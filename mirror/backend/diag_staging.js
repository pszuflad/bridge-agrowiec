const Database = require('better-sqlite3');
const db = new Database('./data.db', {readonly:true});
const eans = ['0440000127985','0440000127923','8903635014102'];
for (const ean of eans) {
  const rows = db.prepare("SELECT id, typ_zmiany, kod, nazwa, dostawca, snapshot_json FROM staging_items WHERE snapshot_json LIKE ?").all('%'+ean+'%');
  for (const r of rows) {
    console.log('id:', r.id, 'typ:', r.typ_zmiany, 'kod:', r.kod, 'nazwa:', r.nazwa, 'dostawca:', r.dostawca);
    console.log('snapshot:', r.snapshot_json ? r.snapshot_json.slice(0,2000) : null);
    console.log('---');
  }
}
