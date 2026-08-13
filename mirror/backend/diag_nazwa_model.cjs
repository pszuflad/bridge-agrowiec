const D=require('better-sqlite3');
const db=new D('data.db',{readonly:true});
const fs=require('fs');

// normalizacja do porownania: upper, usun wielokrotne spacje, trim
const norm=s=>(s||'').toUpperCase().replace(/\s+/g,' ').trim();
// wersja "zbita" bez spacji i myslnikow (do wykrycia roznic separatorowych)
const squash=s=>(s||'').toUpperCase().replace(/[\s\-]/g,'');

const rows=db.prepare("SELECT kod,nazwa,marka,model,bieznik FROM products WHERE (bieznik IS NOT NULL AND bieznik!='') OR (model IS NOT NULL AND model!='')").all();

let bieznikNieWNazwie=[], modelNieWNazwie=[], modelBieznikRozne=[];
for(const r of rows){
  const nN=norm(r.nazwa), nNsq=squash(r.nazwa);
  const b=norm(r.bieznik), bsq=squash(r.bieznik);
  const m=norm(r.model), msq=squash(r.model);
  // bieznik nie wystepuje w nazwie (ani dokladnie, ani po zbiciu separatorow)
  if(b && !nN.includes(b) && !nNsq.includes(bsq)){
    bieznikNieWNazwie.push({kod:r.kod,nazwa:r.nazwa,marka:r.marka,bieznik:r.bieznik,model:r.model});
  }
  if(m && !nN.includes(m) && !nNsq.includes(msq)){
    modelNieWNazwie.push({kod:r.kod,nazwa:r.nazwa,marka:r.marka,model:r.model,bieznik:r.bieznik});
  }
  // model != bieznik (moze wskazywac ze jedno zaktualizowane a drugie nie)
  if(b && m && b!==m){
    modelBieznikRozne.push({kod:r.kod,nazwa:r.nazwa,marka:r.marka,model:r.model,bieznik:r.bieznik});
  }
}
console.log('=== DIAGNOZA ROZJAZDU nazwa vs bieznik/model ===');
console.log('bieznik NIE w nazwie:', bieznikNieWNazwie.length);
console.log('model NIE w nazwie:', modelNieWNazwie.length);
console.log('model != bieznik:', modelBieznikRozne.length);

console.log('\n--- bieznik NIE w nazwie (pierwsze 30) ---');
bieznikNieWNazwie.slice(0,30).forEach(r=>console.log(`  ${r.kod} | marka=${r.marka} | bieznik='${r.bieznik}' | nazwa="${r.nazwa}"`));

console.log('\n--- model != bieznik (pierwsze 20) ---');
modelBieznikRozne.slice(0,20).forEach(r=>console.log(`  ${r.kod} | model='${r.model}' | bieznik='${r.bieznik}' | nazwa="${r.nazwa}"`));

fs.writeFileSync('diag_nazwa_model.json',JSON.stringify({bieznikNieWNazwie,modelNieWNazwie,modelBieznikRozne},null,1));
console.log('\nzapisano diag_nazwa_model.json');
db.close();
