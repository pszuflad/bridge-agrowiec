// Waga gabarytowa — `POST /api/waga-gabarytowa/oblicz` (port `deminified/backend-index.cjs:48749-48769`,
// bez zapisu do bazy) oraz `GET`/`PUT /api/waga-gabarytowa/przewoznicy` — trasy NOWE, spoza
// produkcji (backlog #27, ticket 76, karta P9.1).

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { odczytajUstawieniaWagiGabarytowej } from "../repos/config.js";
import { odczytajPrzewoznikow, zapiszPrzewoznikow } from "../repos/przewoznicy.js";
import { obliczWageGabarytowa } from "../waga-gabarytowa/formula.js";
import { zwalidujListePrzewoznikow } from "../waga-gabarytowa/przewoznicy.js";

export type ZaleznosciWagiGabarytowej = {
  db: Baza;
};

/**
 * Audyt nie może wywrócić udanego zapisu listy — ten sam wzorzec co `audytuj()` w
 * `routes/atrybuty.ts`. Lista jest już zapisana, więc błąd `audit_log` tylko logujemy.
 */
function audytuj(db: Baza, wpis: Parameters<typeof zapiszAudyt>[1]): void {
  try {
    zapiszAudyt(db, wpis);
  } catch (e) {
    console.error("[waga-gabarytowa] audyt pominięty:", e instanceof Error ? e.message : e);
  }
}

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

  /**
   * Wspólna lista przewoźników wagi WOLUMETRYCZNEJ (kalkulator liczony we froncie).
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (backlog #27, zatwierdzone przez Anię 2026-09-18/21): produkcja nie ma
   * tych tras — lista żyje w IndexedDB przeglądarki (`deminified/frontend-index.js:9165-9193`).
   * Tu jest wspólna dla firmy; edytuje każdy zalogowany. Kształt API odtwarza to, jak front
   * zapisywał stan: całą listę naraz. Wygrywa ostatni zapis, bez blokad współbieżności.
   */
  router.get("/api/waga-gabarytowa/przewoznicy", requireAuth, (_req: Request, res: Response) => {
    res.json(odczytajPrzewoznikow(db));
  });

  /**
   * Podmiana całej listy. Walidacja (`zwalidujListePrzewoznikow`) jest nowa, bo w produkcji nie
   * ma serwera, który by ją robił; błąd → `400 {error}`, jak w `routes/config.ts`.
   * Zmiana dzielnika zmienia wyceny wszystkim, więc ląduje w `audit_log` z listą przed i po.
   * Widok „Historia zmian" tej akcji nie pokazuje (whitelista w `repos/audit-historia.ts`) —
   * świadomie, Ania o to nie prosiła.
   */
  router.put("/api/waga-gabarytowa/przewoznicy", requireAuth, (req: Request, res: Response) => {
    const wynik = zwalidujListePrzewoznikow(req.body);
    if (!wynik.ok) {
      res.status(400).json({ error: wynik.blad });
      return;
    }

    const przed = odczytajPrzewoznikow(db);
    zapiszPrzewoznikow(db, wynik.lista);
    const po = odczytajPrzewoznikow(db);

    audytuj(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "edycja_przewoznikow",
      encjaTyp: "waga_gab_przewoznicy",
      szczegoly: { przed, po },
    });

    res.json(po);
  });

  return router;
}
