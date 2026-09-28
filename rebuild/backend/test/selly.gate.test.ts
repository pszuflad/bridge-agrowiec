/**
 * GATE ODBUDOWY — Iteracja 8, blok 8a: panel Selly (dziesięć tras).
 *
 * Ścieżki kontraktu w zakresie: `/api/selly/{ping,dictionaries,status,log,csv-status}` (GET)
 * oraz `/api/selly/{producers,categories,sync-product,sync-supplier,generate-csv}` (POST) —
 * `contract/openapi.yaml:914-1018`.
 *
 * Fixtures w zakresie: PIĘĆ — `GET_selly_{status,ping,csv-status,log,dictionaries}.json`.
 *
 * ⚠ ROZKŁAD METOD JEST 5 GET + 5 POST, nie 7 + 3. Roadmapa i prompt sesji 8a wymieniały
 * `categories` i `producers` wśród GET-ów; oryginał (`mirror/backend/selly/routes.cjs:115,128`)
 * i kontrakt (`openapi.yaml:914,974`) mówią jednoznacznie POST. Sprostowane przy tym tickecie.
 *
 * ⚠ DLA PIĘCIU TRAS NIE MA I NIE BĘDZIE FIXTURE'A — i to nie jest obejście gate'a.
 * `producers`, `categories`, `sync-product`, `sync-supplier` to MUTACJE wołające zewnętrzne
 * API Selly; nagrywarka ich nie ruszała, bo każde nagranie zmieniałoby cudzy sklep.
 * `generate-csv` pisze plik na dysku serwera. Siatką dla nich jest kontrakt + zachowanie
 * na atrapie klienta (`test/gate/selly-atrapa.ts`) + osobne testy w
 * `selly.synchronizacja.test.ts`.
 *
 * ⚠ CZEGO ODPOWIEDZI MIEĆ NIE MOGĄ: klucza `_przyciete`. Jest w dwóch fixture'ach
 * (`status`, `log`), ale jako adnotacja nagrywarki mówiąca „przycięto do 5 z N"
 * (`contract/README.md:29`), nie jako pole API.
 */
import { existsSync } from "node:fs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { KOMUNIKAT_BRAK_KONFIGURACJI } from "./gate/selly-atrapa.js";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzAtrapeBezKonfiguracji,
  stworzAtrapeSelly,
  stworzSrodowiskoTestowe,
  zasiejDostawcow,
  zasiejLogSellyZFixtures,
  zasiejMapySelly,
  zasiejProdukty,
  type AtrapaSelly,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Wszystkie dziesięć tras panelu — używane przez test 401 i przez rachunek pokrycia. */
const TRASY_SELLY = [
  { metoda: "GET" as const, sciezka: "/api/selly/ping" },
  { metoda: "GET" as const, sciezka: "/api/selly/dictionaries" },
  { metoda: "GET" as const, sciezka: "/api/selly/status" },
  { metoda: "GET" as const, sciezka: "/api/selly/log" },
  { metoda: "GET" as const, sciezka: "/api/selly/csv-status" },
  { metoda: "POST" as const, sciezka: "/api/selly/producers" },
  { metoda: "POST" as const, sciezka: "/api/selly/categories" },
  { metoda: "POST" as const, sciezka: "/api/selly/sync-product" },
  { metoda: "POST" as const, sciezka: "/api/selly/sync-supplier" },
  { metoda: "POST" as const, sciezka: "/api/selly/generate-csv" },
];

describe("GATE — panel Selly (blok 8a)", () => {
  let srodowisko: SrodowiskoTestowe;
  let atrapa: AtrapaSelly;
  let token: string;

  beforeAll(async () => {
    atrapa = stworzAtrapeSelly();
    srodowisko = await stworzSrodowiskoTestowe(undefined, { klientSelly: atrapa.klient });
    zasiejProdukty(srodowisko.db);
    zasiejDostawcow(srodowisko.db);
    zasiejLogSellyZFixtures(srodowisko.db);
    zasiejMapySelly(srodowisko.db);

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

  describe("fixtures — kształt 1:1 z nagraniem produkcji", () => {
    it("GET /api/selly/status", async () => {
      const odp = await zAuth("/api/selly/status");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "GET",
        sciezka: "/api/selly/status",
        odpowiedz: odp,
      });
      sprawdzZgodnoscZFixture("GET_selly_status.json", odp.body);
    });

    it("GET /api/selly/ping", async () => {
      const odp = await zAuth("/api/selly/ping");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/selly/ping", odpowiedz: odp });
      sprawdzZgodnoscZFixture("GET_selly_ping.json", odp.body);
    });

    it("GET /api/selly/log", async () => {
      const odp = await zAuth("/api/selly/log");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/selly/log", odpowiedz: odp });
      sprawdzZgodnoscZFixture("GET_selly_log.json", odp.body);
    });

    it("GET /api/selly/dictionaries", async () => {
      const odp = await zAuth("/api/selly/dictionaries");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "GET",
        sciezka: "/api/selly/dictionaries",
        odpowiedz: odp,
      });
      sprawdzZgodnoscZFixture("GET_selly_dictionaries.json", odp.body);
    });

    /**
     * `csv-status` opisuje PLIK, więc żeby porównać go z fixture'em, plik musi istnieć.
     * Generujemy go tą samą trasą, którą klika operator — dzięki temu jeden test pokrywa
     * obie: `generate-csv` tworzy, `csv-status` opisuje.
     *
     * ⚠ Odpowiedź „brak pliku" ma INNY, PIĘCIOKLUCZOWY kształt (`routes.cjs:303-305`);
     * fixture zamraża wariant z plikiem, więc bez wygenerowania test porównywałby dwa różne
     * kształty i zapalałby się na sześciu brakujących kluczach.
     */
    it("GET /api/selly/csv-status — po wygenerowaniu pliku", async () => {
      const wygenerowanie = await postZAuth("/api/selly/generate-csv");
      expect(wygenerowanie.status).toBe(200);

      const odp = await zAuth("/api/selly/csv-status");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "GET",
        sciezka: "/api/selly/csv-status",
        odpowiedz: odp,
      });
      sprawdzZgodnoscZFixture("GET_selly_csv-status.json", odp.body);
    });
  });

  describe("kontrakt — trasy bez fixture'a", () => {
    /**
     * Trzy produkty testowe są aktywne, ale żaden nie przechodzi walidacji payloadu:
     * marka „BKT"/„ALLIANCE" jest w słowniku, natomiast `MO9_336320` ma zastosowanie
     * „Ciągnik" → kategoria 11, więc payload jest kompletny i idzie do Selly. Sprawdzamy
     * ścieżkę udaną — 200 i zgodność z kontraktem.
     */
    it("POST /api/selly/sync-product", async () => {
      const odp = await postZAuth("/api/selly/sync-product").send({ kod: "MO9_336320" });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-product",
        odpowiedz: odp,
      });
      expect(odp.body).toMatchObject({ action: "created", kod: "MO9_336320" });
    });

    it("POST /api/selly/sync-supplier (dry_run — nie dotyka Selly)", async () => {
      const przed = atrapa.liczba("createProduct") + atrapa.liczba("updateProduct");
      const odp = await postZAuth("/api/selly/sync-supplier").send({
        dostawca: "MO9",
        dry_run: true,
      });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/sync-supplier",
        odpowiedz: odp,
      });
      expect(atrapa.liczba("createProduct") + atrapa.liczba("updateProduct")).toBe(przed);
    });

    it("POST /api/selly/producers", async () => {
      const odp = await postZAuth("/api/selly/producers").send({ name: "Testowa Marka" });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/producers",
        odpowiedz: odp,
      });
    });

    it("POST /api/selly/categories", async () => {
      const odp = await postZAuth("/api/selly/categories").send({ name: "Testowa Kategoria" });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/categories",
        odpowiedz: odp,
      });
    });

    it("POST /api/selly/generate-csv — plik trafia na dysk", async () => {
      const odp = await postZAuth("/api/selly/generate-csv");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/selly/generate-csv",
        odpowiedz: odp,
      });
      expect(odp.body).toMatchObject({ ok: true });
      expect(existsSync(`${srodowisko.katalogCsvSelly}/${srodowisko.env.SELLY_CSV_PLIK}`)).toBe(
        true,
      );
    });
  });

  describe("adnotacje nagrywarki i autoryzacja", () => {
    it("żadna z pięciu odpowiedzi GET nie niesie `_przyciete`", async () => {
      // `_przyciete` jest w `GET_selly_status.json` i `GET_selly_log.json` (mówi, że nagranie
      // przycięto do 5 z, odpowiednio, 9 i 13 wierszy). To adnotacja pliku, nie pole API —
      // gdyby wyszła w odpowiedzi, frontend dostałby klucz, którego produkcja nie wysyła.
      for (const sciezka of [
        "/api/selly/status",
        "/api/selly/log",
        "/api/selly/ping",
        "/api/selly/dictionaries",
        "/api/selly/csv-status",
      ]) {
        const odp = await zAuth(sciezka);
        const klucze = Object.keys(odp.body as Record<string, unknown>);
        expect(klucze, `${sciezka} ma klucz techniczny nagrywarki`).not.toContain("_przyciete");
      }
    });

    it("wszystkie dziesięć tras oddaje 401 bez tokenu", async () => {
      for (const { metoda, sciezka } of TRASY_SELLY) {
        const odp =
          metoda === "GET"
            ? await request(srodowisko.app).get(sciezka)
            : await request(srodowisko.app).post(sciezka).send({});

        expect(odp.status, `${metoda} ${sciezka}`).toBe(401);
        expect(odp.body).toEqual({ error: "Nieautoryzowany" });
        sprawdzZgodnoscZKontraktem({ metoda, sciezka, odpowiedz: odp });
      }
    });
  });

  describe("walidacja ciała — komunikaty verbatim z oryginału", () => {
    it('POST /api/selly/producers bez `name` → 400 „Brak name”', async () => {
      const odp = await postZAuth("/api/selly/producers").send({});
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ error: "Brak name" });
    });

    it('POST /api/selly/categories bez `name` → 400 „Brak name”', async () => {
      const odp = await postZAuth("/api/selly/categories").send({});
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ error: "Brak name" });
    });

    it('POST /api/selly/sync-product bez `kod` → 400 „Brak "kod""', async () => {
      const odp = await postZAuth("/api/selly/sync-product").send({});
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ error: 'Brak "kod"' });
    });

    it("POST /api/selly/sync-product z nieznanym kodem → 404", async () => {
      const odp = await postZAuth("/api/selly/sync-product").send({ kod: "NIE_MA_TAKIEGO" });
      expect(odp.status).toBe(404);
      expect(odp.body).toEqual({ error: "Nie znaleziono produktu NIE_MA_TAKIEGO" });
    });

    it("POST /api/selly/sync-product dla produktu nieaktywnego → 400 z jego statusem", async () => {
      // MO1_100001 ma w `PRODUKTY_TESTOWE` status „wstrzymany".
      const odp = await postZAuth("/api/selly/sync-product").send({ kod: "MO1_100001" });
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({
        error: 'Produkt MO1_100001 ma status "wstrzymany" — nie może być wysłany do Selly',
      });
    });

    it('POST /api/selly/sync-supplier bez `dostawca` → 400 „Brak "dostawca""', async () => {
      const odp = await postZAuth("/api/selly/sync-supplier").send({});
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ error: 'Brak "dostawca" (np. "MO1")' });
    });

    /**
     * MO2_200002 ma kategorię „Przyczepy", której nie ma w `selly_kategoria_norm_map`,
     * i zastosowanie „Forwarder", którego nie ma w mapie zastosowań. Payload wychodzi więc
     * bez `category_id` i walidacja go odrzuca — 400 z `details` i całym payloadem,
     * dokładnie jak `routes.cjs:159`.
     */
    it('POST /api/selly/sync-product z niemapowalną kategorią → 400 „Walidacja” z details', async () => {
      const odp = await postZAuth("/api/selly/sync-product").send({ kod: "MO2_200002" });

      expect(odp.status).toBe(400);
      const cialo = odp.body as { error: string; details: string[]; payload: unknown };
      expect(cialo.error).toBe("Walidacja");
      expect(cialo.details).toContain("Brak category_id (nieznana kategoria)");
      expect(cialo.payload).toBeDefined();
    });
  });
});

/**
 * Środowisko bez sekretów `SELLY_*` — sześć tras zewnętrznych ma oddać 500 z komunikatem
 * `assertConfig()`, a cztery lokalne działać normalnie (plan.md D6, 1:1 z produkcją).
 *
 * To jest realny stan stagingu i każdego środowiska deweloperskiego: sekretów do cudzego
 * sklepu tam nie ma i nie będzie. Panel z 8b musi ten przypadek obsłużyć.
 */
describe("GATE — panel Selly bez konfiguracji Selly (blok 8a)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe(undefined, {
      klientSelly: stworzAtrapeBezKonfiguracji(),
    });
    zasiejProdukty(srodowisko.db);
    zasiejLogSellyZFixtures(srodowisko.db);

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

  it("sześć tras zewnętrznych oddaje 500 z komunikatem o braku konfiguracji", async () => {
    const odpowiedzi = [
      await zAuth("/api/selly/ping"),
      await zAuth("/api/selly/dictionaries"),
      await postZAuth("/api/selly/producers").send({ name: "X" }),
      await postZAuth("/api/selly/categories").send({ name: "X" }),
      await postZAuth("/api/selly/sync-product").send({ kod: "MO9_336320" }),
      await postZAuth("/api/selly/sync-supplier").send({ dostawca: "MO9" }),
    ];

    for (const odp of odpowiedzi) {
      expect(odp.status).toBe(500);
      expect((odp.body as { error: string }).error).toBe(KOMUNIKAT_BRAK_KONFIGURACJI);
    }
  });

  it("cztery trasy lokalne działają mimo braku konfiguracji Selly", async () => {
    expect((await zAuth("/api/selly/status")).status).toBe(200);
    expect((await zAuth("/api/selly/log")).status).toBe(200);
    expect((await zAuth("/api/selly/csv-status")).status).toBe(200);
    expect((await postZAuth("/api/selly/generate-csv")).status).toBe(200);
  });

  /**
   * Nieudana synchronizacja dostawcy MUSI domknąć wpis w dzienniku statusem `blad`
   * (`routes.cjs:245-246`). Bez tego wiersz zostaje na zawsze w `w_trakcie` i panel
   * pokazuje trwającą operację, której nikt już nie prowadzi.
   */
  it("padnięta sync-supplier zamyka wpis w dzienniku statusem `blad`", async () => {
    await postZAuth("/api/selly/sync-supplier").send({ dostawca: "MO9" });

    const log = await zAuth("/api/selly/log");
    const najnowszy = (log.body as { items: { status: string; dostawca_kod: string }[] }).items[0];
    expect(najnowszy?.status).toBe("blad");
    expect(najnowszy?.dostawca_kod).toBe("MO9");
  });
});
