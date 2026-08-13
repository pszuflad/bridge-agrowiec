// Zapis 187 poprawek Handlopex do bazy Bridge.
// Klucz: dostawca + kod_dostawcy. Bezposrednie UPDATE (nie transakcja - .changes wiarygodne).
const Database = require('better-sqlite3');
const fs = require('fs');

const changes = JSON.parse(fs.readFileSync('/home/admin/private_apps/bridge/_diff_handlopex.json', 'utf8'));
const db = new Database('/home/admin/private_apps/bridge/data.db');

const FIELDS = ['rozmiar','szerokosc','profil','srednica','model','dlugosc','szerokosc_paczki','wysokosc','wysokosc_przesylki'];

let updated = 0, skipped = 0, fieldCounts = {};
const notFound = [];

for (const c of changes) {
  const [dostawca, kod] = c.key.split('::');
  // zbuduj SET tylko dla pol ktore sie zmieniaja
  const sets = [], vals = [];
  for (const f of FIELDS) {
    if (c.diffs[f]) {
      sets.push(`${f} = ?`);
      vals.push(c.diffs[f].new);
      fieldCounts[f] = (fieldCounts[f] || 0) + 1;
    }
  }
  if (!sets.length) { skipped++; continue; }
  vals.push(dostawca, kod);
  const stmt = db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE dostawca = ? AND kod_dostawcy = ?`);
  const info = stmt.run(...vals);
  if (info.changes > 0) updated += info.changes;
  else notFound.push(c.key);
}

console.log('UPDATE wykonane (wiersze):', updated);
console.log('Pominiete (brak zmian):', skipped);
console.log('Nie znaleziono w bazie:', notFound.length);
if (notFound.length) console.log('  ', notFound.slice(0, 10).join(', '));
console.log('Wg pola:', JSON.stringify(fieldCounts));
db.close();
