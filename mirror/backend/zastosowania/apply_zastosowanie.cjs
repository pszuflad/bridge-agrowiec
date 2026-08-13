// apply_zastosowanie.cjs
// Odtwarza/zapisuje products.zastosowanie z trwalego master CSV (dopasowanie po kod).
// Odporny na czyszczenie katalogu: master CSV jest zrodlem prawdy.
// Uzycie:
//   node apply_zastosowanie.cjs           -> DRY-RUN (nic nie zapisuje, pokazuje statystyki)
//   node apply_zastosowanie.cjs --apply   -> zapis do bazy (z automatycznym backupem data.db)
'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const BASE = __dirname;                       // /home/admin/private_apps/bridge/zastosowania
const BRIDGE = path.resolve(BASE, '..');      // /home/admin/private_apps/bridge
const DB_PATH = path.join(BRIDGE, 'data.db');
const CSV_PATH = path.join(BASE, 'zastosowania_master.csv');
const APPLY = process.argv.includes('--apply');

function unquote(v) {
  v = v.trim();
  // zdejmij otaczajace cudzyslowy i rozwin podwojone ""
  if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') {
    v = v.slice(1, -1).replace(/""/g, '"');
  }
  return v.trim();
}

function parseCSV(txt) {
  const lines = txt.split(/\r?\n/).filter(l => l.length);
  const out = [];
  for (let i = 1; i < lines.length; i++) {           // pomijamy naglowek
    const line = lines[i];
    // kod nie zawiera przecinka; wszystko po pierwszym przecinku to zastosowanie (moze byc w cudzyslowach)
    const idx = line.indexOf(',');
    if (idx < 0) continue;
    const kod = unquote(line.slice(0, idx));
    const zast = unquote(line.slice(idx + 1));
    if (kod) out.push({ kod, zast });
  }
  return out;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) { console.error('BRAK master CSV:', CSV_PATH); process.exit(1); }
  if (!fs.existsSync(DB_PATH)) { console.error('BRAK bazy:', DB_PATH); process.exit(1); }

  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
  console.log('Master CSV:', rows.length, 'wierszy');

  const db = new Database(DB_PATH, { readonly: !APPLY });
  const existing = new Set(db.prepare('SELECT kod FROM products').all().map(r => r.kod));

  let match = 0, brakWBazie = 0;
  for (const r of rows) { if (existing.has(r.kod)) match++; else brakWBazie++; }
  console.log('Dopasowanie po kod: pasuje', match, '| brak w bazie:', brakWBazie);

  if (!APPLY) {
    console.log('\n[DRY-RUN] nic nie zapisano. Uruchom z --apply aby zapisac.');
    db.close();
    return;
  }

  // backup bazy przed zapisem
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const backupDir = path.join(BRIDGE, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `data.db_${stamp}_przed_zastosowanie`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log('Backup bazy:', backupPath);

  const upd = db.prepare('UPDATE products SET zastosowanie=? WHERE kod=?');
  const tx = db.transaction(list => {
    let n = 0;
    for (const r of list) { const info = upd.run(r.zast, r.kod); n += info.changes; }
    return n;
  });
  const changed = tx(rows);
  const filled = db.prepare("SELECT COUNT(*) c FROM products WHERE zastosowanie IS NOT NULL AND TRIM(zastosowanie)<>''").get().c;
  console.log('\n[APPLY] zaktualizowano wierszy:', changed);
  console.log('Produkty z wypelnionym zastosowanie:', filled);
  db.close();
}

main();
