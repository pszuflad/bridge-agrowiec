// Zasiewa lokalną bazę deweloperską jednym użytkownikiem, żeby dało się zalogować
// bez snapshotu produkcji. NIE używane w testach (te mają własny seed) ani na stagingu
// (tam baza to snapshot produkcji z realnymi kontami).
//
//   DB_PATH=./data/bridge.db npm run seed:dev -- <email> <hasło> "<Imię Nazwisko>"
import { eq } from "drizzle-orm";
import { zahashujHaslo } from "../src/auth/password.js";
import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { users } from "../src/db/schema.js";

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
} finally {
  sqlite.close();
}
