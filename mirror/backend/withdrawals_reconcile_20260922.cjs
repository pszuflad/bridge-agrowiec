'use strict';
const fs=require('fs'),Module=require('module'),crypto=require('crypto');
const root=__dirname;process.chdir(root);
const s=fs.readFileSync(root+'/index.cjs','utf8'),cut=s.indexOf('var V4=require("node:http")');
if(cut<0)throw Error('Server boundary missing');
const m=new Module(root+'/withdrawal_reconcile_core.cjs',module);m.filename=root+'/withdrawal_reconcile_core.cjs';m.paths=module.paths;
m._compile(s.slice(0,cut)+';module.exports={U,Qi,tk};',m.filename);
const {U,Qi:db,tk}=m.exports;
const adapter=require('./parsers/adapter.cjs'),safe=require('./feed_safety.cjs');
const dir='/tmp/bridge-withdrawals-20260922',suppliers=['MO1','MO2','MO3','MO4','MO5','MO9'];
const digest=()=>crypto.createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM products ORDER BY id').all().map(({nieobecnosc_pod_rzad,...p})=>p))).digest('hex');
const before=digest(),beforeQueue=db.prepare('SELECT typ_zmiany,count(*) n FROM staging_items GROUP BY typ_zmiany').all();
const zero=db.prepare("SELECT count(*) n FROM staging_items s JOIN products p ON s.kod=p.kod AND s.dostawca=p.dostawca WHERE s.typ_zmiany='wycofana' AND p.status='wstrzymany' AND COALESCE(p.stan,0)=0").get().n;
const report={at:new Date().toISOString(),beforeQueue,alreadySuspendedZero:zero,suppliers:[]};
db.exec('SAVEPOINT fix_absences');
try{
 for(const supplier of suppliers){
  const file=dir+'/'+supplier+'.parsed.json';
  if(!fs.existsSync(file))throw Error('Missing freshly verified source '+supplier);
  if(Date.now()-fs.statSync(file).mtimeMs>3*3600000)throw Error('Audit source older than 3 hours '+supplier);
  const parsed=safe.attach(supplier,JSON.parse(fs.readFileSync(file)));
  if(supplier==='MO9' && parsed.records.length+(parsed.odrzucone?.length||0)!==parsed.totalCount)throw Error('Incomplete MO9 source');
  const rows=adapter.recordsToSurowe(supplier,parsed.records);
  // Old counts were based on duplicated reads/fallbacks, so they are not
  // historical evidence. Rebuild from the first verified complete source.
  const removed=db.prepare("DELETE FROM staging_items WHERE dostawca=? AND typ_zmiany='wycofana'").run(supplier).changes;
  db.prepare('UPDATE products SET nieobecnosc_pod_rzad=0 WHERE dostawca=?').run(supplier);
  const stats=tk(supplier,rows,{reconcileOnly:true,verifyAbsence:true});
  report.suppliers.push({supplier,raw:parsed.records.length,rows:rows.length,oldWithdrawalIssues:removed,stats});
 }
 const legacyFile=dir+'/legacy_candidates.json';
 if(fs.existsSync(legacyFile)){
  for(const r of JSON.parse(fs.readFileSync(legacyFile))){
   const item=db.prepare("SELECT id,snapshot_json FROM staging_items WHERE dostawca='MO9' AND kod=?").get(r.code);
   if(!item)continue;
   const snap=JSON.parse(item.snapshot_json||'{}');
   if(!snap._absenceReview)continue;
   snap._candidates=r.candidates;snap._historicalEAN=r.historicalEAN;
   db.prepare('UPDATE staging_items SET snapshot_json=? WHERE id=?').run(JSON.stringify(snap),item.id);
  }
 }
 if(digest()!==before)throw Error('Catalog values changed during queue reconciliation');
 report.afterQueue=db.prepare('SELECT typ_zmiany,count(*) n FROM staging_items GROUP BY typ_zmiany').all();
 report.awaitingEvidence=db.prepare('SELECT supplier,count(*) n FROM product_absence_checks GROUP BY supplier').all();
 report.legacyReview=db.prepare("SELECT count(*) n FROM staging_items WHERE json_extract(snapshot_json,'$._absenceReview')=1").get().n;
 report.duplicates=db.prepare('SELECT count(*) n FROM (SELECT dostawca,kod FROM staging_items GROUP BY dostawca,kod HAVING count(*)>1)').get().n;
 report.catalogUnchanged=true;
 if(report.duplicates)throw Error('Duplicate staging entries');
 if(process.env.APPLY_WITHDRAWALS==='yes'){
  db.exec('RELEASE fix_absences');
  fs.writeFileSync(root+'/withdrawals_reconcile_report_20260922.json',JSON.stringify(report,null,2));
 }else db.exec('ROLLBACK TO fix_absences; RELEASE fix_absences');
 console.log('RECONCILE_RESULT',JSON.stringify(report));
}catch(e){db.exec('ROLLBACK TO fix_absences; RELEASE fix_absences');throw e;}
db.close();
