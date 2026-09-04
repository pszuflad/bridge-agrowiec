/**
 * Klient `POST /api/password/change` — backend gotowy w tej samej sesji
 * (`rebuild/backend/src/routes/konto.ts`, port `P4()` z `backend-index.cjs:47905-47931`).
 */
import { BAZA_API, naglowki } from "@/lib/api";

/** Minimalna długość nowego hasła — 1:1 z backendem (`WEAK_PASSWORD`, `:47921`). */
export const MIN_DLUGOSC_HASLA = 8;

export type BladZmianyHasla = {
  /** Tekst dla użytkownika — pokazujemy go wprost, jak oryginał (`i?.error`, `:27688`). */
  error: string;
  /** `WRONG_OLD_PASSWORD` | `WEAK_PASSWORD` | `SAME_PASSWORD` | `USER_NOT_FOUND`. */
  code?: string;
};

/**
 * ⚠ NIE używa `zadanie()` z `lib/api`. Tamten helper woła `rzucGdyBlad`, który zamienia
 * odpowiedź błędu w `Error("401: {…}")` — a ten formularz musi pokazać `error` z CIAŁA
 * odpowiedzi, dokładnie jak oryginał (`await e.json().catch(() => ({}))` PRZED sprawdzeniem
 * `e.ok`, `:27681-27688`). Sklejony komunikat ze statusem byłby regresją wobec produkcji.
 *
 * @throws gdy sieć padnie — obsługiwane osobno, jak `catch` w oryginale (`:27694`).
 */
export async function zmienHaslo(oldPassword: string, newPassword: string): Promise<void> {
  const odpowiedz = await fetch(`${BAZA_API}/api/password/change`, {
    method: "POST",
    headers: naglowki(true),
    body: JSON.stringify({ oldPassword, newPassword }),
    credentials: "include",
  });

  if (!odpowiedz.ok) {
    const cialo = (await odpowiedz.json().catch(() => ({}))) as Partial<BladZmianyHasla>;
    throw new Error(cialo.error || "Spróbuj ponownie");
  }
}
