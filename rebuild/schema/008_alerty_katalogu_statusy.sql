-- 008_alerty_katalogu_statusy.sql — Iteracja 6, karta P6.2 (ticket 77-FEATURE-pseudo-alerty-katalogowe)
--
-- Status obsługi PSEUDO-ALERTÓW KATALOGOWYCH (marża ujemna / bardzo niska marża / nie-opona /
-- brak importu cennika). Same alerty NIE są tu zapisywane — przeglądarka liczy je na żywo
-- z `GET /api/products`, jak oryginał (`pv()` w żywym bundlu na `origin/main`). Tabela trzyma
-- wyłącznie to, co Ania z nimi zrobiła.
--
-- ⚠ ŚWIADOME ODSTĘPSTWO OD PRODUKCJI (decyzja 2 użytkownika z 2026-09-21, backlog #26).
-- Oryginał trzyma statusy w IndexedDB przeglądarki (klucz `alerty-statusy`), więc giną po
-- wyczyszczeniu historii i nie przechodzą między komputerami — ten sam powód, dla którego
-- alerty importu dostały status w bazie (D1 z I6). Produkcja tej tabeli NIE MA; na cutoverze
-- migracja ją po prostu utworzy (pusta = wszystkie pseudo-alerty „nowy", czyli dokładnie to,
-- co zobaczy Ania na świeżej przeglądarce w produkcji).
--
-- KLUCZ `id` to identyfikator alertu Z ODCISKIEM WARTOŚCI, dosłownie taki, jak liczy front
-- (łatka `ackalerts` pkt 1 z 04.09): `123-marza-ujemna--2.5`, `123-nie-opona-DĘTKA 8.3-24|Dętki`,
-- `dostawca-MO1-brak-importu-12`. Zmiana wartości daje nowy `id`, więc alert wraca jako „nowy".
--
-- `klucz` = ten sam identyfikator BEZ odcisku (`123-marza-ujemna`, `dostawca-MO1-brak-importu`).
-- Służy do SPRZĄTANIA (decyzja Q2 karty): zapis statusu kasuje wpisy tej samej pary
-- (produkt/dostawca, reguła) z innym odciskiem, więc tabela nie rośnie z każdą zmianą marży.
-- `produkt_id` pozwala skasować wpisy produktów, których nie ma już w katalogu (NULL = dostawca).
--
-- Statusu `nowy` się NIE zapisuje: brak wiersza = „nowy" (jak `t[o] || "nowy"` w `pv()`),
-- stąd `CHECK` dopuszcza tylko dwa pozostałe.
--
-- „Kto" — ta sama para kolumn co w `audit_log` (`uzytkownik_id`, `uzytkownik_imie`).
--
-- Idempotentna: `IF NOT EXISTS` przy tabeli i indeksie.

CREATE TABLE IF NOT EXISTS alerty_katalogu_statusy (
  id TEXT PRIMARY KEY NOT NULL,
  klucz TEXT NOT NULL,
  produkt_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('przejrzany', 'rozwiazany')),
  uzytkownik_id INTEGER,
  uzytkownik_imie TEXT,
  kiedy TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerty_katalogu_statusy_klucz
  ON alerty_katalogu_statusy (klucz);
