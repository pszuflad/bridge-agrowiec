# 195-FEATURE-selly-historia-usuniec — zbiorcza historia usuniętych z Selly pozycji

> Status: Approved (decyzje w opisie zadania użytkowniczki, 2026-10-07)
> Branch: `claude/awesome-faraday-98rpkk` (wymuszona przez środowisko sesji chmurowej — bez osobnego worktree)

## Ticket description
Usuwanie z Selly (Tor 3, tickety 186/194) kasuje produkty w prawdziwym sklepie, nieodwracalnie. Dziś ślad zostaje w
`audit_log` (widok „Historia", jeden wpis na produkt) i w `selly_sync_log.szczegoly_json` (jeden wpis na przebieg, lista
przycinana do 8000 znaków). Brakuje jednego miejsca z CAŁĄ listą usuniętych pozycji, które da się później przejrzeć
i wyeksportować. Przed włączeniem usuwania (`SELLY_USUWANIE`) ma istnieć gdzie to zweryfikować.

## Context
- `src/selly/rest/sync-usuwanie.ts` — `przebieg()` zapisuje dla każdej usuniętej pozycji `zapiszHistorie` (audit_log).
  `WpisUsuniecia` ma już wszystkie pola (kod, dostawca, kod_importu, nazwa, ean, selly_product_id, selly_variant_id,
  akcja, czas). `wynik.logId` = id wpisu `selly_sync_log` bieżącego przebiegu.
- Wzorzec CSV: `src/analityka/csv.ts` (`naCsv`, BOM + średnik, `\n`), nagłówki odpowiedzi: `routes/analytics.ts:350`.
- Wzorzec pobrania pliku we froncie: `pages/archiwum-importow/dane.ts` (`fetch` → `blob` → `<a download>`).
- Migracje: `rebuild/schema/NNN_*.sql`, ostatnia `022`, żadna inna gałąź nie rezerwuje `023`.

## Kontrakt i fixtures (zakres)
Trasy NOWE, spoza oryginału (brak fixtures z produkcji — kształt z backendu, jak `usuwanie-status` z ticketu 194):
- `GET /api/selly/usuniete?limit=&offset=` → `{ items: [...], total }`, najnowsze pierwsze.
- `GET /api/selly/usuniete/csv` → `text/csv; charset=utf-8`, BOM + średnik, cała historia.
Istniejące fixtures `GET_selly_*.json` NIE są dotykane (żadna istniejąca trasa nie zmienia kształtu). Kontrakt:
dopisanie obu ścieżek do `contract/openapi.yaml`.

## Decisions
1. **Nowa tabela `selly_usuniecia`, jeden wiersz na usuniętą pozycję**, bez limitu długości (decyzja użytkowniczki).
   Pola: `usunieto_at` (UTC `YYYY-MM-DD HH:MM:SS`, jak `WpisUsuniecia.czas`), `przebieg_id` (= `selly_sync_log.id`),
   `kod`, `nazwa`, `ean`, `dostawca`, `kod_importu`, `selly_product_id`, `selly_variant_id`, `akcja`.
2. **Zapisywane są tylko trzy akcje „usunięte":** `usunieto_wariant`, `usunieto_produkt`, `juz_nie_istnial`
   (te same, które dziś trafiają do `audit_log`). Pominięte i błędy nie wchodzą — to historia usunięć.
3. **`audit_log` i `selly_sync_log` bez zmian** (decyzja użytkowniczki). Nowy zapis idzie obok `zapiszHistorie`,
   we własnym `try/catch`: `DELETE` w Selly już się wykonał, więc awaria zapisu nie może przerwać reszty przebiegu.
4. **Wzorzec CSV z `analityka/csv.ts`** (BOM + średnik); dla pustej historii oddajemy BOM + wiersz nagłówka
   (a nie sam BOM), żeby plik nie był pusty. Kolumny po polsku/snake_case jak reszta Selly.
5. **UI:** karta „Usunięte z Selly" w zakładce Selly pod kartą „Usuwanie z Selly": tabela, 20 na stronę
   (Poprzednie/Następne), licznik „razem", przycisk „Pobierz CSV".
6. **NIE zmieniamy** logiki usuwania, bezpieczników ani `SELLY_USUWANIE` (jego włączenie to osobna decyzja).
7. **Odstępstwo od oryginału:** funkcja całkowicie NOWA (oryginał nie usuwał nic z Selly) — oznaczone w spec i kontrakcie.

## Implementation plan
1. `rebuild/schema/023_selly_usuniecia.sql` — `CREATE TABLE IF NOT EXISTS` + 2 indeksy (idempotentna); wpis w `rebuild/schema/README.md`.
2. `src/repos/selly-usuniecia.ts` — `zapiszUsuniecie`, `listaUsuniec(limit, offset)`, `wszystkieUsuniecia`, `csvUsuniec`.
3. `src/selly/rest/sync-usuwanie.ts` — wywołanie zapisu obok `zapiszHistorie` (własny `try/catch`).
4. `src/routes/selly.ts` — dwie trasy GET.
5. `contract/openapi.yaml` — dwie ścieżki.
6. Frontend: `pages/selly/api.ts` (typy, `pobierzUsuniete`, `pobierzCsvUsunietych`), `SekcjaUsuniete.tsx`, wpięcie w `pages/Selly.tsx`,
   handler MSW w `test/msw/kontrakt.ts` + `test/msw` (pułapka z CLAUDE.md: brak handlera nie wywala testu).
7. Testy backendu i frontendu. Dokumentacja: `docs/spec-backend/wpis-195.md`, `raport.md`, `review.md`.

## Testing strategy
- Backend (prawdziwy SQLite, atrapa Selly z `test/gate`): przebieg zapisuje wiersze dla trzech akcji i NIE zapisuje
  pominiętych/błędów; wiersze niosą `przebieg_id` z `selly_sync_log`; historia nie jest przycinana (więcej wpisów niż mieści
  się w 8000 znakach `szczegoly_json`); awaria zapisu historii nie przerywa przebiegu; trasy: auth, kolejność, paginacja,
  CSV (BOM, średnik, cudzysłowy, nagłówek przy pustej).
- Frontend (MSW): karta pokazuje wiersze, paginację, stan pusty; przycisk CSV woła trasę i pobiera plik.
- GATE: nie dotyka istniejących fixtures (trasy nowe) — wynik w `raport.md`.

## Out of scope
- Włączenie `SELLY_USUWANIE`. Zmiana logiki/limitów Toru 3. Przenoszenie starych wpisów z `audit_log` (usuwanie jeszcze
  nigdy nie działało na produkcji — nic do przeniesienia). Filtry/wyszukiwarka w nowej karcie.

## Definition of done
- [ ] Każda usunięta pozycja ma wiersz w `selly_usuniecia` z numerem przebiegu
- [ ] Karta „Usunięte z Selly" pokazuje listę (najnowsze pierwsze, paginacja) i pobiera pełny CSV
- [ ] Migracja idempotentna, `npm run migrate` na istniejącej bazie nie wymaga kroków ręcznych
- [ ] lint, typecheck, build, testy (backend i frontend) zielone po synchronizacji z `develop`; PR `MERGEABLE`
