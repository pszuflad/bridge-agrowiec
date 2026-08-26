import { Router } from "express";
import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import {
  listaStagingu,
  listaStaginguStronicowana,
  pozycjaStaginguPoId,
  stronaStaginguZFiltrami,
} from "../repos/staging.js";

export type ZaleznosciStagingu = {
  db: Baza;
};

/** Górny pułap `limit` w `/api/staging` (backend-index.cjs:48489: `Math.min(…, 2e3)`). */
export const MAX_LIMIT = 2000;

/** Wartość `limit` używana, gdy parametr jest obecny, ale nie daje się sparsować. */
export const DOMYSLNY_LIMIT = 200;

/** Domyślny i maksymalny `pageSize` w `/paged` (pagination_module.cjs:19). */
export const DOMYSLNY_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/**
 * Staging — odczyt. Trzy trasy pochodzące z DWÓCH różnych modułów produkcji, o trzech
 * różnych kształtach odpowiedzi (szczegóły i uzasadnienie w `repos/staging.ts`).
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D1): `contract/openapi.yaml:1042` opisuje
 * `GET /api/staging` jako PUBLICZNE (`security: []`) — bo taka jest produkcja.
 * Stosujemy `requireAuth`, kontynuując decyzję zaklepaną w I1 (auth na wszystkich
 * trasach danych) i zastosowaną w I2 do `GET /api/products`, też publicznego w kontrakcie.
 *
 * Mutacje (`accept`, `reject`, `import`, `clear`, `PUT`/`DELETE /{id}`) należą do 3d.
 */
export function trasyStagingu({ db }: ZaleznosciStagingu): Router {
  const router = Router();

  /**
   * DWA kształty odpowiedzi, jak w `/api/products`:
   *   • `limit` NIEPODANY → goła TABLICA wszystkich pozycji
   *   • `limit` podany    → `{ items, total, limit, offset }`
   *
   * 1:1 z oryginałem: `parseInt(…) || 200`, więc NaN i 0 dają 200, a nie błąd.
   */
  router.get("/api/staging", requireAuth, (req, res) => {
    const limit =
      req.query.limit !== undefined
        ? Math.min(parseInt(String(req.query.limit), 10) || DOMYSLNY_LIMIT, MAX_LIMIT)
        : undefined;
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

    if (limit === undefined) {
      res.json(listaStagingu(db));
      return;
    }

    const { items, total } = listaStaginguStronicowana(db, limit, offset);
    res.json({ items, total, limit, offset });
  });

  /**
   * Rejestracja PRZED `/:id` jest konieczna — Express dopasowuje trasy po kolei, więc
   * przy odwrotnej kolejności `"paged"` wpadłoby w parametr `:id`. Oryginał ma tę samą
   * kolejność (pagination_module.cjs:16 przed :91).
   */
  router.get("/api/staging/paged", requireAuth, (req, res) => {
    // `Math.max(1, …)` i `Math.min(200, Math.max(1, …))` — 1:1 z pagination_module.cjs:18-19.
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        parseInt(String(req.query.pageSize ?? req.query.limit ?? DOMYSLNY_PAGE_SIZE), 10) ||
          DOMYSLNY_PAGE_SIZE,
      ),
    );

    res.json(
      stronaStaginguZFiltrami(db, {
        page,
        pageSize,
        typZmiany: req.query.typZmiany ? String(req.query.typZmiany) : undefined,
        dostawca: req.query.dostawca ? String(req.query.dostawca) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
      }),
    );
  });

  router.get("/api/staging/:id", requireAuth, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Nieprawidłowy id" });
      return;
    }

    const pozycja = pozycjaStaginguPoId(db, id);
    if (!pozycja) {
      res.status(404).json({ error: "Nie znaleziono pozycji stagingu" });
      return;
    }
    res.json(pozycja);
  });

  return router;
}
