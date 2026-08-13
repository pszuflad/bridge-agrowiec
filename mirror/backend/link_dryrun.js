// DRY RUN: report how many kod->link pairs match existing products. No writes.
const fs=require('fs');
const Database=require('better-sqlite3');
const map=JSON.parse(fs.readFileSync('/home/admin/private_apps/bridge/kod_link_map.json','utf8'));
const db=new Database('/home/admin/private_apps/bridge/data.db',{readonly:true});
const codes=Object.keys(map);
let matched=0, missing=0, alreadySame=0, alreadyDiff=0, empty=0;
const sel=db.prepare("SELECT id, link_zdjecia FROM products WHERE kod=?");
const missingCodes=[];
for(const kod of codes){
  const row=sel.get(kod);
  if(!row){ missing++; if(missingCodes.length<15) missingCodes.push(kod); continue; }
  matched++;
  const cur=row.link_zdjecia;
  if(!cur) empty++;
  else if(cur===map[kod]) alreadySame++;
  else alreadyDiff++;
}
console.log("kod->link pairs:", codes.length);
console.log("matched existing product:", matched);
console.log("NOT found in products:", missing);
console.log("  of matched -> currently empty link:", empty);
console.log("  of matched -> already same link:", alreadySame);
console.log("  of matched -> already DIFFERENT link (would overwrite):", alreadyDiff);
console.log("sample missing codes:", JSON.stringify(missingCodes));
// products total & how many have any link now
console.log("products total:", db.prepare("SELECT COUNT(*) c FROM products").get().c);
console.log("products with link now:", db.prepare("SELECT COUNT(*) c FROM products WHERE link_zdjecia IS NOT NULL AND link_zdjecia<>''").get().c);
db.close();
