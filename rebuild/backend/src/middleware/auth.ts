import type { NextFunction, Request, RequestHandler, Response } from "express";
import { NAZWA_COOKIE_SESJI, odczytajCookie } from "../auth/cookie.js";
import { zweryfikujToken } from "../auth/jwt.js";

/**
 * Wyciąga token z żądania — odpowiednik `iV` (backend-index.cjs:47880-47881).
 * Pierwszeństwo ma nagłówek `Authorization: Bearer`, potem cookie `bridge_session`.
 * Oba działają RÓWNOLEGLE (spec-frontend.md §5: Bearer gdy token + credentials:"include").
 */
export function wyciagnijToken(req: Request): string | undefined {
  const naglowek = req.headers.authorization ?? "";
  if (naglowek.startsWith("Bearer ")) return naglowek.slice(7);
  return odczytajCookie(req, NAZWA_COOKIE_SESJI);
}

/**
 * Odpowiednik `C4` (backend-index.cjs:47883-47890) — wpinany globalnie.
 * Ustawia `req.user`, jeśli token jest ważny; nieważny/brak tokenu NIE jest błędem
 * (o dostępie decyduje dopiero `requireAuth`).
 */
export function optionalAuth(sekret: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = wyciagnijToken(req);
    if (token) {
      const payload = zweryfikujToken(token, sekret);
      if (payload) req.user = payload;
    }
    next();
  };
}

/**
 * Odpowiednik `we` (backend-index.cjs:47892-47897) — bramka na trasy danych.
 * Komunikat 401 verbatim jak w oryginale.
 *
 * ZASADA §3 (zatwierdzona, plan.md O1): w odbudowie nakładamy go na KAŻDĄ trasę danych,
 * także tam, gdzie oryginał zostawił trasę publiczną.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Nieautoryzowany" });
    return;
  }
  next();
};
