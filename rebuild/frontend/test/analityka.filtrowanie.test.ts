/**
 * Filtrowanie kliencke analityki (blok 10a) — semantyka OR/AND i świadome pominięcia.
 *
 * Test istnieje, bo ta logika jest w odbudowie NOWA: backend `margins` nie ma filtrów
 * (`mirror/backend/analytics_module.cjs:292-297`), a `currentWhere()` z oryginału jest
 * martwym kodem (zero wywołań), więc żaden fixture nie mówi, jak filtrowanie ma się
 * zachować. Referencją jest zapis warunków w `currentWhere()` — OR w obrębie wymiaru,
 * AND między wymiarami — i to jego odtwarzamy po stronie klienta (decyzja D2).
 */
import { describe, expect, it } from "vitest";

import type { GrupaMarzy } from "@/pages/analityka/api";
import {
  czyPusty,
  pustyWybor,
  WYMIARY_DOSTAWCOW,
  WYMIARY_FILTRA,
  WYMIARY_MARZ,
  wymiaryNieobslugiwane,
  zastosujFiltryDostawcow,
  zastosujFiltryMarz,
  type WyborFiltrow,
} from "@/pages/analityka/filtrowanie";

function grupa(dostawca: string, marka: string, kategoria = "Rolnicze"): GrupaMarzy {
  return { dostawca, kategoria, marka, produkty: 1, avgMarza: 10, minMarza: 10, maxMarza: 10 };
}

const WIERSZE: GrupaMarzy[] = [
  grupa("MO1", "BKT"),
  grupa("MO1", "CEAT"),
  grupa("MO2", "BKT"),
  grupa("MO3", "MITAS"),
];

function wybor(nadpisania: Partial<Record<keyof WyborFiltrow, string[]>>): WyborFiltrow {
  const w = pustyWybor();
  for (const [wymiar, wartosci] of Object.entries(nadpisania)) {
    w[wymiar as keyof WyborFiltrow] = new Set(wartosci);
  }
  return w;
}

describe("zastosujFiltryMarz", () => {
  it("pusty wybór nie filtruje niczego i oddaje tę samą tablicę", () => {
    expect(zastosujFiltryMarz(WIERSZE, pustyWybor())).toBe(WIERSZE);
  });

  it("wiele wartości w jednym wymiarze łączy się przez OR", () => {
    const wynik = zastosujFiltryMarz(WIERSZE, wybor({ dostawcy: ["MO1", "MO2"] }));
    expect(wynik.map((w) => w.dostawca)).toEqual(["MO1", "MO1", "MO2"]);
  });

  it("różne wymiary łączą się przez AND", () => {
    const wynik = zastosujFiltryMarz(WIERSZE, wybor({ dostawcy: ["MO1", "MO2"], marki: ["BKT"] }));
    expect(wynik).toEqual([grupa("MO1", "BKT"), grupa("MO2", "BKT")]);
  });

  it("wybór bez trafień daje pustą tablicę, a nie komplet wierszy", () => {
    expect(zastosujFiltryMarz(WIERSZE, wybor({ dostawcy: ["NIE_MA"] }))).toEqual([]);
  });

  it("IGNORUJE wymiary, których wiersz marży nie niesie", () => {
    // `margins` grupuje po dostawca/kategoria/marka — model, rozmiar i oba indeksy
    // znikają w `GROUP BY`. Filtr po nich nie może zwinąć tabeli do zera, bo to wyglądałoby
    // na brak danych; sekcja zamiast tego mówi wprost, że go pominęła.
    const wynik = zastosujFiltryMarz(WIERSZE, wybor({ modele: ["AGRIMAX"] }));
    expect(wynik).toBe(WIERSZE);
  });
});

describe("wymiaryNieobslugiwane", () => {
  it("wskazuje zaznaczone wymiary spoza listy obsługiwanych przez sekcję", () => {
    const w = wybor({ dostawcy: ["MO1"], modele: ["AGRIMAX"], rozmiary: ["620/70R42"] });
    expect(wymiaryNieobslugiwane(w, WYMIARY_MARZ)).toEqual(["modele", "rozmiary"]);
  });

  it("milczy, gdy zaznaczono wyłącznie wymiary obsługiwane", () => {
    const w = wybor({ dostawcy: ["MO1"], marki: ["BKT"] });
    expect(wymiaryNieobslugiwane(w, WYMIARY_MARZ)).toEqual([]);
  });
});

describe("stan wyboru", () => {
  it("`pustyWybor` ma komplet sześciu wymiarów, wszystkie puste", () => {
    const w = pustyWybor();
    expect(Object.keys(w)).toEqual([...WYMIARY_FILTRA]);
    expect(czyPusty(w)).toBe(true);
  });

  it("`czyPusty` wykrywa zaznaczenie w dowolnym wymiarze", () => {
    expect(czyPusty(wybor({ indeksyPredkosci: ["A"] }))).toBe(false);
  });
});

/**
 * Filtrowanie zakładki `dostawcy` (blok 10d). Funkcja jest generyczna, bo obsługuje trzy
 * różne wiersze — stabilności, cyklu życia i stanu — a łączy je jedno pole: `dostawca`.
 */
describe("zastosujFiltryDostawcow", () => {
  const WIERSZE_DOSTAWCOW = [
    { dostawca: "MO1", produkty: 10 },
    { dostawca: "MO2", produkty: 20 },
    { dostawca: "MO3", produkty: 30 },
  ];

  it("bez zaznaczenia zwraca wejście bez zmian — i to ten sam obiekt", () => {
    expect(zastosujFiltryDostawcow(WIERSZE_DOSTAWCOW, pustyWybor())).toBe(WIERSZE_DOSTAWCOW);
  });

  it("zaznaczenie kilku dostawców działa jak OR wewnątrz wymiaru", () => {
    const wynik = zastosujFiltryDostawcow(WIERSZE_DOSTAWCOW, wybor({ dostawcy: ["MO1", "MO3"] }));
    expect(wynik.map((w) => w.dostawca)).toEqual(["MO1", "MO3"]);
  });

  it("zachowuje kolejność odpowiedzi — sortowanie należy do backendu, nie do filtra", () => {
    const wynik = zastosujFiltryDostawcow(WIERSZE_DOSTAWCOW, wybor({ dostawcy: ["MO3", "MO1"] }));
    expect(wynik.map((w) => w.dostawca)).toEqual(["MO1", "MO3"]);
  });

  it("dostawca spoza odpowiedzi zwija tabelę do zera, zamiast być ignorowany", () => {
    expect(zastosujFiltryDostawcow(WIERSZE_DOSTAWCOW, wybor({ dostawcy: ["MO10"] }))).toEqual([]);
  });

  it("pozostałe pięć wymiarów jest dla tej zakładki nieobsługiwane", () => {
    // Wiersze zakładki `dostawcy` niosą wyłącznie `dostawca` — dwie trasy grupują po nim,
    // a trzecia czyta staging, gdzie marki ani modelu nie ma w ogóle.
    const w = wybor({ dostawcy: ["MO1"], marki: ["BKT"], modele: ["1000"] });
    expect(wymiaryNieobslugiwane(w, WYMIARY_DOSTAWCOW)).toEqual(["marki", "modele"]);
  });
});
