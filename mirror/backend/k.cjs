const d=require('better-sqlite3')('data.db',{readonly:true});
// jak wyglada supplier_product_id: z prefixem czy bez?
const withPref = d.prepare("SELECT COUNT(*) n FROM manual_overrides WHERE supplier_product_id LIKE 'MO%\\_%' ESCAPE '\\'").get().n;
const total = d.prepare("SELECT COUNT(*) n FROM manual_overrides").get().n;
console.log(`overrides z prefixem MOx_: ${withPref} / ${total}`);
// najnowsze wpisy waga (nasze z apply_wagi) - jaki format?
console.log('\nnajnowsze overrides:');
for(const r of d.prepare("SELECT supplier_kod,supplier_product_id,field_name,override_value,created_at FROM manual_overrides ORDER BY created_at DESC LIMIT 8").all())
  console.log(`  ${r.supplier_kod} | ${r.supplier_product_id} | ${r.field_name}=${String(r.override_value).slice(0,25)} | ${r.created_at}`);
// czy supplier_product_id odpowiada products.kod czy products.kod_importu?
const sample = d.prepare("SELECT supplier_product_id FROM manual_overrides ORDER BY created_at DESC LIMIT 1").get().supplier_product_id;
const byKod = d.prepare("SELECT kod,kod_importu FROM products WHERE kod=?").get(sample);
const byImp = d.prepare("SELECT kod,kod_importu FROM products WHERE kod_importu=?").get(sample);
console.log('\nsample id:', sample, '| match kod:', JSON.stringify(byKod), '| match kod_importu:', JSON.stringify(byImp));
d.close();