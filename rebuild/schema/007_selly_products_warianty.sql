-- 007_selly_products_warianty.sql — Iteracja 13d, karta 13d-1
--     (ticket 45-FEATURE-selly-rest-sync-tor1)
--
-- Backlog #60. Przeprojektowanie `selly_products` na MODEL WARIANTOWY.
--
-- ŹRÓDŁO — `mirror/backend/CHANGELOG.md`, wpis 2026-09-07 20:03 (Anna):
--     „selly_products (schemat przepisany: nowa unikatowosc kod_importu+dostawca, nowe kolumny
--      selly_variant_id, feature_id_magazyn, kod_importu, dostawca; stara tabela zachowana
--      jako selly_products_old z 2174 przestarzalymi wpisami MO1/MO2)"
-- Powód: cena i stan w Selly są PER WARIANT (19% produktów ma >1 wariant), a bulk-endpoint
-- `/api/products/helper/warehouse_quantity` zwracał HTTP 400 dla produktów z wariantami.
-- Ten sam `kod_importu` = JEDEN produkt Selly z N wariantami (N dostawców).
--
-- ⭐ DLACZEGO `RENAME`, A NIE PRZEBUDOWA TABELI (jak w `003_szerokosc_text.sql`).
-- Kształt docelowy odczytany z `main:db/schema.sql` (zrzut produkcji 08.09) niesie DOWÓD na
-- metodę: indeks `idx_selly_products_kod` jest tam przypięty do `selly_products_old`
-- (`:188`), a `idx_selly_products_status` do NOWEJ tabeli (`:331`). SQLite przy
-- `ALTER TABLE ... RENAME TO` przenosi indeksy razem z tabelą, ZACHOWUJĄC ich nazwy — więc
-- taki rozkład powstaje wyłącznie przez rename starej tabeli i zwolnienie nazwy `_status`.
-- Stąd `DROP INDEX idx_selly_products_status` poniżej: bez niego `CREATE INDEX` o tej samej
-- nazwie padłby na „index idx_selly_products_status already exists".
--
-- Danych NIE migrujemy do nowej tabeli — Ania też ich nie migrowała (nowa startowała pusta,
-- zapełniło ją lazy discovery: 5068 → 6614 wpisów przez pierwszą noc). Stare wiersze zostają
-- w `selly_products_old` jako materiał archiwalny; nic ich nie czyta.

ALTER TABLE selly_products RENAME TO selly_products_old;

-- Nazwa musi się zwolnić dla indeksu na nowej tabeli (patrz nota wyżej).
DROP INDEX IF EXISTS idx_selly_products_status;

-- DDL verbatim z `main:db/schema.sql:307-325` (zrzut produkcji 08.09), łącznie z komentarzami.
CREATE TABLE selly_products (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  kod_importu            TEXT NOT NULL,                 -- klucz produktu (grupuje warianty)
  dostawca               TEXT NOT NULL,                 -- MO1..MO10 - identyfikuje wariant
  bridge_kod             TEXT NOT NULL,                 -- pelny kod Bridge (np. MO2_19539) dla latwosci JOIN
  selly_product_id       INTEGER NOT NULL,              -- product_id w Selly (wspolny dla wszystkich wariantow tego kod_importu)
  selly_variant_id       INTEGER,                       -- variant_id w Selly (unikatowy per dostawca+produkt)
  selly_category_id      INTEGER,
  selly_producer_id      INTEGER,
  feature_id_magazyn     INTEGER,                       -- feature_id (Magazyny) dla tego dostawcy
  ostatnia_sync          TEXT NOT NULL DEFAULT (datetime('now')),
  ostatni_status         TEXT NOT NULL DEFAULT 'pending', -- pending | ok | error | not_found
  ostatni_blad           TEXT,
  cena_sprzedazy_wyslana REAL,
  cena_zakupu_wyslana    REAL,
  stan_wyslany           INTEGER,
  utworzono              TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kod_importu, dostawca)
);
CREATE INDEX idx_selly_products_bridge  ON selly_products(bridge_kod);
CREATE INDEX idx_selly_products_kod_imp ON selly_products(kod_importu);
CREATE INDEX idx_selly_products_dostaw  ON selly_products(dostawca);
CREATE INDEX idx_selly_products_prodid  ON selly_products(selly_product_id);
CREATE INDEX idx_selly_products_varid   ON selly_products(selly_variant_id);
CREATE INDEX idx_selly_products_status  ON selly_products(ostatni_status);
