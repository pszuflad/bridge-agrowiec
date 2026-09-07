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

/**
 * Lista użytkowników do `GET /api/users` — port `U.listUsers()` (backend-index.cjs:48195-48201).
 *
 * ⚠ PROJEKCJA JAWNA, nie `select()`. Oryginał mapuje wynik na trzy pola już w trasie
 * (`U.listUsers().map(p => ({id, email, imieNazwisko}))`), a `contract/fixtures/GET_users.json`
 * zamraża dokładnie te trzy klucze. Gołe `select()` przepuściłoby `hasloHash` do odpowiedzi
 * HTTP — projekcja jest tu więc jednocześnie zgodnością z kontraktem i barierą bezpieczeństwa.
 */
export function listaUzytkownikow(db: Baza): Pick<Uzytkownik, "id" | "email" | "imieNazwisko">[] {
  return db
    .select({ id: users.id, email: users.email, imieNazwisko: users.imieNazwisko })
    .from(users)
    .all();
}

/** Oryginał: `updateUserPassword` — zapis nowego hasha bcrypt (`P4`, backend-index.cjs:47929). */
export function zapiszHasloUzytkownika(db: Baza, id: number, hasloHash: string): void {
  db.update(users).set({ hasloHash }).where(eq(users.id, id)).run();
}
