/**
 * Semantyka agregatów EAN (blok 10c) — to, czego fixtures NIE dowodzą.
 *
 * `analityka.ean.gate.test.ts` porównuje KSZTAŁT z sześcioma nagraniami produkcji. Nagrania
 * milczą jednak dokładnie tam, gdzie logika jest najciekawsza:
 *
 *  • `GET_analytics_ean_details.json` nagrał gałąź BEZ `?ean` (`{ean: null, offers: []}`).
 *    Gałąź z podanym EAN-em oddaje CZTERY klucze (`ean`, `offers`, `mediana`, `srednia`)
 *    i dokłada każdej ofercie `pozycjaCenowa` — nic z tego nie ma pokrycia w fixture.
 *    Do kompletu: `offers` jest tam pustą tablicą, a `gate/ksztalt.ts:50` nie zagląda
 *    do elementów pustej tablicy, więc kształt oferty nie byłby dowiedziony NICZYM.
 *  • `GET_analytics_ean-porownanie.json` nagrał gałąź BEZ `?ean` (agregat). Gałąź z EAN-em
 *    oddaje gołą tablicę ofert o innym kształcie.
 *  • `minDiffPct` nie jest w żadnym fixture — oryginalny frontend nigdy go nie podaje.
 *  • Różnica w `WHERE` między `ean/comparison` (`cena_zakupu > 0`) a `ean-porownanie`
 *    (bez tego warunku) jest niewidoczna w nagraniach, bo produkcja nie miała w chwili
 *    nagrywania pozycji z zerową ceną zakupu u dwóch dostawców.
 *
 * Źródło prawdy dla każdej asercji: `mirror/backend/analytics_module.cjs:188-235`, `:335-338`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { products } from "../src/db/schema.js";
import {
  pokrycieEan,
  porownanieEan,
  porownanieEanLegacy,
  rankingDostawcowEan,
  szczegolyEan,
  unikalneEan,
  type OfertaEan,
  type WierszPorownaniaEanLegacy,
} from "../src/repos/analityka.js";
import {
  PRODUKTY_TESTOWE,
  stworzTestowaBaze,
  type NowyProdukt,
  type TestowaBaza,
} from "./gate/index.js";

/** Produkt zbudowany z pierwszej pozycji seedu — komplet kolumn `NOT NULL`, reszta nadpisana. */
function produkt(nadpisania: Partial<NowyProdukt>): NowyProdukt {
  const bazowy = PRODUKTY_TESTOWE[0];
  if (!bazowy) throw new Error("PRODUKTY_TESTOWE jest puste — seed katalogu zniknął");
  return { ...bazowy, ...nadpisania, id: undefined };
}

const EAN_A = "5901234123457";
const EAN_B = "4006381333931";

describe("agregaty EAN (blok 10c)", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => baza.posprzataj());

  const wstaw = (dane: Partial<NowyProdukt>[]) =>
    db.insert(products).values(dane.map(produkt)).run();

  describe("ean/comparison (`:188-200`)", () => {
    it("bierze tylko EAN-y u co najmniej dwóch dostawców i liczy spread w złotówkach i procentach", () => {
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 100 },
        { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 250 },
        // Jeden dostawca — do porównania nie wchodzi, mimo poprawnego EAN-u.
        { kod: "B1", dostawca: "MO1", ean: EAN_B, cenaZakupu: 300 },
      ]);

      const { rows } = porownanieEan(db);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        ean: EAN_A,
        dostawcy: 2,
        cenaMin: 100,
        cenaMax: 250,
        srednia: 175,
        oferty: 2,
        spreadZl: 150,
        spreadPct: 150,
      });
    });

    it("sortuje po BEZWZGLĘDNEJ różnicy cen, nie po procentowej", () => {
      wstaw([
        // Spread 50 zł, ale aż 500% — mimo to niżej niż pozycja o spreadzie 900 zł / 90%.
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 10 },
        { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 60 },
        { kod: "B1", dostawca: "MO1", ean: EAN_B, cenaZakupu: 1000 },
        { kod: "B2", dostawca: "MO5", ean: EAN_B, cenaZakupu: 1900 },
      ]);

      const { rows } = porownanieEan(db);

      expect(rows.map((r) => r.ean)).toEqual([EAN_B, EAN_A]);
      expect(rows[0]?.spreadPct).toBe(90);
      expect(rows[1]?.spreadPct).toBe(500);
    });

    it("pomija pozycje z zerową ceną zakupu (`cena_zakupu > 0` w WHERE)", () => {
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 0 },
        { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 250 },
      ]);

      // Po odrzuceniu oferty za 0 zł zostaje jeden dostawca, więc `HAVING >= 2` nie przechodzi.
      expect(porownanieEan(db).rows).toEqual([]);
    });

    it("pomija produkty nieaktywne i puste EAN-y", () => {
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 100 },
        { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 250, status: "wycofany" },
        { kod: "C1", dostawca: "MO1", ean: "", cenaZakupu: 100 },
        { kod: "C2", dostawca: "MO5", ean: "", cenaZakupu: 250 },
        { kod: "D1", dostawca: "MO1", ean: null, cenaZakupu: 100 },
        { kod: "D2", dostawca: "MO5", ean: null, cenaZakupu: 250 },
      ]);

      expect(porownanieEan(db).rows).toEqual([]);
    });

    describe("parametr `minDiffPct` (`num(req.query.minDiffPct, 0)`)", () => {
      beforeEach(() => {
        wstaw([
          { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 100 },
          { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 250 }, // spread 150%
          { kod: "B1", dostawca: "MO1", ean: EAN_B, cenaZakupu: 1000 },
          { kod: "B2", dostawca: "MO5", ean: EAN_B, cenaZakupu: 1100 }, // spread 10%
        ]);
      });

      it("odcina wiersze o spreadzie procentowym poniżej progu", () => {
        expect(porownanieEan(db, "100").rows.map((r) => r.ean)).toEqual([EAN_A]);
      });

      it("przepuszcza wiersz dokładnie na progu (porównanie `>=`)", () => {
        expect(porownanieEan(db, "150").rows.map((r) => r.ean)).toEqual([EAN_A]);
      });

      it.each([
        ["brak parametru", undefined],
        ["zero", "0"],
        ["wartość nieliczbowa", "abc"],
        ["pusty napis", ""],
      ])("nie filtruje przy progu falsy — %s", (_opis, wartosc) => {
        // `!minDiff` w oryginale: `num()` zwraca 0 dla wartości nieskończonej, a `0` jest falsy.
        expect(porownanieEan(db, wartosc).rows).toHaveLength(2);
      });

      it("filtr NIE przestawia kolejności — porządek zostaje po `spreadZl` z SQL, mimo że próg dotyczy procentów", () => {
        // `spreadZl`/`spreadPct` liczą się w JS, dopiero po `ORDER BY (MAX - MIN) DESC LIMIT
        // 1000` w SQL, a `.filter()` zachowuje porządek wejściowy. Skutek: wiersz o WYŻSZYM
        // spreadzie procentowym (EAN_B, 10% → nie, EAN_A 150%) nie awansuje ponad wiersz
        // o wyższym spreadzie złotówkowym tylko dlatego, że przeszedł próg.
        const wynik = porownanieEan(db, "10");

        expect(wynik.rows.map((r) => r.spreadZl)).toEqual([150, 100]);
        expect(wynik.rows.map((r) => r.ean)).toEqual([EAN_A, EAN_B]);
      });
    });
  });

  describe("ean/details (`:202-208`) — gałąź NIENAGRANA w fixture", () => {
    beforeEach(() => {
      wstaw([
        { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 250, cenaSprzedazy: 300, marzaPct: 20, stan: 7 },
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 100, cenaSprzedazy: 130, marzaPct: 30, stan: 3 },
        { kod: "A3", dostawca: "MO7", ean: EAN_A, cenaZakupu: 160, cenaSprzedazy: 200, marzaPct: 25, stan: 1 },
      ]);
    });

    it("bez `ean` zwraca DOKŁADNIE dwa klucze — bez `mediana` i `srednia`", () => {
      // To jest gałąź nagrana w `GET_analytics_ean_details.json`.
      expect(szczegolyEan(db, undefined)).toEqual({ ean: null, offers: [] });
      expect(szczegolyEan(db, "")).toEqual({ ean: null, offers: [] });
    });

    it("z `ean` zwraca CZTERY klucze, oferty rosnąco po cenie zakupu i pełny kształt wiersza", () => {
      const wynik = szczegolyEan(db, EAN_A);

      expect(Object.keys(wynik)).toEqual(["ean", "offers", "mediana", "srednia"]);
      expect(wynik).toMatchObject({ ean: EAN_A, mediana: 160, srednia: 170 });

      const oferty = (wynik as { offers: (OfertaEan & { pozycjaCenowa: number })[] }).offers;
      expect(oferty.map((o) => o.cenaZakupu)).toEqual([100, 160, 250]);
      expect(oferty.map((o) => o.pozycjaCenowa)).toEqual([1, 2, 3]);
      expect(Object.keys(oferty[0]!)).toEqual([
        "dostawca",
        "kod",
        "nazwa",
        "cenaZakupu",
        "cenaSprzedazy",
        "stan",
        "marzaPct",
        "pozycjaCenowa",
      ]);
    });

    it("przy parzystej liczbie ofert mediana jest średnią dwóch środkowych — wartością, której nie ma żadna oferta", () => {
      wstaw([{ kod: "A4", dostawca: "MO9", ean: EAN_A, cenaZakupu: 200 }]);

      // Ceny 100, 160, 200, 250 → (160 + 200) / 2 = 180.
      expect(szczegolyEan(db, EAN_A)).toMatchObject({ mediana: 180 });
    });

    it("`srednia` jest zaokrąglona do dwóch miejsc, `mediana` NIE jest zaokrąglana", () => {
      // Trzy ceny sumujące się do wartości niepodzielnej: 100 + 160 + 250 = 510 / 3 = 170.
      // Dokładamy czwartą, żeby średnia wyszła okresowa: 510 + 1 = 511 / 4 = 127.75.
      wstaw([{ kod: "A5", dostawca: "MO9", ean: EAN_A, cenaZakupu: 1 }]);

      expect(szczegolyEan(db, EAN_A)).toMatchObject({ srednia: 127.75, mediana: 130 });
    });

    it("nieznany EAN zwraca cztery klucze z pustą listą i nullami, a nie gałąź `ean: null`", () => {
      expect(szczegolyEan(db, "0000000000000")).toEqual({
        ean: "0000000000000",
        offers: [],
        mediana: null,
        srednia: null,
      });
    });
  });

  describe("ean/unique (`:210-217`)", () => {
    it("bierze EAN-y u dokładnie jednego dostawcy i sortuje po nazwie", () => {
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, nazwa: "Zeta", cenaZakupu: 100, stan: 3 },
        { kod: "B1", dostawca: "MO5", ean: EAN_B, nazwa: "Alfa", cenaZakupu: 300, stan: 5 },
        { kod: "B2", dostawca: "MO7", ean: EAN_B, nazwa: "Alfa", cenaZakupu: 310, stan: 5 },
      ]);

      const { rows } = unikalneEan(db);

      expect(rows).toEqual([
        { ean: EAN_A, nazwa: "Zeta", dostawca: "MO1", cenaZakupu: 100, stan: 3 },
      ]);
    });

    it("NIE wymaga ceny większej od zera — inaczej niż `ean/comparison`", () => {
      wstaw([{ kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 0 }]);

      expect(unikalneEan(db).rows.map((r) => r.ean)).toEqual([EAN_A]);
    });

    it("przy kilku kodach jednego dostawcy pod tym samym EAN-em bierze `MAX` ceny i stanu", () => {
      // `MAX(...)` w tym SQL to sposób na wyciągnięcie kolumn spoza `GROUP BY`, nie agregat
      // merytoryczny — dokumentujemy skutek, bo z nazwy kolumn wcale go nie widać.
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 100, stan: 3 },
        { kod: "A2", dostawca: "MO1", ean: EAN_A, cenaZakupu: 180, stan: 9 },
      ]);

      expect(unikalneEan(db).rows[0]).toMatchObject({ cenaZakupu: 180, stan: 9 });
    });
  });

  describe("ean/coverage (`:219-222`)", () => {
    it("zwraca histogram: ilu dostawców ma dany EAN → ile takich EAN-ów, rosnąco", () => {
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A },
        { kod: "A2", dostawca: "MO5", ean: EAN_A },
        { kod: "A3", dostawca: "MO7", ean: EAN_A },
        { kod: "B1", dostawca: "MO1", ean: EAN_B },
        { kod: "C1", dostawca: "MO1", ean: "1111111111111" },
      ]);

      expect(pokrycieEan(db).rows).toEqual([
        { liczbaDostawcow: 1, liczbaEAN: 2 },
        { liczbaDostawcow: 3, liczbaEAN: 1 },
      ]);
    });
  });

  describe("ean/supplier-rank (`:224-235`)", () => {
    it("liczy, jak często dostawca jest najtańszy, i sortuje malejąco po procencie", () => {
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 100 },
        { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 250 },
        { kod: "B1", dostawca: "MO1", ean: EAN_B, cenaZakupu: 300 },
        { kod: "B2", dostawca: "MO5", ean: EAN_B, cenaZakupu: 280 },
        { kod: "C1", dostawca: "MO1", ean: "1111111111111", cenaZakupu: 50 },
      ]);

      // MO1: 3 oferty w rankingu, najtańszy w dwóch (EAN_A i EAN unikalny) → 66.67%.
      // MO5: 2 oferty, najtańszy w jednej (EAN_B) → 50%.
      expect(rankingDostawcowEan(db).rows).toEqual([
        { dostawca: "MO1", wspolnePozycje: 3, najtanszy: 2, najtanszyPct: 66.67 },
        { dostawca: "MO5", wspolnePozycje: 2, najtanszy: 1, najtanszyPct: 50 },
      ]);
    });

    it("`wspolnePozycje` liczy WSZYSTKIE oferty dostawcy, także EAN-y unikalne — stąd 100% u dostawcy bez konkurencji", () => {
      // Nazwa kolumny myli: CTE `ranked` nie wymaga, żeby EAN był u dwóch dostawców.
      // Fixture produkcji potwierdza ten efekt (`MO9`: 846/846 = 100%).
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 100 },
        { kod: "B1", dostawca: "MO1", ean: EAN_B, cenaZakupu: 300 },
      ]);

      expect(rankingDostawcowEan(db).rows).toEqual([
        { dostawca: "MO1", wspolnePozycje: 2, najtanszy: 2, najtanszyPct: 100 },
      ]);
    });

    it("przy remisie cenowym `RANK()` daje pozycję 1 KAŻDEMU z remisujących", () => {
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 100 },
        { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 100 },
      ]);

      // Suma `najtanszy` po dostawcach (2) przekracza liczbę EAN-ów (1) — zachowanie oryginału.
      // Kolejność między remisującymi jest nieokreślona (`ORDER BY najtanszyPct DESC` ich nie
      // rozstrzyga), więc porównujemy po posortowaniu — inaczej test zależałby od SQLite.
      const posortowane = [...rankingDostawcowEan(db).rows].sort((a, b) =>
        a.dostawca.localeCompare(b.dostawca),
      );
      expect(posortowane).toEqual([
        { dostawca: "MO1", wspolnePozycje: 1, najtanszy: 1, najtanszyPct: 100 },
        { dostawca: "MO5", wspolnePozycje: 1, najtanszy: 1, najtanszyPct: 100 },
      ]);
    });
  });

  describe("ean-porownanie (`:335-338`) — osobna trasa, nie alias `ean/comparison`", () => {
    it("bez `ean` zwraca GOŁĄ TABLICĘ z pięcioma kolumnami — bez koperty i bez pól spreadu", () => {
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, nazwa: "Alfa", cenaZakupu: 100 },
        { kod: "A2", dostawca: "MO5", ean: EAN_A, nazwa: "Alfa", cenaZakupu: 250 },
      ]);

      const wynik = porownanieEanLegacy(db, undefined) as WierszPorownaniaEanLegacy[];

      expect(Array.isArray(wynik)).toBe(true);
      expect(wynik).toEqual([
        { ean: EAN_A, nazwa: "Alfa", dostawcy: 2, cenaMin: 100, cenaMax: 250 },
      ]);
    });

    it("NIE filtruje po `cena_zakupu > 0` — to główna różnica wobec `ean/comparison`", () => {
      wstaw([
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 0 },
        { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 250 },
      ]);

      // Ta sama baza, dwie trasy, dwa różne wyniki — dowód, że to NIE jest alias.
      expect(porownanieEan(db).rows).toEqual([]);
      expect(porownanieEanLegacy(db, undefined)).toEqual([
        expect.objectContaining({ ean: EAN_A, dostawcy: 2, cenaMin: 0, cenaMax: 250 }),
      ]);
    });

    it("z `ean` zwraca gołą tablicę ofert BEZ `pozycjaCenowa` — inaczej niż `ean/details`", () => {
      wstaw([
        { kod: "A2", dostawca: "MO5", ean: EAN_A, cenaZakupu: 250 },
        { kod: "A1", dostawca: "MO1", ean: EAN_A, cenaZakupu: 100 },
      ]);

      const wynik = porownanieEanLegacy(db, EAN_A) as OfertaEan[];

      expect(wynik.map((o) => o.cenaZakupu)).toEqual([100, 250]);
      expect(Object.keys(wynik[0]!)).toEqual([
        "dostawca",
        "kod",
        "nazwa",
        "cenaZakupu",
        "cenaSprzedazy",
        "stan",
        "marzaPct",
      ]);
    });
  });
});
