import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.js";

export type BazaSqlite = Database.Database;
export type Baza = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Otwiera bazę SQLite w trybie WAL (jak produkcja) i podpina Drizzle.
 * Katalog pliku bazy jest tworzony, jeśli nie istnieje.
 */
export function otworzBaze(dbPath: string): { sqlite: BazaSqlite; db: Baza } {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // Odczekaj zamiast od razu rzucać SQLITE_BUSY, gdy inny proces pisze.
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

export { schema };
