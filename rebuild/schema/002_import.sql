-- 002_import.sql — Iteracja 3b (ticket 5-FEATURE-staging-endpointy-importu)
--
-- Dwie kolumny spoza kanonu produkcji. Obie są ŚWIADOMYMI odstępstwami zatwierdzonymi
-- w plan.md (D5, D9) i obie są NIEWIDOCZNE w API — repozytoria wybierają kolumny jawną
-- projekcją kontraktową (src/repos/kolumny.ts), żeby zamrożony kształt odpowiedzi
-- `GET /api/products`, `/api/suppliers` i `/api/dostawcy` pozostał nietknięty.

-- D5 (backlog #7) — wycofanie dostawcy z importu.
-- Osobna kolumna, a NIE `suppliers.status`: produkcyjne endpointy importu po każdym udanym
-- przebiegu robią `updateSupplier({status:'aktywny'})` (extensions.cjs:155-160, :247-252),
-- więc `status` sam kasowałby się jako flaga i mieszał dwa znaczenia — stan zdrowia
-- dostawcy (przeliczany w locie, repos/suppliers.ts) z decyzją „importujemy czy nie".
ALTER TABLE suppliers ADD COLUMN import_wylaczony INTEGER NOT NULL DEFAULT 0;

-- D9 (backlog #4) — cena „na zapytanie" (MO7 Nokian, wielkoformatowe VF).
-- Tu dokładamy WYŁĄCZNIE kolumnę. Pisarz (`acceptStaging`, odczyt `uwagaCena` ze
-- `snapshot_json`) i `GET /api/products/uwagi-cena` należą do 3d — endpoint bez pisarza
-- zwracałby zawsze pustą listę. Wartość już dziś dociera do stagingu w `snapshot_json`,
-- bo parsery z 3a propagują pole `uwagaCena`.
ALTER TABLE products ADD COLUMN uwaga_cena TEXT;

-- MO6 Agrowiec / Uniglory — decyzja produkcji z 2026-08-26 (backlog #7 ✅ TAK).
-- W katalogu nie ma ani jednego produktu MO6, więc nie ma czego migrować ani kasować.
-- Parser `mo6_agrowiec.cjs` ZOSTAJE w porcie (kopia bajt-w-bajt, test sha256) — po prostu
-- przestaje być wołany.
UPDATE suppliers SET import_wylaczony = 1 WHERE kod = 'MO6';
