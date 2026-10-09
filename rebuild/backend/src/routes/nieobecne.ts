// Zakładka „Nieobecne w imporcie” w Katalogu — ticket 207 (decyzja użytkowniczki 2026-10-10).
//
// ⚠ NOWE TRASY, SPOZA PRODUKCJI. Widoczne dla każdego zalogowanego użytkownika (aplikacja nie ma ról). Serwer sam przelicza listę
// kwalifikujących się pozycji, więc `ids` spoza niej są po cichu pomijane — nie da się tędy usunąć dowolnej karty.
import { Router } from "express";

import type { Baza } from "../db/index.js";
import { listaNieobecnych, przywrocNieobecne, usunNieobecne, PROG_DNI_DOMYSLNY, PROG_DNI_DOSTAWCY } from "../import/nieobecne.js";
import { requireAuth } from "../middleware/auth.js";
import { uchwytSqlite } from "../import/silnik/bridge-ext.js";

export type ZaleznosciNieobecne = { db: Baza };

const idy = (cialo: unknown): number[] => {
  const ids = (cialo as { ids?: unknown } | null)?.ids;
  return Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
};

export function trasyNieobecne({ db }: ZaleznosciNieobecne): Router {
  const router = Router();
  const sqlite = uchwytSqlite(db);

  router.get("/api/nieobecne", requireAuth, (_req, res) => {
    res.json({ progDniDomyslny: PROG_DNI_DOMYSLNY, progDniDostawcow: PROG_DNI_DOSTAWCY, items: listaNieobecnych(sqlite) });
  });

  router.post("/api/nieobecne/usun", requireAuth, (req, res) => {
    const kto = { id: req.user?.id ?? null, imie: req.user?.imieNazwisko ?? "?" };
    const usuniete = usunNieobecne(sqlite, idy(req.body), kto);
    res.json({ ok: true, usuniete: usuniete.length, kody: usuniete });
  });

  router.post("/api/nieobecne/przywroc", requireAuth, (req, res) => {
    const kto = { id: req.user?.id ?? null, imie: req.user?.imieNazwisko ?? "?" };
    const przywrocone = przywrocNieobecne(sqlite, idy(req.body), kto);
    res.json({ ok: true, przywrocone: przywrocone.length, kody: przywrocone });
  });

  return router;
}
