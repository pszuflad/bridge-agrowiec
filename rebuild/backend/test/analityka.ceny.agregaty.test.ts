/**
 * Semantyka agregatów cen (blok 10b) — to, czego fixtures NIE dowodzą.
 *
 * `analityka.ceny.gate.test.ts` porównuje KSZTAŁT z pięcioma nagraniami produkcji i jest to
 * najmocniejsza siatka w całej Iteracji 10 (żadna z pięciu tablic nie jest pusta). Nagranie
 * jest jednak zawsze JEDNYM przebiegiem przez logikę — pokazuje wynik, nie rozgałęzienia.
 * Ten plik pokrywa dokładnie te rozgałęzienia:
 *
 *  • `market/group-prices` — nagrano wyłącznie `group=marka` (jedyny wariant, jaki wysyła
 *    oryginalny frontend). Że `model` i `rozmiar` też działają, a wartość spoza whitelisty
 *    wraca do `marka` — tego nie dowodzi nic poza tym plikiem;
 *  • `prices/product-history` — nagrano BEZ parametrów, czyli z gałęzią `WHERE 1=1`.
 *    Filtry po `ean`, po `kod` i po obu naraz są nieprzetestowane przez fixture, a to
 *    jedyne parametry w całym bloku;
 *  • `stats` — nagranie pokazuje trzy liczby dla jednego zbioru. Zaokrąglenie, pominięcie
 *    `null`-i i trzy `null`-e przy pustym zbiorze widać dopiero tutaj;
 *  • gałąź „brak historii” — na produkcji `historia_cen` była pełna, więc `hasHistory: false`
 *    nie ma pokrycia w ŻADNYM fixture, a jest to stan, w którym staging bywa na co dzień;
 *  • różnica `WHERE` między `last-import` a `top-zmiany` — obie czytają `staging_items`,
 *    ale pierwsza wymaga OBU cen, a druga tylko starej. W nagraniach obie tablice są
 *    niepuste i wyglądają podobnie, więc różnica jest niewidoczna;
 *  • `inflation` — `LAG` i próg `cena_zakupu > 0`. Fixture trafił w środek szeregu, więc
 *    pierwszego miesiąca dostawcy (z `inflacjaPct: null`) w nim nie widać.
 *
 * Źródło prawdy dla każdej asercji: `mirror/backend/analytics_module.cjs:237-268`, `:333`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { historiaCen, products, stagingItems } from "../src/db/schema.js";
import {
  cenyGrupRynku,
  czyJestHistoria,
  historiaCenProduktu,
  inflacjaCennika,
  statystykiCen,
  topZmiany,
  zacisnijGrupeRynku,
  zmianyCenOstatniegoImportu,
} from "../src/repos/analityka.js";
import {
  PRODUKTY_TESTOWE,
  stworzTestowaBaze,
  type NowyProdukt,
  type TestowaBaza,
} from "./gate/index.js";

/** Produkt z kompletem kolumn `NOT NULL` z seedu katalogu; nadpisujemy tylko badane pola. */
function produkt(nadpisania: Partial<NowyProdukt>): NowyProdukt {
  const bazowy = PRODUKTY_TESTOWE[0];
  if (!bazowy) throw new Error("PRODUKTY_TESTOWE jest puste — seed katalogu zniknął");
  return { ...bazowy, ...nadpisania, id: undefined };
}

/** Pozycja stagingu — tylko kolumny, na które patrzą trasy cen, reszta z wartości domyślnych. */
function pozycjaStagingu(nadpisania: {
  kod: string;
  cenaZakupuStara: number | null;
  cenaZakupuNowa: number | null;
  zmianaPct: number | null;
}) {
  return {
    typZmiany: "zmiana_ceny",
    nazwa: `Pozycja ${nadpisania.kod}`,
    dostawca: "MO1",
    magazyn: "GL",
    utworzono: "2026-08-01T10:00:00.000Z",
    ...nadpisania,
  };
}

/** Wpis historii — `zarejestrowanoAt` decyduje o miesiącu, więc podajemy go zawsze wprost. */
function wpisHistorii(nadpisania: {
  kod: string;
  ean?: string | null;
  dostawca: string;
  cenaZakupu: number | null;
  zarejestrowanoAt: string;
}) {
  return { cenaSprzedazy: null, stan: null, ean: null, ...nadpisania };
}

describe("agregaty cen (blok 10b)", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });

  afterEach(() => baza.posprzataj());

  describe("market/group-prices (`:237-242`)", () => {
    beforeEach(() => {
      db.insert(products)
        .values([
          produkt({ kod: "P1", marka: "BKT", model: "AGRIMAX", rozmiar: "540/65R28", cenaZakupu: 100 }),
          produkt({ kod: "P2", marka: "BKT", model: "FLOT", rozmiar: "540/65R28", cenaZakupu: 300 }),
          produkt({ kod: "P3", marka: "TRELLEBORG", model: "TM800", rozmiar: "600/70R30", cenaZakupu: 200 }),
        ])
        .run();
    });

    it("domyślnie grupuje po marce i liczy oferty, średnią, min i max", () => {
      const wynik = cenyGrupRynku(db, "marka");

      expect(wynik.group).toBe("marka");
      // `ORDER BY oferty DESC` — najliczniejsza grupa pierwsza, nie najdroższa.
      expect(wynik.rows).toEqual([
        { grupa: "BKT", oferty: 2, srednia: 200, min: 100, max: 300 },
        { grupa: "TRELLEBORG", oferty: 1, srednia: 200, min: 200, max: 200 },
      ]);
    });

    it("grupuje po modelu i po rozmiarze, gdy `?group` tego żąda", () => {
      expect(cenyGrupRynku(db, "model").rows.map((w) => w.grupa).sort()).toEqual([
        "AGRIMAX",
        "FLOT",
        "TM800",
      ]);
      expect(cenyGrupRynku(db, "rozmiar").rows.map((w) => w.grupa)).toEqual([
        "540/65R28",
        "600/70R30",
      ]);
    });

    it("pomija produkty wycofane i grupy o pustym wymiarze", () => {
      db.insert(products)
        .values([
          produkt({ kod: "P4", marka: "MICHELIN", status: "wycofany", cenaZakupu: 999 }),
          produkt({ kod: "P5", marka: "", cenaZakupu: 999 }),
        ])
        .run();

      const marki = cenyGrupRynku(db, "marka").rows.map((w) => w.grupa);
      expect(marki).not.toContain("MICHELIN");
      expect(marki).not.toContain("");
    });
  });

  describe("zaciskanie `?group` do whitelisty (`:238`)", () => {
    it("przepuszcza trzy dozwolone wymiary", () => {
      expect(zacisnijGrupeRynku("marka")).toBe("marka");
      expect(zacisnijGrupeRynku("model")).toBe("model");
      expect(zacisnijGrupeRynku("rozmiar")).toBe("rozmiar");
    });

    it("wszystko inne sprowadza do `marka`", () => {
      // Ostatni przypadek to nie fantazja: `?group=a&group=b` daje w Expressie TABLICĘ,
      // a `['marka',…].includes(tablica)` jest fałszem — oryginał wraca wtedy do `marka`.
      expect(zacisnijGrupeRynku(undefined)).toBe("marka");
      expect(zacisnijGrupeRynku("")).toBe("marka");
      expect(zacisnijGrupeRynku("dostawca")).toBe("marka");
      expect(zacisnijGrupeRynku("kod; DROP TABLE products")).toBe("marka");
      expect(zacisnijGrupeRynku(["marka", "model"])).toBe("marka");
    });
  });

  describe("prices/last-import kontra top-zmiany — ta sama tabela, inny `WHERE`", () => {
    beforeEach(() => {
      db.insert(stagingItems)
        .values([
          // Obie ceny — widoczna w OBU trasach.
          pozycjaStagingu({ kod: "OBIE", cenaZakupuStara: 100, cenaZakupuNowa: 130, zmianaPct: 30 }),
          // Tylko stara — TYLKO w `top-zmiany` (`:333`), bo `last-import` (`:246`) wymaga obu.
          pozycjaStagingu({ kod: "TYLKO_STARA", cenaZakupuStara: 100, cenaZakupuNowa: null, zmianaPct: null }),
          // Bez starej — w ŻADNEJ z dwóch.
          pozycjaStagingu({ kod: "BEZ_STAREJ", cenaZakupuStara: null, cenaZakupuNowa: 130, zmianaPct: null }),
          // Duży spadek — sprawdza, że `top-zmiany` sortuje po module, nie po znaku.
          pozycjaStagingu({ kod: "SPADEK", cenaZakupuStara: 500, cenaZakupuNowa: 100, zmianaPct: -80 }),
        ])
        .run();
    });

    it("last-import wymaga OBU cen", () => {
      const kody = zmianyCenOstatniegoImportu(db).rows.map((w) => w.kod);

      expect(kody).toContain("OBIE");
      expect(kody).toContain("SPADEK");
      expect(kody).not.toContain("TYLKO_STARA");
      expect(kody).not.toContain("BEZ_STAREJ");
    });

    it("top-zmiany wymaga tylko ceny starej", () => {
      const kody = topZmiany(db).map((w) => w.kod);

      expect(kody).toContain("TYLKO_STARA");
      expect(kody).not.toContain("BEZ_STAREJ");
    });

    it("top-zmiany sortuje po SILE zmiany, bez względu na kierunek", () => {
      const kody = topZmiany(db).map((w) => w.kod);

      // |−80| > |30|, więc spadek stoi przed wzrostem. Wiersz bez `zmiana_pct` ma
      // `ABS(NULL) = NULL` i w porządku malejącym SQLite ląduje na końcu.
      expect(kody.slice(0, 2)).toEqual(["SPADEK", "OBIE"]);
      expect(kody.at(-1)).toBe("TYLKO_STARA");
    });

    it("last-import oddaje najświeższe pozycje pierwsze (`ORDER BY id DESC`)", () => {
      const kody = zmianyCenOstatniegoImportu(db).rows.map((w) => w.kod);
      expect(kody).toEqual(["SPADEK", "OBIE"]);
    });
  });

  describe("prices/product-history (`:250-261`)", () => {
    beforeEach(() => {
      db.insert(historiaCen)
        .values([
          wpisHistorii({ kod: "K1", ean: "111", dostawca: "MO1", cenaZakupu: 100, zarejestrowanoAt: "2026-06-01T00:00:00.000Z" }),
          wpisHistorii({ kod: "K1", ean: "111", dostawca: "MO1", cenaZakupu: 200, zarejestrowanoAt: "2026-07-01T00:00:00.000Z" }),
          wpisHistorii({ kod: "K2", ean: "111", dostawca: "MO2", cenaZakupu: 300, zarejestrowanoAt: "2026-07-02T00:00:00.000Z" }),
          wpisHistorii({ kod: "K3", ean: "222", dostawca: "MO3", cenaZakupu: 400, zarejestrowanoAt: "2026-07-03T00:00:00.000Z" }),
        ])
        .run();
    });

    it("bez parametrów zwraca całą tabelę, uporządkowaną po znaczniku czasu", () => {
      const wynik = historiaCenProduktu(db, { ean: "", kod: "" });

      expect(wynik.hasHistory).toBe(true);
      expect(wynik.rows).toHaveLength(4);
      expect(wynik.rows.map((w) => w.data)).toEqual([...wynik.rows.map((w) => w.data)].sort());
    });

    it("sam `ean` zawęża do jednego produktu u WSZYSTKICH dostawców", () => {
      const wynik = historiaCenProduktu(db, { ean: "111", kod: "" });

      expect(wynik.rows).toHaveLength(3);
      expect(new Set(wynik.rows.map((w) => w.dostawca))).toEqual(new Set(["MO1", "MO2"]));
    });

    it("sam `kod` zawęża do jednej pozycji jednego dostawcy", () => {
      const wynik = historiaCenProduktu(db, { ean: "", kod: "K1" });

      expect(wynik.rows).toHaveLength(2);
      expect(wynik.rows.every((w) => w.kod === "K1")).toBe(true);
    });

    it("oba parametry łączą się przez AND, nie przez OR", () => {
      // Gdyby to było OR, wyszłyby cztery wiersze (trzy z `ean=111` plus jeden z `kod=K3`).
      const wynik = historiaCenProduktu(db, { ean: "111", kod: "K2" });

      expect(wynik.rows).toHaveLength(1);
      expect(wynik.rows[0]?.kod).toBe("K2");
    });

    it("niedopasowane parametry dają pustą listę i `stats` w null-ach — nie błąd", () => {
      const wynik = historiaCenProduktu(db, { ean: "nie-ma-takiego", kod: "" });

      expect(wynik.hasHistory).toBe(true);
      expect(wynik.rows).toEqual([]);
      expect(wynik.stats).toEqual({ min: null, max: null, avg: null });
    });
  });

  describe("gałąź „brak historii” (`:257`, `:265`)", () => {
    it("na pustej `historia_cen` obie trasy oddają `hasHistory: false` i puste wiersze", () => {
      expect(czyJestHistoria(db)).toBe(false);

      const historia = historiaCenProduktu(db, { ean: "111", kod: "" });
      expect(historia).toEqual({
        hasHistory: false,
        rows: [],
        stats: { min: null, max: null, avg: null },
      });

      expect(inflacjaCennika(db)).toEqual({ hasHistory: false, rows: [] });
    });
  });

  describe("stats (`:259-260`)", () => {
    it("liczy min, max i średnią zaokrągloną do dwóch miejsc", () => {
      // 1/3 daje 0.3333…; oryginał zaokrągla mnożnikiem (`round`, `:54`), nie `toFixed`,
      // więc wynik jest LICZBĄ, a nie napisem — i taką liczbę niesie fixture.
      const wynik = statystykiCen([{ cenaZakupu: 1 }, { cenaZakupu: 0 }, { cenaZakupu: 0 }]);

      expect(wynik).toEqual({ min: 0, max: 1, avg: 0.33 });
      expect(typeof wynik.avg).toBe("number");
    });

    it("pomija `null`-e, ale ZOSTAWIA zero", () => {
      // `filter(v => v != null)` oryginału to porównanie luźne: odsiewa `null`/`undefined`,
      // przepuszcza `0`. Zaostrzenie tego do `> 0` (jak w `inflation`) byłoby cichą zmianą
      // zachowania — minimum przestałoby wynosić zero.
      expect(statystykiCen([{ cenaZakupu: null }, { cenaZakupu: 0 }, { cenaZakupu: 10 }])).toEqual({
        min: 0,
        max: 10,
        avg: 5,
      });
    });

    it("na pustym zbiorze oddaje trzy `null`-e, nie zera ani NaN", () => {
      expect(statystykiCen([])).toEqual({ min: null, max: null, avg: null });
      expect(statystykiCen([{ cenaZakupu: null }])).toEqual({ min: null, max: null, avg: null });
    });
  });

  describe("prices/inflation (`:263-276`)", () => {
    beforeEach(() => {
      db.insert(historiaCen)
        .values([
          // MO1: czerwiec 1000 → lipiec 1200 = +20%.
          wpisHistorii({ kod: "K1", dostawca: "MO1", cenaZakupu: 1000, zarejestrowanoAt: "2026-06-01T00:00:00.000Z" }),
          wpisHistorii({ kod: "K1", dostawca: "MO1", cenaZakupu: 1200, zarejestrowanoAt: "2026-07-01T00:00:00.000Z" }),
          // MO2: tylko lipiec — pierwszy miesiąc dostawcy, brak poprzednika.
          wpisHistorii({ kod: "K2", dostawca: "MO2", cenaZakupu: 500, zarejestrowanoAt: "2026-07-05T00:00:00.000Z" }),
          // Cena zerowa i null — odsiewane progiem `cena_zakupu > 0`.
          wpisHistorii({ kod: "K3", dostawca: "MO3", cenaZakupu: 0, zarejestrowanoAt: "2026-07-06T00:00:00.000Z" }),
          wpisHistorii({ kod: "K4", dostawca: "MO4", cenaZakupu: null, zarejestrowanoAt: "2026-07-07T00:00:00.000Z" }),
        ])
        .run();
    });

    it("liczy zmianę miesiąc do miesiąca w obrębie dostawcy", () => {
      const rows = inflacjaCennika(db).rows;
      const lipiecMo1 = rows.find((w) => w.dostawca === "MO1" && w.miesiac === "2026-07");

      expect(lipiecMo1).toEqual({
        dostawca: "MO1",
        miesiac: "2026-07",
        sredniaCena: 1200,
        inflacjaPct: 20,
      });
    });

    it("pierwszy miesiąc dostawcy ma `inflacjaPct: null` — `LAG` nie ma poprzednika", () => {
      const rows = inflacjaCennika(db).rows;

      expect(rows.find((w) => w.dostawca === "MO1" && w.miesiac === "2026-06")?.inflacjaPct).toBeNull();
      expect(rows.find((w) => w.dostawca === "MO2")?.inflacjaPct).toBeNull();
    });

    it("odsiewa ceny zerowe i puste (`WHERE cena_zakupu > 0`)", () => {
      // To jest ta różnica progu, której `stats` NIE ma: tam zero wchodzi do minimum,
      // tutaj wypada ze średniej miesiąca. Obie wersje są w oryginale.
      const dostawcy = inflacjaCennika(db).rows.map((w) => w.dostawca);

      expect(dostawcy).not.toContain("MO3");
      expect(dostawcy).not.toContain("MO4");
    });

    it("sortuje malejąco po miesiącu, a w miesiącu rosnąco po dostawcy", () => {
      const rows = inflacjaCennika(db).rows;
      expect(rows.map((w) => `${w.miesiac}/${w.dostawca}`)).toEqual([
        "2026-07/MO1",
        "2026-07/MO2",
        "2026-06/MO1",
      ]);
    });

    it("miesiąc bierze się z PREFIKSU znacznika ISO, więc jego format jest częścią kontraktu", () => {
      expect(inflacjaCennika(db).rows.every((w) => /^\d{4}-\d{2}$/.test(w.miesiac))).toBe(true);
    });
  });
});
