// Dekodowanie załącznika XML do tekstu (karta PARTNERZY, ticket 233). Partnerzy bywają polscy: `encoding="ISO-8859-2"` / `windows-1250` w deklaracji
// to nie rzadkość, a `Buffer.toString("utf-8")` zamieniłby polskie litery na „�” po cichu. Kolejność: BOM → deklaracja `encoding` → UTF-8.
// Nieznane kodowanie albo bajty niezgodne z kodowaniem to CZYTELNY błąd pliku (`BladZamowienia`), nie zniekształcony tekst.

import { TextDecoder } from "node:util";

import { BladZamowienia } from "./zamowienie-xml.js";

const BOM_UTF8 = [0xef, 0xbb, 0xbf];
const BOM_UTF16LE = [0xff, 0xfe];
const BOM_UTF16BE = [0xfe, 0xff];
const zaczynaSie = (b: Buffer, wzor: number[]): boolean => wzor.every((x, i) => b[i] === x);

function etykietaKodowania(bufor: Buffer): string {
  if (zaczynaSie(bufor, BOM_UTF8)) return "utf-8";
  if (zaczynaSie(bufor, BOM_UTF16LE)) return "utf-16le";
  if (zaczynaSie(bufor, BOM_UTF16BE)) return "utf-16be";
  // Deklaracja jest ASCII-zgodna we wszystkich obsługiwanych kodowaniach jednobajtowych i w UTF-8; patrzymy tylko na początek pliku.
  const poczatek = bufor.subarray(0, 200).toString("latin1");
  const m = /^\s*<\?xml[^>]*?\bencoding\s*=\s*["']([A-Za-z0-9._:-]+)["']/.exec(poczatek);
  return m?.[1] ? m[1].toLowerCase() : "utf-8";
}

export function dekodujXml(bufor: Buffer): string {
  const etykieta = etykietaKodowania(bufor);
  let dekoder: TextDecoder;
  try {
    dekoder = new TextDecoder(etykieta, { fatal: true });
  } catch {
    throw new BladZamowienia([`Nieobsługiwane kodowanie pliku: ${etykieta}.`]);
  }
  try {
    return dekoder.decode(bufor);
  } catch {
    throw new BladZamowienia([`Plik nie jest poprawnym tekstem w kodowaniu ${etykieta}.`]);
  }
}
