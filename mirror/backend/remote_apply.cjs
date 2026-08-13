const Database=require("better-sqlite3");
const fs=require("fs");
const DB="/home/admin/private_apps/bridge/data.db";
const APP="/home/admin/private_apps/bridge";
const info=JSON.parse(fs.readFileSync(APP+"/kody_rozbicie.json","utf8"));
const plan=JSON.parse(fs.readFileSync(APP+"/plan_polaczony.json","utf8"));

// 1) BACKUP spojny (VACUUM INTO) - regula WAL
const ts=new Date().toISOString().replace(/[-:T]/g,"").slice(0,14); // YYYYMMDDHHMMSS
const bak=`${DB}.bak_full_pre_scalanie_partie_${ts}`;
{
  const dbb=new Database(DB);
  dbb.exec(`VACUUM INTO '${bak}'`);
  dbb.close();
}
console.log("BACKUP:", bak, "->", fs.existsSync(bak)?("OK "+fs.statSync(bak).size+" B"):"BRAK!");

// 2) UPDATE w transakcji
const db=new Database(DB);
const byPair=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE dostawca=? AND kod_dostawcy=?");
const byKodFull=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE kod=?");
const upd=db.prepare("UPDATE products SET kod_importu=?, nazwa=? WHERE id=?");

function rowsFor(kodPliku){
  const {dost,czysty}=info[kodPliku][0];
  let rows=byPair.all(dost,czysty);
  if(!rows.length) rows=byKodFull.all(dost+"_"+czysty);
  if(!rows.length) rows=byKodFull.all(kodPliku);
  return rows;
}

let updKi=0, updNa=0, touched=0;
const audit=[];
const tx=db.transaction(()=>{
  for(const [kodPliku,[nowyKi,nowaNazwa]] of Object.entries(plan)){
    for(const r of rowsFor(kodPliku)){
      const dKi=String(r.kod_importu||"")!==String(nowyKi);
      const dNa=String(r.nazwa||"")!==String(nowaNazwa);
      if(dKi||dNa){
        upd.run(String(nowyKi), String(nowaNazwa), r.id);
        touched++;
        if(dKi) updKi++;
        if(dNa) updNa++;
        audit.push({id:r.id,ki_old:r.kod_importu,ki_new:nowyKi,nazwa_old:r.nazwa,nazwa_new:nowaNazwa});
      }
    }
  }
});
tx();
console.log("Zaktualizowano wierszy:", touched, "| zmiana KI:", updKi, "| zmiana nazwy:", updNa);

// 3) checkpoint WAL do glownego pliku
db.pragma("wal_checkpoint(TRUNCATE)");
db.close();
fs.writeFileSync(APP+`/audit_scalanie_partie_${ts}.json`, JSON.stringify(audit,null,1));
console.log("AUDIT zapisany: audit_scalanie_partie_"+ts+".json ("+audit.length+" zmian)");
console.log("GOTOWE");
