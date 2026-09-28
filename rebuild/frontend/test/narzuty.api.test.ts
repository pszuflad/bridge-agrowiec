/**
 * Klient `/api/markups` i `/api/promotions` (`src/pages/narzuty/api.ts`) — sesja 4b.
 *
 * Ten plik istnieje dla JEDNEJ pułapki, której nie widać w typach. `PATCH /api/promotions/{id}`
 * dla nieistniejącego `id` oddaje **200 z PUSTYM ciałem**, a nie 404 — bliźniacza trasa
 * narzutu 404 ma. To asymetria oryginału, odtworzona 1:1 w sesji 4a
 * (`backend-index.cjs:48709` vs `:48722-48731`, `rebuild-backlog.md` #20). Gołe
 * `odpowiedz.json()` rzuciłoby tu błędem parsowania i edycja zniknionej promocji
 * wywalałaby widok zamiast pokazać komunikat.
 */
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { KLUCZE_STORAGE } from "@/lib/api";
import {
  dodajNarzut,
  pobierzNarzuty,
  pobierzPromocje,
  usunNarzut,
  zapiszNarzut,
  zapiszPromocje,
} from "@/pages/narzuty/api";
import { TOKEN_TESTOWY, narzutyZFixtura } from "./msw/kontrakt";
import { server } from "./msw/server";

const NARZUTY = narzutyZFixtura();

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
});

describe("1. Odczyt", () => {
  it("GET /api/markups oddaje gołą tablicę z fixture'a", async () => {
    server.use(http.get("*/api/markups", () => HttpResponse.json(NARZUTY)));
    const wynik = await pobierzNarzuty();

    expect(Array.isArray(wynik)).toBe(true);
    expect(wynik[0]!.id).toBe(NARZUTY[0]!.id);
    // `warunki` to STRING, nie tablica — część kontraktu, nie szczegół zapisu.
    expect(typeof wynik[0]!.warunki).toBe("string");
  });

  it("pusta lista promocji to `[]`, a nie null", async () => {
    server.use(http.get("*/api/promotions", () => HttpResponse.json([])));
    expect(await pobierzPromocje()).toEqual([]);
  });

  /** 401 na odczycie MA rzucać — inaczej tabela pokazałaby „brak reguł" przy wygasłej sesji. */
  it("401 na odczycie rzuca, zamiast udawać pustą listę", async () => {
    server.use(
      http.get("*/api/markups", () => new HttpResponse("Brak autoryzacji", { status: 401 })),
    );
    await expect(pobierzNarzuty()).rejects.toThrow(/401/);
  });
});

describe("2. Mutacje", () => {
  it("POST /api/markups zwraca zapisany wiersz", async () => {
    server.use(
      http.post("*/api/markups", async ({ request }) =>
        HttpResponse.json({ id: 42, ...((await request.json()) as object) }),
      ),
    );
    const wynik = await dodajNarzut({
      typ: "globalny",
      zakres: "",
      warunki: "[]",
      nazwa: "Nowa",
      wartosc: 6,
      jednostka: "procent",
      priorytet: 50,
      status: "aktywny",
    });
    expect(wynik?.id).toBe(42);
  });

  it("404 z PATCH narzutu rzuca — ta trasa 404 MA", async () => {
    server.use(
      http.patch("*/api/markups/:id", () => new HttpResponse("Nie znaleziono", { status: 404 })),
    );
    await expect(zapiszNarzut(9999, { wartosc: 1 })).rejects.toThrow(/404/);
  });

  it("DELETE nie wymaga ciała odpowiedzi", async () => {
    server.use(http.delete("*/api/markups/:id", () => HttpResponse.json({ ok: true })));
    await expect(usunNarzut(1)).resolves.toBeUndefined();
  });
});

describe("3. ⭐ Pułapka: PATCH promocji bez 404", () => {
  /**
   * Serwer oddaje 200 z pustym ciałem. Klient MUSI to znieść i zaraportować jako
   * „nie znaleziono" (`null`), a nie jako sukces ani jako wyjątek parsowania.
   */
  it("200 z PUSTYM ciałem daje null, nie wyjątek", async () => {
    server.use(
      http.patch("*/api/promotions/:id", () => new HttpResponse("", { status: 200 })),
    );
    await expect(zapiszPromocje(9999, { rabatPct: 5 })).resolves.toBeNull();
  });

  it("istniejąca promocja wraca jako obiekt", async () => {
    server.use(
      http.patch("*/api/promotions/:id", async ({ request, params }) =>
        HttpResponse.json({ id: Number(params.id), ...((await request.json()) as object) }),
      ),
    );
    const wynik = await zapiszPromocje(1, { rabatPct: 5 });
    expect(wynik?.id).toBe(1);
    expect(wynik?.rabatPct).toBe(5);
  });
});
