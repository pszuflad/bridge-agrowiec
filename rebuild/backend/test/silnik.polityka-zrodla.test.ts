// GATE I15.4b — bezpieczeństwo źródła (#103), auto-wstrzymania (#104), reguła wycofań.
//
// ⭐ CZYM TEN GATE RÓŻNI SIĘ OD CHARAKTERYZACJI. `silnik.charakteryzacja.test.ts` porównuje
// port z NAGRANYM wzorcem na realnych cennikach, ale musi traktować je jako ofertę
// niekompletną — próbka 200 wierszy przy katalogu kilku tysięcy kart nie jest kompletną
// ofertą dostawcy i deklarowanie jej jako takiej kazałoby produkcji wstrzymać cały katalog.
//
// Tutaj jest odwrotnie: katalog jest MAŁY i SPÓJNY z cennikiem, więc oferta może uczciwie
// deklarować kompletność — i dzięki temu wchodzimy w gałęzie, których tamten gate nie rusza:
// progi blokad, natychmiastowe wstrzymanie braku, pewny powrót, ochronę wstrzymań ręcznych
// i regułę „trzy różne kompletne oferty + 24 h".
//
// ⭐ WZORCEM JEST ŻYWY ORYGINAŁ, NIE PLIK. Każdy przypadek uruchamia `staging_policy.install()`
// @ `88fa31c` obok naszego portu, na tym samym wejściu, i porównuje SKUTEK w bazie. Nie ma tu
// nagranych oczekiwań, więc nie da się ich po cichu „poprawić" pod port — jeśli port się
// rozjedzie, rozjedzie się z produkcją. Harness oryginału:
// `test/charakteryzacja/silnik/polityka.mjs`.

import { afterEach, describe, expect, it } from "vitest";

import { silnikStagingu, type OpcjeImportu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { stworzPolitykeOryginalu } from "./charakteryzacja/silnik/polityka.mjs";

type Wiersz = Record<string, unknown>;

/** Triggery z `011` — zdejmowane po OBU stronach, żeby nie różnicowały snapshotów. */
const TRIGGERY = [
  "products_blokowane_formy_ai",
  "products_blokowane_formy_au",
  "products_zastosowanie_ai",
  "products_zastosowanie_au",
  "manual_overrides_kategoria_ai",
  "manual_overrides_kategoria_au",
];

const naSnake = (n: string) => n.replace(/[A-Z]/g, (z) => `_${z.toLowerCase()}`);

const PRODUKT: Wiersz = {
  id: 1,
  kod: "MO1_A",
  nazwa: "Opona Michelin 340/85R28 XM108",
  marka: "Michelin",
  kategoria: "Opony rolnicze",
  dostawca: "MO1",
  magazyn: "PL",
  stan: 5,
  cenaZakupu: 1000,
  cenaSprzedazy: 1300,
  marzaPct: 30,
  vat: 23,
  status: "aktywny",
  dataAktualizacji: "2026-01-01T00:00:00.000Z",
  rozmiar: "340/85R28",
  model: "XM108",
  // ⚠ `konstrukcja` MUSI tu być. `znormalizujPozycje()` wyprowadza ją z rozmiaru („340/85R28"
  // → „R"), więc pozycja z cennika zawsze ją ma. Karta katalogowa bez `konstrukcja` jest dla
  // `compatibility()` NIEZGODNA (pole trafia do `missing`) — i wtedy pewny powrót nigdy nie
  // następuje. Osobny przypadek niżej pilnuje właśnie tej gałęzi.
  konstrukcja: "R",
  ean: null,
  kodDostawcy: "A1",
  nieobecnoscPodRzad: 0,
};

const REKORD: Wiersz = {
  kod: "MO1_A",
  nazwa: "Opona Michelin 340/85R28 XM108",
  marka: "Michelin",
  model: "XM108",
  rozmiar: "340/85R28",
  konstrukcja: "R",
  cenaZakupu: 1100,
  stan: 7,
  kodDostawcy: "A1",
};

/** Pozycja spoza katalogu — pozwala zbudować NIEPUSTY cennik bez interesującego nas produktu. */
const INNY: Wiersz = {
  kod: "MO1_Z",
  nazwa: "Opona Michelin 420/85R30 XM110",
  marka: "Michelin",
  model: "XM110",
  rozmiar: "420/85R30",
  konstrukcja: "R",
  cenaZakupu: 2000,
  stan: 3,
  kodDostawcy: "Z1",
};

const meta = (nadpisz: Partial<Record<string, unknown>> = {}) => ({
  complete: true,
  parserErrors: 0,
  source: "supplier file",
  rawCount: 1,
  excludedCodes: [] as string[],
  ...nadpisz,
});

type Przebieg = { rekordy: Wiersz[]; opcje?: OpcjeImportu };

/** To, co porównujemy: skutek w bazie, nie ślad wywołań. */
type Skutek = {
  wyniki: unknown[];
  produkty: unknown[];
  autoWstrzymania: unknown[];
  dowodyNieobecnosci: unknown[];
  stanOferty: unknown[];
  wersjeOferty: number;
  staging: unknown[];
};

const ZAPYTANIA = {
  produkty:
    "SELECT kod,status,stan,cena_zakupu,nieobecnosc_pod_rzad FROM products ORDER BY kod",
  auto: "SELECT supplier,product_code,reason FROM product_auto_suspensions ORDER BY product_code",
  dowody: "SELECT supplier,product_code FROM product_absence_checks ORDER BY product_code",
  stanOferty: "SELECT supplier,last_item_count,max_item_count FROM supplier_feed_state",
  wersje: "SELECT COUNT(*) AS n FROM supplier_feed_versions",
  staging: "SELECT typ_zmiany,kod,powod FROM staging_items ORDER BY kod,typ_zmiany",
};

function zbierz(czytaj: (sql: string) => unknown[], wyniki: unknown[]): Skutek {
  return {
    wyniki,
    produkty: czytaj(ZAPYTANIA.produkty),
    autoWstrzymania: czytaj(ZAPYTANIA.auto),
    dowodyNieobecnosci: czytaj(ZAPYTANIA.dowody),
    stanOferty: czytaj(ZAPYTANIA.stanOferty),
    wersjeOferty: Number((czytaj(ZAPYTANIA.wersje)[0] as { n: number }).n),
    staging: czytaj(ZAPYTANIA.staging),
  };
}

function uruchomOryginal(produkty: Wiersz[], przebiegi: Przebieg[]): Skutek {
  const h = stworzPolitykeOryginalu({ produkty, overrides: [] });
  for (const t of TRIGGERY) h.db.exec(`DROP TRIGGER IF EXISTS ${t}`);
  const wyniki: unknown[] = [];
  for (const p of przebiegi) {
    const rekordy = [...p.rekordy];
    if (p.opcje?.meta) {
      Object.defineProperty(rekordy, "_bridgeFeedMeta", {
        value: p.opcje.meta,
        configurable: true,
      });
    }
    try {
      wyniki.push({ stats: h.importer("MO1", rekordy, { ...p.opcje, meta: undefined }) });
    } catch (e) {
      wyniki.push({ blad: (e as Error).message });
    }
  }
  const skutek = zbierz((sql) => h.db.prepare(sql).all(), wyniki);
  h.zamknij();
  return skutek;
}

function uruchomPort(produkty: Wiersz[], przebiegi: Przebieg[]): Skutek {
  const baza = stworzTestowaBaze();
  for (const t of TRIGGERY) baza.sqlite.exec(`DROP TRIGGER IF EXISTS ${t}`);
  const kolumny = (
    baza.sqlite.prepare("SELECT name FROM pragma_table_info('products')").all() as {
      name: string;
    }[]
  ).map((r) => r.name);
  for (const p of produkty) {
    const wiersz: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) wiersz[naSnake(k)] = v;
    baza.sqlite
      .prepare(
        `INSERT INTO products (${kolumny.join(",")}) VALUES (${kolumny.map(() => "?").join(",")})`,
      )
      .run(kolumny.map((k) => wiersz[k] ?? null));
  }
  const silnik = silnikStagingu(baza.db);
  const wyniki: unknown[] = [];
  for (const p of przebiegi) {
    try {
      wyniki.push({ stats: silnik("MO1", p.rekordy as unknown as RekordSurowy[], p.opcje) });
    } catch (e) {
      wyniki.push({ blad: (e as Error).message });
    }
  }
  const skutek = zbierz((sql) => baza.sqlite.prepare(sql).all(), wyniki);
  baza.posprzataj();
  return skutek;
}

/**
 * Porównuje port z żywym oryginałem. Komunikat blokady jest porównywany OSOBNO, bo dla
 * pustego cennika mamy świadome odstępstwo (D7/D-130.4): zachowujemy własną treść
 * `PustyImportBlad` zamiast produkcyjnej.
 */
function porownaj(
  produkty: Wiersz[],
  przebiegi: Przebieg[],
  opcje: { rozneKomunikatyPustego?: boolean } = {},
) {
  const oryginal = uruchomOryginal(produkty, przebiegi);
  const port = uruchomPort(produkty, przebiegi);

  if (opcje.rozneKomunikatyPustego) {
    const bezTresci = (s: Skutek) => ({
      ...s,
      wyniki: s.wyniki.map((w) => (w as { blad?: string }).blad ? { blad: "<blokada>" } : w),
    });
    expect(bezTresci(port)).toEqual(bezTresci(oryginal));
  } else {
    expect(port).toEqual(oryginal);
  }
  return { oryginal, port };
}

describe("I15.4b — polityka źródła: port == żywy staging_policy.install() @ 88fa31c", () => {
  let baza: TestowaBaza | null = null;
  afterEach(() => {
    baza?.posprzataj();
    baza = null;
  });

  describe("bezpieczeństwo źródła (#103)", () => {
    it("cennik z błędami odczytu zatrzymuje import bez zmiany katalogu", () => {
      const { port } = porownaj(
        [PRODUKT],
        [{ rekordy: [REKORD], opcje: { meta: meta({ parserErrors: 3 }) } }],
      );
      expect(port.wyniki[0]).toHaveProperty("blad");
      expect(port.produkty[0]).toMatchObject({ status: "aktywny", stan: 5, cena_zakupu: 1000 });
    });

    it("pusty cennik zatrzymuje import (treść komunikatu — odstępstwo D7)", () => {
      const { port, oryginal } = porownaj([PRODUKT], [{ rekordy: [], opcje: { meta: meta() } }], {
        rozneKomunikatyPustego: true,
      });
      expect((oryginal.wyniki[0] as { blad: string }).blad).toContain("Pusty cennik");
      expect((port.wyniki[0] as { blad: string }).blad).toContain("Nie ma ani jednej pozycji");
    });

    it("cennik mniejszy o ponad 20% od historycznego maksimum jest odrzucany", () => {
      const duzy = Array.from({ length: 10 }, (_, i) => ({
        ...INNY,
        kod: `MO1_X${i}`,
        kodDostawcy: `X${i}`,
        nazwa: `Opona Michelin 420/85R30 XM110 nr${i}`,
      }));
      const { port } = porownaj(
        [PRODUKT],
        [
          { rekordy: duzy, opcje: { meta: meta() } },
          { rekordy: [INNY], opcje: { meta: meta() } },
        ],
      );
      expect((port.wyniki[1] as { blad: string }).blad).toContain("podejrzanie mały");
    });

    it("maksimum wielkości oferty NIGDY nie maleje", () => {
      const duzy = Array.from({ length: 10 }, (_, i) => ({
        ...INNY,
        kod: `MO1_X${i}`,
        kodDostawcy: `X${i}`,
        nazwa: `Opona Michelin 420/85R30 XM110 nr${i}`,
      }));
      const { port } = porownaj(
        [PRODUKT],
        [
          { rekordy: duzy, opcje: { meta: meta() } },
          { rekordy: duzy.slice(0, 9), opcje: { meta: meta() } },
        ],
      );
      expect(port.stanOferty[0]).toMatchObject({ max_item_count: 10, last_item_count: 9 });
    });

    it("kody odrzucone przez parser nie są dowodem nieobecności", () => {
      const { port } = porownaj(
        [PRODUKT],
        [{ rekordy: [INNY], opcje: { meta: meta({ excludedCodes: ["MO1_A"] }) } }],
      );
      // Produkt jest „widziany" mimo braku w cenniku — nie wolno go wstrzymać.
      expect(port.produkty.find((p) => (p as Wiersz).kod === "MO1_A")).toMatchObject({
        status: "aktywny",
      });
      expect(port.autoWstrzymania).toEqual([]);
    });
  });

  describe("auto-wstrzymania (#104)", () => {
    it("brak w kompletnej ofercie wstrzymuje natychmiast i zeruje stan", () => {
      const { port } = porownaj([PRODUKT], [{ rekordy: [INNY], opcje: { meta: meta() } }]);
      expect(port.produkty.find((p) => (p as Wiersz).kod === "MO1_A")).toMatchObject({
        status: "wstrzymany",
        stan: 0,
      });
      expect(port.autoWstrzymania).toHaveLength(1);
    });

    it("oferta NIEKOMPLETNA nie wstrzymuje niczego", () => {
      const { port } = porownaj([PRODUKT], [{ rekordy: [INNY], opcje: {} }]);
      expect(port.produkty.find((p) => (p as Wiersz).kod === "MO1_A")).toMatchObject({
        status: "aktywny",
        stan: 5,
      });
      expect(port.autoWstrzymania).toEqual([]);
    });

    it("pewny powrót przywraca produkt wstrzymany AUTOMATYCZNIE", () => {
      const { port } = porownaj(
        [PRODUKT],
        [
          { rekordy: [INNY], opcje: { meta: meta() } },
          { rekordy: [REKORD, INNY], opcje: { meta: meta() } },
        ],
      );
      expect(port.produkty.find((p) => (p as Wiersz).kod === "MO1_A")).toMatchObject({
        status: "aktywny",
      });
      expect(port.autoWstrzymania).toEqual([]);
    });

    it("powrót NIE następuje, gdy cechy karty nie potwierdzają zgodności", () => {
      // Karta bez `konstrukcja`, a cennik ją ma (normalizacja wyprowadza „R" z rozmiaru).
      // `compatibility()` melduje brak → zamiast cichego powrotu powstaje sprawa do sprawdzenia.
      const { port } = porownaj(
        [{ ...PRODUKT, konstrukcja: null }],
        [
          { rekordy: [INNY], opcje: { meta: meta() } },
          { rekordy: [REKORD, INNY], opcje: { meta: meta() } },
        ],
      );
      expect(port.produkty.find((p) => (p as Wiersz).kod === "MO1_A")).toMatchObject({
        status: "wstrzymany",
      });
      expect(
        port.staging.some((w) =>
          String((w as Wiersz).powod).includes("Powrót opony wymaga sprawdzenia"),
        ),
      ).toBe(true);
    });

    it("wstrzymanie RĘCZNE jest chronione — powrót w ofercie go nie zdejmuje", () => {
      const { port } = porownaj(
        [{ ...PRODUKT, status: "wstrzymany", stan: 0 }],
        [{ rekordy: [REKORD], opcje: { meta: meta() } }],
      );
      expect(port.produkty.find((p) => (p as Wiersz).kod === "MO1_A")).toMatchObject({
        status: "wstrzymany",
      });
      // Kluczowe: ręcznie wstrzymany produkt NIE dostaje znacznika automatu, więc nie ma
      // czego „przywrócić" przy następnym imporcie.
      expect(port.autoWstrzymania).toEqual([]);
    });

    it("wstrzymany ręcznie i nieobecny w ofercie nadal nie jest własnością automatu", () => {
      const { port } = porownaj(
        [{ ...PRODUKT, status: "wstrzymany", stan: 0 }],
        [{ rekordy: [INNY], opcje: { meta: meta() } }],
      );
      expect(port.autoWstrzymania).toEqual([]);
    });
  });

  describe("reguła wycofań: trzy różne kompletne oferty + 24 h (#103)", () => {
    /**
     * Każdy przebieg musi mieć INNY odcisk oferty, inaczej `czyZnanaWersjaOferty()` odetnie
     * go jako powtórkę. Zmieniamy stan pozycji, która i tak nie dotyczy badanego produktu.
     */
    const rozneOferty = (ile: number): Przebieg[] =>
      Array.from({ length: ile }, (_, i) => ({
        rekordy: [{ ...INNY, stan: 3 + i }],
        opcje: { meta: meta() } as OpcjeImportu,
      }));

    it("powtórzona oferta nie liczy się jako kolejne potwierdzenie", () => {
      const { port } = porownaj(
        [PRODUKT],
        [
          { rekordy: [INNY], opcje: { meta: meta() } },
          { rekordy: [INNY], opcje: { meta: meta() } },
        ],
      );
      // Ten sam plik dwa razy = JEDNA wersja oferty.
      expect(port.wersjeOferty).toBe(1);
    });

    it("trzy RÓŻNE oferty w tej samej dobie nie wystawiają wycofania", () => {
      const { port } = porownaj([PRODUKT], rozneOferty(3));
      // Zapora czasowa: `last_counted_at` blokuje kolejne liczenie przez 24 h, więc mimo
      // trzech różnych plików dowód jest wciąż jeden i `wycofana` nie powstaje.
      expect(port.staging.some((w) => (w as Wiersz).typ_zmiany === "wycofana")).toBe(false);
      expect(port.wersjeOferty).toBe(1);
    });

    it("dowody nieobecności zapisują się dla produktu spoza oferty", () => {
      const { port } = porownaj([PRODUKT], [{ rekordy: [INNY], opcje: { meta: meta() } }]);
      // Produkt zostaje wstrzymany natychmiast (#104), a ścieżka dowodowa (#103) jest od tego
      // ODDZIELNA: wstrzymanie jest natychmiastowe, „wycofanie" wymaga 3 potwierdzeń.
      expect(port.produkty.find((p) => (p as Wiersz).kod === "MO1_A")).toMatchObject({
        status: "wstrzymany",
      });
      expect(port.dowodyNieobecnosci).toEqual([]);
    });
  });

  describe("dopasowanie: EAN, DOT, warianty", () => {
    const zEanem = (kod: string, ean: string, nadpisz: Wiersz = {}) => ({
      ...PRODUKT,
      kod,
      ean,
      ...nadpisz,
    });

    it("EAN dopasowuje TYLKO gdy jest dokładnie jedna zgodna opona", () => {
      const dwie = [
        { ...zEanem("MO1_A", "5901234123457"), id: 1, kodDostawcy: "A1" },
        { ...zEanem("MO1_B", "5901234123457"), id: 2, kodDostawcy: "B1" },
      ];
      const { port } = porownaj(dwie, [
        {
          rekordy: [{ ...REKORD, kod: "", kodDostawcy: "", ean: "5901234123457" }],
          opcje: { meta: meta() },
        },
      ]);
      expect(port.staging).toHaveLength(1);
      // Dwie zgodne opony z tym samym EAN → sprawa do ręcznego rozstrzygnięcia, nie dopasowanie.
      expect(
        port.staging.some((w) =>
          String((w as Wiersz).powod).includes("Kilka zgodnych produktów z tym EAN"),
        ),
        "dwie zgodne opony z tym samym EAN → decyzja człowieka, nie dopasowanie",
      ).toBe(true);
    });

    it("inny DOT zrywa dopasowanie po kodzie", () => {
      const { port } = porownaj(
        [{ ...PRODUKT, dot: "2023" }],
        [{ rekordy: [{ ...REKORD, dot: "2024" }], opcje: { meta: meta() } }],
      );
      expect(port.staging.length).toBeGreaterThan(0);
    });

    it("wariant DEMO nie miesza się ze zwykłą oponą", () => {
      const { port } = porownaj(
        [PRODUKT],
        [
          {
            rekordy: [{ ...REKORD, kod: "MO1_A_DEMO", kodDostawcy: "A1-DEMO" }],
            opcje: { meta: meta() },
          },
        ],
      );
      expect(port.staging.length).toBeGreaterThan(0);
    });
  });
});
