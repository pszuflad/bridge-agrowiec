const Database = require('better-sqlite3');
const db = new Database('data.db');
const total = db.prepare('SELECT COUNT(*) c FROM products').get().c;
const filled = db.prepare("SELECT COUNT(*) c FROM products WHERE zastosowanie IS NOT NULL AND zastosowanie<>''").get().c;
console.log('total products:', total, 'z wypelnionym zastosowaniem:', filled);
const dist = db.prepare('SELECT zastosowanie, COUNT(*) c FROM products GROUP BY zastosowanie ORDER BY c DESC LIMIT 20').all();
console.log('--- dystrybucja ---');
dist.forEach(r => console.log(JSON.stringify(r.zastosowanie), r.c));

console.log('--- atrybuty_rodzaje (szukam zastosowanie) ---');
try {
  const rodzaje = db.prepare("SELECT * FROM atrybuty_rodzaje WHERE nazwa LIKE '%zastosowanie%' OR kod LIKE '%zastosowanie%'").all();
  console.log(JSON.stringify(rodzaje, null, 2));
} catch(e) { console.log('blad atrybuty_rodzaje:', e.message); }
