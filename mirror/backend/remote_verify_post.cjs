const Database=require("better-sqlite3");
const fs=require("fs");
const APP="/home/admin/private_apps/bridge";
const db=new Database(APP+"/data.db",{readonly:true});
const info=JSON.parse(fs.readFileSync(APP+"/kody_rozbicie.json","utf8"));
const plan=JSON.parse(fs.readFileSync(APP+"/plan_polaczony.json","utf8"));

const byPair=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE dostawca=? AND kod_dostawcy=?");
const byKodFull=db.prepare("SELECT id,kod_importu,nazwa FROM products WHERE kod=?");
function rowsFor(k){const {dost,czysty}=info[k][0];let r=byPair.all(dost,czysty);if(!r.length)r=byKodFull.all(dost+"_"+czysty);if(!r.length)r=byKodFull.all(k);return r;}

let ok=0, bad=0; const errs=[];
for(const [k,[nowyKi,nowaNazwa]] of Object.entries(plan)){
  for(const r of rowsFor(k)){
    if(String(r.kod_importu)===String(nowyKi) && String(r.nazwa)===String(nowaNazwa)) ok++;
    else { bad++; if(errs.length<10) errs.push({id:r.id,ki:r.kod_importu,exp:nowyKi}); }
  }
}
console.log("Zweryfikowanych OK:", ok, "| niezgodnych:", bad);
if(errs.length) console.log("Niezgodnosci:", JSON.stringify(errs));

// sprawdz spojnosc grup: kazda grupa z planu ma teraz JEDEN kod_importu wsrod swoich pozycji
// grupuj kody planu po docelowym KI
const grupy={};
for(const [k,[ki]] of Object.entries(plan)){ (grupy[ki]=grupy[ki]||[]).push(k); }
let grpOK=0, grpBad=0;
for(const [ki,kody] of Object.entries(grupy)){
  const kiSet=new Set();
  for(const k of kody) for(const r of rowsFor(k)) kiSet.add(String(r.kod_importu));
  if(kiSet.size===1 && kiSet.has(String(ki))) grpOK++; else grpBad++;
}
console.log("Grup docelowych KI spojnych (1 kod_importu):", grpOK, "| niespojnych:", grpBad);
db.close();
