// dryrun_szer2.cjs — ZAWEZONY: szerokosc = PIERWSZA liczba rozmiaru w oryginalnej jednostce.
// Poprawiamy TYLKO realne bledy:
//  KAT1 cale->mm: rozmiar typu "W-D" lub "W/P-D" lub "W/P R D" gdzie W<60 (cale) a w bazie zapisano mm.
//  KAT2 ucieta 4-cyfrowa: rozmiar "WWWW/PRD" (W>=1000) a w bazie zapisano ostatnie 2-3 cyfry.
// NIE ruszamy notacji AxB / AxB-D (szerokosc = pierwsza liczba, juz poprawna).
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('data.db', { readonly: true });
const rows = db.prepare("SELECT kod, dostawca, rozmiar, szerokosc FROM products WHERE rozmiar IS NOT NULL AND rozmiar != ''").all();

function firstNum(s){ const m = String(s).match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(',','.')) : null; }

const changes = [];   // pewne
const suspicious = []; // do wgladu

for (const r of rows){
  const rz = String(r.rozmiar).trim();
  const cur = r.szerokosc;
  if (cur == null) continue;

  // Pomijamy notacje AxB (zawiera 'x' lub 'X' miedzy liczbami) — pierwsza liczba juz poprawna
  const isAxB = /\d\s*[xX]\s*\d/.test(rz);
  if (isAxB) continue;

  const target = firstNum(rz);
  if (target == null) continue;

  // interesuja nas formaty: "W-D", "W/P-D", "W/PRD", "W/P R D", "W.D-D" itd (bez x)
  // Roznica cur vs target ponad tolerancje => bledny zapis
  const diff = Math.abs(Number(cur) - target);
  if (diff < 0.05) continue; // juz OK

  // klasyfikacja
  let kind = null;
  // KAT2 ucieta 4-cyfrowa: rozmiar zaczyna sie od >=4 cyfr calkowitych i target>=1000
  if (target >= 1000) {
    kind = 'ucieta-4cyfry';
  } else if (target < 60) {
    // KAT1 prawdopodobnie cale->mm: aktualna wartosc ~ target*25.4 lub inna duza
    kind = 'cale->pierwsza';
  } else {
    // target 60..999: moze byc mm poprawne lub cos innego
    kind = 'inne';
  }

  const rec = { kod:r.kod, dostawca:r.dostawca, rozmiar:rz, cur:Number(cur), target, kind };

  // Podejrzane: nonsensowna wartosc lub rozmiar dziwny
  const weird = target < 2 || target > 1300 || rz.includes('1/2');
  if (weird) suspicious.push(rec); else changes.push(rec);
}

changes.sort((a,b)=> a.kod.localeCompare(b.kod));
console.log('ZMIANY (pewne):', changes.length, '| PODEJRZANE:', suspicious.length);
const byKind = {};
for(const c of changes){ byKind[c.kind]=(byKind[c.kind]||0)+1; }
console.log('wg kategorii:', JSON.stringify(byKind));
console.log('\n=== ZMIANY ===');
for (const c of changes) console.log(`  [${c.dostawca}] ${c.kod}  "${c.rozmiar}": ${c.cur} -> ${c.target}  (${c.kind})`);
console.log('\n=== PODEJRZANE ===');
for (const c of suspicious) console.log(`  [${c.dostawca}] ${c.kod}  "${c.rozmiar}": ${c.cur} -> ${c.target}?  (${c.kind})`);

fs.writeFileSync('dryrun_szer2.json', JSON.stringify({changes, suspicious}, null, 2));
console.log('\nzapisano dryrun_szer2.json');
db.close();
