// Ticket 185 — jednorazowe przypisanie kategorii i zastosowania z pliku CSV
// (`katalog_wszyscy_KATEGORIA_ZASTOSOWANIE_FINAL_2026-09-30`, kolumny Nazwa-produktu, Kategoria, Zastosowanie).
//
// NOWA LOGIKA BIZNESOWA, NIE PORT (decyzje użytkownika, 2026-10-04):
//  • klucz dopasowania to `products.nazwa` (plik nie ma kodu produktu);
//  • para spoza listy dozwolonych jest PRZENOSZONA według zasady „zastosowanie decyduje o kategorii”
//    (tabela {@link PRZENIESIENIA}) — nie zostawiana triggerom, które zamieniłyby ją po cichu na
//    „Uniwersalne/pozostałe” albo (Rolnicze/Ładowarka) na „Ciągnik”;
//  • nazwa z dwoma różnymi zastosowaniami w tej samej kategorii (Ciągnik vs Uniwersalne/pozostałe)
//    dostaje „Rolnicze / Ciągnik”; każda inna niejednoznaczność jest POMIJANA i raportowana;
//  • produkt z poprawką Marty (`manual_overrides`) na `kategoria` lub `zastosowanie` nie jest ruszany —
//    ręczna decyzja wygrywa.

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
      plan.push({ nazwa, status: "niejednoznaczna", pary });
    }
  }
  return plan;
}

export type ZmianaProduktu = {
  kod: string;
  dostawca: string;
  nazwa: string;
  staraKategoria: string;
  stareZastosowanie: string;
  kategoria: string;
  zastosowanie: string;
  status: "zmiana" | "pominieta_poprawka_reczna";
};

export type PlanPrzypisania = {
  zmiany: ZmianaProduktu[];
  juzZgodnych: number;
  niejednoznaczne: PlanNazwy[];
  nazwyBezProduktu: string[];
};

const POLA_CHRONIONE = new Set(["kategoria", "zastosowanie"]);

export function zaplanujPrzypisanie(sqlite: BazaSqlite, wiersze: readonly WierszPliku[]): PlanPrzypisania {
  const chronione = new Set<string>();
  for (const o of sqlite
    .prepare("SELECT supplier_kod, supplier_product_id, field_name FROM manual_overrides")
    .all() as { supplier_kod: string; supplier_product_id: string; field_name: string }[]) {
    if (POLA_CHRONIONE.has(o.field_name.toLowerCase())) {
      chronione.add(`${o.supplier_kod}\u0000${o.supplier_product_id}`);
    }
  }

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
        status: chronione.has(`${p.dostawca}\u0000${p.kod}`) ? "pominieta_poprawka_reczna" : "zmiana",
      });
    }
  }
  return wynik;
}

export type WynikZapisu = { zapisano: number; poprawioneTriggerem: ZmianaProduktu[] };

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
  const wynik: WynikZapisu = { zapisano: 0, poprawioneTriggerem: [] };
  sqlite.transaction(() => {
    for (const z of plan.zmiany) {
      if (z.status !== "zmiana") continue;
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
  })();
  return wynik;
}

export function raportPrzypisaniaCsv(plan: PlanPrzypisania): string {
  const esc = (t: string): string => `"${t.replace(/"/g, '""')}"`;
  const linie = ["kod,dostawca,nazwa,stara_kategoria,stare_zastosowanie,kategoria,zastosowanie,status"];
  for (const z of plan.zmiany) {
    linie.push(
      [z.kod, z.dostawca, z.nazwa, z.staraKategoria, z.stareZastosowanie, z.kategoria, z.zastosowanie, z.status]
        .map(esc)
        .join(","),
    );
  }
  for (const n of plan.niejednoznaczne) {
    if (n.status !== "niejednoznaczna") continue;
    const opis = n.pary.map((p) => `${p.kategoria}/${p.zastosowanie}`).join(" | ");
    linie.push(["", "", n.nazwa, "", "", "", opis, "niejednoznaczna_pominieta"].map(esc).join(","));
  }
  return linie.join("\n");
}
