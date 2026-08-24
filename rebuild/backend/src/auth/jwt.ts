import jwt from "jsonwebtoken";

/** Payload podpisywany przy logowaniu — 1:1 z oryginałem (backend-index.cjs:47898-47904). */
export type PayloadUzytkownika = {
  id: number;
  email: string;
  imieNazwisko: string;
};

/** To, co zwraca `jwt.verify` — payload + standardowe pola dołożone przez `jwt.sign`. */
export type PayloadTokena = PayloadUzytkownika & { iat: number; exp: number };

/** Oryginał: `jwt.sign(payload, secret, { expiresIn: "30d" })` (backend-index.cjs:47856-47859). */
export const CZAS_ZYCIA_TOKENA = "30d";

/** 30 dni w sekundach — musi się zgadzać z CZAS_ZYCIA_TOKENA (fixture: exp - iat = 2592000). */
export const CZAS_ZYCIA_TOKENA_SEK = 60 * 60 * 24 * 30;

export function podpiszToken(payload: PayloadUzytkownika, sekret: string): string {
  return jwt.sign(payload, sekret, { expiresIn: CZAS_ZYCIA_TOKENA });
}

/**
 * Weryfikuje token; przy dowolnym błędzie (zły podpis, wygaśnięcie, śmieci)
 * zwraca `null` — tak jak `tV` w oryginale (backend-index.cjs:47861-47868).
 */
export function zweryfikujToken(token: string, sekret: string): PayloadTokena | null {
  try {
    const payload = jwt.verify(token, sekret);
    if (!maKsztaltPayloadu(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}

function maKsztaltPayloadu(payload: unknown): payload is PayloadTokena {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.id === "number" &&
    typeof p.email === "string" &&
    typeof p.imieNazwisko === "string" &&
    typeof p.iat === "number" &&
    typeof p.exp === "number"
  );
}
