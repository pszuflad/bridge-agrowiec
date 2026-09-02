// Promocje — `/api/promotions` (`hn`). Cztery trasy, port `deminified/backend-index.cjs:48714-48737`.
//
// Bliźniak `routes/markups.ts`. Jedyna różnica w zachowaniu jest w PATCH-u i jest w oryginale
// (plan.md D5) — uzasadnienie przy samej trasie.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import {
  aktualizujPromocje,
  dodajPromocje,
  listaPromocji,
  odsiejPolaPromocji,
  usunPromocje,
} from "../repos/promotions.js";

export type ZaleznosciPromocji = {
  db: Baza;
};

export function trasyPromocji({ db }: ZaleznosciPromocji): Router {
  const router = Router();

  /**
   * Lista promocji (`:48714`). Goła tablica — `contract/fixtures/GET_promotions.json`.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (D1 z I1): produkcja ma tę trasę publiczną, u nas idzie
   * za `requireAuth` — jak wszystkie trasy danych w odbudowie.
   */
  router.get("/api/promotions", requireAuth, (_req: Request, res: Response) => {
    res.json(listaPromocji(db));
  });

  /** Dodanie promocji (`:48715`). Zapis przelicza ceny całego katalogu. Filtr pól — D3. */
  router.post("/api/promotions", requireAuth, (req: Request, res: Response) => {
    const promocja = dodajPromocje(db, {
      ...odsiejPolaPromocji(req.body),
      zmienilUzytkownikId: req.user?.id ?? null,
      zmienionoData: new Date().toISOString(),
    });

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "dodanie_promocji",
      encjaTyp: "promocja",
      encjaId: promocja.id,
      szczegoly: req.body,
    });

    res.json(promocja);
  });

  /**
   * Zmiana promocji (`:48722`).
   *
   * ⚠ BRAK 404 JEST W ORYGINALE — i to jest asymetria wobec bliźniaczej trasy narzutów,
   * która sprawdzenie ma (`:48709`). Dla nieistniejącego `id` `updatePromotion` zwraca
   * `undefined`, a trasa oddaje 200 z PUSTYM ciałem. Odtwarzamy 1:1 (plan.md D5), więc
   * sesja 4b nie może zakładać, że w odpowiedzi zawsze jest obiekt. Opisane
   * w `docs/rebuild-backlog.md`.
   *
   * ⚠ Audyt loguje SUROWE `c.body`, zapis idzie przez filtr pól — pełne uzasadnienie tej
   * rozbieżności przy `PATCH /api/markups/:id` (plan.md D2).
   *
   * ⚠ Audyt powstaje TAKŻE dla nieistniejącej promocji — oryginał woła `be(…)` bezwarunkowo,
   * bo nie ma czego przerwać. Znów: audyt zapisuje ZAMIAR.
   */
  router.patch("/api/promotions/:id", requireAuth, (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    const promocja = aktualizujPromocje(db, id, {
      ...odsiejPolaPromocji(req.body),
      zmienilUzytkownikId: req.user?.id ?? null,
      zmienionoData: new Date().toISOString(),
    });

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "edycja_promocji",
      encjaTyp: "promocja",
      encjaId: id,
      szczegoly: req.body,
    });

    res.json(promocja);
  });

  /** Kasowanie promocji (`:48734`). Bez 404, jak przy narzutach. */
  router.delete("/api/promotions/:id", requireAuth, (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    usunPromocje(db, id);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "usuniecie_promocji",
      encjaTyp: "promocja",
      encjaId: id,
    });

    res.json({ ok: true });
  });

  return router;
}
