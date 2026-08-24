/**
 * GATE ODBUDOWY — Iteracja 1a.
 *
 * Ścieżki kontraktu w zakresie: POST /api/login, POST /api/logout, GET /api/me.
 * Fixture w zakresie: contract/fixtures/GET_me.json.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CZAS_ZYCIA_TOKENA_SEK } from "../src/auth/jwt.js";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  type SrodowiskoTestowe,
} from "./gate/index.js";

describe("GATE — kontrakt i fixtures dla logowania", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  it("GET /api/me zwraca kształt 1:1 z contract/fixtures/GET_me.json", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/me", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_me.json", odp.body);
  });

  it("GET /api/me — niezmienniki fixture'a: dokładnie 5 pól i TTL tokenu 30 dni", async () => {
    const fixture = wczytajFixture("GET_me.json");
    const oczekiwaneKlucze = Object.keys(fixture.body as Record<string, unknown>).sort();
    expect(oczekiwaneKlucze).toEqual(["email", "exp", "iat", "id", "imieNazwisko"]);

    const odp = await request(srodowisko.app)
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`);
    const ciało = odp.body as { iat: number; exp: number };

    expect(Object.keys(ciało).sort()).toEqual(oczekiwaneKlucze);
    // Fixture nagrany z produkcji: exp - iat = 2592000 s (30 dni).
    const fixtureBody = fixture.body as { iat: number; exp: number };
    expect(fixtureBody.exp - fixtureBody.iat).toBe(CZAS_ZYCIA_TOKENA_SEK);
    expect(ciało.exp - ciało.iat).toBe(CZAS_ZYCIA_TOKENA_SEK);
  });

  /**
   * ROZJAZD KONTRAKT ↔ PRODUKCJA (opisany w plan.md, „Kontrakt i fixtures", pkt 1).
   *
   * `openapi.yaml:754-761` opisuje `GET /api/me` jako `security: []` z kodami 200/400 —
   * bo inwentarz 2.3 patrzył na to, czy operacja ma wpięty wspólny middleware `we`.
   * Oryginał chroni tę trasę ręcznym `if (!req.user)` (backend-index.cjs:48179-48183)
   * i realnie zwraca 401. WZORCEM JEST PRODUKCJA — odtwarzamy 401.
   *
   * Dlatego dla tej odpowiedzi NIE wołamy sprawdzZgodnoscZKontraktem: kontrakt nie
   * deklaruje 401 dla /api/me i nigdy nie deklarował. Rozjazd zgłoszony w raporcie,
   * do domknięcia przy odświeżeniu kontraktu (Iteracja 12 — audyt bezpieczeństwa).
   */
  it("GET /api/me bez tokenu — 401 jak produkcja (kontrakt tego kodu nie deklaruje)", async () => {
    const odp = await request(srodowisko.app).get("/api/me");
    expect(odp.status).toBe(401);
    expect(odp.body).toEqual({ error: "Nieautoryzowany" });

    const { wczytajKontrakt } = await import("./gate/kontrakt.js");
    const operacja = wczytajKontrakt().znajdzOperacje("GET", "/api/me");
    // Utrwalamy rozjazd, żeby odświeżenie kontraktu o kod 401 od razu tu zaświeciło.
    expect(operacja?.kody).not.toContain("401");
  });

  it("POST /api/login — zgodny z kontraktem (200 i 400)", async () => {
    const ok = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    expect(ok.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/login", odpowiedz: ok });

    const bledne = await request(srodowisko.app).post("/api/login").send({});
    expect(bledne.status).toBe(400);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/login", odpowiedz: bledne });
  });

  it("POST /api/logout — zgodny z kontraktem", async () => {
    const odp = await request(srodowisko.app).post("/api/logout").send({});
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/logout", odpowiedz: odp });
  });

  it("wszystkie trzy ścieżki iteracji istnieją w contract/openapi.yaml", async () => {
    const { wczytajKontrakt } = await import("./gate/kontrakt.js");
    const kontrakt = wczytajKontrakt();
    expect(kontrakt.znajdzOperacje("POST", "/api/login")).toBeDefined();
    expect(kontrakt.znajdzOperacje("POST", "/api/logout")).toBeDefined();
    expect(kontrakt.znajdzOperacje("GET", "/api/me")).toBeDefined();
  });
});
