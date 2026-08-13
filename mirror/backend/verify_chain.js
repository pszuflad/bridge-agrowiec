
const D=require('better-sqlite3');
const fs=require('fs');
const db=new D('data.db');
const map=JSON.parse(fs.readFileSync('kod_link_map.json','utf8'));
const kods=fs.readFileSync('sample_kods.txt','utf8').trim().split('\n');
console.log('KOD | CSV_link? | w_DB? | DB_link_zgodny? | istnieje_w_products?');
for(const k of kods){
  const csv=map[k];
  const row=db.prepare("SELECT kod,link_zdjecia FROM products WHERE kod=?").get(k);
  const inDb = !!row;
  const dbLink = row ? row.link_zdjecia : null;
  const match = csv && dbLink && csv===dbLink;
  console.log(`${k} | csv=${csv?csv.slice(0,45):'BRAK'} | inProducts=${inDb} | dbLink=${dbLink?dbLink.slice(0,45):'NULL'} | zgodny=${match}`);
}
// podsumowanie: ile z CSV kodów w ogóle istnieje w products
let inProd=0, withLink=0, notInProd=0;
for(const k of Object.keys(map)){
  const row=db.prepare("SELECT link_zdjecia FROM products WHERE kod=?").get(k);
  if(row){inProd++; if(row.link_zdjecia) withLink++;} else notInProd++;
}
console.log(`\nCSV kodów: ${Object.keys(map).length}`);
console.log(`  w products: ${inProd}`);
console.log(`  z tego z linkiem: ${withLink}`);
console.log(`  NIE ma w products: ${notInProd}`);
db.close();
