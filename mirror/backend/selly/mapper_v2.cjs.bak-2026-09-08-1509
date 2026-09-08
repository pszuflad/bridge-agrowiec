// backend/selly/mapper_v2.cjs
// v2: Mapper Bridge -> Selly dla nocnego sync (Tor 2) i delta (Tor 1).
//
// Kluczowe różnice względem mapper.cjs (v1):
//  - provider_code = kod_importu (nie kod_dostawcy) - NAPRAWA BUGA
//  - Pełna mapa 21 features (Bieżnik/model uzywa 'bieznik', nie 'model')
//  - Świadomie NIE ustawia: content_html, html_*, unit_of_measure, availability,
//    dlugosc/szerokosc_paczki/wysokosc/wysokosc_przesylki, category_id, producer_id,
//    warehouse_id (magazyn przez feature 'Magazyny' na wariancie, nie ruszamy)
//  - Świadomie POMIJANE features: 'Lód' (label_ice zepsute), 'Magazyny' (feature na wariancie)
//
// Data: 2026-09-07

'use strict';

// ---- Konfiguracja ----
const DEFAULT_VAT_RATE = 23;

// ---- Helpers transformacji wartości features ----

/**
 * Konwersja wartości "flag" z Bridge (0/1/'Tak'/null/'') na format Selly ('Tak' lub null).
 * Etykiety UE: M+S, 3PMSF, label_snow.
 */
function yn(v) {
  if (v === null || v === undefined || v === '' || v === 0 || v === '0') return null;
  if (v === 1 || v === '1' || v === true || v === 'Tak' || v === 'tak' || v === 'TAK') return 'Tak';
  // Awaryjne: jeśli coś innego (np. liczba dB) - zwracamy string
  const s = String(v).trim();
  return s || null;
}

/**
 * Konwersja tekstowa: null/'' -> null, reszta -> trim string.
 */
function txt(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * Konwersja liczbowa która ma być tekstem (bez końcowych zer po kropce).
 * 17.5 -> "17.5", 17.0 -> "17", 17 -> "17"
 */
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (isNaN(n)) return txt(v);
  // Sprowadź do stringa bez końcowych zer
  const s = n.toString();
  return s;
}

/**
 * Zastosowanie: pierwsza wartość przed '+', bez '(ogólne)' etc.
 * 'Koparka + Ładowarka kołowa' -> 'Koparka'
 */
function zastosowaniePierwsze(v) {
  if (!v) return null;
  const first = String(v).split('+')[0].trim();
  return first || null;
}

// ---- Mapa 21 features Bridge -> Selly ----
// Format: [nazwa_selly, pole_bridge, funkcja_transformacji]
// Kolejność ma znaczenie (dla ładniejszego payloadu w logach)
const FEATURE_MAP = [
  ['Bieżnik / model',      'bieznik',              txt],   // Anna: bieznik (nie model)
  ['Rozmiar',              'rozmiar',              txt],
  ['Szerokość opony',      'szerokosc',            txt],
  ['Profil',               'profil',               num],   // ODKRYTE w produkcie 407
  ['Średnica',             'srednica',             num],
  ['Rozmiar alternatywny', 'rozmiar_alternatywny', txt],   // ODKRYTE w produkcie 462
  ['R/D',                  'konstrukcja',          txt],
  ['PR',                   'pr',                   txt],   // ODKRYTE w produkcie 407
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

// Features SWIADOMIE NIE mapowane:
// - 'Lód' (label_ice) - zepsute w Bridge (0% pokrycia, "0.0" wartości)
// - 'Magazyny' - feature na wariancie, osobny endpoint

/**
 * Zbuduj tablicę features do payloadu Selly z wiersza Bridge.
 * Pomija features z null (nie wysyłamy pustych wartości - nie skasujemy istniejących w Selly).
 *
 * @param {Object} row - wiersz z tabeli products (snake_case)
 * @returns {Array<{name: string, values: string[]}>}
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
 * Zbuduj listę features do wysłania W TRYBIE MIRROR (bezpiecznym):
 * Dla każdej cechy KTÓRA JEST W SELLY, wyślij wartość z Bridge (jeśli mamy).
 * Cechy w Selly których NIE MA W NASZEJ MAPIE - pomijamy (żeby ich nie skasować).
 * Cechy w NASZEJ MAPIE których nie ma w Selly - dodajemy (wzbogacenie).
 *
 * @param {Object} row - wiersz z Bridge
 * @param {Array} existingFeatures - features aktualnie w Selly (z GET produktu)
 * @returns {Array}
 */
function buildFeaturesMirror(row, existingFeatures) {
  const bridgeFeatures = buildFeatures(row);
  const bridgeByName = new Map(bridgeFeatures.map(f => [f.name, f]));

  const result = [];

  // 1) Dla każdej cechy w Selly - dołóż wartość z Bridge jeśli mamy w mapie,
  //    inaczej ZACHOWAJ aktualną (żeby nie skasować cech spoza naszej mapy)
  for (const existing of (existingFeatures || [])) {
    if (bridgeByName.has(existing.name)) {
      result.push(bridgeByName.get(existing.name));
      bridgeByName.delete(existing.name); // oznacz jako wysłane
    } else {
      // Cecha spoza naszej mapy - zachowaj aktualną wartość
      result.push({ name: existing.name, values: existing.values });
    }
  }

  // 2) Cechy z Bridge których nie było w Selly - dodaj (wzbogacenie)
  for (const [, f] of bridgeByName) {
    result.push(f);
  }

  return result;
}

/**
 * Zbuduj payload podstawowy dla PUT/POST /api/products/{id}.
 * Zawiera tylko pola które CHCEMY nadpisać - reszta pozostaje w Selly bez zmian.
 *
 * Pola wysyłane:
 *  - name, vat_rate, weight, ean (gdy valid)
 *  - provider_code = kod_importu (NAPRAWA BUGA - był kod_dostawcy)
 *  - price_purchase, visible
 *
 * NIE wysyłamy (świadomie):
 *  - content_html, html_title/description/keywords (Anna: SEO nie ruszamy)
 *  - unit_of_measure, availability (nie wymagane)
 *  - category_id, producer_id (drzewo do zbudowania osobno)
 *  - warehouse_id (magazyn przez wariant)
 *  - price (cena sprzedaży w Selly = ręczna narzuty)
 *  - dlugosc/szerokosc_paczki/wysokosc/wysokosc_przesylki (Selly liczy)
 *
 * @param {Object} row - wiersz z products
 * @param {Object} opts - { includeFeatures: boolean, existingSellyFeatures: Array }
 * @returns {Object}
 */
function toSellyPayloadV2(row, opts = {}) {
  const payload = {
    name:           row.nazwa,
    vat_rate:       Number(row.vat ?? DEFAULT_VAT_RATE),
    weight:         Number(row.waga) || 0,
    provider_code:  row.kod_importu || row.kod_dostawcy || null,  // POPRAWIONE
    price_purchase: Number(row.cena_zakupu) || 0,
    visible:        row.status === 'aktywny',
  };

  // EAN tylko gdy valid (97.9% pokrycia)
  if (row.ean && row.ean_is_valid) {
    payload.ean = row.ean;
  }

  // Features - opcjonalnie (Tor 2 tak, Tor 1 nie)
  if (opts.includeFeatures) {
    payload.features = opts.existingSellyFeatures
      ? buildFeaturesMirror(row, opts.existingSellyFeatures)
      : buildFeatures(row);
  }

  return payload;
}

/**
 * Payload minimalny dla Toru 1 (delta ceny/stan).
 * Zwraca TYLKO pola które się zmieniły.
 *
 * @param {Object} bridgeRow - wiersz z Bridge
 * @param {Object} lastSent - ostatnio wysłany snapshot z selly_products (może być null)
 * @returns {Object|null} - payload lub null jeśli nic się nie zmieniło
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
  // stock jest osobnym endpointem (warehouse_quantity), nie w payload
  changes._stock = currentStock;
  changes._stockChanged = (lastStock !== currentStock);

  const hasProductChange = ('price' in changes) || ('price_purchase' in changes);
  if (!hasProductChange && !changes._stockChanged) {
    return null;  // nic się nie zmieniło
  }

  return changes;
}

// ---- Kod dostawcy -> feature_id na wariancie 'Magazyny' ----
// Odkryte 2026-09-07 z produktów 407,1927,215,1524,60,1049,462,1547
const DOSTAWCA_TO_MAGAZYN_FEATURE_ID = {
  'MO9': 1,
  'MO5': 2,
  'MO4': 3,
  'MO3': 4,
  'MO2': 5,
  // MO1, MO6, MO7, MO8, MO10 - do wykrycia z Selly przy pierwszym auto-create
};

function getMagazynFeatureIdForDostawca(dostawca) {
  return DOSTAWCA_TO_MAGAZYN_FEATURE_ID[dostawca] || null;
}

module.exports = {
  // Główne funkcje
  toSellyPayloadV2,
  toDeltaPayload,
  buildFeatures,
  buildFeaturesMirror,
  // Helpers
  yn, txt, num, zastosowaniePierwsze,
  // Mapa
  FEATURE_MAP,
  DOSTAWCA_TO_MAGAZYN_FEATURE_ID,
  getMagazynFeatureIdForDostawca,
  // Stałe
  DEFAULT_VAT_RATE,
};
