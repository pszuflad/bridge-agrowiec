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

// ════════════════════════════════════════════════════════════════════════════════════════
//  BLOK 10c — EAN (`analytics_module.cjs:188-235` „Part 2: EAN comparison" oraz `:335-338`)
// ════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠ TRZY TRASY TEGO BLOKU CZYTAJĄ `req.query`, wbrew temu, co mówiła nota zakresu:
// `ean/comparison` bierze `minDiffPct`, `ean/details` i `ean-porownanie` biorą `ean`.
// Filtrowanie KLIENCKIE dotyczy wyłącznie globalnego paska sześciu filtrów katalogu
// (decyzja D2 z 10a, `currentWhere()` pozostaje martwym kodem) — z parametrami tych tras
// nie ma nic wspólnego. Parametry odtwarzamy 1:1, łącznie z ich luźnym parsowaniem.
//
// ⚠ CZEGO TU NIE MA: własnego `try/catch` z kodem 500. Oryginał woła `safeAll` (`:49`),
// które połyka wyjątek i zwraca pustą tablicę — trasa nigdy nie oddaje 500 na błędzie SQL.
// Na poprawnym schemacie te SELECT-y nie rzucają, więc dokładanie obsługi błędu byłoby
// dorabianiem zachowania, którego produkcja nie ma.

/** Port `num(v, d)` (`:51`) — `Number()` bez sanityzacji, `d` gdy wynik nieskończony. */
function liczba(wartosc: unknown, domyslna: number): number {
  const n = Number(wartosc);
  return Number.isFinite(n) ? n : domyslna;
}

/** Port `round(v, p)` (`:52`) — zaokrąglenie po pomnożeniu przez potęgę dziesiątki. */
function zaokraglij(wartosc: unknown, miejsca = 2): number {
  const n = liczba(wartosc, 0);
  const m = Math.pow(10, miejsca);
  return Math.round(n * m) / m;
}

/** Port `String(req.query.x || '')` — wartość falsy (w tym brak parametru) daje pusty napis. */
function tekst(wartosc: unknown): string {
  return wartosc ? String(wartosc) : "";
}

/**
 * Port `median(values)` (`:53`) — mediana bez zaokrąglania.
 *
 * Sortowanie jest NUMERYCZNE (`(x, y) => x - y`), nie leksykalne; wartości nieliczbowe
 * odpadają, pusta lista daje `null`, a przy parzystej długości wychodzi średnia dwóch
 * środkowych — czyli wynik, który nie musi być żadną z ofert.
 */
function mediana(wartosci: (number | null)[]): number | null {
  const a = wartosci
    .map(Number)
    .filter((v) => Number.isFinite(v))
    .sort((x, y) => x - y);
  if (!a.length) return null;
  const srodek = Math.floor(a.length / 2);
  return a.length % 2 ? a[srodek]! : (a[srodek - 1]! + a[srodek]!) / 2;
}

/** LIMIT porównania cen po EAN (`:198`). */
const LIMIT_PORWNANIA_EAN = 1000;
/** LIMIT listy pozycji unikalnych (`:215`). */
const LIMIT_UNIKALNYCH_EAN = 1000;
/** LIMIT starszej trasy `ean-porownanie` — INNY niż w `ean/comparison` (`:338`). */
const LIMIT_PORWNANIA_EAN_LEGACY = 200;

export type WierszPorownaniaEan = {
  ean: string;
  nazwa: string;
  dostawcy: number;
  cenaMin: number;
  cenaMax: number;
  srednia: number;
  oferty: number;
  /** `null`, gdy `cenaMin` wynosi zero — gałąź nieosiągalna przy `cena_zakupu > 0` w WHERE. */
  spreadPct: number | null;
  spreadZl: number;
};

/**
 * `GET /api/analytics/ean/comparison` — EAN-y dostępne u co najmniej dwóch dostawców (`:188-200`).
 *
 * Sortowanie idzie po BEZWZGLĘDNEJ różnicy cen (`MAX - MIN` malejąco), a nie po `spreadPct`,
 * więc na górze siedzą pozycje o największym rozrzucie w złotówkach. Frontend zachowuje ten
 * porządek — to część odpowiedzi, nie decyzja widoku.
 *
 * ⚠ `spreadZl` i `spreadPct` NIE SĄ liczone w SQL, tylko w JS po zapytaniu — i to ma znaczenie
 * dla kolejności: filtr `minDiffPct` działa więc PO obcięciu do 1000 wierszy, a nie przed nim.
 * Podniesienie progu nie „dosypie" pozycji z dalszej części rankingu; to zachowanie oryginału.
 *
 * ⚠ `spreadPct` ma gałąź `cenaMin ? … : null`, która jest w oryginale NIEOSIĄGALNA — WHERE
 * wymaga `cena_zakupu > 0`, więc `MIN(cena_zakupu)` nigdy nie wyjdzie zerem. Odtwarzamy ją
 * mimo to: usunięcie zmieniłoby kształt typu (`number` zamiast `number | null`) i różniłoby
 * się od kodu, który realnie działa w produkcji.
 *
 * `minDiffPct` odcina wiersze o spreadzie procentowym poniżej progu. Falsy próg (brak
 * parametru, `0`, wartość nieliczbowa) wyłącza filtr — `!minDiff` w oryginale, odtworzone
 * dosłownie razem z `(spreadPct || 0)` po drugiej stronie porównania.
 */
export function porownanieEan(db: Baza, minDiffPct: unknown = undefined): { rows: WierszPorownaniaEan[] } {
  const minDiff = liczba(minDiffPct, 0);

  const surowe = db.all<{
    ean: string;
    nazwa: string;
    dostawcy: number;
    cenaMin: number;
    cenaMax: number;
    srednia: number;
    oferty: number;
  }>(sql`
    SELECT ean, MAX(nazwa) AS nazwa, COUNT(DISTINCT dostawca) AS dostawcy,
           MIN(cena_zakupu) AS cenaMin, MAX(cena_zakupu) AS cenaMax,
           ROUND(AVG(cena_zakupu), 2) AS srednia, COUNT(*) AS oferty
    FROM products
    WHERE status = 'aktywny' AND ean IS NOT NULL AND ean != '' AND cena_zakupu > 0
    GROUP BY ean
    HAVING COUNT(DISTINCT dostawca) >= 2
    ORDER BY (MAX(cena_zakupu) - MIN(cena_zakupu)) DESC
    LIMIT ${LIMIT_PORWNANIA_EAN}
  `);

  const rows = surowe
    .map((r) => ({
      ...r,
      spreadZl: zaokraglij(r.cenaMax - r.cenaMin),
      spreadPct: r.cenaMin ? zaokraglij(((r.cenaMax - r.cenaMin) / r.cenaMin) * 100) : null,
    }))
    .filter((r) => !minDiff || (r.spreadPct ?? 0) >= minDiff);

  return { rows };
}

export type OfertaEan = {
  dostawca: string;
  kod: string;
  nazwa: string;
  cenaZakupu: number;
  cenaSprzedazy: number;
  stan: number;
  marzaPct: number;
};

export type OfertaEanZPozycja = OfertaEan & { pozycjaCenowa: number };

export type SzczegolyEan =
  | { ean: null; offers: never[] }
  | {
      ean: string;
      offers: OfertaEanZPozycja[];
      mediana: number | null;
      srednia: number | null;
    };

/** Wspólny SELECT ofert jednego EAN-u — `ean/details` (`:205`) i `ean-porownanie` (`:337`). */
function ofertyEan(db: Baza, ean: string): OfertaEan[] {
  return db.all<OfertaEan>(sql`
    SELECT dostawca, kod, nazwa,
           cena_zakupu AS cenaZakupu,
           cena_sprzedazy AS cenaSprzedazy,
           stan,
           marza_pct AS marzaPct
    FROM products
    WHERE ean = ${ean} AND status = 'aktywny'
    ORDER BY cena_zakupu ASC
  `);
}

/**
 * `GET /api/analytics/ean/details` — oferty jednego EAN-u (`:202-208`).
 *
 * ⚠ ODPOWIEDŹ MA DWA RÓŻNE KSZTAŁTY, a fixture nagrał tylko pierwszy z nich.
 * Bez `?ean` → `{ean: null, offers: []}` (dokładnie to jest w
 * `contract/fixtures/GET_analytics_ean_details.json`). Z `?ean` → CZTERY klucze:
 * `{ean, offers, mediana, srednia}`, a każda oferta dostaje dodatkowo `pozycjaCenowa`.
 * `docs/analityka-bloki-10b-10f.md` §3 opisywał tę trasę jako `{ean, offers}` — to prawda
 * wyłącznie dla gałęzi pustej. Kształt gałęzi z `ean` nie jest pokryty żadnym fixture'em,
 * więc dowodzi go test jednostkowy w `analityka.agregaty.test.ts`.
 *
 * `pozycjaCenowa` to pozycja w rankingu cenowym liczona z KOLEJNOŚCI wierszy (`i + 1` po
 * `ORDER BY cena_zakupu ASC`), a nie funkcją okna — dwie oferty o identycznej cenie dostaną
 * więc różne pozycje, zależnie od tego, jak SQLite je uszereguje. Tak działa oryginał;
 * `ean/supplier-rank` używa dla odmiany prawdziwego `RANK()` i tam remisy dzielą pozycję.
 *
 * ⚠ TRASA NIE MA KONSUMENTA W ORYGINALNYM FRONTENDZIE (`docs/analityka-bloki-10b-10f.md` §1.1
 * — zero trafień w bundlu). Dowozimy ją jako trasę bez UI, tak jak 10a dowiozło
 * `POST /api/analytics/bootstrap-current`; dorobienie jej ekranu byłoby budowaniem nowego,
 * nie odbudową (decyzja D6, 2026-09-03).
 */
export function szczegolyEan(db: Baza, ean: unknown): SzczegolyEan {
  const szukany = tekst(ean);
  if (!szukany) return { ean: null, offers: [] };

  const offers = ofertyEan(db, szukany);
  const ceny = offers.map((o) => o.cenaZakupu).filter((v) => v != null);

  return {
    ean: szukany,
    offers: offers.map((o, i) => ({ ...o, pozycjaCenowa: i + 1 })),
    mediana: mediana(ceny),
    srednia: ceny.length ? zaokraglij(ceny.reduce((a, b) => a + b, 0) / ceny.length) : null,
  };
}

export type WierszUnikalnegoEan = {
  ean: string;
  nazwa: string;
  dostawca: string;
  cenaZakupu: number;
  stan: number;
};

/**
 * `GET /api/analytics/ean/unique` — EAN-y dostępne u dokładnie jednego dostawcy (`:210-217`).
 *
 * ⚠ `MAX(...)` przy `nazwa`, `dostawca`, `cena_zakupu` i `stan` nie jest tu agregatem
 * merytorycznym, tylko sposobem na wyciągnięcie kolumn spoza `GROUP BY`. Przy `HAVING
 * COUNT(DISTINCT dostawca) = 1` dostawca jest jeden, więc `MAX(dostawca)` zwraca jego nazwę —
 * ale `MAX(cena_zakupu)` i `MAX(stan)` biorą NAJWYŻSZE wartości z ofert tego dostawcy, gdy ma
 * on pod jednym EAN-em kilka kodów. To zachowanie oryginału i zostaje bez zmian.
 *
 * Inaczej niż `ean/comparison`, ta trasa NIE wymaga `cena_zakupu > 0` — pozycje z zerową ceną
 * zakupu są w niej widoczne.
 */
export function unikalneEan(db: Baza): { rows: WierszUnikalnegoEan[] } {
  const rows = db.all<WierszUnikalnegoEan>(sql`
    SELECT ean, MAX(nazwa) AS nazwa, MAX(dostawca) AS dostawca,
           MAX(cena_zakupu) AS cenaZakupu, MAX(stan) AS stan
    FROM products
    WHERE status = 'aktywny' AND ean IS NOT NULL AND ean != ''
    GROUP BY ean
    HAVING COUNT(DISTINCT dostawca) = 1
    ORDER BY nazwa
    LIMIT ${LIMIT_UNIKALNYCH_EAN}
  `);
  return { rows };
}

export type WierszPokryciaEan = {
  liczbaDostawcow: number;
  liczbaEAN: number;
};

/**
 * `GET /api/analytics/ean/coverage` — rozkład: ilu dostawców ma dany EAN (`:219-222`).
 *
 * Histogram, nie ranking: jeden wiersz na każdą występującą liczbę dostawców, posortowany
 * rosnąco. BEZ LIMIT-u — wierszy jest tyle, ilu maksymalnie dostawców dzieli jeden EAN
 * (w nagraniu produkcji: pięć). Podobnie jak `unique`, nie filtruje po `cena_zakupu > 0`.
 */
export function pokrycieEan(db: Baza): { rows: WierszPokryciaEan[] } {
  const rows = db.all<WierszPokryciaEan>(sql`
    SELECT dostawcy AS liczbaDostawcow, COUNT(*) AS liczbaEAN
    FROM (
      SELECT ean, COUNT(DISTINCT dostawca) AS dostawcy
      FROM products
      WHERE status = 'aktywny' AND ean IS NOT NULL AND ean != ''
      GROUP BY ean
    )
    GROUP BY dostawcy
    ORDER BY dostawcy
  `);
  return { rows };
}

export type WierszRankinguEan = {
  dostawca: string;
  wspolnePozycje: number;
  najtanszy: number;
  najtanszyPct: number;
};

/**
 * `GET /api/analytics/ean/supplier-rank` — jak często dostawca jest najtańszy (`:224-235`).
 *
 * ⚠ `wspolnePozycje` MYLI NAZWĄ. CTE `ranked` nie wymaga, żeby EAN był u dwóch dostawców —
 * bierze każdą aktywną ofertę z niepustym EAN-em i ceną większą od zera. Licznik to więc
 * „ile ofert dostawcy w ogóle wpadło do rankingu", a nie „ile pozycji dzieli z kimkolwiek".
 * Dlatego dostawca, którego wszystkie EAN-y są unikalne, wychodzi z `najtanszyPct = 100`
 * — jest jedyny, więc zawsze najtańszy. Fixture to potwierdza (`MO9`: 846/846 = 100%).
 * Odtwarzamy 1:1; kolumna w UI nosi etykietę „Wspólne" z oryginału.
 *
 * `RANK()` (nie `ROW_NUMBER()`) sprawia, że przy remisie cenowym KAŻDY z remisujących dostaje
 * pozycję 1 i liczy się jako najtańszy — suma `najtanszy` po dostawcach może więc przekroczyć
 * liczbę EAN-ów. To też jest zachowanie oryginału.
 *
 * BEZ LIMIT-u — wierszy jest tyle, ilu dostawców.
 */
export function rankingDostawcowEan(db: Baza): { rows: WierszRankinguEan[] } {
  const rows = db.all<WierszRankinguEan>(sql`
    WITH ranked AS (
      SELECT ean, dostawca, cena_zakupu,
             RANK() OVER (PARTITION BY ean ORDER BY cena_zakupu ASC) AS pozycja
      FROM products
      WHERE status = 'aktywny' AND ean IS NOT NULL AND ean != '' AND cena_zakupu > 0
    )
    SELECT dostawca,
           COUNT(*) AS wspolnePozycje,
           SUM(CASE WHEN pozycja = 1 THEN 1 ELSE 0 END) AS najtanszy,
           ROUND(100.0 * SUM(CASE WHEN pozycja = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) AS najtanszyPct
    FROM ranked
    GROUP BY dostawca
    ORDER BY najtanszyPct DESC
  `);
  return { rows };
}

export type WierszPorownaniaEanLegacy = {
  ean: string;
  nazwa: string;
  dostawcy: number;
  cenaMin: number;
  cenaMax: number;
};

/** Goła tablica — bez koperty `{rows}`, inaczej niż wszystkie trasy `ean/*`. */
export type PorownanieEanLegacy = WierszPorownaniaEanLegacy[] | OfertaEan[];

/**
 * `GET /api/analytics/ean-porownanie` — STARSZA, NIEZALEŻNA trasa (`:335-338`).
 *
 * ⚠ TO NIE JEST ALIAS `ean/comparison` i nie wolno go tak zaimplementować. Różnice, wszystkie
 * istotne dla wyniku:
 *
 *   | | `ean/comparison` | `ean-porownanie` |
 *   |---|---|---|
 *   | koperta | `{rows}` | goła tablica |
 *   | WHERE | + `cena_zakupu > 0` | bez tego warunku |
 *   | kolumny | + `srednia`, `oferty`, `spreadZl`, `spreadPct` | tylko pięć |
 *   | LIMIT | 1000 | 200 |
 *   | parametr | `minDiffPct` | `ean` |
 *
 * Brak `cena_zakupu > 0` znaczy, że pozycje z ceną zakupu zero — których `ean/comparison`
 * nie widzi — tutaj wchodzą do agregatu i mogą wyzerować `cenaMin`.
 *
 * ⚠ DRUGA GAŁĄŹ, NIENAGRANA W FIXTURE. Z `?ean` trasa oddaje gołą tablicę ofert tego EAN-u —
 * ten sam SELECT co `ean/details`, ale BEZ `pozycjaCenowa`, `mediana` i `srednia`. Fixture
 * `GET_analytics_ean-porownanie.json` nagrał wariant bez parametru, więc gałąź z `ean` pokrywa
 * test jednostkowy.
 *
 * ⚠ ZERO KONSUMENTÓW W ORYGINALNYM FRONTENDZIE (§1.1) — trasa bez UI, decyzja D6.
 */
export function porownanieEanLegacy(db: Baza, ean: unknown): PorownanieEanLegacy {
  const szukany = tekst(ean);
  if (szukany) return ofertyEan(db, szukany);

  return db.all<WierszPorownaniaEanLegacy>(sql`
    SELECT ean, MAX(nazwa) AS nazwa, COUNT(DISTINCT dostawca) AS dostawcy,
           MIN(cena_zakupu) AS cenaMin, MAX(cena_zakupu) AS cenaMax
    FROM products
    WHERE status = 'aktywny' AND ean IS NOT NULL AND ean != ''
    GROUP BY ean
    HAVING COUNT(DISTINCT dostawca) >= 2
    ORDER BY (MAX(cena_zakupu) - MIN(cena_zakupu)) DESC
    LIMIT ${LIMIT_PORWNANIA_EAN_LEGACY}
  `);
}
