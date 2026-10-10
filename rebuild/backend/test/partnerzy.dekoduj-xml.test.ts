/** Dekodowanie załączników XML i rozpoznawanie ich typu (ticket 233). */
import { describe, expect, it } from "vitest";

import { dekodujXml } from "../src/partnerzy/dekoduj-xml.js";
import { czyXml } from "../src/partnerzy/odbior-email.js";
import { BladZamowienia, parsujZamowienie } from "../src/partnerzy/zamowienie-xml.js";

const tresc = (nazwa: string) =>
  `<DOCUMENTORDER><NUMBER>1</NUMBER><PRODUCTS><PRODUCT><CODE>K1</CODE><NAME>${nazwa}</NAME><ORDERQUANTITY>1</ORDERQUANTITY></PRODUCT></PRODUCTS></DOCUMENTORDER>`;
const POLSKIE = "Opona zażółć gęślą jaźń ŻÓŁĆ";

describe("dekodujXml", () => {
  it("UTF-8 bez deklaracji i z deklaracją", () => {
    expect(dekodujXml(Buffer.from(tresc(POLSKIE), "utf-8"))).toContain(POLSKIE);
    expect(dekodujXml(Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>${tresc(POLSKIE)}`, "utf-8"))).toContain(POLSKIE);
  });

  it("BOM UTF-8, UTF-16LE i UTF-16BE", () => {
    expect(dekodujXml(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(tresc(POLSKIE), "utf-8")]))).toContain(POLSKIE);
    expect(dekodujXml(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(tresc(POLSKIE), "utf16le")]))).toContain(POLSKIE);
    const be = Buffer.from(tresc(POLSKIE), "utf16le").swap16();
    expect(dekodujXml(Buffer.concat([Buffer.from([0xfe, 0xff]), be]))).toContain(POLSKIE);
  });

  it("deklarowane ISO-8859-2 i windows-1250 — polskie litery nie są niszczone (to ginęło przy toString utf-8)", () => {
    // bufor w ISO-8859-2: ręcznie, bo Node nie ma kodera; litery spoza ASCII jako bajty
    const iso2: Record<string, number> = { ż: 0xbf, ó: 0xf3, ł: 0xb3, ć: 0xe6, ę: 0xea, ś: 0xb6, ą: 0xb1, ź: 0xbc, ń: 0xf1 };
    const kodujIso2 = (s: string) => Buffer.from([...s].map((c) => iso2[c] ?? c.charCodeAt(0)));
    const bufor = kodujIso2(`<?xml version="1.0" encoding="ISO-8859-2"?>${tresc("zażółć gęślą jaźń")}`);
    const tekst = dekodujXml(bufor);
    expect(tekst).toContain("zażółć gęślą jaźń");
    expect(parsujZamowienie(tekst).pozycje[0]!.nazwa).toBe("zażółć gęślą jaźń");
    expect(Buffer.from(bufor).toString("utf-8")).not.toContain("zażółć"); // dowód, że stary sposób psuł tekst

    const win = Buffer.from([...`<?xml version='1.0' encoding='windows-1250'?>${tresc("żółw")}`].map((c) => ({ ż: 0xbf, ó: 0xf3, ł: 0xb3 })[c as "ż"] ?? c.charCodeAt(0)));
    expect(dekodujXml(win)).toContain("żółw");
  });

  it("nieznane kodowanie i bajty niezgodne z kodowaniem to czytelny błąd pliku, nie zniekształcony tekst", () => {
    expect(() => dekodujXml(Buffer.from(`<?xml version="1.0" encoding="KLINGON-1"?>${tresc("x")}`))).toThrow(BladZamowienia);
    expect(() => dekodujXml(Buffer.from(`<?xml version="1.0" encoding="KLINGON-1"?>${tresc("x")}`))).toThrow(/Nieobsługiwane kodowanie.*klingon-1/);
    expect(() => dekodujXml(Buffer.from([0x3c, 0x61, 0x3e, 0xff, 0xfe, 0xfd]))).toThrow(/nie jest poprawnym tekstem/);
  });

  it("deklaracja encoding poza początkiem pliku (np. w treści) jest ignorowana", () => {
    const tekst = `${tresc('encoding="ISO-8859-2" <?xml encoding="x"?>')}`;
    expect(dekodujXml(Buffer.from(tekst, "utf-8"))).toContain("ISO-8859-2");
  });
});

describe("czyXml", () => {
  const z = (nazwa: string, typ: string) => ({ nazwa, typ, tresc: Buffer.alloc(0) });
  it("rozpoznaje XML po rozszerzeniu i typie MIME", () => {
    expect(czyXml(z("zamowienie.xml", ""))).toBe(true);
    expect(czyXml(z("ZAMOWIENIE.XML", "application/octet-stream"))).toBe(true);
    expect(czyXml(z("zam", "text/xml"))).toBe(true);
    expect(czyXml(z("zam", "application/xml; charset=utf-8"))).toBe(true);
    expect(czyXml(z("zam", "application/soap+xml"))).toBe(true);
  });
  it("odrzuca pliki Office (xlsx/docx) i inne typy z „xml” w nazwie typu", () => {
    expect(czyXml(z("cennik.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))).toBe(false);
    expect(czyXml(z("pismo.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBe(false);
    expect(czyXml(z("faktura.pdf", "application/pdf"))).toBe(false);
    expect(czyXml(z("x", "application/vnd.ms-excel.xmlfoo"))).toBe(false);
  });
});
