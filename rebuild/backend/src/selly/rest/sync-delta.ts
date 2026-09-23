/**
 * TOR 1: szybki delta sync — port `origin/main:mirror/backend/selly/sync_delta.cjs`
 * (karta I15.6, ticket 108; produkcja zamrożona na 7d6cfc9).
 *
 * Aktualizuje TYLKO cenę i stan pozycji zmienionych od ostatniej wysyłki:
 * `PUT /api/products/{pid}/variants/{vid}` z ciałem `{quantity, price}`. Nazw, kategorii i cech
 * NIE rusza — to robi nocny `sync_full` (Tor 2, karta I15.7). Brakujące mapowania uzupełnia
 * leniwie `discovery.ensureMapping` — ale BEZ słowników, więc nowego produktu Tor 1 nie założy
 * (kończy się `pending_create`, backlog #68/#69).
 *
 * Wołający w oryginale: wyłącznie `scheduler_selly.cjs` (`syncDelta`) — montaż harmonogramu
 * to karta I15.8. `routes_sync.cjs` importuje nieistniejące `syncDeltaForDostawca`; ta karta
 * eksportuje nazwę, którą oryginał naprawdę ma (`syncDelta`), a los tamtej trasy rozstrzyga I15.8.
 *
 * ⚠ `dryRun` pomija TYLKO PUT ceny/stanu. Discovery idzie normalnie i MOŻE utworzyć wariant
 * w Selly (`createVariant`) — tak działa oryginał (`sync_delta.cjs:137,151`). Twardą blokadą
 * zapisów jest `SELLY_TRYB=tylko-odczyt`, nie `dryRun`.
 */

import type { Baza } from "../../db/index.js";
import type { Discovery, WierszBridge, WynikMapowania } from "./discovery.js";

/** Wiersz `findDeltaProducts` — kolumny SQL-a, dlatego `snake_case`. */
export type WierszDelta = WierszBridge & {
  kod_importu: string;
  dostawca: string;
  nazwa: string | null;
  stan: number | null;
  cena_sprzedazy: number | null;
  cena_zakupu: number | null;
  vat_rate: number | null;
  selly_product_id: number | null;
  selly_variant_id: number | null;
  feature_id_magazyn: number | null;
  stan_wyslany: number | null;
  cena_sprzedazy_wyslana: number | null;
};

export type StatystykiDelta = {
  total: number;
  ok: number;
  err: number;
  skip: number;
  discovered: number;
  created: number;
};

export type WynikSyncDelta = {
  stats: StatystykiDelta;
  errors: { kod: string; error: string }[];
  logId: number;
};

/**
 * Port `findDeltaProducts()` (`:22-54`) — SQL verbatim.
 *
 * Backlog #77: `wstrzymany` wchodzi TYLKO z istniejącym wariantem i wysyła stan 0 (zerujemy
 * wariant w sklepie, ale nie zakładamy produktu, który nigdy nie był opublikowany). EAN
 * i `kod_importu` są wymagane — produkt bez EAN-u Tor 1 pomija w ogóle.
 */
export function findDeltaProducts(db: Baza, dostawca: string | null = null, limit = 10000): WierszDelta[] {
  const where = [
    "(p.status = 'aktywny' OR (p.status = 'wstrzymany' AND sp.selly_variant_id IS NOT NULL))",
    "p.ean IS NOT NULL",
    "p.ean != ''",
    "p.kod_importu IS NOT NULL",
    "p.kod_importu != ''",
  ];
  const params: (string | number)[] = [];
  if (dostawca) {
    where.push("p.dostawca = ?");
    params.push(dostawca);
  }
  const sql = `
    SELECT p.kod, p.kod_importu, p.dostawca, p.ean, p.nazwa,
           p.marka, p.kategoria,
           CASE WHEN p.status = 'wstrzymany' THEN 0 ELSE p.stan END AS stan,
           p.cena_sprzedazy, p.cena_zakupu, p.vat AS vat_rate,
           sp.selly_product_id, sp.selly_variant_id, sp.feature_id_magazyn,
           sp.stan_wyslany, sp.cena_sprzedazy_wyslana
    FROM products p
    LEFT JOIN selly_products sp ON sp.kod_importu = p.kod_importu AND sp.dostawca = p.dostawca
    WHERE ${where.join(" AND ")}
      AND (
        sp.selly_variant_id IS NULL
        OR sp.stan_wyslany IS NULL
        OR sp.stan_wyslany != CASE WHEN p.status = 'wstrzymany' THEN 0 ELSE p.stan END
        OR sp.cena_sprzedazy_wyslana IS NULL OR sp.cena_sprzedazy_wyslana != p.cena_sprzedazy
      )
    LIMIT ?
  `;
  params.push(limit);
  return db.$client.prepare(sql).all(...params) as WierszDelta[];
}

/** `logSyncStart` (`:59-66`) — `dostawca_kod = 'ALL'`, gdy bez filtra. */
function logSyncStart(db: Baza, dostawca: string | null): number {
  const info = db.$client
    .prepare(
      `INSERT INTO selly_sync_log (operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip,
                                 rozpoczeto, status)
    VALUES ('sync_delta', ?, 0, 0, 0, datetime('now'), 'w_trakcie')`,
    )
    .run(dostawca || "ALL");
  return Number(info.lastInsertRowid);
}

/** `logSyncEnd` (`:68-75`) — szczegóły ucinane do 8000 znaków. */
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

/** `markSynced` (`:80-92`) — snapshot wysłanych wartości. */
function markSynced(db: Baza, row: WierszDelta, priceOk: boolean, stockOk: boolean): void {
  db.$client
    .prepare(
      `UPDATE selly_products
    SET stan_wyslany = ?, cena_sprzedazy_wyslana = ?, cena_zakupu_wyslana = ?,
        ostatnia_sync = datetime('now'), ostatni_status = 'ok', ostatni_blad = NULL
    WHERE kod_importu = ? AND dostawca = ?`,
    )
    .run(stockOk ? row.stan : null, priceOk ? row.cena_sprzedazy : null, row.cena_zakupu, row.kod_importu, row.dostawca);
}

/**
 * `markError` (`:94-106`). „Produkt nie istnieje w Selly” to `pending_create` (robota dla Toru 2),
 * reszta — `error`.
 *
 * ⚠ Backlog #69, odtworzone 1:1: sam `UPDATE` bez `INSERT`. Pozycja, która nie ma jeszcze
 * wiersza w `selly_products` (czyli właśnie ta, dla której discovery nic nie znalazło), nie
 * zostawia w bazie ŻADNEGO śladu — błąd jest tylko w `stats`/`errors` i w `selly_sync_log`.
 */
function markError(db: Baza, row: WierszDelta, error: unknown): void {
  const errStr = String(error);
  const isPendingCreate =
    errStr.includes("brak dictMaps do createProduct") || errStr.includes("produkt nie istnieje w Selly");
  const status = isPendingCreate ? "pending_create" : "error";
  db.$client
    .prepare(
      `UPDATE selly_products
    SET ostatnia_sync = datetime('now'), ostatni_status = ?, ostatni_blad = ?
    WHERE kod_importu = ? AND dostawca = ?`,
    )
    .run(status, errStr.slice(0, 500), row.kod_importu, row.dostawca);
}

/**
 * GŁÓWNA FUNKCJA — port `syncDelta(db, dostawca, opts)` (`:114-185`). Instancja discovery
 * jest argumentem, bo w oryginale to moduł współdzielony przez `require` (patrz nota
 * w `discovery.ts`).
 *
 * ⚠ Gałąź `else` po PUT (status spoza 2xx) jest w praktyce martwa: klient rzuca na non-2xx,
 * więc błąd HTTP trafia do `catch` z komunikatem `[Selly] HTTP …`. Zostaje, bo jest w oryginale.
 * ⚠ `stats.created` nigdy nie rośnie — tak jest w oryginale.
 */
export async function syncDelta(
  db: Baza,
  discovery: Discovery,
  dostawca: string | null = null,
  opts: { dryRun?: boolean; maxProducts?: number } = {},
): Promise<WynikSyncDelta> {
  const { dryRun = false, maxProducts = 5000 } = opts;
  const rows = findDeltaProducts(db, dostawca, maxProducts);
  const logId = logSyncStart(db, dostawca);

  const stats: StatystykiDelta = { total: rows.length, ok: 0, err: 0, skip: 0, discovered: 0, created: 0 };
  const errors: { kod: string; error: string }[] = [];

  console.log(`[sync_delta] Start: ${rows.length} produktow, dostawca=${dostawca || "ALL"}, dryRun=${dryRun}`);

  for (const row of rows) {
    try {
      // 1. Mapping — z JOIN-a albo przez discovery
      let mapping: WynikMapowania;
      if (row.selly_variant_id) {
        mapping = {
          product_id: row.selly_product_id ?? undefined,
          variant_id: row.selly_variant_id,
          feature_id_magazyn: row.feature_id_magazyn,
          action: "cache_hit",
        };
      } else {
        mapping = await discovery.ensureMapping(db, row);
        if (mapping.action === "found_variant" || mapping.action === "created_variant") {
          stats.discovered++;
        }
      }

      if (mapping.error || !mapping.variant_id) {
        stats.err++;
        errors.push({ kod: row.kod, error: mapping.error || "brak variant_id" });
        markError(db, row, mapping.error || "discovery: brak variant_id");
        continue;
      }

      // 2. Aktualizacja wariantu (quantity + price)
      if (dryRun) {
        stats.skip++;
        console.log(
          `  [DRY] ${row.kod} -> pid=${mapping.product_id} vid=${mapping.variant_id} qty=${row.stan} price=${row.cena_sprzedazy}`,
        );
        continue;
      }

      const productId = mapping.product_id as number;
      const variantId = mapping.variant_id;
      const putRes = await discovery.apiWithRetry(`PUT /api/products/${productId}/variants/${variantId}`, async () => {
        const data = await discovery.klient.updateVariant(productId, variantId, {
          quantity: row.stan ?? 0,
          price: row.cena_sprzedazy ?? 0,
        });
        // Klient rzuca na non-2xx, więc dotarcie tutaj oznacza 2xx (`client.api` → `{status, data}`).
        return { status: 200, data };
      });

      if (putRes.status >= 200 && putRes.status < 300) {
        stats.ok++;
        markSynced(db, row, true, true);
      } else {
        stats.err++;
        const msg = `HTTP ${putRes.status}: ${JSON.stringify(putRes.data).slice(0, 200)}`;
        errors.push({ kod: row.kod, error: msg });
        markError(db, row, msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      stats.err++;
      errors.push({ kod: row.kod, error: msg });
      markError(db, row, msg);
    }
  }

  logSyncEnd(
    db,
    logId,
    stats.ok,
    stats.err,
    stats.skip,
    { stats, sample_errors: errors.slice(0, 20) },
    stats.err > 0 && stats.ok === 0 ? "blad" : "zakonczono",
  );

  console.log(
    `[sync_delta] Koniec: ok=${stats.ok}, err=${stats.err}, skip=${stats.skip}, discovered=${stats.discovered}`,
  );
  return { stats, errors, logId };
}
