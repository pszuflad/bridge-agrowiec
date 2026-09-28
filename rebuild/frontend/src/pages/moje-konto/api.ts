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
 * Błąd zwrócony przez serwer (odpowiedź z kodem 4xx/5xx), w odróżnieniu od awarii sieci.
 *
 * ⚠ TO ROZRÓŻNIENIE JEST CZĘŚCIĄ PORTU, nie ozdobnikiem. Oryginał ma DWA różne toasty
 * (`:27680-27698`): dla odpowiedzi błędu — „Nie udało się zmienić hasła" z `error` z ciała,
 * a dla wyjątku (`fetch` rzucił, bo sieć padła) — „Błąd" z `e.message`. Bez własnego typu
 * oba przypadki wpadłyby do jednego `catch` i Ania przy zerwanym łączu zobaczyłaby
 * komunikat sugerujący, że to serwer odrzucił jej hasło.
 */
export class BladOdpowiedziSerwera extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "BladOdpowiedziSerwera";
    this.code = code;
  }
}

/**
 * ⚠ NIE używa `zadanie()` z `lib/api`. Tamten helper woła `rzucGdyBlad`, który zamienia
 * odpowiedź błędu w `Error("401: {…}")` — a ten formularz musi pokazać `error` z CIAŁA
 * odpowiedzi, dokładnie jak oryginał (`await e.json().catch(() => ({}))` PRZED sprawdzeniem
 * `e.ok`, `:27681-27688`). Sklejony komunikat ze statusem byłby regresją wobec produkcji.
 *
 * @throws {BladOdpowiedziSerwera} gdy serwer odrzucił żądanie
 * @throws {Error} gdy `fetch` sam rzucił — awaria sieci, osobny toast w komponencie
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
    throw new BladOdpowiedziSerwera(cialo.error || "Spróbuj ponownie", cialo.code);
  }
}
