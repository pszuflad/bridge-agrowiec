/** Parser pól obliczeniowych partnerów (ticket 211, PRT-2.3). */
import { describe, expect, it } from "vitest";

import { BladFormuly, obliczFormule, parsujFormule, sprawdzFormule, zaokraglij, zmienneWFormule } from "../src/partnerzy/formula.js";

const licz = (f: string, z: Record<string, number | null> = {}) => obliczFormule(parsujFormule(f), z);

describe("formuły partnerów", () => {
  it("liczy z priorytetem operatorów, nawiasami i minusem jednoargumentowym", () => {
    expect(licz("2 + 3 * 4")).toBe(14);
    expect(licz("(2 + 3) * 4")).toBe(20);
    expect(licz("-2 + 5")).toBe(3);
    expect(licz("10 - 4 - 3")).toBe(3);
    expect(licz("8 / 2 / 2")).toBe(2);
    expect(licz("--3")).toBe(3);
    expect(licz(".5 + 1.25")).toBe(1.75);
  });

  it("wylicza przykład z karty: (zakup + zakup×narzut + przesyłka + koszty) / kurs", () => {
    const z = { zakup: 1000, narzut_FR: 0.12, przesylka_FR: 181, koszty_dodatkowe_FR: 10, kurs_EUR: 4.3 };
    const wynik = licz("(zakup + zakup * narzut_FR + przesylka_FR + koszty_dodatkowe_FR) / kurs_EUR", z);
    expect(wynik).toBeCloseTo((1000 + 120 + 181 + 10) / 4.3, 10);
  });

  it("funkcje: zaokr, min, max, abs", () => {
    expect(licz("zaokr(2.345, 2)")).toBe(2.35);
    expect(licz("zaokr(1.005, 2)")).toBe(1.01);
    expect(licz("zaokr(-1.005, 2)")).toBe(-1.01);
    expect(licz("zaokr(7.5, 0)")).toBe(8);
    expect(licz("min(3, 1, 2)")).toBe(1);
    expect(licz("max(zakup, 5)", { zakup: 9 })).toBe(9);
    expect(licz("abs(-4)")).toBe(4);
    expect(() => zaokraglij(1, 11)).toThrow(BladFormuly);
  });

  it("nazwy zmiennych mogą mieć polskie litery i cyfry", () => {
    expect(licz("cena_zł2 * 2", { cena_zł2: 4 })).toBe(8);
  });

  it("brak wartości zmiennej to błąd, nie zero", () => {
    expect(() => licz("zakup + 1")).toThrow(/Brak wartości zmiennej „zakup”/);
    expect(() => licz("zakup + 1", { zakup: null })).toThrow(/Brak wartości/);
    expect(() => licz("waga", { waga: Number.NaN })).toThrow(/Brak wartości/);
  });

  it("dzielenie przez zero i wynik nieskończony to błąd", () => {
    expect(() => licz("1 / 0")).toThrow(/Dzielenie przez zero/);
    expect(() => licz("1 / (2 - 2)")).toThrow(/Dzielenie przez zero/);
    expect(() => licz("1e999")).toThrow();
  });

  it("odrzuca niepoprawną składnię z pozycją błędu", () => {
    const poz = (f: string): number | null => {
      try {
        parsujFormule(f);
      } catch (e) {
        return (e as BladFormuly).pozycja;
      }
      throw new Error("brak błędu");
    };
    expect(poz("2 +")).toBe(3);
    expect(poz("2 $ 3")).toBe(2);
    expect(poz("(2 + 3")).toBe(6);
    expect(poz("2 3")).toBe(2);
    expect(poz("1,5 + 1")).toBe(1);
    expect(() => parsujFormule("")).toThrow(/pusta/);
    expect(() => parsujFormule("   ")).toThrow(/pusta/);
    expect(() => parsujFormule("foo(1)")).toThrow(/Nieznana funkcja/);
    expect(() => parsujFormule("zaokr(1)")).toThrow(/arg/);
    expect(() => parsujFormule("abs(1, 2)")).toThrow(/arg/);
    expect(() => parsujFormule("min()")).toThrow(/arg/);
    expect(() => parsujFormule("1..2")).toThrow(/Niepoprawna liczba/);
  });

  it("nie wykonuje kodu: żadnych odwołań, indeksów ani wywołań spoza listy", () => {
    for (const zlosliwa of ["constructor", "constructor.constructor('return 1')()", "process.exit()", "__proto__", "a['b']", "x => x", "`1`"]) {
      expect(() => licz(zlosliwa, { a: 1 })).toThrow(BladFormuly);
    }
    // zmienna o nazwie z prototypu obiektu nie może zostać "znaleziona" przez odziedziczoną własność
    expect(() => licz("toString", {})).toThrow(/Brak wartości/);
  });

  it("ogranicza długość i zagnieżdżenie", () => {
    expect(() => parsujFormule("1+".repeat(1500) + "1")).toThrow(/za długa/);
    expect(() => parsujFormule("(".repeat(100) + "1" + ")".repeat(100))).toThrow(/zagnieżdżona/);
  });

  it("zmienneWFormule i sprawdzFormule", () => {
    expect(zmienneWFormule(parsujFormule("zakup + zakup * narzut + max(waga, 1)"))).toEqual(["zakup", "narzut", "waga"]);
    const dozwolone = new Set(["zakup", "narzut"]);
    expect(sprawdzFormule("zakup * (1 + narzut)", dozwolone)).toEqual([]);
    expect(sprawdzFormule("zakup * kurs", dozwolone).map((b) => b.message)).toEqual(["Nieznana zmienna „kurs”."]);
    expect(sprawdzFormule("zakup *", dozwolone)).toHaveLength(1);
  });
});
