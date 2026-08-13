const Database = require('better-sqlite3');
const db = new Database('/home/admin/private_apps/bridge/data.db', { readonly: true });

console.log('=== WZM zduplikowane ===');
db.prepare(`SELECT kod, bieznik, nazwa FROM products WHERE dostawca='MO9' AND bieznik LIKE '%WZM%WZM%'`).all()
  .forEach(r => console.log(r.kod, '| bieznik:', JSON.stringify(r.bieznik), '| nazwa:', r.nazwa));

console.log('\n=== NOWOŚĆ w bieznik ===');
db.prepare(`SELECT kod, bieznik, nazwa FROM products WHERE dostawca='MO9' AND (bieznik LIKE '%NOWOŚĆ%' OR bieznik LIKE '%NOWOSC%')`).all()
  .forEach(r => console.log(r.kod, '| bieznik:', JSON.stringify(r.bieznik), '| nazwa:', r.nazwa));

console.log('\n=== "Zam." w bieznik ===');
db.prepare(`SELECT kod, bieznik, nazwa FROM products WHERE dostawca='MO9' AND bieznik LIKE '%Zam.%'`).all()
  .forEach(r => console.log(r.kod, '| bieznik:', JSON.stringify(r.bieznik), '| nazwa:', r.nazwa));

console.log('\n=== L/E/G/R/C/I + cyfra na koncu bieznik (mozliwe oznaczenia OTR w zlym polu) ===');
const rows = db.prepare(`SELECT kod, bieznik, oznaczenie_bieznika, nazwa FROM products WHERE dostawca='MO9' AND bieznik IS NOT NULL`).all();
const pattern = /\b([LEGRCI]\s?-?\s?\d\*{0,2}(\s*\/\s*[LEGRCI]\s?-?\s?\d\*{0,2})*)\s*$/i;
let matches = [];
for (const r of rows) {
  const m = r.bieznik.match(pattern);
  if (m) matches.push({kod: r.kod, bieznik: r.bieznik, match: m[1], oznaczenie_bieznika: r.oznaczenie_bieznika, nazwa: r.nazwa});
}
console.log('Znaleziono:', matches.length);
matches.slice(0, 40).forEach(m => console.log(m.kod, '| bieznik:', JSON.stringify(m.bieznik), '| wykryty token:', JSON.stringify(m.match), '| oznaczenie_bieznika (istniejace):', m.oznaczenie_bieznika));
db.close();
