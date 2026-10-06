// Ticket 191 (2026-10-06): zmiana ceny zakupu poza akceptacją stagingu przelicza cenę sprzedaży z narzutu.
// Przypadek z produkcji: MO2 710/45-26.5 ALLIANCE — zakup 5426,85 → 5947,50, sprzedaż została 6906.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { manualOverrides, markups, products, stagingItems } from "../src/db/schema.js";
import { odrzucZmianeKarty } from "../src/import/polityka/odrzucenie-zmiany.js";
import { silnikStagingu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { cenaSprzedazyPoZmianieZakupu } from "../src/repos/ceny.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

const KOD = "MO5_BFPR240460708DUT1";
const katalog = join(dirname(fileURLToPath(import.meta.url)), "charakteryzacja");
const wczytaj = <T>(sciezka: string): T => JSON.parse(readFileSync(sciezka, "utf-8")) as T;
type Wiersz = Record<string, unknown>;

let baza: TestowaBaza | null = null;
afterEach(() => {
  baza?.posprzataj();
  baza = null;
});

const bazowyRekord = () =>
  wczytaj<{ rekordy: Wiersz[] }>(join(katalog, "MO5.expected.json")).rekordy.find((r) => r.kod === KOD)!;

function przygotuj(karta: Wiersz, zNarzutem = true): void {
  const produkt = wczytaj<Wiersz[]>(join(katalog, "silnik", "katalog", "MO5.katalog.json")).find((p) => p.kod === KOD)!;
  baza = stworzTestowaBaze();
  const konstrukcja = produkt.konstrukcja === "D" ? "Diagonalna" : "Radialna";
  baza.db.insert(products).values({ ...produkt, konstrukcja, ...karta } as never).run();
  if (zNarzutem) {
    baza.db
      .insert(markups)
      .values({ nazwa: "Globalna", typ: "globalny", zakres: "", wartosc: 6, priorytet: 50, status: "aktywny", warunki: "[]" } as never)
      .run();
  }
  // Pierwszy import ustala stan oferty; karta przyjmuje bieżące cechy z pliku.
}

const importuj = (rekord: Wiersz) =>
  silnikStagingu(baza!.db)("MO5", [{ ...bazowyRekord(), ...rekord } as unknown as RekordSurowy]);
const karta = () => (baza!.db.select().from(products).all() as unknown as Wiersz[]).find((p) => p.kod === KOD)!;

describe("cenaSprzedazyPoZmianieZakupu", () => {
  const narzut = { id: 1, nazwa: "G", typ: "globalny", zakres: "", wartosc: 6, priorytet: 50, status: "aktywny", warunki: "[]" } as never;
  it("liczy floor(zakup × 1,06 × 1,23) i nie rusza statusu", () => {
    const rekord = { cenaZakupu: 5947.5, vat: 23, status: "wstrzymany" };
    expect(cenaSprzedazyPoZmianieZakupu(rekord, [narzut], [])).toEqual({ cenaSprzedazy: 7754, marzaPct: 6 });
    expect(rekord.status).toBe("wstrzymany");
  });
  it("bez reguł i bez ceny zakupu zwraca null", () => {
    expect(cenaSprzedazyPoZmianieZakupu({ cenaZakupu: 100 }, [], [])).toBeNull();
    expect(cenaSprzedazyPoZmianieZakupu({ cenaZakupu: 0 }, [narzut], [])).toBeNull();
  });
});

describe("cicha aktualizacja importera", () => {
  it("nowa cena zakupu z pliku przelicza cenę sprzedaży z narzutu", () => {
    const r = bazowyRekord();
    przygotuj({ cenaZakupu: 5426.85, cenaSprzedazy: 6906, marzaPct: 6, vat: 23, status: "aktywny" });
    importuj({ ...r, cenaZakupu: 5947.5 });
    expect(baza!.db.select().from(stagingItems).all().filter((w) => w.kod === KOD)).toHaveLength(0);
    expect(karta()).toMatchObject({ cenaZakupu: 5947.5, cenaSprzedazy: 7754, marzaPct: 6 });
  });

  it("bez reguł cenowych cena sprzedaży zostaje (jak dotąd)", () => {
    przygotuj({ cenaZakupu: 5426.85, cenaSprzedazy: 6906, marzaPct: 6, vat: 23, status: "aktywny" }, false);
    importuj({ cenaZakupu: 5947.5 });
    expect(karta()).toMatchObject({ cenaZakupu: 5947.5, cenaSprzedazy: 6906 });
  });

  it("ręczna poprawka ceny sprzedaży wygrywa z przeliczeniem", () => {
    przygotuj({ cenaZakupu: 5426.85, cenaSprzedazy: 9999, marzaPct: 6, vat: 23, status: "aktywny" });
    baza!.db
      .insert(manualOverrides)
      .values({ supplierKod: "MO5", supplierProductId: KOD, fieldName: "cenaSprzedazy", overrideValue: "9999", reason: "test", createdBy: 1, createdAt: "2026-10-06T00:00:00Z" } as never)
      .run();
    importuj({ cenaZakupu: 5947.5 });
    expect(Number(karta().cenaSprzedazy)).toBe(9999);
    expect(karta().cenaZakupu).toBe(5947.5);
  });
});

describe("„Odrzuć” w stagingu", () => {
  it("cena zakupu z pliku przelicza cenę sprzedaży z narzutu", () => {
    przygotuj({ model: "DURAFORCE UTILITY", cenaZakupu: 100, cenaSprzedazy: 500, marzaPct: 6, vat: 23, status: "aktywny" });
    importuj({ model: "DURAFORCE-UTILITY", cenaZakupu: 120 });
    const id = baza!.db.select().from(stagingItems).all().find((w) => w.kod === KOD)!.id;
    const wynik = odrzucZmianeKarty(baza!.db, id, 1);
    expect(wynik.zaktualizowanePola).toEqual(expect.arrayContaining(["cenaZakupu", "cenaSprzedazy"]));
    expect(karta()).toMatchObject({ model: "DURAFORCE UTILITY", cenaZakupu: 120, cenaSprzedazy: 156 });
  });
});
