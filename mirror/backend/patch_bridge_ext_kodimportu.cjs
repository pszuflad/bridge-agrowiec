// Dopisuje funkcje assignKodImportu do bridge_ext.cjs + eksport
const fs = require('fs');
const F = 'bridge_ext.cjs';
let s = fs.readFileSync(F, 'utf8');

if (s.includes('function assignKodImportu')) { console.log('assignKodImportu: juz istnieje'); process.exit(0); }

const fn = `
// --- kod_importu (wielomagazynowosc Selly) -------------------------------
// Wspolny 6-cyfrowy numer dla tego samego produktu we wszystkich magazynach.
// Klucz grupujacy: EAN (gdy poprawny) LUB producent|rozmiar|bieznik|nazwa (znormalizowane).
// Logika: 1) istniejacy produkt (ten sam kod) zachowuje swoj numer;
//         2) inny magazyn tego samego produktu dziedziczy numer z grupy;
//         3) nowy produkt dostaje nowy, unikalny numer.
// Wywolywac PRZED zapisem produktu; ustawia P.kodImportu.
function _kiNorm(v){ return String(v==null?'':v).toLowerCase().replace(/\\s+/g,' ').trim(); }
function _kiGroupKey(P){
  const eanOk = P.ean && String(P.ean).trim()!=='' && (P.eanIsValid===1||P.eanIsValid===true);
  if (eanOk) return 'EAN:'+String(P.ean).trim();
  return 'FB:'+[_kiNorm(P.marka),_kiNorm(P.rozmiar),_kiNorm(P.bieznik),_kiNorm(P.nazwa)].join('|');
}
function _kiGenUnique(db){
  for(let i=0;i<100000;i++){
    const n=String(Math.floor(100000+Math.random()*900000));
    const hit=db.prepare('SELECT 1 FROM products WHERE kod_importu=? LIMIT 1').get(n);
    if(!hit) return n;
  }
  throw new Error('brak wolnych numerow kod_importu');
}
function assignKodImportu(db, P, existing){
  try{
    if(!db||!P) return;
    // 1) istniejacy produkt (ten sam kod) ma juz numer -> zachowaj
    if(existing && existing.kod_importu && /^\\d{6}$/.test(String(existing.kod_importu))){
      P.kodImportu = String(existing.kod_importu); return;
    }
    // 2) poszukaj w katalogu innego rekordu tej samej grupy
    const eanOk = P.ean && String(P.ean).trim()!=='' && (P.eanIsValid===1||P.eanIsValid===true);
    let row=null;
    if(eanOk){
      row=db.prepare("SELECT kod_importu FROM products WHERE ean=? AND ean_is_valid=1 AND kod_importu IS NOT NULL AND kod_importu!='' LIMIT 1").get(String(P.ean).trim());
    } else {
      row=db.prepare("SELECT kod_importu FROM products WHERE (ean IS NULL OR ean='' OR ean_is_valid IS NOT 1) AND lower(trim(COALESCE(marka,'')))=? AND lower(trim(COALESCE(rozmiar,'')))=? AND lower(trim(COALESCE(bieznik,'')))=? AND lower(trim(COALESCE(nazwa,'')))=? AND kod_importu IS NOT NULL AND kod_importu!='' LIMIT 1")
        .get(_kiNorm(P.marka),_kiNorm(P.rozmiar),_kiNorm(P.bieznik),_kiNorm(P.nazwa));
    }
    if(row && row.kod_importu && /^\\d{6}$/.test(String(row.kod_importu))){
      P.kodImportu = String(row.kod_importu); return;
    }
    // 3) nowy produkt -> nowy unikalny numer
    P.kodImportu = _kiGenUnique(db);
  }catch(_){ /* defensywnie: nie wywracaj importu */ }
}
`;

// wstaw przed module.exports
const anchor = 'module.exports = {';
s = s.replace(anchor, fn + '\n' + anchor);
// dodaj do eksportu
s = s.replace('module.exports = { applyDims, applyLinkMemory, rememberLink, ensureMemoryTables, mrKey };',
              'module.exports = { applyDims, applyLinkMemory, rememberLink, ensureMemoryTables, mrKey, assignKodImportu };');

fs.writeFileSync(F, s);
console.log('assignKodImportu dodane. Nowy rozmiar:', s.length);
