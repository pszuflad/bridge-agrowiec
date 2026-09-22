/**
 * Discovery mapowań Bridge ↔ Selly (`src/selly/rest/discovery.ts`, port
 * `origin/main:mirror/backend/selly/discovery.cjs`; karta I15.6, ticket 108).
 *
 * ⚠ Testy chodzą WYŁĄCZNIE po atrapie sklepu (`test/gate/selly-atrapa.ts`) — discovery
 * zakłada w Selly warianty i produkty. Baza jest prawdziwym SQLite w katalogu tymczasowym.
 *
 * Granica dowodu: zgodność z kodem Ani (linie oryginału w nazwach i komentarzach), nie zgodność
 * z żywym API Selly — dla wariantów nie ma nagrań w `contract/fixtures/`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BladSelly } from "../src/selly/klient.js";
import type { WierszBridge } from "../src/selly/rest/discovery.js";
import { opakujKlientaTrybem } from "../src/selly/tryb.js";
import {
  mapowanie,
  stworzAtrapeSelly,
  stworzDiscoveryTestowe,
  stworzTestowaBaze,
  zasiejMapowanie,
  zasiejProdukty,
  type OpcjeAtrapy,
  type ProduktSklepu,
  type TestowaBaza,
} from "./gate/index.js";

/** `MO9_336320` z `PRODUKTY_TESTOWE` w kształcie wiersza `findDeltaProducts`. */
const WIERSZ: WierszBridge = {
  kod: "MO9_336320",
  kod_importu: "798368",
  dostawca: "MO9",
  ean: "8903094073627",
  stan: 2,
  cena_sprzedazy: 7252,
  vat_rate: 23,
  kategoria: "Rolnicze",
  marka: "BKT",
};

const magazyn = (dostawca: string, featureId: number) => ({
  feature_id: featureId,
  name: "Magazyny",
  value: dostawca,
});

/** Produkt 812 z wariantem MO2 (feature 5) — EAN jak `WIERSZ`. */
const produkt812 = (warianty: ProduktSklepu["warianty"] = [{ variant_id: 4001, features: [magazyn("MO2", 5)] }]) => ({
  product_id: 812,
  product_code: "MO2798368",
  provider_code: "798368",
  ean: "8903094073627",
  warianty,
});

/** Słowniki jak z `sync_full.loadDictMaps` — `catMap` z `selly_kategoria_norm_map` (#74). */
const SLOWNIKI = {
  catMap: new Map([["rolnicze", 2]]),
  prodMap: new Map([["bkt", 77]]),
  whMap: new Map<string, number>(),
};

describe("discovery Selly — ensureMapping", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejProdukty(baza.db);
  });
  afterEach(() => baza.posprzataj());

  const przygotuj = (opcje: OpcjeAtrapy = {}) => {
    const atrapa = stworzAtrapeSelly(opcje);
    return { atrapa, ...stworzDiscoveryTestowe(atrapa.klient) };
  };

  it("bez `kod_importu` albo `dostawca` — błąd, bez pytania Selly", async () => {
    const { atrapa, discovery } = przygotuj();
    expect(await discovery.ensureMapping(baza.db, { ...WIERSZ, kod_importu: null })).toEqual({
      error: "brak kod_importu lub dostawca",
    });
    expect(atrapa.wywolania).toEqual([]);
  });

  it("1. cache z wariantem → `cache_hit`, zero wywołań Selly", async () => {
    zasiejMapowanie(baza.sqlite, {
      kodImportu: "798368",
      dostawca: "MO9",
      bridgeKod: "MO9_336320",
      productId: 812,
      variantId: 4242,
      featureId: 1,
    });
    const { atrapa, discovery } = przygotuj();

    expect(await discovery.ensureMapping(baza.db, WIERSZ)).toEqual({
      product_id: 812,
      variant_id: 4242,
      feature_id_magazyn: 1,
      action: "cache_hit",
    });
    expect(atrapa.wywolania).toEqual([]);
  });

  it("4a. produkt po EAN ma wariant dostawcy → `found_variant` i zapis mapowania", async () => {
    const { atrapa, discovery, limiter } = przygotuj({
      sklep: [produkt812([{ variant_id: 4001, features: [magazyn("MO2", 5)] }, { variant_id: 4002, features: [magazyn("MO9", 1)] }])],
    });

    expect(await discovery.ensureMapping(baza.db, WIERSZ)).toEqual({
      product_id: 812,
      variant_id: 4002,
      feature_id_magazyn: 1,
      action: "found_variant",
    });
    expect(atrapa.wywolania.map((w) => w.metoda)).toEqual(["listProductsByEan", "listVariants"]);
    // Każde wywołanie Selly przeszło przez limiter (`throttled()` w `apiWithRetry`).
    expect(limiter.zgody()).toBe(2);
    expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
      bridge_kod: "MO9_336320",
      selly_product_id: 812,
      selly_variant_id: 4002,
      feature_id_magazyn: 1,
      ostatni_status: "ok",
    });
  });

  it("4b. produkt jest, wariantu dostawcy brak → `createVariant` z ciałem z oryginału", async () => {
    const { atrapa, discovery } = przygotuj({ sklep: [produkt812()] });

    const wynik = await discovery.ensureMapping(baza.db, WIERSZ);

    expect(wynik).toMatchObject({ product_id: 812, feature_id_magazyn: 1, action: "created_variant" });
    const wywolanie = atrapa.wywolania.find((w) => w.metoda === "createVariant");
    // `discovery.cjs:180-190` — `attributes: []` wymagane przez Selly nawet puste.
    expect(wywolanie?.argumenty).toEqual([
      812,
      {
        quantity: 2,
        price: 7252,
        vat: 23,
        ean: "8903094073627",
        default: 0,
        attributes: [],
        features: [magazyn("MO9", 1)],
      },
    ]);
    expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
      selly_product_id: 812,
      selly_variant_id: wynik.variant_id,
      feature_id_magazyn: 1,
      ostatni_status: "ok",
    });
    expect(atrapa.sklep.get(812)?.warianty).toHaveLength(2);
  });

  it("3. EAN nie trafia — „rodzeństwo” po `kod_importu` daje `product_id`", async () => {
    zasiejMapowanie(baza.sqlite, {
      kodImportu: "798368",
      dostawca: "MO2",
      bridgeKod: "MO2_798368",
      productId: 812,
      variantId: 4001,
    });
    const { atrapa, discovery } = przygotuj({ sklep: [{ ...produkt812(), ean: "INNY" }] });

    const wynik = await discovery.ensureMapping(baza.db, WIERSZ);

    expect(wynik).toMatchObject({ product_id: 812, action: "created_variant" });
    expect(atrapa.liczba("listProductsByEan")).toBe(1);
  });

  it("3b. cache kodów — trafienie po `product_code` (kod bez `_`), potem po `provider_code`", async () => {
    const { discovery } = przygotuj({
      rozmiarStrony: 1,
      sklep: [
        { product_id: 500, product_code: "MO9336320", ean: null, warianty: [{ variant_id: 1, features: [magazyn("MO9", 1)] }] },
        { product_id: 501, provider_code: "798369", ean: null, warianty: [{ variant_id: 2, features: [magazyn("MO9", 1)] }] },
      ],
    });
    // Bez zbudowanego cache krok 3b nie działa — Tor 1 sam go nie buduje.
    expect(await discovery.ensureMapping(baza.db, { ...WIERSZ, ean: null })).toMatchObject({ action: "not_found" });

    expect(await discovery.buildProductCodeCache()).toMatchObject({ hit: "built", size: 1, providerSize: 1, pageCount: 2 });
    expect(await discovery.buildProductCodeCache()).toEqual({ hit: "cached", size: 1 });

    expect(await discovery.ensureMapping(baza.db, { ...WIERSZ, ean: null })).toMatchObject({
      product_id: 500,
      variant_id: 1,
      action: "found_variant",
    });
    expect(
      await discovery.ensureMapping(baza.db, { ...WIERSZ, kod: "MO9_336319", kod_importu: "798369", ean: null }),
    ).toMatchObject({ product_id: 501, variant_id: 2, action: "found_variant" });
  });

  it("5. produktu nie ma, brak słowników (Tor 1) → `not_found`, bez zakładania i bez śladu w bazie", async () => {
    const { atrapa, discovery } = przygotuj();

    expect(await discovery.ensureMapping(baza.db, WIERSZ)).toEqual({
      error: "produkt nie istnieje w Selly ale brak dictMaps do createProduct",
      action: "not_found",
    });
    expect(atrapa.liczba("createProduct")).toBe(0);
    expect(mapowanie(baza.db, "798368", "MO9")).toBeUndefined();
  });

  it("5. ze słownikami (Tor 2) → `created_product`; kategoria i producent z DANYCH (#74)", async () => {
    const { atrapa, discovery } = przygotuj();

    const wynik = await discovery.ensureMapping(baza.db, WIERSZ, SLOWNIKI);

    expect(wynik).toMatchObject({ feature_id_magazyn: 1, action: "created_product" });
    expect(atrapa.wywolania.map((w) => w.metoda)).toEqual([
      "listProductsByEan",
      "createProduct",
      "listVariants",
      "updateVariant",
    ]);
    // Domyślny wariant nowego produktu dostaje cechę „Magazyny” PUT-em (`discovery.cjs:262-268`).
    expect(atrapa.wywolania.at(-1)?.argumenty).toEqual([
      wynik.product_id,
      wynik.variant_id,
      { features: [magazyn("MO9", 1)] },
    ]);
    expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
      selly_product_id: wynik.product_id,
      selly_variant_id: wynik.variant_id,
      selly_category_id: 2,
      selly_producer_id: 77,
      ostatni_status: "ok",
    });
  });

  it("5. słownik nie zna kategorii → błąd z mappera, żaden zapis nie idzie do Selly", async () => {
    const { atrapa, discovery } = przygotuj();

    expect(await discovery.ensureMapping(baza.db, WIERSZ, { ...SLOWNIKI, catMap: new Map() })).toEqual({
      error: 'createProduct: Brak kategorii w slowniku: "Rolnicze"',
      action: "not_found",
    });
    expect(atrapa.wywolania.map((w) => w.metoda)).toEqual(["listProductsByEan"]);
  });

  it("createProduct — cache kodów zna `product_code`: dolinkowanie wariantu zamiast POST (`_viaCache`)", async () => {
    const { atrapa, discovery } = przygotuj({
      sklep: [{ product_id: 600, product_code: "MO9336320", ean: null, warianty: [] }],
    });
    await discovery.buildProductCodeCache();

    // `ean: null` + brak rodzeństwa, ale krok 3b trafia — więc sprawdzamy createProduct wprost.
    const wynik = await discovery.createProduct(WIERSZ, SLOWNIKI);

    expect(wynik).toMatchObject({ product_id: 600, _viaCache: true });
    expect(atrapa.liczba("createProduct")).toBe(0);
    expect(atrapa.liczba("createVariant")).toBe(1);
  });

  it("createProduct — 400 „Istnieje produkt o tym kodzie” → rebuild cache i wariant (`_viaRebuild`)", async () => {
    const konflikt = new BladSelly(
      '[Selly] HTTP 400 POST https://atrapa/api/products :: {"message":"Istnieje produkt o tym kodzie"}',
      400,
      {},
    );
    const { atrapa, discovery } = przygotuj({
      bledy: { createProduct: konflikt },
      sklep: [{ product_id: 700, product_code: "MO9336320", ean: null, warianty: [] }],
    });

    const wynik = await discovery.ensureMapping(baza.db, WIERSZ, SLOWNIKI);

    expect(wynik).toMatchObject({ product_id: 700, action: "created_variant" });
    expect(atrapa.liczba("listProductsPage")).toBe(1);
    expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({ selly_product_id: 700 });
  });

  it("uczy się `feature_id` nieznanego magazynu z odpowiedzi na POST wariantu", async () => {
    zasiejMapowanie(baza.sqlite, { kodImportu: "100001", dostawca: "MO2", bridgeKod: "MO2_100001", productId: 812 });
    const { atrapa, discovery } = przygotuj({ sklep: [produkt812()], magazynNowegoWariantu: { dostawca: "MO1", featureId: 9 } });
    expect(discovery.getFeatureIdForWarehouse("MO1")).toBeNull();

    const wynik = await discovery.ensureMapping(baza.db, {
      kod: "MO1_100001",
      kod_importu: "100001",
      dostawca: "MO1",
      ean: null,
      stan: 0,
      cena_sprzedazy: 1170,
    });

    // Pierwszy POST idzie BEZ cechy — nie znaliśmy `feature_id`.
    expect(atrapa.wywolania.find((w) => w.metoda === "createVariant")?.argumenty[1]).not.toHaveProperty("features");
    expect(wynik).toMatchObject({ action: "created_variant", feature_id_magazyn: 9 });
    expect(discovery.getFeatureIdForWarehouse("MO1")).toBe(9);
  });

  /** Backlog #70 — odtworzone 1:1: UPSERT nie odświeża `ostatni_status`. */
  it("#70: stary `pending_create` przeżywa udane odnalezienie wariantu", async () => {
    zasiejMapowanie(baza.sqlite, {
      kodImportu: "798368",
      dostawca: "MO9",
      bridgeKod: "MO9_336320",
      productId: 812,
      status: "pending_create",
    });
    const { discovery } = przygotuj({ sklep: [produkt812([{ variant_id: 4002, features: [magazyn("MO9", 1)] }])] });

    expect(await discovery.ensureMapping(baza.db, WIERSZ)).toMatchObject({ action: "found_variant" });
    expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
      selly_variant_id: 4002,
      ostatni_status: "pending_create",
    });
  });

  /**
   * Backlog #66 — retry na 429 jest martwy: klient RZUCA na 429, a `findProductByEan`
   * i `fetchVariants` połykają błąd. Jedno wywołanie, żadnego ponowienia.
   */
  it("#66: HTTP 429 nie jest ponawiany — błąd połknięty jak „brak produktu”", async () => {
    const limit = new BladSelly("[Selly] HTTP 429 GET https://atrapa/api/products :: {}", 429, {});
    const { atrapa, discovery } = przygotuj({ bledy: { listProductsByEan: limit }, sklep: [produkt812()] });

    expect(await discovery.findProductByEan("8903094073627")).toBeNull();
    expect(atrapa.liczba("listProductsByEan")).toBe(1);
  });

  it("⚠ SELLY_TRYB=tylko-odczyt: odczyty idą, `createVariant` zablokowany i nie dociera do sklepu", async () => {
    const atrapa = stworzAtrapeSelly({ sklep: [produkt812()] });
    const { discovery } = stworzDiscoveryTestowe(opakujKlientaTrybem(atrapa.klient, "tylko-odczyt"));

    const wynik = await discovery.ensureMapping(baza.db, WIERSZ);

    expect(wynik).toEqual({
      error: "createVariant: [Selly] Zapis do Selly zablokowany na tym środowisku (SELLY_TRYB=tylko-odczyt)",
      action: "not_found",
    });
    expect(atrapa.wywolania.map((w) => w.metoda)).toEqual(["listProductsByEan", "listVariants"]);
    expect(atrapa.sklep.get(812)?.warianty).toHaveLength(1);
  });
});
