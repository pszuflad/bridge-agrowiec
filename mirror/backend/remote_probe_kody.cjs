const Database=require("better-sqlite3");
const fs=require("fs");
const db=new Database("/home/admin/private_apps/bridge/data.db",{readonly:true});
const kody=JSON.parse(fs.readFileSync("/home/admin/private_apps/bridge/wszystkie_kody_partii.json","utf8"));

// sprawdz kilka kolumn kandydujacych
const cols=["kod","kod_dostawcy","sku"];
for(const col of cols){
  const stmt=db.prepare(`SELECT COUNT(*) c FROM products WHERE ${col}=?`);
  let hit=0;
  for(const k of kody){ if(stmt.get(k).c>0) hit++; }
  console.log(`Kolumna ${col}: dopasowanych ${hit}/${kody.length}`);
}
// czy kod zawiera podkreslnik? probka wartosci kod vs kod_dostawcy
const rows=db.prepare("SELECT kod,kod_dostawcy,dostawca FROM products LIMIT 8").all();
console.log("PROBKA kod / kod_dostawcy:");
rows.forEach(r=>console.log("  kod=",r.kod," | kod_dostawcy=",r.kod_dostawcy," | dost=",r.dostawca));
// czy MO115211664 wystepuje gdziekolwiek jako fragment kolumny kod?
const k0=kody[0];
const like=db.prepare("SELECT kod,kod_dostawcy,dostawca,nazwa FROM products WHERE kod LIKE ? OR kod_dostawcy LIKE ? LIMIT 5").all("%"+k0.replace(/^MO\d+/,"")+"%","%"+k0+"%");
console.log("Szukam fragmentu",k0,"->",JSON.stringify(like).slice(0,400));
db.close();
