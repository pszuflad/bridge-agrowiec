// dryrun_dot20.cjs — znajdz rekordy gdzie dot ma DOKLADNIE 2 cyfry -> dopisz "20" (23 -> 2023)
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('data.db', { readonly: true });
const rows = db.prepare("SELECT kod, dostawca, rozmiar, dot FROM products WHERE dot IS NOT NULL AND dot != ''").all();

const changes = [];
const distinct = {};
for (const r of rows){
  const v = String(r.dot).trim();
  if (/^\d{2}$/.test(v)){          // dokladnie 2 cyfry
    const nv = '20' + v;
    changes.push({ kod:r.kod, dostawca:r.dostawca, rozmiar:r.rozmiar, dot:v, target:nv });
    distinct[v] = (distinct[v]||0)+1;
  }
}
changes.sort((a,b)=>a.kod.localeCompare(b.kod));
console.log('ZMIANY (2-cyfrowe DOT):', changes.length);
console.log('rozklad wartosci:', JSON.stringify(distinct));
console.log('\nprzyklady (pierwsze 20):');
for (const c of changes.slice(0,20)) console.log(`  [${c.dostawca}] ${c.kod}  "${c.rozmiar}"  dot: ${c.dot} -> ${c.target}`);

// rozklad po dostawcach
const byDost = {};
for(const c of changes){ byDost[c.dostawca]=(byDost[c.dostawca]||0)+1; }
console.log('\nwg dostawcy:', JSON.stringify(byDost));

fs.writeFileSync('dryrun_dot20.json', JSON.stringify({changes}, null, 2));
console.log('\nzapisano dryrun_dot20.json');
db.close();
