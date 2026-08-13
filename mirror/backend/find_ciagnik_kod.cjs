const Database = require('better-sqlite3');
const db = new Database('data.db');
const row = db.prepare("SELECT kod, nazwa, zastosowanie FROM products WHERE zastosowanie='Ciągnik' LIMIT 3").all();
console.log(JSON.stringify(row, null, 2));
