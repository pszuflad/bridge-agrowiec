/**
 * Sześć tras ręcznej synchronizacji Bridge → Selly — port
 * `origin/main:mirror/backend/selly/routes_sync.cjs` (karta I15.8, ticket 121).
 *
 *   GET  /api/selly/sync-status         — stan rate limitera + ostatnie 20 wpisów logu
 *   POST /api/selly/sync-delta-supplier — `{dostawca}` — Tor 1 dla jednego dostawcy
 *   POST /api/selly/sync-delta-all      — Tor 1 dla wszystkich
 *   POST /api/selly/sync-full-supplier  — `{dostawca, autoCreate?}` — Tor 2 dla jednego
 *   POST /api/selly/sync-full-today     — Tor 2 dla dzisiejszej rotacji
 *   POST /api/selly/sync-full-force     — `{dostawcy[], autoCreate?}` — Tor 2 wymuszony
 *
 * Rejestracja za auth 1:1 z oryginałem: `registerSyncRoutes(app, {db, requireAuth: we})`
 * (`extensions.cjs:484-485`).
 *
 * ⚠ CZTERY Z TYCH TRAS REALNIE ZAPISUJĄ DO SKLEPU `agroopony.selly24.pl` — `sync-delta-*`
 * i `sync-full-*` wołają Tor 1/Tor 2, a te wysyłają PUT-y wariantów i (przy `autoCreate`)
 * zakładają produkty. W testach wyłącznie atrapa (`test/gate/selly-atrapa.ts`).
 *
 * ── ODSTĘPSTWA ŚWIADOME (karta I15.8, decyzje użytkownika 2026-09-23) ───────────────────
 * Produkcyjny `routes_sync.cjs` destrukturyzuje DWA eksporty, których nie ma. W CJS daje to
 * `undefined`, a nie błąd ładowania, więc moduł wstaje, a `TypeError` leci dopiero
 * w handlerze i wpada w jego `try/catch` — trzy trasy oddają na produkcji HTTP 500
 * („… is not a function"), nie dotykając przy tym Selly:
 *
 * 1. `syncDeltaForDostawca` (`:15`) — `sync_delta.cjs` eksportuje `syncDelta`.
 *    → używamy `syncDelta` (`wejscie-117.md`). Poza nazwą zachowanie identyczne: oryginał
 *      wołał `syncDeltaForDostawca(db, dostawca)` bez opcji, więc i my idziemy z domyślnymi.
 * 2. `runFullTodays` (`:14`) — `scheduler_selly.cjs` eksportuje `runFullBatch`.
 *    → używamy `runFullBatch`; naprawia `sync-full-today` i `sync-full-force`.
 * 3. `sync-full-force` (`:97`) przekazuje `{forceSuppliers: dostawcy}`, a `runFullBatch`
 *    czyta `opts.suppliers` — nazwa klucza się nie zgadza, więc nawet po naprawie (2)
 *    „force MO1,MO2" puściłoby DZISIEJSZĄ ROTACJĘ, czyli zapis do sklepu dla innych
 *    dostawców niż wskazane. → mapujemy `dostawcy` na `suppliers`.
 *
 * Skutek dla kontraktu: `sync-delta-supplier`, `sync-full-today` i `sync-full-force`
 * odpowiadają u nas sukcesem tam, gdzie produkcja oddaje 500. Nagranie 1:1 tych trzech tras
 * z oryginału jest więc niemożliwe — opisane w `docs/tickets/121-.../raport.md`.
 */

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { ostatnieWpisySync } from "../repos/selly.js";
import type { Discovery } from "../selly/rest/discovery.js";
import { globalnyLimiter } from "../selly/rest/limiter.js";
import {
  ACTIVE_SUPPLIERS,
  runDeltaAll,
  runFullBatch,
  suppliersForFullToday,
} from "../selly/rest/scheduler.js";
import { syncDelta } from "../selly/rest/sync-delta.js";
import { syncFullForDostawca } from "../selly/rest/sync-full.js";

export type ZaleznosciSellySync = {
  db: Baza;
  /**
   * JEDNA instancja discovery na proces, wspólna z harmonogramem — stan (nauczone
   * `feature_id`, cache kodów produktów) żyje w jej domknięciu, więc druga instancja
   * miałaby własny, zimny cache (`docs/karty/I15.8/wejscie-108.md`).
   */
  discovery: Discovery;
};

/** Komunikat błędu w kształcie, w jakim oddaje go oryginał (`e.message`, bez opakowania). */
function komunikat(blad: unknown): string {
  return blad instanceof Error ? blad.message : String(blad);
}

/** Czy `dostawca` jest jednym z obsługiwanych kodów (`routes_sync.cjs:43,68,93`). */
function znanyDostawca(kod: unknown): kod is string {
  return typeof kod === "string" && (ACTIVE_SUPPLIERS as readonly string[]).includes(kod);
}

export function trasySellySync({ db, discovery }: ZaleznosciSellySync): Router {
  const router = Router();

  /**
   * Stan synchronizacji (`routes_sync.cjs:23-38`): licznik limitera, rotacja Toru 2 na dziś,
   * lista obsługiwanych dostawców i ostatnie 20 wpisów `selly_sync_log`.
   *
   * ⚠ `recentLogs` ma klucze `snake_case` — oryginał wypisuje jawną listę kolumn i czyta je
   * przez better-sqlite3. Projekcja jest w `repos/selly.ts` (`ostatnieWpisySync`); `select()`
   * bez niej oddałby nazwy PÓL modelu Drizzle (`dostawcaKod`…) i rozjechał kontrakt.
   */
  router.get("/api/selly/sync-status", requireAuth, (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        limiter: globalnyLimiter.getStats(),
        todayRotation: suppliersForFullToday(new Date()),
        activeSuppliers: ACTIVE_SUPPLIERS,
        recentLogs: ostatnieWpisySync(db),
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: komunikat(e) });
    }
  });

  /** Tor 1 dla jednego dostawcy (`:41-52`). Patrz odstępstwo 1 w nagłówku. */
  router.post(
    "/api/selly/sync-delta-supplier",
    requireAuth,
    async (req: Request, res: Response) => {
      const dostawca: unknown = req.body?.dostawca;
      if (!znanyDostawca(dostawca)) {
        res.status(400).json({
          ok: false,
          error: "Zly dostawca. Wymagany jeden z: " + ACTIVE_SUPPLIERS.join(","),
        });
        return;
      }
      try {
        res.json(await syncDelta(db, discovery, dostawca));
      } catch (e) {
        res.status(500).json({ ok: false, error: komunikat(e) });
      }
    },
  );

  /** Tor 1 dla wszystkich (`:55-62`). */
  router.post("/api/selly/sync-delta-all", requireAuth, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, results: await runDeltaAll(db, discovery) });
    } catch (e) {
      res.status(500).json({ ok: false, error: komunikat(e) });
    }
  });

  /**
   * Tor 2 dla jednego dostawcy (`:65-77`). `autoCreate` domyślnie WŁĄCZONE (`!== false`),
   * inaczej niż w `sync-full-force` niżej — tak jest w oryginale.
   */
  router.post(
    "/api/selly/sync-full-supplier",
    requireAuth,
    async (req: Request, res: Response) => {
      const dostawca: unknown = req.body?.dostawca;
      const autoCreate = req.body?.autoCreate !== false;
      if (!znanyDostawca(dostawca)) {
        res.status(400).json({ ok: false, error: "Zly dostawca" });
        return;
      }
      try {
        res.json(await syncFullForDostawca(db, discovery, dostawca, { autoCreate }));
      } catch (e) {
        res.status(500).json({ ok: false, error: komunikat(e) });
      }
    },
  );

  /** Tor 2 dla dzisiejszej rotacji (`:80-87`). Patrz odstępstwo 2 w nagłówku. */
  router.post("/api/selly/sync-full-today", requireAuth, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, results: await runFullBatch(db, discovery) });
    } catch (e) {
      res.status(500).json({ ok: false, error: komunikat(e) });
    }
  });

  /**
   * Tor 2 wymuszony dla konkretnych dostawców (`:90-102`). Patrz odstępstwa 2 i 3.
   *
   * ⚠ `autoCreate` domyślnie WYŁĄCZONE (`=== true`) — ostrożnie, bo ta trasa jest ręczna.
   * To NIE jest pomyłka wobec `sync-full-supplier` wyżej, tylko zastane rozróżnienie.
   */
  router.post("/api/selly/sync-full-force", requireAuth, async (req: Request, res: Response) => {
    const dostawcy: unknown = req.body?.dostawcy;
    const autoCreate = req.body?.autoCreate === true;
    if (!Array.isArray(dostawcy) || dostawcy.length === 0 || !dostawcy.every(znanyDostawca)) {
      res.status(400).json({
        ok: false,
        error: "Podaj tablice dostawcow z: " + ACTIVE_SUPPLIERS.join(","),
      });
      return;
    }
    try {
      const results = await runFullBatch(db, discovery, { suppliers: dostawcy, autoCreate });
      res.json({ ok: true, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: komunikat(e) });
    }
  });

  return router;
}
