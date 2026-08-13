const D = require('better-sqlite3');
const db = new D('/home/admin/private_apps/bridge/data.db', { readonly: true });

// Pobierz wszystkie niepuste bieznik/model
const rows = db.prepare("SELECT kod, dostawca, bieznik, model, nazwa, rozmiar, indeks_nosnosci, indeks_predkosci, indeksy, tl_tt FROM products WHERE (bieznik IS NOT NULL AND bieznik<>'') OR (model IS NOT NULL AND model<>'')").all();
console.log('rekordow z bieznik/model:', rows.length);

// Definicje tokenow-anomalii (jako oddzielone slowa lub sufiksy)
// 1) indeks pojedynczy na koncu: 160J, 173D (2-3 cyfry + 1 litera + opcjonalna cyfra)
// 2) podwojny indeks: 158/150L, 156/150L
// 3) samodzielne TT / TL / TT/TL na koncu lub jako slowo
// 4) NPR / xxPR
const reDblIdx = /\b\d{2,3}\/\d{2,3}[A-Z]?\b/;             // 158/150L
const reSingleIdx = /(^|\s)\d{2,3}[A-Z]\d?(\s|$)/;          // 160J jako oddzielne slowo
const reTLTT = /(^|\s)(TT|TL|TT\/TL|TL\/TT)(\s|$)/;         // TL jako oddzielne slowo
const rePR = /(^|\s)\d{1,3}\s*PR(\s|$)/i;                   // 12PR

function anomalies(v){
  if(!v) return [];
  const a=[];
  if(reDblIdx.test(v)) a.push('dblIdx');
  if(reSingleIdx.test(v)) a.push('singleIdx');
  if(reTLTT.test(v)) a.push('TLTT');
  if(rePR.test(v)) a.push('PR');
  return a;
}

let stat={dblIdx:0,singleIdx:0,TLTT:0,PR:0};
let affected=[];
for(const r of rows){
  const ab=anomalies(r.bieznik), am=anomalies(r.model);
  const all=[...new Set([...ab,...am])];
  if(all.length){
    for(const t of all) stat[t]++;
    affected.push({kod:r.kod,dostawca:r.dostawca,bieznik:r.bieznik,model:r.model,rozmiar:r.rozmiar,tokens:all});
  }
}
console.log('\n=== statystyka anomalii (oddzielone tokeny) ===');
console.log(stat);
console.log('lacznie dotknietych pozycji:', affected.length);

console.log('\n=== rozklad po dostawcach ===');
const byd={};
for(const a of affected) byd[a.dostawca]=(byd[a.dostawca]||0)+1;
console.log(byd);

console.log('\n=== PROBKI (po jednej z kazdego typu, 40) ===');
for(const a of affected.slice(0,40))
  console.log(`[${a.dostawca}] ${a.tokens.join(',')} | bieznik="${a.bieznik}" | model="${a.model}" | rozmiar="${a.rozmiar}"`);

// zapisz pelna liste do pliku
require('fs').writeFileSync('/home/admin/private_apps/bridge/anomalie_bieznik.json', JSON.stringify(affected,null,1));
console.log('\nZapisano anomalie_bieznik.json ('+affected.length+' poz.)');
