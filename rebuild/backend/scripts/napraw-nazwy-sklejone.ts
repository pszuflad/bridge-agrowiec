// Ticket 164-BUG-poprawione-nazwy-sklejonych-opon — jednorazowe wgranie poprawnych nazw dla
// produktów, które dzielą `kod_importu` z innym produktem tego samego dostawcy. Patrz
// `src/import/naprawaNazwSklejonych.ts` (logika, testowana osobno) — ten plik to cienki
// wrapper CLI, jak `dziedzicz-wage.ts`.
//
//   DB_PATH=./data/bridge.db npm run napraw-nazwy-sklejone [ścieżka-do-csv]
//
// Bez podanej ścieżki używa dołączonego pliku `scripts/data/164-poprawione-nazwy.csv`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { naprawNazwySklejone, sparsujWierszeNaprawy } from "../src/import/naprawaNazwSklejonych.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("napraw-nazwy-sklejone: brak DB_PATH — nie wiem, którą bazę aktualizować. Przerywam.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] ?? path.join(__dirname, "data", "164-poprawione-nazwy.csv");
const csvText = readFileSync(csvPath, "utf-8");
const wiersze = sparsujWierszeNaprawy(csvText);

const { sqlite, db } = otworzBaze(dbPath);
try {
  // `manual_overrides`, do którego pisze naprawNazwySklejone(), musi już istnieć w schemacie —
  // uruchomienie migracji jest bezpieczne (idempotentne) i chroni przed zapisem na bazie
  // ze starszym schematem niż ten kod (wzorzec przejęty z `dziedzicz-wage.ts`).
  zastosujMigracje(sqlite);

  const wynik = naprawNazwySklejone(db, wiersze, {
    reason: "import CSV 164-BUG-poprawione-nazwy-sklejonych-opon (kolizja kod_importu)",
  });

  console.log(
    `napraw-nazwy-sklejone: zapisano ${wynik.przetworzono}/${wiersze.length} poprawek nazw ` +
      `(pominięto ${wynik.pominietoPusteNazwy} z pustą nazwą).`,
  );
} finally {
  sqlite.close();
}
