-- 017_ean_pary.sql — ticket 168-FEATURE-uzupelnianie-ean-999
--
-- ⚠ NOWA LOGIKA BIZNESOWA, NIE ODTWORZENIE PRODUKCJI. Produkcja nie ma tej tabeli (jedyny
-- pokrewny mechanizm to ręczny skrypt `mirror/backend/apply_ean_memory.cjs`). Decyzja
-- użytkownika, 2026-09-30.
--
-- Tabela par `kod` (products.kod) – EAN dla EAN-ów WYGENEROWANYCH przez regułę uzupełniania
-- pustych pól EAN (prefiks 999). Pełni trzy role:
--   • gwarancja unikalności: UNIQUE(ean) i UNIQUE(numer) — licznik rośnie, nie ma losowania;
--   • pamięć: po `POST /api/products/clear` i ponownym imporcie produkt dostaje z powrotem ten
--     sam EAN (kod → EAN), a EAN nigdy nie trafia drugi raz do innego produktu;
--   • tabela porównawcza dla API (kod → EAN, EAN → kod).
-- `status = 'zastapiony'`: produkt dostał później prawdziwy EAN z cennika; wiersz zostaje, żeby
-- numer nie wrócił do obiegu.
CREATE TABLE IF NOT EXISTS ean_pary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod TEXT NOT NULL UNIQUE,
  ean TEXT NOT NULL UNIQUE,
  numer INTEGER NOT NULL UNIQUE,
  dostawca TEXT,
  kod_dostawcy TEXT,
  status TEXT NOT NULL DEFAULT 'aktywny' CHECK (status IN ('aktywny', 'zastapiony')),
  utworzono TEXT NOT NULL,
  zastapiono TEXT,
  zastapiony_przez TEXT
);
