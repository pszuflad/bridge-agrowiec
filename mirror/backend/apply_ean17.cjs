// Wdrozenie 14 EAN dla produktow bez EAN (17 pozycji, 3 bez kodu pominiete).
// Zapis na sztywno: ean, ean_raw, ean_is_valid, ean_source_status='memory'.
// DRY-RUN domyslnie; --apply zeby zapisac.
const path = require('path');
const Database = require('better-sqlite3');
const DB = '/home/admin/private_apps/bridge/data.db';
const MEM = '/home/admin/private_apps/bridge/ean_memory.json';
const APPLY = process.argv.includes('--apply');

const mem = require(MEM);
// 14 kodow, ktore chcemy wdrozyc teraz (podzbior pamieci)
const KEYS = [
 'MO3_2708036MIT','MO3_4608534ma2demo','MO3_5406530Mdemo','MO3_6007030ademo',
 'MO3_6207042fidemo','MO3_7107542TR900demo','MO4_BFPR250G75000MBT0',
 'MO4_BFPR250G23000MBT0','MO4_DCPR250H4000ERM80','MO5_LLCR17526570MKLS3',
 'MO3_1657018fqh63818','MO3_31560225dd','MO3_38565225b','MO5_MCRD160E60006AS70'
];

function eanValid(e){
  if(!/^\d{13}$/.test(e)) return false;
  let s=0; for(let i=0;i<12;i++){ s += (i%2? 3:1)*parseInt(e[i],10); }
  return ((10-(s%10))%10) === parseInt(e[12],10);
}

const db = new Database(DB);
const get = db.prepare('SELECT kod, nazwa, ean, ean_source_status FROM products WHERE kod = ?');
const upd = db.prepare("UPDATE products SET ean=?, ean_raw=?, ean_is_valid=?, ean_source_status='memory' WHERE kod=?");

let plan=[], skip=[];
for(const k of KEYS){
  const ean = mem[k];
  if(!ean){ skip.push([k,'brak w pamieci']); continue; }
  const row = get.get(k);
  if(!row){ skip.push([k,'brak w bazie']); continue; }
  const valid = eanValid(ean) ? 1 : 0;
  plan.push({kod:k, nazwa:row.nazwa, ean_stary:row.ean||'(puste)', ean_nowy:ean, valid});
}

console.log('=== PLAN (' + (APPLY?'APPLY':'DRY-RUN') + ') ===');
for(const p of plan){
  console.log(`${p.valid? 'OK ':'INV'} ${p.kod}  ${p.ean_stary} -> ${p.ean_nowy}  | ${p.nazwa}`);
}
if(skip.length){ console.log('--- POMINIETE ---'); skip.forEach(s=>console.log(s.join(' : '))); }
console.log(`Do wdrozenia: ${plan.length}, pominietych: ${skip.length}`);

if(APPLY){
  const tx = db.transaction(()=>{
    for(const p of plan){ upd.run(p.ean_nowy, p.ean_nowy, p.valid, p.kod); }
  });
  tx();
  console.log('=== ZAPISANO ' + plan.length + ' EAN ===');
  // weryfikacja
  let ok=0;
  for(const p of plan){ const r=get.get(p.kod); if(r.ean===p.ean_nowy && r.ean_source_status==='memory') ok++; }
  console.log('Zweryfikowano po zapisie: ' + ok + '/' + plan.length);
}
db.close();
