// MO9 Agrorami — źródło danych: API GraphQL (hurtownia.agrorami.pl)
// Zastępuje pobieranie pliku agrorami.csv. Zwraca records[] w DOKŁADNIE tym samym
// kształcie co parsers/mo9_agrorami.cjs (parseFile) — z record.surowe_pola zawierającym
// klucze, których oczekuje adapter → tyre.normalizeAgrorami:
//   id, ean, producent, bieznik, rozmiar, nosnosc, predkosc, 'tl/tt', plotna,
//   cena, magazyn, waga, kategoria, sezon
//
// KLUCZOWE MAPOWANIE STANU (decyzja Anny 2026-07-09):
//   stock_availability.in_stock_real  →  surowe_pola.magazyn
//   Wartość "5+" zostaje jako string — common.cjs normalizeQty() zetnie "+" i da 5.
//   in_stock_real == null  →  brak stanu (magazyn=null) → normalizeQty → null → pozycja
//   będzie potraktowana przez tk() jako stan 0 przy zapisie do stagingu (stanNowy: d.stan ?? 0).
//
// Token: ważny 1h. Lazy auto-refresh w pamięci procesu (bufor 5 min, retry raz na 401).
// Dane logowania z .env: AGRORAMI_EMAIL, AGRORAMI_PASSWORD.

'use strict';

const c = require('../common.cjs');

const DOSTAWCA = 'MO9_Agrorami';

const GRAPHQL_URL = process.env.AGRORAMI_GRAPHQL_URL || 'https://hurtownia.agrorami.pl/graphql?store=pl';
const CATEGORY_ID = process.env.AGRORAMI_CATEGORY_ID || '148'; // Opony BKT = 1113 szt.
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30000;
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // odśwież 5 min przed wygaśnięciem
const TOKEN_TTL_MS = 55 * 60 * 1000;   // zakładamy ~1h, odświeżamy po 55 min

// ---- Mapowanie kategorii Agrorami → słownik Bridge (zgodne z mo9_agrorami.cjs) ----
const KATEGORIA_MAP = {
  'rolnicze': 'rolnicze',
  'leśne': 'leśne', 'lesne': 'leśne',
  'przemysłowe': 'przemysłowe', 'przemyslowe': 'przemysłowe',
  'ciężarowe': 'ciężarowe', 'ciezarowe': 'ciężarowe',
  'dętki': 'dętki', 'detki': 'dętki',
  'akcesoria': 'akcesoria',
  'inne': 'rolnicze' // DECYZJA ANNY: inne → rolnicze
};

// Override rozmiaru dla pozycji, gdzie dostawca wpisuje indeks zamiast wymiaru (jak w CSV parserze)
const ROZMIAR_OVERRIDE = {
  '106946': '540/65R38' // BKT AGRIMAX RT 657
};

// ---- Cache tokenu (per proces) ----
let _token = null;
let _tokenExp = 0;

function _creds() {
  const email = process.env.AGRORAMI_EMAIL;
  const password = process.env.AGRORAMI_PASSWORD;
  if (!email || !password) {
    throw new Error('Brak AGRORAMI_EMAIL / AGRORAMI_PASSWORD w .env');
  }
  return { email, password };
}

async function _gqlFetch(query, variables, token) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal
    });
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch (_) {
      throw new Error(`Agrorami: niepoprawny JSON (HTTP ${resp.status}): ${text.slice(0, 200)}`);
    }
    return { httpStatus: resp.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function _isAuthError(json, httpStatus) {
  if (httpStatus === 401) return true;
  const errs = (json && json.errors) || [];
  return errs.some(e => {
    const msg = (e && e.message ? String(e.message) : '').toLowerCase();
    const cat = (e && e.extensions && e.extensions.category ? String(e.extensions.category) : '').toLowerCase();
    return cat === 'graphql-authorization' ||
      msg.includes('unauthorized') || msg.includes('token') ||
      msg.includes('current customer') || msg.includes('not authorized');
  });
}

async function _generateToken() {
  const { email, password } = _creds();
  const mutation = `mutation($email:String!,$password:String!){generateCustomerToken(email:$email,password:$password){token}}`;
  const { httpStatus, json } = await _gqlFetch(mutation, { email, password }, null);
  const token = json && json.data && json.data.generateCustomerToken && json.data.generateCustomerToken.token;
  if (!token) {
    const err = json && json.errors ? JSON.stringify(json.errors).slice(0, 300) : `HTTP ${httpStatus}`;
    throw new Error(`Agrorami: nie udało się wygenerować tokenu: ${err}`);
  }
  _token = token;
  _tokenExp = Date.now() + TOKEN_TTL_MS;
  return token;
}

async function _getToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _token && now < (_tokenExp - TOKEN_BUFFER_MS)) return _token;
  return _generateToken();
}

// Zapytanie o produkty (keyset po entity_id). Filtr: kategoria + entity_id > kursor.
const PRODUCTS_QUERY = `
query($catId:String!,$after:String!,$pageSize:Int!){
  products(
    filter:{ category_id:{eq:$catId}, entity_id:{gt:$after} }
    sort:{ entity_id:ASC }
    pageSize:$pageSize
    currentPage:1
  ){
    total_count
    items{
      id
      sku
      name
      ean
      manufacturer
      url_key
      stock_status
      stock_availability{ in_stock in_stock_real }
      categories{ id name }
      price_range{
        minimum_price{
          regular_price{ value currency }
          final_price{ value }
          individual_price{ net gross currency }
        }
      }
      image{ url }
      ... on SimpleProduct{ weight }
    }
  }
}`;

// Pobiera WSZYSTKIE produkty z danej kategorii keyset-paginacją, z auto-odnową tokenu.
async function fetchAllItems() {
  let token = await _getToken();
  const items = [];
  let after = '0';
  let totalCount = null;
  let retriedAuth = false;

  for (let guard = 0; guard < 1000; guard++) {
    const { httpStatus, json } = await _gqlFetch(PRODUCTS_QUERY, { catId: CATEGORY_ID, after, pageSize: PAGE_SIZE }, token);

    if (_isAuthError(json, httpStatus)) {
      if (retriedAuth) throw new Error('Agrorami: powtórny błąd autoryzacji po odnowie tokenu');
      retriedAuth = true;
      token = await _getToken(true); // wymuś świeży token i spróbuj raz jeszcze
      continue;
    }
    retriedAuth = false;

    if (json.errors && (!json.data || !json.data.products)) {
      throw new Error(`Agrorami: błąd GraphQL: ${JSON.stringify(json.errors).slice(0, 300)}`);
    }
    const products = json.data.products;
    if (totalCount == null) totalCount = products.total_count;
    const batch = products.items || [];
    if (batch.length === 0) break;

    for (const it of batch) items.push(it);

    // keyset: następny kursor = id ostatniego elementu
    const lastId = batch[batch.length - 1].id;
    after = String(lastId);

    if (batch.length < PAGE_SIZE) break; // ostatnia strona
  }

  return { items, totalCount };
}

// ---- Transformacja pojedynczego item GraphQL → record (kształt jak mo9.parseFile) ----
function itemToRecord(it) {
  const idDostawcy = String(it.id != null ? it.id : '').trim();

  // Nazwa produktu Agrorami w API to pole `name` (pełna nazwa handlowa),
  // np. "540/65R38 BKT AGRIMAX RT 657 147D/144E TL". W CSV rozbite na kolumny
  // (producent/bieznik/rozmiar/nosnosc/predkosc/tl-tt). Tu nie mamy tego rozbicia,
  // więc rozmiar próbujemy wyłuskać z nazwy (c.extractSize), a resztę zostawiamy
  // normalizatorowi (normalizeAgrorami parsuje rozmiar+marki z pól, a nazwa końcowa
  // i tak jest budowana od nowa). Producenta bierzemy z pola `manufacturer` jeśli jest.
  const fullName = (it.name || '').trim();
  // UWAGA (naprawione 2026-07-10): pole `manufacturer` z API Agrorami to LICZBOWE ID
  // atrybutu Magento (np. 15), NIE nazwa marki jako string — zweryfikowane na żywo:
  // wszystkie produkty w kategorii 148 ("Opony BKT") mają manufacturer=15 albo null.
  // Ten magazyn sprzedaje wyłącznie markę BKT, więc ustawiamy producenta na stałe.
  const producent = 'BKT';

  // rozmiar: override → z nazwy
  let rozmiar = '';
  if (ROZMIAR_OVERRIDE[idDostawcy]) {
    rozmiar = ROZMIAR_OVERRIDE[idDostawcy];
  } else {
    const sz = c.extractSize(fullName);
    rozmiar = (sz && sz.rozmiar) ? sz.rozmiar : '';
  }

  // bieznik: przekazujemy pełną nazwę jako "bieznik" — normalizeAgrorami wyciąga
  // z niej oznaczenia techniczne (parseTechnicalMarks) i model. To najbezpieczniejsze,
  // bo cała informacja o modelu/oznaczeniach jest w nazwie handlowej.
  const bieznik = fullName;

  // kategoria: z drzewa kategorii API (nazwy). Mapujemy na słownik Bridge; fallback po nazwie.
  const catNames = Array.isArray(it.categories) ? it.categories.map(x => (x && x.name ? String(x.name).toLowerCase().trim() : '')).filter(Boolean) : [];
  let kategoriaRaw = '';
  for (const cn of catNames) {
    if (KATEGORIA_MAP[cn]) { kategoriaRaw = cn; break; }
    if (/rolnicz/.test(cn)) { kategoriaRaw = 'rolnicze'; break; }
    if (/przemys/.test(cn)) { kategoriaRaw = 'przemysłowe'; break; }
    if (/le[sś]n/.test(cn)) { kategoriaRaw = 'leśne'; break; }
    if (/ci[eę][zż]ar/.test(cn)) { kategoriaRaw = 'ciężarowe'; break; }
  }
  let kategoria = KATEGORIA_MAP[kategoriaRaw] || null;
  if (!kategoria) {
    kategoria = c.classifyByName(fullName);
  }
  // Override FLOT/Flotation (zgodnie z CSV parserem)
  if (kategoria === 'leśne' && /\bFLOT\b|Flotation|Flotmaster/i.test(fullName)) {
    kategoria = 'rolnicze';
  }

  // STAN: in_stock_real → magazyn (string, np. "5+"). null → null.
  const sa = it.stock_availability || {};
  const inStockReal = (sa.in_stock_real === null || sa.in_stock_real === undefined) ? '' : String(sa.in_stock_real);

  // CENA ZAKUPU: individual_price.net (cena indywidualna netto kontrahenta) →
  // fallback do final/regular jeśli brak individual.
  const minp = it.price_range && it.price_range.minimum_price ? it.price_range.minimum_price : {};
  const indiv = minp.individual_price || {};
  const cena = (indiv.net != null) ? indiv.net
    : (minp.final_price && minp.final_price.value != null) ? minp.final_price.value
    : (minp.regular_price && minp.regular_price.value != null) ? minp.regular_price.value
    : '';

  const ean = it.ean != null ? String(it.ean) : '';
  const waga = it.weight != null ? it.weight : '';
  const imageUrl = it.image && it.image.url ? it.image.url : '';

  // surowe_pola: KLUCZE muszą pasować do adapter→normalizeAgrorami (raw.*)
  const surowe = {
    id: idDostawcy,
    sku: it.sku != null ? String(it.sku) : '',
    ean: ean,
    producent: producent,
    bieznik: bieznik,        // pełna nazwa handlowa (normalizeAgrorami wyciąga marki/model)
    rozmiar: rozmiar,        // wykryty z nazwy lub override
    nosnosc: '',             // brak osobnego pola w API (LI wyciągane z nazwy przez normalizator)
    predkosc: '',            // brak osobnego pola w API (SI wyciągane z nazwy)
    'tl/tt': '',             // wyciągane z nazwy (parseTechnicalMarks)
    plotna: '',              // PR — wyciągane z nazwy
    cena: cena === '' ? '' : String(cena),
    magazyn: inStockReal,    // <-- in_stock_real; "5+" → normalizeQty → 5
    waga: waga === '' ? '' : String(waga),
    kategoria: kategoriaRaw || (kategoria || ''),
    sezon: '',
    // pola pomocnicze (nie czytane przez normalizeAgrorami, ale zachowane w snapshot):
    url_key: it.url_key || '',
    stock_status: it.stock_status || '',
    in_stock: (sa.in_stock === null || sa.in_stock === undefined) ? '' : String(sa.in_stock),
    in_stock_real: inStockReal,
    image_url: imageUrl,
    name_api: fullName
  };

  const sizeFromName = c.extractSize(fullName);
  const oznaczenia = [...new Set(c.extractTechnicalMarks(fullName))].filter(Boolean);

  return c.normalizeRecord({
    ean: c.normalizeEan(ean),
    kod_dostawcy: idDostawcy,
    nazwa: fullName,
    producent: producent,
    model_bieznik: bieznik,
    rozmiar: rozmiar || (sizeFromName && sizeFromName.rozmiar) || '',
    rozmiar_alternatywny: (sizeFromName && sizeFromName.alternatywny) || '',
    cena_zakupu: cena,
    stan_magazynowy: inStockReal,   // "5+" — normalizeRecord → normalizeQty → 5
    kategoria: kategoria,
    oznaczenia_techniczne: oznaczenia,
    dostawca: DOSTAWCA,
    link_zdjecia: imageUrl,
    surowe_pola: surowe
  });
}

// Główna funkcja: pobiera z API i zwraca kształt identyczny jak mo9.parseFile.
// Zwraca { records, errors, odrzucone, dostawca, totalCount }.
async function fetchAll() {
  const { items, totalCount } = await fetchAllItems();
  const records = [];
  const errors = [];
  const odrzucone = [];

  for (const it of items) {
    try {
      // Odrzucamy quady (jak w CSV parserze) — po nazwie/kategorii
      const nameL = (it.name || '').toLowerCase();
      const catL = (Array.isArray(it.categories) ? it.categories.map(x => (x && x.name) || '').join(' ') : '').toLowerCase();
      if (/\bquad\b/.test(nameL) || /\bquad\b/.test(catL)) {
        odrzucone.push({ powod: 'quad', id: it.id, name: it.name });
        continue;
      }
      records.push(itemToRecord(it));
    } catch (e) {
      errors.push({ id: it && it.id, name: it && it.name, error: e.message });
    }
  }

  return { records, errors, odrzucone, dostawca: DOSTAWCA, totalCount };
}

module.exports = { fetchAll, fetchAllItems, itemToRecord, DOSTAWCA, _getToken };
