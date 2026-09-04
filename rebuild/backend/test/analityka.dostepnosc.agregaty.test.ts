/**
 * Semantyka agregatów bloku 10e — to, czego fixtures NIE dowodzą.
 *
 * `analityka.dostepnosc.gate.test.ts` porównuje kształt z sześcioma nagraniami produkcji,
 * ale CZTERY z nich są puste (`availability/products.rows`, `availability/sell-through.rows`,
 * `rotation/inactive.rows`, całe `importy-timeline`), a `gate/ksztalt.ts:50` nie zagląda do
 * elementów pustej tablicy. Dla tych czterech tras GATE dowodzi wyłącznie koperty. Kształt
 * wiersza, progi, limity, sortowania i obie gałęzie `hasHistory` mają dowód TYLKO tutaj.
 *
 * Źródło prawdy dla każdej asercji: `mirror/backend/analytics_module.cjs:156-184`,
 * `:279-289`, `:299-303`, `:334`.
 *
 * ⚠ DWIE TRASY TEGO BLOKU SĄ W PRODUKCJI TRWALE PUSTE i ten plik to CHARAKTERYZUJE,
 * a nie naprawia — `historia_cen` nie ma kolumny `nazwa`, o którą pytają. Pełne uzasadnienie
 * z dowodem z nagrań: nagłówek `bezpiecznieWiersze` w `repos/analityka.ts`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { auditLog, historiaCen, products } from "../src/db/schema.js";
import {
  cyklZyciaModeli,
  dostepnoscProduktow,
  osCzasuImportow,
  rotacjaNieaktywnych,
  sezonowoscMiesieczna,
  tempoSchodzenia,
  zacisnijDniRotacji,
} from "../src/repos/analityka.js";
import { PRODUKTY_TESTOWE, stworzTestowaBaze, type NowyProdukt, type TestowaBaza } from "./gate/index.js";

/** Produkt testowy z kompletem kolumn `NOT NULL`; nadpisujemy tylko to, co bada przypadek. */
function produkt(nadpisania: Partial<NowyProdukt>): NowyProdukt {
  const bazowy = PRODUKTY_TESTOWE[0];
  if (!bazowy) throw new Error("PRODUKTY_TESTOWE jest puste — seed katalogu zniknął");
  return { ...bazowy, ...nadpisania, id: undefined };
}

/** Migawka `historia_cen`. Kolumny `nazwa` NIE MA — i to jest sedno dwóch testów niżej. */
type NowaMigawka = {
  kod: string;
  dostawca: string;
  marka?: string | null;
  model?: string | null;
  ean?: string | null;
  cenaZakupu?: number | null;
  stan?: number | null;
  zarejestrowanoAt: string;
};

describe("agregaty analityki (blok 10e)", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => baza.posprzataj());

  const zasiejMigawki = (migawki: NowaMigawka[]) =>
    db.insert(historiaCen).values(migawki).run();

  describe("dostepnoscProduktow (`analytics_module.cjs:156-171`)", () => {
    it("bez historii liczy z katalogu: 100/0 procent, `miesiaceBrakow` puste, sort po stanie", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", nazwa: "Pełny", stan: 7 }),
          produkt({ kod: "A2", nazwa: "Pusty", stan: 0 }),
          produkt({ kod: "W1", nazwa: "Wycofany", stan: 1, status: "wycofany" }),
        ])
        .run();

      const wynik = dostepnoscProduktow(db);

      expect(wynik.hasHistory).toBe(false);
      // Kolumny gałęzi zapasowej (`:168`) — `stan` zamiast `snapshoty`, `miesiaceBrakow` NULL.
      expect(wynik.rows).toEqual([
        {
          kod: "A2",
          ean: "8903094073627",
          dostawca: "MO9",
          nazwa: "Pusty",
          stan: 0,
          dostepnoscPct: 0,
          miesiaceBrakow: null,
        },
        {
          kod: "A1",
          ean: "8903094073627",
          dostawca: "MO9",
          nazwa: "Pełny",
          stan: 7,
          dostepnoscPct: 100,
          miesiaceBrakow: null,
        },
      ]);
    });

    it("CHARAKTERYZACJA: z historią zwraca pustą listę, bo `historia_cen` nie ma kolumny `nazwa`", () => {
      zasiejMigawki([
        { kod: "A1", dostawca: "MO1", stan: 0, zarejestrowanoAt: "2026-07-01T10:00:00.000Z" },
        { kod: "A1", dostawca: "MO1", stan: 5, zarejestrowanoAt: "2026-08-01T10:00:00.000Z" },
      ]);

      const wynik = dostepnoscProduktow(db);

      // Historia JEST — a wierszy nie ma. Zapytanie gałęzi historycznej (`:161`) pyta
      // o `MAX(nazwa)`, SQLite odpowiada `no such column: nazwa`, port `safeAll` połyka błąd.
      // Dokładnie to samo widać w nagraniu produkcji: `GET_analytics_status.json` ma 15 597
      // migawek, a `GET_analytics_availability_products.json` — `hasHistory: true, rows: []`.
      expect(wynik).toEqual({ hasHistory: true, rows: [] });
    });
  });

  describe("tempoSchodzenia (`analytics_module.cjs:173-184`)", () => {
    it("bez historii zwraca pustą listę — oryginał NIE MA tu gałęzi zapasowej", () => {
      db.insert(products).values([produkt({ kod: "A1", stan: 3 })]).run();

      expect(tempoSchodzenia(db)).toEqual({ hasHistory: false, rows: [] });
    });

    it("CHARAKTERYZACJA: z historią też pusto — ten sam brak kolumny `nazwa` w CTE `seq`", () => {
      zasiejMigawki([
        { kod: "A1", dostawca: "MO1", stan: 10, zarejestrowanoAt: "2026-07-01T10:00:00.000Z" },
        { kod: "A1", dostawca: "MO1", stan: 4, zarejestrowanoAt: "2026-08-01T10:00:00.000Z" },
      ]);

      // ⚠ SKUTEK UBOCZNY, KTÓRY WARTO ZNAĆ: pułapka `GROUP BY dostawca, kod, zarejestrowano_at`
      // obok gołego `stan` i `LAG(...) OVER (...)` (decyzja D1 planu) jest w produkcji
      // NIEOSIĄGALNA — zapytanie wywraca się wcześniej, na `MAX(nazwa)`. Charakteryzujemy więc
      // realny efekt: sześć spadków stanu do policzenia, zero zwróconych wierszy.
      expect(tempoSchodzenia(db)).toEqual({ hasHistory: true, rows: [] });
    });
  });

  describe("sezonowoscMiesieczna (`analytics_module.cjs:279-283`)", () => {
    it("grupuje po SAMYM NUMERZE miesiąca — sierpień 2025 i 2026 to jedna grupa", () => {
      zasiejMigawki([
        { kod: "A1", dostawca: "MO1", marka: "BKT", cenaZakupu: 100, stan: 5, zarejestrowanoAt: "2025-08-01T10:00:00.000Z" },
        { kod: "A1", dostawca: "MO1", marka: "BKT", cenaZakupu: 200, stan: 0, zarejestrowanoAt: "2026-08-01T10:00:00.000Z" },
      ]);

      const wynik = sezonowoscMiesieczna(db);

      // `substr(zarejestrowano_at, 6, 2)` wycina „08" z obu znaczników — rok znika, i o to chodzi
      // we „wzorcu sezonowym". `dostepnoscPct` to średnia z 100/0, czyli 50.
      expect(wynik).toEqual({
        hasHistory: true,
        rows: [{ miesiac: "08", marka: "BKT", sredniaCena: 150, dostepnoscPct: 50 }],
      });
    });

    it("pomija migawki bez ceny (`WHERE cena_zakupu > 0`) i sortuje po marce, potem miesiącu", () => {
      zasiejMigawki([
        { kod: "A1", dostawca: "MO1", marka: "CULTOR", cenaZakupu: 300, stan: 1, zarejestrowanoAt: "2026-07-01T10:00:00.000Z" },
        { kod: "A2", dostawca: "MO1", marka: "BKT", cenaZakupu: 100, stan: 1, zarejestrowanoAt: "2026-08-01T10:00:00.000Z" },
        { kod: "A3", dostawca: "MO1", marka: "BKT", cenaZakupu: 500, stan: 1, zarejestrowanoAt: "2026-06-01T10:00:00.000Z" },
        // Cena zerowa i brak ceny — obie odpadają, żeby nie zaniżać średniej.
        { kod: "A4", dostawca: "MO1", marka: "BKT", cenaZakupu: 0, stan: 1, zarejestrowanoAt: "2026-08-02T10:00:00.000Z" },
        { kod: "A5", dostawca: "MO1", marka: "BKT", cenaZakupu: null, stan: 1, zarejestrowanoAt: "2026-08-03T10:00:00.000Z" },
      ]);

      expect(sezonowoscMiesieczna(db).rows).toEqual([
        { miesiac: "06", marka: "BKT", sredniaCena: 500, dostepnoscPct: 100 },
        { miesiac: "08", marka: "BKT", sredniaCena: 100, dostepnoscPct: 100 },
        { miesiac: "07", marka: "CULTOR", sredniaCena: 300, dostepnoscPct: 100 },
      ]);
    });

    it("zaokrągla średnią cenę do dwóch miejsc (`ROUND(AVG(cena_zakupu), 2)`)", () => {
      zasiejMigawki([
        { kod: "A1", dostawca: "MO1", marka: "BKT", cenaZakupu: 100, stan: 1, zarejestrowanoAt: "2026-08-01T10:00:00.000Z" },
        { kod: "A2", dostawca: "MO1", marka: "BKT", cenaZakupu: 100.01, stan: 1, zarejestrowanoAt: "2026-08-02T10:00:00.000Z" },
        { kod: "A3", dostawca: "MO1", marka: "BKT", cenaZakupu: 101, stan: 1, zarejestrowanoAt: "2026-08-03T10:00:00.000Z" },
      ]);

      expect(sezonowoscMiesieczna(db).rows[0]?.sredniaCena).toBe(100.34);
    });

    it("bez historii nie sięga do katalogu — zwraca pustą listę", () => {
      db.insert(products).values([produkt({ kod: "A1" })]).run();

      expect(sezonowoscMiesieczna(db)).toEqual({ hasHistory: false, rows: [] });
    });
  });

  describe("cyklZyciaModeli (`analytics_module.cjs:285-289`)", () => {
    it("z historią: `COUNT(DISTINCT kod)`, sort po ostatnim wystąpieniu malejąco", () => {
      zasiejMigawki([
        // Dwie migawki tego samego kodu — `DISTINCT` nie może policzyć go dwa razy.
        { kod: "A1", dostawca: "MO1", marka: "BKT", model: "AS 504", zarejestrowanoAt: "2026-06-01T10:00:00.000Z" },
        { kod: "A1", dostawca: "MO1", marka: "BKT", model: "AS 504", zarejestrowanoAt: "2026-07-01T10:00:00.000Z" },
        { kod: "A2", dostawca: "MO1", marka: "BKT", model: "AS 504", zarejestrowanoAt: "2026-07-01T10:00:00.000Z" },
        { kod: "B1", dostawca: "MO2", marka: "CULTOR", model: "AGRI 10", zarejestrowanoAt: "2026-08-01T10:00:00.000Z" },
        // Model pusty i model NULL — oba odpadają na `WHERE model IS NOT NULL AND model != ''`.
        { kod: "C1", dostawca: "MO2", marka: "GTK", model: "", zarejestrowanoAt: "2026-08-02T10:00:00.000Z" },
        { kod: "C2", dostawca: "MO2", marka: "GTK", model: null, zarejestrowanoAt: "2026-08-03T10:00:00.000Z" },
      ]);

      expect(cyklZyciaModeli(db)).toEqual({
        hasHistory: true,
        rows: [
          {
            marka: "CULTOR",
            model: "AGRI 10",
            pierwszyRaz: "2026-08-01T10:00:00.000Z",
            ostatniRaz: "2026-08-01T10:00:00.000Z",
            produkty: 1,
          },
          {
            marka: "BKT",
            model: "AS 504",
            pierwszyRaz: "2026-06-01T10:00:00.000Z",
            ostatniRaz: "2026-07-01T10:00:00.000Z",
            produkty: 2,
          },
        ],
      });
    });

    it("bez historii: liczy z katalogu, `COUNT(*)`, sort po liczbie produktów — I BEZ FILTRA STATUSU", () => {
      db.insert(products)
        .values([
          produkt({ kod: "A1", marka: "BKT", model: "AS 504", dataAktualizacji: "2026-06-01T10:00:00.000Z" }),
          produkt({ kod: "A2", marka: "BKT", model: "AS 504", dataAktualizacji: "2026-07-01T10:00:00.000Z" }),
          // Wycofany WCHODZI do wyniku — gałąź zapasowa oryginału (`:288`) nie filtruje statusu.
          produkt({ kod: "A3", marka: "BKT", model: "AS 504", status: "wycofany", dataAktualizacji: "2026-08-01T10:00:00.000Z" }),
          produkt({ kod: "B1", marka: "CULTOR", model: "AGRI 10", dataAktualizacji: "2026-09-01T10:00:00.000Z" }),
        ])
        .run();

      expect(cyklZyciaModeli(db)).toEqual({
        hasHistory: false,
        rows: [
          {
            marka: "BKT",
            model: "AS 504",
            pierwszyRaz: "2026-06-01T10:00:00.000Z",
            ostatniRaz: "2026-08-01T10:00:00.000Z",
            produkty: 3,
          },
          {
            marka: "CULTOR",
            model: "AGRI 10",
            pierwszyRaz: "2026-09-01T10:00:00.000Z",
            ostatniRaz: "2026-09-01T10:00:00.000Z",
            produkty: 1,
          },
        ],
      });
    });
  });

  describe("zacisnijDniRotacji (`analytics_module.cjs:300`)", () => {
    it("brak parametru i pusty napis dają 60 — alternatywa `||` łapie oba", () => {
      expect(zacisnijDniRotacji(undefined)).toBe(60);
      expect(zacisnijDniRotacji("")).toBe(60);
    });

    it("zaciska do widełek [1, 730]", () => {
      expect(zacisnijDniRotacji("0")).toBe(1);
      expect(zacisnijDniRotacji("-5")).toBe(1);
      expect(zacisnijDniRotacji("7")).toBe(7);
      expect(zacisnijDniRotacji("730")).toBe(730);
      expect(zacisnijDniRotacji("9999")).toBe(730);
    });

    it("czyta liczbę z przedrostka napisu, tak jak `parseInt` (`\"30dni\"` → 30)", () => {
      expect(zacisnijDniRotacji("30dni")).toBe(30);
    });

    it("CHARAKTERYZACJA: napis nieliczbowy daje `NaN`, które przechodzi oba zaciski", () => {
      // Pole „Bez ruchu dni" jest w oryginale zwykłym inputem tekstowym, więc to jest
      // osiągalne z UI. `Math.max(1, NaN)` i `Math.min(730, NaN)` zwracają `NaN`.
      expect(Number.isNaN(zacisnijDniRotacji("abc"))).toBe(true);
    });
  });

  describe("rotacjaNieaktywnych (`analytics_module.cjs:299-303`)", () => {
    const dzisiaj = new Date();
    const przedDniami = (dni: number) =>
      new Date(dzisiaj.getTime() - dni * 24 * 60 * 60 * 1000).toISOString();

    it("zwraca aktywne produkty starsze niż próg, najstarsze na górze", () => {
      db.insert(products)
        .values([
          produkt({ kod: "STARY", nazwa: "Stary", dataAktualizacji: przedDniami(400) }),
          produkt({ kod: "SREDNI", nazwa: "Średni", dataAktualizacji: przedDniami(90) }),
          produkt({ kod: "SWIEZY", nazwa: "Świeży", dataAktualizacji: przedDniami(3) }),
          produkt({ kod: "WYCOFANY", nazwa: "Wycofany", status: "wycofany", dataAktualizacji: przedDniami(400) }),
        ])
        .run();

      const wynik = rotacjaNieaktywnych(db, 60);

      expect(wynik.days).toBe(60);
      expect(wynik.rows.map((w) => w.kod)).toEqual(["STARY", "SREDNI"]);
      // Osiem kolumn 1:1 z `:301` — żaden fixture ich nie pokazuje, bo `rows` jest w nim puste.
      expect(Object.keys(wynik.rows[0] ?? {})).toEqual([
        "kod",
        "nazwa",
        "dostawca",
        "marka",
        "model",
        "rozmiar",
        "stan",
        "ostatniaAktualizacja",
      ]);
    });

    it("próg realnie działa — 365 dni odsiewa produkt sprzed 90 dni", () => {
      db.insert(products)
        .values([
          produkt({ kod: "STARY", dataAktualizacji: przedDniami(400) }),
          produkt({ kod: "SREDNI", dataAktualizacji: przedDniami(90) }),
        ])
        .run();

      expect(rotacjaNieaktywnych(db, 365).rows.map((w) => w.kod)).toEqual(["STARY"]);
    });

    it("CHARAKTERYZACJA: `NaN` dni daje pustą listę i `days: null` po serializacji", () => {
      db.insert(products).values([produkt({ kod: "STARY", dataAktualizacji: przedDniami(400) })]).run();

      const wynik = rotacjaNieaktywnych(db, zacisnijDniRotacji("abc"));

      // better-sqlite3 wiąże `NaN` jako `NULL`, więc `data_aktualizacji < NULL` jest NULL-em,
      // czyli fałszem. Zostałyby tylko produkty z `data_aktualizacji IS NULL`, a ta kolumna
      // jest `NOT NULL` w schemacie (`001_schema.sql:42`) — więc wynik jest pusty zawsze.
      expect(wynik.rows).toEqual([]);
      expect(JSON.parse(JSON.stringify(wynik))).toEqual({ days: null, rows: [] });
    });
  });

  describe("osCzasuImportow (`analytics_module.cjs:334`)", () => {
    it("bierze wyłącznie akcje importu, najnowsze na górze, z aliasami kolumn", () => {
      db.insert(auditLog)
        .values([
          {
            uzytkownikImie: "Anna",
            akcja: "import_z_url",
            encjaTyp: "dostawca",
            encjaId: "MO1",
            szczegolyJson: '{"pozycji":120}',
            kiedy: "2026-08-01T10:00:00.000Z",
          },
          {
            uzytkownikImie: "Anna",
            akcja: "import_pliku",
            encjaTyp: "dostawca",
            encjaId: "MO2",
            szczegolyJson: null,
            kiedy: "2026-08-02T10:00:00.000Z",
          },
          // Import cennika ze stagingu NIE należy do tej osi — ani tu, ani w oryginale.
          { uzytkownikImie: "Anna", akcja: "import_cennika", encjaId: "MO3", kiedy: "2026-08-03T10:00:00.000Z" },
          { uzytkownikImie: "Anna", akcja: "zatwierdzenie", encjaId: "MO4", kiedy: "2026-08-04T10:00:00.000Z" },
        ])
        .run();

      const wynik = osCzasuImportow(db);

      // Goła tablica, bez koperty — trzecia z trzech takich tras analityki.
      expect(Array.isArray(wynik)).toBe(true);
      expect(wynik).toEqual([
        {
          id: 2,
          kiedy: "2026-08-02T10:00:00.000Z",
          uzytkownik: "Anna",
          dostawca: "MO2",
          szczegolyJson: null,
        },
        {
          id: 1,
          kiedy: "2026-08-01T10:00:00.000Z",
          uzytkownik: "Anna",
          dostawca: "MO1",
          szczegolyJson: '{"pozycji":120}',
        },
      ]);
    });

    it("oddaje `szczegoly_json` surowo, bez parsowania — także gdy JSON jest zepsuty", () => {
      db.insert(auditLog)
        .values([
          { akcja: "import_pliku", encjaId: "MO1", szczegolyJson: "{niepoprawny", kiedy: "2026-08-01T10:00:00.000Z" },
        ])
        .run();

      expect(osCzasuImportow(db)[0]?.szczegolyJson).toBe("{niepoprawny");
    });

    it("na pustym dzienniku zwraca pustą tablicę — tak jak nagranie produkcji", () => {
      expect(osCzasuImportow(db)).toEqual([]);
    });
  });
});
