const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

const ROOT = '/home/admin/private_apps/bridge';
process.chdir(ROOT);

function ts() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const T = ts();
const backups = [];

// Kod
for (const rel of ['parsers/tyre_params.cjs']) {
  const dst = `${rel}.bak_pre_szertxt_${T}`;
  fs.copyFileSync(rel, dst);
  backups.push(dst);
}

// Baza — WAL safe
const db = new Database('data.db');
try {
  db.prepare(`VACUUM INTO 'data.db.bak_pre_szertxt_${T}'`).run();
  backups.push(`data.db.bak_pre_szertxt_${T}`);
} finally {
  db.close();
}

for (const b of backups) {
  const st = fs.statSync(b);
  console.log(`OK ${b} (${st.size} bytes)`);
}
console.log('TS=' + T);
