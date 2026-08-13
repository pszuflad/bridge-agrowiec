const D = require('better-sqlite3');
const fs = require('fs');
const db = new D('data.db', { readonly: true });
const all = (s) => db.prepare(s).all();

const pairs = JSON.parse(fs.readFileSync('pairs.json','utf8'));

// --- normalizacja rozmiaru: zredukuj do ciagu cyfr rozdzielonych separatorami -> ujednolic ---
function normSize(s){
  if(!s) return '';
  return String(s).toLowerCase()
    .replace(/[,]/g,'.')
    .replace(/\s+/g,'')
    .replace(/[x×]/g,'-')        // x -> -
    .replace(/\//g,'-')          // / -> -
    .replace(/r/g,'-')           // R (radialna) -> -
    .replace(/-+/g,'-')          // wielokrotne -
    .replace(/[^0-9.\-]/g,'')    // tylko cyfry . -
    .replace(/^-|-$/g,'');
}
// wyciagnij "rdzen" rozmiaru: posortowane liczby (odporne na kolejnosc/format)
function sizeCore(s){
  const n = normSize(s).match(/[0-9]+(\.[0-9]+)?/g) || [];
  return n.join('|');
}
function normModel(s){
  if(!s) return '';
  return String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
}

// slug -> {marka, tokens, sizeCore}
function parseSlug(url){
  const m = url.match(/\/opona-(.+?)\.html/i);
  if(!m) return null;
  let slug = m[1].toLowerCase();
  return slug;
}

// zbuduj indeks produktow MO9: klucz sizeCore -> lista {id, modelNorm, rozmiar, has_img, grasdorf}
const prods = all(`SELECT id, kod, kod_dostawcy, model, rozmiar,
  CASE WHEN link_zdjecia IS NULL OR link_zdjecia='' THEN 0 ELSE 1 END has_img,
  CASE WHEN link_zdjecia LIKE '%grasdorf%' THEN 1 ELSE 0 END grasdorf
  FROM products WHERE dostawca='MO9'`);
const bySize = new Map();
for(const p of prods){
  const sc = sizeCore(p.rozmiar);
  if(!bySize.has(sc)) bySize.set(sc, []);
  bySize.get(sc).push(p);
}

let exact=0, bySizeOnly=0, ambiguous=0, none=0;
const results=[]; const noneList=[];
for(const pair of pairs){
  const slug = parseSlug(pair.prod);
  if(!slug){ none++; continue; }
  const slugNorm = normModel(slug);            // caly slug bez separatorow
  const sc = sizeCore(slug);                    // liczby ze sluga
  const cand = bySize.get(sc) || [];
  if(cand.length===0){ none++; noneList.push(slug); continue; }
  if(cand.length===1){ bySizeOnly++; results.push({id:cand[0].id,img:pair.img,how:'size-unique',has_img:cand[0].has_img,gr:cand[0].grasdorf}); continue; }
  // wiele kandydatow o tym samym rozmiarze -> dopasuj po modelu (tokeny modelu zawarte w slugu)
  const scored = cand.map(p=>{
    const mn = normModel(p.model);
    // ile znakow modelu wystepuje w slugu (prosty scoring: czy slug zawiera model bez spacji)
    let score=0;
    if(mn && slugNorm.includes(mn)) score=100;
    else {
      // czesciowe: tokeny modelu
      const toks = String(p.model||'').toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=2);
      score = toks.filter(t=>slugNorm.includes(t)).length;
    }
    return {p, score};
  }).sort((a,b)=>b.score-a.score);
  if(scored[0].score>0 && (scored.length<2 || scored[0].score>scored[1].score)){
    exact++; results.push({id:scored[0].p.id,img:pair.img,how:'size+model',has_img:scored[0].p.has_img,gr:scored[0].p.grasdorf});
  } else {
    ambiguous++;
  }
}
console.log('=== WYNIK DOPASOWANIA (dry) ===');
console.log('par wejsciowych:', pairs.length);
console.log('dopasowano rozmiar+model (wielu kand):', exact);
console.log('dopasowano rozmiar-unikalny:', bySizeOnly);
console.log('niejednoznaczne (ten sam rozmiar, brak rozstrzygniecia modelem):', ambiguous);
console.log('brak dopasowania (rozmiar nie znaleziony):', none);
const total = exact+bySizeOnly;
console.log('RAZEM PEWNE:', total, '/', pairs.length);

// ile z dopasowanych: bez zdjecia / konflikt grasdorf / juz ma inne
let noImg=0,gr=0,other=0; const seen=new Set(); let dup=0;
for(const r of results){
  if(seen.has(r.id)){dup++; continue;} seen.add(r.id);
  if(!r.has_img) noImg++; else if(r.gr) gr++; else other++;
}
console.log('\nZ dopasowanych (unikalne produkty '+seen.size+'):');
console.log('  bez zdjecia (uzupelnienie):', noImg);
console.log('  konflikt grasdorf (nadpisanie):', gr);
console.log('  ma juz inne zrodlo:', other);
console.log('  zduplikowane trafienia (ten sam produkt z 2 zdjec):', dup);
console.log('\nprzyklady braku (10):', noneList.slice(0,10).join('\n  '));
fs.writeFileSync('match_results.json', JSON.stringify(results));
db.close();
