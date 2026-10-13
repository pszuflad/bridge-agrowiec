/** Ticket 254: polskie nazwy krajów obok kodów. */
import { describe, expect, it } from "vitest";

import { kodZNazwa, nazwaKraju } from "@/lib/kraje";

describe("nazwaKraju", () => {
  it("zwraca polską nazwę dla kodów ISO, wielkość liter i spacje bez znaczenia", () => {
    expect(nazwaKraju("AT")).toBe("Austria");
    expect(nazwaKraju(" de ")).toBe("Niemcy");
    expect(nazwaKraju("FR")).toBe("Francja");
    expect(nazwaKraju("CZ")).toBe("Czechy");
    expect(nazwaKraju("AD")).toBe("Andora");
  });

  it("kody VAT UE spoza ISO mają wyjątki (EL = Grecja), niepoprawne kody dają null", () => {
    expect(nazwaKraju("EL")).toBe("Grecja");
    expect(nazwaKraju("")).toBeNull();
    expect(nazwaKraju("A")).toBeNull();
    expect(nazwaKraju("ABC")).toBeNull();
    expect(nazwaKraju("12")).toBeNull();
    expect(nazwaKraju(null)).toBeNull();
    expect(nazwaKraju("ZZ")).toBeNull();
  });

  it("kodZNazwa: „AT — Austria”, a bez nazwy sam kod", () => {
    expect(kodZNazwa("AT")).toBe("AT — Austria");
    expect(kodZNazwa("ZZ")).toBe("ZZ");
  });
});
