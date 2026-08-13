// Aktualizacja filtra MO2_JUNK_FILTER:
// odrzuca MO2 + kod 999991 gdy: brak EAN LUB marka pusta LUB marka wyglada jak rozmiar (bez nazwy producenta).
// Na wejsciu importu smieci maja marke pusta/null; dobre (JK Tyre, Goldencrown...) maja realna marke.
const fs = require('fs');
const FILE = '/home/admin/private_apps/bridge/index.cjs';
let src = fs.readFileSync(FILE, 'utf8');

const OLD =
  'let _jm=String((u&&u.marka!=null?u.marka:"")).trim();' +
  'let _jmSize=_jm!==""&&/[0-9]/.test(_jm)&&!/[A-Za-z]{3,}/.test(_jm);' +
  'if(_jt==="MO2"&&/999991/.test(_jk)&&(_je===""||_jmSize)){';

const NEW =
  'let _jm=String((u&&(u.marka!=null?u.marka:(u.producent!=null?u.producent:"")))).trim();' +
  'let _jmSize=_jm!==""&&/[0-9]/.test(_jm)&&!/[A-Za-z]{3,}/.test(_jm);' +
  'let _jmEmpty=_jm==="";' +
  'if(_jt==="MO2"&&/999991/.test(_jk)&&(_je===""||_jmEmpty||_jmSize)){';

if (!src.includes(OLD)) {
  if (src.includes('_jmEmpty')) { console.log('Warunek pustej marki juz obecny — pomijam.'); process.exit(0); }
  console.error('BLAD: nie znaleziono biezacego bloku marki do podmiany.'); process.exit(1);
}

const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
const bak = FILE + '.bak_pre_mo2_marka_empty_' + ts;
fs.copyFileSync(FILE, bak);
src = src.replace(OLD, NEW);
fs.writeFileSync(FILE, src, 'utf8');
console.log('Backup:', bak);
console.log('Zaktualizowano. _jmEmpty obecny:', src.includes('_jmEmpty'), '| producent fallback:', src.includes('u.producent!=null'));
