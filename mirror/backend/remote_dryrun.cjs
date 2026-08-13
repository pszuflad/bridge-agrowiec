const Database=require("better-sqlite3");
const fs=require("fs");
const db=new Database("/home/admin/private_apps/bridge/data.db",{readonly:true});
const info=JSON.parse(fs.readFileSync("/home/admin/private_apps/bridge/kody_rozbicie.json","utf8"));
const plan=JSON.parse(fs.readFileSync("/home/admin/private_apps/bridge/plan_polaczony.json","utf8"));

const byPair=db.prepare("SELECT id,kod,kod_dostawcy,dostawca,kod_importu,nazwa FROM products WHERE dostawca=? AND kod_dostawcy=?");
const byKodFull=db.prepare("SELECT id,kod,kod_dostawcy,dostawca,kod_importu,nazwa FROM products WHERE kod=?");

function rowsFor(kodPliku){
  const arr=info[kodPliku]; const {dost,czysty}=arr[0];
  let rows=byPair.all(dost,czysty);
  if(!rows.length) rows=byKodFull.all(dost+"_"+czysty);
  if(!rows.length) rows=byKodFull.all(kodPliku);
  return rows;
}

let nRows=0, chgKi=0, chgNazwa=0, both=0, none=0;
const zmiany=[];
for(const [kodPliku,[nowyKi,nowaNazwa]] of Object.entries(plan)){
  for(const r of rowsFor(kodPliku)){
    nRows++;
    const dKi = String(r.kod_importu||"")!==String(nowyKi);
    const dNa = String(r.nazwa||"")!==String(nowaNazwa);
    if(dKi) chgKi++;
    if(dNa) chgNazwa++;
    if(dKi&&dNa) both++;
    if(!dKi&&!dNa) none++;
    if(dKi||dNa) zmiany.push({id:r.id,kod:r.kod,dost:r.dostawca,
      ki_old:r.kod_importu,ki_new:nowyKi,ki_zmiana:dKi,
      nazwa_old:r.nazwa,nazwa_new:nowaNazwa,nazwa_zmiana:dNa});
  }
}
console.log("Wierszy dopasowanych w bazie:", nRows);
console.log("Zmiana kod_importu:", chgKi);
console.log("Zmiana nazwy:", chgNazwa);
console.log("Bez zmian:", none);
console.log("Przyklady zmian kod_importu:");
zmiany.filter(z=>z.ki_zmiana).slice(0,8).forEach(z=>
  console.log(`  id=${z.id} ${z.dost} ${z.kod}: KI ${z.ki_old} -> ${z.ki_new}`));
fs.writeFileSync("/home/admin/private_apps/bridge/dryrun_zmiany.json", JSON.stringify(zmiany,null,1));
console.log("Zapisano dryrun_zmiany.json, pozycji:", zmiany.length);
db.close();
