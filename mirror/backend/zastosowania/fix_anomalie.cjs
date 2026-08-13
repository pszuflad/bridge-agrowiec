// fix_anomalie.cjs - naprawa anomalii 1,2,3,6 (dry domyslnie / --apply)
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('better-sqlite3');
const APPLY = process.argv.includes('--apply');
const DB_PATH = '/home/admin/private_apps/bridge/data.db';
const db = new D(DB_PATH, { readonly: !APPLY });

// mapy scalen
const KAT = { 'ciezarowe': 'ciężarowe', 'przemyslowe': 'przemysłowe' };
const MARKA = { 'Ceat': 'CEAT', 'Nokian': 'NOKIAN', 'GoodTrip': 'GOODTRIP' };

function count(sql, ...a) { return db.prepare(sql).get(...a).c; }

// --- podglad ile zmieni ---
console.log('===== ' + (APPLY ? 'APPLY' : 'DRY-RUN') + ' =====\n');

console.log('1) KATEGORIE (scalenie wariantow bez ogonkow):');
let katTotal = 0;
for (const [z, doK] of Object.entries(KAT)) { const c = count('SELECT COUNT(*) c FROM products WHERE kategoria=?', z); console.log(`   '${z}' -> '${doK}': ${c}`); katTotal += c; }

console.log('2) MARKI (do DUZYCH liter):');
let markaTotal = 0;
for (const [z, doM] of Object.entries(MARKA)) { const c = count('SELECT COUNT(*) c FROM products WHERE marka=?', z); console.log(`   '${z}' -> '${doM}': ${c}`); markaTotal += c; }

console.log('3) TRIM nazw (spacja na brzegach):');
const trimCount = count("SELECT COUNT(*) c FROM products WHERE nazwa <> TRIM(nazwa)");
console.log(`   nazw do przyciecia: ${trimCount}`);

console.log('6) ZASTOSOWANIE - brakujace:');
const brak = db.prepare("SELECT kod,nazwa FROM products WHERE zastosowanie IS NULL OR TRIM(zastosowanie)=''").all();
brak.forEach(p => console.log(`   ${p.kod} -> 'All position' (opona ciezarowa drogowa: ${p.nazwa})`));

if (!APPLY) { console.log('\n[DRY-RUN] nic nie zapisano.'); db.close(); return; }

// --- backup ---
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const backupPath = '/home/admin/private_apps/bridge/backups/data.db_' + stamp + '_przed_anomalie';
fs.copyFileSync(DB_PATH, backupPath);
console.log('\nBackup bazy: ' + backupPath);

const tx = db.transaction(() => {
  let k = 0, m = 0, t = 0, z = 0;
  for (const [zK, doK] of Object.entries(KAT)) k += db.prepare('UPDATE products SET kategoria=? WHERE kategoria=?').run(doK, zK).changes;
  for (const [zM, doM] of Object.entries(MARKA)) m += db.prepare('UPDATE products SET marka=? WHERE marka=?').run(doM, zM).changes;
  t = db.prepare("UPDATE products SET nazwa=TRIM(nazwa) WHERE nazwa <> TRIM(nazwa)").changes;
  z = db.prepare("UPDATE products SET zastosowanie='All position' WHERE zastosowanie IS NULL OR TRIM(zastosowanie)=''").changes;
  return { k, m, t, z };
});
const r = tx();
console.log(`\n[APPLY] kategorie: ${r.k} | marki: ${r.m} | trim: ${r.t} | zastosowanie: ${r.z}`);

// weryfikacja
console.log('\n=== weryfikacja po zmianach ===');
console.log('warianty kategorii bez ogonka (ma byc 0):', count("SELECT COUNT(*) c FROM products WHERE kategoria IN ('ciezarowe','przemyslowe')"));
console.log('warianty marek malymi (ma byc 0):', count("SELECT COUNT(*) c FROM products WHERE marka IN ('Ceat','Nokian','GoodTrip')"));
console.log('nazwy z brzegowa spacja (ma byc 0):', count("SELECT COUNT(*) c FROM products WHERE nazwa <> TRIM(nazwa)"));
console.log('bez zastosowania (ma byc 0):', count("SELECT COUNT(*) c FROM products WHERE zastosowanie IS NULL OR TRIM(zastosowanie)=''"));
db.close();
