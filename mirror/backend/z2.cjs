const Database = require('better-sqlite3');
const db = new Database('data.db', { readonly: true });
// rozklad wartosci zastosowanie w calej bazie
console.log('=== distinct zastosowanie (cala baza) ===');
for(const r of db.prepare("SELECT zastosowanie k, COUNT(*) n FROM products GROUP BY zastosowanie ORDER BY n DESC").all())
  console.log(`  ${String(r.n).padStart(6)}  ${JSON.stringify(r.k)}`);
// dla naszych 17
const kods=['MO2_CET0048','MO2_570307','MO2_570283','MO2_568915','MO2_05127050000','MO2_37200023AL-AP','MO2_IND004710','MO2_IND00410','MO2_IND00409','MO2_IND00197','MO2_IND00186','MO2_IND00032','MO2_IND00023','MO2_IND00018','MO2_CET0006','MO2_19738','MO2_05127970000'];
console.log('\n=== nasze 17: zastosowanie ===');
for(const k of kods){ const r=db.prepare("SELECT kod,kategoria,zastosowanie FROM products WHERE kod=?").get(k); console.log(`  ${r.kod} kat=${r.kategoria} zast=${JSON.stringify(r.zastosowanie)}`); }
db.close();