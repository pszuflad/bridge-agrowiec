/**
 * GATE ODBUDOWY — Iteracja 4a (narzuty i promocje).
 *
 * Ścieżki kontraktu w zakresie: `/api/markups`, `/api/markups/{id}`, `/api/promotions`,
 * `/api/promotions/{id}` — po cztery metody na zasób, osiem operacji razem.
 * Fixtures w zakresie: `GET_markups.json`, `GET_promotions.json`.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * ⚠ ASYMETRIA SIŁY TEJ SIATKI, NAZWANA WPROST. `GET_markups.json` niesie jeden pełny wiersz,
 * więc dla narzutów gate jest twardy: porównujemy kształt 1:1 z nagraniem produkcji.
 * `GET_promotions.json` to PUSTA TABLICA — produkcja nie miała ani jednej promocji w chwili
 * nagrywania. Dla promocji gate dowodzi więc tylko dwóch rzeczy: że pusty katalog zwraca `[]`
 * z kodem 200 i że odpowiedź waliduje się względem kontraktu. Kształt WIERSZA promocji
 * sprawdzamy względem schematu (`PROMOCJA_TESTOWA`), i to jest słabsze świadectwo —
 * gdyby ktoś kiedyś nagrał niepustą odpowiedź, ten test trzeba przepisać na fixture.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PROMOCJA_TESTOWA,
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  wczytajKontrakt,
  zasiejNarzutyZFixtures,
  zasiejPromocjeTestowa,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Osiem operacji, które ta iteracja musi dowieźć. */
const OPERACJE: [string, string][] = [
  ["GET", "/api/markups"],
  ["POST", "/api/markups"],
  ["PATCH", "/api/markups/10"],
  ["DELETE", "/api/markups/10"],
  ["GET", "/api/promotions"],
  ["POST", "/api/promotions"],
  ["PATCH", "/api/promotions/1"],
  ["DELETE", "/api/promotions/1"],
];

describe("GATE — kontrakt i fixtures dla narzutów i promocji", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejNarzutyZFixtures(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/markups zwraca kształt 1:1 z contract/fixtures/GET_markups.json", async () => {
    const odp = await zAuth("/api/markups");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/markups", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_markups.json", odp.body);
  });

  /**
   * Niezmiennik, którego samo `porownajKsztalt` nie złapie przy jednoelementowej tablicy:
   * KOMPLETNY zbiór kluczy. Odpowiedź jest gołą tablicą, nie kopertą — to też jest kontrakt.
   */
  it("GET /api/markups — reguła ma dokładnie te 11 kluczy co fixture, w gołej tablicy", async () => {
    const fixture = wczytajFixture("GET_markups.json");
    const wzorzec = (fixture.body as Record<string, unknown>[])[0];
    const oczekiwane = Object.keys(wzorzec ?? {}).sort();
    expect(oczekiwane).toHaveLength(11);

    const odp = await zAuth("/api/markups");
    const reguly = odp.body as Record<string, unknown>[];

    expect(Array.isArray(reguly), "odpowiedź musi być gołą tablicą, nie kopertą").toBe(true);
    expect(reguly.length).toBeGreaterThan(0);
    for (const regula of reguly) expect(Object.keys(regula).sort()).toEqual(oczekiwane);
  });

  /**
   * `warunki` to STRING ze zserializowanym JSON-em, nie rozpakowana tablica — dokładnie jak
   * `snapshotJson` w stagingu. Silnik cen sam go parsuje (`repos/ceny.ts`), więc gdyby warstwa
   * odczytu zaczęła oddawać obiekt, kontrakt by się rozjechał, a formuła dalej działała.
   */
  it("warunki jadą jako string z JSON-em, nie jako rozpakowana tablica", async () => {
    const odp = await zAuth("/api/markups");
    const regula = (odp.body as { warunki: unknown }[])[0]!;

    expect(typeof regula.warunki).toBe("string");
    expect(() => JSON.parse(regula.warunki as string)).not.toThrow();
  });

  it("GET /api/promotions na pustej tabeli zwraca [] zgodnie z fixture", async () => {
    const odp = await zAuth("/api/promotions");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/promotions", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_promotions.json", odp.body);
    expect(odp.body).toEqual([]);
  });

  /**
   * Kształt wiersza promocji — ze SCHEMATU, nie z nagrania (patrz nota u góry pliku).
   * Osobne środowisko, żeby nie zabrudzić pustej tabeli, na której opiera się test wyżej.
   */
  it("GET /api/promotions z wierszem zwraca 11 kolumn ze schematu", async () => {
    const inne = await stworzSrodowiskoTestowe();
    try {
      zasiejPromocjeTestowa(inne.db);
      const logowanie = await request(inne.app)
        .post("/api/login")
        .send({ email: inne.dane.email, password: inne.dane.haslo });
      const odp = await request(inne.app)
        .get("/api/promotions")
        .set("Authorization", `Bearer ${(logowanie.body as { token: string }).token}`);

      expect(odp.status).toBe(200);
      const promocje = odp.body as Record<string, unknown>[];
      expect(promocje).toHaveLength(1);
      expect(Object.keys(promocje[0]!).sort()).toEqual(Object.keys(PROMOCJA_TESTOWA).sort());
      expect(promocje[0]).toEqual({ ...PROMOCJA_TESTOWA });
    } finally {
      inne.posprzataj();
    }
  });

  it("wszystkie osiem operacji istnieje w contract/openapi.yaml", () => {
    const kontrakt = wczytajKontrakt();
    for (const [metoda, sciezka] of OPERACJE) {
      expect(kontrakt.znajdzOperacje(metoda, sciezka), `brak ${metoda} ${sciezka}`).toBeDefined();
    }
  });

  /**
   * ODSTĘPSTWO ŚWIADOME (D1 z I1): kontrakt ma przy obu `GET`-ach `security: []`, bo produkcja
   * wystawia je publicznie. Odbudowa stawia `requireAuth` na wszystkich trasach danych —
   * ten test pilnuje, że decyzja obowiązuje na KAŻDEJ z ośmiu operacji, a nie tylko tam,
   * gdzie ktoś pamiętał ją dopisać.
   */
  it("wszystkie osiem operacji wymaga tokenu (401 bez niego)", async () => {
    for (const [metoda, sciezka] of OPERACJE) {
      const zapytanie = request(srodowisko.app) as unknown as Record<
        string,
        (s: string) => request.Test
      >;
      const odp = await zapytanie[metoda.toLowerCase()]!(sciezka).send({});
      expect(odp.status, `${metoda} ${sciezka} bez tokenu`).toBe(401);
    }
  });
});
