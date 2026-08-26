/**
 * GATE ODBUDOWY — Iteracja 3b (staging, odczyt).
 *
 * Ścieżki kontraktu w zakresie: GET /api/staging, /api/staging/paged, /api/staging/{id}.
 * Fixtures w zakresie: GET_staging.json, GET_staging_paged.json.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * Dane sieje `zasiejStagingZFixtures` — wprost z nagrań produkcji. Uzasadnienie tego
 * wyboru (i czego ten gate świadomie NIE dowodzi) jest w `test/gate/dane.ts` oraz
 * w plan.md D2: pola `typZmiany`/`powod`/`snapshotJson`/`ean*` produkuje `tk()`, którego
 * 3b nie portuje. Sprawdzamy więc całą warstwę odczytu, a nie produkcję danych.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  zasiejStagingZFixtures,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Pozycja z `GET_staging.json` — ta ma pełny zestaw pól, w tym `snapshotJson`. */
const ID_Z_PELNYM_SNAPSHOTEM = 710053;

describe("GATE — kontrakt i fixtures dla stagingu", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejStagingZFixtures(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/staging?limit=5 zwraca kształt 1:1 z contract/fixtures/GET_staging.json", async () => {
    const odp = await zAuth("/api/staging?limit=5");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/staging", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_staging.json", odp.body);
  });

  it("GET /api/staging/paged zwraca kształt 1:1 z contract/fixtures/GET_staging_paged.json", async () => {
    const odp = await zAuth("/api/staging/paged");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/staging/paged", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_staging_paged.json", odp.body);
  });

  /**
   * Niezmiennik, którego samo `porownajKsztalt` nie złapie: fixture ma po 5 pozycji, więc
   * pole obecne tylko w części z nich mogłoby się prześlizgnąć. Tu porównujemy KOMPLETNE
   * zbiory kluczy — i to one pilnują, że trzy kształty stagingu nie zaczną się zlewać
   * w jeden (24 / 20 / 21 pól, `repos/staging.ts`).
   */
  it("GET /api/staging — pozycja ma dokładnie te 24 klucze co fixture", async () => {
    const fixture = wczytajFixture("GET_staging.json");
    const wzorzec = (fixture.body as { items: Record<string, unknown>[] }).items[0];
    const oczekiwane = Object.keys(wzorzec ?? {}).sort();
    expect(oczekiwane).toHaveLength(24);

    const odp = await zAuth("/api/staging?limit=5");
    const items = (odp.body as { items: Record<string, unknown>[] }).items;

    expect(items.length).toBeGreaterThan(0);
    for (const pozycja of items) expect(Object.keys(pozycja).sort()).toEqual(oczekiwane);
  });

  it("GET /api/staging/paged — pozycja ma dokładnie te 20 kluczy co fixture", async () => {
    const fixture = wczytajFixture("GET_staging_paged.json");
    const wzorzec = (fixture.body as { items: Record<string, unknown>[] }).items[0];
    const oczekiwane = Object.keys(wzorzec ?? {}).sort();
    expect(oczekiwane).toHaveLength(20);

    const odp = await zAuth("/api/staging/paged");
    const items = (odp.body as { items: Record<string, unknown>[] }).items;

    expect(items.length).toBeGreaterThan(0);
    for (const pozycja of items) expect(Object.keys(pozycja).sort()).toEqual(oczekiwane);
  });

  /**
   * `GET /api/staging/{id}` nie ma fixtura — kształt bierzemy z oryginału
   * (`pagination_module.cjs:105-124`): zestaw `paged` PLUS `snapshotJson`, czyli 21 pól.
   * Tego nie da się wyprowadzić z `GET_staging.json`, bo tamten ma pola, których ten
   * kształt nie zwraca (`eanCandidates`, `magazynRaw`, `zatwierdzilUzytkownikId`).
   */
  it("GET /api/staging/{id} — 21 kluczy: zestaw z paged plus snapshotJson", async () => {
    const fixturePaged = wczytajFixture("GET_staging_paged.json");
    const wzorzecPaged = (fixturePaged.body as { items: Record<string, unknown>[] }).items[0];
    const oczekiwane = [...Object.keys(wzorzecPaged ?? {}), "snapshotJson"].sort();
    expect(oczekiwane).toHaveLength(21);

    const odp = await zAuth(`/api/staging/${ID_Z_PELNYM_SNAPSHOTEM}`);

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: `/api/staging/${ID_Z_PELNYM_SNAPSHOTEM}`,
      odpowiedz: odp,
    });
    expect(Object.keys(odp.body as Record<string, unknown>).sort()).toEqual(oczekiwane);
  });

  /** `snapshotJson` to STRING ze zserializowanym JSON-em, nie obiekt — tak jest w fixture. */
  it("snapshotJson jedzie jako string, nie jako rozpakowany obiekt", async () => {
    const odp = await zAuth(`/api/staging/${ID_Z_PELNYM_SNAPSHOTEM}`);
    const ciało = odp.body as { snapshotJson: unknown };

    expect(typeof ciało.snapshotJson).toBe("string");
    expect(() => JSON.parse(ciało.snapshotJson as string)).not.toThrow();
  });

  it("wszystkie trzy ścieżki istnieją w contract/openapi.yaml", async () => {
    const { wczytajKontrakt } = await import("./gate/kontrakt.js");
    const kontrakt = wczytajKontrakt();
    for (const sciezka of ["/api/staging", "/api/staging/paged", "/api/staging/42"]) {
      expect(kontrakt.znajdzOperacje("GET", sciezka), `brak ${sciezka}`).toBeDefined();
    }
  });

  /**
   * ODSTĘPSTWO ŚWIADOME (plan.md D1) utrwalone testem: kontrakt opisuje `GET /api/staging`
   * jako publiczne, my wymagamy auth. Test pilnuje, że to nadal decyzja, a nie przypadek.
   */
  it("GET /api/staging wymaga auth, choć kontrakt opisuje ją jako publiczną", async () => {
    const { wczytajKontrakt } = await import("./gate/kontrakt.js");
    expect(wczytajKontrakt().znajdzOperacje("GET", "/api/staging")?.wymagaAuth).toBe(false);

    for (const sciezka of ["/api/staging", "/api/staging/paged", "/api/staging/1"]) {
      const odp = await request(srodowisko.app).get(sciezka);
      expect(odp.status, `${sciezka} bez tokenu`).toBe(401);
    }
  });
});
