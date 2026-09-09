/**
 * TOR 1 — szybka synchronizacja delty (stan i cena) — port
 * `mirror/backend/selly/sync_delta.cjs` (Iteracja 13d-1, ticket 45).
 *
 * Aktualizuje WYŁĄCZNIE `quantity` i `price` na WARIANCIE:
 * `PUT /api/products/{pid}/variants/{vid}`. Nazw, kategorii ani cech nie rusza — to robota
 * Toru 2 (`sync_full`, karta 13d-2). Mapowanie bierze z `discovery.ts` (lazy, po EAN).
 *
 * ⚠ Dlaczego wariant, a nie produkt: w Selly cena i stan są PER WARIANT (19% produktów ma
 * >1 wariant), a bulk-endpoint `/api/products/helper/warehouse_quantity` zwracał dla nich
 * HTTP 400 (backlog #60, CHANGELOG 2026-09-07 20:03).
 */

import { sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import type { Discovery, WierszBridge } from "./discovery.js";
import type { KlientSelly } from "./klient.js";

/** Wiersz wyniku `znajdzProduktyDelta` — projekcja jawna, jak w `SELECT` oryginału. */
export type WierszDelty = WierszBridge & {
  nazwa: string | null;
  marka: string | null;
  kategoria: string | null;
  cena_zakupu: number | null;
  vat_rate: number | null;
  selly_product_id: number | null;
  selly_variant_id: number | null;
  feature_id_magazyn: number | null;
  stan_wyslany: number | null;
  cena_sprzedazy_wyslana: number | null;
};

export type StatystykiDelty = {
  total: number;
  ok: number;
  err: number;
  skip: number;
  discovered: number;
  created: number;
};

export type BladProduktu = { kod: string; error: string };

export type WynikSyncDelta = {
  stats: StatystykiDelty;
  errors: BladProduktu[];
  logId: number;
};

/**
 * Port `findDeltaProducts()` (`sync_delta.cjs:22-47`).
 *
 * Warunek delty ma cztery gałęzie i pierwsza z nich jest istotna: `selly_variant_id IS NULL`
 * wciąga do przebiegu produkty JESZCZE NIEZMAPOWANE — to dla nich uruchomi się discovery.
 *
 * ⚠ Projekcja wypisana jawnie i wynik ma klucze `snake_case`. Nie `select()` bez listy pól:
 * Drizzle oddałby wtedy nazwy PÓL MODELU (camelCase), a cały ten moduł — jak oryginał —
 * czyta `row.kod_importu`, `row.cena_sprzedazy` itd. (CLAUDE.md, pułapka projekcji).
 */
export function znajdzProduktyDelta(
  db: Baza,
  dostawca: string | null = null,
  limit = 10000,
): WierszDelty[] {
  const filtrDostawcy = dostawca ? sql`AND p.dostawca = ${dostawca}` : sql``;
  return db.all<WierszDelty>(
    sql`SELECT p.kod, p.kod_importu, p.dostawca, p.ean, p.nazwa,
               p.marka, p.kategoria, p.stan, p.cena_sprzedazy, p.cena_zakupu, p.vat AS vat_rate,
               sp.selly_product_id, sp.selly_variant_id, sp.feature_id_magazyn,
               sp.stan_wyslany, sp.cena_sprzedazy_wyslana
        FROM products p
        LEFT JOIN selly_products sp
          ON sp.kod_importu = p.kod_importu AND sp.dostawca = p.dostawca
        WHERE p.status = 'aktywny'
          AND p.ean IS NOT NULL AND p.ean != ''
          AND p.kod_importu IS NOT NULL AND p.kod_importu != ''
          ${filtrDostawcy}
          AND (
            sp.selly_variant_id IS NULL
            OR sp.stan_wyslany IS NULL OR sp.stan_wyslany != p.stan
            OR sp.cena_sprzedazy_wyslana IS NULL OR sp.cena_sprzedazy_wyslana != p.cena_sprzedazy
          )
        LIMIT ${limit}`,
  );
}

/** Port `logSyncStart()` (`:52-60`). */
export function otworzLogSync(db: Baza, dostawca: string | null): number {
  db.run(
    sql`INSERT INTO selly_sync_log (operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip,
          rozpoczeto, status)
        VALUES ('sync_delta', ${dostawca ?? "ALL"}, 0, 0, 0, datetime('now'), 'w_trakcie')`,
  );
  const wiersz = db
    .all<{ id: number }>(sql`SELECT last_insert_rowid() AS id`)
    .at(0);
  return wiersz?.id ?? 0;
}

/** Port `logSyncEnd()` (`:62-71`) — `szczegoly_json` przycinany do 8000 znaków. */
export function zamknijLogSync(
  db: Baza,
  logId: number,
  ok: number,
  err: number,
  skip: number,
  szczegoly: unknown,
  status = "zakonczono",
): void {
  db.run(
    sql`UPDATE selly_sync_log
        SET liczba_ok = ${ok}, liczba_blad = ${err}, liczba_skip = ${skip},
            szczegoly_json = ${JSON.stringify(szczegoly).slice(0, 8000)},
            zakonczono = datetime('now'), status = ${status}
        WHERE id = ${logId}`,
  );
}

/**
 * Port `markSynced()` (`:76-89`).
 *
 * ⚠ `cena_zakupu_wyslana` zapisywana BEZWARUNKOWO z wiersza Bridge, mimo że Tor 1 ceny
 * zakupu do Selly w ogóle nie wysyła (payload to `{quantity, price}`). Tak jest u Ani
 * i tak zostaje — snapshot mija się tu z tym, co poszło na wariant.
 */
export function oznaczZsynchronizowany(
  db: Baza,
  wiersz: WierszDelty,
  cenaOk: boolean,
  stanOk: boolean,
): void {
  db.run(
    sql`UPDATE selly_products
        SET stan_wyslany = ${stanOk ? wiersz.stan : null},
            cena_sprzedazy_wyslana = ${cenaOk ? wiersz.cena_sprzedazy : null},
            cena_zakupu_wyslana = ${wiersz.cena_zakupu},
            ostatnia_sync = datetime('now'), ostatni_status = 'ok', ostatni_blad = NULL
        WHERE kod_importu = ${wiersz.kod_importu} AND dostawca = ${wiersz.dostawca}`,
  );
}

/**
 * Port `markError()` (`:91-104`).
 *
 * ⭐ TU MIESZKA ROZRÓŻNIENIE „awaria" vs „zaplanowana robota dla Toru 2". Nieznany
 * produkt (bez słowników discovery go nie założy) dostaje `pending_create`, nie `error` —
 * i rozpoznanie idzie po TREŚCI komunikatu, nie po kodzie błędu. Dlatego string
 * „produkt nie istnieje w Selly ale brak dictMaps do createProduct" w `discovery.ts` jest
 * kontraktem wewnętrznym: przeredagowanie go zamieni tysiące `pending_create` w `error`.
 *
 * ⚠ `UPDATE` bez `INSERT`: gdy discovery nie zdążyło zapisać mapowania, ten zapis nie trafia
 * w żaden wiersz i przepada po cichu — 1:1 z oryginałem.
 */
export function oznaczBlad(db: Baza, wiersz: WierszDelty, blad: unknown): void {
  const tekst = String(blad);
  const czekaNaUtworzenie =
    tekst.includes("brak dictMaps do createProduct") ||
    tekst.includes("produkt nie istnieje w Selly");
  const status = czekaNaUtworzenie ? "pending_create" : "error";
  db.run(
    sql`UPDATE selly_products
        SET ostatnia_sync = datetime('now'), ostatni_status = ${status},
            ostatni_blad = ${tekst.slice(0, 500)}
        WHERE kod_importu = ${wiersz.kod_importu} AND dostawca = ${wiersz.dostawca}`,
  );
}

export type ZaleznosciSyncDelta = {
  db: Baza;
  klient: KlientSelly;
  /**
   * Throttle jest W ŚRODKU `discovery.wykonajZPonowieniem` — ten moduł nie dostaje limitera
   * osobno, bo oryginał też go tu nie używa: `sync_delta.cjs:14` importuje `globalLimiter`,
   * ale ani razu go nie woła (komentarz nad importem mówi wprost, że throttle przychodzi
   * z `apiWithRetry`). Wstrzykiwanie limitera drugi raz dałoby podwójne dławienie.
   */
  discovery: Discovery;
};

export type OpcjeSyncDelta = { dryRun?: boolean; maxProducts?: number };

/**
 * GŁÓWNA FUNKCJA — port `syncDelta()` (`sync_delta.cjs:112-181`).
 *
 * Dla każdego wiersza: mapowanie (z wiersza albo z discovery) → PUT wariantu → snapshot.
 * `dryRun` przerywa PRZED wywołaniem Selly, ale JUŻ PO ewentualnym discovery — czyli
 * „na sucho" i tak potrafi założyć wariant w Selly. Tak jest u Ani i to zostaje.
 */
export async function syncDelta(
  { db, klient, discovery }: ZaleznosciSyncDelta,
  dostawca: string | null = null,
  opcje: OpcjeSyncDelta = {},
): Promise<WynikSyncDelta> {
  const { dryRun = false, maxProducts = 5000 } = opcje;
  const wiersze = znajdzProduktyDelta(db, dostawca, maxProducts);
  const logId = otworzLogSync(db, dostawca);

  const stats: StatystykiDelty = {
    total: wiersze.length,
    ok: 0,
    err: 0,
    skip: 0,
    discovered: 0,
    created: 0,
  };
  const errors: BladProduktu[] = [];

  console.log(
    `[sync_delta] Start: ${wiersze.length} produktow, dostawca=${dostawca || "ALL"}, dryRun=${dryRun}`,
  );

  for (const wiersz of wiersze) {
    try {
      // 1. Mapowanie — z wiersza (cache) albo lazy discovery.
      let mapowanie;
      if (wiersz.selly_variant_id) {
        mapowanie = {
          product_id: wiersz.selly_product_id ?? undefined,
          variant_id: wiersz.selly_variant_id,
          feature_id_magazyn: wiersz.feature_id_magazyn,
          action: "cache_hit" as const,
        };
      } else {
        // ⚠ BEZ słowników — i to jest cały mechanizm `pending_create` (patrz `oznaczBlad`).
        mapowanie = await discovery.zapewnijMapowanie(db, wiersz);
        if (mapowanie.action === "found_variant" || mapowanie.action === "created_variant") {
          stats.discovered++;
        }
      }

      if (mapowanie.error || !mapowanie.variant_id) {
        stats.err++;
        errors.push({ kod: wiersz.kod, error: mapowanie.error ?? "brak variant_id" });
        oznaczBlad(db, wiersz, mapowanie.error ?? "discovery: brak variant_id");
        continue;
      }

      // 2. Tryb „na sucho" — nie dotykamy Selly.
      if (dryRun) {
        stats.skip++;
        console.log(
          `  [DRY] ${wiersz.kod} -> pid=${mapowanie.product_id} vid=${mapowanie.variant_id}` +
            ` qty=${wiersz.stan} price=${wiersz.cena_sprzedazy}`,
        );
        continue;
      }

      // 3. PUT wariantu. `wykonajZPonowieniem` robi throttle przed wywołaniem; 429 leci
      //    wyjątkiem do `catch` niżej i kończy jako `error` (decyzja D2).
      await discovery.wykonajZPonowieniem(
        `PUT /api/products/${mapowanie.product_id}/variants/${mapowanie.variant_id}`,
        () =>
          klient.updateVariant(mapowanie.product_id as number, mapowanie.variant_id as number, {
            quantity: wiersz.stan ?? 0,
            price: wiersz.cena_sprzedazy ?? 0,
          }),
      );

      stats.ok++;
      oznaczZsynchronizowany(db, wiersz, true, true);
    } catch (e) {
      stats.err++;
      const komunikat = e instanceof Error ? e.message : String(e);
      errors.push({ kod: wiersz.kod, error: komunikat });
      oznaczBlad(db, wiersz, komunikat);
    }
  }

  zamknijLogSync(
    db,
    logId,
    stats.ok,
    stats.err,
    stats.skip,
    { stats, sample_errors: errors.slice(0, 20) },
    // `blad` TYLKO gdy nic się nie udało — częściowe niepowodzenie to nadal „zakonczono".
    stats.err > 0 && stats.ok === 0 ? "blad" : "zakonczono",
  );

  console.log(
    `[sync_delta] Koniec: ok=${stats.ok}, err=${stats.err}, skip=${stats.skip}, discovered=${stats.discovered}`,
  );
  return { stats, errors, logId };
}
