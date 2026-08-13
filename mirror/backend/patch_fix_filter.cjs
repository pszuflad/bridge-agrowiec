// Koryguje kryterium filtra MO2_JUNK_FILTER wg realnych danych:
// Odrzuca: dostawca MO2 + kod zawiera 999991 + BRAK EAN (null/pusty).
// Chroni dobre opony MO2 (maja realny kod lub realny EAN 0440000...).
const fs = require('fs');
const FILE = '/home/admin/private_apps/bridge/index.cjs';
let src = fs.readFileSync(FILE, 'utf8');

// Stary blok filtra (dokladnie taki jak wstawiony wczesniej)
const OLD =
  '/*MO2_JUNK_FILTER*/{let _jt=String(t||"").toUpperCase();' +
  'let _jk=String(u&&u.kod!=null?u.kod:"").trim().replace(/^MO2_/i,"");' +
  'let _je=String(u&&u.ean!=null?u.ean:"").replace(/\\s+/g,"");' +
  'if(_jt==="MO2"&&/^999991/.test(_jk)&&/^044000012/.test(_je)){' +
  'i.odrzuconeSmieciMO2=(i.odrzuconeSmieciMO2||0)+1;' +
  'i.szczegolyOdrzuconych.push({nazwa:String((u&&u.nazwa)||"(bez nazwy)"),powod:"smieciowa pozycja MO2 (kod 999991 + EAN 044000012) - odrzucona przy imporcie"});' +
  'continue;}}';

// Nowy blok: MO2 + kod zawiera 999991 + brak EAN
const NEW =
  '/*MO2_JUNK_FILTER*/{let _jt=String(t||"").toUpperCase();' +
  'let _jk=String(u&&u.kod!=null?u.kod:"").trim().replace(/^MO2_/i,"");' +
  'let _je=String((u&&(u.ean!=null?u.ean:u.ean_raw))||"").replace(/\\s+/g,"");' +
  'if(_jt==="MO2"&&/999991/.test(_jk)&&_je===""){' +
  'i.odrzuconeSmieciMO2=(i.odrzuconeSmieciMO2||0)+1;' +
  'i.szczegolyOdrzuconych.push({nazwa:String((u&&u.nazwa)||"(bez nazwy)"),powod:"smieciowa pozycja MO2 (kod 999991 bez EAN) - odrzucona przy imporcie"});' +
  'continue;}}';

if (!src.includes(OLD)) {
  if (src.includes(NEW)) { console.log('NOWY filtr juz obecny — pomijam.'); process.exit(0); }
  console.error('BLAD: nie znaleziono starego bloku filtra do podmiany.'); process.exit(1);
}

const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
const bak = FILE + '.bak_pre_mo2_filter_fix_' + ts;
fs.copyFileSync(FILE, bak);
src = src.replace(OLD, NEW);
fs.writeFileSync(FILE, src, 'utf8');
console.log('Backup:', bak);
console.log('Filtr poprawiony. Marker obecny:', src.includes('MO2_JUNK_FILTER'), '| nowy warunek obecny:', src.includes('/999991/.test(_jk)&&_je===""'));
