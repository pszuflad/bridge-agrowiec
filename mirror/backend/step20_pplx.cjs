require('dotenv').config();
const Database = require('better-sqlite3');
const db = new Database('data.db');
const { toSellyPayload, mapZastosowanieCategory } = require('./selly/mapper.cjs');

// Wybieramy kilka roznorodnych przypadkow: z multi-zastosowaniem, z (ogolne), bez zastosowania
const codes = [
  'MO1_19800286',  // Lesne(ogolne)+Rolnicze(ogolne), kategoria=przemyslowe
  'MO1_15285410',  // Koparka+Ladowarka kolowa, kategoria=rolnicze
  'MO1_15285312',  // Koparka+Ladowarka kolowa, kategoria=przemyslowe
];
// dodajemy jeszcze jeden produkt bez zastosowania (NULL) jesli istnieje
const nullRow = db.prepare("SELECT kod FROM products WHERE zastosowanie IS NULL LIMIT 1").get();
if (nullRow) codes.push(nullRow.kod);

for (const kod of codes) {
  const row = db.prepare('SELECT * FROM products WHERE kod = ?').get(kod);
  if (!row) { console.log(kod, '-> NIE ZNALEZIONO'); continue; }
  const mapped = mapZastosowanieCategory(db, row);
  console.log(`--- ${kod} ---`);
  console.log('  kategoria (raw):', row.kategoria, '| zastosowanie:', row.zastosowanie);
  console.log('  mapped:', JSON.stringify(mapped));
}
