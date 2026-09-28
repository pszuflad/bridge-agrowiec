/**
 * Dwa formaty CSV eksportu do Shopera — port `a()` i `o()`
 * (`deminified/backend-index.cjs:48770-48782` i `:48819-48851`).
 *
 * ⚠ TO SĄ DWA RÓŻNE FORMATY, NIE JEDEN Z OPCJAMI, i stoją za dwiema różnymi trasami:
 *
 *  - `csvDostawcy()` → `GET /api/export-shoper`: nagłówek STAŁY, 7 kolumn, filtr `stan >= 0`,
 *    bez parametru zwija się do ZIP-a z plikiem per dostawca.
 *  - `csvWgKolumn()` → `GET /api/export/shoper`: nagłówek z konfiguracji
 *    (`shoper.format_eksportu`), 21 dostępnych kolumn, BEZ filtra na stan, zawsze jeden plik.
 *
 * Wspólne dla obu: separator `;`, BOM UTF-8, łącznik `\r\n`, przecinek dziesiętny w cenach.
 *
 * ⚠ ŻADEN Z TYCH DWÓCH FORMATÓW NIE MA CUDZYSŁOWÓW. Zamiast escapować pole zawierające
 * średnik, oryginał ZAMIENIA W NIM `;` NA `,` (w nazwie, marce, modelu, kategorii) — i to
 * jest cała ochrona przed rozjechaniem kolumn. Dlatego ten moduł nie używa `escapujKomorke`
 * z `analityka/csv.ts` ani `esc()` z generatora Selly: te dwa formaty naprawdę escapują,
 * a ten nie. Ujednolicenie zmieniłoby zawartość plików, które Ania wgrywa do Shopera.
 */

import type { Produkt } from "../repos/products.js";

/** BOM — wymusza w Excelu odczyt UTF-8 (jak w pozostałych eksportach). */
const BOM = "﻿";

/** Nagłówek `GET /api/export-shoper` — stały, siedmiokolumnowy (`:48771`). */
export const NAGLOWEK_EXPORT_SHOPER =
  "kod_produktu;aktywny;nazwa;cena;vat;jednostka;kategoria";

/** Domyślne kolumny `GET /api/export/shoper`, gdy `shoper.format_eksportu` jest pusty (`:48854`). */
export const DOMYSLNY_FORMAT_EKSPORTU = "ean;nazwa;producent;rozmiar;cena_netto;magazyn;vat";

/** Cena w formacie polskim: dwa miejsca po przecinku, przecinek dziesiętny. */
function cena(wartosc: unknown): string {
  return Number(wartosc ?? 0)
    .toFixed(2)
    .replace(".", ",");
}

/** Jedyna ochrona kolumn w obu formatach: średnik w treści staje się przecinkiem. */
function bezSrednika(wartosc: unknown): string {
  return String(wartosc ?? "").replace(/;/g, ",");
}

/**
 * CSV jednego dostawcy — port `a(dostawca)` (`:48770-48782`).
 *
 * ⚠ `aktywny` to `1` TYLKO gdy produkt ma status „aktywny" ORAZ dodatni stan; sam status
 * nie wystarczy. Filtr wierszy to `stan >= 0`, więc produkt ze stanem `0` W PLIKU JEST,
 * ale z `aktywny=0`. Odcinane są wyłącznie stany ujemne.
 *
 * ⚠ `cena` bierze `cenaSprzedazy`, nie `cenaZakupu` — to plik dla sklepu.
 */
export function csvDostawcy(produkty: readonly Produkt[], dostawca: string): string {
  const wiersze = produkty
    .filter((p) => p.dostawca === dostawca)
    .filter((p) => p.stan >= 0)
    .map((p) => {
      const aktywny = p.status === "aktywny" && p.stan > 0 ? "1" : "0";
      return `${p.kod};${aktywny};${bezSrednika(p.nazwa)};${cena(p.cenaSprzedazy)};${p.vat};szt;${p.kategoria}`;
    });

  return BOM + [NAGLOWEK_EXPORT_SHOPER, ...wiersze].join("\r\n");
}

/**
 * Słownik dostępnych kolumn `GET /api/export/shoper` — port obiektu `s` (`:48819-48841`).
 * Klucz spoza tego słownika daje PUSTE pole, nie błąd (`:48847`) — literówka w konfiguracji
 * jest więc cicha, widać ją dopiero po pustej kolumnie w Excelu. Zastane zachowanie.
 *
 * ⚠ `ean` i `ean_raw` wychodzą jako `="1234567890123"`. To formuła Excela, nie pomyłka:
 * bez niej arkusz zamienia 13-cyfrowy kod na notację naukową `1,23457E+12`. Pusty EAN daje
 * puste pole, nie `=""`.
 *
 * ⚠ `magazyn` woli `magazynRaw` (napis z cennika, np. „>10") i dopiero potem `stan`;
 * `stan` osobno oddaje zawsze liczbę. To dwie różne kolumny o różnym znaczeniu.
 */
export const KOLUMNY_EXPORT_SHOPER: Record<string, (p: Produkt) => string> = {
  ean: (p) => (p.ean ? `="${String(p.ean)}"` : ""),
  ean_raw: (p) => (p.eanRaw ? `="${String(p.eanRaw)}"` : ""),
  kod: (p) => String(p.kod ?? ""),
  kod_produktu: (p) => String(p.kod ?? ""),
  nazwa: (p) => bezSrednika(p.nazwa),
  producent: (p) => bezSrednika(p.marka),
  marka: (p) => bezSrednika(p.marka),
  model: (p) => bezSrednika(p.model),
  kategoria: (p) => bezSrednika(p.kategoria),
  rozmiar: (p) => String(p.rozmiar ?? ""),
  cena_netto: (p) => cena(p.cenaSprzedazy),
  cena: (p) => cena(p.cenaSprzedazy),
  cena_zakupu: (p) => cena(p.cenaZakupu),
  vat: (p) => String(p.vat ?? 23),
  magazyn: (p) => String(p.magazynRaw ?? p.stan ?? ""),
  magazyn_raw: (p) => String(p.magazynRaw ?? ""),
  stan: (p) => String(p.stan ?? 0),
  dostawca: (p) => String(p.dostawca ?? ""),
  aktywny: (p) => (p.status === "aktywny" && (p.stan ?? 0) > 0 ? "1" : "0"),
  status: (p) => String(p.status ?? ""),
  jednostka: () => "szt",
};

/**
 * CSV wg listy kolumn — port `o(kolumny, dostawca)` (`:48843-48851`).
 *
 * ⚠ BRAK FILTRA `stan >= 0`, w odróżnieniu od `csvDostawcy`. Produkt ze stanem ujemnym
 * (zdarza się przy korektach cennika) wyjdzie tu w pliku, a tam nie. To realna różnica
 * między dwiema trasami, nie niedopatrzenie portu.
 *
 * Nazwy kolumn są `trim()`owane dopiero przy szukaniu w słowniku, tak jak w oryginale —
 * dzięki temu `"ean; nazwa"` z konfiguracji też zadziała, ale w NAGŁÓWKU pliku spacja
 * zostanie. Zachowane 1:1.
 */
export function csvWgKolumn(
  produkty: readonly Produkt[],
  kolumny: readonly string[],
  dostawca?: string,
): string {
  const wybrane = produkty.filter((p) => !dostawca || p.dostawca === dostawca);
  const wiersze = wybrane.map((p) =>
    kolumny
      .map((nazwa) => {
        const generator = KOLUMNY_EXPORT_SHOPER[nazwa.trim()];
        return generator ? generator(p) : "";
      })
      .join(";"),
  );

  return BOM + [kolumny.join(";"), ...wiersze].join("\r\n");
}

/**
 * Rozbicie `shoper.format_eksportu` na listę kolumn (`:48854`). Pusta wartość, brak klucza
 * i sam napis złożony ze średników dają domyślny format.
 */
export function kolumnyZFormatu(format: string | null | undefined): string[] {
  return (format || DOMYSLNY_FORMAT_EKSPORTU)
    .split(";")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Liczba wierszy danych w gotowym pliku — port `csv.split("\r\n").length - 1` z audytu
 * (`:48812`, `:48861`). Wyliczane z TREŚCI, nie z długości listy produktów, bo tak robi
 * oryginał i tak trafia do dziennika.
 */
export function liczbaWierszyDanych(csv: string): number {
  return csv.split("\r\n").length - 1;
}
