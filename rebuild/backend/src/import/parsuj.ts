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
// Pusty cennik ma JEDEN bezpiecznik w całym backendzie (odstępstwo D7) — `feed_safety`
// wykrywa go teraz wcześniej, ale kończy się tym samym wyjątkiem i tą samą odpowiedzią 400,
// żeby nie rozjechały się dwa komunikaty o tej samej sytuacji.
import { PustyImportBlad } from "./tk.js";

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
 * Cennik dotarł, ale parser go nie odczytał — `feed_safety.attach()` przerwał import
 * (backlog #103, resync 23.09, ticket 120).
 *
 * To NIE jest to samo co pusty wynik: pusty cennik ma własny, starszy bezpiecznik
 * (`PustyImportBlad`, odstępstwo D7) i własny komunikat. Tutaj chodzi o sytuację, w której
 * parser ZGŁOSIŁ błędy odczytu — przed #103 przechodziły dalej w polu `bledy` i import
 * leciał na niekompletnych danych, teraz zatrzymują go bez przełączania na stary format.
 */
export class BladCennika extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BladCennika";
  }
}

/**
 * Trzy komunikaty, którymi `legacy/feed_safety.cjs` sygnalizuje przerwanie importu.
 *
 * Rozpoznajemy je PO TREŚCI, bo `attach()` rzuca goły `Error` — bez kodu, typu ani własnej
 * klasy. Treści są przypięte testem w `test/feed-safety.test.ts`, więc kolejny resync, który
 * je zmieni, zaświeci na czerwono, zamiast po cichu przestać rozpoznawać wyjątek.
 */
const PUSTY_CENNIK = /^Pusty cennik/;
const BRAK_LISTY = /^Brak listy produktów/;
const BLEDY_PARSERA = /^Błędy odczytu cennika/;

/**
 * Tłumaczy wyjątek z `feed_safety.attach()` na typ, który znają trasy importu.
 *
 * Bez tego wyjątek leci przez `parsujBufor()` aż do zewnętrznego `catch` w trasie i kończy się
 * odpowiedzią 500, mimo że to zwykły błąd DANYCH WEJŚCIOWYCH (400). Dotyczy wszystkich trzech
 * wejść: `routes/import.ts`, `routes/suppliers.ts` i auto-pulla `synchronizuj.ts`.
 *
 * ⚠ Tłumaczymy WYŁĄCZNIE te trzy znane komunikaty. Każdy inny wyjątek — awaria czytnika XLSX,
 * `TypeError` z naszego kodu, cokolwiek nieprzewidzianego — leci dalej nietknięty i kończy się
 * kodem 500, dokładnie jak przed tym ticketem. Gdyby tłumaczyć wszystko, prawdziwy błąd
 * serwera przebierałby się za błąd klienta i znikał z radaru.
 */
function przetlumaczBladParsera(kodDostawcy: string, e: unknown): unknown {
  if (!(e instanceof Error)) return e;
  if (PUSTY_CENNIK.test(e.message) || BRAK_LISTY.test(e.message)) {
    return new PustyImportBlad(kodDostawcy);
  }
  if (BLEDY_PARSERA.test(e.message)) return new BladCennika(e.message);
  return e;
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

  // Od resyncu 23.09 `parseByKod()` woła `feed_safety.attach()`, które RZUCA przy pustym
  // cenniku i przy błędach parsera (#103) — wcześniej ta ścieżka nigdy nie rzucała.
  let wynikParsera: WynikParseraDostawcy;
  try {
    wynikParsera = dispatcher.parseByKod(kod, sciezkaPliku);
  } catch (e) {
    throw przetlumaczBladParsera(kod, e);
  }

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
