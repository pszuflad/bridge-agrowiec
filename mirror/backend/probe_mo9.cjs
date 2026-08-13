const D = require('better-sqlite3');
const db = new D('data.db', { readonly: true });
const all = (s) => db.prepare(s).all();

const rows = all(`SELECT id, kod, kod_dostawcy, marka, model, rozmiar, nazwa,
                   CASE WHEN link_zdjecia IS NULL OR link_zdjecia='' THEN 0 ELSE 1 END has_img,
                   CASE WHEN link_zdjecia LIKE '%grasdorf%' THEN 1 ELSE 0 END grasdorf
                 FROM products WHERE dostawca='MO9' ORDER BY id LIMIT 25`);
console.log('=== przyklady MO9 (model / rozmiar / nazwa) ===');
rows.forEach(r => console.log(JSON.stringify({id:r.id,kd:r.kod_dostawcy,marka:r.marka,model:r.model,rozmiar:r.rozmiar,img:r.has_img,gr:r.grasdorf,nazwa:(r.nazwa||'').slice(0,50)})));

console.log('\n=== statystyki MO9 ===');
const s = all(`SELECT COUNT(*) n,
  SUM(CASE WHEN model IS NOT NULL AND model<>'' THEN 1 ELSE 0 END) ma_model,
  SUM(CASE WHEN rozmiar IS NOT NULL AND rozmiar<>'' THEN 1 ELSE 0 END) ma_rozmiar,
  SUM(CASE WHEN kod_dostawcy IS NOT NULL AND kod_dostawcy<>'' THEN 1 ELSE 0 END) ma_kd,
  SUM(CASE WHEN link_zdjecia IS NULL OR link_zdjecia='' THEN 1 ELSE 0 END) bez_img,
  SUM(CASE WHEN link_zdjecia LIKE '%grasdorf%' THEN 1 ELSE 0 END) grasdorf
  FROM products WHERE dostawca='MO9'`)[0];
console.log(JSON.stringify(s,null,1));
db.close();
