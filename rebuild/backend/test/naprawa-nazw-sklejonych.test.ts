/**
 * Ticket 164-BUG-poprawione-nazwy-sklejonych-opon — naprawa nazw dla produktów, które dzielą
 * `kod_importu` z innym produktem tego samego dostawcy (kolizja #108). Weryfikuje:
 *  1. parsowanie CSV (w tym pola z przecinkami w cudzysłowie, np. atesty "(E,C,B,72dB)"),
 *  2. że zapis idzie do `manual_overrides` per DOKŁADNY (dostawca, kod), nie po `kod_importu`,
 *  3. że `poprawkiMarty()` po nałożeniu na pozycję z pliku dostawcy zwraca różne, poprawne
 *     nazwy dla dwóch produktów współdzielących `kod_importu`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { manualOverrides } from "../src/db/schema.js";
import {
  naprawNazwySklejone,
  sparsujWierszeNaprawy,
} from "../src/import/naprawaNazwSklejonych.js";
import { poprawkiMarty } from "../src/import/silnik/overrides.js";
import type { PozycjaZnormalizowana } from "../src/import/silnik/pozycja.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

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
