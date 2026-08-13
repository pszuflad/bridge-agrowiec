// diag_kategoria.cjs — pokaz wszystkie distinct wartosci kolumny kategoria + licznosc
const Database = require('better-sqlite3');
const db = new Database('data.db', { readonly: true });

// najpierw sprawdz czy kolumna 'kategoria' istnieje
const cols = db.prepare("PRAGMA table_info(products)").all().map(c=>c.name);
const catCol = cols.find(c=>/kategor/i.test(c));
console.log('kolumny pasujace do "kategor":', cols.filter(c=>/kategor/i.test(c)).join(', ') || '(brak)');
if(!catCol){ console.log('BRAK kolumny kategoria — dostepne kolumny:'); console.log(cols.join(', ')); db.close(); process.exit(0); }

const rows = db.prepare(`SELECT ${catCol} AS k, COUNT(*) AS n FROM products WHERE ${catCol} IS NOT NULL AND ${catCol}!='' GROUP BY ${catCol} ORDER BY n DESC`).all();
console.log(`\n=== DISTINCT ${catCol} (${rows.length} wartosci) ===`);
for (const r of rows){
  // pokaz tez kody znakow zeby wykryc pl znaki
  console.log(`  ${String(r.n).padStart(6)}  "${r.k}"`);
}
db.close();
