const Database = require('better-sqlite3');
const db = new Database('./data.db', {readonly:true});
const eans = ['0440000127985','0440000127923','8903635014102'];
for (const ean of eans) {
  const row = db.prepare("SELECT kod, nazwa, marka, bieznik, model, rozmiar, dostawca, kod_dostawcy FROM products WHERE ean=?").get(ean);
  console.log(JSON.stringify(row));
}
