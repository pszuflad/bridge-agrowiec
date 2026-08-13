const Database=require('better-sqlite3');
const fs=require('fs');
const db=new Database('data.db',{readonly:true});
const merges=JSON.parse(fs.readFileSync('merges_flat.json','utf8'));

// dry-run: dla kazdej pary src->target policz ile pozycji w bazie ma bieznik===src
let total=0, touchedA=0, touchedB=0;
const details=[];
const bymark={};
for(const m of merges){
  const rows=db.prepare('SELECT kod,marka,bieznik,model FROM products WHERE bieznik=?').all(m.src);
  if(rows.length>0){
    total+=rows.length;
    if(m.typ==='A') touchedA+=rows.length; else touchedB+=rows.length;
    details.push({...m, n:rows.length});
    bymark[m.marka]=(bymark[m.marka]||0)+rows.length;
  }
}
console.log('=== DRY-RUN SCALANIE BIEZNIKOW ===');
console.log('par src->target z trafieniami w bazie:',details.length,'/',merges.length);
console.log('pozycji do zmiany RAZEM:',total,'| TYP A:',touchedA,'| TYP B:',touchedB);
console.log('\n--- TYP B (krotki/dlugi) trafienia ---');
for(const d of details.filter(x=>x.typ==='B')){
  console.log(`  ${d.marka}: '${d.src}' -> '${d.target}'  (${d.n} poz.)`);
}
// sprawdz czy target istnieje jako bieznik (spojnosc)
console.log('\n--- czy TARGET juz istnieje w bazie? (TYP B) ---');
const seen=new Set();
for(const d of details.filter(x=>x.typ==='B')){
  if(seen.has(d.target))continue; seen.add(d.target);
  const c=db.prepare('SELECT COUNT(*) n FROM products WHERE bieznik=?').get(d.target).n;
  console.log(`  '${d.target}': ${c} poz. juz ma te nazwe`);
}
fs.writeFileSync('dryrun_wynik.json',JSON.stringify(details,null,1));
console.log('\nzapisano dryrun_wynik.json');
db.close();
