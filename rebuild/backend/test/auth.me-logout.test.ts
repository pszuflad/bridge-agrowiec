/** GET /api/me i POST /api/logout — backend-index.cjs:48175-48183. */
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NAZWA_COOKIE_SESJI } from "../src/auth/cookie.js";
import { podpiszToken } from "../src/auth/jwt.js";
import { SEKRET_TESTOWY, stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("GET /api/me", () => {
  let s: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    s = await stworzSrodowiskoTestowe();
    token = podpiszToken(s.uzytkownik, SEKRET_TESTOWY);
  });
  afterAll(() => s.posprzataj());

  it("401 bez tokenu", async () => {
    const odp = await request(s.app).get("/api/me");
    expect(odp.status).toBe(401);
    expect(odp.body).toEqual({ error: "Nieautoryzowany" });
  });

  it("401 dla tokenu podpisanego innym sekretem", async () => {
    const obcy = jwt.sign(s.uzytkownik, "zupelnie-inny-sekret", { expiresIn: "30d" });
    const odp = await request(s.app).get("/api/me").set("Authorization", `Bearer ${obcy}`);
    expect(odp.status).toBe(401);
  });

  it("401 dla tokenu wygasłego", async () => {
    const wygasly = jwt.sign(s.uzytkownik, SEKRET_TESTOWY, { expiresIn: "-1s" });
    const odp = await request(s.app).get("/api/me").set("Authorization", `Bearer ${wygasly}`);
    expect(odp.status).toBe(401);
  });

  it("401 dla śmieci w nagłówku i dla nagłówka bez prefiksu Bearer", async () => {
    for (const naglowek of ["Bearer nie-jest-jwt", token]) {
      const odp = await request(s.app).get("/api/me").set("Authorization", naglowek);
      expect(odp.status).toBe(401);
    }
  });

  it("200 z nagłówkiem Bearer", async () => {
    const odp = await request(s.app).get("/api/me").set("Authorization", `Bearer ${token}`);
    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject(s.uzytkownik);
  });

  it("200 z samym cookie bridge_session (bez nagłówka) — oba kanały działają równolegle", async () => {
    const odp = await request(s.app)
      .get("/api/me")
      .set("Cookie", `${NAZWA_COOKIE_SESJI}=${encodeURIComponent(token)}`);
    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject(s.uzytkownik);
  });

  it("nagłówek Bearer ma pierwszeństwo przed cookie", async () => {
    const inny = podpiszToken(
      { id: 999, email: "inny@example.test", imieNazwisko: "Ktoś Inny" },
      SEKRET_TESTOWY,
    );
    const odp = await request(s.app)
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", `${NAZWA_COOKIE_SESJI}=${encodeURIComponent(inny)}`);
    expect(odp.status).toBe(200);
    expect((odp.body as { id: number }).id).toBe(s.uzytkownik.id);
  });

  it("zwraca SUROWY payload JWT (z iat/exp), nie rekord z bazy", async () => {
    const odp = await request(s.app).get("/api/me").set("Authorization", `Bearer ${token}`);
    // Rekord z bazy miałby `utworzono`/`ostatnieLogowanie` i nie miałby `iat`/`exp`.
    expect(odp.body).toHaveProperty("iat");
    expect(odp.body).toHaveProperty("exp");
    expect(odp.body).not.toHaveProperty("utworzono");
    expect(odp.body).not.toHaveProperty("hasloHash");
  });
});

describe("POST /api/logout", () => {
  let s: SrodowiskoTestowe;

  beforeAll(async () => {
    s = await stworzSrodowiskoTestowe();
  });
  afterAll(() => s.posprzataj());

  it("zwraca {ok:true} i czyści cookie sesji", async () => {
    const odp = await request(s.app).post("/api/logout").send({});
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true });

    const setCookie = odp.headers["set-cookie"] as unknown as string[];
    const cookie = setCookie.find((c) => c.startsWith(`${NAZWA_COOKIE_SESJI}=`));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(new RegExp(`^${NAZWA_COOKIE_SESJI}=;`));
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    // Atrybuty muszą odpowiadać tym z ustawiania, inaczej przeglądarka nie nadpisze cookie.
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("działa bez zalogowania (trasa publiczna, jak w oryginale)", async () => {
    const odp = await request(s.app).post("/api/logout");
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true });
  });

  it("token pozostaje ważny po wylogowaniu — JWT jest bezstanowy (zachowanie oryginału)", async () => {
    const token = podpiszToken(s.uzytkownik, SEKRET_TESTOWY);
    await request(s.app).post("/api/logout");
    const odp = await request(s.app).get("/api/me").set("Authorization", `Bearer ${token}`);
    expect(odp.status).toBe(200);
  });
});
