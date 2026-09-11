-- WERSJA 2: kazde KONKRETNE zastosowanie ma WLASNA, jednoznaczna kategorie glowna w Selly,
-- niezaleznie od products.kategoria (np. "Koparka" -> Przemyslowe, nawet jesli produkt
-- w bazie ma kategoria='rolnicze'). Ustalone z uzytkownikiem 2026-07-10.
-- Wyjatek: "(ogólne)" i "Uniwersalne" NIE MAJA wlasnej kategorii -> dziedzicza
-- category_id_glowna z products.kategoria (przez selly_kategoria_norm_map).

DROP TABLE IF EXISTS selly_zastosowanie_category_map;

CREATE TABLE selly_zastosowanie_category_map (
  zastosowanie TEXT NOT NULL UNIQUE,
  category_id_glowna INTEGER,
  category_id_zastosowanie INTEGER,
  dziedziczy_kategorie_produktu INTEGER NOT NULL DEFAULT 0,
  utworzony TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Wartosci z WLASNA jednoznaczna kategoria glowna + podkategoria
INSERT INTO selly_zastosowanie_category_map (zastosowanie, category_id_glowna, category_id_zastosowanie, dziedziczy_kategorie_produktu) VALUES
  ('Ciągnik', 1, 26, 0),
  ('Kombajn', 1, 58, 0),
  ('Opryskiwacz', 1, 66, 0),
  ('Przyczepa', 1, 2, 0),
  ('Przyczepa / Flotacja', 1, 2, 0),
  ('Kosiarka', 1, 76, 0),
  ('Ładowarka rolnicza', 1, 43, 0),
  ('Implement rolniczy', 1, 88, 0),

  ('Ładowarka', 137, 138, 0),
  ('Ładowarka kołowa', 137, 138, 0),
  ('Koparka', 137, 163, 0),
  ('Kompaktor/walec', 137, 189, 0),
  ('Suwnice/dźwig', 137, 186, 0),
  ('Maszyny górnicze/kamieniołomy', 137, 152, 0),
  ('Maszyny górnicze/kamieniołomy (OTR)', 137, 152, 0),
  ('Wózek widłowy', 137, 176, 0),
  ('Uniwersalne przemysłowe', 137, 195, 0),

  ('Oś kierowana', 259, 301, 0),
  ('Oś napędowa', 259, 279, 0),
  ('Naczepa', 259, 323, 0),

  ('Ciągnik leśny', 377, 381, 0),
  ('Harwester', 377, 384, 0),
  ('Forwarder', 377, 378, 0),
  ('Skidder', 377, 387, 0),
  ('Przyczepa leśna', 377, 391, 0),
  ('Uniwersalne leśne', 377, 391, 0);

-- Wartosci "(ogólne)" i "Uniwersalne" -> dziedzicza kategorie z products.kategoria,
-- category_id_glowna/category_id_zastosowanie tutaj NULL, bridge musi je dopelnic
-- w runtime z selly_kategoria_norm_map na podstawie products.kategoria danego produktu.
INSERT INTO selly_zastosowanie_category_map (zastosowanie, category_id_glowna, category_id_zastosowanie, dziedziczy_kategorie_produktu) VALUES
  ('Rolnicze (ogólne)', NULL, NULL, 1),
  ('Przemysłowe (ogólne)', NULL, NULL, 1),
  ('Ciężarowe (ogólne)', NULL, NULL, 1),
  ('Leśne (ogólne)', NULL, NULL, 1),
  ('Uniwersalne', NULL, NULL, 1);
