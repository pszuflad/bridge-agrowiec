/**
 * Formatowanie liczb w analityce — port pomocników `_()` i `D()` z widoku `/analityka`
 * (`deminified/frontend-index.js:27909-27921`, funkcja `zM`).
 *
 * Odtwarzamy je co do zachowania, łącznie z tym, że pusty napis jest traktowany jak brak
 * wartości, a liczby idą przez locale `pl-PL` z maksymalnie dwoma miejscami po przecinku
 * (czyli 6 wyświetla się jako „6", nie „6,00").
 */

/** Znak braku wartości — myślnik półpauzy, tak jak w oryginale. */
export const BRAK = "—";

/** Port `_(e)` (`:27909`). Liczba → locale `pl-PL`; `null`/`undefined`/`""` → „—". */
export function formatuj(wartosc: unknown): string {
  if (wartosc === null || wartosc === undefined || wartosc === "") return BRAK;
  if (typeof wartosc === "number") {
    return wartosc.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
  }
  return String(wartosc);
}

/** Port `D(e)` (`:27917`). To samo co `formatuj`, z doklejonym procentem. */
export function formatujProcent(wartosc: unknown): string {
  if (wartosc === null || wartosc === undefined) return BRAK;
  return `${formatuj(wartosc)}%`;
}

/**
 * Zaokrąglenie liczbowe do `miejsca` miejsc po przecinku — port `round()` backendu
 * (`analytics_module.cjs:52`), potrzebny wszędzie tam, gdzie sekcja LICZY coś sama,
 * zamiast pokazywać liczbę z odpowiedzi.
 *
 * ⚠ To NIE jest to samo co `formatuj()`. Tamto zamienia liczbę w napis dla użytkownika
 * (locale `pl-PL`, „—" dla pustych); to zostaje w domenie liczb, żeby wynik dało się dalej
 * porównywać i sumować. Bloki 10d/10e: używajcie tego zamiast własnego `Math.round(x * 100) / 100`.
 */
export function zaokraglij(wartosc: number, miejsca = 2): number {
  const m = Math.pow(10, miejsca);
  return Math.round(wartosc * m) / m;
}

/**
 * Data w komunikacie o zasięgu historii. Oryginał przepuszcza znacznik ISO przez `_()`,
 * czyli pokazuje go surowo (`:27922` — `"…od " + _(p.od)`); zachowujemy to zamiast
 * ładniejszego formatu, bo to jedyny napis tego nagłówka, który Ania zna z produkcji.
 */
export function formatujZnacznik(znacznik: string | null): string {
  return formatuj(znacznik);
}
