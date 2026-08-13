const Database=require('better-sqlite3');
const fs=require('fs');
const db=new Database('data.db');
const merges=JSON.parse(fs.readFileSync('merges_final.json','utf8'));

const now=new Date().toISOString().replace('T',' ').slice(0,19);
const stamp=new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);

// 1) BACKUP
const bak=`data.db.bak_pre_scalanie_bieznik_${stamp}`;
db.exec(`VACUUM INTO '${bak}'`);
console.log('BACKUP:',bak);

const selBy=db.prepare('SELECT kod,nazwa,marka,bieznik,dostawca FROM products WHERE bieznik=?');
const upd=db.prepare('UPDATE products SET bieznik=? WHERE kod=?');
const histIns=db.prepare('INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)');
const ovExists=db.prepare('SELECT id FROM manual_overrides WHERE supplier_product_id=? AND field_name=?');
const ovIns=db.prepare('INSERT INTO manual_overrides (supplier_kod,supplier_product_id,field_name,override_value,reason,created_by,created_at,acknowledged_source_value) VALUES (?,?,?,?,?,?,?,?)');

const ZR='scalanie-bieznik-2026-07-22';
const REASON='ochrona-scalanie-bieznik-2026-07-22';

let nUpd=0,nHist=0,nOv=0,nOvSkip=0;
const tx=db.transaction(()=>{
  for(const m of merges){
    const rows=selBy.all(m.src);
    for(const r of rows){
      upd.run(m.target, r.kod);
      histIns.run(now, r.kod, r.nazwa||'', 'bieznik', m.src, m.target, ZR, 'Anna');
      nUpd++; nHist++;
      // manual_override: chron docelowa nazwe bieznika przed importem
      const ex=ovExists.get(r.kod,'bieznik');
      if(ex){
        // aktualizuj istniejacy override na nowa docelowa
        db.prepare('UPDATE manual_overrides SET override_value=?, reason=?, created_at=?, acknowledged_source_value=? WHERE id=?')
          .run(m.target, REASON, now, m.src, ex.id);
        nOvSkip++;
      } else {
        ovIns.run(r.dostawca||'', r.kod, 'bieznik', m.target, REASON, 1, now, m.src);
        nOv++;
      }
    }
  }
});
tx();
console.log('UPDATE bieznik:',nUpd,'| historia:',nHist,'| nowe overrides:',nOv,'| zaktualizowane overrides:',nOvSkip);

// weryfikacja: czy zostaly jakies src w bazie?
let pozostale=0;
for(const m of merges){ pozostale+=db.prepare('SELECT COUNT(*) n FROM products WHERE bieznik=?').get(m.src).n; }
console.log('POZOSTALE zrodlowe warianty w bazie (powinno 0):',pozostale);
db.close();
