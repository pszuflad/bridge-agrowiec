// Zapis linkow zdjec Agrorami do products + trwala pamiec (link_pamiec_kod, link_pamiec_mr)
// Tryb: domyslnie DRY. Z argumentem --apply wykonuje zmiany.
const D = require('better-sqlite3');
const fs = require('fs');
const APPLY = process.argv.includes('--apply');
const db = new D('data.db');
const final = JSON.parse(fs.readFileSync('match_final.json','utf8'));

const norm = v => String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,' ');
function mrKey(marka, model, rozmiar){
  const p=norm(marka),m=norm(model),r=norm(rozmiar);
  if(!p&&!m&&!r) return null; return `${p}|${m}|${r}`;
}

const getP = db.prepare(`SELECT id,kod,marka,model,rozmiar,link_zdjecia FROM products WHERE id=?`);
const updP = db.prepare(`UPDATE products SET link_zdjecia=? WHERE id=?`);
const upKod = db.prepare(`INSERT INTO link_pamiec_kod(kod,link,updated_at) VALUES(?,?,?)
  ON CONFLICT(kod) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at`);
const upMr = db.prepare(`INSERT INTO link_pamiec_mr(mrkey,link,updated_at) VALUES(?,?,?)
  ON CONFLICT(mrkey) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at`);

let willUpdate=0, fillEmpty=0, overwriteGrasdorf=0, overwriteOther=0, skipSame=0, missing=0;
const now = new Date().toISOString();

const tx = db.transaction(()=>{
  for(const r of final){
    const p = getP.get(r.id);
    if(!p){ missing++; continue; }
    const old = p.link_zdjecia || '';
    if(old === r.img){ skipSame++; }
    else {
      if(!old) fillEmpty++;
      else if(old.includes('grasdorf')) overwriteGrasdorf++;
      else overwriteOther++;
      willUpdate++;
      if(APPLY) updP.run(r.img, r.id);
    }
    // pamiec zawsze (kod + marka|model|rozmiar)
    if(APPLY){
      if(p.kod) upKod.run(String(p.kod), r.img, now);
      const k = mrKey(p.marka, p.model, p.rozmiar);
      if(k) upMr.run(k, r.img, now);
    }
  }
});
tx();

console.log(APPLY?'=== APPLY ===':'=== DRY (podglad) ===');
console.log('rekordow w liscie:', final.length);
console.log('do aktualizacji link_zdjecia:', willUpdate);
console.log('  - uzupelnienie pustych:', fillEmpty);
console.log('  - nadpisanie Grasdorf:', overwriteGrasdorf);
console.log('  - nadpisanie innego zrodla:', overwriteOther);
console.log('bez zmian (juz ten sam link):', skipSame);
console.log('brak produktu w bazie:', missing);
if(APPLY){
  const c1=db.prepare('SELECT COUNT(*) n FROM link_pamiec_kod').get().n;
  const c2=db.prepare('SELECT COUNT(*) n FROM link_pamiec_mr').get().n;
  console.log('link_pamiec_kod rows:', c1, '| link_pamiec_mr rows:', c2);
}
db.close();
