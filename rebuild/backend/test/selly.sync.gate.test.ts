/**
 * GATE ODBUDOWY — karta I15.8: sześć tras `sync-*` (`routes_sync.cjs`).
 *
 * Ścieżki kontraktu w zakresie: `GET /api/selly/sync-status` oraz `POST /api/selly/`
 * `{sync-delta-supplier, sync-delta-all, sync-full-supplier, sync-full-today, sync-full-force}`
 * — dopisane do `contract/openapi.yaml` w tym tickecie.
 *
 * ⚠ FIXTURE'ÓW DLA TYCH TRAS NIE MA I NIE BĘDZIE — i to nie jest obejście gate'a.
 * Cztery z sześciu to MUTACJE wołające Tor 1/Tor 2, czyli realne PUT-y wariantów
 * i (przy `autoCreate`) zakładanie produktów w cudzym sklepie `agroopony.selly24.pl`;
 * nagrywarka ich nie ruszała, bo każde nagranie zmieniałoby ten sklep. Z pozostałych dwóch
 * `sync-delta-supplier`, `sync-full-today` i `sync-full-force` oddają na PRODUKCJI 500
 * (zepsute importy — patrz nagłówek `src/routes/selly-sync.ts`), więc nagranie 1:1 byłoby
 * nagraniem awarii. Siatką jest tu kontrakt + zachowanie na atrapie klienta.
 *
 * ⚠ ŻADEN TEST NIE WOŁA PRAWDZIWEGO SELLY — klient to atrapa (`test/gate/selly-atrapa.ts`).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  sprawdzZgodnoscZKontraktem,
  stworzAtrapeSelly,
  stworzSrodowiskoTestowe,
  type AtrapaSelly,
  type SrodowiskoTestowe,
} from "./gate/index.js";
import { ACTIVE_SUPPLIERS } from "../src/selly/rest/scheduler.js";

const TRASY_SYNC = [
  { metoda: "GET" as const, sciezka: "/api/selly/sync-status" },
  { metoda: "POST" as const, sciezka: "/api/selly/sync-delta-supplier" },
  { metoda: "POST" as const, sciezka: "/api/selly/sync-delta-all" },
  { metoda: "POST" as const, sciezka: "/api/selly/sync-full-supplier" },
  { metoda: "POST" as const, sciezka: "/api/selly/sync-full-today" },
  { metoda: "POST" as const, sciezka: "/api/selly/sync-full-force" },
];

describe("GATE — trasy sync-* (karta I15.8)", () => {
  let srodowisko: SrodowiskoTestowe;
  let atrapa: AtrapaSelly;
  let token: string;

  beforeAll(async () => {
    atrapa = stworzAtrapeSelly();
    srodowisko = await stworzSrodowiskoTestowe(undefined, { klientSelly: atrapa.klient });

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);
  const postZAuth = (sciezka: string) =>
    request(srodowisko.app).post(sciezka).set("Authorization", `Bearer ${token}`);

  it("wszystkie sześć tras wymaga auth (401 bez tokenu)", async () => {
    for (const { metoda, sciezka } of TRASY_SYNC) {
      const odp =
        metoda === "GET"
          ? await request(srodowisko.app).get(sciezka)
          : await request(srodowisko.app).post(sciezka).send({});
      expect(odp.status, `${metoda} ${sciezka}`).toBe(401);
    }
  });

  describe("GET /api/selly/sync-status", () => {
    it("oddaje kształt z `routes_sync.cjs:34` i zgadza się z kontraktem", async () => {
      const odp = await zAuth("/api/selly/sync-status");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "GET",
        sciezka: "/api/selly/sync-status",
        odpowiedz: odp,
      });

      const body = odp.body as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(
        ["activeSuppliers", "limiter", "ok", "recentLogs", "todayRotation"].sort(),
      );
      expect(body.ok).toBe(true);
      expect(body.activeSuppliers).toEqual([...ACTIVE_SUPPLIERS]);
      expect(Object.keys(body.limiter as object).sort()).toEqual([
        "capacity",
        "requestsInWindow",
        "utilizationPct",
      ]);
      expect(Array.isArray(body.todayRotation)).toBe(true);
    });

    /**
     * ⚠ KLUCZE `recentLogs` SĄ `snake_case` — to wymóg kontraktu, nie stylistyka.
     * Oryginał czyta jawną listę kolumn przez better-sqlite3, więc do JSON-a idą nazwy
     * KOLUMN. Drizzle `select()` bez projekcji oddałby `dostawcaKod`, `liczbaOk`… i rozjechał
     * kształt — dokładnie tak, jak stało się na `GET /api/selly/log` (CLAUDE.md).
     */
    it("`recentLogs` ma klucze snake_case i pomija uzytkownik_*", async () => {
      srodowisko.sqlite
        .prepare(
          `INSERT INTO selly_sync_log (operacja, dostawca_kod, liczba_ok, liczba_blad,
                                       liczba_skip, rozpoczeto, zakonczono, status,
                                       uzytkownik_id, uzytkownik_imie)
           VALUES ('sync_delta', 'MO1', 3, 1, 0, '2026-09-20 09:55:00',
                   '2026-09-20 09:55:04', 'zakonczono', 7, 'Ania')`,
        )
        .run();

      const odp = await zAuth("/api/selly/sync-status");
      const wpisy = (odp.body as { recentLogs: Record<string, unknown>[] }).recentLogs;

      expect(wpisy.length).toBeGreaterThan(0);
      expect(Object.keys(wpisy[0]!).sort()).toEqual(
        [
          "dostawca_kod",
          "id",
          "liczba_blad",
          "liczba_ok",
          "liczba_skip",
          "operacja",
          "rozpoczeto",
          "status",
          "szczegoly_json",
          "zakonczono",
        ].sort(),
      );
      // `GET /api/selly/log` je oddaje, `sync-status` NIE — oryginał wypisuje 9 kolumn.
      expect(wpisy[0]).not.toHaveProperty("uzytkownik_id");
      expect(wpisy[0]).not.toHaveProperty("uzytkownik_imie");
      expect(wpisy[0]).not.toHaveProperty("dostawcaKod");
    });

    it("oddaje najwyżej 20 ostatnich wpisów, malejąco po `rozpoczeto`", async () => {
      const wstaw = srodowisko.sqlite.prepare(
        `INSERT INTO selly_sync_log (operacja, dostawca_kod, rozpoczeto, status)
         VALUES ('sync_delta', ?, ?, 'zakonczono')`,
      );
      for (let i = 1; i <= 25; i++) {
        wstaw.run("MO1", `2026-09-22 10:${String(i).padStart(2, "0")}:00`);
      }

      const odp = await zAuth("/api/selly/sync-status");
      const wpisy = (odp.body as { recentLogs: { rozpoczeto: string }[] }).recentLogs;

      expect(wpisy).toHaveLength(20);
      const czasy = wpisy.map((w) => w.rozpoczeto);
      expect([...czasy].sort().reverse()).toEqual(czasy);
      expect(czasy[0]).toBe("2026-09-22 10:25:00");
    });
  });

  describe("walidacja dostawcy (400)", () => {
    it("sync-delta-supplier odrzuca brak i zły kod komunikatem z oryginału", async () => {
      for (const ciało of [{}, { dostawca: "MO99" }, { dostawca: 7 }]) {
        const odp = await postZAuth("/api/selly/sync-delta-supplier").send(ciało);
        expect(odp.status).toBe(400);
        sprawdzZgodnoscZKontraktem({
          metoda: "POST",
          sciezka: "/api/selly/sync-delta-supplier",
          odpowiedz: odp,
        });
        expect(odp.body).toEqual({
          ok: false,
          error: "Zly dostawca. Wymagany jeden z: " + ACTIVE_SUPPLIERS.join(","),
        });
      }
    });

    it("sync-full-supplier odrzuca zły kod krótszym komunikatem (`:69`)", async () => {
      const odp = await postZAuth("/api/selly/sync-full-supplier").send({ dostawca: "MO99" });
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ ok: false, error: "Zly dostawca" });
    });

    it("sync-full-force wymaga NIEPUSTEJ tablicy samych znanych dostawców", async () => {
      for (const ciało of [{}, { dostawcy: [] }, { dostawcy: "MO1" }, { dostawcy: ["MO1", "X"] }]) {
        const odp = await postZAuth("/api/selly/sync-full-force").send(ciało);
        expect(odp.status, JSON.stringify(ciało)).toBe(400);
        expect(odp.body).toEqual({
          ok: false,
          error: "Podaj tablice dostawcow z: " + ACTIVE_SUPPLIERS.join(","),
        });
      }
    });
  });

  describe("przebiegi na atrapie", () => {
    it("sync-delta-supplier oddaje wynik `syncDelta` (odstępstwo: produkcja daje tu 500)", async () => {
      const odp = await postZAuth("/api/selly/sync-delta-supplier").send({ dostawca: "MO1" });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-delta-supplier",
        odpowiedz: odp,
      });
      const body = odp.body as { stats: Record<string, number>; logId: number };
      expect(Object.keys(body.stats).sort()).toEqual([
        "created",
        "discovered",
        "err",
        "ok",
        "skip",
        "total",
      ]);
      expect(typeof body.logId).toBe("number");
    });

    it("sync-delta-all opakowuje wyniki wszystkich dostawców", async () => {
      const odp = await postZAuth("/api/selly/sync-delta-all").send({});

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-delta-all",
        odpowiedz: odp,
      });
      const body = odp.body as { ok: boolean; results: { dostawca: string }[] };
      expect(body.ok).toBe(true);
      expect(body.results.map((r) => r.dostawca)).toEqual([...ACTIVE_SUPPLIERS]);
    });

    /**
     * ODSTĘPSTWO 3 (karta I15.8): produkcja przekazuje `{forceSuppliers}`, a `runFullBatch`
     * czyta `opts.suppliers` — więc „force MO3" puściłoby DZISIEJSZĄ ROTACJĘ, czyli zapis
     * do sklepu dla innych dostawców niż wskazane. Tu sprawdzamy, że lista jest honorowana.
     */
    it("sync-full-force honoruje podaną listę dostawców, nie rotację z dziś", async () => {
      const odp = await postZAuth("/api/selly/sync-full-force").send({ dostawcy: ["MO3", "MO5"] });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-full-force",
        odpowiedz: odp,
      });
      const body = odp.body as { ok: boolean; results: { dostawca: string }[] };
      expect(body.ok).toBe(true);
      expect(body.results.map((r) => r.dostawca)).toEqual(["MO3", "MO5"]);
    });

    it("sync-full-today idzie rotacją na dziś (odstępstwo: produkcja daje tu 500)", async () => {
      const odp = await postZAuth("/api/selly/sync-full-today").send({});

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-full-today",
        odpowiedz: odp,
      });
      const body = odp.body as { ok: boolean; results: unknown[] };
      expect(body.ok).toBe(true);
      // Rotacja zależy od dnia biegu testu — pusta lista w dzień bez rotacji jest poprawna.
      expect(Array.isArray(body.results)).toBe(true);
    });

    it("sync-full-supplier oddaje wynik `syncFullForDostawca`", async () => {
      const odp = await postZAuth("/api/selly/sync-full-supplier").send({
        dostawca: "MO1",
        autoCreate: false,
      });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-full-supplier",
        odpowiedz: odp,
      });
      const body = odp.body as { stats: Record<string, number>; durationMs: number };
      expect(Object.keys(body.stats).sort()).toEqual([
        "created_C",
        "created_variant_B",
        "dry",
        "err",
        "skip",
        "total",
        "updated_A",
      ]);
      expect(typeof body.durationMs).toBe("number");
    });
  });
});
