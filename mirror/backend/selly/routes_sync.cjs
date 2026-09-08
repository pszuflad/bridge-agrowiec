// backend/selly/routes_sync.cjs
// Endpointy manualne dla synchronizacji Bridge -> Selly:
//   GET  /api/selly/sync-status               - stan rate limitera + ostatnie logi
//   POST /api/selly/sync-delta-supplier       - {dostawca} - Tor 1 dla jednego dostawcy
//   POST /api/selly/sync-delta-all            - Tor 1 dla wszystkich
//   POST /api/selly/sync-full-supplier        - {dostawca, autoCreate?:true} - Tor 2 dla jednego
//   POST /api/selly/sync-full-today           - Tor 2 dla dzisiejszej rotacji
//   POST /api/selly/sync-full-force           - {dostawcy: [...], autoCreate?:false} - manualny
//
// Data: 2026-09-07

'use strict';

const { runDeltaAll, runFullTodays, suppliersForFullToday, ACTIVE_SUPPLIERS } = require('./scheduler_selly.cjs');
const { syncDeltaForDostawca } = require('./sync_delta.cjs');
const { syncFullForDostawca } = require('./sync_full.cjs');
const { globalLimiter } = require('./rate_limiter.cjs');

function registerSyncRoutes(app, { db, requireAuth }) {
  const auth = requireAuth || ((req, res, next) => next());

  // --- Status ---
  app.get('/api/selly/sync-status', auth, (req, res) => {
    try {
      const limiter = globalLimiter.getStats();
      const recentLogs = db.prepare(`
        SELECT id, operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip,
               rozpoczeto, zakonczono, status, szczegoly_json
        FROM selly_sync_log
        ORDER BY rozpoczeto DESC
        LIMIT 20
      `).all();
      const todayRotation = suppliersForFullToday(new Date());
      res.json({ ok: true, limiter, todayRotation, activeSuppliers: ACTIVE_SUPPLIERS, recentLogs });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // --- Tor 1 dla jednego dostawcy ---
  app.post('/api/selly/sync-delta-supplier', auth, async (req, res) => {
    const dostawca = req.body?.dostawca;
    if (!dostawca || !ACTIVE_SUPPLIERS.includes(dostawca)) {
      return res.status(400).json({ ok: false, error: 'Zly dostawca. Wymagany jeden z: ' + ACTIVE_SUPPLIERS.join(',') });
    }
    try {
      const result = await syncDeltaForDostawca(db, dostawca);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // --- Tor 1 dla wszystkich ---
  app.post('/api/selly/sync-delta-all', auth, async (req, res) => {
    try {
      const results = await runDeltaAll(db);
      res.json({ ok: true, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // --- Tor 2 dla jednego dostawcy ---
  app.post('/api/selly/sync-full-supplier', auth, async (req, res) => {
    const dostawca = req.body?.dostawca;
    const autoCreate = req.body?.autoCreate !== false;
    if (!dostawca || !ACTIVE_SUPPLIERS.includes(dostawca)) {
      return res.status(400).json({ ok: false, error: 'Zly dostawca' });
    }
    try {
      const result = await syncFullForDostawca(db, dostawca, { autoCreate });
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // --- Tor 2 dla dzisiejszej rotacji ---
  app.post('/api/selly/sync-full-today', auth, async (req, res) => {
    try {
      const results = await runFullTodays(db);
      res.json({ ok: true, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // --- Tor 2 wymuszony dla konkretnych dostawcow ---
  app.post('/api/selly/sync-full-force', auth, async (req, res) => {
    const dostawcy = Array.isArray(req.body?.dostawcy) ? req.body.dostawcy : [];
    const autoCreate = req.body?.autoCreate === true; // domyslnie NIE (ostroznie)
    if (dostawcy.length === 0 || dostawcy.some(d => !ACTIVE_SUPPLIERS.includes(d))) {
      return res.status(400).json({ ok: false, error: 'Podaj tablice dostawcow z: ' + ACTIVE_SUPPLIERS.join(',') });
    }
    try {
      const results = await runFullTodays(db, { forceSuppliers: dostawcy, autoCreate });
      res.json({ ok: true, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log('[Selly Sync] Zarejestrowano: /api/selly/sync-status, /sync-delta-{supplier,all}, /sync-full-{supplier,today,force}');
}

module.exports = { registerSyncRoutes };
