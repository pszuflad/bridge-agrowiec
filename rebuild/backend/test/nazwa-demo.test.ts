// Decyzja Anny 2026-09-30: kod dostawcy z "demo" => nazwa kończy się "DEMO".
import { describe, expect, it } from "vitest";

import { nazwaZDemo } from "../src/import/polityka/nazwa-demo.js";

const NAZWA = "650/60R34 TRELLEBORG TM 900 HP 159D/156E TL";

describe("nazwaZDemo", () => {
  it("dopisuje DEMO na końcu, gdy kod dostawcy zawiera demo", () => {
    expect(nazwaZDemo(NAZWA, "M036506034TRdemo")).toBe(`${NAZWA} DEMO`);
  });

  it("nie zmienia nazwy bez demo w kodzie", () => {
    expect(nazwaZDemo(NAZWA, "M036506034TR")).toBe(NAZWA);
    expect(nazwaZDemo(NAZWA, null)).toBe(NAZWA);
  });

  it("nie dubluje DEMO i przenosi je na koniec", () => {
    expect(nazwaZDemo(`${NAZWA} DEMO`, "X-demo")).toBe(`${NAZWA} DEMO`);
    expect(nazwaZDemo("650/60R34 DEMO TRELLEBORG TM 900", "X-DEMO")).toBe(
      "650/60R34 TRELLEBORG TM 900 DEMO",
    );
  });

  it("puste nazwy zostawia", () => {
    expect(nazwaZDemo(null, "xdemo")).toBeNull();
  });
});
