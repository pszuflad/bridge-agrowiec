/**
 * Ticket 164-BUG-poprawione-nazwy-sklejonych-opon — naprawa nazw dla produktów, które dzielą
 * `kod_importu` z innym produktem tego samego dostawcy (kolizja #108). Weryfikuje:
 *  1. parsowanie CSV (w tym pola z przecinkami w cudzysłowie, np. atesty "(E,C,B,72dB)"),
 *  2. że zapis idzie do `manual_overrides` per DOKŁADNY (dostawca, kod), nie po `kod_importu`,
 *  3. że `poprawkiMarty()` po nałożeniu na pozycję z pliku dostawcy zwraca różne, poprawne
 *     nazwy dla dwóch produktów współdzielących `kod_importu`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import type { Baza } from "../src/db/index.js";
import { manualOverrides, products } from "../src/db/schema.js";
import {
  naprawNazwySklejone,
  sparsujWierszeNaprawy,
  zastosujNazwyWKatalogu,
} from "../src/import/naprawaNazwSklejonych.js";
import { poprawkiMarty } from "../src/import/silnik/overrides.js";
import type { PozycjaZnormalizowana } from "../src/import/silnik/pozycja.js";
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
    ...nadpisania,
  };
}

const NAGLOWEK = "kod_importu,dostawca,kod,ean,nazwa,marka,model,rozmiar,dot,cena_sprzedazy,stan";

describe("sparsujWierszeNaprawy", () => {
  it("parsuje proste wiersze i wyciąga tylko dostawca/kod/nazwa", () => {
    const csv = [
      NAGLOWEK,
      "326606,MO1,MO1_15126981,8906117624387,OPONA VF710/70R42 CEAT TORQUEMAX 185D TL,CEAT,TORQUEMAX,710/70R42,nie starsza niz 3 lata,10676.0,2",
    ].join("\n");

    expect(sparsujWierszeNaprawy(csv)).toEqual([
      { dostawca: "MO1", kod: "MO1_15126981", nazwa: "OPONA VF710/70R42 CEAT TORQUEMAX 185D TL" },
    ]);
  });

  it("obsługuje nazwę z przecinkami w cudzysłowie (atesty)", () => {
    const csv = [
      NAGLOWEK,
      '257213,MO2,MO2_1370,4250427424965,"OPONA 205/75R17.5 RI151 124/122M 3PMSF M+S ALL POSITION Falken (E,C,B,72dB)",FALKEN,RI151,205/75R17.5,nie starsza niz 3 lata,864.0,3',
    ].join("\n");

    const wynik = sparsujWierszeNaprawy(csv);
    expect(wynik).toHaveLength(1);
    expect(wynik[0]!.nazwa).toBe(
      "OPONA 205/75R17.5 RI151 124/122M 3PMSF M+S ALL POSITION Falken (E,C,B,72dB)",
    );
  });

  it("pomija wiersze bez dostawcy/kodu/nazwy", () => {
    const csv = [NAGLOWEK, "326606,MO1,,8906117624387,,CEAT,TORQUEMAX,710/70R42,x,1,1"].join(
      "\n",
    );
    expect(sparsujWierszeNaprawy(csv)).toEqual([]);
  });
});

describe("naprawNazwySklejone — zapis do manual_overrides", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => {
    baza.posprzataj();
  });

  it("rozróżnia dwa produkty tego samego dostawcy współdzielące kod_importu", () => {
    // MO1, kod_importu 326606 — dwie fizycznie różne opony pod jednym kod_importu (backlog #108).
    const wiersze = [
      { dostawca: "MO1", kod: "MO1_15126981", nazwa: "OPONA VF710/70R42 CEAT TORQUEMAX 185D TL" },
      {
        dostawca: "MO1",
        kod: "MO1_15126983",
        nazwa: "OPONA VF710/70R42 CEAT TORQUEMAX 185D TL STEEL BELTED",
      },
    ];

    const wynik = naprawNazwySklejone(db, wiersze, { reason: "test" });
    expect(wynik).toEqual({ przetworzono: 2, pominietoPusteNazwy: 0 });

    const zapisane = db.select().from(manualOverrides).all();
    expect(zapisane).toHaveLength(2);

    const perKod = Object.fromEntries(
      zapisane.map((o) => [o.supplierProductId, o.overrideValue]),
    );
    expect(perKod["MO1_15126981"]).toBe("OPONA VF710/70R42 CEAT TORQUEMAX 185D TL");
    expect(perKod["MO1_15126983"]).toBe(
      "OPONA VF710/70R42 CEAT TORQUEMAX 185D TL STEEL BELTED",
    );
  });

  it("pomija wiersze z pustą nazwą po przycięciu białych znaków", () => {
    const wynik = naprawNazwySklejone(
      db,
      [{ dostawca: "MO1", kod: "MO1_X", nazwa: "   " }],
      { reason: "test" },
    );
    expect(wynik).toEqual({ przetworzono: 0, pominietoPusteNazwy: 1 });
    expect(db.select().from(manualOverrides).all()).toHaveLength(0);
  });

  it("jest idempotentny — powtórne uruchomienie nadpisuje te same wartości, nie duplikuje wierszy", () => {
    const wiersze = [{ dostawca: "MO1", kod: "MO1_15126981", nazwa: "Nazwa A" }];
    naprawNazwySklejone(db, wiersze, { reason: "pierwszy przebieg" });
    naprawNazwySklejone(db, wiersze, { reason: "drugi przebieg" });

    const zapisane = db.select().from(manualOverrides).all();
    expect(zapisane).toHaveLength(1);
    expect(zapisane[0]!.overrideValue).toBe("Nazwa A");
    expect(zapisane[0]!.reason).toBe("drugi przebieg");
  });

  it("po nałożeniu przez poprawkiMarty() dwa produkty z tym samym kod_importu dostają różne, poprawne nazwy", () => {
    naprawNazwySklejone(
      db,
      [
        { dostawca: "MO1", kod: "MO1_15126981", nazwa: "Nazwa poprawna A" },
        { dostawca: "MO1", kod: "MO1_15126983", nazwa: "Nazwa poprawna B" },
      ],
      { reason: "test" },
    );

    const zastosuj = poprawkiMarty(db);

    const pozycjaA = {
      kod: "MO1_15126981",
      nazwa: "Nazwa sklejona z pliku dostawcy",
    } as unknown as PozycjaZnormalizowana;
    const pozycjaB = {
      kod: "MO1_15126983",
      nazwa: "Nazwa sklejona z pliku dostawcy",
    } as unknown as PozycjaZnormalizowana;

    const wynikA = zastosuj("MO1", pozycjaA);
    const wynikB = zastosuj("MO1", pozycjaB);

    expect(wynikA.pozycja.nazwa).toBe("Nazwa poprawna A");
    expect(wynikB.pozycja.nazwa).toBe("Nazwa poprawna B");
    // Plik dostawcy przyniósł tę samą (błędną) nazwę dla obu — to spodziewany konflikt,
    // zameldowany, ale override i tak wygrywa (niesymetria 1, patrz overrides.ts).
    expect(wynikA.naruszono).toEqual(["nazwa"]);
    expect(wynikB.naruszono).toEqual(["nazwa"]);
  });
});

describe("zastosujNazwyWKatalogu — bezpośredni zapis do products.nazwa", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => {
    baza.posprzataj();
  });

  it("nadpisuje nazwę istniejącego produktu i liczy trafienie", () => {
    db.insert(products)
      .values([produkt({ kod: "MO1_15126981", nazwa: "Nazwa sklejona" })])
      .run();

    const wynik = zastosujNazwyWKatalogu(db, [
      { dostawca: "MO1", kod: "MO1_15126981", nazwa: "Nazwa poprawna A" },
    ]);

    expect(wynik).toEqual({ zaktualizowano: 1, nieZnaleziono: 0, bezZmian: 0 });
    const po = db.select().from(products).where(eq(products.kod, "MO1_15126981")).get();
    expect(po?.nazwa).toBe("Nazwa poprawna A");
  });

  it("nie liczy jako zmianę, gdy nazwa jest już poprawna (bezpieczne powtórne uruchomienie)", () => {
    db.insert(products)
      .values([produkt({ kod: "MO1_15126981", nazwa: "Nazwa poprawna A" })])
      .run();

    const wynik = zastosujNazwyWKatalogu(db, [
      { dostawca: "MO1", kod: "MO1_15126981", nazwa: "Nazwa poprawna A" },
    ]);

    expect(wynik).toEqual({ zaktualizowano: 0, nieZnaleziono: 0, bezZmian: 1 });
  });

  it("liczy jako nieznaleziony produkt, którego nie ma jeszcze w katalogu", () => {
    const wynik = zastosujNazwyWKatalogu(db, [
      { dostawca: "MO1", kod: "MO1_NIEISTNIEJE", nazwa: "Cokolwiek" },
    ]);
    expect(wynik).toEqual({ zaktualizowano: 0, nieZnaleziono: 1, bezZmian: 0 });
  });

  it("rozróżnia dwa kolidujące produkty tego samego kod_importu po zapisie do katalogu", () => {
    db.insert(products)
      .values([
        produkt({ kod: "MO1_15126981", nazwa: "Nazwa sklejona" }),
        produkt({ kod: "MO1_15126983", nazwa: "Nazwa sklejona" }),
      ])
      .run();

    zastosujNazwyWKatalogu(db, [
      { dostawca: "MO1", kod: "MO1_15126981", nazwa: "Nazwa poprawna A" },
      { dostawca: "MO1", kod: "MO1_15126983", nazwa: "Nazwa poprawna B" },
    ]);

    const a = db.select().from(products).where(eq(products.kod, "MO1_15126981")).get();
    const b = db.select().from(products).where(eq(products.kod, "MO1_15126983")).get();
    expect(a?.nazwa).toBe("Nazwa poprawna A");
    expect(b?.nazwa).toBe("Nazwa poprawna B");
  });
});
