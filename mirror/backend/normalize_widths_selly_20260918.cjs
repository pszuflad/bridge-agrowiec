'use strict';

require('dotenv').config({ path: '.env' });

const Database = require('better-sqlite3');
const client = require('./selly/client.cjs');

function normalizeWidth(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) return text;
  const number = Number(text);
  return Number.isFinite(number) ? String(number) : text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(operation, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
      await sleep(attempt * 1500);
    }
  }
  throw lastError;
}

async function main() {
  const db = new Database('data.db');
  const rows = db.prepare(`
    SELECT id, szerokosc
    FROM products
    WHERE szerokosc IS NOT NULL AND TRIM(szerokosc) <> ''
  `).all();
  const changedRows = rows
    .map(row => ({ ...row, normalized: normalizeWidth(row.szerokosc) }))
    .filter(row => row.normalized !== row.szerokosc);
  const changedIds = new Set(changedRows.map(row => row.id));

  const mappings = db.prepare(`
    SELECT p.id AS bridge_id, sp.selly_product_id
    FROM products p
    JOIN selly_products sp
      ON sp.kod_importu = p.kod_importu
     AND sp.dostawca = p.dostawca
    WHERE sp.selly_product_id IS NOT NULL
  `).all();
  const productIds = [...new Set(
    mappings
      .filter(row => changedIds.has(row.bridge_id))
      .map(row => Number(row.selly_product_id))
      .filter(Boolean)
  )].sort((a, b) => a - b);

  const updateWidth = db.prepare('UPDATE products SET szerokosc = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of changedRows) updateWidth.run(row.normalized, row.id);
    db.prepare(`
      UPDATE products
      SET rozmiar = '7-14'
      WHERE id = 105986 AND dostawca = 'MO9' AND rozmiar = '$7-14'
    `).run();
  })();

  console.log(JSON.stringify({
    stage: 'bridge_done',
    bridge_updated: changedRows.length,
    selly_candidates: productIds.length
  }));

  let inspected = 0;
  let updated = 0;
  let unchanged = 0;
  const errors = [];

  for (const productId of productIds) {
    try {
      const response = await retry(() => client.getProduct(productId));
      const product = response && response.data ? response.data : response;
      const currentFeatures = Array.isArray(product.features) ? product.features : [];
      let featureChanged = false;
      const features = currentFeatures.map(feature => {
        if (feature.name !== 'Szerokość opony') {
          return { name: feature.name, values: feature.values };
        }
        const values = (feature.values || []).map(value => normalizeWidth(value));
        if (JSON.stringify(values) !== JSON.stringify(feature.values || [])) {
          featureChanged = true;
        }
        return { name: feature.name, values: [...new Set(values)] };
      });

      inspected += 1;
      if (!featureChanged) {
        unchanged += 1;
      } else {
        await retry(() => client.updateProduct(productId, {
          name: product.name,
          category_id: product.category_id,
          features
        }));
        const afterResponse = await retry(() => client.getProduct(productId));
        const after = afterResponse && afterResponse.data ? afterResponse.data : afterResponse;
        const widthFeature = (after.features || []).find(feature => feature.name === 'Szerokość opony');
        const bad = (widthFeature?.values || []).filter(value => normalizeWidth(value) !== value);
        if (bad.length) throw new Error(`weryfikacja nieudana: ${bad.join(', ')}`);
        updated += 1;
      }

      if (inspected % 25 === 0) {
        console.log(JSON.stringify({ stage: 'selly_progress', inspected, updated, unchanged, errors: errors.length }));
      }
      await sleep(180);
    } catch (error) {
      errors.push({
        product_id: productId,
        status: error.status || null,
        error: String(error.message || error).slice(0, 300)
      });
      console.error(JSON.stringify({ stage: 'selly_error', product_id: productId, error: errors[errors.length - 1] }));
    }
  }

  console.log(JSON.stringify({
    stage: 'finished',
    bridge_updated: changedRows.length,
    selly_candidates: productIds.length,
    inspected,
    updated,
    unchanged,
    errors
  }));
  db.close();
  if (errors.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
