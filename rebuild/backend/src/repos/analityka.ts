// Analityka — agregaty czytane przez `/api/analytics/*` (blok 10a).
//
// Port `mirror/backend/analytics_module.cjs`. To NIE jest zdeminifikowany bundle, tylko
// czytelne źródło modułu doklejanego do `index.cjs` — numery linii w komentarzach odnoszą
// się do niego i są stabilne.
//
// ⚠ ZAKRES 10a TO PIĘĆ Z DWUDZIESTU SIEDMIU TRAS MODUŁU. Pozostałe dwadzieścia dwie
// (ceny, EAN, dostawcy, dostępność, rotacja, cykl życia, export) dowożą bloki 10b–10f.
// Dokładając je tutaj, trzymaj się układu tego pliku: jedna funkcja = jedna trasa,
// SQL przepisany dosłownie, limity i progi jako nazwane stałe.
//
// ⚠ CZEGO TU NIE MA I BYĆ NIE MOŻE: pola `_przyciete`. W `contract/fixtures/` ono jest,
// ale to adnotacja NAGRYWARKI fixtures (`contract/README.md:29` — duże tablice przycięto
// do 5 elementów, 27 MB → 247 KB), a nie pole odpowiedzi produkcji. Handler oryginału
// zwraca gołe tablice. Dorzucenie `_przyciete` do odpowiedzi wywaliłoby GATE, bo
// `test/gate/ksztalt.ts` zgłasza klucz nadmiarowy w odpowiedzi jako RÓŻNICĘ.

import { sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";

/**
 * Limity list filtrów — 1:1 z `analytics_module.cjs:98-107`.
 *
 * Nie są symetryczne i nie ma w tym pomyłki: `dostawcy` idą bez limitu (jest ich kilkanaście),
 * `marki` mają 500, dwie największe listy po 1000, a oba indeksy po 300. Fixture potwierdza,
 * że produkcja realnie dobija do limitu przy `modele` (1000), `rozmiary` (1000)
 * i `indeksyNosnosci` (300) — to nie są listy, które da się wygodnie przewinąć,
 * stąd wymóg wyszukiwarki w kontrolce filtra po stronie frontendu.
 */
const LIMITY_FILTROW = {
  dostawcy: null,
  marki: 500,
  modele: 1000,
  rozmiary: 1000,
  indeksyNosnosci: 300,
  indeksyPredkosci: 300,
} as const;

/** Kolumna `products`, z której pochodzi każda z sześciu list. */
const KOLUMNY_FILTROW = {
  dostawcy: "dostawca",
  marki: "marka",
  modele: "model",
  rozmiary: "rozmiar",
  indeksyNosnosci: "indeks_nosnosci",
  indeksyPredkosci: "indeks_predkosci",
} as const;

export type NazwaFiltru = keyof typeof KOLUMNY_FILTROW;

/** Nazwa kolumny dopuszczonej do `sql.raw` — domknięta zbiorem wartości `KOLUMNY_FILTROW`. */
type KolumnaFiltru = (typeof KOLUMNY_FILTROW)[NazwaFiltru];

/** Pozycja listy filtra — kolumna jest aliasowana na `value`, tak jak w oryginale. */
export type WartoscFiltru = { value: string };

export type ListyFiltrow = Record<NazwaFiltru, WartoscFiltru[]>;

/**
 * Jedna lista `DISTINCT` — wspólny kształt sześciu zapytań z `:98-107`.
 *
 * `sql.raw` dostaje nazwę kolumny WYŁĄCZNIE ze stałej `KOLUMNY_FILTROW` — i pilnuje tego
 * TYP `KolumnaFiltru`, nie komentarz: dowolny inny napis nie skompiluje się w wywołaniu.
 * Drogi z `req.query` tu nie ma i powstać nie może bez rozszerzenia tego typu.
 */
function listaWartosci(db: Baza, kolumna: KolumnaFiltru, limit: number | null): WartoscFiltru[] {
  const kol = sql.raw(kolumna);
  return db.all<WartoscFiltru>(sql`
    SELECT DISTINCT ${kol} AS value
    FROM products
    WHERE ${kol} IS NOT NULL AND ${kol} != ''
    ORDER BY ${kol}
    ${limit === null ? sql`` : sql`LIMIT ${limit}`}
  `);
}

/**
 * `GET /api/analytics/filters` — sześć list wartości do kontrolek filtra (`:98-107`).
 *
 * Oryginał NIE filtruje po `status='aktywny'` (inaczej niż KPI i marże) — listy obejmują
 * też produkty wycofane. Odtwarzamy to bez zmian.
 */
export function listyFiltrow(db: Baza): ListyFiltrow {
  const wynik = {} as ListyFiltrow;
  for (const nazwa of Object.keys(KOLUMNY_FILTROW) as NazwaFiltru[]) {
    wynik[nazwa] = listaWartosci(db, KOLUMNY_FILTROW[nazwa], LIMITY_FILTROW[nazwa]);
  }
  return wynik;
}

export type StatusHistorii = {
  hasHistory: boolean;
  snapshots: number;
  od: string | null;
  do: string | null;
};

/**
 * `GET /api/analytics/status` — zasięg tabeli `historia_cen` (`:93-96`).
 *
 * Nagłówek widoku `/analityka` mówi tym Ani, czy widoki czasowe mają z czego rysować.
 * Agregat na pustej tabeli zwraca w SQLite jeden wiersz z `COUNT=0` i `NULL`-ami — stąd
 * `hasHistory` liczone z `snapshots > 0`, dokładnie jak `!!(h && h.snapshots > 0)`.
 */
export function statusHistorii(db: Baza): StatusHistorii {
  const wiersz = db.get<{ snapshots: number; od: string | null; do: string | null }>(sql`
    SELECT COUNT(*) AS snapshots,
           MIN(zarejestrowano_at) AS od,
           MAX(zarejestrowano_at) AS do
    FROM historia_cen
  `);

  return {
    hasHistory: !!(wiersz && wiersz.snapshots > 0),
    snapshots: wiersz?.snapshots ?? 0,
    od: wiersz?.od ?? null,
    do: wiersz?.do ?? null,
  };
}

export type Kpi = {
  produkty: number;
  dostawcy: number;
  /** `NULL` przy pustym katalogu — `AVG` nie ma z czego liczyć. */
  avgMarza: number | null;
  stagingPending: number;
};

/**
 * `GET /api/analytics/kpi` — cztery liczby nagłówka (`:325-331`).
 *
 * ⚠ W ORYGINALNYM FRONTENDZIE TA TRASA NIE MA KONSUMENTA. Backend nazywa ją wprost
 * „Backward-compatible aliases used by previous frontend build" (`:324`), a widok
 * `/analityka` (`deminified/frontend-index.js:27804`) liczy swoje cztery kafle z zupełnie
 * innych źródeł (`filters.dostawcy.length`, `ean/comparison`, `ean/unique`, `status`).
 * Nasz nagłówek KPI czyta właśnie tę trasę — świadome odstępstwo O-10a-1, decyzja D3
 * użytkownika z 2026-09-03 (patrz plan.md). Sam kształt odpowiedzi jest 1:1 z fixture'em.
 *
 * Trzy pierwsze liczby patrzą tylko na produkty aktywne, czwarta na niezatwierdzone pozycje
 * stagingu — `zatwierdzono_data IS NULL` obejmuje zarówno pozycje czekające na decyzję,
 * jak i odrzucone, bo oryginał nie rozróżnia ich w tym liczniku.
 */
export function kpi(db: Baza): Kpi {
  const produkty = db.get<{ produkty: number }>(
    sql`SELECT COUNT(*) AS produkty FROM products WHERE status = 'aktywny'`,
  );
  const dostawcy = db.get<{ dostawcy: number }>(
    sql`SELECT COUNT(DISTINCT dostawca) AS dostawcy FROM products WHERE status = 'aktywny'`,
  );
  const marza = db.get<{ avgMarza: number | null }>(
    sql`SELECT ROUND(AVG(marza_pct), 2) AS avgMarza FROM products WHERE status = 'aktywny'`,
  );
  const staging = db.get<{ stagingPending: number }>(
    sql`SELECT COUNT(*) AS stagingPending FROM staging_items WHERE zatwierdzono_data IS NULL`,
  );

  return {
    produkty: produkty?.produkty ?? 0,
    dostawcy: dostawcy?.dostawcy ?? 0,
    avgMarza: marza?.avgMarza ?? null,
    stagingPending: staging?.stagingPending ?? 0,
  };
}

/**
 * Progi marży dla list ostrzegawczych — na twardo w oryginale (`:294-296`), NIE parametry.
 * Fixture ma obie listy puste, bo w chwili nagrywania cały katalog mieścił się w (5, 80).
 */
const PROG_MARZY_NISKIEJ = 5;
const PROG_MARZY_WYSOKIEJ = 80;

/** Limity trzech zapytań marż (`:293-296`). */
const LIMIT_GRUP_MARZY = 1000;
const LIMIT_LISTY_MARZY = 200;

export type GrupaMarzy = {
  dostawca: string;
  kategoria: string;
  marka: string;
  produkty: number;
  avgMarza: number | null;
  minMarza: number | null;
  maxMarza: number | null;
};

export type ProduktMarzy = {
  kod: string;
  nazwa: string;
  dostawca: string;
  cenaZakupu: number;
  cenaSprzedazy: number;
  marzaPct: number;
};

export type Marze = {
  rows: GrupaMarzy[];
  low: ProduktMarzy[];
  high: ProduktMarzy[];
};

/** Wspólne `SELECT` list `low`/`high` — oryginał powtarza je dwa razy, różnią się tylko filtrem. */
function listaProduktowMarzy(
  db: Baza,
  warunek: ReturnType<typeof sql>,
  porzadek: ReturnType<typeof sql>,
): ProduktMarzy[] {
  return db.all<ProduktMarzy>(sql`
    SELECT kod, nazwa, dostawca,
           cena_zakupu AS cenaZakupu,
           cena_sprzedazy AS cenaSprzedazy,
           marza_pct AS marzaPct
    FROM products
    WHERE status = 'aktywny' AND ${warunek}
    ORDER BY ${porzadek}
    LIMIT ${LIMIT_LISTY_MARZY}
  `);
}

/**
 * `GET /api/analytics/margins` — dashboard-wzorzec bloku 10a (`:292-297`).
 *
 * ⚠ ZERO PARAMETRÓW QUERY, i to jest zachowanie oryginału, nie uproszczenie. W module
 * istnieje `currentWhere(q, alias)` (`:60-74`) zbudowana dokładnie pod sześć filtrów
 * katalogu plus `cenaMin`/`cenaMax`/`stan` — i ma ZERO wywołań w całych 27 trasach.
 * Martwego kodu nie ożywiamy (decyzja D2, 2026-09-03): filtrowanie sekcji marż dzieje się
 * po stronie klienta, nad pobranymi wierszami. Gdyby kiedyś miało zejść na backend, musi to
 * być osobna, nazwana decyzja — żaden fixture nie pokrywa odpowiedzi z filtrami.
 *
 * `rows` sortuje się `avgMarza ASC`, czyli najgorsze marże na górze; frontend zachowuje ten
 * porządek i to on decyduje, które grupy trafiają na wykres.
 *
 * `low` i `high` produkcyjny frontend pobiera, ale NIGDY nie renderuje. Dowozimy je, bo
 * są w kształcie odpowiedzi; w UI 10a też się nie pojawiają.
 */
export function marze(db: Baza): Marze {
  const rows = db.all<GrupaMarzy>(sql`
    SELECT dostawca, kategoria, marka,
           COUNT(*) AS produkty,
           ROUND(AVG(marza_pct), 2) AS avgMarza,
           MIN(marza_pct) AS minMarza,
           MAX(marza_pct) AS maxMarza
    FROM products
    WHERE status = 'aktywny'
    GROUP BY dostawca, kategoria, marka
    ORDER BY avgMarza ASC
    LIMIT ${LIMIT_GRUP_MARZY}
  `);

  return {
    rows,
    low: listaProduktowMarzy(
      db,
      sql`marza_pct < ${PROG_MARZY_NISKIEJ}`,
      sql`marza_pct ASC`,
    ),
    high: listaProduktowMarzy(
      db,
      sql`marza_pct > ${PROG_MARZY_WYSOKIEJ}`,
      sql`marza_pct DESC`,
    ),
  };
}

export type WynikBootstrapu = {
  ok: true;
  inserted: number;
  at: string;
};

/**
 * `POST /api/analytics/bootstrap-current` — migawka całego aktywnego katalogu do
 * `historia_cen` (`:81-91`).
 *
 * ⚠ TO NIE JEST OPERACJA IDEMPOTENTNA, i tak jest w produkcji. `INSERT … SELECT` nie ma
 * `ON CONFLICT` ani sprawdzenia, czy migawka z tym znacznikiem już istnieje — drugie
 * wywołanie dokłada DRUGI komplet wierszy, po jednym na każdy aktywny produkt. Nie
 * „naprawiamy" tego: zmiana zachowania trasy wymagałaby osobnej decyzji, a odbudowa
 * odtwarza zastane działanie. Skutek dla UI: trasa świadomie NIE dostaje przycisku
 * (decyzja D4, 2026-09-03) — oryginalny frontend też jej nigdy nie woła.
 *
 * ⚠ TO DRUGI PISARZ `historia_cen`, nie pierwszy. Pierwszym jest gałąź auto-zatwierdzania
 * importu (`repos/historia.ts`, blok 3d-1). Ten pisze partiami po całym katalogu, tamten —
 * po jednym wierszu na auto-zatwierdzoną zmianę.
 *
 * Znacznik czasu jest liczony RAZ dla całej partii i zwracany w odpowiedzi, więc jedno
 * wywołanie daje jedną spójną migawkę, którą da się później wyciąć po `zarejestrowano_at`.
 * Format `toISOString()` (`…T…Z`) — nie `datetime('now')` ze schematu, który dałby
 * `YYYY-MM-DD HH:MM:SS`; fixture `GET_analytics_status.json` potwierdza wariant z `T`/`Z`.
 */
export function zbudujSnapshotBiezacy(db: Baza): WynikBootstrapu {
  const teraz = new Date().toISOString();

  const wynik = db.run(sql`
    INSERT INTO historia_cen (
      produkt_id, kod, ean, dostawca, marka, model, rozmiar,
      indeks_nosnosci, indeks_predkosci, kategoria,
      cena_zakupu, cena_sprzedazy, stan, zarejestrowano_at
    )
    SELECT id, kod, ean, dostawca, marka, model, rozmiar,
           indeks_nosnosci, indeks_predkosci, kategoria,
           cena_zakupu, cena_sprzedazy, stan, ${teraz}
    FROM products
    WHERE status = 'aktywny'
  `);

  return { ok: true, inserted: wynik.changes, at: teraz };
}
