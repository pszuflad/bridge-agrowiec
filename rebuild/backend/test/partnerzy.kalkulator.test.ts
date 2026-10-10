/** Kalkulator ceny partnera (ticket 213, PRT-2.4). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { parsujFormule } from "../src/partnerzy/formula.js";
import { BladKalkulacji, obliczCene, zaokragliWgReguly, type PozycjaDoCeny } from "../src/partnerzy/kalkulator.js";
import { importujTabeleGeis, ustawPaliwo } from "../src/partnerzy/transport.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const POZYCJA: PozycjaDoCeny = { kod: "MO1_1", cenaZakupu: 1000, waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85 };
const KRAJ = { kraj: "FR", narzutProc: 12, kosztyDodatkowe: 43 };
const BAZA = { kraj: KRAJ, zaokraglanie: "grosz", kurs: 4.3, data: "2026-10-10" };

describe("kalkulator ceny partnera", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-kalk-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    importujTabeleGeis(db, { FR: { wspGabarytowy: 250, maks: null, stawki: [[100, 103], [200, 163], [500, 369]] } });
    ustawPaliwo(db, "FR", 11, "2026-01-01");
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  it("liczy: zakup×(1+narzut)/kurs + przesyłka GEIS z paliwem + koszty dodatkowe/kurs", () => {
    const w = obliczCene(db, { ...BAZA, pozycja: POZYCJA });
    const oczekiwana = (1000 * 1.12) / 4.3 + 163 * 1.11 + 43 / 4.3;
    expect(w.cenaPrzedZaokragleniem).toBeCloseTo(oczekiwana, 9);
    expect(w.cenaEur).toBe(Math.round(oczekiwana * 100) / 100);
    expect(w.skladniki).toMatchObject({ zakup: 1000, narzut: 0.12, kurs: 4.3 });
    expect(w.skladniki.przesylkaEur).toBeCloseTo(180.93, 2);
    expect(w.ostrzezenia).toEqual([]);
  });

  it("zgadza się z wzorem z karty, gdy przesyłkę traktować jako PLN (przesylka_pln)", () => {
    const formula = parsujFormule("(zakup + zakup * narzut + przesylka_pln + koszty_dodatkowe) / kurs_EUR");
    const w = obliczCene(db, { ...BAZA, pozycja: POZYCJA, formula });
    expect(w.cenaPrzedZaokragleniem).toBeCloseTo((1000 + 120 + 180.93 * 4.3 + 43) / 4.3, 6);
  });

  it("zaokrągla dopiero wynik, wg reguły partnera", () => {
    expect(zaokragliWgReguly(12.344, "grosz")).toBe(12.34);
    expect(zaokragliWgReguly(12.345, "grosz")).toBe(12.35);
    expect(zaokragliWgReguly(12.5, "euro")).toBe(13);
    expect(zaokragliWgReguly(11.01, "gora5")).toBe(15);
    expect(zaokragliWgReguly(15, "gora5")).toBe(15);
    expect(zaokragliWgReguly(15.0000001, "gora10")).toBe(20);
    expect(() => zaokragliWgReguly(1, "inne")).toThrow(/Nieznana reguła/);
    const w = obliczCene(db, { ...BAZA, zaokraglanie: "gora10", pozycja: POZYCJA });
    expect(w.cenaEur % 10).toBe(0);
    expect(w.cenaEur).toBeGreaterThanOrEqual(w.cenaPrzedZaokragleniem);
  });

  it("pozycja bez wagi lub wymiarów jest błędem kalkulacji, nie ceną", () => {
    for (const braki of [{ waga: null }, { waga: 0 }, { dlugosc: null }, { wysokosc: null }]) {
      const e = (() => {
        try {
          obliczCene(db, { ...BAZA, pozycja: { ...POZYCJA, ...braki } });
        } catch (x) {
          return x;
        }
      })();
      expect(e).toBeInstanceOf(BladKalkulacji);
      expect((e as BladKalkulacji).kod).toBe("MO1_1");
    }
  });

  it("błąd kalkulacji: brak ceny zakupu, kursu, tabeli kraju, waga ponad próg", () => {
    expect(() => obliczCene(db, { ...BAZA, pozycja: { ...POZYCJA, cenaZakupu: null } })).toThrow(/Brak ceny zakupu/);
    expect(() => obliczCene(db, { ...BAZA, pozycja: { ...POZYCJA, cenaZakupu: 0 } })).toThrow(/Brak ceny zakupu/);
    expect(() => obliczCene(db, { ...BAZA, kurs: 0, pozycja: POZYCJA })).toThrow(/kurs/);
    expect(() => obliczCene(db, { ...BAZA, kraj: { ...KRAJ, kraj: "DE" }, pozycja: POZYCJA })).toThrow(/Brak tabeli/);
    expect(() => obliczCene(db, { ...BAZA, pozycja: { ...POZYCJA, waga: 900 } })).toThrow(/najwyższy próg/);
  });

  it("błąd w formule partnera (nieznana zmienna) staje się błędem kalkulacji", () => {
    const formula = parsujFormule("zakup * nieznana");
    expect(() => obliczCene(db, { ...BAZA, pozycja: POZYCJA, formula })).toThrow(/Błąd formuły.*nieznana/);
  });

  it("waga automatyczna i szacowana są użyte, ale oznaczone ostrzeżeniem", () => {
    const w = obliczCene(db, { ...BAZA, pozycja: { ...POZYCJA, wagaAutoUzupelniona: true, wagaSzacowana: true } });
    expect(w.ostrzezenia).toEqual(["MO1_1: waga uzupełniona automatycznie (mniej pewna).", "MO1_1: waga szacowana (mniej pewna)."]);
    expect(w.cenaEur).toBeGreaterThan(0);
  });

  it("zmiana paliwa wpływa tylko na wycenę od nowej daty", () => {
    ustawPaliwo(db, "FR", 20, "2026-11-01");
    const stara = obliczCene(db, { ...BAZA, data: "2026-10-31", pozycja: POZYCJA }).cenaEur;
    const nowa = obliczCene(db, { ...BAZA, data: "2026-11-01", pozycja: POZYCJA }).cenaEur;
    expect(nowa).toBeGreaterThan(stara);
    expect(obliczCene(db, { ...BAZA, data: "2026-10-31", pozycja: POZYCJA }).cenaEur).toBe(stara);
  });
});
