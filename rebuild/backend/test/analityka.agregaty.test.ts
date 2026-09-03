/**
 * Semantyka agregatów analityki (blok 10a) — to, czego fixtures NIE dowodzą.
 *
 * `analityka.gate.test.ts` porównuje KSZTAŁT z czterema nagraniami produkcji. Nagrania są
 * jednak zubożone w dokładnie tych miejscach, gdzie logika jest najciekawsza:
 *
 *  • `GET_analytics_margins.json` ma `low` i `high` PUSTE — cała produkcja mieściła się
 *    w marży (5, 80), więc progi 5/80 i kształt tych wierszy nie mają w fixture pokrycia;
 *  • wszystkie wiersze fixture'ów mają `avgMarza: 6`, więc sortowanie `avgMarza ASC`
 *    nie jest w nich widoczne;
 *  • `POST /api/analytics/bootstrap-current` nie ma fixture'a w ogóle
 *    (`contract/README.md:38`), a jest jedyną trasą 10a, która PISZE do bazy.
 *
 * Ten plik jest więc świadectwem semantyki: progów, sortowań, limitów, tego które produkty
 * wchodzą do których liczników — i nieidempotentności bootstrapu, którą CHARAKTERYZUJEMY,
 * a nie naprawiamy (odbudowa odtwarza zastane zachowanie).
 *
 * Źródło prawdy dla każdej asercji: `mirror/backend/analytics_module.cjs`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { historiaCen, products, stagingItems } from "../src/db/schema.js";
import {
  kpi,
  listyFiltrow,
  marze,
  statusHistorii,
  zbudujSnapshotBiezacy,
} from "../src/repos/analityka.js";
import {
  PRODUKTY_TESTOWE,
  stworzTestowaBaze,
  type NowyProdukt,
  type TestowaBaza,
} from "./gate/index.js";

/**
 * Produkt testowy budowany z pierwszej pozycji seedu katalogu — bierzemy z niej komplet
 * kolumn `NOT NULL`, a nadpisujemy tylko to, co bada dany przypadek.
 */
function produkt(nadpisania: Partial<NowyProdukt>): NowyProdukt {
  const bazowy = PRODUKTY_TESTOWE[0];
  if (!bazowy) throw new Error("PRODUKTY_TESTOWE jest puste — seed katalogu zniknął");
  // `id` zerowane, żeby SQLite nadał własne — inaczej drugi produkt zderzyłby się z pierwszym.
  return { ...bazowy, ...nadpisania, id: undefined };
}

describe("agregaty analityki (blok 10a)", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => baza.posprzataj());

  describe("kpi (`analytics_module.cjs:325-331`)", () => {
    it("liczy wyłącznie produkty aktywne — w każdej z trzech liczb katalogowych", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", dostawca: "MO1", marzaPct: 10, status: "aktywny" }),
          produkt({ kod: "A2", dostawca: "MO2", marzaPct: 20, status: "aktywny" }),
          // Wycofany: nie może podnieść ani licznika produktów, ani liczby dostawców,
          // ani wciągnąć swojej marży do średniej.
          produkt({ kod: "W1", dostawca: "MO9", marzaPct: 999, status: "wycofany" }),
        ])
        .run();

      expect(kpi(db)).toEqual({
        produkty: 2,
        dostawcy: 2,
        avgMarza: 15,
        stagingPending: 0,
      });
    });

    it("zaokrągla średnią marżę do dwóch miejsc (`ROUND(AVG(marza_pct), 2)`)", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", marzaPct: 10 }),
          produkt({ kod: "A2", marzaPct: 10 }),
          produkt({ kod: "A3", marzaPct: 11 }),
        ])
        .run();

      // 31/3 = 10.3333… → 10.33
      expect(kpi(db).avgMarza).toBe(10.33);
    });

    it("na pustym katalogu daje zera i `avgMarza: null` — `AVG` nie ma z czego liczyć", () => {
      expect(kpi(db)).toEqual({
        produkty: 0,
        dostawcy: 0,
        avgMarza: null,
        stagingPending: 0,
      });
    });

    it("`stagingPending` liczy pozycje po `zatwierdzono_data IS NULL`, niezależnie od typu zmiany", () => {
      const pozycja = (kod: string, typZmiany: string, zatwierdzonoData: string | null) => ({
        typZmiany,
        kod,
        nazwa: `Pozycja ${kod}`,
        dostawca: "MO1",
        magazyn: "MAG1",
        utworzono: "2026-08-01T10:00:00.000Z",
        zatwierdzonoData,
      });

      db.insert(stagingItems)
        .values([
          pozycja("S1", "zmiana_ceny", null),
          pozycja("S2", "nowy_produkt", null),
          pozycja("S3", "zmiana_ceny", "2026-08-01T12:00:00.000Z"),
        ])
        .run();

      // Oryginał patrzy WYŁĄCZNIE na znacznik zatwierdzenia (`:330`) — nie rozróżnia typów
      // zmiany ani nie zagląda nigdzie indziej. Pozycja zatwierdzona wypada z licznika.
      expect(kpi(db).stagingPending).toBe(2);
    });
  });

  describe("marze (`analytics_module.cjs:292-297`)", () => {
    it("grupuje po dostawca/kategoria/marka i sortuje rosnąco po średniej marży", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", dostawca: "MO1", kategoria: "Rolnicze", marka: "BKT", marzaPct: 30 }),
          produkt({ kod: "A2", dostawca: "MO1", kategoria: "Rolnicze", marka: "BKT", marzaPct: 40 }),
          produkt({ kod: "B1", dostawca: "MO2", kategoria: "Leśne", marka: "CEAT", marzaPct: 10 }),
        ])
        .run();

      const { rows } = marze(db);

      // Najgorsza marża na górze — ten porządek dziedziczy wykres w widoku.
      expect(rows).toEqual([
        {
          dostawca: "MO2",
          kategoria: "Leśne",
          marka: "CEAT",
          produkty: 1,
          avgMarza: 10,
          minMarza: 10,
          maxMarza: 10,
        },
        {
          dostawca: "MO1",
          kategoria: "Rolnicze",
          marka: "BKT",
          produkty: 2,
          avgMarza: 35,
          minMarza: 30,
          maxMarza: 40,
        },
      ]);
    });

    it("pomija produkty nieaktywne w grupowaniu", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", dostawca: "MO1", marzaPct: 30, status: "aktywny" }),
          produkt({ kod: "W1", dostawca: "MO1", marzaPct: 1, status: "wstrzymany" }),
        ])
        .run();

      const { rows } = marze(db);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.produkty).toBe(1);
      expect(rows[0]?.avgMarza).toBe(30);
    });

    it("`low` bierze marże OSTRO poniżej 5 i sortuje rosnąco; próg 5 nie wchodzi", () => {
      db.insert(products)
        .values([
          produkt({ kod: "L1", marzaPct: 4.9 }),
          produkt({ kod: "L2", marzaPct: 1 }),
          produkt({ kod: "R1", marzaPct: 5 }),
          produkt({ kod: "R2", marzaPct: 50 }),
        ])
        .run();

      const { low } = marze(db);
      expect(low.map((p) => p.kod)).toEqual(["L2", "L1"]);
    });

    it("`high` bierze marże OSTRO powyżej 80 i sortuje malejąco; próg 80 nie wchodzi", () => {
      db.insert(products)
        .values([
          produkt({ kod: "H1", marzaPct: 81 }),
          produkt({ kod: "H2", marzaPct: 120 }),
          produkt({ kod: "R1", marzaPct: 80 }),
        ])
        .run();

      const { high } = marze(db);
      expect(high.map((p) => p.kod)).toEqual(["H2", "H1"]);
    });

    it("wiersze `low`/`high` mają kształt, którego pusty fixture nie dowodzi", () => {
      db.insert(products)
        .values([
          produkt({
            kod: "L1",
            nazwa: "Opona testowa",
            dostawca: "MO1",
            cenaZakupu: 100,
            cenaSprzedazy: 102,
            marzaPct: 2,
          }),
        ])
        .run();

      // Sześć pól z aliasami camelCase — `contract/README.md:32` („API zwraca camelCase,
      // mimo że baza jest snake_case"). To jedyne miejsce, gdzie ten kształt jest sprawdzany.
      expect(marze(db).low).toEqual([
        {
          kod: "L1",
          nazwa: "Opona testowa",
          dostawca: "MO1",
          cenaZakupu: 100,
          cenaSprzedazy: 102,
          marzaPct: 2,
        },
      ]);
    });
  });

  describe("listyFiltrow (`analytics_module.cjs:98-107`)", () => {
    it("NIE filtruje po statusie — inaczej niż KPI i marże", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", marka: "BKT", status: "aktywny" }),
          produkt({ kod: "W1", marka: "WYCOFANA", status: "wycofany" }),
        ])
        .run();

      // Świadome odtworzenie asymetrii oryginału: kontrolka filtra pokazuje też wartości
      // produktów wycofanych, bo `filters` jako jedyna z pięciu tras 10a nie ma `WHERE status`.
      expect(listyFiltrow(db).marki.map((m) => m.value)).toEqual(["BKT", "WYCOFANA"]);
    });

    it("pomija wartości puste i NULL oraz zwraca każdą wartość raz", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", model: "AGRIMAX" }),
          produkt({ kod: "A2", model: "AGRIMAX" }),
          produkt({ kod: "A3", model: "" }),
          produkt({ kod: "A4", model: null }),
        ])
        .run();

      expect(listyFiltrow(db).modele).toEqual([{ value: "AGRIMAX" }]);
    });

    it("zwraca komplet sześciu list i nic poza nimi", () => {
      expect(Object.keys(listyFiltrow(db))).toEqual([
        "dostawcy",
        "marki",
        "modele",
        "rozmiary",
        "indeksyNosnosci",
        "indeksyPredkosci",
      ]);
    });
  });

  describe("statusHistorii (`analytics_module.cjs:93-96`)", () => {
    it("na pustej tabeli daje `hasHistory: false` i nulle zamiast zakresu dat", () => {
      expect(statusHistorii(db)).toEqual({
        hasHistory: false,
        snapshots: 0,
        od: null,
        do: null,
      });
    });

    it("podaje liczbę migawek i skrajne znaczniki czasu", () => {
      db.insert(historiaCen)
        .values([
          { kod: "A1", dostawca: "MO1", zarejestrowanoAt: "2026-08-02T10:00:00.000Z" },
          { kod: "A1", dostawca: "MO1", zarejestrowanoAt: "2026-08-01T10:00:00.000Z" },
          { kod: "A2", dostawca: "MO1", zarejestrowanoAt: "2026-08-03T10:00:00.000Z" },
        ])
        .run();

      expect(statusHistorii(db)).toEqual({
        hasHistory: true,
        snapshots: 3,
        od: "2026-08-01T10:00:00.000Z",
        do: "2026-08-03T10:00:00.000Z",
      });
    });
  });

  describe("zbudujSnapshotBiezacy (`analytics_module.cjs:81-91`)", () => {
    beforeEach(() => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", dostawca: "MO1", cenaZakupu: 100, status: "aktywny" }),
          produkt({ kod: "A2", dostawca: "MO2", cenaZakupu: 200, status: "aktywny" }),
          produkt({ kod: "W1", dostawca: "MO9", cenaZakupu: 300, status: "wycofany" }),
        ])
        .run();
    });

    it("kopiuje wyłącznie produkty aktywne i zwraca ich liczbę", () => {
      const wynik = zbudujSnapshotBiezacy(db);

      expect(wynik.ok).toBe(true);
      expect(wynik.inserted).toBe(2);

      const kody = db.select({ kod: historiaCen.kod }).from(historiaCen).all();
      expect(kody.map((w) => w.kod).sort()).toEqual(["A1", "A2"]);
    });

    it("znakuje całą partię jednym `toISOString()` — nie `datetime('now')` ze schematu", () => {
      const wynik = zbudujSnapshotBiezacy(db);

      // Format z `T` i `Z` jest tym, co pokazuje `GET_analytics_status.json`
      // (`od: "2026-06-30T09:11:42.589Z"`); domyślka schematu dałaby „YYYY-MM-DD HH:MM:SS".
      expect(wynik.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const znaczniki = db
        .select({ at: historiaCen.zarejestrowanoAt })
        .from(historiaCen)
        .all()
        .map((w) => w.at);
      expect(new Set(znaczniki)).toEqual(new Set([wynik.at]));
    });

    it("CHARAKTERYZACJA: nie jest idempotentna — drugie wywołanie dokłada drugi komplet", () => {
      zbudujSnapshotBiezacy(db);
      const drugi = zbudujSnapshotBiezacy(db);

      expect(drugi.inserted).toBe(2);
      expect(statusHistorii(db).snapshots).toBe(4);

      // To NIE jest bug do naprawienia w tym tickecie, tylko udokumentowane zachowanie
      // produkcji: `INSERT … SELECT` bez `ON CONFLICT` (`:83-88`). Powód, dla którego trasa
      // świadomie nie dostaje przycisku w UI (decyzja D4, plan.md).
    });
  });
});
