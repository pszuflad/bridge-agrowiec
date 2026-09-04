// Analityka — trasy bloków 10a, 10c, 10d i 10e. Port `registerAnalyticsRoutes`
// (`mirror/backend/analytics_module.cjs:76-107`, `:110-143`, `:156-235`, `:279-303`, `:325-338`).
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
// Blok 10c dołożył sześć tras EAN (`:188-235`, `:335-338`), blok 10d — cztery trasy dostawców
// (`:110`, `:133`, `:143`, `:332`), blok 10e — sześć tras dostępności, rotacji i cyklu życia
// (`:156-184`, `:279-303`, `:334`). Razem z pięcioma trasami 10a daje to 21 z 27 tras modułu;
// pozostałe 6 dowożą bloki 10b i 10f (`docs/rebuild-roadmap.md` §5, Iteracja 10).
//
// ⚠ TRZY TRASY EAN CZYTAJĄ `req.query` — i to jest jedyne miejsce w tym pliku, gdzie parametr
// żądania w ogóle dociera do repozytorium (trasy dostawców z 10d żadnego nie mają). Trasy
// podają go SUROWO (`req.query.x`), bo oryginał parsuje go dopiero w handlerze (`num()`,
// `String(x || '')`) i jego luźna semantyka — tablica z powtórzonego parametru, wartość
// nieliczbowa, pusty napis — jest częścią odtwarzanego zachowania. Rozpakowanie tego
// wcześniej zmieniłoby wynik. Czwartym takim parametrem jest `?days` w `rotation/inactive`
// (blok 10e) — z tą różnicą, że tam zaciski oryginału są na tyle osobne, że mieszkają
// w nazwanej funkcji `zacisnijDniRotacji`, żeby dało się je pokryć testem bez serwera.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import {
  cyklZyciaDostawcow,
  cyklZyciaModeli,
  dostepnoscProduktow,
  kpi,
  listyFiltrow,
  marze,
  osCzasuImportow,
  pokrycieEan,
  porownanieEan,
  porownanieEanLegacy,
  rankingDostawcowEan,
  rotacjaNieaktywnych,
  sezonowoscMiesieczna,
  stabilnoscDostawcow,
  stanDostawcow,
  statusHistorii,
  statystykiDostawcow,
  szczegolyEan,
  tempoSchodzenia,
  unikalneEan,
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

  // ───────────────────────────────────────────────────────────────────────────────────────
  // BLOK 10e — dostępność / rotacja / cykl.
  //
  // Pięć z tych sześciu tras ma konsumenta w zakładkach `dostepnosc` i `marza`; szósta,
  // `importy-timeline`, świadomie go NIE MA (decyzja D2 — oryginalny bundle też jej nie woła).
  //
  // Kolejność WEWNĄTRZ bloku jest jak w oryginale; blok EAN z 10c stoi niżej, choć w module
  // rejestruje się między `availability/*` (`:156-184`) a `seasonality/monthly` (`:279`).
  // Nie ma to znaczenia dla zachowania — wszystkie ścieżki są literalne, więc Express dopasowuje
  // je niezależnie od kolejności rejestracji; scalanie bloków w jedną sekwencję kosztowałoby
  // przemeblowanie pliku bez zysku.
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
