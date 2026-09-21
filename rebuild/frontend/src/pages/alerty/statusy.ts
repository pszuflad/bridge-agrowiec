/**
 * Statusy alertu i akcje, które je zmieniają — WSPÓLNE dla list na `/alerty`.
 *
 * Dziś korzysta z tego lista alertów importu (`TabelaAlertow.tsx`). Karta P6.2 (pseudo-alerty
 * katalogowe) ma mieć TE SAME trzy statusy i te same przyciski, więc importuje stąd, zamiast
 * powtarzać słownictwo — obie listy mają mówić do Ani tymi samymi słowami.
 *
 * SŁOWNICTWO z oryginału `HT()` (`deminified/frontend-index.js:25177-25340`), który Ania zna
 * z produkcji: przyciski „Oznacz jako przejrzany" i „Rozwiąż", filtr „Nowy" / „Przejrzany" /
 * „Rozwiązany". Akcja „Otwórz ponownie" jest NASZA — oryginał nie ma drogi powrotnej, a przy
 * trzech stanach pomyłka musi dać się cofnąć (decyzja D2, ticket
 * `72-FEATURE-alerty-przejrzany-szukajka`).
 */

/** 1:1 z `StatusAlertu` w `backend/src/repos/alerts.ts`. */
export const STATUS_NOWY = "nowy";
/** „Widziałam, ale jeszcze nie załatwione" — alert zostaje na liście roboczej. */
export const STATUS_PRZEJRZANY = "przejrzany";
/** „Załatwione". Pisownia bez ogonka to surowa wartość z bazy, nie literówka. */
export const STATUS_ROZWIAZANY = "rozwiazany";

export type StatusAlertu =
  | typeof STATUS_NOWY
  | typeof STATUS_PRZEJRZANY
  | typeof STATUS_ROZWIAZANY;

/**
 * Etykiety statusów w FILTRZE — jak opcje filtra w `HT()`. Plakietka przy alercie pokazuje
 * natomiast surową wartość (`rozwiazany`), tak samo jak oryginał.
 */
export const ETYKIETY_STATUSU: Record<StatusAlertu, string> = {
  [STATUS_NOWY]: "Nowy",
  [STATUS_PRZEJRZANY]: "Przejrzany",
  [STATUS_ROZWIAZANY]: "Rozwiązany",
};

/**
 * Kolumna `alerts.status` nie ma `CHECK`, więc z bazy może przyjść status spoza trzech
 * znanych — wtedy pokazujemy go pod surową nazwą, zamiast go chować.
 */
export function etykietaStatusu(status: string): string {
  return (ETYKIETY_STATUSU as Record<string, string>)[status] ?? status;
}

export type AkcjaStatusu = {
  /** Status, na który akcja przestawia alert. */
  cel: StatusAlertu;
  etykieta: string;
};

/**
 * Które przyciski pokazać przy alercie o danym statusie. Reguła ma trzy warunki, a nie tabelę
 * trzech przypadków, bo status spoza znanych też musi dać się obsłużyć:
 *  - „Oznacz jako przejrzany" — tylko przy `nowy` (jak w `HT()`);
 *  - „Rozwiąż" — przy wszystkim, co nie jest `rozwiazany` (jak w `HT()`);
 *  - „Otwórz ponownie" — przy wszystkim, co nie jest `nowy` (nasze, patrz nagłówek).
 */
export function akcjeStatusu(status: string): AkcjaStatusu[] {
  const akcje: AkcjaStatusu[] = [];
  if (status === STATUS_NOWY) {
    akcje.push({ cel: STATUS_PRZEJRZANY, etykieta: "Oznacz jako przejrzany" });
  }
  if (status !== STATUS_ROZWIAZANY) {
    akcje.push({ cel: STATUS_ROZWIAZANY, etykieta: "Rozwiąż" });
  }
  if (status !== STATUS_NOWY) {
    akcje.push({ cel: STATUS_NOWY, etykieta: "Otwórz ponownie" });
  }
  return akcje;
}
