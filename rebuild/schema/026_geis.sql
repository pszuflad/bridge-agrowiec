-- Ticket 212 (212-FEATURE-partnerzy-transport-geis, PRT-2.2): tabele transportowe GEIS dla modułu partnerów.
--
-- ⚠ NOWE TABELE, NIE ODTWORZENIE PRODUKCJI. Dane (13 krajów) wgrywa się osobno z pliku JSON
-- (`npm run importuj-geis -- plik.json`); migracja tworzy tylko puste tabele.
--   geis_kraje  — parametry kraju: współczynnik wagi gabarytowej (200/250), koszt pakowania, maks. wymiary (cm)
--   geis_stawki — V1: stawka CAŁEGO KRAJU (kolumna 1 arkusza), per próg wagowy (kg); progi są per kraj
-- Opłata paliwowa NIE jest tu — to ręcznie wpisywana wartość z historią okresów (`paliwo_historia`, migracja 024).
CREATE TABLE IF NOT EXISTS geis_kraje (
  kraj TEXT PRIMARY KEY,
  wsp_gabarytowy REAL NOT NULL,
  koszt_pakowania REAL NOT NULL DEFAULT 0,
  maks_dlugosc REAL,
  maks_szerokosc REAL,
  maks_wysokosc REAL
);

CREATE TABLE IF NOT EXISTS geis_stawki (
  kraj TEXT NOT NULL REFERENCES geis_kraje(kraj) ON DELETE CASCADE,
  prog_kg REAL NOT NULL,
  stawka REAL NOT NULL,
  PRIMARY KEY (kraj, prog_kg)
);
