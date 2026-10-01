# 177-FEATURE-scal-karty-auto — raport

## Summary
Skrypt `npm run scal-karty-auto` (domyślnie dry-run z raportem CSV, `--apply` z backupem, `--zeruj-selly`) scala karty AUTO z prawdziwymi.

## Changes
- **New:** `rebuild/schema/018_scalone_karty_auto.sql`, `src/import/migracje/scal-karty-auto.ts`, `scripts/scal-karty-auto.ts`, `test/scal-karty-auto.test.ts`.
- `package.json` — skrypt `scal-karty-auto`; `test/db.migracje*.test.ts` — liczniki (38 tabel, 22 indeksy, 018).

## Deviations from plan
Status/znacznik R zmieniany tylko przy stanie oferty > 0. Krok 8 speca (odświeżenie dostępności) zostawiony operatorowi.
Zerowanie wariantów Selly jako osobny, ponawialny krok. Brak osobnego reviewera (jak w 176).

## Test results
Gate API: N/D. 9 nowych testów (dry-run, scalenie, Selly oba/tylko A, błąd Selly, poprawki, do_recznej, 2×A→R, brak oferty).
Pełne bramki backendu zielone po synchronizacji z `develop` (5e2806b).

## Breaking changes
None.

## Follow-up
- Uruchomić dry-run na kopii prod, pokazać Annie `do_recznej` (otwarte pytanie 1 speca), dopiero potem `--apply`.
- Po `--apply`: `npm run selly:csv`, delta sync, `--zeruj-selly`; sprawdzić SQL 1–3 ze speca.
- Cel „≤ 5 zgłoszeń Brak starego kodu” i „kolejny import MO5/MO4 bez nowych AUTO” — do zmierzenia na danych prod.
