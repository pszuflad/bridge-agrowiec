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

export type WynikMigracji = {
  zastosowane: string[];
  pominiete: string[];
  /** Podzbiór `zastosowane`: odnotowane bez wykonania treści, bo zadziałał warunek dyrektywy. */
  bezTresci: string[];
};

const DYREKTYWA = /^--\s*@(\S+)(.*)$/;
const DODAJ_KOLUMNE = /^\s+(\w+)\s+(\w+)\s+(\S.*?)\s*$/;
const TYP_KOLUMNY = /^\s+(\w+)\s+(\w+)\s+(\w+)\s*$/;
const TABELA = /^\s+(\w+)\s*$/;

type Dyrektywa = { nazwa: string; argumenty: string[] };

/** Wyciąga dyrektywy z pliku i waliduje ich składnię — przed wykonaniem czegokolwiek. */
function czytajDyrektywy(sql: string, plik: string): Dyrektywa[] {
  const wynik: Dyrektywa[] = [];
  for (const linia of sql.split(/\r?\n/)) {
    const d = DYREKTYWA.exec(linia.trim());
    if (!d) continue;
    const [, nazwa, reszta] = d as unknown as [string, string, string];
    const wzorzec =
      nazwa === "dodaj-kolumne-jesli-brak"
        ? { re: DODAJ_KOLUMNE, oczekiwano: "<tabela> <kolumna> <definicja>" }
        : nazwa === "pomin-jesli-typ-kolumny"
          ? { re: TYP_KOLUMNY, oczekiwano: "<tabela> <kolumna> <typ>" }
          : nazwa === "pomin-jesli-tabela-istnieje"
            ? { re: TABELA, oczekiwano: "<tabela>" }
            : null;
    if (!wzorzec) throw new Error(`${plik}: nieznana dyrektywa migracji "@${nazwa}".`);
    const a = wzorzec.re.exec(reszta);
    if (!a) {
      throw new Error(`${plik}: zła składnia "@${nazwa}" — oczekiwano "${wzorzec.oczekiwano}".`);
    }
    wynik.push({ nazwa, argumenty: a.slice(1) as string[] });
  }
  return wynik;
}

function kolumnyTabeli(
  sqlite: BazaSqlite,
  tabela: string,
  plik: string,
  dyrektywa: string,
): { name: string; type: string }[] {
  const kolumny = sqlite.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string; type: string }[];
  if (kolumny.length === 0) {
    throw new Error(`${plik}: "@${dyrektywa}" — tabela "${tabela}" nie istnieje.`);
  }
  return kolumny;
}

/**
 * Dyrektywy migracji — linie-komentarze `-- @<nazwa> …`, które runner wykonuje PRZED treścią pliku,
 * w tej samej transakcji. SQLite ich nie widzi (to zwykły komentarz), więc plik pozostaje poprawnym
 * SQL-em.
 *
 * PO CO: produkcyjna `data.db` nie pochodzi z naszego kanonu — ma kolumny dokładane runtime'owo przy
 * każdym starcie starego backendu (`uwaga_cena`, `blokowane_formy_platnosci`) i własną historię zmian
 * Ani (`szerokosc` TEXT po `szertxt`). SQLite nie ma `ADD COLUMN IF NOT EXISTS` ani warunkowego DDL,
 * a runner wykonuje plik w jednej transakcji — migracja zakładająca kształt kanonu wywróciłaby się na
 * produkcji w całości. Dyrektywy dają migracji warunek sprawdzany na żywym schemacie (ticket 107).
 *
 * Obsługiwane:
 *  - `-- @dodaj-kolumne-jesli-brak <tabela> <kolumna> <definicja>` — `ALTER TABLE … ADD COLUMN`
 *    tylko wtedy, gdy kolumny brak (002 `uwaga_cena`, 011 `blokowane_formy_platnosci`);
 *  - `-- @pomin-jesli-typ-kolumny <tabela> <kolumna> <typ>` — gdy kolumna ma JUŻ zadeklarowany typ
 *    `<typ>` (porównanie bez wielkości liter), treść pliku i pozostałe dyrektywy NIE są wykonywane,
 *    a migracja zostaje odnotowana jako zastosowana (003: `szerokosc` już TEXT = cel osiągnięty);
 *  - `-- @pomin-jesli-tabela-istnieje <tabela>` — jak wyżej, gdy tabela (albo widok) o tej nazwie JUŻ
 *    istnieje (013: `selly_products_old` na produkcji = przebudowa Selly już zrobiona).
 *
 * Najpierw walidowana jest składnia WSZYSTKICH dyrektyw, potem sprawdzane warunki pominięcia, na końcu
 * dokładane kolumny. Nieznana dyrektywa, zła składnia, brak tabeli albo (dla pominięcia po typie) brak kolumny
 * = błąd, który wycofuje całą migrację — literówka ma zatrzymać deploy, a nie zmienić jego przebieg.
 *
 * @returns `false`, gdy treść pliku ma NIE być wykonana (zadziałał warunek pominięcia).
 */
export function zastosujDyrektywy(sqlite: BazaSqlite, sql: string, plik: string): boolean {
  const dyrektywy = czytajDyrektywy(sql, plik);

  for (const { nazwa, argumenty } of dyrektywy) {
    if (nazwa === "pomin-jesli-typ-kolumny") {
      const [tabela, kolumna, typ] = argumenty as [string, string, string];
      const k = kolumnyTabeli(sqlite, tabela, plik, nazwa).find((c) => c.name === kolumna);
      if (!k) throw new Error(`${plik}: "@${nazwa}" — kolumna "${tabela}.${kolumna}" nie istnieje.`);
      if (k.type.trim().toUpperCase() === typ.toUpperCase()) return false;
    } else if (nazwa === "pomin-jesli-tabela-istnieje") {
      const [tabela] = argumenty as [string];
      const jest = sqlite
        .prepare(`SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?`)
        .get(tabela);
      if (jest) return false;
    }
  }

  for (const { nazwa, argumenty } of dyrektywy) {
    if (nazwa !== "dodaj-kolumne-jesli-brak") continue;
    const [tabela, kolumna, definicja] = argumenty as [string, string, string];
    if (kolumnyTabeli(sqlite, tabela, plik, nazwa).some((c) => c.name === kolumna)) continue;
    sqlite.exec(`ALTER TABLE ${tabela} ADD COLUMN ${kolumna} ${definicja}`);
  }
  return true;
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

  const wynik: WynikMigracji = { zastosowane: [], pominiete: [], bezTresci: [] };
  for (const plik of pliki) {
    if (juzZastosowane.has(plik)) {
      wynik.pominiete.push(plik);
      continue;
    }
    const sql = readFileSync(join(katalog, plik), "utf8");
    let wykonanaTresc = true;
    const wTransakcji = sqlite.transaction(() => {
      wykonanaTresc = zastosujDyrektywy(sqlite, sql, plik);
      if (wykonanaTresc) sqlite.exec(sql);
      sqlite
        .prepare(`INSERT INTO ${TABELA_MIGRACJI} (nazwa, zastosowano) VALUES (?, ?)`)
        .run(plik, new Date().toISOString());
    });
    wTransakcji();
    wynik.zastosowane.push(plik);
    if (!wykonanaTresc) wynik.bezTresci.push(plik);
  }
  return wynik;
}
