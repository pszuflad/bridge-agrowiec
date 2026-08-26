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
 * Podzbiór `bridge_ext`, który woła silnik importu. Moduł eksportuje 11 funkcji —
 * pozostałe (`assignKodImportu`, `applyNazwaPamiec`, `applyWagaPamiec`, `rememberLink`,
 * `ensure*Tables`, `mrKey`) wchodzą portem, ale ich wywołania siedzą w `acceptStaging`
 * i `addProductsBulk`, czyli w sesji 3d-2. Dopisz je tu, kiedy będą wołane.
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
}

const modul = wymagaj("../legacy/bridge_ext.cjs") as BridgeExt;

export const { applyDims, applyLinkMemory } = modul;

/**
 * Surowy uchwyt better-sqlite3 spod Drizzle — odpowiednik `Qi` z oryginału.
 *
 * `bridge_ext` wykonuje własne `db.prepare('SELECT link FROM link_pamiec_kod …')`, więc
 * potrzebuje uchwytu drivera, a nie instancji Drizzle. Wyciągamy go zamiast rozszerzać
 * sygnaturę `silnikStagingu(db)`, której używa `src/routes/import.ts`.
 */
export function uchwytSqlite(db: Baza): BazaSqlite {
  return (db as unknown as { $client: BazaSqlite }).$client;
}
