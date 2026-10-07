# 195-FEATURE-selly-historia-usuniec — Implementation report

## Summary
Tor 3 (usuwanie z Selly) zapisuje teraz zbiorczą historię usuniętych pozycji w nowej tabeli `selly_usuniecia` — jeden
wiersz na pozycję, bez limitu długości. W zakładce Selly jest karta „Usunięte z Selly” (lista, najnowsze pierwsze,
paginacja po 20, „Pobierz CSV” z całą historią). Logika usuwania, bezpieczniki i `SELLY_USUWANIE` nie zostały zmienione.

## Changes
- **New:** `rebuild/schema/023_selly_usuniecia.sql` — tabela + dwa indeksy, idempotentna (`IF NOT EXISTS`); wpis w `rebuild/schema/README.md`.
- **New:** `rebuild/backend/src/repos/selly-usuniecia.ts` — `zapiszUsuniecie`, `listaUsuniec` (limit 20/maks. 200, offset), `csvUsuniec` (BOM + średnik, nagłówek także przy pustej historii; `escapujKomorke` z `analityka/csv.ts`).
- `rebuild/backend/src/selly/rest/sync-usuwanie.ts` — wywołanie `zapiszUsuniecie` obok `zapiszHistorie`, we własnym `try/catch` (po wykonanym `DELETE`).
- `rebuild/backend/src/routes/selly.ts` — `GET /api/selly/usuniete` i `GET /api/selly/usuniete/csv` (oba za `requireAuth`).
- `contract/openapi.yaml` — obie ścieżki (oznaczone jako spoza oryginału).
- **New:** `rebuild/frontend/src/pages/selly/SekcjaUsuniete.tsx`; `pages/selly/api.ts` (typy, `pobierzUsuniete`, `pobierzCsvUsunietych`); `pages/Selly.tsx` (wpięcie karty).
- Testy: **New** `backend/test/selly.usuniete.test.ts` (11), **New** `frontend/test/selly.usuniete.test.tsx` (6); handler `*/api/selly/usuniete` dopisany do czterech istniejących testów `/selly` (pułapka MSW z CLAUDE.md) + `stronaUsunietychTestowa` w `test/msw/kontrakt.ts`; `db.migracje.test.ts` i `db.migracje-produkcja.test.ts` znają migrację 023 (40 tabel / 24 indeksy).
- **New:** `docs/spec-backend/wpis-195.md`, `plan.md`, `raport.md`, `review.md`.

## Deviations from plan
Brak. (Wymuszona przez środowisko gałąź `claude/awesome-faraday-98rpkk` zamiast `feature/195-…` i brak osobnego worktree — odnotowane w `plan.md`.)

## Review fixes applied
Pierwszy przegląd (`review.md`): 2 BLOCKER, 3 SHOULD-FIX, 5 NICE-TO-HAVE.
- **BLOCKER (oba)** — testy migracji nie znały 023 (`db.migracje.test.ts`: lista migracji, bilans 40/24; `db.migracje-produkcja.test.ts`: lista nowych obiektów). Poprawione; pełny `npm test` potwierdził, że to były jedyne trzy czerwone testy.
- **SHOULD-FIX** — `limit < 1` zwraca teraz domyślne 20 (wcześniej `limit=-5` dawał 1, wbrew opisowi w spec/OpenAPI); test na `limit=-5` i `limit=0`.
- **SHOULD-FIX** — test niezależności zapisów: zapis do `selly_usuniecia` działa przy odrzucającym inserty `audit_log` (wyzwalacz). Uwaga: sama utrata tabeli `audit_log` zatrzymuje cały przebieg PRZED pierwszym `DELETE` (Tor 3 czyta ją do limitu dobowego) — zachowanie istniejące i bezpieczne.
- **SHOULD-FIX** — brak `raport.md` — ten plik.
- **NICE (zrobione)** — JSDoc `csv-status` wrócił do swojej trasy (nowe trasy przed jego komentarzem). Spread `{ ...wpis, akcja: wpis.akcja }` zostaje: zawęża typ akcji do trzech „usuniętych”, bez niego `tsc` odrzuca wywołanie (dodałem komentarz).

## Test results
- **Gate odbudowy (fixtures/kontrakt):** N/D — ticket dodaje WYŁĄCZNIE nowe trasy spoza oryginału (brak fixtures z produkcji); żadna istniejąca trasa ani fixture `contract/fixtures/GET_selly_*.json` nie zmienia kształtu. Kontrakt `openapi.yaml` uzupełniony (YAML poprawny).
- Backend (po poprawkach z review): lint ✓, typecheck ✓, build ✓, `npm test` ✓ — 2242 passed, 12 skipped.
- Frontend: lint ✓, typecheck ✓, build ✓, `npm test` ✓ — 1072 passed (w tym 6 nowych).
- Bramki przebiegły PO synchronizacji z `develop` (`f4fc3e0`, PR #293) — gałąź zawierała całe `origin/develop` w chwili startu pracy; ostatnia synchronizacja przed pushem opisana niżej.

## Breaking changes
None. Migracja 023 tworzy pustą tabelę (`npm run migrate` w `deploy-produkcja.sh`, bez kroków ręcznych).

## Follow-up
- **Włączenie usuwania w Selly** (`SELLY_USUWANIE=false` w `.env` na serwerze) — osobna decyzja użytkowniczki (zostawione).
- Komórki CSV zaczynające się od `=`, `+`, `-`, `@` nie są neutralizowane — spójnie z istniejącym wzorcem `analityka/csv.ts`; ewentualnie do backlogu jako zmiana dla wszystkich eksportów naraz.
- `offset` karty nie jest resetowany ani przycinany do `total` — historia jest wyłącznie dopisywana (nie maleje), więc offset poza zakresem nie wystąpi.
- Wpisy sprzed tego ticketu nie są przenoszone do nowej tabeli: usuwanie nigdy jeszcze nie działało na produkcji, więc nie ma czego przenosić.
