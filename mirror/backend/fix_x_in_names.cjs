'use strict';
// Domkniecie spojnosci: separator rozmiaru 'X' -> 'x' (male) w polu nazwa,
// TYLKO w kontekscie rozmiaru (cyfra X cyfra). Zgodne z regula importu (toUpperPLName).
const D = require('better-sqlite3');
const APPLY = process.argv.includes('--apply');
const db = new D('data.db');
const rows = db.prepare("SELECT id, kod, nazwa FROM products WHERE nazwa GLOB '*[0-9]X[0-9]*'").all();
const plan = [];
for (const r of rows) {
  const neu = r.nazwa.replace(/(\d)X(?=\d)/g, '$1x');
  if (neu !== r.nazwa) plan.push({ id:r.id, kod:r.kod, old:r.nazwa, neu });
}
console.log('do poprawy:', plan.length);
for (const p of plan.slice(0,20)) console.log('  ['+p.old+'] -> ['+p.neu+']');
if (!APPLY) { console.log('DRY-RUN'); db.close(); return; }
const now = new Date().toISOString();
const upd = db.prepare("UPDATE products SET nazwa=@neu WHERE id=@id");
const hist = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");
const tx = db.transaction(()=>{ for (const p of plan){ upd.run(p); hist.run(now,p.kod,p.neu,'nazwa',p.old,p.neu,'fix_x_lowercase','Anna'); } return plan.length; });
const n = tx();
db.pragma('wal_checkpoint(TRUNCATE)');
const left = db.prepare("SELECT COUNT(*) c FROM products WHERE nazwa GLOB '*[0-9]X[0-9]*'").get().c;
console.log('APPLY OK:', n, '| pozostale X w rozmiarze:', left);
db.close();
