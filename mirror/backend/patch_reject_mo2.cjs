// Wstawia filtr odrzucajacy smieciowe pozycje MO2 na poczatku petli importu w aktywnej funkcji tk.
// Kryterium (kombinacja): dostawca MO2 + kod dostawcy zaczyna sie od 999991 + EAN zaczyna sie od 044000012.
// Odrzucone NIE trafiaja ani do stagingu, ani do katalogu.
const fs = require('fs');
const FILE = '/home/admin/private_apps/bridge/index.cjs';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('MO2_JUNK_FILTER')) {
  console.log('PATCH JUZ OBECNY — pomijam.');
  process.exit(0);
}

// Zakotwicz sie w AKTYWNEJ funkcji tk (tk=function), potem pierwsze "for(let u of e){" po niej.
const tkPos = src.indexOf('tk=function');
if (tkPos < 0) { console.error('BLAD: nie znaleziono tk=function'); process.exit(1); }
const anchor = 'for(let u of e){';
const loopPos = src.indexOf(anchor, tkPos);
if (loopPos < 0) { console.error('BLAD: nie znaleziono petli for(let u of e){ w tk'); process.exit(1); }

// dodaj licznik do obiektu statystyk i (osobno) filtr na poczatku petli
// 1) licznik: rozszerz inicjalizacje i o pole odrzuconeSmieciMO2
const statAnchor = 'odrzuconeBrakDanych:0,';
const statPos = src.indexOf(statAnchor, tkPos);
if (statPos < 0) { console.error('BLAD: nie znaleziono inicjalizacji statystyk'); process.exit(1); }

// filtr wstawiany zaraz po "for(let u of e){"
const filter =
  '/*MO2_JUNK_FILTER*/{let _jt=String(t||"").toUpperCase();' +
  'let _jk=String(u&&u.kod!=null?u.kod:"").trim().replace(/^MO2_/i,"");' +
  'let _je=String(u&&u.ean!=null?u.ean:"").replace(/\\s+/g,"");' +
  'if(_jt==="MO2"&&/^999991/.test(_jk)&&/^044000012/.test(_je)){' +
  'i.odrzuconeSmieciMO2=(i.odrzuconeSmieciMO2||0)+1;' +
  'i.szczegolyOdrzuconych.push({nazwa:String((u&&u.nazwa)||"(bez nazwy)"),powod:"smieciowa pozycja MO2 (kod 999991 + EAN 044000012) - odrzucona przy imporcie"});' +
  'continue;}}';

const insCounter = statAnchor + 'odrzuconeSmieciMO2:0,';
let out = src.slice(0, statPos) + insCounter + src.slice(statPos + statAnchor.length);

// pozycja petli przesuwa sie o dlugosc dodanego licznika
const shift = insCounter.length - statAnchor.length;
const loopPos2 = loopPos + shift;
if (out.slice(loopPos2, loopPos2 + anchor.length) !== anchor) {
  console.error('BLAD: kotwica petli nie zgadza sie po dodaniu licznika. Przerywam.');
  process.exit(1);
}
out = out.slice(0, loopPos2 + anchor.length) + filter + out.slice(loopPos2 + anchor.length);

// backup + zapis
const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
const bak = FILE + '.bak_pre_mo2_junk_filter_' + ts;
fs.copyFileSync(FILE, bak);
fs.writeFileSync(FILE, out, 'utf8');
console.log('Backup:', bak);
console.log('Wstawiono licznik + filtr. Roznica dlugosci:', out.length - src.length, 'znakow.');
console.log('Weryfikacja markera:', out.includes('MO2_JUNK_FILTER'));
