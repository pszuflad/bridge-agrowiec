const Database = require('better-sqlite3');
const db = new Database('data.db', { readonly: true });
const rows = db.prepare("SELECT kod,dostawca,nazwa,indeks_predkosci,indeks_2,indeksy,indeks_nosnosci FROM products").all();
// FULDA-typ: indeks_predkosci lub indeks_2 pasuje do ^[A-Z]1/[A-Z], gdzie cyfra=1 i to NIE jest znany symbol A1..A8/B..
// realny blad: litera + '1' + '/' gdzie po slashu brak setki (przesuniecie). Rozpoznajemy prosto: predk zawiera '1/' tuz po literze i nazwa ma wzorzec \dK1/\d\dL
const fuldaLike=[];
for(const r of rows){
  const p=String(r.indeks_predkosci||''); 
  if(/^[A-Z]1\/[A-Z]$/i.test(p) && !/^A[0-9]\//i.test(p)){ // np. K1/L ale nie A8/..
    fuldaLike.push(r);
  }
}
console.log('FULDA-like (Xn/Y z cyfra tuz po literze, nie A-klasa):', fuldaLike.length);
for(const r of fuldaLike) console.log(`  [${r.dostawca}] ${r.kod} predk="${r.indeks_predkosci}" indeksy="${r.indeksy}" nazwa="${String(r.nazwa).slice(0,70)}"`);

// zero w indeks_2
const zero = db.prepare("SELECT COUNT(*) n FROM products WHERE indeks_2='0'").get().n;
const zeroIdx = db.prepare("SELECT COUNT(*) n FROM products WHERE indeksy='0'").get().n;
console.log('\nindeks_2=\"0\":', zero, '| indeksy=\"0\":', zeroIdx);
db.close();