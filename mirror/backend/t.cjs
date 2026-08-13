const d=require('better-sqlite3')('data.db',{readonly:true});
// symulacja Gq z test_ack.cjs
function Gq(overrides, fileRec){ let r={...fileRec},a=[]; for(let s of overrides){ let o=fileRec[s.field_name]; if(o!=null && String(o)!==s.override_value){ if(s.acknowledged_source_value==null||String(o)!==String(s.acknowledged_source_value)){a.push(s.field_name);} } r[s.field_name]=s.override_value; } return {rec:r,naruszono:a}; }
function ov(kod){ return d.prepare("SELECT field_name,override_value,acknowledged_source_value FROM manual_overrides WHERE supplier_product_id=?").all(kod); }

// TEST 1: FULDA - plik przysyla STARA zla nazwe/indeks -> override wymusza poprawna
const k1='MO5_GFCZ22531570LWCC0';
let r1=Gq(ov(k1), {indeksPredkosci:'K1/L', indeks2:'K1/L', indeksy:'154K1/52L', nazwa:'315/70R22.5 FULDA WINTERCONTROL PROWADZĄCA 154K1/52L TL M+S 3PMSF'});
console.log('FULDA po imporcie: predk=%s idx2=%s indeksy=%s', r1.rec.indeksPredkosci, r1.rec.indeks2, r1.rec.indeksy);
console.log('  konflikt(naruszono):', JSON.stringify(r1.naruszono));

// TEST 2: kategoria - plik przysyla mala litere 'ciezarowe' -> override wymusza 'Ciężarowe'
const k2='MO2_CET0048';
let r2=Gq(ov(k2), {kategoria:'ciezarowe', zastosowanie:null});
console.log('\nkategoria po imporcie:', r2.rec.kategoria, '| zastosowanie:', r2.rec.zastosowanie);

// TEST 3: szerokosc - plik przysyla przeliczone mm zamiast pierwszej liczby
const k3=d.prepare("SELECT kod_produktu FROM history WHERE data LIKE '2026-07-22%' AND zrodlo='fix-szerokosc' LIMIT 1").get().kod_produktu;
const cur=d.prepare("SELECT szerokosc,rozmiar FROM products WHERE kod=?").get(k3);
let r3=Gq(ov(k3), {szerokosc:'999'});
console.log('\nszerokosc %s (rozmiar %s) po imporcie: %s (plik chcial 999)', k3, cur.rozmiar, r3.rec.szerokosc);
d.close();