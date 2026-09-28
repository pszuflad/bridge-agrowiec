// Konfiguracja — `/api/config` (`Jt`). Dwie trasy, port `deminified/backend-index.cjs:48739-48748`.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import {
  czyKluczDozwolony,
  KLUCZE_KONFIGURACJI,
  odczytajCalaKonfiguracje,
  zapiszKonfiguracje,
} from "../repos/config.js";

export type ZaleznosciKonfiguracji = {
  db: Baza;
};

export function trasyKonfiguracji({ db }: ZaleznosciKonfiguracji): Router {
  const router = Router();

  /**
   * Cała konfiguracja jako PŁASKI obiekt `{klucz: wartosc}` (`:48739`) — bez koperty,
   * same stringi, `contract/fixtures/GET_config.json`.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (D1 z I1): w produkcji ta trasa jest PUBLICZNA (brak `we`,
   * `security: []` w `contract/openapi.yaml:545`), a `docs/spec-backend.md:41-49` wymienia
   * ją wśród najgroźniejszych publicznych GET-ów. Stosujemy `requireAuth`, kontynuując
   * decyzję z I1 — tak samo jak `GET /api/markups` (I4a) czy `GET /api/staging` (3b).
   * Kształt odpowiedzi bez zmian.
   *
   * ⚠ NIE maskujemy tu niczego, mimo że obiekt niesie `ai_fallback.klucz_api`
   * i `shoper.token_api`. Oryginał oddaje surowe wartości (`U.allConfig()`), maskuje tylko
   * przy ZAPISIE, w dzienniku audytu — a widok potrzebuje prawdziwej wartości, żeby pokazać
   * ją w polu edycji. Zmiana tego byłaby zmianą zachowania, nie poprawką bezpieczeństwa:
   * trasa i tak stoi już za `requireAuth`.
   */
  router.get("/api/config", requireAuth, (_req: Request, res: Response) => {
    res.json(odczytajCalaKonfiguracje(db));
  });

  /**
   * Zapis JEDNEGO klucza (`:48740-48748`). Ciało to `{klucz, wartosc}` — nie cały obiekt
   * konfiguracji. Zakładka „AI Fallback" wysyła przy zapisie trzy takie żądania,
   * zakładka „Shoper" dwa (`frontend-index.js:25995-26003`, `:26251-26256`).
   *
   * ⚠ `docs/incoming/frontend-perplexity/dokumentacja/02_WIDOKI.md:144` twierdzi, że ciałem
   * jest „obiekt konfiguracji" — to BŁĄD dokumentacji, sprawdzony w bundlu produkcji.
   * Roadmapa nazywa tę trasę `PUT /api/config`; metody PUT nie ma ani oryginał, ani
   * `contract/openapi.yaml:550`. Obie nieścisłości sprostowane przy tym tickecie.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D4): klucz spoza `KLUCZE_KONFIGURACJI` → 400.
   * Oryginał przyjmuje dowolny (`U.setConfig` bez walidacji), więc literówka w nazwie
   * zakłada w bazie nowy, martwy wiersz i cicho przestaje działać.
   */
  router.post("/api/config", requireAuth, (req: Request, res: Response) => {
    const { klucz, wartosc } = (req.body ?? {}) as { klucz?: unknown; wartosc?: unknown };

    if (!czyKluczDozwolony(klucz)) {
      res.status(400).json({
        error: `Nieznany klucz konfiguracji. Dozwolone: ${KLUCZE_KONFIGURACJI.join(", ")}`,
      });
      return;
    }
    // Kolumna `wartosc` jest NOT NULL, a cała konfiguracja to stringi (`:45633-45644`) —
    // liczba czy `null` w ciele to błąd wołającego, nie wartość do cichego rzutowania.
    if (typeof wartosc !== "string") {
      res.status(400).json({ error: "Pole `wartosc` musi być tekstem" });
      return;
    }

    zapiszKonfiguracje(db, klucz, wartosc);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "edycja_konfiguracji",
      encjaTyp: "config",
      encjaId: klucz,
      // Maskowanie 1:1 z oryginałem (`:48746`): warunek patrzy na NAZWĘ klucza, nie na
      // listę sekretów, więc `shoper.token_api` do dziennika trafia JAWNIE. Odtwarzamy to
      // dosłownie — zawężenie albo poszerzenie maski byłoby zmianą zachowania. Realne
      // ryzyko jest niewielkie: dziennik i tak stoi za `requireAuth`.
      szczegoly: { wartosc: klucz.includes("klucz_api") ? "***" : wartosc },
    });

    res.json({ ok: true });
  });

  return router;
}
