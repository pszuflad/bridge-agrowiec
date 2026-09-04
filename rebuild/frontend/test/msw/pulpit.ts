/**
 * Handlery pięciu tras, które Pulpit `/` pobiera przy każdym wejściu.
 *
 * ⚠ PO CO TO ISTNIEJE. Do bloku 10f trasa `/` była placeholderem i nie wykonywała ŻADNEGO
 * zapytania, więc testy niezwiązane z pulpitem (shell, logowanie) mogły renderować `<App />`
 * pod adresem `/` bez mockowania czegokolwiek. Od 10f `/` to prawdziwy widok — a
 * `onUnhandledRequest: "error"` (`test/setup.ts`) wywala test przy pierwszym niezamockowanym
 * żądaniu. Ten pomocnik daje takim testom minimum, zamiast kazać każdemu z nich przepisywać
 * pięć handlerów, których ich zakres w ogóle nie dotyczy.
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
    http.get("*/api/history", () => HttpResponse.json([])),
    http.get("*/api/alerts", () => HttpResponse.json([])),
  ];
}
