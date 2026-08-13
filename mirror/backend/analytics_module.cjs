// analytics_module.cjs -- Bridge v6 full analytics v2
// Covers: supplier analysis, EAN comparison, price changes, availability/seasonality placeholders,
// global filters and CSV export. Creates historia_cen for future time-series analytics.
'use strict';

const DB_PATH = '/home/admin/private_apps/bridge/data.db';

function openDb() {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

function asDb(dbOrCtx) {
  if (dbOrCtx && typeof dbOrCtx.prepare === 'function') return dbOrCtx;
  return openDb();
}

function asAuth(dbOrCtx, auth) {
  return auth || (dbOrCtx && (dbOrCtx.we || dbOrCtx.requireAuth)) || ((req, res, next) => next());
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS historia_cen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produkt_id INTEGER,
      kod TEXT NOT NULL,
      ean TEXT,
      dostawca TEXT NOT NULL,
      marka TEXT,
      model TEXT,
      rozmiar TEXT,
      indeks_nosnosci TEXT,
      indeks_predkosci TEXT,
      kategoria TEXT,
      cena_zakupu REAL,
      cena_sprzedazy REAL,
      stan INTEGER,
      zarejestrowano_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_historia_cen_kod_data ON historia_cen(kod, zarejestrowano_at);
    CREATE INDEX IF NOT EXISTS idx_historia_cen_ean_data ON historia_cen(ean, zarejestrowano_at);
    CREATE INDEX IF NOT EXISTS idx_historia_cen_dostawca_data ON historia_cen(dostawca, zarejestrowano_at);
    CREATE INDEX IF NOT EXISTS idx_historia_cen_marka ON historia_cen(marka);
    CREATE INDEX IF NOT EXISTS idx_historia_cen_rozmiar ON historia_cen(rozmiar);
  `);
}

function safeAll(db, sql, params = []) { try { return db.prepare(sql).all(...params); } catch (e) { return []; } }
function safeGet(db, sql, params = []) { try { return db.prepare(sql).get(...params) || null; } catch (e) { return null; } }
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function round(v, p = 2) { const n = num(v, 0); const m = Math.pow(10, p); return Math.round(n * m) / m; }
function median(values) { const a = values.map(Number).filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return null; const mid = Math.floor(a.length / 2); return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2; }
function csvEscape(v) { if (v == null) return ''; const s = String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function toCsv(rows) { if (!rows || !rows.length) return '\uFEFF'; const cols = Object.keys(rows[0]); return '\uFEFF' + [cols.join(';'), ...rows.map(r => cols.map(c => csvEscape(r[c])).join(';'))].join('\n'); }
function hasHistory(db) { const r = safeGet(db, 'SELECT COUNT(*) AS c FROM historia_cen'); return !!(r && r.c > 0); }

function currentWhere(q, alias = 'p') {
  const w = [`${alias}.status = 'aktywny'`];
  const p = [];
  if (q.dostawcy) { const vals = String(q.dostawcy).split(',').filter(Boolean); if (vals.length) { w.push(`${alias}.dostawca IN (${vals.map(() => '?').join(',')})`); p.push(...vals); } }
  if (q.marka) { w.push(`${alias}.marka = ?`); p.push(String(q.marka)); }
  if (q.model) { w.push(`${alias}.model = ?`); p.push(String(q.model)); }
  if (q.rozmiar) { w.push(`${alias}.rozmiar = ?`); p.push(String(q.rozmiar)); }
  if (q.indeksNosnosci) { w.push(`${alias}.indeks_nosnosci = ?`); p.push(String(q.indeksNosnosci)); }
  if (q.indeksPredkosci) { w.push(`${alias}.indeks_predkosci = ?`); p.push(String(q.indeksPredkosci)); }
  if (q.cenaMin) { w.push(`${alias}.cena_zakupu >= ?`); p.push(Number(q.cenaMin)); }
  if (q.cenaMax) { w.push(`${alias}.cena_zakupu <= ?`); p.push(Number(q.cenaMax)); }
  if (q.stan === 'dostepne') w.push(`${alias}.stan > 0`);
  if (q.stan === 'braki') w.push(`${alias}.stan <= 0`);
  return { where: 'WHERE ' + w.join(' AND '), params: p };
}

function registerAnalyticsRoutes(app, dbOrCtx, authMaybe) {
  const db = asDb(dbOrCtx);
  const requireAuth = asAuth(dbOrCtx, authMaybe);
  ensureSchema(db);

  app.post('/api/analytics/bootstrap-current', requireAuth, (req, res) => {
    try {
      const now = new Date().toISOString();
      const info = db.prepare(`
        INSERT INTO historia_cen (produkt_id, kod, ean, dostawca, marka, model, rozmiar, indeks_nosnosci, indeks_predkosci, kategoria, cena_zakupu, cena_sprzedazy, stan, zarejestrowano_at)
        SELECT id, kod, ean, dostawca, marka, model, rozmiar, indeks_nosnosci, indeks_predkosci, kategoria, cena_zakupu, cena_sprzedazy, stan, ?
        FROM products WHERE status = 'aktywny'
      `).run(now);
      res.json({ ok: true, inserted: info.changes, at: now });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/analytics/status', requireAuth, (req, res) => {
    const h = safeGet(db, 'SELECT COUNT(*) AS snapshots, MIN(zarejestrowano_at) AS od, MAX(zarejestrowano_at) AS do FROM historia_cen');
    res.json({ hasHistory: !!(h && h.snapshots > 0), snapshots: h?.snapshots || 0, od: h?.od || null, do: h?.do || null });
  });

  app.get('/api/analytics/filters', requireAuth, (req, res) => {
    res.json({
      dostawcy: safeAll(db, "SELECT DISTINCT dostawca AS value FROM products WHERE dostawca IS NOT NULL AND dostawca != '' ORDER BY dostawca"),
      marki: safeAll(db, "SELECT DISTINCT marka AS value FROM products WHERE marka IS NOT NULL AND marka != '' ORDER BY marka LIMIT 500"),
      modele: safeAll(db, "SELECT DISTINCT model AS value FROM products WHERE model IS NOT NULL AND model != '' ORDER BY model LIMIT 1000"),
      rozmiary: safeAll(db, "SELECT DISTINCT rozmiar AS value FROM products WHERE rozmiar IS NOT NULL AND rozmiar != '' ORDER BY rozmiar LIMIT 1000"),
      indeksyNosnosci: safeAll(db, "SELECT DISTINCT indeks_nosnosci AS value FROM products WHERE indeks_nosnosci IS NOT NULL AND indeks_nosnosci != '' ORDER BY indeks_nosnosci LIMIT 300"),
      indeksyPredkosci: safeAll(db, "SELECT DISTINCT indeks_predkosci AS value FROM products WHERE indeks_predkosci IS NOT NULL AND indeks_predkosci != '' ORDER BY indeks_predkosci LIMIT 300"),
    });
  });

  // Part 1: supplier analysis
  app.get('/api/analytics/suppliers/stability', requireAuth, (req, res) => {
    const hist = hasHistory(db);
    let rows = [];
    if (hist) {
      rows = safeAll(db, `
        WITH seq AS (
          SELECT dostawca, kod, cena_zakupu, zarejestrowano_at,
                 LAG(cena_zakupu) OVER (PARTITION BY dostawca, kod ORDER BY zarejestrowano_at) AS prev_price
          FROM historia_cen WHERE cena_zakupu IS NOT NULL
        )
        SELECT dostawca,
               COUNT(*) AS punkty,
               SUM(CASE WHEN prev_price IS NOT NULL AND ABS(cena_zakupu - prev_price) > 0.01 THEN 1 ELSE 0 END) AS liczbaZmian,
               ROUND(AVG(CASE WHEN prev_price > 0 THEN ABS((cena_zakupu - prev_price) / prev_price * 100) END), 2) AS sredniaZmianaPct,
               ROUND(MAX(CASE WHEN prev_price > 0 THEN ABS((cena_zakupu - prev_price) / prev_price * 100) END), 2) AS maxZmianaPct
        FROM seq GROUP BY dostawca ORDER BY sredniaZmianaPct DESC
      `);
    } else {
      rows = safeAll(db, `SELECT dostawca, COUNT(*) AS produkty, ROUND(AVG(cena_zakupu),2) AS sredniaCena, ROUND(AVG(stan),2) AS sredniStan, NULL AS liczbaZmian, NULL AS sredniaZmianaPct, NULL AS maxZmianaPct FROM products WHERE status='aktywny' GROUP BY dostawca ORDER BY produkty DESC`);
    }
    res.json({ hasHistory: hist, rows });
  });

  app.get('/api/analytics/suppliers/lifecycle', requireAuth, (req, res) => {
    const rows = safeAll(db, `
      SELECT dostawca, typ_zmiany AS typ, kod, nazwa, utworzono AS kiedy, powod
      FROM staging_items
      WHERE typ_zmiany IN ('nowa','wycofana')
      ORDER BY utworzono DESC LIMIT 500
    `);
    res.json({ rows });
  });

  app.get('/api/analytics/suppliers/stock', requireAuth, (req, res) => {
    const rows = safeAll(db, `
      SELECT dostawca,
             COUNT(*) AS produkty,
             ROUND(AVG(stan),2) AS sredniStan,
             SUM(CASE WHEN stan > 0 THEN 1 ELSE 0 END) AS dostepne,
             ROUND(100.0 * SUM(CASE WHEN stan > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS dostepnoscPct
      FROM products WHERE status='aktywny'
      GROUP BY dostawca ORDER BY dostepnoscPct DESC, produkty DESC
    `);
    res.json({ rows });
  });

  app.get('/api/analytics/availability/products', requireAuth, (req, res) => {
    const hist = hasHistory(db);
    let rows = [];
    if (hist) {
      rows = safeAll(db, `
        SELECT kod, ean, dostawca, MAX(nazwa) AS nazwa,
               COUNT(*) AS snapshoty,
               ROUND(100.0 * SUM(CASE WHEN stan > 0 THEN 1 ELSE 0 END) / COUNT(*),2) AS dostepnoscPct,
               GROUP_CONCAT(CASE WHEN stan <= 0 THEN substr(zarejestrowano_at,1,7) END) AS miesiaceBrakow
        FROM historia_cen GROUP BY dostawca, kod ORDER BY dostepnoscPct ASC LIMIT 500
      `);
    } else {
      rows = safeAll(db, `SELECT kod, ean, dostawca, nazwa, stan, CASE WHEN stan > 0 THEN 100 ELSE 0 END AS dostepnoscPct, NULL AS miesiaceBrakow FROM products WHERE status='aktywny' ORDER BY stan ASC LIMIT 500`);
    }
    res.json({ hasHistory: hist, rows });
  });

  app.get('/api/analytics/availability/sell-through', requireAuth, (req, res) => {
    const hist = hasHistory(db);
    const rows = hist ? safeAll(db, `
      WITH seq AS (
        SELECT dostawca, kod, MAX(nazwa) AS nazwa, stan,
               LAG(stan) OVER (PARTITION BY dostawca, kod ORDER BY zarejestrowano_at) AS prev_stan
        FROM historia_cen GROUP BY dostawca, kod, zarejestrowano_at
      )
      SELECT dostawca, kod, nazwa, SUM(CASE WHEN prev_stan > stan THEN prev_stan - stan ELSE 0 END) AS zeszloSztuk
      FROM seq GROUP BY dostawca, kod ORDER BY zeszloSztuk DESC LIMIT 500
    `) : [];
    res.json({ hasHistory: hist, rows });
  });

  // Part 2: EAN comparison
  app.get('/api/analytics/ean/comparison', requireAuth, (req, res) => {
    const minDiff = num(req.query.minDiffPct, 0);
    const rows = safeAll(db, `
      SELECT ean, MAX(nazwa) AS nazwa, COUNT(DISTINCT dostawca) AS dostawcy,
             MIN(cena_zakupu) AS cenaMin, MAX(cena_zakupu) AS cenaMax,
             ROUND(AVG(cena_zakupu),2) AS srednia, COUNT(*) AS oferty
      FROM products WHERE status='aktywny' AND ean IS NOT NULL AND ean != '' AND cena_zakupu > 0
      GROUP BY ean HAVING COUNT(DISTINCT dostawca) >= 2
      ORDER BY (MAX(cena_zakupu)-MIN(cena_zakupu)) DESC LIMIT 1000
    `).map(r => ({ ...r, spreadZl: round(r.cenaMax - r.cenaMin), spreadPct: r.cenaMin ? round((r.cenaMax - r.cenaMin) / r.cenaMin * 100) : null }))
      .filter(r => !minDiff || (r.spreadPct || 0) >= minDiff);
    res.json({ rows });
  });

  app.get('/api/analytics/ean/details', requireAuth, (req, res) => {
    const ean = String(req.query.ean || '');
    if (!ean) return res.json({ ean: null, offers: [] });
    const offers = safeAll(db, `SELECT dostawca, kod, nazwa, cena_zakupu AS cenaZakupu, cena_sprzedazy AS cenaSprzedazy, stan, marza_pct AS marzaPct FROM products WHERE ean=? AND status='aktywny' ORDER BY cena_zakupu ASC`, [ean]);
    const prices = offers.map(o => o.cenaZakupu).filter(v => v != null);
    res.json({ ean, offers: offers.map((o, i) => ({ ...o, pozycjaCenowa: i + 1 })), mediana: median(prices), srednia: prices.length ? round(prices.reduce((a,b)=>a+b,0)/prices.length) : null });
  });

  app.get('/api/analytics/ean/unique', requireAuth, (req, res) => {
    const rows = safeAll(db, `
      SELECT ean, MAX(nazwa) AS nazwa, MAX(dostawca) AS dostawca, MAX(cena_zakupu) AS cenaZakupu, MAX(stan) AS stan
      FROM products WHERE status='aktywny' AND ean IS NOT NULL AND ean != ''
      GROUP BY ean HAVING COUNT(DISTINCT dostawca)=1 ORDER BY nazwa LIMIT 1000
    `);
    res.json({ rows });
  });

  app.get('/api/analytics/ean/coverage', requireAuth, (req, res) => {
    const rows = safeAll(db, `SELECT dostawcy AS liczbaDostawcow, COUNT(*) AS liczbaEAN FROM (SELECT ean, COUNT(DISTINCT dostawca) AS dostawcy FROM products WHERE status='aktywny' AND ean IS NOT NULL AND ean != '' GROUP BY ean) GROUP BY dostawcy ORDER BY dostawcy`);
    res.json({ rows });
  });

  app.get('/api/analytics/ean/supplier-rank', requireAuth, (req, res) => {
    const rows = safeAll(db, `
      WITH ranked AS (
        SELECT ean, dostawca, cena_zakupu, RANK() OVER (PARTITION BY ean ORDER BY cena_zakupu ASC) AS pozycja
        FROM products WHERE status='aktywny' AND ean IS NOT NULL AND ean != '' AND cena_zakupu > 0
      )
      SELECT dostawca, COUNT(*) AS wspolnePozycje, SUM(CASE WHEN pozycja=1 THEN 1 ELSE 0 END) AS najtanszy,
             ROUND(100.0 * SUM(CASE WHEN pozycja=1 THEN 1 ELSE 0 END) / COUNT(*),2) AS najtanszyPct
      FROM ranked GROUP BY dostawca ORDER BY najtanszyPct DESC
    `);
    res.json({ rows });
  });

  app.get('/api/analytics/market/group-prices', requireAuth, (req, res) => {
    const group = ['marka','model','rozmiar'].includes(req.query.group) ? req.query.group : 'marka';
    const col = group === 'rozmiar' ? 'rozmiar' : group;
    const rows = safeAll(db, `SELECT ${col} AS grupa, COUNT(*) AS oferty, ROUND(AVG(cena_zakupu),2) AS srednia, MIN(cena_zakupu) AS min, MAX(cena_zakupu) AS max FROM products WHERE status='aktywny' AND ${col} IS NOT NULL AND ${col} != '' GROUP BY ${col} ORDER BY oferty DESC LIMIT 500`);
    res.json({ group, rows });
  });

  // Part 3: price changes/time
  app.get('/api/analytics/prices/last-import', requireAuth, (req, res) => {
    const rows = safeAll(db, `SELECT kod, nazwa, dostawca, cena_zakupu_stara AS cenaStara, cena_zakupu_nowa AS cenaNowa, zmiana_pct AS zmianaPct, utworzono FROM staging_items WHERE cena_zakupu_stara IS NOT NULL AND cena_zakupu_nowa IS NOT NULL ORDER BY id DESC LIMIT 500`);
    res.json({ rows });
  });

  app.get('/api/analytics/prices/product-history', requireAuth, (req, res) => {
    const ean = String(req.query.ean || '');
    const kod = String(req.query.kod || '');
    const params = [];
    let where = 'WHERE 1=1';
    if (ean) { where += ' AND ean = ?'; params.push(ean); }
    if (kod) { where += ' AND kod = ?'; params.push(kod); }
    const hist = hasHistory(db);
    const rows = hist ? safeAll(db, `SELECT zarejestrowano_at AS data, dostawca, kod, ean, cena_zakupu AS cenaZakupu, cena_sprzedazy AS cenaSprzedazy, stan FROM historia_cen ${where} ORDER BY zarejestrowano_at`, params) : [];
    const prices = rows.map(r => r.cenaZakupu).filter(v => v != null);
    res.json({ hasHistory: hist, rows, stats: { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null, avg: prices.length ? round(prices.reduce((a,b)=>a+b,0)/prices.length) : null } });
  });

  app.get('/api/analytics/prices/inflation', requireAuth, (req, res) => {
    const hist = hasHistory(db);
    const rows = hist ? safeAll(db, `
      WITH month_avg AS (
        SELECT dostawca, substr(zarejestrowano_at,1,7) AS miesiac, AVG(cena_zakupu) AS avg_price
        FROM historia_cen WHERE cena_zakupu > 0 GROUP BY dostawca, miesiac
      ), seq AS (
        SELECT dostawca, miesiac, avg_price, LAG(avg_price) OVER (PARTITION BY dostawca ORDER BY miesiac) AS prev_price FROM month_avg
      )
      SELECT dostawca, miesiac, ROUND(avg_price,2) AS sredniaCena, ROUND(CASE WHEN prev_price > 0 THEN (avg_price-prev_price)/prev_price*100 END,2) AS inflacjaPct
      FROM seq ORDER BY miesiac DESC, dostawca LIMIT 500
    `) : [];
    res.json({ hasHistory: hist, rows });
  });

  // Part 4: seasonality / life cycle
  app.get('/api/analytics/seasonality/monthly', requireAuth, (req, res) => {
    const hist = hasHistory(db);
    const rows = hist ? safeAll(db, `SELECT substr(zarejestrowano_at,6,2) AS miesiac, marka, ROUND(AVG(cena_zakupu),2) AS sredniaCena, ROUND(AVG(CASE WHEN stan>0 THEN 100 ELSE 0 END),2) AS dostepnoscPct FROM historia_cen WHERE cena_zakupu > 0 GROUP BY miesiac, marka ORDER BY marka, miesiac`) : [];
    res.json({ hasHistory: hist, rows });
  });

  app.get('/api/analytics/lifecycle/models', requireAuth, (req, res) => {
    const hist = hasHistory(db);
    const rows = hist ? safeAll(db, `SELECT marka, model, MIN(zarejestrowano_at) AS pierwszyRaz, MAX(zarejestrowano_at) AS ostatniRaz, COUNT(DISTINCT kod) AS produkty FROM historia_cen WHERE model IS NOT NULL AND model != '' GROUP BY marka, model ORDER BY ostatniRaz DESC LIMIT 1000`) : safeAll(db, `SELECT marka, model, MIN(data_aktualizacji) AS pierwszyRaz, MAX(data_aktualizacji) AS ostatniRaz, COUNT(*) AS produkty FROM products WHERE model IS NOT NULL AND model != '' GROUP BY marka, model ORDER BY produkty DESC LIMIT 1000`);
    res.json({ hasHistory: hist, rows });
  });

  // Part 5 / margins / rotation
  app.get('/api/analytics/margins', requireAuth, (req, res) => {
    const rows = safeAll(db, `SELECT dostawca, kategoria, marka, COUNT(*) AS produkty, ROUND(AVG(marza_pct),2) AS avgMarza, MIN(marza_pct) AS minMarza, MAX(marza_pct) AS maxMarza FROM products WHERE status='aktywny' GROUP BY dostawca, kategoria, marka ORDER BY avgMarza ASC LIMIT 1000`);
    const low = safeAll(db, `SELECT kod, nazwa, dostawca, cena_zakupu AS cenaZakupu, cena_sprzedazy AS cenaSprzedazy, marza_pct AS marzaPct FROM products WHERE status='aktywny' AND marza_pct < 5 ORDER BY marza_pct ASC LIMIT 200`);
    const high = safeAll(db, `SELECT kod, nazwa, dostawca, cena_zakupu AS cenaZakupu, cena_sprzedazy AS cenaSprzedazy, marza_pct AS marzaPct FROM products WHERE status='aktywny' AND marza_pct > 80 ORDER BY marza_pct DESC LIMIT 200`);
    res.json({ rows, low, high });
  });

  app.get('/api/analytics/rotation/inactive', requireAuth, (req, res) => {
    const days = Math.min(730, Math.max(1, parseInt(req.query.days || '60', 10)));
    const rows = safeAll(db, `SELECT kod, nazwa, dostawca, marka, model, rozmiar, stan, data_aktualizacji AS ostatniaAktualizacja FROM products WHERE status='aktywny' AND (data_aktualizacji IS NULL OR data_aktualizacji < datetime('now','-' || ? || ' days')) ORDER BY data_aktualizacji ASC LIMIT 1000`, [days]);
    res.json({ days, rows });
  });

  app.get('/api/analytics/export/:view', requireAuth, (req, res) => {
    const view = req.params.view;
    const fakeReq = { query: req.query };
    const sendRows = rows => { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename=${view}.csv`); res.send(toCsv(rows)); };
    try {
      if (view === 'suppliers-stability') return sendRows(safeAll(db, `SELECT dostawca, COUNT(DISTINCT produkt_id) AS produkty, COUNT(*) AS punkty, ROUND(AVG(cena_zakupu),2) AS sredniaCena, ROUND(AVG(stan),2) AS sredniStan FROM historia_cen GROUP BY dostawca ORDER BY dostawca`));
      if (view === 'suppliers-lifecycle') return sendRows(safeAll(db, `SELECT typ_zmiany AS typ, dostawca, kod, nazwa, powod, utworzono AS kiedy FROM staging_items WHERE typ_zmiany IN ('nowa','nowy','wycofana','zniknal') ORDER BY utworzono DESC LIMIT 5000`));
      if (view === 'suppliers-stock') return sendRows(safeAll(db, `SELECT dostawca, COUNT(*) AS produkty, ROUND(AVG(stan),2) AS sredniStan, SUM(CASE WHEN stan>0 THEN 1 ELSE 0 END) AS dostepne, ROUND(100.0*SUM(CASE WHEN stan>0 THEN 1 ELSE 0 END)/COUNT(*),2) AS dostepnoscPct FROM products WHERE status='aktywny' GROUP BY dostawca ORDER BY dostawca`));
      if (view === 'ean-comparison') return sendRows(safeAll(db, `SELECT ean, MAX(nazwa) AS nazwa, COUNT(DISTINCT dostawca) AS dostawcy, MIN(cena_zakupu) AS cenaMin, MAX(cena_zakupu) AS cenaMax, ROUND(MAX(cena_zakupu)-MIN(cena_zakupu),2) AS spreadZl, ROUND((MAX(cena_zakupu)-MIN(cena_zakupu))*100.0/NULLIF(MIN(cena_zakupu),0),2) AS spreadPct FROM products WHERE status='aktywny' AND ean IS NOT NULL AND ean != '' GROUP BY ean HAVING COUNT(DISTINCT dostawca)>=2`));
      if (view === 'unique') return sendRows(safeAll(db, `SELECT ean, MAX(nazwa) AS nazwa, MAX(dostawca) AS dostawca, MAX(cena_zakupu) AS cenaZakupu, MAX(stan) AS stan FROM products WHERE status='aktywny' AND ean IS NOT NULL AND ean != '' GROUP BY ean HAVING COUNT(DISTINCT dostawca)=1`));
      if (view === 'prices-last') return sendRows(safeAll(db, `SELECT utworzono, dostawca, kod, nazwa, cena_zakupu_stara AS cenaStara, cena_zakupu_nowa AS cenaNowa, zmiana_pct AS zmianaPct FROM staging_items WHERE cena_zakupu_stara IS NOT NULL ORDER BY utworzono DESC LIMIT 5000`));
      if (view === 'availability-products') return sendRows(safeAll(db, `SELECT dostawca, kod, ean, nazwa, ROUND(100.0*SUM(CASE WHEN stan>0 THEN 1 ELSE 0 END)/COUNT(*),2) AS dostepnoscPct FROM historia_cen GROUP BY dostawca,kod,ean,nazwa ORDER BY dostepnoscPct ASC LIMIT 5000`));
      if (view === 'sell-through') return sendRows(safeAll(db, `SELECT dostawca, kod, MAX(nazwa) AS nazwa, SUM(spadek) AS zeszloSztuk FROM (SELECT h.*, MAX(0, LAG(stan) OVER (PARTITION BY dostawca,kod ORDER BY zarejestrowano_at)-stan) AS spadek FROM historia_cen h) GROUP BY dostawca,kod ORDER BY zeszloSztuk DESC LIMIT 5000`));
      if (view === 'margins') return sendRows(safeAll(db, `SELECT kod,nazwa,dostawca,kategoria,marka,marza_pct FROM products WHERE status='aktywny' ORDER BY marza_pct ASC LIMIT 5000`));
      if (view === 'rotation-inactive') return sendRows(safeAll(db, `SELECT kod,nazwa,dostawca,marka,model,rozmiar,stan,data_aktualizacji AS ostatniaAktualizacja FROM products WHERE status='aktywny' ORDER BY data_aktualizacji ASC LIMIT 5000`));
      return sendRows([]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Backward-compatible aliases used by previous frontend build.
  app.get('/api/analytics/kpi', requireAuth, (req, res) => {
    const totalProducts = safeGet(db, "SELECT COUNT(*) AS produkty FROM products WHERE status='aktywny'") || {};
    const dostawcy = safeGet(db, "SELECT COUNT(DISTINCT dostawca) AS dostawcy FROM products WHERE status='aktywny'") || {};
    const avgMarza = safeGet(db, "SELECT ROUND(AVG(marza_pct),2) AS avgMarza FROM products WHERE status='aktywny'") || {};
    const staging = safeGet(db, "SELECT COUNT(*) AS stagingPending FROM staging_items WHERE zatwierdzono_data IS NULL") || {};
    res.json({ ...totalProducts, ...dostawcy, ...avgMarza, ...staging });
  });
  app.get('/api/analytics/dostawcy-stats', requireAuth, (req, res) => res.json(safeAll(db, `SELECT dostawca, COUNT(*) AS liczbaProduktow, ROUND(AVG(marza_pct),2) AS avgMarza, ROUND(AVG(cena_zakupu),2) AS avgCenaZakupu, SUM(CASE WHEN stan>0 THEN 1 ELSE 0 END) AS dostepnych FROM products WHERE status='aktywny' GROUP BY dostawca ORDER BY liczbaProduktow DESC`)));
  app.get('/api/analytics/top-zmiany', requireAuth, (req, res) => res.json(safeAll(db, `SELECT kod,nazwa,dostawca,cena_zakupu_stara AS cenaStara,cena_zakupu_nowa AS cenaNowa,zmiana_pct AS zmianaPct,utworzono FROM staging_items WHERE cena_zakupu_stara IS NOT NULL ORDER BY ABS(zmiana_pct) DESC LIMIT 100`)));
  app.get('/api/analytics/importy-timeline', requireAuth, (req, res) => res.json(safeAll(db, `SELECT id,kiedy,uzytkownik_imie AS uzytkownik,encja_id AS dostawca,szczegoly_json AS szczegolyJson FROM audit_log WHERE akcja IN ('import_z_url','import_pliku','import') ORDER BY id DESC LIMIT 200`)));
  app.get('/api/analytics/ean-porownanie', requireAuth, (req, res) => {
    const ean = String(req.query.ean || '');
    if (ean) return res.json(safeAll(db, `SELECT dostawca,kod,nazwa,cena_zakupu AS cenaZakupu,cena_sprzedazy AS cenaSprzedazy,stan,marza_pct AS marzaPct FROM products WHERE ean=? AND status='aktywny' ORDER BY cena_zakupu ASC`, [ean]));
    res.json(safeAll(db, `SELECT ean,MAX(nazwa) AS nazwa,COUNT(DISTINCT dostawca) AS dostawcy,MIN(cena_zakupu) AS cenaMin,MAX(cena_zakupu) AS cenaMax FROM products WHERE status='aktywny' AND ean IS NOT NULL AND ean!='' GROUP BY ean HAVING COUNT(DISTINCT dostawca)>=2 ORDER BY (MAX(cena_zakupu)-MIN(cena_zakupu)) DESC LIMIT 200`));
  });
}

module.exports = { registerAnalyticsRoutes, registerAnalytics: registerAnalyticsRoutes };
