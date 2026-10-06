import { eq } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { users } from "../db/schema.js";
import { zahashujHaslo } from "./password.js";

/**
 * Zakłada konto z hasłem tymczasowym. Istniejącego konta NIE rusza (ani hasła, ani nazwy),
 * żeby ponowne uruchomienie nie nadpisało hasła ustawionego już przez użytkownika.
 * E-mail dopasowywany dokładnie, jak w logowaniu (`pobierzUzytkownikaPoEmailu`).
 */
export async function dodajUzytkownika(
  db: Baza,
  email: string,
  imieNazwisko: string,
  hasloTymczasowe: string,
): Promise<"utworzono" | "istnieje"> {
  if (db.select().from(users).where(eq(users.email, email)).get()) return "istnieje";
  db.insert(users)
    .values({
      email,
      hasloHash: await zahashujHaslo(hasloTymczasowe),
      imieNazwisko,
      utworzono: new Date().toISOString(),
    })
    .run();
  return "utworzono";
}
