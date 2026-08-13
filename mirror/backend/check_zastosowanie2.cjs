const Database = require('better-sqlite3');
const db = new Database('data.db');

console.log('--- schema atrybuty_rodzaje ---');
console.log(db.prepare("PRAGMA table_info(atrybuty_rodzaje)").all());

console.log('--- wszystkie atrybuty_rodzaje ---');
console.log(db.prepare("SELECT * FROM atrybuty_rodzaje").all());

console.log('--- pelna dystrybucja zastosowanie (wszystkie unikalne wartosci) ---');
const dist = db.prepare('SELECT zastosowanie, COUNT(*) c FROM products GROUP BY zastosowanie ORDER BY c DESC').all();
dist.forEach(r => console.log(JSON.stringify(r.zastosowanie), r.c));
