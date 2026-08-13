// apply_szer.cjs — zapisuje 83 zmiany szerokosci z dryrun_szer2.json (tylko changes), log historii.
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('data.db');
const data = JSON.parse(fs.readFileSync('dryrun_szer2.json','utf8'));
const changes = data.changes;
const now = new Date().toISOString().replace('T',' ').slice(0,19);

const getRow = db.prepare('SELECT nazwa, szerokosc FROM products WHERE kod=?');
const upd = db.prepare('UPDATE products SET szerokosc=? WHERE kod=?');
const ins = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");

let n=0, skipped=0, hist=0;
const tx = db.transaction(()=>{
  for (const c of changes){
    const r = getRow.get(c.kod);
    if (!r){ skipped++; continue; }
    const old = r.szerokosc;
    if (Number(old) === Number(c.target)){ skipped++; continue; }
    upd.run(c.target, c.kod);
    ins.run(now, c.kod, r.nazwa, 'szerokosc', String(old), String(c.target), 'fix-szerokosc', 'Anna');
    n++; hist++;
  }
});
tx();
console.log(`Zaktualizowano: ${n} | pominieto: ${skipped} | wpisow historii: ${hist}`);

// weryfikacja kilku
const chk = ['MO5_HLRD240G24006MR20','MO9_63069','MO8_0209500','MO1_19110117'];
for (const k of chk){ const r=db.prepare('SELECT kod,rozmiar,szerokosc FROM products WHERE kod=?').get(k); console.log('  ', JSON.stringify(r)); }
db.close();
