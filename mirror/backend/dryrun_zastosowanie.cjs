// dryrun_zastosowanie.cjs — przypisz zastosowanie dla 17 poz. wg rozmiaru+kategorii (najczestsze u sasiadow)
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('data.db', { readonly: true });

const kods=['MO2_CET0048','MO2_570307','MO2_570283','MO2_568915','MO2_05127050000','MO2_37200023AL-AP','MO2_IND004710','MO2_IND00410','MO2_IND00409','MO2_IND00197','MO2_IND00186','MO2_IND00032','MO2_IND00023','MO2_IND00018','MO2_CET0006','MO2_19738','MO2_05127970000'];

function mode(arr){ const m={}; let best=null,bn=0; for(const v of arr){ if(v==null||v==='') continue; m[v]=(m[v]||0)+1; if(m[v]>bn){bn=m[v];best=v;} } return {best,bn,dist:m}; }
function firstNum(s){ const x=String(s).match(/(\d+(?:[.,]\d+)?)/); return x?parseFloat(x[1].replace(',','.')):null; }
function diaNum(s){ const x=String(s).match(/[R\-x](\d+(?:\.\d+)?)\s*$/i); return x?parseFloat(x[1]):null; }

const all = db.prepare("SELECT rozmiar,kategoria,zastosowanie,srednica,szerokosc FROM products WHERE zastosowanie IS NOT NULL AND zastosowanie!=''").all();

const out=[];
for(const k of kods){
  const z = db.prepare("SELECT kod,rozmiar,kategoria,srednica,szerokosc FROM products WHERE kod=?").get(k);
  // 1) ten sam rozmiar
  let cand = all.filter(r=>r.rozmiar===z.rozmiar).map(r=>r.zastosowanie);
  let method='rozmiar-identyczny';
  if(cand.length<2){
    // 2) ta sama kategoria + zblizona srednica felgi (+-1")
    const dia=z.srednica||diaNum(z.rozmiar);
    cand = all.filter(r=> r.kategoria===z.kategoria && r.srednica && dia && Math.abs(r.srednica-dia)<=1).map(r=>r.zastosowanie);
    method='kat+srednica';
  }
  if(cand.length<2){
    // 3) sama kategoria
    cand = all.filter(r=> r.kategoria===z.kategoria).map(r=>r.zastosowanie);
    method='kat-tylko';
  }
  const m=mode(cand);
  out.push({kod:z.kod, rozmiar:z.rozmiar, kategoria:z.kategoria, zast:m.best, n:m.bn, total:cand.length, method,
            top: Object.entries(m.dist).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>`${e[0]}:${e[1]}`).join(', ')});
}
console.log('%-22s %-14s %-12s %-22s %-14s %s','KOD','ROZMIAR','KAT','ZASTOSOWANIE','METODA','TOP3');
for(const o of out) console.log(
  `${o.kod.padEnd(22)} ${String(o.rozmiar).padEnd(14)} ${String(o.kategoria).padEnd(12)} ${String(o.zast||'BRAK').padEnd(22)} ${o.method.padEnd(14)} [${o.top}]`);
fs.writeFileSync('dryrun_zastosowanie.json', JSON.stringify({out},null,2));
console.log('\nzapisano dryrun_zastosowanie.json');
db.close();
