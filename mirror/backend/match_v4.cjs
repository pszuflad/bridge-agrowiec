const D = require('better-sqlite3');
const fs = require('fs');
const db = new D('data.db', { readonly: true });
const all = (s) => db.prepare(s).all();
const pairs = JSON.parse(fs.readFileSync('pairs.json','utf8'));

const STOP = new Set(['opona','bkt','tl','tt','pr','ind','cho','sb']);
const onlyDigits = s => String(s||'').toLowerCase().replace(/[^0-9]/g,'');
// wariant: usun ".00"/",00" (np 8.00 -> 8) zeby ujednolicic z baza gdzie bywa 8
function digitsNoZero(s){
  return String(s||'').toLowerCase()
    .replace(/[,]/g,'.')
    .replace(/\.0+(?=\D|$)/g,'')   // .00 na koncu grupy -> usun
    .replace(/[^0-9]/g,'');
}
function modelToks(s){
  return String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(t=>t && !STOP.has(t) && t.length>=2);
}
function getSlug(u){ const m=u.match(/\/opona-(.+?)\.html/i); return m?m[1].toLowerCase():null; }
// slug: "-00" pomiedzy segmentami to .00; zamien "-00-" i "x..-00" na skasowanie zera dziesietnego
function slugDigitsNoZero(slug){
  // zamien pattern <cyfra>-00 (dziesietne) -> <cyfra>
  let s = slug.replace(/(\d)-00(?=[-x]|$)/g, '$1');
  return s.replace(/[^0-9]/g,'');
}

const prods = all(`SELECT id, kod, kod_dostawcy, model, rozmiar, nazwa,
  CASE WHEN link_zdjecia IS NULL OR link_zdjecia='' THEN 0 ELSE 1 END has_img,
  CASE WHEN link_zdjecia LIKE '%grasdorf%' THEN 1 ELSE 0 END grasdorf
  FROM products WHERE dostawca='MO9'`);
const P = prods.map(p=>({
  ...p,
  sizeD: onlyDigits(p.rozmiar),
  sizeZ: digitsNoZero(p.rozmiar),
  mtoks: modelToks(p.model)
}));

let results=[], none=[], ambig=[];
for(const pair of pairs){
  const slug = getSlug(pair.prod);
  if(!slug){ none.push(pair.prod); continue; }
  const sd = onlyDigits(slug);
  const sz = slugDigitsNoZero(slug);
  const slugAlpha = slug.replace(/[^a-z0-9]/g,'');

  let cand = P.filter(p=>{
    if(p.sizeD.length>=3 && sd.includes(p.sizeD)) return true;
    if(p.sizeZ.length>=3 && (sz.includes(p.sizeZ) || sd.includes(p.sizeZ))) return true;
    return false;
  });
  if(cand.length===0){ none.push(slug); continue; }

  const scored = cand.map(p=>{
    let mhit=0; for(const t of p.mtoks) if(slugAlpha.includes(t)) mhit++;
    const mratio = p.mtoks.length? mhit/p.mtoks.length : 0;
    return {p, mratio, mhit, sizeLen:Math.max(p.sizeD.length,p.sizeZ.length)};
  }).sort((a,b)=> b.mratio-a.mratio || b.mhit-a.mhit || b.sizeLen-a.sizeLen);

  const top = scored[0];
  // remis tylko gdy inny MODEL ma identyczny mratio ORAZ identyczny mhit (realna dwuznacznosc)
  const tie = scored.filter(s=> s!==top && s.mratio===top.mratio && s.mhit===top.mhit
                 && s.p.mtoks.join('')!==top.p.mtoks.join(''));
  let how=null;
  if(top.mratio>=1 && top.p.mtoks.length>=1 && tie.length===0) how='full';
  else if(top.mratio>=0.5 && top.mhit>=2 && tie.length===0) how='partial';
  else if(cand.length===1) how='size-unique';
  if(how){
    results.push({id:top.p.id, kod:top.p.kod, img:pair.img, how, has_img:top.p.has_img, gr:top.p.grasdorf, slug, model:top.p.model, rozmiar:top.p.rozmiar});
  } else {
    ambig.push({slug, top:{m:top.p.model,r:top.p.rozmiar,mr:top.mratio,mh:top.mhit}, tie:tie.map(t=>t.p.model), n:cand.length});
  }
}

const seen=new Map(); let dup=0; const final=[];
for(const r of results){ if(seen.has(r.id)){dup++; continue;} seen.set(r.id,r); final.push(r); }
const cnt = h => final.filter(r=>r.how===h).length;
let noImg=0,gr=0,other=0;
for(const r of final){ if(!r.has_img)noImg++; else if(r.gr)gr++; else other++; }

console.log('=== DOPASOWANIE v4 (dry) ===');
console.log('par:', pairs.length);
console.log('  full:', cnt('full'), '| partial:', cnt('partial'), '| size-unique:', cnt('size-unique'));
console.log('RAZEM unikalnych produktow:', final.length, '('+(100*final.length/910).toFixed(1)+'% z 910)');
console.log('duplikaty:', dup, '| niejednoznaczne:', ambig.length, '| brak:', none.length);
console.log('\nZ dopasowanych: bez zdjecia='+noImg+', konflikt grasdorf='+gr+', inne zrodlo='+other);
console.log('\nNiejednoznaczne (8):');
ambig.slice(0,8).forEach(a=>console.log('  '+a.slug+' -> '+JSON.stringify(a.top)+' tie='+JSON.stringify(a.tie)));
console.log('\nBrak (10):', none.slice(0,10).join(' | '));
fs.writeFileSync('match_final.json', JSON.stringify(final));
console.log('\nzapisano match_final.json ('+final.length+')');
db.close();
