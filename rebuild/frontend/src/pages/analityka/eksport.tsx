/**
 * Przycisk „CSV" w nagłówku karty analityki — plik = to, co widać w tabeli karty
 * (karta P10.3, backlog #91 ✅, decyzje użytkownika 2026-09-21).
 *
 * ⚠ ŚWIADOME ODSTĘPSTWO OD ORYGINAŁU. Oryginalne `M()` (`frontend-index.js:27938-27940`) robi
 * nawigację `window.location.href = /api/analytics/export/<view>` bez query stringu, a serwer
 * ma dla każdego widoku WŁASNY SQL, inny niż karta nad przyciskiem. Plik nie znał więc
 * filtrów, w Marży miał wiersze per produkt zamiast grup, a w Rotacji ignorował „Bez ruchu dni".
 * W produkcji to nie bolało, bo produkcja nie ma paska filtrów — pasek to NASZE odstępstwo
 * O-10a-2 i to odbudowa stworzyła lukę „zaznaczam dostawcę, a w pliku są wszyscy".
 *
 * DLATEGO PLIK POWSTAJE W PRZEGLĄDARCE, z dokładnie tej tablicy wierszy i tych kolumn, które
 * karta podaje `TabelaAnalityki`:
 *  • filtry globalne i lokalne są już zastosowane — przycisk NIE liczy ich drugi raz;
 *  • plik ma WSZYSTKIE wiersze po filtrach — limit 300 dotyczy tylko rysowania tabeli;
 *  • format i reguła wartości: `csv.ts`.
 *
 * Trasa `GET /api/analytics/export/{view}` zostaje w backendzie i kontrakcie bez zmian
 * (P10.1: lista widoków + 404), ale front jej już nie woła.
 *
 * Pusta tabela po filtrach → plik z samym nagłówkiem (przycisk aktywny). Nieaktywny jest
 * tylko podczas wczytywania: plik z tej chwili byłby pusty bez powodu.
 */
import { Button } from "@/components/ui/button";
import { pobierzPlik } from "@/pages/katalog/eksport";

import { zbudujCsvTabeli, type KolumnaCsv } from "./csv";

/**
 * Dziesięć kart z przyciskiem — nazwy `{view}` oryginału (`frontend-index.js:28065`, `:28109`,
 * `:28147`, `:28190`, `:28233`, `:28310`, `:28432`, `:28470`, `:28531`, `:28573`).
 * Dziś służą jako nazwa pliku (`<view>.csv`, jak w `Content-Disposition` serwera) i jako
 * `data-testid`; zamknięta unia pilnuje, żeby karta nie dostała nazwy spoza listy.
 */
export type WidokEksportu =
  | "suppliers-stability"
  | "suppliers-lifecycle"
  | "suppliers-stock"
  | "ean-comparison"
  | "unique"
  | "prices-last"
  | "availability-products"
  | "sell-through"
  | "margins"
  | "rotation-inactive";

export type PrzyciskCsvProps<T> = {
  widok: WidokEksportu;
  /** Wiersze tabeli karty PO filtrach, PRZED `slice(0, 300)` — ta sama tablica co `dane` tabeli. */
  wiersze: readonly T[];
  /** Te same kolumny, którymi karta rysuje tabelę. */
  kolumny: readonly KolumnaCsv<T>[];
  /** Dane karty jeszcze się wczytują — przycisk nieaktywny. */
  wczytywanie?: boolean;
};

/**
 * Markup 1:1 z oryginałem: `<Button variant="outline" size="sm">CSV</Button>` w nagłówku
 * karty, po prawej stronie tytułu.
 */
export function PrzyciskCsv<T extends Record<string, unknown>>({
  widok,
  wiersze,
  kolumny,
  wczytywanie = false,
}: PrzyciskCsvProps<T>) {
  return (
    <Button
      variant="outline"
      size="sm"
      data-testid={`csv-${widok}`}
      disabled={wczytywanie}
      onClick={() => pobierzPlik(`${widok}.csv`, zbudujCsvTabeli(wiersze, kolumny))}
    >
      CSV
    </Button>
  );
}
