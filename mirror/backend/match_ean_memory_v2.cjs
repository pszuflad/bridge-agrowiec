// v2: Dopasowanie 271 potwierdzonych par Nazwa->EAN do rekordów w products.
// Silniejsza normalizacja nazw (wymiary opon x/-// ujednolicone, usuwanie słów
// "opona","demo","zestaw-set" itp.) + fallback fuzzy (token overlap) + krzyżowa
// walidacja przez EAN już obecny w bazie. DRY-RUN — tylko odczyt + pliki wynikowe.
const fs = require('fs');
const Database = require('better-sqlite3');

const DBP = '/home/admin/private_apps/bridge/data.db';
const SRC = '/home/admin/private_apps/bridge/ean_memory_source.json';
const OUT_MEMORY = '/home/admin/private_apps/bridge/ean_memory.json';
const OUT_REPORT = '/home/admin/private_apps/bridge/ean_memory_match_report.json';

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

// Normalizacja "silna": ignoruje separator wymiarów (x, -, /), usuwa słowa
// dekoracyjne (opona, demo, zestaw-set, dot), usuwa nadmiarowe znaki.
function normalizeStrong(s) {
  if (s == null) return '';
  let t = String(s).toLowerCase();
  t = t.replace(/\(\s*demo\s*\)/g, ' ');
  t = t.replace(/\bdemo\b/g, ' ');
  t = t.replace(/\bopona\b/g, ' ');
  t = t.replace(/\(?\s*zestaw[- ]set\s*\)?/g, ' zestawset ');
  t = t.replace(/\(?\s*dot\s*\)?/g, ' ');
  t = t.replace(/\bniebrudz\w*\b/g, ' ');
  t = t.replace(/\bquick\b/g, ' ');
  // separator wymiarów: x, X, -, / między cyframi -> jednolity token
  t = t.replace(/(\d)\s*[x×]\s*(\d)/gi, '$1x$2');
  t = t.replace(/(\d)\s*[-]\s*(\d)/g, '$1x$2');
  t = t.replace(/(\d)\s*\/\s*(\d)/g, '$1/$2');
  // "147A8/147B" -> "147a8/b" ujednolić podwójne wskazanie nośności/prędkości: usuń powtórzony numer przed literą po "/"
  t = t.replace(/\/(\d+)([a-z])$/gi, '/$2');
  t = t.replace(/(\d+)([a-z])\/(\d+)([a-z])/gi, (m, n1, l1, n2, l2) => `${n1}${l1}/${l2}`);
  t = t.replace(/[\/,;_]+/g, ' ');
  t = t.replace(/["']/g, ' ');
  t = t.replace(/[^\w.\s%]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function tokens(s) {
  return new Set(normalizeStrong(s).split(' ').filter(Boolean));
}

function jaccard(aSet, bSet) {
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter++;
  const union = aSet.size + bSet.size - inter;
  return inter / union;
}

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
console.log('Wejście: ' + src.length + ' par nazwa->EAN');

const db = new Database(DBP, { readonly: true });
const rows = db.prepare('SELECT id, kod, nazwa, dostawca, ean FROM products').all();
console.log('W bazie products: ' + rows.length + ' rekordów');

// indeks: znormalizowana silna nazwa -> lista rekordów
const byNorm = new Map();
// indeks: EAN -> lista rekordów (do walidacji krzyżowej / fallback)
const byEan = new Map();
for (const r of rows) {
  const n = normalizeStrong(r.nazwa);
  if (!byNorm.has(n)) byNorm.set(n, []);
  byNorm.get(n).push(r);
  if (r.ean) {
    if (!byEan.has(r.ean)) byEan.set(r.ean, []);
    byEan.get(r.ean).push(r);
  }
}

const matched = [];
const unmatched = [];
const ambiguous = [];
const FUZZY_THRESHOLD = 0.72;

for (const item of src) {
  const norm = normalizeStrong(item.nazwa);
  let candidates = byNorm.get(norm) || [];
  let method = 'exact_strong_norm';

  // Fallback: dopasowanie fuzzy (Jaccard tokenów) jeśli brak dokładnego
  if (candidates.length === 0) {
    const srcTok = tokens(item.nazwa);
    let best = null, bestScore = 0;
    for (const [normDb, recs] of byNorm.entries()) {
      const dbTok = new Set(normDb.split(' ').filter(Boolean));
      const score = jaccard(srcTok, dbTok);
      if (score > bestScore) { bestScore = score; best = recs; }
    }
    if (best && bestScore >= FUZZY_THRESHOLD) {
      candidates = best;
      method = 'fuzzy_jaccard_' + bestScore.toFixed(2);
    }
  }

  if (candidates.length === 0) {
    // Fallback 2: dopasowanie po EAN już istniejącym w bazie (walidacja krzyżowa, inny kod)
    const eanRecs = byEan.get(item.ean);
    if (eanRecs && eanRecs.length) {
      candidates = eanRecs;
      method = 'fallback_by_existing_ean';
    }
  }

  if (candidates.length === 0) {
    unmatched.push({ nazwa: item.nazwa, ean: item.ean, norm });
    continue;
  }

  const distinctKods = new Set(candidates.map(c => c.kod));
  if (distinctKods.size > 1) {
    ambiguous.push({
      nazwa: item.nazwa, ean: item.ean, norm, method,
      candidates: candidates.map(c => ({ kod: c.kod, nazwa_db: c.nazwa, dostawca: c.dostawca, ean_obecny: c.ean }))
    });
  }
  // Wybor najlepszego kandydata przy niejednoznacznosci:
  // 1) zgodnosc "demo" w nazwie zrodlowej z obecnoscia "demo" w kod/nazwa_db
  // 2) preferuj rekord z PUSTYM ean_obecny (to on potrzebuje pamieci)
  // 3) w razie remisu - pierwszy z listy
  const srcHasDemo = /\bdemo\b/i.test(item.nazwa) || /\(\s*demo\s*\)/i.test(item.nazwa);
  let ranked = candidates.slice();
  ranked.sort((a, b) => {
    const aDemo = /demo/i.test(a.kod) || /demo/i.test(a.nazwa);
    const bDemo = /demo/i.test(b.kod) || /demo/i.test(b.nazwa);
    const aDemoMatch = (aDemo === srcHasDemo) ? 1 : 0;
    const bDemoMatch = (bDemo === srcHasDemo) ? 1 : 0;
    if (aDemoMatch !== bDemoMatch) return bDemoMatch - aDemoMatch;
    const aEmpty = (!a.ean) ? 1 : 0;
    const bEmpty = (!b.ean) ? 1 : 0;
    if (aEmpty !== bEmpty) return bEmpty - aEmpty;
    return 0;
  });
  const best = ranked[0];
  const valid = eanChecksumValid(item.ean);
  matched.push({
    nazwa_src: item.nazwa,
    ean: item.ean,
    kod: best.kod,
    nazwa_db: best.nazwa,
    dostawca: best.dostawca,
    ean_obecny_w_db: best.ean,
    checksum_valid: valid,
    method,
    ambiguous: distinctKods.size > 1
  });
}

console.log('\n=== WYNIK DOPASOWANIA v2 ===');
console.log('Dopasowane: ' + matched.length + ' / ' + src.length);
console.log('  - exact_strong_norm: ' + matched.filter(m => m.method === 'exact_strong_norm').length);
console.log('  - fuzzy: ' + matched.filter(m => m.method.startsWith('fuzzy')).length);
console.log('  - fallback_by_existing_ean: ' + matched.filter(m => m.method === 'fallback_by_existing_ean').length);
console.log('Niedopasowane: ' + unmatched.length);
console.log('Niejednoznaczne (ta sama nazwa, różne kod): ' + ambiguous.length);
console.log('Dopasowane z niepoprawną sumą kontrolną EAN: ' + matched.filter(m => !m.checksum_valid).length);

console.log('\n--- Niedopasowane (' + unmatched.length + ') ---');
for (const u of unmatched) console.log('  "' + u.nazwa + '" (EAN ' + u.ean + ')');

if (ambiguous.length) {
  console.log('\n--- Niejednoznaczne (' + ambiguous.length + ') — bierzemy pierwszego kandydata, oflagowane ---');
  for (const a of ambiguous.slice(0, 30)) console.log('  "' + a.nazwa + '" [' + a.method + '] -> ' + JSON.stringify(a.candidates));
}

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
  dopasowane_exact: matched.filter(m => m.method === 'exact_strong_norm').length,
  dopasowane_fuzzy: matched.filter(m => m.method.startsWith('fuzzy')).length,
  dopasowane_fallback_ean: matched.filter(m => m.method === 'fallback_by_existing_ean').length,
  niedopasowane: unmatched.length,
  niejednoznaczne: ambiguous.length,
  niepoprawna_suma_kontrolna: matched.filter(m => !m.checksum_valid).length,
  lista_niedopasowanych: unmatched,
  lista_niejednoznacznych: ambiguous,
  wszystkie_dopasowane: matched
};
fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2), 'utf8');
console.log('Zapisano raport: ' + OUT_REPORT);

db.close();
