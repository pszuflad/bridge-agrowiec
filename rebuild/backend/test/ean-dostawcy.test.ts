// Ticket 180 — oznaczenia EAN Handlopexu (MO4/MO5) traktowane jako prawidłowe (decyzja Ani 2026-10-01).
import { describe, expect, it } from "vitest";

import { kanonicznyEanDostawcy, validateEanDostawcy } from "../src/import/polityka/ean-dostawcy.js";

describe("EAN Handlopexu", () => {
  it.each([
    ["4024063003477DO", "4024063003477"],
    ["4251438404205_D", "4251438404205"],
    ["4024063003477W2", "4024063003477"],
    ["4024063003477 DO", "4024063003477"],
  ])("MO5: %s → %s", (raw, ean) => {
    expect(kanonicznyEanDostawcy(raw, "MO5")).toBe(ean);
    expect(validateEanDostawcy(kanonicznyEanDostawcy(raw, "MO5"), "MO5")).toMatchObject({ valid: true, value: ean });
  });

  it("inni dostawcy bez zmian", () => {
    expect(kanonicznyEanDostawcy("4024063003477DO", "MO1")).toBe("4024063003477DO");
    expect(validateEanDostawcy("9996118002103", "MO1").valid).toBe(false);
  });

  it("numer z niezgodną cyfrą kontrolną od Handlopexu jest prawidłowy (9996118002103)", () => {
    expect(validateEanDostawcy("9996118002103", "MO5")).toMatchObject({ valid: true, value: "9996118002103", status: "ok" });
    expect(validateEanDostawcy("9996118002103", "MO4").valid).toBe(true);
  });

  it("inne błędy zostają błędami także u Handlopexu", () => {
    expect(kanonicznyEanDostawcy("5901234X23457", "MO5")).toBe("5901234X23457");
    expect(validateEanDostawcy("5901234X23457", "MO5").valid).toBe(false);
    expect(validateEanDostawcy("12345", "MO5").valid).toBe(false);
    // sufiks na numerze ze złą sumą też jest zdejmowany (dostawca = prawidłowy)
    expect(kanonicznyEanDostawcy("9996118002103DO", "MO5")).toBe("9996118002103");
  });
});
