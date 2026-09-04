// Analityka — agregaty czytane przez `/api/analytics/*` (blok 10a).
//
// Port `mirror/backend/analytics_module.cjs`. To NIE jest zdeminifikowany bundle, tylko
// czytelne źródło modułu doklejanego do `index.cjs` — numery linii w komentarzach odnoszą
// się do niego i są stabilne.
//
// ⚠ ZAKRES: CZTERNAŚCIE Z DWUDZIESTU SIEDMIU TRAS MODUŁU — pięć z bloku 10a (fundament),
// pięć z 10b (ceny) i cztery z 10d (dostawcy); każdy blok ma niżej własną sekcję.
// Pozostałe trzynaście (EAN, dostępność, rotacja, cykl życia, export) dowożą bloki
// 10c, 10e i 10f. Dokładając je tutaj, trzymaj się układu tego pliku: jedna funkcja =
// jedna trasa, SQL przepisany dosłownie, limity i progi jako nazwane stałe. Pomocnik
// wspólny dla kilku bloków wydziel NAD ich sekcje, jak `czyJestHistoria`.
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

// ─── WSPÓLNY POMOCNIK BLOKÓW CZYTAJĄCYCH `historia_cen` ────────────────────────────────

/**
 * Port `hasHistory(db)` (`:58`) — czy `historia_cen` ma cokolwiek.
 *
 * ⚠ TO OSOBNE ZAPYTANIE OD `statusHistorii()`, mimo że obie liczą ten sam `COUNT(*)`.
 * W oryginale też są osobne (`:58` kontra `:93-96`) i wołane niezależnie — odtwarzamy
 * strukturę wywołań, nie optymalizujemy jej. Ta wersja jest tańsza (bez `MIN`/`MAX`),
 * a woła ją bramka w każdym żądaniu, które sięga do historii.
 *
 * Dziewięć tras zależy od tej bramki — na pustej tabeli zwracają
 * `{hasHistory: false, rows: []}` i to jest POPRAWNE zachowanie, nie awaria. Bloki 10b
 * (`prices/product-history`, `prices/inflation`) i 10d (`suppliers/stability`) doszły do
 * niej niezależnie; stoi tu, wyżej niż obie sekcje, żeby trzeci blok nie dopisał trzeciej
 * kopii.
 */
export function czyJestHistoria(db: Baza): boolean {
  const wiersz = db.get<{ c: number }>(sql`SELECT COUNT(*) AS c FROM historia_cen`);
  return !!(wiersz && wiersz.c > 0);
}

// ─── BLOK 10b · CENY ────────────────────────────────────────────────────────────────────
//
// Pięć tras zakładki „Ceny w czasie" (`analytics_module.cjs:237-268`, `:333`). Trzy z nich
// mają w oryginale kartę w UI, dwie NIE MAJĄ ŻADNEJ i to jest udokumentowany stan produkcji:
//
//   • `top-zmiany` — ZERO wywołań w całym bundlu frontendu (grep po `mirror/frontend/assets/*.js`
//     i `deminified/frontend-index.js`). Trasa bez konsumenta, jak `kpi` przed 10a.
//   • `market/group-prices` — wołana przy każdym wejściu na `/analityka` z `group=marka`
//     na sztywno (`frontend-index.js:27856-27860`), wynik ląduje w zmiennej `z`, po czym
//     `z` NIE JEST UŻYTE ANI RAZU w całym komponencie. Martwy fetch; selektora grupy w UI
//     nie ma w ogóle.
//
// Obie dowozimy jako trasy (są w kontrakcie i mają fixtures), obie zostają BEZ UI —
// decyzje D1 i D2 użytkownika z 2026-09-03. Dołożenie im karty byłoby budowaniem nowej
// funkcjonalności, a nie odbudową.

/** Ile wierszy oddaje `market/group-prices` (`:240`). */
const LIMIT_GRUP_RYNKU = 500;
/** Ile wierszy oddaje `prices/last-import` (`:246`). */
const LIMIT_OSTATNIEGO_IMPORTU = 500;
/** Ile wierszy oddaje `prices/inflation` (`:272`). */
const LIMIT_INFLACJI = 500;
/** Ile wierszy oddaje `top-zmiany` (`:333`). */
const LIMIT_TOP_ZMIAN = 100;

/**
 * Port `round(v, p = 2)` (`:54`) — zaokrąglenie przez mnożnik, nie przez `toFixed`.
 *
 * Różnica jest widoczna: `toFixed` oddaje string, a oryginał zwraca LICZBĘ i taką liczbę
 * niesie fixture (`stats.avg: 1561.39`). `Math.round(n * 100) / 100` odtwarza to 1:1.
 */
function zaokraglij(wartosc: number): number {
  return Math.round(wartosc * 100) / 100;
}

/** Wymiary, po których `market/group-prices` potrafi grupować (`:238`). */
export const GRUPY_RYNKU = ["marka", "model", "rozmiar"] as const;

export type GrupaRynku = (typeof GRUPY_RYNKU)[number];

/**
 * Wymiar → kolumna `products`. Mapa jest tożsamościowa i taka też jest w oryginale:
 * `const col = group === 'rozmiar' ? 'rozmiar' : group` (`:239`) to warunek, który
 * niczego nie zmienia. Zapisujemy go jako mapę, a nie jako martwy `if`, bo mapa
 * jednocześnie DOMYKA TYPEM to, co trafia do `sql.raw` — dokładnie jak `KOLUMNY_FILTROW`
 * wyżej. Innej drogi z `req.query` do surowego SQL-a w tym pliku nie ma.
 */
const KOLUMNY_GRUP_RYNKU: Record<GrupaRynku, string> = {
  marka: "marka",
  model: "model",
  rozmiar: "rozmiar",
};

/**
 * Zaciśnięcie `?group` do whitelisty — port `['marka','model','rozmiar'].includes(...)`
 * (`:238`). Wartość spoza listy, pusta i brakująca dają `marka`, a odpowiedź niesie
 * wartość PO zaciśnięciu, nie surowe query (`res.json({ group, rows })`, `:241`).
 */
export function zacisnijGrupeRynku(wartosc: unknown): GrupaRynku {
  return GRUPY_RYNKU.includes(wartosc as GrupaRynku) ? (wartosc as GrupaRynku) : "marka";
}

export type WierszCenGrupy = {
  grupa: string;
  oferty: number;
  srednia: number | null;
  min: number | null;
  max: number | null;
};

export type CenyGrupRynku = {
  group: GrupaRynku;
  rows: WierszCenGrupy[];
};

/**
 * `GET /api/analytics/market/group-prices` — rozrzut cen w obrębie marki/modelu/rozmiaru
 * (`:237-242`).
 *
 * ⚠ TRASA BEZ KONSUMENTA W UI (decyzja D2) — uzasadnienie w nagłówku sekcji wyżej.
 *
 * Sortowanie po `oferty DESC`, czyli najliczniejsze grupy pierwsze — nie po cenie.
 * Grupy o pustym albo nieustalonym wymiarze wypadają (`IS NOT NULL AND != ''`), tak jak
 * w listach filtrów.
 */
export function cenyGrupRynku(db: Baza, group: GrupaRynku): CenyGrupRynku {
  const kol = sql.raw(KOLUMNY_GRUP_RYNKU[group]);
  const rows = db.all<WierszCenGrupy>(sql`
    SELECT ${kol} AS grupa,
           COUNT(*) AS oferty,
           ROUND(AVG(cena_zakupu), 2) AS srednia,
           MIN(cena_zakupu) AS min,
           MAX(cena_zakupu) AS max
    FROM products
    WHERE status = 'aktywny' AND ${kol} IS NOT NULL AND ${kol} != ''
    GROUP BY ${kol}
    ORDER BY oferty DESC
    LIMIT ${LIMIT_GRUP_RYNKU}
  `);

  return { group, rows };
}

export type WierszZmianyCeny = {
  kod: string;
  nazwa: string;
  dostawca: string;
  cenaStara: number | null;
  cenaNowa: number | null;
  zmianaPct: number | null;
  utworzono: string;
};

/**
 * `GET /api/analytics/prices/last-import` — karta „3.1 Zmiany cen z ostatnich importów"
 * (`:245-248`).
 *
 * ⚠ WARUNEK `WHERE` RÓŻNI TĘ TRASĘ OD `top-zmiany` I TO NIE JEST PRZEOCZENIE ORYGINAŁU.
 * Tutaj muszą być OBIE ceny (`stara IS NOT NULL AND nowa IS NOT NULL`), bo karta pokazuje
 * kolumny „Było"/„Jest" — wiersz z pustym „Jest" nie miałby czego pokazać. `top-zmiany`
 * wymaga tylko ceny starej i dlatego zwraca też pozycje, których tu nie widać.
 * Odtwarzamy obie wersje dosłownie.
 *
 * `ORDER BY id DESC` = najświeższe pozycje stagingu pierwsze; „ostatni import" jest więc
 * przybliżeniem przez kolejność wstawiania, a nie filtrem po identyfikatorze importu.
 */
export function zmianyCenOstatniegoImportu(db: Baza): { rows: WierszZmianyCeny[] } {
  const rows = db.all<WierszZmianyCeny>(sql`
    SELECT kod, nazwa, dostawca,
           cena_zakupu_stara AS cenaStara,
           cena_zakupu_nowa AS cenaNowa,
           zmiana_pct AS zmianaPct,
           utworzono
    FROM staging_items
    WHERE cena_zakupu_stara IS NOT NULL AND cena_zakupu_nowa IS NOT NULL
    ORDER BY id DESC
    LIMIT ${LIMIT_OSTATNIEGO_IMPORTU}
  `);

  return { rows };
}

/**
 * `GET /api/analytics/top-zmiany` — sto największych ruchów ceny co do modułu (`:333`).
 *
 * ⚠ TRASA BEZ KONSUMENTA W UI (decyzja D1) — zero wywołań w bundlu produkcji.
 *
 * `ORDER BY ABS(zmiana_pct) DESC` sortuje po sile zmiany bez względu na kierunek, więc
 * podwyżka o 30% i obniżka o 30% stoją obok siebie. Pozycje bez `zmiana_pct` mają
 * `ABS(NULL) = NULL` i w SQLite lądują na końcu porządku malejącego — zostają w wyniku,
 * bo `WHERE` ich nie odsiewa.
 */
export function topZmiany(db: Baza): WierszZmianyCeny[] {
  return db.all<WierszZmianyCeny>(sql`
    SELECT kod, nazwa, dostawca,
           cena_zakupu_stara AS cenaStara,
           cena_zakupu_nowa AS cenaNowa,
           zmiana_pct AS zmianaPct,
           utworzono
    FROM staging_items
    WHERE cena_zakupu_stara IS NOT NULL
    ORDER BY ABS(zmiana_pct) DESC
    LIMIT ${LIMIT_TOP_ZMIAN}
  `);
}

export type WierszHistoriiCeny = {
  data: string;
  dostawca: string;
  kod: string;
  ean: string | null;
  cenaZakupu: number | null;
  cenaSprzedazy: number | null;
  stan: number | null;
};

/** Trzy liczby liczone w JS nad pobranymi wierszami — `null`, gdy nie ma z czego liczyć. */
export type StatystykiCeny = {
  min: number | null;
  max: number | null;
  avg: number | null;
};

export type HistoriaCenyProduktu = {
  hasHistory: boolean;
  rows: WierszHistoriiCeny[];
  stats: StatystykiCeny;
};

/**
 * `GET /api/analytics/prices/product-history` — karta „3.2 / 3.3 Historia ceny wybranej
 * opony" (`:250-261`).
 *
 * ⚠ TO PIERWSZY CZYTELNIK `historia_cen` PER PRODUKT (decyzja D3 roadmapy, `§5 Iteracja 10`).
 * Tabela ma dziś dwóch pisarzy: auto-zatwierdzanie importu (`repos/historia.ts`, blok 3d-1)
 * i `POST bootstrap-current` (blok 10a). Na stagingu bez importów bywa pusta — wtedy
 * `hasHistory: false`, pusta tabela i `stats` w `null`-ach. To POPRAWNE zachowanie.
 *
 * ⚠ TRASA NIE MA LIMIT-U i bez parametrów zwraca CAŁĄ tabelę — fixture nagrano właśnie
 * tak (`_przyciete.rows: 15597`). Nie dokładamy limitu, bo zmieniłby odpowiedź, którą
 * dowodzi nagranie; ochronę przed zalewaniem tej trasy zapytaniami robi frontend
 * (odstępstwo O-10b-1 — debounce, plus warunek „nie pytaj, gdy oba pola puste").
 *
 * Gdy historii nie ma, oryginał W OGÓLE nie odpytuje bazy (`hist ? safeAll(...) : []`,
 * `:257`) — odtwarzamy także to, bo różnica jest obserwowalna w logu zapytań.
 *
 * Oba parametry są opcjonalne i łączą się przez AND: sam `ean` zawęża do jednego produktu
 * u wszystkich dostawców, sam `kod` — do jednej pozycji jednego dostawcy, oba naraz do
 * części wspólnej.
 */
export function historiaCenProduktu(
  db: Baza,
  { ean, kod }: { ean: string; kod: string },
): HistoriaCenyProduktu {
  const hasHistory = czyJestHistoria(db);

  // Port `where`/`params` z `:253-256`: `WHERE 1=1` plus dokładane warunki. Wartości idą
  // parametrem zapytania (`sql` interpoluje je jako bind), więc `req.query` nigdy nie
  // trafia do treści SQL-a.
  const warunki = [sql`1 = 1`];
  if (ean) warunki.push(sql`ean = ${ean}`);
  if (kod) warunki.push(sql`kod = ${kod}`);

  const rows = hasHistory
    ? db.all<WierszHistoriiCeny>(sql`
        SELECT zarejestrowano_at AS data, dostawca, kod, ean,
               cena_zakupu AS cenaZakupu,
               cena_sprzedazy AS cenaSprzedazy,
               stan
        FROM historia_cen
        WHERE ${sql.join(warunki, sql` AND `)}
        ORDER BY zarejestrowano_at
      `)
    : [];

  return { hasHistory, rows, stats: statystykiCen(rows) };
}

/**
 * Port `stats` z `:259-260` — liczone w JS nad WIERSZAMI, nie w SQL-u.
 *
 * `filter(v => v != null)` oryginału jest luźnym porównaniem i odsiewa `null` oraz
 * `undefined`, ale ZOSTAWIA zero — pozycja o cenie zakupu 0 wchodzi więc do minimum.
 * Zachowujemy to; zmiana progu na `> 0` (jak w `inflation`) byłaby cichą poprawką.
 */
export function statystykiCen(rows: Pick<WierszHistoriiCeny, "cenaZakupu">[]): StatystykiCeny {
  const ceny = rows
    .map((r) => r.cenaZakupu)
    .filter((v): v is number => v !== null && v !== undefined);

  if (ceny.length === 0) return { min: null, max: null, avg: null };

  return {
    min: Math.min(...ceny),
    max: Math.max(...ceny),
    avg: zaokraglij(ceny.reduce((a, b) => a + b, 0) / ceny.length),
  };
}

export type WierszInflacji = {
  dostawca: string;
  miesiac: string;
  sredniaCena: number | null;
  inflacjaPct: number | null;
};

/**
 * `GET /api/analytics/prices/inflation` — karta „3.6 Inflacja cennika" (`:263-276`).
 *
 * Jedyne w tym bloku zapytanie okienkowe. Trzy kroki: średnia cena zakupu per dostawca
 * i miesiąc (`substr(zarejestrowano_at, 1, 7)` — miesiąc bierze się z PREFIKSU znacznika
 * ISO, więc format daty jest tu częścią kontraktu), potem `LAG` po miesiącach w obrębie
 * dostawcy, na końcu zmiana procentowa.
 *
 * ⚠ `inflacjaPct` JEST NULLOWALNE Z DWÓCH POWODÓW i oba są normalne: pierwszy miesiąc
 * dostawcy nie ma poprzednika (`LAG` daje `NULL`), a `CASE WHEN prev_price > 0` bez gałęzi
 * `ELSE` oddaje `NULL` również wtedy, gdy poprzednia średnia wyszła zerem. Fixture pokazuje
 * w tych kolumnach liczby, bo nagranie trafiło w środek szeregu.
 *
 * `WHERE cena_zakupu > 0` odsiewa pozycje bez ceny i zerowe — inaczej wyzerowałyby średnią
 * miesiąca. To jedyny filtr; `status` produktu nie ma tu znaczenia, bo `historia_cen` jest
 * migawką, a nie widokiem katalogu.
 */
export function inflacjaCennika(db: Baza): { hasHistory: boolean; rows: WierszInflacji[] } {
  const hasHistory = czyJestHistoria(db);

  const rows = hasHistory
    ? db.all<WierszInflacji>(sql`
        WITH month_avg AS (
          SELECT dostawca,
                 substr(zarejestrowano_at, 1, 7) AS miesiac,
                 AVG(cena_zakupu) AS avg_price
          FROM historia_cen
          WHERE cena_zakupu > 0
          GROUP BY dostawca, miesiac
        ), seq AS (
          SELECT dostawca, miesiac, avg_price,
                 LAG(avg_price) OVER (PARTITION BY dostawca ORDER BY miesiac) AS prev_price
          FROM month_avg
        )
        SELECT dostawca, miesiac,
               ROUND(avg_price, 2) AS sredniaCena,
               ROUND(CASE WHEN prev_price > 0 THEN (avg_price - prev_price) / prev_price * 100 END, 2) AS inflacjaPct
        FROM seq
        ORDER BY miesiac DESC, dostawca
        LIMIT ${LIMIT_INFLACJI}
      `)
    : [];

  return { hasHistory, rows };
}

// ─── BLOK 10d · DOSTAWCY ────────────────────────────────────────────────────────────────
//
// Cztery trasy „Part 1: supplier analysis" (`analytics_module.cjs:110-154`) plus alias
// `dostawcy-stats` (`:332`). Żadna z nich NIE czyta `req.query` — filtrowanie zakładki
// `dostawcy` dzieje się po stronie klienta, tak samo jak w sekcji marż z 10a.
//
// ⚠ TO NIE JEST TEN SAM ZASÓB CO `/api/dostawcy`. Widok Konfiguracja → Dostawcy stoi na
// `repos/suppliers.ts` (blok 3f-2) i liczy przeliczony `status` dostawcy oraz znaczniki zmian
// z `historia_cen`. Tutaj są surowe agregaty katalogu i historii cen — nazwy pól i semantyka
// są inne, więc nic się nie da (ani nie należy) współdzielić. Ostrzeżenie jest tu po to, żeby
// przyszła sesja nie scaliła obu przez podobieństwo nazw.

/**
 * Próg uznania zmiany ceny za zmianę (`:120`). Odsiewa szum zaokrągleń groszowych: dwa
 * kolejne punkty historii różniące się o mniej niż grosz to ta sama cena.
 */
const PROG_ZMIANY_CENY = 0.01;

/** Wiersz stabilności liczony z `historia_cen` — gałąź `hasHistory: true` (`:114-126`). */
export type WierszStabilnosciZHistoria = {
  dostawca: string;
  punkty: number;
  liczbaZmian: number;
  /** `NULL`, gdy dostawca nie ma ANI JEDNEJ pary punktów z dodatnią ceną poprzednią. */
  sredniaZmianaPct: number | null;
  maxZmianaPct: number | null;
};

/** Wiersz stabilności liczony z `products` — gałąź zapasowa `hasHistory: false` (`:128`). */
export type WierszStabilnosciBezHistorii = {
  dostawca: string;
  produkty: number;
  sredniaCena: number | null;
  sredniStan: number | null;
  liczbaZmian: null;
  sredniaZmianaPct: null;
  maxZmianaPct: null;
};

export type WierszStabilnosci = WierszStabilnosciZHistoria | WierszStabilnosciBezHistorii;

export type StabilnoscDostawcow = {
  hasHistory: boolean;
  rows: WierszStabilnosci[];
};

/**
 * `GET /api/analytics/suppliers/stability` — karta „1.1 Stabilność cennika dostawcy" (`:110-131`).
 *
 * ⚠ DWIE GAŁĘZIE ZWRACAJĄ DWA RÓŻNE KSZTAŁTY WIERSZA, I TAK JEST W PRODUKCJI. Typ zwracany
 * jest tu unią, a nie jednym rekordem z opcjonalnymi polami, właśnie po to, żeby ta rozbieżność
 * została nazwana zamiast rozmyć się w `?`:
 *
 * | pole              | `hasHistory: true` | `hasHistory: false` |
 * |-------------------|--------------------|---------------------|
 * | `punkty`          | jest               | **brak klucza**     |
 * | `produkty`        | **brak klucza**    | jest                |
 * | `sredniaCena`     | **brak klucza**    | jest                |
 * | `sredniStan`      | **brak klucza**    | jest                |
 * | `liczbaZmian` i dalej | policzone      | `NULL`              |
 *
 * Frontend oryginału renderuje przy tym SIEDEM kolumn (`dostawca, produkty, punkty, liczbaZmian,
 * sredniaZmianaPct, maxZmianaPct, sredniStan`, `frontend-index.js:28070-28093`), więc w każdej
 * gałęzi część z nich jest pusta („—"), a `sredniaCena` nie trafia do UI w ogóle. To jest
 * ZASTANE ZACHOWANIE PRODUKCJI, nie błąd portu — nie „naprawiamy" go (decyzja D1, 2026-09-03).
 *
 * Fixture `GET_analytics_suppliers_stability.json` nagrano przy `hasHistory: true`, więc gałąź
 * zapasowa NIE jest pokryta przez GATE — jej kształt dowodzi test w `analityka.dostawcy.agregaty.test.ts`.
 *
 * `LAG() OVER (PARTITION BY …)` wymaga SQLite ≥ 3.25; `better-sqlite3` w tym projekcie niesie 3.47.
 */
export function stabilnoscDostawcow(db: Baza): StabilnoscDostawcow {
  const hist = czyJestHistoria(db);

  if (!hist) {
    return {
      hasHistory: false,
      rows: db.all<WierszStabilnosciBezHistorii>(sql`
        SELECT dostawca,
               COUNT(*) AS produkty,
               ROUND(AVG(cena_zakupu), 2) AS sredniaCena,
               ROUND(AVG(stan), 2) AS sredniStan,
               NULL AS liczbaZmian,
               NULL AS sredniaZmianaPct,
               NULL AS maxZmianaPct
        FROM products
        WHERE status = 'aktywny'
        GROUP BY dostawca
        ORDER BY produkty DESC
      `),
    };
  }

  return {
    hasHistory: true,
    rows: db.all<WierszStabilnosciZHistoria>(sql`
      WITH seq AS (
        SELECT dostawca, kod, cena_zakupu, zarejestrowano_at,
               LAG(cena_zakupu) OVER (PARTITION BY dostawca, kod ORDER BY zarejestrowano_at) AS prev_price
        FROM historia_cen
        WHERE cena_zakupu IS NOT NULL
      )
      SELECT dostawca,
             COUNT(*) AS punkty,
             SUM(CASE WHEN prev_price IS NOT NULL AND ABS(cena_zakupu - prev_price) > ${PROG_ZMIANY_CENY} THEN 1 ELSE 0 END) AS liczbaZmian,
             ROUND(AVG(CASE WHEN prev_price > 0 THEN ABS((cena_zakupu - prev_price) / prev_price * 100) END), 2) AS sredniaZmianaPct,
             ROUND(MAX(CASE WHEN prev_price > 0 THEN ABS((cena_zakupu - prev_price) / prev_price * 100) END), 2) AS maxZmianaPct
      FROM seq
      GROUP BY dostawca
      ORDER BY sredniaZmianaPct DESC
    `),
  };
}

/** Ile pozycji cyklu życia wraca z backendu (`:139`). Tabela w UI rysuje z tego pierwsze 300. */
const LIMIT_CYKLU_ZYCIA = 500;

/** Wiersz karty „1.2 Nowości i wycofania" — pozycja stagingu, nie produkt katalogu. */
export type WierszCykluZycia = {
  dostawca: string;
  /** `nowa` albo `wycofana` — jedyne dwa typy dopuszczone przez zapytanie. */
  typ: string;
  kod: string;
  nazwa: string;
  /** Surowy znacznik `staging_items.utworzono`; UI pokazuje go monospace, bez formatowania. */
  kiedy: string;
  powod: string | null;
};

/**
 * `GET /api/analytics/suppliers/lifecycle` — karta „1.2 Nowości i wycofania" (`:133-141`).
 *
 * Czyta STAGING, nie katalog: to dziennik decyzji importu (pozycja pojawiła się w cenniku albo
 * z niego zniknęła), a nie stan produktów. Dlatego nie ma tu `status = 'aktywny'` — wiersz
 * o wycofaniu opisuje właśnie coś, czego w aktywnym katalogu już nie ma.
 *
 * Zapytanie NIE odsiewa pozycji niezatwierdzonych — `zmiana_kluczowa` i `blad` odpadają same,
 * bo nie mieszczą się w filtrze `typ_zmiany`.
 */
export function cyklZyciaDostawcow(db: Baza): { rows: WierszCykluZycia[] } {
  return {
    rows: db.all<WierszCykluZycia>(sql`
      SELECT dostawca, typ_zmiany AS typ, kod, nazwa, utworzono AS kiedy, powod
      FROM staging_items
      WHERE typ_zmiany IN ('nowa', 'wycofana')
      ORDER BY utworzono DESC
      LIMIT ${LIMIT_CYKLU_ZYCIA}
    `),
  };
}

/** Wiersz karty „1.4 / 1.5 Stan i dostępność dostawcy". */
export type WierszStanuDostawcy = {
  dostawca: string;
  produkty: number;
  sredniStan: number | null;
  dostepne: number;
  /** 0–100 z dwoma miejscami; UI rysuje z tego pasek postępu, nie liczbę. */
  dostepnoscPct: number | null;
};

/**
 * `GET /api/analytics/suppliers/stock` — karta „1.4 / 1.5" (`:143-154`).
 *
 * Bez `LIMIT` — dostawców jest kilkanaście, a `GROUP BY dostawca` i tak zwija katalog do
 * jednego wiersza na dostawcę.
 *
 * Sortowanie jest dwustopniowe (`dostepnoscPct DESC, produkty DESC`) i to porządek odpowiedzi,
 * nie decyzja widoku: przy remisie na 100% dostępności wyżej stoi dostawca z większym katalogiem.
 * Frontend go zachowuje — również na wykresie.
 */
export function stanDostawcow(db: Baza): { rows: WierszStanuDostawcy[] } {
  return {
    rows: db.all<WierszStanuDostawcy>(sql`
      SELECT dostawca,
             COUNT(*) AS produkty,
             ROUND(AVG(stan), 2) AS sredniStan,
             SUM(CASE WHEN stan > 0 THEN 1 ELSE 0 END) AS dostepne,
             ROUND(100.0 * SUM(CASE WHEN stan > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS dostepnoscPct
      FROM products
      WHERE status = 'aktywny'
      GROUP BY dostawca
      ORDER BY dostepnoscPct DESC, produkty DESC
    `),
  };
}

/** Wiersz `dostawcy-stats`. Odpowiedź to GOŁA TABLICA takich wierszy, bez koperty. */
export type WierszStatystykDostawcy = {
  dostawca: string;
  liczbaProduktow: number;
  avgMarza: number | null;
  avgCenaZakupu: number | null;
  dostepnych: number;
};

/**
 * `GET /api/analytics/dostawcy-stats` — alias zgodności (`:332`).
 *
 * ⚠ W ORYGINALNYM FRONTENDZIE TA TRASA NIE MA KONSUMENTA — zero trafień w całym bundlu
 * (`grep -o "analytics/dostawcy-stats" mirror/frontend/assets/*.js deminified/frontend-index.js`).
 * Siedzi w sekcji, którą backend sam opisuje jako „Backward-compatible aliases used by previous
 * frontend build" (`:324`), razem z `kpi`, `top-zmiany`, `importy-timeline` i `ean-porownanie`.
 * Dowozimy ją, bo ma fixture i wchodzi do GATE, ale ŚWIADOMIE bez hooka i bez karty w UI
 * (decyzja D3, 2026-09-03) — dokładnie jak `POST bootstrap-current` w 10a. Dorobienie jej ekranu
 * byłoby budowaniem czegoś nowego, a nie odbudową.
 *
 * Merytorycznie nakłada się na `suppliers/stock` (ten sam `GROUP BY dostawca` po aktywnym
 * katalogu), ale zwraca inny zestaw pól i inne nazwy — łączenie ich w jedno zapytanie zmieniłoby
 * kształt obu odpowiedzi, więc zostają osobno, tak jak w oryginale.
 */
export function statystykiDostawcow(db: Baza): WierszStatystykDostawcy[] {
  return db.all<WierszStatystykDostawcy>(sql`
    SELECT dostawca,
           COUNT(*) AS liczbaProduktow,
           ROUND(AVG(marza_pct), 2) AS avgMarza,
           ROUND(AVG(cena_zakupu), 2) AS avgCenaZakupu,
           SUM(CASE WHEN stan > 0 THEN 1 ELSE 0 END) AS dostepnych
    FROM products
    WHERE status = 'aktywny'
    GROUP BY dostawca
    ORDER BY liczbaProduktow DESC
  `);
}
