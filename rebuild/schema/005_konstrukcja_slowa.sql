-- 005_konstrukcja_slowa.sql — Iteracja 13c (ticket 44-CHORE-i13c-migracje-konwencji)
--
-- Backlog #58 (`konstr`, 2026-09-01), część MIGRACYJNA: `products.konstrukcja` przestaje być
-- kodem jednoliterowym i staje się pełnym polskim słowem.
--
-- ŹRÓDŁO — `mirror/backend/CHANGELOG.md`, wpis 2026-09-01 11:35:
--     UPDATE products SET konstrukcja='Radialna'   WHERE 'R'            4390 rek.
--     UPDATE products SET konstrukcja='Diagonalna' WHERE 'D'/'L'/'B'    2958+46+11 = 3015 rek.
--     Suma 7405 → w bazie zostają DOKŁADNIE dwie wartości: Radialna 4390 + Diagonalna 3015.
-- Powód (Anna): „chce widzieć »Radialna«/»Diagonalna« w kolumnie i w eksporcie zamiast kodów".
-- `L` (46 rek., np. `17.5L-24` — `L` to część rozmiaru „Low Section Height", nie osobny typ)
-- i `B` (11 rek., Trelleborg AMPT / Nokian Ground Kare — bias-belted) → obie na `Diagonalna`,
-- zgodnie z dotychczasowym mapowaniem frontendu panelu.
--
-- ⭐ MIGRACJA = `normalizeKonstrukcja()` PRZYŁOŻONE DO ISTNIEJĄCYCH WIERSZY, nie węższa lista
-- z CHANGELOG-a. Tak każe roadmapa bloku 13c („migruj wg `KONSTRUKCJA_CANONICAL_MAP`"), i tak
-- jest bezpieczniej: kanoniczna mapa (`src/import/legacy/common.cjs:614-624`) jest tym samym
-- kodem, przez który od 13a przechodzi KAŻDY nowy import (`adapter.cjs:578`), więc baza
-- i potok importu mówią po migracji dokładnie tym samym słownikiem.
--     r / radialna / radial              → 'Radialna'
--     d / diagonalna / diagonal / l / b / '-'  → 'Diagonalna'
-- Klucz liczony jest — jak w `normalizeKonstrukcja` — z `LOWER(TRIM(value))`.
--
-- ⚠ WARTOŚCI SPOZA MAPY ZOSTAJĄ NIETKNIĘTE, dokładnie jak `MAP[key] || value` w oryginale.
-- Pomiar na `db/snapshot.db` (2026-08-13, stan sprzed migracji produkcji):
--     R 4389 · D 2957 · L 35 · B 11 · NULL 12 · X 1
-- `X` (1 rek.) i `NULL` (12 rek.) migracja pomija. Produkcja tych rekordów po 09-01 już nie
-- miała (7405 = 4390 + 3015) — Ania zdążyła je w międzyczasie uzupełnić backfillem, którego
-- decyzją 13f (`41-CHORE-i13f-decyzja-backfille`) NIE odtwarzamy. Zostawienie ich w spokoju
-- jest więc zgodne i z SQL-em produkcji, i z tamtą decyzją.
--
-- ⚠ IDEMPOTENCJA. Cutover idzie na bazie, którą Ania już zmigrowała — `'Radialna'` daje klucz
-- `'radialna'`, który mapa odwzorowuje na `'Radialna'`, więc warunek `konstrukcja <> <forma
-- docelowa>` odcina zapis. Powtórne wykonanie pliku zmienia 0 wierszy; pilnuje tego
-- `test/db.migracje.test.ts`.

UPDATE products
   SET konstrukcja = CASE LOWER(TRIM(konstrukcja))
                       WHEN 'r'          THEN 'Radialna'
                       WHEN 'radialna'   THEN 'Radialna'
                       WHEN 'radial'     THEN 'Radialna'
                       WHEN 'd'          THEN 'Diagonalna'
                       WHEN 'diagonalna' THEN 'Diagonalna'
                       WHEN 'diagonal'   THEN 'Diagonalna'
                       WHEN 'l'          THEN 'Diagonalna'
                       WHEN 'b'          THEN 'Diagonalna'
                       WHEN '-'          THEN 'Diagonalna'
                     END
 WHERE konstrukcja IS NOT NULL
   AND LOWER(TRIM(konstrukcja)) IN (
         'r', 'radialna', 'radial',
         'd', 'diagonalna', 'diagonal', 'l', 'b', '-'
       )
   AND konstrukcja <> CASE LOWER(TRIM(konstrukcja))
                        WHEN 'r'          THEN 'Radialna'
                        WHEN 'radialna'   THEN 'Radialna'
                        WHEN 'radial'     THEN 'Radialna'
                        WHEN 'd'          THEN 'Diagonalna'
                        WHEN 'diagonalna' THEN 'Diagonalna'
                        WHEN 'diagonal'   THEN 'Diagonalna'
                        WHEN 'l'          THEN 'Diagonalna'
                        WHEN 'b'          THEN 'Diagonalna'
                        WHEN '-'          THEN 'Diagonalna'
                      END;
