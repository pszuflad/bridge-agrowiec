const Database = require('better-sqlite3');
const db = new Database('./data.db', {readonly:true});
const p = db.prepare("SELECT id, kod, nazwa, bieznik, model, data_aktualizacji FROM products WHERE ean=?").get('0440000127923');
console.log('PRODUCT:', JSON.stringify(p));
console.log('HISTORY COLS:', db.prepare("PRAGMA table_info(history)").all().map(c=>c.name).join(', '));
