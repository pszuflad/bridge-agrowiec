// apply_zastosowanie.cjs — zapis zastosowania z dryrun_zastosowanie.json
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('data.db');
const now = new Date().toISOString().replace('T',' ').slice(0,19);
const { out } = JSON.parse(fs.readFileSync('dryrun_zastosowanie.json','utf8'));

const getRow = db.prepare('SELECT nazwa, zastosowanie FROM products WHERE kod=?');
const upd = db.prepare('UPDATE products SET zastosowanie=? WHERE kod=?');
const ins = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");

let n=0, skip=0;
const tx = db.transaction(()=>{
  for(const o of out){
    if(!o.zast){ skip++; continue; }
    const r = getRow.get(o.kod); if(!r){ skip++; continue; }
    upd.run(o.zast, o.kod);
    ins.run(now, o.kod, r.nazwa, 'zastosowanie', r.zastosowanie==null?'':String(r.zastosowanie), o.zast, 'przypisanie-zastosowanie', 'Anna');
    n++;
  }
});
tx();
console.log(`Zaktualizowano: ${n} | pominieto: ${skip}`);
for(const o of out){ const r=db.prepare("SELECT kod,rozmiar,kategoria,zastosowanie FROM products WHERE kod=?").get(o.kod); console.log(`  ${r.kod} ${r.rozmiar} ${r.kategoria} -> ${r.zastosowanie}`); }
db.close();
