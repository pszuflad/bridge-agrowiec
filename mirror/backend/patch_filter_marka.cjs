// Rozszerza filtr MO2_JUNK_FILTER: odrzuca MO2 + kod 999991 gdy (brak EAN) LUB (marka wyglada jak rozmiar opony).
// marka=rozmiar => zawiera cyfry i NIE zawiera nazwy producenta (brak sekwencji >=3 liter).
const fs = require('fs');
const FILE = '/home/admin/private_apps/bridge/index.cjs';
let src = fs.readFileSync(FILE, 'utf8');

const OLD =
  '/*MO2_JUNK_FILTER*/{let _jt=String(t||"").toUpperCase();' +
  'let _jk=String(u&&u.kod!=null?u.kod:"").trim().replace(/^MO2_/i,"");' +
  'let _je=String((u&&(u.ean!=null?u.ean:u.ean_raw))||"").replace(/\\s+/g,"");' +
  'if(_jt==="MO2"&&/999991/.test(_jk)&&_je===""){' +
  'i.odrzuconeSmieciMO2=(i.odrzuconeSmieciMO2||0)+1;' +
  'i.szczegolyOdrzuconych.push({nazwa:String((u&&u.nazwa)||"(bez nazwy)"),powod:"smieciowa pozycja MO2 (kod 999991 bez EAN) - odrzucona przy imporcie"});' +
  'continue;}}';

const NEW =
  '/*MO2_JUNK_FILTER*/{let _jt=String(t||"").toUpperCase();' +
  'let _jk=String(u&&u.kod!=null?u.kod:"").trim().replace(/^MO2_/i,"");' +
  'let _je=String((u&&(u.ean!=null?u.ean:u.ean_raw))||"").replace(/\\s+/g,"");' +
  'let _jm=String((u&&u.marka!=null?u.marka:"")).trim();' +
  'let _jmSize=_jm!==""&&/[0-9]/.test(_jm)&&!/[A-Za-z]{3,}/.test(_jm);' +
  'if(_jt==="MO2"&&/999991/.test(_jk)&&(_je===""||_jmSize)){' +
  'i.odrzuconeSmieciMO2=(i.odrzuconeSmieciMO2||0)+1;' +
  'i.szczegolyOdrzuconych.push({nazwa:String((u&&u.nazwa)||"(bez nazwy)"),powod:"smieciowa pozycja MO2 (kod 999991 + brak EAN lub marka=rozmiar) - odrzucona przy imporcie"});' +
  'continue;}}';

if (!src.includes(OLD)) {
  if (src.includes(NEW)) { console.log('NOWY (rozszerzony) filtr juz obecny — pomijam.'); process.exit(0); }
  console.error('BLAD: nie znaleziono biezacego bloku filtra do podmiany.'); process.exit(1);
}

const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
const bak = FILE + '.bak_pre_mo2_marka_filter_' + ts;
fs.copyFileSync(FILE, bak);
src = src.replace(OLD, NEW);
fs.writeFileSync(FILE, src, 'utf8');
console.log('Backup:', bak);
console.log('Filtr rozszerzony. Marker:', src.includes('MO2_JUNK_FILTER'), '| warunek marka:', src.includes('_jmSize'));
