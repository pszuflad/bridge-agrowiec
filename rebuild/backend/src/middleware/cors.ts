import type { RequestHandler } from "express";

/**
 * ODSTĘPSTWO OD ORYGINAŁU (zatwierdzone, plan.md O3): oryginał odbijał DOWOLNY `Origin`
 * razem z `Access-Control-Allow-Credentials: true` (backend-index.cjs:48926-48930) —
 * przy takim ustawieniu każda strona w internecie mogła czytać dane zalogowanego
 * użytkownika. Tutaj CORS jest domyślnie WYŁĄCZONY: staging i produkcja są same-origin
 * (frontend i /api pod tą samą domeną przez proxy Apache — deploy/staging/htaccess:12).
 *
 * Allowlista (CORS_ORIGINS) służy tylko lokalnemu developmentowi frontendu,
 * gdy Vite stoi na innym porcie niż backend.
 */
export function corsZAllowlisty(dozwoloneOrigins: string[]): RequestHandler {
  const dozwolone = new Set(dozwoloneOrigins);

  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && dozwolone.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      // Preflight z niedozwolonego originu dostaje 204 bez nagłówków CORS — przeglądarka odrzuci.
      res.sendStatus(204);
      return;
    }
    next();
  };
}
