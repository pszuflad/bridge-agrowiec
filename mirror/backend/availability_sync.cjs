'use strict';
// Availability changes publish the active-only CSV and promptly zero existing
// suspended variants. Periodic delta sync remains the durable retry mechanism.
const cp=require('child_process'),path=require('path');
const pending=new Set();
let running=false;
function request(db,supplier){
  pending.add(supplier);
  if(running)return;
  running=true;
  setImmediate(async()=>{
    try{
      while(pending.size){
        const suppliers=[...pending];pending.clear();
        cp.execFileSync(process.execPath,[path.join(__dirname,'generate_selly_export.cjs')],{cwd:__dirname,timeout:60000});
        const {syncDelta}=require('./selly/sync_delta.cjs');
        for(const s of suppliers)await syncDelta(db,s);
      }
    }catch(e){console.error('[availability] Refresh failed; periodic sync will retry:',e.message);}
    finally{running=false;if(pending.size)request(db,[...pending][0]);}
  });
}
module.exports={request};
