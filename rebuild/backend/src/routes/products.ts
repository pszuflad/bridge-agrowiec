import { Router } from "express";
import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { listaProduktow, listaProduktowStronicowana } from "../repos/products.js";

export type ZaleznosciProduktow = {
  db: Baza;
};

/** Górny pułap `limit` z oryginału (backend-index.cjs:48281: `Math.min(…, 2e3)`). */
export const MAX_LIMIT = 2000;

/** Wartość `limit` używana, gdy parametr jest obecny, ale nie daje się sparsować. */
export const DOMYSLNY_LIMIT = 200;

/**
 * Produkty — wierne odtworzenie oryginału (backend-index.cjs:48280-48294).
 *
 * ⚠ Endpoint ma DWA kształty odpowiedzi i to nie jest niedopatrzenie:
 *
 *   • `limit` NIEPODANY i `dostawca` NIEPODANY  →  goła TABLICA wszystkich produktów
 *   • w każdym innym przypadku                  →  `{ items, total, limit, offset }`
 *
 * Frontend katalogu korzysta z pierwszego wariantu (`queryKey: ["/api/products"]`,
 * frontend-index.js:23261) — pobiera komplet i filtruje/sortuje/paginuje u siebie.
 * Fixture `contract/fixtures/GET_products.json` zamraża wariant drugi (`?limit=5`).
 *
 * Endpoint NIE zna `search` ani `sort` — produkcja ich nie obsługuje.
 * `GET /api/products/{id}` nie istnieje ani w produkcji, ani w kontrakcie
 * (openapi.yaml:834-870 ma tam wyłącznie delete/patch/put) — dlatego go tu nie ma.
 */
export function trasyProduktow({ db }: ZaleznosciProduktow): Router {
  const router = Router();

  router.get("/api/products", requireAuth, (req, res) => {
    // 1:1 z oryginałem: `parseInt(…) || 200` — czyli NaN i 0 dają 200, a nie błąd.
    // Rozróżnienie „brak parametru" vs „parametr niepoprawny" jest tu istotne,
    // bo tylko brak przełącza odpowiedź na gołą tablicę.
    const limit =
      req.query.limit !== undefined
        ? Math.min(parseInt(String(req.query.limit), 10) || DOMYSLNY_LIMIT, MAX_LIMIT)
        : undefined;
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
    const dostawca = req.query.dostawca ? String(req.query.dostawca) : undefined;

    if (limit === undefined && dostawca === undefined) {
      res.json(listaProduktow(db));
      return;
    }

    const { items, total } = listaProduktowStronicowana(
      db,
      limit ?? DOMYSLNY_LIMIT,
      offset,
      dostawca,
    );
    res.json({ items, total, limit: limit ?? DOMYSLNY_LIMIT, offset });
  });

  return router;
}
