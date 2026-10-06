// Filtr śmieci MO2: kod `999991NNN` + marka = rozmiar odpada; EAN zgłoszony ręcznie odpada zawsze.
import { describe, expect, it } from "vitest";

import { czySmiecMo2 } from "../src/import/polityka/tolerancja-dopasowania.js";

describe("czySmiecMo2", () => {
  it("zgłoszony EAN odpada niezależnie od kodu i marki", () => {
    expect(czySmiecMo2("MO2", { kod: "MO2_ABC1", ean: "0440000129392", marka: "ALLIANCE" })).toBe(true);
    expect(czySmiecMo2("MO2", { kod: "X", ean: " 0440000129392 ", marka: "JK TYRE" })).toBe(true);
  });
  it("kod 999991NNN z rozmiarem w polu marka odpada", () => {
    expect(czySmiecMo2("MO2", { kod: "MO2_999991711", ean: "0440000128906", marka: "16.5/70-18" })).toBe(true);
    expect(czySmiecMo2("MO2", { kod: "999991", ean: "", marka: "ALLIANCE" })).toBe(true);
  });
  it("kod 999991NNN z prawdziwą marką i EAN-em zostaje", () => {
    expect(czySmiecMo2("MO2", { kod: "MO2_999991602", ean: "0440000123055", marka: "GOODRIDE" })).toBe(false);
  });
  it("inny dostawca i inny kod nie są ruszane", () => {
    expect(czySmiecMo2("MO1", { kod: "999991711", ean: "1", marka: "16.5/70-18" })).toBe(false);
    expect(czySmiecMo2("MO2", { kod: "MO2_WL0920", ean: "0440000127657", marka: "WEST LAKE" })).toBe(false);
  });
});
