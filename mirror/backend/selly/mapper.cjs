// backend/selly/mapper.cjs
// Mapowanie: wiersz z Bridge (tabela products, snake_case) → payload Selly.pl (POST /api/products).
// Uwaga: schemat kolumn wg backend/db_schema.sql (products).

'use strict';

// ---- Konfiguracja ----
const DEFAULT_VAT_RATE     = 23;   // % - opony w PL
const DEFAULT_WAREHOUSE_ID = 1;    // Magazyn główny w Selly (fallback)
const DEFAULT_UNIT         = 1;    // 1 = szt.
const DEFAULT_AVAILABILITY = 'dostępny';

/**
 * Zwraca category_id w Selly dla wartości "kategoria" z Bridge.
 * @param {string} kategoria  - np. "Rolnicze", "Leśne", "Przemysłowe", "Ciężarowe"
 * @param {Object} catMap     - { "opony rolnicze": 1, "opony leśne": 2, ... }
 */
function mapCategoryId(kategoria, catMap) {
  const k = (kategoria || '').trim().toLowerCase();
  if (!k) return null;
  // dokładne dopasowania
  const table = {
    'rolnicze':      'opony rolnicze',
    'leśne':         'opony leśne',
    'lesne':         'opony leśne',
    'przemysłowe':   'opony  przemysłowe',   // uwaga: podwójna spacja w Selly demo
    'przemyslowe':   'opony  przemysłowe',
    'ciężarowe':     'opony ciężarowe',
    'ciezarowe':     'opony ciężarowe',
  };
  const wanted = table[k];
  if (!wanted) return null;
  // fallback: spacje pojedyncze vs podwójne
  return catMap[wanted]
      || catMap[wanted.replace(/  +/g, ' ')]
      || catMap[wanted.replace(/ /g, '  ')]
      || null;
}

/**
 * Zwraca producer_id w Selly dla wartości "marka" z Bridge.
 * @param {string} marka
 * @param {Object} producerMap - { "alliance": 2, "bkt": 4, ... }
 */
function mapProducerId(marka, producerMap) {
  return producerMap[(marka || '').trim().toLowerCase()] || null;
}

/**
 * Zwraca warehouse_id w Selly dla symbolu dostawcy MO1-MO10.
 * Każdy dostawca ma dedykowany magazyn w Selly o tej samej nazwie (np. dostawca="MO1" -> magazyn "MO1").
 * Jeśli magazyn nie istnieje w Selly - fallback do magazynu głównego (id=1) i zwróć warning.
 *
 * @param {string} dostawca  - np. "MO1", "MO8"
 * @param {Object} whMap     - { "mo1": 3, "mo2": 2, ..., "magazyn główny": 1 }
 * @returns {number}         - id magazynu Selly
 */
function mapWarehouseId(dostawca, whMap) {
  const key = (dostawca || '').trim().toLowerCase();
  if (whMap[key]) return whMap[key];
  // fallback: magazyn główny
  return whMap['magazyn główny'] || whMap['magazyn glowny'] || DEFAULT_WAREHOUSE_ID;
}

/**
 * Buduje HTML z parametrami technicznymi opony.
 */
function buildTireDescription(p) {
  const rows = [];
  const add = (k, v) => {
    if (v === null || v === undefined || v === '' || v === false) return;
    rows.push(`<tr><td><b>${k}</b></td><td>${String(v).replace(/</g,'&lt;')}</td></tr>`);
  };
  add('Rozmiar',        p.rozmiar);
  add('Szerokość',      p.szerokosc);
  add('Profil',         p.profil);
  add('Średnica',       p.srednica);
  add('Konstrukcja',    p.konstrukcja);
  add('Indeks nośności',p.indeks_nosnosci || p.indeks_1);
  add('Indeks prędkości', p.indeks_predkosci || p.indeks_2);
  add('PR',             p.pr);
  add('TL/TT',          p.tl_tt);
  add('VF/IF',          p.vf_if);
  add('Bieżnik',        p.bieznik);
  add('Model',          p.model);
  add('DOT',            p.dot);
  add('Sezon',          p.sezon);
  add('M+S',            p.ms ? 'tak' : null);
  add('3PMSF',          p.snow_3pmsf ? 'tak' : null);
  add('Reinforced',     p.reinforced ? 'tak' : null);
  add('Extra Load',     p.extra_load ? 'tak' : null);
  add('Odporność na przecięcia', p.cut_resistant ? 'tak' : null);
  add('Odporność na temperaturę', p.heat_resistant ? 'tak' : null);
  add('Odporność na ściernisko', p.stubble_resistant ? 'tak' : null);
  add('Waga (kg)',      p.waga);
  add('Kod dostawcy',   p.kod_dostawcy);
  if (!rows.length) return '';
  return `<table class="tire-specs">${rows.join('')}</table>`;
}

/**
 * Rozbija string zastosowania na pojedyncze wartości.
 * "Koparka + Ładowarka kołowa" -> ["Koparka", "Ładowarka kołowa"]
 */
function splitZastosowanie(zastosowanie) {
  if (!zastosowanie) return [];
  return zastosowanie.split('+').map(s => s.trim()).filter(Boolean);
}

/**
 * Zwraca category_id głównej kategorii Selly (Rolnicze/Przemysłowe/Ciężarowe/Leśne) dla
 * surowej wartości products.kategoria, przez tabelę selly_kategoria_norm_map
 * (obsługuje warianty pisowni: przemyslowe/przemysłowe/Przemysłowe itd.)
 */
function mapKategoriaGlownaId(db, kategoriaRaw) {
  if (!kategoriaRaw) return null;
  const row = db.prepare(
    'SELECT category_id_glowna FROM selly_kategoria_norm_map WHERE kategoria_raw = ?'
  ).get(kategoriaRaw.trim());
  return row ? row.category_id_glowna : null;
}

/**
 * Mapuje produkt na { category_id, extra_cat_ids, source } na podstawie pola "zastosowanie".
 * Reguły (ustalone z użytkownikiem):
 *  - Pierwsza wartość zastosowania = kategoria główna produktu w Selly (category_id).
 *  - Kolejne wartości (po " + ") = dodatkowe kategorie -> multi_cat.
 *  - Wartości "(ogólne)"/"Uniwersalne" (dziedziczy_kategorie_produktu=1) nie mają własnej
 *    podkategorii - produkt idzie tylko do kategorii głównej wyliczonej z products.kategoria.
 *    Słowo "ogólne" NIGDY nie trafia do Selly jako nazwa kategorii.
 *  - Jeśli produkt nie ma zastosowania (NULL, gap danych Excel) -> fallback do kategorii głównej
 *    z products.kategoria, bez multi_cat.
 *
 * @param {Object} db  - instancja better-sqlite3
 * @param {Object} row - wiersz z tabeli products
 */
function mapZastosowanieCategory(db, row) {
  const wartosci = splitZastosowanie(row.zastosowanie);

  if (wartosci.length === 0) {
    const catId = mapKategoriaGlownaId(db, row.kategoria);
    return { category_id: catId, extra_cat_ids: [], source: 'fallback_kategoria' };
  }

  const getMapRow = db.prepare(
    'SELECT category_id_glowna, category_id_zastosowanie, dziedziczy_kategorie_produktu FROM selly_zastosowanie_category_map WHERE zastosowanie = ?'
  );

  const resolved = [];
  for (const w of wartosci) {
    const m = getMapRow.get(w);
    if (!m) continue; // nieznana wartość - pomijamy (coverage 100%, nie powinno się zdarzyć)
    if (m.dziedziczy_kategorie_produktu) {
      const glownaId = mapKategoriaGlownaId(db, row.kategoria);
      if (glownaId) resolved.push(glownaId);
    } else {
      resolved.push(m.category_id_zastosowanie);
    }
  }

  const unique = [...new Set(resolved.filter(Boolean))];

  if (unique.length === 0) {
    const catId = mapKategoriaGlownaId(db, row.kategoria);
    return { category_id: catId, extra_cat_ids: [], source: 'fallback_empty' };
  }

  return { category_id: unique[0], extra_cat_ids: unique.slice(1), source: 'zastosowanie' };
}

/**
 * Konwertuje wiersz z tabeli products (snake_case) do payloadu Selly /api/products.
 * @param {Object} row          - wiersz z SQLite
 * @param {Object} maps         - { producerMap, catMap }
 * @param {Object} opts         - { warehouse_id, vat_rate, db }
 *   opts.db - WYMAGANE dla nowej logiki zastosowania (instancja better-sqlite3);
 *             jeśli nie podane, funkcja wraca do starej logiki mapCategoryId (tylko kategoria główna).
 * @returns {Object}            - payload gotowy do POST /api/products, plus payload._extra_cat_ids
 *                                 (tablica dodatkowych category_id na multi_cat, niewysyłana do Selly w tym obiekcie)
 */
function toSellyPayload(row, maps, opts = {}) {
  // Warehouse ID: 1) explicit opts, 2) mapowanie dostawca->magazyn, 3) fallback do glównego
  const warehouseId = opts.warehouse_id
    ?? mapWarehouseId(row.dostawca, maps.whMap || {})
    ?? DEFAULT_WAREHOUSE_ID;
  const vatRate     = opts.vat_rate     ?? row.vat ?? DEFAULT_VAT_RATE;

  let category_id;
  let extra_cat_ids = [];
  if (opts.db) {
    const mapped = mapZastosowanieCategory(opts.db, row);
    category_id = mapped.category_id;
    extra_cat_ids = mapped.extra_cat_ids;
  } else {
    // Stara logika (bez db) - zachowana dla kompatybilności / testów
    category_id = mapCategoryId(row.kategoria, maps.catMap);
  }
  const producer_id = mapProducerId(row.marka, maps.producerMap);

  return {
    // ---- Product ----
    name: row.nazwa,
    category_id,
    producer_id: producer_id || undefined,
    price: Number(row.cena_sprzedazy) || 0,
    visible: true,
    // ---- ProductProperties ----
    product_code:   row.kod,
    provider_code:  row.kod_dostawcy || row.kod,
    ean:            row.ean || '',
    vat_rate:       Number(vatRate),
    price_purchase: Number(row.cena_zakupu) || 0,
    warehouse_id:   warehouseId,
    weight:         Number(row.waga) || 0,
    content_html:   buildTireDescription(row),
    unit_of_measure: DEFAULT_UNIT,
    availability:   DEFAULT_AVAILABILITY,
    // ---- Nie wysyłane bezpośrednio w tym payloadzie - użyte osobno na multi_cat ----
    _extra_cat_ids: extra_cat_ids,
  };
}

/**
 * Waliduje payload przed wysyłką. Zwraca { ok, errors: [...] }.
 */
function validatePayload(payload) {
  const errors = [];
  if (!payload.name)         errors.push('Brak name');
  if (!payload.category_id)  errors.push('Brak category_id (nieznana kategoria)');
  if (!payload.producer_id)  errors.push('Brak producer_id (nieznana marka) — produkt zostanie pominięty');
  if (!(payload.price >= 0)) errors.push('Nieprawidłowa cena');
  if (payload.price === 0)   errors.push('Cena = 0 — produkt nie może być wysłany do Selly');
  if (!payload.product_code) errors.push('Brak product_code');
  return { ok: errors.length === 0, errors };
}

module.exports = {
  toSellyPayload,
  validatePayload,
  buildTireDescription,
  mapCategoryId,
  mapProducerId,
  mapWarehouseId,
  mapZastosowanieCategory,
  mapKategoriaGlownaId,
  splitZastosowanie,
  DEFAULT_VAT_RATE,
  DEFAULT_WAREHOUSE_ID,
};
