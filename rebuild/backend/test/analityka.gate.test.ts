/**
 * GATE ODBUDOWY — Iteracja 10, blok 10a (fundament analityki).
 *
 * Ścieżki kontraktu w zakresie: `GET /api/analytics/filters`, `/status`, `/kpi`, `/margins`
 * oraz `POST /api/analytics/bootstrap-current` — pięć operacji.
 * Fixtures w zakresie: `GET_analytics_{filters,status,kpi,margins}.json`.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * ⚠ ASYMETRIA SIŁY TEJ SIATKI, NAZWANA WPROST — dwie warstwy, obie słabsze niż zwykle.
 *
 * 1. KONTRAKT. `contract/openapi.yaml` nie ma dla ŻADNEJ trasy analityki schematu odpowiedzi
 *    (`responses: {200, 400, 401}` i tyle — patrz `:103-114`, `:189-197`, `:207-215`, `:225-233`).
 *    `sprawdzZgodnoscZKontraktem` dowodzi tu więc wyłącznie, że ścieżka i metoda istnieją,
 *    status jest zadeklarowany, a ciało jest JSON-em. O kształcie nie mówi nic.
 *
 * 2. FIXTURES. Cały ciężar kształtu spoczywa na czterech nagraniach GET. Dla
 *    `POST /api/analytics/bootstrap-current` fixture'a NIE MA i mieć nie będzie w tej fazie
 *    (`contract/README.md:38` — metod zapisujących nie nagrywano, bo modyfikowałyby produkcję).
 *    Ta trasa ma tu wyłącznie dowód „istnieje, wymaga auth, zwraca 200/JSON"; jej semantykę
 *    — łącznie z NIEIDEMPOTENTNOŚCIĄ — pokrywa `analityka.agregaty.test.ts`.
 *
 * ⚠ TRZECIA SŁABOŚĆ, TYM RAZEM W ŚRODKU FIXTURE'A. `GET_analytics_margins.json` ma `low` i `high`
 * jako PUSTE TABLICE, bo w chwili nagrywania cały katalog produkcji mieścił się w marży (5, 80).
 * Harness nie sprawdza kształtu elementów pustej tablicy (`gate/ksztalt.ts:50`), więc kształt
 * wiersza `low`/`high` NIE jest tu dowiedziony niczym — robi to test jednostkowy progów.
 * Gdyby ktoś kiedyś nagrał niepustą odpowiedź, ten test trzeba wzmocnić.
 *
 * ⚠ CZEGO ODPOWIEDŹ MIEĆ NIE MOŻE: klucza `_przyciete`. W fixtures on jest, ale jako adnotacja
 * NAGRYWARKI (`contract/README.md:29`), nie pole produkcji. Harness pomija klucze na `_` po
 * stronie fixture'a, a klucz nadmiarowy po stronie ODPOWIEDZI zgłasza jako różnicę
 * (`gate/ksztalt.ts:69-76`) — czyli ten gate sam pilnuje, żebyśmy go nie dorobili.
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

/** Pięć operacji, które ten blok musi dowieźć. */
const OPERACJE: [string, string][] = [
  ["GET", "/api/analytics/filters"],
  ["GET", "/api/analytics/status"],
  ["GET", "/api/analytics/kpi"],
  ["GET", "/api/analytics/margins"],
  ["POST", "/api/analytics/bootstrap-current"],
];

describe("GATE — kontrakt i fixtures dla analityki (blok 10a)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    // Trzy źródła, z których liczą się wszystkie cztery odpowiedzi GET:
    // katalog (filtry, KPI, marże), staging (`stagingPending`) i historia cen (`status`).
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

  it("GET /api/analytics/filters zwraca kształt 1:1 z contract/fixtures/GET_analytics_filters.json", async () => {
    const odp = await zAuth("/api/analytics/filters");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/filters",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_filters.json", odp.body);
  });

  it("GET /api/analytics/filters NIE zwraca `_przyciete` — to adnotacja nagrywarki, nie pole API", async () => {
    const odp = await zAuth("/api/analytics/filters");

    // Asercja wprost, a nie tylko przez gate: gdyby ktoś kiedyś „dorobił" to pole pod fixture,
    // ma tu zobaczyć zdanie z uzasadnieniem, a nie zagadkową różnicę kształtu.
    expect(Object.keys(odp.body as object)).toEqual([
      "dostawcy",
      "marki",
      "modele",
      "rozmiary",
      "indeksyNosnosci",
      "indeksyPredkosci",
    ]);
  });

  it("GET /api/analytics/status zwraca kształt 1:1 z contract/fixtures/GET_analytics_status.json", async () => {
    const odp = await zAuth("/api/analytics/status");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/status",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_status.json", odp.body);
  });

  it("GET /api/analytics/kpi zwraca kształt 1:1 z contract/fixtures/GET_analytics_kpi.json", async () => {
    const odp = await zAuth("/api/analytics/kpi");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/analytics/kpi", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_analytics_kpi.json", odp.body);
  });

  it("GET /api/analytics/margins zwraca kształt 1:1 z contract/fixtures/GET_analytics_margins.json", async () => {
    const odp = await zAuth("/api/analytics/margins");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/margins",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_margins.json", odp.body);
  });

  it("POST /api/analytics/bootstrap-current waliduje się wg kontraktu (brak fixture'a dla metod zapisujących)", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/analytics/bootstrap-current")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "POST",
      sciezka: "/api/analytics/bootstrap-current",
      odpowiedz: odp,
    });
    expect(odp.body).toMatchObject({ ok: true, inserted: expect.any(Number) as number });
  });

  it.each(OPERACJE)("%s %s bez tokenu zwraca 401", async (metoda, sciezka) => {
    const odp =
      metoda === "POST"
        ? await request(srodowisko.app).post(sciezka).send({})
        : await request(srodowisko.app).get(sciezka);

    expect(odp.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda, sciezka, odpowiedz: odp });
  });
});
