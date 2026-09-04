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

// ─────────────────────────────────────────────────────────────────────────────────────────
// BLOK 10e — dostępność, tempo schodzenia, sezonowość, rotacja, cykl życia modelu.
//
// Backend: `rebuild/backend/src/routes/analytics.ts` + `repos/analityka.ts` (ten sam ticket).
// Szósta trasa bloku, `GET /api/analytics/importy-timeline`, NIE MA tu hooka i mieć nie
// będzie: oryginalny bundle nie woła jej ani razu, więc dokładanie jej ekranu byłoby
// wymyślaniem nowego widoku (decyzja D2, 2026-09-03) — tak samo jak `bootstrap-current` w 10a.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Wiersz „4.1 Historia dostępności pozycji".
 *
 * ⚠ DWIE GAŁĘZIE BACKENDU DAJĄ RÓŻNE KOLUMNY, stąd dwa pola opcjonalne: przy historii
 * przychodzi `snapshoty`, bez historii — `stan`. Tabela renderuje tylko część wspólną,
 * dokładnie tę, którą renderuje oryginał (`frontend-index.js:28437-28455`).
 *
 * ⚠ W PRAKTYCE TA LISTA JEST PUSTA, GDY ISTNIEJE HISTORIA CEN. Zapytanie gałęzi historycznej
 * pyta `historia_cen` o kolumnę `nazwa`, której ta tabela nie ma — w produkcji też. Szczegóły
 * i dowód z nagrań: `repos/analityka.ts`, nagłówek `bezpiecznieWiersze`.
 */
export type WierszDostepnosci = {
  kod: string;
  ean: string | null;
  dostawca: string;
  nazwa: string | null;
  dostepnoscPct: number | null;
  miesiaceBrakow: string | null;
  /** Tylko gałąź z historią — ile migawek złożyło się na procent. */
  snapshoty?: number;
  /** Tylko gałąź bez historii — bieżący stan magazynowy. */
  stan?: number;
};

export type Dostepnosc = { hasHistory: boolean; rows: WierszDostepnosci[] };

/** Wiersz „4.2 Tempo schodzenia z magazynu". Ta lista jest pusta z tego samego powodu. */
export type WierszTempaSchodzenia = {
  dostawca: string;
  kod: string;
  nazwa: string | null;
  zeszloSztuk: number | null;
};

export type TempoSchodzenia = { hasHistory: boolean; rows: WierszTempaSchodzenia[] };

/** Wiersz „4.4 Sezonowy wzorzec cen". `miesiac` to sam numer (`"01"`–`"12"`), bez roku. */
export type WierszSezonowosci = {
  miesiac: string;
  /** Fixture ma wiersz z pustą marką — to realna wartość, nie brak danych. */
  marka: string | null;
  sredniaCena: number | null;
  dostepnoscPct: number | null;
};

export type Sezonowosc = { hasHistory: boolean; rows: WierszSezonowosci[] };

/** Wiersz „4.6 Cykl życia modelu". Kształt potwierdzony fixture'em. */
export type WierszCykluZycia = {
  marka: string | null;
  model: string;
  pierwszyRaz: string | null;
  ostatniRaz: string | null;
  produkty: number;
};

export type CyklZycia = { hasHistory: boolean; rows: WierszCykluZycia[] };

/** Wiersz „Rotacja / produkty bez aktualizacji". */
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
  /** Zaciśnięta przez backend liczba dni. `null`, gdy w polu wpisano coś nieliczbowego. */
  days: number | null;
  rows: WierszRotacji[];
};

export function useDostepnoscProduktow(): UseQueryResult<Dostepnosc | null> {
  return useQuery<Dostepnosc | null>({ queryKey: ["/api/analytics/availability/products"] });
}

export function useTempoSchodzenia(): UseQueryResult<TempoSchodzenia | null> {
  return useQuery<TempoSchodzenia | null>({
    queryKey: ["/api/analytics/availability/sell-through"],
  });
}

export function useSezonowoscMiesieczna(): UseQueryResult<Sezonowosc | null> {
  return useQuery<Sezonowosc | null>({ queryKey: ["/api/analytics/seasonality/monthly"] });
}

export function useCyklZyciaModeli(): UseQueryResult<CyklZycia | null> {
  return useQuery<CyklZycia | null>({ queryKey: ["/api/analytics/lifecycle/models"] });
}

/**
 * `GET /api/analytics/rotation/inactive?days=…` — JEDYNY hook analityki z parametrem.
 *
 * ⚠ DLACZEGO PARAMETR, A NIE `useMemo`. Rozstrzyga oryginał, nie wygoda: `rotation/inactive`
 * to jedna z niewielu tras modułu, które realnie czytają `req.query`
 * (`analytics_module.cjs:300`), więc filtrowanie należy do backendu, a wartość — do klucza
 * zapytania. Pozostałe cztery sekcje 10e filtrują się klientem, bo ich trasy query nie znają.
 *
 * ⚠ KLUCZ TO JEDEN SEGMENT Z PEŁNYM ADRESEM, nie dwa. `lib/queryClient.ts` skleja klucz
 * przez `queryKey.join("/")`, więc rozbicie na `["…/inactive", "?days=60"]` dałoby URL
 * `…/inactive/?days=60` z ukośnikiem przed znakiem zapytania. Ten sam wzorzec „cały adres
 * w jednym segmencie" niosą `pages/Staging.tsx` i `pages/Historia.tsx` (`adresStrony`).
 *
 * Wartość jest napisem, bo oryginalna kontrolka to zwykły input tekstowy (`useState("60")`)
 * i przepuszcza też napisy nieliczbowe — zaciskanie i tak należy do backendu.
 */
export function useRotacjeNieaktywnych(dni: string): UseQueryResult<Rotacja | null> {
  return useQuery<Rotacja | null>({
    queryKey: [`/api/analytics/rotation/inactive?days=${encodeURIComponent(dni)}`],
  });
}
