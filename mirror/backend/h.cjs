const d=require('better-sqlite3')('data.db',{readonly:true});
console.log('=== historia wg zrodla (dzis 2026-07-22) ===');
for(const r of d.prepare("SELECT zrodlo, pole, COUNT(*) n FROM history WHERE data LIKE '2026-07-22%' GROUP BY zrodlo,pole ORDER BY zrodlo,pole").all())
  console.log(`  ${r.zrodlo.padEnd(24)} ${String(r.pole).padEnd(18)} ${r.n}`);
console.log('\n=== distinct kod_produktu z prefixem (przyklad formatu) ===');
console.log(d.prepare("SELECT kod_produktu FROM history WHERE data LIKE '2026-07-22%' LIMIT 3").all().map(r=>r.kod_produktu).join(', '));
// czy manual_overrides supplier_product_id == products.kod?
const one = d.prepare("SELECT supplier_kod, supplier_product_id FROM manual_overrides LIMIT 1").get();
console.log('\nprzyklad override:', JSON.stringify(one));
d.close();