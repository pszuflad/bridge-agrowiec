// Analityka — trasy bloków 10a (pięć) i 10e (sześć). Port `registerAnalyticsRoutes`
// (`mirror/backend/analytics_module.cjs:76-107`, `:156-184`, `:279-303`, `:325-334`).
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
// Pozostałe 16 tras modułu dowożą bloki 10b, 10c, 10d i 10f (`docs/rebuild-roadmap.md` §5).

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import {
  cyklZyciaModeli,
  dostepnoscProduktow,
  kpi,
  listyFiltrow,
  marze,
  osCzasuImportow,
  rotacjaNieaktywnych,
  sezonowoscMiesieczna,
  statusHistorii,
  tempoSchodzenia,
  zacisnijDniRotacji,
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

  // ───────────────────────────────────────────────────────────────────────────────────────
  // BLOK 10e — dostępność / rotacja / cykl. Kolejność rejestracji jak w oryginale.
  //
  // Pięć z tych sześciu tras ma konsumenta w zakładkach `dostepnosc` i `marza`; szósta,
  // `importy-timeline`, świadomie go NIE MA (decyzja D2 — oryginalny bundle też jej nie woła).
  // ───────────────────────────────────────────────────────────────────────────────────────

  /** „4.1 Historia dostępności pozycji" (`:156-171`). Dwie gałęzie, różne kolumny — patrz repo. */
  router.get("/api/analytics/availability/products", requireAuth, (_req: Request, res: Response) => {
    res.json(dostepnoscProduktow(db));
  });

  /** „4.2 Tempo schodzenia z magazynu" (`:173-184`). SQL odtworzony 1:1 z pułapką — patrz repo. */
  router.get(
    "/api/analytics/availability/sell-through",
    requireAuth,
    (_req: Request, res: Response) => {
      res.json(tempoSchodzenia(db));
    },
  );

  /** „4.4 Sezonowy wzorzec cen" (`:279-283`). Miesiąc bez roku, jedyna trasa bloku bez limitu. */
  router.get("/api/analytics/seasonality/monthly", requireAuth, (_req: Request, res: Response) => {
    res.json(sezonowoscMiesieczna(db));
  });

  /** „4.6 Cykl życia modelu" (`:285-289`). Gałęzie różnią się sortowaniem i licznikiem. */
  router.get("/api/analytics/lifecycle/models", requireAuth, (_req: Request, res: Response) => {
    res.json(cyklZyciaModeli(db));
  });

  /**
   * „Rotacja / produkty bez aktualizacji" (`:299-303`).
   *
   * ⚠ JEDYNA TRASA ANALITYKI DOWIEZIONA DO TEJ PORY, KTÓRA CZYTA `req.query`. Zaciskanie
   * `days` do [1, 730] — łącznie z tym, co wychodzi dla napisu nieliczbowego — siedzi
   * w `zacisnijDniRotacji`, żeby dało się je pokryć testem bez podnoszenia serwera.
   */
  router.get("/api/analytics/rotation/inactive", requireAuth, (req: Request, res: Response) => {
    res.json(rotacjaNieaktywnych(db, zacisnijDniRotacji(req.query.days)));
  });

  /** Oś czasu importów z `audit_log` (`:334`). GOŁA TABLICA, bez koperty. Bez UI (decyzja D2). */
  router.get("/api/analytics/importy-timeline", requireAuth, (_req: Request, res: Response) => {
    res.json(osCzasuImportow(db));
  });

  return router;
}
