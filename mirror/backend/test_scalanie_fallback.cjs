const D = require('better-sqlite3');
const db = new D('data.db', { readonly: true });

// KANDYDACI DO SCALENIA wg realnej logiki assignKodImportu:
// grupa BEZ waznego EAN, klucz marka|rozmiar|bieznik|nazwa, majaca >1 roznych kod_importu
console.log('=== FALLBACK (bez waznego EAN): ten sam klucz marka|rozmiar|bieznik|nazwa, ROZNE kod_importu ===');
const fb = db.prepare(`
  SELECT lower(trim(COALESCE(marka,'')))||'|'||lower(trim(COALESCE(rozmiar,'')))||'|'||lower(trim(COALESCE(bieznik,'')))||'|'||lower(trim(COALESCE(nazwa,''))) AS gk,
         COUNT(DISTINCT kod_importu) ki, COUNT(*) c,
         GROUP_CONCAT(kod||':'||dostawca||':'||kod_importu, ' | ') det
  FROM products
  WHERE (ean IS NULL OR ean='' OR ean_is_valid IS NOT 1)
  GROUP BY gk
  HAVING COUNT(DISTINCT kod_importu) > 1
  ORDER BY c DESC
`).all();
console.log('  grup do scalenia (fallback):', fb.length);
fb.slice(0, 40).forEach(r => console.log('   [' + r.c + ' poz / ' + r.ki + ' numery] nazwa-klucz="' + r.gk.split('|')[3] + '" -> ' + r.det));

const hl = fb.filter(r => /MO4_|MO5_/.test(r.det));
console.log('\n=== grup fallback zawierajacych MO4/MO5 (Handlopex):', hl.length, '===');
hl.slice(0, 40).forEach(r => console.log('   [' + r.c + ' poz] ' + r.det));

db.close();
