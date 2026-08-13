// Dopasowanie 271 potwierdzonych par Nazwa->EAN (ean_memory_source.json) do rekordów
// w tabeli products (po znormalizowanej nazwie), w celu wyciągnięcia par kod->ean.
// DRY-RUN / analiza — nic nie zapisuje do bazy. Wynik: ean_memory.json + raport JSON.
const fs = require('fs');
const Database = require('better-sqlite3');

const DBP = '/home/admin/private_apps/bridge/data.db';
const SRC = '/home/admin/private_apps/bridge/ean_memory_source.json';
const OUT_MEMORY = '/home/admin/private_apps/bridge/ean_memory.json';
const OUT_REPORT = '/home/admin/private_apps/bridge/ean_memory_match_report.json';

// Normalizacja nazwy: lowercase, usuń "(demo)"/"demo", ujednolić separatory, wielokrotne spacje -> 1.
function normalize(s) {
  if (s == null) return '';
  let t = String(s).toLowerCase();
  t = t.replace(/\(\s*demo\s*\)/g, ' ');       // "(demo)"
  t = t.replace(/\bdemo\b/g, ' ');             // samodzielne słowo "demo"
  t = t.replace(/[\/,;_]+/g, ' ');             // separatory / , ; _  -> spacja
  t = t.replace(/[-–—]+/g, '-');                // ujednolić myślniki
  t = t.replace(/\s*-\s*/g, '-');               // spacje wokół myślnika
  t = t.replace(/[^\w.\-\s%]/g, ' ');           // usuń pozostałe znaki specjalne (zachowaj . - % i litery/cyfry)
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

// Walidacja sumy kontrolnej EAN-13 (akceptuje EAN-8/UPC-12/GTIN-14)
function eanChecksumValid(ean) {
  const s = String(ean || '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(s.length)) return false;
  const digits = s.split('').map(Number);
  const check = digits.pop();
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = (w === 3 ? 1 : 3)) sum += digits[i] * w;
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
console.log('Wejście: ' + src.length + ' par nazwa->EAN z ean_memory_source.json');

const db = new Database(DBP, { readonly: true });
const rows = db.prepare('SELECT id, kod, nazwa, dostawca, ean FROM products').all();
console.log('W bazie products: ' + rows.length + ' rekordów');

// Mapa znormalizowana nazwa -> lista rekordów (może być kilka produktów o tej samej znormalizowanej nazwie)
const byNorm = new Map();
for (const r of rows) {
  const n = normalize(r.nazwa);
  if (!byNorm.has(n)) byNorm.set(n, []);
  byNorm.get(n).push(r);
}

const matched = [];       // {nazwa_src, ean, kod, nazwa_db, dostawca, id, checksum_valid, note}
const unmatched = [];     // {nazwa_src, ean, norm}
const ambiguous = [];     // gdy jedna znorm. nazwa odpowiada wielu różnym `kod`

for (const item of src) {
  const norm = normalize(item.nazwa);
  const candidates = byNorm.get(norm);
  if (!candidates || candidates.length === 0) {
    unmatched.push({ nazwa: item.nazwa, ean: item.ean, norm });
    continue;
  }
  // Jeśli kilka rekordów w DB mają tę samą znormalizowaną nazwę ale różny kod -> ambiguous
  const distinctKods = new Set(candidates.map(c => c.kod));
  if (distinctKods.size > 1) {
    ambiguous.push({
      nazwa: item.nazwa, ean: item.ean, norm,
      candidates: candidates.map(c => ({ kod: c.kod, nazwa_db: c.nazwa, dostawca: c.dostawca, ean_obecny: c.ean }))
    });
    // Bierzemy pierwszy jako propozycję, ale flagujemy do ręcznej weryfikacji
  }
  const best = candidates[0];
  const valid = eanChecksumValid(item.ean);
  matched.push({
    nazwa_src: item.nazwa,
    ean: item.ean,
    kod: best.kod,
    nazwa_db: best.nazwa,
    dostawca: best.dostawca,
    ean_obecny_w_db: best.ean,
    checksum_valid: valid,
    ambiguous: distinctKods.size > 1
  });
}

console.log('\n=== WYNIK DOPASOWANIA ===');
console.log('Dopasowane: ' + matched.length + ' / ' + src.length);
console.log('Niedopasowane: ' + unmatched.length);
console.log('Niejednoznaczne (ta sama nazwa, różne kod): ' + ambiguous.length);
console.log('Dopasowane z niepoprawną sumą kontrolną EAN: ' + matched.filter(m => !m.checksum_valid).length);

console.log('\n--- Przykłady dopasowanych (5) ---');
for (const m of matched.slice(0, 5)) {
  console.log('  ' + m.kod + ' | ' + m.nazwa_src + ' -> EAN ' + m.ean + ' (obecny w DB: ' + m.ean_obecny_w_db + ', valid=' + m.checksum_valid + ')');
}

console.log('\n--- Niedopasowane (' + unmatched.length + ') ---');
for (const u of unmatched) {
  console.log('  "' + u.nazwa + '" (EAN ' + u.ean + ')  [norm: "' + u.norm + '"]');
}

if (ambiguous.length) {
  console.log('\n--- Niejednoznaczne (' + ambiguous.length + ') ---');
  for (const a of ambiguous) {
    console.log('  "' + a.nazwa + '" -> kandydaci: ' + JSON.stringify(a.candidates));
  }
}

// Budowa pliku trwałej pamięci EAN — tylko z dopasowanych (nawet ambiguous, biorąc pierwszy kandydat, oflagowane)
const memory = {};
const today = '2026-07-16';
for (const m of matched) {
  memory[m.kod] = { ean: m.ean, nazwa: m.nazwa_src, data: today };
}
fs.writeFileSync(OUT_MEMORY, JSON.stringify(memory, null, 2), 'utf8');
console.log('\nZapisano plik trwałej pamięci: ' + OUT_MEMORY + ' (' + Object.keys(memory).length + ' wpisów)');

const report = {
  wygenerowano: new Date().toISOString(),
  wejscie_par: src.length,
  db_rekordow: rows.length,
  dopasowane: matched.length,
  niedopasowane: unmatched.length,
  niejednoznaczne: ambiguous.length,
  niepoprawna_suma_kontrolna: matched.filter(m => !m.checksum_valid).length,
  lista_niedopasowanych: unmatched,
  lista_niejednoznacznych: ambiguous,
  przyklady_dopasowanych: matched.slice(0, 20)
};
fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2), 'utf8');
console.log('Zapisano raport: ' + OUT_REPORT);

db.close();
