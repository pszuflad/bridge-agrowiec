-- 003_szerokosc_text.sql — Iteracja 3d-1 (ticket 7-FEATURE-silnik-zatwierdzanie-wycofania-overrides)
--
-- Backlog #3, stan końcowy sagi `szerokoscfix` → `szerorig` → `szertxt`:
-- `products.szerokosc` przestaje być liczbą i staje się TEKSTEM.
--
-- ⭐ DLACZEGO TO NIE JEST KOSMETYKA. Ania doprowadziła poprawkę do końca w parserze:
-- `tyre_params.cjs:288-298` nadpisuje `result.szerokosc` napisem wziętym 1:1 z rozmiaru,
-- Z ZACHOWANIEM ZER KOŃCOWYCH („10.00", „14.9", „800"). Nasz port 3a jest kopią bajt-w-bajt,
-- więc backend JUŻ dziś produkuje takie napisy. Tyle że SQLite stosuje TYPE AFFINITY:
-- do kolumny zadeklarowanej REAL napis „10.00" wchodzi jako liczba 10.0 i zera przepadają.
-- Kanon fizycznie niszczył więc dokładnie to, po co `szertxt` powstał. Dopóki nikt tej kolumny
-- nie zapisywał, było to nieszkodliwe — ale `acceptStaging` (sesja 3d-2) jest jej JEDYNYM
-- pisarzem i od jego wejścia każda zaakceptowana pozycja zapisywałaby uszkodzoną wartość.
--
-- SQLite nie ma `ALTER TABLE … ALTER COLUMN`, więc jedyną drogą jest przebudowa tabeli:
-- nowa tabela → przepisanie danych → podmiana nazwy → odtworzenie indeksu. Ta sama droga,
-- którą przeszła produkcja.
--
-- ⚠ DDL PONIŻEJ MUSI ZOSTAĆ ZGODNY Z `001_schema.sql` + `002_import.sql`. Kolejność kolumn
-- jest istotna, bo przepisanie danych idzie przez `SELECT *`. Pilnuje tego test
-- `db.migracje.test.ts` — porównuje kolumny żywej tabeli z kanonem i dopuszcza dokładnie
-- dwie różnice: `szerokosc` TEXT (ta migracja) i `uwaga_cena` (migracja 002).
--
-- GATE I2: `contract/fixtures/GET_products.json` nagrano PRZED tą migracją produkcji, więc
-- trzyma `szerokosc` jako liczbę. Rozjazd jest ZADEKLAROWANY jako wyjątek w gate'cie
-- (`test/gate/asercje.ts`, `WYJATKI_GET_PRODUCTS`) i domykany przenagraniem fixtures w I12.

CREATE TABLE products_szertxt (
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
  label_snow TEXT,
  link_zdjecia TEXT,
  oznaczenie_bieznika TEXT,
  sezon TEXT,
  ms INTEGER,
  snow_3pmsf INTEGER,
  wentyl TEXT,
  cfo INTEGER,
  wysokosc_przesylki REAL,
  zastosowanie TEXT,
  kod_importu TEXT,
  nieobecnosc_pod_rzad INTEGER NOT NULL DEFAULT 0,
  uwaga_cena TEXT
);

-- Przepisanie 1:1. Wartości liczbowe wchodzące do kolumny TEXT stają się napisami
-- („620" zamiast 620) — to jest właśnie zamierzony efekt, nie utrata danych.
INSERT INTO products_szertxt SELECT * FROM products;

DROP TABLE products;
ALTER TABLE products_szertxt RENAME TO products;

-- Indeks z `001_schema.sql:312` — `DROP TABLE` zabrał go razem z tabelą.
CREATE INDEX IF NOT EXISTS idx_products_kod_importu ON products(kod_importu);
