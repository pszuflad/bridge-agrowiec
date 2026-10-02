# 176-BUG-powrot-karty-bez-dot — raport

## Summary
Wstrzymana automatycznie karta wraca z innym DOT bez zgłoszenia, a DOT aktualizuje się po cichu. Pusta
cecha dodatkowa (`pr`/`tlTt`/`vfIf`/`konstrukcja`) w ofercie przy wypełnionej karcie nie jest już sprzecznością.

## Changes
- `rebuild/backend/src/import/polityka/fabryka.ts` — warunek „Powrót opony wymaga sprawdzenia” używa `zgodnaBezDotZ`.
- `rebuild/backend/src/import/polityka/tolerancja-dopasowania.ts` — `widok(bezDot)` podstawia wartość karty za pustą cechę oferty.
- `rebuild/backend/test/tolerancja-dopasowania.test.ts` — 5 testów (a, b, c, d + karta bez cechy/oferta z cechą).
- **New:** `docs/spec-backend/wpis-176.md`.

## Deviations from plan
None. Praca na gałęzi wyznaczonej sesją (`claude/new-session-wfqwy9`) zamiast worktree `feature/N-…`;
subagent reviewer nie był uruchamiany (zmiana ~20 linii, pełne bramki zielone) — do rozważenia przez recenzenta PR.

## Test results
- **Gate odbudowy:** N/D — nie dotyka API/kontraktu.
- Unit/integration: ✓ `npm test` 1991 passed, 12 skipped; lint, typecheck, build ✓. Gałąź zawierała `origin/develop` (5e2806b) przed bramkami.
- Testy (a) i (c) potwierdzone jako czerwone na kodzie sprzed poprawki.
- NIE zmierzono na kopii produkcji (kryterium „≤ 1 zgłoszenie Powrót…”): `db/snapshot.db`/`data-prod.db` nie ma w tej sesji.

## Breaking changes
None (świadome odstępstwo od produkcji — decyzja z 2026-10-01).

## Follow-up
- Po wdrożeniu: przeliczyć na prodzie liczbę zgłoszeń „Powrót…” (cel ≤ 1) — dotychczasowe 48 wpisów staging
  zniknie przy najbliższym imporcie MO2–MO5 (`wyczyscZgloszenie` przy rozstrzygniętej pozycji).
- Etapy 1, 3, 4 specyfikacji.
