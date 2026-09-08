// backend/selly/scheduler_selly.cjs
// Scheduler dla synchronizacji Bridge -> Selly.
//
// Tor 1 (DELTA - stan/cena) - AKTYWNY:
//   - Uruchamia sie o HH:55 dla dostawcow ktorzy maja auto-pull o HH:54
//   - Fallback: co 15 min sprawdza wszystkich dostawcow (dla recznych aktualizacji)
//   - Kazde uruchomienie: syncDelta per dostawca (findDeltaProducts + PUT wariant)
//
// Tor 2 (PELNY MIRROR + auto-create) - AKTYWNY od 2026-09-08:
//   - Uruchamia sie codziennie o 04:30 CEST (po auto-pull dostawcow o 04:00)
//   - Rotacja per dzien tygodnia (patrz FULL_ROTATION)
//   - Wykorzystuje discovery.buildProductCodeCache (75s jednorazowo) + 3 sciezki A/B/C
//
// Data: 2026-09-08 (v3 - wlaczony Tor 2 z rotacja)

'use strict';

const { syncDelta } = require('./sync_delta.cjs');
const { syncFullForDostawca } = require('./sync_full.cjs');
const { globalLimiter } = require('./rate_limiter.cjs');

const ACTIVE_SUPPLIERS = ['MO1', 'MO2', 'MO3', 'MO4', 'MO5', 'MO6', 'MO7', 'MO8', 'MO9', 'MO10'];

// Rotacja Toru 2 per dzien tygodnia (0=nd, 1=pn, ..., 6=so)
// Duzi dostawcy w tygodniu, mali w weekend (MO7, MO8 raz w miesiacu).
const FULL_ROTATION = {
  1: ['MO1', 'MO2'],
  2: ['MO3', 'MO4'],
  3: ['MO5', 'MO6'],
  4: ['MO9'],
  5: ['MO10'],
  6: ['MO7'], // tylko pierwsza sobota miesiaca
  0: ['MO8'], // tylko pierwsza niedziela miesiaca
};

const TOR2_HOUR = 4;   // 04:30 CEST
const TOR2_MINUTE = 30;

function isFirstOfMonthDay(date, targetDow) {
  if (date.getDay() !== targetDow) return false;
  return date.getDate() <= 7;
}

function suppliersForFullToday(date = new Date()) {
  const dow = date.getDay();
  const scheduled = FULL_ROTATION[dow] || [];
  return scheduled.filter(s => {
    if (s === 'MO7') return isFirstOfMonthDay(date, 6);
    if (s === 'MO8') return isFirstOfMonthDay(date, 0);
    return true;
  });
}

/**
 * Uruchom Tor 1 dla wszystkich (lub podanych) dostawcow.
 */
async function runDeltaAll(db, opts = {}) {
  const suppliers = opts.suppliers || ACTIVE_SUPPLIERS;
  const results = [];
  for (const s of suppliers) {
    try {
      const r = await syncDelta(db, s, {
        dryRun: opts.dryRun || false,
        maxProducts: opts.maxProducts || 5000,
      });
      results.push({ dostawca: s, ...r.stats });
      if (r.stats.total > 0) {
        console.log(`[Selly Tor1] ${s}: total=${r.stats.total}, ok=${r.stats.ok}, err=${r.stats.err}, discovered=${r.stats.discovered}`);
      }
    } catch (e) {
      results.push({ ok: false, dostawca: s, error: e.message });
      console.error(`[Selly Tor1] ${s} FATAL:`, e.message);
    }
  }
  return results;
}

/**
 * Uruchom Tor 2 dla podanych dostawcow (rotacja per dzien).
 * Cache Selly (buildProductCodeCache) budowany JEDEN raz przed calym batchem.
 */
async function runFullBatch(db, opts = {}) {
  const suppliers = opts.suppliers || suppliersForFullToday(new Date());
  if (!suppliers.length) {
    console.log('[Selly Tor2] Brak dostawcow w rotacji na dzis.');
    return [];
  }
  console.log(`[Selly Tor2] Start batch dla: ${suppliers.join(', ')} (dryRun=${!!opts.dryRun})`);
  const results = [];
  for (let i = 0; i < suppliers.length; i++) {
    const s = suppliers[i];
    try {
      const r = await syncFullForDostawca(db, s, {
        dryRun: opts.dryRun || false,
        maxProducts: opts.maxProducts || 5000,
        autoCreate: opts.autoCreate !== false,
        buildCache: i === 0, // cache tylko raz na batch
      });
      results.push({ dostawca: s, ...r.stats, duration_ms: r.durationMs });
      console.log(`[Selly Tor2] ${s}: A=${r.stats.updated_A}, B=${r.stats.created_variant_B}, C=${r.stats.created_C}, err=${r.stats.err}, time=${(r.durationMs/1000).toFixed(1)}s`);
    } catch (e) {
      results.push({ ok: false, dostawca: s, error: e.message });
      console.error(`[Selly Tor2] ${s} FATAL:`, e.message);
    }
  }
  return results;
}

/**
 * Zainstaluj scheduler w procesie. Sprawdza co minute co jest do zrobienia.
 */
function installScheduler(db, opts = {}) {
  const CHECK_INTERVAL_MS = 60_000;
  let lastRunKey = null;
  let lastFullKey = null; // "YYYY-MM-DD" - Tor 2 raz dziennie

  const tick = async () => {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const dateKey = now.toISOString().substring(0, 10);
    const key = `${dateKey} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;

    // Tor 1 event-driven (HH:55) + fallback (HH:10, HH:25, HH:40)
    if ([55, 10, 25, 40].includes(mm) && lastRunKey !== key) {
      lastRunKey = key;
      const tag = mm === 55 ? 'event-driven' : 'fallback';
      console.log(`[Selly Scheduler] Tor1 ${tag} ${hh}:${String(mm).padStart(2,'0')}`);
      runDeltaAll(db, opts).catch(e => console.error('[Selly Scheduler] Tor1 err:', e.message));
    }

    // Tor 2 raz dziennie (04:30 CEST) - po nocnym auto-pull dostawcow (04:00)
    if (hh === TOR2_HOUR && mm === TOR2_MINUTE && lastFullKey !== dateKey) {
      lastFullKey = dateKey;
      const suppliers = suppliersForFullToday(now);
      if (suppliers.length) {
        console.log(`[Selly Scheduler] Tor2 start ${hh}:${String(mm).padStart(2,'0')} suppliers=${suppliers.join(',')}`);
        runFullBatch(db, opts).catch(e => console.error('[Selly Scheduler] Tor2 err:', e.message));
      }
    }
  };

  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  console.log(`[Selly Scheduler] Zainstalowany. Tor1: HH:55 + HH:10/25/40. Tor2: codziennie ${TOR2_HOUR}:${String(TOR2_MINUTE).padStart(2,'0')} (rotacja per dzien).`);
  return () => clearInterval(timer);
}

module.exports = {
  installScheduler,
  runDeltaAll,
  runFullBatch,
  suppliersForFullToday,
  ACTIVE_SUPPLIERS,
  FULL_ROTATION,
};
