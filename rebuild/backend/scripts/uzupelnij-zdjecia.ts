// Ticket 202-FEATURE-link-zdjecia-po-modelu — uzupełnienie pustych linków do zdjęć w katalogu
// po marce+modelu. ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT — patrz `src/import/dziedziczenieLinkow.ts`.
// Cienki wrapper CLI wokół tych samych funkcji, których używa `POST /api/products/uzupelnij-zdjecia`.
//
//   DB_PATH=./data/bridge.db npm run uzupelnij-zdjecia            # tylko podgląd
//   DB_PATH=./data/bridge.db npm run uzupelnij-zdjecia -- --zapisz  # zapis

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { proponujLinkiKatalogu, uzupelnijLinkiWstecznie } from "../src/import/dziedziczenieLinkow.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("uzupelnij-zdjecia: brak DB_PATH — nie wiem, którą bazę czytać. Przerywam.");
  process.exit(1);
}

const { sqlite, db } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);

  const podglad = proponujLinkiKatalogu(db);
  console.log(
    `uzupelnij-zdjecia: ${podglad.wszystkichPustych} produktów bez linku; propozycje: ${podglad.propozycje.length} ` +
      `(pominięto: ${podglad.pominietoPoprawka} poprawka linku, ${podglad.pominietoBrakDanych} brak marki/modelu, ` +
      `${podglad.pominietoBrakDopasowania} brak pasującego produktu z linkiem).`,
  );

  if (process.argv.includes("--zapisz")) {
    const wynik = uzupelnijLinkiWstecznie(db, sqlite);
    console.log(`uzupelnij-zdjecia: zapisano ${wynik.zaktualizowano} linków.`);
  } else {
    console.log("uzupelnij-zdjecia: to był tylko podgląd — dodaj --zapisz, żeby zapisać.");
  }
} finally {
  sqlite.close();
}
