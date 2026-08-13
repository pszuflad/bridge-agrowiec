const D = require('better-sqlite3');
const db = new D('/home/admin/private_apps/bridge/data.db', { readonly: true });
const kods = ["MO9_37266","MO5_TRRD040114000T7S0","MO5_LLCZ22531580LWD60","MO5_LLCR22531580LETD1","MO5_LLCR22531570LD360","MO5_IMCR22531580L6380","MO5_GSCR19543550JCA41","MO2_24865900","MO2_24846800","MO1_10007509","MO7_T445796","MO7_T445620","MO5_LLCR22531570LRD30"];
for (const k of kods){
  const r = db.prepare("SELECT kod,dostawca,marka,model,bieznik,rozmiar,indeks_nosnosci,indeks_predkosci,indeksy,indeks_1,indeks_2,nazwa FROM products WHERE kod=?").get(k);
  if(!r){console.log(k,'BRAK');continue;}
  console.log(`\n[${r.dostawca}] ${r.kod}`);
  console.log(`  marka="${r.marka}" model="${r.model}" bieznik="${r.bieznik}"`);
  console.log(`  rozmiar="${r.rozmiar}" LI="${r.indeks_nosnosci}" SI="${r.indeks_predkosci}" indeksy="${r.indeksy}" i1="${r.indeks_1}" i2="${r.indeks_2}"`);
  console.log(`  nazwa="${r.nazwa}"`);
}
