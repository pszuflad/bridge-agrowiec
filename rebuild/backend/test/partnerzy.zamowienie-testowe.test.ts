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
