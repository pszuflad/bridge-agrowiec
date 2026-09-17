// backend/selly/mapper_v2.cjs
// v2.1 (2026-09-08): Mapper Bridge -> Selly dla Tor 1 (delta) i Tor 2 (full).
//
// Zmiana 2026-09-08:
//  - USUNIETO `vat_rate` z toSellyPayloadV2 - Anna: VAT nadawany w Selly na kategorii, nie migrujemy
//  - DODANO `buildProductPayload(row, dictMaps)` - kompletny payload dla POST /api/products (Tor 2 auto-create)
//
// Zasady:
//  - provider_code = kod_importu (nie kod_dostawcy)
//  - Pelna mapa 21 features (Bieznik/model uzywa 'bieznik', nie 'model')
//  - Swiadomie NIE ustawia: content_html, html_*, unit_of_measure, availability,
//    dlugosc/szerokosc_paczki/wysokosc/wysokosc_przesylki, warehouse_id (magazyn przez feature)
//  - Swiadomie POMIJANE features: 'Lod' (label_ice zepsute), 'Magazyny' (feature na wariancie)

'use strict';

// ---- Helpers transformacji wartosci features ----

/**
 * Konwersja wartosci "flag" z Bridge (0/1/'Tak'/null/'') na format Selly ('Tak' lub null).
 */
function yn(v) {
  if (v === null || v === undefined || v === '' || v === 0 || v === '0') return null;
  if (v === 1 || v === '1' || v === true || v === 'Tak' || v === 'tak' || v === 'TAK') return 'Tak';
  const s = String(v).trim();
  return s || null;
}

function txt(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (isNaN(n)) return txt(v);
  return n.toString();
}

function zastosowaniePierwsze(v) {
  if (!v) return null;
  const first = String(v).split('+')[0].trim();
  return first || null;
}

// ---- Mapa 21 features Bridge -> Selly ----
const FEATURE_MAP = [
  ['Bieżnik / model',      'bieznik',              txt],
  ['Rozmiar',              'rozmiar',              txt],
  ['Szerokość opony',      'szerokosc',            txt],
  ['Profil',               'profil',               num],
  ['Średnica',             'srednica',             num],
  ['Rozmiar alternatywny', 'rozmiar_alternatywny', txt],
  ['R/D',                  'konstrukcja',          txt],
  ['PR',                   'pr',                   txt],
  ['TL/TT',                'tl_tt',                txt],
  ['Indeksy',              'indeksy',              txt],
  ['Indeks nośności',      'indeks_nosnosci',      txt],
  ['Indeks prędkości',     'indeks_predkosci',     txt],
  ['DOT',                  'dot',                  txt],
  ['Zastosowanie',         'zastosowanie',         zastosowaniePierwsze],
  ['Przyczepność',         'label_wet',            txt],
  ['Opór toczenia',        'label_rolling',        txt],
  ['Hałas',                'label_noise',          txt],
  ['Błoto + śnieg',        'ms',                   yn],
  ['Śnieg-3PMSF',          'snow_3pmsf',           yn],
  ['Śnieg',                'label_snow',           yn],
  ['Marka',                'marka',                txt],
];

/**
 * Zbuduj tablice features do payloadu Selly z wiersza Bridge.
 * Pomija features z null (nie kasuje istniejacych w Selly).
 */
function buildFeatures(row) {
  const features = [];
  for (const [sellyName, bridgeCol, fn] of FEATURE_MAP) {
    const rawVal = row[bridgeCol];
    const mapped = fn(rawVal);
    if (mapped !== null && mapped !== undefined && mapped !== '') {
      features.push({ name: sellyName, values: [String(mapped)] });
    }
  }
  return features;
}

/**
 * Mirror mode: dla kazdej cechy w Selly, wyslij wartosc z Bridge (jesli mamy w mapie).
 * Cechy w Selly poza mapa - zachowaj (zeby nie skasowac).
 * Cechy z mapy ktorych nie ma w Selly - dodaj (wzbogacenie).
 */
function buildFeaturesMirror(row, existingFeatures) {
  const bridgeFeatures = buildFeatures(row);
  const bridgeByName = new Map(bridgeFeatures.map(f => [f.name, f]));
  const result = [];
  for (const existing of (existingFeatures || [])) {
    if (bridgeByName.has(existing.name)) {
      result.push(bridgeByName.get(existing.name));
      bridgeByName.delete(existing.name);
    } else {
      result.push({ name: existing.name, values: existing.values });
    }
  }
  for (const [, f] of bridgeByName) {
    result.push(f);
  }
  return result;
}

/**
 * Payload dla PUT /api/products/{id} (Tor 2 mirror).
 * NIE zawiera: vat_rate (Anna 2026-09-08), category_id, producer_id, warehouse_id,
 * content_html, html_*, price (per wariant), unit_of_measure, availability.
 *
 * @param {Object} row - wiersz products (snake_case)
 * @param {Object} opts - { includeFeatures: bool, existingSellyFeatures: Array }
 */
function toSellyPayloadV2(row, opts = {}) {
  const payload = {
    name:           row.nazwa,
    weight:         Number(row.waga) || 0,
    provider_code:  row.kod_importu || row.kod_dostawcy || null,
    price_purchase: Number(row.cena_zakupu) || 0,
    visible:        row.status === 'aktywny',
  };

  if (row.ean && row.ean_is_valid) {
    payload.ean = row.ean;
  }

  if (opts.includeFeatures) {
    payload.features = opts.existingSellyFeatures
      ? buildFeaturesMirror(row, opts.existingSellyFeatures)
      : buildFeatures(row);
  }

  return payload;
}

/**
 * KOMPLETNY payload dla POST /api/products (Tor 2 auto-create).
 * Rozszerza toSellyPayloadV2 o pola wymagane przy tworzeniu:
 *   - category_id (z dictMaps.catMap)
 *   - producer_id (z dictMaps.prodMap)
 *   - product_code (kod Bridge bez podkreslnika)
 *   - price (cena sprzedazy na start)
 *
 * Zwraca null gdy brak wymaganych sowinikow.
 *
 * @param {Object} row - wiersz products z JOIN
 * @param {Object} dictMaps - { catMap: Map, prodMap: Map }
 * @returns {Object|null}
 */
function buildProductPayload(row, dictMaps = {}) {
  const catMap = dictMaps.catMap;
  const prodMap = dictMaps.prodMap;

  // Slowniki moga byc Map lub zwyklym objectem
  const catKey = String(row.kategoria || '').toLowerCase();
  const prodKey = String(row.marka || '').toLowerCase();

  const catId = catMap instanceof Map ? catMap.get(catKey) : (catMap && catMap[catKey]);
  const prodId = prodMap instanceof Map ? prodMap.get(prodKey) : (prodMap && prodMap[prodKey]);

  if (!catId) {
    return { _error: `Brak kategorii w slowniku: "${row.kategoria}" (klucz=${catKey})` };
  }
  if (!prodId) {
    return { _error: `Brak producenta w slowniku: "${row.marka}" (klucz=${prodKey})` };
  }

  // Bazowy payload (bez vat_rate)
  const payload = toSellyPayloadV2(row, { includeFeatures: true });

  // Rozszerz o pola dla POST
  payload.category_id  = catId;
  payload.producer_id  = prodId;
  payload.product_code = String(row.kod || '').replace(/_/g, '');
  payload.price        = Number(row.cena_sprzedazy) || 0;

  return payload;
}

/**
 * Payload minimalny dla Toru 1 (delta ceny/stan).
 */
function toDeltaPayload(bridgeRow, lastSent) {
  const changes = {};
  const currentPrice   = Number(bridgeRow.cena_sprzedazy) || 0;
  const currentPurchase = Number(bridgeRow.cena_zakupu) || 0;
  const currentStock   = Number(bridgeRow.stan) || 0;

  const lastPrice    = lastSent ? Number(lastSent.cena_sprzedazy_wyslana) : null;
  const lastPurchase = lastSent ? Number(lastSent.cena_zakupu_wyslana) : null;
  const lastStock    = lastSent ? Number(lastSent.stan_wyslany) : null;

  if (lastPrice !== currentPrice) changes.price = currentPrice;
  if (lastPurchase !== currentPurchase) changes.price_purchase = currentPurchase;
  changes._stock = currentStock;
  changes._stockChanged = (lastStock !== currentStock);

  const hasProductChange = ('price' in changes) || ('price_purchase' in changes);
  if (!hasProductChange && !changes._stockChanged) {
    return null;
  }

  return changes;
}

// ---- Kod dostawcy -> feature_id na wariancie 'Magazyny' ----
const DOSTAWCA_TO_MAGAZYN_FEATURE_ID = {
  'MO9': 1, 'MO5': 2, 'MO4': 3, 'MO3': 4, 'MO2': 5,
  // MO1, MO6, MO7, MO8, MO10 - odkryte przy pierwszym POST/GET wariantu
};

function getMagazynFeatureIdForDostawca(dostawca) {
  return DOSTAWCA_TO_MAGAZYN_FEATURE_ID[dostawca] || null;
}

module.exports = {
  toSellyPayloadV2,
  buildProductPayload,   // NEW 2026-09-08 - dla Tor 2 auto-create
  toDeltaPayload,
  buildFeatures,
  buildFeaturesMirror,
  yn, txt, num, zastosowaniePierwsze,
  FEATURE_MAP,
  DOSTAWCA_TO_MAGAZYN_FEATURE_ID,
  getMagazynFeatureIdForDostawca,
};
