#!/usr/bin/env node
// cleanup_atrybuty.cjs — czyszczenie słownika atrybutów Bridge
// ------------------------------------------------------------------
// CO ROBI (tabela atrybuty_wartosci):
//   1) NAPRAWA nieprawidłowych zapisów: usuwa wiodące/końcowe '-', spacje
//      oraz nadmiarowe spacje wewnętrzne (np. "-537S" -> "537S",
//      "-A40  uniwersalna" -> "A40 uniwersalna").
//   2) SCALANIE duplikatów będących WYŁĄCZNIE błędami zapisu, w obrębie
//      tego samego rodzaju. Scalamy tylko gdy jedyna różnica to:
//        - liczba spacji ("D30  156" = "D30 156"),
//        - wiodące/końcowe '-'/spacje,
//        - wielkość liter ("320 Value Plus" = "320 VALUE PLUS").
//      NIE scalamy, gdy różni je '+', wewnętrzny myślnik, ani układ
//      litera/cyfra ("AC 65" != "AC65", "AC70" != "AC70+") — to mogą być
//      odrębne wzory bieżnika. Zostaje 1 rekord kanoniczny, reszta usuwana.
//
// BEZPIECZEŃSTWO:
//   - Domyślnie DRY-RUN (żadnych zapisów). Zapis tylko z flagą --apply.
//   - Zmiany w JEDNEJ transakcji (all-or-nothing).
//   - Kolizje UNIQUE(rodzaj, wartosc) obsłużone: jeśli po naprawie wartość
//     już istnieje, rekord-duplikat jest usuwany zamiast wymuszać wstawienie.
//   - Rekordy CORE-owe rodzajów są traktowane tak samo (czyścimy wartości,
//     nie rodzaje) — nie ruszamy tabeli atrybuty_rodzaje.
//   - Zapis do auditlog jak w pozostałych skryptach (jeśli tabela istnieje).
//
// WZORZEC KANONICZNY przy scalaniu (który rekord zostaje):
//   Preferujemy origin='catalog'/'katalog' (źródło KATALOG na UI) nad 'user',
//   następnie najkrótszy zapis, następnie najniższe id. Dzięki temu jako
//   "prawidłowy zapis" wygrywa wersja z katalogu, a nie ręczne warianty.
//
// URUCHOMIENIE:
//   node cleanup_atrybuty.cjs                 # podgląd (dry-run)
//   node cleanup_atrybuty.cjs --apply         # wdrożenie
//   node cleanup_atrybuty.cjs --rodzaj bieznik            # tylko jeden rodzaj (dry)
//   node cleanup_atrybuty.cjs --rodzaj bieznik --apply    # tylko jeden rodzaj (zapis)
// ------------------------------------------------------------------

const Database = require('better-sqlite3');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const rodzajIdx = process.argv.indexOf('--rodzaj');
const ONLY_RODZAJ = rodzajIdx !== -1 ? process.argv[rodzajIdx + 1] : null;

const BRIDGE_DIR = '/home/admin/private_apps/bridge';
const DB_PATH = process.env.BRIDGE_DB || path.join(BRIDGE_DIR, 'data.db');

// --- Normalizacja pojedynczej wartości (naprawa zapisu) ---
// Usuwa wiodące/końcowe myślniki i spacje, zwija wielokrotne spacje.
function fixValue(raw) {
  if (raw == null) return '';
  let v = String(raw);
  v = v.replace(/\s+/g, ' ');          // wielokrotne spacje -> jedna
  v = v.replace(/^[\s\-–—]+/, '');     // wiodące myślniki (-, –, —) i spacje
  v = v.replace(/[\s\-–—]+$/, '');     // końcowe myślniki i spacje
  return v.trim();
}

// --- Klucz kanonizacji do wykrywania duplikatów ---
// BEZPIECZNY: normalizuje TYLKO błędy zapisu.
//   - najpierw fixValue (wiodące/końcowe '-'/spacje, zwinięcie spacji),
//   - potem lower-case (różnica tylko w wielkości liter).
// Zachowuje '+', wewnętrzne myśniki i układ litera/cyfra (spacje wewnątrz
// są znaczące, bo różne wzory mogą zależeć od spacji — zwijamy tylko
// zdublowane spacje przez fixValue, nie usuwamy ich całkowicie).
function canonKey(v) {
  return fixValue(v).toLowerCase();
}

// Który wariant wygrywa w grupie duplikatów.
// Preferencje: 1) origin=catalog/katalog, 2) ładny zapis (nie CAPS,
// tzn. zawiera małe litery), 3) najniższe id.
function pickCanonical(rows) {
  const rank = (r) => {
    const o = String(r.origin || '').toLowerCase();
    if (o === 'catalog' || o === 'katalog') return 0;
    if (o === 'preset') return 1;
    return 2;
  };
  const isAllCaps = (s) => s === s.toUpperCase() && s !== s.toLowerCase();
  return [...rows].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    const ca = isAllCaps(a.fixed) ? 1 : 0, cb = isAllCaps(b.fixed) ? 1 : 0;
    if (ca !== cb) return ca - cb;              // wariant z małymi literami wygrywa
    return a.id - b.id;
  })[0];
}

function hasColumn(db, table, col) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
  } catch { return false; }
}

function tableExists(db, name) {
  return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name);
}

(function main() {
  console.log('MODE:', APPLY ? 'APPLY (zapis do bazy)' : 'DRY-RUN (bez zmian)');
  console.log('DB:', DB_PATH);
  if (ONLY_RODZAJ) console.log('Filtr rodzaju:', ONLY_RODZAJ);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  if (!tableExists(db, 'atrybuty_wartosci')) {
    console.error('BŁĄD: brak tabeli atrybuty_wartosci'); process.exit(1);
  }
  const hasOrigin = hasColumn(db, 'atrybuty_wartosci', 'origin');
  const hasAudit = tableExists(db, 'auditlog');

  const sql = ONLY_RODZAJ
    ? `SELECT id, rodzaj, wartosc${hasOrigin ? ', origin' : ''} FROM atrybuty_wartosci WHERE rodzaj = ? ORDER BY rodzaj, id`
    : `SELECT id, rodzaj, wartosc${hasOrigin ? ', origin' : ''} FROM atrybuty_wartosci ORDER BY rodzaj, id`;
  const rows = ONLY_RODZAJ ? db.prepare(sql).all(ONLY_RODZAJ) : db.prepare(sql).all();
  console.log('Wczytano wartości:', rows.length);

  // Przygotuj naprawioną wartość dla każdego rekordu
  for (const r of rows) { r.origin = r.origin || null; r.fixed = fixValue(r.wartosc); }

  // Grupowanie per (rodzaj + klucz kanoniczny)
  const groups = new Map();
  for (const r of rows) {
    const key = r.rodzaj + '|' + canonKey(r.fixed);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const renamePlan = [];  // pojedyncze naprawy zapisu (bez scalania)
  const mergePlan = [];   // grupy z duplikatami do scalenia
  const emptyPlan = [];   // wartości puste po naprawie -> do usunięcia

  for (const grp of groups.values()) {
    // usuń rekordy, które po naprawie stają się puste
    const nonEmpty = grp.filter(r => r.fixed !== '');
    for (const r of grp) if (r.fixed === '') emptyPlan.push(r);

    if (nonEmpty.length === 0) continue;

    if (nonEmpty.length === 1) {
      const r = nonEmpty[0];
      if (r.fixed !== r.wartosc) renamePlan.push({ id: r.id, rodzaj: r.rodzaj, stara: r.wartosc, nowa: r.fixed });
      continue;
    }
    // Duplikaty: wybierz kanoniczny, resztę usuń
    const keep = pickCanonical(nonEmpty);
    const remove = nonEmpty.filter(r => r.id !== keep.id);
    mergePlan.push({ rodzaj: keep.rodzaj, keep, remove });
  }

  console.log('\n=== PLAN ===');
  console.log('Napraw zapisu (bez scalania):', renamePlan.length);
  console.log('Grup do scalenia:', mergePlan.length,
    '| rekordów do usunięcia w scaleniu:', mergePlan.reduce((s, g) => s + g.remove.length, 0));
  console.log('Wartości puste po naprawie do usunięcia:', emptyPlan.length);

  const preview = (arr, n, fmt) => arr.slice(0, n).forEach(fmt);
  if (renamePlan.length) {
    console.log('\n--- Przykłady napraw zapisu (max 15) ---');
    preview(renamePlan, 15, p => console.log(`  [${p.rodzaj}] "${p.stara}" -> "${p.nowa}"`));
  }
  if (mergePlan.length) {
    console.log('\n--- Przykłady scaleń (max 15) ---');
    preview(mergePlan, 15, g => {
      console.log(`  [${g.rodzaj}] ZOSTAJE "${g.keep.fixed}" (id=${g.keep.id}, origin=${g.keep.origin || '?'})`);
      g.remove.forEach(r => console.log(`        usuń id=${r.id}: "${r.wartosc}" (origin=${r.origin || '?'})`));
    });
  }
  if (emptyPlan.length) {
    console.log('\n--- Puste po naprawie (max 15) ---');
    preview(emptyPlan, 15, r => console.log(`  [${r.rodzaj}] usuń id=${r.id}: "${r.wartosc}"`));
  }

  if (!APPLY) {
    db.close();
    console.log('\nDRY-RUN — nic nie zapisano. Uruchom z flagą --apply, aby wdrożyć.');
    return;
  }

  // === ZAPIS w jednej transakcji ===
  const updWartosc = db.prepare(`UPDATE atrybuty_wartosci SET wartosc = ? WHERE id = ?`);
  const delWartosc = db.prepare(`DELETE FROM atrybuty_wartosci WHERE id = ?`);
  const existsWartosc = db.prepare(`SELECT id FROM atrybuty_wartosci WHERE rodzaj = ? AND wartosc = ? AND id != ?`);
  const insAudit = hasAudit
    ? db.prepare(`INSERT INTO auditlog (userId, userName, akcja, typObiektu, idObiektu, szczegoly, kiedy)
                  VALUES (0, 'cleanup_atrybuty', ?, 'atrybut_wartosc', ?, ?, datetime('now'))`)
    : null;
  const audit = (akcja, id, det) => { if (insAudit) { try { insAudit.run(akcja, String(id), JSON.stringify(det)); } catch (_) {} } };

  let renamed = 0, merged = 0, removedEmpty = 0, collisionsResolved = 0;

  const tx = db.transaction(() => {
    // 1) puste -> usuń
    for (const r of emptyPlan) { delWartosc.run(r.id); removedEmpty++; audit('atrybut_wartosc_usunieto_puste', r.id, { stara: r.wartosc, rodzaj: r.rodzaj }); }

    // 2) scalenia: usuń duplikaty, upewnij się że keep ma poprawny zapis
    for (const g of mergePlan) {
      // najpierw usuń duplikaty (zwalnia potencjalne kolizje UNIQUE)
      for (const r of g.remove) { delWartosc.run(r.id); merged++; audit('atrybut_wartosc_scalono', r.id, { rodzaj: g.rodzaj, stara: r.wartosc, kanoniczna: g.keep.fixed }); }
      // popraw zapis rekordu kanonicznego jeśli trzeba
      if (g.keep.fixed !== g.keep.wartosc) {
        const clash = existsWartosc.get(g.rodzaj, g.keep.fixed, g.keep.id);
        if (clash) { delWartosc.run(g.keep.id); collisionsResolved++; audit('atrybut_wartosc_kolizja_usunieto', g.keep.id, { rodzaj: g.rodzaj }); }
        else { updWartosc.run(g.keep.fixed, g.keep.id); renamed++; audit('atrybut_wartosc_naprawiono', g.keep.id, { stara: g.keep.wartosc, nowa: g.keep.fixed }); }
      }
    }

    // 3) pojedyncze naprawy zapisu (obsługa kolizji UNIQUE)
    for (const p of renamePlan) {
      const clash = existsWartosc.get(p.rodzaj, p.nowa, p.id);
      if (clash) { delWartosc.run(p.id); collisionsResolved++; audit('atrybut_wartosc_kolizja_usunieto', p.id, { rodzaj: p.rodzaj, stara: p.stara, kolidujeZ: clash.id }); }
      else { updWartosc.run(p.nowa, p.id); renamed++; audit('atrybut_wartosc_naprawiono', p.id, { stara: p.stara, nowa: p.nowa }); }
    }
  });
  tx();

  console.log('\n=== WYNIK ===');
  console.log('Naprawiono zapisów:', renamed);
  console.log('Usunięto duplikatów (scalenie):', merged);
  console.log('Usunięto pustych:', removedEmpty);
  console.log('Kolizje UNIQUE rozwiązane usunięciem:', collisionsResolved);

  // === WERYFIKACJA ===
  const total = db.prepare(`SELECT COUNT(*) c FROM atrybuty_wartosci${ONLY_RODZAJ ? ' WHERE rodzaj = ?' : ''}`);
  const totalC = (ONLY_RODZAJ ? total.get(ONLY_RODZAJ) : total.get()).c;
  const leadDash = db.prepare(`SELECT COUNT(*) c FROM atrybuty_wartosci WHERE wartosc LIKE '-%' OR wartosc LIKE ' %'${ONLY_RODZAJ ? ' AND rodzaj = ?' : ''}`);
  const leadC = (ONLY_RODZAJ ? leadDash.get(ONLY_RODZAJ) : leadDash.get()).c;
  console.log('\nWERYFIKACJA — wartości razem:', totalC, '| pozostałe z wiodącym "-"/spacją:', leadC);

  db.close();
  console.log('\nGotowe. Zmiany zapisane w', DB_PATH);
})();
