/**
 * Ticket 202-FEATURE-link-zdjecia-po-modelu — uzupełnianie pustych linków do zdjęć po marce+modelu.
 * Realna baza SQLite (bez atrap): logika dopasowania, podgląd/zapis dla katalogu, wpięcie w
 * akceptację stagingu i w `dodajProduktyBulk`, ochrona przez `manual_overrides`.
 */
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { zatwierdzPozycjeStagingu } from "../src/import/akceptacja.js";
import { dodajProduktyBulk } from "../src/import/bulk.js";
import {
  applyLinkDziedziczony,
  kluczMarkaModel,
  propozycjaLinkuDlaPozycji,
  proponujLinkiKatalogu,
  uzupelnijLinkiWstecznie,
  zbudujIndeksLinkow,
  znajdzPropozycje,
} from "../src/import/dziedziczenieLinkow.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { pozycja } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type NowyProdukt = typeof products.$inferInsert;

function produkt(nadpisania: Partial<NowyProdukt> & { kod: string }): NowyProdukt {
  return {
    nazwa: "Opona testowa",
    marka: "BKT",
    model: "AGRIMAX RT 765",
    kategoria: "rolnicze",
    dostawca: "MO1",
    magazyn: "0",
    stan: 0,
    cenaZakupu: 100,
    cenaSprzedazy: 150,
    marzaPct: 50,
    dataAktualizacji: "2026-10-09T00:00:00.000Z",
    linkZdjecia: null,
    ...nadpisania,
  };
}

const LINK_A = "https://foto.example/a.jpg";
const LINK_B = "https://foto.example/b.jpg";

describe("dziedziczenie linków — dopasowanie po marce+modelu", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });
  afterEach(() => baza.posprzataj());

  it("klucz ignoruje wielkość liter i nadmiarowe spacje, a brak marki lub modelu daje null", () => {
    expect(kluczMarkaModel(" bkt ", "agrimax   rt 765")).toBe("BKT|AGRIMAX RT 765");
    expect(kluczMarkaModel("BKT", "")).toBeNull();
    expect(kluczMarkaModel(null, "X")).toBeNull();
  });

  it("wybiera najczęstszy link pary; remis rozstrzyga alfabetycznie", () => {
    db.insert(products)
      .values([
        produkt({ kod: "1", linkZdjecia: LINK_B }),
        produkt({ kod: "2", linkZdjecia: LINK_B }),
        produkt({ kod: "3", linkZdjecia: LINK_A }),
        produkt({ kod: "4", marka: "MITAS", linkZdjecia: "https://foto.example/inna-marka.jpg" }),
      ])
      .run();
    const indeks = zbudujIndeksLinkow(db);
    expect(znajdzPropozycje(indeks, "bkt", "AGRIMAX RT 765")).toEqual({
      link: LINK_B,
      produktow: 2,
      wariantow: 2,
    });

    db.insert(products).values(produkt({ kod: "5", linkZdjecia: LINK_A })).run();
    expect(znajdzPropozycje(zbudujIndeksLinkow(db), "BKT", "AGRIMAX RT 765")?.link).toBe(LINK_A);
  });

  it("nie proponuje nic, gdy nikt w katalogu nie ma linku dla pary (inna marka to inna para)", () => {
    db.insert(products)
      .values(produkt({ kod: "1", marka: "MITAS", linkZdjecia: LINK_A }))
      .run();
    expect(znajdzPropozycje(zbudujIndeksLinkow(db), "BKT", "AGRIMAX RT 765")).toBeNull();
  });

  it("applyLinkDziedziczony uzupełnia tylko pusty link i zwraca true tylko przy zmianie", () => {
    db.insert(products).values(produkt({ kod: "1", linkZdjecia: LINK_A })).run();

    const pusty: Record<string, unknown> = { dostawca: "MO1", kod: "N1", marka: "BKT", model: "AGRIMAX RT 765" };
    expect(applyLinkDziedziczony(db, pusty)).toBe(true);
    expect(pusty.linkZdjecia).toBe(LINK_A);

    const niepusty: Record<string, unknown> = { ...pusty, kod: "N2", linkZdjecia: LINK_B };
    expect(applyLinkDziedziczony(db, niepusty)).toBe(false);
    expect(niepusty.linkZdjecia).toBe(LINK_B);

    const bezModelu: Record<string, unknown> = { dostawca: "MO1", kod: "N3", marka: "BKT" };
    expect(applyLinkDziedziczony(db, bezModelu)).toBe(false);
  });
});

describe("dziedziczenie linków — katalog (podgląd i zapis)", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
    db.insert(products)
      .values([
        produkt({ kod: "DAWCA", linkZdjecia: LINK_A }),
        produkt({ kod: "PUSTY1" }),
        produkt({ kod: "PUSTY2", linkZdjecia: "  " }),
        produkt({ kod: "OBCY", marka: "MITAS", model: "INNY" }),
        produkt({ kod: "BEZ_MODELU", model: null }),
        produkt({ kod: "CHRONIONY" }),
        produkt({ kod: "ZLINKIEM", linkZdjecia: LINK_B }),
      ])
      .run();
    db.insert(manualOverrides)
      .values({
        supplierKod: "MO1",
        supplierProductId: "CHRONIONY",
        fieldName: "linkZdjecia",
        overrideValue: "",
        createdAt: "2026-10-01T00:00:00.000Z",
      })
      .run();
  });
  afterEach(() => baza.posprzataj());

  it("podgląd liczy propozycje i powody pominięcia, niczego nie zapisując", () => {
    const podglad = proponujLinkiKatalogu(db);
    expect(podglad.wszystkichPustych).toBe(5);
    expect(podglad.propozycje.map((p) => p.kod).sort()).toEqual(["PUSTY1", "PUSTY2"]);
    expect(podglad.pominietoPoprawka).toBe(1);
    expect(podglad.pominietoBrakDanych).toBe(1);
    expect(podglad.pominietoBrakDopasowania).toBe(1);
    expect(db.select().from(products).where(eq(products.kod, "PUSTY1")).get()?.linkZdjecia).toBeNull();
  });

  it("zapis uzupełnia linki, zakłada poprawki i jest idempotentny; niepustych nie rusza", () => {
    const wynik = uzupelnijLinkiWstecznie(db, baza.sqlite);
    expect(wynik.zaktualizowano).toBe(2);

    const link = (kod: string) =>
      db.select().from(products).where(eq(products.kod, kod)).get()?.linkZdjecia;
    expect(link("PUSTY1")).toBe(LINK_A);
    expect(link("PUSTY2")).toBe(LINK_A);
    expect(link("ZLINKIEM")).toBe(LINK_B);
    expect(link("CHRONIONY")).toBeNull();

    const poprawka = db
      .select()
      .from(manualOverrides)
      .where(and(eq(manualOverrides.supplierProductId, "PUSTY1"), eq(manualOverrides.fieldName, "linkZdjecia")))
      .get();
    expect(poprawka?.overrideValue).toBe(LINK_A);

    expect(uzupelnijLinkiWstecznie(db, baza.sqlite).zaktualizowano).toBe(0);
  });

  it("zapis z ids obejmuje tylko wybrane i liczy nieaktualne", () => {
    const id1 = db.select().from(products).where(eq(products.kod, "PUSTY1")).get()!.id;
    const wynik = uzupelnijLinkiWstecznie(db, baza.sqlite, { ids: [id1, 999999] });
    expect(wynik).toEqual({ zaktualizowano: 1, pominiete: 1 });
    expect(
      db.select().from(products).where(eq(products.kod, "PUSTY2")).get()?.linkZdjecia?.trim(),
    ).toBe("");
  });
});

describe("dziedziczenie linków — wpięcie w zapis", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
    db.insert(products).values(produkt({ kod: "DAWCA", linkZdjecia: LINK_A })).run();
  });
  afterEach(() => baza.posprzataj());

  it("akceptacja nie wymyśla linku, gdy żaden produkt o tej marce i modelu go nie ma", () => {
    db.insert(stagingItems)
      .values(
        pozycja({ kod: "NOWY", dostawca: "MO5", snapshot: { marka: "BKT", model: "ZUPEŁNIE INNY" } }) as never,
      )
      .run();
    const id = db.select().from(stagingItems).get()!.id;
    zatwierdzPozycjeStagingu(db, id, 1, undefined, false, true);

    expect(db.select().from(products).where(eq(products.kod, "NOWY")).get()?.linkZdjecia ?? "").toBe("");
    expect(db.select().from(manualOverrides).all()).toHaveLength(0);
  });

  it("akceptacja zapisuje link i poprawkę, gdy marka i model pasują", () => {
    db.insert(stagingItems)
      .values(
        pozycja({ kod: "NOWY", dostawca: "MO5", snapshot: { marka: "BKT", model: "AGRIMAX RT 765" } }) as never,
      )
      .run();
    const id = db.select().from(stagingItems).get()!.id;
    zatwierdzPozycjeStagingu(db, id, 1, undefined, false, true);

    expect(db.select().from(products).where(eq(products.kod, "NOWY")).get()?.linkZdjecia).toBe(LINK_A);
    const poprawka = db
      .select()
      .from(manualOverrides)
      .where(and(eq(manualOverrides.supplierKod, "MO5"), eq(manualOverrides.supplierProductId, "NOWY")))
      .get();
    expect(poprawka?.fieldName).toBe("linkZdjecia");
    expect(poprawka?.overrideValue).toBe(LINK_A);
  });

  it("bez uzupelnijLink akceptacja zostaje bez zmian (harness charakteryzacyjny)", () => {
    db.insert(stagingItems)
      .values(pozycja({ kod: "NOWY", dostawca: "MO5" }) as never)
      .run();
    const id = db.select().from(stagingItems).get()!.id;
    zatwierdzPozycjeStagingu(db, id, 1);
    const zapisany = db.select().from(products).where(eq(products.kod, "NOWY")).get();
    expect(zapisany?.linkZdjecia ?? "").toBe("");
    expect(db.select().from(manualOverrides).all()).toHaveLength(0);
  });

  it("dodajProduktyBulk uzupełnia link tylko z opcją uzupelnijLink", () => {
    const wiersz = { kod: "B1", dostawca: "MO1", nazwa: "x", marka: "BKT", model: "AGRIMAX RT 765", cenaZakupu: 10 };
    // Najpierw bez opcji (kolejność ma znaczenie: zapis B1 zapamiętałby link w pamięci linków).
    dodajProduktyBulk(db, [{ ...wiersz, kod: "B2" }]);
    expect(db.select().from(products).where(eq(products.kod, "B2")).get()?.linkZdjecia ?? null).toBeNull();

    dodajProduktyBulk(db, [wiersz], { uzupelnijLink: true });
    expect(db.select().from(products).where(eq(products.kod, "B1")).get()?.linkZdjecia).toBe(LINK_A);
  });

  it("dopasowanie pojedynczej pary (bez pełnego indeksu) działa tak samo, także przy innej wielkości liter i spacjach", () => {
    db.insert(products).values(produkt({ kod: "DAWCA2", model: "Agrimax  RT 765", linkZdjecia: LINK_B })).run();
    const rekord: Record<string, unknown> = { dostawca: "MO1", kod: "N9", marka: "bkt", model: "AGRIMAX RT 765" };
    expect(applyLinkDziedziczony(db, rekord)).toBe(true);
    // dwa różne linki (A z DAWCA, B z DAWCA2), po jednym produkcie → remis → alfabetycznie A
    expect(rekord.linkZdjecia).toBe(LINK_A);
  });

  it("bulk: istniejący produkt bez linku też dostaje link, a z linkiem go zachowuje", () => {
    const wiersz = { dostawca: "MO1", nazwa: "x", marka: "BKT", model: "AGRIMAX RT 765", cenaZakupu: 10 };
    db.insert(products).values([produkt({ kod: "E1" }), produkt({ kod: "E2", linkZdjecia: LINK_B })]).run();
    dodajProduktyBulk(db, [{ ...wiersz, kod: "E1" }, { ...wiersz, kod: "E2", linkZdjecia: LINK_B }], {
      uzupelnijLink: true,
    });
    expect(db.select().from(products).where(eq(products.kod, "E1")).get()?.linkZdjecia).toBe(LINK_A);
    expect(db.select().from(products).where(eq(products.kod, "E2")).get()?.linkZdjecia).toBe(LINK_B);
  });

  it("zapis z pustą listą ids niczego nie zmienia", () => {
    db.insert(products).values(produkt({ kod: "P1" })).run();
    expect(uzupelnijLinkiWstecznie(db, baza.sqlite, { ids: [] })).toEqual({ zaktualizowano: 0, pominiete: 0 });
  });

  it("podpowiedź dla stagingu: jest, dopóki pozycja nie ma linku ani poprawki", () => {
    const bazowa = {
      dostawca: "MO5",
      kod: "NOWY",
      snapshotJson: JSON.stringify({ marka: "BKT", model: "AGRIMAX RT 765" }),
    };
    expect(propozycjaLinkuDlaPozycji(db, bazowa)?.link).toBe(LINK_A);
    expect(
      propozycjaLinkuDlaPozycji(db, {
        ...bazowa,
        snapshotJson: JSON.stringify({ marka: "BKT", model: "AGRIMAX RT 765", linkZdjecia: LINK_B }),
      }),
    ).toBeNull();
    expect(propozycjaLinkuDlaPozycji(db, { ...bazowa, snapshotJson: "{zepsute" })).toBeNull();

    db.insert(manualOverrides)
      .values({
        supplierKod: "MO5",
        supplierProductId: "NOWY",
        fieldName: "linkZdjecia",
        overrideValue: "",
        createdAt: "2026-10-09T00:00:00.000Z",
      })
      .run();
    expect(propozycjaLinkuDlaPozycji(db, bazowa)).toBeNull();
  });
});
