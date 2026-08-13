const Database=require("better-sqlite3");
const fs=require("fs");
const db=new Database("/home/admin/private_apps/bridge/data.db",{readonly:true});
const kody=JSON.parse(fs.readFileSync("/home/admin/private_apps/bridge/wszystkie_kody_partii.json","utf8"));

function variants(k){
  // prefiks MO<num> + reszta
  const m=k.match(/^(MO\d+)(.*)$/);
  const v=[k];
  if(m){
    v.push(m[1]+"_"+m[2]);           // MO5_TRRD...
    v.push(m[1].toLowerCase()+"_"+m[2]);
  }
  return v;
}
const byKod=db.prepare("SELECT id,kod,kod_dostawcy,dostawca,kod_importu,nazwa FROM products WHERE kod=?");
let hit=0, brak=[], multi=0;
const trafienia={};
for(const k of kody){
  let found=null;
  for(const v of variants(k)){
    const rows=byKod.all(v);
    if(rows.length){ found={v,rows}; break; }
  }
  if(found){ hit++; trafienia[k]=found; }
  else brak.push(k);
}
console.log("Dopasowanych przez kolumne kod (z wariantem _):", hit, "/", kody.length);
console.log("Brak:", brak.length);
if(brak.length) console.log("Przyklady brakow:", brak.slice(0,15).join(", "));
const ex=Object.keys(trafienia)[0];
console.log("Przyklad:", ex, "-> wariant", trafienia[ex].v, "->", JSON.stringify(trafienia[ex].rows).slice(0,250));
db.close();
