'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.env.BRIDGE_TEST_ROOT||'/home/admin/private_apps/bridge';
if(!process.env.BRIDGE_TEST_ROOT && process.env.APPLY_AVAILABILITY!=='yes')throw Error('Explicit deployment flag required');
const DB=require(root+'/node_modules/better-sqlite3');
const db=new DB(root+'/data.db');
const now=new Date().toISOString();
const oldMo9=db.prepare(`SELECT s.id staging_id,p.id product_id,p.kod,p.kod_importu,p.status,p.stan,
  sp.selly_product_id,sp.selly_variant_id,sp.stan_wyslany
  FROM staging_items s JOIN products p ON p.dostawca=s.dostawca AND p.kod=s.kod
  LEFT JOIN selly_products sp ON sp.dostawca=p.dostawca AND sp.kod_importu=p.kod_importu
  WHERE s.dostawca='MO9' AND json_extract(s.snapshot_json,'$._absenceReview')=1`).all();
const alternative=db.prepare(`SELECT s.id staging_id,p.id product_id,p.kod,p.kod_importu,p.dostawca,p.status,p.stan,
  sp.selly_product_id,sp.selly_variant_id,sp.stan_wyslany
  FROM staging_items s JOIN products p ON p.dostawca=s.dostawca AND p.kod=s.kod
  LEFT JOIN selly_products sp ON sp.dostawca=p.dostawca AND sp.kod_importu=p.kod_importu
  WHERE s.dostawca!='MO9' AND json_extract(s.snapshot_json,'$._absenceReview')=1`).all();
const missing=db.prepare(`SELECT p.id product_id,p.kod,p.kod_importu,p.dostawca,p.status,p.stan,
  sp.selly_product_id,sp.selly_variant_id,sp.stan_wyslany
  FROM product_absence_checks a JOIN products p ON p.dostawca=a.supplier AND p.kod=a.product_code
  LEFT JOIN selly_products sp ON sp.dostawca=p.dostawca AND sp.kod_importu=p.kod_importu`).all();
if(oldMo9.length!==179)throw Error(`Oczekiwano 179 starych kart MO9, jest ${oldMo9.length}`);
if(alternative.length!==2)throw Error(`Oczekiwano 2 alternatywnych kart, jest ${alternative.length}`);
if(missing.length!==395)throw Error(`Oczekiwano 395 nieobecnych produktów, jest ${missing.length}`);
const targeted=new Map();
for(const r of [...missing,...alternative,...oldMo9]) targeted.set(`${r.dostawca||'MO9'}\0${r.kod}`,{...r,dostawca:r.dostawca||'MO9'});
db.exec(`CREATE TABLE IF NOT EXISTS product_auto_suspensions(
  supplier TEXT NOT NULL,product_code TEXT NOT NULL,suspended_at TEXT NOT NULL,
  source_fingerprint TEXT,reason TEXT NOT NULL,PRIMARY KEY(supplier,product_code))`);
const tx=db.transaction(()=>{
  const suspend=db.prepare("UPDATE products SET status='wstrzymany',stan=0,nieobecnosc_pod_rzad=0,data_aktualizacji=? WHERE id=?");
  const mark=db.prepare(`INSERT INTO product_auto_suspensions VALUES(?,?,?,?,?)
    ON CONFLICT(supplier,product_code) DO UPDATE SET suspended_at=excluded.suspended_at,
    source_fingerprint=excluded.source_fingerprint,reason=excluded.reason`);
  for(const r of [...missing,...alternative]){
    if(r.status==='aktywny'){
      mark.run(r.dostawca,r.kod,now,'wdrozenie-20260922','Brak w aktualnym, kompletnym cenniku dostawcy');
    }
    suspend.run(now,r.product_id);
  }
  // Old MO9 rows will be deleted only after their Selly variants are zeroed.
  for(const r of oldMo9)suspend.run(now,r.product_id);
  db.prepare('DELETE FROM product_absence_checks').run();
  db.prepare("DELETE FROM staging_items WHERE typ_zmiany='wycofana'").run();
});
tx();
// Shared shop variants must remain available when a different current catalog
// offer for the SAME supplier/group is still active.
const hasActive=db.prepare("SELECT 1 FROM products WHERE dostawca=? AND kod_importu=? AND status='aktywny' LIMIT 1");
const targetVariants=new Map();
for(const r of targeted.values())if(r.selly_variant_id && !hasActive.get(r.dostawca,r.kod_importu)){
  targetVariants.set(`${r.selly_product_id}/${r.selly_variant_id}`,r);
}
const targets=[...targetVariants.values()];
fs.writeFileSync(root+'/availability_zero_targets_20260922.json',JSON.stringify(targets,null,2),{mode:0o600});
fs.writeFileSync(root+'/availability_migration_archive_20260922.json',JSON.stringify({
  at:now,missing,alternative,oldMo9,
  deletedProducts:db.prepare("SELECT * FROM products WHERE dostawca='MO9' AND id IN (SELECT p.id FROM staging_items s JOIN products p ON p.kod=s.kod AND p.dostawca=s.dostawca WHERE s.dostawca='MO9' AND json_extract(s.snapshot_json,'$._absenceReview')=1)").all()
},null,2),{mode:0o600});
console.log(JSON.stringify({oldMo9:oldMo9.length,alternative:alternative.length,missing:missing.length,
  uniqueTargets:targeted.size,apiZeros:targets.length,
  autoSuspensions:db.prepare('SELECT count(*) n FROM product_auto_suspensions').get().n,
  activeRemaining:db.prepare("SELECT count(*) n FROM products WHERE status='aktywny'").get().n},null,2));
db.close();
