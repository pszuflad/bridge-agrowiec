import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Uzytkownik } from "@/lib/api";
import type { Produkt } from "@/pages/katalog/filtrowanie";
import type { Narzut, Promocja } from "@/pages/narzuty/api";
import type { Alert } from "@/pages/alerty/api";
import type {
  Filtry,
  HistoriaCenyProduktu,
  Kpi,
  Marze,
  StabilnoscDostawcow,
  StatusHistorii,
  WierszCykluZycia,
  WierszInflacji,
  WierszStanuDostawcy,
  WierszZmianyCeny,
} from "@/pages/analityka/api";

const katalogTestow = dirname(fileURLToPath(import.meta.url));
const korzenRepo = resolve(katalogTestow, "../../../..");

/**
 * Użytkownik do mocków brany PROSTO z `contract/fixtures/GET_me.json` — nagranej
 * odpowiedzi żywej produkcji. Dzięki temu testy sprawdzają zgodność z kontraktem,
 * a nie z moim wyobrażeniem o nim: zmiana kształtu fixtura wywali test.
 */
export function uzytkownikZFixtura(): Uzytkownik {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_me.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: { id: number; email: string; imieNazwisko: string };
  };
  const { id, email, imieNazwisko } = fixture.body;
  return { id, email, imieNazwisko };
}

/** Token o kształcie JWT — wartość nieistotna, liczy się, że FE go zapisze i odeśle. */
export const TOKEN_TESTOWY = "naglowek.tresc.podpis";

/**
 * Produkty do mocków prosto z `contract/fixtures/GET_products.json` (5 pozycji nagranych
 * z produkcji). Ta sama zasada co przy użytkowniku: testy widoku sprawdzają zgodność
 * z kontraktem, a nie z moim wyobrażeniem o kształcie danych.
 */
export function produktyZFixtura(): Produkt[] {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_products.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: { items: Produkt[] };
  };
  return fixture.body.items;
}

/** Dostawcy z `contract/fixtures/GET_suppliers.json` (5 pozycji). */
export function dostawcyZFixtura(): Record<string, unknown>[] {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_suppliers.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as { body: Record<string, unknown>[] };
  return fixture.body;
}

/**
 * Strona stagingu prosto z `contract/fixtures/GET_staging_paged.json` — koperta
 * `{items,total,page,pageSize,pages}` z 50 nagranymi pozycjami.
 *
 * Ta sama zasada co przy produktach: widok testujemy przeciwko KSZTAŁTOWI, który realnie
 * oddaje produkcja, a nie przeciwko mojemu wyobrażeniu o nim. Fixture ma tylko 20 pól
 * w pozycji — bez `snapshotJson` — i właśnie o to chodzi: podgląd różnic MUSI dociągnąć
 * pozycję osobno.
 */
export function stronaStaginguZFixtura(): {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
} {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_staging_paged.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: { items: Record<string, unknown>[]; total: number; page: number; pageSize: number; pages: number };
  };
  const { items, total, page, pageSize, pages } = fixture.body;
  return { items, total, page, pageSize, pages };
}

/**
 * Pozycja ze `snapshotJson` prosto z `contract/fixtures/GET_staging.json` — kształt, jaki
 * oddaje `GET /api/staging/{id}` (24 pola). Używana w teście podglądu różnic.
 */
export function pozycjaStaginguZFixtura(): Record<string, unknown> {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_staging.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: Record<string, unknown>[] | { items: Record<string, unknown>[] };
  };
  const pozycje = Array.isArray(fixture.body) ? fixture.body : fixture.body.items;
  // Wybieramy pozycję, która NAPRAWDĘ ma snapshot — inaczej test podglądu byłby pusty.
  return pozycje.find((p) => p.snapshotJson) ?? pozycje[0]!;
}

/**
 * Strona historii prosto z `contract/fixtures/GET_history_paged.json` — koperta
 * `{items,total,pages,page,limit}`. Ta sama zasada co wyżej: test widoku sprawdza zgodność
 * z kontraktem, a nie z moim wyobrażeniem o kształcie.
 *
 * ⚠ `items` ma PIĘĆ wpisów, nie 50 — nagranie przycięto przy sanityzacji, a `50` z pola
 * `_przyciete.items` mówi, ile ich było PRZED przycięciem (`contract/README.md`). Pola
 * `total`/`pages` pochodzą z pełnej odpowiedzi produkcji i celowo nie zgadzają się
 * z długością `items`; to nie jest niespójność do „naprawienia" w fixture.
 */
export function stronaHistoriiZFixtura(): {
  items: Record<string, unknown>[];
  total: number;
  pages: number;
  page: number;
  limit: number;
} {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_history_paged.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: {
      items: Record<string, unknown>[];
      total: number;
      pages: number;
      page: number;
      limit: number;
    };
  };
  const { items, total, pages, page, limit } = fixture.body;
  return { items, total, pages, page, limit };
}

/** Lista dostawców do filtra historii z `contract/fixtures/GET_history_meta.json`. */
export function metaHistoriiZFixtura(): { dostawcy: string[] } {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_history_meta.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as { body: { dostawcy: string[] } };
  return { dostawcy: fixture.body.dostawcy };
}

/**
 * Reguły narzutu z `contract/fixtures/GET_markups.json` — jeden pełny wiersz nagrany
 * z produkcji. Ta sama zasada co przy produktach i dostawcach: widok sprawdzamy przeciwko
 * kształtowi, który realnie oddaje backend, a nie przeciwko mojemu wyobrażeniu o nim.
 *
 * ⚠ `warunki` przychodzi jako STRING (`"[]"`), nie tablica — i to jest część kontraktu,
 * nie szczegół zapisu.
 */
export function narzutyZFixtura(): Narzut[] {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_markups.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as { body: Narzut[] };
  return fixture.body;
}

/**
 * Promocje — z fixture'a, czyli PUSTA TABLICA.
 *
 * ⚠ OGRANICZENIE SIATKI, NAZWANE WPROST: `contract/fixtures/GET_promotions.json` nie zawiera
 * ani jednego wiersza, bo produkcja nie miała żadnej promocji w chwili nagrywania. Kształt
 * wiersza NIE JEST więc pokryty nagraniem — testy, które go potrzebują, budują dane
 * z `PROMOCJA_TESTOWA` poniżej, opartej o schemat (`rebuild/schema/001_schema.sql:156-168`).
 * To słabsze świadectwo niż przy narzutach i trzeba o tym pamiętać przy czytaniu wyników.
 */
export function promocjeZFixtura(): Promocja[] {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_promotions.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as { body: Promocja[] };
  return fixture.body;
}

/** Promocja ze SCHEMATU (nie z nagrania) — patrz nota przy `promocjeZFixtura`. */
export const PROMOCJA_TESTOWA: Promocja = {
  id: 1,
  nazwa: "Wyprzedaż zimowa",
  rabatPct: 10,
  zasieg: "BKT,MICHELIN",
  warunki: null,
  priorytet: 50,
  start: "2026-01-01T00:00:00.000Z",
  koniec: "2026-03-31T00:00:00.000Z",
  status: "aktywna",
  zmienilUzytkownikId: 1,
  zmienionoData: "2026-07-31T13:07:21.578Z",
};

/**
 * Konfiguracja z `contract/fixtures/GET_config.json` — płaski obiekt, 11 kluczy, same
 * stringi. Ta sama zasada co przy produktach i dostawcach: zakładki „Shoper" i „AI Fallback"
 * testujemy przeciwko KSZTAŁTOWI, który realnie oddaje produkcja.
 *
 * ⚠ Nagranie NIE zawiera `shoper.kolumny` ani `shoper.separator` — nikt ich w produkcji
 * nie zapisał. Zakładka Shoper musi więc wystartować od wartości domyślnych i właśnie
 * to sprawdza test.
 */
export function konfiguracjaZFixtura(): Record<string, string> {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_config.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as { body: Record<string, string> };
  return fixture.body;
}

/**
 * Limity spedycyjne z `contract/fixtures/GET_spedycja.json` — 5 wierszy z 10 nagranych
 * (`_body_przyciete_z`). Fixture pokrywa oba warianty progu: liczbę (MO1, MO2) i `null`
 * (MO3–MO5), więc test tabeli ma na czym sprawdzić „dostawca bez progu".
 */
export function spedycjaZFixtura(): {
  id: number;
  dostawcaKod: string;
  progNetto: number | null;
  kosztPonizej: number | null;
  kosztPowyzej: number | null;
  dodatkoweReguly: string | null;
}[] {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_spedycja.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: {
      id: number;
      dostawcaKod: string;
      progNetto: number | null;
      kosztPonizej: number | null;
      kosztPowyzej: number | null;
      dodatkoweReguly: string | null;
    }[];
  };
  return fixture.body;
}

/**
 * Alerty z `contract/fixtures/GET_alerts.json` — pięć nagranych wierszy.
 *
 * ⚠ OGRANICZENIE SIATKI, NAZWANE WPROST: wszystkie pięć to `Synchronizacja`/`info`/
 * `rozwiazany`, każdy dla INNEGO dostawcy — czyli w nagraniu NIE MA ANI JEDNEJ POWTÓRKI,
 * a to właśnie powtórki są sednem tej iteracji (339 alertów „Błąd pobierania" w
 * `db/snapshot.db`). Fixture daje więc KSZTAŁT wiersza, ale nie rozkład danych; testy
 * zwijania budują powtórki z tego kształtu przez `zPowtorkami` w `alerty.grupowanie.test.ts`.
 */
export function alertyZFixtura(): Alert[] {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_alerts.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as { body: Alert[] };
  return fixture.body;
}

/**
 * Analityka (blok 10a) — cztery odpowiedzi prosto z nagrań produkcji.
 *
 * ⚠ FIXTURES NIOSĄ KLUCZ `_przyciete`, KTÓREGO API NIE ZWRACA. To adnotacja nagrywarki
 * (`contract/README.md:29` — duże tablice przycięto do 5 elementów), a nie pole odpowiedzi;
 * backend `rebuild/backend/src/repos/analityka.ts` go nie produkuje i GATE tego pilnuje.
 * Loadery poniżej ZDEJMUJĄ go z ciała, żeby mock MSW oddawał to, co realnie oddaje backend —
 * inaczej test widoku pracowałby na kształcie, którego w produkcji nie ma.
 */
function bezKluczyTechnicznych<T extends Record<string, unknown>>(cialo: T): T {
  return Object.fromEntries(Object.entries(cialo).filter(([k]) => !k.startsWith("_"))) as T;
}

function analitykaZFixtura<T extends Record<string, unknown>>(nazwaPliku: string): T {
  const sciezka = resolve(korzenRepo, "contract/fixtures", nazwaPliku);
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as { body: T };
  return bezKluczyTechnicznych(fixture.body);
}

/** `GET /api/analytics/filters` — sześć list po 5 nagranych pozycji. */
export function filtryZFixtura(): Filtry {
  return analitykaZFixtura<Filtry>("GET_analytics_filters.json");
}

/** `GET /api/analytics/status` — `hasHistory: true`, 15597 snapshotów. */
export function statusAnalitykiZFixtura(): StatusHistorii {
  return analitykaZFixtura<StatusHistorii>("GET_analytics_status.json");
}

/** `GET /api/analytics/kpi` — cztery liczby nagłówka. */
export function kpiZFixtura(): Kpi {
  return analitykaZFixtura<Kpi>("GET_analytics_kpi.json");
}

/**
 * `GET /api/analytics/margins` — 5 nagranych grup.
 *
 * ⚠ `low` i `high` są PUSTE, bo cała produkcja mieściła się w marży (5, 80). Widok ich
 * i tak nie renderuje (oryginał też nie), ale trzeba wiedzieć, że ich kształtu to nagranie
 * nie dowodzi — robi to test jednostkowy backendu.
 */
export function marzeZFixtura(): Marze {
  return analitykaZFixtura<Marze>("GET_analytics_margins.json");
}

/**
 * Analityka — ceny (blok 10b). Trzy nagrania obsługujące trzy karty zakładki
 * „Ceny w czasie", przepuszczone przez ten sam `analitykaZFixtura`, więc bez `_przyciete`.
 *
 * ⚠ CZEGO TU NIE MA I BYĆ NIE MA: loaderów dla `GET_analytics_top-zmiany.json`
 * i `GET_analytics_market_group-prices.json`. Obie trasy mają backend, ale **nie mają
 * klienta w UI** (decyzje D1 i D2 użytkownika z 2026-09-03) — oryginał ich nie renderuje.
 * Skoro widok ich nie woła, mock nie ma czego udawać. Osobno testuje je GATE backendu.
 */

/** `GET /api/analytics/prices/last-import` — 5 nagranych wierszy z 500. */
export function ostatniImportZFixtura(): { rows: WierszZmianyCeny[] } {
  return analitykaZFixtura<{ rows: WierszZmianyCeny[] }>(
    "GET_analytics_prices_last-import.json",
  );
}

/**
 * `GET /api/analytics/prices/inflation` — 5 nagranych wierszy z 17.
 *
 * Nagranie trafiło w środek szeregu, więc `inflacjaPct` jest wszędzie liczbą. Że kolumna
 * bywa `null` (pierwszy miesiąc dostawcy), dowodzi test jednostkowy backendu.
 */
export function inflacjaZFixtura(): { hasHistory: boolean; rows: WierszInflacji[] } {
  return analitykaZFixtura<{ hasHistory: boolean; rows: WierszInflacji[] }>(
    "GET_analytics_prices_inflation.json",
  );
}

/**
 * `GET /api/analytics/prices/product-history` — 5 nagranych wierszy z 15 597.
 *
 * ⚠ `stats` w tym nagraniu JEST i musi być, bo backend je zwraca. Widok ich świadomie
 * nie renderuje (decyzja D4) — dokładnie jak `margins.low`/`high` w 10a.
 */
export function historiaCenyZFixtura(): HistoriaCenyProduktu {
  return analitykaZFixtura<HistoriaCenyProduktu>("GET_analytics_prices_product-history.json");
}

/**
 * `GET /api/analytics/suppliers/stability` — 5 nagranych dostawców, `hasHistory: true`.
 *
 * ⚠ NAGRANIE POKAZUJE TYLKO JEDNĄ Z DWÓCH GAŁĘZI. Backend ma drugą (pusta `historia_cen`),
 * o INNYM zestawie kolumn — `produkty`/`sredniaCena`/`sredniStan` zamiast `punkty`. Widok
 * renderuje mimo to stałe siedem kolumn oryginału, więc część z nich zawsze pokazuje „—";
 * test tej gałęzi buduje wiersz sam, bo fixture jej nie zna.
 */
export function stabilnoscDostawcowZFixtura(): StabilnoscDostawcow {
  return analitykaZFixtura<StabilnoscDostawcow>("GET_analytics_suppliers_stability.json");
}

/** `GET /api/analytics/suppliers/lifecycle` — 5 z 500 nagranych pozycji stagingu. */
export function cyklZyciaDostawcowZFixtura(): { rows: WierszCykluZycia[] } {
  return analitykaZFixtura<{ rows: WierszCykluZycia[] }>(
    "GET_analytics_suppliers_lifecycle.json",
  );
}

/** `GET /api/analytics/suppliers/stock` — 5 z 9 nagranych dostawców. */
export function stanDostawcowZFixtura(): { rows: WierszStanuDostawcy[] } {
  return analitykaZFixtura<{ rows: WierszStanuDostawcy[] }>("GET_analytics_suppliers_stock.json");
}
