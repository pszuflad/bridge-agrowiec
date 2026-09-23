# I15.11 — panel „Braki w cenniku” i podgląd starej karty (frontend)

> **Stan:** ⬜ po I15.4b, I15.4c i I15.5 (faza 5)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #103 · **Zależy od:** I15.4b, I15.4c (dane i trasy), I15.5 (ten sam widok Staging)
> **Ticket:** —

Przepisana z karty-rezerwy przez koordynatora (ticket 110, triaż 22.09 wieczór). Źródło prawdy: `origin/main` na `abe5f14`.

## Zakres
Port zmian panelu z #103: **„Braki w cenniku”** (widok/filtr pozycji, których dostawca nie przysłał, wraz z dowodami
kompletności) i **podgląd starej karty** przy zablokowanych zgłoszeniach „do sprawdzenia”.
⚠ Zmiany poszły w **ŻYWY bundel** `mirror/frontend/assets/index-PRICEFMT1783512500.js` (jedna linia minifikatu)
oraz w `assets/staging-policy-injection.js` (+9 l.) i `index.html`. Rozłóż diff bundla
(`git diff 7d6cfc9 abe5f14 -- mirror/frontend/assets/index-PRICEFMT1783512500.js`) zanim uwierzysz etykiecie —
CLAUDE.md, „nazwa `.bak` daje ETYKIETĘ, nie treść”.

## Pliki (wyłączna własność)
`rebuild/frontend/src/pages/staging/**` (część „Braki w cenniku” i podgląd starej karty), testy FE.
NIE: okno „Rozstrzygnij” (I15.5), backend (I15.4).

## Decyzje
Decyzje D1–D9 z bloku I15 obowiązują.

## Dowiezione
—

## Do koordynatora
—
