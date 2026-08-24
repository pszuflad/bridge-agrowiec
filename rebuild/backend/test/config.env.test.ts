/** Konfiguracja środowiska — fail-fast bez JWT_SECRET (plan.md O2). */
import { describe, expect, it } from "vitest";
import { wczytajEnv } from "../src/config/env.js";

const bazoweEnv = {
  DB_PATH: "/tmp/nieistotna.db",
  JWT_SECRET: "sekret",
} as NodeJS.ProcessEnv;

describe("wczytajEnv", () => {
  it("rzuca czytelnym błędem, gdy brakuje JWT_SECRET (bez zahardkodowanego fallbacku)", () => {
    expect(() => wczytajEnv({ DB_PATH: "/tmp/x.db" } as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
  });

  it("rzuca, gdy brakuje DB_PATH", () => {
    expect(() => wczytajEnv({ JWT_SECRET: "sekret" } as NodeJS.ProcessEnv)).toThrow(/DB_PATH/);
  });

  it("nie ma śladu sekretu z oryginału", () => {
    expect(() => wczytajEnv({ DB_PATH: "/tmp/x.db" } as NodeJS.ProcessEnv)).toThrow();
    // Gdyby fallback wrócił, powyższe by nie rzuciło — ten test jest strażnikiem odstępstwa O2.
  });

  it("domyślne wartości HOST/PORT/NODE_ENV odpowiadają kontraktowi deployu", () => {
    const env = wczytajEnv(bazoweEnv);
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.PORT).toBe(5001);
    expect(env.NODE_ENV).toBe("development");
  });

  it("PORT z env jest liczbą", () => {
    const env = wczytajEnv({ ...bazoweEnv, PORT: "5001" });
    expect(env.PORT).toBe(5001);
    expect(() => wczytajEnv({ ...bazoweEnv, PORT: "nie-liczba" })).toThrow(/PORT/);
  });

  it("cookieSecure: domyślnie true w produkcji, false poza nią", () => {
    expect(wczytajEnv({ ...bazoweEnv, NODE_ENV: "production" }).cookieSecure).toBe(true);
    expect(wczytajEnv({ ...bazoweEnv, NODE_ENV: "development" }).cookieSecure).toBe(false);
    expect(wczytajEnv({ ...bazoweEnv, NODE_ENV: "test" }).cookieSecure).toBe(false);
  });

  it("COOKIE_SECURE nadpisuje domyślną wartość w obie strony", () => {
    expect(
      wczytajEnv({ ...bazoweEnv, NODE_ENV: "production", COOKIE_SECURE: "false" }).cookieSecure,
    ).toBe(false);
    expect(
      wczytajEnv({ ...bazoweEnv, NODE_ENV: "development", COOKIE_SECURE: "true" }).cookieSecure,
    ).toBe(true);
  });

  it("CORS_ORIGINS: pusty domyślnie, lista po przecinku po ustawieniu", () => {
    expect(wczytajEnv(bazoweEnv).CORS_ORIGINS).toEqual([]);
    expect(
      wczytajEnv({ ...bazoweEnv, CORS_ORIGINS: "http://localhost:5173, http://localhost:4173" })
        .CORS_ORIGINS,
    ).toEqual(["http://localhost:5173", "http://localhost:4173"]);
  });
});
