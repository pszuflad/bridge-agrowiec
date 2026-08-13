// Wdraza dopasowania ze zrodla products-zdjecia (src_match.json) do pustych link_zdjecia.
// + zapis do pamieci. Domyslnie DRY; --apply wykonuje.
const D=require('better-sqlite3'); const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const db=new D('data.db');
const res=JSON.parse(fs.readFileSync('src_match.json'));

const norm=v=>String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,' ');
function mrKey(a,b,c){const p=norm(a),m=norm(b),r=norm(c);if(!p&&!m&&!r)return null;return `${p}|${m}|${r}`;}

const getP=db.prepare('SELECT id,kod,marka,model,rozmiar,link_zdjecia FROM products WHERE id=?');
const updP=db.prepare('UPDATE products SET link_zdjecia=? WHERE id=?');
const upKod=db.prepare(`INSERT INTO link_pamiec_kod(kod,link,updated_at) VALUES(?,?,?)
  ON CONFLICT(kod) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at`);
const upMr=db.prepare(`INSERT INTO link_pamiec_mr(mrkey,link,updated_at) VALUES(?,?,?)
  ON CONFLICT(mrkey) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at`);

let filled=0, skip=0, memKod=0, memMr=0;
const now=new Date().toISOString();
const tx=db.transaction(()=>{
  for(const r of res){
    const p=getP.get(r.id); if(!p){skip++;continue;}
    if(p.link_zdjecia){skip++;continue;}   // ma juz link -> nie ruszamy
    filled++;
    if(APPLY){
      updP.run(r.link, p.id);
      if(p.kod){upKod.run(String(p.kod), r.link, now); memKod++;}
      const k=mrKey(p.marka,p.model,p.rozmiar);
      if(k){upMr.run(k, r.link, now); memMr++;}
    }
  }
});
tx();
console.log(APPLY?'=== APPLY ===':'=== DRY ===');
console.log('do uzupelnienia:', filled, '| pominietych (juz mialy link):', skip);
if(APPLY) console.log('pamiec: link_pamiec_kod +'+memKod+', link_pamiec_mr +'+memMr);
db.close();
