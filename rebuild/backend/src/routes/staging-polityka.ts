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
import {
  odczytajPoprawki,
  POLA_POPRAWEK,
  rozstrzygnijIZatwierdz,
} from "../import/polityka/rozstrzygniecie-z-zapisem.js";
import { rozstrzygnijBlednyEan } from "../import/polityka/ean-bledny.js";
import { odrzucZmianeKarty } from "../import/polityka/odrzucenie-zmiany.js";
import { wyjasnijZgloszenie } from "../import/polityka/wyjasnienie.js";
import { rozstrzygnijSprzecznoscZrodla } from "../import/polityka/sprzecznosc-zrodla.js";
import { skanujNoweWartosci } from "../repos/atrybuty-pending.js";
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
    const produktyKandydatow = kandydaci.map((c) => produktPoKodzie(db, String(c.kod)));

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
      // NOWE (2026-10-01): EAN karty w katalogu — do decyzji „zostaw EAN z katalogu".
      eanKarty: product?.ean ?? null,
      // NOWE (2026-09-30): zdania dla człowieka, co jest nie tak, i dane do ręcznej poprawki.
      wyjasnienie: wyjasnijZgloszenie({
        snap,
        nazwaImportu: row.nazwa,
        powod: row.powod,
        kandydaci: kandydaci as Array<{ kod: string; nazwa?: unknown }>,
        produktyKandydatow,
      }),
      propozycja: Object.fromEntries(
        POLA_POPRAWEK.map((pole) => [
          pole,
          String((pole === "nazwa" ? row.nazwa : snap[pole]) ?? ""),
        ]),
      ),
      incoming: {
        marka: snap.marka,
        model: snap.model,
        rozmiar: snap.rozmiar,
        dot: snap.dot,
        ean: snap.eanRaw ?? snap.ean,
        stan: product?.stan,
        status: product?.status,
      },
      candidates: kandydaci.map((c, i) => {
        const p = produktyKandydatow[i];
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
          produktId: p?.id ?? null,
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

  /**
   * Rozstrzygnięcie niejednoznacznego dopasowania — `staging_policy.cjs:657-663`.
   *
   * ⚠ ODSTĘPSTWO OD PRODUKCJI (decyzja użytkowniczki, 2026-09-30): decyzja od razu ZATWIERDZA
   * wynik do katalogu (bez drugiej akceptacji w stagingu) i przyjmuje `corrections` — własne,
   * poprawione wartości pól. Szczegóły: `import/polityka/rozstrzygniecie-z-zapisem.ts`.
   */
  router.post("/api/staging/:id/resolve", requireAuth, (req, res) => {
    try {
      const cialo = (req.body ?? {}) as {
        action?: unknown;
        targetCode?: unknown;
        corrections?: unknown;
      };
      const poprawki = odczytajPoprawki(cialo.corrections);
      const wynik = rozstrzygnijIZatwierdz(
        db,
        Number(req.params.id),
        cialo.action,
        cialo.targetCode,
        poprawki,
        req.user!.id,
      );
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "rozstrzygniecie_stagingu",
        encjaTyp: "staging",
        encjaId: String(req.params.id),
        szczegoly: { action: cialo.action, kod: wynik.kod, poprawki },
      });
      try {
        skanujNoweWartosci(db);
      } catch (e) {
        console.error("[pending] skan po rozstrzygnięciu dopasowania:", e instanceof Error ? e.message : e);
      }
      return res.json({ ok: true, kod: wynik.kod });
    } catch (e) {
      return odpowiedzBledem(res, e);
    }
  });

  /**
   * „Odrzuć” w szczegółach: karta zostaje bez zmian, a różnice z pliku zapisują się jako poprawki Marty
   * z wartościami karty (kolejny import ich nie zgłasza ani nie nadpisuje). Zgłoszenie znika.
   *
   * ⚠ TRASA SPOZA ORYGINAŁU — decyzja użytkowniczki (2026-10-05). Szczegóły: `import/polityka/odrzucenie-zmiany.ts`.
   */
  router.post("/api/staging/:id/keep-card", requireAuth, (req, res) => {
    try {
      const wynik = odrzucZmianeKarty(db, Number(req.params.id), req.user!.id);
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "odrzucenie_zmiany_stagingu",
        encjaTyp: "staging",
        encjaId: String(req.params.id),
        szczegoly: {
          kod: wynik.kod,
          zachowanePola: wynik.zachowanePola,
          pominietePola: wynik.pominietePola,
        },
      });
      return res.json({ ok: true, ...wynik });
    } catch (e) {
      return odpowiedzBledem(res, e);
    }
  });

  /**
   * Błędny EAN od dostawcy: „zostaw EAN z katalogu" (`keep`) albo „wpisz poprawny" (`set`, `ean`).
   *
   * ⚠ TRASA SPOZA ORYGINAŁU — decyzja użytkowniczki (2026-10-01). Decyzja od razu ZATWIERDZA pozycję
   * i zapamiętuje się jako poprawka `ean`, żeby ten sam błędny numer nie wracał przy kolejnych
   * importach. Szczegóły: `import/polityka/ean-bledny.ts`.
   */
  router.post("/api/staging/:id/resolve-ean", requireAuth, (req, res) => {
    try {
      const cialo = (req.body ?? {}) as { decision?: unknown; ean?: unknown };
      const wynik = rozstrzygnijBlednyEan(
        db,
        Number(req.params.id),
        cialo.decision,
        cialo.ean,
        req.user!.id,
      );
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "rozstrzygniecie_blednego_ean",
        encjaTyp: "staging",
        encjaId: String(req.params.id),
        szczegoly: { decyzja: cialo.decision, kod: wynik.kod, ean: wynik.ean },
      });
      return res.json({ ok: true, kod: wynik.kod, ean: wynik.ean });
    } catch (e) {
      return odpowiedzBledem(res, e);
    }
  });

  /**
   * Sprzeczne wiersze jednego cennika: „połącz w jeden produkt" / „rozdziel na osobne".
   *
   * ⚠ TRASA SPOZA ORYGINAŁU — świadoma decyzja użytkownika (2026-09-29); w produkcji ten przypadek
   * ma tylko podgląd, a `POST /resolve` odmawia. W odróżnieniu od `/resolve` decyzja od razu
   * ZATWIERDZA wynik do katalogu (jedna transakcja), więc odpowiada też skan nowych wartości
   * atrybutów, jak po `POST /api/staging/accept`. Szczegóły: `import/polityka/sprzecznosc-zrodla.ts`.
   */
  router.post("/api/staging/:id/resolve-source-conflict", requireAuth, (req, res) => {
    try {
      const cialo = (req.body ?? {}) as { decision?: unknown };
      const wynik = rozstrzygnijSprzecznoscZrodla(
        db,
        Number(req.params.id),
        cialo.decision,
        req.user!.id,
      );
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "rozstrzygniecie_sprzecznosci_zrodla",
        encjaTyp: "staging",
        encjaId: String(req.params.id),
        szczegoly: { decyzja: cialo.decision, kody: wynik.kody },
      });
      try {
        skanujNoweWartosci(db);
      } catch (e) {
        console.error("[pending] skan po rozstrzygnięciu sprzeczności:", e instanceof Error ? e.message : e);
      }
      return res.json({ ok: true, kody: wynik.kody });
    } catch (e) {
      return odpowiedzBledem(res, e);
    }
  });

  return router;
}
