/**
 * GATE ODBUDOWY — Iteracja 10, blok 10d (analityka dostawców).
 *
 * Ścieżki kontraktu w zakresie: `GET /api/analytics/suppliers/{stability,lifecycle,stock}`
 * oraz `GET /api/analytics/dostawcy-stats` — cztery operacje.
 * Fixtures w zakresie: `GET_analytics_suppliers_{stability,lifecycle,stock}.json`
 * i `GET_analytics_dostawcy-stats.json`.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * ⚠ SIŁA TEJ SIATKI — ta sama asymetria co w 10a. `contract/openapi.yaml` nie ma dla ŻADNEJ
 * trasy analityki schematu odpowiedzi (`:115-125`, `:297-323` — same `200/400/401` i `security`),
 * więc `sprawdzZgodnoscZKontraktem` dowodzi tu wyłącznie, że ścieżka i metoda istnieją, status
 * jest zadeklarowany, a ciało jest JSON-em. Cały ciężar kształtu niosą cztery nagrania GET.
 *
 * ⚠ CZEGO TEN GATE NIE DOWODZI — GAŁĘZI ZAPASOWEJ `suppliers/stability`. Fixture nagrano przy
 * `hasHistory: true`, a handler ma DRUGĄ gałąź (pusta `historia_cen`) o INNYM zestawie kolumn
 * (`produkty`, `sredniaCena`, `sredniStan` zamiast `punkty`). Żaden fixture jej nie pokrywa,
 * bo produkcja od dawna ma historię. Pokrywa ją test jednostkowy w
 * `analityka.dostawcy.agregaty.test.ts` — gdyby kiedyś zniknął, ta gałąź zostaje bez świadka.
 *
 * ⚠ TRZY KSZTAŁTY KOPERTY W JEDNYM BLOKU, i to jest zamierzone (ściąga §3):
 * `{hasHistory, rows}` dla `stability`, `{rows}` dla `lifecycle`/`stock`, a `dostawcy-stats`
 * zwraca GOŁĄ TABLICĘ bez koperty. Ostatnie jest łatwe do przeoczenia przy kopiowaniu testu.
 *
 * ⚠ CZEGO ODPOWIEDŹ MIEĆ NIE MOŻE: klucza `_przyciete`. W trzech z czterech fixtures on jest,
 * ale jako adnotacja NAGRYWARKI (`contract/README.md:29`), nie pole produkcji. Harness pomija
 * klucze na `_` po stronie fixture'a, a klucz nadmiarowy po stronie ODPOWIEDZI zgłasza jako
 * różnicę (`gate/ksztalt.ts:69-76`) — plus asercja wprost niżej, żeby powód był czytelny.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  zasiejHistorieCen,
  zasiejProdukty,
  zasiejStagingZFixtures,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Cztery operacje, które ten blok musi dowieźć. */
const OPERACJE: [string, string][] = [
  ["GET", "/api/analytics/suppliers/stability"],
  ["GET", "/api/analytics/suppliers/lifecycle"],
  ["GET", "/api/analytics/suppliers/stock"],
  ["GET", "/api/analytics/dostawcy-stats"],
];

describe("GATE — kontrakt i fixtures dla analityki dostawców (blok 10d)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    // Trzy źródła, po jednym na kształt: katalog (`stock`, `dostawcy-stats`), staging
    // (`lifecycle`) i historia cen (`stability` — gałąź `hasHistory: true`, ta z fixture'a).
    zasiejProdukty(srodowisko.db);
    zasiejStagingZFixtures(srodowisko.db);
    zasiejHistorieCen(srodowisko.db);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/analytics/suppliers/stability zwraca kształt 1:1 z contract/fixtures/GET_analytics_suppliers_stability.json", async () => {
    const odp = await zAuth("/api/analytics/suppliers/stability");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/suppliers/stability",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_suppliers_stability.json", odp.body);

    // Zasiew ma historię, więc to gałąź `hasHistory: true` — ta, którą nagrano.
    expect((odp.body as { hasHistory: boolean }).hasHistory).toBe(true);
  });

  it("GET /api/analytics/suppliers/lifecycle zwraca kształt 1:1 z contract/fixtures/GET_analytics_suppliers_lifecycle.json", async () => {
    const odp = await zAuth("/api/analytics/suppliers/lifecycle");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/suppliers/lifecycle",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_suppliers_lifecycle.json", odp.body);

    // Fixture nagrano na niepustej liście, więc porównanie kształtu wiersza ma sens tylko
    // wtedy, gdy nasz zasiew też coś zwrócił. `GET_staging*.json` niosą pozycje `wycofana`.
    expect((odp.body as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
  });

  it("GET /api/analytics/suppliers/stock zwraca kształt 1:1 z contract/fixtures/GET_analytics_suppliers_stock.json", async () => {
    const odp = await zAuth("/api/analytics/suppliers/stock");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/suppliers/stock",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_suppliers_stock.json", odp.body);
  });

  it("GET /api/analytics/dostawcy-stats zwraca GOŁĄ TABLICĘ 1:1 z contract/fixtures/GET_analytics_dostawcy-stats.json", async () => {
    const odp = await zAuth("/api/analytics/dostawcy-stats");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/dostawcy-stats",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_dostawcy-stats.json", odp.body);

    // Koperty nie ma i być nie może — to alias zgodności, a nie trasa dashboardu.
    expect(Array.isArray(odp.body)).toBe(true);
  });

  it("żadna z czterech odpowiedzi nie zawiera `_przyciete` — to adnotacja nagrywarki, nie pole API", async () => {
    const [stability, lifecycle, stock] = await Promise.all([
      zAuth("/api/analytics/suppliers/stability"),
      zAuth("/api/analytics/suppliers/lifecycle"),
      zAuth("/api/analytics/suppliers/stock"),
    ]);

    // Asercja wprost, a nie tylko przez gate: gdyby ktoś kiedyś „dorobił" to pole pod fixture,
    // ma tu zobaczyć zdanie z uzasadnieniem, a nie zagadkową różnicę kształtu.
    expect(Object.keys(stability.body as object)).toEqual(["hasHistory", "rows"]);
    expect(Object.keys(lifecycle.body as object)).toEqual(["rows"]);
    expect(Object.keys(stock.body as object)).toEqual(["rows"]);
  });

  it.each(OPERACJE)("%s %s bez tokenu zwraca 401", async (metoda, sciezka) => {
    const odp = await request(srodowisko.app).get(sciezka);

    expect(odp.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda, sciezka, odpowiedz: odp });
  });
});
