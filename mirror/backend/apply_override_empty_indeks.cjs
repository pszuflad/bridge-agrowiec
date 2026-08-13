// apply_override_empty_indeks.cjs
// Dla 58 poz. z wyczyszczonymi zerowymi indeksami: override z PUSTA wartoscia,
// zeby import nie przywrocil "0". field_name: indeks2 (=indeks_2), indeksy.
const Database = require('better-sqlite3');
const db = new Database('data.db');
const nowIso = new Date().toISOString();

// pozycje z dzisiejszego fix-zero-indeks
const rows = db.prepare(
  "SELECT DISTINCT kod_produktu AS kod, pole FROM history WHERE data LIKE '2026-07-22%' AND zrodlo='fix-zero-indeks'"
).all();

const FLD = { 'indeks_2':'indeks2', 'indeksy':'indeksy' };
const getProd = db.prepare("SELECT dostawca FROM products WHERE kod=?");
const findOv  = db.prepare("SELECT id FROM manual_overrides WHERE supplier_product_id=? AND field_name=?");
const insOv = db.prepare(`INSERT INTO manual_overrides
  (supplier_kod, supplier_product_id, field_name, override_value, reason, created_by, created_at, acknowledged_source_value)
  VALUES (?,?,?,?,?,?,?,?)`);

let created=0, existed=0; const byField={};
const tx = db.transaction(()=>{
  for(const r of rows){
    const fld = FLD[r.pole]; if(!fld) continue;
    if(findOv.get(r.kod, fld)){ existed++; continue; }
    const prod = getProd.get(r.kod);
    const supplier = (prod && prod.dostawca) || String(r.kod).split('_')[0];
    // override_value='' => import wymusi puste; ack='0' => plik z '0' nie zglosi konfliktu
    insOv.run(supplier, r.kod, fld, '', 'ochrona-pustego-indeksu-2026-07-22', 1, nowIso, '0');
    created++; byField[fld]=(byField[fld]||0)+1;
  }
});
tx();
console.log('Nowe overrides (puste):', created, '| juz istnialy:', existed);
console.log('Wg pola:', JSON.stringify(byField));
console.log('Suma manual_overrides:', db.prepare("SELECT COUNT(*) n FROM manual_overrides").get().n);
db.close();
