# 204-FEATURE-filtr-brak-zdjecia — Implementation report

## Summary
Pod podsumowaniem podglądu „Uzupełnianie zdjęć" jest link do katalogu z filtrem „Brak zdjęcia" (`?status=brak_zdjecia`), który pokazuje tylko produkty bez linku do zdjęcia.

## Changes
- `rebuild/frontend/src/pages/katalog/filtrowanie.ts` — tryb `brak_zdjecia` w `filtrujStatus`.
- `rebuild/frontend/src/pages/Katalog.tsx` — opcja „Brak zdjęcia" w dropdownie statusu (deep link działa przez istniejący mechanizm).
- `rebuild/frontend/src/pages/konfiguracja/UzupelnianieZdjec.tsx` — link pod podsumowaniem.
- Testy: `katalog.filtrowanie.test.ts`, `katalog.test.tsx`, `konfiguracja.admin.test.tsx`.

## Deviations from plan
None.

## Test results
- **Gate kontraktu:** N/D — nie dotyka API (filtr po stronie frontendu).
- Frontend: lint ✓, typecheck ✓, `npm test` ✓ (1080). Backend nietknięty.

## Breaking changes
None.

## Follow-up
- Link w podsumowaniu znika po zapisie propozycji (podgląd się zamyka); wejście do pozycji bez linku zostaje przez filtr „Brak zdjęcia" w katalogu.
