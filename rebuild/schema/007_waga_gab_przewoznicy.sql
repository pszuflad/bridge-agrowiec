-- 007_waga_gab_przewoznicy.sql — karta P9.1 (ticket 76-FEATURE-przewoznicy-serwer-paletowy)
--
-- Backlog #27. ⚠ ODSTĘPSTWO ŚWIADOME od produkcji, zatwierdzone przez Anię (2026-09-18/21):
-- lista przewoźników i dzielników wagi WOLUMETRYCZNEJ (widok `/waga-gabarytowa`) przenosi się
-- z IndexedDB przeglądarki (`deminified/frontend-index.js:9165-9193`, baza `bridge-store-v2`)
-- na serwer i jest wspólna dla wszystkich zalogowanych. Produkcja takiej tabeli NIE MA.
--
-- To NIE są ustawienia kalkulatora paletowego — te zostają w `config` pod `waga_gab.*`.
-- Tabela zamiast klucza w `config`, bo `GET /api/config` oddaje całą tabelę bez maskowania
-- (lista JSON wyciekłaby do zakładki Konfiguracja i rozjechała fixture `GET_config.json`).
--
-- ⭐ SEED JEST DANYMI, NIE STRUKTURĄ — pierwszy taki przypadek w kanonie. Sześciu przewoźników
-- z oryginału (`:9169-9192`), w tej samej kolejności, GEIS jako domyślny; Ania potwierdziła
-- listę 2026-09-21 bez poprawek. Cutover uruchamia `npm run migrate` na żywej `data.db`
-- (`docs/cutover.md` §5), więc seed trafia do produkcji bez ręcznych kroków. Ta sama lista
-- żyje we froncie jako `PRZEWOZNICY_DOMYSLNI` (przycisk „Przywróć domyślne");
-- `test/waga-gabarytowa.przewoznicy.test.ts` pilnuje, że się nie rozjadą.
--
-- `kolejnosc` jest wewnętrzna — API oddaje listę jako tablicę w tej kolejności.
-- Idempotencja: `IF NOT EXISTS` + `INSERT OR IGNORE`, choć `_migracje` i tak puszcza plik raz.

CREATE TABLE IF NOT EXISTS waga_gab_przewoznicy (
  id TEXT PRIMARY KEY,
  nazwa TEXT NOT NULL,
  dzielnik REAL NOT NULL,
  kolejnosc INTEGER NOT NULL,
  domyslny INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO waga_gab_przewoznicy (id, nazwa, dzielnik, kolejnosc, domyslny) VALUES
  ('geis',   'GEIS Polska',   10000, 0, 1),
  ('dpd',    'DPD',            6000, 1, 0),
  ('gls',    'GLS',            4000, 2, 0),
  ('inpost', 'InPost Kurier',  5000, 3, 0),
  ('ups',    'UPS',            5000, 4, 0),
  ('dhl',    'DHL Parcel',     5000, 5, 0);
