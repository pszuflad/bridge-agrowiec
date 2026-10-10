/** Selekcja pozycji i wycena dla partnera (ticket 214, PRT-3.1). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { products } from "../src/db/schema.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { czysc, wybierzPozycje, wycenPozycje } from "../src/partnerzy/selekcja.js";
import { importujTabeleGeis } from "../src/partnerzy/transport.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

type Nowy = typeof products.$inferInsert;
const produkt = (kod: string, nadpisania: Partial<Nowy> = {}): Nowy => ({
  kod,
  nazwa: "OPONA TESTOWA",
  marka: "MITAS",
  kategoria: "Rolnicze",
  dostawca: "MO1",
  magazyn: "MO1",
  stan: 5,
  cenaZakupu: 1000,
  cenaSprzedazy: 1500,
  marzaPct: 50,
  dataAktualizacji: "2026-10-10T00:00:00.000Z",
  kodImportu: `IMP_${kod}`,
  waga: 56,
  dlugosc: 80,
  szerokoscPaczki: 60,
  wysokosc: 85,
  ...nadpisania,
});

describe("selekcja i wycena partnera", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  let partnerId: number;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-selekcja-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    partnerId = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES ('P', 'x', 'x')").run().lastInsertRowid);
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });
  const magazyny = (...m: string[]) => m.forEach((x) => sqlite.prepare("INSERT INTO partner_magazyny VALUES (?, ?)").run(partnerId, x));
  const wstaw = (...p: Nowy[]) => db.insert(products).values(p).run();

  it("czysc: przycina, zwija białe znaki, pusty → null", () => {
    expect(czysc("  Mitas   AC85 \t")).toBe("Mitas AC85");
    expect(czysc("   ")).toBeNull();
    expect(czysc(null)).toBeNull();
  });

  it("partner bez magazynów dostaje pusty wynik z ostrzeżeniem", () => {
    wstaw(produkt("A"));
    const w = wybierzPozycje(db, partnerId);
    expect(w.pozycje).toEqual([]);
    expect(w.ostrzezenia[0]).toMatch(/nie ma wybranych magazynów/);
  });

  it("bierze tylko wybrane magazyny, aktywne produkty, stan ≥ minimum, bez wykluczonych i bez ceny", () => {
    magazyny("MO1", "MO2");
    sqlite.prepare("INSERT INTO partner_wykluczenia VALUES (?, 'WYK')").run(partnerId);
    wstaw(
      produkt("OK1"),
      produkt("OK2", { magazyn: "MO2", stan: 2 }),
      produkt("INNY_MAG", { magazyn: "MO9" }),
      produkt("STAN1", { stan: 1 }),
      produkt("STAN0", { stan: 0 }),
      produkt("WYK"),
      produkt("BEZ_CENY", { cenaZakupu: 0 }),
      produkt("WSTRZYMANY", { status: "wstrzymany" }),
    );
    const w = wybierzPozycje(db, partnerId);
    expect(w.pozycje.map((p) => p.kod)).toEqual(["OK1", "OK2"]);
    expect(w.pominiete).toEqual({ stanPonizejMinimum: 2, wykluczone: 1, bezCenyZakupu: 1 });
  });

  it("stan minimalny jest ustawieniem partnera", () => {
    magazyny("MO1");
    sqlite.prepare("UPDATE partnerzy SET stan_min = 5 WHERE id = ?").run(partnerId);
    wstaw(produkt("S4", { stan: 4 }), produkt("S5", { stan: 5 }));
    expect(wybierzPozycje(db, partnerId).pozycje.map((p) => p.kod)).toEqual(["S5"]);
  });

  it("ten sam kod_importu w dwóch magazynach to dwa osobne wiersze (bez agregacji)", () => {
    magazyny("MO1", "MO2");
    wstaw(produkt("M1_X", { kodImportu: "WSPOLNY", magazyn: "MO1" }), produkt("M2_X", { kodImportu: "WSPOLNY", magazyn: "MO2", cenaZakupu: 900 }));
    const w = wybierzPozycje(db, partnerId).pozycje;
    expect(w.map((p) => [p.kod, p.kodImportu, p.magazyn])).toEqual([
      ["M1_X", "WSPOLNY", "MO1"],
      ["M2_X", "WSPOLNY", "MO2"],
    ]);
  });

  it("czyści teksty (spacje) i nie zmienia ceny ani stanu", () => {
    magazyny("MO1");
    wstaw(produkt("C1", { nazwa: "  Mitas   AC85  ", ean: " 5901234123457 ", kodImportu: " ", model: "" }));
    const p = wybierzPozycje(db, partnerId).pozycje[0]!;
    expect(p).toMatchObject({ nazwa: "Mitas AC85", ean: "5901234123457", kodImportu: null, model: null, cenaZakupu: 1000, stan: 5 });
  });

  it("wycenia pozycje dla każdego kraju; błąd w jednym kraju daje null i wpis w błędach", () => {
    magazyny("MO1");
    importujTabeleGeis(db, { FR: { wspGabarytowy: 250, stawki: [[100, 103], [200, 163], [500, 369]] } });
    sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj, narzut_proc) VALUES (?, 'FR', 12)").run(partnerId);
    sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj, narzut_proc) VALUES (?, 'DE', 10)").run(partnerId);
    wstaw(produkt("P1"), produkt("P2", { waga: null, wagaSzacowana: false }), produkt("P3", { wagaSzacowana: true }));
    const sel = wybierzPozycje(db, partnerId);
    const w = wycenPozycje(db, partnerId, sel.pozycje, { FR: 4.3, DE: 4.3 }, "2026-10-10");
    expect(w.wiersze).toHaveLength(3);
    expect(w.wiersze[0]!.ceny.FR).toBeGreaterThan(0);
    expect(w.wiersze[0]!.ceny.DE).toBeNull(); // brak tabeli GEIS dla DE
    expect(w.wiersze[1]!.ceny.FR).toBeNull(); // brak wagi
    expect(w.bledy.filter((b) => b.kraj === "FR").map((b) => b.kod)).toEqual(["P2"]);
    expect(w.bledy.filter((b) => b.kraj === "DE")).toHaveLength(3);
    expect(w.ostrzezenia).toEqual(["P3: waga szacowana (mniej pewna)."]);
  });

  it("brak kursu dla kraju jest błędem kalkulacji, nie ceną", () => {
    magazyny("MO1");
    sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj) VALUES (?, 'FR')").run(partnerId);
    wstaw(produkt("K1"));
    const w = wycenPozycje(db, partnerId, wybierzPozycje(db, partnerId).pozycje, {}, "2026-10-10");
    expect(w.wiersze[0]!.ceny.FR).toBeNull();
    expect(w.bledy[0]!.powod).toMatch(/Brak kursu/);
  });
});
