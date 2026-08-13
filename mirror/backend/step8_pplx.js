// Weryfikacja pokrycia: dla kazdego produktu z zastosowanie != NULL,
// sprawdz ze KAZDA pojedyncza wartosc (po rozbiciu " + ") ma wpis w mapie
// dla znormalizowanej kategorii tego produktu.
const Database = require('better-sqlite3');
const db = new Database('/home/admin/private_apps/bridge/data.db', { readonly: true });

const normMap = new Map();
for (const r of db.prepare('SELECT * FROM selly_kategoria_norm_map').all()) {
  normMap.set(r.kategoria_raw, { norm: r.kategoria_glowna_norm, id: r.category_id_glowna });
}

const zastMap = new Set();
for (const r of db.prepare('SELECT zastosowanie, kategoria_glowna_norm FROM selly_zastosowanie_category_map').all()) {
  zastMap.add(r.zastosowanie + '||' + r.kategoria_glowna_norm);
}

const products = db.prepare("SELECT kategoria, zastosowanie FROM products WHERE zastosowanie IS NOT NULL").all();
let missing = new Set();
let missingKategoria = new Set();
let checked = 0;
for (const p of products) {
  const norm = normMap.get(p.kategoria);
  if (!norm) { missingKategoria.add(p.kategoria); continue; }
  const parts = p.zastosowanie.split(' + ').map(s => s.trim());
  for (const part of parts) {
    checked++;
    if (!zastMap.has(part + '||' + norm.norm)) {
      missing.add(part + ' || ' + norm.norm + ' (raw kategoria: ' + p.kategoria + ')');
    }
  }
}
console.log('Sprawdzonych pojedynczych wartosci (z rozbicia):', checked);
console.log('Kategorie bez wpisu w norm_map:', [...missingKategoria]);
console.log('Brakujace pary zastosowanie||kategoria_norm:', missing.size);
for (const m of missing) console.log(' -', m);
