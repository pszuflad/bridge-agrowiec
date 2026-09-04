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

// ─────────────────────────────────────────────────────────────────────────────────────────
// BLOK 10e — dostępność, tempo schodzenia, sezonowość, cykl życia, rotacja, oś czasu importów
// (`analytics_module.cjs:156-184`, `:279-289`, `:299-303`, `:334`).
//
// Sześć tras, TRZY różne koperty odpowiedzi: `{hasHistory, rows}` (cztery z nich),
// `{days, rows}` (rotacja) i GOŁA TABLICA (oś czasu importów). Nie ujednolicamy ich —
// każdy kształt jest potwierdzony osobnym fixture'em.
//
// ⚠ CZTERY Z SZEŚCIU FIXTURES SĄ PUSTE (`availability/products`, `availability/sell-through`,
// `rotation/inactive` mają `rows: []`, `importy-timeline` jest pustą tablicą), a
// `test/gate/ksztalt.ts:50` nie zagląda do elementów pustej tablicy. GATE dowodzi dla nich
// wyłącznie koperty; kształt WIERSZA niesie `test/analityka.dostepnosc.agregaty.test.ts`,
// przepisany z SQL-a oryginału. Zmieniając cokolwiek niżej, zmieniasz kontrakt, którego
// nie pilnuje żadne nagranie produkcji.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Port `safeAll(db, sql, params)` (`:51`) — zapytanie, które RZUCA, oddaje pustą listę.
 *
 * ⚠⚠ TO NIE JEST DEFENSYWA „NA WSZELKI WYPADEK". W oryginale każde z 27 zapytań analityki
 * idzie przez `safeAll`/`safeGet`, a w dwóch trasach TEGO BLOKU ten `catch` jest jedyną
 * rzeczą, która stoi między produkcją a błędem 500 — i widać to w nagraniach:
 *
 *   `historia_cen` NIE MA KOLUMNY `nazwa`. Nie ma jej ani `rebuild/schema/001_schema.sql`,
 *   ani zrzut produkcji `db/schema.sql`, ani `ensureSchema()` samego modułu analityki
 *   (`analytics_module.cjs:24-49`). A `availability/products` (`:161`) i
 *   `availability/sell-through` (`:176`) pytają tę tabelę o `MAX(nazwa)`. SQLite odpowiada
 *   `no such column: nazwa`, `safeAll` połyka wyjątek i obie trasy oddają `rows: []`.
 *
 * Dowód, że tak jest NA PRODUKCJI, a nie tylko u nas: `GET_analytics_status.json` pokazuje
 * 15 597 migawek historii, a `GET_analytics_availability_products.json`
 * i `GET_analytics_availability_sell-through.json` mają mimo to `hasHistory: true`
 * i `rows: []`. Obie karty zakładki „Dostępność" są w produkcji trwale puste.
 *
 * Odtwarzamy to bez zmian — odbudowa odtwarza zastane zachowanie, a naprawa (dołożenie
 * `JOIN products` albo usunięcie kolumny z zapytania) byłaby świadomym odstępstwem, którego
 * nie pokrywa żaden fixture. Sprawa czeka na decyzję w `docs/rebuild-backlog.md`.
 *
 * ⚠ ASYMETRIA WOBEC 10a, ŻEBY NIE ZASKOCZYŁA: pięć funkcji bloku 10a (`filters`, `status`,
 * `kpi`, `margins`, bootstrap) NIE przechodzi przez ten helper — ich zapytania nie mogą się
 * wywrócić na schemacie, więc 10a nie miało powodu go portować. Jeśli kiedyś trzeba będzie
 * ujednolicić, to osobna decyzja, nie skutek uboczny tego bloku.
 */
function bezpiecznieWiersze<T>(db: Baza, zapytanie: ReturnType<typeof sql>): T[] {
  try {
    return db.all<T>(zapytanie);
  } catch {
    return [];
  }
}

/** Limity sześciu zapytań bloku (`:165`, `:181`, `:288`, `:302`, `:334`). */
const LIMIT_DOSTEPNOSCI = 500;
const LIMIT_TEMPA_SCHODZENIA = 500;
const LIMIT_CYKLU_ZYCIA = 1000;
const LIMIT_ROTACJI = 1000;
const LIMIT_OSI_IMPORTOW = 200;

/**
 * Czy `historia_cen` ma choć jeden wiersz — port `hasHistory(db)` (`:58`).
 *
 * Cztery trasy tego bloku rozgałęziają się na tej jednej liczbie i zwracają ją w odpowiedzi,
 * żeby UI wiedziało, czy widok czasowy ma z czego rysować. `statusHistorii` wyżej liczy to
 * samo przy okazji zasięgu dat — osobny helper jest tu dlatego, że oryginał też ma osobny
 * i woła go raz na trasę.
 */
function czyJestHistoria(db: Baza): boolean {
  const wiersz = db.get<{ c: number }>(sql`SELECT COUNT(*) AS c FROM historia_cen`);
  return !!(wiersz && wiersz.c > 0);
}

/** Wiersz „4.1 Historia dostępności" liczony z `historia_cen` (`:160-166`). */
export type WierszDostepnosciZHistorii = {
  kod: string;
  ean: string | null;
  dostawca: string;
  nazwa: string | null;
  /** Ile migawek złożyło się na procent — kolumna istnieje TYLKO w tej gałęzi. */
  snapshoty: number;
  dostepnoscPct: number | null;
  /** Sklejone `GROUP_CONCAT`-em miesiące `YYYY-MM`, w których stan był ≤ 0. */
  miesiaceBrakow: string | null;
};

/** Wiersz tej samej karty liczony z `products`, gdy historii nie ma (`:168`). */
export type WierszDostepnosciZKatalogu = {
  kod: string;
  ean: string | null;
  dostawca: string;
  nazwa: string;
  /** Bieżący stan — kolumna istnieje TYLKO w tej gałęzi. */
  stan: number;
  dostepnoscPct: number;
  miesiaceBrakow: null;
};

export type WierszDostepnosci = WierszDostepnosciZHistorii | WierszDostepnosciZKatalogu;

export type Dostepnosc = { hasHistory: boolean; rows: WierszDostepnosci[] };

/**
 * `GET /api/analytics/availability/products` — „4.1 Historia dostępności pozycji" (`:156-171`).
 *
 * ⚠ DWIE GAŁĘZIE ZWRACAJĄ RÓŻNE KOLUMNY, i to nie jest przeoczenie oryginału do naprawienia.
 * Z historią wiersz niesie `snapshoty` (ile migawek), bez historii — `stan` (bieżący zapas);
 * `miesiaceBrakow` w gałęzi zapasowej jest zawsze `NULL`, bo z jednej migawki nie da się
 * odtworzyć miesięcy braków. Wspólne pozostaje to, co realnie renderuje oryginalna tabela
 * (`frontend-index.js:28437-28455`): dostawca, kod, EAN, nazwa, dostępność, miesiące braków.
 *
 * Sortowanie `dostepnoscPct ASC` w gałęzi z historią i `stan ASC` w zapasowej — obie stawiają
 * na górze pozycje najgorzej dostępne, ale liczą to z innych danych.
 */
export function dostepnoscProduktow(db: Baza): Dostepnosc {
  const jestHistoria = czyJestHistoria(db);

  if (jestHistoria) {
    return {
      hasHistory: true,
      rows: bezpiecznieWiersze<WierszDostepnosciZHistorii>(
        db,
        sql`
        SELECT kod, ean, dostawca, MAX(nazwa) AS nazwa,
               COUNT(*) AS snapshoty,
               ROUND(100.0 * SUM(CASE WHEN stan > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS dostepnoscPct,
               GROUP_CONCAT(CASE WHEN stan <= 0 THEN substr(zarejestrowano_at, 1, 7) END) AS miesiaceBrakow
        FROM historia_cen
        GROUP BY dostawca, kod
        ORDER BY dostepnoscPct ASC
        LIMIT ${LIMIT_DOSTEPNOSCI}
      `),
    };
  }

  return {
    hasHistory: false,
    rows: bezpiecznieWiersze<WierszDostepnosciZKatalogu>(
      db,
      sql`
      SELECT kod, ean, dostawca, nazwa, stan,
             CASE WHEN stan > 0 THEN 100 ELSE 0 END AS dostepnoscPct,
             NULL AS miesiaceBrakow
      FROM products
      WHERE status = 'aktywny'
      ORDER BY stan ASC
      LIMIT ${LIMIT_DOSTEPNOSCI}
    `),
  };
}

/** Wiersz „4.2 Tempo schodzenia z magazynu" (`:180`). */
export type WierszTempaSchodzenia = {
  dostawca: string;
  kod: string;
  nazwa: string | null;
  /** Suma spadków stanu między kolejnymi migawkami; wzrosty liczą się jako zero. */
  zeszloSztuk: number | null;
};

export type TempoSchodzenia = { hasHistory: boolean; rows: WierszTempaSchodzenia[] };

/**
 * `GET /api/analytics/availability/sell-through` — „4.2 Tempo schodzenia z magazynu" (`:173-184`).
 *
 * ⚠⚠ TO ZAPYTANIE JEST W ORYGINALE NIEPOPRAWNE I ODTWARZAMY JE DOSŁOWNIE (decyzja D1
 * użytkownika, 2026-09-03; ticket `25-FEATURE-analityka-dostepnosc-rotacja`).
 *
 * CTE `seq` bierze `stan` GOŁY — bez agregatu — obok `GROUP BY dostawca, kod, zarejestrowano_at`,
 * a funkcja okna `LAG(stan) OVER (…)` liczy się PO tej agregacji. SQLite na to pozwala
 * (SQL92 nie), więc:
 *
 *  • gdy na `(dostawca, kod, zarejestrowano_at)` przypada DOKŁADNIE JEDEN wiersz — a tak jest
 *    w zdecydowanej większości przypadków — `GROUP BY` jest bezczynne i wynik wychodzi
 *    poprawny: `LAG` porównuje kolejne migawki po dacie;
 *  • gdy wierszy jest ≥ 2, SQLite bierze `stan` z ARBITRALNEGO wiersza grupy
 *    (implementation-defined; empirycznie: z wstawionego jako pierwszy), a `MAX(nazwa)`
 *    z całej grupy. Wynik przestaje być określony przez standard.
 *
 * Drugi przypadek JEST osiągalny w tej odbudowie: `import/tk.ts:171,548-564` liczy
 * `zarejestrowanoAt` RAZ na cały import, więc dwie linie tego samego `kod` w jednym cenniku
 * dają dwa wiersze `historia_cen` o identycznym kluczu grupowania. Fixture
 * `GET_analytics_availability_sell-through.json` ma `rows: []`, więc GATE tego nie wykryje —
 * zachowanie charakteryzuje test w `test/analityka.dostepnosc.agregaty.test.ts`, a sprawa
 * czeka na decyzję w `docs/rebuild-backlog.md` (wpis o pułapce `GROUP BY` + `LAG`).
 *
 * Bez historii oryginał NIE MA gałęzi zapasowej — zwraca pustą listę (`:174`).
 */
export function tempoSchodzenia(db: Baza): TempoSchodzenia {
  const jestHistoria = czyJestHistoria(db);
  if (!jestHistoria) return { hasHistory: false, rows: [] };

  return {
    hasHistory: true,
    rows: bezpiecznieWiersze<WierszTempaSchodzenia>(
      db,
      sql`
      WITH seq AS (
        SELECT dostawca, kod, MAX(nazwa) AS nazwa, stan,
               LAG(stan) OVER (PARTITION BY dostawca, kod ORDER BY zarejestrowano_at) AS prev_stan
        FROM historia_cen
        GROUP BY dostawca, kod, zarejestrowano_at
      )
      SELECT dostawca, kod, nazwa,
             SUM(CASE WHEN prev_stan > stan THEN prev_stan - stan ELSE 0 END) AS zeszloSztuk
      FROM seq
      GROUP BY dostawca, kod
      ORDER BY zeszloSztuk DESC
      LIMIT ${LIMIT_TEMPA_SCHODZENIA}
    `),
  };
}

/** Wiersz „4.4 Sezonowy wzorzec cen" (`:281`). Kształt potwierdzony fixture'em. */
export type WierszSezonowosci = {
  /** Sam NUMER miesiąca (`"01"`–`"12"`), bez roku — `substr(zarejestrowano_at, 6, 2)`. */
  miesiac: string;
  /** Pusty napis jest realną wartością: fixture ma wiersz z `marka: ""`. */
  marka: string | null;
  sredniaCena: number | null;
  dostepnoscPct: number | null;
};

export type Sezonowosc = { hasHistory: boolean; rows: WierszSezonowosci[] };

/**
 * `GET /api/analytics/seasonality/monthly` — „4.4 Sezonowy wzorzec cen" (`:279-283`).
 *
 * ⚠ MIESIĄC BEZ ROKU. `substr(zarejestrowano_at, 6, 2)` wycina dwa znaki na pozycji 6, czyli
 * numer miesiąca ze znacznika `YYYY-MM-DD…`. Dane z sierpnia 2025 i sierpnia 2026 wpadną
 * więc do JEDNEJ grupy `"08"` — to jest sens „wzorca sezonowego" i zostaje bez zmian.
 *
 * `WHERE cena_zakupu > 0` odcina migawki bez ceny, żeby nie zaniżały średniej. Jedyna trasa
 * bloku BEZ limitu — oryginał ufa, że dwanaście miesięcy × marki się zmieści.
 */
export function sezonowoscMiesieczna(db: Baza): Sezonowosc {
  const jestHistoria = czyJestHistoria(db);
  if (!jestHistoria) return { hasHistory: false, rows: [] };

  return {
    hasHistory: true,
    rows: bezpiecznieWiersze<WierszSezonowosci>(
      db,
      sql`
      SELECT substr(zarejestrowano_at, 6, 2) AS miesiac, marka,
             ROUND(AVG(cena_zakupu), 2) AS sredniaCena,
             ROUND(AVG(CASE WHEN stan > 0 THEN 100 ELSE 0 END), 2) AS dostepnoscPct
      FROM historia_cen
      WHERE cena_zakupu > 0
      GROUP BY miesiac, marka
      ORDER BY marka, miesiac
    `),
  };
}

/** Wiersz „4.6 Cykl życia modelu" (`:287-288`). Kształt potwierdzony fixture'em. */
export type WierszCykluZycia = {
  marka: string | null;
  model: string;
  pierwszyRaz: string | null;
  ostatniRaz: string | null;
  produkty: number;
};

export type CyklZycia = { hasHistory: boolean; rows: WierszCykluZycia[] };

/**
 * `GET /api/analytics/lifecycle/models` — „4.6 Cykl życia modelu" (`:285-289`).
 *
 * ⚠ GAŁĘZIE RÓŻNIĄ SIĘ NIE TYLKO ŹRÓDŁEM, ALE I SORTOWANIEM ORAZ LICZNIKIEM — 1:1 z oryginałem:
 *  • z historią: daty z `zarejestrowano_at`, `COUNT(DISTINCT kod)`, `ORDER BY ostatniRaz DESC`
 *    (najświeższe modele na górze),
 *  • bez historii: daty z `data_aktualizacji`, `COUNT(*)`, `ORDER BY produkty DESC`
 *    (najliczniejsze modele na górze).
 *
 * ⚠ Gałąź zapasowa NIE filtruje po `status = 'aktywny'` — obejmuje też produkty wycofane.
 * Tak jest w oryginale (`:288`) i tego nie zmieniamy; ta sama asymetria co przy `filters`.
 */
export function cyklZyciaModeli(db: Baza): CyklZycia {
  const jestHistoria = czyJestHistoria(db);

  if (jestHistoria) {
    return {
      hasHistory: true,
      rows: bezpiecznieWiersze<WierszCykluZycia>(
        db,
        sql`
        SELECT marka, model,
               MIN(zarejestrowano_at) AS pierwszyRaz,
               MAX(zarejestrowano_at) AS ostatniRaz,
               COUNT(DISTINCT kod) AS produkty
        FROM historia_cen
        WHERE model IS NOT NULL AND model != ''
        GROUP BY marka, model
        ORDER BY ostatniRaz DESC
        LIMIT ${LIMIT_CYKLU_ZYCIA}
      `),
    };
  }

  return {
    hasHistory: false,
    rows: bezpiecznieWiersze<WierszCykluZycia>(
      db,
      sql`
      SELECT marka, model,
             MIN(data_aktualizacji) AS pierwszyRaz,
             MAX(data_aktualizacji) AS ostatniRaz,
             COUNT(*) AS produkty
      FROM products
      WHERE model IS NOT NULL AND model != ''
      GROUP BY marka, model
      ORDER BY produkty DESC
      LIMIT ${LIMIT_CYKLU_ZYCIA}
    `),
  };
}

/** Widełki i wartość domyślna parametru `?days` (`:300`). */
export const DNI_ROTACJI_MIN = 1;
export const DNI_ROTACJI_MAX = 730;
export const DNI_ROTACJI_DOMYSLNE = 60;

/** Wiersz „Rotacja / produkty bez aktualizacji" (`:301`). */
export type WierszRotacji = {
  kod: string;
  nazwa: string;
  dostawca: string;
  marka: string | null;
  model: string | null;
  rozmiar: string | null;
  stan: number;
  ostatniaAktualizacja: string | null;
};

export type Rotacja = {
  /**
   * Zaciśnięta liczba dni, odbita w odpowiedzi. Bywa `null`: `parseInt("abc")` daje `NaN`,
   * a `JSON.stringify(NaN)` — `null`. Patrz `zacisnijDniRotacji`.
   */
  days: number;
  rows: WierszRotacji[];
};

/**
 * Port wyrażenia `Math.min(730, Math.max(1, parseInt(req.query.days || '60', 10)))` (`:300`).
 *
 * ⚠ ODTWARZAMY TEŻ PRZYPADEK PATOLOGICZNY, bo oryginalne pole „Bez ruchu dni" jest zwykłym
 * inputem tekstowym i użytkownik może wpisać w nie cokolwiek:
 *  • `""`/brak → `'60'` (alternatywa `||` łapie pusty napis) → 60;
 *  • `"5"` → 5; `"0"` → 1; `"9999"` → 730 (zaciski);
 *  • `"abc"` → `NaN`, które przechodzi przez oba zaciski nietknięte i trafia do zapytania.
 *    better-sqlite3 wiąże `NaN` jako `NULL` (sprawdzone, nie rzuca), więc warunek
 *    `data_aktualizacji < datetime('now','-' || NULL || ' days')` jest `NULL`, czyli fałszem,
 *    i zostają wyłącznie produkty z pustą datą aktualizacji. W odpowiedzi `days` jest wtedy
 *    `null`. Dokładnie to samo robi produkcja — nie „naprawiamy" tego walidacją 400.
 */
export function zacisnijDniRotacji(surowe: unknown): number {
  const napis = surowe ? String(surowe) : String(DNI_ROTACJI_DOMYSLNE);
  return Math.min(DNI_ROTACJI_MAX, Math.max(DNI_ROTACJI_MIN, parseInt(napis, 10)));
}

/**
 * `GET /api/analytics/rotation/inactive` — „Rotacja / produkty bez aktualizacji" (`:299-303`).
 *
 * ⚠ JEDYNA TRASA CAŁEGO BLOKU 10e, KTÓRA CZYTA `req.query`. Filtrowanie po dniach dzieje się
 * więc na BACKENDZIE, a nie klientem — i dlatego `?days` należy do klucza zapytania po stronie
 * frontendu, w odróżnieniu od globalnych filtrów katalogu (patrz `pages/analityka/README.md` §2.2).
 *
 * `data_aktualizacji IS NULL` wpada do wyniku zawsze: produkt bez daty aktualizacji jest
 * „bez ruchu" niezależnie od progu. Sortowanie `ASC` stawia najstarsze na górze, a `NULL`-e
 * w SQLite sortują się przed wszystkim — czyli produkty bez daty są pierwsze.
 */
export function rotacjaNieaktywnych(db: Baza, dni: number): Rotacja {
  return {
    days: dni,
    rows: bezpiecznieWiersze<WierszRotacji>(
      db,
      sql`
      SELECT kod, nazwa, dostawca, marka, model, rozmiar, stan,
             data_aktualizacji AS ostatniaAktualizacja
      FROM products
      WHERE status = 'aktywny'
        AND (data_aktualizacji IS NULL
             OR data_aktualizacji < datetime('now', '-' || ${dni} || ' days'))
      ORDER BY data_aktualizacji ASC
      LIMIT ${LIMIT_ROTACJI}
    `),
  };
}

/** Wpis osi czasu importów (`:334`). Odpowiedź to GOŁA TABLICA takich wierszy, bez koperty. */
export type WpisOsiImportow = {
  id: number;
  kiedy: string;
  uzytkownik: string | null;
  /** `encja_id` audytu — w praktyce kod dostawcy, którego dotyczył import. */
  dostawca: string | null;
  /** Surowy JSON z audytu, oddawany bez parsowania — tak jak w oryginale. */
  szczegolyJson: string | null;
};

/**
 * `GET /api/analytics/importy-timeline` — oś czasu importów z `audit_log` (`:334`).
 *
 * ⚠ TRASA BEZ KONSUMENTA W ORYGINALNYM FRONCIE, tak jak `kpi` i `bootstrap-current`
 * (`docs/analityka-bloki-10b-10f.md` §1.1 — zero trafień w całym bundlu produkcji). Odbudowa
 * dowozi ją, bo należy do kontraktu, ale ŻADNA zakładka jej nie woła (decyzja D2 użytkownika,
 * 2026-09-03) — dokładanie karty byłoby wymyślaniem nowego ekranu, nie odbudową. Fixture jest
 * pustą tablicą, więc kształt wiersza pokrywa test jednostkowy.
 *
 * Trzeci wariant w `IN` — `'import'` — jest martwy po obu stronach: odbudowa zapisuje
 * `import_z_url` i `import_pliku` (`routes/import.ts:170`), a `import_cennika` ze stagingu
 * (`routes/staging-mutacje.ts:149`) do tego zestawu nie należy ani tu, ani w oryginale.
 * Zostaje w zapytaniu, bo jest w oryginale.
 */
export function osCzasuImportow(db: Baza): WpisOsiImportow[] {
  return bezpiecznieWiersze<WpisOsiImportow>(
    db,
    sql`
    SELECT id, kiedy,
           uzytkownik_imie AS uzytkownik,
           encja_id AS dostawca,
           szczegoly_json AS szczegolyJson
    FROM audit_log
    WHERE akcja IN ('import_z_url', 'import_pliku', 'import')
    ORDER BY id DESC
    LIMIT ${LIMIT_OSI_IMPORTOW}
  `);
}
