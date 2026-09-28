import type { Baza } from "../db/index.js";
import { pobierzUzytkownikaPoId, zapiszHasloUzytkownika } from "../repos/users.js";
import { porownajHaslo, zahashujHaslo } from "./password.js";

/**
 * Kody błędów `P4()` — 1:1 z oryginałem (backend-index.cjs:47905-47931).
 * Trasa mapuje je na status HTTP: `WRONG_OLD_PASSWORD` → 401, reszta → 400 (`:48212`).
 */
export type KodBleduHasla =
  | "USER_NOT_FOUND"
  | "WRONG_OLD_PASSWORD"
  | "WEAK_PASSWORD"
  | "SAME_PASSWORD";

export type WynikZmianyHasla = { ok: true } | { ok: false; code: KodBleduHasla; message: string };

/** Minimalna długość nowego hasła — `n.length < 8` (`:47921`). */
export const MIN_DLUGOSC_HASLA = 8;

/**
 * Zmiana hasła — port `P4(t, e, n)` (backend-index.cjs:47905-47931).
 *
 * KOLEJNOŚĆ SPRAWDZEŃ JEST CZĘŚCIĄ KONTRAKTU i odtwarzamy ją co do kroku:
 *  1. użytkownik nie istnieje → `USER_NOT_FOUND`;
 *  2. stare hasło nie pasuje → `WRONG_OLD_PASSWORD` (jedyny przypadek z 401);
 *  3. nowe krótsze niż 8 znaków → `WEAK_PASSWORD`;
 *  4. nowe równe staremu → `SAME_PASSWORD`.
 *
 * ⚠ Krok 2 idzie PRZED walidacją siły nowego hasła. Dzięki temu ktoś bez znajomości starego
 * hasła nie dowie się z komunikatu niczego o regułach — i tak samo działa oryginał, więc
 * nie ma tu nic do „poprawiania".
 *
 * ⚠ Krok 4 porównuje przez `bcrypt.compare(nowe, hash)`, a nie stringi `stare === nowe`.
 * Różnica jest realna: nowe hasło identyczne z aktualnym zostanie odrzucone także wtedy,
 * gdy użytkownik podał stare hasło w innej formie zapisu, bo liczy się hash w bazie.
 */
export async function zmienHaslo(
  db: Baza,
  uzytkownikId: number,
  stare: string,
  nowe: string,
): Promise<WynikZmianyHasla> {
  const uzytkownik = pobierzUzytkownikaPoId(db, uzytkownikId);
  if (!uzytkownik) {
    return { ok: false, code: "USER_NOT_FOUND", message: "Użytkownik nie istnieje" };
  }

  if (!(await porownajHaslo(stare, uzytkownik.hasloHash))) {
    return { ok: false, code: "WRONG_OLD_PASSWORD", message: "Aktualne hasło jest nieprawidłowe" };
  }

  if (typeof nowe !== "string" || nowe.length < MIN_DLUGOSC_HASLA) {
    return {
      ok: false,
      code: "WEAK_PASSWORD",
      message: "Nowe hasło musi mieć co najmniej 8 znaków",
    };
  }

  if (await porownajHaslo(nowe, uzytkownik.hasloHash)) {
    return { ok: false, code: "SAME_PASSWORD", message: "Nowe hasło musi być inne niż aktualne" };
  }

  zapiszHasloUzytkownika(db, uzytkownik.id, await zahashujHaslo(nowe));
  return { ok: true };
}
