import { Router, type RequestHandler } from "express";
import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { listaDostawcow } from "../repos/suppliers.js";

export type ZaleznosciDostawcow = {
  db: Baza;
};

/**
 * Dostawcy — wierne odtworzenie oryginału (backend-index.cjs:48213-48216).
 *
 * Oryginał rejestruje JEDEN handler pod DWIEMA ścieżkami: `/api/dostawcy` (używane przez
 * ekran konfiguracji) i `/api/suppliers` (używane przez katalog). Oba mają własne fixtures
 * — `GET_dostawcy.json` i `GET_suppliers.json` — i są one identyczne co do bajta,
 * co potwierdza, że to ta sama odpowiedź.
 *
 * W I2 dokładamy tylko ODCZYT. `PATCH /api/dostawcy/{id}` należy do Iteracji 11.
 */
export function trasyDostawcow({ db }: ZaleznosciDostawcow): Router {
  const router = Router();

  const lista: RequestHandler = (_req, res) => {
    res.json(listaDostawcow(db));
  };

  router.get("/api/dostawcy", requireAuth, lista);
  router.get("/api/suppliers", requireAuth, lista);

  return router;
}
