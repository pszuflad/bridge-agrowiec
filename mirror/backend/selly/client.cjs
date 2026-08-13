// backend/selly/client.cjs
// Klient REST API Selly.pl (OAS 3.0) dla Bridge dla Agrowca.
// Autoryzacja: OAuth2 client_credentials, body JSON, endpoint /api/auth/access_token.
// Panel testowy: https://agroopony.selly24.pl/adm/  |  API docs: https://demo.e-store.pl/api/documentation
//
// Konfiguracja z .env:
//   SELLY_SHOP_URL=https://agroopony.selly24.pl
//   SELLY_CLIENT_ID=bridge-xxxxxxx
//   SELLY_CLIENT_SECRET=xxxxxxxx
//   SELLY_SCOPE=READWRITE
//
// Uwaga:
//   - Limit Selly to max 50 rekordów per zapytanie GET (page/limit).
//   - Token JWT, ważny 3600s. Cache w pamięci + auto-refresh na 401.

'use strict';

const https = require('https');
const http = require('http');

const SHOP_URL      = (process.env.SELLY_SHOP_URL || '').replace(/\/$/, '');
const CLIENT_ID     = process.env.SELLY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SELLY_CLIENT_SECRET || '';
const SCOPE         = process.env.SELLY_SCOPE || 'READWRITE';

let tokenCache = { access_token: null, expires_at: 0, token_type: 'Bearer' };

function assertConfig() {
  if (!SHOP_URL || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('[Selly] Brak konfiguracji: SELLY_SHOP_URL / SELLY_CLIENT_ID / SELLY_CLIENT_SECRET');
  }
}

// ---------- Low-level HTTP ----------
function request(method, url, { headers = {}, body = null, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Bridge/1.0 Selly-client', ...headers },
      timeout: timeoutMs,
    };
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch (_) { /* not json */ }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, headers: res.headers, data: json, raw });
        } else {
          const err = new Error(`[Selly] HTTP ${res.statusCode} ${method} ${url} :: ${raw.slice(0, 800)}`);
          err.status = res.statusCode;
          err.body = json || raw;
          reject(err);
        }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('[Selly] timeout')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------- OAuth2: pobranie tokenu ----------
async function getAccessToken(force = false) {
  assertConfig();
  const now = Math.floor(Date.now() / 1000);
  if (!force && tokenCache.access_token && tokenCache.expires_at - 30 > now) {
    return tokenCache.access_token;
  }
  const payload = JSON.stringify({
    grant_type: 'client_credentials',
    scope: SCOPE,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const { data } = await request('POST', `${SHOP_URL}/api/auth/access_token`, {
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  if (!data || !data.access_token) {
    throw new Error('[Selly] Brak access_token w odpowiedzi: ' + JSON.stringify(data));
  }
  tokenCache = {
    access_token: data.access_token,
    expires_at: now + (Number(data.expires_in) || 3600),
    token_type: data.token_type || 'Bearer',
  };
  return tokenCache.access_token;
}

// ---------- Uniwersalny call ----------
async function api(method, path, { query = null, body = null, retryOn401 = true, timeoutMs = 30000 } = {}) {
  assertConfig();
  const token = await getAccessToken();
  let url = `${SHOP_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    url += (url.includes('?') ? '&' : '?') + qs.toString();
  }
  const headers = { 'Authorization': `Bearer ${token}` };
  let payload = null;
  if (body !== null && body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  try {
    return await request(method, url, { headers, body: payload, timeoutMs });
  } catch (e) {
    if (e.status === 401 && retryOn401) {
      await getAccessToken(true);
      return api(method, path, { query, body, retryOn401: false, timeoutMs });
    }
    throw e;
  }
}

// ---------- Produkty ----------
async function listProducts({ page = 1, limit = 50, ...extra } = {}) {
  const r = await api('GET', '/api/products', { query: { page, limit: Math.min(limit, 50), ...extra } });
  return r.data;
}
async function getProduct(id) { return (await api('GET', `/api/products/${id}`)).data; }
async function createProduct(product) { return (await api('POST', '/api/products', { body: product })).data; }
async function updateProduct(id, product) { return (await api('PUT', `/api/products/${id}`, { body: product })).data; }
async function deleteProduct(id) { return (await api('DELETE', `/api/products/${id}`)).data; }

// ---------- Stany magazynowe (per warehouse) ----------
async function upsertProductWarehouse(productId, { warehouse_id = 1, quantity = 0 } = {}) {
  // Najpierw POST (utwórz przypisanie), przy 409/istniejącym używamy PUT.
  try {
    return (await api('POST', `/api/products/${productId}/warehouses`,
      { body: { warehouse_id, quantity } })).data;
  } catch (e) {
    if (e.status === 400 || e.status === 409 || /istnieje|exists/i.test(e.message)) {
      return (await api('PUT', `/api/products/${productId}/warehouses/${warehouse_id}`,
        { body: { quantity } })).data;
    }
    throw e;
  }
}

// ---------- Kategorie dodatkowe (multi_cat) ----------
async function getProductMultiCat(productId) {
  return (await api('GET', `/api/products/${productId}/multi_cat`)).data;
}
async function setProductMultiCat(productId, categoryIds) {
  // categoryIds: tablica liczb -> "1,2,3"
  const categories = (categoryIds || []).filter(Boolean).join(',');
  if (!categories) return null;
  return (await api('POST', `/api/products/${productId}/multi_cat`,
    { body: { product_id: productId, categories } })).data;
}
async function deleteProductMultiCat(productId, categoryId) {
  return (await api('DELETE', `/api/products/${productId}/multi_cat/${categoryId}`)).data;
}

// ---------- Masowe operacje ----------
async function bulkPriceUpdate(products) {
  // products: [{product_id, price?, availability?, availability_id?, delivery_time?, discount_price_level_1..3?}]
  return (await api('PUT', '/api/products/helper/price_update', { body: { products } })).data;
}
async function bulkWarehouseQuantity(products) {
  // products: [{product_id, warehouse_id?, quantity?, purchase_price?}]
  return (await api('PUT', '/api/products/helper/warehouse_quantity', { body: { products } })).data;
}

// ---------- Słowniki ----------
async function listCategories(query = {}) { return (await api('GET', '/api/categories', { query })).data; }
async function createCategory(cat)        { return (await api('POST', '/api/categories', { body: cat })).data; }
async function listProducers(query = {})  { return (await api('GET', '/api/producers', { query })).data; }
async function createProducer(prod)       { return (await api('POST', '/api/producers', { body: prod })).data; }
async function listVatRates()             { return (await api('GET', '/api/vat_rates')).data; }
async function listWarehouses()           { return (await api('GET', '/api/warehouses')).data; }
async function listUnits()                { return (await api('GET', '/api/units')).data; }

// ---------- Zamówienia ----------
async function listOrders({ page = 1, limit = 50, ...extra } = {}) {
  return (await api('GET', '/api/orders', { query: { page, limit: Math.min(limit, 50), ...extra } })).data;
}
async function getOrder(id) { return (await api('GET', `/api/orders/${id}`)).data; }

// ---------- Diagnostyka ----------
async function ping() {
  const t = await getAccessToken(true);
  const vats = await listVatRates().catch(e => ({ error: e.message }));
  return {
    ok: true,
    shop: SHOP_URL,
    token_prefix: t.slice(0, 12) + '...',
    expires_in_seconds: tokenCache.expires_at - Math.floor(Date.now() / 1000),
    vat_probe: Array.isArray(vats?.data) ? `OK (${vats.data.length} stawek)` : vats,
  };
}

module.exports = {
  // low-level
  api, getAccessToken,
  // products
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  upsertProductWarehouse,
  getProductMultiCat, setProductMultiCat, deleteProductMultiCat,
  bulkPriceUpdate, bulkWarehouseQuantity,
  // dictionaries
  listCategories, createCategory,
  listProducers, createProducer,
  listVatRates, listWarehouses, listUnits,
  // orders
  listOrders, getOrder,
  // diag
  ping,
  // config
  get config() {
    return { shop_url: SHOP_URL, client_id: CLIENT_ID, scope: SCOPE };
  },
};
