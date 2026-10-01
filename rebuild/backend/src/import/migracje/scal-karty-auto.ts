// Ticket 177 — Etap 1 SPEC „Naprawa kolejki stagingu (2026-10-01)”: scalenie zdublowanych kart
// `MO*_AUTO_<hash>` (A) z kartami o prawdziwym kodzie dostawcy (R).
//
// ⚠ NOWA LOGIKA, NIE PORT. Do zmiany nr 172 („DOT jako cecha zmienna tej samej pozycji”) inny DOT
// zakładał kartę AUTO, a kartę z prawdziwym kodem wstrzymywał. Po 172 oferta dopasowuje się do R,
// A przestaje być widoczna w ofercie (jej stan stoi zamrożony, a sklep sprzedaje wg niego), a każda
// para generuje zgłoszenie „Brak starego kodu…”. Ten moduł robi jednorazową migrację danych.
//
// Ustalenia z użytkowniczką (wiążące): zostaje karta z prawdziwym kodem; gdy obie są w Selly, zostaje
// produkt Selly karty R, a produkt karty A dostaje stan 0 (bez usuwania); karta A znika z `products`
// (kopia w `products_scalone`).
//
// Ticket 180 (decyzja Ani 2026-10-01) — grupy „kilka kart AUTO → jedna karta R”: scalana jest karta AUTO
// z bieżącej oferty (zgłoszenie z kandydatem R), a gdy żadna/kilka — ta jedyna ze stanem > 0. Pozostałe
// karty AUTO ze stanem 0 to duplikaty: znikają z Bridge (kopia w `products_scalone`) i z Selly
// (`usunDuplikatySelly`, wariant albo cały produkt). Gdy któraś z pozostałych ma stan > 0 — grupa do ręcznej.
// Para bez odczytu oferty: dane handlowe R bierzemy z karty A (aktywnej, ze stanem), żeby sklep nie stracił
// towaru do najbliższego importu, który i tak nadpisze je danymi z cennika.
//
// Moduł jest czysty względem I/O poza SQLite — Selly dotyka dopiero `zerujWariantySelly` z wstrzykniętym
// klientem, więc testy nigdy nie wołają prawdziwego sklepu.

import type { BazaSqlite } from "../../db/index.js";
import type { KlientSelly } from "../../selly/klient.js";
import { compatibility, norm } from "../polityka/helpery.js";
import { codeKey } from "../polityka/podstawy.js";
import { zgodnaBezDot } from "../polityka/tolerancja-dopasowania.js";

type Wiersz = Record<string, unknown>;

export type Decyzja = "scal" | "do_recznej" | "usun_duplikat";

export type WierszRaportu = {
  dostawca: string;
  kodAuto: string;
  kodReal: string;
  eanAuto: string;
  eanReal: string;
  stanAuto: number | null;
  /** Stan z ostatniego odczytu oferty (kandydat w zgłoszeniu „Brak starego kodu”), `null` = brak danych. */
  stanOferta: number | null;
  statusReal: string;
  sellyAuto: "tak" | "nie";
  sellyReal: "tak" | "nie";
  akcjaSelly: "brak" | "wyzeruj_wariant_auto" | "przepnij_na_real" | "usun_z_selly";
  overrideKonflikt: string;
  decyzja: Decyzja;
  powod: string;
};

export type WynikScalenia = {
  raport: WierszRaportu[];
  scalono: number;
  doRecznej: number;
  /** Ticket 180: duplikaty AUTO ze stanem 0 usunięte (albo do usunięcia w dry-run). */
  usunieto: number;
};

const AUTO_RE = /^MO\d+_AUTO_/;

const s = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

const kluczKodu = (dostawca: string, v: unknown): string => codeKey(dostawca, v);

/** EAN wygenerowany regułą uzupełniania (tabela `ean_pary`) nie jest „prawdziwym” — nie blokuje scalenia. */
function eanyWygenerowane(sqlite: BazaSqlite): Set<string> {
  try {
    return new Set(
      (sqlite.prepare("SELECT ean FROM ean_pary").all() as { ean: string }[]).map((r) => r.ean),
    );
  } catch {
    return new Set();
  }
}

type OfertaKarty = { stan: number | null; cenaZakupu: number | null; cenaSprzedazy: number | null };

/** Ostatni odczyt oferty dla karty R: kandydat o kodzie R w zgłoszeniu „Brak starego kodu” karty A. */
function ofertaZeZgloszenia(sqlite: BazaSqlite, dostawca: string, kodAuto: string, kodReal: string): OfertaKarty | null {
  const wiersze = sqlite
    .prepare("SELECT snapshot_json FROM staging_items WHERE dostawca=? AND kod=?")
    .all(dostawca, kodAuto) as { snapshot_json: string | null }[];
  for (const w of wiersze) {
    let snap: { _candidates?: Wiersz[] };
    try {
      snap = JSON.parse(w.snapshot_json || "{}") as { _candidates?: Wiersz[] };
    } catch {
      continue;
    }
    const k = (snap._candidates ?? []).find((c) => s(c.kod) === kodReal);
    if (k) {
      return { stan: num(k.stan), cenaZakupu: num(k.cenaZakupu), cenaSprzedazy: num(k.cenaSprzedazy) };
    }
  }
  return null;
}

type Plan = {
  auto: Wiersz;
  real: Wiersz | null;
  oferta: OfertaKarty | null;
  wiersz: WierszRaportu;
};

/** Zestawia pary i decyzje — bez zapisu. */
export function zaplanujScalenie(sqlite: BazaSqlite): Plan[] {
  const wygenerowane = eanyWygenerowane(sqlite);
  const karty = sqlite.prepare("SELECT * FROM products").all() as Wiersz[];
  const auta = karty.filter((p) => AUTO_RE.test(s(p.kod)));
  const poDostawcy = new Map<string, Wiersz[]>();
  for (const p of karty) {
    if (AUTO_RE.test(s(p.kod))) continue;
    const l = poDostawcy.get(s(p.dostawca)) ?? [];
    l.push(p);
    poDostawcy.set(s(p.dostawca), l);
  }
  const sellyKody = new Map<string, number>();
  for (const r of sqlite.prepare("SELECT bridge_kod, COUNT(*) c FROM selly_products GROUP BY bridge_kod").all() as {
    bridge_kod: string;
    c: number;
  }[]) {
    sellyKody.set(r.bridge_kod, r.c);
  }

  const plany: Plan[] = auta.map((auto) => {
    const dostawca = s(auto.dostawca);
    const kodDostawcy = s(auto.kod_dostawcy);
    const kandydaci = kodDostawcy
      ? (poDostawcy.get(dostawca) ?? []).filter(
          (r) => kluczKodu(dostawca, r.kod) === kluczKodu(dostawca, kodDostawcy),
        )
      : [];
    const real = kandydaci.length === 1 ? kandydaci[0]! : null;
    const oferta = real ? ofertaZeZgloszenia(sqlite, dostawca, s(auto.kod), s(real.kod)) : null;
    const wiersz: WierszRaportu = {
      dostawca,
      kodAuto: s(auto.kod),
      kodReal: real ? s(real.kod) : "",
      eanAuto: s(auto.ean),
      eanReal: real ? s(real.ean) : "",
      stanAuto: num(auto.stan),
      stanOferta: oferta?.stan ?? null,
      statusReal: real ? s(real.status) : "",
      sellyAuto: sellyKody.has(s(auto.kod)) ? "tak" : "nie",
      sellyReal: real && sellyKody.has(s(real.kod)) ? "tak" : "nie",
      akcjaSelly: "brak",
      overrideKonflikt: "",
      decyzja: "scal",
      powod: "",
    };
    const odrzuc = (powod: string): Plan => {
      wiersz.decyzja = "do_recznej";
      wiersz.powod = powod;
      return { auto, real, oferta, wiersz };
    };
    if (!kodDostawcy) return odrzuc("karta AUTO bez kod_dostawcy");
    if (!kandydaci.length) return odrzuc("brak karty z prawdziwym kodem");
    if (kandydaci.length > 1) return odrzuc("kilka kart z prawdziwym kodem");
    const r = real!;
    const eA = s(auto.ean);
    const eR = s(r.ean);
    if (eA && eR && eA !== eR && !wygenerowane.has(eA) && !wygenerowane.has(eR)) {
      return odrzuc("różny EAN");
    }
    const zgodne =
      zgodnaBezDot(auto, r) ||
      (compatibility(auto, r).different.length === 0 && compatibility(auto, r).missing.every((k) => k === "dot"));
    if (!zgodne) return odrzuc("cechy karty AUTO i prawdziwej nie są zgodne (marka/rozmiar/model)");
    if (norm(auto.dostawca) !== norm(r.dostawca)) return odrzuc("inny dostawca");
    return { auto, real: r, oferta, wiersz };
  });

  // Dwie karty AUTO na jedną prawdziwą (np. kilka partii DOT) — nie wiadomo, której stan jest właściwy.
  const poReal = new Map<string, Plan[]>();
  for (const p of plany) {
    if (p.wiersz.decyzja !== "scal") continue;
    const l = poReal.get(p.wiersz.kodReal) ?? [];
    l.push(p);
    poReal.set(p.wiersz.kodReal, l);
  }
  const stanAuto = (p: Plan): number => num(p.auto.stan) ?? 0;
  for (const l of poReal.values()) {
    if (l.length < 2) continue;
    // Ticket 180: zwycięzca = karta z bieżącej oferty; remis/brak → jedyna ze stanem > 0.
    const zOferty = l.filter((p) => p.oferta != null);
    const pula = zOferty.length ? zOferty : l;
    const zeStanem = pula.filter((p) => stanAuto(p) > 0);
    const zwyciezca = pula.length === 1 ? pula[0]! : zeStanem.length === 1 ? zeStanem[0]! : null;
    const reszta = l.filter((p) => p !== zwyciezca);
    if (!zwyciezca || reszta.some((p) => stanAuto(p) > 0)) {
      for (const p of l) {
        p.wiersz.decyzja = "do_recznej";
        p.wiersz.powod = "kilka kart AUTO wskazuje tę samą prawdziwą kartę";
      }
      continue;
    }
    for (const p of reszta) {
      p.wiersz.decyzja = "usun_duplikat";
      p.wiersz.powod = `duplikat karty ${zwyciezca.wiersz.kodAuto} ze stanem 0 — usunięcie z Bridge i Selly`;
      p.wiersz.akcjaSelly = p.wiersz.sellyAuto === "tak" ? "usun_z_selly" : "brak";
    }
  }

  // Akcja Selly i konflikty poprawek — informacja do raportu.
  for (const p of plany) {
    if (p.wiersz.decyzja !== "scal") continue;
    const w = p.wiersz;
    w.akcjaSelly =
      w.sellyAuto === "tak" && w.sellyReal === "tak"
        ? "wyzeruj_wariant_auto"
        : w.sellyAuto === "tak"
          ? "przepnij_na_real"
          : "brak";
    const poleA = sqlite
      .prepare("SELECT field_name FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?")
      .all(w.dostawca, w.kodAuto) as { field_name: string }[];
    const poleR = new Set(
      (
        sqlite
          .prepare("SELECT field_name FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?")
          .all(w.dostawca, w.kodReal) as { field_name: string }[]
      ).map((r) => r.field_name),
    );
    w.overrideKonflikt = poleA
      .map((r) => r.field_name)
      .filter((f) => poleR.has(f))
      .join(";");
  }
  return plany;
}

const NAGLOWEK = [
  "dostawca",
  "kod_auto",
  "kod_real",
  "ean_auto",
  "ean_real",
  "stan_auto",
  "stan_oferta",
  "status_real",
  "selly_auto",
  "selly_real",
  "akcja_selly",
  "override_konflikt",
  "decyzja",
];

const csv = (v: unknown): string => {
  const t = v == null ? "" : String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV raportu (kolumny jak w specyfikacji; `decyzja` = `scal` albo `do_recznej: <powód>`). */
export function raportCsv(raport: WierszRaportu[]): string {
  const linie = raport.map((w) =>
    [
      w.dostawca,
      w.kodAuto,
      w.kodReal,
      w.eanAuto,
      w.eanReal,
      w.stanAuto,
      w.stanOferta,
      w.statusReal,
      w.sellyAuto,
      w.sellyReal,
      w.akcjaSelly,
      w.overrideKonflikt,
      w.decyzja === "scal" ? "scal" : `${w.decyzja}: ${w.powod}`,
    ]
      .map(csv)
      .join(","),
  );
  return [NAGLOWEK.join(","), ...linie].join("\n") + "\n";
}

function przetworzPare(sqlite: BazaSqlite, p: Plan, teraz: string): void {
  const { auto, real: r, wiersz: w } = p;
  const real = r!;
  // Ticket 180: bez odczytu oferty — dane handlowe z karty A, o ile ma stan (import i tak je nadpisze).
  const oferta: OfertaKarty | null =
    p.oferta ??
    ((num(auto.stan) ?? 0) > 0
      ? { stan: num(auto.stan), cenaZakupu: num(auto.cena_zakupu), cenaSprzedazy: num(auto.cena_sprzedazy) }
      : null);
  const kodA = w.kodAuto;
  const kodR = w.kodReal;
  const dostawca = w.dostawca;

  // 1. Dane handlowe karty R z ostatniego odczytu oferty (nie z zamrożonej karty A).
  if (oferta && oferta.stan != null) {
    const sets: string[] = ["stan=?", "data_aktualizacji=?"];
    const par: unknown[] = [oferta.stan, teraz];
    if (oferta.cenaZakupu != null && oferta.cenaZakupu > 0) {
      sets.push("cena_zakupu=?");
      par.push(oferta.cenaZakupu);
    }
    if (oferta.cenaSprzedazy != null && oferta.cenaSprzedazy > 0) {
      sets.push("cena_sprzedazy=?");
      par.push(oferta.cenaSprzedazy);
    }
    // Powrót do aktywnych tylko ze stanem > 0; przy stanie 0 karta zostaje jak była (ze znacznikiem
    // wstrzymania automatycznego, więc import przywróci ją sam, gdy towar wróci).
    if (oferta.stan > 0 && s(real.status) !== "aktywny") {
      sets.push("status='aktywny'");
      sqlite
        .prepare("DELETE FROM product_auto_suspensions WHERE supplier=? AND product_code=?")
        .run(dostawca, kodR);
    }
    sqlite.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id=?`).run(...par, real.id);
  }

  // 2. Pola ręczne i pamięci.
  const poprawkiA = sqlite
    .prepare("SELECT * FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?")
    .all(dostawca, kodA) as Wiersz[];
  const polaR = new Set(
    (
      sqlite
        .prepare("SELECT field_name FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?")
        .all(dostawca, kodR) as { field_name: string }[]
    ).map((x) => x.field_name),
  );
  for (const o of poprawkiA) {
    if (!polaR.has(s(o.field_name))) {
      sqlite.prepare("UPDATE manual_overrides SET supplier_product_id=? WHERE id=?").run(kodR, o.id);
    }
  }
  if (!s(real.kod_importu) && s(auto.kod_importu)) {
    sqlite.prepare("UPDATE products SET kod_importu=? WHERE id=?").run(s(auto.kod_importu), real.id);
    real.kod_importu = auto.kod_importu;
  }
  const kiR = s(real.kod_importu);
  const kiA = s(auto.kod_importu);
  if (kiA && kiR && kiA !== kiR) {
    sqlite
      .prepare(
        "INSERT OR IGNORE INTO nazwa_pamiec (kod_importu, nazwa, updated_at, source) " +
          "SELECT ?, nazwa, updated_at, source FROM nazwa_pamiec WHERE kod_importu=?",
      )
      .run(kiR, kiA);
  }
  sqlite
    .prepare(
      "INSERT OR IGNORE INTO waga_pamiec (kod, waga, updated_at, source) " +
        "SELECT ?, waga, updated_at, source FROM waga_pamiec WHERE kod=?",
    )
    .run(kodR, kodA);
  sqlite
    .prepare(
      "INSERT OR IGNORE INTO link_pamiec_kod (kod, link, updated_at) " +
        "SELECT ?, link, updated_at FROM link_pamiec_kod WHERE kod=?",
    )
    .run(kodR, kodA);

  // 3. Selly.
  const wierszeA = sqlite.prepare("SELECT * FROM selly_products WHERE bridge_kod=?").all(kodA) as Wiersz[];
  const idyR = new Set(
    (sqlite.prepare("SELECT id FROM selly_products WHERE bridge_kod=?").all(kodR) as { id: number }[]).map(
      (x) => x.id,
    ),
  );
  for (const sp of wierszeA) {
    if (idyR.has(Number(sp.id))) continue;
    if (idyR.size) {
      // Obie karty w Selly — zostaje produkt karty R, wariant AUTO do wyzerowania; wiersz do archiwum.
      sqlite
        .prepare(
          "INSERT INTO selly_products_scalone (kod_importu, dostawca, bridge_kod, selly_product_id, " +
            "selly_variant_id, scalono_do, scalono_at) VALUES (?,?,?,?,?,?,?)",
        )
        .run(sp.kod_importu, sp.dostawca, sp.bridge_kod, sp.selly_product_id, sp.selly_variant_id, kodR, teraz);
      sqlite.prepare("DELETE FROM selly_products WHERE id=?").run(sp.id);
    } else {
      // Tylko A w Selly — przepinamy wiersz na R (produkt w sklepie bez zmian).
      sqlite
        .prepare("UPDATE selly_products SET bridge_kod=?, kod_importu=? WHERE id=?")
        .run(kodR, kiR || s(sp.kod_importu), sp.id);
    }
  }

  // 4. Audyt i archiwum karty A (historia_cen / history zostają, tylko do odczytu).
  sqlite
    .prepare(
      "INSERT INTO audit_log (uzytkownik_id, uzytkownik_imie, akcja, encja_typ, encja_id, szczegoly_json, kiedy) " +
        "VALUES (NULL, 'scal-karty-auto', 'scalenie_karty_auto', 'product', ?, ?, ?)",
    )
    .run(kodR, JSON.stringify({ auto: kodA, real: kodR, stanOferta: w.stanOferta, akcjaSelly: w.akcjaSelly }), teraz);

  // 5. Dopasowania i decyzje o nieobecności.
  sqlite.prepare("DELETE FROM staging_matches WHERE supplier=? AND product_code=?").run(dostawca, kodA);
  sqlite
    .prepare(
      "DELETE FROM staging_absence_decisions WHERE supplier=? AND (product_code IN (?,?) OR selected_source_code=?)",
    )
    .run(dostawca, kodA, kodR, kodA);

  // 6. Kolejka.
  sqlite.prepare("DELETE FROM staging_items WHERE dostawca=? AND kod IN (?,?)").run(dostawca, kodA, kodR);

  // 7. Karta A → archiwum → usunięcie. Znacznik wstrzymania A też znika.
  sqlite
    .prepare("INSERT INTO products_scalone (kod, dostawca, scalono_do, scalono_at, wiersz_json) VALUES (?,?,?,?,?)")
    .run(kodA, dostawca, kodR, teraz, JSON.stringify({ produkt: auto, poprawki: poprawkiA }));
  sqlite.prepare("DELETE FROM product_auto_suspensions WHERE supplier=? AND product_code=?").run(dostawca, kodA);
  sqlite.prepare("DELETE FROM products WHERE id=?").run(auto.id);
}

/** Ticket 180: usunięcie duplikatu AUTO (stan 0) — Bridge od razu, Selly oznaczone do `usunDuplikatySelly`. */
function usunDuplikat(sqlite: BazaSqlite, p: Plan, teraz: string): void {
  const { auto, wiersz: w } = p;
  const kodA = w.kodAuto;
  const dostawca = w.dostawca;
  for (const sp of sqlite.prepare("SELECT * FROM selly_products WHERE bridge_kod=?").all(kodA) as Wiersz[]) {
    sqlite
      .prepare(
        "INSERT INTO selly_products_scalone (kod_importu, dostawca, bridge_kod, selly_product_id, " +
          "selly_variant_id, scalono_do, scalono_at, do_usuniecia) VALUES (?,?,?,?,?,?,?,1)",
      )
      .run(s(sp.kod_importu), sp.dostawca, sp.bridge_kod, sp.selly_product_id, sp.selly_variant_id, w.kodReal, teraz);
    sqlite.prepare("DELETE FROM selly_products WHERE id=?").run(sp.id);
  }
  const poprawkiA = sqlite
    .prepare("SELECT * FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?")
    .all(dostawca, kodA) as Wiersz[];
  sqlite.prepare("DELETE FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?").run(dostawca, kodA);
  sqlite
    .prepare(
      "INSERT INTO audit_log (uzytkownik_id, uzytkownik_imie, akcja, encja_typ, encja_id, szczegoly_json, kiedy) " +
        "VALUES (NULL, 'scal-karty-auto', 'usuniecie_duplikatu_auto', 'product', ?, ?, ?)",
    )
    .run(kodA, JSON.stringify({ auto: kodA, real: w.kodReal, powod: w.powod, akcjaSelly: w.akcjaSelly }), teraz);
  sqlite.prepare("DELETE FROM staging_matches WHERE supplier=? AND product_code=?").run(dostawca, kodA);
  sqlite
    .prepare("DELETE FROM staging_absence_decisions WHERE supplier=? AND (product_code=? OR selected_source_code=?)")
    .run(dostawca, kodA, kodA);
  sqlite.prepare("DELETE FROM staging_items WHERE dostawca=? AND kod=?").run(dostawca, kodA);
  sqlite
    .prepare("INSERT INTO products_scalone (kod, dostawca, scalono_do, scalono_at, wiersz_json) VALUES (?,?,?,?,?)")
    .run(kodA, dostawca, w.kodReal, teraz, JSON.stringify({ produkt: auto, poprawki: poprawkiA, usunietyDuplikat: true }));
  sqlite.prepare("DELETE FROM product_auto_suspensions WHERE supplier=? AND product_code=?").run(dostawca, kodA);
  sqlite.prepare("DELETE FROM products WHERE id=?").run(auto.id);
}

/**
 * Wykonuje scalenie (każda para w osobnej transakcji). Backup bazy robi wołający PRZED wywołaniem
 * (`VACUUM INTO`, patrz CLI). Wywołane drugi raz nie ma już czego scalać.
 */
export function zastosujScalenie(sqlite: BazaSqlite, teraz = new Date().toISOString()): WynikScalenia {
  const plany = zaplanujScalenie(sqlite);
  let scalono = 0;
  let usunieto = 0;
  for (const p of plany) {
    if (p.wiersz.decyzja === "usun_duplikat") {
      try {
        sqlite.transaction(() => usunDuplikat(sqlite, p, teraz))();
        usunieto += 1;
      } catch (e) {
        p.wiersz.decyzja = "do_recznej";
        p.wiersz.powod = `błąd przy usuwaniu duplikatu: ${e instanceof Error ? e.message : String(e)}`;
      }
      continue;
    }
    if (p.wiersz.decyzja !== "scal") continue;
    try {
      sqlite.transaction(() => przetworzPare(sqlite, p, teraz))();
      scalono += 1;
    } catch (e) {
      // Np. kolizja UNIQUE w selly_products — para zostaje nietknięta (transakcja się cofnęła).
      p.wiersz.decyzja = "do_recznej";
      p.wiersz.powod = `błąd przy scalaniu: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { raport: plany.map((p) => p.wiersz), scalono, doRecznej: plany.length - scalono - usunieto, usunieto };
}

/** Raport bez zapisu. */
export function raportScalenia(sqlite: BazaSqlite): WynikScalenia {
  const plany = zaplanujScalenie(sqlite);
  const scalono = plany.filter((p) => p.wiersz.decyzja === "scal").length;
  const usunieto = plany.filter((p) => p.wiersz.decyzja === "usun_duplikat").length;
  return { raport: plany.map((p) => p.wiersz), scalono, doRecznej: plany.length - scalono - usunieto, usunieto };
}

export type WynikZerowania = { wyzerowano: number; bledy: number };

/**
 * Ustawia stan 0 na wariantach Selly kart AUTO z `selly_products_scalone` (bez usuwania produktów
 * i wariantów). Klient jest wstrzykiwany; blokada `SELLY_TRYB` działa przez opakowanie klienta.
 */
export async function zerujWariantySelly(
  sqlite: BazaSqlite,
  klient: Pick<KlientSelly, "updateVariant">,
  teraz = new Date().toISOString(),
): Promise<WynikZerowania> {
  const doZrobienia = sqlite
    .prepare("SELECT * FROM selly_products_scalone WHERE wyzerowano_at IS NULL AND selly_variant_id IS NOT NULL " +
        "AND do_usuniecia=0")
    .all() as Wiersz[];
  let wyzerowano = 0;
  let bledy = 0;
  for (const w of doZrobienia) {
    try {
      await klient.updateVariant(Number(w.selly_product_id), Number(w.selly_variant_id), { quantity: 0 });
      sqlite.prepare("UPDATE selly_products_scalone SET wyzerowano_at=?, ostatni_blad=NULL WHERE id=?").run(teraz, w.id);
      wyzerowano += 1;
    } catch (e) {
      sqlite.prepare("UPDATE selly_products_scalone SET ostatni_blad=? WHERE id=?").run(String(e), w.id);
      bledy += 1;
    }
  }
  return { wyzerowano, bledy };
}

export type WynikUsuwania = { usunietoWarianty: number; usunietoProdukty: number; bledy: number };

/**
 * Ticket 180: usuwa z Selly duplikaty AUTO (`selly_products_scalone.do_usuniecia=1`). Wariant, gdy produkt
 * ma inne warianty albo inny wiersz mapowania Bridge; inaczej cały produkt. 404 = już usunięte.
 */
export async function usunDuplikatySelly(
  sqlite: BazaSqlite,
  klient: Pick<KlientSelly, "listVariants" | "deleteVariant" | "deleteProduct">,
  teraz = new Date().toISOString(),
): Promise<WynikUsuwania> {
  const doZrobienia = sqlite
    .prepare("SELECT * FROM selly_products_scalone WHERE do_usuniecia=1 AND usunieto_at IS NULL")
    .all() as Wiersz[];
  const wynik: WynikUsuwania = { usunietoWarianty: 0, usunietoProdukty: 0, bledy: 0 };
  for (const w of doZrobienia) {
    const pid = Number(w.selly_product_id);
    const vid = w.selly_variant_id == null ? null : Number(w.selly_variant_id);
    try {
      const inneMapowania = (
        sqlite.prepare("SELECT COUNT(*) c FROM selly_products WHERE selly_product_id=?").get(pid) as { c: number }
      ).c;
      let inneWarianty = 0;
      if (vid != null) {
        try {
          const lista = await klient.listVariants(pid);
          inneWarianty = (lista?.data ?? []).filter((x) => Number(x.variant_id) !== vid).length;
        } catch (e) {
          if ((e as { status?: number }).status !== 404) throw e;
        }
      }
      try {
        if (vid != null && (inneWarianty > 0 || inneMapowania > 0)) {
          await klient.deleteVariant(pid, vid);
          wynik.usunietoWarianty += 1;
        } else if (inneMapowania === 0) {
          await klient.deleteProduct(pid);
          wynik.usunietoProdukty += 1;
        } else {
          throw new Error(`produkt ${pid} ma inne mapowania Bridge, a wiersz nie ma wariantu — pomijam`);
        }
      } catch (e) {
        if ((e as { status?: number }).status !== 404) throw e;
      }
      sqlite.prepare("UPDATE selly_products_scalone SET usunieto_at=?, ostatni_blad=NULL WHERE id=?").run(teraz, w.id);
    } catch (e) {
      sqlite.prepare("UPDATE selly_products_scalone SET ostatni_blad=? WHERE id=?").run(String(e), w.id);
      wynik.bledy += 1;
    }
  }
  return wynik;
}
