/**
 * TOR 1 — delta ceny/stanu (`src/selly/rest/sync-delta.ts`, port
 * `origin/main:mirror/backend/selly/sync_delta.cjs`; karta I15.6, ticket 108).
 *
 * ⚠ To JEST operacja zmieniająca cudzy sklep (`PUT /api/products/{pid}/variants/{vid}`).
 * Testy chodzą wyłącznie po atrapie; baza — prawdziwy SQLite w katalogu tymczasowym.
 *
 * Produkty z `PRODUKTY_TESTOWE`: `MO9_336320` (aktywny, stan 2, cena 7252), `MO9_336319`
 * (aktywny, stan 2, cena 730), `MO2_200002` (aktywny, stan 7, cena 2730), `MO1_100001`
 * (wstrzymany, BEZ EAN).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BladSelly } from "../src/selly/klient.js";
import { findDeltaProducts, syncDelta } from "../src/selly/rest/sync-delta.js";
import { opakujKlientaTrybem } from "../src/selly/tryb.js";
import {
  mapowanie,
  stworzAtrapeSelly,
  stworzDiscoveryTestowe,
  stworzTestowaBaze,
  zasiejMapowanie,
  zasiejProdukty,
  type OpcjeAtrapy,
  type TestowaBaza,
} from "./gate/index.js";

const magazyn = (dostawca: string, featureId: number) => ({ feature_id: featureId, name: "Magazyny", value: dostawca });

describe("Tor 1 — sync_delta", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejProdukty(baza.db);
  });
  afterEach(() => baza.posprzataj());

  const kody = () => findDeltaProducts(baza.db).map((w) => w.kod).sort();

  /** Mapowanie `MO9_336320` z wariantem 4242 i podanym snapshotem wysłanych wartości. */
  const zmapuj336320 = (stanWyslany: number | null, cenaWyslana: number | null) =>
    zasiejMapowanie(baza.sqlite, {
      kodImportu: "798368",
      dostawca: "MO9",
      bridgeKod: "MO9_336320",
      productId: 812,
      variantId: 4242,
      featureId: 1,
      stanWyslany,
      cenaWyslana,
    });

  const przygotuj = (opcje: OpcjeAtrapy = {}) => {
    const atrapa = stworzAtrapeSelly({
      sklep: [{ product_id: 812, ean: null, warianty: [{ variant_id: 4242, features: [magazyn("MO9", 1)] }] }],
      ...opcje,
    });
    return { atrapa, ...stworzDiscoveryTestowe(atrapa.klient) };
  };

  const wpisLogu = (id: number) =>
    baza.sqlite.prepare("SELECT * FROM selly_sync_log WHERE id = ?").get(id) as Record<string, unknown>;

  describe("findDeltaProducts", () => {
    it("aktywne z EAN i `kod_importu` bez mapowania wchodzą; bez EAN — nie", () => {
      expect(kody()).toEqual(["MO2_200002", "MO9_336319", "MO9_336320"]);
    });

    it("wysłany snapshot równy bieżącemu → poza deltą; zmiana ceny → z powrotem", () => {
      zmapuj336320(2, 7252);
      expect(kody()).not.toContain("MO9_336320");

      baza.sqlite.prepare("UPDATE products SET cena_sprzedazy = 7300 WHERE kod = 'MO9_336320'").run();
      expect(kody()).toContain("MO9_336320");
    });

    it("#77: `wstrzymany` z wariantem wchodzi ze stanem 0; bez mapowania — nie", () => {
      baza.sqlite.prepare("UPDATE products SET status = 'wstrzymany', stan = 5 WHERE kod = 'MO9_336320'").run();
      expect(kody()).not.toContain("MO9_336320");

      zmapuj336320(5, 7252);
      const wiersz = findDeltaProducts(baza.db).find((w) => w.kod === "MO9_336320");
      expect(wiersz).toMatchObject({ stan: 0, selly_variant_id: 4242 });

      // Po wysłaniu zera snapshot `stan_wyslany = 0` zgadza się z wymuszonym zerem — koniec delty.
      baza.sqlite.prepare("UPDATE selly_products SET stan_wyslany = 0 WHERE kod_importu = '798368'").run();
      expect(kody()).not.toContain("MO9_336320");
    });

    it("filtr dostawcy i limit", () => {
      expect(findDeltaProducts(baza.db, "MO2").map((w) => w.kod)).toEqual(["MO2_200002"]);
      expect(findDeltaProducts(baza.db, null, 1)).toHaveLength(1);
    });
  });

  describe("syncDelta", () => {
    it("mapowanie z JOIN-a → PUT `{quantity, price}`, snapshot i wpis w dzienniku", async () => {
      zmapuj336320(1, 7000);
      const { atrapa, discovery } = przygotuj();

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      // MO9_336319 bez mapowania i bez produktu w sklepie → `not_found` (Tor 1 nie zakłada).
      expect(wynik.stats).toEqual({ total: 2, ok: 1, err: 1, skip: 0, discovered: 0, created: 0 });
      expect(wynik.errors).toEqual([
        { kod: "MO9_336319", error: "produkt nie istnieje w Selly ale brak dictMaps do createProduct" },
      ]);
      const put = atrapa.wywolania.find((w) => w.metoda === "updateVariant");
      expect(put?.argumenty).toEqual([812, 4242, { quantity: 2, price: 7252 }]);
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
        stan_wyslany: 2,
        cena_sprzedazy_wyslana: 7252,
        cena_zakupu_wyslana: 5562.4,
        ostatni_status: "ok",
        ostatni_blad: null,
      });
      // #69: pozycja bez wiersza w `selly_products` nie zostawia śladu w bazie.
      expect(mapowanie(baza.db, "798369", "MO9")).toBeUndefined();

      const log = wpisLogu(wynik.logId);
      expect(log).toMatchObject({
        operacja: "sync_delta",
        dostawca_kod: "MO9",
        liczba_ok: 1,
        liczba_blad: 1,
        liczba_skip: 0,
        status: "zakonczono",
      });
      expect(JSON.parse(String(log.szczegoly_json))).toEqual({
        stats: wynik.stats,
        sample_errors: wynik.errors,
      });
    });

    it("bez dostawcy → `dostawca_kod = 'ALL'`; same błędy → status `blad`", async () => {
      const { discovery } = przygotuj({ sklep: [] });

      const wynik = await syncDelta(baza.db, discovery);

      expect(wynik.stats).toMatchObject({ total: 3, ok: 0, err: 3 });
      expect(wpisLogu(wynik.logId)).toMatchObject({ dostawca_kod: "ALL", status: "blad" });
    });

    it("discovery znajduje wariant → `discovered` i PUT w tym samym przebiegu", async () => {
      const { discovery } = przygotuj({
        sklep: [
          {
            product_id: 900,
            ean: "8903094073627",
            warianty: [{ variant_id: 9100, features: [magazyn("MO9", 1)] }],
          },
        ],
      });

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      expect(wynik.stats).toMatchObject({ ok: 1, discovered: 1 });
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
        selly_variant_id: 9100,
        stan_wyslany: 2,
        ostatni_status: "ok",
      });
    });

    it("#77: `wstrzymany` z wariantem → PUT ze stanem 0", async () => {
      baza.sqlite.prepare("UPDATE products SET status = 'wstrzymany', stan = 5 WHERE kod = 'MO9_336320'").run();
      zmapuj336320(5, 7252);
      const { atrapa, discovery } = przygotuj();

      await syncDelta(baza.db, discovery, "MO9");

      const put = atrapa.wywolania.find((w) => w.metoda === "updateVariant");
      expect(put?.argumenty).toEqual([812, 4242, { quantity: 0, price: 7252 }]);
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({ stan_wyslany: 0 });
    });

    it("`dryRun` pomija PUT i snapshot, liczy `skip`", async () => {
      zmapuj336320(1, 7000);
      const { atrapa, discovery } = przygotuj();

      const wynik = await syncDelta(baza.db, discovery, "MO9", { dryRun: true });

      expect(wynik.stats).toMatchObject({ skip: 1, ok: 0 });
      expect(atrapa.liczba("updateVariant")).toBe(0);
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({ stan_wyslany: 1, cena_sprzedazy_wyslana: 7000 });
    });

    /** Zastane 1:1 (`sync_delta.cjs:137,151`): `dryRun` nie chroni przed discovery. */
    it("⚠ `dryRun` NADAL uruchamia discovery — może założyć wariant w Selly", async () => {
      const { atrapa, discovery } = przygotuj({
        sklep: [{ product_id: 900, ean: "8903094073627", warianty: [] }],
      });

      await syncDelta(baza.db, discovery, "MO9", { dryRun: true });

      expect(atrapa.liczba("createVariant")).toBe(1);
      expect(atrapa.liczba("updateVariant")).toBe(0);
    });

    it("błąd PUT (HTTP spoza 2xx) → `error` z komunikatem klienta w `ostatni_blad`", async () => {
      zmapuj336320(1, 7000);
      const blad = new BladSelly("[Selly] HTTP 500 PUT https://atrapa/api/products/812/variants/4242 :: {}", 500, {});
      const { discovery } = przygotuj({ bledy: { updateVariant: blad } });

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      expect(wynik.errors).toContainEqual({ kod: "MO9_336320", error: blad.message });
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
        ostatni_status: "error",
        ostatni_blad: blad.message,
        stan_wyslany: 1,
      });
    });

    it("`pending_create` vs `error` rozróżniane po treści komunikatu discovery", async () => {
      // Wiersz bez wariantu istnieje, a produkt 812 zniknął ze sklepu: rodzeństwo daje 812,
      // warianty → 404 połknięte, `createVariant` → 404 → to jest `error`, nie `pending_create`.
      zasiejMapowanie(baza.sqlite, { kodImportu: "798368", dostawca: "MO9", bridgeKod: "MO9_336320", productId: 812 });
      const { discovery } = przygotuj({ sklep: [] });

      await syncDelta(baza.db, discovery, "MO9");

      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({ ostatni_status: "error" });
      expect(mapowanie(baza.db, "798368", "MO9")?.ostatni_blad).toMatch(/^createVariant: \[Selly\] HTTP 404/);
    });

    it("⚠ SELLY_TRYB=tylko-odczyt: PUT wariantu zablokowany, nie dociera do sklepu", async () => {
      zmapuj336320(1, 7000);
      const atrapa = stworzAtrapeSelly();
      const { discovery } = stworzDiscoveryTestowe(opakujKlientaTrybem(atrapa.klient, "tylko-odczyt"));

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      expect(atrapa.liczba("updateVariant")).toBe(0);
      expect(wynik.errors).toContainEqual({
        kod: "MO9_336320",
        error: "[Selly] Zapis do Selly zablokowany na tym środowisku (SELLY_TRYB=tylko-odczyt)",
      });
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({ ostatni_status: "error", stan_wyslany: 1 });
    });
  });
});
