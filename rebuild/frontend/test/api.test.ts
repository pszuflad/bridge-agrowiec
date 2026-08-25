/**
 * Warstwa HTTP — zachowania, które łatwo zepsuć refaktorem, a które są kontraktem
 * z backendem (`deminified/frontend-index.js:8996-9053`).
 */
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import {
  KLUCZE_STORAGE,
  naglowki,
  pobierzStore,
  pobierzToken,
  ustawZapamietaj,
  zadanie,
  zapiszToken,
} from "@/lib/api";
import { server } from "./msw/server";

beforeEach(() => {
  zapiszToken(null);
});

describe("wybór magazynu (zapamiętaj mnie)", () => {
  it("bez flagi używa sessionStorage", () => {
    expect(pobierzStore()).toBe(sessionStorage);
  });

  it("z flagą bridge_remember=1 używa localStorage", () => {
    ustawZapamietaj(true);
    expect(localStorage.getItem(KLUCZE_STORAGE.zapamietaj)).toBe("1");
    expect(pobierzStore()).toBe(localStorage);
  });

  it("wyłączenie flagi usuwa ją i wraca do sessionStorage", () => {
    ustawZapamietaj(true);
    ustawZapamietaj(false);
    expect(localStorage.getItem(KLUCZE_STORAGE.zapamietaj)).toBeNull();
    expect(pobierzStore()).toBe(sessionStorage);
  });
});

describe("token", () => {
  it("zapisuje się w magazynie wskazanym przez flagę", () => {
    ustawZapamietaj(true);
    zapiszToken("abc");
    expect(localStorage.getItem(KLUCZE_STORAGE.token)).toBe("abc");
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
  });

  it("czyszczenie usuwa go z OBU magazynów", () => {
    localStorage.setItem(KLUCZE_STORAGE.token, "z-localstorage");
    sessionStorage.setItem(KLUCZE_STORAGE.token, "z-sessionstorage");
    zapiszToken(null);
    expect(localStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
    expect(pobierzToken()).toBeNull();
  });
});

describe("nagłówki", () => {
  it("bez tokenu nie wysyła Authorization", () => {
    expect(naglowki(false)).toEqual({});
  });

  it("Content-Type dokłada tylko przy żądaniu z body", () => {
    expect(naglowki(true)).toEqual({ "Content-Type": "application/json" });
  });

  it("Authorization pojawia się dopiero, gdy token istnieje", () => {
    zapiszToken("tajne");
    expect(naglowki(false)).toEqual({ Authorization: "Bearer tajne" });
  });
});

describe("zadanie()", () => {
  it("wysyła cookie równolegle z Bearerem i serializuje body", async () => {
    zapiszToken("tajne");
    let zebrane: { autoryzacja: string | null; typTresci: string | null; body: string } | null =
      null;

    server.use(
      http.post("http://localhost:5173/api/test", async ({ request }) => {
        zebrane = {
          autoryzacja: request.headers.get("authorization"),
          typTresci: request.headers.get("content-type"),
          body: await request.text(),
        };
        return HttpResponse.json({ ok: true });
      }),
    );

    await zadanie("POST", "/api/test", { a: 1 });

    expect(zebrane).toEqual({
      autoryzacja: "Bearer tajne",
      typTresci: "application/json",
      body: JSON.stringify({ a: 1 }),
    });
  });

  it("żądanie bez body nie dostaje Content-Type", async () => {
    let typTresci: string | null | undefined;
    server.use(
      http.post("http://localhost:5173/api/test", ({ request }) => {
        typTresci = request.headers.get("content-type");
        return HttpResponse.json({ ok: true });
      }),
    );

    await zadanie("POST", "/api/test");
    expect(typTresci).toBeNull();
  });

  it("błąd HTTP rzuca wyjątek w formacie <status>: <treść>", async () => {
    server.use(
      http.post(
        "http://localhost:5173/api/test",
        () => new HttpResponse("coś poszło nie tak", { status: 500 }),
      ),
    );

    await expect(zadanie("POST", "/api/test")).rejects.toThrow("500: coś poszło nie tak");
  });
});
