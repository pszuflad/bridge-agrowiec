/**
 * Trasy manualne synchronizacji Bridge → Selly, TOR 1 — port
 * `mirror/backend/selly/routes_sync.cjs` (Iteracja 13d-1, ticket 45).
 *
 * Trzy trasy z sześciu, które ma oryginał. Pozostałe trzy (`sync-full-supplier`,
 * `sync-full-today`, `sync-full-force`) to Tor 2 i należą do karty 13d-2.
 *
 * ⚠ AUTH: oryginał rejestruje te trasy ZA `requireAuth` (`extensions.cjs:465` przekazuje
 * `requireAuth: we`), więc `requireAuth` niżej nie jest naszym dodatkiem, tylko portem.
 *
 * ⚠ DWIE Z TRZECH TRAS TORU 2 SĄ U ANI ZEPSUTE — `routes_sync.cjs:14` importuje
 * `runFullTodays`, którego `scheduler_selly.cjs` nie eksportuje (nazwa żyje wyłącznie
 * w `.bak-preref-2026-09-07`). Odnotowane dla 13d-2, tutaj bez konsekwencji.
 */

import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { globalnyLimiter, type Limiter } from "../selly/limiter.js";
import {
  DOSTAWCY_AKTYWNI,
  dostawcyPelnegoNaDzis,
  uruchomDeltaDlaWszystkich,
  type FunkcjaSyncDelta,
} from "../selly/scheduler-sync.js";

/** Wiersz `recentLogs` — projekcja jawna, dokładnie 9 kolumn z `routes_sync.cjs:27-33`. */
type WpisLoguSync = {
  id: number;
  operacja: string;
  dostawca_kod: string | null;
  liczba_ok: number;
  liczba_blad: number;
  liczba_skip: number;
  rozpoczeto: string;
  zakonczono: string | null;
  status: string;
  szczegoly_json: string | null;
};

export type ZaleznosciSellySync = {
  db: Baza;
  /** JEDNA instancja na proces — ta sama, którą dostaje scheduler. */
  syncDelta: FunkcjaSyncDelta;
  /** Wstrzykiwany na potrzeby testów; produkcyjnie singleton jak w oryginale. */
  limiter?: Limiter;
};

export function trasySellySync({
  db,
  syncDelta,
  limiter = globalnyLimiter,
}: ZaleznosciSellySync): Router {
  const router = Router();

  /**
   * `GET /api/selly/sync-status` (`routes_sync.cjs:23-39`).
   *
   * ⚠ `todayRotation` i `activeSuppliers` dotyczą TORU 2, a mimo to wychodzą tą trasą —
   * dlatego rotacja jest w `scheduler-sync.ts` już teraz, choć Tor 2 nic nie uruchamia.
   * Bez nich kształt odpowiedzi rozjechałby się z produkcją.
   */
  router.get("/api/selly/sync-status", requireAuth, (_req: Request, res: Response) => {
    try {
      const recentLogs = db.all<WpisLoguSync>(
        sql`SELECT id, operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip,
                   rozpoczeto, zakonczono, status, szczegoly_json
            FROM selly_sync_log
            ORDER BY rozpoczeto DESC
            LIMIT 20`,
      );
      res.json({
        ok: true,
        limiter: limiter.getStats(),
        todayRotation: dostawcyPelnegoNaDzis(new Date()),
        activeSuppliers: DOSTAWCY_AKTYWNI,
        recentLogs,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  /**
   * `POST /api/selly/sync-delta-supplier` (`routes_sync.cjs:41-53`).
   *
   * ⚠⚠ ODSTĘPSTWO ŚWIADOME — U ANI TA TRASA ZAWSZE ZWRACA 500 (ticket 45, decyzja D1).
   * Oryginał woła `syncDeltaForDostawca(db, dostawca)`, a `sync_delta.cjs` eksportuje
   * `{ syncDelta, findDeltaProducts }` — tamta nazwa żyje wyłącznie w
   * `sync_delta.cjs.bak-v1-2026-09-07`, czyli refaktor z 07.09 nie doszedł do tego pliku.
   * Efekt na produkcji: `{ ok: false, error: "syncDeltaForDostawca is not a function" }`.
   *
   * Naprawiamy, bo obie funkcje mają tę samą sygnaturę, a karta 13d-3 dokłada w panelu
   * przycisk „synchronizuj dostawcę", który bez tego z definicji oddawałby 500.
   * Komunikat walidacji zostaje verbatim z oryginału.
   */
  router.post(
    "/api/selly/sync-delta-supplier",
    requireAuth,
    async (req: Request, res: Response) => {
      const dostawca = (req.body as { dostawca?: string } | undefined)?.dostawca;
      if (!dostawca || !(DOSTAWCY_AKTYWNI as readonly string[]).includes(dostawca)) {
        res.status(400).json({
          ok: false,
          error: "Zly dostawca. Wymagany jeden z: " + DOSTAWCY_AKTYWNI.join(","),
        });
        return;
      }
      try {
        const wynik = await syncDelta(dostawca);
        res.json(wynik);
      } catch (e) {
        res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
  );

  /** `POST /api/selly/sync-delta-all` (`routes_sync.cjs:55-63`). */
  router.post("/api/selly/sync-delta-all", requireAuth, async (_req: Request, res: Response) => {
    try {
      const results = await uruchomDeltaDlaWszystkich(syncDelta);
      res.json({ ok: true, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
