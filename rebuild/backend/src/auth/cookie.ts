import type { Request, Response } from "express";

/** Nazwa cookie sesji — 1:1 z oryginałem (backend-index.cjs:47854). */
export const NAZWA_COOKIE_SESJI = "bridge_session";

/** 30 dni, tak jak w oryginale (`Max-Age = 3600 * 24 * 30`, backend-index.cjs:47936). */
export const MAX_AGE_COOKIE_SEK = 60 * 60 * 24 * 30;

/**
 * ODSTĘPSTWO OD ORYGINAŁU (zatwierdzone, plan.md O4): oryginał hardkoduje
 * `SameSite=None; Secure` (flaga `i = !0`, backend-index.cjs:47934-47938).
 * Staging i produkcja są same-origin (frontend i /api pod tą samą domeną przez proxy
 * Apache — deploy/staging/htaccess:12), więc `None` jest niepotrzebne, a `Lax` chroni
 * przed CSRF. `Secure` sterowane środowiskiem, żeby cookie działało też lokalnie po HTTP.
 * Reszta atrybutów (HttpOnly, Path=/, Max-Age=2592000) bez zmian.
 */
export function ustawCookieSesji(res: Response, token: string, secure: boolean): void {
  res.cookie(NAZWA_COOKIE_SESJI, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: MAX_AGE_COOKIE_SEK * 1000,
  });
}

/**
 * Czyści cookie sesji. Atrybuty muszą się zgadzać z tymi użytymi przy ustawianiu —
 * inaczej przeglądarka potrafi nie nadpisać istniejącego cookie (plan.md O6).
 */
export function wyczyscCookieSesji(res: Response, secure: boolean): void {
  res.clearCookie(NAZWA_COOKIE_SESJI, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
}

/** Odpowiednik `nV` z oryginału (backend-index.cjs:47870-47878) — bez zależności cookie-parser. */
export function odczytajCookie(req: Request, nazwa: string): string | undefined {
  const naglowek = req.headers.cookie ?? "";
  for (const kawalek of naglowek.split(";")) {
    const [klucz, ...reszta] = kawalek.trim().split("=");
    if (klucz === nazwa) return decodeURIComponent(reszta.join("="));
  }
  return undefined;
}
