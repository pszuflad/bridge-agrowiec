-- Ticket 219 (219-FEATURE-partnerzy-logi, PRT-4.2): logi operacji modułu partnerów.
--
-- ⚠ NOWE TABELE, NIE ODTWORZENIE PRODUKCJI; powstają puste, bez kroków ręcznych.
--   partner_logi      — JEDNA linia na operację (np. „wygenerowano plik, 3000 pozycji”)
--   partner_error_log — szczegóły błędów i ostrzeżeń (błąd kalkulacji pozycji, awaria NBP, pusty plik…), `poziom` = blad | ostrzezenie
-- Retencja 30 dni: czyści ją `wyczyscLogi` (src/partnerzy/logi.ts) przy każdym zapisie wyniku generowania.
CREATE TABLE IF NOT EXISTS partner_logi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  kiedy TEXT NOT NULL,
  operacja TEXT NOT NULL,
  opis TEXT NOT NULL,
  liczba_pozycji INTEGER
);

CREATE TABLE IF NOT EXISTS partner_error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  kiedy TEXT NOT NULL,
  operacja TEXT NOT NULL,
  poziom TEXT NOT NULL DEFAULT 'blad',
  komunikat TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_logi_partner ON partner_logi(partner_id, kiedy);
CREATE INDEX IF NOT EXISTS idx_partner_error_log_partner ON partner_error_log(partner_id, kiedy);
