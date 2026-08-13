// diag_indeks_anomalie.cjs — szukaj anomalii w kolumnach indeksowych
const Database = require('better-sqlite3');
const db = new Database('data.db', { readonly: true });
const rows = db.prepare("SELECT kod,dostawca,nazwa,rozmiar,indeks_nosnosci,indeks_predkosci,konstrukcja,indeksy,indeks_1,indeks_2 FROM products").all();

const A_slashLead=[];   // wartosc zaczyna sie od '/' np. '/K'  (jak CETROC)
const B_letterDigit=[]; // predkosc/idx2 typu 'K1/L' litera+cyfra przed / (jak FULDA)
const C_predkStrange=[];// indeks_predkosci zawiera cyfre (nietypowe dla indeksu predkosci)
const D_idx2Strange=[]; // indeks_2 z cyframi lub dziwne
const E_pusteAleNazwa=[];// indeks_predkosci pusty ale w nazwie widac indeks

for(const r of rows){
  const p = r.indeks_predkosci==null?'':String(r.indeks_predkosci).trim();
  const i2 = r.indeks_2==null?'':String(r.indeks_2).trim();
  const idx = r.indeksy==null?'':String(r.indeksy).trim();

  if(/^\//.test(p) || /^\//.test(i2)) A_slashLead.push(r);
  if(/[A-Z]\d+\//i.test(p) || /[A-Z]\d+\//i.test(i2) || /[A-Z]\d+\//i.test(idx)) B_letterDigit.push(r);
  // indeks_predkosci powinien byc litera(y) opcjonalnie ze slashem: dozwolone np. K, L, K/L, A8, B, D itd.
  // podejrzane: zawiera cyfre POMIEDZY literami lub konczy sie cyfra przy pojedynczym czlonie
  if(p && !/^[A-Z]{1,2}\d?(\/[A-Z]{1,2}\d?)?$/i.test(p)) C_predkStrange.push(r);
  if(i2 && !/^[A-Z]{1,2}\d?(\/[A-Z]{1,2}\d?)?$/i.test(i2)) D_idx2Strange.push(r);
}

function show(title, arr, lim=40){
  console.log(`\n=== ${title}: ${arr.length} ===`);
  for(const r of arr.slice(0,lim))
    console.log(`  [${r.dostawca}] ${r.kod}  predk="${r.indeks_predkosci}" idx2="${r.indeks_2}" indeksy="${r.indeksy}" nosn="${r.indeks_nosnosci}"`);
  if(arr.length>lim) console.log(`  ... i ${arr.length-lim} wiecej`);
}
show("A. Zaczyna sie od '/' (typ CETROC /K)", A_slashLead);
show("B. litera+cyfra przed '/' (typ FULDA K1/L)", B_letterDigit);
show("C. indeks_predkosci nietypowy format", C_predkStrange);
show("D. indeks_2 nietypowy format", D_idx2Strange);

db.close();
