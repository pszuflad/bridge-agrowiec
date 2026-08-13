const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = '/home/admin/private_apps/bridge/data.db';
const db = new Database(DB_PATH);

const SUPPLIERS = ['MO1','MO2','MO3','MO4','MO5','MO6','MO7','MO8','MO9','MO10'];

function hasPrefix(kod) {
  if (!kod) return true;
  return SUPPLIERS.some(s => kod.startsWith(s + '_'));
}

const report = {};

db.transaction(() => {
  // 1) products: kod + kod_dostawcy, dostawca-scoped
  for (const sup of SUPPLIERS) {
    const rows = db.prepare('SELECT id, kod, kod_dostawcy FROM products WHERE dostawca=?').all(sup);
    let changed = 0;
    for (const r of rows) {
      if (r.kod && !hasPrefix(r.kod)) {
        const newKod = `${sup}_${r.kod}`;
        db.prepare('UPDATE products SET kod=? WHERE id=?').run(newKod, r.id);
        changed++;
      }
    }
    report['products_' + sup] = { total: rows.length, changed };
  }

  // 2) staging_items: kod, dostawca-scoped
  for (const sup of SUPPLIERS) {
    const rows = db.prepare('SELECT id, kod FROM staging_items WHERE dostawca=?').all(sup);
    let changed = 0;
    for (const r of rows) {
      if (r.kod && !hasPrefix(r.kod)) {
        db.prepare('UPDATE staging_items SET kod=? WHERE id=?').run(`${sup}_${r.kod}`, r.id);
        changed++;
      }
    }
    report['staging_' + sup] = { total: rows.length, changed };
  }

  // 3) manual_overrides: supplier_kod + supplier_product_id
  const overrides = db.prepare('SELECT id, supplier_kod, supplier_product_id FROM manual_overrides').all();
  let ovChanged = 0;
  for (const r of overrides) {
    if (r.supplier_product_id && !hasPrefix(r.supplier_product_id)) {
      const newId = `${r.supplier_kod}_${r.supplier_product_id}`;
      db.prepare('UPDATE manual_overrides SET supplier_product_id=? WHERE id=?').run(newId, r.id);
      ovChanged++;
    }
  }
  report['manual_overrides'] = { total: overrides.length, changed: ovChanged };

  // 4) history: kod_produktu (format is DOSTAWCA+kod bez podkreslnika, np MO9206704)
  //    Zamieniamy na DOSTAWCA_kod tylko gdy da sie jednoznacznie rozpoznac prefiks dostawcy.
  const hist = db.prepare('SELECT id, kod_produktu FROM history').all();
  let histChanged = 0;
  for (const r of hist) {
    const kp = r.kod_produktu;
    if (!kp) continue;
    const sup = SUPPLIERS.find(s => kp.startsWith(s) && !kp.startsWith(s + '_'));
    if (sup) {
      const rest = kp.slice(sup.length);
      db.prepare('UPDATE history SET kod_produktu=? WHERE id=?').run(`${sup}_${rest}`, r.id);
      histChanged++;
    }
  }
  report['history'] = { total: hist.length, changed: histChanged };

  // 5) historia_cen: kod + dostawca columns both present
  for (const sup of SUPPLIERS) {
    const rows = db.prepare('SELECT id, kod FROM historia_cen WHERE dostawca=?').all(sup);
    let changed = 0;
    for (const r of rows) {
      if (r.kod && !hasPrefix(r.kod)) {
        db.prepare('UPDATE historia_cen SET kod=? WHERE id=?').run(`${sup}_${r.kod}`, r.id);
        changed++;
      }
    }
    report['historia_cen_' + sup] = { total: rows.length, changed };
  }

  // 6) link_pamiec_kod: kod only, no dostawca column - format already like MO8xxxx (no underscore)
  const links = db.prepare('SELECT kod, link, updated_at FROM link_pamiec_kod').all();
  let linkChanged = 0;
  for (const r of links) {
    const kp = r.kod;
    if (!kp) continue;
    const sup = SUPPLIERS.find(s => kp.startsWith(s) && !kp.startsWith(s + '_'));
    if (sup) {
      const rest = kp.slice(sup.length);
      const newKod = `${sup}_${rest}`;
      // avoid PK collision
      const exists = db.prepare('SELECT 1 FROM link_pamiec_kod WHERE kod=?').get(newKod);
      if (!exists) {
        db.prepare('UPDATE link_pamiec_kod SET kod=? WHERE kod=?').run(newKod, kp);
        linkChanged++;
      }
    }
  }
  report['link_pamiec_kod'] = { total: links.length, changed: linkChanged };

})();

console.log(JSON.stringify(report, null, 2));

// Sanity check: verify no duplicate kod remains in products (should be impossible, but verify)
const dupCheck = db.prepare('SELECT kod, COUNT(*) c FROM products GROUP BY kod HAVING c > 1').all();
console.log('DUPLICATE KOD CHECK (should be empty):', JSON.stringify(dupCheck));

const totalProducts = db.prepare('SELECT COUNT(*) c FROM products').get().c;
console.log('total products after migration:', totalProducts);
