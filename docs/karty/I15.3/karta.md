# I15.3 — blokowane formy płatności w katalogu + eksport CSV Selly

> **Stan:** ⬜ po I15.1 (fala 2)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #73, #76, #77 (część CSV) · **Zależy od:** I15.1
> **Ticket:** —

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
- **#73 w API i UI:** pole blokowanych form płatności w odpowiedzi katalogu (zmierz na oryginale z `origin/main`,
  jak produkcja je wystawia — klucz i trasa) + kolumna „Blokowane formy płatności” w `/katalog` (port
  `mirror/frontend/assets/payment-blocks-injection.js` z `origin/main`, z poprawką `routefix` — router haszowy).
- **#73 w CSV:** 60. kolumna pełnego eksportu CSV dla Selly (`generate_selly_export.cjs` na `origin/main`).
- **#76:** `toSellyCategoryName` — nazwy kategorii sklepu, mapowanie `ł`→`l` (pkt 1–2; pkt 3 — nagłówek `R/D` —
  odbudowa już ma).
- **#77 (część CSV):** produkty `wstrzymany` trafiają do eksportu ze stanem 0. Część delta → I15.6.
Nagrania/fixture CSV: przenagraj z oryginału na `origin/main`. ⚠ `contract/fixtures` → bramki OBU stron.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/generator-csv.ts` (+ fixture CSV), projekcja pola w trasie katalogu, `rebuild/frontend/src/pages/katalog/**`
(kolumna), `contract/openapi.yaml` (pole). NIE: `rebuild/schema/` i model (I15.1), `src/selly/rest/**` (I15.6–I15.8).

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
