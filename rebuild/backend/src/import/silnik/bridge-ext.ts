// Most do `src/import/legacy/bridge_ext.cjs` — rozszerzeń importu utrzymywanych przez Anię.
//
// Ten plik NIE zawiera logiki: cała siedzi w porcie verbatim, pilnowanym sha256 w
// `test/charakteryzacja.test.ts`. Tutaj jest wyłącznie most ESM→CJS i typy, żeby reszta
// backendu nie sięgała po `createRequire` na własną rękę.
//
// W oryginale moduł jest wstrzykiwany do `tk()` jako globalne `__BRIDGE_EXT`
// (`deminified/backend-index.cjs:47794`) i dostaje SUROWY uchwyt better-sqlite3 (`Qi`),
// bo robi własne `db.prepare(...)`. My podajemy ten sam uchwyt przez `db.$client`
// (patrz `uchwytSqlite()`), nie zmieniając sygnatury silnika.

import { createRequire } from "node:module";

import type { Baza, BazaSqlite } from "../../db/index.js";

const wymagaj = createRequire(import.meta.url);

/** Wymiary paczki policzone z rozmiaru opony — wynik `tire_dims.packageDims()`. */
export type WymiaryPaczki = {
  kind: string;
  wysokosc: number;
  szerokosc: number | null;
  dlugosc: number;
  szerokosc_paczki: number;
  wysokosc_przesylki: number;
};

/**
 * Podzbiór `bridge_ext`, który woła nasz kod: silnik importu (3d-1) i `acceptStaging` (3d-2).
 * Poza mostem zostają `rememberNazwaPamiec`, `rememberWaga`, `ensure*Tables` i `mrKey` —
 * w produkcji wołają je ścieżki spoza Iteracji 3 (m.in. `addProductsBulk`, odłożony do I12).
 */
interface BridgeExt {
  /**
   * Ustawia na obiekcie produktu wymiary paczki policzone z `rozmiar`.
   * MUTUJE przekazany obiekt i zwraca policzone wymiary albo `null`.
   */
  applyDims(produkt: Record<string, unknown>, rozmiarFallback: unknown): WymiaryPaczki | null;
  /**
   * Uzupełnia `linkZdjecia` z pamięci linków (po kodzie, zapasowo po marka|model|rozmiar).
   * MUTUJE przekazany obiekt. Nigdy nie nadpisuje istniejącego linku pustym.
   */
  applyLinkMemory(
    sqlite: BazaSqlite | null,
    produkt: Record<string, unknown>,
    istniejacy: unknown,
  ): void;
  /**
   * Nadaje `kodImportu` — sześciocyfrowy numer wspólny dla grupy (ten sam EAN albo
   * marka+rozmiar+bieżnik+nazwa). MUTUJE przekazany obiekt.
   *
   * ⚠ NIESPÓJNOŚĆ ORYGINAŁU, ODTWARZANA 1:1: pierwsza reguła („istniejący produkt ma już
   * numer — zachowaj go") czyta `existing.kod_importu` w snake_case, a `acceptStaging` podaje
   * tam wiersz z Drizzle, czyli `kodImportu`. Reguła nigdy więc nie wypala. W praktyce numer
   * i tak się zachowuje, bo reguła druga szuka po grupie SUROWYM SQL-em (poprawne snake_case)
   * i trafia w ten sam produkt.
   *
   * Numer dla produktu bez grupy jest LOSOWY (`Math.random()` w `_kiGenUnique`), więc
   * charakteryzacja porównuje go po kształcie, nie po wartości.
   */
  assignKodImportu(
    sqlite: BazaSqlite | null,
    produkt: Record<string, unknown>,
    istniejacy: unknown,
  ): void;
  /** Odtwarza ręcznie ustawioną nazwę z `nazwa_pamiec` (klucz: `kodImportu`). MUTUJE. */
  applyNazwaPamiec(sqlite: BazaSqlite | null, produkt: Record<string, unknown>): void;
  /** Odtwarza wagę z `waga_pamiec` (klucz: `kod`), gdy import jej nie przyniósł. MUTUJE. */
  applyWagaPamiec(
    sqlite: BazaSqlite | null,
    produkt: Record<string, unknown>,
    istniejacy: unknown,
  ): void;
  /** Zapamiętuje link zdjęcia po `kod` i po `marka|model|rozmiar`. Wołać PO zapisie produktu. */
  rememberLink(sqlite: BazaSqlite | null, produkt: Record<string, unknown>): void;
}

const modul = wymagaj("../legacy/bridge_ext.cjs") as BridgeExt;

export const {
  applyDims,
  applyLinkMemory,
  assignKodImportu,
  applyNazwaPamiec,
  applyWagaPamiec,
  rememberLink,
} = modul;

/** Komplet rozszerzeń w jednym obiekcie — tak wstrzykuje je oryginał jako `__BRIDGE_EXT`. */
export const bridgeExt: BridgeExt = modul;

/**
 * Surowy uchwyt better-sqlite3 spod Drizzle — odpowiednik `Qi` z oryginału.
 *
 * `bridge_ext` wykonuje własne `db.prepare('SELECT link FROM link_pamiec_kod …')`, więc
 * potrzebuje uchwytu drivera, a nie instancji Drizzle. Wyciągamy go zamiast rozszerzać
 * sygnaturę `silnikStagingu(db)`, której używa `src/routes/import.ts`.
 */
export function uchwytSqlite(db: Baza): BazaSqlite {
  const uchwyt = (db as unknown as { $client?: BazaSqlite }).$client;

  // ⚠ TWARDY BŁĄD ZAMIAST CICHEJ AWARII. `$client` to szczegół implementacyjny Drizzle,
  // który może zniknąć przy aktualizacji. Gdyby zniknął, `applyLinkMemory` dostałoby
  // `undefined`, a `bridge_ext` — z założenia defensywny — połknąłby to bez słowa
  // (`if (!db) return`) i pamięć linków przestałaby działać po cichu. Ten sam rodzaj
  // pułapki złapaliśmy już przy ładowaniu `tire_dims.js`, patrz `test/bridge-ext.test.ts`.
  if (!uchwyt || typeof uchwyt.prepare !== "function") {
    throw new Error(
      "Nie udało się wyciągnąć uchwytu better-sqlite3 spod Drizzle (`db.$client`). " +
        "Prawdopodobnie zmieniła się wersja drizzle-orm — bez tego uchwytu `bridge_ext` " +
        "nie ma jak czytać pamięci linków.",
    );
  }
  return uchwyt;
}
