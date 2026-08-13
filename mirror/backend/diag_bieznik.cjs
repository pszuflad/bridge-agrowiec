const D = require('better-sqlite3');
const db = new D('/home/admin/private_apps/bridge/data.db', { readonly: true });

const tot = db.prepare('SELECT COUNT(*) c FROM products').get().c;
console.log('TOTAL produktow:', tot);

// Rozklad po dostawcach dla bieznik/model niepustych
console.log('\n=== dostawcy z niepustym bieznik/model ===');
const bd = db.prepare("SELECT dostawca, COUNT(*) c, SUM(CASE WHEN bieznik IS NOT NULL AND bieznik<>'' THEN 1 ELSE 0 END) bz, SUM(CASE WHEN model IS NOT NULL AND model<>'' THEN 1 ELSE 0 END) md FROM products GROUP BY dostawca ORDER BY c DESC").all();
for (const r of bd) console.log(`${r.dostawca||'(null)'}: total=${r.c} bieznik=${r.bz} model=${r.md}`);

function count(where){ return db.prepare('SELECT COUNT(*) c FROM products WHERE '+where).get().c; }

console.log('\n=== ANOMALIE bieznik ===');
console.log('bieznik zawiera " TT" lub " TL" (osobne slowo):', count("bieznik LIKE '% TT%' OR bieznik LIKE '% TL%' OR bieznik LIKE 'TT %' OR bieznik LIKE 'TL %' OR bieznik='TT' OR bieznik='TL'"));
console.log('bieznik zawiera TT/TL gdziekolwiek:', count("bieznik LIKE '%TT%' OR bieznik LIKE '%TL%'"));
// indeks nosnosci/predkosci: np 173D, 146A5, 150/147, 20PR
console.log("bieznik ma wzorzec indeksu (cyfry+litera na koncu):", count("bieznik GLOB '*[0-9][0-9][A-Z]' OR bieznik GLOB '*[0-9][0-9][A-Z][0-9]'"));
console.log("bieznik ma PR (plyt):", count("bieznik LIKE '%PR%'"));
console.log("bieznik ma cyfry:", count("bieznik GLOB '*[0-9]*'"));

console.log('\n=== ANOMALIE model ===');
console.log('model zawiera TT/TL:', count("model LIKE '%TT%' OR model LIKE '%TL%'"));
console.log("model ma wzorzec indeksu:", count("model GLOB '*[0-9][0-9][A-Z]' OR model GLOB '*[0-9][0-9][A-Z][0-9]'"));
console.log("model ma PR:", count("model LIKE '%PR%'"));

console.log('\n=== PROBKI bieznik z TT/TL (30) ===');
for (const r of db.prepare("SELECT kod, dostawca, bieznik, model, nazwa FROM products WHERE bieznik LIKE '%TT%' OR bieznik LIKE '%TL%' LIMIT 30").all())
  console.log(`[${r.dostawca}] kod=${r.kod} | bieznik="${r.bieznik}" | model="${r.model}"`);

console.log('\n=== PROBKI bieznik z indeksem (30) ===');
for (const r of db.prepare("SELECT kod, dostawca, bieznik, model FROM products WHERE bieznik GLOB '*[0-9][0-9][A-Z]' OR bieznik GLOB '*[0-9][0-9][A-Z][0-9]' LIMIT 30").all())
  console.log(`[${r.dostawca}] kod=${r.kod} | bieznik="${r.bieznik}" | model="${r.model}"`);

console.log('\n=== PROBKI model z anomalia (20) ===');
for (const r of db.prepare("SELECT kod, dostawca, bieznik, model FROM products WHERE model LIKE '%TT%' OR model LIKE '%TL%' OR model GLOB '*[0-9][0-9][A-Z]' LIMIT 20").all())
  console.log(`[${r.dostawca}] kod=${r.kod} | model="${r.model}" | bieznik="${r.bieznik}"`);
