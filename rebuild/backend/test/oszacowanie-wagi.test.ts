/**
 * Ticket 167-FEATURE-oszacuj-pozostale-wagi — NOWA logika, świadomie MNIEJ PEWNA niż
 * dziedziczenie z ticketu 155. Testy dla `kluczRozmiaru`, `sredniaWagaDlaRozmiaru` i
 * `oszacujWageWstecznie` (`src/import/dziedziczenieWagi.ts`).
 */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza, BazaSqlite } from "../src/db/index.js";
import { manualOverrides, products } from "../src/db/schema.js";
import {
  kluczRozmiaru,
  oszacujWageWstecznie,
  sredniaWagaDlaRozmiaru,
} from "../src/import/dziedziczenieWagi.js";
import { uchwytSqlite } from "../src/import/silnik/bridge-ext.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

type NowyProdukt = typeof products.$inferInsert;

function produkt(nadpisania: Partial<NowyProdukt> & { kod: string }): NowyProdukt {
  return {
    nazwa: "Opona testowa",
    marka: "MITAS",
    kategoria: "rolnicze",
    dostawca: "MO1",
    magazyn: "0",
    stan: 0,
    cenaZakupu: 100,
    cenaSprzedazy: 150,
    marzaPct: 50,
    dataAktualizacji: "2026-09-25T00:00:00.000Z",
    rozmiar: "16.5-12",
    szerokosc: "16.5",
    profil: null,
    srednica: 12,
    konstrukcja: "Diagonalna",
    bieznik: "AW",
    waga: null,
    ...nadpisania,
  };
}

describe("kluczRozmiaru", () => {
  it("zwraca null bez szerokosci", () => {
    expect(kluczRozmiaru({ szerokosc: null })).toBeNull();
  });

  it("nie wymaga marki (inaczej niż kluczZRekordu)", () => {
    expect(kluczRozmiaru({ marka: null, szerokosc: "16.5", srednica: 12 })).toEqual({
      szerokosc: "16.5",
      profil: null,
      srednica: 12,
    });
  });
});

describe("sredniaWagaDlaRozmiaru", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => {
    baza.posprzataj();
  });

  it("liczy średnią z kandydatów TEGO SAMEGO rozmiaru, bez względu na markę/bieżnik", () => {
    db.insert(products)
      .values([
        produkt({ kod: "A1", marka: "MITAS", bieznik: "AW", waga: 70 }),
        produkt({ kod: "A2", marka: "ALLIANCE", bieznik: "IND", waga: 80 }),
        produkt({ kod: "A3", marka: "BKT", bieznik: null, waga: 90 }),
      ])
      .run();

    const klucz = kluczRozmiaru(produkt({ kod: "NOWY" }))!;
    expect(sredniaWagaDlaRozmiaru(db, klucz)).toBe(80); // (70+80+90)/3
  });

  it("zaokrągla do liczby całkowitej", () => {
    db.insert(products)
      .values([produkt({ kod: "B1", waga: 70 }), produkt({ kod: "B2", waga: 71 })])
      .run();

    const klucz = kluczRozmiaru(produkt({ kod: "NOWY" }))!;
    expect(sredniaWagaDlaRozmiaru(db, klucz)).toBe(71); // 70.5 → 71
  });

  it("ignoruje kandydatów z inną szerokością/profilem/średnicą", () => {
    db.insert(products)
      .values([
        produkt({ kod: "C1", szerokosc: "18.4", waga: 100 }),
        produkt({ kod: "C2", srednica: 24, waga: 100 }),
      ])
      .run();

    const klucz = kluczRozmiaru(produkt({ kod: "NOWY" }))!;
    expect(sredniaWagaDlaRozmiaru(db, klucz)).toBeNull();
  });

  it("ignoruje kandydatów z pustą/zerową wagą", () => {
    db.insert(products).values([produkt({ kod: "D1", waga: 0 }), produkt({ kod: "D2", waga: null })]).run();

    const klucz = kluczRozmiaru(produkt({ kod: "NOWY" }))!;
    expect(sredniaWagaDlaRozmiaru(db, klucz)).toBeNull();
  });

  it("zwraca null, gdy nie ma żadnego produktu tego rozmiaru (decyzja 1 z Q&A)", () => {
    const klucz = kluczRozmiaru(produkt({ kod: "NOWY" }))!;
    expect(sredniaWagaDlaRozmiaru(db, klucz)).toBeNull();
  });
});

describe("oszacujWageWstecznie", () => {
  let baza: TestowaBaza;
  let db: Baza;
  let sqlite: BazaSqlite;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
    sqlite = uchwytSqlite(db);
  });

  afterEach(() => {
    baza.posprzataj();
  });

  it("oszacowuje wagę i ustawia flagę wagaSzacowana (nie wagaAutoUzupelniona)", () => {
    db.insert(products)
      .values([
        produkt({ kod: "E1", marka: "MITAS", waga: 70 }),
        produkt({ kod: "E2", marka: "ALLIANCE", waga: 90 }),
        produkt({ kod: "E3", marka: "BKT", waga: null }),
      ])
      .run();

    const wynik = oszacujWageWstecznie(db, sqlite);

    expect(wynik).toEqual({
      wszystkichKandydatow: 1,
      zaktualizowano: 1,
      pominietoOverride: 0,
      pominietoBrakDanych: 0,
      pominietoBrakSredniej: 0,
    });

    const po = db.select().from(products).where(eq(products.kod, "E3")).get()!;
    expect(po.waga).toBe(80);
    expect(po.wagaSzacowana).toBe(true);
    expect(po.wagaAutoUzupelniona).toBeFalsy();
  });

  it("nie dotyka produktów, które już mają wagę", () => {
    db.insert(products).values([produkt({ kod: "F1", waga: 55 })]).run();

    const wynik = oszacujWageWstecznie(db, sqlite);

    expect(wynik.wszystkichKandydatow).toBe(0);
    expect(wynik.zaktualizowano).toBe(0);
  });

  it("pomija produkt bez żadnego innego produktu tego rozmiaru z wagą", () => {
    db.insert(products).values([produkt({ kod: "G1", waga: null })]).run();

    const wynik = oszacujWageWstecznie(db, sqlite);

    expect(wynik).toEqual({
      wszystkichKandydatow: 1,
      zaktualizowano: 0,
      pominietoOverride: 0,
      pominietoBrakDanych: 0,
      pominietoBrakSredniej: 1,
    });
  });

  it("pomija produkt chroniony ręczną poprawką wagi (decyzja 4 z plan.md)", () => {
    db.insert(products)
      .values([produkt({ kod: "H1", waga: 70 }), produkt({ kod: "H2", dostawca: "MO2", waga: 0 })])
      .run();
    db.insert(manualOverrides)
      .values({
        supplierKod: "MO2",
        supplierProductId: "H2",
        fieldName: "waga",
        overrideValue: "0",
        createdAt: "2026-09-29T00:00:00.000Z",
      })
      .run();

    const wynik = oszacujWageWstecznie(db, sqlite);

    expect(wynik).toEqual({
      wszystkichKandydatow: 1,
      zaktualizowano: 0,
      pominietoOverride: 1,
      pominietoBrakDanych: 0,
      pominietoBrakSredniej: 0,
    });
    const po = db.select().from(products).where(eq(products.kod, "H2")).get()!;
    expect(po.waga).toBe(0);
    expect(po.wagaSzacowana).toBeFalsy();
  });
});
