/**
 * Dane Pulpitu `/` — port zapytań `N2` (`deminified/frontend-index.js:16836-16852`).
 *
 * ⚠ PULPIT NIE WOŁA ANI JEDNEJ TRASY `/api/analytics/*`. Wygląda inaczej, niż sugerowała
 * roadmapa: kafle KPI nie biorą się z `GET /api/analytics/kpi`, tylko są LICZONE PO STRONIE
 * KLIENTA z surowych `/api/products` i `/api/staging`. Oryginał pobiera cztery trasy:
 *
 *   ["/api/products"]   ["/api/staging"]   ["/api/suppliers"]   ["/api/history"]
 *
 * ⚠ DWIE Z NICH MAJĄ PO DWA KSZTAŁTY ODPOWIEDZI. `GET /api/products` i `GET /api/staging`
 * bez parametrów oddają **gołą tablicę**, a z `?limit`/`?dostawca` — kopertę
 * `{items,total,limit,offset}` (fixtures zamrażają wariant drugi; `backend/src/routes/
 * products.ts` i `staging.ts`). Pulpit woła je BEZ parametrów, więc `dane?.length` liczy to,
 * co trzeba. Doklejenie tu `?limit` po cichu zmieniłoby kształt i wyzerowało oba kafle.
 *
 * Klucz zapytania jest ścieżką — `lib/queryClient.ts` skleja `queryKey.join("/")` i dokłada
 * nagłówki; własny `queryFn` nie jest tu potrzebny, bo żadna z tych tras nie ma parametrów.
 * Typ ma `| null`, bo `on401: "returnNull"` oznacza `null` na wygasłej sesji, nie błąd.
 *
 * Alertów TU NIE MA celowo — Pulpit reużywa `pobierzAlerty()` z `pages/alerty/api.ts`
 * (Iteracja 6). Drugi klient tej samej trasy byłby czystym powielaniem.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { Produkt } from "@/pages/katalog/filtrowanie";
import type { PozycjaStagingu } from "@/pages/staging/dane";

/**
 * Wiersz `GET /api/history` — tabela `history`, kształt z `contract/fixtures/GET_history.json`.
 *
 * ⚠ TO NIE JEST `WpisHistorii` z `pages/historia/dane.ts`. Tamten opisuje `/api/history/paged`,
 * które czyta `audit_log` i ma pola `typ`, `kiedy`, `liczbaPozycji`. Ta trasa czyta INNĄ
 * TABELĘ — dziennik zmian pól produktu — i żadnego z tych pól nie ma. Rozróżnienie jest
 * opisane w nagłówku `backend/src/routes/history.ts`; pomylenie ich to prosta droga
 * do kafla, który zawsze pokazuje „—" (patrz `ostatniEksport` w `kpi.ts`).
 */
export type WpisDziennikaZmian = {
  id: number;
  data: string;
  kodProduktu: string;
  nazwa: string;
  pole: string;
  staraWartosc: string | null;
  nowaWartosc: string | null;
  zrodlo: string;
  kto: string | null;
  wykonalUzytkownikId: number | null;
};

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
 * Dziennik zmian pól produktu.
 *
 * ⚠ NA STAGINGU TA TRASA ZWRACA `[]` I TO NIE JEST BŁĄD. Jedynym pisarzem tabeli `history`
 * jest ręczna edycja produktu w katalogu, a ta nie została jeszcze sportowana — więc dopóki
 * jej nie ma, lista jest pusta. Widok musi to przeżyć bez komunikatu o błędzie.
 */
export function useDziennikZmian(): UseQueryResult<WpisDziennikaZmian[] | null> {
  return useQuery({ queryKey: ["/api/history"] });
}
