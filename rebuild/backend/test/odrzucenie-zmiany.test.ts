// „Odrzuć” w szczegółach stagingu (decyzja użytkowniczki, 2026-10-05, `polityka/odrzucenie-zmiany.ts`):
// karta zostaje bez zmian, różnica z pliku zapisuje się jak poprawka Marty z wartością karty.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { odrzucZmianeKarty } from "../src/import/polityka/odrzucenie-zmiany.js";
import { silnikStagingu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
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

/** Karta z fixture'a z `karta`, jeden import rekordu z `rekord`; zwraca id pierwszego zgłoszenia. */
function przygotuj(karta: Wiersz, rekord: Wiersz): number {
  const produkt = wczytaj<Wiersz[]>(join(katalog, "silnik", "katalog", "MO5.katalog.json")).find((p) => p.kod === KOD)!;
  const baseRekord = wczytaj<{ rekordy: Wiersz[] }>(join(katalog, "MO5.expected.json")).rekordy.find((r) => r.kod === KOD)!;
  baza = stworzTestowaBaze();
  const konstrukcja = produkt.konstrukcja === "D" ? "Diagonalna" : "Radialna";
  baza.db.insert(products).values({ ...produkt, konstrukcja, ...karta } as never).run();
  importuj(rekord, baseRekord);
  return baza.db.select().from(stagingItems).all().find((w) => w.kod === KOD)!.id;
}

function importuj(rekord: Wiersz, baseRekord?: Wiersz): void {
  const bazowy =
    baseRekord ??
    wczytaj<{ rekordy: Wiersz[] }>(join(katalog, "MO5.expected.json")).rekordy.find((r) => r.kod === KOD)!;
  silnikStagingu(baza!.db)("MO5", [{ ...bazowy, ...rekord } as unknown as RekordSurowy]);
}

const kartaZBazy = () => (baza!.db.select().from(products).all() as unknown as Wiersz[]).find((p) => p.kod === KOD)!;
const poprawki = () => baza!.db.select().from(manualOverrides).all();

describe("odrzucZmianeKarty", () => {
  it("zostawia kartę bez zmian, zakłada poprawkę z wartością karty i usuwa zgłoszenie", () => {
    const id = przygotuj({ model: "DURAFORCE UTILITY" }, { model: "DURAFORCE-UTILITY" });
    const przed = kartaZBazy();

    const wynik = odrzucZmianeKarty(baza!.db, id, 1);

    expect(wynik.zachowanePola).toContain("model");
    expect(kartaZBazy()).toEqual(przed);
    expect(baza!.db.select().from(stagingItems).all().filter((w) => w.kod === KOD)).toHaveLength(0);
    const p = poprawki().find((x) => x.fieldName === "model")!;
    expect(p).toMatchObject({
      supplierKod: "MO5",
      supplierProductId: KOD,
      overrideValue: "DURAFORCE UTILITY",
      acknowledgedSourceValue: "DURAFORCE-UTILITY",
      createdBy: 1,
    });
    expect(p.reason).toContain("Odrzucona zmiana z pliku");
  });

  it("kolejny import z TĄ SAMĄ wartością z pliku nie zgłasza różnicy", () => {
    const id = przygotuj({ model: "DURAFORCE UTILITY" }, { model: "DURAFORCE-UTILITY" });
    odrzucZmianeKarty(baza!.db, id, 1);

    importuj({ model: "DURAFORCE-UTILITY" });

    const zgloszenia = baza!.db.select().from(stagingItems).all().filter((w) => w.kod === KOD);
    expect(zgloszenia.filter((w) => w.typZmiany === "zmiana_kluczowa")).toHaveLength(0);
    expect(kartaZBazy().model).toBe("DURAFORCE UTILITY");
  });

  it("jak każda poprawka Marty: gdy dostawca zmieni wartość jeszcze raz, karta zostaje przy swojej (po cichu)", () => {
    const id = przygotuj({ model: "DURAFORCE UTILITY" }, { model: "DURAFORCE-UTILITY" });
    odrzucZmianeKarty(baza!.db, id, 1);

    importuj({ model: "DURAFORCE UTILITY 2" });

    expect(kartaZBazy().model).toBe("DURAFORCE UTILITY");
    expect(baza!.db.select().from(stagingItems).all().filter((w) => w.typZmiany === "zmiana_kluczowa")).toHaveLength(0);
  });

  it("odmawia, gdy zgłoszenia już nie ma", () => {
    przygotuj({ model: "DURAFORCE UTILITY" }, { model: "DURAFORCE-UTILITY" });
    expect(() => odrzucZmianeKarty(baza!.db, 999_999, 1)).toThrow(/już nie istnieje/);
  });

  it("odmawia dla pozycji innego typu niż zmiana istniejącego produktu", () => {
    const id = przygotuj({ model: "DURAFORCE UTILITY" }, { model: "DURAFORCE-UTILITY" });
    baza!.db.update(stagingItems).set({ typZmiany: "nowa" }).run();
    expect(() => odrzucZmianeKarty(baza!.db, id, 1)).toThrow(/działa tylko dla zmiany istniejącego produktu/);
    expect(poprawki()).toHaveLength(0);
  });
});
