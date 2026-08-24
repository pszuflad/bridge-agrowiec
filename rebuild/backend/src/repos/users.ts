import { eq } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { users } from "../db/schema.js";

export type Uzytkownik = typeof users.$inferSelect;

/**
 * Dopasowanie e-maila jest DOKŁADNE — bez `trim()` i bez `lowercase()`,
 * tak jak w oryginale (`where eq(users.email, t)`, backend-index.cjs:45052-45054).
 * Przycinanie białych znaków robi frontend (spec-frontend.md §5: `email.trim()`).
 */
export function pobierzUzytkownikaPoEmailu(db: Baza, email: string): Uzytkownik | undefined {
  return db.select().from(users).where(eq(users.email, email)).get();
}

export function pobierzUzytkownikaPoId(db: Baza, id: number): Uzytkownik | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/** Oryginał: `updateUserLogin` — znacznik ISO chwili logowania (backend-index.cjs:45060-45063). */
export function zapiszOstatnieLogowanie(db: Baza, id: number, kiedy = new Date()): void {
  db.update(users).set({ ostatnieLogowanie: kiedy.toISOString() }).where(eq(users.id, id)).run();
}
