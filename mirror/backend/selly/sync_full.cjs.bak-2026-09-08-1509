// backend/selly/sync_full.cjs
// Tor 2 — PEŁNY sync nocny (02:00-04:00).
// Dla kazdego produktu:
//   - JESLI istnieje w selly_products -> PUT /api/products/{id} z pelnym payload (mirror)
//                                        + upsertProductWarehouse(id, {warehouse_id, quantity})
//   - JESLI nie istnieje              -> POST /api/products (auto-create)
//
// Nadpisuje: name, vat_rate, weight, ean (jesli valid), provider_code=kod_importu (BUGFIX),
// price_purchase, visible, 21 features.
//
// NIE rusza: content_html, html_*, category_id, producer_id, warehouse_id, dimensions.
//
// Strategia rotacji: extensions.cjs cron wybiera dostawce per noc.
//
// Data: 2026-09-07

'use strict';

const client = require('./client.cjs');
const { toSellyPayloadV2 } = require('./mapper_v2.cjs');
const { globalLimiter } = require('./rate_limiter.cjs');

const DEFAULT_WAREHOUSE_ID = 1;

/**
 * Zbierz produkty dostawcy do pelnego sync.
 * Zwraca: { existing: [{p, sp}], missing: [{p}] }
 */
function collectFullSyncItems(db, dostawca) {
  const rows = db.prepare(`
    SELECT
      p.*,
      sp.selly_product_id,
      sp.id AS selly_row_id
    FROM products p
    LEFT JOIN selly_products sp ON sp.bridge_kod = REPLACE(p.kod, '_', '')
    WHERE p.dostawca = ?
      AND p.status = 'aktywny'
  `).all(dostawca);

  const existing = [];
  const missing = [];
  for (const r of rows) {
    if (r.selly_product_id) {
      existing.push(r);
    } else {
      missing.push(r);
    }
  }
  return { existing, missing };
}

/**
 * Zapisz podsumowanie.
 */
function logSyncRun(db, dostawca, operacja, stats) {
  const endTs = new Date();
  const startTs = new Date(endTs.getTime() - (stats.durationMs || 0));
  const iso = d => d.toISOString().replace('T', ' ').substring(0, 19);
  const status = stats.errors > 0 ? 'blad' : 'zakonczono';
  db.prepare(`
    INSERT INTO selly_sync_log (operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip,
                                szczegoly_json, rozpoczeto, zakonczono, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    operacja,
    dostawca,
    stats.updated + stats.created,
    stats.errors,
    stats.skipped,
    JSON.stringify(stats.details || {}).substring(0, 4000),
    iso(startTs),
    iso(endTs),
    status
  );
}

/**
 * Zaktualizuj wpis selly_products po sukcesie.
 */
function updateSnapshotAfterFull(db, row, sellyProductId, action) {
  if (action === 'created') {
    db.prepare(`
      INSERT INTO selly_products (bridge_kod, selly_product_id,
        cena_sprzedazy_wyslana, cena_zakupu_wyslana, stan_wyslany,
        ostatnia_sync, ostatni_status)
      VALUES (?, ?, ?, ?, ?, datetime('now'), 'ok')
    `).run(
      String(row.kod).replace(/_/g, ''),
      sellyProductId,
      Number(row.cena_sprzedazy || 0),
      Number(row.cena_zakupu || 0),
      Number(row.stan || 0)
    );
  } else {
    db.prepare(`
      UPDATE selly_products
      SET ostatnia_sync = datetime('now'),
          ostatni_status = 'ok',
          ostatni_blad = NULL,
          cena_sprzedazy_wyslana = ?,
          cena_zakupu_wyslana = ?,
          stan_wyslany = ?
      WHERE selly_product_id = ?
    `).run(
      Number(row.cena_sprzedazy || 0),
      Number(row.cena_zakupu || 0),
      Number(row.stan || 0),
      sellyProductId
    );
  }
}

/**
 * Zaktualizuj wpis selly_products po bledzie (nie kasujemy - tylko oznaczamy).
 */
function markError(db, bridgeKod, sellyProductId, errMsg) {
  if (sellyProductId) {
    db.prepare(`
      UPDATE selly_products
      SET ostatnia_sync = datetime('now'),
          ostatni_status = 'error',
          ostatni_blad = ?
      WHERE selly_product_id = ?
    `).run(String(errMsg).substring(0, 500), sellyProductId);
  }
}

/**
 * Sync jednego istniejacego produktu (PUT + upsertWarehouse).
 */
async function syncExistingProduct(db, row, opts) {
  // Payload z mapper_v2: name, vat_rate, weight, provider_code, price_purchase, visible,
  //                     ean (jesli valid), features
  const payload = toSellyPayloadV2(row, { includeFeatures: true });

  await globalLimiter.acquire();
  await client.updateProduct(row.selly_product_id, payload);

  await globalLimiter.acquire();
  await client.upsertProductWarehouse(row.selly_product_id, {
    warehouse_id: opts.warehouse_id || DEFAULT_WAREHOUSE_ID,
    quantity: Number(row.stan || 0),
  });

  updateSnapshotAfterFull(db, row, row.selly_product_id, 'updated');
  return { action: 'updated', kod: row.kod, selly_product_id: row.selly_product_id };
}

/**
 * Auto-create nowego produktu.
 * WAZNE: potrzebuje category_id, producer_id, warehouse_id - dolaczam z opts.dictMaps.
 */
async function createMissingProduct(db, row, opts) {
  const dictMaps = opts.dictMaps || {};

  // Podstawowy payload dla POST /api/products (rozszerzony w porownaniu do PUT)
  const payload = toSellyPayloadV2(row, { includeFeatures: true });

  // Dodaj wymagane pola dla POST:
  const catId = dictMaps.catMap && dictMaps.catMap[String(row.kategoria || '').toLowerCase()];
  const prodId = dictMaps.prodMap && dictMaps.prodMap[String(row.marka || '').toLowerCase()];
  const whId = opts.warehouse_id || DEFAULT_WAREHOUSE_ID;

  if (!catId || !prodId) {
    throw new Error(`Brak w slowniku: kategoria=${row.kategoria} (${catId ? 'OK' : 'BRAK'}), marka=${row.marka} (${prodId ? 'OK' : 'BRAK'})`);
  }

  payload.category_id = catId;
  payload.producer_id = prodId;
  payload.warehouse_id = whId;
  payload.price = Number(row.cena_sprzedazy || 0);
  payload.product_code = String(row.kod || '').replace(/_/g, ''); // BEZ podkreslnika (spojnosc)

  await globalLimiter.acquire();
  const created = await client.createProduct(payload);
  const productId = created?.data?.product_id;
  if (!productId) throw new Error('Brak product_id w odpowiedzi Selly: ' + JSON.stringify(created).substring(0, 200));

  await globalLimiter.acquire();
  await client.upsertProductWarehouse(productId, {
    warehouse_id: whId,
    quantity: Number(row.stan || 0),
  });

  updateSnapshotAfterFull(db, row, productId, 'created');
  return { action: 'created', kod: row.kod, selly_product_id: productId };
}

/**
 * Wczytaj slowniki (kategorie, producenci) z selly_dict do map.
 */
function loadDictMaps(db) {
  const rows = db.prepare('SELECT slownik, klucz, wartosc_id FROM selly_dict').all();
  const maps = { catMap: {}, prodMap: {}, whMap: {} };
  for (const r of rows) {
    if (r.slownik === 'categories') maps.catMap[r.klucz] = r.wartosc_id;
    else if (r.slownik === 'producers') maps.prodMap[r.klucz] = r.wartosc_id;
    else if (r.slownik === 'warehouses') maps.whMap[r.klucz] = r.wartosc_id;
  }
  return maps;
}

/**
 * Glowna funkcja Toru 2.
 */
async function syncFullForDostawca(db, dostawca, opts = {}) {
  const startTs = Date.now();
  const stats = {
    updated: 0, created: 0, errors: 0, skipped: 0, durationMs: 0,
    existingCount: 0, missingCount: 0,
    details: { updateErrors: [], createErrors: [], missingDict: [] },
  };

  try {
    const { existing, missing } = collectFullSyncItems(db, dostawca);
    stats.existingCount = existing.length;
    stats.missingCount = missing.length;

    const dictMaps = loadDictMaps(db);
    const syncOpts = { ...opts, dictMaps };

    // --- Istniejace: PUT ---
    for (const row of existing) {
      try {
        await syncExistingProduct(db, row, syncOpts);
        stats.updated++;
      } catch (e) {
        stats.errors++;
        stats.details.updateErrors.push({ kod: row.kod, selly_id: row.selly_product_id, error: e.message });
        markError(db, row.kod, row.selly_product_id, e.message);
      }
    }

    // --- Brakujace: POST (auto-create) ---
    if (opts.autoCreate !== false) {
      for (const row of missing) {
        try {
          await createMissingProduct(db, row, syncOpts);
          stats.created++;
        } catch (e) {
          stats.errors++;
          const isDictErr = /Brak w slowniku/.test(e.message);
          if (isDictErr) {
            stats.details.missingDict.push({ kod: row.kod, kategoria: row.kategoria, marka: row.marka });
          } else {
            stats.details.createErrors.push({ kod: row.kod, error: e.message.substring(0, 300) });
          }
        }
      }
    } else {
      stats.skipped = missing.length;
    }

  } catch (e) {
    stats.errors++;
    stats.details.fatal = e.message;
  }

  stats.durationMs = Date.now() - startTs;
  logSyncRun(db, dostawca, 'sync_supplier', stats);

  return {
    ok: stats.errors === 0,
    dostawca,
    ...stats,
    limiter: globalLimiter.getStats(),
  };
}

module.exports = {
  syncFullForDostawca,
  collectFullSyncItems,
  loadDictMaps,
};
