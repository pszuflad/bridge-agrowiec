// uwaga_cena_patch.cjs — DODANE 2026-08-24
// Zarządzanie kolumną products.uwaga_cena.
//
// 1) ALTER TABLE ADD COLUMN products.uwaga_cena (idempotentnie)
// 2) Monkey-patch U.acceptStaging: po zaakceptowaniu staging item odczyt uwagaCena
//    ze snapshotJson i UPDATE products.uwaga_cena.
// 3) Monkey-patch U.addProductsBulk: propagacja uwagaCena z payload przy imporcie
//    bulk (endpoint /api/products).
// 4) Endpoint GET /api/products/uwagi-cena — lista wstrzymanych z uwaga_cena
//    (używane przez frontend injection do tooltipu).
//
// Powód: dostawcy zwracają czasem "cena na zapytanie" ("- zł" w Nokian dla
// wielkoformatowych VF Float King). Parser (mo7_nokian.cjs) i adapter.cjs już
// propagują pole `uwagaCena` — teraz backend zapisuje je w bazie.

'use strict';

function installUwagaCena(app, ctx, db) {
  const { U, we } = ctx;
  if (!U || !db) {
    console.error('[uwaga_cena] BLAD: brak U albo db - patch nie zaladowany');
    return;
  }

  // === 1) Dodaj kolumnę idempotentnie ===
  try {
    const cols = db.prepare(`PRAGMA table_info(products)`).all();
    if (!cols.some(c => c.name === 'uwaga_cena')) {
      db.exec(`ALTER TABLE products ADD COLUMN uwaga_cena TEXT`);
      console.log('[uwaga_cena] Dodano kolumnę products.uwaga_cena');
    }
  } catch (e) {
    console.error('[uwaga_cena] BLAD ALTER TABLE:', e.message);
  }

  // === 2) Monkey-patch U.acceptStaging ===
  if (typeof U.acceptStaging === 'function' && !U.__uwagaCenaPatched) {
    const orig = U.acceptStaging.bind(U);
    U.acceptStaging = function patchedAcceptStaging(t, e) {
      // Odczyt staging PRZED zaakceptowaniem (potem jest usuwany)
      let uwagaCena = null;
      let kod = null;
      try {
        const st = db.prepare(`SELECT kod, snapshot_json FROM staging_items WHERE id = ?`).get(t);
        if (st) {
          kod = st.kod;
          if (st.snapshot_json) {
            try {
              const snap = JSON.parse(st.snapshot_json);
              uwagaCena = snap.uwagaCena || null;
            } catch (_) {}
          }
        }
      } catch (err) {
        console.error('[uwaga_cena] read staging fail:', err.message);
      }
      const result = orig(t, e);
      // Update products.uwaga_cena
      if (kod) {
        try {
          db.prepare(`UPDATE products SET uwaga_cena = ? WHERE kod = ?`).run(uwagaCena, kod);
        } catch (err) {
          console.error('[uwaga_cena] update products fail:', err.message);
        }
      }
      return result;
    };
    U.__uwagaCenaPatched = true;
    console.log('[uwaga_cena] Monkey-patch U.acceptStaging aktywny');
  }

  // === 3) Monkey-patch U.addProductsBulk ===
  if (typeof U.addProductsBulk === 'function' && !U.__uwagaCenaBulkPatched) {
    const origBulk = U.addProductsBulk.bind(U);
    U.addProductsBulk = function patchedBulk(items) {
      const result = origBulk(items);
      // Po insercie: przenieś uwagaCena z payload do products
      try {
        const upd = db.prepare(`UPDATE products SET uwaga_cena = ? WHERE kod = ?`);
        for (const it of items) {
          if (it && it.kod) {
            const uc = it.uwagaCena !== undefined ? it.uwagaCena : (it.uwaga_cena || null);
            upd.run(uc, String(it.kod));
          }
        }
      } catch (err) {
        console.error('[uwaga_cena] bulk update fail:', err.message);
      }
      return result;
    };
    U.__uwagaCenaBulkPatched = true;
    console.log('[uwaga_cena] Monkey-patch U.addProductsBulk aktywny');
  }

  // === 4) Endpoint dla frontendu ===
  if (app && we) {
    app.get('/api/products/uwagi-cena', we, (req, res) => {
      try {
        const rows = db.prepare(`
          SELECT id, kod, uwaga_cena
          FROM products
          WHERE uwaga_cena IS NOT NULL AND uwaga_cena <> ''
        `).all();
        res.json({ ok: true, items: rows });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    console.log('[uwaga_cena] Endpoint GET /api/products/uwagi-cena aktywny');
  }
}

module.exports = { installUwagaCena };
