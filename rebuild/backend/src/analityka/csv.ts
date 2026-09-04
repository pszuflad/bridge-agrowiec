/**
 * Format CSV eksportu analityki — port `csvEscape` i `toCsv`
 * (`mirror/backend/analytics_module.cjs:56-57`).
 *
 * To jedyne miejsce w odbudowie, które produkuje CSV, i jedyna odpowiedź całego backendu,
 * która NIE jest JSON-em. Trzy właściwości tego formatu są nieoczywiste i wszystkie trzy
 * są zamierzone przez oryginał — nie „ulepszamy" ich:
 *
 *  1. **Separatorem jest ŚREDNIK, nie przecinek.** Excel w polskiej lokalizacji dzieli
 *     kolumny po średniku; przecinek dałby jedną kolumnę na wiersz. Dlatego też cudzysłów
 *     zakłada się na pola zawierające `;`, a nie `,`.
 *  2. **Na początku pliku stoi BOM (`U+FEFF`).** Bez niego Excel czyta plik jako windows-1250
 *     i „ą" zamienia w krzaki. BOM wychodzi z funkcji ZAWSZE — także dla pustego wyniku,
 *     który jest wtedy plikiem złożonym z samego znacznika.
 *  3. **Nagłówek bierze się z kluczy PIERWSZEGO wiersza**, a nie z sumy kluczy wszystkich
 *     wierszy. Wiersz o innym zestawie pól zgubiłby kolumny albo je przesunął. Wszystkie
 *     dziesięć zapytań eksportu zwraca wiersze jednorodne (SELECT ze stałą listą kolumn),
 *     więc w praktyce to nie boli — ale zachowanie jest portem, nie założeniem.
 *
 * Łącznikiem wierszy jest samo `\n` (bez `\r`), tak jak w oryginale.
 */

/** Znacznik kolejności bajtów — wymusza w Excelu odczyt UTF-8. */
export const BOM = "﻿";

/**
 * Port `csvEscape` (`:56`). `null` i `undefined` dają PUSTE pole (nie napis „null"),
 * a pole ze średnikiem, cudzysłowem albo złamaniem wiersza idzie w cudzysłowy
 * z podwojonym cudzysłowem wewnątrz — czyli tak, jak każe RFC 4180.
 */
export function escapujKomorke(wartosc: unknown): string {
  if (wartosc === null || wartosc === undefined) return "";
  const tekst = String(wartosc);
  return /[;"\n\r]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
}

/**
 * Port `toCsv` (`:57`). Pusta lista → sam BOM; to jest POPRAWNY wynik, nie błąd —
 * tak wygląda w produkcji eksport `availability-products` i `sell-through`
 * (`docs/rebuild-backlog.md` #32).
 */
export function naCsv(wiersze: readonly Record<string, unknown>[]): string {
  const pierwszy = wiersze[0];
  if (!pierwszy) return BOM;
  const kolumny = Object.keys(pierwszy);
  const linie = [
    kolumny.join(";"),
    ...wiersze.map((wiersz) => kolumny.map((k) => escapujKomorke(wiersz[k])).join(";")),
  ];
  return BOM + linie.join("\n");
}
