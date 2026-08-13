// Podmiana linkow abstore -> agritires.eu/zdjecia-produktow/store/ wg mapy 1:1 (po pelnym starym linku).
// + trwaly zapis do pamieci. Domyslnie DRY; --apply wykonuje.
const D = require('better-sqlite3');
const fs = require('fs');
const APPLY = process.argv.includes('--apply');
const db = new D('data.db');
const mp = JSON.parse(fs.readFileSync('abstore_map.json','utf8'));

const norm = v => String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,' ');
function mrKey(marka, model, rozmiar){
  const p=norm(marka),m=norm(model),r=norm(rozmiar);
  if(!p&&!m&&!r) return null; return `${p}|${m}|${r}`;
}

const rows = db.prepare(
  `SELECT id,kod,marka,model,rozmiar,link_zdjecia FROM products
   WHERE link_zdjecia LIKE '%static.abstore.pl%'`).all();

const updP = db.prepare(`UPDATE products SET link_zdjecia=? WHERE id=?`);
const upKod = db.prepare(`INSERT INTO link_pamiec_kod(kod,link,updated_at) VALUES(?,?,?)
  ON CONFLICT(kod) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at`);
const upMr = db.prepare(`INSERT INTO link_pamiec_mr(mrkey,link,updated_at) VALUES(?,?,?)
  ON CONFLICT(mrkey) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at`);

let changed=0, memKod=0, memMr=0, noMap=0;
const now = new Date().toISOString();
const sample=[];

const tx = db.transaction(()=>{
  for(const r of rows){
    const nl = mp[r.link_zdjecia];
    if(!nl){ noMap++; continue; }
    if(nl===r.link_zdjecia) continue;
    changed++;
    if(sample.length<5) sample.push([r.link_zdjecia.slice(-40), nl.slice(-40)]);
    if(APPLY){
      updP.run(nl, r.id);
      if(r.kod){ upKod.run(String(r.kod), nl, now); memKod++; }
      const k = mrKey(r.marka, r.model, r.rozmiar);
      if(k){ upMr.run(k, nl, now); memMr++; }
    }
  }
});
tx();

console.log(APPLY?'=== APPLY ===':'=== DRY (podglad) ===');
console.log('produktow z linkiem abstore:', rows.length);
console.log('do podmiany (jest w mapie):', changed, '| bez mapy (zostaje):', noMap);
if(APPLY) console.log('pamiec: link_pamiec_kod +'+memKod+', link_pamiec_mr +'+memMr);
console.log('przyklady:');
sample.forEach(s=>console.log('  ...'+s[0]+'  =>  ...'+s[1]));
if(APPLY){
  const left=db.prepare(`SELECT COUNT(*) n FROM products WHERE link_zdjecia LIKE '%static.abstore.pl%'`).get().n;
  const now2=db.prepare(`SELECT COUNT(*) n FROM products WHERE link_zdjecia LIKE '%agritires.eu/zdjecia-produktow/store/%'`).get().n;
  console.log('WERYFIKACJA: pozostalo abstore =', left, '| nowych store/ =', now2);
}
db.close();
