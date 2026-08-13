require('dotenv').config();
const Database = require('better-sqlite3');
const db = new Database('data.db');
const client = require('./selly/client.cjs');
const { toSellyPayload, validatePayload } = require('./selly/mapper.cjs');

const rows = db.prepare('SELECT slownik, klucz, wartosc_id FROM selly_dict').all();
const maps = { producerMap: {}, catMap: {}, vatMap: {}, whMap: {} };
for (const r of rows) {
  if (r.slownik === 'producers')  maps.producerMap[r.klucz] = r.wartosc_id;
  if (r.slownik === 'categories') maps.catMap[r.klucz]      = r.wartosc_id;
  if (r.slownik === 'vat_rates')  maps.vatMap[r.klucz]      = r.wartosc_id;
  if (r.slownik === 'warehouses') maps.whMap[r.klucz]       = r.wartosc_id;
}

(async () => {
  const kod = 'MO1_15285410';
  const row = db.prepare('SELECT * FROM products WHERE kod = ?').get(kod);
  const existing = db.prepare('SELECT * FROM selly_products WHERE bridge_kod = ?').get(kod);
  console.log('Produkt:', kod, '| selly_product_id istniejacy:', existing?.selly_product_id);
  console.log('  stary selly_category_id w naszej bazie:', existing?.selly_category_id);

  const payload = toSellyPayload(row, maps, { db });
  const val = validatePayload(payload);
  console.log('Nowy payload category_id:', payload.category_id, '| extra_cat_ids:', payload._extra_cat_ids);
  if (!val.ok) { console.log('WALIDACJA NIEOK:', val.errors); process.exit(1); }

  try {
    console.log('\n>>> Wywolanie PRAWDZIWEGO updateProduct...');
    const upd = await client.updateProduct(existing.selly_product_id, payload);
    console.log('updateProduct OK:', JSON.stringify(upd).slice(0, 300));

    console.log('\n>>> Wywolanie PRAWDZIWEGO setProductMultiCat...');
    const mc = await client.setProductMultiCat(existing.selly_product_id, payload._extra_cat_ids);
    console.log('setProductMultiCat OK:', JSON.stringify(mc));

    console.log('\n>>> Weryfikacja GET multi_cat...');
    const check = await client.getProductMultiCat(existing.selly_product_id);
    console.log('GET multi_cat wynik:', JSON.stringify(check));

    console.log('\n>>> Weryfikacja GET produktu (category_id)...');
    const prod = await client.getProduct(existing.selly_product_id);
    console.log('GET product category_id:', prod?.category_id);
  } catch (e) {
    console.error('BLAD:', e.message);
  }
})();
