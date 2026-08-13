const Database = require('better-sqlite3');
const db = new Database('data.db', { readonly: true });
const cols = db.prepare("PRAGMA table_info(products)").all().map(c=>c.name);
console.log('kolumny ~ zastosow/kategor:', cols.filter(c=>/zastosow|kategor/i.test(c)).join(', '));
const kods=['MO2_CET0048','MO2_570307','MO2_570283','MO2_568915','MO2_05127050000','MO2_37200023AL-AP','MO2_IND004710','MO2_IND00410','MO2_IND00409','MO2_IND00197','MO2_IND00186','MO2_IND00032','MO2_IND00023','MO2_IND00018','MO2_CET0006','MO2_19738','MO2_05127970000'];
for(const k of kods){ const r=db.prepare("SELECT kod,rozmiar,kategoria FROM products WHERE kod=?").get(k); console.log('  ', r? `${r.kod} roz=${r.rozmiar} kat=${r.kategoria}` : `${k} BRAK`); }
db.close();