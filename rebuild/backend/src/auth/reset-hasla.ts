import type { Baza } from "../db/index.js";
import { pobierzUzytkownikaPoEmailu, zapiszHasloUzytkownika } from "../repos/users.js";
import { zahashujHaslo } from "./password.js";

/**
 * Ustawia istniejącemu kontu hasło tymczasowe (reset, gdy użytkownik nie pamięta hasła).
 * E-mail dopasowywany dokładnie, jak w logowaniu. Dotyka WYŁĄCZNIE `haslo_hash` — imię, e-mail i
 * data ostatniego logowania zostają. Brak konta nie jest wyjątkiem: wołający decyduje, co dalej.
 */
export async function ustawHasloTymczasowe(
  db: Baza,
  email: string,
  hasloTymczasowe: string,
): Promise<"zmieniono" | "brak_konta"> {
  const uzytkownik = pobierzUzytkownikaPoEmailu(db, email);
  if (!uzytkownik) return "brak_konta";
  zapiszHasloUzytkownika(db, uzytkownik.id, await zahashujHaslo(hasloTymczasowe));
  return "zmieniono";
}
