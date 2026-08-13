require('dotenv').config();
const Database = require('better-sqlite3');
const db = new Database('data.db', { readonly: true });
const { toSellyPayload, validatePayload } = require('./selly/mapper.cjs');

// Odtwarzamy maps tak jak robi to ensureDict() w routes.cjs
const rows = db.prepare('SELECT slownik, klucz, wartosc_id FROM selly_dict').all();
const maps = { producerMap: {}, catMap: {}, vatMap: {}, whMap: {} };
for (const r of rows) {
  if (r.slownik === 'producers')  maps.producerMap[r.klucz] = r.wartosc_id;
  if (r.slownik === 'categories') maps.catMap[r.klucz]      = r.wartosc_id;
  if (r.slownik === 'vat_rates')  maps.vatMap[r.klucz]      = r.wartosc_id;
  if (r.slownik === 'warehouses') maps.whMap[r.klucz]       = r.wartosc_id;
}

const codes = ['MO1_19800286', 'MO1_15285410', 'MO1_15285312'];
for (const kod of codes) {
  const row = db.prepare('SELECT * FROM products WHERE kod = ?').get(kod);
  const payload = toSellyPayload(row, maps, { db });
  const val = validatePayload(payload);
  console.log(`--- ${kod} ---`);
  console.log('  category_id:', payload.category_id, '| extra_cat_ids:', payload._extra_cat_ids, '| producer_id:', payload.producer_id);
  console.log('  walidacja ok:', val.ok, val.errors.length ? val.errors : '');
}

// Sprawdzamy ilu produktow LACZNIE bylo juz zsynchronizowanych ze starym (zlym) category_id
// zeby wiedziec skale przyszlej korekty (informacyjnie, bez zmian)
const already = db.prepare('SELECT COUNT(*) as n FROM selly_products').get();
console.log('\nProduktow juz w Selly (do przyszlej korekty category_id/multi_cat):', already.n);
