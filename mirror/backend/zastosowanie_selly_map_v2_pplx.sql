-- WERSJA 3: po przebudowie kategorii Selly 2026-09-11 wszystkie dawne
-- podkategorie zastosowań zostały usunięte i ich ID zwracają 404.
-- Do czasu ponownego utworzenia drzewa każde zastosowanie dziedziczy żywą
-- kategorię główną z products.kategoria przez selly_kategoria_norm_map.

DROP TABLE IF EXISTS selly_zastosowanie_category_map;

CREATE TABLE selly_zastosowanie_category_map (
  zastosowanie TEXT NOT NULL UNIQUE,
  category_id_glowna INTEGER,
  category_id_zastosowanie INTEGER,
  dziedziczy_kategorie_produktu INTEGER NOT NULL DEFAULT 0,
  utworzony TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Wszystkie znane wartości zastosowania bez martwych ID podkategorii.
INSERT INTO selly_zastosowanie_category_map (zastosowanie, category_id_glowna, category_id_zastosowanie, dziedziczy_kategorie_produktu) VALUES
  ('Ciągnik', NULL, NULL, 1),
  ('Kombajn', NULL, NULL, 1),
  ('Opryskiwacz', NULL, NULL, 1),
  ('Przyczepa', NULL, NULL, 1),
  ('Przyczepa / Flotacja', NULL, NULL, 1),
  ('Kosiarka', NULL, NULL, 1),
  ('Ładowarka rolnicza', NULL, NULL, 1),
  ('Implement rolniczy', NULL, NULL, 1),
  ('Ładowarka', NULL, NULL, 1),
  ('Ładowarka kołowa', NULL, NULL, 1),
  ('Koparka', NULL, NULL, 1),
  ('Kompaktor/walec', NULL, NULL, 1),
  ('Suwnice/dźwig', NULL, NULL, 1),
  ('Maszyny górnicze/kamieniołomy', NULL, NULL, 1),
  ('Maszyny górnicze/kamieniołomy (OTR)', NULL, NULL, 1),
  ('Wózek widłowy', NULL, NULL, 1),
  ('Uniwersalne przemysłowe', NULL, NULL, 1),
  ('Oś kierowana', NULL, NULL, 1),
  ('Oś napędowa', NULL, NULL, 1),
  ('Naczepa', NULL, NULL, 1),
  ('Ciągnik leśny', NULL, NULL, 1),
  ('Harwester', NULL, NULL, 1),
  ('Forwarder', NULL, NULL, 1),
  ('Skidder', NULL, NULL, 1),
  ('Przyczepa leśna', NULL, NULL, 1),
  ('Uniwersalne leśne', NULL, NULL, 1),
  ('Rolnicze (ogólne)', NULL, NULL, 1),
  ('Przemysłowe (ogólne)', NULL, NULL, 1),
  ('Ciężarowe (ogólne)', NULL, NULL, 1),
  ('Leśne (ogólne)', NULL, NULL, 1),
  ('Uniwersalne', NULL, NULL, 1);
