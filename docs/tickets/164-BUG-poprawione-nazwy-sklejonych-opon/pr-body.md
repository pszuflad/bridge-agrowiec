## Ticket
164-BUG-poprawione-nazwy-sklejonych-opon — poprawione nazwy sklejonych opon

## Summary
Dodano jednorazowy skrypt migracyjny `napraw-nazwy-sklejone.ts`, który wgrywa poprawne nazwy dla
produktów dzielących `kod_importu` z innym produktem tego samego dostawcy (kolizja #108). Nazwy
zapisywane są jako `manual_overrides` ("Poprawki Marty") kluczowane po dokładnym `(dostawca, kod)`,
co rozwiązuje kolizję bez żadnej zmiany `nazwa_pamiec`. Skrypt uruchomiono i zweryfikowano ręcznie
na tymczasowej bazie — 174/174 poprawek zapisanych poprawnie.

## Problem / Motivation
Znana kolizja `kod_importu` (ticket 119 / karta I15.10, `docs/rebuild-backlog.md` #108): ten sam
dostawca ma dwie fizycznie różne opony (różny EAN, czasem inny DOT) pod jednym sześciocyfrowym
`kod_importu`. Mechanizm `nazwa_pamiec` jest kluczowany PO `kod_importu`, więc dla kolidującej pary
pamięta tylko jedną nazwę — stąd nazwy sklejone/pomylone między dwoma produktami. Użytkownik
dostarczył plik CSV z poprawnymi nazwami dla 174 takich pozycji (dostawcy MO1, MO2, MO4, MO5, MO7,
MO8; opis ticketu mówił o 69 — plik faktycznie ma 174, użyto go jako źródła prawdy).

## Solution
- `rebuild/backend/src/import/naprawaNazwSklejonych.ts` — parsowanie CSV
  (`sparsujWierszeNaprawy`) + zapis poprawek `nazwa` przez istniejący `zapiszPoprawke()`
  (`naprawNazwySklejone`), z jednym wspólnym `createdAt` na cały przebieg importu.
- `rebuild/backend/scripts/napraw-nazwy-sklejone.ts` — cienki wrapper CLI wzorowany na
  `scripts/dziedzicz-wage.ts` (`DB_PATH=... npm run napraw-nazwy-sklejone [ścieżka-csv]`).
- `rebuild/backend/scripts/data/164-poprawione-nazwy.csv` — dołączony plik z poprawnymi nazwami.
- `rebuild/backend/test/naprawa-nazw-sklejonych.test.ts` — testy parsowania CSV (w tym przecinki
  w cudzysłowiu), zapisu do `manual_overrides`, idempotencji, integracji z `poprawkiMarty()`.
- `docs/rebuild-backlog/wpis-164.md` (nowy) + jednolinijkowa adnotacja w polu `Status` wpisu #108
  w `docs/rebuild-backlog.md` — ticket naprawia wyłącznie symptom nazwy, nie zamyka #108 (pętla
  delty do Selly i decyzja semantyczna nadal otwarte, poza zakresem odbudowy).

## Design decisions
- **Mechanizm: `manual_overrides`, nie zmiana `nazwa_pamiec`.** Klucz (dostawca, kod, pole) już
  rozróżnia kolidujące produkty — mniejsze ryzyko niż zmiana schematu/logiki `nazwa_pamiec`.
- **Sposób wgrania: jednorazowy skrypt migracyjny**, nie trwały endpoint/mechanizm importu CSV —
  świadoma decyzja użytkownika; jeśli import CSV będzie potrzebny regularnie, to osobny ticket.
- **Świadome odstępstwo od 1:1:** sam skrypt masowego importu poprawek to nowy proces — oryginał
  nie miał odpowiednika (tylko pojedyncze upsety z UI). Ograniczony do jednorazowego narzędzia
  CLI, nie zmienia API ani UI.
- Poprawiane jest wyłącznie pole `nazwa` — pozostałe kolumny CSV to kontekst identyfikujący wiersz.

## Tests
- Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API/kontraktu, zmienia wyłącznie dane
  w `manual_overrides` przez istniejący, niezmieniony mechanizm.
- Unit: 7/7 nowych testów zielone (`naprawa-nazw-sklejonych.test.ts`).
- Pełny `npm test` w `rebuild/backend/`: 1883 passed, 12 skipped (znany, oczekiwany szum
  `DB_PATH: Required` na stderr z dwóch istniejących testów — opisany w `CLAUDE.md`).
- `npm run lint` / `npm run typecheck` / `npm run build`: zielone.
- Weryfikacja manualna end-to-end na tymczasowej bazie: 174/174 poprawek zapisanych; przykładowa
  kolidująca para (MO1, `kod_importu=326606`) ma dwie różne, poprawne nazwy po odczycie.

## Breaking changes
None.

## Follow-up
- Stały mechanizm/endpoint do powtarzalnego importu poprawek CSV — świadomie odłożone (decyzja
  użytkownika). Ewentualny osobny ticket, jeśli Ania będzie chciała powtarzać taki import.
- Skrypt trzeba uruchomić ręcznie na docelowej bazie (produkcja/staging) po wdrożeniu tego PR-a —
  nie wykonuje się automatycznie przy starcie serwera.

## Review
<details>
<summary>Code review</summary>

# 164-BUG-poprawione-nazwy-sklejonych-opon — Code review

> Reviewed: 2026-09-29
> Branch: `fix/164-poprawione-nazwy-sklejonych-opon`
> Diff: 7 plików zmienionych (614 dodań, 0 usunięć), 3 commity

## BLOCKER

Brak.

## SHOULD-FIX

- [x] `rebuild/backend/scripts/napraw-nazwy-sklejone.ts:31` — dopisano komentarz uzasadniający
  `zastosujMigracje()`. Naprawione.
- [ ] Brak automatycznego przypomnienia o ręcznym uruchomieniu skryptu na produkcji/stagingu po
  wdrożeniu PR-a. Pozostawione jako Follow-up — ryzyko niskie, już jawnie odnotowane.

## NICE-TO-HAVE

- [x] Usunięto martwą domyślną wartość `opts.reason` w `naprawNazwySklejone()`. Naprawione.
- [x] `createdAt` liczony teraz raz na cały przebieg importu, nie per wiersz. Naprawione.

## Overall assessment

Implementacja jest precyzyjna i dobrze uzasadniona: właściwy mechanizm (`manual_overrides`
kluczowany po dokładnym `(dostawca, kod)`, nie `nazwa_pamiec` kluczowane po kolizyjnym
`kod_importu`), idempotentny zapis przez istniejący `zapiszPoprawke()`, poprawna obsługa CSV
z przecinkami w cudzysłowiu, testy nietautologiczne (w tym test integracyjny przez
`poprawkiMarty()` potwierdzający realne rozwiązanie kolizji dla dwóch produktów). Skrypt CLI
jest spójny ze wzorcem `dziedzicz-wage.ts`. Świadome odstępstwo od 1:1 (nowy proces masowego
importu, którego nie ma w oryginale) jest jawnie i poprawnie oznaczone w `plan.md`/`raport.md`.
Brak blokerów — uwagi mają charakter porządkowy/dokumentacyjny.

Pełna treść: `docs/tickets/164-BUG-poprawione-nazwy-sklejonych-opon/review.md`.

</details>

---
Ticket docs: `docs/tickets/164-BUG-poprawione-nazwy-sklejonych-opon/`
Zsynchronizowane z `develop` (`561ed6a95e581cbbcdd8acf0ab6de062cd4b7dc6`); bramki przebiegnięte po synchronizacji.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PPFdZV3DKLCSUWr1865qjk
