const D=require('better-sqlite3');
const db=new D('/home/admin/private_apps/bridge/data.db',{readonly:true});

// 1) Grupy: ten sam prefiks numeryczny/nazwa, rozne warianty (333 vs 333 FORESTRY)
// Zbierzmy wszystkie unikalne bieznik + dostawca + licznik
const rows = db.prepare("SELECT bieznik, model, dostawca, marka, COUNT(*) c FROM products WHERE bieznik IS NOT NULL AND bieznik<>'' GROUP BY bieznik, dostawca ORDER BY bieznik").all();
console.log('unikalnych (bieznik,dostawca):', rows.length);

// 2) Wykryj pary gdzie jeden bieznik jest prefiksem drugiego (np "333" i "333 FORESTRY")
const byMarka = {};
for(const r of rows){
  const key = r.marka||'?';
  (byMarka[key] = byMarka[key]||[]).push(r);
}
console.log('\n=== POTENCJALNE DUBLE: krotki wariant jest prefiksem dluzszego (ta sama marka) ===');
let pairCount=0;
for(const marka in byMarka){
  const list = byMarka[marka].map(x=>x.bieznik);
  const uniq = [...new Set(list)];
  for(const a of uniq){
    for(const b of uniq){
      if(a!==b && b.startsWith(a+' ') && /^[A-Z0-9\-]+$/.test(a)){
        // a krotki (np "333"), b dluzszy (np "333 FORESTRY")
        console.log(`  [${marka}] "${a}"  <->  "${b}"`);
        pairCount++;
      }
    }
  }
}
console.log('par (prefiks):', pairCount);

// 3) Niespójny separator: IM-03 vs IM03, IMP 99 vs IMP-01
// Znormalizuj: usun myslniki/spacje/zera wiodace w segmencie numerycznym i grupuj
console.log('\n=== NIESPOJNY SEPARATOR / ZERA (ta sama marka) ===');
function norm(s){ return s.toUpperCase().replace(/[\s\-]+/g,'').replace(/([A-Z]+)0*(\d)/g,'$1$2'); }
const sepGroups={};
for(const r of rows){
  const k = (r.marka||'?')+'||'+norm(r.bieznik);
  (sepGroups[k]=sepGroups[k]||new Set()).add(r.bieznik);
}
let sepCount=0;
for(const k in sepGroups){
  if(sepGroups[k].size>1){
    console.log(`  [${k.split('||')[0]}] warianty: ${[...sepGroups[k]].map(x=>'"'+x+'"').join(' | ')}`);
    sepCount++;
  }
}
console.log('grup z niespojnym separatorem/zerami:', sepCount);
