/** Szablon XML (wzorzec Ceneo) cennika partnera (ticket 216, PRT-3.3). */
import { describe, expect, it } from "vitest";

import { parsujFormule } from "../src/partnerzy/formula.js";
import type { KolumnaPliku } from "../src/partnerzy/plik-csv.js";
import { escapujXml, zbudujXml } from "../src/partnerzy/plik-xml.js";
import type { PozycjaEksportu, WierszWyceniony } from "../src/partnerzy/selekcja.js";

const pozycja = (kod: string, nad: Partial<PozycjaEksportu> = {}): PozycjaEksportu => ({
  id: 1, kod, kodImportu: `IMP_${kod}`, ean: "5901234123457", nazwa: "Mitas AC85", marka: "MITAS", model: null, rozmiar: "600/65R38",
  kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, dot: null, cenaZakupu: 1000, waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85,
  wagaAutoUzupelniona: false, wagaSzacowana: false, ...nad,
});
const wiersz = (kod: string, ceny: Record<string, number | null>, nad: Partial<PozycjaEksportu> = {}): WierszWyceniony => ({ pozycja: pozycja(kod, nad), ceny });

const KOLUMNY: KolumnaPliku[] = [
  { nazwa: "CatNumber", typ: "katalog", pole: "kod" },
  { nazwa: "EAN", typ: "katalog", pole: "ean" },
  { nazwa: "ProductName", typ: "katalog", pole: "nazwa" },
  { nazwa: "StockQty", typ: "katalog", pole: "stan" },
  { nazwa: "PriceEurNet", typ: "cena", kraj: "AT" },
  { nazwa: "DAP", typ: "pole", pole: "dap", formula: parsujFormule("cena_AT + 10") },
];

/** Sprawdza dobrze uformowanie: dopasowanie otwierających i zamykających znaczników, brak surowych `&`/`<` w tekście. */
function dobrzeUformowany(xml: string): boolean {
  const stos: string[] = [];
  for (const m of xml.replace(/<\?xml[^>]*\?>/, "").matchAll(/<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g)) {
    if (m[4]) continue;
    if (m[1]) {
      if (stos.pop() !== m[2]) return false;
    } else stos.push(m[2]!);
  }
  const tekst = xml.replace(/<[^>]*>/g, "");
  return stos.length === 0 && !/&(?!amp;|lt;|gt;|quot;|apos;)/.test(tekst) && !/[<>]/.test(tekst);
}

describe("zbudujXml (Ceneo)", () => {
  it("buduje ofertę z id, ceną, dostępnością, stanem, kategorią, nazwą i atrybutami", () => {
    const w = zbudujXml({ kolumny: KOLUMNY, kraj: "AT", wiersze: [wiersz("A", { AT: 202 })] });
    expect(w.tekst).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<offers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" version="1">\n' +
        '  <group name="other">\n' +
        '    <o id="A" price="202.00" avail="1" stock="5">\n' +
        "      <cat>Rolnicze</cat>\n" +
        "      <name>Mitas AC85</name>\n" +
        "      <attrs>\n" +
        '        <a name="EAN">5901234123457</a>\n' +
        '        <a name="PriceEurNet">202.00</a>\n' +
        '        <a name="DAP">212</a>\n' +
        "      </attrs>\n" +
        "    </o>\n" +
        "  </group>\n" +
        "</offers>\n",
    );
    expect(dobrzeUformowany(w.tekst)).toBe(true);
  });

  it("wiersz bez ceny kraju wypada; stan 0 daje avail=0", () => {
    const w = zbudujXml({ kolumny: KOLUMNY, kraj: "AT", wiersze: [wiersz("A", { AT: null }), wiersz("B", { AT: 10 }, { stan: 0 })] });
    expect(w).toMatchObject({ liczbaWierszy: 1, pominiete: 1 });
    expect(w.tekst).toContain('avail="0" stock="0"');
  });

  it("escapuje znaki specjalne i usuwa znaki niedozwolone w XML", () => {
    const w = zbudujXml({ kolumny: KOLUMNY, kraj: "AT", wiersze: [wiersz('A"&<1>', { AT: 1 }, { nazwa: "Opona <XL> & 'Co' \u0001\u0008x" })] });
    expect(w.tekst).toContain('id="A&quot;&amp;&lt;1&gt;"');
    expect(w.tekst).toContain("<name>Opona &lt;XL&gt; &amp; &apos;Co&apos; x</name>");
    expect(dobrzeUformowany(w.tekst)).toBe(true);
    expect(escapujXml("a\u0000b")).toBe("ab");
  });

  it("bez kolumn kod/nazwa/stan bierze wartości domyślne z pozycji; pusta wartość atrybutu jest pomijana", () => {
    const w = zbudujXml({ kolumny: [{ nazwa: "DOT", typ: "katalog", pole: "dot" }], kraj: "AT", wiersze: [wiersz("Z", { AT: 5 })] });
    expect(w.tekst).toContain('<o id="Z" price="5.00" avail="1" stock="5">');
    expect(w.tekst).not.toContain("<attrs>");
  });

  it("błąd pola obliczeniowego pomija atrybut i trafia do błędów", () => {
    const kolumny: KolumnaPliku[] = [{ nazwa: "X", typ: "pole", pole: "x", formula: parsujFormule("cena_AT / 0") }];
    const w = zbudujXml({ kolumny, kraj: "AT", wiersze: [wiersz("A", { AT: 3 })] });
    expect(w.bledy).toEqual([{ kod: "A", kolumna: "X", powod: "Dzielenie przez zero." }]);
    expect(w.liczbaWierszy).toBe(1);
  });
});
