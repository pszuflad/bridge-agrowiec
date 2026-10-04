// Ticket 185 — jednorazowe przypisanie kategorii i zastosowania z pliku CSV
// (`katalog_wszyscy_KATEGORIA_ZASTOSOWANIE_FINAL_2026-09-30`, kolumny Nazwa-produktu, Kategoria, Zastosowanie).
//
// NOWA LOGIKA BIZNESOWA, NIE PORT (decyzje użytkownika, 2026-10-04):
//  • klucz dopasowania to `products.nazwa` (plik nie ma kodu produktu; dokładnie, po `trim`, z rozróżnieniem
//    wielkości liter — ta sama nazwa u kilku dostawców dostaje tę samą parę);
//  • para spoza listy dozwolonych jest PRZENOSZONA według zasady „zastosowanie decyduje o kategorii”
//    (tabela {@link PRZENIESIENIA}) — nie zostawiana triggerom, które zamieniłyby ją po cichu na
//    „Uniwersalne/pozostałe” albo (Rolnicze/Ładowarka) na „Ciągnik”;
//  • nazwa z dwoma różnymi zastosowaniami w tej samej kategorii (Ciągnik vs Uniwersalne/pozostałe)
//    dostaje „Rolnicze / Ciągnik”; 52 nazwy z różnymi kategoriami rozstrzyga tabela
//    {@link ROZSTRZYGNIECIA_NIEJEDNOZNACZNYCH} (wybór Claude'a na polecenie użytkownika); każda inna
//    niejednoznaczność jest POMIJANA i raportowana;
//  • dotychczasowe poprawki Marty (`manual_overrides` na `kategoria`/`zastosowanie`) są nieaktualne (decyzja
//    użytkownika, 2026-10-04): produkty są nadpisywane, a same poprawki USUWANE przy zapisie. Poprawki dodane
//    później działają normalnie.

import type { BazaSqlite } from "../../db/index.js";

const UNIWERSALNE = "Uniwersalne/pozostałe";

type Para = { kategoria: string; zastosowanie: string };

const klucz = (kategoria: string, zastosowanie: string): string => `${kategoria}\t${zastosowanie}`;

/** Pary z pliku spoza listy dozwolonych (po migracji 021) → para docelowa. */
export const PRZENIESIENIA: ReadonlyMap<string, Para> = new Map<string, Para>([
  // Rolnicze → inna kategoria
  [klucz("Rolnicze", "Wózek widłowy"), { kategoria: "Przemysłowe", zastosowanie: "Wózek widłowy" }],
  [klucz("Rolnicze", "Ładowarka"), { kategoria: "Przemysłowe", zastosowanie: "Ładowarka" }],
  [klucz("Rolnicze", "Kompaktor"), { kategoria: "Przemysłowe", zastosowanie: "Kompaktor" }],
  [klucz("Rolnicze", "Koparka"), { kategoria: "Przemysłowe", zastosowanie: "Koparka" }],
  [klucz("Rolnicze", "Oś kierowana"), { kategoria: "Ciężarowe", zastosowanie: "Oś kierowana" }],
  [klucz("Rolnicze", "Forwarder/Harwester"), { kategoria: "Leśne", zastosowanie: "Forwarder/Harwester" }],
  // Przemysłowe → inna kategoria
  [klucz("Przemysłowe", "Przyczepa"), { kategoria: "Rolnicze", zastosowanie: "Przyczepa" }],
  [klucz("Przemysłowe", "Ciągnik"), { kategoria: "Rolnicze", zastosowanie: "Ciągnik" }],
  [klucz("Przemysłowe", "Kosiarka/ogród"), { kategoria: "Rolnicze", zastosowanie: "Kosiarka/ogród" }],
  [klucz("Przemysłowe", "Oś kierowana"), { kategoria: "Ciężarowe", zastosowanie: "Oś kierowana" }],
  [klucz("Przemysłowe", "Oś napędowa"), { kategoria: "Ciężarowe", zastosowanie: "Oś napędowa" }],
  [klucz("Przemysłowe", "Naczepa/przyczepa"), { kategoria: "Ciężarowe", zastosowanie: "Naczepa/przyczepa" }],
  // Ciężarowe — zmiana zastosowania w tej samej kategorii
  [klucz("Ciężarowe", "Przyczepa"), { kategoria: "Ciężarowe", zastosowanie: "Naczepa/przyczepa" }],
  [klucz("Ciężarowe", "Ciągnik"), { kategoria: "Ciężarowe", zastosowanie: "Oś kierowana" }],
  // Leśne — zmiana zastosowania w tej samej kategorii
  [klucz("Leśne", "Ciągnik"), { kategoria: "Leśne", zastosowanie: "Ciągnik leśny" }],
  [klucz("Leśne", "Przyczepa"), { kategoria: "Leśne", zastosowanie: UNIWERSALNE }],
]);


/**
 * Rozstrzygnięcia 52 nazw, które w pliku mają DWIE różne pary (np. Ciężarowe/Oś kierowana vs Oś napędowa).
 * Decyzja użytkownika: „przypisz do której uważasz” — wybór Claude'a wg rodzaju opony (model/bieżnik):
 * KLS/HS/AS FRONT = oś kierowana/ciągnik, KLD/DL = napędowa, HT = naczepa, XMCL/POWER CL/DURA-UT = ładowarka-koparka,
 * AGRO FORESTRY = leśne itd. Zawsze jedna z dwóch par z pliku. Najmniej pewne (do wglądu): Mitas NB 38 i SK-02,
 * Alliance 570/585/324/323, Nokian TRI 2, Michelin BIBLOAD. Zmiana: edycja tej tabeli i
 * `npm run generuj-migracje-przypisania`.
 */
export const ROZSTRZYGNIECIA_NIEJEDNOZNACZNYCH: ReadonlyMap<string, string> = new Map<string, string>([
  ["18.4-26 GTK AS100 150A6 16PR TT", "Rolnicze / Ciągnik"],
  ["460/70R24 MICHELIN XMCL 159A8/159B TL", "Przemysłowe / Koparka"],
  ["480/80-26 MICHELIN POWER CL 167A8 12PR TL", "Przemysłowe / Koparka"],
  ["440/80-24 MICHELIN POWER CL 168A8 TL", "Przemysłowe / Koparka"],
  ["400/80-24 MICHELIN POWER CL 162A8 20PR TL", "Przemysłowe / Koparka"],
  ["710/50R26.5 MITAS AGRITERRA ULTRA 170D TL SB", "Rolnicze / Przyczepa"],
  ["405/70-24 MITAS MPT-04 152B 14PR TL", "Przemysłowe / Ładowarka"],
  ["10.00-20 MITAS NB 38 146B 16PR TT", "Przemysłowe / Ładowarka"],
  ["31X15.50-15 MITAS SK-02 8PR TL", "Rolnicze / Przyczepa"],
  ["23X8.50-12 MITAS SK-02 115A4 10PR TL", "Rolnicze / Przyczepa"],
  ["6.50-16 CULTOR AS FRONT 08 97A6/89A8 8PR TT", "Rolnicze / Ciągnik"],
  ["265/70R19.5 LINGLONG KLS200 140/138M 16PR TL M+S 3PMSF", "Ciężarowe / Oś kierowana"],
  ["245/70R19.5 LINGLONG KLS200 136/134M 16PR TL M+S 3PMSF", "Ciężarowe / Oś kierowana"],
  ["265/70R17.5 LINGLONG KLS200 140/138M 16PR TL M+S 3PMSF", "Ciężarowe / Oś kierowana"],
  ["315/70R22.5 KUMHO KXA31 156/150L 20PR TL 3PMSF", "Ciężarowe / All position"],
  ["315/70R22.5 KUMHO KLD23 154/150L 18PR TL 3PMSF", "Ciężarowe / Oś napędowa"],
  ["295/80R22.5 KUMHO KXS10 154/149L 18PR TL 3PMSF", "Ciężarowe / All position"],
  ["315/70R22.5 HANKOOK DL51 154/150L M+S 3PMSF", "Ciężarowe / Oś napędowa"],
  ["385/65R22.5 CONTINENTAL CONTI HYBRID HT5 HL 164K 20PR TL M+S 3PMSF", "Ciężarowe / Naczepa/przyczepa"],
  ["295/80R22.5 CONTINENTAL CONTI HYBRID HS5 154/149M 16PR TL M+S 3PMSF", "Ciężarowe / Oś kierowana"],
  ["265/70R19.5 CONTINENTAL CONTI HYBRID HT3+ 143/141K 16PR TL M+S 3PMSF", "Ciężarowe / Naczepa/przyczepa"],
  ["460/70R24 FIRESTONE R8000 UTILITY 159A8/159B TL", "Przemysłowe / Ładowarka"],
  ["7.50-20 CULTOR AS FRONT 08 109A6/101A8 8PR TT", "Rolnicze / Ciągnik"],
  ["365/80R20 CONTINENTAL MPT 81 152K TL M+S", "Przemysłowe / Uniwersalne/pozostałe"],
  ["500/70R24 ALLIANCE 580 164A8/164B TL", "Przemysłowe / Ładowarka"],
  ["440/80R28 FIRESTONE DURA-UT 156A8 TL", "Przemysłowe / Ładowarka"],
  ["500/70R24 FIRESTONE DURA-UT 164A/164B TL", "Przemysłowe / Koparka"],
  ["405/70R18 FIRESTONE DURA-UT 141B", "Przemysłowe / Ładowarka"],
  ["400/80-24 ALLIANCE TOUGH TRAC 325 162A8 TL", "Przemysłowe / Uniwersalne/pozostałe"],
  ["440/80R28 NOKIAN TRI 2 156A8/151D SB TL", "Przemysłowe / Uniwersalne/pozostałe"],
  ["460/70R24 ALLIANCE 585 159A8/159B SB TL", "Przemysłowe / Uniwersalne/pozostałe"],
  ["23X8.50-12 TRELLEBORG T463 10PR TL", "Rolnicze / Kosiarka/ogród"],
  ["500/70-24 MICHELIN POWER CL 164A8 TL", "Przemysłowe / Koparka"],
  ["700/40-22.5 ALLIANCE 328 16PR TL", "Rolnicze / Przyczepa"],
  ["400/70R20 MICHELIN BIBLOAD 149A8/149B TL", "Przemysłowe / Koparka"],
  ["380/75R20 MICHELIN XMCL 148A8/148B TL", "Przemysłowe / Koparka"],
  ["800/65R32 ALLIANCE 360 181A8/178B TL", "Rolnicze / Kombajn"],
  ["18.4-34 NOKIAN TR FOREST 14PR TT", "Leśne / Forwarder/Harwester"],
  ["600/65R28 GRI GREEN XLR 65 154D/157A8 R-1W TL", "Rolnicze / Ciągnik"],
  ["710/70R38 ALLIANCE AGRO FORESTRY 670 175A2/168A8 SB TL", "Leśne / Ciągnik leśny"],
  ["480/70-34 ALLIANCE AGRO FORESTRY 670 146A8/143B SB TL", "Leśne / Ciągnik leśny"],
  ["19.5R24 ALLIANCE 570 156A8/153B SB TL", "Przemysłowe / Uniwersalne/pozostałe"],
  ["17.5-24 ALLIANCE 570 12PR TL", "Przemysłowe / Uniwersalne/pozostałe"],
  ["15.5/80-24 ALLIANCE AGRI NOVA 157A8 12PR TL", "Rolnicze / Uniwersalne/pozostałe"],
  ["460/85-38 ALLIANCE AGRO FORESTRY 333 154A8/151B 14PR SB TL", "Leśne / Forwarder/Harwester"],
  ["380/85-24 ALLIANCE AGRO FORESTRY 333 137A8/134B 14PR SB TL", "Leśne / Forwarder/Harwester"],
  ["480/45-17 ALLIANCE FARM PRO 327 134A8/146A8 14PR TL", "Rolnicze / Przyczepa"],
  ["380/55-17 ALLIANCE FARM PRO 327 125A8/138A8 12PR TL", "Rolnicze / Przyczepa"],
  ["7.50-16 ALLIANCE 324 112A6 8PR TT", "Rolnicze / Uniwersalne/pozostałe"],
  ["405/70-24 ALLIANCE TRACTION INDUSTRIAL 323 152B 14PR TL", "Przemysłowe / Uniwersalne/pozostałe"],
  ["28L-26 NOKIAN LOGGER KING TRS-2 SF 20PR TL", "Leśne / Skidder"],
  ["385/55R22.5 DUNLOP SP346 160K/158L TL M+S 3PMSF", "Ciężarowe / All position"],
]);

/** „Kategoria / Zastosowanie” → para. */
function paraZTekstu(t: string): Para {
  const i = t.indexOf(" / ");
  return { kategoria: t.slice(0, i), zastosowanie: t.slice(i + 3) };
}

export type WierszPliku = { nazwa: string; kategoria: string; zastosowanie: string };

/** Minimalny parser CSV (cudzysłowy, `""`, CRLF, BOM) — plik ma kolumny z przecinkami w nazwach. */
export function parsujCsv(tekst: string): string[][] {
  const wiersze: string[][] = [];
  let pole = "";
  let wiersz: string[] = [];
  let wCudzyslowie = false;
  const t = tekst.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (wCudzyslowie) {
      if (c === '"' && t[i + 1] === '"') {
        pole += '"';
        i++;
      } else if (c === '"') wCudzyslowie = false;
      else pole += c;
    } else if (c === '"') wCudzyslowie = true;
    else if (c === ",") {
      wiersz.push(pole);
      pole = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      wiersz.push(pole);
      pole = "";
      if (wiersz.some((p) => p !== "")) wiersze.push(wiersz);
      wiersz = [];
    } else pole += c;
  }
  if (pole !== "" || wiersz.length) {
    wiersz.push(pole);
    wiersze.push(wiersz);
  }
  return wiersze;
}

/** Wiersze pliku (nagłówek: `Nazwa-produktu`, `Kategoria`, `Zastosowanie`). */
export function wierszePliku(tekstCsv: string): WierszPliku[] {
  const [naglowek = [], ...dane] = parsujCsv(tekstCsv);
  const kol = (n: string): number => {
    const i = naglowek.indexOf(n);
    if (i < 0) throw new Error(`W pliku brak kolumny „${n}”`);
    return i;
  };
  const [iNazwa, iKat, iZast] = [kol("Nazwa-produktu"), kol("Kategoria"), kol("Zastosowanie")];
  return dane.map((w) => ({
    nazwa: (w[iNazwa] ?? "").trim(),
    kategoria: (w[iKat] ?? "").trim(),
    zastosowanie: (w[iZast] ?? "").trim(),
  }));
}

/** Para po przeniesieniu: wpis z {@link PRZENIESIENIA} albo para z pliku bez zmian. */
export function paraDocelowa(kategoria: string, zastosowanie: string): Para {
  return PRZENIESIENIA.get(klucz(kategoria, zastosowanie)) ?? { kategoria, zastosowanie };
}

export type PlanNazwy =
  | { nazwa: string; status: "ok"; para: Para }
  | { nazwa: string; status: "niejednoznaczna"; pary: Para[] };

/** Jedna docelowa para na nazwę; niejednoznaczność rozstrzyga tylko reguła Ciągnik/Uniwersalne. */
export function zaplanujNazwy(wiersze: readonly WierszPliku[]): PlanNazwy[] {
  const poNazwie = new Map<string, Map<string, Para>>();
  for (const w of wiersze) {
    const p = paraDocelowa(w.kategoria, w.zastosowanie);
    const m = poNazwie.get(w.nazwa) ?? new Map<string, Para>();
    m.set(klucz(p.kategoria, p.zastosowanie), p);
    poNazwie.set(w.nazwa, m);
  }
  const plan: PlanNazwy[] = [];
  for (const [nazwa, m] of poNazwie) {
    const pary = [...m.values()];
    const [pierwsza] = pary;
    if (pary.length === 1 && pierwsza) {
      plan.push({ nazwa, status: "ok", para: pierwsza });
      continue;
    }
    const tylkoRolniczeCiagnikLubUniwersalne =
      pary.length === 2 &&
      pary.every(
        (p) =>
          p.kategoria === "Rolnicze" && (p.zastosowanie === "Ciągnik" || p.zastosowanie === UNIWERSALNE),
      );
    if (tylkoRolniczeCiagnikLubUniwersalne) {
      plan.push({ nazwa, status: "ok", para: { kategoria: "Rolnicze", zastosowanie: "Ciągnik" } });
    } else {
      const reczne = ROZSTRZYGNIECIA_NIEJEDNOZNACZNYCH.get(nazwa);
      const wybrana = reczne === undefined ? undefined : paraZTekstu(reczne);
      if (wybrana && pary.some((p) => klucz(p.kategoria, p.zastosowanie) === klucz(wybrana.kategoria, wybrana.zastosowanie))) {
        plan.push({ nazwa, status: "ok", para: wybrana });
      } else {
        plan.push({ nazwa, status: "niejednoznaczna", pary });
      }
    }
  }
  return plan;
}

export type WpisPrzypisania = { nazwa: string; kategoria: string; zastosowanie: string };

/** Jednoznaczne przypisania nazwa → para (posortowane po nazwie); niejednoznaczne są pomijane. */
export function tabelaPrzypisania(wiersze: readonly WierszPliku[]): WpisPrzypisania[] {
  const wynik: WpisPrzypisania[] = [];
  for (const n of zaplanujNazwy(wiersze)) {
    if (n.status === "ok") wynik.push({ nazwa: n.nazwa, ...n.para });
  }
  return wynik.sort((x, y) => (x.nazwa < y.nazwa ? -1 : x.nazwa > y.nazwa ? 1 : 0));
}

export type ZmianaProduktu = {
  kod: string;
  dostawca: string;
  nazwa: string;
  staraKategoria: string;
  stareZastosowanie: string;
  kategoria: string;
  zastosowanie: string;
};

export type PlanPrzypisania = {
  zmiany: ZmianaProduktu[];
  juzZgodnych: number;
  niejednoznaczne: PlanNazwy[];
  nazwyBezProduktu: string[];
};

export function zaplanujPrzypisanie(sqlite: BazaSqlite, wiersze: readonly WierszPliku[]): PlanPrzypisania {
  const produkty = sqlite
    .prepare("SELECT kod, dostawca, nazwa, kategoria, zastosowanie FROM products")
    .all() as { kod: string; dostawca: string; nazwa: string; kategoria: string; zastosowanie: string | null }[];
  const poNazwie = new Map<string, typeof produkty>();
  for (const p of produkty) {
    const lista = poNazwie.get(p.nazwa.trim()) ?? [];
    lista.push(p);
    poNazwie.set(p.nazwa.trim(), lista);
  }

  const wynik: PlanPrzypisania = { zmiany: [], juzZgodnych: 0, niejednoznaczne: [], nazwyBezProduktu: [] };
  for (const n of zaplanujNazwy(wiersze)) {
    if (n.status === "niejednoznaczna") {
      wynik.niejednoznaczne.push(n);
      continue;
    }
    const prods = poNazwie.get(n.nazwa);
    if (!prods) {
      wynik.nazwyBezProduktu.push(n.nazwa);
      continue;
    }
    for (const p of prods) {
      const stareZast = p.zastosowanie ?? "";
      if (p.kategoria === n.para.kategoria && stareZast === n.para.zastosowanie) {
        wynik.juzZgodnych++;
        continue;
      }
      wynik.zmiany.push({
        kod: p.kod,
        dostawca: p.dostawca,
        nazwa: n.nazwa,
        staraKategoria: p.kategoria,
        stareZastosowanie: stareZast,
        kategoria: n.para.kategoria,
        zastosowanie: n.para.zastosowanie,
      });
    }
  }
  return wynik;
}

export type WynikZapisu = { zapisano: number; poprawioneTriggerem: ZmianaProduktu[]; usunietePoprawki: number };

/**
 * Zapis planu (jedna transakcja) + wpisy do `history` (źródło `przypisanie-kat-zast`).
 * Po zapisie czyta wartość z bazy: triggery `products_zastosowanie_*` mogą jeszcze skorygować parę
 * spoza listy — takie przypadki wracają w `poprawioneTriggerem` (przy poprawnej tabeli przeniesień: puste).
 */
export function zastosujPrzypisanie(sqlite: BazaSqlite, plan: PlanPrzypisania, kto = "Anna"): WynikZapisu {
  const teraz = new Date().toISOString().replace("T", " ").slice(0, 19);
  const upd = sqlite.prepare("UPDATE products SET kategoria = ?, zastosowanie = ? WHERE dostawca = ? AND kod = ?");
  const odczyt = sqlite.prepare("SELECT kategoria, zastosowanie FROM products WHERE dostawca = ? AND kod = ?");
  const hist = sqlite.prepare(
    "INSERT INTO history (data, kod_produktu, nazwa, pole, stara_wartosc, nowa_wartosc, zrodlo, kto) VALUES (?,?,?,?,?,?,?,?)",
  );
  const wynik: WynikZapisu = { zapisano: 0, poprawioneTriggerem: [], usunietePoprawki: 0 };
  sqlite.transaction(() => {
    for (const z of plan.zmiany) {
      upd.run(z.kategoria, z.zastosowanie, z.dostawca, z.kod);
      const po = odczyt.get(z.dostawca, z.kod) as { kategoria: string; zastosowanie: string | null };
      const poZast = po.zastosowanie ?? "";
      if (po.kategoria !== z.staraKategoria) {
        hist.run(teraz, z.kod, z.nazwa, "kategoria", z.staraKategoria, po.kategoria, "przypisanie-kat-zast", kto);
      }
      if (poZast !== z.stareZastosowanie) {
        hist.run(teraz, z.kod, z.nazwa, "zastosowanie", z.stareZastosowanie, poZast, "przypisanie-kat-zast", kto);
      }
      if (po.kategoria !== z.kategoria || poZast !== z.zastosowanie) wynik.poprawioneTriggerem.push(z);
      wynik.zapisano++;
    }
    wynik.usunietePoprawki = sqlite
      .prepare("DELETE FROM manual_overrides WHERE field_name IN ('kategoria', 'zastosowanie')")
      .run().changes;
  })();
  return wynik;
}

export function raportPrzypisaniaCsv(plan: PlanPrzypisania): string {
  const esc = (t: string): string => `"${t.replace(/"/g, '""')}"`;
  const linie = ["kod,dostawca,nazwa,stara_kategoria,stare_zastosowanie,kategoria,zastosowanie,status"];
  for (const z of plan.zmiany) {
    linie.push(
      [z.kod, z.dostawca, z.nazwa, z.staraKategoria, z.stareZastosowanie, z.kategoria, z.zastosowanie, "zmiana"]
        .map(esc)
        .join(","),
    );
  }
  for (const n of plan.niejednoznaczne) {
    if (n.status !== "niejednoznaczna") continue;
    const opis = n.pary.map((p) => `${p.kategoria}/${p.zastosowanie}`).join(" | ");
    linie.push(["", "", n.nazwa, "", "", "", opis, "niejednoznaczna_pominieta"].map(esc).join(","));
  }
  for (const nazwa of plan.nazwyBezProduktu) {
    linie.push(["", "", nazwa, "", "", "", "", "brak_produktu_w_bazie"].map(esc).join(","));
  }
  return linie.join("\n");
}
