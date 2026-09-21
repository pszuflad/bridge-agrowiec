/**
 * Filtry zakładki „Katalog" — czyste funkcje, port łańcucha filtrów z `HT()` (żywy bundel na
 * `origin/main`):
 *
 *   u.filter(e => "all" === poziom || e.poziom === poziom)
 *    .filter(e => "all" === status || e.status === status)
 *    .filter(e => e.status !== "rozwiazany" || status === "rozwiazany")   // ackalerts pkt 4
 *
 * ⚠ ŚWIADOME ODSTĘPSTWO (decyzja Q3 karty P6.2): filtr statusu ma TE SAME opcje co zakładka
 * „Import" z P6.1 — „Nierozwiązane" (domyślny), „Wszystkie statusy", „Nowy", „Przejrzany",
 * „Rozwiązany". Domyślny widok jest identyczny z oryginałem (rozwiązane ukryte, pkt 4 łatki
 * `ackalerts`, odwrócenie D3 z 13e), ale „Wszystkie statusy" pokazuje też rozwiązane — tak jak
 * w „Imporcie". Oryginał nie miał opcji „Nierozwiązane" i jego „Wszystkie" chowało rozwiązane.
 */
import { FILTR_NIEROZWIAZANE } from "./grupowanie";
import type { AlertKatalogu, PoziomAlertuKatalogu } from "./silnik-katalogu";
import { STATUS_ROZWIAZANY } from "./statusy";

export { FILTR_NIEROZWIAZANE };

export type FiltryKatalogu = {
  /** `null` = wszystkie poziomy. */
  poziom: PoziomAlertuKatalogu | null;
  /** Konkretny status, `FILTR_NIEROZWIAZANE` albo `null` (wszystkie statusy). */
  status: string | null;
};

export const FILTRY_KATALOGU_POCZATKOWE: FiltryKatalogu = {
  poziom: null,
  status: FILTR_NIEROZWIAZANE,
};

function pasujeStatus(status: string, filtr: string | null): boolean {
  if (filtr === null) return true;
  if (filtr === FILTR_NIEROZWIAZANE) return status !== STATUS_ROZWIAZANY;
  return status === filtr;
}

/** Kolejność wejścia zostaje (silnik już sortuje: waga poziomu, potem data malejąco). */
export function filtrujAlertyKatalogu(
  alerty: readonly AlertKatalogu[],
  filtry: FiltryKatalogu,
): AlertKatalogu[] {
  return alerty.filter(
    (a) => (filtry.poziom === null || a.poziom === filtry.poziom) && pasujeStatus(a.status, filtry.status),
  );
}

/**
 * „Zaakceptuj wszystko" (`button-accept-all-alerts` w `HT()`): każdy WIDOCZNY po filtrach alert,
 * który nie jest rozwiązany, idzie na `rozwiazany`. Bez pytania o potwierdzenie — jak w oryginale;
 * pomyłkę cofa „Otwórz ponownie" (decyzja Q4).
 */
export function doZaakceptowania(widoczne: readonly AlertKatalogu[]): string[] {
  return widoczne.filter((a) => a.status !== STATUS_ROZWIAZANY).map((a) => a.id);
}

/** Podpis nad listą — liczniki `nowy` z CAŁEGO zbioru, nie z przefiltrowanego (jak `f`/`h` w `HT()`). */
export function podsumowanieKatalogu(alerty: readonly AlertKatalogu[]): string {
  const krytyczne = alerty.filter((a) => a.poziom === "krytyczny" && a.status === "nowy").length;
  const ostrzezenia = alerty.filter((a) => a.poziom === "ostrzezenie" && a.status === "nowy").length;
  return `${krytyczne} krytycznych · ${ostrzezenia} ostrzeżeń · alerty wyliczane na żywo z katalogu`;
}
