-- 018_scalone_karty_auto.sql — ticket 177 (Etap 1 SPEC „Naprawa kolejki stagingu”, 2026-10-01)
--
-- ⚠ NOWA LOGIKA, NIE ODTWORZENIE PRODUKCJI. Archiwa dla jednorazowego scalenia zdublowanych kart
-- `MO*_AUTO_<hash>` z kartami o prawdziwym kodzie dostawcy (`src/import/migracje/scal-karty-auto.ts`).
--
-- products_scalone — pełny wiersz usuniętej karty AUTO (JSON: produkt + jego ręczne poprawki),
--   żeby scalenie dało się odtworzyć i nic nie ginęło bezpowrotnie.
-- selly_products_scalone — wiersz mapowania Selly karty AUTO, gdy obie karty były w sklepie.
--   Produkt i wariant w Selly NIE są usuwane; wariant ma dostać stan 0 (`wyzerowano_at` puste =
--   jeszcze do zrobienia, robi to `--zeruj-selly`).
CREATE TABLE IF NOT EXISTS products_scalone (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod TEXT NOT NULL,
  dostawca TEXT NOT NULL,
  scalono_do TEXT NOT NULL,
  scalono_at TEXT NOT NULL,
  wiersz_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_scalone_kod ON products_scalone(kod);

CREATE TABLE IF NOT EXISTS selly_products_scalone (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod_importu TEXT NOT NULL,
  dostawca TEXT NOT NULL,
  bridge_kod TEXT NOT NULL,
  selly_product_id INTEGER NOT NULL,
  selly_variant_id INTEGER,
  scalono_do TEXT NOT NULL,
  scalono_at TEXT NOT NULL,
  wyzerowano_at TEXT,
  ostatni_blad TEXT
);
