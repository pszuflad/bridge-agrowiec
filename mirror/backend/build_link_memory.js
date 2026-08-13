// Create persistent link-memory tables and populate from file + existing product links.
const fs=require('fs');
const Database=require('better-sqlite3');
const DBP='/home/admin/private_apps/bridge/data.db';
const mem=JSON.parse(fs.readFileSync('/home/admin/private_apps/bridge/link_memory.json','utf8'));

// backup
const ts=new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
const bak=DBP+'.bak_before_linkmem_'+ts;
fs.copyFileSync(DBP,bak);
try{fs.copyFileSync(DBP+'-wal',bak+'-wal')}catch{}
try{fs.copyFileSync(DBP+'-shm',bak+'-shm')}catch{}
console.log("BACKUP:",bak);

const db=new Database(DBP);
db.exec(`CREATE TABLE IF NOT EXISTS link_pamiec_kod (kod TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);
CREATE TABLE IF NOT EXISTS link_pamiec_mr (mrkey TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);`);

const now=new Date().toISOString();
const upKod=db.prepare("INSERT INTO link_pamiec_kod(kod,link,updated_at) VALUES(?,?,?) ON CONFLICT(kod) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at");
const upMr =db.prepare("INSERT INTO link_pamiec_mr(mrkey,link,updated_at) VALUES(?,?,?) ON CONFLICT(mrkey) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at");

const norm=s=>s==null?'':String(s).replace(/\s+/g,' ').trim().toUpperCase();

let ck=0, cm=0;
const tx=db.transaction(()=>{
  for(const [kod,link] of Object.entries(mem.by_kod)){ upKod.run(kod,link,now); ck++; }
  for(const [mr,link] of Object.entries(mem.by_mr)){ upMr.run(mr,link,now); cm++; }
  // ALSO seed by_kod from existing product links not present in file (don't lose current links)
  const rows=db.prepare("SELECT kod, marka, model, rozmiar, link_zdjecia FROM products WHERE link_zdjecia IS NOT NULL AND link_zdjecia<>''").all();
  let seededK=0;
  for(const r of rows){
    if(r.kod && !mem.by_kod[r.kod]){ upKod.run(r.kod, r.link_zdjecia, now); seededK++; }
  }
  console.log("seeded from existing product codes (not in file):",seededK);
});
tx();
db.pragma("wal_checkpoint(TRUNCATE)");
console.log("link_pamiec_kod rows:", db.prepare("SELECT COUNT(*) c FROM link_pamiec_kod").get().c);
console.log("link_pamiec_mr rows:", db.prepare("SELECT COUNT(*) c FROM link_pamiec_mr").get().c);
db.close();
console.log("DONE inserted kod:",ck," mr:",cm);
