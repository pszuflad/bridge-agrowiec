/**
 * Filtrowanie klienckie sekcji EAN (blok 10c) — czysta logika, bez DOM-u.
 *
 * Test widoku (`analityka.ean.test.tsx`) sprawdza, że filtr działa NA EKRANIE; ten plik
 * pilnuje semantyki i granic: które wymiary dana karta w ogóle obsługuje i co się dzieje,
 * gdy użytkownik zaznaczy wymiar, którego wiersz nie niesie.
 *
 * ⚠ OSOBNY PLIK od `analityka.filtrowanie.test.ts` (10a) — bloki 10b–10e idą równolegle
 * i każdy dokłada własne funkcje filtrujące do tego samego modułu.
 */
import { describe, expect, it } from "vitest";

import {
  WYMIARY_EAN_POKRYCIE,
  WYMIARY_EAN_PORWNANIE,
  WYMIARY_EAN_RANKING,
  WYMIARY_EAN_UNIKALNE,
  pustyWybor,
  wymiaryNieobslugiwane,
  zastosujFiltrDostawcy,
  type WyborFiltrow,
} from "@/pages/analityka/filtrowanie";

function wybor(nadpisania: Partial<Record<keyof WyborFiltrow, string[]>>): WyborFiltrow {
  const w = pustyWybor();
  for (const [wymiar, wartosci] of Object.entries(nadpisania)) {
    w[wymiar as keyof WyborFiltrow] = new Set(wartosci);
  }
  return w;
}

const WIERSZE = [
  { dostawca: "MO1", wartosc: 1 },
  { dostawca: "MO2", wartosc: 2 },
  { dostawca: "MO5", wartosc: 3 },
];

describe("zastosujFiltrDostawcy", () => {
  it("pusty wybór przepuszcza wszystko i zwraca tę samą referencję", () => {
    const wynik = zastosujFiltrDostawcy(WIERSZE, pustyWybor());
    expect(wynik).toBe(WIERSZE);
  });

  it("zaznaczenie kilku dostawców działa jak OR wewnątrz wymiaru", () => {
    const wynik = zastosujFiltrDostawcy(WIERSZE, wybor({ dostawcy: ["MO1", "MO5"] }));
    expect(wynik.map((w) => w.dostawca)).toEqual(["MO1", "MO5"]);
  });

  it("dostawca spoza zbioru danych daje pustą listę, a nie wszystkie wiersze", () => {
    expect(zastosujFiltrDostawcy(WIERSZE, wybor({ dostawcy: ["MO99"] }))).toEqual([]);
  });

  it("wymiary inne niż dostawcy NIE zawężają — wiersz ich nie niesie", () => {
    // To jest sedno notki O-10c-2: filtr po marce nie ma na czym zadziałać, więc tabela
    // zostaje pełna, a użytkownik dostaje o tym komunikat zamiast pustego ekranu.
    const wynik = zastosujFiltrDostawcy(WIERSZE, wybor({ marki: ["BKT"] }));
    expect(wynik).toBe(WIERSZE);
  });
});

describe("deklaracje wymiarów per karta", () => {
  it("porównanie i pokrycie nie obsługują ŻADNEGO wymiaru — `GROUP BY` zwinął kolumny katalogu", () => {
    expect(WYMIARY_EAN_PORWNANIE).toEqual([]);
    expect(WYMIARY_EAN_POKRYCIE).toEqual([]);
  });

  it("pozycje unikalne i ranking obsługują wyłącznie dostawcę", () => {
    expect(WYMIARY_EAN_UNIKALNE).toEqual(["dostawcy"]);
    expect(WYMIARY_EAN_RANKING).toEqual(["dostawcy"]);
  });

  it("wymiaryNieobslugiwane wypisuje tylko wymiary REALNIE zaznaczone", () => {
    const w = wybor({ dostawcy: ["MO1"], marki: ["BKT"] });

    // Karta rankingu: dostawcę stosuje, marki nie.
    expect(wymiaryNieobslugiwane(w, WYMIARY_EAN_RANKING)).toEqual(["marki"]);
    // Karta porównania: nie stosuje żadnego z dwóch zaznaczonych.
    expect(wymiaryNieobslugiwane(w, WYMIARY_EAN_PORWNANIE)).toEqual(["dostawcy", "marki"]);
    // Nic nie zaznaczone → nie ma o czym informować, notka się nie pokazuje.
    expect(wymiaryNieobslugiwane(pustyWybor(), WYMIARY_EAN_PORWNANIE)).toEqual([]);
  });
});
