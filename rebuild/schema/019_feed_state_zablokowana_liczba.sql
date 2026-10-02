-- 019_feed_state_zablokowana_liczba.sql — ticket 179 (Etap 4b SPEC „Naprawa kolejki stagingu”, 2026-10-01)
--
-- ⚠ NOWA LOGIKA, NIE ODTWORZENIE PRODUKCJI. Produkcyjny próg „cennik podejrzanie mały” liczył 80% HISTORYCZNEGO
-- maksimum (`max_item_count`, które nigdy nie malało), więc dostawca, który legalnie wycofał produkty, był
-- blokowany na stałe (MO4: max 311, dziś 243–244 przy minimum 249). Od tej migracji próg liczy się od ostatniego
-- UDANEGO importu (`last_item_count`), a ręczne „zaakceptuj mniejszy cennik” potrzebuje liczby z ostatniej
-- zablokowanej próby — stąd osobna tabela. (Kolumna w `supplier_feed_state` odpada: migracja 012 pilnuje, że jej
-- DDL jest znak w znak taki jak w produkcji — `test/db.migracja-012.test.ts`.)
CREATE TABLE IF NOT EXISTS supplier_feed_blocked (
  supplier TEXT PRIMARY KEY,
  item_count INTEGER NOT NULL,
  blocked_at TEXT NOT NULL
);

-- Jednorazowy reset progu: `max_item_count = last_item_count` dla dostawców z policzoną ofertą (migracja jest
-- zapisana w `_migracje`, więc wykona się raz na bazę — test i produkcja).
UPDATE supplier_feed_state SET max_item_count = last_item_count WHERE last_item_count > 0;
