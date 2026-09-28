/**
 * Semantyka agregatów dostawców (blok 10d) — to, czego fixtures NIE dowodzą.
 *
 * `analityka.dostawcy.gate.test.ts` porównuje KSZTAŁT z czterema nagraniami produkcji.
 * Nagrania milczą jednak dokładnie tam, gdzie logika jest najciekawsza:
 *
 *  • `GET_analytics_suppliers_stability.json` ma `hasHistory: true`, więc GAŁĄŹ ZAPASOWA
 *    (pusta `historia_cen`) — o INNYM zestawie kolumn — nie ma w fixture żadnego świadka;
 *  • wszystkie wiersze nagrań są posortowane, ale przy jednorodnych wartościach nie widać
 *    z nich, PO CZYM sortuje backend (`stability` po `sredniaZmianaPct DESC`,
 *    `stock` dwustopniowo po `dostepnoscPct DESC, produkty DESC`);
 *  • próg „to już jest zmiana ceny" (`> 0.01`) i granica `stan > 0` są w SQL, nie w nagraniu;
 *  • `lifecycle` czyta STAGING, nie katalog — nagranie nie pokazuje, że filtr `typ_zmiany`
 *    odsiewa `zmiana_kluczowa` i `blad`.
 *
 * Ten plik jest świadectwem semantyki: progów, sortowań, limitów i tego, które wiersze wchodzą
 * do których liczników. Źródło prawdy dla każdej asercji: `mirror/backend/analytics_module.cjs`
 * (`:110-154`, `:332`).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { historiaCen, products, stagingItems } from "../src/db/schema.js";
import {
  cyklZyciaDostawcow,
  stabilnoscDostawcow,
  stanDostawcow,
  statystykiDostawcow,
  type WierszStabilnosciBezHistorii,
  type WierszStabilnosciZHistoria,
} from "../src/repos/analityka.js";
import {
  PRODUKTY_TESTOWE,
  stworzTestowaBaze,
  type NowyProdukt,
  type TestowaBaza,
} from "./gate/index.js";

/** Produkt testowy z kompletem kolumn `NOT NULL` — nadpisujemy tylko to, co bada przypadek. */
function produkt(nadpisania: Partial<NowyProdukt>): NowyProdukt {
  const bazowy = PRODUKTY_TESTOWE[0];
  if (!bazowy) throw new Error("PRODUKTY_TESTOWE jest puste — seed katalogu zniknął");
  return { ...bazowy, ...nadpisania, id: undefined };
}

/** Pozycja stagingu z kompletem kolumn `NOT NULL`. */
function pozycjaStagingu(nadpisania: Partial<typeof stagingItems.$inferInsert> = {}) {
  return {
    typZmiany: "nowa",
    kod: "MO1_X",
    nazwa: "Opona testowa",
    dostawca: "MO1",
    magazyn: "GL",
    utworzono: "2026-08-13T12:00:00.000Z",
    ...nadpisania,
  };
}

/** Punkt historii ceny — `zarejestrowano_at` decyduje o kolejności w oknie `LAG`. */
function punktHistorii(kod: string, dostawca: string, cenaZakupu: number | null, kiedy: string) {
  return { kod, dostawca, cenaZakupu, cenaSprzedazy: null, stan: null, zarejestrowanoAt: kiedy };
}

describe("agregaty dostawców (blok 10d)", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => baza.posprzataj());

  describe("stabilnoscDostawcow (`analytics_module.cjs:110-131`)", () => {
    /**
     * ⚠ TO JEST TEST, KTÓREGO GATE NIE ZASTĄPI. Fixture nagrano na produkcji z historią cen,
     * więc gałąź zapasowa nie ma tam ŻADNEGO pokrycia — a zwraca inny zestaw kolumn niż ta
     * z fixture'a. Gdyby ten przypadek zniknął, rozjazd w gałęzi zapasowej przeszedłby cicho.
     */
    it("bez historii cen liczy z katalogu i zwraca INNY zestaw kolumn niż gałąź z historią", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", dostawca: "MO1", cenaZakupu: 100, stan: 4, status: "aktywny" }),
          produkt({ kod: "A2", dostawca: "MO1", cenaZakupu: 200, stan: 6, status: "aktywny" }),
          produkt({ kod: "B1", dostawca: "MO2", cenaZakupu: 50, stan: 1, status: "aktywny" }),
          // Wycofany nie wchodzi do żadnej średniej — gałąź zapasowa filtruje `status='aktywny'`.
          produkt({ kod: "W1", dostawca: "MO1", cenaZakupu: 9999, stan: 999, status: "wycofany" }),
        ])
        .run();

      const wynik = stabilnoscDostawcow(db);

      expect(wynik.hasHistory).toBe(false);
      // `produkty DESC` — MO1 (2 pozycje) przed MO2 (1 pozycja).
      expect(wynik.rows.map((w) => w.dostawca)).toEqual(["MO1", "MO2"]);

      const mo1 = wynik.rows[0] as WierszStabilnosciBezHistorii;
      expect(mo1).toEqual({
        dostawca: "MO1",
        produkty: 2,
        sredniaCena: 150,
        sredniStan: 5,
        liczbaZmian: null,
        sredniaZmianaPct: null,
        maxZmianaPct: null,
      });
      // Klucza `punkty` w tej gałęzi NIE MA — to nie to samo co `punkty: null`.
      expect("punkty" in mo1).toBe(false);
    });

    it("z historią liczy punkty i zmiany oknem LAG, per para (dostawca, kod)", () => {
      db.insert(historiaCen)
        .values([
          // MO1 / K1: 100 → 110 (zmiana 10%), potem 110 → 110 (bez zmiany).
          punktHistorii("K1", "MO1", 100, "2026-08-01T10:00:00.000Z"),
          punktHistorii("K1", "MO1", 110, "2026-08-02T10:00:00.000Z"),
          punktHistorii("K1", "MO1", 110, "2026-08-03T10:00:00.000Z"),
          // MO2 / K2: 200 → 202 (zmiana 1%). Mniejsza średnia niż MO1 → niżej w sortowaniu.
          punktHistorii("K2", "MO2", 200, "2026-08-01T10:00:00.000Z"),
          punktHistorii("K2", "MO2", 202, "2026-08-02T10:00:00.000Z"),
        ])
        .run();

      const wynik = stabilnoscDostawcow(db);

      expect(wynik.hasHistory).toBe(true);
      // `sredniaZmianaPct DESC` — najbardziej rozchwiany cennik na górze.
      expect(wynik.rows.map((w) => w.dostawca)).toEqual(["MO1", "MO2"]);

      const mo1 = wynik.rows[0] as WierszStabilnosciZHistoria;
      expect(mo1).toEqual({
        dostawca: "MO1",
        // `punkty` to WSZYSTKIE wiersze historii dostawcy, także pierwszy (bez poprzednika).
        punkty: 3,
        liczbaZmian: 1,
        // Średnia po parach z poprzednikiem: (10% + 0%) / 2 = 5%.
        sredniaZmianaPct: 5,
        maxZmianaPct: 10,
      });
      expect("produkty" in mo1).toBe(false);
    });

    /**
     * ⚠ CHARAKTERYZACJA, NIE ŻYCZENIE. Próg `ABS(cena - prev) > 0.01` porównuje LICZBY
     * ZMIENNOPRZECINKOWE, więc różnica „dokładnie jeden grosz" wypada po jego niewłaściwej
     * stronie: `100.01 - 100` to w podwójnej precyzji 0.010000000000005…, czyli WIĘCEJ niż
     * 0.01, i taka para liczy się jako zmiana. Tak działa produkcja i tak zostaje — próg
     * odsiewa szum zaokrągleń poniżej grosza, a nie równo grosz.
     */
    it("odsiewa różnice poniżej grosza, ale różnicę równą groszowi liczy (arytmetyka float)", () => {
      db.insert(historiaCen)
        .values([
          // Pół grosza — bezspornie poniżej progu.
          punktHistorii("K1", "MO1", 100, "2026-08-01T10:00:00.000Z"),
          punktHistorii("K1", "MO1", 100.005, "2026-08-02T10:00:00.000Z"),
          // Równo grosz — po stronie „zmiana", z powodu reprezentacji binarnej.
          punktHistorii("K2", "MO2", 100, "2026-08-01T10:00:00.000Z"),
          punktHistorii("K2", "MO2", 100.01, "2026-08-02T10:00:00.000Z"),
        ])
        .run();

      const wg = new Map(
        stabilnoscDostawcow(db).rows.map((w) => [w.dostawca, w as WierszStabilnosciZHistoria]),
      );

      expect(wg.get("MO1")?.liczbaZmian).toBe(0);
      expect(wg.get("MO2")?.liczbaZmian).toBe(1);
    });

    it("pomija punkty bez ceny zakupu, ale sama ich obecność włącza gałąź z historią", () => {
      db.insert(historiaCen)
        .values([
          punktHistorii("K1", "MO1", null, "2026-08-01T10:00:00.000Z"),
          punktHistorii("K1", "MO1", 100, "2026-08-02T10:00:00.000Z"),
        ])
        .run();

      const wynik = stabilnoscDostawcow(db);

      // `hasHistory` patrzy na `COUNT(*)` całej tabeli, a CTE odsiewa `cena_zakupu IS NULL`
      // — dlatego zostaje jeden punkt i ani jednej pary do porównania.
      expect(wynik.hasHistory).toBe(true);
      expect(wynik.rows[0]).toEqual({
        dostawca: "MO1",
        punkty: 1,
        liczbaZmian: 0,
        // Brak pary z dodatnią ceną poprzednią → `AVG`/`MAX` nie mają z czego liczyć.
        sredniaZmianaPct: null,
        maxZmianaPct: null,
      });
    });
  });

  describe("cyklZyciaDostawcow (`analytics_module.cjs:133-141`)", () => {
    it("bierze wyłącznie `nowa` i `wycofana`, najświeższe pierwsze", () => {
      db.insert(stagingItems)
        .values([
          pozycjaStagingu({ kod: "S1", typZmiany: "nowa", utworzono: "2026-08-01T10:00:00.000Z" }),
          pozycjaStagingu({
            kod: "S2",
            typZmiany: "wycofana",
            utworzono: "2026-08-03T10:00:00.000Z",
            powod: "Brak w cenniku — pozycja wycofana",
          }),
          // Dwa typy, których karta „1.2" nie pokazuje — odsiewa je sam filtr `typ_zmiany`.
          pozycjaStagingu({
            kod: "S3",
            typZmiany: "zmiana_kluczowa",
            utworzono: "2026-08-05T10:00:00.000Z",
          }),
          pozycjaStagingu({ kod: "S4", typZmiany: "blad", utworzono: "2026-08-06T10:00:00.000Z" }),
        ])
        .run();

      const wynik = cyklZyciaDostawcow(db);

      expect(wynik.rows.map((w) => w.kod)).toEqual(["S2", "S1"]);
      expect(wynik.rows[0]).toEqual({
        dostawca: "MO1",
        typ: "wycofana",
        kod: "S2",
        nazwa: "Opona testowa",
        kiedy: "2026-08-03T10:00:00.000Z",
        powod: "Brak w cenniku — pozycja wycofana",
      });
    });

    it("nie filtruje po zatwierdzeniu — dziennik pokazuje też pozycje jeszcze nierozstrzygnięte", () => {
      db.insert(stagingItems)
        .values([
          pozycjaStagingu({ kod: "S1", zatwierdzonoData: null }),
          pozycjaStagingu({ kod: "S2", zatwierdzonoData: "2026-08-14T09:00:00.000Z" }),
        ])
        .run();

      expect(cyklZyciaDostawcow(db).rows).toHaveLength(2);
    });
  });

  describe("stanDostawcow (`analytics_module.cjs:143-154`)", () => {
    it("liczy dostępność jako odsetek pozycji ze stanem dodatnim i sortuje dwustopniowo", () => {
      db.insert(products)
        .values([
          // MO1: 2 z 4 dostępne → 50%.
          produkt({ kod: "A1", dostawca: "MO1", stan: 5, status: "aktywny" }),
          produkt({ kod: "A2", dostawca: "MO1", stan: 3, status: "aktywny" }),
          produkt({ kod: "A3", dostawca: "MO1", stan: 0, status: "aktywny" }),
          produkt({ kod: "A4", dostawca: "MO1", stan: 0, status: "aktywny" }),
          // MO2: 2 z 2 → 100%, katalog dwuelementowy.
          produkt({ kod: "B1", dostawca: "MO2", stan: 1, status: "aktywny" }),
          produkt({ kod: "B2", dostawca: "MO2", stan: 1, status: "aktywny" }),
          // MO3: 1 z 1 → 100%, katalog jednoelementowy → przy remisie NIŻEJ niż MO2.
          produkt({ kod: "C1", dostawca: "MO3", stan: 7, status: "aktywny" }),
          // Wycofany nie liczy się nigdzie.
          produkt({ kod: "W1", dostawca: "MO1", stan: 100, status: "wycofany" }),
        ])
        .run();

      const wynik = stanDostawcow(db);

      // `dostepnoscPct DESC, produkty DESC` — remis na 100% rozstrzyga większy katalog.
      expect(wynik.rows.map((w) => w.dostawca)).toEqual(["MO2", "MO3", "MO1"]);
      expect(wynik.rows[2]).toEqual({
        dostawca: "MO1",
        produkty: 4,
        sredniStan: 2,
        dostepne: 2,
        dostepnoscPct: 50,
      });
    });

    it("traktuje stan ujemny jak brak — granicą jest `stan > 0`, nie `stan != 0`", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", dostawca: "MO1", stan: -3, status: "aktywny" }),
          produkt({ kod: "A2", dostawca: "MO1", stan: 2, status: "aktywny" }),
        ])
        .run();

      expect(stanDostawcow(db).rows[0]).toMatchObject({ dostepne: 1, dostepnoscPct: 50 });
    });
  });

  describe("statystykiDostawcow (`analytics_module.cjs:332`)", () => {
    it("zwraca GOŁĄ TABLICĘ posortowaną po liczbie produktów malejąco", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", dostawca: "MO1", marzaPct: 10, cenaZakupu: 100, stan: 1 }),
          produkt({ kod: "B1", dostawca: "MO2", marzaPct: 20, cenaZakupu: 300, stan: 0 }),
          produkt({ kod: "B2", dostawca: "MO2", marzaPct: 30, cenaZakupu: 500, stan: 4 }),
        ])
        .run();

      const wynik = statystykiDostawcow(db);

      // Koperty nie ma — to alias zgodności, nie trasa dashboardu.
      expect(Array.isArray(wynik)).toBe(true);
      expect(wynik).toEqual([
        {
          dostawca: "MO2",
          liczbaProduktow: 2,
          avgMarza: 25,
          avgCenaZakupu: 400,
          dostepnych: 1,
        },
        {
          dostawca: "MO1",
          liczbaProduktow: 1,
          avgMarza: 10,
          avgCenaZakupu: 100,
          dostepnych: 1,
        },
      ]);
    });

    it("liczy tylko katalog aktywny — tak samo jak `suppliers/stock`, choć innymi nazwami pól", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", dostawca: "MO1", status: "aktywny" }),
          produkt({ kod: "W1", dostawca: "MO1", status: "wycofany" }),
        ])
        .run();

      expect(statystykiDostawcow(db)[0]?.liczbaProduktow).toBe(1);
    });
  });
});
