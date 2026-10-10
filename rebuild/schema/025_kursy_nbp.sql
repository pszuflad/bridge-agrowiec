-- Ticket 210 (210-FEATURE-partnerzy-kurs-nbp, PRT-2.1): ostatnie znane kursy EUR z NBP (tabela A).
--
-- ⚠ NOWA TABELA, NIE ODTWORZENIE PRODUKCJI. Jeden wiersz na datę tabeli NBP (`data` = dzień notowania, `YYYY-MM-DD`).
-- Służy jako rezerwa: gdy NBP nie odpowiada, moduł partnerów bierze ostatni zapisany kurs i ostrzega w logu.
-- Idempotentna (`IF NOT EXISTS`); na wdrożeniu powstaje pusta.
CREATE TABLE IF NOT EXISTS kursy_nbp (
  data TEXT PRIMARY KEY,
  kurs REAL NOT NULL,
  pobrano TEXT NOT NULL
);
