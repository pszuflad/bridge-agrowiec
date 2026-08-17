-- ============================================================================
--  Bridge dla Agrowca — KANONICZNY SCHEMAT BAZY (001)
--  Źródło: `sqlite3 data.db .schema` z produkcji (2026-08-17), uczyniony
--  idempotentnym (IF NOT EXISTS) i pozbawiony sqlite_sequence (auto).
--
--  TEN PLIK DOMYKA DRYF: wszystkie obiekty, które wcześniej powstawały RĘCZNIE
--  albo jednorazowymi skryptami (a nie przez kod aplikacji), są tu tworzone
--  z kodu. Świeża instalacja z tego pliku daje schemat identyczny z produkcją.
--
--  Obiekty wcześniej "dryfujące" (patrz docs/spec-backend.md §3), teraz kanoniczne:
--    Tabele:  atrybuty_wartosci_pending, atrybuty_wartosci_odrzucone,
--             selly_kategoria_norm_map, selly_zastosowanie_category_map
--    Kolumny products (dopięte historycznie ALTER-em, tu inline w CREATE):
--             link_zdjecia, oznaczenie_bieznika, sezon, ms, snow_3pmsf, wentyl,
--             cfo, wysokosc_przesylki, zastosowanie, kod_importu,
--             nieobecnosc_pod_rzad
--
--  26 tabel użytkowych + 13 indeksów. Weryfikacja: świeża baza z tego pliku
--  vs snapshot produkcji -> ten sam schemat.
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
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
  szerokosc REAL,
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
, link_zdjecia TEXT, oznaczenie_bieznika TEXT, sezon TEXT, ms INTEGER, snow_3pmsf INTEGER, wentyl TEXT, cfo INTEGER, wysokosc_przesylki REAL, zastosowanie TEXT, kod_importu TEXT, nieobecnosc_pod_rzad INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS staging_items (
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
CREATE TABLE IF NOT EXISTS manual_overrides (
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
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poziom TEXT NOT NULL,
  typ TEXT NOT NULL,
  opis TEXT NOT NULL,
  dostawca TEXT,
  status TEXT NOT NULL DEFAULT 'nowy',
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS history (
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
CREATE TABLE IF NOT EXISTS markups (
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
CREATE TABLE IF NOT EXISTS promotions (
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
CREATE TABLE IF NOT EXISTS suppliers (
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
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  haslo_hash TEXT NOT NULL,
  imie_nazwisko TEXT NOT NULL,
  utworzono TEXT NOT NULL,
  ostatnie_logowanie TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uzytkownik_id INTEGER,
  uzytkownik_imie TEXT,
  akcja TEXT NOT NULL,
  encja_typ TEXT,
  encja_id TEXT,
  szczegoly_json TEXT,
  kiedy TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS spedycja_limity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dostawca_kod TEXT NOT NULL UNIQUE,
  prog_netto REAL,
  koszt_ponizej REAL,
  koszt_powyzej REAL,
  dodatkowe_reguly TEXT
);
CREATE TABLE IF NOT EXISTS config (
  klucz TEXT PRIMARY KEY,
  wartosc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS atrybuty_rodzaje (
      value TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      opis TEXT,
      core INTEGER NOT NULL DEFAULT 0,
      utworzony TEXT NOT NULL DEFAULT (datetime('now'))
    );
CREATE TABLE IF NOT EXISTS atrybuty_wartosci (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rodzaj TEXT NOT NULL,
      wartosc TEXT NOT NULL,
      utworzony TEXT NOT NULL DEFAULT (datetime('now')), origin TEXT NOT NULL DEFAULT 'user', utworzono TEXT NOT NULL DEFAULT '',
      UNIQUE(rodzaj, wartosc),
      FOREIGN KEY (rodzaj) REFERENCES atrybuty_rodzaje(value) ON DELETE CASCADE
    );
CREATE TABLE IF NOT EXISTS historia_cen (id INTEGER PRIMARY KEY AUTOINCREMENT,produkt_id INTEGER,kod TEXT NOT NULL,ean TEXT,dostawca TEXT NOT NULL,marka TEXT,model TEXT,rozmiar TEXT,indeks_nosnosci TEXT,indeks_predkosci TEXT,kategoria TEXT,cena_zakupu REAL,cena_sprzedazy REAL,stan INTEGER,zarejestrowano_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_atrybuty_wartosci_rodzaj ON atrybuty_wartosci(rodzaj);
CREATE INDEX IF NOT EXISTS idx_historia_cen_kod_data ON historia_cen(kod,zarejestrowano_at);
CREATE INDEX IF NOT EXISTS idx_historia_cen_ean_data ON historia_cen(ean,zarejestrowano_at);
CREATE INDEX IF NOT EXISTS idx_historia_cen_dostawca_data ON historia_cen(dostawca,zarejestrowano_at);
CREATE INDEX IF NOT EXISTS idx_historia_cen_marka ON historia_cen(marka);
CREATE INDEX IF NOT EXISTS idx_historia_cen_rozmiar ON historia_cen(rozmiar);
CREATE TABLE IF NOT EXISTS atrybuty_wartosci_pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rodzaj TEXT NOT NULL,
  wartosc TEXT NOT NULL,
  ile_wystapien INTEGER NOT NULL DEFAULT 1,
  pierwszy_import TEXT NOT NULL DEFAULT (datetime('now')),
  ostatni_import TEXT NOT NULL DEFAULT (datetime('now')),
  dostawcy TEXT DEFAULT '',
  UNIQUE(rodzaj, wartosc)
);
CREATE INDEX IF NOT EXISTS idx_pending_rodzaj ON atrybuty_wartosci_pending(rodzaj);
CREATE TABLE IF NOT EXISTS atrybuty_wartosci_odrzucone (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rodzaj TEXT NOT NULL,
  wartosc TEXT NOT NULL,
  odrzucono TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(rodzaj, wartosc)
);
CREATE INDEX IF NOT EXISTS idx_odrzucone_rodzaj ON atrybuty_wartosci_odrzucone(rodzaj);
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
CREATE TABLE IF NOT EXISTS selly_dict (
  slownik    TEXT NOT NULL,     -- 'producers' | 'categories' | 'vat_rates' | 'warehouses'
  klucz      TEXT NOT NULL,     -- np. nazwa marki po toLowerCase
  wartosc_id INTEGER NOT NULL,  -- id w Selly
  raw_json   TEXT,              -- surowa odpowiedź (na wypadek dodatkowych pól)
  odswiezono TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slownik, klucz)
);
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
CREATE TABLE IF NOT EXISTS link_pamiec_kod (kod TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);
CREATE TABLE IF NOT EXISTS link_pamiec_mr (mrkey TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);
CREATE TABLE IF NOT EXISTS selly_kategoria_norm_map (
  kategoria_raw TEXT NOT NULL,
  kategoria_glowna_norm TEXT NOT NULL,
  category_id_glowna INTEGER NOT NULL,
  UNIQUE(kategoria_raw)
);
CREATE TABLE IF NOT EXISTS selly_zastosowanie_category_map (
  zastosowanie TEXT NOT NULL UNIQUE,
  category_id_glowna INTEGER,
  category_id_zastosowanie INTEGER,
  dziedziczy_kategorie_produktu INTEGER NOT NULL DEFAULT 0,
  utworzony TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_kod_importu ON products(kod_importu);
CREATE TABLE IF NOT EXISTS nazwa_pamiec (
  kod_importu TEXT PRIMARY KEY,
  nazwa TEXT NOT NULL,
  updated_at TEXT,
  source TEXT
);
CREATE TABLE IF NOT EXISTS waga_pamiec (kod TEXT PRIMARY KEY, waga REAL NOT NULL, updated_at TEXT, source TEXT);
