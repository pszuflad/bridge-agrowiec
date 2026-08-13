const d=require('better-sqlite3')('data.db',{readonly:true});
const data=require('./rozmiary_alt.json');
function toKod(raw){ const m=String(raw).match(/^(MO\d+)(.+)$/); return m? `${m[1]}_${m[2]}` : raw; }
const get = d.prepare("SELECT kod,rozmiar,rozmiar_alternatywny FROM products WHERE kod=?");
const getEan = d.prepare("SELECT kod,rozmiar,rozmiar_alternatywny FROM products WHERE ean=?");
let match=0, byEan=0, notfound=0, alreadyOk=0, needChange=0, poprzMatch=0, poprzMismatch=0;
const problems=[]; const changes=[];
for(const r of data){
  const kod=toKod(r.kod_raw);
  let p=get.get(kod);
  let via='kod';
  if(!p && r.ean){ p=getEan.get(String(r.ean)); via='ean'; }
  if(!p){ notfound++; problems.push(`NOTFOUND ${r.kod_raw} (${kod}) ean=${r.ean}`); continue; }
  if(via==='kod') match++; else byEan++;
  const cur = p.rozmiar_alternatywny;
  if(String(cur)===String(r.alt)) { alreadyOk++; continue; }
  needChange++;
  // czy aktualna wartosc = 'poprzednia wartosc' z pliku?
  if(String(cur)===String(r.poprz)) poprzMatch++; else { poprzMismatch++; }
  changes.push({kod:p.kod, rozmiar:p.rozmiar, cur, alt:r.alt, poprz:r.poprz, via, poprzOK:String(cur)===String(r.poprz)});
}
console.log(`dopasowane: kod=${match} ean=${byEan} | nieznalezione=${notfound}`);
console.log(`juz OK (alt=plik): ${alreadyOk} | do zmiany: ${needChange}`);
console.log(`  z czego aktualna==poprzednia(plik): ${poprzMatch} | rozbieznosc: ${poprzMismatch}`);
console.log('\n=== PROBLEMY ==='); problems.forEach(p=>console.log(' ',p));
console.log('\n=== PROBKA ZMIAN (pierwsze 25) ===');
console.log('%-16s %-14s %-12s %-12s %-8s %s','KOD','ROZMIAR','TERAZ','->ALT','via','poprzOK');
changes.slice(0,25).forEach(c=>console.log(`${c.kod.padEnd(16)} ${String(c.rozmiar).padEnd(14)} ${String(c.cur).padEnd(12)} ${String(c.alt).padEnd(12)} ${c.via.padEnd(8)} ${c.poprzOK}`));
require('fs').writeFileSync('rozmiary_alt_changes.json', JSON.stringify(changes,null,2));
console.log('\nzapisano rozmiary_alt_changes.json (', changes.length, 'zmian )');
d.close();
