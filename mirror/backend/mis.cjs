const d=require('better-sqlite3')('data.db',{readonly:true});
const changes=require('./rozmiary_alt_changes.json');
const mism=changes.filter(c=>!c.poprzOK);
console.log('=== 6 ROZBIEZNOSCI (teraz != poprzednia z pliku) ===');
console.log('%-16s %-14s %-14s %-14s %s','KOD','ROZMIAR','TERAZ(baza)','poprz(plik)','->ALT(plik)');
for(const c of mism) console.log(`${c.kod.padEnd(16)} ${String(c.rozmiar).padEnd(14)} ${String(c.cur).padEnd(14)} ${String(c.poprz).padEnd(14)} ${c.alt}`);
// nieznaleziona MO3 - sprobuj po fragmencie kodu
console.log('\n=== proba znalezienia MO338090... ===');
const cand=d.prepare("SELECT kod,ean,rozmiar,rozmiar_alternatywny FROM products WHERE kod LIKE 'MO3%38090%' OR rozmiar LIKE '%R54%' LIMIT 10").all();
cand.forEach(r=>console.log(' ',JSON.stringify(r)));
d.close();
