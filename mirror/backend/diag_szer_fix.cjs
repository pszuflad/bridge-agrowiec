const D=require('better-sqlite3');
const db=new D('/home/admin/private_apps/bridge/data.db',{readonly:true});
const all = db.prepare("SELECT kod,dostawca,rozmiar,szerokosc,profil,srednica,szerokosc_paczki,wysokosc,dlugosc,wysokosc_przesylki FROM products WHERE rozmiar IS NOT NULL AND rozmiar<>'' AND szerokosc IS NOT NULL").all();

// Kategoria A: szerokosc przeliczona na mm zamiast oryginalu (calowa notacja)
// rozmiar bez ukosnika (cale), np "12.4-24","18.4-34","9.5-24" -> pierwsza liczba to cale
// ale szerokosc w bazie != pierwsza liczba (bo przeliczona *25.4)
// Kategoria B: 4-cyfrowa szerokosc ucieta (rozmiar 1050/... 1250/...)

let catA=[], catB=[], catOther=[];
for(const r of all){
  const s = String(r.rozmiar).replace(',','.');
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if(!m) continue;
  const first = parseFloat(m[1]);
  if(Math.abs(first - r.szerokosc) < 0.01) continue; // OK

  // B: rozmiar zaczyna sie od 4-cyfrowej liczby (>=1000) ze slashem
  if(/^\d{4}\s*\//.test(s)){
    catB.push({kod:r.kod,dostawca:r.dostawca,rozmiar:r.rozmiar,szerokosc:r.szerokosc,pierwsza:first});
    continue;
  }
  // A: calowa notacja bez slasha (np 12.4-24, 18.4-34) gdzie szer = first*25.4
  const expectedMm = Math.round(first*25.4*10)/10;
  if(!s.includes('/') && Math.abs(expectedMm - r.szerokosc) < 0.5){
    catA.push({kod:r.kod,dostawca:r.dostawca,rozmiar:r.rozmiar,szerokosc:r.szerokosc,should:first});
    continue;
  }
  catOther.push({kod:r.kod,dostawca:r.dostawca,rozmiar:r.rozmiar,szerokosc:r.szerokosc,pierwsza:first});
}
console.log('KAT A (cale przeliczone na mm, do przywrocenia):', catA.length);
console.log('KAT B (4-cyfrowa ucieta):', catB.length);
console.log('INNE (do sprawdzenia recznie):', catOther.length);

console.log('\n=== KAT A probka (rozmiar | szerokosc_teraz -> powinno) ===');
for(const x of catA.slice(0,20)) console.log(`  [${x.dostawca}] ${x.kod}  ${x.rozmiar}: ${x.szerokosc} -> ${x.should}`);
// unikalne rozmiary w A
const uszA=[...new Set(catA.map(x=>x.rozmiar))];
console.log('unikalne rozmiary A:', JSON.stringify(uszA));

console.log('\n=== KAT B (wszystkie) ===');
for(const x of catB) console.log(`  [${x.dostawca}] ${x.kod}  ${x.rozmiar}: szer=${x.szerokosc} (pierwsza liczba=${x.pierwsza})`);

console.log('\n=== INNE (wszystkie) ===');
for(const x of catOther) console.log(`  [${x.dostawca}] ${x.kod}  ${x.rozmiar}: szer=${x.szerokosc} (pierwsza=${x.pierwsza})`);

require('fs').writeFileSync('/home/admin/private_apps/bridge/szer_fix_sets.json', JSON.stringify({catA,catB,catOther},null,1));
console.log('\nzapisano szer_fix_sets.json');
