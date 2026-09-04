/**
 * GATE ODBUDOWY — Iteracja 8, blok 8a: dwie trasy eksportu do Shopera.
 *
 * Ścieżki kontraktu w zakresie: `/api/export-shoper` (`contract/openapi.yaml:611-617`)
 * i `/api/export/shoper` (`:619-626`). Fixtures w zakresie: BRAK.
 *
 * ⚠ CZEGO TA SIATKA NIE DOWODZI — i dlaczego to nie jest obejście gate'a.
 *
 * 1. FIXTURE'A NIE MA I NIE MOŻE BYĆ. Nagrywarka zapisywała wyłącznie odpowiedzi JSON
 *    (`contract/README.md`), a te trasy oddają `text/csv` i `application/zip`. Format pliku
 *    niesie `eksport-shoper.format.test.ts`, tu sprawdzamy kontrakt, nagłówki i autoryzację.
 * 2. KONTRAKT NIE DEKLARUJE DLA NICH ŻADNEGO `content` — tylko `security` i `responses`.
 *    Dlatego `sprawdzZgodnoscZKontraktemNieJson` (ścieżka + status), a `content-type`
 *    sprawdzamy osobno i wprost. Wariant podstawowy wymaga `application/json` dla KAŻDEJ
 *    odpowiedzi (`gate/kontrakt.ts:81`) i dla CSV-a zapalałby się zawsze.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (§3, plan.md D1) — TU JEST JEGO DOWÓD. Kontrakt opisuje obie trasy
 * jako PUBLICZNE (`security: []`), bo takie są w produkcji. My zakładamy na nie `requireAuth`.
 * Test „401 bez tokenu" sprawdza więc NASZE odstępstwo, nie zgodność z kontraktem — i to jest
 * jedyne miejsce w tym pliku, gdzie celowo rozjeżdżamy się z `openapi.yaml`.
 *
 * ⚠ DRUGA POŁOWA TEGO PLIKU TO DOWÓD AUTORYZACJI PRZEZ COOKIE. Eksport jest NAWIGACJĄ
 * przeglądarki (`window.location.href`), nie `fetch`-em — nie niesie nagłówka `Authorization`
 * i działa wyłącznie na cookie sesji. To jest ta rzecz, która „działa u mnie" i pada u Ani.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  sprawdzZgodnoscZKontraktemNieJson,
  stworzSrodowiskoTestowe,
  zasiejDostawcow,
  zasiejProdukty,
  type SrodowiskoTestowe,
} from "./gate/index.js";

describe("GATE — eksport do Shopera, dwie trasy (blok 8a)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  let cookie: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
    zasiejDostawcow(srodowisko.db);

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

  describe("GET /api/export-shoper", () => {
    it("ścieżka istnieje w kontrakcie, a 200 jest tam zadeklarowane", async () => {
      const odp = await zAuth("/api/export-shoper?dostawca=MO9");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktemNieJson({
        metoda: "GET",
        sciezka: "/api/export-shoper",
        odpowiedz: odp,
      });
    });

    it("z `?dostawca` oddaje CSV nazwany po dostawcy i dacie", async () => {
      const odp = await zAuth("/api/export-shoper?dostawca=MO9");

      expect(odp.headers["content-type"]).toContain("text/csv");
      const data = new Date().toISOString().slice(0, 10);
      expect(odp.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_MO9_${data}.csv"`,
      );
    });

    /**
     * Bez parametru trasa zwija się do ZIP-a z osobnym plikiem per dostawca (`:48786-48800`).
     * To jedyna odpowiedź całego backendu, która nie jest ani JSON-em, ani CSV-em.
     */
    it("bez parametru oddaje ZIP nazwany `shoper_wszyscy_{data}.zip`", async () => {
      const odp = await zAuth("/api/export-shoper");

      expect(odp.status).toBe(200);
      expect(odp.headers["content-type"]).toContain("application/zip");
      const data = new Date().toISOString().slice(0, 10);
      expect(odp.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_wszyscy_${data}.zip"`,
      );
    });

    it("`dostawca=wszyscy` zachowuje się jak brak parametru", async () => {
      const odp = await zAuth("/api/export-shoper?dostawca=wszyscy");

      expect(odp.status).toBe(200);
      expect(odp.headers["content-type"]).toContain("application/zip");
    });
  });

  describe("GET /api/export/shoper", () => {
    it("ścieżka istnieje w kontrakcie, a 200 jest tam zadeklarowane", async () => {
      const odp = await zAuth("/api/export/shoper");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktemNieJson({
        metoda: "GET",
        sciezka: "/api/export/shoper",
        odpowiedz: odp,
      });
    });

    it("bez filtra oddaje jeden CSV `shoper_wszyscy_{data}.csv`, nigdy ZIP", async () => {
      const odp = await zAuth("/api/export/shoper");

      expect(odp.headers["content-type"]).toContain("text/csv");
      const data = new Date().toISOString().slice(0, 10);
      expect(odp.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_wszyscy_${data}.csv"`,
      );
    });

    /**
     * ⚠ Parametr nazywa się `?supplier=`, a NIE `?dostawca=` jak w trasie obok. Rozjazd
     * nazewnictwa jest w oryginale (`:48855`) i zostaje — 8b musi użyć właściwej nazwy
     * dla właściwej trasy.
     */
    it("filtruje po `?supplier=`, a `?dostawca=` jest tu ignorowane", async () => {
      const data = new Date().toISOString().slice(0, 10);

      const zSupplier = await zAuth("/api/export/shoper?supplier=MO9");
      expect(zSupplier.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_MO9_${data}.csv"`,
      );

      const zDostawca = await zAuth("/api/export/shoper?dostawca=MO9");
      expect(zDostawca.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_wszyscy_${data}.csv"`,
      );
    });
  });

  describe("autoryzacja", () => {
    /**
     * ODSTĘPSTWO ŚWIADOME §3: kontrakt mówi `security: []`, my wymagamy sesji. Publiczny
     * eksport oddaje komplet katalogu razem z cenami zakupu (kolumna `cena_zakupu` jest
     * w słowniku kolumn `/api/export/shoper`).
     */
    it("obie trasy oddają 401 bez tokenu — mimo `security: []` w kontrakcie", async () => {
      for (const sciezka of ["/api/export-shoper", "/api/export/shoper"]) {
        const odp = await request(srodowisko.app).get(sciezka);
        expect(odp.status, sciezka).toBe(401);
        expect(odp.body).toEqual({ error: "Nieautoryzowany" });
      }
    });

    /**
     * ⚠ TEN TEST PILNUJE RZECZY, KTÓREJ NIE WIDAĆ W KODZIE TRASY. Przycisk eksportu
     * w panelu robi `window.location.href = "/api/export-shoper?..."`, czyli zwykłą nawigację
     * przeglądarki. Nawigacja NIE niesie nagłówka `Authorization` — niesie tylko cookie.
     * Gdyby `requireAuth` czytał wyłącznie Bearer, testy z tokenem byłyby zielone, a Ania
     * dostawałaby 401 przy każdym kliknięciu.
     */
    it("obie trasy działają na samo cookie, bez nagłówka Authorization", async () => {
      for (const sciezka of ["/api/export-shoper?dostawca=MO9", "/api/export/shoper"]) {
        const odp = await request(srodowisko.app).get(sciezka).set("Cookie", cookie);
        expect(odp.status, sciezka).toBe(200);
        expect(odp.headers["content-type"]).toContain("text/csv");
      }
    });
  });
});
