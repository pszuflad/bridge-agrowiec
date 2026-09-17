'use strict';

require('dotenv').config({ path: '.env' });

const fs = require('fs');
const Database = require('better-sqlite3');
const client = require('./selly/client.cjs');
const mapper = require('./selly/mapper_v2.cjs');

const APPLY = process.argv.includes('--apply');
const DB_PATH = 'data.db';
const CATEGORY_ID = {
  Rolnicze: 1,
  'Leśne': 2,
  Przemysłowe: 3,
  'Ciężarowe': 4,
};
const SIZE_PRODUCT_IDS = new Set([6509, 6729, 6738]);
const MANAGED_FEATURES = new Set(mapper.FEATURE_MAP.map(([name]) => name));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function scoreRow(row) {
  const fields = [
    'bieznik', 'rozmiar', 'szerokosc', 'profil', 'srednica',
    'rozmiar_alternatywny', 'konstrukcja', 'pr', 'tl_tt',
    'indeksy', 'indeks_nosnosci', 'indeks_predkosci', 'dot',
    'zastosowanie', 'label_wet', 'label_rolling', 'label_noise',
    'ms', 'snow_3pmsf', 'label_snow', 'marka',
  ];
  return fields.reduce((n, key) => n + (row[key] !== null && row[key] !== '' ? 1 : 0), 0);
}

function preferredRows(rows) {
  const active = rows.filter(row => row.status === 'aktywny');
  return active.length ? active : rows;
}

function selectRepresentative(rows, desiredCategoryId) {
  return [...preferredRows(rows)]
    .filter(row => CATEGORY_ID[row.kategoria] === desiredCategoryId)
    .sort((a, b) => scoreRow(b) - scoreRow(a) || b.id - a.id)[0] || null;
}

function desiredFeatures(row, currentFeatures) {
  const unmanaged = (currentFeatures || [])
    .filter(feature => !MANAGED_FEATURES.has(feature.name))
    .map(feature => ({ name: feature.name, values: feature.values }));
  return [...unmanaged, ...mapper.buildFeatures(row)];
}

async function listAllProducts() {
  const products = [];
  for (let page = 1; ; page++) {
    const response = await client.listProducts({
      page,
      limit: 50,
      sort_by: 'product_id',
      sort: 'ASC',
    });
    const rows = response && response.data ? response.data : response;
    if (!Array.isArray(rows) || rows.length === 0) break;
    products.push(...rows);
    if (rows.length < 50) break;
    await sleep(250);
  }
  return products;
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });
  const bridgeRows = db.prepare(`
    SELECT p.*, sp.selly_product_id
    FROM selly_products sp
    JOIN products p
      ON p.kod_importu = sp.kod_importu
     AND p.dostawca = sp.dostawca
    WHERE sp.selly_product_id IS NOT NULL
  `).all();

  const rowsByProduct = new Map();
  for (const row of bridgeRows) {
    if (!rowsByProduct.has(row.selly_product_id)) {
      rowsByProduct.set(row.selly_product_id, []);
    }
    rowsByProduct.get(row.selly_product_id).push(row);
  }

  const products = await listAllProducts();
  const targets = [];
  const skippedConflicts = [];

  for (const product of products) {
    const rows = rowsByProduct.get(product.product_id) || [];
    if (!rows.length) continue;

    const preferred = preferredRows(rows);
    const desiredCategories = [...new Set(
      preferred.map(row => CATEGORY_ID[row.kategoria]).filter(Boolean)
    )];
    if (desiredCategories.length !== 1) {
      if (desiredCategories.length > 1) {
        skippedConflicts.push({
          product_id: product.product_id,
          categories: desiredCategories,
        });
      }
      continue;
    }

    const hasForwarderHarwester = preferred.some(
      row => row.kategoria === 'Leśne' && row.zastosowanie === 'Forwarder/Harwester'
    );
    const desiredCategoryId = desiredCategories[0];
    let representative = selectRepresentative(rows, desiredCategoryId);
    if (hasForwarderHarwester) {
      representative = [...preferred]
        .filter(row => row.kategoria === 'Leśne' && row.zastosowanie === 'Forwarder/Harwester')
        .sort((a, b) => scoreRow(b) - scoreRow(a) || a.id - b.id)[0] || representative;
    }
    if (!representative) continue;

    const categoryMismatch = Number(product.category_id) !== desiredCategoryId;
    const badSize = SIZE_PRODUCT_IDS.has(product.product_id);

    if (categoryMismatch || hasForwarderHarwester || badSize) {
      targets.push({
        product_id: product.product_id,
        listed_name: product.name,
        from_category_id: Number(product.category_id),
        to_category_id: desiredCategoryId,
        reasons: [
          categoryMismatch ? 'category_mismatch' : null,
          hasForwarderHarwester ? 'forwarder_harwester' : null,
          badSize ? 'bad_size' : null,
        ].filter(Boolean),
        representative,
      });
    }
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  const backupPath = `selly_backups/categories_filters_pre_${stamp}.json`;
  const details = [];

  for (const target of targets) {
    const response = await client.getProduct(target.product_id);
    const current = response && response.data ? response.data : response;
    details.push({ target, current });
    await sleep(250);
  }

  fs.mkdirSync('selly_backups', { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify({
    created_at: new Date().toISOString(),
    apply_requested: APPLY,
    target_count: details.length,
    skipped_conflicts: skippedConflicts,
    products: details,
  }, null, 2));

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      backup: backupPath,
      targets: details.length,
      reasons: details.reduce((out, item) => {
        for (const reason of item.target.reasons) out[reason] = (out[reason] || 0) + 1;
        return out;
      }, {}),
      skipped_conflicts: skippedConflicts.length,
    }, null, 2));
    db.close();
    return;
  }

  const results = [];
  for (const item of details) {
    const { target, current } = item;
    const row = target.representative;
    const payload = {
      name: row.nazwa || current.name,
      category_id: target.to_category_id,
      features: desiredFeatures(row, current.features),
    };
    await client.updateProduct(target.product_id, payload);
    await sleep(250);
    const afterResponse = await client.getProduct(target.product_id);
    const after = afterResponse && afterResponse.data ? afterResponse.data : afterResponse;
    const featureMap = new Map((after.features || []).map(feature => [feature.name, feature.values]));
    const expectedFeatures = mapper.buildFeatures(row);
    const errors = [];

    if (Number(after.category_id) !== target.to_category_id) {
      errors.push(`category ${after.category_id} != ${target.to_category_id}`);
    }
    for (const expected of expectedFeatures) {
      const actual = featureMap.get(expected.name) || [];
      if (JSON.stringify(actual) !== JSON.stringify(expected.values)) {
        errors.push(`${expected.name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected.values)}`);
      }
    }
    results.push({
      product_id: target.product_id,
      reasons: target.reasons,
      category_id: after.category_id,
      name: after.name,
      rozmiar: featureMap.get('Rozmiar') || null,
      zastosowanie: featureMap.get('Zastosowanie') || null,
      errors,
    });
    await sleep(250);
  }

  const resultPath = `selly_backups/categories_filters_result_${stamp}.json`;
  fs.writeFileSync(resultPath, JSON.stringify({
    finished_at: new Date().toISOString(),
    backup: backupPath,
    updated: results.length,
    failed_verification: results.filter(result => result.errors.length),
    results,
  }, null, 2));

  console.log(JSON.stringify({
    mode: 'apply',
    backup: backupPath,
    result: resultPath,
    updated: results.length,
    failed_verification: results.filter(result => result.errors.length).length,
    reasons: results.reduce((out, item) => {
      for (const reason of item.reasons) out[reason] = (out[reason] || 0) + 1;
      return out;
    }, {}),
    skipped_conflicts: skippedConflicts.length,
  }, null, 2));
  db.close();
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
