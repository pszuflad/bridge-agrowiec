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
  getUrl(kodDostawcy: string): string | undefined;
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

/**
 * Sprawdza kod dostawcy wobec DWÓCH źródeł: listy dispatchera z produkcji (autorytet
 * runtime — to on wie, którzy dostawcy mają parser) i naszego typu `KodDostawcy`
 * (potrzebnego do zawężenia typu). Rozjazd między nimi może się pojawić dopiero przy
 * re-synchronizacji `dispatcher.cjs` z produkcją i wtedy ma zostać zauważony —
 * pilnuje tego osobny test w `test/charakteryzacja.test.ts`.
 */
function sprawdzKodDostawcy(kodDostawcy: string): KodDostawcy {
  const znaneDispatcherowi = dispatcher.listDostawcy();
  if (!znaneDispatcherowi.includes(kodDostawcy) || !jestKodemDostawcy(kodDostawcy)) {
    throw new BladImportu(
      `Nieznany dostawca: ${kodDostawcy}. Obsługiwani: ${znaneDispatcherowi.join(", ")}`,
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

/**
 * Adres cennika z mapy `URLS` dispatchera (`legacy/parsers/dispatcher.cjs:63`).
 *
 * ⚠ Mapa wymienia adresy dla WSZYSTKICH dziesięciu dostawców, ale dla części to zapis
 * nieużywany: MO6 (Uniglory) i MO8 (Trelleborg) nigdy nie miały auto-pulla — pliki
 * przychodzą mailem i Marta wgrywa je ręcznie (backlog #7 i #8). Obecność adresu w tej
 * mapie nie znaczy więc, że dostawca jest pobierany automatycznie.
 *
 * Pierwszeństwo ma zawsze `suppliers.url` z bazy; to jest fallback (extensions.cjs:87-89).
 */
export function urlDostawcy(kodDostawcy: string): string | null {
  return dispatcher.getUrl(kodDostawcy) ?? null;
}

export type { RekordSurowy, WynikParsowania, KodDostawcy };
