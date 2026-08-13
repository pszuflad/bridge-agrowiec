// apply_overrides_lock.cjs
// Przypina dzisiejsze (2026-07-22) reczne poprawki jako manual_overrides,
// zeby import ich nie nadpisal. Wartosc override = AKTUALNA wartosc w products (po poprawce).
// field_name mapowane na klucze rekordu importu (camelCase tam gdzie import ich uzywa).
const Database = require('better-sqlite3');
const db = new Database('data.db');
const nowIso = new Date().toISOString();

// Mapa: history.pole (kolumna DB) -> {col: kolumna products, fld: field_name w imporcie}
const MAP = {
  'szerokosc':         { col:'szerokosc',        fld:'szerokosc' },
  'kategoria':         { col:'kategoria',        fld:'kategoria' },
  'zastosowanie':      { col:'zastosowanie',     fld:'zastosowanie' },
  'bieznik':           { col:'bieznik',          fld:'bieznik' },
  'model':             { col:'model',            fld:'model' },
  'dot':               { col:'dot',              fld:'dot' },
  'waga':              { col:'waga',             fld:'waga' },
  'nazwa':             { col:'nazwa',            fld:'nazwa' },
  'indeksy':           { col:'indeksy',          fld:'indeksy' },
  'indeks_nosnosci':   { col:'indeks_nosnosci',  fld:'indeksNosnosci' },
  'indeks_predkosci':  { col:'indeks_predkosci', fld:'indeksPredkosci' },
  'indeks_2':          { col:'indeks_2',         fld:'indeks2' },
};

// zrodla ktore powstaly ze skryptow (bez auto-override z panelu)
const zrodla = ['fix-dot-rok','fix-indeks-nazwa','fix-kategoria','fix-szerokosc',
                'fix-zero-indeks','przypisanie-zastosowanie','szacunek-waga',
                'czyszczenie-anomalii','regula-DOT-nazwa'];
const ph = zrodla.map(()=>'?').join(',');

// unikalne (kod, pole) z dzisiejszej historii
const pairs = db.prepare(
  `SELECT DISTINCT kod_produktu AS kod, pole FROM history
   WHERE data LIKE '2026-07-22%' AND zrodlo IN (${ph})`).all(...zrodla);

const getProd = db.prepare("SELECT kod, dostawca, ROWID FROM products WHERE kod=?");
const findOv  = db.prepare("SELECT id FROM manual_overrides WHERE supplier_product_id=? AND field_name=?");
const getVal  = {}; // cache prepared per column
function prepVal(col){ if(!getVal[col]) getVal[col]=db.prepare(`SELECT ${col} AS v FROM products WHERE kod=?`); return getVal[col]; }
const insOv = db.prepare(`INSERT INTO manual_overrides
  (supplier_kod, supplier_product_id, field_name, override_value, reason, created_by, created_at, acknowledged_source_value)
  VALUES (?,?,?,?,?,?,?,?)`);

let created=0, existed=0, skippedNoprod=0, skippedNoMap=0, skippedNull=0;
const byField = {};

const tx = db.transaction(()=>{
  for(const p of pairs){
    const m = MAP[p.pole];
    if(!m){ skippedNoMap++; continue; }
    const prod = getProd.get(p.kod);
    if(!prod){ skippedNoprod++; continue; }
    if(findOv.get(p.kod, m.fld)){ existed++; continue; }
    const row = prepVal(m.col).get(p.kod);
    const val = row ? row.v : null;
    if(val===null || val===undefined || val===''){ skippedNull++; continue; } // nie chronimy pustej wartosci
    const supplier = prod.dostawca || (String(p.kod).split('_')[0]);
    // acknowledged_source_value = aktualna wartosc => brak falszywych konfliktow gdy plik przysyla to samo
    insOv.run(supplier, p.kod, m.fld, String(val), 'ochrona-recznej-korekty-2026-07-22', 1, nowIso, null);
    created++;
    byField[m.fld]=(byField[m.fld]||0)+1;
  }
});
tx();

console.log('Nowe overrides:', created);
console.log('Juz istnialy:', existed);
console.log('Pominieto (brak produktu):', skippedNoprod);
console.log('Pominieto (brak mapy pola):', skippedNoMap);
console.log('Pominieto (pusta wartosc):', skippedNull);
console.log('Wg pola:', JSON.stringify(byField));
console.log('\nSuma manual_overrides teraz:', db.prepare("SELECT COUNT(*) n FROM manual_overrides").get().n);
db.close();
