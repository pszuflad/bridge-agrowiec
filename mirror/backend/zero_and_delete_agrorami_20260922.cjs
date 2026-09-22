'use strict';
const fs=require('fs');
const root='/home/admin/private_apps/bridge';
const DB=require(root+'/node_modules/better-sqlite3');
if(process.env.APPLY_AVAILABILITY!=='yes')throw Error('Explicit deployment flag required');
const targets=JSON.parse(fs.readFileSync(root+'/availability_zero_targets_20260922.json','utf8'));
require(root+'/node_modules/dotenv').config({path:root+'/.env',quiet:true});
const {apiWithRetry}=require(root+'/selly/discovery.cjs');
const db=new DB(root+'/data.db');
(async()=>{
  let ok=0;
  const absent=new Set();
  for(const r of targets){
    const active=db.prepare("SELECT 1 FROM products WHERE dostawca=? AND kod_importu=? AND status='aktywny' LIMIT 1").get(r.dostawca,r.kod_importu);
    if(active)throw Error('An offer returned during verification; re-evaluate targets before proceeding: '+r.kod);
    let res;
    try{res=await apiWithRetry('PUT',`/api/products/${r.selly_product_id}/variants/${r.selly_variant_id}`,{body:{quantity:0}});}
    catch(e){if(e.status===404){absent.add(`${r.selly_product_id}/${r.selly_variant_id}`);continue;}throw e;}
    if(res.status<200||res.status>=300)throw Error(`${r.dostawca}/${r.kod}: HTTP ${res.status}`);
    db.prepare(`UPDATE selly_products SET stan_wyslany=0,ostatnia_sync=datetime('now'),
      ostatni_status='ok',ostatni_blad=NULL WHERE kod_importu=? AND dostawca=?`).run(r.kod_importu,r.dostawca);
    ok++;
    if(ok%50===0)console.log('ZERO_PROGRESS',ok,'/',targets.length);
  }
  // Read back every affected variant. No old catalog card is removed until its
  // shop stock is confirmed zero, rather than merely trusting a PUT response.
  let verified=0;
  for(const r of targets){
    let res;
    try{res=await apiWithRetry('GET',`/api/products/${r.selly_product_id}/variants/${r.selly_variant_id}`);}
    catch(e){if(e.status===404){absent.add(`${r.selly_product_id}/${r.selly_variant_id}`);continue;}throw e;}
    const v=res.data?.data??res.data;
    if(Number(v?.quantity)!==0)throw Error(`Nie potwierdzono zera ${r.selly_product_id}/${r.selly_variant_id}`);
    verified++;
    if(verified%50===0)console.log('VERIFY_PROGRESS',verified,'/',targets.length);
  }
  const mo9=db.prepare(`SELECT p.id,p.kod,p.kod_importu FROM staging_items s
    JOIN products p ON p.dostawca=s.dostawca AND p.kod=s.kod
    WHERE s.dostawca='MO9' AND json_extract(s.snapshot_json,'$._absenceReview')=1`).all();
  if(mo9.length!==179)throw Error(`Przed usunięciem oczekiwano 179 kart MO9, jest ${mo9.length}`);
  const stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z_old_agrorami_delete';
  const backup=root+'/data.db.bak_'+stamp;
  await db.backup(backup);
  db.transaction(()=>{
    const delStage=db.prepare("DELETE FROM staging_items WHERE dostawca='MO9' AND kod=?");
    // Keep zeroed shop mapping for reuse if Marta later accepts the tire anew.
    const delAlias=db.prepare("DELETE FROM staging_matches WHERE supplier='MO9' AND product_code=?");
    const delProduct=db.prepare("DELETE FROM products WHERE id=?");
    const delAuto=db.prepare("DELETE FROM product_auto_suspensions WHERE supplier='MO9' AND product_code=?");
    for(const r of mo9){delStage.run(r.kod);delAlias.run(r.kod);delAuto.run(r.kod);delProduct.run(r.id);}
  })();
  const report={zeroed:ok,verified,notPresentInShop:absent.size,deletedOldAgrorami:mo9.length,backup,
    remainingOldAgrorami:db.prepare(`SELECT count(*) n FROM staging_items WHERE dostawca='MO9' AND json_extract(snapshot_json,'$._absenceReview')=1`).get().n,
    integrity:db.pragma('quick_check')};
  fs.writeFileSync(root+'/availability_shop_result_20260922.json',JSON.stringify(report,null,2),{mode:0o600});
  const log=root+'/CHANGELOG.md',logBackup=log+'.bak_'+stamp;
  fs.copyFileSync(log,logBackup);
  const time=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',dateStyle:'short',timeStyle:'short'}).format(new Date());
  const entry=`${time}\nobszar: baza danych\n\npliki: data.db + ${backup}; CHANGELOG.md + ${logBackup}; availability_migration_archive_20260922.json; availability_shop_result_20260922.json\n\nzmiana: Po zabezpieczeniu dostępności w sklepie usunięto dokładnie 179 dawnych kart MO9 Agrorami z katalogu oraz ich stare zgłoszenia i ręczne powiązania staging_matches. Zachowano historię i wyzerowane mapowania Selly, pozostałych dostawców nie usuwano. Powrót opony nie odtwarza usuniętej karty: przechodzi zwykłe dopasowanie i staging do akceptacji Marty.\n\npowód: Decyzja Anny 22.09.2026 o usunięciu nieobecnych starych kart Agrorami po przejściu z CSV na API.\n\n---\n\n`;
  const tmp=log+'.tmp_'+stamp;fs.writeFileSync(tmp,entry+fs.readFileSync(log,'utf8'));fs.renameSync(tmp,log);
  console.log(JSON.stringify(report,null,2));
  db.close();
})().catch(e=>{console.error(e);try{db.close()}catch{}process.exitCode=1;});
