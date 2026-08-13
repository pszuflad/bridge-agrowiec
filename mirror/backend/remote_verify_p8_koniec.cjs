const Database=require("better-sqlite3");
const fs=require("fs");
const APP="/home/admin/private_apps/bridge";
const db=new Database(APP+"/data.db",{readonly:true});
const info=JSON.parse(fs.readFileSync(APP+"/kody_rozbicie_p8_koniec.json","utf8"));
const plan=JSON.parse(fs.readFileSync(APP+"/plan_p8_koniec.json","utf8"));
function rowsFor(k){const {dost,czysty}=info[k][0];
  let r=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE dostawca=? AND kod_dostawcy=?").all(dost,czysty);
  if(!r.length)r=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE kod=?").all(dost+"_"+czysty);
  if(!r.length)r=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE kod=?").all(k);return r;}
let ok=0,bad=0;
for(const [k,[nk,nn]] of Object.entries(plan)) for(const r of rowsFor(k)){
  if(String(r.kod_importu)===String(nk)&&String(r.nazwa)===String(nn))ok++; else bad++;
}
const grupy={}; for(const [k,[ki]] of Object.entries(plan)) (grupy[ki]=grupy[ki]||[]).push(k);
let g1=0,g0=0;
for(const [ki,ks] of Object.entries(grupy)){const s=new Set();for(const k of ks)for(const r of rowsFor(k))s.add(String(r.kod_importu));(s.size===1&&s.has(String(ki)))?g1++:g0++;}
console.log("OK:",ok,"| niezgodnych:",bad,"| grup spojnych:",g1,"| niespojnych:",g0);
db.close();
