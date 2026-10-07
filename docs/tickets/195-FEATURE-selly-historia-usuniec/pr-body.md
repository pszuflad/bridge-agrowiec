## Ticket
195-FEATURE-selly-historia-usuniec — zbiorcza historia usuniętych z Selly pozycji (Tor 3)

## Summary
Tor 3 zapisuje teraz zbiorczą historię usuniętych pozycji w nowej tabeli `selly_usuniecia` (jeden wiersz na pozycję, bez limitu długości). W zakładce Selly jest karta „Usunięte z Selly" (lista, najnowsze pierwsze, paginacja po 20) i przycisk „Pobierz CSV" z całą historią. Logika usuwania, bezpieczniki i `SELLY_USUWANIE` NIE zostały zmienione.

## Problem / Motivation
Usuwanie z Selly kasuje produkty w prawdziwym sklepie, nieodwracalnie. Dziś ślad jest w `audit_log` (jeden wpis na produkt) i w `selly_sync_log.szczegoly_json` (jeden wpis na przebieg, lista przycinana do 8000 znaków). Brakowało jednego miejsca z całą listą, którą da się później przejrzeć i wyeksportować — przed włączeniem usuwania trzeba mieć gdzie to zweryfikować.

## Solution
- **Migracja `023_selly_usuniecia.sql`** — tabela + 2 indeksy, idempotentna (`IF NOT EXISTS`); na istniejącej bazie powstaje pusta (`npm run migrate` w `deploy-produkcja.sh`, bez kroków ręcznych).
- **Zapis** w `usunSierotyZSelly` obok istniejącego `zapiszHistorie`, we własnym `try/catch` (po wykonanym `DELETE`). Zapisywane akcje: `usunieto_wariant`, `usunieto_produkt`, `juz_nie_istnial`; kolumny: data UTC, `przebieg_id` (= `selly_sync_log.id`), kod, nazwa, EAN, dostawca, kod_importu, id produktu i wariantu w Selly, akcja.
- **`GET /api/selly/usuniete?limit=&offset=`** (domyślnie 20, maks. 200) i **`GET /api/selly/usuniete/csv`** (cała historia, BOM + średnik jak w eksportach analityki, nagłówek także przy pustej historii). Obie za `requireAuth`; kontrakt w `contract/openapi.yaml`.
- **Frontend:** `SekcjaUsuniete.tsx` pod kartą „Usuwanie z Selly", wpięta w `pages/Selly.tsx`.
- To NOWA funkcja, spoza oryginału (oryginał nie usuwał nic z Selly) — oznaczone w `docs/spec-backend/wpis-195.md` i kontrakcie.

## Design decisions
- Osobna tabela zamiast rozszerzania `audit_log`/`selly_sync_log` (decyzja użytkowniczki): bez limitu długości, jeden wiersz na pozycję, `audit_log` i dziennik zostają bez zmian.
- Historia obejmuje tylko faktycznie usunięte pozycje; pominięte i błędy nie wchodzą.
- Wzorzec CSV z `analityka/csv.ts` (BOM + średnik) dla spójności z resztą eksportów.
- `SELLY_USUWANIE` nie jest ruszane — jego włączenie to osobna decyzja.

## Tests
- Backend: lint ✓, typecheck ✓, build ✓, `npm test` ✓ — 11 nowych testów (zapis dla trzech akcji i brak zapisu dla pominiętych/błędów, `przebieg_id`, brak przycinania powyżej 8000 znaków, niezależność od awarii `audit_log`, trasy: auth, kolejność, paginacja, CSV z BOM/średnikiem/cudzysłowami/nagłówkiem). Testy migracji (`db.migracje*.test.ts`) zaktualizowane: 40 tabel / 24 indeksy.
- Frontend: lint ✓, typecheck ✓, build ✓, `npm test` ✓ — 6 nowych testów karty (stan pusty, wiersze, paginacja, błąd listy, pobranie CSV z nazwą z `Content-Disposition`, błąd pobrania); handler `*/api/selly/usuniete` dodany do czterech istniejących testów `/selly`.
- Gate fixtures/kontrakt: N/D — wyłącznie nowe trasy, żadna istniejąca trasa ani fixture nie zmienia kształtu.
- Bramki przebiegły po synchronizacji z `develop` (merge `97d6c2e`).

## Breaking changes
None.

## Follow-up
- Włączenie usuwania w Selly (`SELLY_USUWANIE=false` w `.env` na serwerze) — decyzja użytkowniczki, poza tym PR-em.
- Backlog `#195.1` (neutralizacja komórek CSV zaczynających się od `=`, `+`, `-`, `@` we WSZYSTKICH eksportach) i `#195.2` (offset karty poza zakresem) — `docs/rebuild-backlog/wpis-195.md`.

## Review
Dwa przebiegi review (`docs/tickets/195-FEATURE-selly-historia-usuniec/review.md`): pierwszy — 2 BLOCKER (testy migracji nie znały 023), 3 SHOULD-FIX; wszystko naprawione. Drugi — 0 BLOCKER, 0 SHOULD-FIX, 3 NICE (opisane w backlogu/raporcie).

---
Ticket docs: `docs/tickets/195-FEATURE-selly-historia-usuniec/`
Zsynchronizowane z `develop` (merge `97d6c2e`); bramki przebiegnięte po synchronizacji.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PvnkcRwTpGdrWHX8hhJTmE
