// Ticket 168 — kolejny import nie wywala wygenerowanego EAN-u w stagingu.
// Dane: realny produkt MO3 z wzorca charakteryzacji; cennik przynosi go z PUSTYM EAN-em.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { eanPary, products, stagingItems } from "../src/db/schema.js";
import { przydzielEan } from "../src/ean-pary/uzupelnianie.js";
import { zatwierdzPozycjeStagingu } from "../src/import/akceptacja.js";
import { silnikStagingu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

const KOD = "MO3_7107042ademo";
const katalog = join(dirname(fileURLToPath(import.meta.url)), "charakteryzacja");
const wczytaj = <T>(sciezka: string): T => JSON.parse(readFileSync(sciezka, "utf-8")) as T;

let baza: TestowaBaza | null = null;
afterEach(() => {
  baza?.posprzataj();
  baza = null;
});

function importuj(opcje: { wKatalogu: boolean; para: boolean }) {
  const produkt = wczytaj<Record<string, unknown>[]>(
    join(katalog, "silnik", "katalog", "MO3.katalog.json"),
  ).find((p) => p.kod === KOD)!;
  const rekord = {
    ...wczytaj<{ rekordy: RekordSurowy[] }>(join(katalog, "MO3.expected.json")).rekordy.find(
      (r) => r.kod === KOD,
    )!,
    ean: null,
  } as RekordSurowy;

  baza = stworzTestowaBaze();
  if (opcje.wKatalogu) baza.db.insert(products).values({ ...produkt, ean: null } as never).run();
  const ean = opcje.para ? przydzielEan(baza.db, { kod: KOD }).ean : null;
  silnikStagingu(baza.db)("MO3", [rekord], {});

  const wiersz = baza.db.select().from(stagingItems).all().find((w) => w.kod === KOD);
  return { ean, wiersz };
}

describe("staging a para kod↔EAN (ticket 168)", () => {
  it("pusty EAN w cenniku jest uzupełniony z pary — także dla nowej pozycji / po `clear`", () => {
    for (const wKatalogu of [true, false]) {
      const { ean, wiersz } = importuj({ wKatalogu, para: true });
      expect(ean).toMatch(/^999\d{10}$/);
      expect(wiersz).toBeDefined();
      const snapshot = JSON.parse(wiersz!.snapshotJson as string);
      expect(snapshot.ean).toBe(ean);
      expect(snapshot.eanIsValid).toBe(1);
      expect(wiersz!.eanRaw).toBe(ean);
      baza?.posprzataj();
      baza = null;
    }
  });

  it("bez pary pusty EAN zostaje pusty (generuje dopiero akceptacja)", () => {
    const { wiersz } = importuj({ wKatalogu: false, para: false });
    expect(JSON.parse(wiersz!.snapshotJson as string).ean ?? null).toBeNull();
    expect(baza!.db.select().from(eanPary).all()).toHaveLength(0);
  });

  it("akceptacja zachowuje EAN z pary, a dla pozycji bez pary generuje nowy", () => {
    const zPara = importuj({ wKatalogu: false, para: true });
    zatwierdzPozycjeStagingu(baza!.db, zPara.wiersz!.id, 1, undefined, true);
    expect(baza!.db.select().from(products).get()!.ean).toBe(zPara.ean);
    baza?.posprzataj();
    baza = null;

    const bezPary = importuj({ wKatalogu: false, para: false });
    zatwierdzPozycjeStagingu(baza!.db, bezPary.wiersz!.id, 1, undefined, true);
    const nowy = baza!.db.select().from(products).get()!.ean;
    expect(nowy).toMatch(/^999\d{10}$/);
    expect(baza!.db.select().from(eanPary).get()!.ean).toBe(nowy);
  });
});
