// One-off: rebuild products.nazwa for all MO2 products using current parser output.
// Modes: --dry (default, no writes) or --apply (writes)

const Database = require('better-sqlite3');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');

const APPLY = process.argv.includes('--apply');

const BRIDGE_DIR = '/home/admin/private_apps/bridge';
const DB_PATH = path.join(BRIDGE_DIR, 'data.db');
const DISPATCHER = require(path.join(BRIDGE_DIR, 'parsers/dispatcher.cjs'));
const ADAPTER = require(path.join(BRIDGE_DIR, 'parsers/adapter.cjs'));

const MO2_URL = DISPATCHER.URLS && DISPATCHER.URLS.MO2;
if (!MO2_URL) { console.error('Brak MO2 URL'); process.exit(1); }

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(outPath)));
    }).on('error', reject);
  });
}

(async () => {
  console.log('Tryb:', APPLY ? 'APPLY (zapis do bazy)' : 'DRY-RUN (bez zmian)');
  const tmp = path.join(os.tmpdir(), 'mo2_rebuild.csv');
  console.log('Pobieram MO2 CSV…');
  await download(MO2_URL, tmp);
  console.log('Parsuję MO2…');
  const parsed = DISPATCHER.parseByKod('MO2', tmp);
  if (!parsed || !parsed.records) { console.error('Brak rekordów'); process.exit(1); }
  console.log('Liczba rekordów:', parsed.records.length);

  // recordsToSurowe ma sygnaturę (records, dostawcaKod)
  const surowe = ADAPTER.recordsToSurowe('MO2', parsed.records);
  console.log('Po adapterze:', surowe.length);

  const db = new Database(DB_PATH);
  const existing = db.prepare("SELECT kod, nazwa FROM products WHERE dostawca='MO2'").all();
  const dbByKod = new Map(existing.map(r => [r.kod, r.nazwa]));
  console.log('W bazie MO2:', existing.length);

  const upd = db.prepare("UPDATE products SET nazwa = ?, data_aktualizacji = ? WHERE kod = ?");
  let changed = 0, missing = 0, same = 0;
  const now = new Date().toISOString();
  const diffs = [];
  for (const item of surowe) {
    if (!item || !item.kod) continue;
    const dbNazwa = dbByKod.get(item.kod);
    if (dbNazwa === undefined) { missing++; continue; }
    if (dbNazwa === item.nazwa) { same++; continue; }
    diffs.push({ kod: item.kod, stara: dbNazwa, nowa: item.nazwa });
    if (APPLY) upd.run(item.nazwa, now, item.kod);
    changed++;
  }
  console.log('Do zmiany nazw:', changed);
  console.log('Bez zmian:', same);
  console.log('W parserze ale nie w bazie:', missing);
  if (diffs.length) {
    console.log('---PIERWSZE 25 ZMIAN---');
    for (const d of diffs.slice(0, 25)) {
      console.log(d.kod);
      console.log('  STARA: ' + d.stara);
      console.log('  NOWA:  ' + d.nowa);
    }
  }
  db.close();
  if (!APPLY) console.log('\n(Aby zapisać, uruchom z flagą --apply)');
  else console.log('\nZAPISANE.');
})();
