// Migracja: products.szerokosc REAL -> TEXT + backfill z rozmiar (pierwsza liczba jako string 1:1).
// SQLite nie umie ALTER COLUMN, więc:
//   1) CREATE TABLE products_new (identyczna, ale szerokosc TEXT)
//   2) INSERT INTO products_new SELECT ... z konwersją szerokosc na string wyekstrahowany z rozmiar
//   3) DROP products; ALTER RENAME
//   4) VACUUM (opcjonalnie — pomijamy dla szybkości)

const Database = require('better-sqlite3');
const DB_PATH = '/home/admin/private_apps/bridge/data.db';
const db = new Database(DB_PATH);

// Wczytaj schemat products
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'").get();
if (!schema) { console.error('BLAD: brak tabeli products'); process.exit(1); }
console.log('=== schema products (skrocony) ===');
console.log(schema.sql.slice(0, 200) + '...');

// Wczytaj kolumny
const cols = db.prepare("PRAGMA table_info(products)").all();
console.log(`Kolumn: ${cols.length}`);
const szerCol = cols.find(c => c.name === 'szerokosc');
if (!szerCol) { console.error('BLAD: brak kolumny szerokosc'); process.exit(1); }
console.log(`szerokosc obecny typ: ${szerCol.type}`);
if (szerCol.type.toUpperCase() === 'TEXT') {
  console.log('WARNING: szerokosc juz jest TEXT — kontynuuje backfill');
}

// Wczytaj indeksy dla products (do odtworzenia po RENAME)
const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='products' AND sql IS NOT NULL").all();
console.log(`Indeksy: ${indexes.length}`);
for (const ix of indexes) console.log('  ' + ix.sql.slice(0, 100));

// Wczytaj triggery
const triggers = db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND tbl_name='products'").all();
console.log(`Triggery: ${triggers.length}`);

// Sprawdź czy są klucze obce z innych tabel wskazujące na products
const otherFKs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'products'").all();
let fkRefs = [];
for (const t of otherFKs) {
  const fks = db.prepare(`PRAGMA foreign_key_list(${t.name})`).all();
  for (const fk of fks) if (fk.table === 'products') fkRefs.push({from: t.name, ...fk});
}
console.log(`FK do products: ${fkRefs.length}`);

// === Migracja ===
db.pragma('foreign_keys = OFF');
db.exec('BEGIN');

try {
  // 1) Zbuduj CREATE TABLE products_new przez sqlite_master:
  //    zamień "szerokosc REAL" na "szerokosc TEXT" w schemacie.
  let newSql = schema.sql.replace(/"?products"?\s*\(/, '"products_new" (');
  // Zamień deklarację szerokosc — używamy regex tolerancyjnego
  const newSqlPatched = newSql.replace(/(\bszerokosc\b)\s+REAL/i, '$1 TEXT');
  if (newSqlPatched === newSql) {
    console.error('BLAD: nie udalo sie zamienic REAL->TEXT dla szerokosc');
    console.error('schema:', schema.sql);
    process.exit(1);
  }
  console.log('\n=== nowy CREATE TABLE (fragment ze szerokosc) ===');
  const idx = newSqlPatched.toLowerCase().indexOf('szerokosc');
  console.log(newSqlPatched.slice(Math.max(0, idx-30), idx+50));

  db.exec(newSqlPatched);
  console.log('OK: products_new utworzony');

  // 2) INSERT INTO products_new SELECT ... z konwersją szerokosc.
  const colNames = cols.map(c => `"${c.name}"`).join(', ');
  const selectCols = cols.map(c => {
    if (c.name === 'szerokosc') {
      // Wyekstrahuj pierwszą liczbę z rozmiar jako string, zachowuje zera koncowe.
      // Jeśli nie da się — wpadamy w CAST(szerokosc AS TEXT) jako fallback.
      // W SQLite użyjemy CASE + substr — ale prościej zrobić to w JS po SELECT.
      return `"szerokosc"`;
    }
    return `"${c.name}"`;
  }).join(', ');

  // Pobierz wszystkie ID + rozmiar + istniejąca szerokosc
  const rows = db.prepare('SELECT id, rozmiar, szerokosc FROM products').all();
  console.log(`Rekordow do migracji: ${rows.length}`);

  // Wyekstrahuj szerokosc z rozmiar dla każdego rekordu — jako string 1:1
  function extractSzerRaw(rozmiar) {
    if (rozmiar == null || rozmiar === '') return null;
    // Podobnie jak w parseSize — pierwsza liczba (obsługa przecinka)
    const m = String(rozmiar).match(/(\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    return m[1].replace(',', '.');
  }

  const updates = new Map();
  let extracted = 0, nullified = 0, changed = 0, kept = 0;
  for (const r of rows) {
    const raw = extractSzerRaw(r.rozmiar);
    updates.set(r.id, raw);
    if (raw === null && r.szerokosc === null) kept++;
    else if (raw === null) nullified++;
    else if (String(r.szerokosc) !== raw) { extracted++; changed++; }
    else kept++;
  }
  console.log(`Podglad: wyekstrahowanych=${extracted}, zerowanych=${nullified}, bez_zmian=${kept}`);
  console.log('Przykłady zmian:');
  const shown = new Set();
  for (const r of rows) {
    if (shown.size >= 10) break;
    const raw = updates.get(r.id);
    if (raw !== null && String(r.szerokosc) !== raw && !shown.has(r.rozmiar)) {
      shown.add(r.rozmiar);
      console.log(`  ${r.rozmiar}: ${r.szerokosc} → "${raw}"`);
    }
  }

  // Wstaw do products_new — bulk
  const insertCols = cols.map(c => `"${c.name}"`).join(', ');
  const insertPlaceholders = cols.map((_,i) => `?`).join(', ');
  const insertStmt = db.prepare(`INSERT INTO products_new (${insertCols}) VALUES (${insertPlaceholders})`);
  const selectAll = db.prepare('SELECT * FROM products').all();
  const insertMany = db.transaction((items) => {
    for (const row of items) {
      const values = cols.map(c => {
        if (c.name === 'szerokosc') return updates.get(row.id);
        return row[c.name];
      });
      insertStmt.run(values);
    }
  });
  insertMany(selectAll);
  const newCount = db.prepare('SELECT COUNT(*) as c FROM products_new').get().c;
  console.log(`INSERT OK: ${newCount} rekordow`);

  // 3) DROP products; RENAME products_new -> products
  // Najpierw zbierz i usuń stare indeksy (będą odtworzone po rename z nowego)
  db.exec('DROP TABLE products');
  db.exec('ALTER TABLE products_new RENAME TO products');
  console.log('OK: RENAME');

  // 4) Odtwórz indeksy
  for (const ix of indexes) {
    try {
      db.exec(ix.sql);
      console.log('  odtworzony indeks: ' + ix.sql.slice(0, 80));
    } catch (e) {
      console.log('  SKIP indeks (juz istnieje?): ' + e.message);
    }
  }

  db.exec('COMMIT');
  console.log('COMMIT OK');
} catch (e) {
  console.error('ROLLBACK: ' + e.message);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.pragma('foreign_keys = ON');
}

// Weryfikacja typu
const colsAfter = db.prepare('PRAGMA table_info(products)').all();
const szerAfter = colsAfter.find(c => c.name === 'szerokosc');
console.log(`\n=== szerokosc po migracji: typ = ${szerAfter.type} ===`);

// Integrity check
const chk = db.prepare('PRAGMA integrity_check').all();
console.log('integrity_check:', JSON.stringify(chk));

// Przykłady po migracji
console.log('\n=== Przyklady z bazy po migracji ===');
const samples = ['10.0/75x15.3', '14.9x28', '13.6x24', '800/70R32', '23.5R25', '15.0/55x17', '16x6-8', '10.00/75x15.3', '30.5L-32', '12,00x24'];
for (const s of samples) {
  const rows = db.prepare('SELECT rozmiar, szerokosc, typeof(szerokosc) as t, COUNT(*) as n FROM products WHERE rozmiar = ? GROUP BY szerokosc').all(s);
  console.log(`  ${s.padEnd(20)} ${JSON.stringify(rows)}`);
}

db.close();
