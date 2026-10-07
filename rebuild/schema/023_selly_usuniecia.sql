-- Ticket 195 (195-FEATURE-selly-historia-usuniec): zbiorcza historia pozycji usuniętych z Selly (Tor 3).
--
-- ⚠ NOWA TABELA, NIE ODTWORZENIE PRODUKCJI — produkcja nie usuwała nic z Selly (backlog #100), więc nie ma tej tabeli.
-- Jeden wiersz na każdą usuniętą pozycję, bez limitu długości (w odróżnieniu od `selly_sync_log.szczegoly_json`,
-- przycinanego do 8000 znaków). Zapisuje ją `usunSierotyZSelly` (`src/selly/rest/sync-usuwanie.ts`) obok wpisu w `audit_log`.
--
--   usunieto_at  — moment decyzji, UTC `YYYY-MM-DD HH:MM:SS` (jak `datetime('now')` w bazie)
--   przebieg_id  — `selly_sync_log.id` przebiegu, który usunął pozycję (zbiorcze grupowanie)
--   akcja        — usunieto_wariant | usunieto_produkt | juz_nie_istnial
--
-- Idempotentna (`IF NOT EXISTS`) — na istniejącej bazie powstaje pusta tabela, bez kroków ręcznych przy wdrożeniu.
CREATE TABLE IF NOT EXISTS selly_usuniecia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usunieto_at TEXT NOT NULL,
  przebieg_id INTEGER,
  kod TEXT NOT NULL,
  nazwa TEXT,
  ean TEXT,
  dostawca TEXT NOT NULL,
  kod_importu TEXT NOT NULL,
  selly_product_id INTEGER NOT NULL,
  selly_variant_id INTEGER,
  akcja TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_selly_usuniecia_at ON selly_usuniecia(usunieto_at);
CREATE INDEX IF NOT EXISTS idx_selly_usuniecia_przebieg ON selly_usuniecia(przebieg_id);
