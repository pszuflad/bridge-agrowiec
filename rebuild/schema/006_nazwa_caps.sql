-- 006_nazwa_caps.sql — Iteracja 13c (ticket 44-CHORE-i13c-migracje-konwencji)
--
-- Backlog #59 (`CAPS`, 2026-09-01), część MIGRACYJNA. Część silnikowa (`wartosciRowne`/`Xq`
-- case-insensitive) weszła w 13b (`43-CHORE-i13b-silnik-p3-caps`) — ten plik domyka wpis.
--
-- ŹRÓDŁO — `mirror/backend/CHANGELOG.md`, wpis 2026-09-01 12:30, trzy operacje na `data.db`:
--     UPDATE products SET nazwa=UPPER(nazwa)                                    747 rek.
--     UPDATE manual_overrides SET override_value=UPPER(override_value)
--       WHERE field_name='nazwa'                                                 38 rek.
--     DELETE FROM staging_items ... typ_zmiany='zmiana_kluczowa'
--       AND powod LIKE 'nazwa:%' AND UPPER(A)=UPPER(B)                          769 rek.
-- Powód (Anna): staging miał nadmiar pozycji do akceptacji, głównie przez różnicę wielkości
-- liter w polu `nazwa` (plik CAPS vs baza mieszana). Konwencja globalna: nazwy w katalogu
-- wyłącznie DUŻYMI literami.
--
-- ⭐ TO JEST TA MIGRACJA, KTÓRA REALNIE WYCISZA SZUM — nie kod silnika. Rozjazd
-- CHANGELOG↔kod zmierzony w 13b: klasyfikacja `zmiana_kluczowa` (`tk.ts:429-440`, za oryginałem)
-- porównuje literalnie `String(vS) !== String(vN)`, BEZ `wartosciRowne`/`Xq`. Case-only różnica
-- w polu klucza NADAL generuje `zmiana_kluczowa` w produkcji, wbrew narracji CHANGELOG-a.
-- `Xq` wpływa tylko na narrację `powod` i na auto-patch pięciu pól cenowo-magazynowych.
-- Szum znika dopiero tutaj: gdy nazwy w bazie są WIELKIE, plik CAPS przestaje się od nich
-- różnić, a historyczne wiersze CASE_ONLY zostają skasowane.
--
-- ⚠ `UPPER()` SQLite JEST ASCII-ONLY — `ę` zostaje `ę`, `Ą` nie powstaje. Produkcja użyła
-- dosłownie `UPPER(nazwa)` w SQLite, więc ma ten sam efekt; JS-owy `toLocaleUpperCase('pl-PL')`
-- dałby `Ę` i natychmiastowy rozjazd 1:1. Odtwarzamy zachowanie, nie ideał: 69 z 7405 nazw
-- w `db/snapshot.db` ma polskie znaki i po migracji zostaną w nich małe diakrytyki — dokładnie
-- jak w produkcji.
--
-- ⚠ IDEMPOTENCJA. `UPPER(UPPER(x)) = UPPER(x)`, a warunki `<> UPPER(...)` odcinają zapis
-- wiersza, który już jest WIELKI. `DELETE` jest idempotentny z natury (skasowanych wierszy
-- nie da się skasować drugi raz). Powtórne wykonanie pliku zmienia 0 wierszy — pilnuje tego
-- `test/db.migracje.test.ts`.

UPDATE products
   SET nazwa = UPPER(nazwa)
 WHERE nazwa <> UPPER(nazwa);

UPDATE manual_overrides
   SET override_value = UPPER(override_value)
 WHERE field_name = 'nazwa'
   AND override_value <> UPPER(override_value);

-- ——— Sprzątanie staging: wiersze CASE_ONLY ———
--
-- ⚠ `powod` JEST WIELOSEGMENTOWY, więc naiwne „wszystko po pierwszej strzałce = nowa wartość"
-- jest BŁĘDNE. `tk.ts:429` buduje segment jako `${label}: ${stara} → ${nowa}`, `tk.ts:515`
-- skleja segmenty przez ` • ` i DOKLEJA `ostrzezenie` jako segment bez strzałki. Pomiar na
-- `db/snapshot.db`: 193 z 1441 wierszy `powod LIKE 'nazwa:%'` ma więcej niż jedną strzałkę.
-- Przykład: „nazwa: … DEMO … → … • model: FUELMAX DEMO → FUELMAX • kod dostawcy: …X D3 → …D1".
--
-- Dlatego rozbijamy `powod` na segmenty rekurencyjnym CTE i kasujemy wiersz tylko wtedy, gdy
-- KAŻDY jego segment jest różnicą wyłącznie w wielkości liter. To jest dosłowna treść zadania
-- („różnica dotyczy WYŁĄCZNIE wielkości liter”) i reguła ściśle bezpieczna: wiersz niosący
-- realną zmianę w drugim polu albo `ostrzezenie` NIE zostanie skasowany.
--
-- Zmierzona równoważność z regułą produkcji: „segment `nazwa` jest case-only" daje na
-- snapshocie 739 wierszy, „każdy segment jest case-only" — również 739. Rozjazd = 0, więc
-- reguła ostrożniejsza nic nie kosztuje. (Naiwna R1 dawała 738 i gubiła wielosegmentowe.)
--
-- ⚠ TE 739 TO POMIAR RÓWNOWAŻNOŚCI REGUŁ, LICZONY W JS (`toUpperCase()`, Unicode-aware).
-- SAM `DELETE` kasuje na tym samym snapshocie **723 wiersze**, i to jest liczba właściwa.
-- Różnica 16 wierszy bierze się stąd, że `UPPER()` SQLite jest ASCII-only nie tylko
-- w `UPDATE … nazwa=UPPER(nazwa)` wyżej, ale RÓWNIEŻ w tym predykacie: dla
-- „prowadząca" vs „PROWADZĄCA" (id 710497 w snapshocie) `UPPER` zostawia małe `ą` po lewej
-- i duże `Ą` po prawej, więc wiersz nie jest uznany za case-only i ZOSTAJE — na zawsze,
-- bo ponowne uruchomienie też go nie złapie.
--
-- ⭐ TO NIE JEST BŁĄD DO NAPRAWY. Produkcja użyła dokładnie tego samego SQLite-owego `UPPER()`
-- w swoim `DELETE`, więc ma tę samą resztkę. Co więcej, tak MUSI być spójnie: skoro
-- `UPDATE nazwa=UPPER(nazwa)` zostawia w bazie „PROWADZąCA", to plik dostawcy z „PROWADZĄCA"
-- NADAL się od niej różni i wiersz `zmiana_kluczowa` jest tam zasadny. Przestawienie samego
-- predykatu na porównanie Unicode-aware skasowałoby wiersze, których produkcja nie skasowała,
-- i zgubiłoby realną (choć brzydką) różnicę. Nie „poprawiaj" tej liczby na 739 licząc
-- narzędziem znającym Unicode.
--
-- Warunek wejścia `powod LIKE 'nazwa:%'` jest za produkcją — wiersz, którego różnice zaczynają
-- się od innego pola, zostaje nietknięty nawet gdy jest case-only.

WITH RECURSIVE segmenty(id, ogon, segment) AS (
  -- Kotwica: ` • ` doklejone na końcu sprawia, że OSTATNI segment też ma terminator,
  -- więc pętla wypluwa wszystkie. Sam wiersz kotwiczący niesie pusty `segment` i odpada
  -- w `WHERE segment <> ''` niżej.
  SELECT id, powod || ' • ', ''
    FROM staging_items
   WHERE typ_zmiany = 'zmiana_kluczowa'
     AND powod LIKE 'nazwa:%'
  UNION ALL
  SELECT id,
         substr(ogon, instr(ogon, ' • ') + 3),
         substr(ogon, 1, instr(ogon, ' • ') - 1)
    FROM segmenty
   WHERE instr(ogon, ' • ') > 0
)
DELETE FROM staging_items
 WHERE id IN (
       SELECT id
         FROM segmenty
        WHERE segment <> ''
        GROUP BY id
       HAVING COUNT(*) = SUM(
                CASE
                  -- Segment ma kształt `etykieta: STARA → NOWA` i obie strony różnią się
                  -- wyłącznie wielkością liter.
                  --
                  -- ZAŁOŻENIE, wypisane wprost: pierwsze `: ` w segmencie należy do etykiety,
                  -- a pierwsze ` → ` do separatora wartości. Trzyma się, bo etykiety
                  -- z `POLA_ROZNIC` nie zawierają dwukropka, a wartości pól katalogu (nazwa,
                  -- marka, model, rozmiar, kod dostawcy, EAN) nie zawierają znaku „→".
                  -- Gdyby kiedyś zawierały, offsety by się rozjechały — ale wyłącznie
                  -- w kierunku BEZPIECZNYM: porównanie by nie wyszło i wiersz by ZOSTAŁ.
                  -- Nie da się tak doprowadzić do skasowania wiersza z realną zmianą.
                  WHEN instr(segment, ' → ') > 0
                   AND instr(segment, ': ') > 0
                   AND instr(segment, ': ') < instr(segment, ' → ')
                   AND UPPER(substr(segment,
                                    instr(segment, ': ') + 2,
                                    instr(segment, ' → ') - instr(segment, ': ') - 2))
                     = UPPER(substr(segment, instr(segment, ' → ') + 3))
                  THEN 1
                  ELSE 0
                END)
       );
