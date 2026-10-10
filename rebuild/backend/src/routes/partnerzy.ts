// Partnerzy B2B — ustawienia (karta PARTNERZY, ticket 209 / PRT-1.3).
//
// ⚠ NOWE TRASY, SPOZA PRODUKCJI I SPOZA `contract/openapi.yaml` (nowa funkcjonalność; ten sam tryb co `/api/ean-pary`
// z ticketu 168). Wszystkie za `requireAuth`. Błąd: `{error}`. Partnera się nie usuwa — tylko dezaktywuje.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import {
  czyBlad,
  dodajPartnera,
  edytujPartnera,
  listaPartnerow,
  normalizujKraj,
  szczegolyPartnera,
  ustawAktywnosc,
  ustawKraj,
  ustawMagazyny,
  ustawWykluczenia,
  usunKraj,
  walidujListeTekstow,
  walidujUstawieniaKraju,
  walidujUstawieniaPartnera,
} from "../repos/partnerzy.js";

export type ZaleznosciPartnerzy = { db: Baza };

export function trasyPartnerzy({ db }: ZaleznosciPartnerzy): Router {
  const router = Router();

  const audytuj = (req: Request, akcja: string, id: number, szczegoly?: unknown): void => {
    try {
      const user = req.user!;
      zapiszAudyt(db, { uzytkownikId: user.id, uzytkownikImie: user.imieNazwisko, akcja, encjaTyp: "partner", encjaId: id, szczegoly });
    } catch (e) {
      console.error("[partnerzy] audyt pominięty:", e instanceof Error ? e.message : e);
    }
  };
  const idZParametru = (req: Request, res: Response): number | null => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1 || szczegolyPartnera(db, id) === null) {
      res.status(404).json({ error: "Nie ma takiego partnera." });
      return null;
    }
    return id;
  };

  router.get("/api/partnerzy", requireAuth, (_req, res) => {
    res.json({ partnerzy: listaPartnerow(db) });
  });

  router.get("/api/partnerzy/:id", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id !== null) res.json(szczegolyPartnera(db, id));
  });

  router.post("/api/partnerzy", requireAuth, (req, res) => {
    const u = walidujUstawieniaPartnera(req.body, false);
    if (czyBlad(u)) return void res.status(400).json({ error: u.blad });
    const id = dodajPartnera(db, u as Parameters<typeof dodajPartnera>[1]);
    if (id === null) return void res.status(409).json({ error: "Partner o tej nazwie już istnieje." });
    audytuj(req, "partner_dodany", id, u);
    res.status(201).json(szczegolyPartnera(db, id));
  });

  router.put("/api/partnerzy/:id", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const u = walidujUstawieniaPartnera(req.body, true);
    if (czyBlad(u)) return void res.status(400).json({ error: u.blad });
    if (edytujPartnera(db, id, u) === "nazwa-zajeta")
      return void res.status(409).json({ error: "Partner o tej nazwie już istnieje." });
    audytuj(req, "partner_zmieniony", id, u);
    res.json(szczegolyPartnera(db, id));
  });

  /** Aktywacja i dezaktywacja bez usuwania: `{aktywny: boolean}`. */
  router.put("/api/partnerzy/:id/aktywny", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const aktywny = (req.body as { aktywny?: unknown } | undefined)?.aktywny;
    if (typeof aktywny !== "boolean") return void res.status(400).json({ error: "Pole `aktywny` musi być wartością logiczną." });
    ustawAktywnosc(db, id, aktywny);
    audytuj(req, aktywny ? "partner_aktywowany" : "partner_dezaktywowany", id);
    res.json(szczegolyPartnera(db, id));
  });

  router.put("/api/partnerzy/:id/magazyny", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const l = walidujListeTekstow((req.body as { magazyny?: unknown } | undefined)?.magazyny, "magazyny");
    if (czyBlad(l)) return void res.status(400).json({ error: l.blad });
    ustawMagazyny(db, id, l);
    audytuj(req, "partner_magazyny", id, { magazyny: l });
    res.json(szczegolyPartnera(db, id));
  });

  router.put("/api/partnerzy/:id/wykluczenia", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const l = walidujListeTekstow((req.body as { kody?: unknown } | undefined)?.kody, "kody");
    if (czyBlad(l)) return void res.status(400).json({ error: l.blad });
    ustawWykluczenia(db, id, l);
    audytuj(req, "partner_wykluczenia", id, { liczba: l.length });
    res.json(szczegolyPartnera(db, id));
  });

  /** Dodaje albo nadpisuje kraj (np. `PUT /api/partnerzy/1/kraje/FR`). */
  router.put("/api/partnerzy/:id/kraje/:kraj", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const kraj = normalizujKraj(req.params.kraj);
    if (kraj === null) return void res.status(400).json({ error: "Kraj musi być dwuliterowym kodem (np. FR)." });
    const u = walidujUstawieniaKraju(req.body);
    if (czyBlad(u)) return void res.status(400).json({ error: u.blad });
    ustawKraj(db, id, kraj, u);
    audytuj(req, "partner_kraj", id, { kraj, ...u });
    res.json(szczegolyPartnera(db, id));
  });

  router.delete("/api/partnerzy/:id/kraje/:kraj", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const kraj = normalizujKraj(req.params.kraj);
    if (kraj === null || !usunKraj(db, id, kraj)) return void res.status(404).json({ error: "Partner nie ma takiego kraju." });
    audytuj(req, "partner_kraj_usuniety", id, { kraj });
    res.json(szczegolyPartnera(db, id));
  });

  return router;
}
