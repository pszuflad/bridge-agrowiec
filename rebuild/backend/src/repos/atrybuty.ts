// Słownik atrybutów — tabele `atrybuty_rodzaje` i `atrybuty_wartosci`.
//
// Port `mirror/backend/atrybuty_module.cjs` (`registerAtrybuty`, 308 linii). Ten moduł NIE
// JEST częścią rdzenia backendu: `grep "'/api/atrybuty" mirror/backend/index.cjs` daje zero
// trafień, a klaster atrybutów w `index.cjs:295` (`ATTR_CORE_KINDS`, `listAtrybuty`,
// `upsertAtrybutRodzaj`…) jest MARTWY — żadna trasa go nie rejestruje. Żywy kod ładuje
// `extensions.cjs:114`. Potwierdza to `docs/spec-backend.md:31`.
//
// `ensureSchema()` z oryginału NIE jest portowane: kanoniczny `rebuild/schema/001_schema.sql`
// ma już obie tabele, i to w wersji ZUNIFIKOWANEJ (z `origin`/`utworzono`). W produkcji
// istniały dwie rozjeżdżone definicje `atrybuty_wartosci` — moduł tworzył ją bez tych kolumn,
// rdzeń z nimi; kto pierwszy wystartował, ten ustawiał kształt. Odtwarzanie tego wyścigu
// w runtime byłoby przeniesieniem defektu, a nie zachowania API.

import { and, eq, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { atrybutyRodzaje, atrybutyWartosci } from "../db/schema.js";

/** Rodzaj atrybutu z `utworzony` — kształt z `GET /api/atrybuty` (`:105`). */
export type RodzajZeZnacznikiem = {
  value: string;
  label: string;
  opis: string | null;
  core: number;
  utworzony: string;
};

/** Rodzaj BEZ `utworzony` — kształt z `GET /api/atrybuty/rodzaje` (`:116`). */
export type Rodzaj = Omit<RodzajZeZnacznikiem, "utworzony">;

/** Wartość słownika — ten sam kształt w obu trasach (`:106`, `:189`). */
export type Wartosc = {
  id: number;
  rodzaj: string;
  wartosc: string;
};

/**
 * Mapa rodzaj atrybutu → kolumna `products` (port `:251-267`, **15 pozycji**).
 *
 * ⚠ TO NIE JEST TA SAMA MAPA, CO W KOLEJCE PENDING. `repos/atrybuty-pending.ts` ma własną,
 * 13-pozycyjną: dokładny PODZBIÓR tej mapy, bez `model` i `zastosowanie` (`wentyl` i cała
 * reszta są w obu). Rozbieżność jest w oryginale — dwa moduły pisano osobno — i ma widoczny skutek: dla pozycji pending rodzaju `model` albo
 * `zastosowanie` akceptacja z edycją zwróciłaby 400 „Nieznany rodzaj". W praktyce takie
 * pozycje nie powstają, bo skan ich nie tworzy. Nie unifikujemy map — unifikacja zmieniłaby
 * zachowanie obu tras naraz.
 */
export const RODZAJ_KOLUMNA = {
  marka: "marka",
  kategoria: "kategoria",
  konstrukcja: "konstrukcja",
  vfIf: "vf_if",
  bieznik: "bieznik",
  rodzaj: "rodzaj",
  model: "model",
  indeks_nosnosci: "indeks_nosnosci",
  indeks_predkosci: "indeks_predkosci",
  oznaczenie_bieznika: "oznaczenie_bieznika",
  rozmiar: "rozmiar",
  sezon: "sezon",
  tl_tt: "tl_tt",
  wentyl: "wentyl",
  zastosowanie: "zastosowanie",
} as const satisfies Record<string, string>;

export type RodzajSlownika = keyof typeof RODZAJ_KOLUMNA;

/** Czy napis jest znanym rodzajem — jedyna droga od `req.query` do nazwy kolumny. */
export function znanyRodzaj(rodzaj: unknown): rodzaj is RodzajSlownika {
  return typeof rodzaj === "string" && Object.hasOwn(RODZAJ_KOLUMNA, rodzaj);
}

/**
 * Rodzaje z `utworzony` — `GET /api/atrybuty` (`:105`).
 * `ORDER BY core DESC, label`: wbudowane na górze, reszta alfabetycznie.
 */
export function listaRodzajowZeZnacznikiem(db: Baza): RodzajZeZnacznikiem[] {
  return db.all<RodzajZeZnacznikiem>(sql`
    SELECT value, label, opis, core, utworzony
    FROM atrybuty_rodzaje
    ORDER BY core DESC, label
  `);
}

/**
 * Rodzaje BEZ `utworzony` — `GET /api/atrybuty/rodzaje` (`:116`).
 *
 * ⚠ Różnica pól wobec `listaRodzajowZeZnacznikiem` JEST REALNA, nie jest artefaktem
 * sanityzacji fixture'a: SELECT w `:116` po prostu nie pobiera `utworzony`. Widać to
 * w obu nagraniach — `GET_atrybuty.json` ma to pole, `GET_atrybuty_rodzaje.json` nie.
 * Odtwarzamy dosłownie; front 7b nie może liczyć na `utworzony` z tej trasy.
 */
export function listaRodzajow(db: Baza): Rodzaj[] {
  return db.all<Rodzaj>(sql`
    SELECT value, label, opis, core
    FROM atrybuty_rodzaje
    ORDER BY core DESC, label
  `);
}

/**
 * Wartości słownika — `GET /api/atrybuty/wartosci?rodzaj=` (`:188-191`).
 * Bez filtra sortowanie jest dwupoziomowe, z filtrem — po samej wartości.
 */
export function listaWartosci(db: Baza, rodzaj?: string): Wartosc[] {
  if (rodzaj) {
    return db.all<Wartosc>(sql`
      SELECT id, rodzaj, wartosc FROM atrybuty_wartosci WHERE rodzaj = ${rodzaj} ORDER BY wartosc
    `);
  }
  return db.all<Wartosc>(sql`
    SELECT id, rodzaj, wartosc FROM atrybuty_wartosci ORDER BY rodzaj, wartosc
  `);
}

/**
 * Slug `value` z etykiety, gdy front go nie poda (port `:132-136`).
 *
 * Kolejność zamian jest z oryginału razem z jej dziurami: `ś` i `š` idą do `s`, ale np. `ü`
 * czy `ß` nie mają reguły i wpadną w `[^a-z0-9]+` → `_`. Nie poprawiamy tego — slug trafia
 * do klucza głównego, więc każda zmiana mapowania rozjechałaby istniejące rekordy.
 */
export function slugRodzaju(label: string): string {
  return label
    .toLowerCase()
    .replace(/[ąàáâ]/g, "a")
    .replace(/[ćč]/g, "c")
    .replace(/[ęè]/g, "e")
    .replace(/ł/g, "l")
    .replace(/ń/g, "n")
    .replace(/[óòöô]/g, "o")
    .replace(/[śš]/g, "s")
    .replace(/[żź]/g, "z")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

/** Jeden rodzaj po kluczu — do sprawdzeń 404/403 w trasach. */
export function rodzajPoValue(db: Baza, value: string): Rodzaj | undefined {
  return db
    .select({
      value: atrybutyRodzaje.value,
      label: atrybutyRodzaje.label,
      opis: atrybutyRodzaje.opis,
      core: atrybutyRodzaje.core,
    })
    .from(atrybutyRodzaje)
    .where(eq(atrybutyRodzaje.value, value))
    .get();
}

/** Czy rodzaj w ogóle istnieje (`:203`). */
export function czyRodzajIstnieje(db: Baza, value: string): boolean {
  return rodzajPoValue(db, value) !== undefined;
}

/** Nowy rodzaj — zawsze `core = 0` (`:141`). Duplikat klucza wychodzi wyjątkiem UNIQUE. */
export function dodajRodzaj(db: Baza, dane: { value: string; label: string; opis?: string }): void {
  db.insert(atrybutyRodzaje)
    .values({ value: dane.value, label: dane.label, opis: dane.opis || null, core: 0 })
    .run();
}

/**
 * Edycja rodzaju (`:159-160`).
 *
 * ⚠ `COALESCE` na PUSTYM napisie: oryginał podaje `label || null`, więc `""` znaczy „nie
 * zmieniaj", a nie „wyczyść". ⚠ `core` NIE BLOKUJE edycji — wbudowany rodzaj można
 * przemianować (blokada jest tylko na usunięciu, `:174`).
 */
export function zmienRodzaj(
  db: Baza,
  value: string,
  dane: { label?: unknown; opis?: unknown },
): void {
  const label = typeof dane.label === "string" && dane.label ? dane.label : null;
  const opis = typeof dane.opis === "string" && dane.opis ? dane.opis : null;
  db.run(sql`
    UPDATE atrybuty_rodzaje
    SET label = COALESCE(${label}, label), opis = COALESCE(${opis}, opis)
    WHERE value = ${value}
  `);
}

/**
 * Usunięcie rodzaju (`:175`). Wartości znikają KASKADĄ z klucza obcego
 * (`atrybuty_wartosci.rodzaj REFERENCES atrybuty_rodzaje(value) ON DELETE CASCADE`) —
 * działa, bo `db/index.ts:18` włącza `PRAGMA foreign_keys = ON`, tak jak oryginał (`:93`).
 */
export function usunRodzaj(db: Baza, value: string): void {
  db.delete(atrybutyRodzaje).where(eq(atrybutyRodzaje.value, value)).run();
}

/** Nowa wartość (`:207`). Zwraca `id` z `lastInsertRowid` — zwykły AUTOINCREMENT. */
export function dodajWartosc(db: Baza, rodzaj: string, wartosc: string): Wartosc {
  const wynik = db
    .insert(atrybutyWartosci)
    .values({ rodzaj, wartosc })
    .returning({ id: atrybutyWartosci.id })
    .get();
  return { id: wynik.id, rodzaj, wartosc };
}

/** Zmiana wartości (`:224`). Zwraca liczbę zmienionych wierszy — 0 znaczy 404. */
export function zmienWartosc(db: Baza, id: number, wartosc: string): number {
  const wynik = db
    .update(atrybutyWartosci)
    .set({ wartosc })
    .where(eq(atrybutyWartosci.id, id))
    .run();
  return wynik.changes;
}

/** Wartość po `id` — trasa DELETE potrzebuje jej do audytu (`:240`). */
export function wartoscPoId(db: Baza, id: number): { rodzaj: string; wartosc: string } | undefined {
  return db
    .select({ rodzaj: atrybutyWartosci.rodzaj, wartosc: atrybutyWartosci.wartosc })
    .from(atrybutyWartosci)
    .where(eq(atrybutyWartosci.id, id))
    .get();
}

/** Usunięcie wartości (`:242`). */
export function usunWartosc(db: Baza, id: number): void {
  db.delete(atrybutyWartosci).where(eq(atrybutyWartosci.id, id)).run();
}

/** Czy para (rodzaj, wartość) jest już w słowniku — używa tego akceptacja aliasu (`:321-323`). */
export function czyWartoscWKatalogu(db: Baza, rodzaj: string, wartosc: string): boolean {
  const wiersz = db
    .select({ id: atrybutyWartosci.id })
    .from(atrybutyWartosci)
    .where(and(eq(atrybutyWartosci.rodzaj, rodzaj), eq(atrybutyWartosci.wartosc, wartosc)))
    .get();
  return wiersz !== undefined;
}

/** Mapa `"<rodzaj>::<wartosc>" → liczba produktów` — `GET /api/atrybuty/liczniki`. */
export type LicznikiAtrybutow = Record<string, number>;

/**
 * Liczniki użycia (`:270-286`).
 *
 * ⚠ Odpowiedź jest GOŁĄ MAPĄ, bez `ok` — jedyna taka trasa w module (`res.json(wynik)`
 * zamiast `res.json({ok:true, …})`). Potwierdza to `contract/fixtures/GET_atrybuty_liczniki.json`.
 *
 * ⚠ Wyjątek z pojedynczej kolumny jest POŁYKANY (`continue`, `:277`): gdyby kolumna zniknęła
 * ze schematu, ten rodzaj po prostu wypada z wyniku, a trasa zwraca 200. Odtwarzamy to,
 * bo inaczej jedna brakująca kolumna wywracałaby całą trasę — ale znaczy to też, że pusta
 * mapa NIE dowodzi braku danych (ta sama pułapka, co `safeAll()` w analityce, `CLAUDE.md`).
 *
 * `sql.raw` dostaje nazwę kolumny wyłącznie ze stałej `RODZAJ_KOLUMNA`; droga z `req.query`
 * tu nie istnieje.
 */
export function licznikiAtrybutow(db: Baza): LicznikiAtrybutow {
  const wynik: LicznikiAtrybutow = {};
  for (const [rodzaj, kolumna] of Object.entries(RODZAJ_KOLUMNA)) {
    const kol = sql.raw(kolumna);
    let wiersze: { w: string; c: number }[];
    try {
      wiersze = db.all<{ w: string; c: number }>(sql`
        SELECT ${kol} AS w, COUNT(*) AS c
        FROM products
        WHERE ${kol} IS NOT NULL AND ${kol} != ''
        GROUP BY ${kol}
      `);
    } catch {
      continue;
    }
    for (const wiersz of wiersze) {
      wynik[`${rodzaj}::${wiersz.w}`] = wiersz.c;
    }
  }
  return wynik;
}

/** Produkt na liście użycia atrybutu (`:298`). */
export type ProduktUzycia = {
  dostawca: string;
  kod: string;
  nazwa: string;
  marka: string;
  rozmiar: string | null;
  stan: number;
};

/**
 * Produkty używające danej wartości atrybutu (`:296-298`).
 *
 * ⚠ `count` pochodzi z OSOBNEGO `COUNT(*)` bez limitu, a lista jest ucięta do 200 — dla
 * popularnej marki `count` będzie więc większy niż `products.length`. To zastane zachowanie,
 * front 7b musi je uwzględnić przy komunikacie „pokazano X z Y".
 */
export function uzycieAtrybutu(
  db: Baza,
  rodzaj: RodzajSlownika,
  wartosc: string,
): { count: number; products: ProduktUzycia[] } {
  const kol = sql.raw(RODZAJ_KOLUMNA[rodzaj]);
  const licznik = db.get<{ c: number }>(sql`
    SELECT COUNT(*) AS c FROM products WHERE ${kol} = ${wartosc}
  `);
  const produkty = db.all<ProduktUzycia>(sql`
    SELECT dostawca, kod, nazwa, marka, rozmiar, stan
    FROM products
    WHERE ${kol} = ${wartosc}
    ORDER BY nazwa
    LIMIT 200
  `);
  return { count: licznik?.c ?? 0, products: produkty };
}

/** Sześć wbudowanych rodzajów seedowanych z `core = 1` (port `CORE_RODZAJE`, `:19-26`). */
const CORE_RODZAJE: { value: string; label: string; opis: string }[] = [
  { value: "marka", label: "Marka", opis: "Producent opon (Alliance, Michelin, BKT...)" },
  {
    value: "kategoria",
    label: "Kategoria",
    opis: "Rolnicze, Leśne, Przemysłowe, Ciężarowe, Dętki, Akcesoria",
  },
  { value: "konstrukcja", label: "Konstrukcja", opis: "R (radialna), D (diagonalna), B (bias-belted)" },
  { value: "vfIf", label: "VF / IF / CFO", opis: "Specjalne technologie nośności" },
  { value: "bieznik", label: "Bieżnik", opis: "Wzór bieżnika opony" },
  { value: "rodzaj", label: "Rodzaj produktu", opis: "Opona / dętka / koło itp." },
];

/** Domyślne wartości trzech rodzajów (port `CORE_WARTOSCI`, `:29-34`). */
const CORE_WARTOSCI: Record<string, string[]> = {
  kategoria: ["Rolnicze", "Leśne", "Przemysłowe", "Ciężarowe", "Dętki", "Akcesoria"],
  konstrukcja: ["R", "D", "B"],
  vfIf: ["VF", "IF", "CFO", "CHO", "NRO"],
};

/**
 * Seed słownika — port `seed()` (`:61-84`), wołany w `registerAtrybuty:99`, czyli przy KAŻDYM
 * starcie procesu. Decyzja użytkownika (plan.md D1): odtwarzamy 1:1, razem z konsekwencjami.
 *
 * ⚠ „BIEŻNIK Z MODELU" JEST W ORYGINALE (`:80-83`) i nie jest literówką w naszym porcie:
 * słownik `bieznik` zasilany jest z `products.model`, choć `products` ma osobną kolumnę
 * `bieznik`. Skutek uboczny widać wprost w `contract/fixtures/GET_atrybuty_pending.json`:
 * pozycja pending „AGRI STAR II" ma sugerowany alias o `podobienstwo: 100` — samą siebie,
 * bo seed wsypał tę wartość do katalogu z `products.model` już PO utworzeniu wpisu pending,
 * a skan nigdy nie usuwa nieaktualnych pozycji. Zmiana źródła kolumny naprawiłaby ten quirk,
 * ale rozjechałaby zawartość słownika z produkcją.
 *
 * ⚠ Seed rośnie z każdym importem: nowa marka w `products` po restarcie wchodzi do katalogu
 * automatycznie, a wartość obecna w katalogu jest przy skanie POMIJANA — seed realnie steruje
 * tym, co Ania zobaczy w kolejce pending.
 *
 * Oba SELECT-y z `products` są w `try/catch` jak w oryginale („products może nie istnieć
 * w testach", `:78`).
 */
export function zasiejSlownikAtrybutow(db: Baza): void {
  for (const rodzaj of CORE_RODZAJE) {
    db.run(sql`
      INSERT OR IGNORE INTO atrybuty_rodzaje (value, label, opis, core)
      VALUES (${rodzaj.value}, ${rodzaj.label}, ${rodzaj.opis}, 1)
    `);
  }

  const wstawWartosc = (rodzaj: string, wartosc: string): void => {
    db.run(sql`
      INSERT OR IGNORE INTO atrybuty_wartosci (rodzaj, wartosc) VALUES (${rodzaj}, ${wartosc})
    `);
  };

  for (const [rodzaj, wartosci] of Object.entries(CORE_WARTOSCI)) {
    for (const wartosc of wartosci) wstawWartosc(rodzaj, wartosc);
  }

  try {
    const marki = db.all<{ marka: string }>(sql`
      SELECT DISTINCT marka FROM products WHERE marka IS NOT NULL AND marka != '' ORDER BY marka
    `);
    for (const m of marki) wstawWartosc("marka", m.marka);
  } catch {
    /* products może nie istnieć — jak w oryginale (`:78`) */
  }

  try {
    const biezniki = db.all<{ model: string }>(sql`
      SELECT DISTINCT model FROM products WHERE model IS NOT NULL AND model != '' ORDER BY model
    `);
    for (const b of biezniki) wstawWartosc("bieznik", b.model);
  } catch {
    /* jw. (`:83`) */
  }
}
