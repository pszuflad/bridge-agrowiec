// Analityka — pięć tras bloku 10a. Port `registerAnalyticsRoutes`
// (`mirror/backend/analytics_module.cjs:76-107`, `:292-297`, `:325-331`).
//
// ⚠ AUTH NIE JEST TU ODSTĘPSTWEM. Inaczej niż przy `markups`/`promotions`/`history`, gdzie
// `contract/openapi.yaml` opisuje trasy jako publiczne (`security: []`), a odbudowa świadomie
// dokłada `requireAuth` (decyzja D1 z I1) — wszystkie ścieżki `/api/analytics/*` mają
// w kontrakcie `security: [{bearerAuth: []}, {cookieAuth: []}]`, a oryginał podaje
// `requireAuth` w każdej rejestracji (`:81`, `:93`, `:98`, `:292`, `:325`). Zgodność jest
// pełna i nie ma tu czego odnotowywać jako różnicę.
//
// ⚠ SIŁA SIATKI BEZPIECZEŃSTWA, NAZWANA WPROST. `contract/openapi.yaml` nie ma dla analityki
// ŻADNYCH schematów odpowiedzi — tylko `responses: {200, 400, 401}` i `security`. Kontraktowa
// część GATE dowodzi więc jedynie, że ścieżka istnieje, status jest zadeklarowany i ciało jest
// JSON-em. Cały ciężar kształtu spoczywa na fixtures — twardo dla czterech GET-ów, wcale dla
// `POST /api/analytics/bootstrap-current` (metod zapisujących nie nagrywano,
// `contract/README.md:38`), który zamiast tego ma test jednostkowy w `analityka.agregaty.test.ts`.
//
// Blok 10d dołożył cztery trasy dostawców (`:110`, `:133`, `:143`, `:332`) — pozostałe 18 tras
// modułu dowożą bloki 10b, 10c, 10e i 10f (`docs/rebuild-roadmap.md` §5, Iteracja 10).

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import {
  cyklZyciaDostawcow,
  kpi,
  listyFiltrow,
  marze,
  stabilnoscDostawcow,
  stanDostawcow,
  statusHistorii,
  statystykiDostawcow,
  zbudujSnapshotBiezacy,
} from "../repos/analityka.js";

export type ZaleznosciAnalityki = {
  db: Baza;
};

export function trasyAnalityki({ db }: ZaleznosciAnalityki): Router {
  const router = Router();

  /**
   * Migawka aktywnego katalogu do `historia_cen` (`:81-91`).
   *
   * Rejestrowana PRZED trasami GET, tak jak w oryginale. Nieidempotentna — powód i skutki
   * opisane przy `zbudujSnapshotBiezacy`. Nie ma dla niej fixture'a: GATE sprawdza tu tylko
   * kontrakt (200/JSON) i bramkę 401.
   */
  router.post("/api/analytics/bootstrap-current", requireAuth, (_req: Request, res: Response) => {
    res.json(zbudujSnapshotBiezacy(db));
  });

  /** Zasięg historii cen — nagłówek widoku `/analityka` (`:93-96`). */
  router.get("/api/analytics/status", requireAuth, (_req: Request, res: Response) => {
    res.json(statusHistorii(db));
  });

  /**
   * Sześć list wartości do kontrolek filtra (`:98-107`).
   *
   * Odpowiedź to sześć gołych tablic i NIC więcej — `_przyciete` z fixture'a jest adnotacją
   * nagrywarki, nie polem API (`contract/README.md:29`); szczegóły w nagłówku `repos/analityka.ts`.
   */
  router.get("/api/analytics/filters", requireAuth, (_req: Request, res: Response) => {
    res.json(listyFiltrow(db));
  });

  // ─── Blok 10d · dostawcy ──────────────────────────────────────────────────────────────
  //
  // Trzy trasy z sekcji „Part 1: supplier analysis" oryginału, w jego kolejności rejestracji.
  // ŻADNA nie czyta `req.query` — filtrowanie zakładki `dostawcy` jest klienckie, tak jak
  // w sekcji marż z 10a. Czwarta trasa bloku (`dostawcy-stats`) siedzi niżej, w sekcji aliasów,
  // bo tam ją zarejestrował oryginał.

  /** Stabilność cennika dostawcy (`:110-131`). Dwie gałęzie kształtu wiersza — patrz repo. */
  router.get("/api/analytics/suppliers/stability", requireAuth, (_req: Request, res: Response) => {
    res.json(stabilnoscDostawcow(db));
  });

  /** Nowości i wycofania — dziennik stagingu, nie katalog (`:133-141`). */
  router.get("/api/analytics/suppliers/lifecycle", requireAuth, (_req: Request, res: Response) => {
    res.json(cyklZyciaDostawcow(db));
  });

  /** Stan i dostępność dostawcy (`:143-154`). Bez limitu — wiersz na dostawcę. */
  router.get("/api/analytics/suppliers/stock", requireAuth, (_req: Request, res: Response) => {
    res.json(stanDostawcow(db));
  });

  /** Cztery liczby nagłówka KPI (`:325-331`). W oryginalnym froncie bez konsumenta — patrz repo. */
  router.get("/api/analytics/kpi", requireAuth, (_req: Request, res: Response) => {
    res.json(kpi(db));
  });

  /**
   * Statystyki dostawców (`:332`) — GOŁA TABLICA, bez koperty.
   *
   * Alias zgodności bez konsumenta w oryginalnym froncie (0 trafień w bundlu). Dowieziona pod
   * GATE, świadomie bez hooka i bez karty w UI (decyzja D3 bloku 10d) — szczegóły w repo.
   */
  router.get("/api/analytics/dostawcy-stats", requireAuth, (_req: Request, res: Response) => {
    res.json(statystykiDostawcow(db));
  });

  /** Marże per dostawca/kategoria/marka + listy skrajne (`:292-297`). Bez parametrów query. */
  router.get("/api/analytics/margins", requireAuth, (_req: Request, res: Response) => {
    res.json(marze(db));
  });

  return router;
}
