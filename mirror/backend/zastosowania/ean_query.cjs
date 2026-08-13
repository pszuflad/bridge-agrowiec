'use strict';
const D = require('better-sqlite3');
const fs = require('fs');
const db = new D('/home/admin/private_apps/bridge/data.db', { readonly: true });

const eans = `8903094036141
8903094019205
8903094040728
8903094048830
8903094019465
4251438402201
4251438410022
8059971044003
8808956624132
8907375026494
8907375026586
8907375000272
8907375025626
8907375029525
8907375047345
8907375024452
8907375027699
4251438411661
8907375026494
8907375026586
8907375025626
8907375029525
8907375047338
8907375047345
7291050008635
8059971000320
8059971000170
8059971000160`.split(/\s+/).map(s => s.trim()).filter(Boolean);

const uniq = [...new Set(eans)];
const found = [];
const missing = [];
const seenId = new Set();

for (const e of uniq) {
  const r = db.prepare("SELECT * FROM products WHERE TRIM(ean)=? OR TRIM(ean_raw)=?").all(e, e);
  if (r.length) {
    for (const x of r) { if (!seenId.has(x.id)) { seenId.add(x.id); found.push(x); } }
  } else {
    missing.push(e);
  }
}

fs.writeFileSync('/tmp/ean_export.json', JSON.stringify({ found, missing, total_ean: uniq.length }));
console.log('unikalnych EAN:', uniq.length, '| znaleziono produktow:', found.length, '| brak:', missing.length);
if (missing.length) console.log('BRAK EAN:', missing.join(', '));
db.close();
