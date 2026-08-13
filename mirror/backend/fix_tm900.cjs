const D=require('better-sqlite3');
const db=new D('data.db');
const now=new Date().toISOString().replace('T',' ').slice(0,19);
const rows=db.prepare("SELECT kod,nazwa,dostawca,bieznik FROM products WHERE bieznik='TM900HP'").all();
console.log('do domkniecia:',rows.length);
const upd=db.prepare("UPDATE products SET bieznik='TM 900 HP' WHERE kod=?");
const h=db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");
const ovE=db.prepare("SELECT id FROM manual_overrides WHERE supplier_product_id=? AND field_name='bieznik'");
const ovU=db.prepare("UPDATE manual_overrides SET override_value=?,reason=?,created_at=?,acknowledged_source_value=? WHERE id=?");
const ovI=db.prepare("INSERT INTO manual_overrides (supplier_kod,supplier_product_id,field_name,override_value,reason,created_by,created_at,acknowledged_source_value) VALUES (?,?,?,?,?,?,?,?)");
const tx=db.transaction(()=>{
  for(const r of rows){
    upd.run(r.kod);
    h.run(now,r.kod,r.nazwa||'','bieznik','TM900HP','TM 900 HP','scalanie-bieznik-2026-07-22','Anna');
    const e=ovE.get(r.kod);
    if(e) ovU.run('TM 900 HP','ochrona-scalanie-bieznik-2026-07-22',now,'TM900HP',e.id);
    else ovI.run(r.dostawca||'',r.kod,'bieznik','TM 900 HP','ochrona-scalanie-bieznik-2026-07-22',1,now,'TM900HP');
  }
});
tx();
const left=db.prepare("SELECT COUNT(*) n FROM products WHERE bieznik='TM900HP'").get().n;
console.log('pozostalo TM900HP:',left,'| TM 900 HP:',db.prepare("SELECT COUNT(*) n FROM products WHERE bieznik='TM 900 HP'").get().n);
db.close();
