import bcrypt from "bcryptjs";

/**
 * Koszt bcrypt = 10, tak jak w oryginale (`bcrypt.hash(n, 10)`, backend-index.cjs:47928).
 *
 * WYMÓG TWARDY: staging używa snapshotu produkcji z realnymi hashami `$2b$10$…`,
 * więc algorytm i format muszą pozostać bcrypt — nie argon2/scrypt (plan.md, Decyzje).
 */
export const KOSZT_BCRYPT = 10;

export function zahashujHaslo(haslo: string): Promise<string> {
  return bcrypt.hash(haslo, KOSZT_BCRYPT);
}

export function porownajHaslo(haslo: string, hash: string): Promise<boolean> {
  return bcrypt.compare(haslo, hash);
}
