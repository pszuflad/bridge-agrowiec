// Test cyklu ACK: import1 konflikt -> accept (ACK) -> import2 cicho -> zmiana pliku -> konflikt znow
const D = require('better-sqlite3');
const db = new D('data.db');
const q = s => s.replace(/#/g, String.fromCharCode(39));

// symulacja Gq (dokladnie jak w kodzie po patchu)
function Gq(overrides, fileRec) {
  let r = { ...fileRec }, a = [], _srcVals = {};
  for (let s of overrides) {
    let o = fileRec[s.field_name];
    if (o != null && String(o) !== s.override_value) {
      if (s.acknowledged_source_value == null || String(o) !== String(s.acknowledged_source_value)) {
        a.push(s.field_name); _srcVals[s.field_name] = String(o);
      }
    }
    r[s.field_name] = s.override_value;
  }
  return { naruszono: a, srcVals: _srcVals };
}

const TEST_KOD = '__ACKTEST__';
const SUP = 'MO2';
// sprzataj po ewentualnym poprzednim tescie
db.prepare(q("DELETE FROM manual_overrides WHERE supplier_product_id=#__ACKTEST__#")).run();

// Marta poprawila nazwe: override nazwa = "Poprawna Nazwa"
db.prepare(q("INSERT INTO manual_overrides(supplier_kod,supplier_product_id,field_name,override_value,reason,created_by,created_at) VALUES(?,?,?,?,?,?,?)"))
  .run(SUP, TEST_KOD, 'nazwa', 'Poprawna Nazwa', 'test', 1, new Date().toISOString());

function getOv() { return db.prepare(q("SELECT * FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?")).all(SUP, TEST_KOD); }

let results = [];

// IMPORT 1: plik przysyla zla nazwe "Zla Nazwa Z Pliku"
let r1 = Gq(getOv(), { kod: TEST_KOD, nazwa: 'Zla Nazwa Z Pliku' });
results.push(['IMPORT 1 (plik=Zla Nazwa)', r1.naruszono.length === 1, 'konflikt=' + JSON.stringify(r1.naruszono)]);

// AKCEPTACJA: zapis ACK = wartosc z pliku
if (r1.naruszono.length) {
  let sv = r1.srcVals['nazwa'];
  let ov = getOv().find(x => x.field_name === 'nazwa');
  db.prepare(q("UPDATE manual_overrides SET acknowledged_source_value=? WHERE id=?")).run(String(sv), ov.id);
}

// IMPORT 2: plik przysyla TE SAMA zla nazwe -> powinno byc CICHO
let r2 = Gq(getOv(), { kod: TEST_KOD, nazwa: 'Zla Nazwa Z Pliku' });
results.push(['IMPORT 2 (ta sama zla nazwa)', r2.naruszono.length === 0, 'konflikt=' + JSON.stringify(r2.naruszono)]);

// IMPORT 3: plik przysyla ta sama, znowu cicho
let r3 = Gq(getOv(), { kod: TEST_KOD, nazwa: 'Zla Nazwa Z Pliku' });
results.push(['IMPORT 3 (ta sama zla nazwa)', r3.naruszono.length === 0, 'konflikt=' + JSON.stringify(r3.naruszono)]);

// IMPORT 4: dostawca zmienil na NOWA inna wartosc -> konflikt ZNOW
let r4 = Gq(getOv(), { kod: TEST_KOD, nazwa: 'Inna Nowa Nazwa' });
results.push(['IMPORT 4 (nowa inna nazwa)', r4.naruszono.length === 1, 'konflikt=' + JSON.stringify(r4.naruszono)]);

// IMPORT 5: plik = wartosc Marty (dostawca poprawil) -> brak konfliktu
let r5 = Gq(getOv(), { kod: TEST_KOD, nazwa: 'Poprawna Nazwa' });
results.push(['IMPORT 5 (plik=wartosc Marty)', r5.naruszono.length === 0, 'konflikt=' + JSON.stringify(r5.naruszono)]);

// sprzataj
db.prepare(q("DELETE FROM manual_overrides WHERE supplier_product_id=#__ACKTEST__#")).run();
db.close();

let ok = 0;
for (const [name, pass, info] of results) { if (pass) ok++; console.log((pass ? 'PASS' : 'FAIL'), name, '->', info); }
console.log('\nWynik: ' + ok + '/' + results.length);
