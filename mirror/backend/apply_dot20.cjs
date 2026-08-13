// apply_dot20.cjs — zapis 24 poprawek DOT z dryrun_dot20.json, log historii
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('data.db');
const { changes } = JSON.parse(fs.readFileSync('dryrun_dot20.json','utf8'));
const now = new Date().toISOString().replace('T',' ').slice(0,19);

const getRow = db.prepare('SELECT nazwa, dot FROM products WHERE kod=?');
const upd = db.prepare('UPDATE products SET dot=? WHERE kod=?');
const ins = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");

let n=0, skipped=0;
const tx = db.transaction(()=>{
  for (const c of changes){
    const r = getRow.get(c.kod);
    if (!r){ skipped++; continue; }
    const old = String(r.dot).trim();
    if (!/^\d{2}$/.test(old)){ skipped++; continue; } // ochrona: tylko jesli nadal 2 cyfry
    upd.run(c.target, c.kod);
    ins.run(now, c.kod, r.nazwa, 'dot', old, c.target, 'fix-dot-rok', 'Anna');
    n++;
  }
});
tx();
console.log(`Zaktualizowano: ${n} | pominieto: ${skipped}`);
const chk = ['MO3_2309532T','MO3_3658020N','MO3_6007030conti'];
for (const k of chk){ const r=db.prepare('SELECT kod,rozmiar,dot FROM products WHERE kod=?').get(k); console.log('  ', JSON.stringify(r)); }
db.close();
