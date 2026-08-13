// Apply kod->link into products.link_zdjecia by kod. Backup first, then update, then checkpoint.
const fs=require('fs');
const Database=require('better-sqlite3');
const DBP='/home/admin/private_apps/bridge/data.db';
const map=JSON.parse(fs.readFileSync('/home/admin/private_apps/bridge/kod_link_map.json','utf8'));

// backup
const ts=new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
const bak=DBP+'.bak_before_links_'+ts;
fs.copyFileSync(DBP,bak);
try{fs.copyFileSync(DBP+'-wal',bak+'-wal');}catch{}
try{fs.copyFileSync(DBP+'-shm',bak+'-shm');}catch{}
console.log("BACKUP:",bak);

const db=new Database(DBP);
const before=db.prepare("SELECT COUNT(*) c FROM products WHERE link_zdjecia IS NOT NULL AND link_zdjecia<>''").get().c;
console.log("products with link BEFORE:",before);

const sel=db.prepare("SELECT id, link_zdjecia FROM products WHERE kod=?");
const upd=db.prepare("UPDATE products SET link_zdjecia=? WHERE kod=?");
let updated=0, filled=0, overwritten=0, samed=0, missing=0;
const tx=db.transaction(()=>{
  for(const kod of Object.keys(map)){
    const row=sel.get(kod);
    if(!row){ missing++; continue; }
    const cur=row.link_zdjecia||'';
    const nw=map[kod];
    if(cur===nw){ samed++; continue; }
    upd.run(nw, kod);
    updated++;
    if(!cur) filled++; else overwritten++;
  }
});
tx();
console.log("UPDATED rows:",updated," (filled:",filled," overwritten:",overwritten,") | same-skip:",samed," | missing:",missing);

db.pragma("wal_checkpoint(TRUNCATE)");
const after=db.prepare("SELECT COUNT(*) c FROM products WHERE link_zdjecia IS NOT NULL AND link_zdjecia<>''").get().c;
console.log("products with link AFTER:",after," (delta +"+(after-before)+")");

// samples
const s=db.prepare("SELECT kod,nazwa,link_zdjecia FROM products WHERE kod IN ('MO86404800','MO811146800','MO811681000')").all();
console.log("SAMPLES:", JSON.stringify(s,null,1));
db.close();
console.log("DONE");
