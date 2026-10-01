// Tolerancja dopasowania (decyzja użytkowniczki, 2026-10-01, `polityka/tolerancja-dopasowania.ts`):
// import nie zgłasza „Oznaczenie wskazuje inną oponę", gdy różnica to (1) wartość pola już
// poprawiona ręcznie na karcie albo (2) DOT — ten sam kod = ta sama pozycja, DOT zmienia się w miejscu
// (decyzja 2026-10-01; w pliku dostawcy inna partia DOT ma INNY symbol, więc nic się nie scala).
//
// Przypadek wzorcowy: Mitas TF-03 6.50-16 — karta ma model `TF03` (poprawka Marty, źródło
// `TF-03`) i DOT `2025,2026`, cennik podaje `TF-03` i `2026`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { eanPary, manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { rozstrzygnijIZatwierdz } from "../src/import/polityka/rozstrzygniecie-z-zapisem.js";
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
  /** Kompletna oferta — wtedy niejednoznaczne dopasowanie mogło (w produkcji) wstrzymywać karty. */
  kompletna?: boolean;
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
  silnikStagingu(baza.db)(
    "MO5",
    [{ ...rekord, ...opcje.rekord } as unknown as RekordSurowy],
    opcje.kompletna ? { meta: { complete: true } as never } : {},
  );
  const wiersze = baza.db.select().from(stagingItems).all();
  return wiersze.map((w) => ({
    kod: w.kod,
    typ: w.typZmiany,
    powod: w.powod as string | null,
    problem: (JSON.parse(w.snapshotJson as string) as Wiersz)._matchIssue ?? null,
  }));
}

describe("importer — tolerancja dopasowania", () => {
  /** DOT karty po imporcie — z tej samej bazy, na której poszedł import. */
  const dotKartyWiersz = (kod = KOD) =>
    (baza!.db.select().from(products).all() as unknown as Wiersz[]).find((p) => p.kod === kod)!;
  const dotKarty = (kod = KOD) =>
    (baza!.db.select().from(products).all() as unknown as Wiersz[]).find((p) => p.kod === kod)!.dot;

  const karta = () => dotKartyWiersz();

  describe("DOT jako cecha zmienna — ta sama pozycja (ten sam kod) nie wraca do akceptacji", () => {
    it("`2026` vs `2025,2026`: ta sama karta, bez zgłoszenia, DOT zapisany na karcie", () => {
      const staging = importuj({ karta: { dot: "2025,2026" }, rekord: { dot: "2026" } });
      expect(staging.filter((w) => w.problem)).toEqual([]);
      expect(staging.every((w) => w.kod === KOD)).toBe(true);
      expect(dotKarty()).toBe("2026");
    });

    it("`2026` vs `2025` (rozłączne): TA SAMA karta — bez nowego produktu i bez pytania, DOT zmieniony w miejscu", () => {
      const staging = importuj({ karta: { dot: "2025" }, rekord: { dot: "2026" } });
      expect(staging.filter((w) => w.problem)).toEqual([]);
      expect(staging.some((w) => w.typ === "nowa"), "nie powstaje druga karta").toBe(false);
      expect(dotKarty()).toBe("2026");
    });

    it("zmiana DOT przy zmienionym modelu karty (poprawka Marty) też nie pyta", () => {
      const staging = importuj({
        karta: { model: "DURAFORCE-UTILITY", dot: "2025" },
        rekord: { dot: "2026" },
        poprawka: {
          fieldName: "model",
          overrideValue: "DURAFORCE-UTILITY",
          acknowledgedSourceValue: "DURAFORCE UTILITY",
        },
      });
      expect(staging.filter((w) => w.problem)).toEqual([]);
      expect(dotKarty()).toBe("2026");
    });

    it("NOWY symbol dostawcy z innym DOT (kolejna partia) to nadal osobny produkt — bez pytania", () => {
      const staging = importuj({
        karta: { dot: "2025" },
        rekord: { kod: "MO5_BFPR240460708DUT2", kodDostawcy: "BFPR240460708DUT2", dot: "2026" },
      });
      expect(staging.filter((w) => w.problem)).toEqual([]);
      expect(staging).toHaveLength(1);
      expect(staging[0]!.typ).toBe("nowa");
      expect(staging[0]!.kod).toBe("MO5_BFPR240460708DUT2");
      expect(dotKarty(), "karta z poprzednią partią nietknięta").toBe("2025");
    });
  });

  describe("inny symbol dostawcy = osobna pozycja (decyzja użytkowniczki, 2026-10-01)", () => {
    const NOWY = { kod: "MO5_BFPR240460708DUT2", kodDostawcy: "BFPR240460708DUT2" };

    it("ten sam DOT i ten sam EAN, ale nowy symbol — nowa karta, bez pytania", () => {
      const staging = importuj({ karta: { dot: "2026" }, rekord: { ...NOWY, dot: "2026" } });
      expect(staging.filter((w) => w.problem)).toEqual([]);
      expect(staging.find((w) => w.kod === NOWY.kod)).toMatchObject({ typ: "nowa" });
      // Jednowierszowy plik testowy nie zawiera już starego symbolu, więc stara karta dostaje
      // WŁASNY przegląd nieobecności („stara karta”) — sieć bezpieczeństwa na zmianę symbolu.
      const stara = staging.filter((w) => w.kod === KOD);
      expect(stara.every((w) => w.typ === "blad")).toBe(true);
      expect(dotKarty(), "karta o starym symbolu nietknięta").toBe("2026");
    });

    it("pokrewny DOT (`2026` ⊂ `2025,2026`) i nowy symbol — też osobna karta", () => {
      const staging = importuj({ karta: { dot: "2025,2026" }, rekord: { ...NOWY, dot: "2026" } });
      expect(staging.filter((w) => w.problem)).toEqual([]);
      expect(staging.find((w) => w.kod === NOWY.kod)).toMatchObject({ typ: "nowa" });
    });

    it("inny EAN, te same cechy i DOT, nowy symbol — nowa karta, bez pytania", () => {
      const staging = importuj({
        karta: { dot: "2026", ean: "5901234123457" },
        rekord: { ...NOWY, dot: "2026" },
      });
      expect(staging.filter((w) => w.problem)).toEqual([]);
      expect(staging.find((w) => w.kod === NOWY.kod)).toMatchObject({ typ: "nowa" });
    });

    it("TEN SAM symbol z innym kodem w katalogu nadal wskazuje tę kartę (reguła nie dotyka kroku „kod dostawcy”)", () => {
      const staging = importuj({
        karta: { kod: "MO5_STARY_KOD", dot: "2026" },
        rekord: { dot: "2026" },
      });
      expect(staging.some((w) => w.typ === "nowa" && w.kod !== "MO5_STARY_KOD")).toBe(false);
    });
  });

  describe("karta założona wcześniej przez system dla tego wiersza (`…_AUTO_…`, stare osobne partie DOT)", () => {
    const AUTO = "MO5_AUTO_ABC123";
    /** Karta z kodem z pliku ma DOT 2025, a zaakceptowana wcześniej partia 2026 żyje pod kodem zastępczym. */
    const karty = (druga: Wiersz = {}) => ({
      karta: { dot: "2025", ean: "9990000000210" },
      druga: { kod: AUTO, dot: "2026", ean: "9990000001903", ...druga },
      pary: [
        { kod: KOD, ean: "9990000000210", numer: 21 },
        { kod: AUTO, ean: "9990000001903", numer: 190 },
      ],
      rekord: { dot: "2026", ean: null, eanRaw: null },
    });

    it("wiersz dopasowuje się po kodzie do karty z kodem z pliku — bez pytania i bez nowej karty", () => {
      const staging = importuj(karty());
      expect(staging.filter((w) => w.problem)).toEqual([]);
      expect(staging.some((w) => w.typ === "nowa")).toBe(false);
      expect(dotKarty()).toBe("2026");
    });

    it("prawdziwy EAN w cenniku nie blokuje dopasowania, gdy karta ma wygenerowany 999…", () => {
      const staging = importuj({ ...karty(), rekord: { dot: "2026", ean: "5901234123457" } });
      expect(staging.filter((w) => w.problem)).toEqual([]);
    });
  });

  describe("błędny EAN z pliku, który już rozstrzygnięto (poprawka `ean` z potwierdzonym numerem)", () => {
    const BLEDNY = "5901234123457_D";
    const poprawkaEan = {
      fieldName: "ean",
      overrideValue: "5901234123457",
      acknowledgedSourceValue: BLEDNY,
    };
    const bledy = (st: ReturnType<typeof importuj>) =>
      st.filter((w) => w.typ === "blad" && (w.powod ?? "").includes("Błędny EAN"));

    it("bez rozstrzygnięcia ten sam błędny EAN jest zgłaszany", () => {
      const staging = importuj({ karta: { ean: "5901234123457" }, rekord: { ean: BLEDNY, eanRaw: BLEDNY } });
      expect(bledy(staging)).toHaveLength(1);
    });

    it("po rozstrzygnięciu ten sam numer NIE jest zgłaszany ponownie", () => {
      const staging = importuj({
        karta: { ean: "5901234123457" },
        rekord: { ean: BLEDNY, eanRaw: BLEDNY },
        poprawka: poprawkaEan,
      });
      expect(bledy(staging)).toEqual([]);
    });

    it("dostawca zmienił błędny numer → pytanie wraca", () => {
      const staging = importuj({
        karta: { ean: "5901234123457" },
        rekord: { ean: "5901234123457_X", eanRaw: "5901234123457_X" },
        poprawka: poprawkaEan,
      });
      expect(bledy(staging)).toHaveLength(1);
    });
  });

  describe("czekająca pozycja nie rusza katalogu (decyzja 2026-10-01)", () => {
    it("niejednoznaczne dopasowanie NIE wstrzymuje karty-kandydata i nie zeruje jej stanu", () => {
      // Ta sama opona pod INNYM kodem i BEZ własnego symbolu dostawcy → „podobna opona” (pytanie), kandydatem jest karta KOD.
      // (Z innym symbolem dostawcy to osobna karta — patrz „inny symbol dostawcy = osobna pozycja”.)
      const staging = importuj({
        karta: { stan: 7, status: "aktywny" },
        rekord: { kod: "MO5_INNY_KOD", kodDostawcy: "", ean: "5901234123457", eanRaw: "5901234123457" },
        kompletna: true,
      });
      expect(staging.filter((w) => w.problem)).toHaveLength(1);
      expect(karta()).toMatchObject({ status: "aktywny", stan: 7 });
    });
  });

  describe("rozstrzygnięcie człowieka nie gubi stanu", () => {
    it("karta wstrzymana ręcznie (bez znacznika) po „połącz” dostaje stan i status z oferty", () => {
      importuj({
        karta: { stan: 0, status: "wstrzymany" },
        rekord: { kod: "MO5_INNY_KOD", kodDostawcy: "", ean: "5901234123457", eanRaw: "5901234123457", stan: 4 },
        kompletna: true,
      });
      const id = baza!.db.select().from(stagingItems).all()[0]!.id;
      rozstrzygnijIZatwierdz(baza!.db, id, "link", KOD, {}, 1);
      expect(karta()).toMatchObject({ status: "aktywny", stan: 4 });
    });
  });

  describe("samo „DOT” w nazwie dostawcy (BKT/MO9)", () => {
    const BKT = {
      karta: { nazwa: "18.00x25 BKT XL GRIP 40PR TL", model: "XL GRIP", dot: "2025" },
      rekord: {
        nazwa: "18.00x25 BKT XL GRIP DOT 40PR TL",
        model: "XL GRIP DOT",
        bieznik: "XL GRIP DOT",
        dot: "2025",
      },
    };

    it("model i bieżnik bez „DOT”, nazwa karty zostaje — pozycja nie wraca do akceptacji", () => {
      const staging = importuj(BKT);
      expect(staging.filter((w) => w.typ === "zmiana_kluczowa")).toEqual([]);
      expect(karta().nazwa).toBe("18.00x25 BKT XL GRIP 40PR TL");
    });

    it("prawdziwa zmiana nazwy (nie tylko „DOT”) nadal idzie do akceptacji", () => {
      const staging = importuj({
        ...BKT,
        rekord: { ...BKT.rekord, nazwa: "18.00x25 BKT XL GRIP DOT 44PR TL" },
      });
      expect(staging.filter((w) => w.typ === "zmiana_kluczowa")).toHaveLength(1);
    });
  });
});
