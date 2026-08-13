const D=require('better-sqlite3'); const fs=require('fs');
const db=new D('data.db',{readonly:true});
const miss=JSON.parse(fs.readFileSync('miss_names.json'));
const ean2plik=JSON.parse(fs.readFileSync('src_ean2plik.json'));
const bysize=JSON.parse(fs.readFileSync('src_bysize.json')); // {sizeDigits: [[tokens[],plik],...]}
const BASE='https://agritires.eu/zdjecia-produktow/opony/';

const digits=s=>String(s||'').replace(/[^0-9]/g,'');
const STOP=new Set(['TL','TT','PR','BEZDETKOWA','DETKOWA','SET','ZESTAW','E','TIL']);
const norm=s=>String(s||'').trim().toUpperCase().replace(/\s+/g,' ');
function toks(s){ return norm(s).split(/[^A-Z0-9]+/).filter(t=>t && !STOP.has(t) && t.length>=2 && !/^\d+$/.test(t)); }

const getByName=db.prepare('SELECT id,kod,ean,marka,model,rozmiar FROM products WHERE nazwa=?');

let byEan=0, bySizeModel=0, none=0;
const res=[]; const noneList=[]; const ambigList=[];

for(const nm of miss){
  const p=getByName.get(nm); if(!p) { none++; noneList.push(nm); continue; }
  const e=(p.ean||'').trim();
  // 1) EAN (pewny)
  if(e && ean2plik[e]){ res.push({id:p.id,kod:p.kod,how:'ean',link:BASE+ean2plik[e]}); byEan++; continue; }
  // 2) zapasowo: rozmiar-digits + tokeny modelu produktu
  const sd=digits(p.rozmiar);
  const cand=bysize[sd]||[];
  if(cand.length){
    const mtoks=toks((p.marka||'')+' '+(p.model||''));
    const scored=cand.map(([tk,plik])=>{ let h=0; for(const t of mtoks) if(tk.includes(t)) h++; return {plik, r: mtoks.length? h/mtoks.length:0, h}; })
      .sort((a,b)=>b.r-a.r||b.h-a.h);
    const top=scored[0];
    const tie=scored.filter(s=>s!==top && s.r===top.r && s.h===top.h && s.plik!==top.plik);
    if(top && top.r>=1 && top.h>=1 && tie.length===0){ res.push({id:p.id,kod:p.kod,how:'sizemodel',link:BASE+top.plik}); bySizeModel++; continue; }
    ambigList.push({nm, marka:p.marka, model:p.model, rozmiar:p.rozmiar, cand:cand.length, topr:top?top.r:0});
  }
  none++; noneList.push(nm);
}

console.log('=== DOPASOWANIE ZE ZRODLA products-zdjecia (dry) ===');
console.log('brakow:', miss.length);
console.log('  po EAN (pewne):', byEan);
console.log('  po rozmiar+model (zapasowe, pewne):', bySizeModel);
console.log('  RAZEM dopasowane:', byEan+bySizeModel);
console.log('  bez dopasowania:', none);
console.log('\nPrzyklady bez dopasowania (10):');
noneList.slice(0,10).forEach(n=>console.log('  '+n));
fs.writeFileSync('src_match.json', JSON.stringify(res));
fs.writeFileSync('src_none.json', JSON.stringify(noneList));
console.log('\nzapisano src_match.json ('+res.length+'), src_none.json ('+noneList.length+')');
db.close();
