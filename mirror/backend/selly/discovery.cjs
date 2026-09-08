// selly/discovery.cjs
// Znajduje lub tworzy mapping (kod_importu, dostawca) -> (selly_product_id, selly_variant_id) w Selly.
// Strategia lazy: pytamy Selly dopiero jak sync chce cos wyslac dla nieznanego produktu.
//
// Publiczne API:
//   ensureMapping(db, bridgeRow) -> { product_id, variant_id, feature_id_magazyn, action }
//     bridgeRow: { kod, kod_importu, dostawca, ean, nazwa, marka, ... }
//     action: 'cache_hit' | 'found_variant' | 'created_variant' | 'created_product' | 'not_found'
//
// Uwagi:
//   - Wymaga zainstalowanego globalLimiter z rate_limiter.cjs (opcjonalnie, jesli undefined - bez limitu).
//   - Wymaga selly/client.cjs.
//   - Nie zapisuje ceny/stanu - to robi sync_delta/sync_full po ensureMapping.

const client = require('./client.cjs');
let globalLimiter = null;
try { globalLimiter = require('./rate_limiter.cjs').globalLimiter; } catch (_) {}

async function throttled() {
  if (globalLimiter) await globalLimiter.acquire();
}

/**
 * Wrapper wokol client.api ktory automatycznie retry-uje na HTTP 429.
 */
async function apiWithRetry(method, path, opts = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await throttled();
    const r = await client.api(method, path, opts);
    if (r.status !== 429) return r;
    const retryAfter = parseInt(r.headers?.['retry-after'] || '10', 10);
    const waitMs = Math.min(60_000, Math.max(1000, retryAfter * 1000));
    console.log(`[discovery] HTTP 429 na ${method} ${path}, retry #${attempt+1} za ${waitMs}ms`);
    await new Promise(res => setTimeout(res, waitMs));
  }
  return { status: 429, data: { message: 'Max retries exceeded' } };
}

// Mapa feature_id (Magazyny) - poznajemy stopniowo z GET /variants.
// Znane z produkcji: MO2=5, MO3=4, MO4=3, MO5=2, MO9=1
// Reszta uzupelni sie automatycznie przy pierwszym POST wariantu z tym dostawca.
const WAREHOUSE_FEATURE_IDS = {
  MO1: null, MO2: 5, MO3: 4, MO4: 3, MO5: 2, MO6: null,
  MO7: null, MO8: null, MO9: 1, MO10: null,
};

// Cache dostawca -> feature_id (uzupelniany runtime po odkryciu w Selly)
const featureIdCache = { ...WAREHOUSE_FEATURE_IDS };

function getFeatureIdForWarehouse(dostawca) {
  return featureIdCache[dostawca] || null;
}

function learnFeatureId(dostawca, featureId) {
  if (dostawca && featureId && !featureIdCache[dostawca]) {
    featureIdCache[dostawca] = featureId;
  }
}

/**
 * Znajdz produkt Selly po EAN.
 * @returns {number|null} product_id lub null
 */
async function findProductByEan(ean) {
  if (!ean) return null;
  try {
    const r = await apiWithRetry('GET', '/api/products', { query: { ean, limit: 1 } });
    const items = r.data?.data || [];
    return items.length > 0 ? items[0].product_id : null;
  } catch (e) {
    return null;
  }
}

/**
 * Pobierz warianty produktu Selly.
 * @returns {Array} warianty (moze byc puste)
 */
async function fetchVariants(productId) {
  try {
    const r = await apiWithRetry('GET', `/api/products/${productId}/variants`);
    return r.data?.data || [];
  } catch (e) {
    return [];
  }
}

/**
 * Znajdz wariant dla konkretnego dostawcy (feature "Magazyny" == dostawca).
 * @returns {Object|null} wariant lub null
 */
function findVariantForDostawca(variants, dostawca) {
  for (const v of variants) {
    const mag = (v.features || []).find(f => f.name === 'Magazyny');
    if (mag && mag.value === dostawca) {
      // przy okazji nauka feature_id
      learnFeatureId(dostawca, mag.feature_id);
      return v;
    }
  }
  return null;
}

/**
 * Utworz nowy wariant dla istniejacego produktu Selly.
 * @param {number} productId
 * @param {Object} bridgeRow - { ean, kod_importu, dostawca, stan, cena_sprzedazy, vat_rate }
 * @returns {Object|null} { variant_id, feature_id_magazyn }
 */
async function createVariant(productId, bridgeRow) {
  const featureId = getFeatureIdForWarehouse(bridgeRow.dostawca);
  const body = {
    quantity: bridgeRow.stan ?? 0,
    price: bridgeRow.cena_sprzedazy ?? 0,
    vat: bridgeRow.vat_rate ?? 23,
    ean: bridgeRow.ean || '',
    default: 0,
    attributes: [], // Selly wymaga tego pola nawet gdy puste (HTTP 400 "Brak wymaganego argumentu attributes")
  };
  // Jesli znamy feature_id - dodajemy Magazyny do wariantu
  if (featureId) {
    body.features = [{ feature_id: featureId, name: 'Magazyny', value: bridgeRow.dostawca }];
  }
  try {
    const r = await apiWithRetry('POST', `/api/products/${productId}/variants`, { body });
    const created = r.data?.data;
    if (!created?.variant_id) {
      return { error: 'POST variant nie zwrocil variant_id: ' + JSON.stringify(r.data) };
    }
    // Jesli nie mielismy feature_id - odkryj po fakcie
    if (!featureId) {
      const mag = (created.features || []).find(f => f.name === 'Magazyny');
      if (mag) learnFeatureId(bridgeRow.dostawca, mag.feature_id);
    }
    return { variant_id: created.variant_id, feature_id_magazyn: featureId || getFeatureIdForWarehouse(bridgeRow.dostawca) };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Utworz nowy produkt Selly z pierwszym wariantem.
 * Wymaga mappera_v2.cjs do zbudowania payloadu.
 * @param {Object} bridgeRow - pelny wiersz z products (z JOIN)
 * @param {Object} dictMaps - { catMap, prodMap, whMap } ze slownikow
 * @returns {Object|null} { product_id, variant_id, feature_id_magazyn }
 */
async function createProduct(bridgeRow, dictMaps) {
  const mapper = require('./mapper_v2.cjs');
  const payload = mapper.buildProductPayload(bridgeRow, dictMaps);
  if (!payload) return { error: 'mapper zwrocil null' };

  try {
    // 1. Utworz produkt (bez wariantow - Selly stworzy default variant)
    const r = await apiWithRetry('POST', '/api/products', { body: payload });
    const created = r.data?.data;
    if (!created?.product_id) {
      return { error: 'POST product nie zwrocil product_id: ' + JSON.stringify(r.data).slice(0, 500) };
    }
    const productId = created.product_id;

    // 2. Sprawdz jaki wariant powstal (Selly zwykle tworzy default variant automatycznie)
    const variants = await fetchVariants(productId);
    let variant = variants.find(v => v.default === 1) || variants[0];

    // 3. Jesli default wariant nie ma feature Magazyny - dopisz przez PUT
    if (variant) {
      const mag = (variant.features || []).find(f => f.name === 'Magazyny');
      if (!mag) {
        const featureId = getFeatureIdForWarehouse(bridgeRow.dostawca);
        if (featureId) {
          await apiWithRetry('PUT', `/api/products/${productId}/variants/${variant.variant_id}`, {
            body: {
              quantity: bridgeRow.stan ?? 0,
              price: bridgeRow.cena_sprzedazy ?? 0,
              features: [{ feature_id: featureId, name: 'Magazyny', value: bridgeRow.dostawca }],
            }
          });
        }
      }
      return {
        product_id: productId,
        variant_id: variant.variant_id,
        feature_id_magazyn: (mag ? mag.feature_id : getFeatureIdForWarehouse(bridgeRow.dostawca))
      };
    }
    return { error: 'POST product utworzyl produkt ' + productId + ' ale brak default variant' };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * GLOWNA FUNKCJA: zapewnij mapping dla bridgeRow.
 * @param {Object} db - better-sqlite3
 * @param {Object} bridgeRow - { kod, kod_importu, dostawca, ean, ... }
 * @param {Object} dictMaps - opcjonalnie, potrzebne tylko przy tworzeniu nowego produktu
 * @returns {Object} { product_id, variant_id, feature_id_magazyn, action, error? }
 */
async function ensureMapping(db, bridgeRow, dictMaps = null) {
  const { kod, kod_importu, dostawca, ean } = bridgeRow;
  if (!kod_importu || !dostawca) {
    return { error: 'brak kod_importu lub dostawca' };
  }

  // 1. Cache hit?
  const cached = db.prepare(
    'SELECT selly_product_id, selly_variant_id, feature_id_magazyn FROM selly_products WHERE kod_importu = ? AND dostawca = ?'
  ).get(kod_importu, dostawca);
  if (cached?.selly_variant_id) {
    return {
      product_id: cached.selly_product_id,
      variant_id: cached.selly_variant_id,
      feature_id_magazyn: cached.feature_id_magazyn,
      action: 'cache_hit',
    };
  }

  // 2. Znajdz produkt w Selly po EAN
  let productId = null;
  if (ean) {
    productId = await findProductByEan(ean);
  }

  // 3. Jesli inny wariant tego samego kod_importu jest juz w cache - uzyj jego product_id
  if (!productId) {
    const sibling = db.prepare(
      'SELECT selly_product_id FROM selly_products WHERE kod_importu = ? AND selly_product_id IS NOT NULL LIMIT 1'
    ).get(kod_importu);
    if (sibling) productId = sibling.selly_product_id;
  }

  // 4. Znaleziony produkt? Sprawdz warianty
  if (productId) {
    const variants = await fetchVariants(productId);
    const variant = findVariantForDostawca(variants, dostawca);
    if (variant) {
      // Wariant istnieje - zapisz mapping
      const featureId = ((variant.features || []).find(f => f.name === 'Magazyny') || {}).feature_id;
      db.prepare(`
        INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id,
                                    feature_id_magazyn, ostatni_status, ostatnia_sync)
        VALUES (?, ?, ?, ?, ?, ?, 'ok', datetime('now'))
        ON CONFLICT(kod_importu, dostawca) DO UPDATE SET
          selly_product_id=excluded.selly_product_id,
          selly_variant_id=excluded.selly_variant_id,
          feature_id_magazyn=excluded.feature_id_magazyn,
          bridge_kod=excluded.bridge_kod
      `).run(kod_importu, dostawca, kod, productId, variant.variant_id, featureId || null);
      return {
        product_id: productId,
        variant_id: variant.variant_id,
        feature_id_magazyn: featureId,
        action: 'found_variant',
      };
    }
    // Produkt jest, ale nie ma wariantu dla naszego dostawcy - utworz
    const created = await createVariant(productId, bridgeRow);
    if (created.error) {
      return { error: 'createVariant: ' + created.error, action: 'not_found' };
    }
    db.prepare(`
      INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id,
                                  feature_id_magazyn, ostatni_status, ostatnia_sync)
      VALUES (?, ?, ?, ?, ?, ?, 'ok', datetime('now'))
      ON CONFLICT(kod_importu, dostawca) DO UPDATE SET
        selly_product_id=excluded.selly_product_id,
        selly_variant_id=excluded.selly_variant_id,
        feature_id_magazyn=excluded.feature_id_magazyn
    `).run(kod_importu, dostawca, kod, productId, created.variant_id, created.feature_id_magazyn || null);
    return {
      product_id: productId,
      variant_id: created.variant_id,
      feature_id_magazyn: created.feature_id_magazyn,
      action: 'created_variant',
    };
  }

  // 5. Produkt nie istnieje w Selly - utworz od zera
  if (!dictMaps) {
    return { error: 'produkt nie istnieje w Selly ale brak dictMaps do createProduct', action: 'not_found' };
  }
  const created = await createProduct(bridgeRow, dictMaps);
  if (created.error) {
    return { error: 'createProduct: ' + created.error, action: 'not_found' };
  }
  db.prepare(`
    INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id,
                                selly_category_id, selly_producer_id, feature_id_magazyn,
                                ostatni_status, ostatnia_sync)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ok', datetime('now'))
    ON CONFLICT(kod_importu, dostawca) DO UPDATE SET
      selly_product_id=excluded.selly_product_id,
      selly_variant_id=excluded.selly_variant_id,
      feature_id_magazyn=excluded.feature_id_magazyn
  `).run(kod_importu, dostawca, kod, created.product_id, created.variant_id,
         dictMaps.catMap?.get(bridgeRow.kategoria) || null,
         dictMaps.prodMap?.get(bridgeRow.marka) || null,
         created.feature_id_magazyn || null);
  return {
    product_id: created.product_id,
    variant_id: created.variant_id,
    feature_id_magazyn: created.feature_id_magazyn,
    action: 'created_product',
  };
}

module.exports = {
  ensureMapping,
  findProductByEan,
  fetchVariants,
  findVariantForDostawca,
  createVariant,
  createProduct,
  getFeatureIdForWarehouse,
  learnFeatureId,
  apiWithRetry,
  WAREHOUSE_FEATURE_IDS: featureIdCache,
};
