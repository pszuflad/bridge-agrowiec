const D=require('better-sqlite3');
const db=new D('/home/admin/private_apps/bridge/data.db',{readonly:true});
const dbl=db.prepare("SELECT COUNT(*) c FROM products WHERE (bieznik GLOB '*[0-9][0-9]/[0-9]*' OR model GLOB '*[0-9][0-9]/[0-9]*')").get();
const tl=db.prepare("SELECT COUNT(*) c FROM products WHERE bieznik LIKE '% TL' OR bieznik LIKE '% TT' OR model LIKE '% TL' OR model LIKE '% TT'").get();
const naped=db.prepare("SELECT COUNT(*) c FROM products WHERE bieznik LIKE '%NAP%D%' OR model LIKE '%NAP%D%'").get();
const h=db.prepare("SELECT COUNT(*) c FROM history WHERE zrodlo='czyszczenie-anomalii'").get();
console.log('pozostaly dblIdx ( z ukosnikiem):', dbl.c);
console.log('sufiks TL/TT na koncu:', tl.c);
console.log('NAPED:', naped.c);
console.log('wpisy history (czyszczenie-anomalii):', h.c);
// pokaz co jeszcze ma dblIdx (jesli cos)
if(dbl.c>0){
  const s=db.prepare("SELECT kod,bieznik,model FROM products WHERE (bieznik GLOB '*[0-9][0-9]/[0-9]*' OR model GLOB '*[0-9][0-9]/[0-9]*') LIMIT 20").all();
  console.log('przyklady dblIdx:'); s.forEach(r=>console.log(' ',r.kod,'| b:',r.bieznik,'| m:',r.model));
}
if(tl.c>0){
  const s=db.prepare("SELECT kod,bieznik,model FROM products WHERE bieznik LIKE '% TL' OR model LIKE '% TL' LIMIT 20").all();
  console.log('przyklady TL:'); s.forEach(r=>console.log(' ',r.kod,'| b:',r.bieznik,'| m:',r.model));
}
