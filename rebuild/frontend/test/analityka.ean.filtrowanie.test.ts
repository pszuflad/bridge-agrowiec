/**
 * Filtrowanie klienckie sekcji EAN (blok 10c) — czysta logika, bez DOM-u.
 *
 * Test widoku (`analityka.ean.test.tsx`) sprawdza, że filtr działa NA EKRANIE; ten plik
 * pilnuje granic: które wymiary dana karta w ogóle obsługuje i co się dzieje, gdy użytkownik
 * zaznaczy wymiar, którego wiersz nie niesie.
 *
 * ⚠ CZEGO TU NIE MA: testów samej `zastosujFiltryDostawcow`. Sekcja EAN używa tej funkcji,
 * ale nie ona ją wnosi — przyszła z bloku 10d i jest pokryta w `analityka.filtrowanie.test.ts`
 * (OR wewnątrz wymiaru, zachowanie kolejności, ta sama referencja przy pustym wyborze).
 * Duplikowanie tamtych asercji tutaj nic by nie dowiodło.
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
  type WyborFiltrow,
} from "@/pages/analityka/filtrowanie";

function wybor(nadpisania: Partial<Record<keyof WyborFiltrow, string[]>>): WyborFiltrow {
  const w = pustyWybor();
  for (const [wymiar, wartosci] of Object.entries(nadpisania)) {
    w[wymiar as keyof WyborFiltrow] = new Set(wartosci);
  }
  return w;
}

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
