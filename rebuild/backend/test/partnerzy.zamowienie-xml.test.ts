/** Parser zamówienia partnera `DOCUMENTORDER` (ticket 227, PRT-7.1). */
import { describe, expect, it } from "vitest";

import { BladZamowienia, parsujZamowienie } from "../src/partnerzy/zamowienie-xml.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

const blad = (xml: string): string[] => {
  try {
    parsujZamowienie(xml);
  } catch (e) {
    if (e instanceof BladZamowienia) return e.bledy;
    throw e;
  }
  throw new Error("oczekiwano BladZamowienia");
};

describe("parsujZamowienie", () => {
  it("czyta przykład z karty: numer zamówienia z korzenia (nie z INVOICE), nagłówek, pozycje, dostawę", () => {
    const z = parsujZamowienie(XML_PRZYKLAD);
    expect(z).toMatchObject({
      numerPartnera: "A01UF90224",
      dataZamowienia: "2024-02-02 11:27:11",
      dataDostawy: "2024-02-02",
      waluta: "EUR",
      kosztDostawy: 0,
      krajDostawy: "AT",
    });
    expect(z.faktura).toMatchObject({ NUMBER: "A01UF90224", COUNTRY: "AD" });
    expect(z.dostawa).toMatchObject({ CUSTOMERNAME: "Jan Kowalski", PHONE: "+43 1 234" });
    expect(z.pozycje).toEqual([
      { lp: 1, kod: "011200284", nazwa: "Ceat Farmax R70 280/70 R18 114A8/B", ilosc: 2, cenaSprzedazy: 202 },
      { lp: 2, kod: "0102 00001", nazwa: "Opona & felga <test>", ilosc: 1, cenaSprzedazy: 99.5 },
    ]);
  });

  it("CODE zostaje tekstem — zera wiodące są zachowane", () => {
    expect(parsujZamowienie(XML_PRZYKLAD).pozycje[0]!.kod).toBe("011200284");
  });

  it("obsługuje CDATA, BOM, komentarze i encje numeryczne", () => {
    const xml = `${"\uFEFF"}<!-- c --><DOCUMENTORDER><NUMBER>X&#49;</NUMBER><PRODUCTS><PRODUCT><CODE><![CDATA[00<1>]]></CODE><ORDERQUANTITY>3</ORDERQUANTITY></PRODUCT></PRODUCTS></DOCUMENTORDER>`;
    const z = parsujZamowienie(xml);
    expect(z.numerPartnera).toBe("X1");
    expect(z.pozycje[0]).toMatchObject({ kod: "00<1>", ilosc: 3, cenaSprzedazy: null, nazwa: null });
    expect(z.kosztDostawy).toBeNull();
  });

  it("odrzuca DOCTYPE/ENTITY (XXE, billion laughs)", () => {
    const xml = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><DOCUMENTORDER><NUMBER>&a;</NUMBER></DOCUMENTORDER>`;
    expect(blad(xml)[0]).toMatch(/DOCTYPE/);
  });

  it("zgłasza błędy strukturalne: zły XML, zły korzeń, brak numeru i pozycji", () => {
    expect(blad("to nie jest xml")[0]).toMatch(/Niepoprawny XML/);
    expect(blad("<DOCUMENTORDER><NUMBER>1</DOCUMENTORDER>")[0]).toMatch(/zamknięcie|niezamknięty/);
    expect(blad("<A><NUMBER>1</NUMBER></A>")[0]).toMatch(/DOCUMENTORDER/);
    expect(blad("<DOCUMENTORDER><INVOICE><NUMBER>1</NUMBER></INVOICE><PRODUCTS/></DOCUMENTORDER>")).toEqual([
      "Brak numeru zamówienia (NUMBER).",
      "Brak pozycji zamówienia (PRODUCTS/PRODUCT).",
    ]);
  });

  it("zgłasza wszystkie błędy pozycji naraz", () => {
    const xml = `<DOCUMENTORDER><NUMBER>1</NUMBER><PRODUCTS>
      <PRODUCT><NAME>bez kodu</NAME><ORDERQUANTITY>1</ORDERQUANTITY></PRODUCT>
      <PRODUCT><CODE>A</CODE><ORDERQUANTITY>0</ORDERQUANTITY></PRODUCT>
      <PRODUCT><CODE>B</CODE><ORDERQUANTITY>1.5</ORDERQUANTITY><SELL_PRICE>abc</SELL_PRICE></PRODUCT>
    </PRODUCTS></DOCUMENTORDER>`;
    expect(blad(xml)).toEqual([
      "Pozycja 1: brak CODE.",
      "Pozycja 2: ORDERQUANTITY musi być liczbą całkowitą ≥ 1.",
      "Pozycja 3: ORDERQUANTITY musi być liczbą całkowitą ≥ 1.",
      "Pozycja 3: SELL_PRICE nie jest poprawną ceną.",
    ]);
  });

  it("nie sprawdza biznesu: nieznany kod i dowolna cena przechodzą parser (to zadanie PRT-7.4)", () => {
    const xml = `<DOCUMENTORDER><NUMBER>1</NUMBER><PRODUCTS><PRODUCT><CODE>NIEISTNIEJE</CODE><ORDERQUANTITY>99999</ORDERQUANTITY><SELL_PRICE>0.01</SELL_PRICE></PRODUCT></PRODUCTS></DOCUMENTORDER>`;
    expect(parsujZamowienie(xml).pozycje).toHaveLength(1);
  });
});
