// Trasy administracyjne — port `mirror/backend/extensions.cjs:296-405` (moduł Extensions)
// oraz `GET /api/audit-log` z rdzenia (`deminified/backend-index.cjs:48735`).

import { Router } from "express";

import type { Baza } from "../db/index.js";
import { listaDostawcow as kodyDostawcow, urlDostawcy } from "../import/parsuj.js";
import { requireAuth } from "../middleware/auth.js";
import { listaAudytu, zapiszAudyt } from "../repos/audit.js";
import {
  aktualizujDostawce,
  dostawcaPoKodzie,
  type PoleEdytowalne,
} from "../repos/suppliers.js";

export type ZaleznosciAdmina = {
  db: Baza;
  /**
   * Odpowiednik `delete lastRunPerSupplier[kod]` z oryginału (`extensions.cjs:387-389`):
   * po zmianie częstotliwości nowa wartość ma obowiązywać od razu, a nie od kolejnego
   * cyklu. Oryginał kasuje znacznik ostatniego przebiegu; scheduler odbudowy trzyma
   * zamiast tego mapę interwałów, więc odpowiednikiem jest przeplanowanie (3f-3).
   * Ten sam callback dostaje `PATCH /api/dostawcy/{id}` (`routes/suppliers.ts:317`).
   * Pominięty (testy, `stworzApp` bez schedulera) ⇒ brak operacji.
   */
  przeplanujScheduler?: () => void;
};

/** Statusy przyjmowane przez `PATCH` — `['aktywny','wstrzymany','blad']` (`extensions.cjs:374`). */
const DOZWOLONE_STATUSY = ["aktywny", "wstrzymany", "blad"] as const;

/** Granice częstotliwości pollingu — `n < 5 || n > 10080` (`extensions.cjs:366`). */
const MIN_CZESTOTLIWOSC = 5;
const MAX_CZESTOTLIWOSC = 10080;

/** Ile najświeższych wpisów audytu oddaje `/api/audit-log` — `U.listAudit(500)` (`:48735`). */
const LIMIT_AUDIT_LOG = 500;

/**
 * Wiersz dostawcy tak, jak widzi go administracja: pusty `url` w bazie znaczy „użyj adresu
 * z dispatchera". Port `resolveUrl` + `getSupplierUrlFromDb` (`extensions.cjs:83-92`).
 */
function urlZBazy(url: string | null | undefined): string | null {
  return url && url.trim().length > 0 ? url : null;
}

export function trasyAdmina({ db, przeplanujScheduler }: ZaleznosciAdmina): Router {
  const router = Router();

  /**
   * Konfiguracja wszystkich dostawców do formularza edycji (`extensions.cjs:321-338`).
   *
   * ⚠ PĘTLA IDZIE PO DISPATCHERZE, NIE PO TABELI `suppliers`. Lista ma zawsze dziesięć
   * pozycji — tyle, ile kodów zna dispatcher — także wtedy, gdy w bazie nie ma jeszcze
   * ani jednego wiersza. Odwrotnie też: dostawca w bazie z kodem spoza dispatchera się
   * tu NIE pojawi. `contract/fixtures/GET_admin_supplier-config.json` to potwierdza
   * (marker sanityzacji `_przyciete: {dostawcy: 10}`).
   *
   * ⚠ `url` vs `fallbackUrl`: `url` to adres EFEKTYWNY (z bazy, jeśli niepusty, inaczej
   * z dispatchera), `fallbackUrl` to ZAWSZE adres z dispatchera. Gdy baza nie ma własnego
   * adresu, oba pola są równe, a `urlEfektywnyZDb` mówi, który przypadek zachodzi —
   * bez tej flagi formularz nie odróżniłby „ustawiono ręcznie ten sam adres" od „nie
   * ustawiono nic".
   */
  router.get("/api/admin/supplier-config", requireAuth, (_req, res) => {
    const dostawcy = kodyDostawcow().map((kod) => {
      const wiersz = dostawcaPoKodzie(db, kod);
      const zBazy = urlZBazy(wiersz?.url);
      const fallbackUrl = urlDostawcy(kod);
      return {
        kod,
        nazwa: wiersz?.nazwa || kod,
        url: zBazy ?? fallbackUrl,
        urlEfektywnyZDb: zBazy !== null,
        czestotliwoscMinuty: wiersz?.czestotliwoscMinuty ?? null,
        status: wiersz?.status || "aktywny",
        fallbackUrl,
      };
    });

    res.json({ ok: true, dostawcy });
  });

  /**
   * Lista dostawców dla strony „import teraz" (`extensions.cjs:298-317`) — ta sama pętla
   * po dispatcherze, ale zamiast pary url/fallback niesie statystyki ostatniego importu.
   *
   * ⚠ `liczbaProduktow: … || 0`, nie `?? 0` — oryginał zamienia na zero także `null`
   * i pusty string z bazy. Kolumna jest u nas `NOT NULL DEFAULT 0`, więc różnica dotyczy
   * wyłącznie dostawcy, którego w tabeli w ogóle nie ma; wtedy oba zapisy dają 0.
   */
  router.get("/api/admin/suppliers-list", requireAuth, (_req, res) => {
    const dostawcy = kodyDostawcow().map((kod) => {
      const wiersz = dostawcaPoKodzie(db, kod);
      return {
        kod,
        nazwa: wiersz?.nazwa || kod,
        url: urlZBazy(wiersz?.url) ?? urlDostawcy(kod),
        czestotliwoscMinuty: wiersz?.czestotliwoscMinuty ?? null,
        status: wiersz?.status || "aktywny",
        ostatniPlik: wiersz?.ostatniPlik || null,
        liczbaProduktow: wiersz?.liczbaProduktow || 0,
      };
    });

    res.json({ ok: true, dostawcy });
  });

  /**
   * Zmiana konfiguracji jednego dostawcy (`extensions.cjs:344-395`).
   *
   * ⚠ METODA TO `PATCH`, NIE `PUT`. Potwierdzone dwoma źródłami: `contract/openapi.yaml:31`
   * i `app.patch(...)` w oryginale. `docs/rebuild-roadmap.md` mówiła „PUT" — sprostowane
   * przy tym tickecie.
   *
   * ⚠ POLE NIEOBECNE ≠ POLE `null`. Cała walidacja stoi na `hasOwnProperty`: brak klucza
   * znaczy „nie ruszaj", a jawny `null` (albo pusty string) znaczy „wyczyść". Zwykłe
   * `if (req.body.url)` skasowałoby tę różnicę i zamieniło czyszczenie adresu w brak zmiany.
   *
   * Kolejność sprawdzeń jak w oryginale: nieznany kod → 400 PRZED sprawdzeniem bazy,
   * brak wiersza → 404, potem pola, na końcu pusty patch → 400.
   */
  router.patch("/api/admin/supplier-config/:kod", requireAuth, (req, res) => {
    const kod = String(req.params.kod || "").toUpperCase();

    if (!kodyDostawcow().includes(kod)) {
      res.status(400).json({ error: `Nieznany dostawca: ${kod}` });
      return;
    }

    const dostawca = dostawcaPoKodzie(db, kod);
    if (!dostawca) {
      res.status(404).json({ error: `Dostawca ${kod} nie istnieje w bazie` });
      return;
    }

    const cialo = (req.body ?? {}) as Record<string, unknown>;
    const ma = (pole: string) => Object.prototype.hasOwnProperty.call(cialo, pole);
    const patch: Partial<Pick<typeof dostawca, PoleEdytowalne>> = {};

    if (ma("url")) {
      const wartosc = cialo.url;
      if (wartosc === null || wartosc === "") {
        patch.url = null;
      } else if (typeof wartosc === "string" && /^https?:\/\//i.test(wartosc.trim())) {
        patch.url = wartosc.trim();
      } else {
        res.status(400).json({ error: "url musi być http(s):// albo null/pusty" });
        return;
      }
    }

    if (ma("czestotliwoscMinuty")) {
      const wartosc = cialo.czestotliwoscMinuty;
      if (wartosc === null || wartosc === "" || wartosc === undefined) {
        patch.czestotliwoscMinuty = null;
      } else {
        const liczba = Number(wartosc);
        if (!Number.isFinite(liczba) || liczba < MIN_CZESTOTLIWOSC || liczba > MAX_CZESTOTLIWOSC) {
          res.status(400).json({ error: "czestotliwoscMinuty: 5..10080 albo null" });
          return;
        }
        patch.czestotliwoscMinuty = Math.round(liczba);
      }
    }

    if (ma("status")) {
      const wartosc = String(cialo.status ?? "").toLowerCase();
      if (!(DOZWOLONE_STATUSY as readonly string[]).includes(wartosc)) {
        res.status(400).json({ error: "status: aktywny|wstrzymany|blad" });
        return;
      }
      patch.status = wartosc;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Brak pól do aktualizacji (url|czestotliwoscMinuty|status)" });
      return;
    }

    aktualizujDostawce(db, dostawca.id, patch);

    // Oryginał resetuje znacznik tylko przy zmianie częstotliwości (`extensions.cjs:387`).
    if (ma("czestotliwoscMinuty")) przeplanujScheduler?.();

    // `extensions.cjs:390-393` — audyt niesie listę zmienionych pól i ich nowe wartości.
    const user = req.user!;
    zapiszAudyt(db, {
      uzytkownikId: user.id,
      uzytkownikImie: user.imieNazwisko,
      akcja: "edit_supplier_config",
      encjaTyp: "dostawca",
      encjaId: kod,
      szczegoly: { pola: Object.keys(patch), nowe: patch },
    });

    const po = dostawcaPoKodzie(db, kod);
    res.json({
      ok: true,
      kod,
      url: po?.url ?? null,
      czestotliwoscMinuty: po?.czestotliwoscMinuty ?? null,
      status: po?.status,
    });
  });

  /**
   * SUROWY dziennik audytu (`deminified/backend-index.cjs:48735`) — w oryginale dosłownie
   * `u.json(U.listAudit(500))`, bez mapowania i bez JOIN-a.
   *
   * ⚠ `szczegolyJson` WYCHODZI JAKO STRING, nie jako obiekt. `contract/fixtures/GET_audit-log.json`
   * zamraża dokładnie to (`"szczegolyJson": "{\"source\":\"scheduler\",…}"`). Kuszące użycie
   * `parsujSzczegoly` z `historia/mapowanie.ts` złamałoby kontrakt na dwa sposoby naraz:
   * zmieniłoby typ wartości i (przy zmianie nazwy klucza) jego nazwę. Parsowanie należy do
   * KONSUMENTA — robi je widok „Dziennik" we froncie.
   *
   * ⚠ To jest audyt BEZ FILTRA TYPU, w odróżnieniu od `/api/history/{meta,paged}`, które
   * odsiewają pięć rozpoznawanych akcji. Wychodzą więc stąd także wiersze, których tamten
   * widok nigdy nie pokaże — m.in. `synchronizacja_reczna` z `szczegoly_json = NULL`
   * (`:48240`, audyt wołany bez czwartego argumentu) oraz wiersze, których `encjaId` jest
   * kodem dostawcy spoza `suppliers` (audyt zapisuje ZAMIAR, przed sprawdzeniem, czy
   * dostawca istnieje). Trasa nie łączy się z żadną inną tabelą, więc znosi jedno i drugie
   * bez zmian — i tak samo musi to znieść widok.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D2): oryginał ma tę trasę PUBLICZNĄ (brak `we`,
   * `security: []` w `contract/openapi.yaml:536`). Nakładamy `requireAuth`, kontynuując
   * zasadę §3 z I1 — dziennik niesie e-maile użytkowników, nazwy plików i adresy dostawców.
   */
  router.get("/api/audit-log", requireAuth, (_req, res) => {
    res.json(listaAudytu(db, LIMIT_AUDIT_LOG));
  });

  return router;
}
