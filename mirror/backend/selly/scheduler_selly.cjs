// backend/selly/scheduler_selly.cjs
// Scheduler dla synchronizacji Bridge -> Selly.
//
// Tor 1 (DELTA - stan/cena) - AKTYWNY:
//   - Uruchamia sie o HH:55 dla dostawcow ktorzy maja auto-pull o HH:54
//   - Fallback: co 15 min sprawdza wszystkich dostawcow (dla recznych aktualizacji)
//   - Kazde uruchomienie: syncDelta per dostawca (findDeltaProducts + PUT wariant)
//
// Tor 2 (PELNY MIRROR + auto-create) - WYLACZONY:
//   - Nowa wersja sync_full jeszcze nieukonczona (wymaga refactoru na model wariantow).
//   - Na razie tylko Tor 1 wystarcza do bierzacej aktualizacji cen/stanow istniejacych produktow.
//   - Do wlaczenia po skonczeniu refactoru sync_full.cjs.
//
// Data: 2026-09-07 (v2 - po refactorze na model wariantow)

'use strict';

const { syncDelta } = require('./sync_delta.cjs');
// const { syncFull } = require('./sync_full.cjs'); // TODO: refactor
const { globalLimiter } = require('./rate_limiter.cjs');

const ACTIVE_SUPPLIERS = ['MO1', 'MO2', 'MO3', 'MO4', 'MO5', 'MO6', 'MO7', 'MO8', 'MO9', 'MO10'];

// Rotacja Toru 2 per dzien tygodnia (do wznowienia po refactorze sync_full)
const FULL_ROTATION = {
  1: ['MO1', 'MO2'],
  2: ['MO3', 'MO4'],
  3: ['MO5', 'MO6'],
  4: ['MO9'],
  5: ['MO10'],
  6: ['MO7'],
  0: ['MO8'],
};

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
 * Zainstaluj scheduler w procesie. Sprawdza co minute co jest do zrobienia.
 */
function installScheduler(db, opts = {}) {
  const CHECK_INTERVAL_MS = 60_000;
  let lastRunKey = null; // "YYYY-MM-DD HH:MM" - zeby nie duplikowac w tej samej minucie

  const tick = async () => {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const key = `${now.toISOString().substring(0, 10)} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;

    // Tor 1 event-driven (HH:55) + fallback (HH:10, HH:25, HH:40)
    if ([55, 10, 25, 40].includes(mm) && lastRunKey !== key) {
      lastRunKey = key;
      const tag = mm === 55 ? 'event-driven' : 'fallback';
      console.log(`[Selly Scheduler] Tor1 ${tag} ${hh}:${String(mm).padStart(2,'0')}`);
      runDeltaAll(db, opts).catch(e => console.error('[Selly Scheduler] Tor1 err:', e.message));
    }

    // Tor 2 - wylaczony do zakonczenia refactoru sync_full
  };

  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  console.log('[Selly Scheduler] Zainstalowany. Tor1: HH:55 + HH:10/25/40. Tor2: WYLACZONY (do refactoru sync_full).');
  return () => clearInterval(timer);
}

module.exports = {
  installScheduler,
  runDeltaAll,
  suppliersForFullToday,
  ACTIVE_SUPPLIERS,
  FULL_ROTATION,
};
