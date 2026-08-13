const Database=require("better-sqlite3");
const fs=require("fs");
const db=new Database("/home/admin/private_apps/bridge/data.db",{readonly:true});
const kody=JSON.parse(fs.readFileSync("/home/admin/private_apps/bridge/wszystkie_kody_partii.json","utf8"));

let znal=0, brak=[];
const stmt=db.prepare("SELECT id,kod,kod_dostawcy,nazwa,kod_importu,dostawca FROM products WHERE kod_dostawcy=?");
const mapa={};
for(const k of kody){
  const rows=stmt.all(k);
  if(rows.length===0){ brak.push(k); }
  else { znal++; mapa[k]=rows.map(r=>({id:r.id,dostawca:r.dostawca,ki:r.kod_importu,nazwa:r.nazwa})); }
}
console.log("Kodow w pliku:", kody.length);
console.log("Znalezionych w bazie (kod_dostawcy):", znal);
console.log("Brakujacych:", brak.length);
if(brak.length) console.log("BRAK:", brak.slice(0,20).join(", "));
// przyklad
const ex=kody.find(k=>mapa[k]);
console.log("Przyklad dopasowania", ex, "->", JSON.stringify(mapa[ex]).slice(0,300));
db.close();
