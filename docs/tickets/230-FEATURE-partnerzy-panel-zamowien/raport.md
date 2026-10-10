# 230 — Raport (PRT-7.6a)

## Summary
Dodano podgląd zamówień odebranych od partnera: dwie trasy odczytu i sekcję „Zamówienia od partnera” na stronie partnera. Tylko odczyt.

## Changes
- `rebuild/backend/src/repos/partnerzy-zamowienia.ts` — `listaZamowien` z `limit`/`offset` i `liczbaPozycji`, `szczegolyZamowieniaDlaPartnera`
- `rebuild/backend/src/routes/partnerzy.ts` — `GET /api/partnerzy/:id/zamowienia` i `…/:zamowienieId`
- **Nowe:** `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx`, typy w `pages/partnerzy/api.ts`, wpięcie w `PartnerSzczegoly.tsx`
- Testy: `backend/test/partnerzy.zamowienia-trasy.test.ts` (6), `frontend/test/partnerzy.zamowienia.test.tsx` (6); w trzech istniejących testach stron partnera dopisany handler MSW listy zamówień (nowe zapytanie w widoku, który ma już testy — zob. CLAUDE.md o MSW)
- Docs: `docs/spec-backend/wpis-230.md`, `docs/karty/PARTNERZY/karta.md`

## Deviations from plan
Brak.

## Test results
- **Gate kontraktu:** N/D — nowe trasy poza `openapi.yaml`/fixtures (jak reszta `/api/partnerzy*`); żadna istniejąca trasa się nie zmienia.
- Backend i frontend: zob. PR (pełne bramki po synchronizacji z `develop`).
- Test złapał błąd w podzapytaniu liczącym pozycje (zob. `wpis-230.md`).

## Breaking changes
None.

## Follow-up
- Statusy, błędy importu i powiązanie z Selly (PRT-7.4/7.5); „Odbierz teraz” (wymaga wstrzyknięcia IMAP do aplikacji); filtry i wyszukiwanie.
