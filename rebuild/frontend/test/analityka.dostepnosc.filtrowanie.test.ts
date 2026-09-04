/**
 * Filtrowanie klienckie sekcji 10e i zwijanie sezonowości do punktów wykresu.
 *
 * Blok 10a miał jedną sekcję i jedną funkcję filtrującą (`zastosujFiltryMarz`). Blok 10e
 * dołożył pięć sekcji, z których każda niesie INNY podzbiór sześciu wymiarów, więc pętla
 * filtrująca stała się generykiem sterowanym mapowaniem „wymiar → pole wiersza".
 * Ten plik pilnuje jej semantyki; testy sekcji marż z 10a stoją nietknięte obok
 * (`analityka.filtrowanie.test.ts`) i dowodzą, że nakładka nic nie zmieniła.
 */
import { describe, expect, it } from "vitest";

import type { WierszRotacji, WierszSezonowosci } from "@/pages/analityka/api";
import {
  pustyWybor,
  wymiaryZMapowania,
  zastosujFiltry,
  type MapowanieWymiarow,
  type WyborFiltrow,
} from "@/pages/analityka/filtrowanie";
import { punktyMiesieczne } from "@/pages/analityka/SekcjaSezonowosci";

const MAPOWANIE_ROTACJI: MapowanieWymiarow<WierszRotacji> = {
  dostawcy: (w) => w.dostawca,
  marki: (w) => w.marka,
  modele: (w) => w.model,
  rozmiary: (w) => w.rozmiar,
};

function wiersz(nadpisania: Partial<WierszRotacji> = {}): WierszRotacji {
  return {
    kod: "MO1_1",
    nazwa: "Opona",
    dostawca: "MO1",
    marka: "BKT",
    model: "AS 504",
    rozmiar: "620/70R42",
    stan: 3,
    ostatniaAktualizacja: "2026-01-01T00:00:00.000Z",
    ...nadpisania,
  };
}

function zWyborem(nadpisania: Partial<Record<keyof WyborFiltrow, string[]>>): WyborFiltrow {
  const wybor = pustyWybor();
  for (const [wymiar, wartosci] of Object.entries(nadpisania)) {
    wybor[wymiar as keyof WyborFiltrow] = new Set(wartosci);
  }
  return wybor;
}

describe("zastosujFiltry — generyk filtrowania klienckiego", () => {
  it("bez zaznaczenia przepuszcza wszystko i zwraca TĘ SAMĄ tablicę", () => {
    const wiersze = [wiersz(), wiersz({ kod: "MO2_1" })];

    // Tożsamość referencji ma znaczenie: `useMemo` w sekcjach opiera się na tym,
    // że brak filtrów nie tworzy nowej tablicy przy każdym renderze.
    expect(zastosujFiltry(wiersze, pustyWybor(), MAPOWANIE_ROTACJI)).toBe(wiersze);
  });

  it("OR wewnątrz wymiaru: dwaj zaznaczeni dostawcy dają oba komplety wierszy", () => {
    const wiersze = [
      wiersz({ kod: "A", dostawca: "MO1" }),
      wiersz({ kod: "B", dostawca: "MO2" }),
      wiersz({ kod: "C", dostawca: "MO3" }),
    ];

    const wynik = zastosujFiltry(wiersze, zWyborem({ dostawcy: ["MO1", "MO2"] }), MAPOWANIE_ROTACJI);

    expect(wynik.map((w) => w.kod)).toEqual(["A", "B"]);
  });

  it("AND między wymiarami: dostawca I marka muszą pasować jednocześnie", () => {
    const wiersze = [
      wiersz({ kod: "A", dostawca: "MO1", marka: "BKT" }),
      wiersz({ kod: "B", dostawca: "MO1", marka: "CULTOR" }),
      wiersz({ kod: "C", dostawca: "MO2", marka: "BKT" }),
    ];

    const wynik = zastosujFiltry(
      wiersze,
      zWyborem({ dostawcy: ["MO1"], marki: ["BKT"] }),
      MAPOWANIE_ROTACJI,
    );

    expect(wynik.map((w) => w.kod)).toEqual(["A"]);
  });

  it("wiersz z pustą wartością odpada, gdy ten wymiar filtruje", () => {
    const wiersze = [wiersz({ kod: "A", model: "AS 504" }), wiersz({ kod: "B", model: null })];

    // Zaznaczenie konkretnego modelu nie może przepuszczać wierszy, które modelu nie mają.
    expect(
      zastosujFiltry(wiersze, zWyborem({ modele: ["AS 504"] }), MAPOWANIE_ROTACJI).map((w) => w.kod),
    ).toEqual(["A"]);
  });

  it("wymiar spoza mapowania sekcji nie zawęża wyniku — zamiast pustej tabeli jest notka", () => {
    const wiersze = [wiersz({ kod: "A" }), wiersz({ kod: "B" })];

    // Wiersz rotacji nie niesie indeksu nośności, więc ten filtr nie ma na czym zadziałać.
    // Sekcja mówi o tym wprost przez `wymiaryNieobslugiwane`, a nie zwija tabeli do zera.
    expect(
      zastosujFiltry(wiersze, zWyborem({ indeksyNosnosci: ["166"] }), MAPOWANIE_ROTACJI),
    ).toBe(wiersze);
  });

  it("wymiaryZMapowania wypisuje wymiary sekcji w kolejności globalnej", () => {
    expect(wymiaryZMapowania(MAPOWANIE_ROTACJI)).toEqual([
      "dostawcy",
      "marki",
      "modele",
      "rozmiary",
    ]);
  });
});

describe("punktyMiesieczne — zwinięcie „miesiąc × marka” do jednej linii", () => {
  const sezon = (nadpisania: Partial<WierszSezonowosci>): WierszSezonowosci => ({
    miesiac: "08",
    marka: "BKT",
    sredniaCena: 100,
    dostepnoscPct: 100,
    ...nadpisania,
  });

  it("uśrednia marki w obrębie miesiąca i sortuje miesiące rosnąco", () => {
    const punkty = punktyMiesieczne([
      sezon({ miesiac: "08", marka: "BKT", sredniaCena: 100 }),
      sezon({ miesiac: "08", marka: "CULTOR", sredniaCena: 200 }),
      sezon({ miesiac: "07", marka: "BKT", sredniaCena: 50 }),
    ]);

    expect(punkty).toEqual([
      { miesiac: "07", sredniaCena: 50, marek: 1 },
      { miesiac: "08", sredniaCena: 150, marek: 2 },
    ]);
  });

  it("pomija wiersze bez ceny, zamiast liczyć je jako zero", () => {
    const punkty = punktyMiesieczne([
      sezon({ marka: "BKT", sredniaCena: 100 }),
      sezon({ marka: "GTK", sredniaCena: null }),
    ]);

    expect(punkty).toEqual([{ miesiac: "08", sredniaCena: 100, marek: 1 }]);
  });

  it("zaokrągla średnią do dwóch miejsc, jak tabela obok", () => {
    const punkty = punktyMiesieczne([
      sezon({ marka: "A", sredniaCena: 100 }),
      sezon({ marka: "B", sredniaCena: 100.01 }),
      sezon({ marka: "C", sredniaCena: 101 }),
    ]);

    expect(punkty[0]?.sredniaCena).toBe(100.34);
  });

  it("na pustym wejściu nie daje żadnego punktu — sekcja nie rysuje wtedy wykresu", () => {
    expect(punktyMiesieczne([])).toEqual([]);
  });
});
