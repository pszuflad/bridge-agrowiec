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
// Blok 10b dołożył pięć tras cen (`:237-268`, `:333`), blok 10c — sześć tras EAN
// (`:188-235`, `:335-338`), blok 10d — cztery trasy dostawców (`:110`, `:133`, `:143`, `:332`).
// Razem z pięcioma trasami 10a daje to 20 z 27 tras modułu; pozostałe siedem dowożą bloki
// 10e i 10f (`docs/rebuild-roadmap.md` §5, Iteracja 10).
//
// ⚠ PIĘĆ TRAS CZYTA `req.query` — trzy z bloku 10c (`ean/comparison`, `ean/details`,
// `ean-porownanie`) i dwie z 10b (`market/group-prices`, `prices/product-history`); trasy
// dostawców z 10d nie mają żadnego parametru. Trasy EAN podają go SUROWO (`req.query.x`),
// bo oryginał parsuje go dopiero w handlerze (`num()`,
// `String(x || '')`) i jego luźna semantyka — tablica z powtórzonego parametru, wartość
// nieliczbowa, pusty napis — jest częścią odtwarzanego zachowania. Rozpakowanie tego
// wcześniej zmieniłoby wynik.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import {
  cenyGrupRynku,
  cyklZyciaDostawcow,
  historiaCenProduktu,
  inflacjaCennika,
  kpi,
  listyFiltrow,
  marze,
  pokrycieEan,
  porownanieEan,
  porownanieEanLegacy,
  rankingDostawcowEan,
  stabilnoscDostawcow,
  stanDostawcow,
  statusHistorii,
  statystykiDostawcow,
  szczegolyEan,
  topZmiany,
  unikalneEan,
  zacisnijGrupeRynku,
  zbudujSnapshotBiezacy,
  zmianyCenOstatniegoImportu,
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

  // ─── BLOK 10b · CENY ──────────────────────────────────────────────────────────────
  //
  // Pięć tras zakładki „Ceny w czasie", w KOLEJNOŚCI REJESTRACJI Z ORYGINAŁU
  // (`:237`, `:245`, `:250`, `:263`, `:333`). Kolejność nie wpływa tu na dopasowanie —
  // ścieżki się nie nakładają — ale trzymamy ją, żeby porównanie z modułem oryginału
  // szło linijka w linijkę.
  //
  // ⚠ DWIE Z NICH NIE MAJĄ UI I TAK MA ZOSTAĆ (decyzje D1 i D2 użytkownika, 2026-09-03):
  // `top-zmiany` ma zero wywołań w bundlu produkcji, a `market/group-prices` jest wołana
  // i ignorowana (martwy fetch). Uzasadnienie w nagłówku sekcji 10b w `repos/analityka.ts`.

  /**
   * Rozrzut cen w obrębie marki/modelu/rozmiaru (`:237-242`). BEZ UI (decyzja D2).
   *
   * `?group` zaciskamy do whitelisty `marka|model|rozmiar` — to jedyne miejsce w tym
   * routerze, gdzie wartość z `req.query` w ogóle dociera do warstwy zapytań, i dociera
   * jako wartość TYPU `GrupaRynku`, nie jako napis. Odpowiedź niesie `group` PO
   * zaciśnięciu, dokładnie jak `res.json({ group, rows })` w oryginale.
   */
  router.get("/api/analytics/market/group-prices", requireAuth, (req: Request, res: Response) => {
    res.json(cenyGrupRynku(db, zacisnijGrupeRynku(req.query.group)));
  });

  /** Zmiany cen z ostatnich importów — karta „3.1" (`:245-248`). Bez parametrów query. */
  router.get("/api/analytics/prices/last-import", requireAuth, (_req: Request, res: Response) => {
    res.json(zmianyCenOstatniegoImportu(db));
  });

  /**
   * Historia ceny wybranej opony — karta „3.2 / 3.3" (`:250-261`).
   *
   * `String(req.query.x || "")` jest portem dosłownym i pełni tu robotę: pusty napis
   * znaczy „nie zawężaj", a wartość nieoczekiwanego typu (tablica przy `?ean=a&ean=b`)
   * zamienia się w napis, zamiast wysadzać zapytanie.
   */
  router.get(
    "/api/analytics/prices/product-history",
    requireAuth,
    (req: Request, res: Response) => {
      res.json(
        historiaCenProduktu(db, {
          ean: String(req.query.ean || ""),
          kod: String(req.query.kod || ""),
        }),
      );
    },
  );

  /** Inflacja cennika per dostawca i miesiąc — karta „3.6" (`:263-276`). */
  router.get("/api/analytics/prices/inflation", requireAuth, (_req: Request, res: Response) => {
    res.json(inflacjaCennika(db));
  });

  /**
   * Sto największych zmian ceny co do modułu (`:333`). BEZ UI (decyzja D1).
   *
   * ⚠ ODPOWIEDŹ TO GOŁA TABLICA, bez koperty — jeden z trzech takich przypadków w całym
   * module (obok `dostawcy-stats` i `importy-timeline`). Fixture to potwierdza i dlatego
   * jego adnotacja przycięcia siedzi na najwyższym poziomie jako `_body_przyciete_z`,
   * a nie jako `_przyciete.rows`.
   */
  router.get("/api/analytics/top-zmiany", requireAuth, (_req: Request, res: Response) => {
    res.json(topZmiany(db));
  });

  return router;
}
