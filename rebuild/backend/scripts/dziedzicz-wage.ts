// Ticket 155-FEATURE-dziedziczenie-wagi-po-rozmiarze — dociągnięcie wagi WSTECZNIE dla
// produktów już w katalogu, które mają dziś pustą albo zerową wagę (decyzja 3 z Q&A).
//
// ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT — patrz `src/import/dziedziczenieWagi.ts`. Cienki wrapper
// CLI wokół `dziedziczWageWstecznie()` — od ticketu 156 ta sama logika stoi też za przyciskiem
// „Dociągnij wagę" w Konfiguracji → Katalog (`POST /api/products/dziedzicz-wage`), więc
// skrypt i trasa HTTP nie mogą się rozjechać.
//
//   DB_PATH=./data/bridge.db npm run dziedzicz-wage

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { dziedziczWageWstecznie } from "../src/import/dziedziczenieWagi.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("dziedzicz-wage: brak DB_PATH — nie wiem, którą bazę czytać. Przerywam.");
  process.exit(1);
}

const { sqlite, db } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);

  const wynik = dziedziczWageWstecznie(db, sqlite);

  console.log(
    `dziedzicz-wage: zaktualizowano ${wynik.zaktualizowano}/${wynik.wszystkichKandydatow} produktów ` +
      `(pominięto: ${wynik.pominietoOverride} ręczna poprawka wagi, ${wynik.pominietoBrakDanych} brak marki/rozmiaru, ` +
      `${wynik.pominietoBrakDopasowania} brak pasującego produktu z wagą).`,
  );
} finally {
  sqlite.close();
}
