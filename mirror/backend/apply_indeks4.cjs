// apply_indeks4.cjs — pelna korekta 4 pozycji (indeks/nazwa) wg jawnej mapy
const Database = require('better-sqlite3');
const db = new Database('data.db');
const now = new Date().toISOString().replace('T',' ').slice(0,19);

// jawna mapa docelowa: kod -> { pole: nowa_wartosc }
const FIX = {
  'MO5_GFCZ22538565LWCC0': {
    nazwa: "385/65R22.5 FULDA WINTERCONTROL PROWADZĄCA 160K/158L TL M+S 3PMSF",
    indeks_nosnosci: "160/158", indeksy: "160K/158L", indeks_2: "K/L", indeks_predkosci: "K/L",
  },
  'MO5_GFCZ22531570LWCC0': {
    nazwa: "315/70R22.5 FULDA WINTERCONTROL PROWADZĄCA 154K/152L TL M+S 3PMSF",
    indeks_nosnosci: "154/152", indeksy: "154K/152L", indeks_2: "K/L", indeks_predkosci: "K/L",
  },
  'MO5_GFCZ22531570KWFC0': {
    nazwa: "315/70R22.5 FULDA WINTERFORCE NAPĘD 154K/152L TL M+S 3PMSF",
    indeks_nosnosci: "154/152", indeksy: "154K/152L", indeks_2: "K/L", indeks_predkosci: "K/L",
  },
  'MO2_CET0014': {
    indeks_2: "K", indeks_predkosci: "K",
  },
};

const ins = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");
let changed=0, hist=0;
const tx = db.transaction(()=>{
  for(const [kod, fields] of Object.entries(FIX)){
    const r = db.prepare("SELECT * FROM products WHERE kod=?").get(kod);
    if(!r){ console.log('BRAK', kod); continue; }
    for(const [pole, nv] of Object.entries(fields)){
      const old = r[pole];
      if(String(old) === String(nv)) continue; // juz OK
      db.prepare(`UPDATE products SET ${pole}=? WHERE kod=?`).run(nv, kod);
      ins.run(now, kod, r.nazwa, pole, old==null?'':String(old), String(nv), 'fix-indeks-nazwa', 'Anna');
      hist++; changed++;
      console.log(`  ${kod}  ${pole}: ${JSON.stringify(old)} -> ${JSON.stringify(nv)}`);
    }
  }
});
tx();
console.log(`\nZmian pol: ${changed} | wpisow historii: ${hist}`);

// weryfikacja koncowa
console.log('\n=== STAN PO ===');
for(const kod of Object.keys(FIX)){
  const r = db.prepare("SELECT kod,nazwa,indeks_nosnosci,indeks_predkosci,konstrukcja,indeksy,indeks_2 FROM products WHERE kod=?").get(kod);
  console.log(`  ${r.kod}: nosn=${r.indeks_nosnosci} predk=${r.indeks_predkosci} konstr=${r.konstrukcja} indeksy=${r.indeksy} idx2=${r.indeks_2}`);
  console.log(`     nazwa: ${r.nazwa}`);
}
db.close();
