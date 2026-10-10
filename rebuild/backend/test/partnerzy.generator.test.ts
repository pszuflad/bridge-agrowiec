/** Generator cennika partnera (ticket 217, PRT-3.4) — NBP zawsze atrapą. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { products } from "../src/db/schema.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { generujPlikiPartnera, wyczyscArchiwum } from "../src/partnerzy/generator.js";
import type { KlientNbp } from "../src/partnerzy/kurs-nbp.js";
import { importujTabeleGeis, ustawPaliwo } from "../src/partnerzy/transport.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const NBP: KlientNbp = { pobierzKursEur: async () => ({ kurs: 4.3, data: "2026-10-09" }) };
const NBP_AWARIA: KlientNbp = { pobierzKursEur: async () => { throw new Error("timeout"); } };
const TERAZ = new Date("2026-10-10T12:00:00.000Z");
type Nowy = typeof products.$inferInsert;
const produkt = (kod: string, nad: Partial<Nowy> = {}): Nowy => ({
  kod, nazwa: "Mitas AC85", marka: "MITAS", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1500, marzaPct: 50,
  dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: `IMP_${kod}`, ean: "5901234123457", waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85, ...nad,
});

describe("generator cennika partnera", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  let wyjscie: string;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-gen-"));
    wyjscie = join(katalog, "partner");
    ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const stawki: [number, number][] = [[100, 103], [200, 163], [500, 369]];
    importujTabeleGeis(db, { FR: { wspGabarytowy: 250, stawki }, DE: { wspGabarytowy: 200, stawki }, AT: { wspGabarytowy: 200, stawki } });
    for (const k of ["FR", "DE", "AT"]) ustawPaliwo(db, k, 11, "2026-01-01");
    db.insert(products).values([produkt("A"), produkt("B", { stan: 9, nazwa: "Alliance 350" }), produkt("C", { stan: 0 })]).run();
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const partner = (nazwa: string, kraje: string[], kolumny: [string, string, string][], nad = ""): number => {
    const id = Number(sqlite.prepare(`INSERT INTO partnerzy (nazwa, utworzono, zmieniono${nad ? ", format_pliku" : ""}) VALUES (?, 'x', 'x'${nad ? ", ?" : ""})`).run(...(nad ? [nazwa, nad] : [nazwa])).lastInsertRowid);
    sqlite.prepare("INSERT INTO partner_magazyny VALUES (?, 'MO1')").run(id);
    for (const k of kraje) sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj, narzut_proc) VALUES (?, ?, 12)").run(id, k);
    kolumny.forEach(([nazwa, typ, zrodlo], i) =>
      sqlite.prepare("INSERT INTO partner_kolumny (partner_id, pozycja, nazwa_w_pliku, zrodlo_typ, zrodlo) VALUES (?, ?, ?, ?, ?)").run(id, i + 1, nazwa, typ, zrodlo));
    return id;
  };
  const wczytaj = (nazwa: string) => readFileSync(join(wyjscie, "pricelist", nazwa), "utf8");

  it("ceny dwóch krajów w kolumnach → jeden plik; zapis w pricelist/, kopia w archive/, kurs zapisany", async () => {
    const id = partner("TyreWorld", ["FR", "DE"], [["CatNumber", "katalog", "kod"], ["StockQty", "katalog", "stan"], ["FR euro nett ", "cena", "FR"], ["DE euro nett", "cena", "DE"]]);
    const w = await generujPlikiPartnera(db, NBP, id, { katalog: wyjscie, teraz: () => TERAZ });
    expect(w.pliki).toEqual([{ nazwa: "tyreworld.csv", kraj: null, liczbaWierszy: 2, pominiete: 0, zapisany: true }]);
    const linie = wczytaj("tyreworld.csv").split("\n");
    expect(linie[0]).toBe("CatNumber;StockQty;FR euro nett;DE euro nett");
    expect(linie).toHaveLength(4); // nagłówek + A + B + pusty po ostatnim LF
    expect(linie[1]).toMatch(/^A;5;\d+\.\d{2};\d+\.\d{2}$/);
    expect(w.pozycjeWybrane).toBe(2); // C ma stan 0 < 2
    expect(readdirSync(join(wyjscie, "archive"))).toEqual(["20261010_120000_tyreworld.csv"]);
    expect(readdirSync(join(wyjscie, "pricelist"))).toEqual(["tyreworld.csv"]); // brak plików tymczasowych
    const kursy = sqlite.prepare("SELECT kraj, kurs, zrodlo, plik FROM partner_kursy ORDER BY kraj").all();
    expect(kursy).toEqual([
      { kraj: "DE", kurs: 4.3, zrodlo: "nbp", plik: "tyreworld.csv" },
      { kraj: "FR", kurs: 4.3, zrodlo: "nbp", plik: "tyreworld.csv" },
    ]);
  });

  it("jedna kolumna ceny → osobny plik na kraj, każdy z ceną swojego kraju", async () => {
    const id = partner("Adtyres", ["AT", "FR"], [["CatNumber", "katalog", "kod"], ["PriceEurNet", "cena", "AT"]]);
    const w = await generujPlikiPartnera(db, NBP, id, { katalog: wyjscie, teraz: () => TERAZ });
    expect(w.pliki.map((p) => p.nazwa)).toEqual(["adtyres_AT.csv", "adtyres_FR.csv"]);
    const at = wczytaj("adtyres_AT.csv");
    const fr = wczytaj("adtyres_FR.csv");
    expect(at.split("\n")[0]).toBe("CatNumber;PriceEurNet");
    expect(at).not.toBe(fr); // różne współczynniki gabarytowe/stawki → różne ceny
    expect(sqlite.prepare("SELECT kraj, plik FROM partner_kursy ORDER BY kraj").all()).toEqual([
      { kraj: "AT", plik: "adtyres_AT.csv" },
      { kraj: "FR", plik: "adtyres_FR.csv" },
    ]);
  });

  it("format xml → plik XML na kraj", async () => {
    const id = partner("Ceneo Partner", ["AT"], [["CatNumber", "katalog", "kod"], ["Cena", "cena", "AT"]], "xml");
    const w = await generujPlikiPartnera(db, NBP, id, { katalog: wyjscie, teraz: () => TERAZ });
    expect(w.pliki[0]).toMatchObject({ nazwa: "ceneo_partner_AT.xml", zapisany: true });
    expect(wczytaj("ceneo_partner_AT.xml")).toContain('<o id="A" price="');
  });

  it("awaria NBP: używa ostatniego zapisanego kursu i ostrzega; bez żadnego kursu — nic nie zapisuje", async () => {
    const id = partner("P", ["AT"], [["CatNumber", "katalog", "kod"], ["Cena", "cena", "AT"]]);
    const bez = await generujPlikiPartnera(db, NBP_AWARIA, id, { katalog: wyjscie, teraz: () => TERAZ });
    expect(bez.pliki[0]!.zapisany).toBe(false);
    expect(bez.bledy.join("\n")).toMatch(/AT: NBP nie odpowiada.*nie ma żadnego zapisanego kursu/);
    expect(existsSync(join(wyjscie, "pricelist", "p_AT.csv"))).toBe(false);

    await generujPlikiPartnera(db, NBP, id, { katalog: wyjscie, teraz: () => TERAZ });
    const z = await generujPlikiPartnera(db, NBP_AWARIA, id, { katalog: wyjscie, teraz: () => TERAZ });
    expect(z.pliki[0]!.zapisany).toBe(true);
    expect(z.ostrzezenia.join("\n")).toMatch(/AT: NBP nie odpowiada.*użyto ostatniego zapisanego kursu 4\.3/);
    expect(z.kursy.AT).toMatchObject({ zrodlo: "nbp-zapisany" });
  });

  it("pusty wynik nie nadpisuje poprzedniego cennika", async () => {
    const id = partner("P", ["AT"], [["CatNumber", "katalog", "kod"], ["Cena", "cena", "AT"]]);
    await generujPlikiPartnera(db, NBP, id, { katalog: wyjscie, teraz: () => TERAZ });
    const przed = wczytaj("p_AT.csv");
    sqlite.prepare("DELETE FROM partner_magazyny").run();
    sqlite.prepare("INSERT INTO partner_magazyny VALUES (?, 'NIEISTNIEJACY')").run(id);
    const w = await generujPlikiPartnera(db, NBP, id, { katalog: wyjscie, teraz: () => TERAZ });
    expect(w.pliki[0]).toMatchObject({ zapisany: false, liczbaWierszy: 0 });
    expect(w.bledy.join("\n")).toMatch(/brak wierszy.*bez zmian/);
    expect(wczytaj("p_AT.csv")).toBe(przed);
  });

  it("błędy kalkulacji trafiają do raportu, a pozycje bez ceny wypadają z pliku", async () => {
    const id = partner("P", ["AT"], [["CatNumber", "katalog", "kod"], ["Cena", "cena", "AT"]]);
    db.insert(products).values(produkt("BEZ_WAGI", { waga: null })).run();
    const w = await generujPlikiPartnera(db, NBP, id, { katalog: wyjscie, teraz: () => TERAZ });
    expect(w.bledy).toContain("Błąd kalkulacji BEZ_WAGI (AT): Błąd kalkulacji transportu (AT): Brak wagi pozycji.");
    expect(w.pliki[0]).toMatchObject({ liczbaWierszy: 2, pominiete: 1 });
    expect(wczytaj("p_AT.csv")).not.toContain("BEZ_WAGI");
  });

  it("błędy konfiguracji: brak krajów, brak kolumn, zła kolumna", async () => {
    const bezKrajow = partner("B1", [], [["X", "katalog", "kod"]]);
    expect((await generujPlikiPartnera(db, NBP, bezKrajow, { katalog: wyjscie })).bledy[0]).toMatch(/nie ma żadnego kraju/);
    const bezKolumn = partner("B2", ["AT"], []);
    expect((await generujPlikiPartnera(db, NBP, bezKolumn, { katalog: wyjscie })).bledy[0]).toMatch(/nie ma skonfigurowanych kolumn/);
    const zla = partner("B3", ["AT"], [["X", "katalog", "haslo_hash"]]);
    expect((await generujPlikiPartnera(db, NBP, zla, { katalog: wyjscie })).bledy[0]).toMatch(/Błąd konfiguracji kolumn.*nieznane pole/);
    await expect(generujPlikiPartnera(db, NBP, 999, { katalog: wyjscie })).rejects.toThrow(/Nie ma partnera/);
  });

  it("wyczyscArchiwum usuwa tylko pliki starsze niż 30 dni, po znaczniku z nazwy", () => {
    const arch = join(katalog, "arch");
    mkdirSync(arch);
    for (const n of ["20260909_120000_stary.csv", "20260911_120000_graniczny.csv", "20261009_120000_swiezy.csv", "obcy.txt"]) writeFileSync(join(arch, n), "x");
    utimesSync(join(arch, "obcy.txt"), new Date("2020-01-01"), new Date("2020-01-01"));
    expect(wyczyscArchiwum(arch, TERAZ)).toBe(1); // 2026-09-09 jest 31 dni przed 2026-10-10
    expect(readdirSync(arch).sort()).toEqual(["20260911_120000_graniczny.csv", "20261009_120000_swiezy.csv", "obcy.txt"]);
    expect(wyczyscArchiwum(join(katalog, "nie-ma"), TERAZ)).toBe(0);
  });
});
