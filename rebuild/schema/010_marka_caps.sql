-- 010_marka_caps.sql — karta PR.5 (ticket 101-CHORE-migracja-marka-caps), backlog #92
--
-- Duplikaty marki różniące się WYŁĄCZNIE wielkością liter (Ania w przeglądzie 12 widoków:
-- „w filtrach marki w katalogu jest ALLIANCE i alliance"). Decyzja użytkownika 2026-09-22:
-- poprawka DANYCH, nie scalanie w filtrze. Konwencja katalogu = WIELKIE litery (Ania przy #42:
-- „katalog ma się zmieniać na drukowane litery").
--
-- ⚠ ŚWIADOME ODSTĘPSTWO OD PRODUKCJI — produkcja ma ten duplikat; to nie odtworzenie skryptu Ani.
--
-- POMIAR `db/snapshot.db` (2026-09-22): jedyna para to `ALLIANCE` (848 produktów) i `Alliance`
-- (1 — `MO1_71970103`, wartość sprzed 2026-09-01, gdy adapter zaczął robić `toUpperPL(marka)`).
-- Silnik porównuje pole klucza literalnie (`import/tk.ts`), więc sam tego nie naprawi — wisiałoby
-- w stagingu jako `zmiana_kluczowa`. Ten wiersz stagingu (id 711428) kasuje już `006`: każdy jego
-- segment (`nazwa` i `marka`) jest case-only. Słownik `marka` ma obie formy.
--
-- REGUŁA OGÓLNA, nie „Alliance" na sztywno: marka, której klucz (niżej) ma w `products` więcej niż
-- jedną formę, przechodzi na klucz. Grupa bez formy WIELKIEJ (`Bkt` + `bkt`) też kończy jako `BKT`.
-- Marka bez pary zostaje nietknięta, nawet pisana małymi literami — reguła celuje w duplikat,
-- nie w konwencję.
--
-- ⚠ `UPPER()` SQLITE JEST ASCII-ONLY (`UPPER('Poznań')` = `'POZNAń'`). Klucz sprowadza więc
-- najpierw 9 małych polskich liter do wielkich przez `replace()`, potem `UPPER()`. Dzięki temu
-- `Stomil Poznań` i `STOMIL POZNAŃ` trafiają do jednej grupy i wynik ma `Ń`, nie `ń`.
-- OGRANICZENIE: inne litery spoza ASCII (`é`, `ü`, …) nie są sprowadzane — para `Kléber`/`KLÉBER`
-- zostałaby pominięta (bezpiecznie: nic nie zepsuje, po prostu nie scali). Na snapshocie takich
-- marek nie ma; test na kopii snapshotu liczy pary narzędziem znającym Unicode i żąda zera.
--
-- SŁOWNIK (`atrybuty_wartosci`, rodzaj `marka`): kasujemy formę ≠ klucz, jeśli forma = klucz już
-- w nim jest. Nic nie odwołuje się do wierszy słownika po `id`.
--
-- NIE RUSZAMY: `manual_overrides` (pole `marka` ma na snapshocie wyłącznie formy WIELKIE),
-- `historia_cen.marka` (dziennik stanu w chwili rejestracji — 953 wiersze `Alliance` sprzed
-- 2026-07-21 zostają jako zapis historii).
--
-- ⚠ IDEMPOTENCJA TREŚCIOWA. Po przebiegu każda grupa ma jedną formę (= klucz), więc warunek
-- „>1 forma" nie trafia już w nic; słownik nie ma formy ≠ klucz obok kanonicznej. Drugie
-- wykonanie zmienia 0 wierszy — pilnuje tego `test/db.migracje.test.ts`.

-- Klucz liczony w CTE każdej instrukcji (bez tabeli pomocniczej) — wyrażenie jest w obu
-- instrukcjach IDENTYCZNE; zmieniając jedno, zmień drugie.
--
-- ⚠ Instrukcje czytają tabelę, którą same zmieniają. Bezpieczne, bo `WHERE … IN (SELECT …)`
-- jest podzapytaniem NIESKORELOWANYM — SQLite liczy je raz, przed pierwszym zapisem — a wiersz
-- dostaje wartość z `klucz` wyliczonego z jego WŁASNEJ (starej) marki, niezależnie od kolejności.
-- Test „grupa bez formy WIELKIEJ" (`Bkt` + `bkt` → oba `BKT`) pilnuje, że żaden wiersz grupy
-- nie wypada po zmianie poprzedniego. Kopiując ten wzorzec, nie zamieniaj `IN` na podzapytanie
-- skorelowane (np. `EXISTS` po `products`) — to byłoby liczone per wiersz na zmienianej tabeli.

WITH klucz AS (
       SELECT wartosc,
              UPPER(replace(replace(replace(replace(replace(replace(replace(replace(replace(wartosc,
                'ą', 'Ą'), 'ć', 'Ć'), 'ę', 'Ę'), 'ł', 'Ł'), 'ń', 'Ń'), 'ó', 'Ó'), 'ś', 'Ś'), 'ź', 'Ź'), 'ż', 'Ż')) AS klucz
         FROM (SELECT DISTINCT marka AS wartosc FROM products)
     ),
     grupy AS (
       SELECT klucz FROM klucz GROUP BY klucz HAVING COUNT(*) > 1
     )
UPDATE products
   SET marka = (SELECT k.klucz FROM klucz k WHERE k.wartosc = products.marka)
 WHERE marka IN (SELECT k.wartosc
                   FROM klucz k
                  WHERE k.wartosc <> k.klucz
                    AND k.klucz IN (SELECT klucz FROM grupy));

WITH klucz AS (
       SELECT wartosc,
              UPPER(replace(replace(replace(replace(replace(replace(replace(replace(replace(wartosc,
                'ą', 'Ą'), 'ć', 'Ć'), 'ę', 'Ę'), 'ł', 'Ł'), 'ń', 'Ń'), 'ó', 'Ó'), 'ś', 'Ś'), 'ź', 'Ź'), 'ż', 'Ż')) AS klucz
         FROM atrybuty_wartosci
        WHERE rodzaj = 'marka'
     )
DELETE FROM atrybuty_wartosci
 WHERE rodzaj = 'marka'
   AND wartosc IN (SELECT k.wartosc
                     FROM klucz k
                    WHERE k.wartosc <> k.klucz
                      AND k.klucz IN (SELECT wartosc FROM klucz));
