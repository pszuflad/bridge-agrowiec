// apply_waga.cjs — zapis oszacowanych wag z dryrun_waga.json + fallback dla pozycji BRAK
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('data.db');
const now = new Date().toISOString().replace('T',' ').slice(0,19);
const { out } = JSON.parse(fs.readFileSync('dryrun_waga.json','utf8'));

function median(arr){ if(!arr.length) return null; const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2? s[m] : (s[m-1]+s[m])/2; }
function firstNum(s){ const m=String(s).match(/(\d+(?:[.,]\d+)?)/); return m?parseFloat(m[1].replace(',','.')):null; }
function diaNum(s){ const m=String(s).match(/[R\-x](\d+(?:\.\d+)?)\s*$/i); return m?parseFloat(m[1]):null; }

// fallback dla BRAK: podobna srednica felgi +-1", dowolna kategoria
const withW = db.prepare("SELECT rozmiar,kategoria,waga,srednica,szerokosc FROM products WHERE waga>0 AND rozmiar IS NOT NULL AND rozmiar!=''").all();
for(const o of out){
  if(o.est!=null) continue;
  const row = db.prepare("SELECT rozmiar,srednica,szerokosc,kategoria FROM products WHERE kod=?").get(o.kod);
  const dia = row.srednica || diaNum(row.rozmiar);   // 16.5
  const w0  = row.szerokosc || firstNum(row.rozmiar); // 33 (cale, calkowita srednica dla AxB)
  // szukamy zblizonych: srednica +-1", i szerokosc pierwszej liczby +-25% w tej samej kategorii, potem luzniej
  let cand = withW.filter(r=> r.kategoria===row.kategoria && r.srednica && dia && Math.abs(r.srednica-dia)<=1
              && (!w0 || !r.szerokosc || Math.abs(r.szerokosc-w0)/w0<=0.25)).map(r=>r.waga);
  if(cand.length<3) cand = withW.filter(r=> r.srednica && dia && Math.abs(r.srednica-dia)<=1).map(r=>r.waga);
  const est = median(cand);
  o.est = est!=null? Math.round(est*10)/10 : 40; // ostateczny fallback 40kg
  o.method = 'M4-fallback-przyblizone';
  o.src = cand.length;
  console.log(`FALLBACK ${o.kod} "${row.rozmiar}" -> ${o.est} kg (#${cand.length})`);
}

const getRow = db.prepare('SELECT nazwa, waga FROM products WHERE kod=?');
const upd = db.prepare('UPDATE products SET waga=? WHERE kod=?');
const ins = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");

let n=0;
const tx = db.transaction(()=>{
  for(const o of out){
    const r = getRow.get(o.kod); if(!r) continue;
    upd.run(o.est, o.kod);
    ins.run(now, o.kod, r.nazwa, 'waga', String(r.waga), String(o.est), 'szacunek-waga', 'Anna');
    n++;
  }
});
tx();
console.log(`\nZaktualizowano wag: ${n}`);
// weryfikacja: ile nadal waga=0
const zero = db.prepare("SELECT COUNT(*) n FROM products WHERE waga=0").get().n;
console.log(`pozostalo waga=0: ${zero}`);
db.close();
