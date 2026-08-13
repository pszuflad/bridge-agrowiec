// atrybuty_module.cjs — moduł Atrybutów do wstrzyknięcia w extensions.cjs
// Eksportuje funkcję registerAtrybuty(app, ctx) wywoływaną z register()
//
// Tabele:
//   atrybuty_rodzaje    - typy atrybutów (Marka, Kategoria, własne)
//   atrybuty_wartosci   - wartości w obrębie typu (Alliance, BKT, ...)
//
// Endpointy:
//   GET    /api/atrybuty                  - cała struktura {rodzaje:[...], wartosci:[...]}
//   GET    /api/atrybuty/rodzaje          - lista rodzajów
//   POST   /api/atrybuty/rodzaje          - nowy rodzaj {value, label, opis?}
//   PUT    /api/atrybuty/rodzaje/:value   - edycja
//   DELETE /api/atrybuty/rodzaje/:value   - usunięcie (tylko non-core)
//   GET    /api/atrybuty/wartosci?rodzaj=marka - wartości danego rodzaju
//   POST   /api/atrybuty/wartosci         - nowa wartość {rodzaj, wartosc}
//   PUT    /api/atrybuty/wartosci/:id     - edycja
//   DELETE /api/atrybuty/wartosci/:id     - usunięcie

const CORE_RODZAJE = [
  { value: 'marka',       label: 'Marka',           opis: 'Producent opon (Alliance, Michelin, BKT...)' },
  { value: 'kategoria',   label: 'Kategoria',       opis: 'Rolnicze, Leśne, Przemysłowe, Ciężarowe, Dętki, Akcesoria' },
  { value: 'konstrukcja', label: 'Konstrukcja',     opis: 'R (radialna), D (diagonalna), B (bias-belted)' },
  { value: 'vfIf',        label: 'VF / IF / CFO',   opis: 'Specjalne technologie nośności' },
  { value: 'bieznik',     label: 'Bieżnik',         opis: 'Wzór bieżnika opony' },
  { value: 'rodzaj',      label: 'Rodzaj produktu', opis: 'Opona / dętka / koło itp.' }
];

// Domyślne wartości seedowane do bazy przy pierwszym uruchomieniu
const CORE_WARTOSCI = {
  kategoria: ['Rolnicze', 'Leśne', 'Przemysłowe', 'Ciężarowe', 'Dętki', 'Akcesoria'],
  konstrukcja: ['R', 'D', 'B'],
  vfIf: ['VF', 'IF', 'CFO', 'CHO', 'NRO'],
  // marka, bieznik, rodzaj - puste, użytkownik dodaje
};

function ensureSchema(db) {
  // Tabela rodzajów
  db.exec(`
    CREATE TABLE IF NOT EXISTS atrybuty_rodzaje (
      value TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      opis TEXT,
      core INTEGER NOT NULL DEFAULT 0,
      utworzony TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Tabela wartości
  db.exec(`
    CREATE TABLE IF NOT EXISTS atrybuty_wartosci (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rodzaj TEXT NOT NULL,
      wartosc TEXT NOT NULL,
      utworzony TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(rodzaj, wartosc),
      FOREIGN KEY (rodzaj) REFERENCES atrybuty_rodzaje(value) ON DELETE CASCADE
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_atrybuty_wartosci_rodzaj ON atrybuty_wartosci(rodzaj);`);
}

function seed(db) {
  const insRodzaj = db.prepare(`
    INSERT OR IGNORE INTO atrybuty_rodzaje (value, label, opis, core) VALUES (?, ?, ?, 1)
  `);
  for (const r of CORE_RODZAJE) {
    insRodzaj.run(r.value, r.label, r.opis);
  }
  const insWartosc = db.prepare(`
    INSERT OR IGNORE INTO atrybuty_wartosci (rodzaj, wartosc) VALUES (?, ?)
  `);
  for (const [rodzaj, wartosci] of Object.entries(CORE_WARTOSCI)) {
    for (const w of wartosci) insWartosc.run(rodzaj, w);
  }
  // Marka - seedujemy z products.marka (DISTINCT)
  try {
    const marki = db.prepare(`SELECT DISTINCT marka FROM products WHERE marka IS NOT NULL AND marka != '' ORDER BY marka`).all();
    for (const m of marki) insWartosc.run('marka', m.marka);
  } catch (_) { /* products może nie istnieć w testach */ }
  // Bieżnik - z products.model
  try {
    const biezniki = db.prepare(`SELECT DISTINCT model FROM products WHERE model IS NOT NULL AND model != '' ORDER BY model`).all();
    for (const b of biezniki) insWartosc.run('bieznik', b.model);
  } catch (_) {}
}

function registerAtrybuty(app, ctx, dbPath) {
  const { we, be } = ctx;
  let db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath || '/home/admin/private_apps/bridge/data.db');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  } catch (e) {
    console.error('[atrybuty] BŁĄD: nie udało się otworzyć better-sqlite3:', e.message);
    return;
  }
  ensureSchema(db);
  seed(db);
  console.log('[atrybuty] Schema OK, seed OK, db:', dbPath || '/home/admin/private_apps/bridge/data.db');

  // === GET /api/atrybuty - cała struktura ===
  app.get('/api/atrybuty', we, (req, res) => {
    try {
      const rodzaje = db.prepare(`SELECT value, label, opis, core, utworzony FROM atrybuty_rodzaje ORDER BY core DESC, label`).all();
      const wartosci = db.prepare(`SELECT id, rodzaj, wartosc FROM atrybuty_wartosci ORDER BY rodzaj, wartosc`).all();
      res.json({ ok: true, rodzaje, wartosci });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // === GET /api/atrybuty/rodzaje ===
  app.get('/api/atrybuty/rodzaje', we, (req, res) => {
    try {
      const rows = db.prepare(`SELECT value, label, opis, core FROM atrybuty_rodzaje ORDER BY core DESC, label`).all();
      res.json({ ok: true, rodzaje: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // === POST /api/atrybuty/rodzaje ===
  // Body: {value, label, opis?}  - tworzy nowy rodzaj non-core
  app.post('/api/atrybuty/rodzaje', we, (req, res) => {
    let { value, label, opis } = req.body || {};
    label = (label || '').trim();
    if (!label) return res.status(400).json({ ok: false, error: 'Brak label' });

    // value generujemy z label jeśli nie podano (slug)
    if (!value) {
      value = label.toLowerCase()
        .replace(/[ąàáâ]/g,'a').replace(/[ćč]/g,'c').replace(/[ęè]/g,'e')
        .replace(/[ł]/g,'l').replace(/[ń]/g,'n').replace(/[óòöô]/g,'o')
        .replace(/[śš]/g,'s').replace(/[żź]/g,'z')
        .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0, 32);
    }
    if (!value) return res.status(400).json({ ok: false, error: 'Nie udało się wygenerować value z label' });

    try {
      db.prepare(`INSERT INTO atrybuty_rodzaje (value, label, opis, core) VALUES (?, ?, ?, 0)`).run(value, label, opis || null);
      try { be(req.user.id, req.user.imieNazwisko, 'atrybut_rodzaj_dodano', 'atrybut_rodzaj', value, { label, opis }); } catch (_) {}
      res.json({ ok: true, rodzaj: { value, label, opis: opis || null, core: 0 } });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ ok: false, error: `Rodzaj '${value}' już istnieje` });
      }
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // === PUT /api/atrybuty/rodzaje/:value ===
  app.put('/api/atrybuty/rodzaje/:value', we, (req, res) => {
    const { value } = req.params;
    const { label, opis } = req.body || {};
    try {
      const row = db.prepare(`SELECT core FROM atrybuty_rodzaje WHERE value = ?`).get(value);
      if (!row) return res.status(404).json({ ok: false, error: 'Nie znaleziono' });
      db.prepare(`UPDATE atrybuty_rodzaje SET label = COALESCE(?, label), opis = COALESCE(?, opis) WHERE value = ?`)
        .run(label || null, opis || null, value);
      try { be(req.user.id, req.user.imieNazwisko, 'atrybut_rodzaj_zmieniono', 'atrybut_rodzaj', value, { label, opis }); } catch (_) {}
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // === DELETE /api/atrybuty/rodzaje/:value ===
  app.delete('/api/atrybuty/rodzaje/:value', we, (req, res) => {
    const { value } = req.params;
    try {
      const row = db.prepare(`SELECT core FROM atrybuty_rodzaje WHERE value = ?`).get(value);
      if (!row) return res.status(404).json({ ok: false, error: 'Nie znaleziono' });
      if (row.core) return res.status(403).json({ ok: false, error: 'Nie można usunąć wbudowanego rodzaju' });
      db.prepare(`DELETE FROM atrybuty_rodzaje WHERE value = ?`).run(value);
      // ON DELETE CASCADE usunie wartości
      try { be(req.user.id, req.user.imieNazwisko, 'atrybut_rodzaj_usunieto', 'atrybut_rodzaj', value, {}); } catch (_) {}
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // === GET /api/atrybuty/wartosci?rodzaj=marka ===
  app.get('/api/atrybuty/wartosci', we, (req, res) => {
    const rodzaj = req.query.rodzaj;
    try {
      const sql = rodzaj
        ? `SELECT id, rodzaj, wartosc FROM atrybuty_wartosci WHERE rodzaj = ? ORDER BY wartosc`
        : `SELECT id, rodzaj, wartosc FROM atrybuty_wartosci ORDER BY rodzaj, wartosc`;
      const rows = rodzaj ? db.prepare(sql).all(rodzaj) : db.prepare(sql).all();
      res.json({ ok: true, wartosci: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // === POST /api/atrybuty/wartosci ===
  app.post('/api/atrybuty/wartosci', we, (req, res) => {
    const { rodzaj, wartosc } = req.body || {};
    if (!rodzaj || !wartosc) return res.status(400).json({ ok: false, error: 'Brak rodzaj lub wartosc' });
    try {
      const r = db.prepare(`SELECT 1 FROM atrybuty_rodzaje WHERE value = ?`).get(rodzaj);
      if (!r) return res.status(400).json({ ok: false, error: `Rodzaj '${rodzaj}' nie istnieje` });
      const wartoscTrim = String(wartosc).trim();
      if (!wartoscTrim) return res.status(400).json({ ok: false, error: 'Pusta wartość' });
      const info = db.prepare(`INSERT INTO atrybuty_wartosci (rodzaj, wartosc) VALUES (?, ?)`).run(rodzaj, wartoscTrim);
      try { be(req.user.id, req.user.imieNazwisko, 'atrybut_wartosc_dodano', 'atrybut_wartosc', String(info.lastInsertRowid), { rodzaj, wartosc: wartoscTrim }); } catch (_) {}
      res.json({ ok: true, wartosc: { id: info.lastInsertRowid, rodzaj, wartosc: wartoscTrim } });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ ok: false, error: 'Taka wartość już istnieje dla tego rodzaju' });
      }
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // === PUT /api/atrybuty/wartosci/:id ===
  app.put('/api/atrybuty/wartosci/:id', we, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { wartosc } = req.body || {};
    if (!wartosc) return res.status(400).json({ ok: false, error: 'Brak wartosc' });
    try {
      const info = db.prepare(`UPDATE atrybuty_wartosci SET wartosc = ? WHERE id = ?`).run(String(wartosc).trim(), id);
      if (info.changes === 0) return res.status(404).json({ ok: false, error: 'Nie znaleziono' });
      try { be(req.user.id, req.user.imieNazwisko, 'atrybut_wartosc_zmieniono', 'atrybut_wartosc', String(id), { wartosc }); } catch (_) {}
      res.json({ ok: true });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ ok: false, error: 'Taka wartość już istnieje' });
      }
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // === DELETE /api/atrybuty/wartosci/:id ===
  app.delete('/api/atrybuty/wartosci/:id', we, (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
      const row = db.prepare(`SELECT rodzaj, wartosc FROM atrybuty_wartosci WHERE id = ?`).get(id);
      if (!row) return res.status(404).json({ ok: false, error: 'Nie znaleziono' });
      db.prepare(`DELETE FROM atrybuty_wartosci WHERE id = ?`).run(id);
      try { be(req.user.id, req.user.imieNazwisko, 'atrybut_wartosc_usunieto', 'atrybut_wartosc', String(id), row); } catch (_) {}
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Mapowanie rodzaj atrybutu -> kolumna w tabeli products
  const RODZAJ_KOLUMNA = {
    marka: 'marka',
    kategoria: 'kategoria',
    konstrukcja: 'konstrukcja',
    vfIf: 'vf_if',
    bieznik: 'bieznik',
    rodzaj: 'rodzaj',
    model: 'model',
    indeks_nosnosci: 'indeks_nosnosci',
    indeks_predkosci: 'indeks_predkosci',
    oznaczenie_bieznika: 'oznaczenie_bieznika',
    rozmiar: 'rozmiar',
    sezon: 'sezon',
    tl_tt: 'tl_tt',
    wentyl: 'wentyl',
    zastosowanie: 'zastosowanie'
  };

  // === GET /api/atrybuty/liczniki - liczba produktów per rodzaj::wartosc ===
  app.get('/api/atrybuty/liczniki', we, (req, res) => {
    try {
      const wynik = {};
      for (const [rodzaj, kolumna] of Object.entries(RODZAJ_KOLUMNA)) {
        let rows;
        try {
          rows = db.prepare(`SELECT ${kolumna} AS w, COUNT(*) AS c FROM products WHERE ${kolumna} IS NOT NULL AND ${kolumna} != '' GROUP BY ${kolumna}`).all();
        } catch (_) { continue; }
        for (const r of rows) {
          wynik[`${rodzaj}::${r.w}`] = r.c;
        }
      }
      res.json(wynik);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // === GET /api/atrybuty/uzycie?rodzaj=..&wartosc=.. - produkty uzywajace danej wartosci atrybutu ===
  app.get('/api/atrybuty/uzycie', we, (req, res) => {
    const rodzaj = req.query.rodzaj;
    const wartosc = req.query.wartosc;
    const kolumna = RODZAJ_KOLUMNA[rodzaj];
    if (!kolumna) return res.status(400).json({ ok: false, error: `Nieznany rodzaj atrybutu: ${rodzaj}` });
    if (wartosc == null || wartosc === '') return res.status(400).json({ ok: false, error: 'Brak wartosc' });
    try {
      const countRow = db.prepare(`SELECT COUNT(*) AS c FROM products WHERE ${kolumna} = ?`).get(wartosc);
      const count = countRow ? countRow.c : 0;
      const products = db.prepare(`SELECT dostawca, kod, nazwa, marka, rozmiar, stan FROM products WHERE ${kolumna} = ? ORDER BY nazwa LIMIT 200`).all(wartosc);
      res.json({ ok: true, count, products });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log('[atrybuty] Endpointy zarejestrowane: /api/atrybuty, /api/atrybuty/rodzaje, /api/atrybuty/wartosci, /api/atrybuty/liczniki, /api/atrybuty/uzycie');
}

module.exports = { registerAtrybuty };
