# 164-BUG-poprawione-nazwy-sklejonych-opon — raport implementacji

## Summary

Dodano jednorazowy skrypt migracyjny `napraw-nazwy-sklejone.ts`, który wgrywa poprawne nazwy
dla produktów dzielących `kod_importu` z innym produktem tego samego dostawcy (kolizja #108).
Nazwy zapisywane są jako `manual_overrides` ("Poprawki Marty") kluczowane po dokładnym
`(dostawca, kod)`, co rozwiązuje kolizję bez żadnej zmiany `nazwa_pamiec`. Skrypt uruchomiono
i zweryfikowano ręcznie na tymczasowej bazie — 174/174 poprawek zapisanych poprawnie, w tym
przykładowa kolidująca para (MO1, `kod_importu=326606`) ma teraz dwie różne, poprawne nazwy.

## Changes

- **New:** `rebuild/backend/src/import/naprawaNazwSklejonych.ts` — logika: parsowanie CSV
  (`sparsujWierszeNaprawy`) + zapis poprawek `nazwa` przez `zapiszPoprawke()`
  (`naprawNazwySklejone`).
- **New:** `rebuild/backend/scripts/napraw-nazwy-sklejone.ts` — cienki wrapper CLI (wzorowany na
  `scripts/dziedzicz-wage.ts`), `DB_PATH=... npm run napraw-nazwy-sklejone [ścieżka-csv]`.
- **New:** `rebuild/backend/scripts/data/164-poprawione-nazwy.csv` — dołączony plik z poprawnymi
  nazwami (źródło danych dla skryptu).
- **New:** `rebuild/backend/test/naprawa-nazw-sklejonych.test.ts` — testy parsowania CSV, zapisu
  do `manual_overrides`, idempotencji oraz integracji z `poprawkiMarty()` (dwa kolidujące
  produkty dostają różne nazwy po nałożeniu poprawek).
- `rebuild/backend/package.json` — dodany skrypt `napraw-nazwy-sklejone`.

## Deviations from plan

- **Liczba wierszy: 174, nie 69.** Opis ticketu podawał „69 pozycji", ale dołączony plik CSV
  faktycznie zawiera 174 unikalne wiersze (dostawcy MO1, MO2, MO4, MO5, MO7, MO8). Użyto
  faktycznej zawartości pliku — to on jest źródłem prawdy, nie liczba w opisie.
- Użytkownik dosłał dodatkowo drugi plik (`import.csv`) z OBECNYMI (błędnymi) nazwami dla tych
  samych 174 pozycji — posłużył wyłącznie do potwierdzenia zakresu (te same klucze
  dostawca+kod), nie był wgrywany; źródłem wartości `nazwa` pozostaje plik z poprawnymi nazwami.
- Poza tym bez odstępstw od `plan.md`.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** N/D — ticket nie dotyka API/kontraktu (patrz `plan.md`,
  sekcja „Kontrakt i fixtures"), zmienia wyłącznie dane w `manual_overrides` przez istniejący,
  niezmieniony mechanizm `zapiszPoprawke()`/`POST /api/overrides`.
- Unit: ✓ 7/7 nowych testów (`naprawa-nazw-sklejonych.test.ts`) — parsowanie CSV (w tym pole
  z przecinkami w cudzysłowie), zapis do `manual_overrides`, obsługa pustej nazwy, idempotencja,
  poprawne rozróżnienie dwóch produktów o wspólnym `kod_importu` przez `poprawkiMarty()`.
- Pełny `npm test` w `rebuild/backend/`: ✓ 1883 passed, 12 skipped (114 plików + nowy). Szum na
  stderr (`DB_PATH: Required`, `kopia-bazy: brak DB_PATH`) to znany, oczekiwany efekt dwóch
  istniejących testów (`test/kopia-bazy.test.ts`, `test/selly.csv-cli.test.ts`) — opisany
  w `CLAUDE.md`, nie błąd.
- `npm run lint` / `npm run typecheck` / `npm run build`: ✓ wszystkie zielone.
- Weryfikacja manualna end-to-end: uruchomiono `DB_PATH=<tymczasowa baza> npm run
  napraw-nazwy-sklejone` — log: „zapisano 174/174 poprawek nazw (pominięto 0 z pustą nazwą)”.
  Odczyt bazy potwierdził dwie różne, poprawne wartości `override_value` dla `MO1_15126981` i
  `MO1_15126983` (wspólny `kod_importu=326606`).

## Breaking changes

None.

## Review fixes applied

Code review (`review.md`): 0 BLOCKER / 2 SHOULD-FIX / 2 NICE-TO-HAVE.

- **SHOULD-FIX** — dopisano komentarz w `scripts/napraw-nazwy-sklejone.ts` uzasadniający wywołanie
  `zastosujMigracje()` (chroni przed zapisem na bazie ze starszym schematem; wzorzec z
  `dziedzicz-wage.ts`). ✓ Naprawione.
- **SHOULD-FIX** — brak automatycznego przypomnienia o ręcznym uruchomieniu skryptu na
  produkcji/stagingu po wdrożeniu PR-a. Pozostawione jako `Follow-up` (niżej) — ryzyko niskie,
  już jawnie odnotowane, bez oczywistego taniego rozwiązania kodowego w zakresie tego ticketu.
- **NICE-TO-HAVE** — usunięto martwą domyślną wartość `opts.reason` w `naprawNazwySklejone()`
  (pole `reason` jest teraz wymagane, zawsze i tak nadpisywane przez wywołujących). ✓ Naprawione.
- **NICE-TO-HAVE** — `createdAt` liczony teraz raz na cały przebieg importu, nie per wiersz —
  ułatwia odróżnienie "ten sam bieg" po `createdAt` w `manual_overrides`. ✓ Naprawione.

Po poprawkach: lint/typecheck zielone, 7/7 nowych testów zielone.

## Follow-up

- Stały mechanizm/endpoint do powtarzalnego importu poprawek CSV — świadomie odłożone (decyzja
  użytkownika w Kroku 3: jednorazowy skrypt, nie trwałe narzędzie). Jeśli Ania będzie chciała
  powtarzać taki import regularnie, warto rozważyć osobny ticket na `POST
  /api/overrides/import-csv` lub podobny.
- Skrypt trzeba uruchomić ręcznie na docelowej bazie (produkcja/staging) po wdrożeniu tego PR-a —
  sam kod nie wykonuje się automatycznie przy starcie serwera.
