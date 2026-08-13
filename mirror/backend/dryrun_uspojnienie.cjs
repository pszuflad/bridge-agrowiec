const D=require('better-sqlite3');
const db=new D('data.db',{readonly:true});
const fs=require('fs');

const norm=s=>(s||'').toUpperCase().replace(/\s+/g,' ').trim();
const squash=s=>(s||'').toUpperCase().replace(/[\s\-.]/g,'');

// pobierz wszystkie produkty z niepustym bieznik/model
const rows=db.prepare("SELECT kod,nazwa,marka,model,bieznik FROM products WHERE (bieznik IS NOT NULL AND bieznik!='') OR (model IS NOT NULL AND model!='')").all();

// GRUPA A: model != bieznik -> model:=bieznik
const grupaA=[];
// GRUPA B: bieznik nie w nazwie -> podmien segment
const grupaB=[];
const grupaB_nieudane=[];

// funkcja: sprobuj podmienic w nazwie segment odpowiadajacy staremu modelowi na docelowy bieznik
function podmienWNazwie(nazwa, marka, staryModel, docelBieznik){
  // strategia: znajdz pozycje marki w nazwie; model wystepuje zaraz po marce
  // Bezpieczniej: sprawdz kilka kandydatow starego segmentu i zamien pierwszy trafiony
  const kandydaci=[staryModel];
  // czasem nazwa ma model bez ostatniego slowa (np. bieznik 'AGRIMAX RT 855 E' a nazwa 'AGRIMAX RT 855')
  // sprobuj tez docelowy bez sufiksu ' E'
  const bezE=docelBieznik.replace(/\sE$/,'').replace(/\sED$/,'');
  kandydaci.push(bezE);
  // model po squash
  for(const k of kandydaci){
    if(!k) continue;
    // dopasowanie case-insensitive z granica slowa
    const re=new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
    if(re.test(nazwa)){
      const nowa=nazwa.replace(re, docelBieznik);
      if(nowa!==nazwa) return nowa;
    }
  }
  return null;
}

for(const r of rows){
  const nN=norm(r.nazwa), nNsq=squash(r.nazwa);
  const b=r.bieznik||'', m=r.model||'';
  // GRUPA A
  if(b && m && b!==m){
    grupaA.push({kod:r.kod,model_old:m,model_new:b});
  }
  // GRUPA B: bieznik nie w nazwie
  if(b && !norm(nN).includes(norm(b)) && !nNsq.includes(squash(b))){
    const nowa=podmienWNazwie(r.nazwa, r.marka, m, b);
    if(nowa) grupaB.push({kod:r.kod,marka:r.marka,bieznik:b,model:m,nazwa_old:r.nazwa,nazwa_new:nowa});
    else grupaB_nieudane.push({kod:r.kod,marka:r.marka,bieznik:b,model:m,nazwa:r.nazwa});
  }
}

console.log('=== DRY-RUN USPOJNIENIE ===');
console.log('GRUPA A (model:=bieznik):',grupaA.length);
console.log('GRUPA B (nazwa podmieniona automatycznie):',grupaB.length);
console.log('GRUPA B NIEUDANE (nie znaleziono segmentu):',grupaB_nieudane.length);
console.log('\n--- GRUPA B: przyklady udanej podmiany (20) ---');
grupaB.slice(0,20).forEach(r=>console.log(`  ${r.kod}\n    STARA: ${r.nazwa_old}\n    NOWA:  ${r.nazwa_new}`));
console.log('\n--- GRUPA B NIEUDANE (30) ---');
grupaB_nieudane.slice(0,30).forEach(r=>console.log(`  ${r.kod} | bieznik='${r.bieznik}' model='${r.model}' | nazwa="${r.nazwa}"`));

fs.writeFileSync('plan_uspojnienie.json',JSON.stringify({grupaA,grupaB,grupaB_nieudane},null,1));
console.log('\nzapisano plan_uspojnienie.json');
db.close();
