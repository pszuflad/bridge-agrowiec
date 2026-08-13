const D = require('better-sqlite3');
const db = new D('data.db', { readonly: true });
const q = (s) => db.prepare(s).all();

console.log('=== dostawcy: liczba produktow + ze zdjeciem ===');
q(`SELECT COALESCE(dostawca,'(null)') d, COUNT(*) n,
      SUM(CASE WHEN link_zdjecia IS NOT NULL AND link_zdjecia<>'' THEN 1 ELSE 0 END) z
    FROM products GROUP BY dostawca ORDER BY n DESC`).forEach(r =>
  console.log(`  ${r.d}: produktow=${r.n}, ze zdjeciem=${r.z}`));

console.log('\n=== marki top 15 ===');
q(`SELECT COALESCE(marka,'(null)') m, COUNT(*) n FROM products GROUP BY marka ORDER BY n DESC LIMIT 15`)
  .forEach(r => console.log(`  ${r.m}: ${r.n}`));

console.log('\n=== przyklady link_zdjecia ===');
q(`SELECT id,kod,sku,kod_dostawcy,dostawca,marka,substr(link_zdjecia,1,110) lz
   FROM products WHERE link_zdjecia IS NOT NULL AND link_zdjecia<>'' LIMIT 10`)
  .forEach(r => console.log(JSON.stringify(r)));

console.log('\n=== rozne domeny/wzorce w link_zdjecia ===');
q(`SELECT COUNT(*) n,
      CASE
        WHEN link_zdjecia LIKE '%agritires.eu/zdjecia-produktow/%' THEN 'agritires-zdjecia-produktow'
        WHEN link_zdjecia LIKE '%grasdorf%' THEN 'grasdorf'
        WHEN link_zdjecia LIKE '%agrorami%' THEN 'agrorami'
        WHEN link_zdjecia LIKE 'http%' THEN 'inny-http'
        WHEN link_zdjecia IS NULL OR link_zdjecia='' THEN 'BRAK'
        ELSE 'inne'
      END wzorzec
    FROM products GROUP BY wzorzec ORDER BY n DESC`).forEach(r => console.log(`  ${r.wzorzec}: ${r.n}`));

console.log('\n=== BKT: ile produktow, ile ze zdjeciem ===');
q(`SELECT COALESCE(dostawca,'(null)') d, COUNT(*) n,
      SUM(CASE WHEN link_zdjecia IS NOT NULL AND link_zdjecia<>'' THEN 1 ELSE 0 END) z
    FROM products WHERE marka LIKE '%BKT%' OR marka LIKE '%bkt%' GROUP BY dostawca`).forEach(r =>
  console.log(`  dostawca=${r.d}: ${r.n} (ze zdjeciem ${r.z})`));

db.close();
