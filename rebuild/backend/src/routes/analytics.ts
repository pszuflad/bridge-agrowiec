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
// Blok 10c dokłada sześć tras EAN (`:188-235`, `:335-338`). Pozostałe 16 tras modułu dowożą
// bloki 10b, 10d, 10e i 10f (`docs/rebuild-roadmap.md` §5, Iteracja 10).
//
// ⚠ TRZY TRASY EAN CZYTAJĄ `req.query` — i to jest jedyne miejsce w tym pliku, gdzie parametr
// żądania w ogóle dociera do repozytorium. Trasy podają go SUROWO (`req.query.x`), bo
// oryginał parsuje go dopiero w handlerze (`num()`, `String(x || '')`) i jego luźna semantyka
// — tablica z powtórzonego parametru, wartość nieliczbowa, pusty napis — jest częścią
// odtwarzanego zachowania. Rozpakowanie tego wcześniej zmieniłoby wynik.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import {
  kpi,
  listyFiltrow,
  marze,
  pokrycieEan,
  porownanieEan,
  porownanieEanLegacy,
  rankingDostawcowEan,
  statusHistorii,
  szczegolyEan,
  unikalneEan,
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

  /** Cztery liczby nagłówka KPI (`:325-331`). W oryginalnym froncie bez konsumenta — patrz repo. */
  router.get("/api/analytics/kpi", requireAuth, (_req: Request, res: Response) => {
    res.json(kpi(db));
  });

  /** Marże per dostawca/kategoria/marka + listy skrajne (`:292-297`). Bez parametrów query. */
  router.get("/api/analytics/margins", requireAuth, (_req: Request, res: Response) => {
    res.json(marze(db));
  });

  // ──────────────────────────────────────────────────────────────────────────────────────
  //  Blok 10c — EAN. Kolejność rejestracji 1:1 z oryginałem („Part 2", `:187-235`).
  // ──────────────────────────────────────────────────────────────────────────────────────

  /** Porównanie cen po EAN u ≥2 dostawców (`:188-200`). Parametr `minDiffPct` — próg spreadu. */
  router.get("/api/analytics/ean/comparison", requireAuth, (req: Request, res: Response) => {
    res.json(porownanieEan(db, req.query.minDiffPct));
  });

  /**
   * Oferty jednego EAN-u (`:202-208`). Parametr `ean`; bez niego `{ean: null, offers: []}`.
   * Bez konsumenta w oryginalnym froncie — trasa bez UI (decyzja D6), patrz repo.
   */
  router.get("/api/analytics/ean/details", requireAuth, (req: Request, res: Response) => {
    res.json(szczegolyEan(db, req.query.ean));
  });

  /** EAN-y dostępne u dokładnie jednego dostawcy (`:210-217`). Bez parametrów query. */
  router.get("/api/analytics/ean/unique", requireAuth, (_req: Request, res: Response) => {
    res.json(unikalneEan(db));
  });

  /** Rozkład „ilu dostawców ma dany EAN" (`:219-222`). Bez parametrów query i bez LIMIT-u. */
  router.get("/api/analytics/ean/coverage", requireAuth, (_req: Request, res: Response) => {
    res.json(pokrycieEan(db));
  });

  /** Ranking: jak często dostawca jest najtańszy (`:224-235`). Bez parametrów query. */
  router.get("/api/analytics/ean/supplier-rank", requireAuth, (_req: Request, res: Response) => {
    res.json(rankingDostawcowEan(db));
  });

  /**
   * Starsza, NIEZALEŻNA trasa porównania (`:335-338`) — goła tablica, inny WHERE, inny LIMIT.
   * Nie jest aliasem `ean/comparison`; różnice wypisane przy `porownanieEanLegacy`.
   * W oryginale rejestrowana dopiero w sekcji aliasów, za `top-zmiany` — zachowujemy to
   * miejsce w kolejności, na końcu routera.
   */
  router.get("/api/analytics/ean-porownanie", requireAuth, (req: Request, res: Response) => {
    res.json(porownanieEanLegacy(db, req.query.ean));
  });

  return router;
}
