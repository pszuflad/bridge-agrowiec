/**
 * STRAŻNIK CICHEJ AWARII `bridge_ext` (Iteracja 3d-1).
 *
 * `bridge_ext.cjs` jest z założenia DEFENSYWNY — każdy błąd łapie i połyka, żeby nie wywrócić
 * importu. To dobre w produkcji i groźne dla nas: gdy moduł nie zdoła wczytać `tire_dims.js`,
 * `packageDims` zostaje `null`, `applyDims` zwraca `null` i wymiary po prostu NIGDY się nie
 * liczą — bez wyjątku, bez logu, bez czerwonego testu.
 *
 * Dokładnie to zdarzyło się przy porcie: backend ma `"type": "module"`, więc `tire_dims.js`
 * (rozszerzenie `.js`, nie `.cjs`) był traktowany jako ESM i `require('./tire_dims.js')`
 * padało. Naprawia to marker `src/import/legacy/package.json` (`"type": "commonjs"`) —
 * produkcja go nie potrzebuje, bo `mirror/backend/package.json` nie deklaruje `type`
 * i cały katalog jest CommonJS.
 *
 * Te testy istnieją po to, żeby ta awaria nie mogła wrócić po cichu.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { applyDims, applyLinkMemory, uchwytSqlite } from "../src/import/silnik/bridge-ext.js";

describe("bridge_ext — most ESM→CJS działa, a nie tylko nie wybucha", () => {
  it("applyDims LICZY wymiary (a nie zwraca null przez połknięty błąd wczytania tire_dims)", () => {
    const produkt: Record<string, unknown> = { rozmiar: "480/70R30" };
    const wymiary = applyDims(produkt, null);

    // Wartości z arkusza firmowego (tire_dims.js): 480/70R30 → bok 33.6 cm,
    // wysokość 2*33.6 + 30*2.54 = 143.4 → ceil 144; przesyłka = +15.
    expect(wymiary).not.toBeNull();
    expect(produkt.wysokosc).toBe(144);
    expect(produkt.dlugosc).toBe(144);
    expect(produkt.wysokoscPrzesylki).toBe(159);
    expect(produkt.szerokoscPaczki).toBe(53);
  });

  it("applyDims NIE nadpisuje szerokości opony wymiarem paczki (POPRAWKA 2026-07-14)", () => {
    const produkt: Record<string, unknown> = { rozmiar: "235/75R17.5", szerokosc: "235" };
    applyDims(produkt, null);
    expect(produkt.szerokosc).toBe("235");
  });

  it("applyDims korzysta z rozmiarFallback, gdy produkt nie ma rozmiaru", () => {
    const produkt: Record<string, unknown> = { rozmiar: null };
    expect(applyDims(produkt, "480/70R30")).not.toBeNull();
    expect(produkt.wysokosc).toBe(144);
  });

  it("applyLinkMemory odtwarza link z pamięci po kodzie", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(
      "CREATE TABLE link_pamiec_kod (kod TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);" +
        "CREATE TABLE link_pamiec_mr (mrkey TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);",
    );
    sqlite
      .prepare("INSERT INTO link_pamiec_kod (kod, link, updated_at) VALUES (?,?,?)")
      .run("MO1_1", "https://example/zdjecie.jpg", "2026-08-26T00:00:00.000Z");

    const produkt: Record<string, unknown> = { kod: "MO1_1", linkZdjecia: null };
    applyLinkMemory(sqlite, produkt, null);
    expect(produkt.linkZdjecia).toBe("https://example/zdjecie.jpg");

    sqlite.close();
  });

  it("uchwytSqlite() zwraca ten sam obiekt drivera, który dostał Drizzle", () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    expect(uchwytSqlite(db as never)).toBe(sqlite);
    sqlite.close();
  });
});
