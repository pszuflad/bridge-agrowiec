// dryrun_waga.cjs — oszacuj wage dla 23 pozycji waga=0.
// Metoda hierarchiczna:
//  M1: mediana wag rekordow o IDENTYCZNYM rozmiarze (waga>0)  [najlepsze]
//  M2: mediana wag o tym samym rozmiarze po normalizacji (usun spacje, ujednolic separatory)
//  M3: model liniowy waga ~ f(srednica, szerokosc_mm) w obrebie tej samej kategorii  [fallback]
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('data.db', { readonly: true });

function median(arr){ if(!arr.length) return null; const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2? s[m] : (s[m-1]+s[m])/2; }
function normRoz(s){ return String(s).toLowerCase().replace(/\s+/g,'').replace(/[x×]/g,'x'); }
function firstNum(s){ const m=String(s).match(/(\d+(?:[.,]\d+)?)/); return m?parseFloat(m[1].replace(',','.')):null; }
function diaNum(s){ // srednica felgi = liczba po ostatnim R lub po ostatnim - lub x
  const m=String(s).match(/[R\-x](\d+(?:\.\d+)?)\s*$/i); return m?parseFloat(m[1]):null; }

const withW = db.prepare("SELECT rozmiar, kategoria, waga, srednica, szerokosc FROM products WHERE waga>0 AND rozmiar IS NOT NULL AND rozmiar!=''").all();
// indeksy
const byRoz = {}, byRozNorm = {};
for(const r of withW){
  (byRoz[r.rozmiar] ||= []).push(r.waga);
  (byRozNorm[normRoz(r.rozmiar)] ||= []).push(r.waga);
}

const zeros = db.prepare("SELECT kod,dostawca,rozmiar,kategoria,marka,srednica,szerokosc,waga FROM products WHERE waga=0").all();
const out=[];
for(const z of zeros){
  let est=null, method=null, src=null;
  if(byRoz[z.rozmiar]){ est=median(byRoz[z.rozmiar]); method='M1-identyczny-rozmiar'; src=byRoz[z.rozmiar].length; }
  else if(byRozNorm[normRoz(z.rozmiar)]){ est=median(byRozNorm[normRoz(z.rozmiar)]); method='M2-rozmiar-norm'; src=byRozNorm[normRoz(z.rozmiar)].length; }
  else {
    // M3: podobne w tej samej kategorii wg srednicy (+-0) i szerokosci pierwszej liczby (+-15%)
    const dia = z.srednica || diaNum(z.rozmiar);
    const w0 = z.szerokosc || firstNum(z.rozmiar);
    const cand = withW.filter(r=>{
      if(r.kategoria!==z.kategoria) return false;
      const rd = r.srednica; const rw = r.szerokosc;
      if(dia && rd && Math.abs(rd-dia)>0.6) return false;
      if(w0 && rw && Math.abs(rw-w0)/w0>0.15) return false;
      return true;
    }).map(r=>r.waga);
    if(cand.length){ est=median(cand); method='M3-regresja-kat'; src=cand.length; }
  }
  out.push({kod:z.kod, rozmiar:z.rozmiar, kategoria:z.kategoria, marka:z.marka, est: est!=null?Math.round(est*10)/10:null, method, src});
}

console.log('Pozycje waga=0:', zeros.length);
console.log('\n%-24s %-16s %-14s %8s %6s %-22s','KOD','ROZMIAR','KAT','WAGA_EST','#zr','METODA');
for(const o of out) console.log(
  `${o.kod.padEnd(24)} ${String(o.rozmiar).padEnd(16)} ${String(o.kategoria).padEnd(14)} ${String(o.est??'BRAK').padStart(8)} ${String(o.src??'-').padStart(6)} ${o.method||'-'}`);

const brak = out.filter(o=>o.est==null);
console.log(`\nz oszacowaniem: ${out.length-brak.length} | bez (BRAK): ${brak.length}`);
fs.writeFileSync('dryrun_waga.json', JSON.stringify({out}, null, 2));
console.log('zapisano dryrun_waga.json');
db.close();
