// Wejście dla `npm run migrate` — stosuje kanoniczny schemat/migracje na DB_PATH.
// Wywoływane przez tools/deploy-staging.sh po buildzie (kontrakt deployu).
import { otworzBaze } from "./index.js";
import { znajdzKatalogMigracji, zastosujMigracje } from "./migrate.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("Brak DB_PATH — ustaw ścieżkę do pliku bazy SQLite.");
  process.exit(1);
}

const katalog = znajdzKatalogMigracji();
const { sqlite } = otworzBaze(dbPath);
try {
  const { zastosowane, pominiete, bezTresci } = zastosujMigracje(sqlite, katalog);
  console.log(`migrate: baza ${dbPath}, migracje z ${katalog}`);
  console.log(
    `migrate: zastosowano ${zastosowane.length} (${zastosowane.join(", ") || "—"}), ` +
      `pominięto ${pominiete.length} (już zastosowane)`,
  );
  if (bezTresci.length > 0) {
    // Np. 003 na bazie produkcji, gdzie `szerokosc` jest już TEXT — odnotowana, treść niewykonana.
    console.log(`migrate: w tym bez treści (warunek dyrektywy @pomin-jesli-…): ${bezTresci.join(", ")}`);
  }
} finally {
  sqlite.close();
}
