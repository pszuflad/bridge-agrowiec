/**
 * Generator CSV kart analityki — plik = to, co widać w tabeli (karta P10.3, backlog #91).
 *
 * Plik powstaje w PRZEGLĄDARCE z tej samej tablicy wierszy i tych samych kolumn, którymi
 * karta rysuje `TabelaAnalityki`. Filtry (globalne z paska i lokalne karty) są więc już
 * zastosowane, zanim wiersze tu trafią — ten moduł niczego nie filtruje i nie ma prawa.
 *
 * FORMAT — jak eksport serwerowy (`backend/src/analityka/csv.ts`, port `toCsv`/`csvEscape`
 * z `analytics_module.cjs:56-57`), z trzema świadomymi różnicami (decyzje 2026-09-22):
 *
 *  • tak samo: separator `;` (polski Excel), wiersze łączone samym `\n`, cudzysłów tylko
 *    wokół pola z `;`, `"`, `\n` albo `\r` (wewnętrzny `"` podwojony), BOM na początku —
 *    ten ostatni dokłada `pobierzPlik()`, nie ta funkcja;
 *  • INACZEJ: nagłówek to ETYKIETY kolumn tabeli („Śr. marża"), nie klucze pól (`avgMarza`);
 *  • INACZEJ: liczba dziesiętna ma PRZECINEK (`12,5`), bo polski Excel czyta `12.5` jako
 *    tekst albo datę. Bez separatora tysięcy — `1 234,5` z twardą spacją Excel bierze za tekst;
 *  • INACZEJ: kolumny i wiersze są kartą, nie osobnym SQL-em serwera (Marża — grupy, nie produkty).
 *
 * ⚠ REGUŁA WARTOŚCI: do komórki idzie POLE WIERSZA spod `kolumna.key`, nigdy tekst z ekranu.
 * Dotyczy to też kolumn z własnym `render()` — „Dostępność" rysuje pasek z podpisem „87,5%",
 * a w pliku jest liczba `87,5`. Brak wartości (`null`, `undefined`, `""`) to PUSTA komórka,
 * nie „—" z UI: półpauza w komórce psuje sumy i filtry w Excelu.
 */
import type { KolumnaTabeli } from "./TabelaAnalityki";

/** Separator kolumn — ten sam co w eksporcie serwerowym. */
export const SEPARATOR_CSV = ";";

/** Kolumna w oczach generatora: skąd wziąć wartość i jak podpisać nagłówek. */
export type KolumnaCsv<T> = Pick<KolumnaTabeli<T>, "key" | "label">;

/**
 * Wartość pola → tekst komórki (przed escapowaniem).
 *
 * Liczba idzie przez `String()` jak na serwerze, tylko z przecinkiem zamiast kropki.
 * `NaN` i nieskończoności to w danych analityki zawsze artefakt dzielenia przez zero —
 * tabela pokazałaby je jako „NaN", w pliku zostają pustą komórką.
 */
export function wartoscKomorkiCsv(wartosc: unknown): string {
  if (wartosc === null || wartosc === undefined || wartosc === "") return "";
  if (typeof wartosc === "number") {
    return Number.isFinite(wartosc) ? String(wartosc).replace(".", ",") : "";
  }
  return String(wartosc);
}

/** Port `csvEscape` (`analytics_module.cjs:56`) — ta sama reguła co na serwerze. */
export function escapujKomorkeCsv(tekst: string): string {
  return /[;"\n\r]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
}

/**
 * Treść pliku: nagłówek z etykiet + wszystkie przekazane wiersze (bez limitu 300 tabeli).
 * Pusta lista daje sam nagłówek — pusta tabela to też „to, co widać".
 * Bez BOM-u: dokłada go `pobierzPlik()` przy zapisie.
 */
export function zbudujCsvTabeli<T extends Record<string, unknown>>(
  wiersze: readonly T[],
  kolumny: readonly KolumnaCsv<T>[],
): string {
  const naglowek = kolumny.map((k) => escapujKomorkeCsv(k.label)).join(SEPARATOR_CSV);
  const linie = wiersze.map((wiersz) =>
    kolumny.map((k) => escapujKomorkeCsv(wartoscKomorkiCsv(wiersz[k.key]))).join(SEPARATOR_CSV),
  );
  return [naglowek, ...linie].join("\n");
}
