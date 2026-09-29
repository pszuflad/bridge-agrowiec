# 164-BUG-poprawione-nazwy-sklejonych-opon — Code review

> Reviewed: 2026-09-29
> Branch: `fix/164-poprawione-nazwy-sklejonych-opon`
> Diff: 7 plików zmienionych (614 dodań, 0 usunięć), 3 commity

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/scripts/napraw-nazwy-sklejone.ts:31` — `zastosujMigracje(sqlite)` jest
  wołane wewnątrz skryptu migracji danych bez żadnego uzasadnienia w komentarzu — jeśli ktoś
  uruchomi ten skrypt na bazie ze starszym schematem niż aktualny `HEAD`, migracje wejdą jako
  efekt uboczny naprawy nazw, co może zaskoczyć operatora. To wzorzec przejęty 1:1 z
  `dziedzicz-wage.ts`, więc nie jest to nowy problem tego ticketu, ale warto rozważyć w obu
  miejscach krótki komentarz, dlaczego skrypt to robi (żeby nie wyglądało na przypadkowy
  kopiuj-wklej).
- [ ] `rebuild/backend/scripts/data/164-poprawione-nazwy.csv` — plik danych wejściowych (174
  wierszy z rzeczywistymi nazwami produktów/EAN-ami) trafia do repozytorium na stałe jako
  artefakt jednorazowego skryptu migracyjnego, bez żadnej weryfikacji uruchomienia (np. flagi w
  bazie / migracji SQL potwierdzającej, że skrypt faktycznie wykonano na docelowej bazie).
  Rozbudowa `raport.md` mówi, że uruchomiono go tylko na tymczasowej bazie testowej — plan
  zakładał uruchomienie „na lokalnej/testowej bazie deweloperskiej", ale `Definition of done`
  i `Follow-up` w raporcie jasno stwierdzają, że produkcja/staging wymaga ręcznego uruchomienia
  po wdrożeniu PR-a. Warto rozważyć, czy nie brakuje śladu wykonania (np. wpisu do
  `docs/rebuild-backlog.md` albo checklisty deploymentu), żeby to nie zostało zapomniane —
  ryzyko niskie, bo świadomie odnotowane w `Follow-up`, ale brak automatycznego mechanizmu
  przypominającego.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/import/naprawaNazwSklejonych.ts:48` — domyślna wartość `opts.reason`
  w sygnaturze (`{ reason: "import CSV — naprawa nazw sklejonych" }`) jest w praktyce zawsze
  nadpisywana przez wywołującego (`scripts/napraw-nazwy-sklejone.ts:34` i wszystkie testy podają
  własny `reason`) — martwy fragment kodu, można usunąć domyślną wartość i zostawić `reason`
  jako wymagane pole `opts`.
- [ ] `rebuild/backend/src/import/naprawaNazwSklejonych.ts:67` — `new Date().toISOString()`
  liczone osobno dla każdego wiersza w pętli oznacza, że 174 poprawki dostaną 174 (teoretycznie)
  różne znaczniki czasu w milisekundach zamiast jednego wspólnego znacznika dla całego importu.
  Nieszkodliwe funkcjonalnie, ale utrudnia późniejsze odróżnienie „ten sam bieg importu" po
  `createdAt`, gdyby ktoś kiedyś tego potrzebował — można policzyć raz przed pętlą i przekazać
  jako wspólny `createdAt` dla całego przebiegu.

## Plan compliance

### Done ✓
- Plik CSV z poprawnymi nazwami zapisany jako `scripts/data/164-poprawione-nazwy.csv`.
- Skrypt `napraw-nazwy-sklejone.ts` wzorowany na `dziedzicz-wage.ts`: `DB_PATH` z env,
  komunikat błędu + `exit(1)` przy braku, zamknięcie `sqlite` w `finally`, log z liczbami.
- Wpis w `package.json` (`scripts.napraw-nazwy-sklejone`) spójny z konwencją `tsx`.
- Testy jednostkowe parsowania CSV (w tym przecinki w cudzysłowiu) + integracyjne zapisu do
  `manual_overrides` + weryfikacja przez `poprawkiMarty()` dla kolidującej pary.
- Zapis idzie przez istniejący, niezmieniony `zapiszPoprawke()` — brak zmian w `nazwa_pamiec`.

### Missing or deviating ✗
- Liczba wierszy: plan zakładał 69, faktyczny plik ma 174 — udokumentowane i uzasadnione w
  `raport.md` (plik jest źródłem prawdy). Rozsądna, jawnie opisana decyzja, nie traktuję jako
  problemu.
- Krok 5 planu („Uruchomić skrypt na lokalnej/testowej bazie deweloperskiej, żeby zweryfikować
  manualnie efekt") wykonany i opisany w `raport.md` — zgodnie z planem.

### Definition of done
- [x] Skrypt istnieje, czyta CSV, zapisuje poprawki przez `zapiszPoprawke()` (174, nie 69 —
  patrz wyżej, uzasadnione).
- [x] Testy zielone (7/7 nowych + pełny `npm test`: 1883 passed).
- [x] Lint/typecheck/build/test przechodzą (potwierdzone w `raport.md`).
- [x] `raport.md` opisuje wynik uruchomienia, w tym odstępstwo od liczby 69→174.
- [ ] Synchronizacja z `origin/develop` / PR `MERGEABLE` — poza zakresem code review (do
  wykonania po review, zgodnie z procedurą CLAUDE.md).

## Parallel-test concerns

None — nowy test korzysta z `stworzTestowaBaze()` (`test/gate/baza.ts`), czyli standardowego,
izolowanego mechanizmu tymczasowej bazy używanego przez resztę pakietu testów backendu. Brak
odwołań do stałych portów czy współdzielonych plików.

## Overall assessment

Implementacja jest precyzyjna i dobrze uzasadniona: właściwy mechanizm (`manual_overrides`
kluczowany po dokładnym `(dostawca, kod)`, nie `nazwa_pamiec` kluczowane po kolizyjnym
`kod_importu`), idempotentny zapis przez istniejący `zapiszPoprawke()`, poprawna obsługa CSV
z przecinkami w cudzysłowiu, testy nietautologiczne (w tym test integracyjny przez
`poprawkiMarty()` potwierdzający realne rozwiązanie kolizji dla dwóch produktów). Skrypt CLI
jest spójny ze wzorcem `dziedzicz-wage.ts`. Świadome odstępstwo od 1:1 (nowy proces masowego
importu, którego nie ma w oryginale) jest jawnie i poprawnie oznaczone w `plan.md`/`raport.md`.
Brak blokerów — uwagi mają charakter porządkowy/dokumentacyjny.
