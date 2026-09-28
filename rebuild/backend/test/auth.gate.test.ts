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
   * ROZJAZD KONTRAKT ↔ PRODUKCJA — DOMKNIĘTY 2026-09-08 (ticket 38, sesja 12d).
   *
   * Kontrakt 2.3 opisywał `GET /api/me` jako `security: []` z kodami 200/400 — bo inwentarz
   * patrzył na to, czy operacja ma wpięty wspólny middleware `we`. Oryginał chroni tę trasę
   * ręcznym `if (!req.user)` (`backend-index.cjs:48179-48183`) i realnie zwraca 401.
   * Do tego ticketu ten test UTRWALAŁ rozjazd (`expect(kody).not.toContain("401")`), żeby
   * odświeżenie kontraktu od razu tu zaświeciło — i zaświeciło.
   *
   * ⭐ 401 nie zostało wpisane „bo tak działa nasz backend". Zmierzone na URUCHOMIONYM
   * ORYGINALE postawionym na kopii bazy: `GET /api/me` bez tokenu → 401. Ta sama próba
   * pokazała, że pozostałe 14 tras z `security: []`, które odbudowa chroni, produkcja
   * realnie oddaje BEZ logowania — dlatego u nich `401` niesie adnotację `x-odbudowa-auth`,
   * a tutaj nie: tu 401 to produkcja, nie nasze odstępstwo.
   */
  it("GET /api/me bez tokenu — 401 jak produkcja, teraz też zadeklarowane w kontrakcie", async () => {
    const odp = await request(srodowisko.app).get("/api/me");
    expect(odp.status).toBe(401);
    expect(odp.body).toEqual({ error: "Nieautoryzowany" });

    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/me", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_me_401.json", odp.body);

    const { wczytajKontrakt } = await import("./gate/kontrakt.js");
    const operacja = wczytajKontrakt().znajdzOperacje("GET", "/api/me");
    expect(operacja?.kody).toContain("401");
    // `security` ZOSTAJE puste: kontrakt opisuje produkcję, a produkcja nie ma tu middleware'u
    // auth — 401 bierze się z ręcznego sprawdzenia w handlerze (D4).
    expect(operacja?.wymagaAuth).toBe(false);
  });

  it("POST /api/login — zgodny z kontraktem (200 i 400)", async () => {
    const ok = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    expect(ok.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/login", odpowiedz: ok });
    sprawdzZgodnoscZFixture("POST_login.json", ok.body);

    const bledne = await request(srodowisko.app).post("/api/login").send({});
    expect(bledne.status).toBe(400);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/login", odpowiedz: bledne });
  });

  /**
   * 401 przy ZŁYM HAŚLE to inny przypadek niż 400 przy braku pól — i kontrakt 2.3 nie
   * deklarował go wcale. Kod dopisany w tym tickecie na podstawie nagrania z oryginału,
   * nie z naszego backendu.
   */
  it("POST /api/login ze złym hasłem — 401 z kształtem 1:1 z nagrania oryginału", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: "zdecydowanie-nie-to-haslo" });

    expect(odp.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/login", odpowiedz: odp });
    sprawdzZgodnoscZFixture("POST_login_401.json", odp.body);
  });

  it("POST /api/logout — zgodny z kontraktem", async () => {
    const odp = await request(srodowisko.app).post("/api/logout").send({});
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/logout", odpowiedz: odp });
    sprawdzZgodnoscZFixture("POST_logout.json", odp.body);
  });

  it("wszystkie trzy ścieżki iteracji istnieją w contract/openapi.yaml", async () => {
    const { wczytajKontrakt } = await import("./gate/kontrakt.js");
    const kontrakt = wczytajKontrakt();
    expect(kontrakt.znajdzOperacje("POST", "/api/login")).toBeDefined();
    expect(kontrakt.znajdzOperacje("POST", "/api/logout")).toBeDefined();
    expect(kontrakt.znajdzOperacje("GET", "/api/me")).toBeDefined();
  });
});
