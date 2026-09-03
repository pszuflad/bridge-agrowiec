// Limity spedycyjne — `/api/spedycja` (`gn` = `spedycja_limity`).
// Dwie trasy, port `deminified/backend-index.cjs:48735-48738`.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { listaSpedycji, odsiejPolaSpedycji, zapiszLimitSpedycji } from "../repos/spedycja.js";

export type ZaleznosciSpedycji = {
  db: Baza;
};

export function trasySpedycji({ db }: ZaleznosciSpedycji): Router {
  const router = Router();

  /**
   * Lista limitów (`:48735`). Odpowiedź to GOŁA TABLICA, nie koperta —
   * `contract/fixtures/GET_spedycja.json` (5 wierszy z 10, `_body_przyciete_z`).
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (D1 z I1): w produkcji trasa jest PUBLICZNA (brak `we`,
   * `security: []` w `contract/openapi.yaml:1023`). Stosujemy `requireAuth`, jak przy
   * wszystkich trasach danych od I1. Kształt bez zmian.
   */
  router.get("/api/spedycja", requireAuth, (_req: Request, res: Response) => {
    res.json(listaSpedycji(db));
  });

  /**
   * Zapis limitów jednego dostawcy (`:48736-48738`) — UPSERT po `dostawcaKod`, nie po `id`.
   *
   * ⚠ TA TRASA JEST W PRODUKCJI MARTWA OD STRONY UI. Zakładka „Spedycja" trzyma limity
   * wyłącznie w przeglądarce: `setQueryDefaults(["/api/spedycja"], {queryFn: async () =>
   * [...an]})` (`frontend-index.js:10381`) plus zapis do IndexedDB (`:10365-10371`) —
   * żadne żądanie sieciowe stąd nie wychodzi. Backend jednak trasę ma i działa ona
   * poprawnie, więc odbudowa PODPINA pod nią widok (plan.md D2, decyzja użytkownika):
   * limity mają być trwałe i wspólne, a nie ginąć razem z profilem przeglądarki Ani.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D5): ciało idzie przez `odsiejPolaSpedycji`.
   */
  router.post("/api/spedycja", requireAuth, (req: Request, res: Response) => {
    const pola = odsiejPolaSpedycji(req.body);
    const dostawcaKod = pola.dostawcaKod;

    // Oryginał bez tego sprawdzenia szuka `WHERE dostawca_kod = undefined`, nic nie znajduje
    // i wywraca się dopiero na NOT NULL przy INSERT-cie — czyli oddaje 500 tam, gdzie
    // odpowiedzią jest „ciało jest bez sensu". Zamieniamy to na 400, bo jedyna różnica dla
    // wołającego to czytelny komunikat zamiast błędu serwera.
    if (typeof dostawcaKod !== "string" || dostawcaKod.trim() === "") {
      res.status(400).json({ error: "Pole `dostawcaKod` jest wymagane" });
      return;
    }

    zapiszLimitSpedycji(db, { ...pola, dostawcaKod });

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "edycja_spedycji",
      encjaTyp: "spedycja",
      encjaId: dostawcaKod,
      // SUROWE ciało — port 1:1 (`be(…, c.body)`, `:48737`) i ten sam wybór, co przy
      // narzutach w I4a: zapis idzie przez filtr, audyt opisuje ZAMIAR, więc próba wysłania
      // pola spoza listy zostaje w dzienniku jako sygnał, zamiast zniknąć bez śladu.
      szczegoly: req.body,
    });

    res.json({ ok: true });
  });

  return router;
}
