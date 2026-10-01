# 178-FEATURE-normalizacja-pozycji — raport

## Summary
Pozycje cennika są normalizowane po parserze (model, bieżnik, DOT, konstrukcja, indeksy), a model porównywany kluczem
niewrażliwym na spacje/myślniki/dopiski. Czyszczenie katalogu: `npm run normalizuj-katalog`.

## Changes
- **New:** `src/import/polityka/normalizacja-pozycji.ts`, `src/import/slowniki/modele-producenta.ts`,
  `src/import/migracje/normalizuj-katalog.ts`, `scripts/normalizuj-katalog.ts`, `test/normalizacja-pozycji.test.ts`, `test/normalizuj-katalog.test.ts`.
- `polityka/fabryka.ts` (wywołanie `normalizujPozycje`), `polityka/tolerancja-dopasowania.ts` (`kluczModelu` w `widok`),
  `package.json`, mocki w `test/silnik.charakteryzacja.test.ts` i `test/silnik.polityka-zrodla.test.ts`.

## Deviations from plan
Poprawki w warstwie TS zamiast w `legacy/parsers` (pinned sha256); konstrukcja do formy słownej; brak przenoszenia dopisków do
`zastosowanie`; słownik w TS i pusty; brak zmiany `identity()`/migracji `source_key`. Wszystko opisane w plan.md. Brak osobnego reviewera.

## Test results
Gate API: N/D. `npm test`: 2047 passed / 12 skipped; lint, typecheck zielone.

## Breaking changes
Klucz źródłowy (`sourceKey`) rekordów, którym zmienia się model (HS/dopiski), zmienia się — ewentualne zapamiętane ręczne dopasowanie
dla nich wróci do pytania jeden raz.

## Follow-up
- Anna: wpisy do `modele-producenta.ts` (T-539/T539, RD-01, EM-22, AS-AGRI 10, L-T20…).
- Uruchomić `normalizuj-katalog` w dry-run na kopii prod, obejrzeć CSV, potem `--apply` (przed importem).
- Zmiany nazw produktów (otwarte pytanie 2 speca) — osobna decyzja.
- Pomiar liczby zgłoszeń po imporcie MO2–MO5/MO9 i po 24 h.
