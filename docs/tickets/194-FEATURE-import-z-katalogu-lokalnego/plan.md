# 194 — Cennik dostawcy z pliku na serwerze (katalog imports/selly-agroopony)

## Problem (2026-10-07)
`agroopony.eu` wskazuje Selly (212.91.26.121) także w DNS serwera vpshd86. URL-e
`https://agroopony.eu/imports/...` nie działają — MO4, MO5, MO9: „fetch failed”, status `blad`.

## Rozwiązanie
Dostawcy wgrywają pliki przez FTP do `/home/admin/domains/agroopony.eu/public_html/imports/selly-agroopony/<MOx_…>/`
(katalog przygotowany przez Erwina, niewidoczny z internetu). Bridge działa na tym samym serwerze, więc czyta plik z dysku.

- `src/import/plik-lokalny.ts`: pole URL dostawcy może być ścieżką bezwzględną albo `file://`.
  Odczyt tylko spod `IMPORT_KATALOG_LOKALNY` (domyślnie `/home/admin/domains/agroopony.eu/public_html/imports`),
  `..` i dowiązania poza katalog są odrzucane. Brak pliku = jak HTTP 404 (alert, bez ponowień).
- `synchronizuj.ts` (scheduler) i `pobierz.ts` (ręczne „pobierz z URL”) obsługują ścieżkę lokalną.
- Test: `test/plik-lokalny.test.ts`.

## Po wdrożeniu (dane)
MO4 → `.../MO4_rfkPTMLAB05QUA2H/agrowiec_wr.csv`, MO5 → `.../MO5_EqOYuDlbOyJZ9ckg/agrowiec_mw.csv`.
MO9 pobiera CSV, ale ceny bierze z API GraphQL — do ustalenia plik w `MO9_…`.
