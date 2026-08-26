/** Migracje — `npm run migrate` musi być idempotentne (kontrakt deployu). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("zastosujMigracje", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let sciezka: string;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-migracje-"));
    sciezka = join(katalog, "test.db");
    ({ sqlite } = otworzBaze(sciezka));
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const policzTabele = (db: BazaSqlite): number =>
    (
      db
        .prepare(
          `SELECT count(*) AS c FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_migracje'`,
        )
        .get() as { c: number }
    ).c;

  /**
   * Kolejność ma znaczenie — migracje stosowane są alfabetycznie i 002 zakłada, że
   * tabele z 001 już istnieją. Lista jest tu jawna, żeby dołożenie pliku do
   * `rebuild/schema/` było świadomą zmianą testu, a nie cichym rozszerzeniem.
   */
  const MIGRACJE = ["001_schema.sql", "002_import.sql"];

  it("stosuje wszystkie migracje po kolei: 26 tabel i 13 indeksów", () => {
    const wynik = zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(wynik.zastosowane).toEqual(MIGRACJE);
    // 002 dokłada wyłącznie KOLUMNY (plan.md D5/D9) — liczba tabel i indeksów bez zmian.
    expect(policzTabele(sqlite)).toBe(26);

    const indeksy = (
      sqlite
        .prepare(
          `SELECT count(*) AS c FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`,
        )
        .get() as { c: number }
    ).c;
    expect(indeksy).toBe(13);
  });

  it("baza działa w trybie WAL (jak produkcja)", () => {
    expect(String(sqlite.pragma("journal_mode", { simple: true }))).toBe("wal");
  });

  it("drugie uruchomienie nic nie stosuje i nie rusza danych", () => {
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    sqlite
      .prepare(
        `INSERT INTO users (email, haslo_hash, imie_nazwisko, utworzono) VALUES (?, ?, ?, ?)`,
      )
      .run("a@b.test", "$2b$10$hash", "Ktoś Tam", new Date().toISOString());

    const wynik = zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(wynik.zastosowane).toEqual([]);
    expect(wynik.pominiete).toEqual(MIGRACJE);

    const liczba = (sqlite.prepare(`SELECT count(*) AS c FROM users`).get() as { c: number }).c;
    expect(liczba).toBe(1);
    expect(policzTabele(sqlite)).toBe(26);
  });

  it("tabela users ma kolumny zgodne z kanonem", () => {
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const kolumny = (sqlite.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map(
      (k) => k.name,
    );
    expect(kolumny).toEqual([
      "id",
      "email",
      "haslo_hash",
      "imie_nazwisko",
      "utworzono",
      "ostatnie_logowanie",
    ]);
  });
});
