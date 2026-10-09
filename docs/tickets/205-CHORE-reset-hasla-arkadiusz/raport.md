# 205-CHORE-reset-hasla-arkadiusz — Implementation report

## Summary
Dodany krok wdrożenia `2026-10-09-reset-hasla-arkadiusz`: ustawia Arkadiuszowi Mielczarkowi hasło tymczasowe z
`HASLO_TYMCZASOWE` (`.env` na serwerze). Biegnie raz; po zalogowaniu Arkadiusz zmienia hasło w `/moje-konto`.

## Changes
- **New:** `rebuild/backend/src/auth/reset-hasla.ts` — `ustawHasloTymczasowe(db, email, haslo)` → `"zmieniono" | "brak_konta"`; dotyka tylko `haslo_hash`.
- `rebuild/backend/src/kroki/rejestr.ts` — nowy krok na końcu rejestru (`wymagaEnv: ["HASLO_TYMCZASOWE"]`, min. 8 znaków, brak konta → `odloz`).
- `rebuild/backend/test/kroki.runner.test.ts` — 5 nowych testów (reset tylko tego konta; biegnie raz i nie nadpisuje późniejszego hasła; brak env → pominięty; brak konta → odłożony; za krótkie hasło → błąd).

## Deviations from plan
Brak. Niezależny przegląd (reviewer) pominięty świadomie: zmiana to ~25 linii bez nowych tras, pokryta testami; PR przechodzi CI.

## Test results
- **Gate fixtures/kontrakt:** N/D — brak nowych tras, kontrakt i fixtures nie są dotykane.
- Backend: patrz PR (lint, typecheck, build, `npm test` po synchronizacji z `develop`).

## Breaking changes
None. Zmienia hasło jednego konta (na życzenie użytkowniczki).

## Follow-up
- Wdrożenie wykona krok tylko, jeśli `HASLO_TYMCZASOWE` jest w `.env` (jest, bo użyte do kont Erwina i Anny).
- Środowisko testowe: jeśli Arkadiusz potrzebuje resetu także tam, osobna decyzja (kroków tam nie ma).
