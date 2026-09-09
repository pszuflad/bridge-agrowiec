-- 004_kategoria_wielka_litera.sql — Iteracja 13c (ticket 44-CHORE-i13c-migracje-konwencji)
--
-- Backlog #2 (`kategoriafix`, 2026-08-18) + #57 (`katunify`, 2026-09-01), część MIGRACYJNA:
-- historyczne `products.kategoria` z małej litery → forma kanoniczna z Wielkiej.
--
-- ⭐ DLACZEGO TA MIGRACJA POWSTAJE DOPIERO TERAZ. Backlog #2 zamknięto w I3/3a **portem**
-- (`capitalizeKategoria()` w `adapter.recordToSurowe()`), czyli naprawą U ŹRÓDŁA — nowe importy
-- od tamtej pory wchodzą z Wielką literą. Rekordów, które w bazie SIEDZIAŁY już wcześniej,
-- port nie dotyka. Produkcja domknęła to osobno, skryptem `mirror/backend/apply_kategoria.cjs`
-- (537 rekordów), którego odbudowa nie miała odpowiednika. Pomiar na `db/snapshot.db`
-- (2026-08-13, 7405 produktów) pokazuje dokładnie ten dług:
--     Rolnicze 4199 · Ciężarowe 1357 · Przemysłowe 1105 · Leśne 207
--     rolnicze 334 · ciężarowe 106 · przemysłowe 90 · leśne 7      ← 537 do migracji
-- Weryfikacja produkcji po `katunify` (CHANGELOG 2026-09-01 10:35) potwierdza stan docelowy:
-- „products.kategoria w bazie 100% Wielkie (Rolnicze 4533, Ciężarowe 1463, Przemysłowe 1195,
-- Leśne 214)".
--
-- MAPA = UNIA DWÓCH MAP PRODUKCJI, bo obie są cząstkowe:
--  1. `KATEGORIA_CANONICAL_MAP` (`src/import/legacy/common.cjs:592-599`) — warianty z polskimi
--     znakami i bez, w tym `Dętki`/`Akcesoria`, których `apply_kategoria.cjs` nie zna;
--  2. `apply_kategoria.cjs:12` — `'rolnicze małe'` → `'Rolnicze małe'`, którego z kolei NIE ZNA
--     warstwa parserów. To jest znalezisko 13a (`42-CHORE-i13a-resync-parserow`): `katunify`
--     NIE unifikuje `'rolnicze małe'` — w parserach zostaje z małej litery (MO2, 3 rek.),
--     Wielką nadaje dopiero ten skrypt, spoza potoku importu.
--
-- ⚠ WARTOŚCI SPOZA MAPY ZOSTAJĄ NIETKNIĘTE — tak samo jak `KATEGORIA_CANONICAL_MAP[key] || value`
-- w `capitalizeKategoria()` i tak samo jak `apply_kategoria.cjs`, który nieznane loguje jako
-- `unmapped` i pomija. Dotyczy to m.in. `'Przyczepy'` z zasiewu bramek.
--
-- ⚠ IDEMPOTENCJA. Cutover idzie na TEJ SAMEJ `data.db`, którą Ania już zmigrowała — tam ta
-- migracja musi być no-opem. Jest, z dwóch powodów naraz: klucz liczony jest z
-- `LOWER(TRIM(kategoria))`, więc forma docelowa (`'Rolnicze'` → klucz `'rolnicze'`) mapuje się
-- na samą siebie, a dodatkowy warunek `kategoria <> <forma docelowa>` odcina zapis wiersza,
-- który już jest poprawny. Powtórne wykonanie tego pliku zmienia 0 wierszy — pilnuje tego
-- `test/db.migracje.test.ts`.
--
-- ⚠ `LOWER()` w SQLite jest ASCII-only, a `capitalizeKategoria()` używa JS-owego
-- `toLowerCase()`, który zna Unicode. Rozjazd dotyczy WYŁĄCZNIE form z WIELKIMI polskimi
-- znakami (`'CIĘŻAROWE'` → klucz `'ciĘŻarowe'`, poza mapą, wiersz nietknięty). Takich form
-- w danych nie ma — zmierzone na `db/snapshot.db`, osiem wariantów wypisanych wyżej to
-- komplet. Nie dokładamy ich do mapy, bo byłoby to zgadywanie, a nie odtwarzanie.
--
-- Wpisów w `history` NIE dokładamy, choć robił to `apply_kategoria.cjs`. Migracja jest
-- zdarzeniem deployu, nie edycją użytkownika — nie ma autora ani zegara, więc wpisywałaby
-- do dziennika audytowego zmyśloną datę i cudze nazwisko. Stan `products` jest identyczny.

UPDATE products
   SET kategoria = CASE LOWER(TRIM(kategoria))
                     WHEN 'rolnicze'      THEN 'Rolnicze'
                     WHEN 'rolnicze małe' THEN 'Rolnicze małe'
                     WHEN 'rolnicze male' THEN 'Rolnicze małe'
                     WHEN 'przemysłowe'   THEN 'Przemysłowe'
                     WHEN 'przemyslowe'   THEN 'Przemysłowe'
                     WHEN 'ciężarowe'     THEN 'Ciężarowe'
                     WHEN 'ciezarowe'     THEN 'Ciężarowe'
                     WHEN 'leśne'         THEN 'Leśne'
                     WHEN 'lesne'         THEN 'Leśne'
                     WHEN 'dętki'         THEN 'Dętki'
                     WHEN 'detki'         THEN 'Dętki'
                     WHEN 'akcesoria'     THEN 'Akcesoria'
                   END
 WHERE kategoria IS NOT NULL
   AND LOWER(TRIM(kategoria)) IN (
         'rolnicze', 'rolnicze małe', 'rolnicze male',
         'przemysłowe', 'przemyslowe',
         'ciężarowe', 'ciezarowe',
         'leśne', 'lesne',
         'dętki', 'detki',
         'akcesoria'
       )
   AND kategoria <> CASE LOWER(TRIM(kategoria))
                      WHEN 'rolnicze'      THEN 'Rolnicze'
                      WHEN 'rolnicze małe' THEN 'Rolnicze małe'
                      WHEN 'rolnicze male' THEN 'Rolnicze małe'
                      WHEN 'przemysłowe'   THEN 'Przemysłowe'
                      WHEN 'przemyslowe'   THEN 'Przemysłowe'
                      WHEN 'ciężarowe'     THEN 'Ciężarowe'
                      WHEN 'ciezarowe'     THEN 'Ciężarowe'
                      WHEN 'leśne'         THEN 'Leśne'
                      WHEN 'lesne'         THEN 'Leśne'
                      WHEN 'dętki'         THEN 'Dętki'
                      WHEN 'detki'         THEN 'Dętki'
                      WHEN 'akcesoria'     THEN 'Akcesoria'
                    END;
