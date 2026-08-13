// APLIKACJA WAG: wypełnia products.waga TYLKO gdzie brak, + manual_overrides (field_name='waga')
// aby import nie nadpisywał. Dopasowanie: dokładne (norm) + jednoznaczne (normHard). Kolizje -> wyższa waga.
const Database = require("better-sqlite3");
const fs = require("fs");

const map = JSON.parse(fs.readFileSync("/home/admin/private_apps/bridge/wagi_map.json", "utf8"));
const db = new Database("/home/admin/private_apps/bridge/data.db");

function norm(s) {
  return (s || "").toString().toLowerCase()
    .replace(/\s+/g, " ").replace(/[×x]/g, "x").replace(/[,]/g, ".")
    .replace(/\s*\/\s*/g, "/").trim();
}
function normHard(s) {
  return norm(s)
    .replace(/\bdemo\b/g, "")
    .replace(/\b\d{2,3}[a-z]\d?(\/\d{2,3}[a-z]\d?)?\b/g, " ")
    .replace(/\b\d{1,2}pr\b/g, " ")
    .replace(/\b(tl|tt)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

// zbuduj mapy; kolizje -> wyższa waga
const mapNorm = {}, mapHard = {};
for (const [name, w] of Object.entries(map)) {
  const k = norm(name);
  mapNorm[k] = (mapNorm[k] == null) ? w : Math.max(mapNorm[k], w);
  const h = normHard(name);
  if (!(h in mapHard)) mapHard[h] = new Set();
  mapHard[h].add(w);
}

const rows = db.prepare("SELECT id, kod, dostawca, nazwa FROM products WHERE waga IS NULL OR waga=0").all();

const DRY = process.argv.includes("--dry");
const nowIso = new Date().toISOString();

const updProd = db.prepare("UPDATE products SET waga=? WHERE id=?");
const findOv = db.prepare("SELECT id FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=? AND field_name='waga'");
const insOv = db.prepare(`INSERT INTO manual_overrides
  (supplier_kod, supplier_product_id, field_name, override_value, reason, created_by, created_at, acknowledged_source_value)
  VALUES (?, ?, 'waga', ?, 'uzupełnienie wag z Excela 2026-07-20 (import-safe)', 1, ?, NULL)`);

let setExact = 0, setHard = 0, skipHardAmbig = 0, noMatch = 0, ovNew = 0, ovExists = 0;

const run = db.transaction(() => {
  for (const r of rows) {
    let w = mapNorm[norm(r.nazwa)];
    let via = "exact";
    if (w == null) {
      const set = mapHard[normHard(r.nazwa)];
      if (set && set.size === 1) { w = [...set][0]; via = "hard"; }
      else if (set && set.size > 1) { skipHardAmbig++; continue; }
      else { noMatch++; continue; }
    }
    if (!(w > 0)) { noMatch++; continue; }

    if (!DRY) {
      updProd.run(w, r.id);
      // override chroniący wartość przy imporcie; supplier_product_id = kod (jak w istniejących wpisach: MO9_206704)
      const ex = findOv.get(r.dostawca, r.kod);
      if (ex) { ovExists++; }
      else { insOv.run(r.dostawca, r.kod, String(w), nowIso); ovNew++; }
    }
    if (via === "exact") setExact++; else setHard++;
  }
});
run();

console.log(DRY ? "=== DRY ===" : "=== ZAPISANO ===");
console.log("Kandydatów (bez wagi):", rows.length);
console.log("Ustawiono wagę (exact):", setExact);
console.log("Ustawiono wagę (hard):", setHard);
console.log("RAZEM ustawiono:", setExact + setHard);
console.log("Pominięto niejednoznaczne (hard):", skipHardAmbig);
console.log("Bez dopasowania (puste):", noMatch);
console.log("Nowe overrides 'waga':", ovNew, "| już istniały:", ovExists);
db.close();
