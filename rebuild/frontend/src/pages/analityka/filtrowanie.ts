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

export const MAPOWANIE_MARZ: MapowanieWymiarow<GrupaMarzy> = {
  dostawcy: (w) => w.dostawca,
  marki: (w) => w.marka,
};

export function zastosujFiltryMarz(wiersze: GrupaMarzy[], wybor: WyborFiltrow): GrupaMarzy[] {
  return zastosujFiltry(wiersze, wybor, MAPOWANIE_MARZ);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// GENERYK — jedno filtrowanie dla wszystkich sekcji (dołożone w bloku 10e).
//
// 10a miało jedną sekcję i jedną funkcję filtrującą. 10e dokłada pięć sekcji, z których
// każda niesie INNY podzbiór sześciu wymiarów (wiersz sezonowości zna tylko markę, wiersz
// rotacji zna cztery wymiary), więc piąta kopia tej samej pętli byłaby czystym powielaniem.
// Sekcja deklaruje MAPOWANIE „wymiar → pole wiersza", a semantyka OR/AND zostaje jedna.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Które wymiary filtra sekcja umie zastosować i skąd bierze dla nich wartość.
 *
 * Wymiar NIEOBECNY w mapie to wymiar, którego wiersz tej sekcji nie niesie — nie filtruje
 * więc niczym i trafia do notki z `wymiaryNieobslugiwane`. To jest świadoma deklaracja,
 * a nie przeoczenie: pusta tabela „bo filtr nie miał na czym zadziałać" byłaby gorsza.
 */
export type MapowanieWymiarow<T> = Partial<Record<WymiarFiltra, (wiersz: T) => string | null>>;

/** Wymiary zadeklarowane przez sekcję — do przekazania do `wymiaryNieobslugiwane`. */
export function wymiaryZMapowania<T>(mapowanie: MapowanieWymiarow<T>): WymiarFiltra[] {
  return WYMIARY_FILTRA.filter((w) => mapowanie[w] !== undefined);
}

/**
 * Filtrowanie klienckie: **OR wewnątrz wymiaru, AND między wymiarami** — ta sama semantyka,
 * którą oryginał zapisał w `currentWhere()` dla backendu (`analytics_module.cjs:60-74`).
 *
 * Wiersz z pustą wartością wymiaru (`null`) odpada, gdy ten wymiar filtruje — zaznaczenie
 * konkretnej marki nie może przepuszczać wierszy bez marki.
 */
export function zastosujFiltry<T>(
  wiersze: T[],
  wybor: WyborFiltrow,
  mapowanie: MapowanieWymiarow<T>,
): T[] {
  const czynne = wymiaryZMapowania(mapowanie).filter((w) => wybor[w].size > 0);
  if (czynne.length === 0) return wiersze;

  return wiersze.filter((wiersz) =>
    czynne.every((wymiar) => {
      const wartosc = mapowanie[wymiar]?.(wiersz);
      return wartosc !== null && wartosc !== undefined && wybor[wymiar].has(wartosc);
    }),
  );
}

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

// ════════════════════════════════════════════════════════════════════════════════════════
//  BLOK 10c — EAN. Które wymiary globalnego filtra mają w tej zakładce na czym zadziałać.
// ════════════════════════════════════════════════════════════════════════════════════════
//
// Odpowiedź wynika z SELECT-ów, nie z życzeń: wiersz może być filtrowany tylko po kolumnie,
// którą realnie niesie. Cztery trasy EAN grupują po `ean`, więc większość wymiarów katalogu
// (marka, model, rozmiar, oba indeksy) `GROUP BY` po prostu zwinął — nie ma ich w odpowiedzi
// i nie da się ich odtworzyć po stronie klienta.
//
//   • `ean/comparison`  → `ean, nazwa, dostawcy(LICZBA), cenaMin, cenaMax, srednia, oferty`
//   • `ean/coverage`    → `liczbaDostawcow, liczbaEAN`
//   • `ean/unique`      → `ean, nazwa, dostawca, cenaZakupu, stan`
//   • `ean/supplier-rank` → `dostawca, wspolnePozycje, najtanszy, najtanszyPct`
//
// Tylko dwie ostatnie mają kolumnę `dostawca`. Przy pierwszych dwóch `dostawcy` to LICZBA
// dostawców, nie ich nazwy — filtr po dostawcy nie ma się o co zaczepić. Zamiast po cichu
// zwracać pustą tabelę, sekcja wypisuje wymiary pominięte (`wymiaryNieobslugiwane`).

/** Porównanie cen po EAN — wiersz nie niesie ŻADNEJ z sześciu kolumn filtra. */
export const WYMIARY_EAN_PORWNANIE: WymiarFiltra[] = [];

/** Histogram pokrycia — wiersz to dwie liczby, nie ma czego filtrować. */
export const WYMIARY_EAN_POKRYCIE: WymiarFiltra[] = [];

/** Pozycje unikalne — jedyna kolumna filtra w wierszu to `dostawca`. */
export const WYMIARY_EAN_UNIKALNE: WymiarFiltra[] = ["dostawcy"];

/** Ranking dostawców — jedyna kolumna filtra w wierszu to `dostawca`. */
export const WYMIARY_EAN_RANKING: WymiarFiltra[] = ["dostawcy"];

// Samego filtrowania po dostawcy sekcja EAN NIE definiuje po raz drugi — używa
// `zastosujFiltryDostawcow` niżej (blok 10d). Funkcja jest generyczna po `{dostawca: string}`,
// więc obsługuje i wiersze dostawców, i wiersze EAN; dwie identyczne implementacje pod różnymi
// nazwami byłyby czystym długiem (wykryte przy scalaniu 10c z 10d, 2026-09-04).

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

export function zastosujFiltryDostawcow<T extends { dostawca: string }>(
  wiersze: T[],
  wybor: WyborFiltrow,
): T[] {
  const dostawcy = wybor.dostawcy;
  if (dostawcy.size === 0) return wiersze;
  return wiersze.filter((w) => dostawcy.has(w.dostawca));
}
