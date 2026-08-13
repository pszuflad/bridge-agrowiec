const Database=require('better-sqlite3');
const db=new Database('data.db',{readonly:true});
const kody=[
 'MO9_336319',            // grupaA model:=bieznik
 'MO9_65581',             // grupaB nazwa CON STAR E
 'MO5_CCCR22538565K5SH0', // Continental HS5
 'MO5_CCCZ22538555K3SH1', // Continental HS3 ED
 'MO5_LLCR19538555JLLT0', // LINGLONG L-T10
 'MO5_LLCR22531570LRD30', // LINGLONG R-D30
 'MO5_HLRD080F16003MG50', // MRL Z-WIDE
 'MO5_IMCR22531580L12M1', // MIRAGE kolejnosc
 'MO3_23095R28AAIIRC110D10' // ALLIANCE ROW CROP
];
const q=db.prepare('SELECT kod,nazwa,model,bieznik FROM products WHERE kod=?');
for(const k of kody){const r=q.get(k); console.log(k); if(r){console.log('  nazwa :',r.nazwa); console.log('  model :',r.model); console.log('  biez  :',r.bieznik);} else console.log('  BRAK'); console.log();}
// kontrola: ile jeszcze niespojnosci model!=bieznik wsrod grupaA (powinno maleć)
db.close();
