const D = require('better-sqlite3');
const fs = require('fs');
const db = new D('data.db', { readonly: true });
const all = (s) => db.prepare(s).all();
const pairs = JSON.parse(fs.readFileSync('pairs.json','utf8'));

const STOP = new Set(['opona','bkt','tl','tt','pr','ind','cho','sb']);
const onlyDigits = s => String(s||'').toLowerCase().replace(/[^0-9]/g,'');
function modelToks(s){
  return String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(t=>t && !STOP.has(t) && t.length>=2);
}
function getSlug(u){ const m=u.match(/\/opona-(.+?)\.html/i); return m?m[1].toLowerCase():null; }

const prods = all(`SELECT id, kod, kod_dostawcy, model, rozmiar, nazwa,
  CASE WHEN link_zdjecia IS NULL OR link_zdjecia='' THEN 0 ELSE 1 END has_img,
  CASE WHEN link_zdjecia LIKE '%grasdorf%' THEN 1 ELSE 0 END grasdorf
  FROM products WHERE dostawca='MO9'`);
const P = prods.map(p=>({
  ...p,
  sizeDigits: onlyDigits(p.rozmiar),
  mtoks: modelToks(p.model)
}));

let results=[], none=[], ambig=[];
for(const pair of pairs){
  const slug = getSlug(pair.prod);
  if(!slug){ none.push(pair.prod); continue; }
  const slugDigits = onlyDigits(slug);
  const slugAlpha = slug.replace(/[^a-z0-9]/g,'');

  // kandydaci: rozmiar (cyfry) wystepuje w cyfrach sluga; dlugosc rozmiaru>=3 cyfr zeby unikac przypadkow
  let cand = P.filter(p=> p.sizeDigits.length>=3 && slugDigits.includes(p.sizeDigits));
  if(cand.length===0){ none.push(slug); continue; }

  // scoring: model tokens w slugu + dlugosc dopasowanego rozmiaru (dluzszy = pewniejszy)
  const scored = cand.map(p=>{
    let mhit=0; for(const t of p.mtoks) if(slugAlpha.includes(t)) mhit++;
    const mratio = p.mtoks.length? mhit/p.mtoks.length : 0;
    return {p, mratio, mhit, sizeLen:p.sizeDigits.length};
  }).sort((a,b)=> b.mratio-a.mratio || b.sizeLen-a.sizeLen || b.mhit-a.mhit);

  const top = scored[0];
  // remis: inny model o tym samym mratio i sizeLen
  const tie = scored.filter(s=> s!==top && s.mratio===top.mratio && s.sizeLen===top.sizeLen
                                 && onlyDigits(s.p.model)+s.p.mtoks.join('') !== onlyDigits(top.p.model)+top.p.mtoks.join(''));
  let how=null;
  if(top.mratio>=1 && top.p.mtoks.length>=1 && tie.length===0) how='full';
  else if(top.mratio>=0.5 && top.mhit>=2 && tie.length===0) how='partial';
  else if(cand.length===1) how='size-unique';   // tylko jeden produkt tego rozmiaru
  if(how){
    results.push({id:top.p.id, kod:top.p.kod, img:pair.img, how, has_img:top.p.has_img, gr:top.p.grasdorf, slug, model:top.p.model, rozmiar:top.p.rozmiar, mratio:top.mratio});
  } else {
    ambig.push({slug, top:{m:top.p.model,r:top.p.rozmiar,mr:top.mratio}, n:cand.length});
  }
}

// dedup po id
const seen=new Map(); let dup=0; const final=[];
for(const r of results){ if(seen.has(r.id)){dup++; continue;} seen.set(r.id,r); final.push(r); }

const cnt = h => final.filter(r=>r.how===h).length;
let noImg=0,gr=0,other=0;
for(const r of final){ if(!r.has_img)noImg++; else if(r.gr)gr++; else other++; }

console.log('=== DOPASOWANIE v3 (dry, klucz cyfrowy rozmiaru) ===');
console.log('par wejsciowych:', pairs.length);
console.log('  full (model+rozmiar):', cnt('full'));
console.log('  partial (czesc modelu+rozmiar):', cnt('partial'));
console.log('  size-unique (jedyny tego rozmiaru):', cnt('size-unique'));
console.log('RAZEM unikalnych produktow:', final.length);
console.log('duplikaty (kolejne zdjecie na ten sam produkt):', dup);
console.log('niejednoznaczne (pominiete):', ambig.length);
console.log('brak dopasowania rozmiaru:', none.length);
console.log('\nZ dopasowanych:');
console.log('  bez zdjecia (uzupelnienie):', noImg);
console.log('  konflikt grasdorf (nadpisanie Agrorami):', gr);
console.log('  ma juz inne zrodlo:', other);
console.log('\nPokrycie 910 produktow MO9:', final.length, '('+(100*final.length/910).toFixed(1)+'%)');
console.log('\nPrzyklady niejednoznacznych (6):');
ambig.slice(0,6).forEach(a=>console.log('  '+a.slug+' -> top='+JSON.stringify(a.top)+' kand='+a.n));
console.log('\nPrzyklady braku (6):', none.slice(0,6).join(' | '));
fs.writeFileSync('match_final.json', JSON.stringify(final));
console.log('\nzapisano match_final.json ('+final.length+' rekordow)');
db.close();
