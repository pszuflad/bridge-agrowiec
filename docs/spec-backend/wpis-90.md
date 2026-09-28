# Wpis do spec-backend od ticketu 90 (karta P10.1) · 2026-09-22

**Sekcja:** §2 (świadome odstępstwa tras analityki); dotyczy też akapitu o `historia_cen` bez
`nazwa` w §5.
**Przeniesione** z końca §2 `docs/spec-backend.md` ticketem 91, treść bez zmian — przyczyna:
`docs/spec-backend/README.md`.

**Potwierdzone w P10.1** (`90-FEATURE-ozywienie-kart-dostepnosci`, 2026-09-22, karta P10.1):
cztery świadome odstępstwa od produkcji w module analityki (decyzje Ani, 2026-09-21). **#32** —
`availability/products`/`availability/sell-through` (dashboard i oba eksporty CSV) łączą
`historia_cen` z `products` po `(dostawca, kod)` zamiast pytać nieistniejącą kolumnę
`historia_cen.nazwa`; pozycja usunięta z katalogu dostaje `nazwa: null` (JSON) / pustą komórkę
(CSV) zamiast trwale pustego wyniku. **#33** — `sell-through` (dashboard i eksport) liczy
`LAG()` na historii ze zwiniętymi duplikatami klucza `(dostawca, kod, zarejestrowano_at)`
(wiersz `MAX(id)` per klucz); karta 4.1 i jej eksport dalej liczą `COUNT(*)` po surowej
historii (poza zakresem tej decyzji, follow-up). **#31** — `POST /api/analytics/bootstrap-current`
jest teraz idempotentny w obrębie dnia kalendarzowego UTC: drugie wywołanie tego samego dnia
dla produktu z już istniejącą migawką daje `inserted: 0` (kształt `{ok, inserted, at}` bez
zmian). **#35** — `GET /api/analytics/export/{view}` dla nieznanego widoku oddaje `404 {error}`
zamiast `200` + sam BOM. Fixtures nietknięte (oba nagrania mają `rows: []`; `gate/ksztalt.ts`
nie zagląda do elementów pustej tablicy wzorcowej). Szczegóły:
`docs/tickets/90-FEATURE-ozywienie-kart-dostepnosci/`.
