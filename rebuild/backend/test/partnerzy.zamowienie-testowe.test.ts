/** Ticket 267: zamówienie testowe do sprawdzenia „Utwórz w Selly”. */
import { describe, expect, it } from "vitest";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { partnerZamowienia, partnerzy, products, sellyProducts } from "../src/db/schema.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { NUMER_ZAMOWIENIA_TESTOWEGO, zalozZamowienieTestowe } from "../src/partnerzy/zamowienie-testowe.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const nowaBaza = () => {
  const { sqlite, db } = otworzBaze(":memory:");
  zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  return db;
};
const produkt = (kod: string) => ({
  kod, nazwa: `Opona ${kod}`, marka: "CEAT", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 50, cenaSprzedazy: 60, marzaPct: 10,
  dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: `IMP_${kod}`,
});

describe("zamówienie testowe Selly (ticket 267)", () => {
  it("krok tylko produkcyjny", () => {
    expect(KROKI_WDROZENIA.find((k) => k.id === "2026-10-14-partnerzy-zamowienie-testowe-selly")!.tylkoProdukcja).toBe(true);
  });

  it("odkłada krok, gdy nie ma partnera albo produktu z powiązaniem Selly", () => {
    const db = nowaBaza();
    expect(zalozZamowienieTestowe(db, "Adtyres")).toEqual({ odloz: expect.stringMatching(/brak partnera/) });
    db.insert(partnerzy).values({ nazwa: "Adtyres", aktywny: true, utworzono: "x", zmieniono: "x" }).run();
    expect(zalozZamowienieTestowe(db, "Adtyres")).toEqual({ odloz: expect.stringMatching(/powiązaniem Selly/) });
  });

  it("zakłada zamówienie raz, na produkcie z jednoznacznym powiązaniem (wieloznaczne pomija)", () => {
    const db = nowaBaza();
    db.insert(partnerzy).values({ nazwa: "Adtyres", aktywny: true, utworzono: "x", zmieniono: "x" }).run();
    db.insert(products).values([produkt("WIELE"), produkt("JEDEN")]).run();
    db.insert(sellyProducts).values([
      { kodImportu: "a", dostawca: "MO1", bridgeKod: "WIELE", sellyProductId: 1, sellyVariantId: 1 },
      { kodImportu: "b", dostawca: "MO1", bridgeKod: "WIELE", sellyProductId: 2, sellyVariantId: 2 },
      { kodImportu: "c", dostawca: "MO1", bridgeKod: "JEDEN", sellyProductId: 3, sellyVariantId: 4 },
    ]).run();
    expect(zalozZamowienieTestowe(db, "Adtyres")).toMatch(/założono.*przyjete/);
    const z = db.select().from(partnerZamowienia).all();
    expect(z).toHaveLength(1);
    expect(z[0]!.numerPartnera).toBe(NUMER_ZAMOWIENIA_TESTOWEGO);
    expect(zalozZamowienieTestowe(db, "Adtyres")).toMatch(/już istnieje/);
    expect(db.select().from(partnerZamowienia).all()).toHaveLength(1);
  });
});

describe("zamówienia symulacyjne (ticket 272)", () => {
  it("odkłada krok bez partnerów albo bez 4 produktów z powiązaniem Selly", async () => {
    const { zalozZamowieniaSymulacyjne } = await import("../src/partnerzy/zamowienie-testowe.js");
    const db = nowaBaza();
    expect(zalozZamowieniaSymulacyjne(db)).toEqual({ odloz: expect.stringMatching(/brak partnera/) });
    db.insert(partnerzy).values([
      { nazwa: "Adtyres", aktywny: true, utworzono: "x", zmieniono: "x" },
      { nazwa: "TyreWorld", aktywny: true, utworzono: "x", zmieniono: "x" },
    ]).run();
    expect(zalozZamowieniaSymulacyjne(db)).toEqual({ odloz: expect.stringMatching(/za mało/) });
  });

  it("zakłada dwa zamówienia z adresem dostawy (FR i DE), raz", async () => {
    const { zalozZamowieniaSymulacyjne, NUMER_SYMULACJI_ADTYRES, NUMER_SYMULACJI_TYREWORLD } = await import("../src/partnerzy/zamowienie-testowe.js");
    const { adresDostawy } = await import("../src/partnerzy/podglad-selly.js");
    const { szczegolyZamowieniaDlaPartnera } = await import("../src/repos/partnerzy-zamowienia.js");
    const db = nowaBaza();
    const ids = [
      Number(db.insert(partnerzy).values({ nazwa: "Adtyres", aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid),
      Number(db.insert(partnerzy).values({ nazwa: "TyreWorld", aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid),
    ];
    const kody = ["K1", "K2", "K3", "K4"];
    db.insert(products).values(kody.map((k) => produkt(k))).run();
    db.insert(sellyProducts).values(kody.map((k, i) => ({ kodImportu: `i${i}`, dostawca: "MO1", bridgeKod: k, sellyProductId: 10 + i, sellyVariantId: 20 + i }))).run();
    expect(zalozZamowieniaSymulacyjne(db)).toMatch(/Adtyres: założono TEST-SYM-ADTYRES.*TyreWorld: założono TEST-SYM-TYREWORLD/);
    const zam = db.select().from(partnerZamowienia).all();
    expect(zam.map((z) => z.numerPartnera).sort()).toEqual([NUMER_SYMULACJI_ADTYRES, NUMER_SYMULACJI_TYREWORLD].sort());
    const a = szczegolyZamowieniaDlaPartnera(db, ids[0]!, zam.find((z) => z.partnerId === ids[0])!.id)!;
    const t = szczegolyZamowieniaDlaPartnera(db, ids[1]!, zam.find((z) => z.partnerId === ids[1])!.id)!;
    expect(adresDostawy(a.dostawa)).toMatchObject({ kraj: "FR", kod: "75001", miasto: "Paris", ulica: "1 rue de l'Exemple" });
    expect(adresDostawy(t.dostawa)).toMatchObject({ kraj: "DE", kod: "12345", miasto: "Musterstadt", ulica: "Musterweg 1" });
    expect(a.pozycje).toHaveLength(2);
    expect(t.pozycje).toHaveLength(2);
    expect(zalozZamowieniaSymulacyjne(db)).toMatch(/już istnieje.*już istnieje/);
    expect(db.select().from(partnerZamowienia).all()).toHaveLength(2);
  });
});
