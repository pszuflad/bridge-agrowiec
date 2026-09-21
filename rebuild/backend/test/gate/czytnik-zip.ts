/**
 * Minimalny CZYTNIK ZIP dla bramek eksportu (`GET /api/export-shoper` bez `?dostawca=`).
 *
 * Po co własny, a nie pakiet: w `node_modules` są wyłącznie biblioteki PISZĄCE ZIP
 * (`archiver` → `zip-stream` → `compress-commons`), a bramka ma sprawdzić, że archiwum da się
 * PRZECZYTAĆ niezależnie od tego, kto je zapisał. Czytanie tym samym łańcuchem, który pisze,
 * nie dowodziłoby niczego. Formatu wystarczy tyle, ile produkuje `archiver`: bez ZIP64,
 * bez szyfrowania, metody 0 (stored) i 8 (deflate).
 *
 * Czytamy tak jak rozpakowywacze: od KATALOGU CENTRALNEGO, nie od nagłówków lokalnych.
 * `archiver` strumieniuje, więc w nagłówkach lokalnych ma zerowe rozmiary i CRC (bit 3,
 * „data descriptor") — prawdziwe wartości są dopiero w katalogu centralnym.
 *
 * Każda niezgodność RZUCA: brak rekordu końca katalogu, rozjazd liczby wpisów, zła sygnatura,
 * nieznana metoda, zły rozmiar po rozpakowaniu, zły CRC-32. Uszkodzone albo urwane archiwum
 * nie przejdzie więc po cichu jako „jakieś bajty zaczynające się od PK".
 */
import { inflateRawSync } from "node:zlib";

import type { Response } from "supertest";

export type WpisZip = { nazwa: string; tresc: Buffer };

const SYGNATURA_EOCD = 0x06054b50;
const SYGNATURA_KATALOGU = 0x02014b50;
const SYGNATURA_LOKALNA = 0x04034b50;
/** Rekord końca katalogu bez komentarza ma 22 bajty; komentarz może mieć do 65535. */
const MIN_EOCD = 22;

/**
 * CRC-32 (wielomian IEEE, jak w ZIP). Własna tabela zamiast `zlib.crc32`, bo tamto jest
 * dopiero od Node 20.15 / 22.2, a `engines` deklaruje `>=20`.
 */
const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(bufor: Buffer): number {
  let crc = 0xffffffff;
  for (const bajt of bufor) crc = (TABELA_CRC[(crc ^ bajt) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function znajdzEocd(zip: Buffer): number {
  for (let i = zip.length - MIN_EOCD; i >= Math.max(0, zip.length - MIN_EOCD - 0xffff); i--) {
    if (zip.readUInt32LE(i) === SYGNATURA_EOCD) return i;
  }
  throw new Error(`to nie jest ZIP: brak rekordu końca katalogu (${zip.length} B)`);
}

/** Rozpakowuje archiwum; wpisy w kolejności katalogu centralnego. */
export function czytajZip(zip: Buffer): WpisZip[] {
  if (zip.length < MIN_EOCD) throw new Error(`to nie jest ZIP: ${zip.length} B`);

  const eocd = znajdzEocd(zip);
  const liczbaWpisow = zip.readUInt16LE(eocd + 10);
  const rozmiarKatalogu = zip.readUInt32LE(eocd + 12);
  const poczatekKatalogu = zip.readUInt32LE(eocd + 16);
  if (poczatekKatalogu + rozmiarKatalogu !== eocd) {
    throw new Error(
      `katalog centralny nie kończy się przed EOCD: ${poczatekKatalogu}+${rozmiarKatalogu} ≠ ${eocd}`,
    );
  }

  const wpisy: WpisZip[] = [];
  let p = poczatekKatalogu;
  for (let i = 0; i < liczbaWpisow; i++) {
    if (zip.readUInt32LE(p) !== SYGNATURA_KATALOGU) {
      throw new Error(`zła sygnatura wpisu ${i} katalogu centralnego (offset ${p})`);
    }
    const metoda = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    const rozmiarSkompresowany = zip.readUInt32LE(p + 20);
    const rozmiar = zip.readUInt32LE(p + 24);
    const dlNazwy = zip.readUInt16LE(p + 28);
    const dlExtra = zip.readUInt16LE(p + 30);
    const dlKomentarza = zip.readUInt16LE(p + 32);
    const offsetLokalny = zip.readUInt32LE(p + 42);
    const nazwa = zip.subarray(p + 46, p + 46 + dlNazwy).toString("utf8");
    p += 46 + dlNazwy + dlExtra + dlKomentarza;

    if (zip.readUInt32LE(offsetLokalny) !== SYGNATURA_LOKALNA) {
      throw new Error(`${nazwa}: zła sygnatura nagłówka lokalnego (offset ${offsetLokalny})`);
    }
    const start =
      offsetLokalny +
      30 +
      zip.readUInt16LE(offsetLokalny + 26) +
      zip.readUInt16LE(offsetLokalny + 28);
    const dane = zip.subarray(start, start + rozmiarSkompresowany);
    if (dane.length !== rozmiarSkompresowany) throw new Error(`${nazwa}: dane urwane`);

    let tresc: Buffer;
    if (metoda === 0) tresc = Buffer.from(dane);
    else if (metoda === 8) tresc = inflateRawSync(dane);
    else throw new Error(`${nazwa}: nieobsługiwana metoda kompresji ${metoda}`);

    if (tresc.length !== rozmiar) {
      throw new Error(`${nazwa}: po rozpakowaniu ${tresc.length} B, katalog mówi ${rozmiar} B`);
    }
    if (crc32(tresc) !== crc) throw new Error(`${nazwa}: CRC-32 się nie zgadza`);

    wpisy.push({ nazwa, tresc });
  }

  if (p !== eocd)
    throw new Error(`katalog centralny: ${eocd - p} B nadmiarowych po ${liczbaWpisow} wpisach`);
  return wpisy;
}

/**
 * Parser supertest zbierający odpowiedź do jednego bufora. Bez niego supertest zostawia
 * `application/zip` jako pusty `body`. Użycie: `request(app).get(...).buffer(true).parse(doBufora)`.
 */
export function doBufora(res: Response, cb: (blad: Error | null, body: Buffer) => void): void {
  const kawalki: Buffer[] = [];
  res.on("data", (c: Buffer) => kawalki.push(c));
  res.on("end", () => cb(null, Buffer.concat(kawalki)));
}
