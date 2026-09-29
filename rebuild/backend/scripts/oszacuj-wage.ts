// Ticket 167-FEATURE-oszacuj-pozostale-wagi — wsteczne OSZACOWANIE wagi (średnia po samym
// rozmiarze, bez marki/bieżnika) dla produktów, którym `npm run dziedzicz-wage` (dokładne
// dopasowanie) nic nie znalazła.
//
// ⚠ NOWA LOGIKA, ŚWIADOMIE MNIEJ PEWNA niż `dziedzicz-wage.ts` — patrz
// `src/import/dziedziczenieWagi.ts`. Cienki wrapper CLI wokół `oszacujWageWstecznie()` — ta
// sama logika stoi za przyciskiem „Oszacuj pozostałe wagi" w Konfiguracji → Katalog
// (`POST /api/products/oszacuj-wage`).
//
//   DB_PATH=./data/bridge.db npm run oszacuj-wage

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { oszacujWageWstecznie } from "../src/import/dziedziczenieWagi.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("oszacuj-wage: brak DB_PATH — nie wiem, którą bazę czytać. Przerywam.");
  process.exit(1);
}

const { sqlite, db } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);

  const wynik = oszacujWageWstecznie(db, sqlite);

  console.log(
    `oszacuj-wage: oszacowano ${wynik.zaktualizowano}/${wynik.wszystkichKandydatow} produktów ` +
      `(pominięto: ${wynik.pominietoOverride} ręczna poprawka wagi, ${wynik.pominietoBrakDanych} brak rozmiaru, ` +
      `${wynik.pominietoBrakSredniej} brak jakiegokolwiek produktu tego rozmiaru z wagą).`,
  );
} finally {
  sqlite.close();
}
