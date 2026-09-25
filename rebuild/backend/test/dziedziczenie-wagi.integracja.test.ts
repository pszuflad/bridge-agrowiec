/**
 * Ticket 155-FEATURE-dziedziczenie-wagi-po-rozmiarze — testy integracyjne na realnej bazie
 * SQLite: wpięcie dziedziczenia wagi w `dodajProduktyBulk` (pokrywa import bulk I ręczne
 * dodanie z UI, bo `POST /api/products` woła tę samą funkcję) i reset flagi przy ręcznej
 * edycji przez `aktualizujProdukt` (`PUT/PATCH /api/products/:id`).
 */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza, BazaSqlite } from "../src/db/index.js";
import { products, wagaPamiec } from "../src/db/schema.js";
import { dodajProduktyBulk } from "../src/import/bulk.js";
import { applyWagaPamiec, uchwytSqlite } from "../src/import/silnik/bridge-ext.js";
import { applyWagaDziedziczona } from "../src/import/dziedziczenieWagi.js";
import { aktualizujProdukt } from "../src/repos/products.js";
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

describe("dziedziczenie wagi — dodajProduktyBulk (import bulk + POST /api/products)", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => {
    baza.posprzataj();
  });

  it("nowy produkt bez wagi dziedziczy po istniejącym tej samej marki/rozmiaru/bieżnika", () => {
    db.insert(products).values([produkt({ kod: "ISTNIEJACY", waga: 78 })]).run();

    dodajProduktyBulk(db, [
      {
        kod: "NOWY",
        nazwa: "Opona nowa",
        marka: "MITAS",
        dostawca: "MO2",
        rozmiar: "16.5-12",
        szerokosc: "16.5",
        srednica: 12,
        konstrukcja: "Diagonalna",
        bieznik: "AW",
        cenaZakupu: 100,
      },
    ]);

    const zapisany = db.select().from(products).where(eq(products.kod, "NOWY")).get();
    expect(zapisany?.waga).toBe(78);
    expect(zapisany?.wagaAutoUzupelniona).toBe(true);
  });

  it("produkt z wagą z importu NIE jest nadpisywany dziedziczeniem", () => {
    db.insert(products).values([produkt({ kod: "ISTNIEJACY", waga: 78 })]).run();

    dodajProduktyBulk(db, [
      {
        kod: "NOWY",
        nazwa: "Opona nowa",
        marka: "MITAS",
        dostawca: "MO2",
        rozmiar: "16.5-12",
        szerokosc: "16.5",
        srednica: 12,
        konstrukcja: "Diagonalna",
        bieznik: "AW",
        waga: 55,
        cenaZakupu: 100,
      },
    ]);

    const zapisany = db.select().from(products).where(eq(products.kod, "NOWY")).get();
    expect(zapisany?.waga).toBe(55);
    expect(zapisany?.wagaAutoUzupelniona).toBe(false);
  });
});

describe("dziedziczenie wagi — priorytet waga_pamiec (decyzja 5 z plan.md)", () => {
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

  it("applyWagaPamiec ustawia wagę PRZED dziedziczeniem — dziedziczenie jej nie nadpisuje, mimo lepszego kandydata po rozmiarze", () => {
    // Kandydat do dziedziczenia — dałby WYŻSZĄ wagę (90), gdyby dziedziczenie poszło pierwsze.
    db.insert(products).values([produkt({ kod: "KANDYDAT", waga: 90 })]).run();
    // Pamięć wagi dla TEGO SAMEGO kodu importu — 50, zapisana wcześniej (np. ręczna edycja
    // przy poprzednim imporcie tego samego produktu).
    db.insert(wagaPamiec).values({ kod: "PONOWNY", waga: 50, source: "manual" }).run();

    const rekord: Record<string, unknown> = { ...produkt({ kod: "PONOWNY", waga: null }) };

    // Dokładnie ta sama kolejność, co w akceptacja.ts/bulk.ts.
    applyWagaPamiec(sqlite, rekord, null);
    applyWagaDziedziczona(db, rekord);

    expect(rekord.waga).toBe(50);
    expect(rekord.wagaAutoUzupelniona).toBeUndefined();
  });
});

describe("dziedziczenie wagi — reset flagi przy ręcznej edycji", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => {
    baza.posprzataj();
  });

  it("edycja pola waga przez aktualizujProdukt czyści wagaAutoUzupelniona", () => {
    const wstawiony = db
      .insert(products)
      .values(produkt({ kod: "X1", waga: 78, wagaAutoUzupelniona: true }))
      .returning()
      .get();

    aktualizujProdukt(db, wstawiony.id, { waga: 80 });

    const po = db.select().from(products).where(eq(products.id, wstawiony.id)).get();
    expect(po?.waga).toBe(80);
    expect(po?.wagaAutoUzupelniona).toBe(false);
  });

  it("edycja INNEGO pola nie rusza wagaAutoUzupelniona", () => {
    const wstawiony = db
      .insert(products)
      .values(produkt({ kod: "X2", waga: 78, wagaAutoUzupelniona: true }))
      .returning()
      .get();

    aktualizujProdukt(db, wstawiony.id, { nazwa: "Nowa nazwa" });

    const po = db.select().from(products).where(eq(products.id, wstawiony.id)).get();
    expect(po?.wagaAutoUzupelniona).toBe(true);
  });
});
