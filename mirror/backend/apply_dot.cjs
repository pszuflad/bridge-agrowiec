const D=require('better-sqlite3');
const db=new D('/home/admin/private_apps/bridge/data.db');
const now = new Date().toISOString().replace('T',' ').slice(0,19);
const NEW = 'starsza niż 3 lata';

const rows = db.prepare("SELECT kod,nazwa,dot FROM products WHERE UPPER(nazwa) LIKE '%DOT%'").all();
console.log('pozycji z DOT w nazwie:', rows.length);

const upd = db.prepare("UPDATE products SET dot=? WHERE kod=?");
const hist = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");

let n=0, h=0;
const tx = db.transaction(()=>{
  for(const r of rows){
    if(r.dot !== NEW){
      upd.run(NEW, r.kod);
      hist.run(now, r.kod, r.nazwa, 'dot', r.dot, NEW, 'regula-DOT-nazwa', 'Anna');
      h++;
    }
    n++;
  }
});
tx();
console.log('zaktualizowano:', h, 'z', n);

// weryfikacja
console.log('\n=== WERYFIKACJA ===');
const chk = db.prepare("SELECT kod,nazwa,dot FROM products WHERE UPPER(nazwa) LIKE '%DOT%'").all();
for(const r of chk) console.log(`${r.kod}: dot="${r.dot}"  <- ${r.nazwa}`);
db.close();
