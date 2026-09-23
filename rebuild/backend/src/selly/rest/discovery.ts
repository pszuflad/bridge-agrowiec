/**
 * Znajdowanie/tworzenie mapowań Bridge ↔ Selly — port `origin/main:mirror/backend/selly/discovery.cjs`
 * (karta I15.6, ticket 108; produkcja zamrożona na 7d6cfc9).
 *
 * MODEL WARIANTOWY: 1 produkt Selly = N wariantów, każdy wariant = inny dostawca (cecha
 * „Magazyny” o wartości MO1..MO10). Cache: `selly_products` `(kod_importu, dostawca)` →
 * `(selly_product_id, selly_variant_id)`. Pytamy Selly dopiero wtedy, gdy synchronizacja chce
 * coś wysłać dla nieznanego produktu („lazy discovery”).
 *
 * Nazwy eksportowanych funkcji są nazwami z oryginału, żeby port `sync_full.cjs` (I15.7),
 * który woła `disc.ensureMapping` i `disc.buildProductCodeCache`, dało się czytać obok.
 *
 * ⚠ RÓŻNICE STRUKTURALNE, NIE BEHAWIORALNE:
 * - Stan procesu (nauczone `feature_id`, cache kodów produktów) oryginał trzyma w zmiennych
 *   MODUŁU (`discovery.cjs:39,53-55`), więc Tor 1 i Tor 2 w jednym procesie dzielą go przez
 *   `require`. U nas żyje w domknięciu `stworzDiscovery()` — testy się nie przeciekają, ale
 *   **proces musi mieć JEDNĄ instancję** i podać ją obu torom (montaż: I15.7/I15.8). Dwie
 *   instancje uczyłyby się osobno, a cache kodów zbudowany przez Tor 2 nie byłby widoczny w Torze 1.
 * - Zamiast `client.api(metoda, ścieżka)` — nazwane metody `KlientSelly` (klasyfikowalne
 *   w `tryb.ts`, więc `SELLY_TRYB` obejmuje każdą ścieżkę zapisu z tego pliku).
 * - `mapper.buildProductPayload` (`mapper_v2.cjs`, własność karty I15.7) jest WSTRZYKIWANE
 *   (decyzja D1 ticketu 108): discovery nie importuje mappera, podaje go wołający.
 */

import type { Baza } from "../../db/index.js";
import type { CechaWariantu, KlientSelly, WariantSelly } from "../klient.js";
import { globalnyLimiter, type Limiter } from "./limiter.js";

/** Wiersz Bridge, na którym pracuje discovery — kolumny z `findDeltaProducts` (snake_case z SQL). */
export type WierszBridge = {
  kod: string;
  kod_importu: string | null;
  dostawca: string | null;
  ean: string | null;
  stan?: number | null;
  cena_sprzedazy?: number | null;
  vat_rate?: number | null;
  kategoria?: string | null;
  marka?: string | null;
};

/** Wartości `action` z oryginału. */
export type AkcjaMapowania =
  | "cache_hit"
  | "found_variant"
  | "created_variant"
  | "created_product"
  | "not_found";

export type WynikMapowania = {
  product_id?: number;
  variant_id?: number | null;
  feature_id_magazyn?: number | null;
  action?: AkcjaMapowania;
  error?: string;
};

/**
 * Słowniki do zakładania produktu od zera (`dictMaps` z `sync_full.loadDictMaps`, I15.7).
 * `catMap` pochodzi z `selly_kategoria_norm_map` — ID kategorii Selly są DANYMI, nie kodem
 * (backlog #74: stare 137/259/377 zwracają 404, żywe to 1/2/3/4).
 */
export type SlownikiSelly = {
  catMap?: Map<string, number>;
  prodMap?: Map<string, number>;
  whMap?: Map<string, number>;
};

/**
 * Wynik `mapper.buildProductPayload(row, dictMaps)` (`mapper_v2.cjs:159-187`): payload
 * `POST /api/products` albo `{ _error }`, gdy słownik nie zna kategorii/producenta.
 */
export type PayloadProduktu = {
  _error?: string;
  product_code?: string;
  /** `null`, gdy wiersz nie ma ani `kod_importu`, ani `kod_dostawcy` (`mapper_v2.cjs:128`). */
  provider_code?: string | null;
  [pole: string]: unknown;
};

export type BudujPayloadProduktu = (wiersz: WierszBridge, slowniki: SlownikiSelly) => PayloadProduktu;

/**
 * Znane `feature_id` cechy „Magazyny” (`discovery.cjs:35-38`, odkryte z produkcji 07.09).
 * MO1/MO6/MO7/MO8/MO10 uczą się w runtime (`learnFeatureId`).
 */
export const WAREHOUSE_FEATURE_IDS: Readonly<Record<string, number | null>> = {
  MO1: null,
  MO2: 5,
  MO3: 4,
  MO4: 3,
  MO5: 2,
  MO6: null,
  MO7: null,
  MO8: null,
  MO9: 1,
  MO10: null,
};

export type ZaleznosciDiscovery = {
  klient: KlientSelly;
  /** Budowa payloadu nowego produktu — `mapper_v2.buildProductPayload` (wpina I15.7). */
  budujPayloadProduktu: BudujPayloadProduktu;
  /** Wstrzykiwany, żeby testy nie czekały realnych sekund. Domyślnie wspólny dla procesu. */
  limiter?: Limiter;
  /** Uśpienie przed ponowieniem po 429 (martwa gałąź, patrz `apiWithRetry`). */
  spij?: (ms: number) => Promise<void>;
};

type WynikUtworzenia = {
  product_id?: number;
  variant_id?: number;
  feature_id_magazyn?: number | null;
  error?: string;
  _viaCache?: boolean;
  _viaRebuild?: boolean;
};

export type Discovery = ReturnType<typeof stworzDiscovery>;

const komunikat = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function stworzDiscovery({
  klient,
  budujPayloadProduktu,
  limiter = globalnyLimiter,
  spij = (ms) => new Promise((r) => setTimeout(r, ms)),
}: ZaleznosciDiscovery) {
  // ---- Feature ID Magazyny per dostawca (nauczone runtime), `discovery.cjs:39` ----
  const featureIdCache: Record<string, number | null> = { ...WAREHOUSE_FEATURE_IDS };

  function getFeatureIdForWarehouse(dostawca: string | null | undefined): number | null {
    return (dostawca ? featureIdCache[dostawca] : null) || null;
  }

  /** `discovery.cjs:45-50` — uczy TYLKO puste pola, nigdy nie nadpisuje. */
  function learnFeatureId(dostawca: string | null | undefined, featureId: number | null | undefined): void {
    if (dostawca && featureIdCache[dostawca] == null && featureId) {
      featureIdCache[dostawca] = featureId;
      console.log(`[discovery] Nauczylem sie: ${dostawca} = feature_id ${featureId}`);
    }
  }

  // ---- Cache product_code → product_id (budowany raz na cykl sync_full), `:53-55` ----
  let productCodeCache: Map<string, number> | null = null;
  let providerCodeCache: Map<string, number> | null = null;
  let productCodeCacheBuiltAt = 0;

  /**
   * Port `apiWithRetry()` (`discovery.cjs:21-32`) — throttle przed KAŻDĄ próbą i retry na 429.
   *
   * ⚠⚠ RETRY NA HTTP 429 JEST MARTWYM KODEM — w oryginale i u nas, świadomie (backlog #66).
   * `client.api()` odrzuca obietnicę dla każdego statusu spoza 2xx (429 też), a oryginał nie
   * ma tu `try/catch`, więc warunek `r.status !== 429` nigdy nie widzi 429: wyjątek leci wprost
   * do wołającego. Nasze metody `KlientSelly` rzucają `BladSelly` tak samo. Działa i ugasiło
   * burzę 429 z 07.09 samo dławienie (`limiter.ts`). Gałąź zostaje, bo jest w oryginale.
   */
  async function apiWithRetry<T>(opis: string, wywolanie: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await limiter.acquire();
      const r = await wywolanie();
      const status = (r as { status?: number } | null)?.status;
      if (status !== 429) return r;
      const naglowek = (r as { headers?: Record<string, string> }).headers?.["retry-after"];
      const retryAfter = parseInt(naglowek || "10", 10);
      const waitMs = Math.min(60_000, Math.max(1000, retryAfter * 1000));
      console.log(`[discovery] HTTP 429 na ${opis}, retry #${attempt + 1} za ${waitMs}ms`);
      await spij(waitMs);
    }
    return { status: 429, data: { message: "Max retries exceeded" } } as T;
  }

  /**
   * Port `buildProductCodeCache()` (`:64-106`). Selly nie filtruje `GET /api/products` po
   * `product_code`/`provider_code` (odkrycie 08.09), więc paginujemy CAŁĄ listę (~314 stron).
   * Cache ważny `maxAgeMs` (domyślnie 10 min) — jeden cykl `sync_full`.
   *
   * ⚠ Brak `try/catch` — błąd paginacji leci do wołającego (jak w oryginale), a cache zostaje
   * w poprzednim stanie.
   */
  async function buildProductCodeCache(
    opts: { force?: boolean; maxAgeMs?: number; onProgress?: ((page: number, total: number) => void) | null } = {},
  ) {
    const { force = false, maxAgeMs = 10 * 60 * 1000, onProgress = null } = opts;
    const now = Date.now();
    if (!force && productCodeCache && now - productCodeCacheBuiltAt < maxAgeMs) {
      return { hit: "cached" as const, size: productCodeCache.size };
    }

    const codeMap = new Map<string, number>();
    const providerMap = new Map<string, number>();
    const t0 = Date.now();

    const first = await apiWithRetry("GET /api/products?sort_by=product_id&sort=ASC", () =>
      klient.listProductsPage(),
    );
    const meta = first?.__metadata ?? {};
    const pageCount = meta.page_count || 1;
    const totalCount = meta.total_count || 0;

    for (const p of first?.data ?? []) {
      if (p.product_code) codeMap.set(String(p.product_code), p.product_id);
      // Klucz złożony (dostawca→kod) niemożliwy — Selly nie zwraca dostawcy per produkt.
      if (p.provider_code) providerMap.set(String(p.provider_code), p.product_id);
    }

    for (let page = 2; page <= pageCount; page++) {
      const r = await apiWithRetry(`GET /api/products?sort_by=product_id&sort=ASC&page=${page}`, () =>
        klient.listProductsPage(page),
      );
      for (const p of r?.data ?? []) {
        if (p.product_code) codeMap.set(String(p.product_code), p.product_id);
        if (p.provider_code) providerMap.set(String(p.provider_code), p.product_id);
      }
      if (onProgress && page % 20 === 0) onProgress(page, pageCount);
    }

    productCodeCache = codeMap;
    providerCodeCache = providerMap;
    productCodeCacheBuiltAt = now;

    const durationMs = Date.now() - t0;
    console.log(
      `[discovery] Cache built: ${codeMap.size} product_codes, ${providerMap.size} provider_codes z ${totalCount} produktow, ${durationMs}ms`,
    );
    return {
      hit: "built" as const,
      size: codeMap.size,
      providerSize: providerMap.size,
      totalCount,
      pageCount,
      durationMs,
    };
  }

  /** `:111-114` — bez zbudowanego cache zwraca `null` (nie buduje sam). */
  function findProductByCode(productCode: string): number | null {
    if (!productCodeCache) return null;
    return productCodeCache.get(String(productCode)) || null;
  }

  /** `:119-122` — po `provider_code` (= `kod_importu` Bridge). */
  function findProductByProviderCode(providerCode: string): number | null {
    if (!providerCodeCache) return null;
    return providerCodeCache.get(String(providerCode)) || null;
  }

  /** `:127-129` — wymuszony rebuild. */
  async function rebuildProductCodeCache(onProgress: ((page: number, total: number) => void) | null = null) {
    return buildProductCodeCache({ force: true, onProgress });
  }

  /**
   * `:135-144`. ⚠ Błąd jest POŁYKANY i daje `null` — 429 albo padnięte Selly wygląda tu
   * identycznie jak „produktu nie ma” (także blokada `SELLY_TRYB=wylaczony`).
   */
  async function findProductByEan(ean: string | null | undefined): Promise<number | null> {
    if (!ean) return null;
    try {
      const r = await apiWithRetry("GET /api/products", () => klient.listProductsByEan(ean));
      const items = r?.data ?? [];
      return items.length > 0 ? (items[0]?.product_id ?? null) : null;
    } catch {
      return null;
    }
  }

  /** `:150-157` — błąd połykany, pusta lista. */
  async function fetchVariants(productId: number): Promise<WariantSelly[]> {
    try {
      const r = await apiWithRetry(`GET /api/products/${productId}/variants`, () =>
        klient.listVariants(productId),
      );
      return r?.data ?? [];
    } catch {
      return [];
    }
  }

  const cechaMagazynu = (wariant: WariantSelly | null | undefined): CechaWariantu | undefined =>
    (wariant?.features ?? []).find((f) => f.name === "Magazyny");

  /** `:163-173` — wariant, którego „Magazyny” == dostawca; przy okazji uczy `feature_id`. */
  function findVariantForDostawca(variants: WariantSelly[], dostawca: string): WariantSelly | null {
    for (const v of variants) {
      const mag = cechaMagazynu(v);
      if (mag && mag.value === dostawca) {
        learnFeatureId(dostawca, mag.feature_id);
        return v;
      }
    }
    return null;
  }

  /**
   * `:178-205` — nowy wariant istniejącego produktu. `attributes: []` jest wymagane przez
   * Selly nawet puste (poprawka Ani 08.09 12:50).
   */
  async function createVariant(productId: number, bridgeRow: WierszBridge): Promise<WynikUtworzenia> {
    const featureId = getFeatureIdForWarehouse(bridgeRow.dostawca);
    const body: Parameters<KlientSelly["createVariant"]>[1] = {
      quantity: bridgeRow.stan ?? 0,
      price: bridgeRow.cena_sprzedazy ?? 0,
      vat: bridgeRow.vat_rate ?? 23,
      ean: bridgeRow.ean || "",
      default: 0,
      attributes: [],
    };
    if (featureId) {
      body.features = [{ feature_id: featureId, name: "Magazyny", value: bridgeRow.dostawca ?? undefined }];
    }
    try {
      const r = await apiWithRetry(`POST /api/products/${productId}/variants`, () =>
        klient.createVariant(productId, body),
      );
      const created = r?.data;
      if (!created?.variant_id) {
        return { error: "POST variant nie zwrocil variant_id: " + JSON.stringify(r) };
      }
      if (!featureId) {
        const mag = cechaMagazynu(created);
        if (mag) learnFeatureId(bridgeRow.dostawca, mag.feature_id);
      }
      return {
        variant_id: created.variant_id,
        feature_id_magazyn: featureId || getFeatureIdForWarehouse(bridgeRow.dostawca),
      };
    } catch (e) {
      return { error: komunikat(e) };
    }
  }

  /**
   * `:212-298` — nowy produkt Selly z pierwszym wariantem.
   *
   * Przed POST: jeśli cache kodów jest zbudowany i zna `product_code`, produkt już istnieje —
   * dolinkowujemy wariant (`_viaCache`). Po 400 „Istnieje produkt o tym kodzie”: rebuild cache
   * (~314 stron) i ta sama próba (`_viaRebuild`).
   *
   * ⚠ `budujPayloadProduktu` jest wołane POZA `try` — wyjątek z mappera leci do wołającego,
   * jak `mapper.buildProductPayload` w oryginale.
   * ⚠ Nieudany PUT „Magazyny” na domyślnym wariancie jest tylko logowany, a wynik i tak niesie
   * `feature_id_magazyn` — zastane (`:262-271`).
   */
  async function createProduct(bridgeRow: WierszBridge, dictMaps: SlownikiSelly): Promise<WynikUtworzenia> {
    const payload = budujPayloadProduktu(bridgeRow, dictMaps);
    if (payload._error) {
      return { error: payload._error };
    }

    // KROK PROTECT: czy product_code już istnieje w Selly
    if (productCodeCache && payload.product_code) {
      const existingId = findProductByCode(payload.product_code);
      if (existingId) {
        console.log(
          `[discovery] Produkt z product_code=${payload.product_code} juz istnieje w Selly (id=${existingId}), fallback do createVariant`,
        );
        const created = await createVariant(existingId, bridgeRow);
        if (created.error) return { error: "createVariant (via cache): " + created.error };
        return {
          product_id: existingId,
          variant_id: created.variant_id,
          feature_id_magazyn: created.feature_id_magazyn,
          _viaCache: true,
        };
      }
    }

    try {
      const r = await apiWithRetry("POST /api/products", () => klient.createProduct(payload));
      const created = r?.data;
      if (!created?.product_id) {
        return { error: "POST product nie zwrocil product_id: " + JSON.stringify(r).slice(0, 500) };
      }
      const productId = created.product_id;

      if (productCodeCache && payload.product_code) {
        productCodeCache.set(String(payload.product_code), productId);
      }
      if (providerCodeCache && payload.provider_code) {
        providerCodeCache.set(String(payload.provider_code), productId);
      }

      // Produkt powstaje z domyślnym wariantem — znajdź go
      const variants = await fetchVariants(productId);
      const defaultV = variants.find((v) => v.default === 1) || variants[0];
      if (!defaultV) {
        return { error: "POST product utworzyl produkt " + productId + " ale brak default variant" };
      }

      const hasMag = cechaMagazynu(defaultV);
      let featureId = getFeatureIdForWarehouse(bridgeRow.dostawca);
      const variantId = defaultV.variant_id;

      if (!hasMag && featureId) {
        try {
          await apiWithRetry(`PUT /api/products/${productId}/variants/${variantId}`, () =>
            klient.updateVariant(productId, variantId, {
              features: [{ feature_id: featureId as number, name: "Magazyny", value: bridgeRow.dostawca ?? undefined }],
            }),
          );
        } catch (e) {
          console.warn(`[discovery] Nie udalo sie dopisac Magazyny do default variant ${variantId}: ${komunikat(e)}`);
        }
      } else if (hasMag) {
        featureId = hasMag.feature_id ?? null;
        learnFeatureId(bridgeRow.dostawca, featureId);
      }

      return { product_id: productId, variant_id: variantId, feature_id_magazyn: featureId };
    } catch (e) {
      // 400 „Istnieje produkt o tym kodzie” — cache niekompletny (produkt dodany w międzyczasie).
      const status = (e as { status?: number } | null)?.status;
      if (status === 400 && /Istnieje produkt o tym kodzie/i.test(komunikat(e))) {
        console.warn(`[discovery] POST product 400 (conflict) mimo cache. Rebuild i retry.`);
        await rebuildProductCodeCache();
        const existingId = findProductByCode(payload.product_code as string);
        if (existingId) {
          const created = await createVariant(existingId, bridgeRow);
          if (created.error) return { error: "createVariant po rebuild: " + created.error };
          return {
            product_id: existingId,
            variant_id: created.variant_id,
            feature_id_magazyn: created.feature_id_magazyn,
            _viaRebuild: true,
          };
        }
      }
      return { error: komunikat(e) };
    }
  }

  /**
   * GŁÓWNA FUNKCJA — port `ensureMapping()` (`:303-425`). Kroki:
   *  1. cache `selly_products` (tylko z `selly_variant_id`) → `cache_hit`;
   *  2. produkt w Selly po EAN;
   *  3. „rodzeństwo” — ten sam `kod_importu` u innego dostawcy już zmapowany;
   *  3b. cache kodów produktów (tylko gdy zbudowany — w praktyce przez Tor 2 w tym samym procesie);
   *  4. produkt jest → wariant dostawcy (`found_variant`) albo nowy wariant (`created_variant`);
   *  5. produktu nie ma → bez `dictMaps` błąd (Tor 1 ZAWSZE tu kończy, backlog #68), z nimi
   *     `createProduct` (Tor 2).
   *
   * Trzy UPSERT-y różnią się listą `DO UPDATE` i zostają osobne, verbatim: tylko `found_variant`
   * nadpisuje `bridge_kod`, żaden nie odświeża `ostatni_status` (backlog #70 — stary
   * `pending_create` przeżywa udane odnalezienie wariantu; defekt odtworzony 1:1).
   */
  async function ensureMapping(
    db: Baza,
    bridgeRow: WierszBridge,
    dictMaps: SlownikiSelly | null = null,
  ): Promise<WynikMapowania> {
    const { kod, kod_importu, dostawca, ean } = bridgeRow;
    if (!kod_importu || !dostawca) {
      return { error: "brak kod_importu lub dostawca" };
    }
    const sqlite = db.$client;

    // 1. Cache hit?
    const cached = sqlite
      .prepare(
        "SELECT selly_product_id, selly_variant_id, feature_id_magazyn FROM selly_products WHERE kod_importu = ? AND dostawca = ?",
      )
      .get(kod_importu, dostawca) as
      | { selly_product_id: number; selly_variant_id: number | null; feature_id_magazyn: number | null }
      | undefined;
    if (cached?.selly_variant_id) {
      return {
        product_id: cached.selly_product_id,
        variant_id: cached.selly_variant_id,
        feature_id_magazyn: cached.feature_id_magazyn,
        action: "cache_hit",
      };
    }

    // 2. Produkt w Selly po EAN
    let productId: number | null = null;
    if (ean) {
      productId = await findProductByEan(ean);
    }

    // 3. Sibling w cache Bridge (inny dostawca tego samego kod_importu)
    if (!productId) {
      const sibling = sqlite
        .prepare(
          "SELECT selly_product_id FROM selly_products WHERE kod_importu = ? AND selly_product_id IS NOT NULL LIMIT 1",
        )
        .get(kod_importu) as { selly_product_id: number } | undefined;
      if (sibling) productId = sibling.selly_product_id;
    }

    // 3b. Cache product_code Selly (produkt bez EAN, bez rodzeństwa)
    if (!productId && productCodeCache) {
      // Odtworzony kod — musi być zgodny z `buildProductPayload` (kod bez podkreślników)
      const guess = (kod || "").replace(/_/g, "");
      productId = findProductByCode(guess);
      if (productId) {
        console.log(`[discovery] Znaleziono w Selly przez product_code cache: ${guess} -> ${productId}`);
      }
      if (!productId) {
        productId = findProductByProviderCode(kod_importu);
        if (productId) {
          console.log(`[discovery] Znaleziono w Selly przez provider_code cache: ${kod_importu} -> ${productId}`);
        }
      }
    }

    // 4. Znaleziony produkt — warianty
    if (productId) {
      const variants = await fetchVariants(productId);
      const variant = findVariantForDostawca(variants, dostawca);
      if (variant) {
        const featureId = cechaMagazynu(variant)?.feature_id;
        sqlite
          .prepare(
            `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id,
                                    feature_id_magazyn, ostatni_status, ostatnia_sync)
        VALUES (?, ?, ?, ?, ?, ?, 'ok', datetime('now'))
        ON CONFLICT(kod_importu, dostawca) DO UPDATE SET
          selly_product_id=excluded.selly_product_id,
          selly_variant_id=excluded.selly_variant_id,
          feature_id_magazyn=excluded.feature_id_magazyn,
          bridge_kod=excluded.bridge_kod`,
          )
          .run(kod_importu, dostawca, kod, productId, variant.variant_id, featureId || null);
        return {
          product_id: productId,
          variant_id: variant.variant_id,
          feature_id_magazyn: featureId,
          action: "found_variant",
        };
      }
      // Produkt jest, brak wariantu dla dostawcy — utwórz
      const created = await createVariant(productId, bridgeRow);
      if (created.error) {
        return { error: "createVariant: " + created.error, action: "not_found" };
      }
      sqlite
        .prepare(
          `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id,
                                  feature_id_magazyn, ostatni_status, ostatnia_sync)
      VALUES (?, ?, ?, ?, ?, ?, 'ok', datetime('now'))
      ON CONFLICT(kod_importu, dostawca) DO UPDATE SET
        selly_product_id=excluded.selly_product_id,
        selly_variant_id=excluded.selly_variant_id,
        feature_id_magazyn=excluded.feature_id_magazyn`,
        )
        .run(kod_importu, dostawca, kod, productId, created.variant_id, created.feature_id_magazyn || null);
      return {
        product_id: productId,
        variant_id: created.variant_id,
        feature_id_magazyn: created.feature_id_magazyn,
        action: "created_variant",
      };
    }

    // 5. Produkt nie istnieje w Selly — utwórz od zera.
    // ⚠ TREŚĆ KOMUNIKATU jest kontraktem wewnętrznym: `markError` w `sync-delta.ts` rozpoznaje
    // po niej `pending_create` (`sync_delta.cjs:98-99`).
    if (!dictMaps) {
      return { error: "produkt nie istnieje w Selly ale brak dictMaps do createProduct", action: "not_found" };
    }
    const created = await createProduct(bridgeRow, dictMaps);
    if (created.error) {
      return { error: "createProduct: " + created.error, action: "not_found" };
    }
    sqlite
      .prepare(
        `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id,
                                selly_category_id, selly_producer_id, feature_id_magazyn,
                                ostatni_status, ostatnia_sync)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ok', datetime('now'))
    ON CONFLICT(kod_importu, dostawca) DO UPDATE SET
      selly_product_id=excluded.selly_product_id,
      selly_variant_id=excluded.selly_variant_id,
      feature_id_magazyn=excluded.feature_id_magazyn`,
      )
      .run(
        kod_importu,
        dostawca,
        kod,
        created.product_id,
        created.variant_id,
        dictMaps.catMap?.get(String(bridgeRow.kategoria || "").toLowerCase()) || null,
        dictMaps.prodMap?.get(String(bridgeRow.marka || "").toLowerCase()) || null,
        created.feature_id_magazyn || null,
      );
    return {
      product_id: created.product_id,
      variant_id: created.variant_id,
      feature_id_magazyn: created.feature_id_magazyn,
      action: created._viaCache || created._viaRebuild ? "created_variant" : "created_product",
    };
  }

  return {
    /** Klient, którym discovery gada z Selly — Tor 1 robi nim swój PUT wariantu. */
    klient,
    ensureMapping,
    findProductByEan,
    fetchVariants,
    findVariantForDostawca,
    createVariant,
    createProduct,
    getFeatureIdForWarehouse,
    learnFeatureId,
    apiWithRetry,
    buildProductCodeCache,
    rebuildProductCodeCache,
    findProductByCode,
    findProductByProviderCode,
    /** Żywy obiekt nauczonych `feature_id` — w oryginale eksportowany jako `WAREHOUSE_FEATURE_IDS` (`:441`). */
    featureIdCache,
  };
}
