const Database=require("better-sqlite3");
const fs=require("fs");
const db=new Database("/home/admin/private_apps/bridge/data.db",{readonly:true});
const info=JSON.parse(fs.readFileSync("/home/admin/private_apps/bridge/kody_rozbicie.json","utf8"));

// dopasowanie po (dostawca, kod_dostawcy=czysty)
const byPair=db.prepare("SELECT id,kod,kod_dostawcy,dostawca,kod_importu,nazwa FROM products WHERE dostawca=? AND kod_dostawcy=?");
const byKodFull=db.prepare("SELECT id,kod,kod_dostawcy,dostawca,kod_importu,nazwa FROM products WHERE kod=?");
let hitPair=0, hitKod=0, brak=[];
const res={};
for(const [kodPliku, arr] of Object.entries(info)){
  const {dost,czysty}=arr[0];
  let rows=byPair.all(dost,czysty);
  let via="pair";
  if(rows.length===0){
    // fallback: kolumna kod = DOST_czysty
    rows=byKodFull.all(dost+"_"+czysty); via="kod_underscore";
  }
  if(rows.length===0){
    rows=byKodFull.all(kodPliku); via="kod_raw";
  }
  if(rows.length){ (via==="pair"?hitPair++:hitKod++); res[kodPliku]={via,ids:rows.map(r=>r.id),ki:rows.map(r=>r.kod_importu)}; }
  else brak.push(kodPliku);
}
console.log("Dopasowanych przez (dostawca,kod_dostawcy):", hitPair);
console.log("Dopasowanych fallbackiem (kod):", hitKod);
console.log("Brak:", brak.length, brak.slice(0,15).join(", "));
// sprawdz spojnosc: czy kod_importu w bazie zgadza sie z tym co mielismy z CSV?
db.close();
