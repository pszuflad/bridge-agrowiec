// Wgrywa tabele transportowe GEIS z pliku JSON (ticket 212, PRT-2.2). Użycie: npm run importuj-geis -- sciezka/geis.json
// Format: patrz `TabeleGeisJson` w src/partnerzy/transport.ts, przykład: docs/tickets/212-FEATURE-partnerzy-transport-geis/geis-przyklad.json.
import { readFileSync } from "node:fs";

import { otworzBaze } from "../src/db/index.js";
import { importujTabeleGeis, type TabeleGeisJson } from "../src/partnerzy/transport.js";

const plik = process.argv[2];
const dbPath = process.env.DB_PATH;
if (!plik || !dbPath) {
  console.error("Użycie: DB_PATH=… npm run importuj-geis -- plik.json");
  process.exit(1);
}
const { sqlite, db } = otworzBaze(dbPath);
try {
  const n = importujTabeleGeis(db, JSON.parse(readFileSync(plik, "utf8")) as TabeleGeisJson);
  console.log(`Wgrano tabele GEIS dla ${n} krajów.`);
} finally {
  sqlite.close();
}
