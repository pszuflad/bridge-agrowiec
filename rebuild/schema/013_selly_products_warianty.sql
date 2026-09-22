-- 013_selly_products_warianty.sql — Iteracja 15, karta I15.6
--     (ticket 108-FEATURE-selly-rest-discovery-delta; dawne 13d-1)
--
-- Backlog #60. Przebudowa `selly_products` na MODEL WARIANTOWY.
--
-- ŹRÓDŁO — `origin/main:mirror/backend/CHANGELOG.md`, wpis 2026-09-07 20:03 (Ania):
--     „selly_products (schemat przepisany: nowa unikatowosc kod_importu+dostawca, nowe kolumny
--      selly_variant_id, feature_id_magazyn, kod_importu, dostawca; stara tabela zachowana
--      jako selly_products_old z 2174 przestarzalymi wpisami MO1/MO2)"
-- Cena i stan w Selly są PER WARIANT; ten sam `kod_importu` = JEDEN produkt Selly
-- z N wariantami (po jednym na dostawcę, rozpoznawanym po cesze „Magazyny”).
-- Kształt docelowy: `origin/main:db/schema.sql:174-188` (stara) i `:307-331` (nowa), zamrożenie 7d6cfc9.
--
-- ⭐ DLACZEGO `RENAME`, A NIE PRZEBUDOWA. Zrzut produkcji niesie dowód na metodę: indeks
-- `idx_selly_products_kod` jest tam przypięty do `selly_products_old` (`:188`), a
-- `idx_selly_products_status` do NOWEJ tabeli (`:331`). SQLite przy `ALTER TABLE … RENAME TO`
-- przenosi indeksy razem z tabelą i zachowuje ich nazwy, więc taki rozkład powstaje wyłącznie
-- przez rename starej tabeli i zwolnienie nazwy `_status` (bez `DROP INDEX` poniżej
-- `CREATE INDEX idx_selly_products_status` padłby na „already exists”).
--
-- Danych NIE przenosimy — Ania też nie (nowa tabela startowała pusta, zapełniło ją lazy
-- discovery). Stare wiersze zostają w `selly_products_old`; nic ich nie czyta.
--
-- ⚠ CUTOVER. Baza produkcji ma już oba obiekty, więc na niej ta migracja PADA
-- („there is already another table named selly_products_old”) i transakcja runnera się
-- wycofuje — nic nie zostaje w pół drogi. Przy przełączeniu trzeba sprawdzić kształt i odnotować
-- 013 w `_migracje` ręcznie (jak 002, `docs/cutover.md` §5). Opis: `docs/karty/I15.6/karta.md`.

ALTER TABLE selly_products RENAME TO selly_products_old;

DROP INDEX IF EXISTS idx_selly_products_status;

-- DDL verbatim z `origin/main:db/schema.sql:307-331`, łącznie z komentarzami.
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
CREATE INDEX idx_selly_products_status ON selly_products(ostatni_status);
