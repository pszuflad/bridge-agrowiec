/**
 * Lazy discovery mapowania Bridge → Selly — port `mirror/backend/selly/discovery.cjs`
 * (Iteracja 13d-1, ticket 45).
 *
 * Pytamy Selly dopiero wtedy, gdy synchronizacja chce coś wysłać dla nieznanego produktu.
 * Wynik trafia do `selly_products` i przy kolejnym przebiegu jest już trafieniem w cache.
 *
 * MODEL: `(kod_importu, dostawca)` → `(selly_product_id, selly_variant_id)`. Ten sam
 * `kod_importu` to JEDEN produkt w Selly z N wariantami — po jednym na dostawcę. Wariant
 * rozpoznajemy po cesze `Magazyny` o wartości równej kodowi dostawcy.
 */

import { sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { globalnyLimiter, type Limiter } from "./limiter.js";
import type { CechaWariantu, KlientSelly, WariantSelly } from "./klient.js";

/** Wiersz Bridge, na którym pracuje discovery (podzbiór wyniku `znajdzProduktyDelta`). */
export type WierszBridge = {
  kod: string;
  kod_importu: string | null;
  dostawca: string | null;
  ean: string | null;
  stan: number | null;
  cena_sprzedazy: number | null;
  vat_rate?: number | null;
  kategoria?: string | null;
  marka?: string | null;
};

/** Dokładne wartości `action` z oryginału (`discovery.cjs:7`). */
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
 * Słowniki potrzebne wyłącznie do zakładania produktu od zera (Tor 2). Tor 1 ich NIE
 * przekazuje — i to jest mechanizm, przez który nieznany produkt kończy jako
 * `pending_create`, a nie `error` (patrz `oznaczBlad` w `sync-delta.ts`).
 */
export type SlownikiSelly = {
  catMap?: Map<string, number>;
  prodMap?: Map<string, number>;
  whMap?: Map<string, number>;
};

/**
 * Znane `feature_id` cechy „Magazyny" (`discovery.cjs:40-43`).
 *
 * Odkryte z produkcji na produktach 407, 1927, 215, 1524, 60, 1049, 462, 1547
 * (CHANGELOG 2026-09-07 20:03). Pozostałe (MO1, MO6, MO7, MO8, MO10) uzupełniają się same
 * przy pierwszym wariancie utworzonym dla danego dostawcy — patrz `naucz`.
 */
export const FEATURE_ID_MAGAZYNOW: Readonly<Record<string, number | null>> = {
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

/**
 * Cache `dostawca → feature_id`, uzupełniany w trakcie działania procesu.
 *
 * ⚠ Stan MODUŁU, jak w oryginale (`discovery.cjs:46`) — żyje tyle, co proces, i nie jest
 * zapisywany do bazy (do bazy trafia `feature_id_magazyn` per wiersz mapowania).
 * `stworzDiscovery` dostaje własną kopię, żeby testy się nie przeciekały nawzajem.
 */
function stworzCacheFeatureId(): Record<string, number | null> {
  return { ...FEATURE_ID_MAGAZYNOW };
}

export type ZaleznosciDiscovery = {
  klient: KlientSelly;
  /** Wstrzykiwany, żeby testy nie czekały realnych sekund (patrz `limiter.ts`). */
  limiter?: Limiter;
};

export type Discovery = ReturnType<typeof stworzDiscovery>;

export function stworzDiscovery({ klient, limiter = globalnyLimiter }: ZaleznosciDiscovery) {
  const cacheFeatureId = stworzCacheFeatureId();

  function featureIdDlaDostawcy(dostawca: string | null | undefined): number | null {
    if (!dostawca) return null;
    return cacheFeatureId[dostawca] ?? null;
  }

  /** Port `learnFeatureId()` (`:54-58`) — uczy TYLKO puste pola, nigdy nie nadpisuje. */
  function naucz(dostawca: string | null | undefined, featureId: number | null | undefined): void {
    if (dostawca && featureId && !cacheFeatureId[dostawca]) {
      cacheFeatureId[dostawca] = featureId;
    }
  }

  /**
   * Port `apiWithRetry()` (`discovery.cjs:27-36`).
   *
   * ⚠⚠ RETRY NA HTTP 429 JEST W ORYGINALE MARTWYM KODEM — i u nas też, świadomie
   * (ticket 45, decyzja D2). `client.api()` w oryginale idzie przez `request()`
   * (`client.cjs:56-60`), które ODRZUCA obietnicę dla każdego statusu spoza 2xx — 429
   * włącznie. `apiWithRetry` nie ma `try/catch` wokół wywołania, więc do linii
   * `if (r.status !== 429)` sterowanie nigdy nie dociera ścieżką błędu: 429 leci wyjątkiem
   * wprost do wołającego. Nasz `zapytaj()` (`klient.ts`) zachowuje się identycznie.
   *
   * Zachowanie faktyczne, które odtwarzamy: throttle przed KAŻDĄ próbą (to działa i to
   * ugasiło burzę 429), a 429 kończy produkt błędem bez ponowienia. Gałąź `429` zostaje
   * niżej, bo jest w oryginale — nie dlatego, że kiedykolwiek się wykona. Wpis: backlog #60.
   */
  async function wykonajZPonowieniem<T>(
    opis: string,
    wywolanie: () => Promise<T>,
    maksProb = 3,
  ): Promise<T> {
    let ostatni: T | undefined;
    for (let proba = 0; proba <= maksProb; proba++) {
      await limiter.acquire();
      const wynik = await wywolanie();

      // Nieosiągalne przy kliencie, który rzuca na non-2xx (patrz nota wyżej). Zachowane,
      // bo tak wygląda oryginał; gdyby klient kiedyś zaczął ZWRACAĆ status zamiast rzucać,
      // ta gałąź wznowi zamierzone zachowanie.
      const status = (wynik as { status?: number } | null)?.status;
      if (status !== 429) return wynik;

      ostatni = wynik;
      const naglowek = (wynik as { headers?: Record<string, string> } | null)?.headers?.[
        "retry-after"
      ];
      const retryAfter = parseInt(naglowek ?? "10", 10);
      const czekajMs = Math.min(60_000, Math.max(1000, retryAfter * 1000));
      console.log(`[discovery] HTTP 429 na ${opis}, retry #${proba + 1} za ${czekajMs}ms`);
      await new Promise((r) => setTimeout(r, czekajMs));
    }
    return ostatni as T;
  }

  /**
   * Port `findProductByEan()` (`:64-74`).
   *
   * ⚠ `try/catch` POŁYKA BŁĄD i oddaje `null` — 1:1 z oryginałem. Skutek uboczny, który
   * trzeba znać przy diagnozie: HTTP 429 albo padnięte Selly wygląda tu identycznie jak
   * „produktu nie ma", więc produkt ląduje w `pending_create` zamiast w `error`.
   */
  async function znajdzProduktPoEan(ean: string | null): Promise<number | null> {
    if (!ean) return null;
    try {
      const odp = await wykonajZPonowieniem(`GET /api/products?ean=${ean}`, () =>
        klient.listProductsByEan(ean),
      );
      const pozycje = odp?.data ?? [];
      return pozycje.length > 0 ? (pozycje[0]?.product_id ?? null) : null;
    } catch {
      return null;
    }
  }

  /** Port `fetchVariants()` (`:80-87`) — błąd również połykany, oddaje pustą listę. */
  async function pobierzWarianty(productId: number): Promise<WariantSelly[]> {
    try {
      const odp = await wykonajZPonowieniem(`GET /api/products/${productId}/variants`, () =>
        klient.listVariants(productId),
      );
      return odp?.data ?? [];
    } catch {
      return [];
    }
  }

  function cechaMagazynu(wariant: WariantSelly | undefined): CechaWariantu | undefined {
    return (wariant?.features ?? []).find((f) => f.name === "Magazyny");
  }

  /** Port `findVariantForDostawca()` (`:93-103`) — przy okazji uczy `feature_id`. */
  function wariantDlaDostawcy(
    warianty: WariantSelly[],
    dostawca: string,
  ): WariantSelly | null {
    for (const wariant of warianty) {
      const mag = cechaMagazynu(wariant);
      if (mag && mag.value === dostawca) {
        naucz(dostawca, mag.feature_id);
        return wariant;
      }
    }
    return null;
  }

  /**
   * Port `createVariant()` (`:110-137`).
   *
   * ⚠ `attributes: []` jest WYMAGANE, mimo że puste — bez niego Selly odbija
   * HTTP 400 „Brak wymaganego argumentu attributes" (poprawka Ani z 2026-09-08 12:50,
   * `discovery.cjs.bak-2026-09-08-1250`).
   */
  async function utworzWariant(
    productId: number,
    wiersz: WierszBridge,
  ): Promise<{ variant_id?: number; feature_id_magazyn?: number | null; error?: string }> {
    const featureId = featureIdDlaDostawcy(wiersz.dostawca);
    const cialo = {
      quantity: wiersz.stan ?? 0,
      price: wiersz.cena_sprzedazy ?? 0,
      vat: wiersz.vat_rate ?? 23,
      ean: wiersz.ean || "",
      default: 0,
      attributes: [] as unknown[],
      ...(featureId
        ? {
            features: [
              { feature_id: featureId, name: "Magazyny", value: wiersz.dostawca ?? undefined },
            ],
          }
        : {}),
    };

    try {
      const odp = await wykonajZPonowieniem(`POST /api/products/${productId}/variants`, () =>
        klient.createVariant(productId, cialo),
      );
      const utworzony = odp?.data;
      if (!utworzony?.variant_id) {
        return { error: "POST variant nie zwrocil variant_id: " + JSON.stringify(odp?.data) };
      }
      // Nie znaliśmy `feature_id` — odkryj je po fakcie z odpowiedzi Selly.
      if (!featureId) {
        const mag = cechaMagazynu(utworzony);
        if (mag) naucz(wiersz.dostawca, mag.feature_id);
      }
      return {
        variant_id: utworzony.variant_id,
        feature_id_magazyn: featureId ?? featureIdDlaDostawcy(wiersz.dostawca),
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Port `createProduct()` (`:145-186`) — zakładanie produktu od zera.
   *
   * ⚠⚠ TA ŚCIEŻKA JEST W PRODUKCJI ZEPSUTA I ODTWARZAMY TO 1:1 (ticket 45, decyzja D5).
   * Oryginał woła `mapper.buildProductPayload(bridgeRow, dictMaps)`, a `mapper_v2.cjs`
   * takiej funkcji NIE EKSPORTUJE (ani `mapper.cjs` v1) — sprawdzone na `main`. U Ani
   * kończy się to `TypeError`, złapanym przez `catch` i zwróconym jako `{ error }`.
   * Nie dopisujemy brakującej funkcji, bo to byłoby projektowanie Toru 2 w tickecie o Torze 1.
   *
   * Z Toru 1 nieosiągalne: `syncDelta` woła `zapewnijMapowanie` BEZ słowników, więc
   * sterowanie zatrzymuje się krok wcześniej (`not_found` → `pending_create`).
   * Domknięcie ścieżki należy do 13d-2.
   */
  async function utworzProdukt(
    _wiersz: WierszBridge,
    _slowniki: SlownikiSelly,
  ): Promise<{
    product_id?: number;
    variant_id?: number;
    feature_id_magazyn?: number | null;
    error?: string;
  }> {
    return {
      error:
        "mapper.buildProductPayload is not a function" +
        " (funkcja nie istnieje w mapper_v2 — defekt produkcji odtworzony 1:1, ticket 45 D5)",
    };
  }

  /** UPSERT mapowania — `ON CONFLICT(kod_importu, dostawca) DO UPDATE` jak w oryginale. */
  function zapiszMapowanie(
    db: Baza,
    wiersz: WierszBridge,
    dane: {
      productId: number;
      variantId: number | null;
      featureId: number | null;
      categoryId?: number | null;
      producerId?: number | null;
    },
  ): void {
    db.run(
      sql`INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id,
            selly_variant_id, selly_category_id, selly_producer_id, feature_id_magazyn,
            ostatni_status, ostatnia_sync)
          VALUES (${wiersz.kod_importu}, ${wiersz.dostawca}, ${wiersz.kod}, ${dane.productId},
            ${dane.variantId}, ${dane.categoryId ?? null}, ${dane.producerId ?? null},
            ${dane.featureId}, 'ok', datetime('now'))
          ON CONFLICT(kod_importu, dostawca) DO UPDATE SET
            selly_product_id = excluded.selly_product_id,
            selly_variant_id = excluded.selly_variant_id,
            feature_id_magazyn = excluded.feature_id_magazyn,
            bridge_kod = excluded.bridge_kod`,
    );
  }

  /**
   * GŁÓWNA FUNKCJA — port `ensureMapping()` (`discovery.cjs:194-274`).
   *
   * Pięć kroków, w tej kolejności:
   *  1. trafienie w cache `selly_products` (tylko gdy jest `selly_variant_id`) → `cache_hit`;
   *  2. szukanie produktu w Selly po EAN;
   *  3. gdy EAN nie trafił — „rodzeństwo": inny wariant TEGO SAMEGO `kod_importu` już
   *     zmapowany, więc `selly_product_id` jest znane bez pytania Selly;
   *  4. produkt znaleziony → wariant dla naszego dostawcy (`found_variant`) albo nowy
   *     wariant (`created_variant`);
   *  5. produktu nie ma → bez słowników `not_found`, ze słownikami `created_product`.
   */
  async function zapewnijMapowanie(
    db: Baza,
    wiersz: WierszBridge,
    slowniki: SlownikiSelly | null = null,
  ): Promise<WynikMapowania> {
    const { kod_importu, dostawca, ean } = wiersz;
    if (!kod_importu || !dostawca) {
      return { error: "brak kod_importu lub dostawca" };
    }

    // 1. Cache
    const zCache = db
      .all<{
        selly_product_id: number;
        selly_variant_id: number | null;
        feature_id_magazyn: number | null;
      }>(
        sql`SELECT selly_product_id, selly_variant_id, feature_id_magazyn
            FROM selly_products WHERE kod_importu = ${kod_importu} AND dostawca = ${dostawca}`,
      )
      .at(0);

    if (zCache?.selly_variant_id) {
      return {
        product_id: zCache.selly_product_id,
        variant_id: zCache.selly_variant_id,
        feature_id_magazyn: zCache.feature_id_magazyn,
        action: "cache_hit",
      };
    }

    // 2. Produkt w Selly po EAN
    let productId: number | null = null;
    if (ean) {
      productId = await znajdzProduktPoEan(ean);
    }

    // 3. „Rodzeństwo" — inny wariant tego samego kod_importu
    if (!productId) {
      const rodzenstwo = db
        .all<{ selly_product_id: number }>(
          sql`SELECT selly_product_id FROM selly_products
              WHERE kod_importu = ${kod_importu} AND selly_product_id IS NOT NULL LIMIT 1`,
        )
        .at(0);
      if (rodzenstwo) productId = rodzenstwo.selly_product_id;
    }

    // 4. Produkt jest — szukamy albo tworzymy wariant
    if (productId) {
      const warianty = await pobierzWarianty(productId);
      const wariant = wariantDlaDostawcy(warianty, dostawca);

      if (wariant) {
        const featureId = cechaMagazynu(wariant)?.feature_id ?? null;
        zapiszMapowanie(db, wiersz, {
          productId,
          variantId: wariant.variant_id,
          featureId,
        });
        return {
          product_id: productId,
          variant_id: wariant.variant_id,
          feature_id_magazyn: featureId,
          action: "found_variant",
        };
      }

      const utworzony = await utworzWariant(productId, wiersz);
      if (utworzony.error) {
        return { error: "createVariant: " + utworzony.error, action: "not_found" };
      }
      zapiszMapowanie(db, wiersz, {
        productId,
        variantId: utworzony.variant_id ?? null,
        featureId: utworzony.feature_id_magazyn ?? null,
      });
      return {
        product_id: productId,
        variant_id: utworzony.variant_id,
        feature_id_magazyn: utworzony.feature_id_magazyn,
        action: "created_variant",
      };
    }

    // 5. Produktu nie ma w Selly
    //
    // ⚠ KOMUNIKAT JEST CZĘŚCIĄ KONTRAKTU WEWNĘTRZNEGO — `oznaczBlad` w `sync-delta.ts`
    // rozpoznaje `pending_create` po JEGO TREŚCI (`sync_delta.cjs:86-89`). Zmiana słowa
    // w tym stringu po cichu zamieni „zaplanowana robota dla Tor 2" w „awaria".
    if (!slowniki) {
      return {
        error: "produkt nie istnieje w Selly ale brak dictMaps do createProduct",
        action: "not_found",
      };
    }

    const utworzony = await utworzProdukt(wiersz, slowniki);
    if (utworzony.error) {
      return { error: "createProduct: " + utworzony.error, action: "not_found" };
    }
    zapiszMapowanie(db, wiersz, {
      productId: utworzony.product_id as number,
      variantId: utworzony.variant_id ?? null,
      featureId: utworzony.feature_id_magazyn ?? null,
      categoryId: slowniki.catMap?.get(wiersz.kategoria ?? "") ?? null,
      producerId: slowniki.prodMap?.get(wiersz.marka ?? "") ?? null,
    });
    return {
      product_id: utworzony.product_id,
      variant_id: utworzony.variant_id,
      feature_id_magazyn: utworzony.feature_id_magazyn,
      action: "created_product",
    };
  }

  return {
    zapewnijMapowanie,
    znajdzProduktPoEan,
    pobierzWarianty,
    wariantDlaDostawcy,
    utworzWariant,
    utworzProdukt,
    featureIdDlaDostawcy,
    naucz,
    wykonajZPonowieniem,
  };
}
