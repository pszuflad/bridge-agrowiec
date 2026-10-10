-- Ticket 208 (208-FEATURE-partnerzy-model-danych, PRT-1.1): model danych modułu partnerów B2B (karta PARTNERZY).
--
-- ⚠ NOWE TABELE, NIE ODTWORZENIE PRODUKCJI — produkcja nie ma obiektu „partner". Na wdrożeniu powstają puste,
-- bez kroków ręcznych. Sam model, bez logiki: kalkulator ceny, kurs NBP, GEIS, generator plików i panel to kolejne tickety.
-- Wszystkie ceny/koszty trzymamy w walucie źródłowej (PLN), kurs EUR zapisujemy osobno przy każdym pliku (`partner_kursy`).
--
--   partnerzy              — jeden wiersz na partnera; `aktywny` = 0 domyślnie (nowy partner nic nie generuje)
--   partner_magazyny       — magazyny (`products.magazyn`), z których eksportujemy
--   partner_wykluczenia    — pojedyncze produkty (`products.kod`) wykluczone z pliku partnera
--   partner_kraje          — ustawienia per partner × kraj: narzut (NARZUT zakup×(1+x), nie marża), źródło kursu, koszty dodatkowe
--   partner_kolumny        — kolumny pliku: kolejność, nazwa w pliku, źródło (pole katalogu albo pole obliczeniowe)
--   partner_pola_obliczeniowe — własne pola z formułą (parser w osobnym tickecie)
--   paliwo_historia        — opłata paliwowa per kraj, wpisywana ręcznie, z historią okresów (zmiana nie przelicza wstecz)
--   partner_kursy          — kurs EUR faktycznie użyty przy wygenerowaniu pliku
--
-- Idempotentna (`IF NOT EXISTS`).
CREATE TABLE IF NOT EXISTS partnerzy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nazwa TEXT NOT NULL UNIQUE,
  aktywny INTEGER NOT NULL DEFAULT 0,
  stan_min INTEGER NOT NULL DEFAULT 2,
  zaokraglanie TEXT NOT NULL DEFAULT 'grosz',
  harmonogram_minuty INTEGER,
  tolerancja_ceny_proc REAL,
  format_pliku TEXT NOT NULL DEFAULT 'csv',
  csv_separator TEXT NOT NULL DEFAULT ';',
  kanal_ftp INTEGER NOT NULL DEFAULT 0,
  kanal_email INTEGER NOT NULL DEFAULT 0,
  email_skrzynka TEXT,
  utworzono TEXT NOT NULL,
  zmieniono TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_magazyny (
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  magazyn TEXT NOT NULL,
  PRIMARY KEY (partner_id, magazyn)
);

CREATE TABLE IF NOT EXISTS partner_wykluczenia (
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  produkt_kod TEXT NOT NULL,
  PRIMARY KEY (partner_id, produkt_kod)
);

CREATE TABLE IF NOT EXISTS partner_kraje (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  kraj TEXT NOT NULL,
  narzut_proc REAL NOT NULL DEFAULT 0,
  kurs_zrodlo TEXT NOT NULL DEFAULT 'nbp',
  kurs_reczny REAL,
  koszty_dodatkowe REAL NOT NULL DEFAULT 0,
  UNIQUE (partner_id, kraj)
);

CREATE TABLE IF NOT EXISTS partner_pola_obliczeniowe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  nazwa TEXT NOT NULL,
  formula TEXT NOT NULL,
  UNIQUE (partner_id, nazwa)
);

CREATE TABLE IF NOT EXISTS partner_kolumny (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  pozycja INTEGER NOT NULL,
  nazwa_w_pliku TEXT NOT NULL,
  zrodlo_typ TEXT NOT NULL,
  zrodlo TEXT NOT NULL,
  UNIQUE (partner_id, pozycja)
);

CREATE TABLE IF NOT EXISTS paliwo_historia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kraj TEXT NOT NULL,
  procent REAL NOT NULL,
  obowiazuje_od TEXT NOT NULL,
  UNIQUE (kraj, obowiazuje_od)
);

CREATE TABLE IF NOT EXISTS partner_kursy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  kraj TEXT NOT NULL,
  kurs REAL NOT NULL,
  zrodlo TEXT NOT NULL,
  plik TEXT,
  zapisano TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_kursy_partner ON partner_kursy(partner_id, zapisano);
