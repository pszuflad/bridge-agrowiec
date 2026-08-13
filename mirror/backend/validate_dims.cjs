const {calcDims}=require('/home/admin/private_apps/bridge/tire_dims.js');
const Database=require('better-sqlite3');
const db=new Database('/home/admin/private_apps/bridge/data.db',{readonly:true});
const rows=db.prepare("SELECT rozmiar,wysokosc FROM products WHERE rozmiar IS NOT NULL AND rozmiar!=''").all();
let ok=0,bad=0,none=0,ex=[],bigdiff=[];
for(const r of rows){
  const d=calcDims(r.rozmiar);
  if(!d){none++; if(ex.length<25)ex.push(r.rozmiar); continue;}
  const diff=Math.abs(d.height_cm - r.wysokosc);
  if(diff<=2) ok++;
  else { bad++; if(bigdiff.length<30) bigdiff.push({rozmiar:r.rozmiar,stored:r.wysokosc,calc:d.height_cm,kind:d.kind,diff:Math.round(diff*10)/10}); }
}
console.log(`total ${rows.length}: height-match(±2cm) ${ok}, mismatch ${bad}, unparseable ${none}`);
console.log('UNPARSEABLE sample:', JSON.stringify([...new Set(ex)]));
console.log('MISMATCH sample (recomputed vs stored):');
for(const e of bigdiff) console.log('   ',JSON.stringify(e));
db.close();
