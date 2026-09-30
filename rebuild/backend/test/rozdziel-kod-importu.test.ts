/**
 * Ticket 165-BUG-rozdziel-kod-importu — rozdzielenie kod_importu dla znanych kolizji
 * (docs/rebuild-backlog.md #108). Weryfikuje:
 *  1. parsowanie CSV (kolumny kod_importu, dostawca, kod),
 *  2. że w grupie (dostawca, kod_importu) pierwszy produkt zachowuje numer, a kolejne
 *     dostają nowe, unikalne sześciocyfrowe numery,
 *  3. że grupy bez kolizji (jeden produkt) są pomijane,
 *  4. że powtórne uruchomienie nie psuje już rozdzielonych grup (idempotencja),
 *  5. że brakujący w katalogu produkt jest bezpiecznie pomijany.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import type { Baza, BazaSqlite } from "../src/db/index.js";
import { products } from "../src/db/schema.js";
import {
  rozdzielKodImportu,
  sparsujWierszeKolizji,
  type WierszKolizji,
} from "../src/import/rozdzielKodImportu.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

const NAGLOWEK = "kod_importu,dostawca,kod,ean,nazwa,marka,model,rozmiar,dot,cena_sprzedazy,stan";

type NowyProdukt = typeof products.$inferInsert;

function produkt(nadpisania: Partial<NowyProdukt> & { kod: string }): NowyProdukt {
  return {
    nazwa: "Opona testowa",
    marka: "CEAT",
    kategoria: "rolnicze",
    dostawca: "MO1",
    magazyn: "0",
    stan: 0,
    cenaZakupu: 100,
    cenaSprzedazy: 150,
    marzaPct: 50,
    dataAktualizacji: "2026-09-30T00:00:00.000Z",
    ...nadpisania,
  };
}

describe("sparsujWierszeKolizji", () => {
  it("parsuje wiersze i wyciąga dostawca/kod/kod_importu", () => {
    const csv = [
      NAGLOWEK,
      "326606,MO1,MO1_15126981,8906117624387,OPONA X,CEAT,TORQUEMAX,710/70R42,x,100,1",
    ].join("\n");
    expect(sparsujWierszeKolizji(csv)).toEqual([
      { dostawca: "MO1", kod: "MO1_15126981", kodImportu: "326606" },
    ]);
  });
});

describe("rozdzielKodImportu", () => {
  let baza: TestowaBaza;
  let db: Baza;
  let sqlite: BazaSqlite;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
    sqlite = baza.sqlite;
  });

  afterEach(() => {
    baza.posprzataj();
  });

  it("pierwszy produkt w grupie zachowuje kod_importu, drugi dostaje nowy", () => {
    db.insert(products)
      .values([
        produkt({ kod: "MO1_15126981", kodImportu: "326606" }),
        produkt({ kod: "MO1_15126983", kodImportu: "326606" }),
      ])
      .run();

    const wiersze: WierszKolizji[] = [
      { dostawca: "MO1", kod: "MO1_15126981", kodImportu: "326606" },
      { dostawca: "MO1", kod: "MO1_15126983", kodImportu: "326606" },
    ];

    const wynik = rozdzielKodImportu(db, sqlite, wiersze);
    expect(wynik).toEqual({
      grupRozdzielonych: 1,
      produktowPrzenumerowanych: 1,
      pominietoBrakProduktu: 0,
    });

    const a = db.select().from(products).where(eq(products.kod, "MO1_15126981")).get();
    const b = db.select().from(products).where(eq(products.kod, "MO1_15126983")).get();
    expect(a?.kodImportu).toBe("326606");
    expect(b?.kodImportu).toMatch(/^\d{6}$/);
    expect(b?.kodImportu).not.toBe("326606");
  });

  it("grupa z jednym produktem (brak kolizji) zostaje bez zmian", () => {
    db.insert(products).values([produkt({ kod: "MO1_X", kodImportu: "111111" })]).run();

    const wynik = rozdzielKodImportu(db, sqlite, [
      { dostawca: "MO1", kod: "MO1_X", kodImportu: "111111" },
    ]);
    expect(wynik).toEqual({
      grupRozdzielonych: 0,
      produktowPrzenumerowanych: 0,
      pominietoBrakProduktu: 0,
    });

    const p = db.select().from(products).where(eq(products.kod, "MO1_X")).get();
    expect(p?.kodImportu).toBe("111111");
  });

  it("trzy produkty w jednej grupie — dwa kolejne dostają różne, unikalne numery", () => {
    db.insert(products)
      .values([
        produkt({ kod: "MO2_A", kodImportu: "128222" }),
        produkt({ kod: "MO2_B", kodImportu: "128222" }),
        produkt({ kod: "MO2_C", kodImportu: "128222" }),
      ])
      .run();

    const wynik = rozdzielKodImportu(db, sqlite, [
      { dostawca: "MO2", kod: "MO2_A", kodImportu: "128222" },
      { dostawca: "MO2", kod: "MO2_B", kodImportu: "128222" },
      { dostawca: "MO2", kod: "MO2_C", kodImportu: "128222" },
    ]);
    expect(wynik).toEqual({
      grupRozdzielonych: 1,
      produktowPrzenumerowanych: 2,
      pominietoBrakProduktu: 0,
    });

    const a = db.select().from(products).where(eq(products.kod, "MO2_A")).get();
    const b = db.select().from(products).where(eq(products.kod, "MO2_B")).get();
    const c = db.select().from(products).where(eq(products.kod, "MO2_C")).get();
    expect(a?.kodImportu).toBe("128222");
    expect(b?.kodImportu).not.toBe("128222");
    expect(c?.kodImportu).not.toBe("128222");
    expect(b?.kodImportu).not.toBe(c?.kodImportu);
  });

  it("pomija wiersz, którego produkt nie istnieje w katalogu", () => {
    db.insert(products).values([produkt({ kod: "MO1_ISTNIEJE", kodImportu: "222222" })]).run();

    const wynik = rozdzielKodImportu(db, sqlite, [
      { dostawca: "MO1", kod: "MO1_ISTNIEJE", kodImportu: "222222" },
      { dostawca: "MO1", kod: "MO1_NIEISTNIEJE", kodImportu: "222222" },
    ]);
    expect(wynik).toEqual({
      grupRozdzielonych: 0,
      produktowPrzenumerowanych: 0,
      pominietoBrakProduktu: 1,
    });
  });

  it("jest idempotentny — powtórne uruchomienie nie zmienia już rozdzielonych numerów", () => {
    db.insert(products)
      .values([
        produkt({ kod: "MO1_15126981", kodImportu: "326606" }),
        produkt({ kod: "MO1_15126983", kodImportu: "326606" }),
      ])
      .run();

    const wiersze: WierszKolizji[] = [
      { dostawca: "MO1", kod: "MO1_15126981", kodImportu: "326606" },
      { dostawca: "MO1", kod: "MO1_15126983", kodImportu: "326606" },
    ];

    rozdzielKodImportu(db, sqlite, wiersze);
    const bPoPierwszym = db
      .select()
      .from(products)
      .where(eq(products.kod, "MO1_15126983"))
      .get()!.kodImportu;

    const wynikDrugi = rozdzielKodImportu(db, sqlite, wiersze);
    expect(wynikDrugi).toEqual({
      grupRozdzielonych: 0,
      produktowPrzenumerowanych: 0,
      pominietoBrakProduktu: 0,
    });

    const bPoDrugim = db
      .select()
      .from(products)
      .where(eq(products.kod, "MO1_15126983"))
      .get()!.kodImportu;
    expect(bPoDrugim).toBe(bPoPierwszym);
  });
});
