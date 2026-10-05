# 186-FEATURE-selly-usuwanie-sierot — raport

## Summary
Dodano Tor 3: po każdym przebiegu Toru 1 (HH:10/25/40/55) usuwa z Selly produkty/warianty, których nie ma już w Bridge, z historią
(kod, nazwa, EAN, id w Selly, dostawca, godzina) w widoku „Historia” i w „Historii operacji” Selly.

## Changes
- **New:** `rebuild/backend/src/selly/rest/sync-usuwanie.ts`; `rebuild/backend/test/selly.usuwanie.test.ts` (12 testów)
- `selly/rest/scheduler.ts` (Tor 3 po Torze 1, opcja `usuwanie`), `config/env.ts` (`SELLY_USUWANIE`, domyślnie true), `server.ts`
- `historia/mapowanie.ts` — akcja `selly_usuniecie` (typ `edycja`); `test/historia.mapowanie.test.ts` — osiem akcji zamiast siedmiu

## Deviations from plan
None.

## Test results
- Gate fixtures/kontrakt: N/D (kształty API bez zmian; testy historii zielone).
- Backend: lint, typecheck, build, `npm test` zielone (137 plików, 2159 testów), na atrapie Selly (żadnych wywołań do prawdziwego sklepu).

## Breaking changes
Po wdrożeniu na produkcji (przy `SELLY_TRYB=pelny` i `SELLY_SCHEDULER=true`) zacznie realnie usuwać z Selly. Wyłączenie: `SELLY_USUWANIE=false`.

## Follow-up
- Na produkcji mogło się nazbierać sierot z przeszłości (rotacje kodów, scalenia, hurtowe czyszczenia); schodzą po 20 na przebieg, a przy >30% mapowań
  przebieg się wstrzymuje (wpis „wstrzymano” w Historii operacji). Pierwszy tydzień warto obejrzeć wpisy.
- Nie zweryfikowano, czy konto API Selly na produkcji ma prawo `DELETE` (zakres `READWRITE`); pierwszy przebieg to pokaże (wpis „błąd” z komunikatem HTTP).
- Czas w historii to UTC (jak reszta bazy).
