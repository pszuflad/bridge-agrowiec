-- 009_alerty_polskie_znaki.sql — karta PR.3 (ticket 92-CHORE-migracja-typow-alertow)
--
-- Naprawa polskich liter zamienionych na „?" w `alerts.typ` i `alerts.opis`. Ania zobaczyła
-- „B??d HTTP" w filtrze nowego panelu Alerty (przegląd 12 widoków); obietnica: „Poprawimy same
-- dane" (`docs/pytania-do-ani-2026-09-18.md`, sekcja 12).
--
-- ⭐ PRZYCZYNA SIEDZI W KODZIE PRODUKCJI, NIE W KODOWANIU ZAPISU. Znaki „?" są wpisane na sztywno
-- w literałach wysłanego bundla (`deminified/backend-index.cjs:48060, :48091, :48103, :48269,
-- :48270`). Dowód: nazwa dostawcy wklejana do tego samego `opis` („Handlopex Wrocław") ma
-- poprawne ogonki. Produkcja psuje więc KAŻDY nowy alert tych typów aż do cutoveru; odbudowa
-- pisze poprawne literały (`src/import/synchronizuj.ts`, `src/routes/suppliers.ts`). Ta
-- migracja, puszczona przy cutoverze, naprawia wszystko do dnia przełączenia — potem problem
-- nie wraca.
--
-- ⚠ TO JEST ŚWIADOME ODSTĘPSTWO OD PRODUKCJI (uzgodnione — karta PR.3), nie odtworzenie
-- jednorazowego skryptu Ani jak `004`–`006`.
--
-- SŁOWNIK — wyłącznie wartości, które kod (odbudowa i oryginał) faktycznie zapisuje. Każdy „?"
-- zastępuje DOKŁADNIE jedną literę, a każda zepsuta forma ma jednego kandydata identycznego
-- poza pozycjami „?". Pomiar na `db/snapshot.db` (2562 alerty, 2026-06-30…08-13):
--
--   alerts.typ   'B??d pobierania' → 'Błąd pobierania'                              339 wierszy
--   alerts.typ   'R?czny upload'   → 'Ręczny upload'                                 92
--   alerts.typ   'B??d HTTP'       → 'Błąd HTTP'                                      4
--   alerts.opis  ' produkt?w (nowe: ' + ', kluczowe/b??dy: '  (typ Synchronizacja) 2127
--   alerts.opis  ' produkt?w, nowe: '                          (typ Ręczny upload)    92
--
-- Skan WSZYSTKICH kolumn tekstowych wszystkich tabel nie znalazł „?" w słowie nigdzie indziej.
-- `kluczowe/bledy` (bez ogonków) w alertach „Ręczny upload" to oryginał (`:48270`), nie
-- uszkodzenie — odbudowa pisze tak samo, więc zostaje.
--
-- ⚠ DOPASOWANIE WYŁĄCZNIE DOKŁADNE. `?` jest wildcardem w GLOB, a `UPPER()`/`LOWER()` w SQLite
-- są ASCII-only — żadne z nich tu nie występuje. `typ` porównujemy przez `=`, `opis` przez
-- `instr()` + `replace()` na PEŁNYM fragmencie szablonu z otaczającą interpunkcją, i tylko
-- w wierszach właściwego typu. Nazwa pliku i nazwa dostawcy w `opis` zostają nietknięte —
-- na snapshocie żadna nie zawiera tych fragmentów (sprawdza to test na kopii snapshotu).
--
-- ⚠ IDEMPOTENCJA TREŚCIOWA. Każdy `WHERE` trafia tylko w formę zepsutą; po naprawie wiersz
-- przestaje spełniać warunek. Drugie wykonanie zmienia 0 wierszy — pilnuje tego
-- `test/db.migracje.test.ts`. Alerty zapisane już poprawnie przez odbudowę są poza zasięgiem.

UPDATE alerts SET typ = 'Błąd pobierania' WHERE typ = 'B??d pobierania';
UPDATE alerts SET typ = 'Ręczny upload'   WHERE typ = 'R?czny upload';
UPDATE alerts SET typ = 'Błąd HTTP'       WHERE typ = 'B??d HTTP';

-- `typ` jest już naprawiony powyżej, ale warunek zna obie formy — żeby plik nie zależał od
-- kolejności instrukcji.
UPDATE alerts
   SET opis = replace(replace(opis,
                ' produkt?w (nowe: ', ' produktów (nowe: '),
                ', kluczowe/b??dy: ', ', kluczowe/błędy: ')
 WHERE typ = 'Synchronizacja'
   AND (instr(opis, ' produkt?w (nowe: ') > 0 OR instr(opis, ', kluczowe/b??dy: ') > 0);

UPDATE alerts
   SET opis = replace(opis, ' produkt?w, nowe: ', ' produktów, nowe: ')
 WHERE typ IN ('Ręczny upload', 'R?czny upload')
   AND instr(opis, ' produkt?w, nowe: ') > 0;
