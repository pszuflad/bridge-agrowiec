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

import { BAZA_API, naglowki, rzucGdyBlad } from "@/lib/api";

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

// ─── BLOK 10b · CENY ────────────────────────────────────────────────────────────────────
//
// Trzy hooki dla trzech kart zakładki „Ceny w czasie". Tras jest w bloku pięć, ale
// `top-zmiany` i `market/group-prices` NIE MAJĄ tu klienta i mieć nie mają — pierwsza
// ma zero wywołań w bundlu produkcji, druga jest wołana i ignorowana (martwy fetch).
// Decyzje D1 i D2 użytkownika z 2026-09-03; backend obie dowozi, UI ich nie tyka.
// Dopisanie im hooka „skoro już jest trasa" to budowanie nowej funkcjonalności.

/** Wiersz karty „3.1" — `GET_analytics_prices_last-import.json`. */
export type WierszZmianyCeny = {
  kod: string;
  nazwa: string;
  dostawca: string;
  cenaStara: number | null;
  cenaNowa: number | null;
  zmianaPct: number | null;
  utworzono: string;
};

/** Wiersz karty „3.2 / 3.3" — `GET_analytics_prices_product-history.json`. */
export type WierszHistoriiCeny = {
  data: string;
  dostawca: string;
  kod: string;
  ean: string | null;
  cenaZakupu: number | null;
  cenaSprzedazy: number | null;
  stan: number | null;
};

/**
 * Trzy liczby, które backend liczy i oddaje — i których widok NIE RENDERUJE.
 *
 * ⚠ To nie jest przeoczenie, tylko wierność (decyzja D4): oryginalny frontend destrukturyzuje
 * `stats` z odpowiedzi i nigdzie ich nie pokazuje (`grep ".stats" ` po bundlu → zero użyć).
 * Dokładnie ta sama sytuacja co `margins.low`/`high` w 10a. Typ jest tu, bo kształt
 * odpowiedzi go zawiera i GATE go pilnuje.
 */
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

/** Wiersz karty „3.6" — `GET_analytics_prices_inflation.json`. `inflacjaPct` jest nullowalne. */
export type WierszInflacji = {
  dostawca: string;
  miesiac: string;
  sredniaCena: number | null;
  inflacjaPct: number | null;
};

export function useZmianyCenOstatniegoImportu(): UseQueryResult<{
  rows: WierszZmianyCeny[];
} | null> {
  return useQuery<{ rows: WierszZmianyCeny[] } | null>({
    queryKey: ["/api/analytics/prices/last-import"],
  });
}

export function useInflacjaCen(): UseQueryResult<{
  hasHistory: boolean;
  rows: WierszInflacji[];
} | null> {
  return useQuery<{ hasHistory: boolean; rows: WierszInflacji[] } | null>({
    queryKey: ["/api/analytics/prices/inflation"],
  });
}

/** Odpowiedź „nie pytaliśmy" — ten sam kształt, co pusta odpowiedź backendu. */
const PUSTA_HISTORIA: HistoriaCenyProduktu = {
  hasHistory: false,
  rows: [],
  stats: { min: null, max: null, avg: null },
};

/**
 * `GET /api/analytics/prices/product-history?ean=&kod=` — jedyny hook analityki z realnymi
 * parametrami zapytania.
 *
 * ⚠ DLACZEGO WŁASNY `queryFn`, A NIE KLUCZ-ŚCIEŻKA. Domyślny `queryFn` skleja segmenty
 * klucza (`queryKey.join("/")`, `lib/queryClient.ts`), więc parametr musiałby jechać jako
 * segment `"?ean=…"` doklejony po ukośniku. Oryginał robi to inaczej i to on rozstrzyga:
 * pisze własny `queryFn` z jawnym query stringiem, a klucz trzyma jako
 * `["/api/analytics/prices/product-history", ean, kod]` — czyli segmenty klucza NIE SĄ
 * tam ścieżką (`deminified/frontend-index.js:27870-27877`). Odtwarzamy tę wersję: URL
 * wychodzi taki sam jak w produkcji, a klucz dalej poprawnie rozdziela cache po parametrach.
 *
 * ⚠ NIE ODPYTUJEMY, DOPÓKI OBA POLA SĄ PUSTE — port warunku `n || a ? fetch(…) : {rows:[],
 * stats:{}}` (`:27871`). To jest istotne, bo trasa NIE MA LIMIT-u: bez tego warunku samo
 * wejście na zakładkę ściągałoby całą tabelę `historia_cen` (15 597 wierszy w nagraniu).
 *
 * `401 → null` zgodnie z konwencją całej aplikacji (`on401: "returnNull"`), której domyślny
 * `queryFn` pilnuje za nas, a tutaj musimy odtworzyć ręcznie.
 */
export function useHistoriaCenyProduktu(
  ean: string,
  kod: string,
): UseQueryResult<HistoriaCenyProduktu | null> {
  return useQuery<HistoriaCenyProduktu | null>({
    queryKey: ["/api/analytics/prices/product-history", ean, kod],
    queryFn: async () => {
      if (!ean && !kod) return PUSTA_HISTORIA;

      const url =
        `${BAZA_API}/api/analytics/prices/product-history` +
        `?ean=${encodeURIComponent(ean)}&kod=${encodeURIComponent(kod)}`;
      const odpowiedz = await fetch(url, { headers: naglowki(false), credentials: "include" });
      if (odpowiedz.status === 401) return null;
      await rzucGdyBlad(odpowiedz);
      return (await odpowiedz.json()) as HistoriaCenyProduktu;
    },
  });
}

// ─── BLOK 10d · DOSTAWCY ────────────────────────────────────────────────────────────────
//
// Trzy hooki zakładki `dostawcy` — DOMYŚLNEJ zakładki całego widoku. Czwarta trasa bloku,
// `GET /api/analytics/dostawcy-stats`, ŚWIADOMIE NIE MA TU HOOKA: oryginalny frontend nie
// woła jej ani razu (0 trafień w bundlu), więc dorobienie jej ekranu byłoby budowaniem
// czegoś nowego zamiast odbudowy (decyzja D3 bloku 10d). Backend ją dowozi, GATE ją pokrywa.
//
// Żadna z tych tras nie przyjmuje parametrów query (`analytics_module.cjs:110`, `:133`, `:143`)
// — filtrowanie jest klienckie, przez `zastosujFiltryDostawcow` w `useMemo`.

/**
 * Wiersz karty „1.1 Stabilność cennika dostawcy".
 *
 * ⚠ DWA KSZTAŁTY, ZALEŻNE OD `hasHistory`, I TAK JEST W PRODUKCJI. Gałąź z historią liczy
 * z `historia_cen` (`punkty`, `liczbaZmian`, `sredniaZmianaPct`, `maxZmianaPct`), gałąź
 * zapasowa — z katalogu (`produkty`, `sredniaCena`, `sredniStan` i trzy `null`-e). Klucze,
 * których dana gałąź nie zwraca, po prostu NIE ISTNIEJĄ w wierszu.
 *
 * Tabela renderuje mimo to stały zestaw siedmiu kolumn oryginału, więc część z nich zawsze
 * pokazuje „—" — patrz `SekcjaStabilnoscDostawcow.tsx`. Pola są opcjonalne właśnie po to,
 * żeby ten fakt był widoczny w typie, a nie odkrywany w przeglądarce.
 */
export type WierszStabilnosci = {
  dostawca: string;
  punkty?: number;
  produkty?: number;
  sredniaCena?: number | null;
  sredniStan?: number | null;
  liczbaZmian: number | null;
  sredniaZmianaPct: number | null;
  maxZmianaPct: number | null;
};

export type StabilnoscDostawcow = {
  hasHistory: boolean;
  rows: WierszStabilnosci[];
};

/** Wiersz karty „1.2 Nowości i wycofania" — pozycja stagingu, nie produkt katalogu. */
export type WierszCykluZycia = {
  dostawca: string;
  /** `nowa` albo `wycofana`. */
  typ: string;
  kod: string;
  nazwa: string;
  /** Surowy znacznik ISO — tabela pokazuje go monospace, bez formatowania (jak oryginał). */
  kiedy: string;
  powod: string | null;
};

/** Wiersz karty „1.4 / 1.5 Stan i dostępność dostawcy". */
export type WierszStanuDostawcy = {
  dostawca: string;
  produkty: number;
  sredniStan: number | null;
  dostepne: number;
  /** 0–100; kolumna „Dostępność" rysuje z tego PASEK POSTĘPU, nie liczbę. */
  dostepnoscPct: number | null;
};

export function useStabilnoscDostawcow(): UseQueryResult<StabilnoscDostawcow | null> {
  return useQuery<StabilnoscDostawcow | null>({
    queryKey: ["/api/analytics/suppliers/stability"],
  });
}

export function useCyklZyciaDostawcow(): UseQueryResult<{ rows: WierszCykluZycia[] } | null> {
  return useQuery<{ rows: WierszCykluZycia[] } | null>({
    queryKey: ["/api/analytics/suppliers/lifecycle"],
  });
}

export function useStanDostawcow(): UseQueryResult<{ rows: WierszStanuDostawcy[] } | null> {
  return useQuery<{ rows: WierszStanuDostawcy[] } | null>({
    queryKey: ["/api/analytics/suppliers/stock"],
  });
}
