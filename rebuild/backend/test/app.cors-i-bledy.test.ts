/** CORS z allowlisty (plan.md O3) i obsługa błędów aplikacji. */
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { wczytajEnv } from "../src/config/env.js";
import { stworzApp } from "../src/app.js";
import { SEKRET_TESTOWY, stworzSrodowiskoTestowe, stworzTestowaBaze } from "./gate/index.js";

function appZOriginami(origins: string, sciezkaBazy: string) {
  const env = wczytajEnv({
    NODE_ENV: "test",
    DB_PATH: sciezkaBazy,
    JWT_SECRET: SEKRET_TESTOWY,
    CORS_ORIGINS: origins,
  } as NodeJS.ProcessEnv);
  return { env, stworz: (db: Parameters<typeof stworzApp>[0]["db"]) => stworzApp({ env, db }) };
}

describe("CORS", () => {
  it("domyślnie NIE odbija żadnego Origin (odstępstwo O3 od oryginału)", async () => {
    const s = await stworzSrodowiskoTestowe();
    try {
      const odp = await request(s.app).get("/api/health").set("Origin", "https://zlosliwa.example");
      expect(odp.headers["access-control-allow-origin"]).toBeUndefined();
      expect(odp.headers["access-control-allow-credentials"]).toBeUndefined();
    } finally {
      s.posprzataj();
    }
  });

  it("odbija wyłącznie Origin z allowlisty", async () => {
    const baza = stworzTestowaBaze();
    try {
      const { stworz } = appZOriginami("http://localhost:5173", baza.sciezka);
      const app = stworz(baza.db);

      const dozwolony = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
      expect(dozwolony.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(dozwolony.headers["access-control-allow-credentials"]).toBe("true");
      // Zestaw nagłówków jak w oryginale (backend-index.cjs:48928).
      expect(dozwolony.headers["access-control-expose-headers"]).toBe("Set-Cookie");
      expect(dozwolony.headers["access-control-allow-headers"]).toContain("Cookie");

      const obcy = await request(app).get("/api/health").set("Origin", "https://zlosliwa.example");
      expect(obcy.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      baza.posprzataj();
    }
  });
});

describe("obsługa błędów", () => {
  let posprzataj: (() => void) | undefined;
  afterEach(() => posprzataj?.());

  it("nieznana ścieżka → 404 JSON-em, nie HTML-em Expressa", async () => {
    const s = await stworzSrodowiskoTestowe();
    posprzataj = s.posprzataj;
    const odp = await request(s.app).get("/api/nie-ma-takiej");
    expect(odp.status).toBe(404);
    expect(odp.headers["content-type"]).toContain("application/json");
    expect(odp.body).toEqual({ error: "Nie znaleziono" });
  });

  it("uszkodzony JSON w ciele → 400, nie 500", async () => {
    const s = await stworzSrodowiskoTestowe();
    posprzataj = s.posprzataj;
    const odp = await request(s.app)
      .post("/api/login")
      .set("Content-Type", "application/json")
      .send("{to nie jest json");
    expect(odp.status).toBe(400);
    expect(odp.body).toEqual({ error: "Błędne żądanie" });
  });

  it("przyjmuje ciało application/x-www-form-urlencoded (parser jak w oryginale)", async () => {
    const s = await stworzSrodowiskoTestowe();
    posprzataj = s.posprzataj;
    const odp = await request(s.app)
      .post("/api/login")
      .type("form")
      .send({ email: s.dane.email, password: s.dane.haslo });
    expect(odp.status).toBe(200);
  });

  it("nie ujawnia nagłówka X-Powered-By", async () => {
    const s = await stworzSrodowiskoTestowe();
    posprzataj = s.posprzataj;
    const odp = await request(s.app).get("/api/health");
    expect(odp.headers["x-powered-by"]).toBeUndefined();
  });
});
