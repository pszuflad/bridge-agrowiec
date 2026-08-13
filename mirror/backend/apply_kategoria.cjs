// apply_kategoria.cjs — ujednolicenie kategorii do wielkiej litery + scalenie duplikatow pl-znakow
const Database = require('better-sqlite3');
const db = new Database('data.db');
const now = new Date().toISOString().replace('T',' ').slice(0,19);

// mapa: znormalizowany klucz -> docelowa forma
const MAP = {
  'ciezarowe':'Ciężarowe', 'ciężarowe':'Ciężarowe',
  'przemyslowe':'Przemysłowe', 'przemysłowe':'Przemysłowe',
  'rolnicze':'Rolnicze',
  'leśne':'Leśne', 'lesne':'Leśne',
  'rolnicze małe':'Rolnicze małe', 'rolnicze male':'Rolnicze małe',
};

const rows = db.prepare("SELECT kod, nazwa, kategoria FROM products WHERE kategoria IS NOT NULL AND kategoria!=''").all();
const getRow = db.prepare('SELECT nazwa FROM products WHERE kod=?');
const upd = db.prepare('UPDATE products SET kategoria=? WHERE kod=?');
const ins = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");

let n=0, unmapped={};
const tx = db.transaction(()=>{
  for (const r of rows){
    const cur = String(r.kategoria);
    const key = cur.trim().toLowerCase();
    const target = MAP[key];
    if (!target){ unmapped[cur]=(unmapped[cur]||0)+1; continue; }
    if (cur === target) continue; // juz OK
    upd.run(target, r.kod);
    ins.run(now, r.kod, r.nazwa, 'kategoria', cur, target, 'fix-kategoria', 'Anna');
    n++;
  }
});
tx();
console.log(`Zaktualizowano: ${n}`);
if(Object.keys(unmapped).length) console.log('NIEZMAPOWANE (pominieto):', JSON.stringify(unmapped));

// weryfikacja koncowa
const after = db.prepare("SELECT kategoria AS k, COUNT(*) n FROM products WHERE kategoria IS NOT NULL AND kategoria!='' GROUP BY kategoria ORDER BY n DESC").all();
console.log('\n=== STAN PO ===');
for(const a of after) console.log(`  ${String(a.n).padStart(6)}  "${a.k}"`);
db.close();
