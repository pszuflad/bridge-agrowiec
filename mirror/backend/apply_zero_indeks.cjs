// apply_zero_indeks.cjs — zamien indeks_2='0' i indeksy='0' na NULL, log historii
const Database = require('better-sqlite3');
const db = new Database('data.db');
const now = new Date().toISOString().replace('T',' ').slice(0,19);

const rows = db.prepare("SELECT kod,nazwa,indeks_2,indeksy FROM products WHERE indeks_2='0' OR indeksy='0'").all();
const ins = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");
const updI2 = db.prepare("UPDATE products SET indeks_2=NULL WHERE kod=?");
const updIdx = db.prepare("UPDATE products SET indeksy=NULL WHERE kod=?");

let hist=0, recs=0;
const tx = db.transaction(()=>{
  for(const r of rows){
    let touched=false;
    if(String(r.indeks_2)==='0'){ updI2.run(r.kod); ins.run(now,r.kod,r.nazwa,'indeks_2','0','', 'fix-zero-indeks','Anna'); hist++; touched=true; }
    if(String(r.indeksy)==='0'){ updIdx.run(r.kod); ins.run(now,r.kod,r.nazwa,'indeksy','0','', 'fix-zero-indeks','Anna'); hist++; touched=true; }
    if(touched) recs++;
  }
});
tx();
console.log(`Rekordow: ${recs} | wpisow historii: ${hist}`);
const z2 = db.prepare("SELECT COUNT(*) n FROM products WHERE indeks_2='0'").get().n;
const zi = db.prepare("SELECT COUNT(*) n FROM products WHERE indeksy='0'").get().n;
console.log(`pozostalo indeks_2='0': ${z2} | indeksy='0': ${zi}`);
db.close();
