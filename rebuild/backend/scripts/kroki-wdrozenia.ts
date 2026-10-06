// Uruchamia kroki wdrożenia z `src/kroki/rejestr.ts` na bazie z DB_PATH (każdy najwyżej raz).
// Woła to `tools/deploy-produkcja.sh` — ręcznie niczego odpalać nie trzeba. Lokalnie:
//
//   DB_PATH=./data/bridge.db npm run kroki-wdrozenia
import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error(
    "kroki-wdrozenia: brak DB_PATH — nie wiem, którą bazę zmieniać. Przerywam.",
  );
  process.exit(1);
}

const { sqlite, db } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);
  const w = await uruchomKroki(sqlite, db, KROKI_WDROZENIA, process.env, (l) =>
    console.log(`kroki-wdrozenia: ${l}`),
  );
  console.log(
    `kroki-wdrozenia: wykonano ${w.wykonane.length}, już wykonane ${w.juzWykonane.length}, ` +
      `pominięte (brak env) ${w.pominieteBrakEnv.length}`,
  );
} finally {
  sqlite.close();
}
