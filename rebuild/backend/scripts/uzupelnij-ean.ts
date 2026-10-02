// Ticket 168-FEATURE-uzupelnianie-ean-999 — uzupełnienie pustych `products.ean` w całym katalogu
// (prefiks 999, tabela par `ean_pary`). Ta sama logika co `POST /api/ean-pary/uzupelnij`.
//
// ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT — patrz `src/ean-pary/uzupelnianie.ts`. Idempotentne: dotyka
// wyłącznie pustych EAN-ów, więc kolejne uruchomienie po wdrożeniu nic nie zmienia. Uruchamiane
// przy każdym deployu produkcji (`tools/deploy-produkcja.sh`), PO migracjach.
//
//   DB_PATH=./data/bridge.db npm run uzupelnij-ean            # zapis
//   DB_PATH=./data/bridge.db npm run uzupelnij-ean -- --dry   # tylko policz

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { uzupelnijKatalog } from "../src/ean-pary/uzupelnianie.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("uzupelnij-ean: brak DB_PATH — nie wiem, którą bazę czytać. Przerywam.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry");

const { sqlite, db } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);
  const wynik = uzupelnijKatalog(db, { dryRun });
  console.log(
    `uzupelnij-ean${dryRun ? " (dry-run)" : ""}: uzupełniono ${wynik.uzupelniono} pustych EAN-ów, ` +
      `zastąpiono ${wynik.zastapiono} par prawdziwym EAN-em.`,
  );
} finally {
  sqlite.close();
}
