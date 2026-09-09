/**
 * Trasy Toru 1 (`src/routes/selly-sync.ts`, port `routes_sync.cjs`) — trzy z sześciu,
 * które ma oryginał. Pozostałe trzy to Tor 2 (karta 13d-2).
 *
 * ⚠ GRANICA DOWODU. Te trasy NIE MAJĄ nagrania w `contract/fixtures/` i nie da się go
 * zrobić — wymagałoby odpytania żywego, cudzego sklepu Selly (zakaz z CLAUDE.md).
 * Kształty odpowiedzi pochodzą z odczytania `routes_sync.cjs` i zostały dopisane do
 * `contract/openapi.yaml` (ticket 45, decyzja D6); walidujemy się względem nich.
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DOSTAWCY_AKTYWNI } from "../src/selly/scheduler-sync.js";
import {
  sprawdzZgodnoscZKontraktem,
  stworzAtrapeSelly,
  stworzSrodowiskoTestowe,
  zasiejProdukty,
  type AtrapaSelly,
  type SrodowiskoTestowe,
} from "./gate/index.js";

describe("trasy Toru 1 — /api/selly/sync-*", () => {
  let srodowisko: SrodowiskoTestowe;
  let atrapa: AtrapaSelly;
  let token: string;

  beforeEach(async () => {
    atrapa = stworzAtrapeSelly({ produktyPoEan: {} });
    srodowisko = await stworzSrodowiskoTestowe(undefined, { klientSelly: atrapa.klient });
    zasiejProdukty(srodowisko.db);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterEach(() => srodowisko.posprzataj());

  const zAuth = (metoda: "get" | "post", sciezka: string) =>
    request(srodowisko.app)[metoda](sciezka).set("Authorization", `Bearer ${token}`);

  describe("auth — wszystkie trzy trasy za `requireAuth`", () => {
    /**
     * ⚠ To NIE jest nasz dodatek: oryginał rejestruje te trasy z `requireAuth: we`
     * (`extensions.cjs:465`), więc auth jest tu portem, nie zaostrzeniem.
     */
    it("bez tokenu każda oddaje 401", async () => {
      for (const [metoda, sciezka] of [
        ["get", "/api/selly/sync-status"],
        ["post", "/api/selly/sync-delta-supplier"],
        ["post", "/api/selly/sync-delta-all"],
      ] as const) {
        const odp = await request(srodowisko.app)[metoda](sciezka);
        expect(odp.status, `${metoda} ${sciezka}`).toBe(401);
      }
    });
  });

  describe("GET /api/selly/sync-status", () => {
    it("oddaje limiter, rotację, listę dostawców i ostatnie wpisy dziennika", async () => {
      const odp = await zAuth("get", "/api/selly/sync-status");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "GET",
        sciezka: "/api/selly/sync-status",
        odpowiedz: odp,
      });

      const cialo = odp.body as {
        ok: boolean;
        limiter: { requestsInWindow: number; capacity: number; utilizationPct: number };
        todayRotation: string[];
        activeSuppliers: string[];
        recentLogs: unknown[];
      };
      expect(cialo.ok).toBe(true);
      expect(cialo.limiter.capacity).toBe(250);
      expect(cialo.activeSuppliers).toEqual([...DOSTAWCY_AKTYWNI]);
      expect(Array.isArray(cialo.todayRotation)).toBe(true);
      expect(cialo.recentLogs).toEqual([]);
    });

    it("pokazuje wpis dziennika po przebiegu delty", async () => {
      await zAuth("post", "/api/selly/sync-delta-supplier").send({ dostawca: "MO9" });

      const odp = await zAuth("get", "/api/selly/sync-status");

      const logi = (odp.body as { recentLogs: { operacja: string; dostawca_kod: string }[] })
        .recentLogs;
      expect(logi[0]).toMatchObject({ operacja: "sync_delta", dostawca_kod: "MO9" });
    });
  });

  describe("POST /api/selly/sync-delta-supplier", () => {
    /**
     * ⭐ ODSTĘPSTWO ŚWIADOME (ticket 45, decyzja D1). U Ani ta trasa ZAWSZE oddaje 500:
     * `routes_sync.cjs:15` importuje `syncDeltaForDostawca`, którego `sync_delta.cjs`
     * nie eksportuje (nazwa żyje tylko w `.bak-v1-2026-09-07`). U nas trasa działa —
     * bo karta 13d-3 dokłada w panelu przycisk, który bez tego byłby martwy.
     */
    it("działa i oddaje statystyki przebiegu (u Ani: 500 — D1)", async () => {
      const odp = await zAuth("post", "/api/selly/sync-delta-supplier").send({ dostawca: "MO9" });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-delta-supplier",
        odpowiedz: odp,
      });
      expect(odp.body).toMatchObject({
        stats: { total: expect.any(Number), ok: expect.any(Number), err: expect.any(Number) },
        logId: expect.any(Number),
      });
    });

    it("zły dostawca → 400 z komunikatem verbatim z oryginału", async () => {
      const odp = await zAuth("post", "/api/selly/sync-delta-supplier").send({ dostawca: "MO99" });

      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({
        ok: false,
        error: "Zly dostawca. Wymagany jeden z: MO1,MO2,MO3,MO4,MO5,MO6,MO7,MO8,MO9,MO10",
      });
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-delta-supplier",
        odpowiedz: odp,
      });
    });

    it("brak `dostawca` w ciele → też 400", async () => {
      const odp = await zAuth("post", "/api/selly/sync-delta-supplier").send({});
      expect(odp.status).toBe(400);
    });

    it("odrzucony dostawca NIE dotyka Selly", async () => {
      await zAuth("post", "/api/selly/sync-delta-supplier").send({ dostawca: "NIE_MA" });
      expect(atrapa.wywolania).toEqual([]);
    });
  });

  describe("POST /api/selly/sync-delta-all", () => {
    it("oddaje wynik dla wszystkich dziesięciu dostawców", async () => {
      const odp = await zAuth("post", "/api/selly/sync-delta-all").send({});

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-delta-all",
        odpowiedz: odp,
      });

      const cialo = odp.body as { ok: boolean; results: { dostawca: string }[] };
      expect(cialo.ok).toBe(true);
      expect(cialo.results.map((r) => r.dostawca)).toEqual([...DOSTAWCY_AKTYWNI]);
    });
  });
});
