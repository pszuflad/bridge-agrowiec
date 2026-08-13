'use strict';
// Domkniecie: cala NAZWA na WIELKIE litery (dopiski typu demo, Stubble Guard, Agri Star ...),
// z zachowaniem malego 'x' TYLKO w separatorze rozmiaru (cyfra x cyfra). Spojne z toUpperPLName w imporcie.
const D = require('better-sqlite3');
const APPLY = process.argv.includes('--apply');
const db = new D('data.db');

function upName(v) {
  if (typeof v !== 'string' || !v) return v;
  return v.toLocaleUpperCase('pl-PL').replace(/\s+/g,' ').trim().replace(/(\d)X(?=\d)/g,'$1x');
}

const rows = db.prepare("SELECT id, kod, nazwa FROM products").all();
const plan = [];
for (const r of rows) {
  const neu = upName(r.nazwa);
  if (neu !== r.nazwa) plan.push({ id:r.id, kod:r.kod, old:r.nazwa, neu });
}
console.log('nazw do zmiany:', plan.length);
plan.slice(0,20).forEach(p=>console.log('  ['+p.old+'] -> ['+p.neu+']'));
if (!APPLY) { console.log('DRY-RUN'); db.close(); return; }
const now = new Date().toISOString();
const upd = db.prepare("UPDATE products SET nazwa=@neu WHERE id=@id");
const hist = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");
const tx = db.transaction(()=>{ for (const p of plan){ upd.run(p); hist.run(now,p.kod,p.neu,'nazwa',p.old,p.neu,'fix_dopiski_upper','Anna'); } return plan.length; });
const n = tx();
db.pragma('wal_checkpoint(TRUNCATE)');
// weryfikacja: ile nazw ma jeszcze male litery poza x-rozmiar
const left = db.prepare("SELECT nazwa FROM products WHERE nazwa GLOB '*[a-ząćęłńóśźż]*'").all()
  .filter(r=>/[a-ząćęłńóśźż]/.test(r.nazwa.replace(/(\d)x(?=\d)/g,'$1_'))).length;
console.log('APPLY OK:', n, '| pozostale nazwy z malymi (poza x-rozmiar):', left);
db.close();
