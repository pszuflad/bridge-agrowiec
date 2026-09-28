/**
 * Handlery sześciu tras, które Pulpit `/` pobiera przy każdym wejściu.
 *
 * ⚠ PO CO TO ISTNIEJE. Do bloku 10f trasa `/` była placeholderem i nie wykonywała ŻADNEGO
 * zapytania, więc testy niezwiązane z pulpitem (shell, logowanie) mogły renderować `<App />`
 * pod adresem `/` bez mockowania czegokolwiek. Od 10f `/` to prawdziwy widok — a
 * `onUnhandledRequest: "error"` (`test/setup.ts`) wywala test przy pierwszym niezamockowanym
 * żądaniu. Ten pomocnik daje takim testom minimum, zamiast kazać każdemu z nich przepisywać
 * sześć handlerów, których ich zakres w ogóle nie dotyczy.
 *
 * Test, który REALNIE sprawdza pulpit (`test/pulpit.test.tsx`), rejestruje własne handlery
 * z fixtures — ten plik jest tłem dla pozostałych, nie ich zamiennikiem.
 */
import { http, HttpResponse } from "msw";

/** Puste odpowiedzi w kształcie, jaki oddaje produkcja: gołe tablice, nie koperty. */
export function handleryPulpitu() {
  return [
    http.get("*/api/products", () => HttpResponse.json([])),
    http.get("*/api/staging", () => HttpResponse.json([])),
    http.get("*/api/suppliers", () => HttpResponse.json([])),
    // Kafel „Ostatni eksport CSV" (P10.2, #34) — dwa zapytania `typ=eksport|import&limit=1`.
    // Goła `/api/history` wypadła z Pulpitu razem z martwym kaflem.
    http.get("*/api/history/paged", () =>
      HttpResponse.json({ items: [], total: 0, pages: 1, page: 1, limit: 1 }),
    ),
    http.get("*/api/alerts", () => HttpResponse.json([])),
    // Statusy pseudo-alertów katalogowych (P6.2) — Pulpit liczy je z `/api/products`.
    http.get("*/api/alerty-katalogu/statusy", () => HttpResponse.json([])),
  ];
}
