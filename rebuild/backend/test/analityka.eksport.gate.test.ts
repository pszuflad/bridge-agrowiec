/**
 * GATE ODBUDOWY — Iteracja 10, blok 10f (`GET /api/analytics/export/{view}`).
 *
 * Ścieżka kontraktu w zakresie: JEDNA — `/api/analytics/export/{view}`
 * (`contract/openapi.yaml:178-188`). Fixtures w zakresie: **BRAK**.
 *
 * ⚠ CZEGO TA SIATKA NIE DOWODZI — i dlaczego to nie jest obejście gate'a.
 *
 * 1. FIXTURE'A NIE MA I NIE MOŻE BYĆ. Nagrywarka zapisywała wyłącznie odpowiedzi JSON
 *    (`contract/README.md`), a ta trasa oddaje `text/csv`. Nie ma czego „poprawiać" ani
 *    dogrywać — kształt wierszy niesie `analityka.eksport.agregaty.test.ts`, format pliku
 *    `analityka.csv.test.ts`.
 * 2. KONTRAKT NIE DEKLARUJE DLA NIEJ ŻADNEGO `content` — tylko `parameters`, `security`
 *    i `responses: {200, 400, 401}`. Dlatego używamy `sprawdzZgodnoscZKontraktemNieJson`
 *    (ścieżka + status) i sprawdzamy `content-type` osobno, wprost. Wspólna
 *    `sprawdzZgodnoscZKontraktem` wymaga `application/json` dla KAŻDEJ odpowiedzi
 *    (`gate/kontrakt.ts:81`) i dla CSV-a zapalałaby się zawsze, choć kontrakt tego nie chce.
 *
 * ⚠ DRUGA POŁOWA TEGO PLIKU TO DOWÓD AUTORYZACJI PRZEZ COOKIE. W oryginale eksport jest
 * NAWIGACJĄ przeglądarki (`window.location.href`, `frontend-index.js:27938-27940`), nie
 * `fetch`-em — nie niesie więc nagłówka `Authorization` i działa wyłącznie na cookie sesji.
 * Trasa stoi za `requireAuth`, więc to jest ta rzecz, która „działa u mnie" i pada na
 * stagingu. Sprawdzamy ją tak, jak zrobi to przeglądarka: samo `Cookie`, bez `Authorization`.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NAZWY_WIDOKOW_EKSPORTU } from "../src/repos/analityka-eksport.js";
import {
  sprawdzZgodnoscZKontraktemNieJson,
  stworzSrodowiskoTestowe,
  zasiejHistorieCen,
  zasiejProdukty,
  zasiejStagingZFixtures,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** BOM — pierwszy znak każdej odpowiedzi tej trasy, także pustej. */
const BOM = "﻿";

describe("GATE — kontrakt i format dla eksportu CSV (blok 10f)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  let cookie: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
    zasiejStagingZFixtures(srodowisko.db);
    zasiejHistorieCen(srodowisko.db);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;

    const ustawione = odp.headers["set-cookie"] as unknown as string[] | undefined;
    cookie = (ustawione ?? []).find((c) => c.startsWith("bridge_session=")) ?? "";
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("ścieżka istnieje w kontrakcie, a 200 jest tam zadeklarowane", async () => {
    const odp = await zAuth("/api/analytics/export/margins");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktemNieJson({
      metoda: "GET",
      sciezka: "/api/analytics/export/margins",
      odpowiedz: odp,
    });
  });

  it("odpowiedź to CSV z załącznikiem nazwanym po widoku (:307-308)", async () => {
    const odp = await zAuth("/api/analytics/export/margins");

    expect(odp.headers["content-type"]).toContain("text/csv");
    expect(odp.headers["content-type"]).toContain("charset=utf-8");
    expect(odp.headers["content-disposition"]).toBe("attachment; filename=margins.csv");
  });

  it("bez tokenu i bez cookie — 401, tak jak każda trasa analityki", async () => {
    const odp = await request(srodowisko.app).get("/api/analytics/export/margins");

    expect(odp.status).toBe(401);
    expect(odp.body).toEqual({ error: "Nieautoryzowany" });
  });

  it("wszystkie dziesięć widoków oryginału odpowiada CSV-em zaczynającym się od BOM", async () => {
    for (const widok of NAZWY_WIDOKOW_EKSPORTU) {
      const odp = await zAuth(`/api/analytics/export/${widok}`);

      expect(odp.status, widok).toBe(200);
      expect(odp.headers["content-type"], widok).toContain("text/csv");
      expect(odp.headers["content-disposition"], widok).toBe(
        `attachment; filename=${widok}.csv`,
      );
      expect(odp.text.startsWith(BOM), widok).toBe(true);
    }
  });

  it("widok z danymi ma nagłówek rozdzielony ŚREDNIKAMI, nie przecinkami", async () => {
    const odp = await zAuth("/api/analytics/export/margins");
    const naglowek = odp.text.slice(BOM.length).split("\n")[0];

    expect(naglowek).toBe("kod;nazwa;dostawca;kategoria;marka;marza_pct");
    expect(odp.text.split("\n").length).toBeGreaterThan(1);
  });

  /**
   * Port `return sendRows([])` z końca łańcucha `if`-ów (`:321`). To NIE jest 404 —
   * oryginał odpowiada poprawnym, pustym plikiem CSV, i tak samo nazywa go po widoku.
   */
  it("nieznany {view} → 200 i SAM BOM, nie 404", async () => {
    const odp = await zAuth("/api/analytics/export/nie-ma-takiego-widoku");

    expect(odp.status).toBe(200);
    expect(odp.headers["content-type"]).toContain("text/csv");
    expect(odp.text).toBe(BOM);
  });

  /**
   * Charakteryzacja usterki produkcji — `docs/rebuild-backlog.md` #32. Historia cen jest
   * zasiana, a mimo to oba pliki są puste, bo ich SQL pyta `historia_cen` o kolumnę `nazwa`,
   * której ta tabela nie ma. Gdyby #32 naprawiono, ten test zapali i wymusi decyzję.
   */
  it("availability-products i sell-through oddają SAM BOM mimo danych w historii (#32)", async () => {
    const zHistoria = await zAuth("/api/analytics/export/suppliers-stability");
    expect(zHistoria.text.length, "historia_cen jest zasiana").toBeGreaterThan(BOM.length);

    expect((await zAuth("/api/analytics/export/availability-products")).text).toBe(BOM);
    expect((await zAuth("/api/analytics/export/sell-through")).text).toBe(BOM);
  });

  describe("autoryzacja przez samo cookie sesji — tak, jak robi to nawigacja przeglądarki", () => {
    it("logowanie ustawia bridge_session z atrybutami, które przeżyją nawigację GET", () => {
      expect(cookie, "POST /api/login nie ustawił cookie bridge_session").not.toBe("");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Path=/");
      // `SameSite=Lax` wysyła cookie przy nawigacji najwyższego poziomu metodą GET — czyli
      // dokładnie przy `window.location.href`. `Strict` by tego nie zrobił po wejściu z linku.
      expect(cookie).toMatch(/SameSite=Lax/i);
    });

    it("GET eksportu z samym Cookie, BEZ nagłówka Authorization, zwraca CSV", async () => {
      const odp = await request(srodowisko.app)
        .get("/api/analytics/export/margins")
        .set("Cookie", cookie.split(";")[0]!);

      expect(odp.status).toBe(200);
      expect(odp.headers["content-type"]).toContain("text/csv");
      expect(odp.text.startsWith(BOM)).toBe(true);
      expect(odp.request.getHeader("Authorization")).toBeUndefined();
    });

    it("podrobione cookie nie wystarcza — 401", async () => {
      const odp = await request(srodowisko.app)
        .get("/api/analytics/export/margins")
        .set("Cookie", "bridge_session=nie-jest-to-zaden-token");

      expect(odp.status).toBe(401);
    });
  });
});
