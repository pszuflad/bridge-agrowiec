/**
 * Globalne filtry analityki — stan i stosowanie po stronie KLIENTA (decyzja D2, 2026-09-03).
 *
 * ⚠ DLACZEGO NIE NA BACKENDZIE. `GET /api/analytics/margins` nie przyjmuje żadnego query
 * param (`mirror/backend/analytics_module.cjs:292-297`). W module istnieje `currentWhere(q, alias)`
 * (`:60-74`) zbudowana dokładnie pod te sześć wymiarów plus `cenaMin`/`cenaMax`/`stan` — i ma
 * ZERO wywołań w całych 27 trasach. To martwy kod; ożywienie go dałoby zachowanie, którego
 * żaden fixture nie pokrywa, więc filtrujemy nad pobranymi wierszami.
 *
 * ⚠ CO Z TEGO WYNIKA DLA BLOKÓW 10b–10e. Ten plik NIE jest jedynym wzorcem filtrowania.
 * Trasy, które w ORYGINALE mają parametry (`rotation/inactive?days`, `market/group-prices?group`,
 * `prices/product-history?ean&kod`), filtruje się parametrem w `queryKey`, nie tutaj.
 * Rozstrzyga zawsze oryginał: ma parametr → parametr; nie ma → filtr kliencki.
 */
import type { GrupaMarzy } from "./api";

/** Sześć wymiarów filtra — nazwy 1:1 z kluczami `GET /api/analytics/filters`. */
export const WYMIARY_FILTRA = [
  "dostawcy",
  "marki",
  "modele",
  "rozmiary",
  "indeksyNosnosci",
  "indeksyPredkosci",
] as const;

export type WymiarFiltra = (typeof WYMIARY_FILTRA)[number];

/** Wybór użytkownika: wymiar → zaznaczone wartości. Pusty zbiór = wymiar nie filtruje. */
export type WyborFiltrow = Record<WymiarFiltra, Set<string>>;

export function pustyWybor(): WyborFiltrow {
  return {
    dostawcy: new Set(),
    marki: new Set(),
    modele: new Set(),
    rozmiary: new Set(),
    indeksyNosnosci: new Set(),
    indeksyPredkosci: new Set(),
  };
}

/** Czy cokolwiek jest zaznaczone — nagłówek sekcji pokazuje wtedy, ile wierszy odpadło. */
export function czyPusty(wybor: WyborFiltrow): boolean {
  return WYMIARY_FILTRA.every((w) => wybor[w].size === 0);
}

/**
 * Filtrowanie wierszy marż.
 *
 * Semantyka jest ta sama, którą oryginał zapisał w `currentWhere()` dla backendu:
 * **OR wewnątrz wymiaru, AND między wymiarami** — zaznaczenie „MO1" i „MO2" pokazuje obu
 * dostawców, ale dołożenie marki „BKT" zawęża do produktów, które są jednocześnie od tych
 * dostawców i tej marki.
 *
 * ⚠ WIERSZ MARŻY NIE MA WSZYSTKICH SZEŚCIU WYMIARÓW. `GET /api/analytics/margins` grupuje po
 * `dostawca`, `kategoria` i `marka` — model, rozmiar i oba indeksy w odpowiedzi NIE ISTNIEJĄ,
 * bo grupowanie je zwija. Filtry po tych trzech wymiarach nie mają więc na czym zadziałać
 * w tej sekcji i są tu ŚWIADOMIE POMIJANE, zamiast po cichu zwracać pustą tabelę.
 * `wymiaryNieobslugiwane` mówi wprost, które to są — sekcja pokazuje o tym notkę, żeby
 * użytkownik nie zastanawiał się, czemu zaznaczenie modelu nic nie zmienia. Sekcje 10b–10e,
 * których wiersze niosą te kolumny, zastosują je normalnie.
 */
export const WYMIARY_MARZ: WymiarFiltra[] = ["dostawcy", "marki"];

export function zastosujFiltryMarz(wiersze: GrupaMarzy[], wybor: WyborFiltrow): GrupaMarzy[] {
  const dostawcy = wybor.dostawcy;
  const marki = wybor.marki;
  if (dostawcy.size === 0 && marki.size === 0) return wiersze;

  return wiersze.filter(
    (w) =>
      (dostawcy.size === 0 || dostawcy.has(w.dostawca)) &&
      (marki.size === 0 || marki.has(w.marka)),
  );
}

/**
 * Wymiary stosowane przez sekcję cen (blok 10b).
 *
 * Wiersze `prices/last-import` i `prices/inflation` niosą z sześciu wymiarów katalogu
 * WYŁĄCZNIE `dostawca` — pierwsza czyta `staging_items` (bez marki i modelu), druga
 * grupuje po dostawcy i miesiącu. Pozostałe pięć filtrów nie ma tu na czym zadziałać
 * i sekcja mówi o tym wprost przez `wymiaryNieobslugiwane`, zamiast po cichu zwracać
 * pustą tabelę.
 *
 * Trzeciej karty („3.2 / 3.3 Historia ceny") to nie dotyczy: `prices/product-history`
 * realnie czyta `?ean` i `?kod`, więc filtruje BACKEND, a parametry idą do zapytania.
 *
 * ⚠ Wartość jest ta sama co `WYMIARY_DOSTAWCOW` (blok 10d) i to ZBIEG OKOLICZNOŚCI, nie
 * powód do scalenia: każda sekcja deklaruje swoje wymiary osobno, bo wynikają z kolumn JEJ
 * odpowiedzi. Gdyby kiedyś `prices/last-import` zaczął zwracać markę, zmienia się ta stała
 * i tylko ta. Samo filtrowanie jest już wspólne — `zastosujFiltryDostawcow` niżej.
 */
export const WYMIARY_CEN: WymiarFiltra[] = ["dostawcy"];

/** Wymiary zaznaczone przez użytkownika, na które dana sekcja nie ma jak odpowiedzieć. */
export function wymiaryNieobslugiwane(
  wybor: WyborFiltrow,
  obslugiwane: WymiarFiltra[],
): WymiarFiltra[] {
  return WYMIARY_FILTRA.filter((w) => wybor[w].size > 0 && !obslugiwane.includes(w));
}

/** Etykiety PL wymiarów — używane i w kontrolkach, i w notce o wymiarach pominiętych. */
export const ETYKIETY_WYMIAROW: Record<WymiarFiltra, string> = {
  dostawcy: "Dostawcy",
  marki: "Marki",
  modele: "Modele",
  rozmiary: "Rozmiary",
  indeksyNosnosci: "Indeksy nośności",
  indeksyPredkosci: "Indeksy prędkości",
};

/**
 * Filtrowanie sekcji zakładki `dostawcy` (blok 10d).
 *
 * Wszystkie trzy wiersze tej zakładki (`suppliers/stability`, `suppliers/lifecycle`,
 * `suppliers/stock`) niosą JEDEN wspólny wymiar katalogu — `dostawca`. Marki, modelu,
 * rozmiaru ani indeksów w tych odpowiedziach nie ma: dwie z tras grupują po dostawcy,
 * a trzecia czyta staging, gdzie tych kolumn nie ma w ogóle. Pozostałe pięć wymiarów jest
 * więc ŚWIADOMIE POMIJANE, a sekcja mówi o tym notką — tak samo jak sekcja marż z 10a.
 */
export const WYMIARY_DOSTAWCOW: WymiarFiltra[] = ["dostawcy"];

/**
 * Filtr po dostawcy dla DOWOLNEGO wiersza, który tę kolumnę niesie.
 *
 * Używa go zakładka `dostawcy` (10d) i obie tabelaryczne karty zakładki `ceny` (10b).
 * Semantyka jak w `zastosujFiltryMarz`: pusty zbiór nie filtruje, a zaznaczenie kilku
 * dostawców działa jak OR.
 */
export function zastosujFiltryDostawcow<T extends { dostawca: string }>(
  wiersze: T[],
  wybor: WyborFiltrow,
): T[] {
  const dostawcy = wybor.dostawcy;
  if (dostawcy.size === 0) return wiersze;
  return wiersze.filter((w) => dostawcy.has(w.dostawca));
}
