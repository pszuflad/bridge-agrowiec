#!/usr/bin/env node
// unify_katalog.cjs — ujednolicenie źródła słownika atrybutów do JEDNEGO katalogu.
// ------------------------------------------------------------------
// KONTEKST:
//   W bazie były dwa origin dla tego samego źródła (katalog produktów):
//     - 'catalog' (przez 'c') — jednorazowy wsad startowy z 2026-07-02,
//     - 'katalog' (przez 'k') — bieżąca synchronizacja seedAttrValuesFromProducts().
//   Decyzja: zostaje JEDEN katalog o etykiecie 'catalog'.
//
// CO ROBI:
//   Zamienia origin 'katalog' -> 'catalog' dla wszystkich wartości.
//   (Dokładnych kolizji (rodzaj,wartosc) brak — sprawdzone przed migracją.
//    Na wszelki wypadek obsługujemy je: przy kolizji usuwamy rekord 'katalog'.)
//
// BEZPIECZEŃSTWO:
//   - Domyślnie DRY-RUN. Zapis tylko z flagą --apply.
//   - Jedna transakcja.
// URUCHOMIENIE:
//   node unify_katalog.cjs            # podgląd
//   node unify_katalog.cjs --apply    # wdrożenie
// ------------------------------------------------------------------
const Database = require('better-sqlite3');
const APPLY = process.argv.includes('--apply');
const DB_PATH = process.env.BRIDGE_DB || '/home/admin/private_apps/bridge/data.db';
const TARGET = 'catalog';  // docelowa jedna etykieta

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('MODE:', APPLY ? 'APPLY' : 'DRY-RUN', '| DB:', DB_PATH);

const before = {};
for (const r of db.prepare(`SELECT origin, COUNT(*) c FROM atrybuty_wartosci GROUP BY origin`).all()) before[r.origin] = r.c;
console.log('PRZED:', JSON.stringify(before));

// rekordy 'katalog', które po zmianie kolidowałyby z istniejącym 'catalog' (rodzaj,wartosc)
const collisions = db.prepare(`
  SELECT k.id
  FROM atrybuty_wartosci k
  WHERE k.origin = 'katalog'
    AND EXISTS (SELECT 1 FROM atrybuty_wartosci c
                WHERE c.origin = ? AND c.rodzaj = k.rodzaj AND c.wartosc = k.wartosc)
`).all(TARGET).map(r => r.id);

const toUpdate = db.prepare(`SELECT COUNT(*) c FROM atrybuty_wartosci WHERE origin='katalog'`).get().c;
console.log('Do zmiany origin katalog -> ' + TARGET + ':', toUpdate);
console.log('Kolizje do usunięcia:', collisions.length);

if (!APPLY) {
  db.close();
  console.log('DRY-RUN — nic nie zapisano. Uruchom z --apply.');
  process.exit(0);
}

const tx = db.transaction(() => {
  if (collisions.length) {
    const del = db.prepare(`DELETE FROM atrybuty_wartosci WHERE id = ?`);
    for (const id of collisions) del.run(id);
  }
  db.prepare(`UPDATE atrybuty_wartosci SET origin = ? WHERE origin = 'katalog'`).run(TARGET);
});
tx();

const after = {};
for (const r of db.prepare(`SELECT origin, COUNT(*) c FROM atrybuty_wartosci GROUP BY origin`).all()) after[r.origin] = r.c;
console.log('PO:', JSON.stringify(after));
console.log('Pozostałe origin=katalog (powinno 0):', db.prepare(`SELECT COUNT(*) c FROM atrybuty_wartosci WHERE origin='katalog'`).get().c);
db.close();
console.log('Gotowe.');
