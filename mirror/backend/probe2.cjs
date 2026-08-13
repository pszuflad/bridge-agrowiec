const D = require('better-sqlite3');
const db = new D('data.db', { readonly: true });
const all = (s) => db.prepare(s).all();
const one = (s) => db.prepare(s).get();

console.log('=== wszystkie tabele ===');
all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).forEach(r => console.log('  ' + r.name));

console.log('\n=== tabele powiazane z dostawca/mapowaniem/pamiecia/zdjeciami ===');
all(`SELECT name,sql FROM sqlite_master WHERE type='table' AND (
      name LIKE '%dostaw%' OR name LIKE '%supplier%' OR name LIKE '%mapp%' OR name LIKE '%memory%'
      OR name LIKE '%zdjec%' OR name LIKE '%foto%' OR name LIKE '%image%' OR name LIKE '%link%'
      OR name LIKE '%vendor%' OR name LIKE '%mo%' )`).forEach(r => {
  console.log('--- ' + r.name + ' ---'); console.log(r.sql);
});

console.log('\n=== czy jest tabela mapujaca MOx -> nazwa dostawcy? szukam wartosci agrorami/grasdorf ===');
// przeszukaj kolumny tekstowe glownych tabel
const tabs = all(`SELECT name FROM sqlite_master WHERE type='table'`).map(r=>r.name);
for (const t of tabs) {
  try {
    const cols = all(`PRAGMA table_info(${t})`).map(c=>c.name);
    for (const c of cols) {
      try {
        const hit = one(`SELECT COUNT(*) n FROM ${t} WHERE ${c} LIKE '%agrorami%' OR ${c} LIKE '%grasdorf%'`);
        if (hit && hit.n > 0) console.log(`  ${t}.${c}: ${hit.n} trafien (agrorami/grasdorf)`);
      } catch(e){}
    }
  } catch(e){}
}
db.close();
