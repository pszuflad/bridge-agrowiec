// Dokłada konta Erwina i Anny (Marta i Arkadiusz zostają bez zmian) z hasłem tymczasowym.
// Hasło NIE jest w repozytorium (publiczne) — podaj je w env:
//
//   DB_PATH=/sciezka/do/bazy.db HASLO_TYMCZASOWE='...' npm run dodaj:uzytkownikow
//
// Idempotentne: istniejące konto zostaje nietknięte. Użytkownicy zmieniają hasło w /moje-konto.
import { dodajUzytkownika } from "../src/auth/dodaj-uzytkownika.js";
import { otworzBaze } from "../src/db/index.js";

const dbPath = process.env.DB_PATH;
const haslo = process.env.HASLO_TYMCZASOWE;
if (!dbPath || !haslo) {
  console.error("Wymagane: DB_PATH i HASLO_TYMCZASOWE.");
  process.exit(1);
}
if (haslo.length < 8) {
  console.error("HASLO_TYMCZASOWE musi mieć co najmniej 8 znaków.");
  process.exit(1);
}

const KONTA = [
  { email: "erwin.wojtysiak@agrowiec.eu", imieNazwisko: "Erwin Wojtysiak" },
  { email: "anna.naumowicz4@gmail.com", imieNazwisko: "Anna Naumowicz" },
];

const { sqlite, db } = otworzBaze(dbPath);
try {
  for (const { email, imieNazwisko } of KONTA) {
    console.log(`${email}: ${await dodajUzytkownika(db, email, imieNazwisko, haslo)}`);
  }
} finally {
  sqlite.close();
}
