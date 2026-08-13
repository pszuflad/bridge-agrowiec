const Database = require('better-sqlite3');
const db = new Database('./data.db', {readonly:true});
const cols = db.prepare("PRAGMA table_info(suppliers)").all().map(c=>c.name);
console.log('COLS:', cols.join(', '));
console.log('---');
const rows = db.prepare("SELECT * FROM suppliers").all();
for (const r of rows) {
  console.log(JSON.stringify(r));
}
