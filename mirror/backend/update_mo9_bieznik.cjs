// Aktualizacja pola bieznik/nazwa/oznaczenie_bieznika dla 35 rekordow MO9
// (bug: WZM zdublowane, NOWOSC/Nowosc, Zam./Zam. Zam., oznaczenie klasy L/E/G/R/C/I
// wyciete do osobnej kolumny). Testowane na kopii produkcyjnej DB przed uruchomieniem
// tutaj - 35/35 zaktualizowanych, 0 nieoczekiwanych zmian.
const Database = require('better-sqlite3');
const db = new Database('/home/admin/private_apps/bridge/data.db');

const updates = [{"sku": "520984", "bieznik": "EARTHMAX SR 30", "nazwa": "26.5R25 BKT EARTHMAX SR 30 TL E3** L3*", "oznaczenie": "E3** L3*"}, {"sku": "520378", "bieznik": "LIFTMAX LM81", "nazwa": "250/70R15 BKT LIFTMAX LM81 153A5 TL", "oznaczenie": null}, {"sku": "520887", "bieznik": "EARTHMAX SR 41 CR", "nazwa": "29.5R25 BKT EARTHMAX SR 41 CR E4** L4*", "oznaczenie": "E4** L4*"}, {"sku": "521164", "bieznik": "MULTIMAX MP 527", "nazwa": "340/80R18 BKT MULTIMAX MP 527 143A8/B TL", "oznaczenie": null}, {"sku": "520276", "bieznik": "EARTHMAX SR35 CR", "nazwa": "750/65R25 BKT EARTHMAX SR35 CR TL E3** L3*", "oznaczenie": "E3** L3*"}, {"sku": "521159", "bieznik": "FL 635", "nazwa": "750/45R22.5 BKT FL 635 168D TL", "oznaczenie": null}, {"sku": "521163", "bieznik": "MULTIMAX MP-522", "nazwa": "340/80R18 BKT MULTIMAX MP-522 143A8/B TL", "oznaczenie": null}, {"sku": "520739", "bieznik": "EARTHMAX SR 30", "nazwa": "23.5R25 BKT EARTHMAX SR 30 TL E3** L3*", "oznaczenie": "E3** L3*"}, {"sku": "521162", "bieznik": "LIFT MAX LM81 146A5", "nazwa": "7.50R15 BKT LIFT MAX LM81 146A5 146A5 TL", "oznaczenie": null}, {"sku": "520603", "bieznik": "EARTHMAX SR 30", "nazwa": "15.5R25 BKT EARTHMAX SR 30 169A2/160B TL L3* E3**", "oznaczenie": "L3* E3**"}, {"sku": "521180", "bieznik": "EARTH MAX SR 51 DOT2016", "nazwa": "23.5R25 BKT EARTH MAX SR 51 DOT2016 TL L5", "oznaczenie": "L5"}, {"sku": "520973", "bieznik": "EARTHMAX SR 41", "nazwa": "26.5R25 BKT EARTHMAX SR 41 E4** L4*", "oznaczenie": "E4** L4*"}, {"sku": "520983", "bieznik": "Earthmax SR 30", "nazwa": "20.5R25 BKT Earthmax SR 30 186A2/177B TL L3* E3**", "oznaczenie": "L3* E3**"}, {"sku": "520186", "bieznik": "Earthmax SR 51", "nazwa": "17.5R25 BKT Earthmax SR 51 176A2 TL L5*", "oznaczenie": "L5*"}, {"sku": "520728", "bieznik": "V-FLEXA", "nazwa": "650/55R26.5 BKT V-FLEXA 171D TL SB VF", "oznaczenie": null}, {"sku": "520609", "bieznik": "TR 315", "nazwa": "26x12-12 BKT TR 315 8PR TL", "oznaczenie": null}, {"sku": "520127", "bieznik": "Earthmax SR 51", "nazwa": "20.5R25 BKT Earthmax SR 51 186A2 TL L5*", "oznaczenie": "L5*"}, {"sku": "520372", "bieznik": "FLOT 648 T WZM T E", "nazwa": "550/45x22.5 BKT FLOT 648 T WZM T E 20PR TL", "oznaczenie": null}, {"sku": "520230", "bieznik": "EARTHMAX SR 53 CR", "nazwa": "20.5R25 BKT EARTHMAX SR 53 CR 186A2 TL L5*", "oznaczenie": "L5*"}, {"sku": "520894", "bieznik": "EARTHMAX SR 45 C.R.", "nazwa": "24.00R35 BKT EARTHMAX SR 45 C.R. TL E4**", "oznaczenie": "E4**"}, {"sku": "521375", "bieznik": "LOADER PLUS", "nazwa": "23.5x25 BKT LOADER PLUS 20PR TT L3", "oznaczenie": "L3"}, {"sku": "521435", "bieznik": "EARTHMAX SR31", "nazwa": "23.5R25 BKT EARTHMAX SR31 TL L3* E3**", "oznaczenie": "L3* E3**"}, {"sku": "521464", "bieznik": "AGRIMAX FACTOR E", "nazwa": "600/70R30 BKT AGRIMAX FACTOR E 152D/155A8", "oznaczenie": null}, {"sku": "521465", "bieznik": "AGRIMAX FACTOR E", "nazwa": "710/70R42 BKT AGRIMAX FACTOR E 173D/176A8", "oznaczenie": null}, {"sku": "521539", "bieznik": "Earthmax SR 35 CR", "nazwa": "650/65R25 BKT Earthmax SR 35 CR 180B TL E3**", "oznaczenie": "E3**"}, {"sku": "521485", "bieznik": "EM933", "nazwa": "10.00-20 BKT EM933 152B/168A2 18PR", "oznaczenie": null}, {"sku": "521630", "bieznik": "EARTHMAX SR412 CR", "nazwa": "750/65R25 BKT EARTHMAX SR412 CR E4** L4*", "oznaczenie": "E4** L4*"}, {"sku": "521662", "bieznik": "EARTHMAX SR53 CR", "nazwa": "26.5R25 BKT EARTHMAX SR53 CR L5**", "oznaczenie": "L5**"}, {"sku": "521624", "bieznik": "EARTHMAX SR41 CR", "nazwa": "29.5R25 BKT EARTHMAX SR41 CR E4**", "oznaczenie": "E4**"}, {"sku": "521626", "bieznik": "EARTHMAX SR47 H2 CR", "nazwa": "24.00R35 BKT EARTHMAX SR47 H2 CR E4**", "oznaczenie": "E4**"}, {"sku": "520889", "bieznik": "EARTHMAX SR 50", "nazwa": "26.5R25 BKT EARTHMAX SR 50 TL L5", "oznaczenie": "L5"}, {"sku": "521663", "bieznik": "EARTHMAX SR50 CR", "nazwa": "29.5R25 BKT EARTHMAX SR50 CR L5**", "oznaczenie": "L5**"}, {"sku": "521664", "bieznik": "EARTHMAX SR53 CR", "nazwa": "29.5R25 BKT EARTHMAX SR53 CR L5**", "oznaczenie": "L5**"}, {"sku": "521661", "bieznik": "EARTHMAX SR53 CR", "nazwa": "23.5R25 BKT EARTHMAX SR53 CR L5**", "oznaczenie": "L5**"}, {"sku": "521711", "bieznik": "LOADER SPL", "nazwa": "35/65-33 BKT LOADER SPL 42PR TL L5", "oznaczenie": "L5"}];

const stmt = db.prepare(
  "UPDATE products SET bieznik=?, nazwa=?, oznaczenie_bieznika=?, rodzaj=? WHERE dostawca='MO9' AND kod_dostawcy=?"
);

let updated = 0;
for (const u of updates) {
  const info = stmt.run(u.bieznik, u.nazwa, u.oznaczenie, u.oznaczenie, u.sku);
  updated += info.changes;
}

console.log('Zaktualizowano wierszy:', updated, '/', updates.length);

// weryfikacja koncowa
const remaining = db.prepare(
  "SELECT COUNT(*) as c FROM products WHERE dostawca='MO9' AND (bieznik LIKE '%NOWO%' OR bieznik LIKE '%Zam%')"
).get();
console.log('Pozostale problematyczne wzorce (powinno byc 0):', remaining.c);

db.close();
