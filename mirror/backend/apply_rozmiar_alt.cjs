// apply_rozmiar_alt.cjs — zastap rozmiar_alternatywny wartosciami z pliku (dopas. po EAN, fallback kod)
// + manual_overrides (field_name=rozmiarAlternatywny) chroniace przed importem. history kto=Anna.
const Database = require('better-sqlite3');
const db = new Database('data.db');
const now = new Date().toISOString().replace('T',' ').slice(0,19);
const nowIso = new Date().toISOString();
const data = require('./rozmiary_alt.json');

function toKod(raw){ const m=String(raw).match(/^(MO\d+)(.+)$/); return m? `${m[1]}_${m[2]}` : raw; }

const getByEan = db.prepare("SELECT kod,rozmiar,rozmiar_alternatywny,dostawca FROM products WHERE ean=?");
const getByKod = db.prepare("SELECT kod,rozmiar,rozmiar_alternatywny,dostawca FROM products WHERE kod=?");
const upd = db.prepare("UPDATE products SET rozmiar_alternatywny=? WHERE kod=?");
const insH = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");
const getNazwa = db.prepare("SELECT nazwa FROM products WHERE kod=?");
const findOv = db.prepare("SELECT id FROM manual_overrides WHERE supplier_product_id=? AND field_name='rozmiarAlternatywny'");
const insOv = db.prepare(`INSERT INTO manual_overrides
  (supplier_kod, supplier_product_id, field_name, override_value, reason, created_by, created_at, acknowledged_source_value)
  VALUES (?,?,?,?,?,?,?,?)`);

let changed=0, already=0, notfound=0, ovNew=0, ovExist=0;
const nf=[];
const tx = db.transaction(()=>{
  for(const r of data){
    let p = r.ean ? getByEan.get(String(r.ean)) : null;
    let via='ean';
    if(!p){ p = getByKod.get(toKod(r.kod_raw)); via='kod'; }
    if(!p){ notfound++; nf.push(`${r.kod_raw} ean=${r.ean}`); continue; }
    const cur = p.rozmiar_alternatywny;
    if(String(cur)===String(r.alt)){ already++; }
    else {
      upd.run(r.alt, p.kod);
      insH.run(now, p.kod, getNazwa.get(p.kod).nazwa, 'rozmiar_alternatywny', cur==null?'':String(cur), r.alt, 'fix-rozmiar-alt', 'Anna');
      changed++;
    }
    // override ochronny (na wartosc docelowa)
    const supplier = p.dostawca || String(p.kod).split('_')[0];
    if(findOv.get(p.kod)){ ovExist++; }
    else { insOv.run(supplier, p.kod, 'rozmiarAlternatywny', String(r.alt), 'ochrona-rozmiar-alt-2026-07-22', 1, nowIso, null); ovNew++; }
  }
});
tx();
console.log(`Zmienione: ${changed} | juz OK: ${already} | nieznalezione: ${notfound}`);
console.log(`Overrides: nowe ${ovNew} | istnialy ${ovExist}`);
if(nf.length){ console.log('NIEZNALEZIONE:'); nf.forEach(x=>console.log('  ',x)); }
db.close();
