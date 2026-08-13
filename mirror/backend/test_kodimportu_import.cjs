const D = require('better-sqlite3');
const db = new D('data.db'); // read-write ale test nie zapisuje produktow
const ext = require('./bridge_ext.cjs');
let res = [];

// Wez realny istniejacy produkt z EAN i jego kod_importu
const real = db.prepare("SELECT kod,ean,ean_is_valid,marka,rozmiar,bieznik,nazwa,kod_importu FROM products WHERE ean IS NOT NULL AND ean!='' AND ean_is_valid=1 AND kod_importu IS NOT NULL LIMIT 1").get();
console.log('REALNY produkt:', real.kod, '| EAN', real.ean, '| kod_importu', real.kod_importu);

// (a) istniejacy produkt (ten sam kod) -> zachowuje numer
{ let P={ean:real.ean,eanIsValid:1,marka:real.marka,rozmiar:real.rozmiar,bieznik:real.bieznik,nazwa:real.nazwa,kod:real.kod};
  let existing={kod_importu:real.kod_importu};
  ext.assignKodImportu(db,P,existing);
  res.push(['(a) istniejacy kod zachowuje numer', P.kodImportu===String(real.kod_importu), 'got='+P.kodImportu+' exp='+real.kod_importu]); }

// (b) nowy magazyn tego samego produktu (inny kod, ten sam EAN, brak existing) -> dziedziczy numer z grupy
{ let P={ean:real.ean,eanIsValid:1,marka:real.marka,rozmiar:real.rozmiar,bieznik:real.bieznik,nazwa:real.nazwa,kod:'__NOWY_MAG__'+real.kod};
  ext.assignKodImportu(db,P,null);
  res.push(['(b) nowy magazyn dziedziczy numer z EAN', P.kodImportu===String(real.kod_importu), 'got='+P.kodImportu+' exp='+real.kod_importu]); }

// (c) zupelnie nowy produkt (nieistniejacy EAN) -> nowy unikalny numer
{ let fakeEan='9990000'+String(Math.floor(100000+Math.random()*899999));
  let P={ean:fakeEan,eanIsValid:1,marka:'TESTMARKA',rozmiar:'999/99R99',bieznik:'TESTBIEZNIK',nazwa:'TEST NOWY PRODUKT',kod:'__NOWY_PROD__'};
  ext.assignKodImportu(db,P,null);
  let is6=/^\d{6}$/.test(String(P.kodImportu));
  let notUsedByOther = !db.prepare('SELECT 1 FROM products WHERE kod_importu=? LIMIT 1').get(P.kodImportu);
  res.push(['(c) nowy produkt: 6 cyfr', is6, 'got='+P.kodImportu]);
  res.push(['(c) nowy produkt: numer nie istnieje w katalogu', notUsedByOther, 'unikalny='+notUsedByOther]); }

// (d) nowy produkt bez EAN (fallback) -> nowy numer (chyba ze fallback trafi w istniejaca grupe)
{ let P={ean:null,eanIsValid:null,marka:'ZZZUNIKAT',rozmiar:'111/11R11',bieznik:'ZZZ',nazwa:'ZZZ UNIKALNA NAZWA TEST',kod:'__FB_NEW__'};
  ext.assignKodImportu(db,P,null);
  res.push(['(d) nowy fallback: 6 cyfr', /^\d{6}$/.test(String(P.kodImportu)), 'got='+P.kodImportu]); }

db.close();
let ok=0; for(const [n,p,i] of res){ if(p)ok++; console.log((p?'PASS':'FAIL'),n,'->',i); }
console.log('\nWynik: '+ok+'/'+res.length);
