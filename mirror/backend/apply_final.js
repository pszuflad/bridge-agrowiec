const fs=require("fs");
const Database=require("better-sqlite3");
const {packageDims}=require("./tire_dims.js");

// Fresh backup of CURRENT state (post-import, 6018 rows)
const ts=new Date().toISOString().replace(/[-:T]/g,"").slice(0,14);
const bak=`data.db.bak_before_dims_final_${ts}`;
fs.copyFileSync("data.db",bak);
console.log("BACKUP:",bak);

const db=new Database("data.db");
const cols=db.prepare("PRAGMA table_info(products)").all().map(c=>c.name);
if(!cols.includes("wysokosc_przesylki")){
  db.prepare("ALTER TABLE products ADD COLUMN wysokosc_przesylki REAL").run();
  console.log("column added");
}

const rows=db.prepare("SELECT id,rozmiar FROM products").all();
console.log("rows to process:",rows.length);
const upd=db.prepare("UPDATE products SET wysokosc=?, szerokosc=?, dlugosc=?, szerokosc_paczki=?, wysokosc_przesylki=? WHERE id=?");
let ok=0,fail=0,failSamples=[];
const tx=db.transaction(()=>{
  for(const r of rows){
    const pd=packageDims(r.rozmiar);
    if(!pd){ fail++; if(failSamples.length<20) failSamples.push(r.rozmiar); continue; }
    const info=upd.run(pd.wysokosc,pd.szerokosc,pd.dlugosc,pd.szerokosc_paczki,pd.wysokosc_przesylki,r.id);
    if(info.changes===1) ok++; else fail++;
  }
});
tx();
console.log("UPDATED:",ok,"FAIL:",fail,"failSamples:",JSON.stringify(failSamples));
db.pragma("wal_checkpoint(TRUNCATE)");
db.close();

// verify fresh
const db2=new Database("data.db");
const total=db2.prepare("SELECT COUNT(*) c FROM products").get().c;
const consistent=db2.prepare("SELECT COUNT(*) c FROM products WHERE dlugosc=wysokosc AND wysokosc=CAST(wysokosc AS INT) AND wysokosc IS NOT NULL").get().c;
const decWys=db2.prepare("SELECT COUNT(*) c FROM products WHERE wysokosc<>CAST(wysokosc AS INT)").get().c;
console.log("total:",total,"consistent(dlug=wys=int):",consistent,"still-decimal-wys:",decWys);
const s=db2.prepare("SELECT rozmiar,wysokosc,szerokosc,dlugosc,szerokosc_paczki,wysokosc_przesylki FROM products WHERE rozmiar IN ('315/60R22.5','30.5L-32','23x9-10','80-15','14.00R32') LIMIT 5").all();
console.log("samples:",JSON.stringify(s));
db2.close();
