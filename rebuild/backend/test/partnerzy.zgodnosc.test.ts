/**
 * Zgodność cenników z plikami wzorcowymi partnerów (ticket 218, PRT-3.5).
 *
 * ⚠ Plików wzorcowych (`tyreworld_agrowiec.csv`, `adtyres_agrowiec_at.csv`) NIE MA w repo — test używa danych SYNTETYCZNYCH, które odwzorowują
 * ich kolumny, układ i opisane w karcie DEFEKTY (puste CatNumber, spacje na końcach, `-` w cenie, pusty wiersz końcowy, powtórzone pary EAN×magazyn).
 * Sprawdza własności, które muszą być prawdziwe niezależnie od danych: jeden silnik cen dla obu układów, jeden wiersz na pozycję bez agregacji magazynów,
 * brak defektów. Porównanie z prawdziwymi plikami wymaga ich dostarczenia (pytanie do użytkownika).
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { products } from "../src/db/schema.js";
import { generujPlikiPartnera } from "../src/partnerzy/generator.js";
import type { KlientNbp } from "../src/partnerzy/kurs-nbp.js";
import { importujTabeleGeis, ustawPaliwo } from "../src/partnerzy/transport.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const NBP: KlientNbp = { pobierzKursEur: async () => ({ kurs: 4.3, data: "2026-10-09" }) };
const TERAZ = new Date("2026-10-10T12:00:00.000Z");
const KRAJE = ["FR", "DE", "NL", "BE", "AT", "IT"];
type Nowy = typeof products.$inferInsert;

describe("zgodność cenników partnerów z układem plików wzorcowych", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  let wyjscie: string;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-zgodnosc-"));
    wyjscie = join(katalog, "out");
    ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const stawki: [number, number][] = [[100, 103], [200, 163], [500, 369], [2500, 1135]];
    importujTabeleGeis(db, Object.fromEntries(KRAJE.map((k) => [k, { wspGabarytowy: 250, stawki }])));
    for (const k of KRAJE) ustawPaliwo(db, k, 11, "2026-01-01");

    const baza = (kod: string, nad: Partial<Nowy> = {}): Nowy => ({
      kod, nazwa: `  Mitas   AC85 ${kod}  `, marka: "MITAS", model: " AC85 ", rozmiar: "600/65R38", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 8,
      cenaZakupu: 1000 + kod.length, cenaSprzedazy: 1500, marzaPct: 50, dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: `IMP_${kod}`, ean: "5901234123457",
      dot: "", waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85, ...nad,
    });
    const wiersze: Nowy[] = [];
    for (let i = 0; i < 300; i++) wiersze.push(baza(`MO1_${i}`, { ean: `590000000${String(i).padStart(4, "0")}` }));
    // ten sam EAN w dwóch magazynach: dwa osobne wiersze (bez agregacji)
    wiersze.push(baza("MO1_DUP", { ean: "5909999999999", magazyn: "MO1" }), baza("MO2_DUP", { ean: "5909999999999", magazyn: "MO2", cenaZakupu: 900 }));
    // defekty z plików wzorcowych
    wiersze.push(baza("", { ean: "5908888888888" }), baza("MO1_STAN0", { stan: 0 }), baza("MO1_STAN1", { stan: 1 }), baza("MO1_BEZWAGI", { waga: null }));
    db.insert(products).values(wiersze).run();
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const partner = (nazwa: string, kolumny: [string, string, string][]): number => {
    const id = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES (?, 'x', 'x')").run(nazwa).lastInsertRowid);
    for (const m of ["MO1", "MO2"]) sqlite.prepare("INSERT INTO partner_magazyny VALUES (?, ?)").run(id, m);
    for (const k of KRAJE) sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj, narzut_proc) VALUES (?, ?, 12)").run(id, k);
    kolumny.forEach(([n, t, z], i) =>
      sqlite.prepare("INSERT INTO partner_kolumny (partner_id, pozycja, nazwa_w_pliku, zrodlo_typ, zrodlo) VALUES (?, ?, ?, ?, ?)").run(id, i + 1, n, t, z));
    return id;
  };
  const czytaj = (plik: string): string[][] => {
    const tekst = readFileSync(join(wyjscie, "pricelist", plik), "utf8");
    expect(tekst.startsWith("﻿")).toBe(false);
    expect(tekst).not.toContain("\r");
    expect(tekst.endsWith("\n") && !tekst.endsWith("\n\n")).toBe(true); // brak pustego/"spacjowego" wiersza końcowego
    return tekst.slice(0, -1).split("\n").map((l) => l.split(";"));
  };

  const tyreworld = () =>
    partner("TyreWorld", [
      ["CatNumber", "katalog", "kod"], ["EAN", "katalog", "ean"], ["ProductName", "katalog", "nazwa"], ["ProductBrand", "katalog", "marka"],
      ["ProductModel", "katalog", "model"], ["ProductSize", "katalog", "rozmiar"], ["StockQty", "katalog", "stan"], ["DOT", "katalog", "dot"],
      ...KRAJE.map((k): [string, string, string] => [`${k} euro nett`, "cena", k]),
    ]);
  const adtyres = () =>
    partner("Adtyres", [
      ["CatNumber", "katalog", "kod"], ["EAN", "katalog", "ean"], ["ProductName", "katalog", "nazwa"], ["ProductBrand", "katalog", "marka"],
      ["ProductModel", "katalog", "model"], ["ProductSize", "katalog", "rozmiar"], ["PriceEurNet", "cena", "AT"], ["StockQty", "katalog", "stan"],
      ["DOT", "katalog", "dot"], ["Warehouse", "katalog", "magazyn"],
    ]);

  it("układ TyreWorld: jeden plik, 6 kolumn krajów, nagłówki bez spacji na końcu, jeden wiersz na pozycję", async () => {
    const w = await generujPlikiPartnera(db, NBP, tyreworld(), { katalog: wyjscie, teraz: () => TERAZ });
    expect(w.pliki.map((p) => p.nazwa)).toEqual(["tyreworld.csv"]);
    const [naglowek, ...wiersze] = czytaj("tyreworld.csv");
    expect(naglowek).toEqual(["CatNumber", "EAN", "ProductName", "ProductBrand", "ProductModel", "ProductSize", "StockQty", "DOT", ...KRAJE.map((k) => `${k} euro nett`)]);
    expect(wiersze).toHaveLength(302); // 300 + 2 wiersze tego samego EAN w dwóch magazynach
    expect(new Set(wiersze.map((r) => r[0])).size).toBe(wiersze.length); // numer katalogowy unikalny
    expect(wiersze.filter((r) => r[1] === "5909999999999")).toHaveLength(2); // bez agregacji magazynów
  });

  it("brak defektów plików wzorcowych: puste CatNumber, spacje na brzegach, '-' w cenach, stan < 2, brak wagi", async () => {
    const wynik = await generujPlikiPartnera(db, NBP, tyreworld(), { katalog: wyjscie, teraz: () => TERAZ });
    const [, ...wiersze] = czytaj("tyreworld.csv");
    for (const r of wiersze) {
      expect(r[0], "pusty CatNumber").not.toBe("");
      for (const komorka of r) expect(komorka, `spacje na brzegach: „${komorka}”`).toBe(komorka.trim());
      for (const cena of r.slice(8)) expect(cena).toMatch(/^\d+\.\d{2}$/); // żadnych „-”, pustych ani tekstu
      expect(Number(r[6])).toBeGreaterThanOrEqual(2);
    }
    expect(wiersze.map((r) => r[0])).not.toContain("MO1_STAN0");
    expect(wiersze.map((r) => r[0])).not.toContain("MO1_STAN1");
    expect(wiersze.map((r) => r[0])).not.toContain("MO1_BEZWAGI");
    expect(wiersze.find((r) => r[0] === "MO1_5")![2]).toBe("Mitas AC85 MO1_5"); // spacje w nazwie zwinięte
    expect(wynik.bledy.some((b) => b.includes("MO1_BEZWAGI") && b.includes("Brak wagi"))).toBe(true); // zalogowane, nie wyzerowane
  });

  it("układ Adtyres: plik na kraj, kolumny Warehouse i PriceEurNet, ta sama pozycja w dwóch magazynach = dwa wiersze", async () => {
    await generujPlikiPartnera(db, NBP, adtyres(), { katalog: wyjscie, teraz: () => TERAZ });
    const [naglowek, ...wiersze] = czytaj("adtyres_AT.csv");
    expect(naglowek).toEqual(["CatNumber", "EAN", "ProductName", "ProductBrand", "ProductModel", "ProductSize", "PriceEurNet", "StockQty", "DOT", "Warehouse"]);
    const dup = wiersze.filter((r) => r[1] === "5909999999999");
    expect(dup.map((r) => r[9]).sort()).toEqual(["MO1", "MO2"]);
    expect(new Set(wiersze.map((r) => `${r[1]}|${r[9]}`)).size).toBe(wiersze.length); // brak powtórzonych par EAN×magazyn
  });

  it("jeden silnik cen: cena AT w pliku TyreWorld jest identyczna z PriceEurNet w pliku Adtyres dla tej samej pozycji", async () => {
    await generujPlikiPartnera(db, NBP, tyreworld(), { katalog: wyjscie, teraz: () => TERAZ });
    await generujPlikiPartnera(db, NBP, adtyres(), { katalog: wyjscie, teraz: () => TERAZ });
    const tw = new Map(czytaj("tyreworld.csv").slice(1).map((r) => [r[0]!, { at: r[8 + KRAJE.indexOf("AT")]!, stan: r[6]! }]));
    const ad = czytaj("adtyres_AT.csv").slice(1);
    expect(ad.length).toBe(tw.size);
    for (const r of ad) expect(tw.get(r[0]!), r[0]).toEqual({ at: r[6], stan: r[7] });
  });

  it("skala: ~2000 pozycji generuje się w rozsądnym czasie", async () => {
    const dodatkowe: Nowy[] = Array.from({ length: 2000 }, (_, i) => ({
      kod: `BIG_${i}`, nazwa: "Opona", marka: "M", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 4, cenaZakupu: 800, cenaSprzedazy: 1000, marzaPct: 25,
      dataAktualizacji: "2026-10-10T00:00:00.000Z", waga: 40, dlugosc: 70, szerokoscPaczki: 50, wysokosc: 70,
    }));
    for (let i = 0; i < dodatkowe.length; i += 200) db.insert(products).values(dodatkowe.slice(i, i + 200)).run();
    const start = Date.now();
    const w = await generujPlikiPartnera(db, NBP, tyreworld(), { katalog: wyjscie, teraz: () => TERAZ });
    expect(w.pliki[0]!.liczbaWierszy).toBe(2302);
    expect(Date.now() - start).toBeLessThan(15_000);
  });
});
