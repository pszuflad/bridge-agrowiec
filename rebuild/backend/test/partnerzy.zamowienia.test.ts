/** Repo zamówień partnerów (ticket 227, PRT-7.1): idempotencja po NUMBER, zmiana treści, kaskada, izolacja partnerów. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { partnerzy } from "../src/db/schema.js";
import { BladZamowienia } from "../src/partnerzy/zamowienie-xml.js";
import { listaZamowien, szczegolyZamowienia, zapiszZamowienie } from "../src/repos/partnerzy-zamowienia.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

describe("repo zamówień partnerów", () => {
  let s: SrodowiskoTestowe;
  let partnerA: number;
  let partnerB: number;

  beforeEach(async () => {
    s = await stworzSrodowiskoTestowe();
    const teraz = "2026-10-10T00:00:00.000Z";
    const dodaj = (nazwa: string): number =>
      Number(s.db.insert(partnerzy).values({ nazwa, utworzono: teraz, zmieniono: teraz }).run().lastInsertRowid);
    partnerA = dodaj("TyreWorld");
    partnerB = dodaj("Adtyres");
  });
  afterEach(() => s.posprzataj());

  it("zapisuje zamówienie z pozycjami; numer własny jest pusty, status 'nowe'", () => {
    const w = zapiszZamowienie(s.db, partnerA, XML_PRZYKLAD);
    expect(w).toMatchObject({ nowe: true, zmieniony: false });
    const z = szczegolyZamowienia(s.db, w.id)!;
    expect(z).toMatchObject({ numerPartnera: "A01UF90224", numerWlasny: null, status: "nowe", waluta: "EUR", krajDostawy: "AT" });
    expect(z.pozycje.map((p) => [p.lp, p.kod, p.ilosc, p.cenaSprzedazy])).toEqual([[1, "011200284", 2, 202], [2, "0102 00001", 1, 99.5]]);
    expect(z.dostawa.CUSTOMERNAME).toBe("Jan Kowalski");
    expect(z.surowyXml).toBe(XML_PRZYKLAD);
  });

  it("ten sam plik drugi raz nie tworzy duplikatu (idempotencja po NUMBER)", () => {
    const a = zapiszZamowienie(s.db, partnerA, XML_PRZYKLAD);
    const b = zapiszZamowienie(s.db, partnerA, XML_PRZYKLAD);
    expect(b).toEqual({ id: a.id, nowe: false, zmieniony: false });
    expect(listaZamowien(s.db, partnerA)).toHaveLength(1);
  });

  it("ten sam numer ze zmienioną treścią: sygnalizuje zmianę, ale nie nadpisuje zapisanego", () => {
    const a = zapiszZamowienie(s.db, partnerA, XML_PRZYKLAD);
    const inny = XML_PRZYKLAD.replace("<ORDERQUANTITY>2</ORDERQUANTITY>", "<ORDERQUANTITY>5</ORDERQUANTITY>");
    expect(zapiszZamowienie(s.db, partnerA, inny)).toEqual({ id: a.id, nowe: false, zmieniony: true });
    expect(szczegolyZamowienia(s.db, a.id)!.pozycje[0]!.ilosc).toBe(2);
  });

  it("zmiana samych białych znaków nie jest zmianą zamówienia", () => {
    const a = zapiszZamowienie(s.db, partnerA, XML_PRZYKLAD);
    expect(zapiszZamowienie(s.db, partnerA, "\n" + XML_PRZYKLAD.replace(/>\s+</g, "><") + "\n")).toEqual({ id: a.id, nowe: false, zmieniony: false });
  });

  it("numer jest unikalny per partner: ten sam numer u innego partnera to osobne zamówienie", () => {
    const a = zapiszZamowienie(s.db, partnerA, XML_PRZYKLAD);
    const b = zapiszZamowienie(s.db, partnerB, XML_PRZYKLAD);
    expect(b.nowe).toBe(true);
    expect(b.id).not.toBe(a.id);
    expect(listaZamowien(s.db, partnerA)).toHaveLength(1);
    expect(listaZamowien(s.db, partnerB)).toHaveLength(1);
  });

  it("błędny plik nic nie zapisuje", () => {
    expect(() => zapiszZamowienie(s.db, partnerA, "<DOCUMENTORDER><NUMBER>9</NUMBER></DOCUMENTORDER>")).toThrow(BladZamowienia);
    expect(listaZamowien(s.db, partnerA)).toHaveLength(0);
  });

  it("usunięcie partnera kasuje jego zamówienia i pozycje", () => {
    const a = zapiszZamowienie(s.db, partnerA, XML_PRZYKLAD);
    s.sqlite.prepare("DELETE FROM partnerzy WHERE id = ?").run(partnerA);
    expect(szczegolyZamowienia(s.db, a.id)).toBeNull();
    expect(s.sqlite.prepare("SELECT count(*) AS c FROM partner_zamowienia_pozycje").get()).toEqual({ c: 0 });
  });
});
