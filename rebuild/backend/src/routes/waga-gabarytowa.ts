// Waga gabarytowa — `POST /api/waga-gabarytowa/oblicz`.
// Port `deminified/backend-index.cjs:48749-48769`. Jedna trasa, bez zapisu do bazy.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { odczytajUstawieniaWagiGabarytowej } from "../repos/config.js";
import { obliczWageGabarytowa } from "../waga-gabarytowa/formula.js";

export type ZaleznosciWagiGabarytowej = {
  db: Baza;
};

export function trasyWagiGabarytowej({ db }: ZaleznosciWagiGabarytowej): Router {
  const router = Router();

  /**
   * Kalkulator wagi gabarytowej paletowej (`:48749`). Czyta cztery klucze `waga_gab.*`
   * z konfiguracji i liczy — nic nie zapisuje, więc bez `zapiszAudyt` (oryginał też nie
   * audytuje tej trasy).
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (D1 z I1, potwierdzone w plan.md D2): w produkcji ta trasa jest
   * PUBLICZNA — rejestrowana bez middleware `we`, a `contract/openapi.yaml:1157` zamraża to
   * jako `security: []` z komentarzem „stan faktyczny". Stosujemy `requireAuth`, kontynuując
   * decyzję zaklepaną w I1 dla wszystkich tras danych — tak samo jak `GET /api/markups`
   * (4a), `GET /api/products` (I2), `GET /api/staging` (3b) i `GET /api/overrides` (3d-2).
   * Kształt odpowiedzi bez zmian. Konsekwencja dla testów: kontrakt nie deklaruje dla tej
   * ścieżki kodu 401, więc gate asertuje go wprost, poza `sprawdzZgodnoscZKontraktem`
   * (ten sam zabieg co w `test/narzuty.gate.test.ts`) — kontraktu NIE ruszamy.
   *
   * ⚠ BRAK WALIDACJI I BRAK 400 — to jest w oryginale. Każde wejście, łącznie z pustym
   * ciałem i tekstem zamiast liczby, kończy się kodem 200 (szczegóły w `formula.ts`).
   * Kontrakt deklaruje 400, ale produkcja tej gałęzi nie ma i my też jej nie dorabiamy.
   */
  router.post("/api/waga-gabarytowa/oblicz", requireAuth, (req: Request, res: Response) => {
    const ustawienia = odczytajUstawieniaWagiGabarytowej(db);
    // `req.body ?? {}` — oryginał sięga po `c.body` wprost, bo jego `express.json()` zawsze
    // coś zostawia. Nasz `app.ts` też, ale strażnik jest tani i chroni przed 500 przy żądaniu
    // bez ciała. Zachowanie bez zmian: puste ciało i tak liczy się jako same zera.
    res.json(obliczWageGabarytowa(req.body ?? {}, ustawienia));
  });

  return router;
}
