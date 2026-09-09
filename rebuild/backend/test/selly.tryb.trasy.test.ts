/**
 * Blokada środowiskowa NA TRASACH (ticket 34) — dowód, że obwoluta działa end-to-end,
 * a nie tylko w izolacji (`selly.tryb.test.ts`).
 *
 * ⭐ Najważniejszy test tego pliku: **`sync-supplier` z `dry_run: true` przechodzi w trybie
 * `tylko-odczyt`, a z `dry_run: false` nie.** To jest cała wartość tego trybu dla Ani —
 * może przetestować połączenie i zobaczyć, co poszłoby do sklepu, bez najmniejszej
 * możliwości, żeby cokolwiek tam trafiło. Nie ma w kodzie ani jednej linijki na ten temat:
 * wynika to z tego, że dry-run nigdy nie woła metody zapisującej (decyzja D3).
 *
 * Wstrzykujemy atrapę OPAKOWANĄ trybem, bo `app.ts` opakowuje tylko klienta budowanego
 * z env — wstrzyknięty idzie nietknięty (żeby GATE 8a/8b nie zależał od tego mechanizmu).
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { opakujKlientaTrybem } from "../src/selly/tryb.js";
import {
  stworzAtrapeSelly,
  stworzSrodowiskoTestowe,
  zasiejMapySelly,
  zasiejProdukty,
  type AtrapaSelly,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Buduje środowisko z klientem opakowanym danym trybem. */
async function srodowiskoZTrybem(tryb: "wylaczony" | "tylko-odczyt" | "pelny"): Promise<{
  srodowisko: SrodowiskoTestowe;
  atrapa: AtrapaSelly;
  token: string;
}> {
  const atrapa = stworzAtrapeSelly();
  const srodowisko = await stworzSrodowiskoTestowe(undefined, {
    klientSelly: opakujKlientaTrybem(atrapa.klient, tryb),
  });
  zasiejProdukty(srodowisko.db);
  zasiejMapySelly(srodowisko.db);

  const odp = await request(srodowisko.app)
    .post("/api/login")
    .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });

  return { srodowisko, atrapa, token: (odp.body as { token: string }).token };
}

describe("tryb `wylaczony` — sześć tras zewnętrznych odmawia", () => {
  let srodowisko: SrodowiskoTestowe;
  let atrapa: AtrapaSelly;
  let token: string;

  beforeEach(async () => {
    ({ srodowisko, atrapa, token } = await srodowiskoZTrybem("wylaczony"));
  });

  afterEach(async () => {
    srodowisko.posprzataj();
  });

  it("`GET /api/selly/ping` oddaje 500 z komunikatem o wyłączonej integracji", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/selly/ping")
      .set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(500);
    expect(JSON.stringify(odp.body)).toMatch(/SELLY_TRYB=wylaczony/);
  });

  it("`POST /api/selly/sync-supplier` nie dotyka Selly nawet w dry-runie", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/selly/sync-supplier")
      .set("Authorization", `Bearer ${token}`)
      .send({ dostawca: "MO9", dry_run: true });

    expect(odp.status).toBe(500);
    // Kluczowa asercja: ZERO wywołań do sklepu.
    expect(atrapa.wywolania).toEqual([]);
  });

  it("trasy LOKALNE działają dalej — blokada dotyczy tylko wyjścia na zewnątrz", async () => {
    // To jest sedno podziału: `status`, `log` i `csv-status` czytają naszą bazę i plik,
    // więc zablokowanie integracji nie może ich ruszyć.
    for (const sciezka of ["/api/selly/status", "/api/selly/log", "/api/selly/csv-status"]) {
      const odp = await request(srodowisko.app)
        .get(sciezka)
        .set("Authorization", `Bearer ${token}`);
      expect(odp.status, sciezka).toBe(200);
    }
  });
});

describe("⭐ tryb `tylko-odczyt` — dry-run tak, wysyłka nie", () => {
  let srodowisko: SrodowiskoTestowe;
  let atrapa: AtrapaSelly;
  let token: string;

  beforeEach(async () => {
    ({ srodowisko, atrapa, token } = await srodowiskoZTrybem("tylko-odczyt"));
  });

  afterEach(async () => {
    srodowisko.posprzataj();
  });

  it("`ping` przechodzi — Ania może sprawdzić połączenie", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/selly/ping")
      .set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(200);
  });

  it("`sync-supplier` z `dry_run: true` DZIAŁA i nic nie zapisuje", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/selly/sync-supplier")
      .set("Authorization", `Bearer ${token}`)
      .send({ dostawca: "MO9", dry_run: true });

    expect(odp.status).toBe(200);
    expect((odp.body as { dry_run?: boolean }).dry_run).toBe(true);

    // Ani jednego wywołania tworzącego/aktualizującego produkt.
    expect(atrapa.wywolania.filter((w) => /^(create|update|upsert|set)/.test(w.metoda))).toEqual(
      [],
    );
  });

  it("`sync-supplier` z `dry_run: false` NIE tworzy produktów", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/selly/sync-supplier")
      .set("Authorization", `Bearer ${token}`)
      .send({ dostawca: "MO9", dry_run: false });

    // Trasa łapie błędy per produkt i liczy je jako `failed` — więc odpowiada 200,
    // ale ZERO produktów zostało utworzonych. To jest właściwy dowód blokady.
    const cialo = odp.body as { created?: number; updated?: number; failed?: number };
    expect(cialo.created ?? 0).toBe(0);
    expect(cialo.updated ?? 0).toBe(0);
    expect(cialo.failed ?? 0).toBeGreaterThan(0);

    expect(atrapa.wywolania.filter((w) => /^(create|update|upsert|set)/.test(w.metoda))).toEqual(
      [],
    );
  });
});

describe("tryb `pelny` — zachowanie 1:1, nic nie blokuje", () => {
  it("`sync-supplier` z `dry_run: false` tworzy produkty jak dotąd", async () => {
    const { srodowisko, token } = await srodowiskoZTrybem("pelny");
    try {
      const odp = await request(srodowisko.app)
        .post("/api/selly/sync-supplier")
        .set("Authorization", `Bearer ${token}`)
        .send({ dostawca: "MO9", dry_run: false });

      expect(odp.status).toBe(200);
      const cialo = odp.body as { created?: number; updated?: number };
      expect((cialo.created ?? 0) + (cialo.updated ?? 0)).toBeGreaterThan(0);
    } finally {
      srodowisko.posprzataj();
    }
  });
});
