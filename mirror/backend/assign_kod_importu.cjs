// Nadanie kod_importu: 6-cyfrowy losowy numer, wspolny dla grupy (ten sam produkt = te same magazyny)
// Klucz: EAN (gdy poprawny) LUB fallback producent|rozmiar|bieznik|nazwa (znormalizowane)
const D = require('better-sqlite3');
const db = new D('data.db');
const APPLY = process.argv.includes('--apply');

const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
function groupKey(r) {
  if (r.ean && String(r.ean).trim() !== '' && r.ean_is_valid === 1) return 'EAN:' + String(r.ean).trim();
  return 'FB:' + [norm(r.marka), norm(r.rozmiar), norm(r.bieznik), norm(r.nazwa)].join('|');
}

const all = db.prepare('SELECT id,kod,nazwa,marka,ean,ean_is_valid,rozmiar,bieznik,kod_importu FROM products').all();

// istniejace numery (gdyby skrypt uruchamiany ponownie) - nie generuj kolizji
const used = new Set();
all.forEach(r => { if (r.kod_importu && /^\d{6}$/.test(String(r.kod_importu))) used.add(String(r.kod_importu)); });

function genNum() {
  let n, guard = 0;
  do { n = String(Math.floor(100000 + Math.random() * 900000)); guard++; if (guard > 100000) throw new Error('brak wolnych numerow'); } while (used.has(n));
  used.add(n); return n;
}

// zbuduj grupy
const groups = {};
for (const r of all) { const k = groupKey(r); (groups[k] = groups[k] || []).push(r); }

// przypisz numer per grupa: jesli ktorykolwiek rekord w grupie ma juz kod_importu -> uzyj go (spojnosc)
const keyToNum = {};
for (const [k, recs] of Object.entries(groups)) {
  let existing = recs.map(r => r.kod_importu).find(v => v && /^\d{6}$/.test(String(v)));
  keyToNum[k] = existing ? String(existing) : genNum();
}

// przygotuj update
let toUpdate = [];
for (const r of all) {
  const k = groupKey(r); const num = keyToNum[k];
  if (String(r.kod_importu || '') !== num) toUpdate.push({ id: r.id, num });
}

console.log('produkty:', all.length);
console.log('grupy (unikalne produkty):', Object.keys(groups).length);
console.log('wygenerowane/uzyte numery:', Object.keys(keyToNum).length);
console.log('rekordy do aktualizacji:', toUpdate.length);
// weryfikacja unikalnosci
const numSet = new Set(Object.values(keyToNum));
console.log('unikalnych numerow:', numSet.size, '(== grupy?', numSet.size === Object.keys(groups).length, ')');
// przyklad
const exK = Object.keys(groups).find(k => groups[k].length > 1);
console.log('przyklad grupy:', exK, '-> num', keyToNum[exK], '|', groups[exK].map(r => r.kod).join(', '));

if (APPLY) {
  const upd = db.prepare('UPDATE products SET kod_importu=? WHERE id=?');
  const tx = db.transaction(items => { for (const it of items) upd.run(it.num, it.id); });
  tx(toUpdate);
  console.log('\nZAPISANO:', toUpdate.length, 'rekordow.');
  // kontrola po zapisie
  const nullCnt = db.prepare("SELECT count(*) c FROM products WHERE kod_importu IS NULL OR kod_importu=''").get().c;
  console.log('rekordy bez kod_importu po zapisie:', nullCnt);
} else {
  console.log('\n[DRY-RUN] nic nie zapisano. Uruchom z --apply aby zastosowac.');
}
db.close();
