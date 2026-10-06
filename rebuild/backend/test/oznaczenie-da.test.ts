// „DA” (wada kosmetyczna): tylko na końcu nazwy, nie w modelu/bieżniku.
import { describe, expect, it } from "vitest";

import { zastosujOznaczenieDa } from "../src/import/polityka/oznaczenie-da.js";

const OZKA = {
  nazwa: "520/85R42 OZKA AGROLOX DA 157A8/157B TL",
  marka: "OZKA",
  model: "AGROLOX DA",
  bieznik: "AGROLOX DA",
};

describe("zastosujOznaczenieDa", () => {
  it("zdejmuje DA z modelu i bieżnika, w nazwie zostaje jedno DA na końcu", () => {
    const w = zastosujOznaczenieDa(OZKA, OZKA.nazwa);
    expect(w.model).toBe("AGROLOX");
    expect(w.bieznik).toBe("AGROLOX");
    expect(w.nazwa).toBe("520/85R42 OZKA AGROLOX 157A8/157B TL DA");
  });
  it("jest idempotentne", () => {
    const raz = zastosujOznaczenieDa(OZKA, OZKA.nazwa);
    expect(zastosujOznaczenieDa(raz, raz.nazwa)).toEqual(raz);
  });
  it("DA wykryte w nazwie z pliku, choć parser usunął je z nazwy pozycji", () => {
    const w = zastosujOznaczenieDa({ ...OZKA, nazwa: "520/85R42 OZKA AGROLOX 157A8/157B TL" }, OZKA.nazwa);
    expect(w.nazwa).toBe("520/85R42 OZKA AGROLOX 157A8/157B TL DA");
  });
  it("bez DA — pozycja nietknięta (ta sama referencja)", () => {
    const d = { nazwa: "480/70R28 BKT AGRIMAX RT 765 TL", model: "AGRIMAX RT 765" };
    expect(zastosujOznaczenieDa(d, d.nazwa)).toBe(d);
  });
  it("DA wewnątrz słowa, rozmiaru czy oznaczenia nie jest wadą kosmetyczną", () => {
    for (const nazwa of ["600/65R28 DAYTON TL", "13.6-24 MODA 8PR", "460/85R38 AGRI-DA 149A8", "440/65R28 X DAY TL"]) {
      const d = { nazwa, model: "X" };
      expect(zastosujOznaczenieDa(d, nazwa)).toBe(d);
    }
  });
  it("model złożony tylko z DA zostaje (nie robimy pustego modelu)", () => {
    const w = zastosujOznaczenieDa({ nazwa: "X DA", model: "DA" }, "X DA");
    expect(w.model).toBe("DA");
    expect(w.nazwa).toBe("X DA");
  });
});
