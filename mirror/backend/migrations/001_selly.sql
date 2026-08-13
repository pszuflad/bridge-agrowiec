-- Migracja 001_selly.sql
-- Dodaje tabelę mapowania Bridge <-> Selly oraz cache słowników.

-- Mapowanie kodu produktu Bridge -> product_id w Selly.
CREATE TABLE IF NOT EXISTS selly_products (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  bridge_kod         TEXT NOT NULL UNIQUE,          -- odpowiada products.kod
  selly_product_id   INTEGER NOT NULL,              -- product_id w Selly
  selly_category_id  INTEGER,
  selly_producer_id  INTEGER,
  ostatnia_sync      TEXT NOT NULL DEFAULT (datetime('now')),
  ostatni_status     TEXT NOT NULL DEFAULT 'ok',    -- ok | error | pending
  ostatni_blad       TEXT,
  cena_sprzedazy_wyslana REAL,
  cena_zakupu_wyslana    REAL,
  stan_wyslany           INTEGER,
  utworzono          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_selly_products_kod ON selly_products(bridge_kod);
CREATE INDEX IF NOT EXISTS idx_selly_products_status ON selly_products(ostatni_status);

-- Cache słowników Selly (producenci, kategorie, VAT, magazyny).
CREATE TABLE IF NOT EXISTS selly_dict (
  slownik    TEXT NOT NULL,     -- 'producers' | 'categories' | 'vat_rates' | 'warehouses'
  klucz      TEXT NOT NULL,     -- np. nazwa marki po toLowerCase
  wartosc_id INTEGER NOT NULL,  -- id w Selly
  raw_json   TEXT,              -- surowa odpowiedź (na wypadek dodatkowych pól)
  odswiezono TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slownik, klucz)
);

-- Historia operacji sync (dla audit trail).
CREATE TABLE IF NOT EXISTS selly_sync_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  operacja     TEXT NOT NULL,        -- 'sync_supplier' | 'sync_product' | 'update_prices' | 'update_stock'
  dostawca_kod TEXT,
  liczba_ok    INTEGER NOT NULL DEFAULT 0,
  liczba_blad  INTEGER NOT NULL DEFAULT 0,
  liczba_skip  INTEGER NOT NULL DEFAULT 0,
  szczegoly_json TEXT,
  uzytkownik_id INTEGER,
  uzytkownik_imie TEXT,
  rozpoczeto   TEXT NOT NULL DEFAULT (datetime('now')),
  zakonczono   TEXT,
  status       TEXT NOT NULL DEFAULT 'w_trakcie'  -- 'w_trakcie' | 'zakonczono' | 'blad'
);
CREATE INDEX IF NOT EXISTS idx_selly_sync_log_data ON selly_sync_log(rozpoczeto);
CREATE INDEX IF NOT EXISTS idx_selly_sync_log_dostawca ON selly_sync_log(dostawca_kod);
