/**
 * TOR 2: pełna synchronizacja Bridge → Selly (nocna albo ręczna) — port
 * `origin/main:mirror/backend/selly/sync_full.cjs` (karta I15.7, ticket 109; produkcja zamrożona
 * na 7d6cfc9, stan po `5dedefb` — backlog #81).
 *
 * Model: Bridge `(kod_importu, dostawca)` → Selly `(product_id, variant_id)`.
 *
 * Aktualizuje pola produktu (`name`, `weight`, `ean`, `provider_code`, `price_purchase`,
 * `visible`), a u KANONICZNEGO rekordu wspólnego produktu także cechy (lustro) i `category_id`.
 * NIE aktualizuje: VAT (nadawany w Selly na kategorii), ceny i stanu (Tor 1, `sync-delta.ts`).
 *
 * Trzy ścieżki na rekord:
 *   A. wariant jest w cache `selly_products` → `PUT /api/products/{pid}` (właściciel metadanych:
 *      najpierw `GET /api/products/{pid}`, potem PUT z cechami i kategorią — #81);
 *   B. produkt w Selly jest, wariantu brak → `discovery.ensureMapping` zakłada wariant, potem PUT;
 *   C. produktu nie ma → `discovery.ensureMapping` zakłada produkt (auto-create), potem PUT.
 *
 * Wołający w oryginale: `scheduler_selly.cjs:93` (`runFullBatch`, rotacja dostawców, `buildCache`
 * tylko dla pierwszego w partii) i `routes_sync.cjs:72` (`sync-full-supplier`, `{autoCreate}`) —
 * oba to karta I15.8. Instancja discovery jest ARGUMENTEM: jedna na proces, wspólna z Torem 1
 * (nota w `discovery.ts`).
 *
 * ⚠ `dryRun` Toru 2 nie woła Selly poza budową cache kodów (same odczyty): ścieżka A pomija GET
 * i PUT, B/C w ogóle nie wchodzą do discovery. Twardą blokadą zapisów i tak jest `SELLY_TRYB`.
 * ⚠ Gałęzie „PUT zwrócił status spoza 2xx” są martwe — klient rzuca na non-2xx, więc błąd HTTP
 * trafia do `catch` z komunikatem `[Selly] HTTP …` (jak w Torze 1). Zostają, bo są w oryginale.
 */

import type { Baza } from "../../db/index.js";
import type { Discovery, SlownikiSelly, WierszBridge } from "./discovery.js";
import { globalnyLimiter } from "./limiter.js";
import { toSellyPayloadV2, type PayloadV2, type WierszMapperaV2 } from "./mapper-v2.js";

/** Wiersz `collectFullSyncItems` — kolumny SQL-a, dlatego `snake_case`. */
export type WierszFull = WierszBridge &
  WierszMapperaV2 & {
    bridge_product_id: number;
    kod: string;
    kod_importu: string;
    dostawca: string;
    vat: number | null;
    selly_product_id: number | null;
    selly_variant_id: number | null;
    feature_id_magazyn: number | null;
    stan_wyslany: number | null;
    cena_sprzedazy_wyslana: number | null;
    cena_zakupu_wyslana: number | null;
  };

/** Słowniki Toru 2 — `catMap` z `selly_kategoria_norm_map`, `prodMap`/`whMap` z `selly_dict`. */
export type SlownikiToru2 = Required<SlownikiSelly>;

export type StatystykiFull = {
  total: number;
  updated_A: number;
  created_variant_B: number;
  created_C: number;
  err: number;
  skip: number;
  dry: number;
};

export type BladFull = { kod: string; kod_importu: string; error: string };

export type WynikSyncFull = {
  stats: StatystykiFull;
  errors: BladFull[];
  logId: number;
  durationMs: number;
};

export type OpcjeSyncFull = {
  dryRun?: boolean;
  maxProducts?: number;
  autoCreate?: boolean;
  /** Budować cache kodów Selly przed pętlą (harmonogram: tylko dla pierwszego dostawcy partii). */
  buildCache?: boolean;
};

type WynikRekordu = { action: string; [pole: string]: unknown };

const komunikat = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Port `collectFullSyncItems()` (`:36-60`) — SQL verbatim. Tylko `aktywny` z `kod_importu`;
 * EAN NIE jest wymagany (inaczej niż w Torze 1) — produkty bez EAN idą ścieżką B/C przez cache kodów.
 */
export function collectFullSyncItems(db: Baza, dostawca: string): WierszFull[] {
  return db.$client
    .prepare(
      `
    SELECT
      p.id AS bridge_product_id,
      p.kod, p.kod_importu, p.dostawca, p.ean, p.nazwa,
      p.marka, p.kategoria, p.status, p.stan, p.waga,
      p.cena_sprzedazy, p.cena_zakupu, p.vat,
      p.bieznik, p.rozmiar, p.szerokosc, p.profil, p.srednica,
      p.rozmiar_alternatywny, p.konstrukcja, p.pr, p.tl_tt,
      p.indeksy, p.indeks_nosnosci, p.indeks_predkosci, p.dot,
      p.zastosowanie, p.label_wet, p.label_rolling, p.label_noise,
      p.ms, p.snow_3pmsf, p.label_snow, p.ean_is_valid,
      p.kod_dostawcy,
      sp.selly_product_id, sp.selly_variant_id, sp.feature_id_magazyn,
      sp.stan_wyslany, sp.cena_sprzedazy_wyslana, sp.cena_zakupu_wyslana
    FROM products p
    LEFT JOIN selly_products sp ON sp.kod_importu = p.kod_importu AND sp.dostawca = p.dostawca
    WHERE p.dostawca = ?
      AND p.status = 'aktywny'
      AND p.kod_importu IS NOT NULL AND p.kod_importu != ''
    ORDER BY p.kod
  `,
    )
    .all(dostawca) as WierszFull[];
}

/**
 * Port `loadDictMaps()` (`:74-92`) — słowniki auto-create:
 *   - `catMap`: `kategoria_raw.toLowerCase()` → `category_id_glowna` z `selly_kategoria_norm_map`
 *     (żywe kategorie główne Selly; stare 137/259/377 dają 404 — backlog #74, zero ID w kodzie);
 *   - `prodMap`: `selly_dict` `producers` (`klucz` → `wartosc_id`);
 *   - `whMap`: `selly_dict` `warehouses`.
 */
export function loadDictMaps(db: Baza): SlownikiToru2 {
  const maps: SlownikiToru2 = { catMap: new Map(), prodMap: new Map(), whMap: new Map() };
  const sqlite = db.$client;

  const cats = sqlite.prepare("SELECT kategoria_raw, category_id_glowna FROM selly_kategoria_norm_map").all() as {
    kategoria_raw: string;
    category_id_glowna: number;
  }[];
  for (const r of cats) {
    maps.catMap.set(String(r.kategoria_raw).toLowerCase(), r.category_id_glowna);
  }

  const dict = sqlite.prepare("SELECT slownik, klucz, wartosc_id FROM selly_dict").all() as {
    slownik: string;
    klucz: string;
    wartosc_id: number;
  }[];
  for (const r of dict) {
    if (r.slownik === "producers") maps.prodMap.set(r.klucz, r.wartosc_id);
    else if (r.slownik === "warehouses") maps.whMap.set(r.klucz, r.wartosc_id);
  }
  return maps;
}

/** `logSyncStart` (`:97-104`) — własna kopia Toru 2 (w oryginale osobna od `sync_delta.cjs`). */
function logSyncStart(db: Baza, dostawca: string): number {
  const info = db.$client
    .prepare(
      `INSERT INTO selly_sync_log (operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip,
                                 rozpoczeto, status)
    VALUES ('sync_full', ?, 0, 0, 0, datetime('now'), 'w_trakcie')`,
    )
    .run(dostawca || "ALL");
  return Number(info.lastInsertRowid);
}

/** `logSyncEnd` (`:106-113`) — szczegóły ucinane do 8000 znaków. */
function logSyncEnd(
  db: Baza,
  logId: number,
  ok: number,
  err: number,
  skip: number,
  details: unknown,
  status = "zakonczono",
): void {
  db.$client
    .prepare(
      `UPDATE selly_sync_log
    SET liczba_ok = ?, liczba_blad = ?, liczba_skip = ?,
        szczegoly_json = ?, zakonczono = datetime('now'), status = ?
    WHERE id = ?`,
    )
    .run(ok, err, skip, JSON.stringify(details).slice(0, 8000), status, logId);
}

/** `markProductSynced` (`:118-125`) — cena i stan to domena Toru 1, tu tylko `cena_zakupu_wyslana`. */
function markProductSynced(db: Baza, row: WierszFull): void {
  db.$client
    .prepare(
      `UPDATE selly_products
    SET ostatnia_sync = datetime('now'), ostatni_status = 'ok', ostatni_blad = NULL,
        cena_zakupu_wyslana = ?
    WHERE kod_importu = ? AND dostawca = ?`,
    )
    .run(Number(row.cena_zakupu) || 0, row.kod_importu, row.dostawca);
}

/**
 * `markError` (`:127-135`). Brak kategorii/producenta w słowniku → `missing_dict`, reszta → `error`.
 * ⚠ Inna klasyfikacja niż `markError` Toru 1 (tam `pending_create`) — w oryginale to dwie osobne
 * funkcje. ⚠ Sam `UPDATE` bez `INSERT` (jak #69): rekord bez wiersza w `selly_products` nie
 * zostawia śladu poza `selly_sync_log`.
 */
function markError(db: Baza, row: WierszFull, error: unknown): void {
  const errStr = String(error);
  const status = /Brak kategorii|Brak producenta/.test(errStr) ? "missing_dict" : "error";
  db.$client
    .prepare(
      `UPDATE selly_products
    SET ostatnia_sync = datetime('now'), ostatni_status = ?, ostatni_blad = ?
    WHERE kod_importu = ? AND dostawca = ?`,
    )
    .run(status, errStr.slice(0, 500), row.kod_importu, row.dostawca);
}

/** Kolumny liczone przez `metadataScore` (`:137-148`) — 20 kolumn cech + `marka`. */
const POLA_METADANYCH = [
  "bieznik",
  "rozmiar",
  "szerokosc",
  "profil",
  "srednica",
  "rozmiar_alternatywny",
  "konstrukcja",
  "pr",
  "tl_tt",
  "indeksy",
  "indeks_nosnosci",
  "indeks_predkosci",
  "dot",
  "zastosowanie",
  "label_wet",
  "label_rolling",
  "label_noise",
  "ms",
  "snow_3pmsf",
  "label_snow",
  "marka",
] as const;

/**
 * Ile pól metadanych rekord ma wypełnionych. ⚠ Pustym jest tylko `null` i `''` — `0` (np. flaga
 * `ms = 0`) liczy się jako wypełnione. Tak jest w oryginale.
 */
function metadataScore(row: Record<string, unknown>): number {
  return POLA_METADANYCH.reduce((sum, key) => sum + (row[key] !== null && row[key] !== "" ? 1 : 0), 0);
}

type KandydatMetadanych = Record<string, unknown> & { id: number; status: string | null; kategoria: string | null };

/**
 * `isMetadataOwner()` (`:156-172`, #81). Jeden produkt Selly może mieć warianty od kilku
 * dostawców, a cechy i kategoria są WSPÓLNE dla produktu — pisze je tylko jeden kanoniczny rekord
 * Bridge: najwięcej wypełnionych metadanych, remis → najniższe `products.id`. Kandydaci to
 * aktywne rekordy grupy (a gdy żadnego — wszystkie). Grupa z różnymi kategoriami (albo bez
 * żadnej) jest celowo pomijana — wymaga rozdzielenia na osobne produkty Selly.
 */
function isMetadataOwner(db: Baza, row: WierszFull): boolean {
  if (!row.selly_product_id) return false;
  const candidates = db.$client
    .prepare(
      `
    SELECT p.*
    FROM selly_products sp
    JOIN products p
      ON p.kod_importu = sp.kod_importu
     AND p.dostawca = sp.dostawca
    WHERE sp.selly_product_id = ?
  `,
    )
    .all(row.selly_product_id) as KandydatMetadanych[];
  const active = candidates.filter((candidate) => candidate.status === "aktywny");
  const preferred = active.length ? active : candidates;
  const categories = new Set(preferred.map((candidate) => candidate.kategoria).filter(Boolean));
  if (categories.size !== 1) return false;
  preferred.sort((a, b) => metadataScore(b) - metadataScore(a) || a.id - b.id);
  return preferred.length > 0 && preferred[0]?.id === row.bridge_product_id;
}

/**
 * Ścieżka A (`:182-216`): wariant jest w cache.
 *
 * Test produkcyjny 2026-09-17 (`5dedefb`) potwierdził, że `PUT /api/products/{pid}` PRZYJMUJE
 * pełną tablicę `features` (mimo że nie ma jej w `fields_edit`) — ustalenie z 08.09 „PUT nie
 * przyjmuje features” jest obalone. Cechy i kategorię pisze tylko właściciel metadanych.
 */
async function updateExistingVariant(
  db: Baza,
  discovery: Discovery,
  row: WierszFull,
  dictMaps: SlownikiToru2,
  opts: { dryRun: boolean },
): Promise<WynikRekordu> {
  const { dryRun } = opts;
  // `selly_product_id` przy istniejącym `selly_variant_id` — w oryginale bez sprawdzenia.
  const productId = row.selly_product_id as number;
  const variantId = row.selly_variant_id;
  const metadataOwner = isMetadataOwner(db, row);

  let productPayload: PayloadV2 = toSellyPayloadV2(row, { includeFeatures: false });
  if (metadataOwner && !dryRun) {
    const current = await discovery.apiWithRetry(`GET /api/products/${productId}`, async () => ({
      status: 200,
      data: await discovery.klient.getProduct(productId),
    }));
    const currentProduct = current.data?.data || current.data || {};
    productPayload = toSellyPayloadV2(row, {
      includeFeatures: true,
      existingSellyFeatures: currentProduct.features || [],
    });
    const categoryId = dictMaps.catMap.get(String(row.kategoria || "").toLowerCase());
    if (categoryId) productPayload.category_id = categoryId;
  }

  if (dryRun) {
    return { action: "dry_A", metadata_owner: metadataOwner, payload_product: productPayload };
  }

  const putProduct = await wyslijProdukt(discovery, productId, productPayload);
  if (putProduct.status < 200 || putProduct.status >= 300) {
    throw new Error(`PUT product HTTP ${putProduct.status}: ${JSON.stringify(putProduct.data).slice(0, 300)}`);
  }

  markProductSynced(db, row);
  return { action: "updated_A", product_id: productId, variant_id: variantId };
}

/** `apiWithRetry('PUT', /api/products/{pid}, {body})` — klient rzuca na non-2xx, więc tu zawsze 2xx. */
function wyslijProdukt(discovery: Discovery, productId: number, payload: PayloadV2) {
  return discovery.apiWithRetry(`PUT /api/products/${productId}`, async () => ({
    status: 200,
    data: await discovery.klient.updateProduct(productId, payload),
  }));
}

/**
 * Ścieżki B i C (`:222-253`): brak wariantu w cache — mapowanie zapewnia discovery (znajdzie albo
 * założy wariant/produkt), potem PUT pól produktu BEZ cech: cechy nowego produktu wysłało już
 * `createProduct` (C), a „Magazyny” wariantu — `createVariant` (B).
 */
async function ensureAndUpdate(
  db: Baza,
  discovery: Discovery,
  row: WierszFull,
  dictMaps: SlownikiToru2,
  opts: { dryRun: boolean },
): Promise<WynikRekordu> {
  const { dryRun } = opts;

  if (dryRun) {
    const hasEan = !!row.ean;
    return { action: "dry_BorC", hasEan, sample_payload: toSellyPayloadV2(row, { includeFeatures: true }) };
  }

  const mapping = await discovery.ensureMapping(db, row, dictMaps);
  if (mapping.error || !mapping.variant_id) {
    throw new Error("ensureMapping: " + (mapping.error || "brak variant_id"));
  }

  const productId = mapping.product_id as number;
  const productPayload = toSellyPayloadV2(row, { includeFeatures: false });
  const putProduct = await wyslijProdukt(discovery, productId, productPayload);
  if (putProduct.status < 200 || putProduct.status >= 300) {
    throw new Error(
      `PUT product po discovery HTTP ${putProduct.status}: ${JSON.stringify(putProduct.data).slice(0, 300)}`,
    );
  }

  markProductSynced(db, row);
  return {
    action: mapping.action === "created_product" ? "created_C" : "created_variant_B",
    product_id: mapping.product_id,
    variant_id: mapping.variant_id,
    discovery_action: mapping.action,
  };
}

/**
 * GŁÓWNA FUNKCJA Toru 2 — port `syncFullForDostawca(db, dostawca, opts)` (`:261-333`); instancja
 * discovery jest drugim argumentem (jak w `syncDelta`).
 *
 * Cache kodów Selly (`buildProductCodeCache`, ~314 stron) budowany tylko przy `buildCache &&
 * autoCreate`; jego błąd jest połykany (ostrzeżenie, dalej tylko EAN/rodzeństwo). Status logu
 * `blad` wyłącznie wtedy, gdy były błędy i ANI JEDEN rekord się nie udał.
 */
export async function syncFullForDostawca(
  db: Baza,
  discovery: Discovery,
  dostawca: string,
  opts: OpcjeSyncFull = {},
): Promise<WynikSyncFull> {
  const { dryRun = false, maxProducts = 5000, autoCreate = true, buildCache = true } = opts;

  if (!dostawca) throw new Error("sync_full: dostawca wymagany");

  const startTs = Date.now();

  if (buildCache && autoCreate) {
    try {
      const cacheRes = await discovery.buildProductCodeCache();
      const rozmiar = "providerSize" in cacheRes ? cacheRes.providerSize || cacheRes.size : cacheRes.size;
      console.log(`[sync_full] Cache Selly: ${cacheRes.hit}, ${rozmiar} entries`);
    } catch (e) {
      console.warn(`[sync_full] Cache Selly build ERROR (fallback: tylko EAN): ${komunikat(e)}`);
    }
  }

  const rows = collectFullSyncItems(db, dostawca);
  const limited = rows.slice(0, maxProducts);

  const dictMaps = loadDictMaps(db);
  const logId = logSyncStart(db, dostawca);

  const stats: StatystykiFull = {
    total: limited.length,
    updated_A: 0,
    created_variant_B: 0,
    created_C: 0,
    err: 0,
    skip: 0,
    dry: 0,
  };
  const errors: BladFull[] = [];
  const details: Record<string, unknown> = { dostawca, dryRun, autoCreate };

  console.log(
    `[sync_full] Start: dostawca=${dostawca}, ${limited.length} produktow, dryRun=${dryRun}, autoCreate=${autoCreate}`,
  );

  for (const row of limited) {
    try {
      // Backlog #104 (`abe5f14`): cykl Toru 2 trwa długo, a import mógł w tym czasie wstrzymać
      // pozycję. Status i stan czytamy więc DOPIERO TERAZ, z bazy, a nie z migawki sprzed biegu.
      // Wstrzymany po rozpoczęciu cyklu jest pomijany — inaczej wysłalibyśmy nieaktualny stan.
      const live = db.$client
        .prepare("SELECT status, stan FROM products WHERE id = ?")
        .get(row.bridge_product_id) as { status: string; stan: number | null } | undefined;
      if (!live || live.status !== "aktywny") {
        stats.skip++;
        continue;
      }
      row.stan = live.stan;

      let result: WynikRekordu;
      if (row.selly_variant_id) {
        result = await updateExistingVariant(db, discovery, row, dictMaps, { dryRun });
      } else {
        if (!autoCreate) {
          stats.skip++;
          continue;
        }
        result = await ensureAndUpdate(db, discovery, row, dictMaps, { dryRun });
      }

      if (dryRun) {
        stats.dry++;
      } else if (result.action === "updated_A") {
        stats.updated_A++;
      } else if (result.action === "created_variant_B") {
        stats.created_variant_B++;
      } else if (result.action === "created_C") {
        stats.created_C++;
      }
    } catch (e) {
      const msg = komunikat(e);
      stats.err++;
      errors.push({ kod: row.kod, kod_importu: row.kod_importu, error: msg.slice(0, 300) });
      if (!dryRun) markError(db, row, msg);
    }
  }

  const durationMs = Date.now() - startTs;
  details.stats = stats;
  details.duration_ms = durationMs;
  details.sample_errors = errors.slice(0, 20);
  details.limiter = globalnyLimiter.getStats?.() || null;

  const totalOk = stats.updated_A + stats.created_variant_B + stats.created_C;
  logSyncEnd(
    db,
    logId,
    totalOk,
    stats.err,
    stats.skip + stats.dry,
    details,
    stats.err > 0 && totalOk === 0 ? "blad" : "zakonczono",
  );

  console.log(
    `[sync_full] Koniec: A=${stats.updated_A}, B=${stats.created_variant_B}, C=${stats.created_C}, err=${stats.err}, skip=${stats.skip}, dry=${stats.dry}, time=${(durationMs / 1000).toFixed(1)}s`,
  );
  return { stats, errors, logId, durationMs };
}
