/**
 * Ticket 185 — ochrona kategorii/zastosowania przy imporcie i dziedziczenie dla nowych produktów.
 * NOWA logika biznesowa, nie port. Prawdziwy SQLite, prawdziwa ścieżka akceptacji stagingu.
 */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { products, stagingItems } from "../src/db/schema.js";
import { zatwierdzPozycjeStagingu } from "../src/import/akceptacja.js";
import { dodajProduktyBulk } from "../src/import/bulk.js";
import { applyKategoriaDziedziczona } from "../src/import/dziedziczenieKategorii.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { pozycja, produkt } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type Wiersz = Record<string, unknown>;

let baza: TestowaBaza;
beforeEach(() => {
  baza = stworzTestowaBaze();
});
afterEach(() => baza.posprzataj());

/** Odpowiednik w katalogu: ta sama marka, model i rozmiar. */
const odpowiednik = (kod: string, nad: Wiersz = {}): Wiersz =>
  produkt({
    kod,
    nazwa: `Opona ${kod}`,
    model: "AGRIMAX RT 765",
    szerokosc: "480",
    profil: 70,
    srednica: 28,
    konstrukcja: "Radialna",
    kategoria: "Przemysłowe",
    zastosowanie: "Ładowarka",
    ...nad,
  });

const nowaPozycja = (kod: string, snapshot: Wiersz = {}): Wiersz =>
  pozycja({
    kod,
    nazwa: `Opona ${kod}`,
    snapshot: {
      kod,
      nazwa: `Opona ${kod}`,
      model: "AGRIMAX RT 765",
      szerokosc: "480",
      profil: 70,
      srednica: 28,
      konstrukcja: "Radialna",
      ...snapshot,
    },
  });

function zatwierdz(wiersz: Wiersz): void {
  baza.db.insert(stagingItems).values(wiersz as never).run();
  const id = (baza.db.select().from(stagingItems).all()[0] as { id: number }).id;
  expect(zatwierdzPozycjeStagingu(baza.db, id, 1)).toBe(true);
}

const stan = (kod: string) =>
  baza.sqlite.prepare("SELECT kategoria, zastosowanie FROM products WHERE kod = ?").get(kod);

describe("akceptacja stagingu — ISTNIEJĄCY produkt zachowuje kategorię i zastosowanie", () => {
  it("snapshot z domyślnym „Rolnicze” i bez zastosowania nie cofa przypisanej pary", () => {
    baza.db.insert(products).values(odpowiednik("P1") as never).run();
    zatwierdz(nowaPozycja("P1", { kategoria: "Rolnicze" }));
    expect(stan("P1")).toEqual({ kategoria: "Przemysłowe", zastosowanie: "Ładowarka" });
  });

  it("poprawka Marty na kategorii wygrywa nad wartością z bazy", () => {
    baza.db.insert(products).values(odpowiednik("P1") as never).run();
    baza.sqlite
      .prepare(
        "INSERT INTO manual_overrides (supplier_kod, supplier_product_id, field_name, override_value, created_at) VALUES ('MO5','P1','kategoria','Leśne','2026-10-01')",
      )
      .run();
    // Silnik importu nakłada poprawkę Marty już na snapshot — tu odwzorowujemy ten stan.
    zatwierdz(nowaPozycja("P1", { kategoria: "Leśne" }));
    expect(stan("P1")).toMatchObject({ kategoria: "Leśne" });
  });
});

describe("akceptacja stagingu — NOWY produkt dziedziczy parę po odpowiedniku", () => {
  it("jednoznaczny odpowiednik (marka + model + rozmiar) → ta sama para", () => {
    baza.db.insert(products).values([odpowiednik("A"), odpowiednik("B")] as never).run();
    zatwierdz(nowaPozycja("NOWY"));
    expect(stan("NOWY")).toEqual({ kategoria: "Przemysłowe", zastosowanie: "Ładowarka" });
  });

  it("sprzeczne odpowiedniki → zostaje domyślne „Rolnicze” i puste zastosowanie", () => {
    baza.db
      .insert(products)
      .values([odpowiednik("A"), odpowiednik("B", { kategoria: "Rolnicze", zastosowanie: "Ciągnik" })] as never)
      .run();
    zatwierdz(nowaPozycja("NOWY"));
    expect(stan("NOWY")).toEqual({ kategoria: "Rolnicze", zastosowanie: null });
  });

  it("inny rozmiar albo inny model → brak dziedziczenia", () => {
    baza.db.insert(products).values([odpowiednik("A")] as never).run();
    zatwierdz(nowaPozycja("NOWY", { szerokosc: "520" }));
    expect(stan("NOWY")).toEqual({ kategoria: "Rolnicze", zastosowanie: null });
  });

  it("poprawka Marty na zastosowaniu nowego produktu: dziedziczenie się nie włącza", () => {
    baza.db.insert(products).values([odpowiednik("A")] as never).run();
    baza.sqlite
      .prepare(
        "INSERT INTO manual_overrides (supplier_kod, supplier_product_id, field_name, override_value, created_at) VALUES ('MO5','NOWY','zastosowanie','Kombajn','2026-10-01')",
      )
      .run();
    zatwierdz(nowaPozycja("NOWY", { zastosowanie: "Kombajn" }));
    expect(stan("NOWY")).toEqual({ kategoria: "Rolnicze", zastosowanie: "Kombajn" });
  });
});

describe("applyKategoriaDziedziczona — warunki wstępne", () => {
  const rekord = (nad: Wiersz = {}): Wiersz => ({
    kod: "N", dostawca: "MO5", marka: "BKT", model: "AGRIMAX RT 765", szerokosc: "480", profil: 70, srednica: 28,
    konstrukcja: "Radialna", kategoria: "Rolnicze", zastosowanie: null, ...nad,
  });

  beforeEach(() => {
    baza.db.insert(products).values([odpowiednik("A")] as never).run();
  });

  it("nic nie robi, gdy kategoria podana wprost, zastosowanie wypełnione albo model pusty", () => {
    for (const [r, opcje] of [
      [rekord(), { kategoriaPodana: true }],
      [rekord({ zastosowanie: "Kombajn" }), { kategoriaPodana: false }],
      [rekord({ model: "" }), { kategoriaPodana: false }],
    ] as const) {
      expect(applyKategoriaDziedziczona(baza.db, r, opcje)).toBe(false);
      expect(r.kategoria).toBe("Rolnicze");
    }
  });

  it("dziedziczy, gdy warunki spełnione", () => {
    const r = rekord();
    expect(applyKategoriaDziedziczona(baza.db, r, { kategoriaPodana: false })).toBe(true);
    expect(r).toMatchObject({ kategoria: "Przemysłowe", zastosowanie: "Ładowarka" });
  });
});

describe("dodajProduktyBulk", () => {
  it("nowy produkt bez kategorii dziedziczy parę; z kategorią podaną wprost — nie", () => {
    baza.db.insert(products).values([odpowiednik("A")] as never).run();
    const wspolne = {
      marka: "BKT", model: "AGRIMAX RT 765", szerokosc: "480", profil: 70, srednica: 28, konstrukcja: "Radialna",
      rozmiar: "480/70R28", dostawca: "MO5", cenaZakupu: 10,
    };
    dodajProduktyBulk(baza.db, [
      { ...wspolne, kod: "B1", nazwa: "B1" },
      { ...wspolne, kod: "B2", nazwa: "B2", kategoria: "Rolnicze" },
    ] as never);
    expect(stan("B1")).toEqual({ kategoria: "Przemysłowe", zastosowanie: "Ładowarka" });
    expect(stan("B2")).toEqual({ kategoria: "Rolnicze", zastosowanie: null });
    expect(baza.db.select().from(products).where(eq(products.kod, "B1")).get()).toBeTruthy();
  });
});
