// pending_module.cjs — Faza B Bridge
//
// Wykrywanie nowych wartości atrybutów, które pojawiają się w products po commit stagingu.
// Nowe wartości trafiają do atrybuty_wartosci_pending → Anna akceptuje/edytuje/aliasuje/odrzuca.
//
// Endpointy:
//   GET    /api/atrybuty/pending
//   POST   /api/atrybuty/pending/:id/akceptuj
//   POST   /api/atrybuty/pending/:id/akceptuj-z-edycja   body:{ nowa_wartosc }
//   POST   /api/atrybuty/pending/:id/akceptuj-jako-alias body:{ kanoniczna_wartosc }
//   POST   /api/atrybuty/pending/:id/odrzuc
//   POST   /api/atrybuty/scan-pending                    (ręczne odświeżenie)
//
// Middleware: automatyczny scan po każdym POST /api/staging/accept
//
// Reguły:
//  - alias sugerowany tylko gdy różnica ≠ tylko "+"
//    ORAZ podobieństwo (Levenshtein) ≥ 90%
//  - "wentyl" NIE ma domyślnego rodzaju — pomijamy (albo skanuje tylko rodzaje zdefiniowane)
//  - MO6 (celowo pominięty w Bridge) — filtrujemy dostawca != 'MO6'

const RODZAJE_KOLUMNY = {
  marka: 'marka',
  kategoria: 'kategoria',
  konstrukcja: 'konstrukcja',
  vfIf: 'vf_if',
  rodzaj: 'rodzaj',
  sezon: 'sezon',
  tl_tt: 'tl_tt',
  oznaczenie_bieznika: 'oznaczenie_bieznika',
  bieznik: 'bieznik',
  wentyl: 'wentyl',
  rozmiar: 'rozmiar',
  indeks_nosnosci: 'indeks_nosnosci',
  indeks_predkosci: 'indeks_predkosci'
};

// ————————————————————————————————————————————
// Podobieństwo (Levenshtein → similarity %)
// ————————————————————————————————————————————
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Reguła aliasu: NIE sugeruj gdy jedyna różnica to "+" I podobieństwo ≥ 90%
function shouldSuggestAlias(nowa, kanoniczna) {
  const sim = similarity(nowa, kanoniczna);
  if (sim < 0.9) return false;
  const strippedNowa = nowa.replace(/\+/g, '');
  const strippedKan = kanoniczna.replace(/\+/g, '');
  if (strippedNowa === strippedKan && nowa !== kanoniczna) return false; // różnica tylko "+"
  return true;
}

// ————————————————————————————————————————————
// Scan: porównaj products vs katalog+odrzucone, dopisz do pending
// ————————————————————————————————————————————
function scanForNewValues(db) {
  const stats = { skanowano_rodzajow: 0, nowych_wartosci: 0, zaktualizowano: 0 };

  for (const [rodzaj, kolumna] of Object.entries(RODZAJE_KOLUMNY)) {
    stats.skanowano_rodzajow++;
    let rows;
    try {
      rows = db.prepare(
        `SELECT ${kolumna} AS wartosc,
                COUNT(*) AS ile,
                GROUP_CONCAT(DISTINCT dostawca) AS dostawcy
         FROM products
         WHERE ${kolumna} IS NOT NULL
           AND TRIM(${kolumna}) != ''
           AND (dostawca IS NULL OR dostawca != 'MO6')
         GROUP BY ${kolumna}`
      ).all();
    } catch (e) {
      console.error(`[pending] scan rodzaj=${rodzaj} kolumna=${kolumna} error:`, e.message);
      continue;
    }

    for (const row of rows) {
      const wartosc = String(row.wartosc).trim();
      if (!wartosc) continue;

      // Już w katalogu?
      const wKatalogu = db.prepare(
        `SELECT 1 FROM atrybuty_wartosci WHERE rodzaj=? AND wartosc=? LIMIT 1`
      ).get(rodzaj, wartosc);
      if (wKatalogu) continue;

      // Odrzucona?
      const wOdrzuconych = db.prepare(
        `SELECT 1 FROM atrybuty_wartosci_odrzucone WHERE rodzaj=? AND wartosc=? LIMIT 1`
      ).get(rodzaj, wartosc);
      if (wOdrzuconych) continue;

      // Już w pending? Zaktualizuj ile_wystapien + ostatni_import
      const wPending = db.prepare(
        `SELECT id FROM atrybuty_wartosci_pending WHERE rodzaj=? AND wartosc=? LIMIT 1`
      ).get(rodzaj, wartosc);

      if (wPending) {
        db.prepare(
          `UPDATE atrybuty_wartosci_pending
              SET ile_wystapien=?, ostatni_import=datetime('now'), dostawcy=?
            WHERE id=?`
        ).run(row.ile, row.dostawcy || '', wPending.id);
        stats.zaktualizowano++;
      } else {
        db.prepare(
          `INSERT INTO atrybuty_wartosci_pending (rodzaj, wartosc, ile_wystapien, dostawcy)
           VALUES (?, ?, ?, ?)`
        ).run(rodzaj, wartosc, row.ile, row.dostawcy || '');
        stats.nowych_wartosci++;
      }
    }
  }

  return stats;
}

// ---
// Hook post-commit: po kazdym POST /api/staging/accept (200/201/204) skanuj DB.
// Bundle uzywa Express 5 - router jest w app.router (nie app._router jak w Express 4).
// Monkey-patchujemy handler /api/staging/accept dodajac res.on('finish') hook.
// ---
function installStagingHook(app, db) {
  const runScanAfterAccept = (req, res) => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const stats = scanForNewValues(db);
          if (stats.nowych_wartosci > 0 || stats.zaktualizowano > 0) {
            console.log('[pending] hook po /api/staging/accept - nowych:', stats.nowych_wartosci, 'aktualizacji:', stats.zaktualizowano);
          }
        } catch (e) {
          console.error('[pending] hook scan error:', e.message);
        }
      }
    });
  };

  // Express 5: app.router (getter); Express 4: app._router
  const router = app.router || app._router;
  if (!router || !router.stack) {
    console.error('[pending] hook: brak router.stack, hook NIE zainstalowany');
    return;
  }

  let wrapped = 0;
  for (const layer of router.stack) {
    if (!layer.route) continue;
    if (layer.route.path !== '/api/staging/accept') continue;
    if (!layer.route.methods || !layer.route.methods.post) continue;

    const routeStack = layer.route.stack;
    if (!routeStack || routeStack.length === 0) continue;

    // Wstrzyknij hook do pierwszego handlera route (przed auth middleware zeby uchwycic res)
    const firstLayer = routeStack[0];
    const originalHandle = firstLayer.handle;
    firstLayer.handle = function (req, res, next) {
      runScanAfterAccept(req, res);
      return originalHandle.call(this, req, res, next);
    };
    wrapped++;
  }

  if (wrapped > 0) {
    console.log('[pending] hook zainstalowany na', wrapped, 'route(s) /api/staging/accept');
  } else {
    console.warn('[pending] hook: nie znaleziono route POST /api/staging/accept - hook NIE zainstalowany');
  }
}


// ————————————————————————————————————————————
// Rejestracja endpointów
// ————————————————————————————————————————————
function registerPending(app, ctx, dbPath) {
  const { we } = ctx;
  let db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath || '/home/admin/private_apps/bridge/data.db');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  } catch (e) {
    console.error('[pending] BŁĄD better-sqlite3:', e.message);
    return;
  }

  console.log('[pending] Modul zaladowany, db:', dbPath || '/home/admin/private_apps/bridge/data.db');

  // Hook middleware — musi być zainstalowany przed innymi handlerami dla /api/staging/accept
  // Uwaga: express uruchamia middleware w kolejności rejestracji, ale res.on('finish') działa niezależnie
  installStagingHook(app, db);

  // GET /api/atrybuty/pending — lista oczekujących z podpowiedziami aliasów
  app.get('/api/atrybuty/pending', we, (req, res) => {
    try {
      const rodzajFilter = req.query.rodzaj;
      let sql = `SELECT id, rodzaj, wartosc, ile_wystapien, pierwszy_import, ostatni_import, dostawcy
                 FROM atrybuty_wartosci_pending`;
      const params = [];
      if (rodzajFilter) {
        sql += ` WHERE rodzaj = ?`;
        params.push(rodzajFilter);
      }
      sql += ` ORDER BY rodzaj, ile_wystapien DESC, wartosc`;
      const items = db.prepare(sql).all(...params);

      // Dla każdej pozycji zaproponuj potencjalne aliasy
      const wynik = items.map(item => {
        const kandydaci = db.prepare(
          `SELECT wartosc FROM atrybuty_wartosci WHERE rodzaj=?`
        ).all(item.rodzaj);
        const aliasy = [];
        for (const k of kandydaci) {
          if (shouldSuggestAlias(item.wartosc, k.wartosc)) {
            aliasy.push({ wartosc: k.wartosc, podobienstwo: Math.round(similarity(item.wartosc, k.wartosc) * 100) });
          }
        }
        aliasy.sort((a, b) => b.podobienstwo - a.podobienstwo);
        return { ...item, sugerowane_aliasy: aliasy.slice(0, 5) };
      });

      res.json({ ok: true, count: wynik.length, items: wynik });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/atrybuty/pending/:id/akceptuj — dodaj do katalogu, usuń z pending
  app.post('/api/atrybuty/pending/:id/akceptuj', we, (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const p = db.prepare(`SELECT rodzaj, wartosc FROM atrybuty_wartosci_pending WHERE id=?`).get(id);
      if (!p) return res.status(404).json({ ok: false, error: 'Pozycja pending nie istnieje' });

      const tx = db.transaction(() => {
        db.prepare(`INSERT OR IGNORE INTO atrybuty_wartosci (rodzaj, wartosc, origin) VALUES (?, ?, 'user')`)
          .run(p.rodzaj, p.wartosc);
        db.prepare(`DELETE FROM atrybuty_wartosci_pending WHERE id=?`).run(id);
      });
      tx();

      res.json({ ok: true, akcja: 'akceptowana', rodzaj: p.rodzaj, wartosc: p.wartosc });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/atrybuty/pending/:id/akceptuj-z-edycja
  // body: { nowa_wartosc } — dodaje edytowaną wartość do katalogu i UPDATE-uje products
  app.post('/api/atrybuty/pending/:id/akceptuj-z-edycja', we, (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const nowa = String(req.body?.nowa_wartosc || '').trim();
      if (!nowa) return res.status(400).json({ ok: false, error: 'Brak nowa_wartosc' });

      const p = db.prepare(`SELECT rodzaj, wartosc FROM atrybuty_wartosci_pending WHERE id=?`).get(id);
      if (!p) return res.status(404).json({ ok: false, error: 'Pozycja pending nie istnieje' });

      const kolumna = RODZAJE_KOLUMNY[p.rodzaj];
      if (!kolumna) return res.status(400).json({ ok: false, error: `Nieznany rodzaj: ${p.rodzaj}` });

      const tx = db.transaction(() => {
        // 1. UPDATE products: stara → nowa
        const info = db.prepare(
          `UPDATE products SET ${kolumna}=? WHERE ${kolumna}=?`
        ).run(nowa, p.wartosc);

        // 2. Dodaj nową do katalogu
        db.prepare(`INSERT OR IGNORE INTO atrybuty_wartosci (rodzaj, wartosc, origin) VALUES (?, ?, 'user')`)
          .run(p.rodzaj, nowa);

        // 3. Usuń pending
        db.prepare(`DELETE FROM atrybuty_wartosci_pending WHERE id=?`).run(id);

        return info.changes;
      });
      const zmienione = tx();

      res.json({ ok: true, akcja: 'akceptowana_z_edycja', z: p.wartosc, na: nowa, produktow_zaktualizowano: zmienione });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/atrybuty/pending/:id/akceptuj-jako-alias
  // body: { kanoniczna_wartosc } — UPDATE products SET pole=kanoniczna WHERE pole=nowa
  app.post('/api/atrybuty/pending/:id/akceptuj-jako-alias', we, (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const kanoniczna = String(req.body?.kanoniczna_wartosc || '').trim();
      if (!kanoniczna) return res.status(400).json({ ok: false, error: 'Brak kanoniczna_wartosc' });

      const p = db.prepare(`SELECT rodzaj, wartosc FROM atrybuty_wartosci_pending WHERE id=?`).get(id);
      if (!p) return res.status(404).json({ ok: false, error: 'Pozycja pending nie istnieje' });

      // Kanoniczna musi istnieć w katalogu
      const istnieje = db.prepare(
        `SELECT 1 FROM atrybuty_wartosci WHERE rodzaj=? AND wartosc=? LIMIT 1`
      ).get(p.rodzaj, kanoniczna);
      if (!istnieje) return res.status(400).json({ ok: false, error: `Kanoniczna "${kanoniczna}" nie istnieje w katalogu ${p.rodzaj}` });

      const kolumna = RODZAJE_KOLUMNY[p.rodzaj];
      if (!kolumna) return res.status(400).json({ ok: false, error: `Nieznany rodzaj: ${p.rodzaj}` });

      const tx = db.transaction(() => {
        const info = db.prepare(
          `UPDATE products SET ${kolumna}=? WHERE ${kolumna}=?`
        ).run(kanoniczna, p.wartosc);
        db.prepare(`DELETE FROM atrybuty_wartosci_pending WHERE id=?`).run(id);
        return info.changes;
      });
      const zmienione = tx();

      res.json({ ok: true, akcja: 'akceptowana_jako_alias', z: p.wartosc, na: kanoniczna, produktow_zaktualizowano: zmienione });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/atrybuty/pending/:id/odrzuc — do tabeli odrzuconych, usuń z pending
  app.post('/api/atrybuty/pending/:id/odrzuc', we, (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const p = db.prepare(`SELECT rodzaj, wartosc FROM atrybuty_wartosci_pending WHERE id=?`).get(id);
      if (!p) return res.status(404).json({ ok: false, error: 'Pozycja pending nie istnieje' });

      const tx = db.transaction(() => {
        db.prepare(`INSERT OR IGNORE INTO atrybuty_wartosci_odrzucone (rodzaj, wartosc) VALUES (?, ?)`)
          .run(p.rodzaj, p.wartosc);
        db.prepare(`DELETE FROM atrybuty_wartosci_pending WHERE id=?`).run(id);
      });
      tx();

      res.json({ ok: true, akcja: 'odrzucona', rodzaj: p.rodzaj, wartosc: p.wartosc });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/atrybuty/scan-pending — ręczne uruchomienie skanu
  app.post('/api/atrybuty/scan-pending', we, (req, res) => {
    try {
      const stats = scanForNewValues(db);
      res.json({ ok: true, ...stats });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // DELETE /api/atrybuty/pending — czyści listę pending (bez wpisu do odrzuconych)
  // Opcjonalny query ?rodzaj=xyz ogranicza czyszczenie do jednego rodzaju.
  // Wartości mogą wrócić do pending przy kolejnym skanie, jeśli produkt wciąż je zawiera.
  app.delete('/api/atrybuty/pending', we, (req, res) => {
    try {
      const rodzaj = req.query.rodzaj;
      let info;
      if (rodzaj) {
        info = db.prepare(`DELETE FROM atrybuty_wartosci_pending WHERE rodzaj=?`).run(rodzaj);
      } else {
        info = db.prepare(`DELETE FROM atrybuty_wartosci_pending`).run();
      }
      res.json({ ok: true, usunieto: info.changes, rodzaj: rodzaj || null });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { registerPending, scanForNewValues, shouldSuggestAlias, similarity };
