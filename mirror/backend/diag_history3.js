const Database = require('better-sqlite3');
const db = new Database('./data.db', {readonly:true});
const hist = db.prepare("SELECT * FROM history WHERE kod_produktu=? ORDER BY id DESC LIMIT 10").all('MO2_999991682');
console.log(JSON.stringify(hist, null, 2));
