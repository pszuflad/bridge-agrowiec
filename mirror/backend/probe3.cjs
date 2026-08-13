const D = require('better-sqlite3');
const db = new D('data.db', { readonly: true });
const all = (s) => db.prepare(s).all();

console.log('=== suppliers: kod -> nazwa ===');
all(`SELECT kod, nazwa, parser, status, liczba_produktow FROM suppliers ORDER BY kod`).forEach(r =>
  console.log(`  ${r.kod} = ${r.nazwa} | parser=${r.parser} | status=${r.status} | prod=${r.liczba_produktow}`));

console.log('\n=== link_pamiec_kod: przyklady + zliczenia domen ===');
all(`SELECT kod, substr(link,1,90) link, updated_at FROM link_pamiec_kod LIMIT 6`).forEach(r=>console.log(JSON.stringify(r)));
console.log('  RAZEM link_pamiec_kod:', all(`SELECT COUNT(*) n FROM link_pamiec_kod`)[0].n);
all(`SELECT COUNT(*) n,
      CASE WHEN link LIKE '%agrorami%' THEN 'agrorami'
           WHEN link LIKE '%grasdorf%' THEN 'grasdorf'
           WHEN link LIKE '%agritires.eu/zdjecia-produktow%' THEN 'agritires-zdjecia'
           ELSE 'inne' END w
    FROM link_pamiec_kod GROUP BY w ORDER BY n DESC`).forEach(r=>console.log(`    ${r.w}: ${r.n}`));

console.log('\n=== link_pamiec_mr: przyklady ===');
all(`SELECT mrkey, substr(link,1,90) link FROM link_pamiec_mr LIMIT 6`).forEach(r=>console.log(JSON.stringify(r)));
console.log('  RAZEM link_pamiec_mr:', all(`SELECT COUNT(*) n FROM link_pamiec_mr`)[0].n);

console.log('\n=== jaki dostawca (MOx) ma linki agrorami vs grasdorf w products ===');
all(`SELECT dostawca,
      SUM(CASE WHEN link_zdjecia LIKE '%agrorami%' THEN 1 ELSE 0 END) agrorami,
      SUM(CASE WHEN link_zdjecia LIKE '%grasdorf%' THEN 1 ELSE 0 END) grasdorf,
      SUM(CASE WHEN link_zdjecia LIKE '%agritires.eu/zdjecia-produktow%' THEN 1 ELSE 0 END) agritires
    FROM products GROUP BY dostawca HAVING agrorami+grasdorf+agritires>0 ORDER BY dostawca`).forEach(r=>
  console.log(`  ${r.dostawca}: agrorami=${r.agrorami}, grasdorf=${r.grasdorf}, agritires-zdjecia=${r.agritires}`));

console.log('\n=== przyklad kodow produktow BKT u dostawcy Agrorami (do dopasowania) ===');
db.close();
