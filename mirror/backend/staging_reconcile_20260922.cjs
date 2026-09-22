'use strict';
const fs=require('fs'),Module=require('module'),crypto=require('crypto');
const root=__dirname;process.chdir(root);
const src=fs.readFileSync(root+'/index.cjs','utf8'),cut=src.indexOf('var V4=require("node:http")');
if(cut<0)throw Error('boundary');
const m=new Module(root+'/replay_core.cjs',module);m.filename=root+'/replay_core.cjs';m.paths=module.paths;
m._compile(src.slice(0,cut)+';module.exports={U,Qi,tk};',m.filename);
const {U,Qi:db,tk}=m.exports;
const {parseByKod}=require('./parsers/dispatcher.cjs'),{recordsToSurowe}=require('./parsers/adapter.cjs');
const archive='/home/admin/private_apps/bridge/import_archive/2026-09';
const digest=()=>crypto.createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM products ORDER BY id').all())).digest('hex');
const before=digest(),results=[];
db.exec('SAVEPOINT reconcile');
try {
  // Deduplicate legacy cases first; a complete fresh feed will replace them below.
  db.exec('DELETE FROM staging_items WHERE id NOT IN (SELECT MAX(id) FROM staging_items GROUP BY dostawca,kod)');
  for(let n=1;n<=10;n++){
    const supplier='MO'+n;
    const files=fs.readdirSync(archive).filter(f=>f.startsWith(supplier+'__')&&!f.endsWith('.json'))
      .map(f=>({f,time:fs.statSync(archive+'/'+f).mtimeMs})).sort((a,b)=>b.time-a.time);
    if(!files.length){results.push({supplier,skipped:'no archive'});continue;}
    const file=files[0].f;
    const parsed=parseByKod(supplier,archive+'/'+file);
    if(!parsed.records?.length || parsed.errors?.length)throw Error(supplier+' incomplete parsing '+JSON.stringify(parsed.errors?.slice(0,3)));
    const records=recordsToSurowe(supplier,parsed.records);
    if(records.length<Math.max(1,U.listProducts().filter(p=>p.dostawca===supplier).length*.3))throw Error(supplier+' suspiciously incomplete feed');
    const stats=tk(supplier,records,{reconcileOnly:true});
    results.push({supplier,file,records:records.length,stats});
  }
  if(digest()!==before)throw Error('RECONCILE CHANGED CATALOG');
  const queue=U.listStaging();
  console.log('REPLAY',JSON.stringify({results,counts:db.prepare('SELECT typ_zmiany,count(*) n FROM staging_items GROUP BY typ_zmiany').all(),
    duplicateGroups:db.prepare('SELECT count(*) n FROM (SELECT kod,dostawca FROM staging_items GROUP BY kod,dostawca HAVING count(*)>1)').get(),
    invalid:queue.filter(r=>JSON.parse(r.snapshotJson||'{}')._eanIssue).length,
    ambiguous:queue.filter(r=>JSON.parse(r.snapshotJson||'{}')._matchIssue).length,
    legacy:queue.filter(r=>!JSON.parse(r.snapshotJson||'{}')._policyVersion).length,
    ceat:queue.filter(r=>r.kod.includes('CTCR22531560LWES')).map(r=>({kod:r.kod,typ:r.typZmiany,price:r.cenaZakupuNowa,reason:r.powod})),
    errorSamples:queue.filter(r=>r.typZmiany==='blad').slice(0,8).map(r=>({kod:r.kod,powod:r.powod})),
    catalogUnchanged:true}));
  if(process.env.APPLY_RECONCILE==='yes'){
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS staging_one_current_product ON staging_items(dostawca,kod)');
    db.exec('RELEASE reconcile');
  }else db.exec('ROLLBACK TO reconcile; RELEASE reconcile');
}catch(e){db.exec('ROLLBACK TO reconcile; RELEASE reconcile');throw e;}
db.close();
