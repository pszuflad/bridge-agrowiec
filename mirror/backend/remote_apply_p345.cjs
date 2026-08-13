const Database=require("better-sqlite3");
const fs=require("fs");
const DB="/home/admin/private_apps/bridge/data.db";
const APP="/home/admin/private_apps/bridge";
const info=JSON.parse(fs.readFileSync(APP+"/kody_rozbicie_p345.json","utf8"));
const plan=JSON.parse(fs.readFileSync(APP+"/plan_p345.json","utf8"));
const DRY = process.argv.includes("--dry");

function rowsFor(db,kodPliku){
  const {dost,czysty}=info[kodPliku][0];
  let rows=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE dostawca=? AND kod_dostawcy=?").all(dost,czysty);
  if(!rows.length) rows=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE kod=?").all(dost+"_"+czysty);
  if(!rows.length) rows=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE kod=?").all(kodPliku);
  return rows;
}

// dopasowanie
{
  const db=new Database(DB,{readonly:true});
  let brak=[];
  for(const k of Object.keys(plan)) if(rowsFor(db,k).length===0) brak.push(k);
  console.log("Dopasowanie: kodow", Object.keys(plan).length, "| brak", brak.length, brak.slice(0,10).join(", "));
  db.close();
}

if(DRY){
  const db=new Database(DB,{readonly:true});
  let ki=0,na=0,rows=0;
  for(const [k,[nk,nn]] of Object.entries(plan)) for(const r of rowsFor(db,k)){
    rows++; if(String(r.kod_importu||"")!==String(nk))ki++; if(String(r.nazwa||"")!==String(nn))na++;
  }
  console.log("DRY: wierszy",rows,"| zmiana KI",ki,"| zmiana nazwy",na);
  db.close();
  process.exit(0);
}

// BACKUP
const ts=new Date().toISOString().replace(/[-:T]/g,"").slice(0,14);
const bak=`${DB}.bak_full_pre_scalanie_p345_${ts}`;
{ const dbb=new Database(DB); dbb.exec(`VACUUM INTO '${bak}'`); dbb.close(); }
console.log("BACKUP:", bak, fs.existsSync(bak)?"OK":"BRAK!");

const db=new Database(DB);
const upd=db.prepare("UPDATE products SET kod_importu=?, nazwa=? WHERE id=?");
let touched=0,updKi=0,updNa=0; const audit=[];
db.transaction(()=>{
  for(const [k,[nk,nn]] of Object.entries(plan)) for(const r of rowsFor(db,k)){
    const dKi=String(r.kod_importu||"")!==String(nk), dNa=String(r.nazwa||"")!==String(nn);
    if(dKi||dNa){ upd.run(String(nk),String(nn),r.id); touched++; if(dKi)updKi++; if(dNa)updNa++;
      audit.push({id:r.id,ki_old:r.kod_importu,ki_new:nk,nazwa_old:r.nazwa,nazwa_new:nn}); }
  }
})();
db.pragma("wal_checkpoint(TRUNCATE)");
db.close();
fs.writeFileSync(APP+`/audit_scalanie_p345_${ts}.json`, JSON.stringify(audit,null,1));
console.log("Zaktualizowano:",touched,"| KI:",updKi,"| nazwa:",updNa,"| audit: audit_scalanie_p345_"+ts+".json");
console.log("GOTOWE");
