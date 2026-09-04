/**
 * Format bajtowy obu eksportów do Shopera (blok 8a).
 *
 * Fixture'a dla tych tras nie ma i być nie może (nagrywarka zapisywała tylko JSON), więc to
 * TEN plik jest siatką dla treści pliku — nagłówki kolumn, escaping, przecinek dziesiętny,
 * BOM, `\r\n`, zawartość ZIP-a. Odpowiednikiem dla analityki jest `analityka.csv.test.ts`.
 *
 * Wzorzec bierzemy z oryginału: `deminified/backend-index.cjs:48770-48782` (format stały)
 * i `:48819-48851` (format z konfiguracji).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { zapiszKonfiguracje } from "../src/repos/config.js";
import {
  csvDostawcy,
  csvWgKolumn,
  DOMYSLNY_FORMAT_EKSPORTU,
  kolumnyZFormatu,
  NAGLOWEK_EXPORT_SHOPER,
} from "../src/selly/csv-shoper.js";
import type { Produkt } from "../src/repos/products.js";
import {
  stworzSrodowiskoTestowe,
  zasiejDostawcow,
  zasiejProdukty,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** BOM — pierwszy znak każdego pliku obu formatów. */
const BOM = "﻿";

/** Minimalny produkt do testów jednostkowych formatu — pola spoza formatu są nieistotne. */
function produkt(nadpisania: Partial<Produkt> = {}): Produkt {
  return {
    kod: "MO9_1",
    nazwa: "620/70R42 BKT",
    marka: "BKT",
    kategoria: "Rolnicze",
    dostawca: "MO9",
    stan: 5,
    cenaZakupu: 100,
    cenaSprzedazy: 123.456,
    vat: 23,
    status: "aktywny",
    ean: "8903094073627",
    eanRaw: "8903094073627",
    magazynRaw: ">10",
    model: "AGRIMAX",
    rozmiar: "620/70R42",
    ...nadpisania,
  } as Produkt;
}

describe("format CSV — `GET /api/export-shoper` (stały, 7 kolumn)", () => {
  it("zaczyna się BOM-em i stałym nagłówkiem, wiersze łączy `\\r\\n`", () => {
    const csv = csvDostawcy([produkt()], "MO9");

    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1).split("\r\n")[0]).toBe(NAGLOWEK_EXPORT_SHOPER);
    expect(NAGLOWEK_EXPORT_SHOPER.split(";")).toHaveLength(7);
  });

  it("cena idzie z przecinkiem dziesiętnym i dwoma miejscami", () => {
    const csv = csvDostawcy([produkt({ cenaSprzedazy: 123.456 })], "MO9");
    expect(csv.split("\r\n")[1]?.split(";")[3]).toBe("123,46");
  });

  /**
   * ⚠ `aktywny` wymaga OBU warunków: statusu „aktywny" ORAZ dodatniego stanu. Produkt ze
   * stanem 0 zostaje w pliku (filtr to `stan >= 0`), ale z flagą 0 — tak Shoper go wygasza,
   * zamiast usuwać.
   */
  it("`aktywny` to 1 tylko przy statusie aktywnym I dodatnim stanie", () => {
    const wiersz = (p: Partial<Produkt>) =>
      csvDostawcy([produkt(p)], "MO9").split("\r\n")[1]?.split(";")[1];

    expect(wiersz({ status: "aktywny", stan: 5 })).toBe("1");
    expect(wiersz({ status: "aktywny", stan: 0 })).toBe("0");
    expect(wiersz({ status: "wstrzymany", stan: 5 })).toBe("0");
  });

  it("odcina tylko stany UJEMNE — stan 0 zostaje w pliku", () => {
    const csv = csvDostawcy(
      [produkt({ kod: "A", stan: 0 }), produkt({ kod: "B", stan: -1 })],
      "MO9",
    );
    const kody = csv
      .split("\r\n")
      .slice(1)
      .map((w) => w.split(";")[0]);

    expect(kody).toEqual(["A"]);
  });

  /**
   * ⚠ TEN FORMAT NIE MA CUDZYSŁOWÓW. Zamiast escapować pole ze średnikiem, oryginał zamienia
   * w nim `;` na `,` — i to jest cała ochrona przed rozjechaniem kolumn.
   */
  it("średnik w nazwie zamienia na przecinek, nie zakłada cudzysłowów", () => {
    const csv = csvDostawcy([produkt({ nazwa: "Opona; duża" })], "MO9");
    const wiersz = csv.split("\r\n")[1] ?? "";

    expect(wiersz).toContain("Opona, duża");
    expect(wiersz).not.toContain('"');
    expect(wiersz.split(";")).toHaveLength(7);
  });

  it("filtruje po dostawcy", () => {
    const csv = csvDostawcy([produkt({ kod: "A" }), produkt({ kod: "B", dostawca: "MO1" })], "MO9");
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("dostawca bez produktów daje plik z samym nagłówkiem", () => {
    const csv = csvDostawcy([produkt()], "MO7");
    expect(csv).toBe(BOM + NAGLOWEK_EXPORT_SHOPER);
  });
});

describe("format CSV — `GET /api/export/shoper` (kolumny z konfiguracji)", () => {
  it("domyślny format to siedem kolumn z oryginału", () => {
    expect(kolumnyZFormatu(null)).toEqual([
      "ean",
      "nazwa",
      "producent",
      "rozmiar",
      "cena_netto",
      "magazyn",
      "vat",
    ]);
    expect(kolumnyZFormatu("")).toEqual(kolumnyZFormatu(DOMYSLNY_FORMAT_EKSPORTU));
  });

  /**
   * ⚠ `="1234567890123"` to formuła Excela, nie pomyłka: bez niej arkusz zamienia
   * 13-cyfrowy EAN na notację naukową `1,23457E+12`.
   */
  it("EAN wychodzi w escapingu Excela, a pusty EAN daje puste pole", () => {
    const zEanem = csvWgKolumn([produkt()], ["ean"]).split("\r\n")[1];
    expect(zEanem).toBe('="8903094073627"');

    const bezEana = csvWgKolumn([produkt({ ean: null })], ["ean"]).split("\r\n")[1];
    expect(bezEana).toBe("");
  });

  it("nieznana nazwa kolumny daje puste pole, nie błąd", () => {
    const csv = csvWgKolumn([produkt()], ["nazwa", "nie_ma_takiej", "vat"]);
    expect(csv.split("\r\n")[1]).toBe("620/70R42 BKT;;23");
  });

  it("nagłówek odbija kolumny dosłownie, ze spacjami włącznie", () => {
    // `trim()` działa przy SZUKANIU generatora, ale nagłówek zostaje surowy (`:48846`).
    const csv = csvWgKolumn([produkt()], ["nazwa", " vat"]);
    const [naglowek, wiersz] = csv.slice(1).split("\r\n");

    expect(naglowek).toBe("nazwa; vat");
    expect(wiersz).toBe("620/70R42 BKT;23");
  });

  it("`magazyn` woli `magazynRaw`, `stan` zawsze liczbę", () => {
    const csv = csvWgKolumn([produkt({ magazynRaw: ">10", stan: 5 })], ["magazyn", "stan"]);
    expect(csv.split("\r\n")[1]).toBe(">10;5");

    const bezRaw = csvWgKolumn([produkt({ magazynRaw: null, stan: 5 })], ["magazyn", "stan"]);
    expect(bezRaw.split("\r\n")[1]).toBe("5;5");
  });

  /** ⚠ Ta trasa NIE filtruje po `stan >= 0`, w odróżnieniu od `export-shoper`. */
  it("nie odcina stanów ujemnych", () => {
    const csv = csvWgKolumn([produkt({ kod: "A", stan: -3 })], ["kod", "stan"]);
    expect(csv.split("\r\n")[1]).toBe("A;-3");
  });

  it("`jednostka` jest stałą „szt”, a `vat` domyślnie 23", () => {
    const csv = csvWgKolumn([produkt({ vat: null as unknown as number })], ["jednostka", "vat"]);
    expect(csv.split("\r\n")[1]).toBe("szt;23");
  });
});

describe("trasy eksportu — treść odpowiedzi end-to-end", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
    zasiejDostawcow(srodowisko.db);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("`/api/export-shoper?dostawca=MO9` oddaje BOM + stały nagłówek + wiersze MO9", async () => {
    const odp = await zAuth("/api/export-shoper?dostawca=MO9");
    const tresc = odp.text;

    expect(tresc.startsWith(BOM)).toBe(true);
    const linie = tresc.slice(1).split("\r\n");
    expect(linie[0]).toBe(NAGLOWEK_EXPORT_SHOPER);
    // Dwa produkty MO9 w `PRODUKTY_TESTOWE`, oba ze stanem 2.
    expect(linie).toHaveLength(3);
    expect(linie.slice(1).every((w) => w.startsWith("MO9_"))).toBe(true);
  });

  /**
   * ZIP jest strumieniowany, więc supertest dostaje go jako bufor binarny. Sprawdzamy
   * sygnaturę `PK` i to, że w środku są nazwy plików per dostawca — bez rozpakowywania,
   * bo nazwy wpisów w archiwum ZIP leżą jawnie w nagłówkach lokalnych.
   */
  it("`/api/export-shoper` bez parametru oddaje ZIP z plikiem per dostawca", async () => {
    const odp = await zAuth("/api/export-shoper").buffer(true).parse((res, cb) => {
      const kawalki: Buffer[] = [];
      res.on("data", (c: Buffer) => kawalki.push(c));
      res.on("end", () => cb(null, Buffer.concat(kawalki)));
    });

    const bufor = odp.body as Buffer;
    expect(bufor.subarray(0, 2).toString("latin1")).toBe("PK");

    const data = new Date().toISOString().slice(0, 10);
    const tekst = bufor.toString("latin1");
    for (const kod of ["MO1", "MO2", "MO9"]) {
      expect(tekst, `brak wpisu dla ${kod}`).toContain(`shoper_${kod}_${data}.csv`);
    }
  });

  it("`/api/export/shoper` czyta `shoper.format_eksportu` z konfiguracji", async () => {
    zapiszKonfiguracje(srodowisko.db, "shoper.format_eksportu", "kod;nazwa;cena_zakupu");

    const odp = await zAuth("/api/export/shoper?supplier=MO9");
    const linie = odp.text.slice(1).split("\r\n");

    expect(linie[0]).toBe("kod;nazwa;cena_zakupu");
    expect(linie[1]?.split(";")).toHaveLength(3);
    expect(linie[1]?.split(";")[2]).toMatch(/^\d+,\d{2}$/);
  });

  it("pusty `shoper.format_eksportu` wraca do domyślnych siedmiu kolumn", async () => {
    zapiszKonfiguracje(srodowisko.db, "shoper.format_eksportu", "");

    const odp = await zAuth("/api/export/shoper");
    expect(odp.text.slice(1).split("\r\n")[0]).toBe(DOMYSLNY_FORMAT_EKSPORTU);
  });
});
