/** Transport GEIS partnerów (ticket 212, PRT-2.2). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import {
  BladTransportu,
  importujTabeleGeis,
  kosztPrzesylki,
  paliwoNaDzien,
  ustawPaliwo,
  wagaRozliczeniowa,
  wymiaryZPaleta,
  type TabeleGeisJson,
} from "../src/partnerzy/transport.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const GEIS: TabeleGeisJson = {
  FR: { wspGabarytowy: 250, maks: null, stawki: [[100, 103], [200, 163], [500, 369], [2500, 1135]] },
  AT: { wspGabarytowy: 200, kosztPakowania: 2, maks: [240, 240, 220], stawki: [[50, 61], [500, 187]] },
};
/** Półpaleta z prawdziwej wyceny (karta): 80×60×85 cm, 56 kg, FR 66500 → 175 EUR. */
const POLPALETA = { waga: 56, dlugosc: 80, szerokosc: 60, wysokosc: 85 }; // z paletą (ticket 274): 80 × 80 × 95

describe("transport GEIS", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-geis-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    importujTabeleGeis(db, GEIS);
    ustawPaliwo(db, "FR", 11, "2026-01-01");
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  it("waga rozliczeniowa to większa z rzeczywistej i gabarytowej", () => {
    const w = wagaRozliczeniowa(POLPALETA, 250);
    expect(w).toMatchObject({ szerokoscZPaleta: 80, wysokoscZPaleta: 95 });
    expect(w.gabarytowa).toBeCloseTo(152, 6);
    expect(w.rozliczeniowa).toBeCloseTo(152, 6);
    expect(wagaRozliczeniowa({ ...POLPALETA, waga: 200 }, 250).rozliczeniowa).toBe(200);
  });

  it("reguła palety (Erwin): szerokość ≤55 → 60, ≤80 → 80, powyżej rzeczywista; wysokość +10 cm", () => {
    expect(wymiaryZPaleta(31, 77)).toEqual({ szerokosc: 60, wysokosc: 87 });
    expect(wymiaryZPaleta(55, 100)).toEqual({ szerokosc: 60, wysokosc: 110 });
    expect(wymiaryZPaleta(56, 100)).toEqual({ szerokosc: 80, wysokosc: 110 });
    expect(wymiaryZPaleta(80, 100)).toEqual({ szerokosc: 80, wysokosc: 110 });
    expect(wymiaryZPaleta(103, 103)).toEqual({ szerokosc: 103, wysokosc: 113 });
  });

  it("opona 10.0/75-15.3 do DE: rzeczywiste 45 kg, ale po regule palety 80 kg → próg 100 (rzeczywista tabela GEIS)", () => {
    importujTabeleGeis(db, { DE: { wspGabarytowy: 200, stawki: [[50, 25], [75, 40], [100, 42], [150, 59]] } });
    const k = kosztPrzesylki(db, "DE", { waga: 45, dlugosc: 77, szerokosc: 31, wysokosc: 77 }, "2026-10-10");
    expect(k).toMatchObject({ szerokoscZPaleta: 60, wysokoscZPaleta: 87, progKg: 100, stawka: 42 });
    expect(k.wagaRozliczeniowa).toBeCloseTo(80.388, 3);
  });

  it("wycena wzorcowa: półpaleta 56 kg do FR → próg 200 kg, stawka 163, z paliwem 11 % ≈ 181 EUR", () => {
    const k = kosztPrzesylki(db, "FR", POLPALETA, "2026-10-10");
    expect(k).toMatchObject({ progKg: 200, stawka: 163, paliwoProc: 11 });
    expect(k.koszt).toBeCloseTo(180.93, 2);
  });

  it("bez gabarytów wyszedłby próg 100 kg — dlatego liczymy wagę gabarytową", () => {
    const tylkoRzeczywista = kosztPrzesylki(db, "FR", { waga: 56, dlugosc: 10, szerokosc: 10, wysokosc: 10 }, "2026-10-10");
    expect(tylkoRzeczywista.progKg).toBe(100);
    expect(tylkoRzeczywista.koszt).toBeCloseTo(103 * 1.11, 6);
  });

  it("koszt pakowania dolicza się po paliwie", () => {
    expect(kosztPrzesylki(db, "AT", { waga: 20, dlugosc: 50, szerokosc: 50, wysokosc: 50 }, "2026-10-10").koszt).toBeCloseTo(63, 6);
  });

  it("paliwo ma historię okresów: zmiana nie przelicza wstecz", () => {
    ustawPaliwo(db, "FR", 13, "2026-10-15");
    expect(paliwoNaDzien(db, "FR", "2026-10-14")).toBe(11);
    expect(paliwoNaDzien(db, "FR", "2026-10-15")).toBe(13);
    expect(paliwoNaDzien(db, "FR", "2025-12-31")).toBe(0);
    expect(paliwoNaDzien(db, "DE", "2026-10-15")).toBe(0);
    expect(kosztPrzesylki(db, "FR", POLPALETA, "2026-10-14").paliwoProc).toBe(11);
  });

  it("błędy zamiast zera: brak wagi, wymiarów, kraju, limit wymiarów i waga ponad tabelę", () => {
    expect(() => kosztPrzesylki(db, "FR", { ...POLPALETA, waga: null }, "2026-10-10")).toThrow(/Brak wagi/);
    expect(() => kosztPrzesylki(db, "FR", { ...POLPALETA, waga: 0 }, "2026-10-10")).toThrow(BladTransportu);
    expect(() => kosztPrzesylki(db, "FR", { ...POLPALETA, wysokosc: null }, "2026-10-10")).toThrow(/Brak wymiarów/);
    expect(() => kosztPrzesylki(db, "DE", POLPALETA, "2026-10-10")).toThrow(/Brak tabeli/);
    expect(() => kosztPrzesylki(db, "AT", { waga: 5, dlugosc: 250, szerokosc: 10, wysokosc: 10 }, "2026-10-10")).toThrow(/limit/);
    expect(() => kosztPrzesylki(db, "FR", { waga: 3000, dlugosc: 10, szerokosc: 10, wysokosc: 10 }, "2026-10-10")).toThrow(/najwyższy próg/);
  });

  it("import odrzuca złe dane i nadpisuje kraj bez dublowania progów", () => {
    expect(() => importujTabeleGeis(db, { fr: GEIS.FR! })).toThrow(/kod kraju/);
    expect(() => importujTabeleGeis(db, { DE: { wspGabarytowy: 0, stawki: [[100, 1]] } })).toThrow(/współczynnik/);
    expect(() => importujTabeleGeis(db, { DE: { wspGabarytowy: 200, stawki: [] } })).toThrow(/brak stawek/);
    expect(() => importujTabeleGeis(db, { DE: { wspGabarytowy: 200, stawki: [[100, 1], [100, 2]] } })).toThrow(/powtórzony/);
    importujTabeleGeis(db, { FR: { wspGabarytowy: 200, stawki: [[100, 50]] } });
    expect(sqlite.prepare("SELECT prog_kg, stawka FROM geis_stawki WHERE kraj = 'FR'").all()).toEqual([{ prog_kg: 100, stawka: 50 }]);
    expect(() => ustawPaliwo(db, "FR", -1, "2026-11-01")).toThrow(BladTransportu);
  });
});
