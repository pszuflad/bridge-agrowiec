// Dziedziczenie linku do zdjęcia po marce+modelu — ticket 202-FEATURE-link-zdjecia-po-modelu.
//
// ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT. Produkcja ma tylko pamięć linków (`applyLinkMemory` w
// `legacy/bridge_ext.cjs`, po kodzie albo marce+modelu+ROZMIARZE) i tylko przy akceptacji
// stagingu. Tu dochodzi dopasowanie po marce+modelu BEZ rozmiaru, wyłącznie z linków, które już
// są w katalogu (decyzje użytkownika, 2026-10-09): bierzemy link najczęstszy dla pary, przy
// remisie najmniejszy alfabetycznie; niepustego linku nigdy nie ruszamy; produktu z poprawką
// Marty (`manual_overrides.fieldName = 'linkZdjecia'`) też nie; uzupełniony link zapisujemy
// jako poprawkę, żeby import dostawcy go nie nadpisał.
//
// Logika żyje poza `legacy/` i `bridge-ext.ts` (most do portu pilnowanego sha256) i jest wołana
// z `akceptacja.ts`/`bulk.ts` TUŻ PO `applyLinkMemory`, więc pamięć linków wygrywa z tym
// dopasowaniem — ta funkcja działa tylko, gdy `rekord.linkZdjecia` jest nadal pusty.

import { and, eq, sql, type SQL } from "drizzle-orm";

import type { Baza, BazaSqlite } from "../db/index.js";
import { manualOverrides, products } from "../db/schema.js";
import { zapiszPoprawke } from "../repos/overrides.js";

/** Nazwa pola w `manual_overrides` (taka sama jak klucz w `POLA_EDYTOWALNE_PRODUKTU`). */
export const POLE_LINKU = "linkZdjecia";

export function jestPustyLink(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

/** Klucz marka|model, znormalizowany jak `mrKey` w pamięci linków (wielkie litery, zwinięte spacje). */
export function kluczMarkaModel(marka: unknown, model: unknown): string | null {
  const norm = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const m = norm(marka);
  const mod = norm(model);
  if (!m || !mod) return null;
  return `${m}|${mod}`;
}

/** Propozycja linku dla pary marka+model. */
export type PropozycjaLinku = {
  link: string;
  /** Ile produktów ma dokładnie ten link. */
  produktow: number;
  /** Ile RÓŻNYCH linków mają produkty tej pary (1 = jednoznacznie). */
  wariantow: number;
};

/** klucz marka|model → (link → liczba produktów z tym linkiem). */
export type IndeksLinkow = Map<string, Map<string, number>>;

/** Buduje indeks z linków, które już są w katalogu. */
export function zbudujIndeksLinkow(db: Baza, dodatkowyWarunek?: SQL): IndeksLinkow {
  const warunek = sql`${products.linkZdjecia} IS NOT NULL AND TRIM(${products.linkZdjecia}) <> ''`;
  const wiersze = db
    .select({ marka: products.marka, model: products.model, link: products.linkZdjecia })
    .from(products)
    .where(dodatkowyWarunek ? and(warunek, dodatkowyWarunek) : warunek)
    .all();

  const indeks: IndeksLinkow = new Map();
  for (const w of wiersze) {
    const klucz = kluczMarkaModel(w.marka, w.model);
    if (!klucz || w.link === null) continue;
    const link = w.link.trim();
    let linki = indeks.get(klucz);
    if (!linki) {
      linki = new Map();
      indeks.set(klucz, linki);
    }
    linki.set(link, (linki.get(link) ?? 0) + 1);
  }
  return indeks;
}

/**
 * Indeks zawężony do produktów, których model zaczyna się od tego samego pierwszego słowa —
 * tani odpowiednik {@link zbudujIndeksLinkow} dla JEDNEJ pary (akceptacja pojedynczej pozycji
 * nie skanuje całego katalogu). Dokładne dopasowanie robi dalej `kluczMarkaModel` w JS.
 */
export function zbudujIndeksLinkowDlaPary(db: Baza, model: unknown): IndeksLinkow {
  const pierwszeSlowo = String(model ?? "").trim().split(/\s+/)[0] ?? "";
  if (!pierwszeSlowo) return new Map();
  const wzorzec = `${pierwszeSlowo.replace(/[\\%_]/g, "\\$&")}%`;
  return zbudujIndeksLinkow(db, sql`${products.model} LIKE ${wzorzec} ESCAPE '\\'`);
}

/** Najczęstszy link pary; remis rozstrzyga najmniejszy alfabetycznie (wynik deterministyczny). */
export function znajdzPropozycje(
  indeks: IndeksLinkow,
  marka: unknown,
  model: unknown,
): PropozycjaLinku | null {
  const klucz = kluczMarkaModel(marka, model);
  if (!klucz) return null;
  const linki = indeks.get(klucz);
  if (!linki || linki.size === 0) return null;

  let najlepszy: string | null = null;
  let ile = 0;
  for (const [link, liczba] of linki) {
    if (liczba > ile || (liczba === ile && najlepszy !== null && link < najlepszy)) {
      najlepszy = link;
      ile = liczba;
    }
  }
  return najlepszy === null ? null : { link: najlepszy, produktow: ile, wariantow: linki.size };
}

/** Czy produkt (dostawca+kod) ma poprawkę Marty na linku — także pustą (= celowe wyczyszczenie). */
function maPoprawkeLinku(db: Baza, dostawca: unknown, kod: unknown): boolean {
  if (typeof dostawca !== "string" || typeof kod !== "string") return false;
  return !!db
    .select({ id: manualOverrides.id })
    .from(manualOverrides)
    .where(
      and(
        eq(manualOverrides.supplierKod, dostawca),
        eq(manualOverrides.supplierProductId, kod),
        eq(manualOverrides.fieldName, POLE_LINKU),
      ),
    )
    .get();
}

/**
 * Wpięcie w ścieżkę zapisu (`akceptacja.ts`, `bulk.ts`) — TUŻ PO `applyLinkMemory`. MUTUJE
 * `rekord`. Zwraca `true` tylko, gdy faktycznie uzupełniła link; wtedy wołający po zapisie
 * produktu woła {@link zapiszPoprawkeLinku}.
 */
export function applyLinkDziedziczony(
  db: Baza,
  rekord: Record<string, unknown>,
  indeks?: IndeksLinkow,
): boolean {
  if (!jestPustyLink(rekord.linkZdjecia)) return false;
  if (kluczMarkaModel(rekord.marka, rekord.model) === null) return false;
  if (maPoprawkeLinku(db, rekord.dostawca, rekord.kod)) return false;

  const propozycja = znajdzPropozycje(
    indeks ?? zbudujIndeksLinkowDlaPary(db, rekord.model),
    rekord.marka,
    rekord.model,
  );
  if (!propozycja) return false;
  rekord.linkZdjecia = propozycja.link;
  return true;
}

/** Zapisuje uzupełniony link jako poprawkę Marty — import dostawcy go nie nadpisze. */
export function zapiszPoprawkeLinku(
  db: Baza,
  dostawca: string,
  kod: string,
  link: string,
  uzytkownikId: number | null = null,
): void {
  zapiszPoprawke(db, {
    supplierKod: dostawca,
    supplierProductId: kod,
    fieldName: POLE_LINKU,
    overrideValue: link,
    reason: "automatyczne uzupełnienie linku po marce i modelu",
    createdBy: uzytkownikId,
    createdAt: new Date().toISOString(),
  });
}

/** Jedna propozycja dla produktu z katalogu (podgląd). */
export type PropozycjaKatalogu = PropozycjaLinku & {
  id: number;
  kod: string;
  dostawca: string;
  nazwa: string | null;
  marka: string | null;
  model: string | null;
};

/** Wynik podglądu: propozycje + ile produktów pominięto i dlaczego. */
export type PodgladUzupelnieniaLinkow = {
  wszystkichPustych: number;
  pominietoPoprawka: number;
  pominietoBrakDanych: number;
  pominietoBrakDopasowania: number;
  propozycje: PropozycjaKatalogu[];
};

/** Produkty z pustym linkiem + podział na te, którym da się coś zaproponować, i resztę. */
export function proponujLinkiKatalogu(db: Baza): PodgladUzupelnieniaLinkow {
  const kandydaci = db
    .select({
      id: products.id,
      kod: products.kod,
      dostawca: products.dostawca,
      nazwa: products.nazwa,
      marka: products.marka,
      model: products.model,
    })
    .from(products)
    .where(sql`${products.linkZdjecia} IS NULL OR TRIM(${products.linkZdjecia}) = ''`)
    .all();

  const poprawki = new Set(
    db
      .select({ d: manualOverrides.supplierKod, k: manualOverrides.supplierProductId })
      .from(manualOverrides)
      .where(eq(manualOverrides.fieldName, POLE_LINKU))
      .all()
      .map((p) => `${p.d}\u0000${p.k}`),
  );
  const indeks = zbudujIndeksLinkow(db);

  const wynik: PodgladUzupelnieniaLinkow = {
    wszystkichPustych: kandydaci.length,
    pominietoPoprawka: 0,
    pominietoBrakDanych: 0,
    pominietoBrakDopasowania: 0,
    propozycje: [],
  };
  for (const p of kandydaci) {
    if (poprawki.has(`${p.dostawca}\u0000${p.kod}`)) {
      wynik.pominietoPoprawka++;
      continue;
    }
    if (kluczMarkaModel(p.marka, p.model) === null) {
      wynik.pominietoBrakDanych++;
      continue;
    }
    const propozycja = znajdzPropozycje(indeks, p.marka, p.model);
    if (!propozycja) {
      wynik.pominietoBrakDopasowania++;
      continue;
    }
    wynik.propozycje.push({ ...propozycja, ...p });
  }
  return wynik;
}

export type WynikUzupelnieniaLinkow = {
  zaktualizowano: number;
  /** Id z listy, które nie są już kandydatami (ktoś w międzyczasie uzupełnił link / zmienił dane). */
  pominiete: number;
};

/**
 * Zapis uzupełnienia dla produktów z katalogu. Przelicza propozycje od nowa (nie ufa danym
 * z podglądu) i zapisuje tylko te, które nadal są kandydatami; `ids` zawęża do wybranych w
 * podglądzie. Jedna transakcja: albo wszystko, albo nic. Wspólna dla trasy i skryptu CLI.
 */
export function uzupelnijLinkiWstecznie(
  db: Baza,
  sqlite: BazaSqlite,
  opcje: { ids?: number[]; uzytkownikId?: number | null } = {},
): WynikUzupelnieniaLinkow {
  const wybrane = opcje.ids ? new Set(opcje.ids) : null;
  const wynik: WynikUzupelnieniaLinkow = { zaktualizowano: 0, pominiete: 0 };

  sqlite.transaction(() => {
    const { propozycje } = proponujLinkiKatalogu(db);
    const doZapisu = wybrane ? propozycje.filter((p) => wybrane.has(p.id)) : propozycje;
    if (wybrane) {
      const zapisywane = new Set(doZapisu.map((p) => p.id));
      for (const id of wybrane) if (!zapisywane.has(id)) wynik.pominiete++;
    }
    for (const p of doZapisu) {
      db.update(products).set({ linkZdjecia: p.link }).where(eq(products.id, p.id)).run();
      zapiszPoprawkeLinku(db, p.dostawca, p.kod, p.link, opcje.uzytkownikId ?? null);
      wynik.zaktualizowano++;
    }
  })();

  return wynik;
}

/**
 * Podpowiedź dla pozycji stagingu (szczegóły pozycji). `null`, gdy pozycja ma już link — także
 * z poprawki Marty, w tym pustej (celowe wyczyszczenie) — albo nic nie pasuje.
 */
export function propozycjaLinkuDlaPozycji(
  db: Baza,
  pozycja: { dostawca: string; kod: string; snapshotJson: string | null },
): PropozycjaLinku | null {
  let snapshot: Record<string, unknown> = {};
  if (pozycja.snapshotJson) {
    try {
      snapshot = JSON.parse(pozycja.snapshotJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (!jestPustyLink(snapshot.linkZdjecia)) return null;
  if (maPoprawkeLinku(db, pozycja.dostawca, pozycja.kod)) return null;
  return znajdzPropozycje(zbudujIndeksLinkowDlaPary(db, snapshot.model), snapshot.marka, snapshot.model);
}
