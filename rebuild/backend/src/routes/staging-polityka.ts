// Trasy polityki stagingu (Staging v2) — port `staging_policy.cjs:620-664`.
//
// CZTERY trasy, nie dwie. Karta I15.4c wymienia w nagłówku `review` i `resolve`, ale
// `registerRoutes` oryginału rejestruje dodatkowo `choose-absence-card`
// i `close-absence-review` — i to właśnie one wystawiają decyzje o nieobecnych kartach
// (backlog #106). Decyzja użytkownika: plan.md D129.1.
//
// ⚠ KSZTAŁT BŁĘDU: te trasy zwracają `{message}`, a nie `{error}` jak reszta stagingu
// (`routes/staging-mutacje.ts`). To NIE jest niespójność do naprawienia — w produkcji są to
// dwa osobne moduły i każdy odpowiada po swojemu. Ujednolicenie byłoby odstępstwem.

import { Router } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { norm, version } from "../import/polityka/helpery.js";
import { produktPoKodzie, pozycjaStagingu, type Snapshot } from "../import/polityka/kontekst.js";
import { rozstrzygnijZgloszenie } from "../import/polityka/zgloszenia.js";
import {
  wybierzKarteNieobecnej,
  zamknijPrzegladNieobecnej,
} from "../import/polityka/nieobecne.js";

export type ZaleznosciPolitykiStagingu = { db: Baza };

/**
 * `U.refreshAbsenceAvailability` — `staging_policy.cjs:137-139` i `:331`.
 *
 * W oryginale odświeżenie CSV i Selly rusza WYŁĄCZNIE, gdy baza to dosłownie
 * `/home/admin/private_apps/bridge/data.db` — komentarz mówi wprost, po co ten warunek:
 * „Test copies must never call shop APIs or publish the production CSV." U nas ten warunek
 * nie jest spełniony nigdy, więc wierny port to no-op z logiem.
 *
 * ⭐ TO JEST PUNKT WPIĘCIA DLA KARTY I15.10 (`availability_sync`) — zostawiony jawnie,
 * żeby tamta sesja miała gdzie wejść. Samego modułu nie portujemy (poza zakresem I15.4c).
 */
function odswiezDostepnosc(dostawca: string): void {
  console.log(
    `[dostepnosc] punkt wpięcia availability_sync dla dostawcy ${dostawca} — no-op poza produkcją (I15.10)`,
  );
}

/** Wspólny `catch` czterech tras — `res.status(e.status||500).json({message:e.message})`. */
function odpowiedzBledem(res: import("express").Response, e: unknown): void {
  const status = (e as { status?: number }).status ?? 500;
  const message = e instanceof Error ? e.message : String(e);
  res.status(status).json({ message });
}

export function trasyPolitykiStagingu({ db }: ZaleznosciPolitykiStagingu): Router {
  const router = Router();

  /**
   * Materiał do ręcznego przeglądu zgłoszenia — `staging_policy.cjs:621-639`.
   *
   * Jedyna trasa polityki, która przy braku wiersza oddaje **404**, a nie 409 — bo to nie
   * konflikt stanu, tylko pytanie o coś, czego już nie ma.
   *
   * ⚠ `incoming.stan` i `incoming.status` biorą się z PRODUKTU W KATALOGU, nie ze snapshotu
   * (`:630`). Reszta `incoming` jest ze snapshotu. Odtworzone dosłownie — panel pokazuje
   * obok siebie „co przyszło" i „co jest dziś w katalogu".
   */
  router.get("/api/staging/:id/review", requireAuth, (req, res) => {
    const row = pozycjaStagingu(db, Number(req.params.id));
    if (!row) {
      return res.status(404).json({ message: "Zgłoszenie zostało zastąpione. Odśwież staging." });
    }

    const snap = JSON.parse(row.snapshotJson || "{}") as Snapshot;
    const product = produktPoKodzie(db, row.kod);
    const kandydaci = (snap._candidates ?? []) as Array<Record<string, unknown>>;

    return res.json({
      id: row.id,
      kod: row.kod,
      nazwa: row.nazwa,
      powod: row.powod,
      matchIssue: snap._matchIssue || null,
      absenceReview: !!snap._absenceReview,
      absenceEvidence: snap._absenceEvidence || [],
      duplicateSource: !!snap._duplicateSource,
      sourceConflict: snap._sourceConflict || null,
      eanIssue: snap._eanIssue || null,
      incoming: {
        marka: snap.marka,
        model: snap.model,
        rozmiar: snap.rozmiar,
        dot: snap.dot,
        ean: snap.eanRaw ?? snap.ean,
        stan: product?.stan,
        status: product?.status,
      },
      candidates: kandydaci.map((c) => {
        const p = produktPoKodzie(db, String(c.kod));
        // `selectable` to ta sama trójstronna zgodność DOT, co w `chooseAbsenceCard` —
        // panel nie może zaproponować wyboru, którego akcja i tak by odrzuciła.
        const selectable =
          !!p &&
          p.dostawca === row.dostawca &&
          norm(c.dot) === norm(p.dot) &&
          norm(c.dot) === norm(snap.dot) &&
          norm(c.rozmiar) === norm(p.rozmiar) &&
          (!c.ean || !p.ean || norm(c.ean) === norm(p.ean));
        return {
          ...c,
          catalogStan: p?.stan ?? null,
          status: p?.status ?? null,
          catalogDot: p?.dot ?? null,
          catalogVersion: version(p),
          selectable,
          sameEan: norm(c.ean) === norm(snap.ean),
          sameDot: selectable,
        };
      }),
    });
  });

  /** Wskazanie karty przy sprawie nieobecnej opony — `staging_policy.cjs:640-648`. */
  router.post("/api/staging/:id/choose-absence-card", requireAuth, (req, res) => {
    try {
      const cialo = (req.body ?? {}) as { selectedCode?: unknown; candidateVersion?: unknown };
      const wynik = wybierzKarteNieobecnej(
        db,
        Number(req.params.id),
        cialo.selectedCode,
        cialo.candidateVersion,
      );
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "wybor_karty_z_biezacej_oferty",
        encjaTyp: "staging",
        encjaId: String(req.params.id),
        szczegoly: { wybranyKod: wynik.kod },
      });
      odswiezDostepnosc(wynik.dostawca);
      return res.json({ ok: true, kod: wynik.kod });
    } catch (e) {
      return odpowiedzBledem(res, e);
    }
  });

  /** Zamknięcie sprawy bez scalania — `staging_policy.cjs:649-656`. */
  router.post("/api/staging/:id/close-absence-review", requireAuth, (req, res) => {
    try {
      const wynik = zamknijPrzegladNieobecnej(db, Number(req.params.id));
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "zamkniecie_sprawdzenia_starej_karty",
        encjaTyp: "staging",
        encjaId: String(req.params.id),
        szczegoly: { kod: wynik.kod, decyzja: "pozostaw_wstrzymana_bez_scalania" },
      });
      return res.json({ ok: true, kod: wynik.kod });
    } catch (e) {
      return odpowiedzBledem(res, e);
    }
  });

  /** Rozstrzygnięcie niejednoznacznego dopasowania — `staging_policy.cjs:657-663`. */
  router.post("/api/staging/:id/resolve", requireAuth, (req, res) => {
    try {
      const cialo = (req.body ?? {}) as { action?: unknown; targetCode?: unknown };
      const row = rozstrzygnijZgloszenie(db, Number(req.params.id), cialo.action, cialo.targetCode);
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "rozstrzygniecie_stagingu",
        encjaTyp: "staging",
        encjaId: String(req.params.id),
        szczegoly: { action: cialo.action, kod: row.kod },
      });
      return res.json({ ok: true, id: row.id, kod: row.kod });
    } catch (e) {
      return odpowiedzBledem(res, e);
    }
  });

  return router;
}
