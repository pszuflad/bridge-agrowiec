/**
 * Sesja użytkownika — `deminified/frontend-index.js:9080-9110`.
 * Mock `/api/login` odpowiada kształtem z kontraktu (user z `contract/fixtures/GET_me.json`).
 */
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { KLUCZE_STORAGE, zapiszToken } from "@/lib/api";
import { _zresetujStanSesji, pobierzUzytkownika, wyloguj, zaloguj } from "@/lib/auth";
import { server } from "./msw/server";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const UZYTKOWNIK = uzytkownikZFixtura();

function zamockujUdaneLogowanie(zebierz?: (body: unknown) => void) {
  server.use(
    http.post("http://localhost:5173/api/login", async ({ request }) => {
      zebierz?.(await request.json());
      return HttpResponse.json({ ok: true, user: UZYTKOWNIK, token: TOKEN_TESTOWY });
    }),
  );
}

beforeEach(() => {
  zapiszToken(null);
  _zresetujStanSesji();
});

describe("zaloguj()", () => {
  it("wysyła przycięty e-mail i hasło pod /api/login", async () => {
    let wyslane: unknown;
    zamockujUdaneLogowanie((body) => {
      wyslane = body;
    });

    await zaloguj("  marta@example.com  ", "tajne-haslo", false);

    expect(wyslane).toEqual({ email: "marta@example.com", password: "tajne-haslo" });
  });

  it("bez zapamiętania zapisuje token i użytkownika w sessionStorage", async () => {
    zamockujUdaneLogowanie();

    await zaloguj(UZYTKOWNIK.email, "tajne", false);

    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBe(TOKEN_TESTOWY);
    expect(JSON.parse(sessionStorage.getItem(KLUCZE_STORAGE.uzytkownik) ?? "null")).toEqual(
      UZYTKOWNIK,
    );
    expect(localStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
  });

  it("z zapamiętaniem zapisuje token i użytkownika w localStorage", async () => {
    zamockujUdaneLogowanie();

    await zaloguj(UZYTKOWNIK.email, "tajne", true);

    expect(localStorage.getItem(KLUCZE_STORAGE.zapamietaj)).toBe("1");
    expect(localStorage.getItem(KLUCZE_STORAGE.token)).toBe(TOKEN_TESTOWY);
    expect(JSON.parse(localStorage.getItem(KLUCZE_STORAGE.uzytkownik) ?? "null")).toEqual(
      UZYTKOWNIK,
    );
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
  });

  it("zwraca użytkownika i udostępnia go przez pobierzUzytkownika()", async () => {
    zamockujUdaneLogowanie();

    const wynik = await zaloguj(UZYTKOWNIK.email, "tajne", false);

    expect(wynik).toEqual(UZYTKOWNIK);
    expect(pobierzUzytkownika()).toEqual(UZYTKOWNIK);
  });

  it("odpowiedź bez tokenu jest poprawna — sesja stoi wtedy na samym cookie", async () => {
    server.use(
      http.post("http://localhost:5173/api/login", () =>
        HttpResponse.json({ ok: true, user: UZYTKOWNIK }),
      ),
    );

    await zaloguj(UZYTKOWNIK.email, "tajne", false);

    expect(pobierzUzytkownika()).toEqual(UZYTKOWNIK);
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
  });

  it("401 z backendu daje komunikat z pola error", async () => {
    server.use(
      http.post("http://localhost:5173/api/login", () =>
        HttpResponse.json({ error: "Nieprawidłowy email lub hasło" }, { status: 401 }),
      ),
    );

    await expect(zaloguj(UZYTKOWNIK.email, "zle", false)).rejects.toThrow(
      /Nieprawidłowy email lub hasło/,
    );
    expect(pobierzUzytkownika()).toBeNull();
  });

  it("odpowiedź 200 bez ok/user jest traktowana jak błąd logowania", async () => {
    server.use(
      http.post("http://localhost:5173/api/login", () => HttpResponse.json({ ok: false })),
    );

    await expect(zaloguj(UZYTKOWNIK.email, "zle", false)).rejects.toThrow(
      "Nieprawidłowy email lub hasło",
    );
  });
});

describe("wyloguj()", () => {
  it("czyści token i użytkownika z obu magazynów oraz flagę zapamiętania", async () => {
    zamockujUdaneLogowanie();
    server.use(
      http.post("http://localhost:5173/api/logout", () => HttpResponse.json({ ok: true })),
    );
    await zaloguj(UZYTKOWNIK.email, "tajne", true);

    await wyloguj();

    expect(pobierzUzytkownika()).toBeNull();
    expect(localStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
    expect(localStorage.getItem(KLUCZE_STORAGE.uzytkownik)).toBeNull();
    expect(sessionStorage.getItem(KLUCZE_STORAGE.uzytkownik)).toBeNull();
    expect(localStorage.getItem(KLUCZE_STORAGE.zapamietaj)).toBeNull();
  });

  it("czyści stan lokalny nawet gdy backend odpowie błędem", async () => {
    zamockujUdaneLogowanie();
    await zaloguj(UZYTKOWNIK.email, "tajne", false);
    server.use(
      http.post(
        "http://localhost:5173/api/logout",
        () => new HttpResponse("padło", { status: 500 }),
      ),
    );

    await expect(wyloguj()).resolves.toBeUndefined();
    expect(pobierzUzytkownika()).toBeNull();
    expect(sessionStorage.getItem(KLUCZE_STORAGE.uzytkownik)).toBeNull();
  });
});
