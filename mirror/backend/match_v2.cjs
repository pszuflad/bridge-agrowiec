const D = require('better-sqlite3');
const fs = require('fs');
const db = new D('data.db', { readonly: true });
const all = (s) => db.prepare(s).all();
const pairs = JSON.parse(fs.readFileSync('pairs.json','utf8'));

// tokeny alfanumeryczne z rozdzieleniem liter/cyfr; usun znane szumy
const STOP = new Set(['opona','bkt','tl','tt','pr','ind','e','b','cho','sb','a8','d','g']);
function tokset(s){
  s = String(s||'').toLowerCase();
  // rozbij na tokeny po niealfanum
  let t = s.split(/[^a-z0-9]+/).filter(Boolean);
  // usun czyste oznaczenia indeksow typu 146a8, 170a8, 136g, 159d itp na koncu? zostaw - pomoc w rozmiarze
  return t;
}
// klucz rozmiaru: znormalizuj slug rozmiaru produktu do zestawu liczb (z kropkami) + obecnosc 'r'
function sizeTokens(rozmiar){
  let s = String(rozmiar||'').toLowerCase().replace(/,/g,'.');
  // wyciagnij liczby (z kropka)
  const nums = (s.match(/\d+\.?\d*/g)||[]);
  const hasR = /r/.test(s);
  return {nums, hasR, raw:s};
}

// zbuduj indeks produktow
const prods = all(`SELECT id, kod, kod_dostawcy, model, rozmiar, nazwa,
  CASE WHEN link_zdjecia IS NULL OR link_zdjecia='' THEN 0 ELSE 1 END has_img,
  CASE WHEN link_zdjecia LIKE '%grasdorf%' THEN 1 ELSE 0 END grasdorf
  FROM products WHERE dostawca='MO9'`);

// dla kazdego produktu: zestaw tokenow modelu + liczby rozmiaru
const P = prods.map(p=>{
  const mt = tokset(p.model);
  const st = sizeTokens(p.rozmiar);
  return {...p, modelTokens:mt, sizeNums:st.nums, hasR:st.hasR,
          modelKey: mt.filter(x=>!STOP.has(x)).join('')};
});

function slugOf(u){ const m=u.match(/\/opona-(.+?)\.html/i); return m?m.group_(1):null; }
function getSlug(u){ const m=u.match(/\/opona-(.+?)\.html/i); return m?m[1].toLowerCase():null; }

let results=[]; let none=[]; let ambig=[];
for(const pair of pairs){
  const slug = getSlug(pair.prod);
  if(!slug){ none.push(pair.prod); continue; }
  const slugToks = tokset(slug);
  const slugNums = (slug.replace(/,/g,'.').match(/\d+\.?\d*/g)||[]);
  const slugNumSet = new Set(slugNums);
  const slugJoined = slugToks.join('');

  // kandydaci: produkty, ktorych WSZYSTKIE liczby rozmiaru wystepuja w liczbach sluga
  const scored = [];
  for(const p of P){
    if(p.sizeNums.length===0) continue;
    const sizeHit = p.sizeNums.every(n=> slugNumSet.has(n));
    if(!sizeHit) continue;
    // scoring modelu: ile tokenow modelu (bez STOP) jest w slugu
    const mtoks = p.modelTokens.filter(x=>!STOP.has(x) && x.length>=2);
    let mhit=0; for(const t of mtoks) if(slugJoined.includes(t)) mhit++;
    const mratio = mtoks.length? mhit/mtoks.length : 0;
    // bonus: dokladna liczba pasujacych liczb rozmiaru (wiecej = lepiej), i zgodnosc liczby elementow
    const sizeScore = p.sizeNums.length;
    scored.push({p, mratio, mhit, sizeScore, mtoks:mtoks.length});
  }
  if(scored.length===0){ none.push(slug); continue; }
  // sortuj: najpierw mratio, potem sizeScore, potem mhit
  scored.sort((a,b)=> b.mratio-a.mratio || b.sizeScore-a.sizeScore || b.mhit-a.mhit);
  const top = scored[0];
  // akceptuj tylko pewne: model w pelni pasuje (mratio==1 i mtoks>=1) i brak remisu z innym modelem
  const tie = scored.filter(s=> s.mratio===top.mratio && s.p.modelKey!==top.p.modelKey && s.sizeScore===top.sizeScore);
  if(top.mratio>=1 && top.mtoks>=1 && tie.length===0){
    results.push({id:top.p.id, kod:top.p.kod, img:pair.img, how:'full-model+size', has_img:top.p.has_img, gr:top.p.grasdorf, slug});
  } else if(top.mratio>=0.5 && top.mtoks>=2 && tie.length===0){
    results.push({id:top.p.id, kod:top.p.kod, img:pair.img, how:'partial-model+size', has_img:top.p.has_img, gr:top.p.grasdorf, slug});
  } else {
    ambig.push({slug, cands:scored.slice(0,3).map(s=>({m:s.p.model,r:s.p.rozmiar,mr:s.mratio}))});
  }
}

// dedup po id - jesli 2 zdjecia -> ten sam produkt, zostaw pierwsze, policz
const seen=new Map(); let dup=0; const final=[];
for(const r of results){ if(seen.has(r.id)){dup++; continue;} seen.set(r.id,r); final.push(r); }

const full = final.filter(r=>r.how==='full-model+size').length;
const part = final.filter(r=>r.how==='partial-model+size').length;
let noImg=0,gr=0,other=0;
for(const r of final){ if(!r.has_img)noImg++; else if(r.gr)gr++; else other++; }

console.log('=== DOPASOWANIE v2 (dry) ===');
console.log('par:', pairs.length);
console.log('dopasowane (pewne, full model+size):', full);
console.log('dopasowane (czesciowy model+size):', part);
console.log('RAZEM unikalnych produktow:', final.length);
console.log('duplikaty (ten sam produkt, kolejne zdjecie pominiete):', dup);
console.log('niejednoznaczne (pominiete):', ambig.length);
console.log('brak rozmiaru w bazie:', none.length);
console.log('\nZ dopasowanych:');
console.log('  bez zdjecia (uzupelnienie):', noImg);
console.log('  konflikt grasdorf (nadpisanie):', gr);
console.log('  ma juz inne zrodlo (nadpisanie?):', other);
console.log('\nPrzyklady niejednoznacznych (5):');
ambig.slice(0,5).forEach(a=>console.log(' ', a.slug, '->', JSON.stringify(a.cands)));
console.log('\nPrzyklady braku rozmiaru (5):', none.slice(0,5).join(' | '));
fs.writeFileSync('match_results_v2.json', JSON.stringify(final));
console.log('\nzapisano match_results_v2.json');
db.close();
