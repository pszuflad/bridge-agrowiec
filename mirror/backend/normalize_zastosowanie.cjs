// normalize_zastosowanie.cjs
// Ujednolica products.zastosowanie do zamkniętej listy Selly (4 kategorie główne x ich zastosowania),
// zgodnie z drzewem kategorii Selly (patrz selly_category_ids.md / migration_002_zastosowanie.sql w Space).
//
// Wielokrotne zastosowania są łączone znakiem " ; " (NIE " + ").
//
// Uruchomienie: node normalize_zastosowanie.cjs [--dry-run]

const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data.db');
const dryRun = process.argv.includes('--dry-run');

const db = new Database(dbPath);

// --- 1) Normalizacja kategorii głównej produktu -> jedna z 4: rolnicze/przemyslowe/ciezarowe/lesne ---
function stripDiacritics(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normKategoriaGlowna(raw) {
  const s = stripDiacritics(raw).toLowerCase().trim();
  if (s.startsWith('rolnicze')) return 'rolnicze';
  if (s.startsWith('przemys')) return 'przemyslowe';
  if (s.startsWith('cie')) return 'ciezarowe'; // ciezarowe / ciężarowe
  if (s.startsWith('les')) return 'lesne'; // lesne / leśne
  return null;
}

// --- 2) Docelowa zamknięta lista Selly, per kategoria główna (podana przez użytkownika) ---
const SELLY_LISTA = {
  rolnicze: ['Ciągnik', 'Kombajn', 'Opryskiwacz', 'Przyczepa', 'Ładowarka', 'Kosiarka/ogród', 'Wózek widłowy', 'Uniwersalne/Pozostałe'],
  przemyslowe: ['Ładowarka', 'Koparka', 'Kompaktor', 'Suwnica/dźwig', 'Maszyny górnicze', 'Wózek widłowy', 'Uniwersalne/Pozostałe'],
  ciezarowe: ['All-position', 'Oś kierowana', 'Oś napędowa', 'Naczepa/przyczepa', 'Uniwersalne/Pozostałe'],
  lesne: ['Ciągnik leśny', 'Harwester', 'Forwarder', 'Skider', 'Uniwersalne/Pozostałe'],
};

// --- 3) Mapa: surowa wartość (z bazy, zebrana z Excela) -> docelowa nazwa Selly ---
//     Osobna mapa per kategoria główna, bo ta sama surowa nazwa może mapować się różnie
//     w zależności od kontekstu (np. "Uniwersalne" -> "Uniwersalne/Pozostałe" wszędzie,
//     ale "Ładowarka rolnicza" istnieje tylko w kontekście rolniczym).
const MAP = {
  rolnicze: {
    'ciągnik': 'Ciągnik',
    'kombajn': 'Kombajn',
    'opryskiwacz': 'Opryskiwacz',
    'przyczepa': 'Przyczepa',
    'przyczepa / flotacja': 'Przyczepa',
    'przyczepa leśna': 'Przyczepa',
    'ładowarka': 'Ładowarka',
    'ładowarka rolnicza': 'Ładowarka',
    'ładowarka kołowa': 'Ładowarka',
    'kosiarka': 'Kosiarka/ogród',
    'wózek widłowy': 'Wózek widłowy',
    'rolnicze (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne': 'Uniwersalne/Pozostałe',
    'implement rolniczy': 'Uniwersalne/Pozostałe',
    'przemysłowe (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne przemysłowe': 'Uniwersalne/Pozostałe',
    'leśne (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne leśne': 'Uniwersalne/Pozostałe',
    'maszyny górnicze/kamieniołomy': 'Uniwersalne/Pozostałe',
    'maszyny górnicze/kamieniołomy (otr)': 'Uniwersalne/Pozostałe',
    'koparka': 'Uniwersalne/Pozostałe',
    'kompaktor/walec': 'Uniwersalne/Pozostałe',
    'suwnice/dźwig': 'Uniwersalne/Pozostałe',
    'harwester': 'Uniwersalne/Pozostałe',
    'forwarder': 'Uniwersalne/Pozostałe',
    'skidder': 'Uniwersalne/Pozostałe',
    'ciągnik leśny': 'Uniwersalne/Pozostałe',
    'oś kierowana': 'Uniwersalne/Pozostałe',
    'oś napędowa': 'Uniwersalne/Pozostałe',
    'naczepa': 'Uniwersalne/Pozostałe',
    'ciężarowe (ogólne)': 'Uniwersalne/Pozostałe',
  },
  przemyslowe: {
    'ładowarka': 'Ładowarka',
    'ładowarka kołowa': 'Ładowarka',
    'ładowarka rolnicza': 'Ładowarka',
    'koparka': 'Koparka',
    'kompaktor/walec': 'Kompaktor',
    'suwnice/dźwig': 'Suwnica/dźwig',
    'maszyny górnicze/kamieniołomy': 'Maszyny górnicze',
    'maszyny górnicze/kamieniołomy (otr)': 'Maszyny górnicze',
    'wózek widłowy': 'Wózek widłowy',
    'przemysłowe (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne przemysłowe': 'Uniwersalne/Pozostałe',
    'uniwersalne': 'Uniwersalne/Pozostałe',
    'rolnicze (ogólne)': 'Uniwersalne/Pozostałe',
    'ciągnik': 'Uniwersalne/Pozostałe',
    'kombajn': 'Uniwersalne/Pozostałe',
    'opryskiwacz': 'Uniwersalne/Pozostałe',
    'przyczepa': 'Uniwersalne/Pozostałe',
    'przyczepa / flotacja': 'Uniwersalne/Pozostałe',
    'kosiarka': 'Uniwersalne/Pozostałe',
    'implement rolniczy': 'Uniwersalne/Pozostałe',
    'oś kierowana': 'Uniwersalne/Pozostałe',
    'oś napędowa': 'Uniwersalne/Pozostałe',
    'naczepa': 'Uniwersalne/Pozostałe',
    'ciężarowe (ogólne)': 'Uniwersalne/Pozostałe',
    'leśne (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne leśne': 'Uniwersalne/Pozostałe',
    'harwester': 'Uniwersalne/Pozostałe',
    'forwarder': 'Uniwersalne/Pozostałe',
    'skidder': 'Uniwersalne/Pozostałe',
    'ciągnik leśny': 'Uniwersalne/Pozostałe',
    'przyczepa leśna': 'Uniwersalne/Pozostałe',
  },
  ciezarowe: {
    'oś kierowana': 'Oś kierowana',
    'oś napędowa': 'Oś napędowa',
    'naczepa': 'Naczepa/przyczepa',
    'przyczepa': 'Naczepa/przyczepa',
    'przyczepa / flotacja': 'Naczepa/przyczepa',
    'ciężarowe (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne': 'Uniwersalne/Pozostałe',
    'maszyny górnicze/kamieniołomy': 'Uniwersalne/Pozostałe',
    'maszyny górnicze/kamieniołomy (otr)': 'Uniwersalne/Pozostałe',
    'wózek widłowy': 'Uniwersalne/Pozostałe',
    'ładowarka': 'Uniwersalne/Pozostałe',
    'ładowarka kołowa': 'Uniwersalne/Pozostałe',
    'ładowarka rolnicza': 'Uniwersalne/Pozostałe',
    'koparka': 'Uniwersalne/Pozostałe',
    'kompaktor/walec': 'Uniwersalne/Pozostałe',
    'suwnice/dźwig': 'Uniwersalne/Pozostałe',
    'rolnicze (ogólne)': 'Uniwersalne/Pozostałe',
    'przemysłowe (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne przemysłowe': 'Uniwersalne/Pozostałe',
    'leśne (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne leśne': 'Uniwersalne/Pozostałe',
    'ciągnik': 'Uniwersalne/Pozostałe',
    'kombajn': 'Uniwersalne/Pozostałe',
    'opryskiwacz': 'Uniwersalne/Pozostałe',
    'kosiarka': 'Uniwersalne/Pozostałe',
    'implement rolniczy': 'Uniwersalne/Pozostałe',
    'harwester': 'Uniwersalne/Pozostałe',
    'forwarder': 'Uniwersalne/Pozostałe',
    'skidder': 'Uniwersalne/Pozostałe',
    'ciągnik leśny': 'Uniwersalne/Pozostałe',
    'przyczepa leśna': 'Uniwersalne/Pozostałe',
  },
  lesne: {
    'ciągnik leśny': 'Ciągnik leśny',
    'harwester': 'Harwester',
    'forwarder': 'Forwarder',
    'skidder': 'Skider',
    'przyczepa leśna': 'Uniwersalne/Pozostałe',
    'leśne (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne leśne': 'Uniwersalne/Pozostałe',
    'uniwersalne': 'Uniwersalne/Pozostałe',
    'rolnicze (ogólne)': 'Uniwersalne/Pozostałe',
    'ciągnik': 'Uniwersalne/Pozostałe',
    'kombajn': 'Uniwersalne/Pozostałe',
    'opryskiwacz': 'Uniwersalne/Pozostałe',
    'przyczepa': 'Uniwersalne/Pozostałe',
    'przyczepa / flotacja': 'Uniwersalne/Pozostałe',
    'ładowarka': 'Uniwersalne/Pozostałe',
    'ładowarka rolnicza': 'Uniwersalne/Pozostałe',
    'ładowarka kołowa': 'Uniwersalne/Pozostałe',
    'kosiarka': 'Uniwersalne/Pozostałe',
    'implement rolniczy': 'Uniwersalne/Pozostałe',
    'wózek widłowy': 'Uniwersalne/Pozostałe',
    'przemysłowe (ogólne)': 'Uniwersalne/Pozostałe',
    'uniwersalne przemysłowe': 'Uniwersalne/Pozostałe',
    'maszyny górnicze/kamieniołomy': 'Uniwersalne/Pozostałe',
    'maszyny górnicze/kamieniołomy (otr)': 'Uniwersalne/Pozostałe',
    'koparka': 'Uniwersalne/Pozostałe',
    'kompaktor/walec': 'Uniwersalne/Pozostałe',
    'suwnice/dźwig': 'Uniwersalne/Pozostałe',
    'oś kierowana': 'Uniwersalne/Pozostałe',
    'oś napędowa': 'Uniwersalne/Pozostałe',
    'naczepa': 'Uniwersalne/Pozostałe',
    'ciężarowe (ogólne)': 'Uniwersalne/Pozostałe',
  },
};

function normKey(s) {
  return String(s || '').toLowerCase().trim();
}

// --- 4) Wczytaj produkty z niepustym zastosowanie ---
const products = db.prepare("SELECT id, kod, kategoria, zastosowanie FROM products WHERE zastosowanie IS NOT NULL AND zastosowanie <> ''").all();

let updated = 0;
let unchanged = 0;
let unmapped = [];
const preview = [];

const updateStmt = db.prepare('UPDATE products SET zastosowanie = ? WHERE id = ?');

const runAll = db.transaction(() => {
  for (const p of products) {
    const katGlowna = normKategoriaGlowna(p.kategoria);
    if (!katGlowna) {
      unmapped.push({ kod: p.kod, kategoria: p.kategoria, zastosowanie: p.zastosowanie, reason: 'kategoria_glowna_nieznana' });
      continue;
    }
    const map = MAP[katGlowna];
    const listaDozwolona = SELLY_LISTA[katGlowna];

    // rozbij po starym separatorze " + " (stary format zapisany w bazie)
    const raw = String(p.zastosowanie).split('+').map(s => s.trim()).filter(Boolean);
    const mappedSet = new Set();
    let anyUnmapped = false;
    for (const r of raw) {
      const key = normKey(r);
      const mapped = map[key];
      if (mapped) {
        mappedSet.add(mapped);
      } else {
        anyUnmapped = true;
      }
    }
    if (mappedSet.size === 0) {
      unmapped.push({ kod: p.kod, kategoria: p.kategoria, zastosowanie: p.zastosowanie, reason: 'brak_mapowania' });
      continue;
    }
    // Sortuj wynik według kolejności w liście Selly, dla stabilnej/czytelnej prezentacji
    const ordered = listaDozwolona.filter(v => mappedSet.has(v));
    const newValue = ordered.join(' ; ');

    if (newValue !== p.zastosowanie) {
      if (preview.length < 25) preview.push({ kod: p.kod, kategoria: p.kategoria, stare: p.zastosowanie, nowe: newValue });
      if (!dryRun) updateStmt.run(newValue, p.id);
      updated++;
    } else {
      unchanged++;
    }
  }
});

runAll();

console.log(`=== ${dryRun ? 'DRY RUN (brak zapisu)' : 'ZAPISANO'} ===`);
console.log(`Produktów z zastosowaniem przetworzonych: ${products.length}`);
console.log(`Zmienionych: ${updated}`);
console.log(`Bez zmiany (już poprawne): ${unchanged}`);
console.log(`Niezmapowanych (do ręcznego sprawdzenia): ${unmapped.length}`);

console.log('\n=== PRZYKŁAD 25 ZMIAN ===');
preview.forEach(x => console.log(`${x.kod} [${x.kategoria}]: "${x.stare}" -> "${x.nowe}"`));

if (unmapped.length > 0) {
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'zastosowanie_niezmapowane.json'), JSON.stringify(unmapped, null, 2), 'utf-8');
  console.log(`\nLista niezmapowanych zapisana do zastosowanie_niezmapowane.json (${unmapped.length} wpisów)`);
}

db.close();
