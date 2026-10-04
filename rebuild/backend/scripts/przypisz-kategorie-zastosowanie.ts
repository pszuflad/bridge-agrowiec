// Ticket 185 — jednorazowe przypisanie kategorii i zastosowania z CSV (patrz
// src/import/migracje/przypisz-kategorie-zastosowanie.ts — tam reguły i tabela przeniesień).
//   DB_PATH=./data/data-prod.db npm run przypisz-kategorie-zastosowanie -- plik.csv [--raport zmiany.csv]   # dry-run
//   DB_PATH=... npm run przypisz-kategorie-zastosowanie -- plik.csv --apply                                 # backup + zapis

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import {
  raportPrzypisaniaCsv,
  wierszePliku,
  zaplanujPrzypisanie,
  zastosujPrzypisanie,
} from "../src/import/migracje/przypisz-kategorie-zastosowanie.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("przypisz-kategorie-zastosowanie: brak DB_PATH — nie wiem, którą bazę zmieniać. Przerywam.");
  process.exit(1);
}
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const iRaport = args.indexOf("--raport");
const plikRaportu = iRaport >= 0 ? args[iRaport + 1] : undefined;
const plikCsv = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--raport");
if (!plikCsv) {
  console.error("przypisz-kategorie-zastosowanie: podaj plik CSV jako pierwszy argument.");
  process.exit(1);
}

const { sqlite } = otworzBaze(dbPath);
try {
  // Dry-run NIE dotyka bazy (żadnych migracji). Przy --apply najpierw kopia, dopiero potem migracje (021
  // musi być zastosowana, żeby triggery przepuszczały pary docelowe) i zapis.
  if (apply) {
    const znacznik = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const katalog = join(dirname(dbPath), "backups");
    mkdirSync(katalog, { recursive: true });
    const kopia = join(katalog, `${basename(dbPath)}.bak_przypisanie_kat_zast_${znacznik}`);
    sqlite.prepare("VACUUM INTO ?").run(kopia);
    console.log(`przypisz-kategorie-zastosowanie: kopia bazy: ${kopia}`);
    zastosujMigracje(sqlite);
  }
  const plan = zaplanujPrzypisanie(sqlite, wierszePliku(readFileSync(plikCsv, "utf-8")));
  console.log(
    `przypisz-kategorie-zastosowanie: ${plan.zmiany.length} produktów do zmiany, ${plan.juzZgodnych} już zgodnych, ` +
      `${plan.niejednoznaczne.length} nazw niejednoznacznych (pominięte), ` +
      `${plan.nazwyBezProduktu.length} nazw z pliku bez produktu w bazie.`,
  );
  if (apply) {
    const w = zastosujPrzypisanie(sqlite, plan);
    console.log(`przypisz-kategorie-zastosowanie: zapisano ${w.zapisano}; poprawionych przez triggery (≠ plik): ${w.poprawioneTriggerem.length}; usunięto poprawek Marty (kategoria/zastosowanie): ${w.usunietePoprawki}.`);
  }
  if (plikRaportu) writeFileSync(plikRaportu, "\uFEFF" + raportPrzypisaniaCsv(plan), "utf-8");
} finally {
  sqlite.close();
}
