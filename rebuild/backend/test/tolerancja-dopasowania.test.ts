// Tolerancja dopasowania (decyzja użytkowniczki, 2026-10-01, `polityka/tolerancja-dopasowania.ts`):
// import nie zgłasza „Oznaczenie wskazuje inną oponę", gdy różnica to (1) wartość pola już
// poprawiona ręcznie na karcie albo (2) DOT pokrewny (zbiór lat zawiera się w drugim).
//
// Przypadek wzorcowy: Mitas TF-03 6.50-16 — karta ma model `TF03` (poprawka Marty, źródło
// `TF-03`) i DOT `2025,2026`, cennik podaje `TF-03` i `2026`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { eanPary, manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { dotyPokrewne } from "../src/import/polityka/tolerancja-dopasowania.js";
import { silnikStagingu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

const KOD = "MO5_BFPR240460708DUT1";
const katalog = join(dirname(fileURLToPath(import.meta.url)), "charakteryzacja");
const wczytaj = <T>(sciezka: string): T => JSON.parse(readFileSync(sciezka, "utf-8")) as T;

describe("dotyPokrewne", () => {
  it.each([
    ["2026", "2025,2026", true],
    ["2025,2026", "2026", true],
    ["2025,2026", "2025,2026", true],
    ["23", "2023", true],
    ["2024,2025,2026", "2025", true],
    ["2026", "2025", false],
    ["2024,2025", "2025,2026", false],
    ["2026", "", false],
    ["", "", true],
    ["nie starsza niz 3 lata", "nie starsza niz 3 lata", true],
    ["nie starsza niz 3 lata", "2026", false],
  ])("%j vs %j → %s", (a, b, oczekiwane) => {
    expect(dotyPokrewne(a, b)).toBe(oczekiwane);
  });
});

let baza: TestowaBaza | null = null;
afterEach(() => {
  baza?.posprzataj();
  baza = null;
});

type Wiersz = Record<string, unknown>;

/** Import jednego rekordu na kartę z fixture'a, z modyfikacjami karty/rekordu i poprawką karty. */
function importuj(opcje: {
  karta?: Wiersz;
  rekord?: Wiersz;
  poprawka?: { fieldName: string; overrideValue: string; acknowledgedSourceValue: string };
  /** Druga karta (np. osobna partia z kodem zastępczym) i pary kod↔EAN wygenerowane wcześniej. */
  druga?: Wiersz;
  pary?: Wiersz[];
}) {
  const produkt = wczytaj<Wiersz[]>(join(katalog, "silnik", "katalog", "MO5.katalog.json")).find(
    (p) => p.kod === KOD,
  )!;
  const rekord = wczytaj<{ rekordy: Wiersz[] }>(join(katalog, "MO5.expected.json")).rekordy.find(
    (r) => r.kod === KOD,
  )!;
  baza = stworzTestowaBaze();
  // Katalog z fixture'a trzyma konstrukcję jako `R`/`D`, a parser podaje `Radialna`/`Diagonalna`
  // (produkcja ma już długą formę). Ujednolicamy, żeby test mierzył tolerancję, a nie ten rozjazd.
  const konstrukcja = produkt.konstrukcja === "D" ? "Diagonalna" : "Radialna";
  baza.db.insert(products).values({ ...produkt, konstrukcja, ...opcje.karta } as never).run();
  if (opcje.druga) {
    baza.db
      .insert(products)
      .values({ ...produkt, konstrukcja, id: 9_999_001, ...opcje.druga } as never)
      .run();
  }
  for (const para of opcje.pary ?? []) {
    baza.db
      .insert(eanPary)
      .values({ dostawca: "MO5", status: "aktywny", utworzono: "2026-09-30T00:00:00.000Z", ...para } as never)
      .run();
  }
  if (opcje.poprawka) {
    baza.db
      .insert(manualOverrides)
      .values({
        supplierKod: "MO5",
        supplierProductId: KOD,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...opcje.poprawka,
      } as never)
      .run();
  }
  silnikStagingu(baza.db)("MO5", [{ ...rekord, ...opcje.rekord } as unknown as RekordSurowy], {});
  const wiersze = baza.db.select().from(stagingItems).all();
  return wiersze.map((w) => ({
    kod: w.kod,
    typ: w.typZmiany,
    problem: (JSON.parse(w.snapshotJson as string) as Wiersz)._matchIssue ?? null,
  }));
}

describe("importer — tolerancja dopasowania", () => {
  it("DOT pokrewny (`2026` vs `2025,2026`): ta sama karta, bez zgłoszenia „inna opona”", () => {
    const staging = importuj({ karta: { dot: "2025,2026" }, rekord: { dot: "2026" } });
    expect(staging.filter((w) => w.problem)).toEqual([]);
    expect(staging.every((w) => w.kod === KOD)).toBe(true); // bez kodu zastępczego `MO5_AUTO_…`
  });

  it("DOT rozłączny (`2026` vs `2025`): nadal OSOBNA partia, jak w produkcji", () => {
    const staging = importuj({ karta: { dot: "2025" }, rekord: { dot: "2026" } });
    expect(staging.filter((w) => w.problem)).toEqual([]);
    expect(staging).toHaveLength(1);
    expect(staging[0]!.kod).toMatch(/^MO5_AUTO_/);
    expect(staging[0]!.typ).toBe("nowa");
  });

  it("poprawka modelu karty + DOT rozłączny: osobna partia, a nie fałszywa „inna opona”", () => {
    const karta = { model: "DURAFORCE-UTILITY", dot: "2025" };
    const rekord = { dot: "2026" };
    const poprawka = {
      fieldName: "model",
      overrideValue: "DURAFORCE-UTILITY",
      acknowledgedSourceValue: "DURAFORCE UTILITY",
    };
    // Bez poprawki karta „różni się modelem" od pliku → trafia do ręcznej decyzji.
    const bez = importuj({ karta, rekord });
    baza?.posprzataj();
    expect(bez.filter((w) => w.problem)).toHaveLength(1);

    const z = importuj({ karta, rekord, poprawka });
    expect(z.filter((w) => w.problem)).toEqual([]);
    expect(z[0]!.kod).toMatch(/^MO5_AUTO_/);
  });

  it("dostawca zmienił model JESZCZE RAZ: poprawka nie przesłania prawdziwej zmiany", () => {
    const staging = importuj({
      karta: { model: "DURAFORCE-UTILITY", dot: "2025" },
      rekord: { dot: "2026", model: "DURAFORCE NOWY" },
      poprawka: {
        fieldName: "model",
        overrideValue: "DURAFORCE-UTILITY",
        acknowledgedSourceValue: "DURAFORCE UTILITY",
      },
    });
    expect(staging.filter((w) => w.problem)).toHaveLength(1);
  });

  describe("karta założona przez system dla tego wiersza (osobna partia DOT z kodem `…_AUTO_…`)", () => {
    const AUTO = "MO5_AUTO_ABC123";
    /** Karta z kodem z pliku ma DOT 2025, a zaakceptowana partia 2026 żyje pod kodem zastępczym. */
    const karty = (druga: Wiersz = {}) => ({
      karta: { dot: "2025", ean: "9990000000210" },
      druga: { kod: AUTO, dot: "2026", ean: "9990000001903", ...druga },
      pary: [
        { kod: KOD, ean: "9990000000210", numer: 21 },
        { kod: AUTO, ean: "9990000001903", numer: 190 },
      ],
      rekord: { dot: "2026", ean: null, eanRaw: null },
    });

    it("kolejny import tego samego wiersza dopasowuje się do niej — bez pytania o „podobną oponę”", () => {
      const staging = importuj(karty());
      expect(staging.filter((w) => w.problem)).toEqual([]);
      expect(staging.every((w) => w.kod === AUTO)).toBe(true);
      expect(staging.some((w) => w.typ === "nowa"), "nie zakłada trzeciej karty").toBe(false);
    });

    it("prawdziwy EAN w cenniku nie blokuje dopasowania, gdy karta ma wygenerowany 999…", () => {
      const staging = importuj({ ...karty(), rekord: { dot: "2026", ean: "5901234123457" } });
      expect(staging.filter((w) => w.problem)).toEqual([]);
    });

    it("INNY prawdziwy EAN na karcie → nadal pytanie (to może być inna opona)", () => {
      const staging = importuj({
        ...karty({ ean: "5901234123464" }),
        pary: [{ kod: KOD, ean: "9990000000210", numer: 21 }],
        rekord: { dot: "2026", ean: "5901234123457" },
      });
      expect(staging.filter((w) => w.problem)).toHaveLength(1);
    });

    it("karta o INNYM kodzie dostawcy niż wiersz nie jest „własną” — pytanie zostaje", () => {
      const staging = importuj(karty({ kodDostawcy: "INNY_KOD" }));
      expect(staging.filter((w) => w.problem)).toHaveLength(1);
    });
  });
});
