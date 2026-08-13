#!/usr/bin/env node
// scripts/bootstrap_selly.cjs
// Jednorazowy skrypt konfiguracyjny do wywołania po wgraniu integracji Selly.
// Wykonuje:
//   1. Migrację SQL (tabele selly_products, selly_dict, selly_sync_log)
//   2. Doda producentów/marek które są w tabeli products a nie ma ich w Selly
//   3. Doda kategorię "Opony ciężarowe" (jeśli nie istnieje)
//   4. Odświeży cache słowników w tabeli selly_dict
//
// Uruchomienie (na VPS w katalogu /home/admin/private_apps/bridge/):
//   node scripts/bootstrap_selly.cjs
//
// Wymaga .env z:
//   SELLY_SHOP_URL, SELLY_CLIENT_ID, SELLY_CLIENT_SECRET, SELLY_SCOPE

'use strict';

const path = require('path');
const fs   = require('fs');
const Database = require('better-sqlite3');

// Wczytaj .env jeśli istnieje
const envFile = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const client = require('../selly/client.cjs');

const DB_PATH = process.env.BRIDGE_DB_PATH || 'data.db';
const MIGRATION = path.resolve(__dirname, '..', 'migrations', '001_selly.sql');

(async () => {
  console.log(`[Selly bootstrap] DB: ${DB_PATH}`);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // -------- 1) Migracja SQL --------
  console.log('\n[1/4] Uruchamiam migrację SQL...');
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  db.exec(sql);
  console.log('  OK. Tabele selly_products, selly_dict, selly_sync_log gotowe.');

  // -------- 2) Ping Selly --------
  console.log('\n[2/4] Test połączenia z Selly...');
  const ping = await client.ping();
  console.log(`  OK. Sklep: ${ping.shop}, token wygasa za ${ping.expires_in_seconds}s.`);

  // -------- 3) Producenci --------
  console.log('\n[3/4] Uzupełnianie producentów w Selly...');
  const marks = db.prepare(`
    SELECT DISTINCT marka FROM products WHERE marka IS NOT NULL AND marka != '' ORDER BY marka
  `).all().map(r => r.marka);
  console.log(`  Unikalnych marek w Bridge: ${marks.length}`);

  const existingProd = (await client.listProducers({ limit: 50 })).data || [];
  const known = new Set(existingProd.map(p => (p.name || '').trim().toLowerCase()));

  let created = 0, skipped = 0, failed = 0;
  for (const marka of marks) {
    if (known.has(marka.toLowerCase())) { skipped++; continue; }
    try {
      await client.createProducer({ name: marka });
      created++;
      process.stdout.write(`+`);
    } catch (e) {
      failed++;
      console.log(`\n  FAIL ${marka}: ${e.message.slice(0, 120)}`);
    }
  }
  console.log(`\n  Utworzono: ${created} | Pominięto (już istniały): ${skipped} | Błędy: ${failed}`);

  // -------- 4) Kategorie --------
  console.log('\n[4/4] Uzupełnianie kategorii w Selly...');
  const cats = db.prepare(`
    SELECT DISTINCT kategoria FROM products WHERE kategoria IS NOT NULL AND kategoria != ''
  `).all().map(r => r.kategoria);
  console.log(`  Unikalnych kategorii w Bridge: ${cats.map(c => `"${c}"`).join(', ')}`);

  const existingCats = (await client.listCategories({ limit: 50 })).data || [];
  const catKnown = new Set(existingCats.map(c => (c.name || '').trim().toLowerCase()));

  const mapPl = {
    'rolnicze':    'Opony rolnicze',
    'leśne':       'Opony Leśne',
    'przemysłowe': 'Opony przemysłowe',
    'ciężarowe':   'Opony ciężarowe',
  };

  for (const [key, sellyName] of Object.entries(mapPl)) {
    if (!cats.some(c => (c || '').trim().toLowerCase() === key)) continue;
    if (catKnown.has(sellyName.toLowerCase()) || catKnown.has(sellyName.replace(/ /g, '  ').toLowerCase())) {
      console.log(`  [SKIP]   ${sellyName}`);
      continue;
    }
    try {
      await client.createCategory({ name: sellyName, parent_id: 0, visible: 'sklep' });
      console.log(`  [CREATE] ${sellyName}`);
    } catch (e) {
      console.log(`  [FAIL]   ${sellyName}: ${e.message.slice(0, 200)}`);
    }
  }

  // -------- 5) Odśwież cache słowników --------
  console.log('\n[5/5] Odświeżam cache słowników w tabeli selly_dict...');
  const registerRoutes = require('../selly/routes.cjs');
  // Wyciągamy tylko helper refreshDict przez chwilową rejestrację no-op app
  // (prostsza droga: przepiszmy logikę tutaj)

  const upsert = db.prepare(`
    INSERT INTO selly_dict (slownik, klucz, wartosc_id, raw_json, odswiezono)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(slownik, klucz) DO UPDATE SET
      wartosc_id = excluded.wartosc_id, raw_json = excluded.raw_json, odswiezono = excluded.odswiezono
  `);
  const clear = db.prepare('DELETE FROM selly_dict WHERE slownik = ?');

  const prod2 = (await client.listProducers({ limit: 50 })).data || [];
  clear.run('producers');
  for (const p of prod2) upsert.run('producers', (p.name || '').trim().toLowerCase(), p.producer_id, JSON.stringify(p));

  const cat2 = (await client.listCategories({ limit: 50 })).data || [];
  clear.run('categories');
  for (const c of cat2) upsert.run('categories', (c.name || '').trim().toLowerCase(), c.category_id, JSON.stringify(c));

  const vat = (await client.listVatRates()).data || [];
  clear.run('vat_rates');
  for (const v of vat) upsert.run('vat_rates', String(v.rate), v.vat_id || 0, JSON.stringify(v));

  const wh = (await client.listWarehouses()).data || [];
  clear.run('warehouses');
  for (const w of wh) upsert.run('warehouses', (w.name || '').trim().toLowerCase(), w.warehouse_id, JSON.stringify(w));

  console.log(`  Producenci: ${prod2.length} | Kategorie: ${cat2.length} | VAT: ${vat.length} | Magazyny: ${wh.length}`);

  console.log('\n[Selly bootstrap] Gotowe. Możesz teraz uruchomić sync:');
  console.log('  curl -X POST http://localhost:5000/api/selly/sync-supplier \\');
  console.log('       -H "Authorization: Bearer TWOJ_TOKEN_BRIDGE" \\');
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"dostawca":"MO1","dry_run":true,"limit":3}\'');

  db.close();
})().catch(e => {
  console.error('\n[Selly bootstrap] BŁĄD:', e.message);
  process.exit(1);
});
