// Ticket 178 — Etap 3 SPEC 2026-10-01: normalizacja pozycji cennika (po parserze, przed dopasowaniem).
// Każdy wiersz tabeli 3b ze speca ma tu przypadek: oferta → oczekiwany model/LI/SI/DOT/konstrukcja.
import { describe, expect, it } from "vitest";

import {
  kluczModelu,
  normalizujDot,
  normalizujKonstrukcje,
  normalizujModel,
  normalizujPozycje,
  poprawIndeksy,
} from "../src/import/polityka/normalizacja-pozycji.js";
import { zgodnaBezDot } from "../src/import/polityka/tolerancja-dopasowania.js";
import { MODELE_PRODUCENTA } from "../src/import/slowniki/modele-producenta.js";

describe("kluczModelu", () => {
  it.each([
    ["T-539", "T539"],
    ["RD-01", "RD01"],
    ["EM 22", "EM-22"],
    ["AS-AGRI10", "AS AGRI 10"],
    ["as_agri.10", "AS AGRI 10"],
    ["MG121 PROWADZĄCA", "MG121"],
    ["CONTI CROSSTRAC HD3 NAPĘD", "conti crosstrac hd3"],
    ["ECOTONN NACZEPA", "ECOTONN"],
  ])("%j ≡ %j", (a, b) => {
    expect(kluczModelu(a)).toBe(kluczModelu(b));
  });
  it("różne modele zostają różne", () => {
    expect(kluczModelu("CONTI ECO 5")).not.toBe(kluczModelu("CONTI ECO HS5"));
  });
});

describe("normalizujModel (3b)", () => {
  const conti = { marka: "CONTINENTAL" };
  it.each([
    ["CONTI ECO 5", "385/55R22.5 CONTINENTAL CONTI ECO HS 5 162K/158L", "CONTI ECO HS5"],
    ["CONTI ECO 5", "315/70R22.5 CONTINENTAL CONTI ECO HS5 156/150L 20PR", "CONTI ECO HS5"],
    ["CONTI HYBRID 5", "315/70R22.5 CONTINENTAL CONTI HYBRID HS5 156/150L", "CONTI HYBRID HS5"],
    ["CONTI CROSSTRAC 3", "385/65R22.5 CONTINENTAL CONTI CROSSTRAC HS3 160K/158L", "CONTI CROSSTRAC HS3"],
  ])("Continental gubi HS: %j → %j", (model, nazwa, oczekiwany) => {
    expect(normalizujModel(model, { ...conti, nazwa })).toBe(oczekiwany);
  });

  it("model, który już ma HS/HD, zostaje; tokeny HS/LS/HD/HT nie są usuwane", () => {
    expect(normalizujModel("CONTI CROSSTRAC HD3", { ...conti, nazwa: "CONTI CROSSTRAC HD3 NAPĘD" })).toBe(
      "CONTI CROSSTRAC HD3",
    );
  });

  it.each([
    ["CONTI CROSSTRAC HD3 NAPĘD", "CONTI CROSSTRAC HD3"],
    ["CONTI HDC1 NAPĘD", "CONTI HDC1"],
    ["ECOTONN NACZEPA", "ECOTONN"],
    ["MG121 PROWADZĄCA", "MG121"],
    ["MG638 NAPEDOWA", "MG638"],
    ["XYZ UNIWERSALNA", "XYZ"],
    ["MG121 158/ PROWADZĄCA", "MG121"],
  ])("dopiski osi: %j → %j", (we, wy) => {
    expect(normalizujModel(we, { marka: "X", nazwa: "" })).toBe(wy);
  });

  it("LingLong: ucięta pierwsza litera bieżnika odtworzona z nazwy", () => {
    expect(normalizujModel("-T20", { marka: "LINGLONG", nazwa: "385/65R22.5 LINGLONG L-T20 164K TL" })).toBe("L-T20");
    expect(normalizujModel("-D30", { marka: "LINGLONG", nazwa: "315/80R22.5 LINGLONG R-D30 156L" })).toBe("R-D30");
    // brak litery w nazwie → bez zmian
    expect(normalizujModel("-T20", { marka: "LINGLONG", nazwa: "385/65R22.5 LINGLONG 164K" })).toBe("-T20");
  });

  it("słownik producenta (dane): wzorzec wygrywa tylko gdy klucze się zgadzają", () => {
    (MODELE_PRODUCENTA as Record<string, string[]>).TESTOWA = ["T-539"];
    try {
      expect(normalizujModel("T539", { marka: "testowa" })).toBe("T-539");
      expect(normalizujModel("T 539", { marka: "TESTOWA" })).toBe("T-539");
      expect(normalizujModel("T540", { marka: "TESTOWA" })).toBe("T540");
      expect(normalizujModel("T539", { marka: "INNA" })).toBe("T539");
    } finally {
      delete (MODELE_PRODUCENTA as Record<string, string[]>).TESTOWA;
    }
  });

  it("puste i nie-tekstowe wartości przechodzą bez zmian", () => {
    expect(normalizujModel(null, {})).toBeNull();
    expect(normalizujModel("", {})).toBe("");
  });
});

describe("normalizujDot (3b)", () => {
  it.each([
    ["24", "2024"],
    ["2024", "2024"],
    ["4822", "2022"],
    ["0524", "2024"],
    ["2025,2026", "2025,2026"],
    ["24, 4822", "2024,2022"],
    ["5424", "5424"],
    ["nie starsza niz 3 lata", "nie starsza niz 3 lata"],
    ["", ""],
  ])("%j → %j", (we, wy) => {
    expect(normalizujDot(we)).toBe(wy);
  });
});

describe("normalizujKonstrukcje (3b)", () => {
  it.each([
    ["R", "Radialna"],
    ["Radial", "Radialna"],
    ["Radialna", "Radialna"],
    ["D", "Diagonalna"],
    ["Bias", "Diagonalna"],
    ["-", "Diagonalna"],
    ["Diagonalna", "Diagonalna"],
    ["Tajemnicza", "Tajemnicza"],
  ])("%j → %j", (we, wy) => {
    expect(normalizujKonstrukcje(we)).toBe(wy);
  });
});

describe("poprawIndeksy (3b)", () => {
  it("MO5: `154/152K/L` ucięte do LI `154/52` + SI `K1/L` wraca do pełnego zapisu", () => {
    expect(poprawIndeksy("315/80R22.5 MARKA MODEL 154/152K/L 20PR TL", "154/52", "K1/L")).toEqual({
      indeksNosnosci: "154/152",
      indeksPredkosci: "K/L",
    });
  });
  it("poprawny zapis nie jest ruszany", () => {
    expect(poprawIndeksy("315/80R22.5 MARKA MODEL 156/150L 20PR", "156/150", "L")).toEqual({
      indeksNosnosci: "156/150",
      indeksPredkosci: "L",
    });
  });
  it("inny zestaw znaków niż w nazwie (inna opona) nie jest nadpisywany", () => {
    expect(poprawIndeksy("315/80R22.5 MARKA 156/150L", "100/97", "A8")).toEqual({
      indeksNosnosci: "100/97",
      indeksPredkosci: "A8",
    });
  });
});

describe("normalizujPozycje + porównanie z kartą", () => {
  it("nie mutuje wejścia i składa wszystkie poprawki", () => {
    const d = {
      marka: "CONTINENTAL",
      nazwa: "385/55R22.5 CONTINENTAL CONTI ECO HS 5 162K/158L",
      model: "CONTI ECO 5 NAPĘD",
      bieznik: "CONTI ECO 5",
      dot: "4822",
      konstrukcja: "R",
      indeksNosnosci: "162/158",
      indeksPredkosci: "K/L",
    };
    const wynik = normalizujPozycje(d);
    expect(d.dot).toBe("4822");
    expect(wynik).toMatchObject({
      model: "CONTI ECO HS5",
      bieznik: "CONTI ECO HS5",
      dot: "2022",
      konstrukcja: "Radialna",
    });
  });

  it("zgodnaBezDot: model różniący się tylko spacją/myślnikiem/dopiskiem to ta sama karta", () => {
    const karta = { marka: "MITAS", model: "T-539", rozmiar: "18.4R34", konstrukcja: "Radialna" };
    for (const model of ["T539", "T 539", "t-539 napęd"]) {
      expect(zgodnaBezDot({ ...karta, model }, karta)).toBe(true);
    }
    expect(zgodnaBezDot({ ...karta, model: "T540" }, karta)).toBe(false);
  });
});
