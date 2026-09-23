# 115-DOCS-101-zamkniete — zamknięcie wpisu #101

## Podsumowanie
Ania potwierdziła 2026-09-23, że nigdzie nie widzi pustych „blokowanych form płatności” — jej
zgłoszenie z 22.09 opierało się na założeniu, że logika nadawania numerów nie istnieje. Istnieje
(triggery `products_blokowane_formy_ai/_au` + `ensurePaymentBlocks()` przy starcie) i jest już
przeniesiona do odbudowy ticketem 107 (migracja 011). Wpis #101 zamknięty, karta I15.7 zaktualizowana.

## Zmiany
- `docs/rebuild-backlog.md` — #101: „Do nowej wersji?” ❌ NIE (temat zamknięty), status ✅ zamknięte
  z cytatem odpowiedzi Ani; usunięte nieaktualne „pytanie do Ani” i rekomendacja „naprawić, jeśli
  potwierdzi się strona Selly”; dopisana luka na przyszłość (brak MO6 w `BLOCKED_PAYMENT_FORMS`,
  dziś bez skutku — MO6 nie ma produktów). Poprawiony odnośnik w #73.
- `docs/karty/I15.7/karta.md` — „Do koordynatora”: prośba o decyzję zastąpiona informacją
  o zamknięciu; zostaje sam fakt, że payload REST nie niesie tego pola (różnica CSV ↔ REST).

## Wyniki testów
Zmiana wyłącznie dokumentacyjna — bramek nie uruchamiano, kod nietknięty.

## Follow-up
- Decyzja o karcie **I15.12** (zmiany Selly Tor 1/Tor 2 z 2026-09-22 19:00, po `7d6cfc9`) — nadal
  otwarta, wpis w backlogu ma status „do decyzji”.
