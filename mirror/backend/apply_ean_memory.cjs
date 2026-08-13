// Trwała pamięć EAN: re-aplikuje zapamiętane pary kod->EAN (ean_memory.json) do
// tabeli products. Rozwiązuje problem znikających EAN po pełnym re-imporcie
// katalogu (czyszczenie -> import z cennika nadpisuje ręcznie przypisane EAN-y,
// bo tych EAN-ów nie ma w źródłowym CSV). Dopasowanie po polu `kod` (T-kod
// dostawcy, stabilny między DB a parserem/importem — patrz index.cjs: import
// robi SELECT ... WHERE kod=? przed UPDATE/INSERT).
// Wzorzec zgodny ze stylem fix_mo7_ean_apply.cjs (transakcja, weryfikacja po
// apply, logi PL). Domyślnie DRY-RUN — uruchom z --apply aby wdrożyć.
const fs = require('fs');
const Database = require('better-sqlite3');

const DBP = '/home/admin/private_apps/bridge/data.db';
const MEMORY_PATH = '/home/admin/private_apps/bridge/ean_memory.json';

const APPLY = process.argv.includes('--apply');
// Domyślnie (bezpiecznie) aktualizujemy TYLKO rekordy z pustym EAN w bazie.
// Nadpisanie już istniejącego (innego) EAN wymaga dodatkowej, świadomej flagi
// --overwrite-existing — bo część dopasowań nazwa->EAN z pamięci może wskazywać
// inny (choć bardzo podobny) warunek/wariant produktu niż ten zaimportowany
// automatycznie z API dostawcy (np. MO9/Agrorami). Zobacz raport: overwrites_do_weryfikacji.json.
const OVERWRITE_EXISTING = process.argv.includes('--overwrite-existing');

// Walidacja sumy kontrolnej EAN-13 (i akceptacja EAN-8/UPC-12/GTIN-14 jak w apce)
function eanChecksumValid(ean) {
  const s = String(ean || '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(s.length)) return false;
  const digits = s.split('').map(Number);
  const check = digits.pop();
  let sum = 0;
  // waga naprzemienna od prawej: 3,1,3,1...
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = (w === 3 ? 1 : 3)) sum += digits[i] * w;
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

(async () => {
  console.log('MODE:', APPLY ? 'APPLY' : 'DRY-RUN');

  if (!fs.existsSync(MEMORY_PATH)) {
    throw new Error('Brak pliku trwałej pamięci EAN: ' + MEMORY_PATH);
  }
  const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
  const kody = Object.keys(memory);
  console.log('Pamięć EAN: ' + kody.length + ' zapamiętanych par kod->EAN (' + MEMORY_PATH + ')');

  const db = new Database(DBP);
  const dbRows = db.prepare('SELECT id, kod, ean, nazwa, dostawca FROM products').all();
  const byKod = new Map();
  for (const r of dbRows) byKod.set(r.kod, r);
  console.log('DB products: ' + dbRows.length + ' rekordów');

  const plan = [];
  const overwriteSkipped = [];
  let unmatched = 0, invalidChk = 0, jużAktualne = 0;
  for (const kod of kody) {
    const entry = memory[kod];
    const r = byKod.get(kod);
    if (!r) { unmatched++; continue; }
    const ean = (entry.ean == null || entry.ean === '') ? null : String(entry.ean).trim();
    if (!ean) continue;
    const isValid = eanChecksumValid(ean) ? 1 : 0;
    if (!isValid) invalidChk++;
    if (String(r.ean || '') === ean) { jużAktualne++; continue; } // nic do zmiany
    const maNadpisacIstniejacy = !!r.ean; // rekord już ma INNY, niepusty EAN
    if (maNadpisacIstniejacy && !OVERWRITE_EXISTING) {
      overwriteSkipped.push({ kod: r.kod, nazwa_db: r.nazwa, dostawca: r.dostawca, ean_db: r.ean, ean_memory: ean });
      continue; // pomijamy w planie domyślnym — wymaga --overwrite-existing
    }
    plan.push({
      id: r.id, kod: r.kod, nazwa_db: r.nazwa, dostawca: r.dostawca,
      oldEan: r.ean, ean,
      ean_raw: ean,
      ean_is_valid: isValid,
      ean_source_status: 'memory',
      ean_candidates: JSON.stringify([ean]),
      nazwa_pamiec: entry.nazwa
    });
  }

  console.log('\nPlan: ' + plan.length + ' do aktualizacji');
  console.log('  - nie znaleziono `kod` w bazie (produkt usunięty/zmieniony): ' + unmatched);
  console.log('  - EAN już aktualny (bez zmian): ' + jużAktualne);
  console.log('  - POMINIĘTE — nadpisanie innego istniejącego EAN (wymaga --overwrite-existing): ' + overwriteSkipped.length);
  console.log('  - niepoprawna suma kontrolna EAN w pamięci (aplikujemy mimo to, ale flagujemy): ' + invalidChk);
  if (overwriteSkipped.length) {
    fs.writeFileSync('/home/admin/private_apps/bridge/ean_memory_overwrites_skipped.json', JSON.stringify(overwriteSkipped, null, 2), 'utf8');
    console.log('    -> lista zapisana do ean_memory_overwrites_skipped.json (do ręcznej weryfikacji)');
  }

  console.log('\nPrzykłady zmian (do 10):');
  for (const p of plan.slice(0, 10)) {
    console.log('  [' + p.id + '] ' + p.kod + ' (' + p.dostawca + ') "' + p.nazwa_db + '": ' +
      (p.oldEan || '(brak)') + ' -> ' + p.ean + ' (valid=' + p.ean_is_valid + ')');
  }

  if (!APPLY) {
    db.close();
    console.log('\n(DRY-RUN — nic nie zapisano. Uruchom z --apply aby wdrożyć ' + plan.length + ' bezpiecznych aktualizacji [puste EAN].)');
    if (overwriteSkipped.length) {
      console.log('Aby DODATKOWO nadpisać ' + overwriteSkipped.length + ' rekordów z INNYM już istniejącym EAN, dodaj również flagę --overwrite-existing (zalecana ręczna weryfikacja listy ean_memory_overwrites_skipped.json przed tym krokiem).');
    }
    return;
  }

  // --- Poniżej wykonywane tylko z flagą --apply ---
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const bak = DBP + '.bak_before_ean_memory_apply_' + ts;
  fs.copyFileSync(DBP, bak);
  try { fs.copyFileSync(DBP + '-wal', bak + '-wal'); } catch {}
  try { fs.copyFileSync(DBP + '-shm', bak + '-shm'); } catch {}
  console.log('BACKUP:', bak);

  const upd = db.prepare('UPDATE products SET ean=?, ean_raw=?, ean_is_valid=?, ean_source_status=?, ean_candidates=? WHERE id=?');
  const tx = db.transaction(() => {
    for (const p of plan) upd.run(p.ean, p.ean_raw, p.ean_is_valid, p.ean_source_status, p.ean_candidates, p.id);
  });
  tx();
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log('\nAPPLY: zaktualizowano ' + plan.length + ' rekordów.');

  const chk = db.prepare(
    "SELECT COUNT(*) c, COUNT(DISTINCT ean) de, SUM(ean_is_valid) valid, " +
    "SUM(CASE WHEN ean_source_status='memory' THEN 1 ELSE 0 END) memstatus FROM products WHERE ean_source_status='memory'"
  ).get();
  console.log('WERYFIKACJA (rekordy ze statusem memory): ' + JSON.stringify(chk));
  db.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
