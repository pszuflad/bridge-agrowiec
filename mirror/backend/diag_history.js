const Database = require('better-sqlite3');
const db = new Database('./data.db', {readonly:true});
const p = db.prepare("SELECT id, kod, nazwa, bieznik, model, data_aktualizacji FROM products WHERE ean=?").get('0440000127923');
console.log('PRODUCT:', JSON.stringify(p));
const hist = db.prepare("SELECT * FROM history WHERE kod=? ORDER BY id DESC LIMIT 5").all(p.kod);
console.log('HISTORY:', JSON.stringify(hist, null, 2));
