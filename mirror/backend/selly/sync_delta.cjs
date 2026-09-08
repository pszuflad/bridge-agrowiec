// selly/sync_delta.cjs
// TOR 1: szybki delta sync - aktualizuje TYLKO ceny/stany zmienione od ostatniego sync.
// Model: bridge (kod_importu, dostawca) -> selly (product_id, variant_id).
// PUT /api/products/{pid}/variants/{vid} body {quantity, price}
//
// NIE aktualizuje nazw, kategorii, features - to robi sync_full (nocny).
// Discovery: uses selly/discovery.cjs (znajduje/tworzy mapping lazy).

const client = require('./client.cjs');
const disc = require('./discovery.cjs');
const { globalLimiter } = require('./rate_limiter.cjs');
// apiWithRetry pochodzi z discovery.cjs - juz zawiera throttle + retry na HTTP 429
const { apiWithRetry } = disc;

/**
 * Znajdz produkty do sync (delta): stan lub cena rozni sie od ostatnio wyslanych.
 * @param {Object} db
 * @param {string|null} dostawca - jesli podany, filtruj po dostawcy
 * @param {number} limit
 * @returns {Array} rekordy do sync
 */
function findDeltaProducts(db, dostawca = null, limit = 10000) {
  const where = ["p.status = 'aktywny'", "p.ean IS NOT NULL", "p.ean != ''",
                 "p.kod_importu IS NOT NULL", "p.kod_importu != ''"];
  const params = [];
  if (dostawca) {
    where.push("p.dostawca = ?");
    params.push(dostawca);
  }
  const sql = `
    SELECT p.kod, p.kod_importu, p.dostawca, p.ean, p.nazwa,
           p.marka, p.kategoria, p.stan, p.cena_sprzedazy, p.cena_zakupu, p.vat AS vat_rate,
           sp.selly_product_id, sp.selly_variant_id, sp.feature_id_magazyn,
           sp.stan_wyslany, sp.cena_sprzedazy_wyslana
    FROM products p
    LEFT JOIN selly_products sp ON sp.kod_importu = p.kod_importu AND sp.dostawca = p.dostawca
    WHERE ${where.join(' AND ')}
      AND (
        sp.selly_variant_id IS NULL
        OR sp.stan_wyslany IS NULL OR sp.stan_wyslany != p.stan
        OR sp.cena_sprzedazy_wyslana IS NULL OR sp.cena_sprzedazy_wyslana != p.cena_sprzedazy
      )
    LIMIT ?
  `;
  params.push(limit);
  return db.prepare(sql).all(...params);
}

/**
 * Zapisz log sync do selly_sync_log.
 */
function logSyncStart(db, dostawca) {
  const info = db.prepare(`
    INSERT INTO selly_sync_log (operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip,
                                 rozpoczeto, status)
    VALUES ('sync_delta', ?, 0, 0, 0, datetime('now'), 'w_trakcie')
  `).run(dostawca || 'ALL');
  return info.lastInsertRowid;
}

function logSyncEnd(db, logId, ok, err, skip, details, status = 'zakonczono') {
  db.prepare(`
    UPDATE selly_sync_log
    SET liczba_ok = ?, liczba_blad = ?, liczba_skip = ?,
        szczegoly_json = ?, zakonczono = datetime('now'), status = ?
    WHERE id = ?
  `).run(ok, err, skip, JSON.stringify(details).slice(0, 8000), status, logId);
}

/**
 * Zapisz snapshot po udanym sync.
 */
function markSynced(db, row, priceOk, stockOk) {
  db.prepare(`
    UPDATE selly_products
    SET stan_wyslany = ?, cena_sprzedazy_wyslana = ?, cena_zakupu_wyslana = ?,
        ostatnia_sync = datetime('now'), ostatni_status = 'ok', ostatni_blad = NULL
    WHERE kod_importu = ? AND dostawca = ?
  `).run(
    stockOk ? row.stan : null,
    priceOk ? row.cena_sprzedazy : null,
    row.cena_zakupu,
    row.kod_importu, row.dostawca
  );
}

function markError(db, row, error) {
  // Rozroznij prawdziwe bledy od zaplanowanego "produkt nie istnieje w Selly"
  // (dla ktorego wersja v1 nie tworzy nowego - to jest robota Tor 2).
  const errStr = String(error);
  const isPendingCreate = errStr.includes('brak dictMaps do createProduct') ||
                          errStr.includes('produkt nie istnieje w Selly');
  const status = isPendingCreate ? 'pending_create' : 'error';
  db.prepare(`
    UPDATE selly_products
    SET ostatnia_sync = datetime('now'), ostatni_status = ?, ostatni_blad = ?
    WHERE kod_importu = ? AND dostawca = ?
  `).run(status, errStr.slice(0, 500), row.kod_importu, row.dostawca);
}

/**
 * GLOWNA FUNKCJA delta sync.
 * @param {Object} db
 * @param {string|null} dostawca
 * @param {Object} opts - { dryRun: bool, maxProducts: int }
 */
async function syncDelta(db, dostawca = null, opts = {}) {
  const { dryRun = false, maxProducts = 5000 } = opts;
  const rows = findDeltaProducts(db, dostawca, maxProducts);
  const logId = logSyncStart(db, dostawca);

  const stats = { total: rows.length, ok: 0, err: 0, skip: 0, discovered: 0, created: 0 };
  const errors = [];

  console.log(`[sync_delta] Start: ${rows.length} produktow, dostawca=${dostawca || 'ALL'}, dryRun=${dryRun}`);

  for (const row of rows) {
    try {
      // 1. Zapewnij mapping (discovery jesli nie ma)
      let mapping;
      if (row.selly_variant_id) {
        mapping = {
          product_id: row.selly_product_id,
          variant_id: row.selly_variant_id,
          feature_id_magazyn: row.feature_id_magazyn,
          action: 'cache_hit',
        };
      } else {
        // discovery uzywa apiWithRetry wewnetrznie - nie potrzeba osobnego acquire
        mapping = await disc.ensureMapping(db, row);
        if (mapping.action === 'found_variant' || mapping.action === 'created_variant') {
          stats.discovered++;
        }
      }

      if (mapping.error || !mapping.variant_id) {
        stats.err++;
        errors.push({ kod: row.kod, error: mapping.error || 'brak variant_id' });
        markError(db, row, mapping.error || 'discovery: brak variant_id');
        continue;
      }

      // 2. Aktualizuj wariant (quantity + price)
      if (dryRun) {
        stats.skip++;
        console.log(`  [DRY] ${row.kod} -> pid=${mapping.product_id} vid=${mapping.variant_id} qty=${row.stan} price=${row.cena_sprzedazy}`);
        continue;
      }

      // apiWithRetry sam robi throttle + retry na 429
      const putRes = await apiWithRetry('PUT',
        `/api/products/${mapping.product_id}/variants/${mapping.variant_id}`,
        { body: { quantity: row.stan ?? 0, price: row.cena_sprzedazy ?? 0 } }
      );

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
      stats.err++;
      errors.push({ kod: row.kod, error: e.message });
      markError(db, row, e.message);
    }
  }

  logSyncEnd(db, logId, stats.ok, stats.err, stats.skip,
             { stats, sample_errors: errors.slice(0, 20) },
             stats.err > 0 && stats.ok === 0 ? 'blad' : 'zakonczono');

  console.log(`[sync_delta] Koniec: ok=${stats.ok}, err=${stats.err}, skip=${stats.skip}, discovered=${stats.discovered}`);
  return { stats, errors, logId };
}

module.exports = { syncDelta, findDeltaProducts };
