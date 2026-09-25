/**
 * Ticket 155-FEATURE-dziedziczenie-wagi-po-rozmiarze — NOWA logika biznesowa, nie port.
 * Testy dla `src/import/dziedziczenieWagi.ts`: próg pustości wagi, dopasowanie kandydatów
 * (marka+rozmiar+bieżnik, maksimum przy rozjeździe, tolerancja pustego bieżnika) i wpięcie
 * mutujące rekord (`applyWagaDziedziczona`).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { products } from "../src/db/schema.js";
import {
  applyWagaDziedziczona,
  jestPustaWaga,
  kluczZRekordu,
  znajdzWageDoDziedziczenia,
} from "../src/import/dziedziczenieWagi.js";
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

describe("jestPustaWaga", () => {
  it.each([
    [null, true],
    [undefined, true],
    ["", true],
    [0, true],
    ["0", true],
    [NaN, true],
    [78, false],
    ["78", false],
    [0.5, false],
  ])("jestPustaWaga(%o) === %o", (wejscie, oczekiwane) => {
    expect(jestPustaWaga(wejscie)).toBe(oczekiwane);
  });
});

describe("kluczZRekordu", () => {
  it("zwraca null bez marki", () => {
    expect(kluczZRekordu({ marka: null, szerokosc: "16.5" })).toBeNull();
  });

  it("zwraca null bez rozmiaru (szerokosc)", () => {
    expect(kluczZRekordu({ marka: "MITAS", szerokosc: null })).toBeNull();
  });

  it("normalizuje puste stringi na null dla profilu/bieżnika", () => {
    expect(
      kluczZRekordu({ marka: "MITAS", szerokosc: "16.5", profil: "", bieznik: "" }),
    ).toEqual({
      marka: "MITAS",
      szerokosc: "16.5",
      profil: null,
      srednica: null,
      konstrukcja: null,
      bieznik: null,
    });
  });
});

describe("znajdzWageDoDziedziczenia", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => {
    baza.posprzataj();
  });

  it("bierze NAJWYŻSZĄ wagę spośród kilku pasujących kandydatów (decyzja 2)", () => {
    db.insert(products)
      .values([
        produkt({ kod: "A1", waga: 70 }),
        produkt({ kod: "A2", waga: 78 }),
        produkt({ kod: "A3", waga: 74 }),
      ])
      .run();

    const klucz = kluczZRekordu(produkt({ kod: "NOWY" }) as unknown as Record<string, unknown>)!;
    expect(znajdzWageDoDziedziczenia(db, klucz)).toBe(78);
  });

  it("nie dopasowuje po innej marce, rozmiarze ani konstrukcji", () => {
    db.insert(products)
      .values([
        produkt({ kod: "B1", marka: "ALLIANCE", waga: 80 }),
        produkt({ kod: "B2", szerokosc: "18.4", waga: 80 }),
        produkt({ kod: "B3", srednica: 24, waga: 80 }),
        produkt({ kod: "B4", konstrukcja: "Radialna", waga: 80 }),
      ])
      .run();

    const klucz = kluczZRekordu(produkt({ kod: "NOWY" }) as unknown as Record<string, unknown>)!;
    expect(znajdzWageDoDziedziczenia(db, klucz)).toBeNull();
  });

  it("ignoruje kandydatów z pustą/zerową wagą", () => {
    db.insert(products)
      .values([produkt({ kod: "C1", waga: 0 }), produkt({ kod: "C2", waga: null })])
      .run();

    const klucz = kluczZRekordu(produkt({ kod: "NOWY" }) as unknown as Record<string, unknown>)!;
    expect(znajdzWageDoDziedziczenia(db, klucz)).toBeNull();
  });

  it("różny WYPEŁNIONY bieżnik wyklucza dopasowanie (decyzja 4)", () => {
    db.insert(products).values([produkt({ kod: "D1", bieznik: "IND", waga: 90 })]).run();

    const klucz = kluczZRekordu(
      produkt({ kod: "NOWY", bieznik: "AW" }) as unknown as Record<string, unknown>,
    )!;
    expect(znajdzWageDoDziedziczenia(db, klucz)).toBeNull();
  });

  it("pusty bieżnik u NOWEGO produktu dopasowuje mimo wypełnionego bieżnika kandydata (decyzja 4)", () => {
    db.insert(products).values([produkt({ kod: "E1", bieznik: "IND", waga: 90 })]).run();

    const klucz = kluczZRekordu(
      produkt({ kod: "NOWY", bieznik: null }) as unknown as Record<string, unknown>,
    )!;
    expect(znajdzWageDoDziedziczenia(db, klucz)).toBe(90);
  });

  it("pusty bieżnik u KANDYDATA dopasowuje mimo wypełnionego bieżnika nowego produktu (decyzja 4)", () => {
    db.insert(products).values([produkt({ kod: "F1", bieznik: null, waga: 95 })]).run();

    const klucz = kluczZRekordu(
      produkt({ kod: "NOWY", bieznik: "AW" }) as unknown as Record<string, unknown>,
    )!;
    expect(znajdzWageDoDziedziczenia(db, klucz)).toBe(95);
  });
});

describe("applyWagaDziedziczona", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => {
    baza.posprzataj();
  });

  it("uzupełnia pustą wagę i ustawia flagę, gdy znajdzie kandydata", () => {
    db.insert(products).values([produkt({ kod: "G1", waga: 78 })]).run();

    const rekord: Record<string, unknown> = { ...produkt({ kod: "NOWY", waga: null }) };
    applyWagaDziedziczona(db, rekord);

    expect(rekord.waga).toBe(78);
    expect(rekord.wagaAutoUzupelniona).toBe(true);
  });

  it("uzupełnia wagę=0 tak samo jak pustą (waga nigdy nie może zostać 0)", () => {
    db.insert(products).values([produkt({ kod: "H1", waga: 78 })]).run();

    const rekord: Record<string, unknown> = { ...produkt({ kod: "NOWY", waga: 0 }) };
    applyWagaDziedziczona(db, rekord);

    expect(rekord.waga).toBe(78);
    expect(rekord.wagaAutoUzupelniona).toBe(true);
  });

  it("NIE dotyka wagi, gdy rekord już ją ma (priorytet importu/pamięci wagi)", () => {
    db.insert(products).values([produkt({ kod: "I1", waga: 78 })]).run();

    const rekord: Record<string, unknown> = { ...produkt({ kod: "NOWY", waga: 55 }) };
    applyWagaDziedziczona(db, rekord);

    expect(rekord.waga).toBe(55);
    expect(rekord.wagaAutoUzupelniona).toBeUndefined();
  });

  it("nie ustawia niczego, gdy brak pasującego kandydata", () => {
    const rekord: Record<string, unknown> = { ...produkt({ kod: "NOWY", waga: null }) };
    applyWagaDziedziczona(db, rekord);

    expect(rekord.waga).toBeNull();
    expect(rekord.wagaAutoUzupelniona).toBeUndefined();
  });
});
