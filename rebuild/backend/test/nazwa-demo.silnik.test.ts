// „DEMO" na końcu nazwy ma ostatnie słowo — także wobec `nazwa_pamiec` i poprawek Marty
// (`manual_overrides`). Decyzja Anny 2026-09-30, `src/import/polityka/nazwa-demo.ts`.
//
// Dane: realny produkt demo MO3 (`MO3_7107042ademo`) z wzorca charakteryzacji — jest w katalogu
// BEZ „DEMO", a cennik przynosi go z kodem dostawcy `7107042ademo`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { manualOverrides, nazwaPamiec, products, stagingItems } from "../src/db/schema.js";
import { silnikStagingu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

const KOD = "MO3_7107042ademo";
const NAZWA_BEZ_DEMO = "710/70R42 ALLIANCE AGRISTAR II 70 173D TL";
const NAZWA_Z_DEMO = `${NAZWA_BEZ_DEMO} DEMO`;
const KOD_IMPORTU = "215047";

const katalog = join(dirname(fileURLToPath(import.meta.url)), "charakteryzacja");
const wczytaj = <T>(sciezka: string): T => JSON.parse(readFileSync(sciezka, "utf-8")) as T;

let baza: TestowaBaza | null = null;
afterEach(() => {
  baza?.posprzataj();
  baza = null;
});

/** Importuje jeden rekord demo na katalog z tym samym produktem i zwraca wiersz stagingu. */
function importuj(dodatki?: (db: TestowaBaza["db"]) => void) {
  const produkt = wczytaj<Record<string, unknown>[]>(
    join(katalog, "silnik", "katalog", "MO3.katalog.json"),
  ).find((p) => p.kod === KOD)!;
  const rekord = wczytaj<{ rekordy: RekordSurowy[] }>(join(katalog, "MO3.expected.json")).rekordy.find(
    (r) => r.kod === KOD,
  )!;
  expect(produkt.nazwa).toBe(NAZWA_BEZ_DEMO);
  expect(rekord.nazwa).toBe(NAZWA_BEZ_DEMO);

  baza = stworzTestowaBaze();
  baza.db.insert(products).values(produkt as never).run();
  dodatki?.(baza.db);
  silnikStagingu(baza.db)("MO3", [rekord], {});

  const wiersze = baza.db.select().from(stagingItems).all().filter((w) => w.kod === KOD);
  return wiersze;
}

describe("DEMO w nazwie na imporcie (silnik stagingu)", () => {
  it("zmiana nazwy na „… DEMO” trafia do stagingu", () => {
    const wiersze = importuj();
    expect(wiersze).toHaveLength(1);
    expect(wiersze[0]!.nazwa).toBe(NAZWA_Z_DEMO);
    expect(JSON.parse(wiersze[0]!.snapshotJson as string).nazwa).toBe(NAZWA_Z_DEMO);
  });

  it("pamięć nazw (`nazwa_pamiec`) nie zdejmuje DEMO", () => {
    const wiersze = importuj((db) =>
      db
        .insert(nazwaPamiec)
        .values({ kodImportu: KOD_IMPORTU, nazwa: NAZWA_BEZ_DEMO, updatedAt: "2026-07-20", source: "test" })
        .run(),
    );
    expect(wiersze).toHaveLength(1);
    expect(JSON.parse(wiersze[0]!.snapshotJson as string).nazwa).toBe(NAZWA_Z_DEMO);
  });

  it("poprawka Marty na `nazwa` (`manual_overrides`) nie zdejmuje DEMO", () => {
    const wiersze = importuj((db) =>
      db
        .insert(manualOverrides)
        .values({
          supplierKod: "MO3",
          supplierProductId: KOD,
          fieldName: "nazwa",
          overrideValue: "710/70R42 ALLIANCE AGRISTAR II 70 RĘCZNA",
          createdAt: "2026-09-29T00:00:00.000Z",
        })
        .run(),
    );
    expect(wiersze).toHaveLength(1);
    expect(JSON.parse(wiersze[0]!.snapshotJson as string).nazwa).toBe(
      "710/70R42 ALLIANCE AGRISTAR II 70 RĘCZNA DEMO",
    );
  });
});
