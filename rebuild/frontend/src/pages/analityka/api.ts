/**
 * Klient `/api/analytics/*` — backend dowieziony w tym samym bloku 10a
 * (`rebuild/backend/src/routes/analytics.ts`).
 *
 * Wszystkie typy pochodzą z `contract/fixtures/GET_analytics_*.json`, czyli z nagrań żywej
 * produkcji — nie ze schematu openapi, który dla analityki nie ma ŻADNYCH schematów
 * odpowiedzi (`contract/openapi.yaml`: same kody 200/400/401 i `security`).
 *
 * Konwencja klucza zapytania jest konwencją całej aplikacji: KLUCZ JEST ŚCIEŻKĄ
 * (`lib/queryClient.ts` — `queryKey.join("/")` skleja segmenty w URL). Domyślny `queryFn`
 * dokłada nagłówki i `credentials`, więc hooki poniżej podają wyłącznie klucz.
 *
 * ⚠ ŻADEN Z TYCH HOOKÓW NIE PRZYJMUJE PARAMETRÓW FILTRA. Backend `margins` nie ma query
 * params (decyzja D2 — `currentWhere()` oryginału jest martwym kodem i nie ożywiamy go),
 * więc filtrowanie dzieje się nad pobranymi wierszami, w `filtrowanie.ts`. Bloki 10b–10e
 * mają trasy z REALNYMI parametrami (`days`, `group`, `ean`, `kod`) — tam parametr dokłada
 * się do `queryKey`, a nie do `useMemo`. Wzorzec opisuje `README.md` w tym katalogu.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/** Pozycja listy filtra — kolumna aliasowana na `value` (`analytics_module.cjs:98-107`). */
export type WartoscFiltru = { value: string };

/**
 * Sześć list z `GET /api/analytics/filters`.
 *
 * ⚠ ODPOWIEDŹ NIE MA POLA `_przyciete`, mimo że fixture je pokazuje — to adnotacja
 * nagrywarki fixtures (`contract/README.md:29`), nie pole API. Listy są za to realnie
 * długie: SQL ucina je na 1000 (`modele`, `rozmiary`), 500 (`marki`) i 300 (indeksy),
 * i produkcja do tych limitów dobija. Stąd wyszukiwarka w kontrolce filtra.
 */
export type Filtry = {
  dostawcy: WartoscFiltru[];
  marki: WartoscFiltru[];
  modele: WartoscFiltru[];
  rozmiary: WartoscFiltru[];
  indeksyNosnosci: WartoscFiltru[];
  indeksyPredkosci: WartoscFiltru[];
};

/** `GET /api/analytics/status` — zasięg tabeli `historia_cen`. */
export type StatusHistorii = {
  hasHistory: boolean;
  snapshots: number;
  od: string | null;
  do: string | null;
};

/** `GET /api/analytics/kpi` — cztery liczby nagłówka. `avgMarza` jest nullem na pustym katalogu. */
export type Kpi = {
  produkty: number;
  dostawcy: number;
  avgMarza: number | null;
  stagingPending: number;
};

/** Wiersz tabeli marż — grupa dostawca × kategoria × marka. */
export type GrupaMarzy = {
  dostawca: string;
  kategoria: string;
  marka: string;
  produkty: number;
  avgMarza: number | null;
  minMarza: number | null;
  maxMarza: number | null;
};

/** Pozycja list skrajnych. Produkcyjny frontend ich nie renderuje — nasz w 10a też nie. */
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

/**
 * `on401: "returnNull"` z oryginału oznacza, że na wygasłej sesji `data` jest `null`,
 * a nie błędem (`lib/queryClient.ts`). Każda sekcja musi więc radzić sobie z `null`,
 * i dlatego hooki niżej zwracają typ z `| null`, zamiast udawać, że dane zawsze są.
 */
export function useFiltry(): UseQueryResult<Filtry | null> {
  return useQuery<Filtry | null>({ queryKey: ["/api/analytics/filters"] });
}

export function useStatusHistorii(): UseQueryResult<StatusHistorii | null> {
  return useQuery<StatusHistorii | null>({ queryKey: ["/api/analytics/status"] });
}

export function useKpi(): UseQueryResult<Kpi | null> {
  return useQuery<Kpi | null>({ queryKey: ["/api/analytics/kpi"] });
}

export function useMarze(): UseQueryResult<Marze | null> {
  return useQuery<Marze | null>({ queryKey: ["/api/analytics/margins"] });
}

// ════════════════════════════════════════════════════════════════════════════════════════
//  BLOK 10c — EAN. Cztery trasy, które ORYGINALNY frontend realnie woła (`fe.js:27839-27851`).
// ════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠ DWÓCH TRAS TEGO BLOKU TU NIE MA I BYĆ NIE MOŻE: `GET /api/analytics/ean/details`
// i `GET /api/analytics/ean-porownanie`. Obie istnieją w backendzie (blok 10c je dowiózł),
// obie przyjmują `?ean` — i obie mają ZERO wywołań w produkcyjnym bundlu
// (`docs/analityka-bloki-10b-10f.md` §1.1). Dopisanie im hooka byłoby pierwszym krokiem do
// ekranu, którego oryginał nie ma; to samo rozstrzygnięcie co przy
// `POST /api/analytics/bootstrap-current` w 10a (decyzja D6, 2026-09-03).
//
// ⚠ `ean/comparison` PRZYJMUJE `minDiffPct`, a hook go NIE PODAJE — i to jest wierność, nie
// niedopatrzenie. Oryginał woła `d("/api/analytics/ean/comparison")` bez query (`:27839`)
// i nie ma dla tego progu żadnej kontrolki w UI. Gdyby kiedyś miała powstać, parametr idzie
// do `queryKey` (wzorzec z `README.md` §2.2), a nie do `useMemo` — trasa filtruje po stronie
// backendu (decyzja D3, 2026-09-03).

/** Wiersz „2.1-2.4 Porównanie cen po EAN" — EAN u co najmniej dwóch dostawców. */
export type WierszPorownaniaEan = {
  ean: string;
  nazwa: string;
  /** Liczba dostawców, nie ich nazwy — `COUNT(DISTINCT dostawca)` zwinął kolumnę. */
  dostawcy: number;
  cenaMin: number;
  cenaMax: number;
  srednia: number;
  oferty: number;
  spreadZl: number;
  /** `null` przy zerowej cenie minimalnej — gałąź w praktyce nieosiągalna, ale w kształcie jest. */
  spreadPct: number | null;
};

/** Wiersz „2.5 Pozycje unikalne" — EAN dostępny u dokładnie jednego dostawcy. */
export type WierszUnikalnegoEan = {
  ean: string;
  nazwa: string;
  dostawca: string;
  cenaZakupu: number;
  stan: number;
};

/** Wiersz histogramu pokrycia — „ilu dostawców ma dany EAN" → „ile takich EAN-ów". */
export type WierszPokryciaEan = {
  liczbaDostawcow: number;
  liczbaEAN: number;
};

/** Wiersz rankingu dostawców — jak często dostawca jest najtańszy. */
export type WierszRankinguEan = {
  dostawca: string;
  /** ⚠ Myli nazwą: to WSZYSTKIE oferty dostawcy w rankingu, także EAN-y unikalne. */
  wspolnePozycje: number;
  najtanszy: number;
  najtanszyPct: number;
};

export function usePorownanieEan(): UseQueryResult<{ rows: WierszPorownaniaEan[] } | null> {
  return useQuery<{ rows: WierszPorownaniaEan[] } | null>({
    queryKey: ["/api/analytics/ean/comparison"],
  });
}

export function useUnikalneEan(): UseQueryResult<{ rows: WierszUnikalnegoEan[] } | null> {
  return useQuery<{ rows: WierszUnikalnegoEan[] } | null>({
    queryKey: ["/api/analytics/ean/unique"],
  });
}

export function usePokrycieEan(): UseQueryResult<{ rows: WierszPokryciaEan[] } | null> {
  return useQuery<{ rows: WierszPokryciaEan[] } | null>({
    queryKey: ["/api/analytics/ean/coverage"],
  });
}

export function useRankingDostawcowEan(): UseQueryResult<{ rows: WierszRankinguEan[] } | null> {
  return useQuery<{ rows: WierszRankinguEan[] } | null>({
    queryKey: ["/api/analytics/ean/supplier-rank"],
  });
}
