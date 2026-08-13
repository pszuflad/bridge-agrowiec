// Uniwersalny rebuild po deployu v2 (prefix + paren/slash + dup-A8 + IND/MPT/EM)
// Dla każdego dostawcy z products (MO2, MO3, MO4, MO5, MO9):
//  1) Pobieramy CSV
//  2) Parsujemy DISPATCHER + ADAPTER (nowy v2 — z prefiksem i poprawkami)
//  3) Budujemy mapę "stary kod (bez prefiksu) -> nowy rekord (z prefiksem)"
//  4) UPDATE products: kod, kod_dostawcy, nazwa, kategoria, indeks_nosnosci, indeks_predkosci
//  5) UPDATE history.kod_produktu (idempotentnie)

const fs = require('fs');
const path = require('path');
process.chdir('/home/admin/private_apps/bridge');
const Database = require('better-sqlite3');
const DISPATCHER = require('./parsers/dispatcher.cjs');
const ADAPTER = require('./parsers/adapter.cjs');

const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || '';

const DOSTAWCY_TO_PROCESS = ['MO2','MO3','MO4','MO5','MO9'];
const dostawcy = ONLY ? ONLY.split(',') : DOSTAWCY_TO_PROCESS;

function stripPrefix(kod, prefix) {
  if (!kod) return kod;
  return String(kod).toUpperCase().startsWith(prefix) ? String(kod).slice(prefix.length) : String(kod);
}

async function processDostawca(db, kod) {
  console.log(`\n========== ${kod} ==========`);
  const url = DISPATCHER.URLS[kod];
  if (!url) { console.log('NO URL'); return; }
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpFile = `/tmp/csv_cache/${kod}.csv`;
  fs.mkdirSync('/tmp/csv_cache', {recursive: true});
  fs.writeFileSync(tmpFile, buf);

  const parsed = DISPATCHER.parseByKod(kod, tmpFile);
  const records = parsed.records || parsed;
  const surowe = ADAPTER.recordsToSurowe(kod, records);
  console.log(`  Parser zwrócił ${surowe.length} rekordów (z prefiksem ${kod})`);

  // Budujemy mapę po stripowanym kodzie (czyli "starym")
  const byOldKod = new Map();
  for (const s of surowe) {
    const oldKod = stripPrefix(s.kod, kod);
    byOldKod.set(oldKod, s);
    // Także po pełnym (idempotentnie)
    byOldKod.set(s.kod, s);
  }

  // Pobieramy obecne produkty z DB
  const dbProds = db.prepare(`SELECT id, kod, kod_dostawcy, nazwa, kategoria, indeks_nosnosci, indeks_predkosci FROM products WHERE dostawca = ?`).all(kod);
  console.log(`  W DB: ${dbProds.length} produktów dla ${kod}`);

  let toUpdate = 0, alreadyOk = 0, notInParser = 0, kodChanges = 0;
  let conflicts = 0;
  const updates = [];

  for (const p of dbProds) {
    const oldKod = p.kod;
    const newRec = byOldKod.get(oldKod) || byOldKod.get(stripPrefix(oldKod, kod));
    if (!newRec) { notInParser++; continue; }

    const newKod = newRec.kod;
    const newKodDostawcy = newRec.kodDostawcy;
    const newNazwa = newRec.nazwa;
    const newKat = newRec.kategoria;
    const newIN = newRec.indeksNosnosci;
    const newIP = newRec.indeksPredkosci;

    const changed = (
      p.kod !== newKod ||
      (p.kod_dostawcy || '') !== (newKodDostawcy || '') ||
      p.nazwa !== newNazwa ||
      p.kategoria !== newKat ||
      (p.indeks_nosnosci || '') !== (newIN || '') ||
      (p.indeks_predkosci || '') !== (newIP || '')
    );
    if (!changed) { alreadyOk++; continue; }
    if (p.kod !== newKod) kodChanges++;

    updates.push({id: p.id, oldKod, newKod, newKodDostawcy, newNazwa, newKat, newIN, newIP, oldNazwa: p.nazwa, oldKat: p.kategoria});
    toUpdate++;
  }

  console.log(`  Do zmiany: ${toUpdate}, bez zmian: ${alreadyOk}, w DB ale nie w parserze: ${notInParser}, zmiany kodu: ${kodChanges}`);
  console.log(`  PIERWSZE 5 PRZYKŁADÓW:`);
  for (const u of updates.slice(0, 5)) {
    console.log(`    [${u.id}] ${u.oldKod} -> ${u.newKod}`);
    console.log(`        nazwa: ${u.oldNazwa}`);
    console.log(`         -> :  ${u.newNazwa}`);
    if (u.oldKat !== u.newKat) console.log(`        kategoria: ${u.oldKat} -> ${u.newKat}`);
  }

  if (!APPLY) return {toUpdate, alreadyOk, notInParser, kodChanges};

  // APPLY — sprawdzamy konflikty (czy nowy kod nie istnieje już w DB jako inny rekord)
  const existsStmt = db.prepare(`SELECT id FROM products WHERE kod = ? AND id != ?`);
  const updProd = db.prepare(`UPDATE products SET kod = ?, kod_dostawcy = ?, nazwa = ?, kategoria = ?, indeks_nosnosci = ?, indeks_predkosci = ? WHERE id = ?`);
  const updHist = db.prepare(`UPDATE history SET kod_produktu = ? WHERE kod_produktu = ?`);

  const tx = db.transaction(() => {
    for (const u of updates) {
      const conflict = existsStmt.get(u.newKod, u.id);
      if (conflict) { conflicts++; continue; }
      updProd.run(u.newKod, u.newKodDostawcy, u.newNazwa, u.newKat, u.newIN, u.newIP, u.id);
      if (u.oldKod !== u.newKod) updHist.run(u.newKod, u.oldKod);
    }
  });
  tx();
  console.log(`  APPLY: zaktualizowano ${updates.length - conflicts}, konflikty: ${conflicts}`);
  return {toUpdate, alreadyOk, notInParser, kodChanges, conflicts};
}

async function main() {
  const db = new Database('/home/admin/private_apps/bridge/data.db');
  console.log(`MODE: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Dostawcy: ${dostawcy.join(', ')}`);

  const summary = {};
  for (const kod of dostawcy) {
    summary[kod] = await processDostawca(db, kod);
  }

  console.log('\n\n========== SUMMARY ==========');
  for (const [kod, s] of Object.entries(summary)) {
    if (s) console.log(`  ${kod}: do zmiany=${s.toUpdate}, bez zmian=${s.alreadyOk}, brak w parserze=${s.notInParser}, zmiany kodu=${s.kodChanges}, konflikty=${s.conflicts||0}`);
  }
  db.close();
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
