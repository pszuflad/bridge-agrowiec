/** Ticket 237: krok wdrożenia z konfiguracją startową partnerów. */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { partnerKraje, partnerzy, products } from "../src/db/schema.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";
import { generujPlikiPartnera } from "../src/partnerzy/generator.js";
import { naprawMagazynyDostawcow, ustawKonfiguracjeStartowa } from "../src/partnerzy/konfiguracja-startowa.js";
import { szczegolyPartnera } from "../src/repos/partnerzy.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

type Nowy = typeof products.$inferInsert;
const produkt = (kod: string, magazyn: string): Nowy => ({
  kod, nazwa: "Mitas AC85", marka: "MITAS", kategoria: "Rolnicze", dostawca: magazyn, magazyn, stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1500, marzaPct: 50,
  dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: `IMP_${kod}`, ean: "5901234123457", waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85,
});

describe("konfiguracja startowa partnerów", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-237-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "t.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    db.insert(products).values(["MO1", "MO4", "MO6", "MO7", "MO8"].map((m) => produkt(`K_${m}`, m))).run();
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const id = (nazwa: string) => db.select().from(partnerzy).all().find((p) => p.nazwa === nazwa)!.id;

  it("po kroku wdrożenia: oba partnery aktywni, magazyny bez MO6/7/8, kraje, kolumny z numerem EAN-dostawca, nazwy plików", async () => {
    const w = await uruchomKroki(sqlite, db, KROKI_WDROZENIA, {});
    expect(w.wykonane).toContain("2026-10-12-partnerzy-konfiguracja-startowa");
    const a = szczegolyPartnera(db, id("Adtyres"))!;
    expect(a).toMatchObject({ aktywny: true, nazwaPliku: "adtyres_agrowiec" });
    expect(a.magazyny).toEqual(["MO1", "MO4"]);
    expect(a.kraje.map((k) => k.kraj)).toEqual(["AT", "BE", "CZ", "DE", "FR", "HU", "IT", "LT", "LU", "LV", "NL", "RO", "SK"]);
    expect(a.kraje.every((k) => k.narzutProc === 0 && k.przesylkaStalaEur === 15)).toBe(true);
    expect(a.kolumny.map((k) => k.nazwaWPliku)).toEqual(["CatNumber", "EAN", "ProductName", "ProductBrand", "ProductModel", "ProductSize", "PriceEurNet", "StockQty", "DOT", "Warehouse"]);
    expect(a.kolumny[0]).toMatchObject({ zrodloTyp: "katalog", zrodlo: "numerPartnera" });
    const t = szczegolyPartnera(db, id("TyreWorld"))!;
    expect(t).toMatchObject({ aktywny: true, nazwaPliku: "tyreworld_agrowiec" });
    expect(t.kraje.map((k) => k.kraj).sort()).toEqual(["AT", "BE", "DE", "FR", "IT", "NL"]);
    expect(t.kolumny.map((k) => k.nazwaWPliku).slice(-6)).toEqual(["FR euro nett", "DE euro nett", "NL euro nett", "BE euro nett", "AT euro nett", "IT euro nett"]);
  });

  it("magazyny startowe to kody dostawców katalogu (bez MO6/MO7/MO8), nie fizyczne magazyny", async () => {
    sqlite.prepare("UPDATE products SET magazyn = 'Rzeszow'").run();
    await uruchomKroki(sqlite, db, KROKI_WDROZENIA, {});
    expect(szczegolyPartnera(db, id("Adtyres"))!.magazyny).toEqual(["MO1", "MO4"]);
  });

  it("naprawa: błędny wybór (fizyczne magazyny) → dostawcy bez MO6/7/8; poprawny wybór z panelu zostaje; powtarzalne", async () => {
    await uruchomKroki(sqlite, db, KROKI_WDROZENIA, {});
    const a = id("Adtyres");
    const t = id("TyreWorld");
    sqlite.prepare("DELETE FROM partner_magazyny").run();
    sqlite.prepare("INSERT INTO partner_magazyny (partner_id, magazyn) VALUES (?, 'Magazyn 1'), (?, 'Rzeszow')").run(a, a); // błąd z kroku 237
    sqlite.prepare("INSERT INTO partner_magazyny (partner_id, magazyn) VALUES (?, 'MO4')").run(t); // świadomy wybór z panelu
    const opis = naprawMagazynyDostawcow(db);
    expect(opis).toContain("Adtyres: 2 dostawców (MO1, MO4)");
    expect(opis).toContain("TyreWorld: wybór poprawny");
    expect(szczegolyPartnera(db, a)!.magazyny).toEqual(["MO1", "MO4"]);
    expect(szczegolyPartnera(db, t)!.magazyny).toEqual(["MO4"]);
    expect(naprawMagazynyDostawcow(db)).toContain("Adtyres: wybór poprawny");
  });

  it("nie nadpisuje tego, co użytkowniczka już ustawiła, i jest powtarzalne", async () => {
    await uruchomKroki(sqlite, db, KROKI_WDROZENIA, {});
    sqlite.prepare("UPDATE partner_kraje SET narzut_proc = 17, przesylka_stala_eur = 20 WHERE kraj = 'AT'").run();
    sqlite.prepare("DELETE FROM partner_magazyny").run();
    sqlite.prepare("INSERT INTO partner_magazyny (partner_id, magazyn) SELECT id, 'MO4' FROM partnerzy").run();
    const opis = ustawKonfiguracjeStartowa(db);
    expect(opis).toContain("bez zmian");
    expect(db.select().from(partnerKraje).all().filter((k) => k.kraj === "AT").every((k) => k.narzutProc === 17 && k.przesylkaStalaEur === 20)).toBe(true);
    expect(szczegolyPartnera(db, id("Adtyres"))!.magazyny).toEqual(["MO4"]);
  });

  it("pusty katalog → krok odłożony (bez zapisu); partner już skonfigurowany przez użytkowniczkę i nieaktywny nie jest aktywowany", async () => {
    sqlite.prepare("DELETE FROM products").run();
    expect(ustawKonfiguracjeStartowa(db)).toMatchObject({ odloz: expect.any(String) });
    expect(db.select().from(partnerzy).all().filter((p) => p.aktywny)).toEqual([]);

    db.insert(products).values(produkt("K_MO1", "MO1")).run();
    const pid = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, aktywny, utworzono, zmieniono) VALUES ('TyreWorld', 0, 'x', 'x')").run().lastInsertRowid);
    sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj, narzut_proc) VALUES (?, 'FR', 9)").run(pid);
    ustawKonfiguracjeStartowa(db);
    expect(szczegolyPartnera(db, pid)!.aktywny).toBe(false); // konfiguracja uzupełniona, aktywność zostawiona
    expect(szczegolyPartnera(db, pid)!.kraje.find((k) => k.kraj === "FR")!.narzutProc).toBe(9);
    expect(szczegolyPartnera(db, id("Adtyres"))!.aktywny).toBe(true);
  });

  it("do ustawienia narzutu nic się nie publikuje; po ustawieniu powstaje plik z numerem EAN-dostawca", async () => {
    await uruchomKroki(sqlite, db, KROKI_WDROZENIA, {});
    const nbp = { pobierzKursEur: async () => ({ kurs: 4.3, data: "2026-10-12" }) };
    const wyjscie = join(katalog, "out");
    const przed = await generujPlikiPartnera(db, nbp, id("Adtyres"), { katalog: wyjscie });
    expect(przed.pliki.every((p) => !p.zapisany)).toBe(true);
    expect(przed.bledy.some((b) => /Narzut kraju nie jest ustawiony/.test(b))).toBe(true);
    sqlite.prepare("UPDATE partner_kraje SET narzut_proc = 12 WHERE kraj = 'AT'").run();
    const po = await generujPlikiPartnera(db, nbp, id("Adtyres"), { katalog: wyjscie });
    expect(po.pliki.filter((p) => p.zapisany).map((p) => p.nazwa)).toEqual(["adtyres_agrowiec_at.csv"]);
    expect(readdirSync(join(wyjscie, "pricelist"))).toEqual(["adtyres_agrowiec_at.csv"]);
    const linie = readFileSync(join(wyjscie, "pricelist", "adtyres_agrowiec_at.csv"), "utf8").split("\n");
    expect(linie[0]).toBe("CatNumber;EAN;ProductName;ProductBrand;ProductModel;ProductSize;PriceEurNet;StockQty;DOT;Warehouse");
    expect(linie.slice(1, -1).map((l) => l.split(";")[0]).sort()).toEqual(["5901234123457-MO1", "5901234123457-MO4"]);
  });
});
