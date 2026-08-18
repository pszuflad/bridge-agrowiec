// audit.cjs - przeglad merytoryczny katalogu products pod katem anomalii
'use strict';
const D = require('better-sqlite3');
const db = new D('/home/admin/private_apps/bridge/data.db', { readonly: true });
const all = db.prepare('SELECT * FROM products').all();
const N = all.length;
const R = []; // raport
function add(sev, kat, msg, przyklady) { R.push({ sev, kat, msg, przyklady: przyklady || [] }); }

// helpery
const isNum = v => v !== null && v !== '' && !isNaN(Number(String(v).replace(',', '.')));
const ctrlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const replacementChar = /\uFFFD/;              // znak zastepczy = zly encoding
const weirdWhitespace = /[\u00A0\u200B\u2028\u2029]/; // nbsp, zero-width itd.
const htmlEntity = /&(amp|lt|gt|quot|#\d+);/i;
const doubleEnc = /Ã.|Å.|â€/;                  // typowe podw. kodowanie UTF8->latin1

// 1) puste kluczowe pola
for (const key of ['kod', 'nazwa', 'marka', 'kategoria']) {
  const puste = all.filter(p => p[key] === null || String(p[key]).trim() === '');
  if (puste.length) add(puste.length > N * 0.02 ? 'HIGH' : 'MED', 'puste_' + key,
    `${puste.length} produktow z pustym polem '${key}'`, puste.slice(0, 5).map(p => p.kod || p.id));
}

// 2) duplikaty kod
const kodMap = {};
for (const p of all) { const k = p.kod; if (!k) continue; (kodMap[k] = kodMap[k] || []).push(p.id); }
const dupKod = Object.entries(kodMap).filter(([k, v]) => v.length > 1);
if (dupKod.length) add('HIGH', 'dup_kod', `${dupKod.length} zduplikowanych kodow`, dupKod.slice(0, 5).map(([k, v]) => k + '(' + v.length + 'x)'));

// 3) niedozwolone / dziwne znaki w polach tekstowych
const textCols = ['kod', 'nazwa', 'marka', 'kategoria', 'model', 'zastosowanie', 'rozmiar', 'bieznik', 'ean'];
for (const col of textCols) {
  const ctrl = [], repl = [], ws = [], html = [], denc = [];
  for (const p of all) {
    const v = p[col]; if (v === null) continue; const s = String(v);
    if (ctrlChars.test(s)) ctrl.push(p.kod);
    if (replacementChar.test(s)) repl.push(p.kod);
    if (weirdWhitespace.test(s)) ws.push(p.kod);
    if (htmlEntity.test(s)) html.push(p.kod);
    if (doubleEnc.test(s)) denc.push(p.kod);
  }
  if (ctrl.length) add('HIGH', 'znaki_kontrolne', `${col}: ${ctrl.length} wartosci ze znakami kontrolnymi`, ctrl.slice(0, 5));
  if (repl.length) add('HIGH', 'zly_encoding', `${col}: ${repl.length} wartosci ze znakiem zastepczym \uFFFD`, repl.slice(0, 5));
  if (ws.length) add('MED', 'dziwne_spacje', `${col}: ${ws.length} wartosci z nbsp/zero-width`, ws.slice(0, 5));
  if (html.length) add('MED', 'html_entity', `${col}: ${html.length} wartosci z encjami HTML`, html.slice(0, 5));
  if (denc.length) add('HIGH', 'podw_kodowanie', `${col}: ${denc.length} wartosci z podwojnym kodowaniem (Ã/Å/â€)`, denc.slice(0, 5));
}

// 4) whitespace na brzegach (trim)
for (const col of ['kod', 'nazwa', 'marka', 'kategoria', 'model', 'zastosowanie']) {
  const bad = all.filter(p => p[col] !== null && String(p[col]) !== String(p[col]).trim());
  if (bad.length) add('MED', 'trim', `${col}: ${bad.length} wartosci ze spacja na poczatku/koncu`, bad.slice(0, 5).map(p => JSON.stringify(p[col]).slice(0, 30)));
}

// 5) pomieszane kolumny - liczby w polu tekstowym marka/kategoria (sama liczba)
for (const col of ['marka', 'kategoria', 'model']) {
  const onlyNum = all.filter(p => p[col] !== null && String(p[col]).trim() !== '' && isNum(p[col]));
  if (onlyNum.length) add('MED', 'liczba_w_tekscie', `${col}: ${onlyNum.length} wartosci to sama liczba (mozliwe przesuniecie kolumn)`, onlyNum.slice(0, 5).map(p => p.kod + '=' + p[col]));
}

// 6) pola liczbowe zawierajace tekst / zakresy
for (const col of ['stan', 'cena_zakupu', 'cena_sprzedazy', 'vat', 'marza_pct']) {
  const bad = all.filter(p => p[col] !== null && p[col] !== '' && isNaN(Number(p[col])));
  if (bad.length) add('HIGH', 'tekst_w_liczbie', `${col}: ${bad.length} wartosci nieliczbowych`, bad.slice(0, 5).map(p => p.kod + '=' + JSON.stringify(p[col])));
}

// 7) ceny/vat poza sensownym zakresem
const cenaUjemna = all.filter(p => p.cena_zakupu < 0 || p.cena_sprzedazy < 0);
if (cenaUjemna.length) add('HIGH', 'cena_ujemna', `${cenaUjemna.length} produktow z ujemna cena`, cenaUjemna.slice(0, 5).map(p => p.kod));
const cenaZero = all.filter(p => (p.cena_sprzedazy === 0 || p.cena_sprzedazy === null) && p.status === 'aktywny');
if (cenaZero.length) add('MED', 'cena_zero_aktywny', `${cenaZero.length} aktywnych produktow z cena sprzedazy 0/null`, cenaZero.slice(0, 5).map(p => p.kod));
const vatZle = all.filter(p => p.vat !== null && ![0, 5, 8, 23].includes(Number(p.vat)));
if (vatZle.length) add('HIGH', 'vat_nietypowy', `${vatZle.length} produktow z nietypowa stawka VAT`, [...new Set(vatZle.map(p => p.vat))].slice(0, 8));
const cenaSprzMniejZak = all.filter(p => p.cena_zakupu > 0 && p.cena_sprzedazy > 0 && p.cena_sprzedazy < p.cena_zakupu);
if (cenaSprzMniejZak.length) add('MED', 'sprzedaz_ponizej_zakupu', `${cenaSprzMniejZak.length} produktow: cena sprzedazy < zakupu`, cenaSprzMniejZak.slice(0, 5).map(p => p.kod + ' z=' + p.cena_zakupu + ' s=' + p.cena_sprzedazy));

// 8) stan magazynowy ujemny
const stanUjemny = all.filter(p => p.stan !== null && Number(p.stan) < 0);
if (stanUjemny.length) add('MED', 'stan_ujemny', `${stanUjemny.length} produktow z ujemnym stanem`, stanUjemny.slice(0, 5).map(p => p.kod + '=' + p.stan));

// 9) kategoria - dozwolone wartosci
const katCount = {};
for (const p of all) { const k = (p.kategoria || '(puste)'); katCount[k] = (katCount[k] || 0) + 1; }
add('INFO', 'rozklad_kategoria', 'Rozklad wartosci kolumny kategoria:', Object.entries(katCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`));

// 10) zastosowanie - dozwolone wartosci (slownik)
const SLOWNIK = ['Ciągnik','Opryskiwacz','Przyczepa','Ładowarka','Kombajn','kosiarka/ogród','Wózek widłowy','Koparka','suwnica/dźwig','maszyny górnicze','kompaktor','All position','Oś kierowana','Oś napędowa','Naczepa/przyczepa','Ciągnik leśny','harwester','Forwarder','Skidder','Uniwersalne/pozostałe','Forwarder, harwester'];
const zastCount = {}; const zastZle = [];
for (const p of all) { const z = p.zastosowanie; if (z === null || String(z).trim() === '') continue; zastCount[z] = (zastCount[z] || 0) + 1; if (!SLOWNIK.includes(z)) zastZle.push(p.kod + '=' + JSON.stringify(z)); }
if (zastZle.length) add('HIGH', 'zastosowanie_spoza_slownika', `${zastZle.length} produktow z zastosowaniem spoza slownika`, zastZle.slice(0, 8));
const zastPuste = all.filter(p => p.zastosowanie === null || String(p.zastosowanie).trim() === '').length;
add('INFO', 'zastosowanie_puste', `${zastPuste} produktow bez zastosowania`, []);

// 11) marka - lista unikalnych (wychwyc literowki/warianty)
const markaCount = {};
for (const p of all) { const m = (p.marka || '(puste)'); markaCount[m] = (markaCount[m] || 0) + 1; }
add('INFO', 'marki_unikalne', `${Object.keys(markaCount).length} unikalnych marek`, Object.entries(markaCount).sort((a, b) => a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1).map(([k, v]) => `${k}:${v}`));

// 12) EAN - dlugosc/format
const eanZle = all.filter(p => p.ean && !/^\d{8}$|^\d{13}$|^\d{14}$/.test(String(p.ean).trim()));
if (eanZle.length) add('MED', 'ean_format', `${eanZle.length} produktow z EAN o nietypowej dlugosci/formacie`, eanZle.slice(0, 5).map(p => p.kod + '=' + p.ean));

// 13) nazwa zbyt krotka / dziwna
const nazwaKrotka = all.filter(p => p.nazwa && String(p.nazwa).trim().length < 5);
if (nazwaKrotka.length) add('MED', 'nazwa_krotka', `${nazwaKrotka.length} produktow z bardzo krotka nazwa (<5 zn)`, nazwaKrotka.slice(0, 5).map(p => p.kod + '=' + JSON.stringify(p.nazwa)));

// wynik
console.log('===== AUDYT KATALOGU (' + N + ' produktow) =====\n');
const order = { HIGH: 0, MED: 1, INFO: 2 };
R.sort((a, b) => order[a.sev] - order[b.sev]);
for (const r of R) {
  console.log(`[${r.sev}] ${r.kat}: ${r.msg}`);
  if (r.przyklady.length) {
    if (r.kat === 'rozklad_kategoria' || r.kat === 'marki_unikalne') r.przyklady.forEach(x => console.log('      - ' + x));
    else console.log('      przyklady: ' + r.przyklady.join(' | '));
  }
}
const high = R.filter(r => r.sev === 'HIGH').length, med = R.filter(r => r.sev === 'MED').length;
console.log(`\n===== PODSUMOWANIE: ${high} HIGH, ${med} MED =====`);
db.close();
