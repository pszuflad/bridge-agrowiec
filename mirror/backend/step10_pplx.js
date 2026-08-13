const Database = require('better-sqlite3');
const db = new Database('/home/admin/private_apps/bridge/data.db', { readonly: true });

const normMap = new Map();
for (const r of db.prepare('SELECT * FROM selly_kategoria_norm_map').all()) {
  normMap.set(r.kategoria_raw, { norm: r.kategoria_glowna_norm, id: r.category_id_glowna });
}
const zastMap = new Map();
for (const r of db.prepare('SELECT * FROM selly_zastosowanie_category_map').all()) {
  zastMap.set(r.zastosowanie, r);
}

const products = db.prepare("SELECT kategoria, zastosowanie FROM products WHERE zastosowanie IS NOT NULL").all();
let missingZast = new Set();
let missingKategoria = new Set();
let checked = 0;
for (const p of products) {
  const norm = normMap.get(p.kategoria);
  if (!norm) missingKategoria.add(p.kategoria);
  const parts = p.zastosowanie.split(' + ').map(s => s.trim());
  for (const part of parts) {
    checked++;
    const hit = zastMap.get(part);
    if (!hit) { missingZast.add(part); continue; }
    if (hit.dziedziczy_kategorie_produktu && !norm) {
      missingZast.add(part + ' (potrzebuje norm dla kategoria=' + p.kategoria + ')');
    }
  }
}
console.log('Sprawdzonych pojedynczych wartosci:', checked);
console.log('Kategorie produktow bez wpisu w norm_map:', [...missingKategoria]);
console.log('Wartosci zastosowania bez pokrycia:', missingZast.size);
for (const m of missingZast) console.log(' -', m);
console.log('WERYFIKACJA ZAKONCZONA - jesli 0 brakujacych, mapa jest kompletna');
