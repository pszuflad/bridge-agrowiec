CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE staging_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  typ_zmiany TEXT NOT NULL,
  kod TEXT NOT NULL,
  nazwa TEXT NOT NULL,
  dostawca TEXT NOT NULL,
  magazyn TEXT NOT NULL,
  stan_stary INTEGER,
  stan_nowy INTEGER,
  cena_zakupu_stara REAL,
  cena_zakupu_nowa REAL,
  cena_sprzedazy_nowa REAL,
  zmiana_pct REAL,
  ostrzezenie TEXT,
  powod TEXT,
  snapshot_json TEXT,
  ean_raw TEXT,
  ean_is_valid INTEGER,
  ean_source_status TEXT,
  ean_candidates TEXT,
  magazyn_raw TEXT,
  edytowane_pola TEXT,
  utworzono TEXT NOT NULL,
  zatwierdzil_uzytkownik_id INTEGER,
  zatwierdzono_data TEXT
);
CREATE TABLE manual_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_kod TEXT NOT NULL,
  supplier_product_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  override_value TEXT NOT NULL,
  reason TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL, acknowledged_source_value TEXT,
  UNIQUE(supplier_kod, supplier_product_id, field_name)
);
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poziom TEXT NOT NULL,
  typ TEXT NOT NULL,
  opis TEXT NOT NULL,
  dostawca TEXT,
  status TEXT NOT NULL DEFAULT 'nowy',
  data TEXT NOT NULL
);
CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  kod_produktu TEXT NOT NULL,
  nazwa TEXT NOT NULL,
  pole TEXT NOT NULL,
  stara_wartosc TEXT,
  nowa_wartosc TEXT,
  zrodlo TEXT NOT NULL,
  kto TEXT NOT NULL,
  wykonal_uzytkownik_id INTEGER
);
CREATE TABLE markups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  typ TEXT NOT NULL,
  zakres TEXT NOT NULL,
  warunki TEXT,
  nazwa TEXT,
  wartosc REAL NOT NULL,
  jednostka TEXT NOT NULL DEFAULT 'procent',
  priorytet INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'aktywny',
  zmienil_uzytkownik_id INTEGER,
  zmieniono_data TEXT
);
CREATE TABLE promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nazwa TEXT NOT NULL,
  rabat_pct REAL NOT NULL,
  zasieg TEXT NOT NULL,
  warunki TEXT,
  priorytet INTEGER DEFAULT 50,
  start TEXT NOT NULL,
  koniec TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktywna',
  zmienil_uzytkownik_id INTEGER,
  zmieniono_data TEXT
);
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod TEXT NOT NULL UNIQUE,
  nazwa TEXT NOT NULL,
  email TEXT,
  format_pliku TEXT NOT NULL,
  sposob_dostarczania TEXT NOT NULL,
  url TEXT,
  czestotliwosc_minuty INTEGER,
  status TEXT NOT NULL DEFAULT 'aktywny',
  ostatni_plik TEXT,
  ostatnia_sync TEXT,
  liczba_produktow INTEGER NOT NULL DEFAULT 0,
  parser TEXT,
  kodowanie TEXT,
  uwagi TEXT
);
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  haslo_hash TEXT NOT NULL,
  imie_nazwisko TEXT NOT NULL,
  utworzono TEXT NOT NULL,
  ostatnie_logowanie TEXT
);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uzytkownik_id INTEGER,
  uzytkownik_imie TEXT,
  akcja TEXT NOT NULL,
  encja_typ TEXT,
  encja_id TEXT,
  szczegoly_json TEXT,
  kiedy TEXT NOT NULL
);
CREATE TABLE spedycja_limity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dostawca_kod TEXT NOT NULL UNIQUE,
  prog_netto REAL,
  koszt_ponizej REAL,
  koszt_powyzej REAL,
  dodatkowe_reguly TEXT
);
CREATE TABLE config (
  klucz TEXT PRIMARY KEY,
  wartosc TEXT NOT NULL
);
CREATE TABLE atrybuty_rodzaje (
      value TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      opis TEXT,
      core INTEGER NOT NULL DEFAULT 0,
      utworzony TEXT NOT NULL DEFAULT (datetime('now'))
    );
CREATE TABLE atrybuty_wartosci (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rodzaj TEXT NOT NULL,
      wartosc TEXT NOT NULL,
      utworzony TEXT NOT NULL DEFAULT (datetime('now')), origin TEXT NOT NULL DEFAULT 'user', utworzono TEXT NOT NULL DEFAULT '',
      UNIQUE(rodzaj, wartosc),
      FOREIGN KEY (rodzaj) REFERENCES atrybuty_rodzaje(value) ON DELETE CASCADE
    );
CREATE TABLE historia_cen (id INTEGER PRIMARY KEY AUTOINCREMENT,produkt_id INTEGER,kod TEXT NOT NULL,ean TEXT,dostawca TEXT NOT NULL,marka TEXT,model TEXT,rozmiar TEXT,indeks_nosnosci TEXT,indeks_predkosci TEXT,kategoria TEXT,cena_zakupu REAL,cena_sprzedazy REAL,stan INTEGER,zarejestrowano_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_atrybuty_wartosci_rodzaj ON atrybuty_wartosci(rodzaj);
CREATE INDEX idx_historia_cen_kod_data ON historia_cen(kod,zarejestrowano_at);
CREATE INDEX idx_historia_cen_ean_data ON historia_cen(ean,zarejestrowano_at);
CREATE INDEX idx_historia_cen_dostawca_data ON historia_cen(dostawca,zarejestrowano_at);
CREATE INDEX idx_historia_cen_marka ON historia_cen(marka);
CREATE INDEX idx_historia_cen_rozmiar ON historia_cen(rozmiar);
CREATE TABLE atrybuty_wartosci_pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rodzaj TEXT NOT NULL,
  wartosc TEXT NOT NULL,
  ile_wystapien INTEGER NOT NULL DEFAULT 1,
  pierwszy_import TEXT NOT NULL DEFAULT (datetime('now')),
  ostatni_import TEXT NOT NULL DEFAULT (datetime('now')),
  dostawcy TEXT DEFAULT '',
  UNIQUE(rodzaj, wartosc)
);
CREATE INDEX idx_pending_rodzaj ON atrybuty_wartosci_pending(rodzaj);
CREATE TABLE atrybuty_wartosci_odrzucone (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rodzaj TEXT NOT NULL,
  wartosc TEXT NOT NULL,
  odrzucono TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(rodzaj, wartosc)
);
CREATE INDEX idx_odrzucone_rodzaj ON atrybuty_wartosci_odrzucone(rodzaj);
CREATE TABLE IF NOT EXISTS "selly_products_old" (
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
CREATE INDEX idx_selly_products_kod ON "selly_products_old"(bridge_kod);
CREATE TABLE selly_dict (
  slownik    TEXT NOT NULL,     -- 'producers' | 'categories' | 'vat_rates' | 'warehouses'
  klucz      TEXT NOT NULL,     -- np. nazwa marki po toLowerCase
  wartosc_id INTEGER NOT NULL,  -- id w Selly
  raw_json   TEXT,              -- surowa odpowiedź (na wypadek dodatkowych pól)
  odswiezono TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slownik, klucz)
);
CREATE TABLE selly_sync_log (
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
CREATE INDEX idx_selly_sync_log_data ON selly_sync_log(rozpoczeto);
CREATE INDEX idx_selly_sync_log_dostawca ON selly_sync_log(dostawca_kod);
CREATE TABLE link_pamiec_kod (kod TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);
CREATE TABLE link_pamiec_mr (mrkey TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);
CREATE TABLE selly_kategoria_norm_map (
  kategoria_raw TEXT NOT NULL,
  kategoria_glowna_norm TEXT NOT NULL,
  category_id_glowna INTEGER NOT NULL,
  UNIQUE(kategoria_raw)
);
CREATE TABLE selly_zastosowanie_category_map (
  zastosowanie TEXT NOT NULL UNIQUE,
  category_id_glowna INTEGER,
  category_id_zastosowanie INTEGER,
  dziedziczy_kategorie_produktu INTEGER NOT NULL DEFAULT 0,
  utworzony TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE nazwa_pamiec (
  kod_importu TEXT PRIMARY KEY,
  nazwa TEXT NOT NULL,
  updated_at TEXT,
  source TEXT
);
CREATE TABLE waga_pamiec (kod TEXT PRIMARY KEY, waga REAL NOT NULL, updated_at TEXT, source TEXT);
CREATE TABLE IF NOT EXISTS "products" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod TEXT NOT NULL UNIQUE,
  nazwa TEXT NOT NULL,
  marka TEXT NOT NULL,
  kategoria TEXT NOT NULL,
  dostawca TEXT NOT NULL,
  magazyn TEXT NOT NULL,
  stan INTEGER NOT NULL,
  cena_zakupu REAL NOT NULL,
  cena_sprzedazy REAL NOT NULL,
  marza_pct REAL NOT NULL,
  vat INTEGER NOT NULL DEFAULT 23,
  ean TEXT,
  ean_raw TEXT,
  ean_is_valid INTEGER,
  ean_source_status TEXT,
  ean_candidates TEXT,
  status TEXT NOT NULL DEFAULT 'aktywny',
  magazyn_raw TEXT,
  data_aktualizacji TEXT NOT NULL,
  rozmiar TEXT,
  szerokosc TEXT,
  profil REAL,
  srednica REAL,
  konstrukcja TEXT,
  indeks_nosnosci TEXT,
  indeks_predkosci TEXT,
  pr TEXT,
  tl_tt TEXT,
  vf_if TEXT,
  bieznik TEXT,
  model TEXT,
  dot TEXT,
  rodzaj TEXT,
  sku TEXT,
  kod_dostawcy TEXT,
  rozmiar_alternatywny TEXT,
  sf TEXT,
  sb TEXT,
  hf TEXT,
  ls TEXT,
  reinforced INTEGER,
  extra_load INTEGER,
  cut_resistant INTEGER,
  heat_resistant INTEGER,
  stubble_resistant INTEGER,
  nro INTEGER,
  cho INTEGER,
  indeksy TEXT,
  indeks_1 TEXT,
  indeks_2 TEXT,
  dostepnosc TEXT,
  waga REAL,
  dlugosc REAL,
  szerokosc_paczki REAL,
  wysokosc REAL,
  label_noise TEXT,
  label_wet TEXT,
  label_rolling TEXT,
  label_ice TEXT,
  label_snow TEXT
, link_zdjecia TEXT, oznaczenie_bieznika TEXT, sezon TEXT, ms INTEGER, snow_3pmsf INTEGER, wentyl TEXT, cfo INTEGER, wysokosc_przesylki REAL, zastosowanie TEXT, kod_importu TEXT, nieobecnosc_pod_rzad INTEGER NOT NULL DEFAULT 0, uwaga_cena TEXT, blokowane_formy_platnosci TEXT);
CREATE INDEX idx_products_kod_importu ON products(kod_importu);
CREATE TABLE atrybuty_wartosci_bak_20260904(
  id INT,
  rodzaj TEXT,
  wartosc TEXT,
  utworzony TEXT,
  origin TEXT,
  utworzono TEXT
);
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
CREATE TABLE staging_matches(supplier TEXT NOT NULL,source_key TEXT NOT NULL,product_code TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(supplier,source_key));
CREATE UNIQUE INDEX staging_one_current_product ON staging_items(dostawca,kod);
CREATE TABLE supplier_feed_state(supplier TEXT PRIMARY KEY,last_identity_hash TEXT,last_item_count INTEGER NOT NULL DEFAULT 0,max_item_count INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,last_counted_at TEXT);
CREATE TABLE supplier_feed_versions(supplier TEXT NOT NULL,fingerprint TEXT NOT NULL,counted_at TEXT NOT NULL,PRIMARY KEY(supplier,fingerprint));
CREATE TABLE product_absence_checks(supplier TEXT NOT NULL,product_code TEXT NOT NULL,checks_json TEXT NOT NULL,PRIMARY KEY(supplier,product_code));
CREATE TABLE product_auto_suspensions(
  supplier TEXT NOT NULL,product_code TEXT NOT NULL,suspended_at TEXT NOT NULL,
  source_fingerprint TEXT,reason TEXT NOT NULL,PRIMARY KEY(supplier,product_code));
CREATE TABLE staging_absence_decisions(
      supplier TEXT NOT NULL,
      product_code TEXT NOT NULL,
      candidates_hash TEXT NOT NULL,
      decided_at TEXT NOT NULL,
      PRIMARY KEY(supplier,product_code)
    );
CREATE TRIGGER products_blokowane_formy_ai
        AFTER INSERT ON products
        BEGIN
          UPDATE products
          SET blokowane_formy_platnosci = CASE UPPER(TRIM(NEW.dostawca)) WHEN 'MO1' THEN '203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO2' THEN '201, 202, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO3' THEN '201, 202, 203, 204, 205, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO4' THEN '201, 202, 203, 204, 205, 206, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO5' THEN '201, 202, 203, 204, 205, 206, 207, 208, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO7' THEN '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO8' THEN '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 215, 216, 217, 218, 219' WHEN 'MO9' THEN '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 217, 218, 219' WHEN 'MO10' THEN '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216' ELSE NULL END
          WHERE id = NEW.id;
        END;
CREATE TRIGGER products_blokowane_formy_au
        AFTER UPDATE OF dostawca ON products
        BEGIN
          UPDATE products
          SET blokowane_formy_platnosci = CASE UPPER(TRIM(NEW.dostawca)) WHEN 'MO1' THEN '203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO2' THEN '201, 202, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO3' THEN '201, 202, 203, 204, 205, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO4' THEN '201, 202, 203, 204, 205, 206, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO5' THEN '201, 202, 203, 204, 205, 206, 207, 208, 211, 212, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO7' THEN '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 213, 214, 215, 216, 217, 218, 219' WHEN 'MO8' THEN '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 215, 216, 217, 218, 219' WHEN 'MO9' THEN '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 217, 218, 219' WHEN 'MO10' THEN '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216' ELSE NULL END
          WHERE id = NEW.id;
        END;
CREATE TRIGGER products_zastosowanie_ai
      AFTER INSERT ON products
      BEGIN
        UPDATE products
        SET kategoria = CASE WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('rolnicze') THEN 'Rolnicze' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('rolnicza') THEN 'Rolnicze' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('przemyslowe') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('przemysłowe') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('przemyslowa') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('przemysłowa') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('ciezarowe') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('ciężarowe') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('ciezarowa') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('ciężarowa') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('lesne') THEN 'Leśne' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('leśne') THEN 'Leśne' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('lesna') THEN 'Leśne' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('leśna') THEN 'Leśne' ELSE TRIM(NEW.kategoria) END,
            zastosowanie = CASE
              WHEN NEW.zastosowanie IS NULL OR TRIM(NEW.zastosowanie) = '' THEN NEW.zastosowanie
              ELSE CASE WHEN NEW.zastosowanie IS NULL OR TRIM(NEW.zastosowanie) = '' THEN NULL WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('Rolnicze') THEN CASE WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kombajn') THEN 'Kombajn' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('opryskiwacz') THEN 'Opryskiwacz' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa / flotacja') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa/flotacja') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa leśna') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka kołowa') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka rolnicza') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka') THEN 'Kosiarka/ogród' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka/ogród') THEN 'Kosiarka/ogród' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('wózek widłowy') THEN 'Wózek widłowy' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor/walec') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnice/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy (otr)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all-position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skider') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('rolnicze (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przemysłowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciężarowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('leśne (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne przemysłowe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne leśne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('implement rolniczy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kombajn') THEN 'Kombajn' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Opryskiwacz') THEN 'Opryskiwacz' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Przyczepa') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ładowarka') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kosiarka/ogród') THEN 'Kosiarka/ogród' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Wózek widłowy') THEN 'Wózek widłowy' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('All position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder, Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester, Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder ; Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester ; Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder/Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester/Forwarder') THEN 'Forwarder/Harwester' ELSE 'Uniwersalne/pozostałe' END WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('Przemysłowe') THEN CASE WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa / flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa/flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa leśna') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka') THEN 'Ładowarka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka kołowa') THEN 'Ładowarka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka rolnicza') THEN 'Ładowarka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('wózek widłowy') THEN 'Wózek widłowy' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('koparka') THEN 'Koparka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor') THEN 'Kompaktor' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor/walec') THEN 'Kompaktor' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnica/dźwig') THEN 'Suwnica/dźwig' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnice/dźwig') THEN 'Suwnica/dźwig' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze') THEN 'Maszyny górnicze' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy') THEN 'Maszyny górnicze' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy (otr)') THEN 'Maszyny górnicze' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all-position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skider') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('rolnicze (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przemysłowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciężarowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('leśne (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne przemysłowe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne leśne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('implement rolniczy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ładowarka') THEN 'Ładowarka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Wózek widłowy') THEN 'Wózek widłowy' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Koparka') THEN 'Koparka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kompaktor') THEN 'Kompaktor' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Suwnica/dźwig') THEN 'Suwnica/dźwig' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Maszyny górnicze') THEN 'Maszyny górnicze' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('All position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder, Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester, Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder ; Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester ; Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder/Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester/Forwarder') THEN 'Forwarder/Harwester' ELSE 'Uniwersalne/pozostałe' END WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('Ciężarowe') THEN CASE WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa / flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa/flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa leśna') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka kołowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka rolnicza') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('wózek widłowy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor/walec') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnice/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy (otr)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all position') THEN 'All position' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all-position') THEN 'All position' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś kierowana') THEN 'Oś kierowana' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś napędowa') THEN 'Oś napędowa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa') THEN 'Naczepa/przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa/przyczepa') THEN 'Naczepa/przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skider') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('rolnicze (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przemysłowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciężarowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('leśne (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne przemysłowe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne leśne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('implement rolniczy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ładowarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Wózek widłowy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('All position') THEN 'All position' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś kierowana') THEN 'Oś kierowana' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś napędowa') THEN 'Oś napędowa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Naczepa/przyczepa') THEN 'Naczepa/przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder, Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester, Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder ; Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester ; Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder/Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester/Forwarder') THEN 'Forwarder/Harwester' ELSE 'Uniwersalne/pozostałe' END WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('Leśne') THEN CASE WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik leśny') THEN 'Ciągnik leśny' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa / flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa/flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa leśna') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka kołowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka rolnicza') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('wózek widłowy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor/walec') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnice/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy (otr)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all-position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skidder') THEN 'Skidder' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skider') THEN 'Skidder' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('rolnicze (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przemysłowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciężarowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('leśne (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne przemysłowe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne leśne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('implement rolniczy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik leśny') THEN 'Ciągnik leśny' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ładowarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Wózek widłowy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('All position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Skidder') THEN 'Skidder' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder, Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester, Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder ; Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester ; Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder/Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester/Forwarder') THEN 'Forwarder/Harwester' ELSE 'Uniwersalne/pozostałe' END ELSE TRIM(NEW.zastosowanie) END
            END
        WHERE id = NEW.id;
      END;
CREATE TRIGGER products_zastosowanie_au
      AFTER UPDATE OF kategoria, zastosowanie ON products
      BEGIN
        UPDATE products
        SET kategoria = CASE WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('rolnicze') THEN 'Rolnicze' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('rolnicza') THEN 'Rolnicze' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('przemyslowe') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('przemysłowe') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('przemyslowa') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('przemysłowa') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('ciezarowe') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('ciężarowe') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('ciezarowa') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('ciężarowa') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('lesne') THEN 'Leśne' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('leśne') THEN 'Leśne' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('lesna') THEN 'Leśne' WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('leśna') THEN 'Leśne' ELSE TRIM(NEW.kategoria) END,
            zastosowanie = CASE
              WHEN NEW.zastosowanie IS NULL OR TRIM(NEW.zastosowanie) = '' THEN NEW.zastosowanie
              ELSE CASE WHEN NEW.zastosowanie IS NULL OR TRIM(NEW.zastosowanie) = '' THEN NULL WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('Rolnicze') THEN CASE WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kombajn') THEN 'Kombajn' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('opryskiwacz') THEN 'Opryskiwacz' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa / flotacja') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa/flotacja') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa leśna') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka kołowa') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka rolnicza') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka') THEN 'Kosiarka/ogród' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka/ogród') THEN 'Kosiarka/ogród' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('wózek widłowy') THEN 'Wózek widłowy' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor/walec') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnice/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy (otr)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all-position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skider') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('rolnicze (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przemysłowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciężarowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('leśne (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne przemysłowe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne leśne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('implement rolniczy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kombajn') THEN 'Kombajn' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Opryskiwacz') THEN 'Opryskiwacz' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Przyczepa') THEN 'Przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ładowarka') THEN 'Ciągnik' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kosiarka/ogród') THEN 'Kosiarka/ogród' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Wózek widłowy') THEN 'Wózek widłowy' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('All position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder, Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester, Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder ; Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester ; Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder/Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester/Forwarder') THEN 'Forwarder/Harwester' ELSE 'Uniwersalne/pozostałe' END WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('Przemysłowe') THEN CASE WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa / flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa/flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa leśna') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka') THEN 'Ładowarka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka kołowa') THEN 'Ładowarka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka rolnicza') THEN 'Ładowarka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('wózek widłowy') THEN 'Wózek widłowy' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('koparka') THEN 'Koparka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor') THEN 'Kompaktor' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor/walec') THEN 'Kompaktor' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnica/dźwig') THEN 'Suwnica/dźwig' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnice/dźwig') THEN 'Suwnica/dźwig' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze') THEN 'Maszyny górnicze' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy') THEN 'Maszyny górnicze' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy (otr)') THEN 'Maszyny górnicze' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all-position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skider') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('rolnicze (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przemysłowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciężarowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('leśne (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne przemysłowe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne leśne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('implement rolniczy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ładowarka') THEN 'Ładowarka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Wózek widłowy') THEN 'Wózek widłowy' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Koparka') THEN 'Koparka' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kompaktor') THEN 'Kompaktor' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Suwnica/dźwig') THEN 'Suwnica/dźwig' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Maszyny górnicze') THEN 'Maszyny górnicze' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('All position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder, Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester, Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder ; Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester ; Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder/Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester/Forwarder') THEN 'Forwarder/Harwester' ELSE 'Uniwersalne/pozostałe' END WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('Ciężarowe') THEN CASE WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa / flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa/flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa leśna') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka kołowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka rolnicza') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('wózek widłowy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor/walec') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnice/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy (otr)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all position') THEN 'All position' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all-position') THEN 'All position' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś kierowana') THEN 'Oś kierowana' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś napędowa') THEN 'Oś napędowa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa') THEN 'Naczepa/przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa/przyczepa') THEN 'Naczepa/przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skider') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('rolnicze (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przemysłowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciężarowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('leśne (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne przemysłowe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne leśne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('implement rolniczy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik leśny') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ładowarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Wózek widłowy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('All position') THEN 'All position' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś kierowana') THEN 'Oś kierowana' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś napędowa') THEN 'Oś napędowa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Naczepa/przyczepa') THEN 'Naczepa/przyczepa' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Skidder') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder, Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester, Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder ; Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester ; Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder/Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester/Forwarder') THEN 'Forwarder/Harwester' ELSE 'Uniwersalne/pozostałe' END WHEN LOWER(TRIM(NEW.kategoria)) = LOWER('Leśne') THEN CASE WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciągnik leśny') THEN 'Ciągnik leśny' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa / flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa/flotacja') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przyczepa leśna') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka kołowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ładowarka rolnicza') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('wózek widłowy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('kompaktor/walec') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('suwnice/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('maszyny górnicze/kamieniołomy (otr)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('all-position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skidder') THEN 'Skidder' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('skider') THEN 'Skidder' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('rolnicze (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('przemysłowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('ciężarowe (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('leśne (ogólne)') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne przemysłowe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('uniwersalne leśne') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('implement rolniczy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ciągnik leśny') THEN 'Ciągnik leśny' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kombajn') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Opryskiwacz') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Ładowarka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kosiarka/ogród') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Wózek widłowy') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Koparka') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Kompaktor') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Suwnica/dźwig') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Maszyny górnicze') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('All position') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś kierowana') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Oś napędowa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Naczepa/przyczepa') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Skidder') THEN 'Skidder' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Uniwersalne/pozostałe') THEN 'Uniwersalne/pozostałe' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder, Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester, Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder ; Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester ; Forwarder') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Forwarder/Harwester') THEN 'Forwarder/Harwester' WHEN LOWER(TRIM(NEW.zastosowanie)) = LOWER('Harwester/Forwarder') THEN 'Forwarder/Harwester' ELSE 'Uniwersalne/pozostałe' END ELSE TRIM(NEW.zastosowanie) END
            END
        WHERE id = NEW.id;
      END;
CREATE TRIGGER manual_overrides_kategoria_ai
      AFTER INSERT ON manual_overrides
      WHEN NEW.field_name = 'kategoria'
      BEGIN
        UPDATE manual_overrides
        SET override_value = CASE WHEN LOWER(TRIM(NEW.override_value)) = LOWER('rolnicze') THEN 'Rolnicze' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('rolnicza') THEN 'Rolnicze' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('przemyslowe') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('przemysłowe') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('przemyslowa') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('przemysłowa') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('ciezarowe') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('ciężarowe') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('ciezarowa') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('ciężarowa') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('lesne') THEN 'Leśne' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('leśne') THEN 'Leśne' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('lesna') THEN 'Leśne' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('leśna') THEN 'Leśne' ELSE TRIM(NEW.override_value) END
        WHERE id = NEW.id;
      END;
CREATE TRIGGER manual_overrides_kategoria_au
      AFTER UPDATE OF field_name, override_value ON manual_overrides
      WHEN NEW.field_name = 'kategoria'
      BEGIN
        UPDATE manual_overrides
        SET override_value = CASE WHEN LOWER(TRIM(NEW.override_value)) = LOWER('rolnicze') THEN 'Rolnicze' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('rolnicza') THEN 'Rolnicze' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('przemyslowe') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('przemysłowe') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('przemyslowa') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('przemysłowa') THEN 'Przemysłowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('ciezarowe') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('ciężarowe') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('ciezarowa') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('ciężarowa') THEN 'Ciężarowe' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('lesne') THEN 'Leśne' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('leśne') THEN 'Leśne' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('lesna') THEN 'Leśne' WHEN LOWER(TRIM(NEW.override_value)) = LOWER('leśna') THEN 'Leśne' ELSE TRIM(NEW.override_value) END
        WHERE id = NEW.id;
      END;
