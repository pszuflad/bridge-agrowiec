/**
 * Dane Pulpitu `/` — port zapytań `N2` (`deminified/frontend-index.js:16836-16852`).
 *
 * ⚠ PULPIT NIE WOŁA ANI JEDNEJ TRASY `/api/analytics/*`. Wygląda inaczej, niż sugerowała
 * roadmapa: kafle KPI nie biorą się z `GET /api/analytics/kpi`, tylko są LICZONE PO STRONIE
 * KLIENTA z surowych `/api/products` i `/api/staging`. Oryginał pobiera cztery trasy:
 *
 *   ["/api/products"]   ["/api/staging"]   ["/api/suppliers"]   ["/api/history"]
 *
 * ⚠ ŚWIADOME ODSTĘPSTWO (backlog #34, decyzja Ani 2026-09-21; karta P10.2, ticket 96): czwartej
 * trasy odbudowa NIE woła. Oryginał brał z niej wyłącznie kafel „Ostatni eksport CSV", który
 * szukał tam pola `typ` — a wiersze tabeli `history` go nie mają, więc kafel był trwale martwy.
 * Kafel czyta teraz `GET /api/history/paged` (`useOstatniWpisHistorii` niżej).
 *
 * ⚠ DWIE Z TRAS ORYGINAŁU MAJĄ PO DWA KSZTAŁTY ODPOWIEDZI. `GET /api/products` i `GET /api/staging`
 * bez parametrów oddają **gołą tablicę**, a z `?limit`/`?dostawca` — kopertę
 * `{items,total,limit,offset}` (fixtures zamrażają wariant drugi; `backend/src/routes/
 * products.ts` i `staging.ts`). Pulpit woła je BEZ parametrów, więc `dane?.length` liczy to,
 * co trzeba. Doklejenie tu `?limit` po cichu zmieniłoby kształt i wyzerowało oba kafle.
 *
 * Klucz zapytania jest ścieżką — `lib/queryClient.ts` skleja `queryKey.join("/")` i dokłada
 * nagłówki; własny `queryFn` nie jest tu potrzebny — parametry `/paged` są już w samym adresie.
 * Typ ma `| null`, bo `on401: "returnNull"` oznacza `null` na wygasłej sesji, nie błąd.
 *
 * Alertów TU NIE MA celowo — Pulpit reużywa `pobierzAlerty()` z `pages/alerty/api.ts`
 * (Iteracja 6). Drugi klient tej samej trasy byłby czystym powielaniem.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { Produkt } from "@/pages/katalog/filtrowanie";
import { adresStrony, type StronaHistorii } from "@/pages/historia/dane";
import type { PozycjaStagingu } from "@/pages/staging/dane";

/**
 * Dostawca z `GET /api/suppliers` — kształt z `contract/fixtures/GET_suppliers.json`.
 *
 * Osobny typ od `DostawcaKonfiguracji` (`pages/konfiguracja/dostawcy.ts`), bo tabela Pulpitu
 * pokazuje dwie kolumny, których tamten typ nie deklaruje: `ostatniaAktualizacjaCeny`
 * i `ostatniaAktualizacjaStanu`.
 */
export type DostawcaPulpitu = {
  id: number;
  kod: string;
  nazwa: string;
  email: string | null;
  formatPliku: string | null;
  ostatniPlik: string | null;
  ostatniaAktualizacjaCeny: string | null;
  ostatniaAktualizacjaStanu: string | null;
  liczbaProduktow: number;
  status: string;
};

/** Cały aktywny katalog gołą tablicą — tak, jak robi to `/katalog` (`Katalog.tsx`). */
export function useProdukty(): UseQueryResult<Produkt[] | null> {
  return useQuery({ queryKey: ["/api/products"] });
}

/** Cały staging gołą tablicą. */
export function useStaging(): UseQueryResult<PozycjaStagingu[] | null> {
  return useQuery({ queryKey: ["/api/staging"] });
}

/** Dziesięciu dostawców M1–M10 — źródło tabeli „Ostatnia aktywność dostawców". */
export function useDostawcy(): UseQueryResult<DostawcaPulpitu[] | null> {
  return useQuery({ queryKey: ["/api/suppliers"] });
}

/**
 * Najnowszy wpis Historii danego typu — źródło kafla „Ostatni eksport CSV" (backlog #34).
 *
 * `GET /api/history/paged` z `typ`, `page=1&limit=1`: backend zawęża po typie w SQL, bez limitu
 * 5000 (backlog #87), i sortuje malejąco po `kiedy`, więc jedyny wpis strony to najświeższy.
 * Adres składa ten sam `adresStrony()`, co widok `/historia` — klucz cache ma jedną postać.
 *
 * Co jest „eksportem", a co „importem", rozstrzyga słownik akcji backendu
 * (`backend/src/historia/mapowanie.ts`) — kafel pokazuje dokładnie to, co pokazuje Historia.
 *
 * `refetchOnMount: "always"` wbrew `staleTime: Infinity` klienta: bez tego eksport zrobiony
 * w katalogu nie pojawiłby się na Pulpicie aż do przeładowania strony (plan.md D5 ticketu 96).
 */
export function useOstatniWpisHistorii(
  typ: "eksport" | "import",
): UseQueryResult<StronaHistorii | null> {
  return useQuery({
    queryKey: [adresStrony({ page: 1, limit: 1, search: "", typ, dostawca: "all" })],
    refetchOnMount: "always",
  });
}
