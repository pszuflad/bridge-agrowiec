-- Tabela normalizujaca WSZYSTKIE realne warianty pisowni products.kategoria
-- znalezione w bazie na 2026-07-10 do (kategoria_glowna_norm, category_id_glowna).
-- Uzywana przez mapper, zeby "rolnicze", "rolnicze małe" itd. trafialy na ten sam wpis
-- w selly_zastosowanie_category_map (ktora jest keyed na kategoria_glowna_norm).

CREATE TABLE IF NOT EXISTS selly_kategoria_norm_map (
  kategoria_raw TEXT NOT NULL,
  kategoria_glowna_norm TEXT NOT NULL,
  category_id_glowna INTEGER NOT NULL,
  UNIQUE(kategoria_raw)
);

DELETE FROM selly_kategoria_norm_map;

INSERT INTO selly_kategoria_norm_map (kategoria_raw, kategoria_glowna_norm, category_id_glowna) VALUES
  ('rolnicze', 'rolnicze', 1),
  ('rolnicze małe', 'rolnicze', 1),
  ('przemyslowe', 'przemyslowe', 137),
  ('przemysłowe', 'przemyslowe', 137),
  ('Przemysłowe', 'przemyslowe', 137),
  ('ciezarowe', 'ciezarowe', 259),
  ('ciężarowe', 'ciezarowe', 259),
  ('leśne', 'lesne', 377);
