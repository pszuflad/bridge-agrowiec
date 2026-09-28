/**
 * Sufity tras dashboardu analityki i opcjonalne `?limit=0` (karta P10.5, backlog #96).
 *
 * ⚠ TEN TEST BRONI OBU STRON NARAZ i przed P10.5 nie istniał:
 *
 *  1. **Domyślne zachowanie jest portem oryginału.** Każda z ośmiu tras ma `LIMIT` przepisany
 *     z produkcji. Do tej pory ŻADEN test nie wstawiał więcej wierszy niż sufit, więc liczbowe
 *     wartości `LIMIT_*` nie były niczym bronione — fixtures nagrano na zbiorach, które
 *     w sufit nie uderzają, a gate porównuje KSZTAŁT, nie liczbę wierszy. Zmiana stałej
 *     z 1000 na 900 przechodziła całą bramkę bez mrugnięcia. Tu przechodzić nie będzie.
 *  2. **`?limit=0` zdejmuje sufit** — i tylko `0`. To świadome odstępstwo od produkcji
 *     (decyzja Ani 2026-09-23, „chcę pełne pliki"); w oryginale pełne dane dawał serwerowy
 *     `export/:view`, który jednak nie znał filtrów (backlog #91).
 *
 * ⚠ `0` NIE MOŻE ZNACZYĆ SQL-owego `LIMIT 0` (zero wierszy) — osobny przypadek niżej.
 *
 * Testy jadą na warstwie repo, nie przez HTTP: zapytania SQL są tym, co sufit trzyma,
 * a `czyBezLimitu` (parsowanie `req.query.limit`) ma własny blok. Trasy sklejają te dwie
 * rzeczy i to pokrywa `analityka.*.gate.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { historiaCen, products, stagingItems } from "../src/db/schema.js";
import {
  cyklZyciaDostawcow,
  czyBezLimitu,
  dostepnoscProduktow,
  marze,
  porownanieEan,
  rotacjaNieaktywnych,
  tempoSchodzenia,
  unikalneEan,
  zmianyCenOstatniegoImportu,
} from "../src/repos/analityka.js";
import { PRODUKTY_TESTOWE, stworzTestowaBaze, type NowyProdukt, type TestowaBaza } from "./gate/index.js";

function produkt(nadpisania: Partial<NowyProdukt>): NowyProdukt {
  const bazowy = PRODUKTY_TESTOWE[0];
  if (!bazowy) throw new Error("PRODUKTY_TESTOWE jest puste — seed katalogu zniknął");
  return { ...bazowy, ...nadpisania, id: undefined };
}

/**
 * Wstawianie PARTIAMI. `products` ma ~70 kolumn, więc 1200 wierszy w jednym `INSERT` to
 * ~84 000 zmiennych, a SQLite ma ich twardy limit (`too many SQL variables`). Rozmiar partii
 * dobrany z zapasem — liczy się tylko to, żeby zbiór w bazie przekroczył sufit trasy.
 */
function wstawPartiami<T>(wykonaj: (partia: T[]) => void, wiersze: T[], rozmiar = 100): void {
  for (let i = 0; i < wiersze.length; i += rozmiar) {
    wykonaj(wiersze.slice(i, i + rozmiar));
  }
}

/**
 * `products.data_aktualizacji` jest NOT NULL w schemacie odbudowy, więc „bez ruchu” robimy
 * datą sprzed lat, nie `NULL`-em. Gałąź `data_aktualizacji IS NULL` zapytania rotacji to port
 * oryginału i tego testu nie dotyczy — tu badamy wyłącznie sufit.
 */
const DAWNO_TEMU = "2020-01-01T00:00:00.000Z";

/** EAN o poprawnej długości, unikalny per `i` — treść nieistotna, liczy się rozdzielność. */
const ean = (i: number) => String(5900000000000 + i);

describe("czyBezLimitu — parsowanie `?limit` (P10.5)", () => {
  it("tylko dosłowne „0” zdejmuje limit", () => {
    expect(czyBezLimitu("0")).toBe(true);
  });

  it("liczba 0 też — `String(0) === \"0\"`; z HTTP przyjdzie napis, ale semantyka jest ta sama", () => {
    expect(czyBezLimitu(0)).toBe(true);
  });

  it.each([
    ["brak parametru", undefined],
    ["null", null],
    ["pusty napis", ""],
    ["„1”", "1"],
    ["„500”", "500"],
    ["napis nieliczbowy", "abc"],
    ["„00” — nie jest dosłownym zerem", "00"],
    ["„ 0 ” ze spacjami", " 0 "],
  ])("%s zostawia oryginalny limit trasy", (_opis, wejscie) => {
    expect(czyBezLimitu(wejscie)).toBe(false);
  });

  it("powtórzony parametr (`?limit=0&limit=0`) — express daje tablicę, sufit zostaje", () => {
    // Zachowanie zachowawcze: nie zdejmujemy limitu na podstawie tablicy.
    expect(czyBezLimitu(["0", "0"])).toBe(false);
  });
});

describe("sufity tras dashboardu i `?limit=0` (P10.5, backlog #96)", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => baza.posprzataj());

  /**
   * Każdy przypadek: ile wierszy wstawiamy (ponad sufit), jaki jest sufit i jak wywołać repo.
   * `zasiej` dostaje liczbę wierszy do wytworzenia.
   */
  const PRZYPADKI: {
    nazwa: string;
    sufit: number;
    wierszy: number;
    zasiej: (db: Baza, n: number) => void;
    wywolaj: (db: Baza, bezLimitu: boolean) => { length: number };
  }[] = [
    {
      nazwa: "ean/unique — „2.5 Pozycje unikalne” (LIMIT_UNIKALNYCH_EAN = 1000)",
      sufit: 1000,
      wierszy: 1200,
      zasiej: (db, n) =>
        wstawPartiami(
          (partia) => db.insert(products).values(partia).run(),
          // jeden dostawca na EAN → HAVING COUNT(DISTINCT dostawca) = 1
          Array.from({ length: n }, (_, i) =>
            produkt({ kod: `U${i}`, nazwa: `Pozycja ${String(i).padStart(5, "0")}`, ean: ean(i), dostawca: "Alfa" }),
          ),
        ),
      wywolaj: (db, bez) => unikalneEan(db, bez).rows,
    },
    {
      nazwa: "ean/comparison — „2.1-2.4” (LIMIT_PORWNANIA_EAN = 1000)",
      sufit: 1000,
      wierszy: 1200,
      zasiej: (db, n) =>
        wstawPartiami(
          (partia) => db.insert(products).values(partia).run(),
          // dwóch dostawców na EAN → HAVING COUNT(DISTINCT dostawca) >= 2
          Array.from({ length: n }, (_, i) => [
            produkt({ kod: `CA${i}`, ean: ean(i), dostawca: "Alfa", cenaZakupu: 100 + i }),
            produkt({ kod: `CB${i}`, ean: ean(i), dostawca: "Beta", cenaZakupu: 200 + i }),
          ]).flat(),
        ),
      wywolaj: (db, bez) => porownanieEan(db, undefined, bez).rows,
    },
    {
      nazwa: "margins — grupy marży (LIMIT_GRUP_MARZY = 1000)",
      sufit: 1000,
      wierszy: 1200,
      zasiej: (db, n) =>
        wstawPartiami(
          (partia) => db.insert(products).values(partia).run(),
          // każda pozycja własną grupą dostawca/kategoria/marka
          Array.from({ length: n }, (_, i) =>
            produkt({ kod: `M${i}`, dostawca: `D${i}`, kategoria: `K${i}`, marka: `MA${i}`, marzaPct: i % 90 }),
          ),
        ),
      wywolaj: (db, bez) => marze(db, bez).rows,
    },
    {
      nazwa: "rotation/inactive — Rotacja (LIMIT_ROTACJI = 1000)",
      sufit: 1000,
      wierszy: 1200,
      zasiej: (db, n) =>
        wstawPartiami(
          (partia) => db.insert(products).values(partia).run(),
          // data sprzed lat → „bez ruchu” przy każdym sensownym progu
          Array.from({ length: n }, (_, i) => produkt({ kod: `R${i}`, dataAktualizacji: DAWNO_TEMU })),
        ),
      wywolaj: (db, bez) => rotacjaNieaktywnych(db, 60, bez).rows,
    },
    {
      nazwa: "suppliers/lifecycle — „1.2 Nowości i wycofania” (LIMIT_CYKLU_ZYCIA = 500)",
      sufit: 500,
      wierszy: 700,
      zasiej: (db, n) =>
        wstawPartiami(
          (partia) => db.insert(stagingItems).values(partia).run(),
          Array.from({ length: n }, (_, i) => ({
            typZmiany: i % 2 === 0 ? "nowa" : "wycofana",
            kod: `L${i}`,
            nazwa: `Pozycja ${i}`,
            dostawca: "Alfa",
            magazyn: "MAG",
            utworzono: `2026-08-${String((i % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
          })),
        ),
      wywolaj: (db, bez) => cyklZyciaDostawcow(db, bez).rows,
    },
    {
      nazwa: "prices/last-import — „3.1 Zmiany cen” (LIMIT_OSTATNIEGO_IMPORTU = 500)",
      sufit: 500,
      wierszy: 700,
      zasiej: (db, n) =>
        wstawPartiami(
          (partia) => db.insert(stagingItems).values(partia).run(),
          Array.from({ length: n }, (_, i) => ({
            typZmiany: "zmiana_ceny",
            kod: `P${i}`,
            nazwa: `Pozycja ${i}`,
            dostawca: "Alfa",
            magazyn: "MAG",
            cenaZakupuStara: 100,
            cenaZakupuNowa: 100 + i,
            zmianaPct: i,
            utworzono: "2026-08-13T10:00:00.000Z",
          })),
        ),
      wywolaj: (db, bez) => zmianyCenOstatniegoImportu(db, bez).rows,
    },
    {
      nazwa: "availability/products — „4.1” gałąź BEZ historii (LIMIT_DOSTEPNOSCI = 500)",
      sufit: 500,
      wierszy: 700,
      zasiej: (db, n) =>
        wstawPartiami(
          (partia) => db.insert(products).values(partia).run(),
          Array.from({ length: n }, (_, i) => produkt({ kod: `A${i}`, stan: i })),
        ),
      wywolaj: (db, bez) => dostepnoscProduktow(db, bez).rows,
    },
  ];

  describe.each(PRZYPADKI)("$nazwa", ({ sufit, wierszy, zasiej, wywolaj }) => {
    beforeEach(() => zasiej(db, wierszy));

    it(`bez parametru ucina do ${"sufitu"} — 1:1 z oryginałem`, () => {
      expect(wywolaj(db, false).length).toBe(sufit);
    });

    it("`?limit=0` oddaje WSZYSTKIE wiersze", () => {
      expect(wywolaj(db, true).length).toBe(wierszy);
    });

    it("`?limit=0` nie znaczy SQL-owego `LIMIT 0` — wynik nie jest pusty", () => {
      expect(wywolaj(db, true).length).toBeGreaterThan(0);
    });
  });

  /**
   * „4.1” i „4.2” z historią — osobno, bo obie potrzebują `historia_cen`, a nie katalogu,
   * i to właśnie ta gałąź jest żywa na produkcji (snapshot ma historię).
   */
  describe("gałąź z historią — availability/products i availability/sell-through", () => {
    const PAR = 700;
    const SUFIT = 500;

    beforeEach(() => {
      // jeden produkt katalogu na parę (dostawca, kod) — LEFT JOIN po nazwę
      wstawPartiami(
        (partia) => db.insert(products).values(partia).run(),
        Array.from({ length: PAR }, (_, i) => produkt({ kod: `H${i}`, dostawca: "Alfa" })),
      );
      // dwie migawki na parę → `LAG` ma na czym liczyć spadek dla sell-through
      wstawPartiami(
        (partia) => db.insert(historiaCen).values(partia).run(),
        Array.from({ length: PAR }, (_, i) => [
          { kod: `H${i}`, dostawca: "Alfa", stan: 10, zarejestrowanoAt: "2026-07-01T10:00:00.000Z" },
          { kod: `H${i}`, dostawca: "Alfa", stan: 3, zarejestrowanoAt: "2026-08-01T10:00:00.000Z" },
        ]).flat(),
      );
    });

    it("availability/products: bez parametru 500, z `limit=0` wszystkie 700", () => {
      const domyslnie = dostepnoscProduktow(db, false);
      const pelne = dostepnoscProduktow(db, true);
      expect(domyslnie.hasHistory).toBe(true);
      expect(domyslnie.rows.length).toBe(SUFIT);
      expect(pelne.rows.length).toBe(PAR);
    });

    it("availability/sell-through: bez parametru 500, z `limit=0` wszystkie 700", () => {
      const domyslnie = tempoSchodzenia(db, false);
      const pelne = tempoSchodzenia(db, true);
      expect(domyslnie.hasHistory).toBe(true);
      expect(domyslnie.rows.length).toBe(SUFIT);
      expect(pelne.rows.length).toBe(PAR);
    });
  });

  /**
   * `marze()` ma DWA różne limity. `?limit=0` zdejmuje tylko sufit GRUP (`rows`, tabela karty
   * i plik CSV — decyzja P10.3). Listy skrajne `low`/`high` mają własny `LIMIT_LISTY_MARZY`
   * = 200, nie ma ich w CSV i zostają nietknięte.
   */
  it("margins: `?limit=0` nie rusza `low`/`high` (LIMIT_LISTY_MARZY = 200)", () => {
    wstawPartiami(
      (partia) => db.insert(products).values(partia).run(),
      Array.from({ length: 300 }, (_, i) =>
        produkt({ kod: `S${i}`, dostawca: `D${i}`, kategoria: `K${i}`, marka: `MA${i}`, marzaPct: 1 }),
      ),
    );

    const pelne = marze(db, true);
    expect(pelne.rows.length).toBe(300);
    expect(pelne.low.length).toBe(200);
  });

  /**
   * Rotacja jako jedyna z ósemki łączy DWA parametry: `?days` (własny, port oryginału)
   * i `?limit` (P10.5). Zdjęcie sufitu nie może rozszczelnić filtra po dniach.
   */
  it("rotation/inactive: `?limit=0` zachowuje filtr `?days`", () => {
    wstawPartiami((partia) => db.insert(products).values(partia).run(), [
      ...Array.from({ length: 1200 }, (_, i) => produkt({ kod: `BR${i}`, dataAktualizacji: DAWNO_TEMU })),
      produkt({ kod: "SWIEZY", dataAktualizacji: new Date().toISOString() }),
    ]);

    const pelne = rotacjaNieaktywnych(db, 60, true);
    expect(pelne.days).toBe(60);
    expect(pelne.rows.length).toBe(1200);
    expect(pelne.rows.some((w) => w.kod === "SWIEZY")).toBe(false);
  });
});
