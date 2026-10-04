// Ticket 185 — generator migracji 022 (przypisanie kategorii i zastosowania z CSV, jednorazowo przy wdrożeniu).
//   npm run generuj-migracje-przypisania            # nadpisuje rebuild/schema/022_*.sql
// Źródło prawdy: scripts/data/katalog-kategoria-zastosowanie-2026-09-30.csv + tabela przeniesień w
// src/import/migracje/przypisz-kategorie-zastosowanie.ts. Test `db.migracja-022` pilnuje, że plik SQL
// jest zgodny z wynikiem tego generatora.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { trescMigracjiPrzypisania } from "../src/import/migracje/migracja-przypisania-sql.js";
import { wierszePliku } from "../src/import/migracje/przypisz-kategorie-zastosowanie.js";

const korzen = join(dirname(fileURLToPath(import.meta.url)), "..");
const csv = readFileSync(join(korzen, "scripts/data/katalog-kategoria-zastosowanie-2026-09-30.csv"), "utf-8");
const cel = join(korzen, "../schema/022_przypisanie_kategorii_zastosowania_csv.sql");
writeFileSync(cel, trescMigracjiPrzypisania(wierszePliku(csv)), "utf-8");
console.log(`generuj-migracje-przypisania: zapisano ${cel}`);
