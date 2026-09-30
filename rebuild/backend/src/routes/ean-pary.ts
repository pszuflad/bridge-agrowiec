// Tabela par kod ↔ EAN i uzupełnianie pustych EAN-ów — ticket 168-FEATURE-uzupelnianie-ean-999.
//
// ⚠ NOWE TRASY, SPOZA PRODUKCJI I SPOZA `contract/openapi.yaml` (nowa logika biznesowa, decyzja
// użytkownika 2026-09-30). Wszystkie za `requireAuth`. Kształt błędu jak w pozostałych trasach
// danych: `{error}`.

import { Router, type Request, type Response } from "express";
import { desc, eq, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { eanPary, products } from "../db/schema.js";
import { pustyEan } from "../ean-pary/generator.js";
import {
  przydzielEan,
  uzupelnijKatalog,
  znajdzParePoEanie,
  znajdzParePoKodzie,
  type ParaEan,
} from "../ean-pary/uzupelnianie.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";

export type ZaleznosciEanPary = { db: Baza };

function opisPary(p: ParaEan) {
  return {
    kod: p.kod,
    ean: p.ean,
    status: p.status,
    dostawca: p.dostawca,
    kodDostawcy: p.kodDostawcy,
    utworzono: p.utworzono,
    zastapiono: p.zastapiono,
    zastapionyPrzez: p.zastapionyPrzez,
  };
}

function audytuj(db: Baza, wpis: Parameters<typeof zapiszAudyt>[1]): void {
  try {
    zapiszAudyt(db, wpis);
  } catch (e) {
    console.error("[ean-pary] audyt pominięty:", e instanceof Error ? e.message : e);
  }
}

export function trasyEanPary({ db }: ZaleznosciEanPary): Router {
  const router = Router();

  /** Czy dla tego `kod` jest EAN — z pary (wygenerowany) albo z samego katalogu (`katalog`). */
  router.get("/api/ean-pary/po-kodzie/:kod", requireAuth, (req: Request, res: Response) => {
    const kod = String(req.params.kod ?? "").trim();
    const para = znajdzParePoKodzie(db, kod);
    const produkt = db.select({ ean: products.ean }).from(products).where(eq(products.kod, kod)).get();
    const eanKatalogu = produkt && !pustyEan(produkt.ean) ? String(produkt.ean).trim() : null;
    res.json({
      kod,
      maEan: eanKatalogu !== null || para?.status === "aktywny",
      ean: eanKatalogu ?? (para ? para.ean : null),
      zrodlo: para && (eanKatalogu === null || eanKatalogu === para.ean) ? "wygenerowany" : eanKatalogu ? "katalog" : null,
      para: para ? opisPary(para) : null,
    });
  });

  /** Jaki kod ma ten EAN — najpierw tabela par, potem katalog. */
  router.get("/api/ean-pary/po-ean/:ean", requireAuth, (req: Request, res: Response) => {
    const ean = String(req.params.ean ?? "").trim();
    const para = znajdzParePoEanie(db, ean);
    const produkt = db.select({ kod: products.kod }).from(products).where(eq(products.ean, ean)).all();
    res.json({
      ean,
      kod: para?.kod ?? produkt[0]?.kod ?? null,
      kody: [...new Set([...(para ? [para.kod] : []), ...produkt.map((p) => p.kod)])],
      para: para ? opisPary(para) : null,
    });
  });

  /** „Mam kod dostawcy, zrób mi EAN." Idempotentne; nie rusza produktu, który ma już EAN. */
  router.post("/api/ean-pary/generuj", requireAuth, (req: Request, res: Response) => {
    const kod = typeof req.body?.kod === "string" ? req.body.kod.trim() : "";
    if (kod === "") {
      res.status(400).json({ error: "Pole `kod` jest wymagane." });
      return;
    }
    const produkt = db.select().from(products).where(eq(products.kod, kod)).get();
    if (!produkt) {
      res.status(404).json({ error: `Nie ma produktu o kodzie „${kod}”.` });
      return;
    }
    if (!pustyEan(produkt.ean)) {
      res.json({ kod, ean: String(produkt.ean).trim(), utworzono: false, zrodlo: "katalog" });
      return;
    }
    const { ean, utworzono } = przydzielEan(db, {
      kod,
      dostawca: produkt.dostawca,
      kodDostawcy: produkt.kodDostawcy,
    });
    db.update(products)
      .set({ ean, eanRaw: ean, eanIsValid: 1, eanSourceStatus: "ok", eanCandidates: null })
      .where(eq(products.id, produkt.id))
      .run();
    const user = req.user!;
    audytuj(db, {
      uzytkownikId: user.id,
      uzytkownikImie: user.imieNazwisko,
      akcja: "ean_wygenerowany",
      encjaTyp: "produkt",
      encjaId: produkt.id,
      szczegoly: { kod, ean, utworzono },
    });
    res.json({ kod, ean, utworzono, zrodlo: "wygenerowany" });
  });

  /** Uzupełnia puste EAN-y w całym katalogu; `dry_run: true` tylko liczy. */
  router.post("/api/ean-pary/uzupelnij", requireAuth, (req: Request, res: Response) => {
    const surowy = req.body?.dry_run;
    if (surowy !== undefined && typeof surowy !== "boolean") {
      res.status(400).json({ error: "Pole `dry_run` musi być wartością logiczną (true/false)." });
      return;
    }
    const dryRun = surowy === true;
    const wynik = uzupelnijKatalog(db, { dryRun });
    if (!dryRun) {
      const user = req.user!;
      audytuj(db, {
        uzytkownikId: user.id,
        uzytkownikImie: user.imieNazwisko,
        akcja: "ean_uzupelnienie_katalogu",
        encjaTyp: "produkt",
        encjaId: "wszystkie",
        szczegoly: wynik,
      });
    }
    res.json({ ok: true, dry_run: wynik.dryRun, uzupelniono: wynik.uzupelniono, zastapiono: wynik.zastapiono });
  });

  /** Lista par (tabela porównawcza) — `limit` (domyślnie 100, max 1000) i `offset`. */
  router.get("/api/ean-pary", requireAuth, (req: Request, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const lacznie = db.select({ c: sql<number>`count(*)` }).from(eanPary).get()?.c ?? 0;
    const wiersze = db
      .select()
      .from(eanPary)
      .orderBy(desc(eanPary.numer))
      .limit(limit)
      .offset(offset)
      .all();
    res.json({ lacznie, limit, offset, pary: wiersze.map(opisPary) });
  });

  return router;
}
