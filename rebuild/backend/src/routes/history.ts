import { Router } from "express";
import type { Baza } from "../db/index.js";
import {
  LIMIT_AUDYTU,
  dostawcyHistorii,
  limitZQuery,
  stronaHistorii,
  stronaZQuery,
  wpisyHistorii,
} from "../historia/mapowanie.js";
import { requireAuth } from "../middleware/auth.js";
import { listaAudytu } from "../repos/audit.js";
import { listaDziennikaZmian } from "../repos/dziennik-zmian.js";

export type ZaleznosciHistorii = {
  db: Baza;
};

/**
 * Historia — odczyt (Iteracja 5). Trzy trasy czytające DWIE RÓŻNE tabele:
 *
 *   • `GET /api/history`       → tabela `history`   (`:48692`, `listHistory()`)
 *   • `GET /api/history/meta`  → tabela `audit_log` (`:48335`, `listAudit(5e3)`)
 *   • `GET /api/history/paged` → tabela `audit_log` (`:48352`, `listAudit(5e3)`)
 *
 * Ani jedna z nich nie czyta `historia_cen` — roadmapa podawała „`Wa` = `historia_cen`"
 * błędnie, sprostowane w bloku I5. Rozróżnienie: nagłówek `repos/dziennik-zmian.ts`.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D1): `contract/openapi.yaml:627-650` opisuje wszystkie trzy
 * ścieżki jako PUBLICZNE (`security: []`) — i taka jest produkcja, ale nie przez decyzję,
 * tylko przez kolejność rejestracji. Rdzeń rejestruje `/meta` i `/paged` bez `we`
 * (`requireAuth`) w `:48335` i `:48352`; `mirror/backend/pagination_module.cjs:136,168`
 * rejestruje te same ścieżki PONOWNIE, tym razem z `we`, a moduł jest ładowany dwukrotnie
 * (`extensions.cjs:449-451` oraz wprost z `index.cjs`) — rejestracji jest więc TRZY, nie dwie,
 * jak podaje `docs/spec-backend.md`. Express bierze pierwszy pasujący handler, więc wygrywa
 * ten bez auth. Stosujemy `requireAuth`, kontynuując decyzję z I1 (auth na wszystkich trasach
 * danych), tak samo jak przy `GET /api/products` (I2) i `GET /api/staging` (3b).
 *
 * Mutacje nie należą tu wcale: jedyny pisarz tabeli `history` to ręczna edycja produktu
 * w katalogu (`:48435`, `:48475`), a `audit_log` zapisują trasy importu i stagingu.
 */
export function trasyHistorii({ db }: ZaleznosciHistorii): Router {
  const router = Router();

  /**
   * Goła TABLICA całej tabeli `history`, bez paginacji i bez parametrów — 1:1 z `:48692`.
   *
   * Widok `/historia` tej trasy NIE woła (używa `/paged` + `/meta`). Wołają ją Pulpit (I10)
   * i optymistyczny cache edycji katalogu (`frontend-index.js:16852`, `:10287-10337`).
   * Do czasu sportowania mutacji katalogu tabela jest pusta i odpowiedź to `[]`.
   */
  router.get("/api/history", requireAuth, (_req, res) => {
    res.json(listaDziennikaZmian(db));
  });

  /**
   * Lista dostawców do filtra — port `:48335-48351`.
   *
   * Liczy się na tych samych zmapowanych wpisach co `/paged`, czyli PO odsianiu akcji spoza
   * słownika. Dostawca, który występuje wyłącznie przy akcji nierozpoznanej (np. przy
   * `synchronizacja_reczna`), do tej listy nie wejdzie — i tak jest w produkcji.
   */
  router.get("/api/history/meta", requireAuth, (_req, res) => {
    const wpisy = wpisyHistorii(listaAudytu(db, LIMIT_AUDYTU));
    res.json({ dostawcy: dostawcyHistorii(wpisy) });
  });

  /** Strona wpisów z filtrami — port `:48352-48391`. */
  router.get("/api/history/paged", requireAuth, (req, res) => {
    const wpisy = wpisyHistorii(listaAudytu(db, LIMIT_AUDYTU));

    res.json(
      stronaHistorii(wpisy, {
        page: stronaZQuery(req.query.page),
        limit: limitZQuery(req.query.limit),
        // `String(x ?? "")` — nie `x ? String(x) : ""`, bo oryginał tak właśnie robi
        // (`:48355-48357`) i `typ=0` czy `dostawca=false` trafiają do filtra dosłownie.
        search: String(req.query.search ?? ""),
        typ: String(req.query.typ ?? "all"),
        dostawca: String(req.query.dostawca ?? "all"),
      }),
    );
  });

  return router;
}
