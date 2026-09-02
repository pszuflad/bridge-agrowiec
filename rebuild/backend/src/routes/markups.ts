// Narzuty — `/api/markups` (`Bt`). Cztery trasy, port `deminified/backend-index.cjs:48692-48713`.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import {
  aktualizujNarzut,
  dodajNarzut,
  listaNarzutow,
  odsiejPolaNarzutu,
  usunNarzut,
} from "../repos/markups.js";

export type ZaleznosciNarzutow = {
  db: Baza;
};

export function trasyNarzutow({ db }: ZaleznosciNarzutow): Router {
  const router = Router();

  /**
   * Lista reguł narzutu (`:48692`). Odpowiedź to GOŁA TABLICA, nie koperta —
   * `contract/fixtures/GET_markups.json`.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (D1 z I1): w produkcji ta trasa jest PUBLICZNA (brak `we`,
   * `security: []` w `contract/openapi.yaml:713`). Stosujemy `requireAuth`, kontynuując
   * decyzję zaklepaną w I1 dla wszystkich tras danych — tak samo jak `GET /api/products`
   * (I2), `GET /api/staging` (3b) i `GET /api/overrides` (3d-2). Kształt bez zmian.
   */
  router.get("/api/markups", requireAuth, (_req: Request, res: Response) => {
    res.json(listaNarzutow(db));
  });

  /**
   * Dodanie reguły (`:48693`). Zapis przelicza ceny CAŁEGO katalogu (`repos/markups.ts`).
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D3): ciało idzie przez `POLA_EDYTOWALNE_NARZUTU`.
   * Oryginał wstawia `{...c.body}` bez filtra, więc pole spoza schematu wywracało INSERT.
   * Filtr na POST jest tą samą decyzją co filtr na PATCH — dwie trasy tego samego zasobu
   * nie powinny mieć różnej powierzchni ataku.
   */
  router.post("/api/markups", requireAuth, (req: Request, res: Response) => {
    const narzut = dodajNarzut(db, {
      ...odsiejPolaNarzutu(req.body),
      zmienilUzytkownikId: req.user?.id ?? null,
      zmienionoData: new Date().toISOString(),
    });

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "dodanie_narzutu",
      encjaTyp: "narzut",
      encjaId: narzut.id,
      // SUROWE ciało — port 1:1 (`be(…, c.body)`, `:48698`). Patrz komentarz przy PATCH.
      szczegoly: req.body,
    });

    res.json(narzut);
  });

  /**
   * Zmiana reguły (`:48699`). 404, gdy reguły nie ma — oryginał ma tu jawne sprawdzenie
   * (`if (!p) return u.status(404)`), w odróżnieniu od trasy promocji (plan.md D5).
   *
   * ⚠ AUDYT LOGUJE SUROWE `c.body`, ZAPIS IDZIE PRZEZ FILTR — i te dwie rzeczy mogą się
   * rozejść (plan.md D2, decyzja użytkownika). Oryginał tego problemu nie ma, bo nie
   * filtruje zapisu; my filtrujemy, więc audyt zaczyna opisywać ZAMIAR, a nie stan bazy.
   * Zostawiamy go świadomie: to ten sam sens co przy `synchronizacja_reczna` z I3 (wpis
   * powstaje nawet dla nieistniejącego dostawcy), a przy okazji próba wysłania pola spoza
   * listy zostaje w dzienniku jako sygnał, zamiast zniknąć bez śladu.
   *
   * ⚠ NIE odtwarzamy niespójności audytu znanej od dostawców (zapis dziesięć pól, audyt
   * cztery). Przy narzutach oryginał loguje `c.body` w CAŁOŚCI (`:48709`) — sprawdzone we
   * wszystkich sześciu wywołaniach `be(…)` w tym bloku tras, żeby nie skopiować rozwiązania
   * z niewłaściwego miejsca.
   */
  router.patch("/api/markups/:id", requireAuth, (req: Request, res: Response) => {
    // `parseInt` jak w oryginale (`:48700`): „abc" → NaN → brak wiersza → 404.
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    const narzut = Number.isNaN(id)
      ? undefined
      : aktualizujNarzut(db, id, {
          ...odsiejPolaNarzutu(req.body),
          zmienilUzytkownikId: req.user?.id ?? null,
          zmienionoData: new Date().toISOString(),
        });

    if (!narzut) {
      res.status(404).json({ error: "Nie znaleziono" });
      return;
    }

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "edycja_narzutu",
      encjaTyp: "narzut",
      encjaId: id,
      szczegoly: req.body,
    });

    res.json(narzut);
  });

  /**
   * Kasowanie reguły (`:48711`).
   *
   * ⚠ Brak 404 jest w oryginale: `deleteMarkup` kasuje w próżnię, audyt powstaje mimo to,
   * a odpowiedź zawsze brzmi `{ok:true}`. Odtworzone dosłownie — jak przy
   * `synchronizacja_reczna`, audyt zapisuje ZAMIAR, nie wynik.
   */
  router.delete("/api/markups/:id", requireAuth, (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    usunNarzut(db, id);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "usuniecie_narzutu",
      encjaTyp: "narzut",
      encjaId: id,
      // Bez czwartego argumentu w oryginale (`:48712`) ⇒ `szczegoly_json` zostaje NULL.
    });

    res.json({ ok: true });
  });

  return router;
}
