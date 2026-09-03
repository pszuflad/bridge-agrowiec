/**
 * Kalkulator wagi gabarytowej liczony W PRZEGLĄDARCE — port `:26656-26685`.
 *
 * ⚠ To NIE jest ten sam wzór co `POST /api/waga-gabarytowa/oblicz` (waga paletowa, testowana
 * w `rebuild/backend/test/waga-gabarytowa.formula.test.ts`). Widok liczy wagę wolumetryczną
 * kurierską i endpointu nie woła — świadomie, plan.md D1. Oba testy muszą zostać osobno;
 * gdyby ktoś kiedyś je „ujednolicił", zmieniłby zachowanie widoczne dla Ani.
 */
import { describe, expect, it } from "vitest";

import {
  naLiczbe,
  policzWage,
  wymiaryPoprawne,
  type WymiaryTekstem,
} from "@/pages/waga-gabarytowa/obliczenia";
import { PRZEWOZNICY_DOMYSLNI, type Przewoznik } from "@/pages/waga-gabarytowa/przewoznicy";

const GEIS = PRZEWOZNICY_DOMYSLNI[0]!;
const DPD = PRZEWOZNICY_DOMYSLNI[1]!;

const wymiary = (nadpisania: Partial<WymiaryTekstem> = {}): WymiaryTekstem => ({
  dlugosc: "60",
  szerokosc: "50",
  wysokosc: "50",
  wagaRzeczywista: "",
  ...nadpisania,
});

describe("policzWage — wzór wolumetryczny", () => {
  /** Przykład z notki w widoku: 60 × 50 × 50 / 10 000 = 15 kg. */
  it("liczy wagę dzielnikiem wybranego przewoźnika", () => {
    const wynik = policzWage(wymiary(), GEIS)!;

    expect(wynik.wagaGabarytowa).toBe(15);
    expect(wynik.dzielnik).toBe(10000);
    expect(wynik.przewoznik).toBe("GEIS Polska");
  });

  /** Ten sam karton u DPD (dzielnik 6 000) waży 25 kg — dzielnik naprawdę steruje wynikiem. */
  it("zmiana przewoźnika zmienia wynik", () => {
    expect(policzWage(wymiary(), DPD)!.wagaGabarytowa).toBe(25);
  });

  it("objętość idzie w metrach sześciennych", () => {
    expect(policzWage(wymiary(), GEIS)!.objetoscM3).toBe(0.15);
  });

  /**
   * Zapisujemy NAZWĘ przewoźnika, nie jego id — wynik leży w IndexedDB i ma się poprawnie
   * wyświetlić także wtedy, gdy Ania w międzyczasie usunie tego przewoźnika z listy.
   */
  it("wynik niesie nazwę przewoźnika, nie identyfikator", () => {
    const wlasny: Przewoznik = { id: "custom_1", nazwa: "Pocztex", dzielnik: 5000 };

    expect(policzWage(wymiary(), wlasny)!.przewoznik).toBe("Pocztex");
  });
});

describe("policzWage — waga do wyceny", () => {
  /** Bez wagi rzeczywistej pole „do wyceny" ma NIE powstać (`null`, nie zero). */
  it("bez wagi rzeczywistej nie liczy wagi do wyceny", () => {
    const wynik = policzWage(wymiary(), GEIS)!;

    expect(wynik.wagaRzeczywista).toBeNull();
    expect(wynik.wagaDoWyceny).toBeNull();
  });

  it("gdy gabarytowa jest większa, do wyceny idzie gabarytowa", () => {
    const wynik = policzWage(wymiary({ wagaRzeczywista: "12" }), GEIS)!;

    expect(wynik.wagaDoWyceny).toBe(15);
    expect(wynik.wagaDoWyceny).toBe(wynik.wagaGabarytowa);
  });

  it("gdy rzeczywista jest większa, do wyceny idzie rzeczywista", () => {
    const wynik = policzWage(wymiary({ wagaRzeczywista: "22.5" }), GEIS)!;

    expect(wynik.wagaDoWyceny).toBe(22.5);
  });

  /**
   * ⚠ Nieparsowalna waga rzeczywista NIE wywraca obliczenia i NIE daje „NaN kg" na ekranie —
   * `Number.isFinite` z oryginału (`:26672`) zbija ją do `null`, więc pole znika.
   */
  it("nieparsowalna waga rzeczywista nie tworzy pola do wyceny", () => {
    const wynik = policzWage(wymiary({ wagaRzeczywista: "abc" }), GEIS)!;

    expect(wynik.wagaDoWyceny).toBeNull();
    expect(wynik.wagaGabarytowa).toBe(15);
  });
});

describe("walidacja wymiarów", () => {
  it.each([
    ["zero", { dlugosc: "0" }],
    ["wartość ujemna", { szerokosc: "-10" }],
    ["tekst", { wysokosc: "abc" }],
    ["pole puste", { dlugosc: "" }],
  ])("odrzuca %s", (_opis, nadpisanie) => {
    expect(wymiaryPoprawne(wymiary(nadpisanie))).toBe(false);
    expect(policzWage(wymiary(nadpisanie), GEIS)).toBeNull();
  });

  it("przyjmuje wymiary ułamkowe", () => {
    expect(wymiaryPoprawne(wymiary({ wysokosc: "12.5" }))).toBe(true);
  });
});

describe("naLiczbe — przecinek dziesiętny", () => {
  /** Ania wpisuje „12,5" z klawiatury numerycznej; sam `parseFloat` uciąłby to do 12. */
  it("czyta przecinek jako separator dziesiętny", () => {
    expect(naLiczbe("12,5")).toBe(12.5);
  });

  it("liczy z przecinkiem tak samo jak z kropką", () => {
    const zPrzecinkiem = policzWage(wymiary({ wysokosc: "50,5" }), GEIS)!;
    const zKropka = policzWage(wymiary({ wysokosc: "50.5" }), GEIS)!;

    expect(zPrzecinkiem.wagaGabarytowa).toBe(zKropka.wagaGabarytowa);
  });
});
