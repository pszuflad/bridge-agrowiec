// Zasiewa lokalną bazę deweloperską jednym użytkownikiem, żeby dało się zalogować
// bez snapshotu produkcji, oraz danymi startowymi spedycji i konfiguracji (I11) — bez nich
// `/konfiguracja` otwiera się na pustych zakładkach. NIE używane w testach (te mają własny
// seed) ani na stagingu (tam baza to snapshot produkcji z realnymi kontami).
//
//   DB_PATH=./data/bridge.db npm run seed:dev -- <email> <hasło> "<Imię Nazwisko>"
import { eq } from "drizzle-orm";
import { zahashujHaslo } from "../src/auth/password.js";
import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KONFIGURACJA_POCZATKOWA, SPEDYCJA_POCZATKOWA } from "../src/db/seed-poczatkowy.js";
import { config, spedycjaLimity, users } from "../src/db/schema.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("Brak DB_PATH.");
  process.exit(1);
}

const [email = "dev@bridge.local", haslo = "dev12345", imieNazwisko = "Konto Deweloperskie"] =
  process.argv.slice(2);

const { sqlite, db } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);
  const hasloHash = await zahashujHaslo(haslo);
  const istniejacy = db.select().from(users).where(eq(users.email, email)).get();
  if (istniejacy) {
    db.update(users).set({ hasloHash, imieNazwisko }).where(eq(users.id, istniejacy.id)).run();
    console.log(`seed:dev: zaktualizowano hasło użytkownika ${email} (id=${istniejacy.id})`);
  } else {
    const wstawiony = db
      .insert(users)
      .values({ email, hasloHash, imieNazwisko, utworzono: new Date().toISOString() })
      .returning()
      .get();
    console.log(`seed:dev: utworzono użytkownika ${email} (id=${wstawiony.id})`);
  }

  // Spedycja i konfiguracja — port seeda produkcji (`zw()`, backend-index.cjs:45710-45716).
  // `onConflictDoNothing` zamiast czyszczenia: ponowny `seed:dev` nie ma prawa nadpisać
  // ustawień, które ktoś zdążył zmienić w `/konfiguracja`.
  let dosianoSpedycji = 0;
  for (const wiersz of SPEDYCJA_POCZATKOWA) {
    const wynik = db.insert(spedycjaLimity).values(wiersz).onConflictDoNothing().run();
    dosianoSpedycji += wynik.changes;
  }
  let dosianoKluczy = 0;
  for (const [klucz, wartosc] of Object.entries(KONFIGURACJA_POCZATKOWA)) {
    const wynik = db.insert(config).values({ klucz, wartosc }).onConflictDoNothing().run();
    dosianoKluczy += wynik.changes;
  }
  console.log(
    `seed:dev: spedycja +${dosianoSpedycji}/${SPEDYCJA_POCZATKOWA.length}, ` +
      `config +${dosianoKluczy}/${Object.keys(KONFIGURACJA_POCZATKOWA).length}`,
  );
} finally {
  sqlite.close();
}
