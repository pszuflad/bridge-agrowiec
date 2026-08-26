// Brzeg wejścia importu: (plik albo bufor + kod dostawcy) → rekordy po normalizacji.
//
// To JEDYNA warstwa, którą piszemy sami — cała logika parsowania i normalizacji
// pochodzi z portu verbatim w src/import/legacy/** i nie wolno jej tu powielać ani
// obchodzić. Odpowiedzialność tego pliku kończy się na:
//   1. sprawdzeniu kodu dostawcy,
//   2. wywołaniu dispatchera z produkcji,
//   3. przepuszczeniu rekordów przez adapter.recordsToSurowe(),
//   4. otypowaniu wyniku dla reszty backendu.
//
// Zapis do staging_items, dopasowanie tk() i endpointy importu są POZA tym plikiem
// (sesje 3b/3c) — patrz docs/rebuild-roadmap.md §5.

import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

import {
  jestKodemDostawcy,
  type BladWiersza,
  type KodDostawcy,
  type OdrzuconyWiersz,
  type RekordSurowy,
  type WynikParsowania,
} from "./typy.js";

// Moduły portu są CommonJS (.cjs), a backend jest ESM — createRequire jest tu
// właściwym mostem. Ścieżka jest względna wobec TEGO pliku, więc działa tak samo
// w src/ (tsx, vitest) jak w dist/ (scripts/copy-parsery.mjs kopiuje tam legacy/).
const wymagaj = createRequire(import.meta.url);

interface WynikParseraDostawcy {
  records: unknown[];
  errors?: BladWiersza[];
  odrzucone?: OdrzuconyWiersz[];
  dostawca: string;
}

interface Dispatcher {
  parseByKod(kodDostawcy: string, sciezkaPliku: string): WynikParseraDostawcy;
  listDostawcy(): string[];
}

interface Adapter {
  recordsToSurowe(kodDostawcy: string, records: unknown[]): RekordSurowy[];
}

const dispatcher = wymagaj("./legacy/parsers/dispatcher.cjs") as Dispatcher;
const adapter = wymagaj("./legacy/parsers/adapter.cjs") as Adapter;

export class BladImportu extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BladImportu";
  }
}

function sprawdzKodDostawcy(kodDostawcy: string): KodDostawcy {
  if (!jestKodemDostawcy(kodDostawcy)) {
    throw new BladImportu(
      `Nieznany dostawca: ${kodDostawcy}. Obsługiwani: ${dispatcher.listDostawcy().join(", ")}`,
    );
  }
  return kodDostawcy;
}

/**
 * Parsuje plik dostawcy z dysku i zwraca rekordy gotowe dla stagingu.
 *
 * Odtwarza potok produkcji 1:1: dispatcher.parseByKod() → adapter.recordsToSurowe().
 * Uwaga na MO9 — produkcyjny parser Agrorami IGNORUJE ścieżkę pliku i pobiera dane
 * z API GraphQL w osobnym procesie (wymaga AGRORAMI_EMAIL/AGRORAMI_PASSWORD).
 */
export function parsujPlik(kodDostawcy: string, sciezkaPliku: string): WynikParsowania {
  const kod = sprawdzKodDostawcy(kodDostawcy);
  const wynikParsera = dispatcher.parseByKod(kod, sciezkaPliku);
  const rekordy = adapter.recordsToSurowe(kod, wynikParsera.records);

  return {
    dostawca: wynikParsera.dostawca,
    rekordy,
    bledy: wynikParsera.errors ?? [],
    odrzucone: wynikParsera.odrzucone ?? [],
    odrzuconePrzezAdapter: wynikParsera.records.length - rekordy.length,
  };
}

/**
 * Wariant buforowy — dla uploadu pliku przez API (endpoint dochodzi w 3b).
 *
 * Parsery dostawców czytają z dysku (`fs.readFileSync`, `XLSX.readFile`), więc bufor
 * ląduje w pliku tymczasowym. To nie jest obejście, tylko odtworzenie produkcji:
 * tam `L4()` też najpierw ściąga plik z URL na dysk, a dopiero potem parsuje.
 *
 * @param nazwaPliku oryginalna nazwa — zachowujemy z niej rozszerzenie, bo SheetJS
 *   (MO8/MO10) bierze je pod uwagę przy wyborze czytnika.
 */
export function parsujBufor(
  kodDostawcy: string,
  bufor: Buffer,
  nazwaPliku?: string,
): WynikParsowania {
  const kod = sprawdzKodDostawcy(kodDostawcy);
  const katalog = mkdtempSync(join(tmpdir(), "bridge-import-"));
  const rozszerzenie = nazwaPliku ? extname(nazwaPliku) : "";
  const sciezka = join(katalog, `${kod}${rozszerzenie}`);

  try {
    writeFileSync(sciezka, bufor);
    return parsujPlik(kod, sciezka);
  } finally {
    rmSync(katalog, { recursive: true, force: true });
  }
}

/** Kody dostawców znane dispatcherowi z produkcji. */
export function listaDostawcow(): string[] {
  return dispatcher.listDostawcy();
}

export type { RekordSurowy, WynikParsowania, KodDostawcy };
