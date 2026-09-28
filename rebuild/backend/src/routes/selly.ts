/**
 * Panel Selly — dziesięć tras, port `mirror/backend/selly/routes.cjs`.
 *
 * ⚠ TE TRASY NIE SĄ ODSTĘPSTWEM OD §3 — oryginał REJESTRUJE JE JUŻ ZA AUTH:
 * `registerSellyRoutes(app, {db, requireAuth: we})` (`mirror/backend/extensions.cjs:456-458`).
 * Roadmapa sugerowała inaczej; sprostowane przy tym tickecie. Świadome odstępstwo §3 dotyczy
 * wyłącznie dwóch tras eksportu Shopera (`routes/export-shoper.ts`).
 *
 * ⚠ ROZKŁAD METOD: 5 GET (`ping`, `dictionaries`, `status`, `log`, `csv-status`)
 * i 5 POST (`producers`, `categories`, `sync-product`, `sync-supplier`, `generate-csv`).
 * Roadmapa i prompt sesji wymieniały `categories`/`producers` jako GET — to BŁĄD, obalony
 * przez `routes.cjs:115,128` i `contract/openapi.yaml:914,974`. Są to POST-y „dodaj do Selly",
 * nie odczyty.
 *
 * ⚠ SZEŚĆ Z TYCH TRAS WYCHODZI DO REALNEGO SKLEPU SELLY (`ping`, `dictionaries`, `producers`,
 * `categories`, `sync-product`, `sync-supplier`), a `sync-supplier` z `dry_run=false` tworzy
 * i modyfikuje tam produkty. Bez sekretów `SELLY_*` klient rzuca przy pierwszym wywołaniu
 * i trasa oddaje 500 — 1:1 z produkcją (plan.md D6).
 *
 * ⚠ KSZTAŁTY ODPOWIEDZI SĄ `snake_case` (`w_bridge`, `token_prefix`, `vat_probe`,
 * `ostatnia_synchronizacja`) — tak są zamrożone w pięciu fixture'ach
 * `contract/fixtures/GET_selly_*.json` i tak zostają.
 */

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import {
  DOMYSLNY_LIMIT_LOGU,
  logSelly,
  MAKS_LIMIT_LOGU,
  otworzWpisLogu,
  oznaczWpisLoguBledem,
  produktPoKodzie,
  produktyDoSynchronizacji,
  statusSelly,
  synchronizujJedenProdukt,
  zamknijWpisLogu,
} from "../repos/selly.js";
import {
  statusPlikuCsv,
  wygenerujCsvSelly,
  type SciezkiCsvSelly,
} from "../selly/generator-csv.js";
import type { KlientSelly } from "../selly/klient.js";
import { naPayloadSelly, walidujPayload, type PayloadSelly } from "../selly/mapper.js";
import { zapewnijSlowniki } from "../selly/slowniki.js";

export type ZaleznosciSelly = {
  db: Baza;
  /**
   * Klient REST Selly. Wstrzykiwany (plan.md D2), żeby testy mogły podać atrapę — żaden
   * bieg `npm test` nie ma prawa dotknąć produkcyjnego sklepu.
   */
  klient: KlientSelly;
  sciezkiCsv: SciezkiCsvSelly;
};

/** Komunikat błędu w kształcie, w jakim oddaje go oryginał (`e.message`, bez opakowania). */
function komunikat(blad: unknown): string {
  return blad instanceof Error ? blad.message : String(blad);
}

/** Maksymalna liczba błędów w podsumowaniu synchronizacji dostawcy (`routes.cjs:230`). */
const MAKS_BLEDOW_W_PODSUMOWANIU = 50;
/** Maksymalna liczba przykładowych payloadów w trybie `dry_run` (`routes.cjs:215`). */
const MAKS_PAYLOADOW_DRY_RUN = 5;

export function trasySelly({ db, klient, sciezkiCsv }: ZaleznosciSelly): Router {
  const router = Router();

  /**
   * Test tokenu i połączenia (`routes.cjs:89-96`). Token pobierany z wymuszonym odświeżeniem —
   * to jest cel tej trasy, sprawdzić, czy OAuth2 w ogóle działa.
   */
  router.get("/api/selly/ping", requireAuth, async (_req: Request, res: Response) => {
    try {
      res.json(await klient.ping());
    } catch (e) {
      res.status(500).json({ ok: false, error: komunikat(e) });
    }
  });

  /**
   * Słowniki Selly (`routes.cjs:99-113`). `?force=1` lub `?force=true` wymusza odpytanie
   * czterech endpointów Selly i nadpisanie cache; bez tego czyta lokalnie, o ile cache
   * nie jest pusty.
   *
   * ⚠ `refreshed` odbija PARAMETR, nie fakt odświeżenia. Pierwsze wywołanie na pustym cache
   * realnie odpytuje Selly, ale zwraca `refreshed: false`, bo `force` nie było. Zastane
   * zachowanie, zamrożone w `GET_selly_dictionaries.json`.
   */
  router.get("/api/selly/dictionaries", requireAuth, async (req: Request, res: Response) => {
    try {
      const wymus = req.query.force === "1" || req.query.force === "true";
      const mapy = await zapewnijSlowniki(db, klient, wymus);
      res.json({
        producers: mapy.producerMap,
        categories: mapy.catMap,
        vat_rates: mapy.vatMap,
        warehouses: mapy.whMap,
        refreshed: wymus,
      });
    } catch (e) {
      res.status(500).json({ error: komunikat(e) });
    }
  });

  /** Dodanie marki do Selly (`routes.cjs:115-126`). Po utworzeniu cache jest odświeżany. */
  router.post("/api/selly/producers", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name } = (req.body ?? {}) as { name?: string };
      if (!name) {
        res.status(400).json({ error: "Brak name" });
        return;
      }
      const wynik = await klient.createProducer({ name });
      await zapewnijSlowniki(db, klient, true);
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "selly_dodanie_producenta",
        encjaTyp: "selly_producer",
        encjaId: name,
        szczegoly: wynik,
      });
      res.json(wynik);
    } catch (e) {
      res.status(500).json({ error: komunikat(e) });
    }
  });

  /**
   * Dodanie kategorii do Selly (`routes.cjs:128-139`). Domyślne `parent_id: 0`
   * (kategoria główna) i `visible: "sklep"` — 1:1 z oryginałem.
   */
  router.post("/api/selly/categories", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        name,
        parent_id = 0,
        visible = "sklep",
      } = (req.body ?? {}) as { name?: string; parent_id?: number; visible?: string };
      if (!name) {
        res.status(400).json({ error: "Brak name" });
        return;
      }
      const wynik = await klient.createCategory({ name, parent_id, visible });
      await zapewnijSlowniki(db, klient, true);
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "selly_dodanie_kategorii",
        encjaTyp: "selly_category",
        encjaId: name,
        szczegoly: wynik,
      });
      res.json(wynik);
    } catch (e) {
      res.status(500).json({ error: komunikat(e) });
    }
  });

  /**
   * Synchronizacja jednego produktu (`routes.cjs:142-164`).
   *
   * Trzy różne 400 i jedno 404, wszystkie z komunikatami verbatim: brak `kod`, produkt
   * nieaktywny, nieudana walidacja payloadu (z `details` i całym `payload` w odpowiedzi —
   * panel pokazuje operatorowi, czego zabrakło).
   *
   * ⚠ 500 niesie `stack` (`routes.cjs:162`). W pozostałych trasach Selly go nie ma. Zostaje
   * 1:1 — trasa jest za `requireAuth`, a panel na tym stosie polega przy diagnostyce.
   */
  router.post("/api/selly/sync-product", requireAuth, async (req: Request, res: Response) => {
    try {
      const { kod } = (req.body ?? {}) as { kod?: string };
      if (!kod) {
        res.status(400).json({ error: 'Brak "kod"' });
        return;
      }

      const produkt = produktPoKodzie(db, kod);
      if (!produkt) {
        res.status(404).json({ error: `Nie znaleziono produktu ${kod}` });
        return;
      }
      if (produkt.status !== "aktywny") {
        res.status(400).json({
          error: `Produkt ${kod} ma status "${produkt.status}" — nie może być wysłany do Selly`,
        });
        return;
      }

      const mapy = await zapewnijSlowniki(db, klient);
      const payload = naPayloadSelly(db, produkt, mapy);
      const walidacja = walidujPayload(payload);
      if (!walidacja.ok) {
        res.status(400).json({ error: "Walidacja", details: walidacja.errors, payload });
        return;
      }

      const wynik = await synchronizujJedenProdukt(db, klient, produkt, payload);
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "selly_sync_produktu",
        encjaTyp: "produkt",
        encjaId: kod,
        szczegoly: wynik,
      });
      res.json(wynik);
    } catch (e) {
      res.status(500).json({
        error: komunikat(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
    }
  });

  /**
   * Synchronizacja całego dostawcy (`routes.cjs:167-249`).
   *
   * ⚠ TO JEST OPERACJA, KTÓRA REALNIE ZMIENIA CUDZY SKLEP. `dry_run: true` przechodzi całą
   * ścieżkę mapowania i walidacji, ale ZERO razy woła klienta — zwraca do pięciu przykładowych
   * payloadów. Domyślne `dry_run` to `false`, jak w oryginale.
   *
   * Wpis w `selly_sync_log` powstaje PRZED pętlą (status `w_trakcie`) i jest domykany po niej.
   * Padnięcie procesu w środku zostawia więc wiersz `w_trakcie` na zawsze — zastane, widoczne
   * także w produkcyjnym `GET_selly_log.json`.
   *
   * ⚠ Błąd walidacji liczy się jako `skipped`, błąd wywołania Selly jako `failed` — dwie
   * różne kolumny w dzienniku. `errors` jest przycinane do 50 wpisów, ale liczniki są pełne.
   */
  router.post("/api/selly/sync-supplier", requireAuth, async (req: Request, res: Response) => {
    const {
      dostawca,
      dry_run = false,
      limit = 0,
      only_updated = false,
    } = (req.body ?? {}) as {
      dostawca?: string;
      dry_run?: boolean;
      limit?: number;
      only_updated?: boolean;
    };

    if (!dostawca) {
      res.status(400).json({ error: 'Brak "dostawca" (np. "MO1")' });
      return;
    }

    const idLogu = otworzWpisLogu(db, {
      dostawca,
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
    });

    try {
      const mapy = await zapewnijSlowniki(db, klient);
      const produkty = produktyDoSynchronizacji(db, dostawca, {
        onlyUpdated: Boolean(only_updated),
        limit: Number(limit) || 0,
      });

      let created = 0;
      let updated = 0;
      let failed = 0;
      let skipped = 0;
      const errors: { kod: string; reason?: string; error?: string }[] = [];
      const dryPayloads: { kod: string; payload: PayloadSelly }[] = [];

      for (const produkt of produkty) {
        const payload = naPayloadSelly(db, produkt, mapy);
        const walidacja = walidujPayload(payload);
        if (!walidacja.ok) {
          skipped++;
          errors.push({ kod: produkt.kod, reason: walidacja.errors.join("; ") });
          continue;
        }
        if (dry_run) {
          if (dryPayloads.length < MAKS_PAYLOADOW_DRY_RUN) {
            dryPayloads.push({ kod: produkt.kod, payload });
          }
          continue;
        }
        try {
          const wynik = await synchronizujJedenProdukt(db, klient, produkt, payload);
          if (wynik.action === "created") created++;
          else updated++;
        } catch (e) {
          failed++;
          errors.push({ kod: produkt.kod, error: komunikat(e).slice(0, 250) });
        }
      }

      const podsumowanie = {
        dostawca,
        total: produkty.length,
        created,
        updated,
        failed,
        skipped,
        dry_run,
        errors: errors.slice(0, MAKS_BLEDOW_W_PODSUMOWANIU),
        dry_payloads: dry_run ? dryPayloads : undefined,
      };

      zamknijWpisLogu(db, idLogu, {
        liczbaOk: created + updated,
        liczbaBlad: failed,
        liczbaSkip: skipped,
        szczegoly: podsumowanie,
      });

      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "selly_sync_dostawcy",
        encjaTyp: "dostawca",
        encjaId: dostawca,
        szczegoly: podsumowanie,
      });

      res.json(podsumowanie);
    } catch (e) {
      oznaczWpisLoguBledem(db, idLogu, komunikat(e));
      res.status(500).json({ error: komunikat(e) });
    }
  });

  /**
   * Status mapowania per dostawca (`routes.cjs:252-280`) — ile produktów jest w Bridge,
   * ile doszło do Selly, ile ma tam błąd. Opcjonalny filtr `?dostawca=`.
   *
   * ⚠ DROBNA RÓŻNICA WOBEC ORYGINAŁU, ŚWIADOMA: przy powtórzonym parametrze
   * (`?dostawca=a&dostawca=b`) Express oddaje TABLICĘ. Oryginał wrzuciłby ją wprost do
   * `db.prepare(...).all(dostawca)` i better-sqlite3 by rzucił (500); my sprawdzamy typ
   * i traktujemy taki parametr jak jego brak. Panel takich żądań nie generuje, a 500
   * z wnętrza sterownika bazy nie jest zachowaniem, które warto odtwarzać wiernie.
   */
  router.get("/api/selly/status", requireAuth, (req: Request, res: Response) => {
    try {
      const dostawca = req.query.dostawca;
      res.json({
        items: statusSelly(db, typeof dostawca === "string" ? dostawca : undefined),
      });
    } catch (e) {
      res.status(500).json({ error: komunikat(e) });
    }
  });

  /**
   * Dziennik operacji (`routes.cjs:283-293`). `?limit` ścinany do 200; wartość nieliczbowa
   * albo brak parametru dają 20.
   */
  router.get("/api/selly/log", requireAuth, (req: Request, res: Response) => {
    try {
      const zParametru = Number.parseInt(String(req.query.limit ?? ""), 10);
      const limit = Math.min(
        Number.isNaN(zParametru) || zParametru === 0 ? DOMYSLNY_LIMIT_LOGU : zParametru,
        MAKS_LIMIT_LOGU,
      );
      res.json({ items: logSelly(db, limit) });
    } catch (e) {
      res.status(500).json({ error: komunikat(e) });
    }
  });

  /** Status codziennego pliku CSV, po który Selly przychodzi samo (`routes.cjs:298-342`). */
  router.get("/api/selly/csv-status", requireAuth, (_req: Request, res: Response) => {
    try {
      res.json(statusPlikuCsv(sciezkiCsv));
    } catch (e) {
      res.status(500).json({ ok: false, status: "blad", error: komunikat(e) });
    }
  });

  /**
   * Ręczne wygenerowanie pliku CSV (`routes.cjs:345-368`) — przycisk awaryjny, gdy cron
   * o 6:00 zawiedzie. Ciała żądania NIE czyta (oryginał też nie).
   *
   * Oryginał, gdy generowanie się uda, ale odczyt statusu pliku padnie, oddaje 200 z kluczem
   * `uwaga` zamiast statystyk (`routes.cjs:366`). U nas generowanie i odczyt statystyk to
   * jedna operacja na tym samym pliku, więc ta gałąź nie ma jak wystąpić — jej brak jest
   * konsekwencją portu in-process (plan.md D5), nie pominięciem.
   */
  router.post("/api/selly/generate-csv", requireAuth, (_req: Request, res: Response) => {
    try {
      res.json(wygenerujCsvSelly(db, sciezkiCsv));
    } catch (e) {
      res.status(500).json({ ok: false, error: komunikat(e) });
    }
  });

  return router;
}
