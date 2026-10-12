/** Format zamówienia TyreWorld `bestellung` (TopM R6) obok `DOCUMENTORDER` Adtyres (ticket 234). Fixtures zanonimizowane. */
import { describe, expect, it } from "vitest";

import { BladZamowienia, parsujZamowienie } from "../src/partnerzy/zamowienie-xml.js";
import { XML_BESTELLUNG } from "./partnerzy.zamowienie-bestellung-przyklad.js";
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
const poz = (artnr: string, menge: string, preis = "<preis>10.00</preis>") => `<pos><artnr>${artnr}</artnr><menge>${menge}</menge>${preis}</pos>`;
const zam = (pozycje: string, numer = "<bestellnummer>1</bestellnummer>") => `<bestellung>${numer}<positionen>${pozycje}</positionen></bestellung>`;

describe("parsujZamowienie — bestellung (TyreWorld)", () => {
  it("czyta zamówienie: numer, data, kraj z lkz, pozycje (artnr jako tekst, ceny, nazwy)", () => {
    const z = parsujZamowienie(XML_BESTELLUNG);
    expect(z).toMatchObject({ numerPartnera: "2026-100000001", dataZamowienia: "2026-03-04 12:24:40", dataDostawy: null, waluta: null, kosztDostawy: null, krajDostawy: "DE", faktura: {} });
    expect(z.pozycje).toEqual([
      { lp: 1, kod: "011300258", nazwa: "CONTINENTAL 420/70 R24 TL 130/133D TRACTOR 70", ilosc: 1, cenaSprzedazy: 779.06 },
      { lp: 2, kod: "013100077", nazwa: "KLEBER 320/85 R36 TL 128/125A8 TRAKER", ilosc: 2, cenaSprzedazy: 650.08 },
    ]);
  });

  it("adres dostawy trafia do mapy `dostawa`; uwagi i neutralversand zapisane pod oryginalnymi nazwami; puste pola puste", () => {
    const { dostawa } = parsujZamowienie(XML_BESTELLUNG);
    expect(dostawa).toMatchObject({ name: "Max Mustermann +490000000000", strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt", lkz: "DE", email: "kontakt@example.test", telefon: "+49(0)000000000" });
    expect(dostawa).toMatchObject({ neutralversand: "true", bemerkung: "Bitte vor Lieferung anrufen" });
    expect(dostawa).not.toHaveProperty("bemerkungintern"); // pusta uwaga wewnętrzna nie tworzy wpisu
    expect(dostawa.land).toBe("");
  });

  it("komentarze w elementach i CDATA nie przeszkadzają; `preis` jest opcjonalny; brak lieferadresse = kraj null", () => {
    const z = parsujZamowienie(zam(`${poz("A1", "3", "")}${poz("B29FK", "1")}`));
    expect(z.pozycje.map((p) => [p.kod, p.ilosc, p.cenaSprzedazy])).toEqual([["A1", 3, null], ["B29FK", 1, 10]]);
    expect(z.krajDostawy).toBeNull();
    expect(z.dostawa).toEqual({});
  });

  it("błędy strukturalne: brak numeru, pozycji, artnr, zła ilość, zła cena — wszystkie naraz", () => {
    expect(blad("<bestellung><positionen/></bestellung>")).toEqual(["Brak numeru zamówienia (bestellnummer).", "Brak pozycji zamówienia (positionen/pos)."]);
    const wiele = blad(zam("<pos><menge>1</menge></pos>" + poz("X", "0") + poz("Y", "1.5", "<preis>abc</preis>")));
    expect(wiele).toEqual([
      "Pozycja 1: brak artnr.",
      "Pozycja 2: menge musi być liczbą całkowitą ≥ 1.",
      "Pozycja 3: menge musi być liczbą całkowitą ≥ 1.",
      "Pozycja 3: preis nie jest poprawną ceną.",
    ]);
  });

  it("nieznany element główny: komunikat wymienia obsługiwane formaty", () => {
    expect(blad("<order><x/></order>")[0]).toMatch(/Nieznany format.*<order>.*DOCUMENTORDER, bestellung/);
  });

  it("oba formaty dają ten sam kształt `Zamowienie` (klucze), a DOCUMENTORDER działa jak dotąd", () => {
    expect(Object.keys(parsujZamowienie(XML_BESTELLUNG)).sort()).toEqual(Object.keys(parsujZamowienie(XML_PRZYKLAD)).sort());
    expect(parsujZamowienie(XML_PRZYKLAD).numerPartnera).toBe("A01UF90224");
  });

  it("DOCTYPE/ENTITY nadal odrzucane także w formacie bestellung", () => {
    expect(blad(`<!DOCTYPE x [<!ENTITY a "b">]>${XML_BESTELLUNG}`)[0]).toMatch(/DOCTYPE/);
  });

  it("przypadki brzegowe: pusty `preis` i `lkz`, `lieferadresse` bez `lkz`, przecinek w `menge`/`preis`", () => {
    const z = parsujZamowienie(`<bestellung><bestellnummer>N1</bestellnummer><lieferadresse><lkz></lkz><ort>X</ort></lieferadresse><positionen>${poz("A1", "2", "<preis></preis>")}${poz("A2", "1", "<preis>12,50</preis>")}</positionen></bestellung>`);
    expect(z.krajDostawy).toBeNull();
    expect(z.dostawa).toMatchObject({ lkz: "", ort: "X" });
    expect(z.pozycje.map((p) => p.cenaSprzedazy)).toEqual([null, 12.5]);
    expect(parsujZamowienie(zam(poz("A1", "1"))).krajDostawy).toBeNull(); // brak lieferadresse
    expect(blad(zam(poz("A1", "dwa")))[0]).toMatch(/menge/);
    expect(parsujZamowienie(zam(poz("A1", "2,0"))).pozycje[0]!.ilosc).toBe(2); // przecinek dziesiętny przyjmowany jak kropka: „2,0” = 2
  });

  it("elementy rozróżniane są wielkością liter: `Bestellung` to nieznany format", () => {
    expect(blad(XML_BESTELLUNG.replace(/bestellung>/g, "Bestellung>").replace("<bestellung", "<Bestellung"))[0]).toMatch(/Nieznany format.*<Bestellung>/);
  });
});
