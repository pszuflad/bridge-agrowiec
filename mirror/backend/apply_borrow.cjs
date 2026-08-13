// Uzupelnia puste link_zdjecia dla pozycji z CSV, pozyczajac link od innego produktu
// o identycznym marka|model|rozmiar (case/space-insensitive). + zapis do pamieci.
// Domyslnie DRY; --apply wykonuje.
const D = require('better-sqlite3');
const fs = require('fs');
const APPLY = process.argv.includes('--apply');
const db = new D('data.db');
const names = JSON.parse(fs.readFileSync('csv_nolink_names.json','utf8'));

const norm = v => String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,' ');
function mrKey(a,b,c){ const p=norm(a),m=norm(b),r=norm(c); if(!p&&!m&&!r) return null; return `${p}|${m}|${r}`; }

const getByName = db.prepare(`SELECT id,kod,marka,model,rozmiar,link_zdjecia FROM products WHERE nazwa=?`);
const findSame = db.prepare(`SELECT link_zdjecia FROM products
  WHERE UPPER(TRIM(marka))=? AND UPPER(TRIM(model))=? AND UPPER(TRIM(rozmiar))=?
  AND link_zdjecia IS NOT NULL AND link_zdjecia!='' LIMIT 1`);
const updP = db.prepare(`UPDATE products SET link_zdjecia=? WHERE id=?`);
const upKod = db.prepare(`INSERT INTO link_pamiec_kod(kod,link,updated_at) VALUES(?,?,?)
  ON CONFLICT(kod) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at`);
const upMr = db.prepare(`INSERT INTO link_pamiec_mr(mrkey,link,updated_at) VALUES(?,?,?)
  ON CONFLICT(mrkey) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at`);

let filled=0, memKod=0, memMr=0;
const now = new Date().toISOString();
const sample=[];

const tx = db.transaction(()=>{
  for(const nm of names){
    const p = getByName.get(nm);
    if(!p || p.link_zdjecia) continue;         // brak produktu lub juz ma link
    const r = findSame.get(norm(p.marka), norm(p.model), norm(p.rozmiar));
    if(!r || !r.link_zdjecia) continue;         // brak zrodla
    filled++;
    if(sample.length<8) sample.push([p.marka+' '+p.model+' '+p.rozmiar, r.link_zdjecia.slice(-45)]);
    if(APPLY){
      updP.run(r.link_zdjecia, p.id);
      if(p.kod){ upKod.run(String(p.kod), r.link_zdjecia, now); memKod++; }
      const k = mrKey(p.marka,p.model,p.rozmiar);
      if(k){ upMr.run(k, r.link_zdjecia, now); memMr++; }
    }
  }
});
tx();

console.log(APPLY?'=== APPLY ===':'=== DRY (podglad) ===');
console.log('uzupelnionych (pozyczka po marka|model|rozmiar):', filled);
if(APPLY) console.log('pamiec: link_pamiec_kod +'+memKod+', link_pamiec_mr +'+memMr);
console.log('przyklady:');
sample.forEach(s=>console.log('  '+s[0].padEnd(45)+' <= ...'+s[1]));
if(APPLY){
  // weryfikacja: ile z listy nadal bez linku
  let noimg=0; for(const nm of names){ const p=getByName.get(nm); if(p && !p.link_zdjecia) noimg++; }
  console.log('WERYFIKACJA: pozycji z listy nadal bez linku =', noimg);
}
db.close();
