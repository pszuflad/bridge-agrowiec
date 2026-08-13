const D = require('better-sqlite3');
const db = new D('/home/admin/private_apps/bridge/data.db');
const changes = require('/home/admin/private_apps/bridge/dryrun_bieznik.json');
const now = new Date().toISOString().replace('T',' ').slice(0,19);

const upd = db.prepare("UPDATE products SET bieznik=?, model=? WHERE kod=?");
const hist = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");
const getNazwa = db.prepare("SELECT nazwa FROM products WHERE kod=?");

let cntU=0, cntH=0;
const tx = db.transaction(()=>{
  for(const c of changes){
    const nz = (getNazwa.get(c.kod)||{}).nazwa || '';
    upd.run(c.bieznik_new, c.model_new, c.kod);
    cntU++;
    if(c.bieznik_old !== c.bieznik_new){ hist.run(now,c.kod,nz,'bieznik',c.bieznik_old,c.bieznik_new,'czyszczenie-anomalii','Anna'); cntH++; }
    if(c.model_old !== c.model_new){ hist.run(now,c.kod,nz,'model',c.model_old,c.model_new,'czyszczenie-anomalii','Anna'); cntH++; }
  }
});
tx();
console.log('Zaktualizowano rekordow:', cntU, '| wpisow history:', cntH);

// weryfikacja - sprawdz kilka
const check = ['MO5_LLCZ22531580LWD60','MO5_GSCR19543550JCA41','MO7_T445620','MO5_GFCZ22531580KWRF0','MO5_IMCR22531580L6380'];
console.log('\n=== WERYFIKACJA ===');
for(const k of check){
  const r = db.prepare("SELECT kod,bieznik,model FROM products WHERE kod=?").get(k);
  console.log(`${k}: bieznik="${r.bieznik}" model="${r.model}"`);
}
// sprawdz ze 537S i RIDEMAX nietkniete
for(const k of ['MO5_TRRD040114000T7S0','MO9_37266']){
  const r = db.prepare("SELECT kod,bieznik,model FROM products WHERE kod=?").get(k);
  console.log(`(nietkniete) ${k}: bieznik="${r.bieznik}" model="${r.model}"`);
}
// pozostale anomalie NAPED/dblIdx?
const rem = db.prepare("SELECT COUNT(*) c FROM products WHERE bieznik LIKE '%NAP%D%' OR model LIKE '%NAP%D%'").get();
console.log('\nPozostalo z NAPED:', rem.c);
db.close();
