# Wpis do spec-backend od ticketu 195 (źródła cenników, kroki odłożone) · 2026-10-07

- Krok wdrożenia może zwrócić `{ odloz: "powód" }` (`kroki/runner.ts`): nie jest zapisywany w `kroki_wdrozenia`, wynik zawiera `odlozone`,
  wdrożenie nie jest przerywane, a krok ponawia się przy następnym wdrożeniu. Używa go `2026-10-07-zrodla-cennikow-foldery` przy braku katalogu/folderu.
- `podmienZrodla` zwraca `{ zmiany, braki }`. Za stare źródło uznaje też lokalną ścieżkę leżącą bezpośrednio w `imports/` (MO9 `agrorami.csv`);
  jawne pliki wewnątrz folderu dostawcy (MO4/MO5) zostają.
