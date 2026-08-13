// diag_indeks4.cjs — pelny stan 4 pozycji: nazwa, indeksy, konstrukcja, indeks_predkosci itd.
const Database = require('better-sqlite3');
const db = new Database('data.db', { readonly: true });
const kods = ['MO5GFCZ22538565LWCC0','MO5GFCZ22531570LWCC0','MO5GFCZ22531570KWFC0','MO2CET0014'];
const eans = ['5452000557896','5452000539113','5452000539069','0440000089146'];

const cols = db.prepare("PRAGMA table_info(products)").all().map(c=>c.name);
console.log('kolumny zwiazane:', cols.filter(c=>/indeks|konstr|nazwa|predkos|nosn/i.test(c)).join(', '));

for(let i=0;i<kods.length;i++){
  let r = db.prepare("SELECT * FROM products WHERE kod=?").get(kods[i]);
  if(!r) r = db.prepare("SELECT * FROM products WHERE ean=?").get(eans[i]);
  if(!r){ console.log(`\n--- ${kods[i]} / EAN ${eans[i]}: NIE ZNALEZIONO`); continue; }
  console.log(`\n--- ${r.kod}  (EAN ${r.ean||''}) ---`);
  console.log('  nazwa           :', JSON.stringify(r.nazwa));
  console.log('  rozmiar         :', r.rozmiar);
  console.log('  indeks_nosnosci :', r.indeks_nosnosci);
  console.log('  indeks_predkosci:', r.indeks_predkosci);
  console.log('  konstrukcja     :', r.konstrukcja);
  console.log('  indeksy         :', r.indeksy);
  console.log('  indeks_1        :', r.indeks_1);
  console.log('  indeks_2        :', r.indeks_2);
  console.log('  tl_tt           :', r.tl_tt);
}
db.close();
