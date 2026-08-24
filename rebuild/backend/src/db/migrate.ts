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

/**
 * Stosuje migracje idempotentnie: każdy plik .sql wykonywany jest raz, w transakcji,
 * a jego nazwa zapisywana w tabeli `_migracje`. Ponowne uruchomienie nic nie zmienia.
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
