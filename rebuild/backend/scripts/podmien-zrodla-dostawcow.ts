// Podmiana starych źródeł cenników (agroopony.eu/imports/…) na lokalne foldery dostawców:
// pole `url` dostawcy dostaje `plik:///<IMPORTY_KATALOG>/<KOD>_…`, więc folder widać w panelu
// (Admin → Dostawcy). MO2 i MO3 zostają na swoich zewnętrznych adresach (decyzja użytkownika).
//
// Idempotentne: dotyka tylko dostawców z pustym URL-em albo adresem z agroopony.eu/imports;
// ponowne uruchomienie niczego nie zmienia. Bez IMPORTY_KATALOG (lub bez folderu dostawcy) pomija krok.
//
//   DB_PATH=./data/bridge.db IMPORTY_KATALOG=/…/selly-agroopony npm run podmien-zrodla [-- --dry]

import { eq } from "drizzle-orm";

import { otworzBaze } from "../src/db/index.js";
import { suppliers } from "../src/db/schema.js";
import { czyStareZrodlo, folderDostawcy, folderZUrl } from "../src/import/katalog-importow.js";

const ZOSTAJA = new Set(["MO2", "MO3"]);

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("podmien-zrodla: brak DB_PATH — nie wiem, którą bazę zmieniać. Przerywam.");
  process.exit(1);
}
const katalog = process.env.IMPORTY_KATALOG?.trim();
if (!katalog) {
  console.log("podmien-zrodla: brak IMPORTY_KATALOG — pomijam.");
  process.exit(0);
}
const dry = process.argv.includes("--dry");

const { sqlite, db } = otworzBaze(dbPath);
try {
  let zmieniono = 0;
  for (const d of db.select().from(suppliers).all()) {
    if (ZOSTAJA.has(d.kod) || folderZUrl(d.url) || !czyStareZrodlo(d.url)) continue;
    const folder = folderDostawcy(katalog, d.kod);
    if (!folder) {
      console.log(`podmien-zrodla: ${d.kod} — brak folderu w ${katalog}, zostawiam bez zmian.`);
      continue;
    }
    console.log(`podmien-zrodla${dry ? " (dry-run)" : ""}: ${d.kod}: ${d.url ?? "(pusty)"} → plik://${folder}`);
    if (!dry) db.update(suppliers).set({ url: `plik://${folder}` }).where(eq(suppliers.id, d.id)).run();
    zmieniono++;
  }
  console.log(`podmien-zrodla: ${zmieniono} dostawców.`);
} finally {
  sqlite.close();
}
