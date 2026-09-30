# 165-BUG-rozdziel-kod-importu — raport implementacji

## Summary

Dodano jednorazowy skrypt migracyjny `rozdziel-kod-importu.ts`, który dla znanych kolizji
`kod_importu` (te same 174/80 grup z ticketu 164, `docs/rebuild-backlog.md` #108) nadaje nowy,
unikalny numer każdemu produktowi w grupie oprócz pierwszego. Rozwiązuje pętlę synchronizacji
do Selly co 15 minut (Tor 1 nadpisywał sobie nawzajem zapamiętany stan w `selly_products`).
Automatyzacja w `tools/deploy-produkcja.sh` — bez potrzeby logowania SSH przez użytkownika.

## Changes

- **New:** `rebuild/backend/src/import/rozdzielKodImportu.ts` — `sparsujWierszeKolizji()`
  (parsowanie tego samego CSV z ticketu 164, teraz wykorzystuje kolumnę `kod_importu`) +
  `rozdzielKodImportu()` (grupowanie po `(dostawca, kodImportu)`, przenumerowanie wszystkich
  poza pierwszym produktem w grupie, idempotencja).
- **New:** `rebuild/backend/scripts/rozdziel-kod-importu.ts` — cienki wrapper CLI.
- **New:** `rebuild/backend/test/rozdziel-kod-importu.test.ts` — 6 testów.
- `rebuild/backend/package.json` — skrypt `rozdziel-kod-importu`.
- `tools/deploy-produkcja.sh` — nowy krok po naprawie nazw, bezwarunkowy (bez pliku-znacznika,
  wnioski z 164c/164d zastosowane od razu).

## Deviations from plan

Brak — zgodne z `plan.md`.

## Test results

- Gate odbudowy: N/D — zmienia wyłącznie `products.kod_importu`, nie dotyka API/kontraktu.
- Unit: 6/6 zielone (`rozdziel-kod-importu.test.ts`).
- Pełny `npm test`: 1920 passed, 12 skipped.
- `npm run lint` / `npm run typecheck` / `npm run build`: zielone.
- Weryfikacja manualna end-to-end: zasiano parę MO1 (kod_importu=326606) na tymczasowej bazie,
  uruchomiono skrypt — pierwszy produkt zachował `326606`, drugi dostał nowy `472435`.

## Breaking changes

Świadoma, zaakceptowana przez użytkownika zmiana zachowania: produkty z nowym `kod_importu`
zostaną przy najbliższym discovery Selly potraktowane jako NOWE produkty (tak jak już dzieje się
w Bridge) — nie jako warianty istniejącej, wspólnej karty. Odstępstwo od 1:1 z oryginałem,
świadomie zatwierdzone.

## Follow-up

**WAŻNE — znana z ticketu 164d kwestia czasowa `deploy-produkcja.sh`:** skrypt deployu
aktualizuje sam siebie w trakcie działania (`git reset --hard` mid-execution), więc zmiana W TYM
PLIKU (dodanie kroku 165) ujawni się dopiero przy DRUGIM deployu po zmergowaniu tego PR-a, nie
przy pierwszym — analogicznie jak przy 164c/164d. Po zmergowaniu do `main` trzeba będzie:
1. poczekać na pierwszy automatyczny deploy (nic nowego nie zrobi w kroku 165, bo uruchomi
   jeszcze POPRZEDNią wersję skryptu bez tego kroku),
2. wypchnąć dowolną, choćby kosmetyczną zmianę dotykającą `tools/deploy-produkcja.sh` (albo
   `rebuild/**`), żeby wywołać DRUGI deploy — dopiero on faktycznie wykona krok 165.

Zrobię to sam po zmergowaniu, bez angażowania użytkownika.
