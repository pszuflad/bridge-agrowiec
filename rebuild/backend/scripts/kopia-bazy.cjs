// Kopia bazy PRZED zastosowaniem migracji — siatka bezpieczeństwa deployu.
//
// PO CO: `tools/deploy-staging.sh` woła `npm run migrate` przy każdym pushu do `develop`,
// a migracje potrafią PRZEBUDOWAĆ tabelę (SQLite nie ma `ALTER TABLE … ALTER COLUMN`, więc
// zmiana typu kolumny to `CREATE` → `INSERT SELECT` → `DROP` → `RENAME`; tak działa
// `003_szerokosc_text.sql`). Runner opakowuje każdą migrację w transakcję, więc NIEUDANA
// migracja wycofa się w całości — ale udanej nikt nie cofnie. Ten skrypt daje punkt powrotu.
//
// ⭐ KOPIA POWSTAJE TYLKO WTEDY, GDY JEST CO MIGROWAĆ. Deploy chodzi z crona przy każdej
// zmianie w `rebuild/`, więc kopiowanie za każdym razem zasypałoby dysk — a ten projekt już
// raz na to nadział się na produkcji (292 pliki backup, ~6 GB, `mirror/backend/CHANGELOG.md`).
// Dlatego najpierw porównujemy pliki `.sql` z tabelą `_migracje` i wychodzimy bez kopii,
// gdy nie ma nic do zastosowania.
//
// DLACZEGO `VACUUM INTO`, A NIE `cp`: baza chodzi w trybie WAL. Zwykłe `cp` samego pliku `.db`
// pomija zawartość `-wal` i przy równoległym zapisie daje kopię niespójną albo cofniętą w czasie.
// `VACUUM INTO` tworzy spójny, odtwarzalny snapshot bez zatrzymywania serwera.
//
// Użycie (z katalogu rebuild/backend):
//   DB_PATH=/ścieżka/data.db node scripts/kopia-bazy.cjs
// Zmienne opcjonalne:
//   KOPIE_DIR   — katalog na kopie (domyślnie `<katalog bazy>/backups`)
//   KOPIE_ILE   — ile kopii zachować (domyślnie 5)
//   ETYKIETA    — dopisek do nazwy pliku, np. skrót commita

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const TABELA_MIGRACJI = "_migracje";

/** Katalog z kanonicznymi migracjami — ten sam, którego szuka `src/db/migrate.ts`. */
function katalogMigracji() {
  if (process.env.MIGRATIONS_DIR) return path.resolve(process.env.MIGRATIONS_DIR);
  const kandydaci = [
    path.join(__dirname, "..", "dist", "schema"), // release na VPS
    path.join(__dirname, "..", "..", "schema"), // repo
  ];
  for (const k of kandydaci) {
    if (fs.existsSync(path.join(k, "001_schema.sql"))) return path.resolve(k);
  }
  throw new Error(`Nie znaleziono katalogu migracji (szukano: ${kandydaci.join(", ")})`);
}

/**
 * Migracje, które jeszcze NIE zostały zastosowane na tej bazie.
 *
 * Brak tabeli `_migracje` znaczy „baza nigdy nie była migrowana" — wtedy wszystkie pliki
 * są do zastosowania.
 */
function migracjeDoZastosowania(db, katalog) {
  const pliki = fs
    .readdirSync(katalog)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const tabelaIstnieje = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(TABELA_MIGRACJI);
  if (!tabelaIstnieje) return pliki;

  const zastosowane = new Set(
    db
      .prepare(`SELECT nazwa FROM ${TABELA_MIGRACJI}`)
      .all()
      .map((w) => w.nazwa),
  );
  return pliki.filter((p) => !zastosowane.has(p));
}

/** Zostawia `ile` najnowszych kopii, resztę kasuje. Zwraca nazwy skasowanych. */
function posprzataj(katalogKopii, przedrostek, ile) {
  const kopie = fs
    .readdirSync(katalogKopii)
    .filter((f) => f.startsWith(przedrostek))
    .map((f) => ({ f, mtime: fs.statSync(path.join(katalogKopii, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const doKasacji = kopie.slice(ile);
  for (const { f } of doKasacji) fs.rmSync(path.join(katalogKopii, f), { force: true });
  return doKasacji.map((k) => k.f);
}

function main() {
  const sciezkaBazy = process.env.DB_PATH;
  if (!sciezkaBazy) {
    console.error("kopia-bazy: brak DB_PATH — nie wiem, co kopiować. Przerywam.");
    process.exit(1);
  }

  // Pierwsze uruchomienie środowiska: bazy jeszcze nie ma, nie ma czego ratować.
  if (!fs.existsSync(sciezkaBazy)) {
    console.log(`kopia-bazy: baza ${sciezkaBazy} jeszcze nie istnieje — pomijam kopię.`);
    return;
  }

  const katalog = katalogMigracji();
  const db = new Database(sciezkaBazy, { readonly: true, fileMustExist: true });

  let oczekujace;
  try {
    oczekujace = migracjeDoZastosowania(db, katalog);
  } catch (blad) {
    db.close();
    throw blad;
  }

  if (oczekujace.length === 0) {
    db.close();
    console.log("kopia-bazy: brak migracji do zastosowania — kopia niepotrzebna.");
    return;
  }

  const katalogKopii = process.env.KOPIE_DIR
    ? path.resolve(process.env.KOPIE_DIR)
    : path.join(path.dirname(sciezkaBazy), "backups");
  fs.mkdirSync(katalogKopii, { recursive: true });

  const znacznik = new Date().toISOString().replace(/[:.]/g, "-");
  const etykieta = process.env.ETYKIETA ? `_${process.env.ETYKIETA}` : "";
  const przedrostek = `${path.basename(sciezkaBazy)}.bak_pre-migracje_`;
  const cel = path.join(katalogKopii, `${przedrostek}${znacznik}${etykieta}`);

  console.log(
    `kopia-bazy: do zastosowania ${oczekujace.length} migracji (${oczekujace.join(", ")}) ` +
      `— robię kopię do ${cel}`,
  );

  // VACUUM INTO nie nadpisze istniejącego pliku, a znacznik czasu jest unikalny —
  // więc kolizja oznaczałaby dwa deploye w tej samej milisekundzie i lepiej, żeby padło.
  try {
    db.prepare("VACUUM INTO ?").run(cel);
  } finally {
    db.close();
  }

  const rozmiar = fs.statSync(cel).size;
  if (rozmiar === 0) throw new Error(`kopia-bazy: kopia ${cel} ma zerowy rozmiar`);

  const ile = Number(process.env.KOPIE_ILE ?? 5);
  const skasowane = posprzataj(katalogKopii, przedrostek, ile);

  console.log(
    `kopia-bazy: gotowe (${(rozmiar / 1024 / 1024).toFixed(1)} MB). ` +
      `Zachowane kopie: ${ile}${skasowane.length ? `, skasowane stare: ${skasowane.length}` : ""}.`,
  );
  console.log(`kopia-bazy: przywrócenie = zatrzymaj serwer i skopiuj plik na miejsce ${sciezkaBazy}`);
}

main();
