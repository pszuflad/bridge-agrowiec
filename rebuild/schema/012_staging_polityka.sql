-- 012_staging_polityka.sql — Iteracja 15, karta I15.4a (ticket 124-FEATURE-fundament-stagingu)
--
-- Backlog #99 (Staging v2 — jedno bieżące zgłoszenie na parę dostawca+kod, świadome dopasowania),
-- #103 („Braki w cenniku" — bezpieczeństwo źródła i dowody nieobecności), #104 (dostępność: brak
-- w pełnej ofercie = wstrzymany/0), #106 (decyzje o nieobecnych kartach). Ta migracja wnosi WYŁĄCZNIE
-- schemat — logika tych wpisów jest zakresem kart I15.4b i I15.4c.
--
-- ⭐ SKĄD TO SIĘ BIERZE. Produkcja NIE ma tego w żadnej migracji — zakłada te tabele przy KAŻDYM
-- starcie procesu, w `staging_policy.cjs` `install()` (`origin/main` @ 88fa31c, linie 86–107):
--   • sześć `CREATE TABLE IF NOT EXISTS` w dokładnie tej treści co niżej;
--   • warunkowy `ALTER TABLE staging_absence_decisions ADD COLUMN selected_source_code TEXT`
--     (pod `PRAGMA table_info`) — u nas kolumna jest wprost w `CREATE`, patrz niżej;
--   • `CREATE UNIQUE INDEX IF NOT EXISTS staging_absence_one_choice …`.
-- Nowy stos nie ma takiego kodu startowego, więc bez tej migracji tabele nie powstałyby wcale.
--
-- ⚠ IDEMPOTENCJA NA PRODUKCJI. Na produkcyjnej `data.db` wszystkie sześć tabel i oba indeksy JUŻ SĄ
-- (Ania założyła je 22–23.09). Runner wykonuje cały plik JEDNYM `sqlite.exec()` w jednej transakcji
-- (`src/db/migrate.ts` `zastosujMigracje`), więc gołe `CREATE TABLE` wywróciłoby CAŁĄ migrację
-- (`table … already exists`) i zatrzymało cutover. `IF NOT EXISTS` jest natywnym mechanizmem SQLite
-- dla `CREATE TABLE` i `CREATE [UNIQUE] INDEX`, więc — inaczej niż w 011 (`ALTER TABLE`) i 013
-- (przebudowa tabeli) — NIE jest tu potrzebna żadna dyrektywa runnera. Na produkcji ta migracja jest
-- w całości no-opem: nie tworzy niczego, nie kasuje niczego (sprzątanie duplikatów — patrz niżej).
--
-- ⚠ TREŚĆ TABEL JEST KOPIĄ BAJT W BAJT `git show 88fa31c:db/schema.sql` (linie 332–347), z jedyną
-- zmianą `CREATE …` → `CREATE … IF NOT EXISTS`. Zrzut ma gołe `CREATE`, bo to `.schema` żywej bazy;
-- KOD produkcji używa `IF NOT EXISTS`, więc odtwarzamy zachowanie oryginału, nie zmieniamy go.
-- Nie „porządkować" formatowania (wcięcia `product_auto_suspensions` i `staging_absence_decisions`
-- różnią się, bo powstały w różnych tygodniach) — zrzut ma być porównywalny z produkcją znak w znak.
--
-- ⚠ `selected_source_code` JEST wprost w `CREATE TABLE staging_absence_decisions`, mimo że produkcja
-- dokłada ją `ALTER`-em. Powód: w zrzucie `88fa31c:db/schema.sql:340-346` kolumna jest już częścią
-- definicji (siedzi w jednej linii z `decided_at` — ślad po `ALTER`), czyli na produkcji fizycznie
-- istnieje i `CREATE … IF NOT EXISTS` jej nie dotknie. Odpowiednika `@dodaj-kolumne-jesli-brak` użyć
-- się tu NIE DA: runner stosuje dyrektywy PRZED treścią pliku, a `kolumnyTabeli()` (`migrate.ts`)
-- rzuca wyjątek, gdy tabeli nie ma — na świeżej bazie wywróciłoby to migrację.

CREATE TABLE IF NOT EXISTS staging_matches(supplier TEXT NOT NULL,source_key TEXT NOT NULL,product_code TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(supplier,source_key));

-- ⚠ SPRZĄTANIE PRZED INDEKSEM UNIKALNYM — kolejność jest istotna i ZMIENIA DANE.
-- Staging v2 (#99) wymusza jedno bieżące zgłoszenie na parę (dostawca, kod). Produkcja doszła do tego
-- stanu jednorazowym skryptem `staging_reconcile_20260922.cjs` (decyzja D5 iteracji 15: skryptu NIE
-- przenosimy) i dopiero potem założyła indeks. U nas ta sama operacja musi być częścią migracji, bo
-- `CREATE UNIQUE INDEX` na danych z duplikatami wywróciłby się na `UNIQUE constraint failed`.
-- Zostaje wiersz o NAJWIĘKSZYM `id` w grupie, czyli najnowsze zgłoszenie — tak samo jak `addStaging`
-- ze Staging v2, które przed wstawieniem kasuje poprzednie zgłoszenie tej samej pary.
-- ZMIERZONE: na kopii `db/snapshot.db` (13.08) 3362 wiersze `staging_items` → 3124, znika 238.
-- NA PRODUKCJI NO-OP: indeks unikalny istnieje tam od 22.09, więc duplikaty są niemożliwe.
DELETE FROM staging_items
 WHERE id NOT IN (SELECT MAX(id) FROM staging_items GROUP BY dostawca, kod);

CREATE UNIQUE INDEX IF NOT EXISTS staging_one_current_product ON staging_items(dostawca,kod);

CREATE TABLE IF NOT EXISTS supplier_feed_state(supplier TEXT PRIMARY KEY,last_identity_hash TEXT,last_item_count INTEGER NOT NULL DEFAULT 0,max_item_count INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,last_counted_at TEXT);
CREATE TABLE IF NOT EXISTS supplier_feed_versions(supplier TEXT NOT NULL,fingerprint TEXT NOT NULL,counted_at TEXT NOT NULL,PRIMARY KEY(supplier,fingerprint));
CREATE TABLE IF NOT EXISTS product_absence_checks(supplier TEXT NOT NULL,product_code TEXT NOT NULL,checks_json TEXT NOT NULL,PRIMARY KEY(supplier,product_code));
CREATE TABLE IF NOT EXISTS product_auto_suspensions(
  supplier TEXT NOT NULL,product_code TEXT NOT NULL,suspended_at TEXT NOT NULL,
  source_fingerprint TEXT,reason TEXT NOT NULL,PRIMARY KEY(supplier,product_code));
CREATE TABLE IF NOT EXISTS staging_absence_decisions(
      supplier TEXT NOT NULL,
      product_code TEXT NOT NULL,
      candidates_hash TEXT NOT NULL,
      decided_at TEXT NOT NULL, selected_source_code TEXT,
      PRIMARY KEY(supplier,product_code)
    );

-- Indeks CZĘŚCIOWY: `WHERE selected_source_code IS NOT NULL`. Bez tego warunku wiele spraw zamkniętych
-- bez wyboru karty (`selected_source_code` NULL) zderzyłoby się ze sobą — w SQLite NULL-e w indeksie
-- unikalnym i tak się nie kolidują, ale warunek jest w oryginale i zostaje bajt w bajt.
CREATE UNIQUE INDEX IF NOT EXISTS staging_absence_one_choice ON staging_absence_decisions(supplier,selected_source_code) WHERE selected_source_code IS NOT NULL;
