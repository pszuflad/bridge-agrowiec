// Alerty — `/api/alerts` (`Ki`). Dwie trasy, port `deminified/backend-index.cjs:48688-48691`:
//
//   e.get("/api/alerts", (c,u) => u.json(U.listAlerts())),
//   e.patch("/api/alerts/:id", we, (c,u) => {
//     U.updateAlertStatus(parseInt(c.params.id), c.body.status), u.json({ok:!0})
//   })
//
// ⚠ PISANIE alertów NIE JEST TUTAJ. Alerty tworzy import (`import/synchronizuj.ts`,
// bloki 3f-1/3f-2) przez `zapiszAlert`; ta trasa ich nie produkuje i produkować nie ma.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { listAlerts, updateAlertStatus } from "../repos/alerts.js";

export type ZaleznosciAlertow = {
  db: Baza;
};

export function trasyAlertow({ db }: ZaleznosciAlertow): Router {
  const router = Router();

  /**
   * Lista alertów (`:48688`). Odpowiedź to GOŁA TABLICA, nie koperta —
   * `contract/fixtures/GET_alerts.json`. Sortowanie `data` MALEJĄCO, bez limitu.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (D1 z I1): w produkcji ta trasa jest PUBLICZNA (brak `we`,
   * `security: []` w `contract/openapi.yaml:67`). Stosujemy `requireAuth`, kontynuując
   * decyzję zaklepaną w I1 dla wszystkich tras danych — tak samo jak `GET /api/products`
   * (I2), `GET /api/staging` (3b), `GET /api/overrides` (3d-2) i `GET /api/markups` (4a).
   * Kształt odpowiedzi bez zmian.
   */
  router.get("/api/alerts", requireAuth, (_req: Request, res: Response) => {
    res.json(listAlerts(db));
  });

  /**
   * Zmiana stanu alertu (`:48689`). Jedyne pole ciała to `status`.
   *
   * ⚠ TRZY RZECZY ODTWORZONE 1:1, KTÓRE WYGLĄDAJĄ NA BRAKI (decyzja D4 planu):
   *  1. **Zawsze `{ok:true}`, nigdy 404** — oryginał nie sprawdza, czy alert o tym `id`
   *     istnieje; UPDATE bez trafienia jest cichym no-opem. Bliźniacze trasy
   *     `DELETE /api/overrides/:id` i `PATCH /api/markups/:id` 404 mają, ta nie.
   *  2. **Brak walidacji `status`** — kolumna nie ma `CHECK`, oryginał zapisuje dowolny
   *     napis. Widok wysyła wyłącznie `nowy`/`rozwiazany` (typ `StatusAlertu`).
   *  3. **Brak wpisu do `audit_log`** — w odróżnieniu od PATCH-ów overrides i markups,
   *     które audytują każdą zmianę. Ta trasa jest jedynym PATCH-em w rebuildzie bez
   *     audytu i tak ma zostać.
   *
   * Powód takiej wierności: dla `PATCH /api/alerts/{id}` NIE MA nagranej próbki
   * w `contract/fixtures/`, więc kod oryginału jest jedynym świadectwem kształtu —
   * każde „ulepszenie" byłoby zgadywaniem kontraktu.
   */
  router.patch("/api/alerts/:id", requireAuth, (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const { status } = (req.body ?? {}) as Record<string, unknown>;

    updateAlertStatus(db, id, String(status));

    res.json({ ok: true });
  });

  return router;
}
