import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BazaSqlite } from "./index.js";

const TABELA_MIGRACJI = "_migracje";

/**
 * Znajduje katalog z kanonicznymi migracjami (`001_schema.sql`, `002_*.sql`, …).
 *
 * Kolejność szukania:
 *  1. MIGRATIONS_DIR (jawne nadpisanie),
 *  2. `<dist>/schema` — release na VPS dostaje tylko dist/ (kopiuje tam scripts/copy-schema.mjs),
 *  3. `rebuild/schema` — praca z repo (dev, testy, CI).
 */
export function znajdzKatalogMigracji(env: NodeJS.ProcessEnv = process.env): string {
  if (env.MIGRATIONS_DIR) return resolve(env.MIGRATIONS_DIR);

  const tenPlik = dirname(fileURLToPath(import.meta.url)); // <root>/src/db lub <root>/dist/db
  const kandydaci = [
    join(tenPlik, "..", "schema"), // dist/schema
    join(tenPlik, "..", "..", "..", "schema"), // rebuild/schema (z src/db)
  ];
  for (const k of kandydaci) {
    if (existsSync(join(resolve(k), "001_schema.sql"))) return resolve(k);
  }
  throw new Error(
    `Nie znaleziono katalogu migracji (szukano: ${kandydaci.join(", ")}). ` +
      `Ustaw MIGRATIONS_DIR albo uruchom "npm run build" (kopiuje schemat do dist/schema).`,
  );
}

export type WynikMigracji = { zastosowane: string[]; pominiete: string[] };

const DYREKTYWA = /^--\s*@(\S+)(.*)$/;
const DODAJ_KOLUMNE = /^\s+(\w+)\s+(\w+)\s+(\S.*?)\s*$/;

/**
 * Dyrektywy migracji — linie-komentarze `-- @<nazwa> …`, które runner wykonuje PRZED treścią pliku,
 * w tej samej transakcji. SQLite ich nie widzi (to zwykły komentarz), więc plik pozostaje poprawnym
 * SQL-em.
 *
 * PO CO: SQLite nie ma `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, a produkcyjna `data.db` ma kolumny
 * dokładane runtime'owo przy każdym starcie starego backendu (np. `blokowane_formy_platnosci` z
 * `payment_blocks.cjs`). Gołe `ALTER` w migracji wywróciłoby na niej cały plik. Dyrektywa robi to,
 * co robił stary runtime: `PRAGMA table_info` → `ALTER` tylko przy braku kolumny (migracja 011,
 * ticket 107).
 *
 * Obsługiwane:
 *  - `-- @dodaj-kolumne-jesli-brak <tabela> <kolumna> <definicja>`
 *
 * Nieznana dyrektywa, zła składnia albo brak tabeli = błąd, który wycofuje całą migrację —
 * literówka ma zatrzymać deploy, a nie po cichu pominąć kolumnę.
 */
export function zastosujDyrektywy(sqlite: BazaSqlite, sql: string, plik: string): void {
  for (const linia of sql.split(/\r?\n/)) {
    const d = DYREKTYWA.exec(linia.trim());
    if (!d) continue;
    const [, nazwa, reszta] = d as unknown as [string, string, string];

    if (nazwa !== "dodaj-kolumne-jesli-brak") {
      throw new Error(`${plik}: nieznana dyrektywa migracji "@${nazwa}".`);
    }
    const a = DODAJ_KOLUMNE.exec(reszta);
    if (!a) {
      throw new Error(
        `${plik}: zła składnia "@dodaj-kolumne-jesli-brak" — oczekiwano "<tabela> <kolumna> <definicja>".`,
      );
    }
    const [, tabela, kolumna, definicja] = a as unknown as [string, string, string, string];

    const kolumny = sqlite.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[];
    if (kolumny.length === 0) {
      throw new Error(`${plik}: "@dodaj-kolumne-jesli-brak" — tabela "${tabela}" nie istnieje.`);
    }
    if (kolumny.some((k) => k.name === kolumna)) continue;
    sqlite.exec(`ALTER TABLE ${tabela} ADD COLUMN ${kolumna} ${definicja}`);
  }
}

/**
 * Stosuje migracje idempotentnie: każdy plik .sql wykonywany jest raz, w transakcji,
 * a jego nazwa zapisywana w tabeli `_migracje`. Ponowne uruchomienie nic nie zmienia.
 * Przed treścią pliku wykonywane są jego dyrektywy (`zastosujDyrektywy`).
 */
export function zastosujMigracje(
  sqlite: BazaSqlite,
  katalog: string = znajdzKatalogMigracji(),
): WynikMigracji {
  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS ${TABELA_MIGRACJI} (
       nazwa TEXT PRIMARY KEY,
       zastosowano TEXT NOT NULL
     );`,
  );

  const juzZastosowane = new Set(
    sqlite
      .prepare(`SELECT nazwa FROM ${TABELA_MIGRACJI}`)
      .all()
      .map((r) => (r as { nazwa: string }).nazwa),
  );

  const pliki = readdirSync(katalog)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const wynik: WynikMigracji = { zastosowane: [], pominiete: [] };
  for (const plik of pliki) {
    if (juzZastosowane.has(plik)) {
      wynik.pominiete.push(plik);
      continue;
    }
    const sql = readFileSync(join(katalog, plik), "utf8");
    const wTransakcji = sqlite.transaction(() => {
      zastosujDyrektywy(sqlite, sql, plik);
      sqlite.exec(sql);
      sqlite
        .prepare(`INSERT INTO ${TABELA_MIGRACJI} (nazwa, zastosowano) VALUES (?, ?)`)
        .run(plik, new Date().toISOString());
    });
    wTransakcji();
    wynik.zastosowane.push(plik);
  }
  return wynik;
}
