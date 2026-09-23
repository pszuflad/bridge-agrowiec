# I15.5 — Staging v2 — frontend: przycisk i okno „Rozstrzygnij”, komunikaty blokady akceptacji

> **Stan:** ⬜ po I15.4c (fala 4)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #99 · **Zależy od:** I15.4c
> **Ticket:** —

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Port `mirror/frontend/assets/staging-policy-injection.js` (z `origin/main`, wersja `20260922v2`) do widoku `/staging`
w React: przycisk „Rozstrzygnij” przy zgłoszeniach z niejednoznacznym dopasowaniem, okno wyboru (trasy
`review`/`resolve` z I15.4), okno „Nie zapisano zmian” z komunikatem 409 przy blokadzie akceptacji. Teksty
dosłownie. Zachowaj zmiany UI stagingu z I14 (14a/14b/14c) — skrypt wstrzykiwany nie znał ich układu.
⚠ Pułapka MSW (CLAUDE.md): nowe zapytania wymagają handlerów we współdzielonych mockach stagingu.

## Pliki (wyłączna własność)
`rebuild/frontend/src/pages/staging/**`, testy FE stagingu. NIE: backend.

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

—

## Dowiezione
—

## Do koordynatora
—
