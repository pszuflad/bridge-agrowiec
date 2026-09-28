-- Tabela mapujaca PARE (kategoria_glowna_norm, zastosowanie) na category_id w Selly.
-- Klucz to PARA, bo ta sama wartosc zastosowania (np. "Ładowarka", "Uniwersalne")
-- ma INNE category_id w zaleznosci od kategorii glownej produktu (Rolnicze vs Przemyslowe itd.)
-- category_id_zastosowanie = NULL gdy wartosc to "(ogólne)" lub "Uniwersalne" bez dedykowanej
-- podkategorii -> produkt idzie tylko do kategorii glownej (category_id_glowna), NIGDY do
-- podkategorii o nazwie "ogólne" (taka nie istnieje i nie ma istnieć w Selly).
-- kategoria_glowna_norm = products.kategoria znormalizowane (lowercase, bez polskich znakow),
-- pokrywa WSZYSTKIE realne warianty pisowni znalezione w bazie na dzien 2026-07-10:
--   rolnicze, rolnicze malle -> rolnicze
--   przemyslowe, przemysłowe, Przemysłowe -> przemyslowe
--   ciezarowe, ciężarowe -> ciezarowe
--   leśne -> lesne

CREATE TABLE IF NOT EXISTS selly_zastosowanie_category_map (
  zastosowanie TEXT NOT NULL,
  kategoria_glowna_norm TEXT NOT NULL,
  category_id_glowna INTEGER NOT NULL,
  category_id_zastosowanie INTEGER,
  utworzony TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(zastosowanie, kategoria_glowna_norm)
);

DELETE FROM selly_zastosowanie_category_map;

-- ROLNICZE (category_id_glowna = 1)
INSERT INTO selly_zastosowanie_category_map (zastosowanie, kategoria_glowna_norm, category_id_glowna, category_id_zastosowanie) VALUES
  ('Ciągnik', 'rolnicze', 1, 26),
  ('Kombajn', 'rolnicze', 1, 58),
  ('Opryskiwacz', 'rolnicze', 1, 66),
  ('Przyczepa', 'rolnicze', 1, 2),
  ('Przyczepa / Flotacja', 'rolnicze', 1, 2),
  ('Kosiarka', 'rolnicze', 1, 76),
  ('Ładowarka rolnicza', 'rolnicze', 1, 43),
  ('Implement rolniczy', 'rolnicze', 1, 88),
  ('Rolnicze (ogólne)', 'rolnicze', 1, NULL),
  ('Uniwersalne', 'rolnicze', 1, NULL);

-- PRZEMYSŁOWE (category_id_glowna = 137)
INSERT INTO selly_zastosowanie_category_map (zastosowanie, kategoria_glowna_norm, category_id_glowna, category_id_zastosowanie) VALUES
  ('Ładowarka', 'przemyslowe', 137, 138),
  ('Ładowarka kołowa', 'przemyslowe', 137, 138),
  ('Koparka', 'przemyslowe', 137, 163),
  ('Kompaktor/walec', 'przemyslowe', 137, 189),
  ('Suwnice/dźwig', 'przemyslowe', 137, 186),
  ('Maszyny górnicze/kamieniołomy', 'przemyslowe', 137, 152),
  ('Maszyny górnicze/kamieniołomy (OTR)', 'przemyslowe', 137, 152),
  ('Wózek widłowy', 'przemyslowe', 137, 176),
  ('Uniwersalne przemysłowe', 'przemyslowe', 137, 195),
  ('Przemysłowe (ogólne)', 'przemyslowe', 137, NULL),
  ('Uniwersalne', 'przemyslowe', 137, NULL);

-- CIĘŻAROWE (category_id_glowna = 259)
INSERT INTO selly_zastosowanie_category_map (zastosowanie, kategoria_glowna_norm, category_id_glowna, category_id_zastosowanie) VALUES
  ('Oś kierowana', 'ciezarowe', 259, 301),
  ('Oś napędowa', 'ciezarowe', 259, 279),
  ('Naczepa', 'ciezarowe', 259, 323),
  ('Ciężarowe (ogólne)', 'ciezarowe', 259, NULL),
  ('Uniwersalne', 'ciezarowe', 259, NULL);

-- LEŚNE (category_id_glowna = 377)
INSERT INTO selly_zastosowanie_category_map (zastosowanie, kategoria_glowna_norm, category_id_glowna, category_id_zastosowanie) VALUES
  ('Ciągnik leśny', 'lesne', 377, 381),
  ('Harwester', 'lesne', 377, 384),
  ('Forwarder', 'lesne', 377, 378),
  ('Skidder', 'lesne', 377, 387),
  ('Przyczepa leśna', 'lesne', 377, 391),
  ('Uniwersalne leśne', 'lesne', 377, 391),
  ('Leśne (ogólne)', 'lesne', 377, NULL),
  ('Uniwersalne', 'lesne', 377, NULL);
