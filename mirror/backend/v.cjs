const d=require('better-sqlite3')('data.db',{readonly:true});
function Gq(overrides, fileRec){ let r={...fileRec},a=[]; for(let s of overrides){ let o=fileRec[s.field_name]; if(o!=null && String(o)!==s.override_value){ if(s.acknowledged_source_value==null||String(o)!==String(s.acknowledged_source_value)){a.push(s.field_name);} } r[s.field_name]=s.override_value; } return {rec:r,naruszono:a}; }
const k=d.prepare("SELECT kod_produktu FROM history WHERE data LIKE '2026-07-22%' AND zrodlo='fix-zero-indeks' LIMIT 1").get().kod_produktu;
const ov=d.prepare("SELECT field_name,override_value,acknowledged_source_value FROM manual_overrides WHERE supplier_product_id=?").all(k);
// plik przysyla znowu "0"
let r=Gq(ov, {indeks2:'0', indeksy:'0'});
console.log('poz:', k);
console.log('  po imporcie (plik="0"): indeks2="%s" indeksy="%s"', r.rec.indeks2, r.rec.indeksy);
console.log('  konflikt:', JSON.stringify(r.naruszono), '(pusty = brak falszywego alertu)');
d.close();