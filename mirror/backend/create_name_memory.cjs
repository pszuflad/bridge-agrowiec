// Tworzy tabele pamieci nazw scalonych i wypelnia ja na podstawie obecnego stanu bazy
// (grupy z kod_importu > 1 wpisu -> zapamietaj nazwe jako "docelowa" dla tego kod_importu)
const Database = require('better-sqlite3');
const db = new Database('data.db');

db.exec(`
CREATE TABLE IF NOT EXISTS nazwa_pamiec (
  kod_importu TEXT PRIMARY KEY,
  nazwa TEXT NOT NULL,
  updated_at TEXT,
  source TEXT
);
`);

const groups = db.prepare(`
  SELECT kod_importu, nazwa, COUNT(*) as cnt
  FROM products
  WHERE kod_importu IN (SELECT kod_importu FROM products GROUP BY kod_importu HAVING COUNT(*) > 1)
  GROUP BY kod_importu, nazwa
`).all();

// group by kod_importu, pick most common nazwa (or the only one if consistent)
const byKI = {};
for (const g of groups) {
  byKI[g.kod_importu] = byKI[g.kod_importu] || [];
  byKI[g.kod_importu].push({nazwa: g.nazwa, cnt: g.cnt});
}

const insert = db.prepare(`INSERT OR REPLACE INTO nazwa_pamiec (kod_importu, nazwa, updated_at, source) VALUES (?, ?, datetime('now'), 'scalanie_2026-07-20')`);
const tx = db.transaction(() => {
  let inserted = 0;
  for (const [ki, opts] of Object.entries(byKI)) {
    // if only one distinct nazwa across the group, that's the unified one worth remembering
    if (opts.length === 1) {
      insert.run(ki, opts[0].nazwa);
      inserted++;
    }
  }
  return inserted;
});
const count = tx();
console.log('Tabela nazwa_pamiec utworzona. Wpisow (grup z jednolita nazwa):', count);

const total = db.prepare('SELECT COUNT(*) c FROM nazwa_pamiec').get().c;
console.log('Total w tabeli:', total);
db.close();
