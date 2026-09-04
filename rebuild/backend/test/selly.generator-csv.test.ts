/**
 * Generator codziennego CSV dla Selly (blok 8a) — siatka dla portu
 * `mirror/backend/generate_selly_export.cjs`.
 *
 * Fixture'a nie ma (to plik na dysku, nie odpowiedź HTTP), więc TU zamrażamy format:
 * 59 kolumn w kolejności, BOM, `;`, `\r\n` i trzy transformacje uzgodnione z Selly, które
 * najłatwiej przy refaktorze zgubić.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LICZBA_KOLUMN,
  sciezkaPliku,
  statusPlikuCsv,
  wygenerujCsvSelly,
  zbudujCsvSelly,
} from "../src/selly/generator-csv.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { PRODUKTY_TESTOWE, zasiejProdukty } from "./gate/dane.js";

describe("generator CSV dla Selly (blok 8a)", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejProdukty(baza.db);
  });

  afterEach(() => baza.posprzataj());

  /** Nagłówek pliku, bez BOM-u, rozbity na kolumny. */
  const naglowek = (): string[] => zbudujCsvSelly(baza.db).tresc.slice(1).split("\r\n")[0]!.split(";");

  /** Wiersz danych o podanym kodzie produktu (`Kod-dostawcy` to 10. kolumna). */
  const wiersz = (kodBezPodkreslnika: string): string[] | undefined =>
    zbudujCsvSelly(baza.db)
      .tresc.split("\r\n")
      .slice(1)
      .map((w) => w.split(";"))
      .find((k) => k[9] === kodBezPodkreslnika);

  it("ma dokładnie 59 kolumn w kolejności z pliku wzorcowego", () => {
    const kolumny = naglowek();

    expect(kolumny).toHaveLength(59);
    expect(LICZBA_KOLUMN).toBe(59);
    expect(kolumny[0]).toBe("Nazwa-produktu");
    expect(kolumny[9]).toBe("Kod-dostawcy");
    expect(kolumny[57]).toBe("Zastosowanie");
    expect(kolumny[58]).toBe("data_aktualizacji");
  });

  it("zaczyna się BOM-em, łączy wiersze `\\r\\n` i kończy złamaniem", () => {
    const { tresc } = zbudujCsvSelly(baza.db);

    expect(tresc.startsWith("﻿")).toBe(true);
    expect(tresc.endsWith("\r\n")).toBe(true);
    expect(tresc).not.toContain("\n\n");
  });

  it("bierze wyłącznie produkty ze statusem `aktywny`", () => {
    const { wiersze } = zbudujCsvSelly(baza.db);
    const aktywne = PRODUKTY_TESTOWE.filter((p) => (p.status ?? "aktywny") === "aktywny").length;

    expect(wiersze).toBe(aktywne);
    // `MO1_100001` jest „wstrzymany" — nie może się pojawić.
    expect(zbudujCsvSelly(baza.db).tresc).not.toContain("MO1100001");
  });

  /**
   * ⚠ `Kod-dostawcy` bierze kolumnę `kod` (NIE `kod_dostawcy`) i usuwa z niej podkreślniki:
   * `MO9_336320` → `MO9336320`. Zgodnie z plikiem wzorcowym wysłanym do Selly.
   */
  it("`Kod-dostawcy` to `kod` bez podkreślników, nie `kod_dostawcy`", () => {
    const dane = zbudujCsvSelly(baza.db)
      .tresc.split("\r\n")
      .slice(1)
      .filter(Boolean)
      .map((w) => w.split(";")[9]);

    expect(dane).toContain("MO9336320");
    expect(dane).not.toContain("MO9_336320");
    // `kodDostawcy` produktu MO9_336319 to „521559" — nie może trafić do tej kolumny.
    expect(dane).not.toContain("521559");
  });

  /** ⚠ Zmiana z 2026-07-24 na prośbę Selly: wartość opisowa zamiast 0/1. */
  it("kolumny boolowskie oddają „Tak” albo PUSTE pole, nigdy 0/1", () => {
    const kolumny = naglowek();
    const zPrawda = wiersz("MO9336319"); // ten produkt ma komplet flag ustawionych na true
    const zNull = wiersz("MO9336320"); // ten ma je nieustawione

    expect(zPrawda?.[kolumny.indexOf("Reinforced")]).toBe("Tak");
    expect(zPrawda?.[kolumny.indexOf("ExtraLoad")]).toBe("Tak");
    expect(zNull?.[kolumny.indexOf("Reinforced")]).toBe("");
    expect(zNull?.[kolumny.indexOf("CFO")]).toBe("");
  });

  /** ⚠ Zmiana z 2026-07-31: `123,-` zamiast surowej liczby z kropką. */
  it("`cena_sprzedazy` wychodzi w formacie `123,-`", () => {
    const kolumny = naglowek();
    const dane = wiersz("MO9336320");

    expect(dane?.[kolumny.indexOf("cena_sprzedazy")]).toBe("7252,-");
    // `Cena-zakupu` NIE jest tak formatowana — zostaje surową liczbą.
    expect(dane?.[kolumny.indexOf("Cena-zakupu")]).toBe("5562.4");
  });

  it("kolumna `Promocja` jest zawsze pusta — nie ma jej w bazie", () => {
    const kolumny = naglowek();
    const dane = wiersz("MO9336320");

    expect(kolumny).toContain("Promocja");
    expect(dane?.[kolumny.indexOf("Promocja")]).toBe("");
  });

  /**
   * Ten format JEST escapowany, w odróżnieniu od OBU eksportów Shopera, które zamiast
   * cudzysłowów zamieniają `;` na `,` (`selly/csv-shoper.ts`). Trzy formaty CSV w jednym
   * projekcie, dwie różne strategie — stąd osobny test na każdą.
   *
   * Wiersza nie rozbijamy tu po `;`, bo escapowane pole zawiera separator w środku;
   * sprawdzamy fragment treści, tak jak zrobiłby to Excel po sparsowaniu cudzysłowów.
   */
  it("pole ze średnikiem trafia w cudzysłowy, a cudzysłów jest podwajany", () => {
    baza.sqlite
      .prepare("UPDATE products SET nazwa = ? WHERE kod = ?")
      .run('Opona; 20" "premium"', "MO9_336320");

    const { tresc } = zbudujCsvSelly(baza.db);

    expect(tresc).toContain('"Opona; 20"" ""premium"""');
    // Pole zawiera średnik, więc naiwny podział wiersza da o jedną kolumnę za dużo —
    // to jest właśnie powód, dla którego escaping tu jest, a w eksportach Shopera go nie ma.
    const wiersze = tresc.split("\r\n").slice(1).filter(Boolean);
    const zEscapem = wiersze.find((w) => w.startsWith('"Opona'));
    expect(zEscapem?.split(";")).toHaveLength(60);
  });

  describe("zapis pliku i odczyt jego statusu", () => {
    it("`wygenerujCsvSelly` pisze plik i zwraca jego statystyki", () => {
      const sciezki = {
        katalog: `${baza.sciezka}-csv`,
        plik: "selly.csv",
        url: "https://przyklad/selly.csv",
      };

      const wynik = wygenerujCsvSelly(baza.db, sciezki);

      expect(wynik.ok).toBe(true);
      expect(wynik.wiersze).toBe(3);
      expect(wynik.czas_ms).toBeGreaterThanOrEqual(0);
      expect(wynik.stdout).toContain("Liczba kolumn: 59");
      expect(wynik.stdout).toContain("Liczba produktow (aktywnych): 3");

      const zDysku = readFileSync(sciezkaPliku(sciezki), "utf8");
      expect(zDysku).toBe(zbudujCsvSelly(baza.db).tresc);
    });

    /**
     * ⚠ Brak pliku daje INNY, pięciokluczowy kształt odpowiedzi (`routes.cjs:303-305`) —
     * bez `ostatnia_synchronizacja`, `wiersze` i reszty. Frontend rozgałęzia się na `exists`.
     */
    it("brak pliku daje pięciokluczową odpowiedź z `exists: false`", () => {
      const status = statusPlikuCsv({
        katalog: `${baza.sciezka}-nie-ma`,
        plik: "brak.csv",
        url: "https://przyklad/brak.csv",
      });

      expect(status).toEqual({
        ok: false,
        exists: false,
        status: "blad",
        powod: "Brak pliku CSV",
        url: "https://przyklad/brak.csv",
      });
    });

    it("świeży plik jest `ok`, a `wiersze` liczy dane bez nagłówka", () => {
      const sciezki = {
        katalog: `${baza.sciezka}-csv2`,
        plik: "selly.csv",
        url: "https://przyklad/selly.csv",
      };
      wygenerujCsvSelly(baza.db, sciezki);

      const status = statusPlikuCsv(sciezki);

      expect(status.exists).toBe(true);
      expect(status).toMatchObject({ ok: true, status: "ok", powod: null, wiersze: 3 });
    });

    /**
     * Plik z wczoraj jest `blad` z konkretnym powodem — to jest sygnał, że cron o 6:00
     * nie zadziałał i Selly ciągnie wczorajsze ceny.
     */
    it("plik nie z dzisiaj jest `blad` z powodem o dacie", () => {
      const sciezki = {
        katalog: `${baza.sciezka}-csv3`,
        plik: "selly.csv",
        url: "https://przyklad/selly.csv",
      };
      wygenerujCsvSelly(baza.db, sciezki);

      const zaDwaDni = new Date(Date.now() + 2 * 86_400_000);
      const status = statusPlikuCsv(sciezki, zaDwaDni);

      expect(status).toMatchObject({
        ok: false,
        exists: true,
        status: "blad",
        powod: "Plik nie zostal wygenerowany dzisiaj",
        wygenerowany_dzisiaj: false,
      });
    });
  });
});
