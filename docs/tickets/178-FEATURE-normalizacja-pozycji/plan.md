# 178-FEATURE-normalizacja-pozycji — normalizacja pozycji cennika (Etap 3)

> Status: Implemented · Branch: `claude/new-session-wfqwy9` · SPEC „Naprawa kolejki stagingu (2026-10-01)”, Etap 3.

## Context
~40 zgłoszeń „Oznaczenie wskazuje inną oponę / Podobna opona / Ten EAN występuje” i jakość katalogu: ten sam model zapisany
różnie (spacje, myślniki, dopiski osi, utracone HS/LS, ucięte indeksy, DOT dwucyfrowy/WWYY).

## Kontrakt i fixtures
Brak (nie dotyka API). Odstępstwo od produkcji — decyzja użytkowniczki (spec).

## Decisions
- **Warstwa po parserze, nie edycja parserów.** `legacy/**` jest pilnowane bajt w bajt względem `mirror/backend`
  (`test/charakteryzacja.test.ts`), a wyjście — wzorcem z produkcji. Poprawki w `polityka/normalizacja-pozycji.ts`, wołane
  w `fabryka.ts` obok `oczyscModelZDot` i wspólne z czyszczeniem katalogu (jedna logika). Odstępstwo od litery speca (pliki parserów).
- **3a**: `kluczModelu` (NFKC→UPPER→bez dopisków osi→bez spacji/`-`/`_`/`.`/`/`) używany w `widok()` w `tolerancja-dopasowania.ts`,
  więc działa w `zgodna`, `zgodnaBezDot`, `osobnaPartia`. NIE zmieniamy `identity()`/`sourceKey`/`syntheticCode` (legacy, pilnowane) —
  stąd brak migracji `staging_matches.source_key`; klucze zmieniają się tylko tam, gdzie zmienia się zapisany model (HS/dopiski).
- **3b**: dopiski osi (NAPĘD/PROWADZĄCA/NACZEPA/UNIWERSALNA) i resztka `158/` usuwane z modelu i bieżnika (NIE przenosimy do
  `zastosujenia` — to słownik sterujący kategoriami Selly, zapis tam zmieniłby kategoryzację); HS/LS/HD/HT Continentala odtwarzane z nazwy;
  LingLong — litera z nazwy; DOT `NN`→`20NN`, `WWYY`→`20YY` (tydzień 01–53); indeksy ucięte — z nazwy tylko przy identycznym zestawie znaków;
  konstrukcja → forma słowna katalogu (`Radialna`/`Diagonalna`, migracja 005), NIE litery `R`/`D` ze speca (zmieniłyby kontrakt API);
  słownik producenta `slowniki/modele-producenta.ts` (TS, nie JSON; start pusty — nie zgadujemy zapisu producenta, wpisy dokłada Anna).
- **3c**: `npm run normalizuj-katalog` (dry-run/`--apply`, backup `VACUUM INTO`); poprawki ręczne chronią pole; nazwy produktów NIE są zmieniane
  (spec: najpierw raport i akceptacja, SEO/delta Selly).

## Testing strategy
Testy jednostkowe na każdy wiersz tabeli 3b, test czyszczenia na prawdziwym SQLite. Gate'y porównujące port z oryginałem
(`silnik.charakteryzacja`, `silnik.polityka-zrodla`) wyłączają normalizację mockiem — tak jak tolerancję.

## Out of scope
Uruchomienie na kopii prod i pomiar „≤ 5 zgłoszeń”; wpisy słownika producenta; zmiany nazw produktów; Etap 4.

## Definition of done
- [x] testy 3b/3a/3c zielone, bramki zielone
- [ ] dry-run na kopii prod, pomiar zgłoszeń po imporcie MO2–MO5/MO9, kontrola po 24 h — po stronie wdrożenia
