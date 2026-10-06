// Lokalne foldery cenników (MO#_…) zamiast starych adresów agroopony.eu/imports.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { suppliers } from "../src/db/schema.js";
import { czyStareZrodlo, folderDostawcy, najnowszyPlik, zapiszCsvZRekordow } from "../src/import/katalog-importow.js";
import { synchronizujDostawce } from "../src/import/synchronizuj.js";
import { stworzTestowaBaze } from "./gate/baza.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "importy-"));
  mkdirSync(join(root, "MO1_abc"));
  mkdirSync(join(root, "MO10_def"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.IMPORTY_KATALOG;
});

describe("katalog importów", () => {
  it("stare źródło: brak URL-a lub agroopony.eu/imports; obce hosty zostają", () => {
    expect(czyStareZrodlo(null)).toBe(true);
    expect(czyStareZrodlo("https://agroopony.eu/imports/acc_ftp3/x.csv")).toBe(true);
    expect(czyStareZrodlo("https://sklep.kolarolnicze.pl/offer/export/a.csv")).toBe(false);
    expect(czyStareZrodlo("http://46.238.100.138:5844/c.csv")).toBe(false);
  });

  it("MO1 nie łapie folderu MO10", () => {
    expect(folderDostawcy(root, "MO1")).toBe(join(root, "MO1_abc"));
    expect(folderDostawcy(root, "MO10")).toBe(join(root, "MO10_def"));
    expect(folderDostawcy(root, "MO2")).toBeNull();
  });

  it("bierze najnowszy CSV/XLSX, pomija inne rozszerzenia i pliki ukryte", () => {
    const f = join(root, "MO1_abc");
    writeFileSync(join(f, "stary.csv"), "a");
    writeFileSync(join(f, "nowy.xlsx"), "b");
    writeFileSync(join(f, "notatka.txt"), "c");
    writeFileSync(join(f, ".ukryty.csv"), "d");
    utimesSync(join(f, "stary.csv"), 1000, 1000);
    utimesSync(join(f, "nowy.xlsx"), 2000, 2000);
    utimesSync(join(f, "notatka.txt"), 3000, 3000);
    utimesSync(join(f, ".ukryty.csv"), 4000, 4000);
    expect(najnowszyPlik(root, "MO1").nazwa).toBe("nowy.xlsx");
  });

  it("pusty folder i brak folderu dają czytelny błąd", () => {
    expect(() => najnowszyPlik(root, "MO1")).toThrow(/Brak pliku CSV\/XLSX/);
    expect(() => najnowszyPlik(root, "MO7")).toThrow(/Brak folderu/);
  });

  it("zapis CSV z rekordów: unia kolumn, cytowanie, bez plików tymczasowych", () => {
    const bufor = zapiszCsvZRekordow(root, "MO10", "api.csv", [{ a: 1, b: 'x;"y"' }, { a: 2, c: "z" }]);
    const tresc = readFileSync(join(root, "MO10_def", "api.csv"), "utf8");
    expect(tresc).toBe('﻿a;b;c\r\n1;"x;""y""";\r\n2;;z\r\n');
    expect(bufor.toString("utf8")).toBe(tresc);
  });

  it("synchronizacja ze starym URL-em czyta folder, nie sieć; pusty folder → alert", async () => {
    process.env.IMPORTY_KATALOG = root;
    const b = stworzTestowaBaze();
    try {
      b.db
        .insert(suppliers)
        .values({ kod: "MO1", nazwa: "Bohnenkamp", formatPliku: "csv", sposobDostarczania: "url", czestotliwoscMinuty: 60, url: "https://agroopony.eu/imports/bohnenkamp.csv", status: "aktywny" })
        .run();
      const wynik = await synchronizujDostawce({ db: b.db, odstepPonowienMs: 0 })("MO1", { recznie: true });
      expect(wynik).toEqual({ ok: false, error: "Brak pliku CSV/XLSX w folderze dostawcy MO1" });
    } finally {
      b.posprzataj();
    }
  });
});
