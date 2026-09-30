// Ticket 165-BUG-rozdziel-kod-importu — rozdzielenie kod_importu dla znanych kolizji
// (docs/rebuild-backlog.md #108). Patrz src/import/rozdzielKodImportu.ts (logika, testowana
// osobno) — ten plik to cienki wrapper CLI, jak scripts/napraw-nazwy-sklejone.ts.
//
//   DB_PATH=./data/bridge.db npm run rozdziel-kod-importu [ścieżka-do-csv]
//
// Bez podanej ścieżki używa dołączonego pliku scripts/data/164-poprawione-nazwy.csv (ten sam
// plik z ticketu 164 — ma już kolumnę kod_importu dla każdej znanej kolizji).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { rozdzielKodImportu, sparsujWierszeKolizji } from "../src/import/rozdzielKodImportu.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("rozdziel-kod-importu: brak DB_PATH — nie wiem, którą bazę aktualizować. Przerywam.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] ?? path.join(__dirname, "data", "164-poprawione-nazwy.csv");
const csvText = readFileSync(csvPath, "utf-8");
const wiersze = sparsujWierszeKolizji(csvText);

const { sqlite, db } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);

  const wynik = rozdzielKodImportu(db, sqlite, wiersze);

  console.log(
    `rozdziel-kod-importu: rozdzielono ${wynik.grupRozdzielonych} grup, ` +
      `przenumerowano ${wynik.produktowPrzenumerowanych} produktów ` +
      `(pominięto ${wynik.pominietoBrakProduktu} bez produktu w katalogu).`,
  );
} finally {
  sqlite.close();
}
