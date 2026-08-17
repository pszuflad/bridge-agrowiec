# 02. Schemat żywej bazy

Źródło struktury: wykonane na żywej bazie polecenie `sqlite3 data.db .schema`; surowy wynik znajduje się w dołączonym `schema.sql`. Liczności pochodzą z odrębnych `SELECT COUNT(*) FROM "tabela"` podczas tego samego odczytu. `PRAGMA journal_mode` zwróciło `wal`; `PRAGMA foreign_keys` zwróciło `0`.

## Tabele, kolumny, klucze i indeksy

### `products` — 72 kolumn; 7405 wierszy

* Definicja żywej bazy: `schema.sql:1`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `kod` TEXT NOT NULL UNIQUE, `nazwa` TEXT NOT NULL, `marka` TEXT NOT NULL, `kategoria` TEXT NOT NULL, `dostawca` TEXT NOT NULL, `magazyn` TEXT NOT NULL, `stan` INTEGER NOT NULL, `cena_zakupu` REAL NOT NULL, `cena_sprzedazy` REAL NOT NULL, `marza_pct` REAL NOT NULL, `vat` INTEGER NOT NULL DEFAULT 23, `ean` TEXT, `ean_raw` TEXT, `ean_is_valid` INTEGER, `ean_source_status` TEXT, `ean_candidates` TEXT, `status` TEXT NOT NULL DEFAULT 'aktywny', `magazyn_raw` TEXT, `data_aktualizacji` TEXT NOT NULL, `rozmiar` TEXT, `szerokosc` REAL, `profil` REAL, `srednica` REAL, `konstrukcja` TEXT, `indeks_nosnosci` TEXT, `indeks_predkosci` TEXT, `pr` TEXT, `tl_tt` TEXT, `vf_if` TEXT, `bieznik` TEXT, `model` TEXT, `dot` TEXT, `rodzaj` TEXT, `sku` TEXT, `kod_dostawcy` TEXT, `rozmiar_alternatywny` TEXT, `sf` TEXT, `sb` TEXT, `hf` TEXT, `ls` TEXT, `reinforced` INTEGER, `extra_load` INTEGER, `cut_resistant` INTEGER, `heat_resistant` INTEGER, `stubble_resistant` INTEGER, `nro` INTEGER, `cho` INTEGER, `indeksy` TEXT, `indeks_1` TEXT, `indeks_2` TEXT, `dostepnosc` TEXT, `waga` REAL, `dlugosc` REAL, `szerokosc_paczki` REAL, `wysokosc` REAL, `label_noise` TEXT, `label_wet` TEXT, `label_rolling` TEXT, `label_ice` TEXT, `label_snow` TEXT, `link_zdjecia` TEXT, `oznaczenie_bieznika` TEXT, `sezon` TEXT, `ms` INTEGER, `snow_3pmsf` INTEGER, `wentyl` TEXT, `cfo` INTEGER, `wysokosc_przesylki` REAL, `zastosowanie` TEXT, `kod_importu` TEXT, `nieobecnosc_pod_rzad` INTEGER NOT NULL DEFAULT 0
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT; kod TEXT NOT NULL UNIQUE
* Indeksy w `sqlite_master`: idx_products_kod_importu(kod_importu), sqlite_autoindex_products_1

### `sqlite_sequence` — 2 kolumn; 17 wierszy

* Definicja żywej bazy: `schema.sql:64`.
* Kolumny: `name` (brak deklaracji typu), `seq` (brak deklaracji typu)
* Klucze/ograniczenia: brak jawnego ograniczenia w definicji.
* Indeksy w `sqlite_master`: brak indeksu w eksporcie sqlite_master.

### `staging_items` — 24 kolumn; 3474 wierszy

* Definicja żywej bazy: `schema.sql:65`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `typ_zmiany` TEXT NOT NULL, `kod` TEXT NOT NULL, `nazwa` TEXT NOT NULL, `dostawca` TEXT NOT NULL, `magazyn` TEXT NOT NULL, `stan_stary` INTEGER, `stan_nowy` INTEGER, `cena_zakupu_stara` REAL, `cena_zakupu_nowa` REAL, `cena_sprzedazy_nowa` REAL, `zmiana_pct` REAL, `ostrzezenie` TEXT, `powod` TEXT, `snapshot_json` TEXT, `ean_raw` TEXT, `ean_is_valid` INTEGER, `ean_source_status` TEXT, `ean_candidates` TEXT, `magazyn_raw` TEXT, `edytowane_pola` TEXT, `utworzono` TEXT NOT NULL, `zatwierdzil_uzytkownik_id` INTEGER, `zatwierdzono_data` TEXT
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT
* Indeksy w `sqlite_master`: brak indeksu w eksporcie sqlite_master.

### `manual_overrides` — 9 kolumn; 12620 wierszy

* Definicja żywej bazy: `schema.sql:91`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `supplier_kod` TEXT NOT NULL, `supplier_product_id` TEXT NOT NULL, `field_name` TEXT NOT NULL, `override_value` TEXT NOT NULL, `reason` TEXT, `created_by` INTEGER, `created_at` TEXT NOT NULL, `acknowledged_source_value` TEXT
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT; UNIQUE(supplier_kod, supplier_product_id, field_name)
* Indeksy w `sqlite_master`: sqlite_autoindex_manual_overrides_1

### `alerts` — 7 kolumn; 3032 wierszy

* Definicja żywej bazy: `schema.sql:102`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `poziom` TEXT NOT NULL, `typ` TEXT NOT NULL, `opis` TEXT NOT NULL, `dostawca` TEXT, `status` TEXT NOT NULL DEFAULT 'nowy', `data` TEXT NOT NULL
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT
* Indeksy w `sqlite_master`: brak indeksu w eksporcie sqlite_master.

### `history` — 10 kolumn; 46916 wierszy

* Definicja żywej bazy: `schema.sql:111`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `data` TEXT NOT NULL, `kod_produktu` TEXT NOT NULL, `nazwa` TEXT NOT NULL, `pole` TEXT NOT NULL, `stara_wartosc` TEXT, `nowa_wartosc` TEXT, `zrodlo` TEXT NOT NULL, `kto` TEXT NOT NULL, `wykonal_uzytkownik_id` INTEGER
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT
* Indeksy w `sqlite_master`: brak indeksu w eksporcie sqlite_master.

### `markups` — 11 kolumn; 1 wierszy

* Definicja żywej bazy: `schema.sql:123`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `typ` TEXT NOT NULL, `zakres` TEXT NOT NULL, `warunki` TEXT, `nazwa` TEXT, `wartosc` REAL NOT NULL, `jednostka` TEXT NOT NULL DEFAULT 'procent', `priorytet` INTEGER NOT NULL DEFAULT 50, `status` TEXT NOT NULL DEFAULT 'aktywny', `zmienil_uzytkownik_id` INTEGER, `zmieniono_data` TEXT
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT
* Indeksy w `sqlite_master`: brak indeksu w eksporcie sqlite_master.

### `promotions` — 11 kolumn; 0 wierszy

* Definicja żywej bazy: `schema.sql:136`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `nazwa` TEXT NOT NULL, `rabat_pct` REAL NOT NULL, `zasieg` TEXT NOT NULL, `warunki` TEXT, `priorytet` INTEGER DEFAULT 50, `start` TEXT NOT NULL, `koniec` TEXT NOT NULL, `status` TEXT NOT NULL DEFAULT 'aktywna', `zmienil_uzytkownik_id` INTEGER, `zmieniono_data` TEXT
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT
* Indeksy w `sqlite_master`: brak indeksu w eksporcie sqlite_master.

### `suppliers` — 15 kolumn; 10 wierszy

* Definicja żywej bazy: `schema.sql:149`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `kod` TEXT NOT NULL UNIQUE, `nazwa` TEXT NOT NULL, `email` TEXT, `format_pliku` TEXT NOT NULL, `sposob_dostarczania` TEXT NOT NULL, `url` TEXT, `czestotliwosc_minuty` INTEGER, `status` TEXT NOT NULL DEFAULT 'aktywny', `ostatni_plik` TEXT, `ostatnia_sync` TEXT, `liczba_produktow` INTEGER NOT NULL DEFAULT 0, `parser` TEXT, `kodowanie` TEXT, `uwagi` TEXT
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT; kod TEXT NOT NULL UNIQUE
* Indeksy w `sqlite_master`: sqlite_autoindex_suppliers_1

### `users` — 6 kolumn; 2 wierszy

* Definicja żywej bazy: `schema.sql:166`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `email` TEXT NOT NULL UNIQUE, `haslo_hash` TEXT NOT NULL, `imie_nazwisko` TEXT NOT NULL, `utworzono` TEXT NOT NULL, `ostatnie_logowanie` TEXT
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT; email TEXT NOT NULL UNIQUE
* Indeksy w `sqlite_master`: sqlite_autoindex_users_1

### `audit_log` — 8 kolumn; 4348 wierszy

* Definicja żywej bazy: `schema.sql:174`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `uzytkownik_id` INTEGER, `uzytkownik_imie` TEXT, `akcja` TEXT NOT NULL, `encja_typ` TEXT, `encja_id` TEXT, `szczegoly_json` TEXT, `kiedy` TEXT NOT NULL
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT
* Indeksy w `sqlite_master`: brak indeksu w eksporcie sqlite_master.

### `spedycja_limity` — 6 kolumn; 10 wierszy

* Definicja żywej bazy: `schema.sql:184`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `dostawca_kod` TEXT NOT NULL UNIQUE, `prog_netto` REAL, `koszt_ponizej` REAL, `koszt_powyzej` REAL, `dodatkowe_reguly` TEXT
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT; dostawca_kod TEXT NOT NULL UNIQUE
* Indeksy w `sqlite_master`: sqlite_autoindex_spedycja_limity_1

### `config` — 2 kolumn; 11 wierszy

* Definicja żywej bazy: `schema.sql:192`.
* Kolumny: `klucz` TEXT PRIMARY KEY, `wartosc` TEXT NOT NULL
* Klucze/ograniczenia: klucz TEXT PRIMARY KEY
* Indeksy w `sqlite_master`: sqlite_autoindex_config_1

### `atrybuty_rodzaje` — 5 kolumn; 15 wierszy

* Definicja żywej bazy: `schema.sql:196`.
* Kolumny: `value` TEXT PRIMARY KEY, `label` TEXT NOT NULL, `opis` TEXT, `core` INTEGER NOT NULL DEFAULT 0, `utworzony` TEXT NOT NULL DEFAULT (datetime('now'))
* Klucze/ograniczenia: value TEXT PRIMARY KEY
* Indeksy w `sqlite_master`: sqlite_autoindex_atrybuty_rodzaje_1

### `atrybuty_wartosci` — 6 kolumn; 5144 wierszy

* Definicja żywej bazy: `schema.sql:203`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `rodzaj` TEXT NOT NULL, `wartosc` TEXT NOT NULL, `utworzony` TEXT NOT NULL DEFAULT (datetime('now')), `origin` TEXT NOT NULL DEFAULT 'user', `utworzono` TEXT NOT NULL DEFAULT ''
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT; UNIQUE(rodzaj, wartosc); FOREIGN KEY (rodzaj) REFERENCES atrybuty_rodzaje(value) ON DELETE CASCADE
* Indeksy w `sqlite_master`: idx_atrybuty_wartosci_rodzaj(rodzaj), sqlite_autoindex_atrybuty_wartosci_1, sqlite_autoindex_atrybuty_wartosci_odrzucone_1, sqlite_autoindex_atrybuty_wartosci_pending_1

### `historia_cen` — 15 kolumn; 15552 wierszy

* Definicja żywej bazy: `schema.sql:211`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `produkt_id` INTEGER, `kod` TEXT NOT NULL, `ean` TEXT, `dostawca` TEXT NOT NULL, `marka` TEXT, `model` TEXT, `rozmiar` TEXT, `indeks_nosnosci` TEXT, `indeks_predkosci` TEXT, `kategoria` TEXT, `cena_zakupu` REAL, `cena_sprzedazy` REAL, `stan` INTEGER, `zarejestrowano_at` TEXT NOT NULL DEFAULT (datetime('now'))
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT
* Indeksy w `sqlite_master`: idx_historia_cen_kod_data(kod,zarejestrowano_at), idx_historia_cen_ean_data(ean,zarejestrowano_at), idx_historia_cen_dostawca_data(dostawca,zarejestrowano_at), idx_historia_cen_marka(marka), idx_historia_cen_rozmiar(rozmiar)

### `atrybuty_wartosci_pending` — 7 kolumn; 498 wierszy

* Definicja żywej bazy: `schema.sql:218`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `rodzaj` TEXT NOT NULL, `wartosc` TEXT NOT NULL, `ile_wystapien` INTEGER NOT NULL DEFAULT 1, `pierwszy_import` TEXT NOT NULL DEFAULT (datetime('now')), `ostatni_import` TEXT NOT NULL DEFAULT (datetime('now')), `dostawcy` TEXT DEFAULT ''
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT; UNIQUE(rodzaj, wartosc)
* Indeksy w `sqlite_master`: idx_pending_rodzaj(rodzaj)

### `atrybuty_wartosci_odrzucone` — 4 kolumn; 3 wierszy

* Definicja żywej bazy: `schema.sql:229`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `rodzaj` TEXT NOT NULL, `wartosc` TEXT NOT NULL, `odrzucono` TEXT NOT NULL DEFAULT (datetime('now'))
* Klucze/ograniczenia: id INTEGER PRIMARY KEY AUTOINCREMENT; UNIQUE(rodzaj, wartosc)
* Indeksy w `sqlite_master`: idx_odrzucone_rodzaj(rodzaj)

### `selly_products` — 12 kolumn; 2174 wierszy

* Definicja żywej bazy: `schema.sql:237`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `bridge_kod` TEXT NOT NULL UNIQUE, `selly_product_id` INTEGER NOT NULL, `selly_category_id` INTEGER, `selly_producer_id` INTEGER, `ostatnia_sync` TEXT NOT NULL DEFAULT (datetime('now')), `ostatni_status` TEXT NOT NULL DEFAULT 'ok', `ostatni_blad` TEXT, `cena_sprzedazy_wyslana` REAL, `cena_zakupu_wyslana` REAL, `stan_wyslany` INTEGER, `utworzono` TEXT NOT NULL DEFAULT (datetime('now'))
* Klucze/ograniczenia: id                 INTEGER PRIMARY KEY AUTOINCREMENT; bridge_kod         TEXT NOT NULL UNIQUE
* Indeksy w `sqlite_master`: idx_selly_products_kod(bridge_kod), idx_selly_products_status(ostatni_status), sqlite_autoindex_selly_products_1

### `selly_dict` — 5 kolumn; 102 wierszy

* Definicja żywej bazy: `schema.sql:253`.
* Kolumny: `slownik` TEXT NOT NULL, `klucz` TEXT NOT NULL, `wartosc_id` INTEGER NOT NULL, `raw_json` TEXT, `odswiezono` TEXT NOT NULL DEFAULT (datetime('now'))
* Klucze/ograniczenia: PRIMARY KEY (slownik, klucz)
* Indeksy w `sqlite_master`: sqlite_autoindex_selly_dict_1

### `selly_sync_log` — 12 kolumn; 13 wierszy

* Definicja żywej bazy: `schema.sql:261`.
* Kolumny: `id` INTEGER PRIMARY KEY AUTOINCREMENT, `operacja` TEXT NOT NULL, `dostawca_kod` TEXT, `liczba_ok` INTEGER NOT NULL DEFAULT 0, `liczba_blad` INTEGER NOT NULL DEFAULT 0, `liczba_skip` INTEGER NOT NULL DEFAULT 0, `szczegoly_json` TEXT, `uzytkownik_id` INTEGER, `uzytkownik_imie` TEXT, `rozpoczeto` TEXT NOT NULL DEFAULT (datetime('now')), `zakonczono` TEXT, `status` TEXT NOT NULL DEFAULT 'w_trakcie'
* Klucze/ograniczenia: id           INTEGER PRIMARY KEY AUTOINCREMENT
* Indeksy w `sqlite_master`: idx_selly_sync_log_data(rozpoczeto), idx_selly_sync_log_dostawca(dostawca_kod)

### `link_pamiec_kod` — 3 kolumn; 12058 wierszy

* Definicja żywej bazy: `schema.sql:277`.
* Kolumny: `kod` TEXT PRIMARY KEY, `link` TEXT NOT NULL, `updated_at` TEXT
* Klucze/ograniczenia: kod TEXT PRIMARY KEY
* Indeksy w `sqlite_master`: sqlite_autoindex_link_pamiec_kod_1

### `link_pamiec_mr` — 3 kolumn; 6550 wierszy

* Definicja żywej bazy: `schema.sql:278`.
* Kolumny: `mrkey` TEXT PRIMARY KEY, `link` TEXT NOT NULL, `updated_at` TEXT
* Klucze/ograniczenia: mrkey TEXT PRIMARY KEY
* Indeksy w `sqlite_master`: sqlite_autoindex_link_pamiec_mr_1

### `selly_kategoria_norm_map` — 3 kolumn; 8 wierszy

* Definicja żywej bazy: `schema.sql:279`.
* Kolumny: `kategoria_raw` TEXT NOT NULL, `kategoria_glowna_norm` TEXT NOT NULL, `category_id_glowna` INTEGER NOT NULL
* Klucze/ograniczenia: UNIQUE(kategoria_raw)
* Indeksy w `sqlite_master`: sqlite_autoindex_selly_kategoria_norm_map_1

### `selly_zastosowanie_category_map` — 5 kolumn; 31 wierszy

* Definicja żywej bazy: `schema.sql:285`.
* Kolumny: `zastosowanie` TEXT NOT NULL UNIQUE, `category_id_glowna` INTEGER, `category_id_zastosowanie` INTEGER, `dziedziczy_kategorie_produktu` INTEGER NOT NULL DEFAULT 0, `utworzony` TEXT NOT NULL DEFAULT (datetime('now'))
* Klucze/ograniczenia: zastosowanie TEXT NOT NULL UNIQUE
* Indeksy w `sqlite_master`: sqlite_autoindex_selly_zastosowanie_category_map_1

### `nazwa_pamiec` — 4 kolumn; 723 wierszy

* Definicja żywej bazy: `schema.sql:293`.
* Kolumny: `kod_importu` TEXT PRIMARY KEY, `nazwa` TEXT NOT NULL, `updated_at` TEXT, `source` TEXT
* Klucze/ograniczenia: kod_importu TEXT PRIMARY KEY
* Indeksy w `sqlite_master`: sqlite_autoindex_nazwa_pamiec_1

### `waga_pamiec` — 4 kolumn; 6821 wierszy

* Definicja żywej bazy: `schema.sql:299`.
* Kolumny: `kod` TEXT PRIMARY KEY, `waga` REAL NOT NULL, `updated_at` TEXT, `source` TEXT
* Klucze/ograniczenia: kod TEXT PRIMARY KEY
* Indeksy w `sqlite_master`: sqlite_autoindex_waga_pamiec_1

## DRYF schematu

| Obiekt obecny w żywej bazie | Tworzenie przez moduły runtime | Potwierdzone użycie | Wniosek |
|---|---|---|---|
| `atrybuty_wartosci_pending` | Nie znaleziono `CREATE TABLE` w `pending_module.cjs`; moduł wykonuje INSERT/SELECT/UPDATE/DELETE (`/home/admin/private_apps/bridge/pending_module.cjs:111-129`, `222-384`). | `/home/admin/private_apps/bridge/pending_module.cjs:111-129`, `222-384` | Dryf: czysta instalacja oparta wyłącznie na aktualnym kodzie nie tworzy tej tabeli. |
| `atrybuty_wartosci_odrzucone` | Nie znaleziono `CREATE TABLE` w kodzie runtime; `atrybuty_module` tworzy tylko dwa podstawowe obiekty (`/home/admin/private_apps/bridge/atrybuty_module.cjs:39-61`). | `/home/admin/private_apps/bridge/pending_module.cjs:111`, `352` | Dryf. |
| `selly_kategoria_norm_map` | Nie znaleziono `CREATE TABLE` w plikach runtime; tabela jest w żywym `schema.sql:279-284`. | `/home/admin/private_apps/bridge/selly/mapper.cjs:115-120` | Dryf. |
| `selly_zastosowanie_category_map` | Nie znaleziono `CREATE TABLE` w plikach runtime; tabela jest w żywym `schema.sql:285-291`. | `/home/admin/private_apps/bridge/selly/mapper.cjs:137-168` | Dryf. |
| `products.kod_importu` | Nie ma w `CREATE TABLE products` rdzenia (`/tmp/bridge_be/be.cjs:44158-44220`) ani w pętli `ALTER` (`44367-44392`). | `/home/admin/private_apps/bridge/bridge_ext.cjs:147-169`; indeks `schema.sql:292` | Dryf kolumny. |
| `products.zastosowanie` | Nie ma w `CREATE TABLE products` rdzenia (`/tmp/bridge_be/be.cjs:44158-44220`) ani w pętli `ALTER` (`44367-44392`). | `/tmp/bridge_be/be.cjs:44125`; `/home/admin/private_apps/bridge/selly/mapper.cjs:105-168` | Dryf kolumny. |

Uwaga: `link_pamiec_kod`, `link_pamiec_mr`, `nazwa_pamiec` i `waga_pamiec` **nie są dryfem** — tworzy je `bridge_ext.cjs` (`/home/admin/private_apps/bridge/bridge_ext.cjs:124-125`, `182`, `211`).