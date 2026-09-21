# 91-FEATURE-archiwum-importow — Implementation report

## Summary
Odbudowany ekran „Archiwum importów” (karta PR.1): trzy trasy odczytu `GET /api/import-archive`,
`/stats` i `/file/{month}/{name}` jako port 1:1 z `mirror/backend/archive_module.cjs` oraz
widok React `/archiwum` z pozycją w menu tuż za „Historią”. Widok ma filtry (dostawca, miesiąc,
status), pasek zajętości i przycisk „Pobierz”, który zapisuje surowy plik pod nazwą, jaką plik
miał u dostawcy. Kontrakt i nagrania dla tych tras powstały z oryginału uruchomionego lokalnie.

## Changes
- `tools/record-write-fixtures.cjs` — scenariusz `odegrajArchiwum()`: zapełnia archiwum
  piaskownicy uploadem przez `POST /api/import/parse-file` ORYGINAŁU (MO1.csv, MO6.csv z próbek
  charakteryzacji → `ok`; CSV z niedomkniętym cudzysłowem dla MO7 → `blad`), potem nagrywa
  9 odpowiedzi; `nagraj()` dostał opcjonalne `naglowkiOdpowiedzi` → pole `_naglowki`.
- **New:** `contract/fixtures/GET_import-archive{,_dostawca,_miesiac,_status,_401,_stats,_file,_file_400,_file_404}.json`.
- `contract/openapi.yaml` — trzy ścieżki (`tags: [import-archive]`, Bearer/cookie), schematy
  odpowiedzi przebudowane `tools/generate-openapi-schemas.cjs`.
- `contract/README.md` — krok 7 nagrywarki (archiwum) i format nagrania pliku.
- `rebuild/backend/src/import/archiwum.ts` — funkcje odczytu: `listaArchiwum`, `statystykiArchiwum`,
  `szukajPlikuArchiwum`; eksport `listaPlikow`/`PlikArchiwum`. Zapis bez zmian.
- **New:** `rebuild/backend/src/routes/import-archive.ts` — `trasyArchiwumImportu({ katalogArchiwum })`.
- `rebuild/backend/src/app.ts` — rejestracja obok `trasyImportu`.
- **New:** `rebuild/backend/test/archiwum-importow.gate.test.ts` — 22 testy GATE.
- **New:** `rebuild/frontend/src/pages/ArchiwumImportow.tsx`, `pages/archiwum-importow/dane.ts`,
  `pages/archiwum-importow/TabelaArchiwum.tsx`.
- `rebuild/frontend/src/App.tsx` (trasa `/archiwum`), `src/components/nawigacja.ts` (12. pozycja
  menu, `link-nav-archiwum` — ten sam `data-testid` co w oryginale).
- `rebuild/frontend/test/msw/kontrakt.ts` — loadery nagrań archiwum; **New:**
  `test/archiwum-importow.test.tsx` (13 testów); `test/shell.test.tsx` — 12 pozycji menu.

## Deviations from plan
- Zepsuty plik do statusu `blad`: plan mówił ogólnie „plik, którego parser nie przełknie”.
  Pierwsza próba (losowe bajty jako XLSX dla MO10) przeszła parsowanie z 19 rekordami, bo parsery
  oryginału są pobłażliwe (`xlsx` czyta tekst jak CSV). Użyty CSV z niedomkniętym cudzysłowem
  dla MO7 — `csv-parse/sync` rzuca „Quote Not Closed”.
- D6 (opcje selectów z przefiltrowanej listy) z jedną korektą prezentacji: wybrana wartość zostaje
  na liście opcji, nawet gdy zniknęła z danych. W oryginale `<select>` pokazywał wtedy „Wszyscy
  dostawcy”, choć filtr dalej działał.
- Komunikat błędu listy nie „przykleja się”. W oryginale `state.error` nie było nigdy
  czyszczone, więc błąd wisiał po udanym odświeżeniu, aż do przeładowania strony. React Query
  czyści go sam — nie odtwarzamy tego błędu.
- Generator schematów przemianował współdzielony schemat `{error}` z `GETMeOdpowiedz401` na
  `GETImportArchiveOdpowiedz401` (nazwę bierze z pierwszego alfabetycznie nagrania). Żaden kod
  ani dokument nie odwołuje się do starej nazwy (sprawdzone `grep`em); dotyczy 5 linii `$ref`
  w innych operacjach.

## Test results
- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Archiwum w teście zapełnione tą samą drogą co
  w nagraniu (te same trzy pliki przez `parse-file` odbudowy), więc porównanie obejmuje wartości,
  nie tylko kształt:
  - `GET_import-archive.json`, `_dostawca`, `_miesiac`, `_status` — kształt 1:1 i **wartości 1:1**
    we wszystkich polach poza `id` i `data` (zegar): `dostawca`, `zrodlo`, `uzytkownik`,
    `oryginalnaNazwa`, `rozmiar`, `status`, `blad` (dosłownie ten sam komunikat csv-parse),
    `rekordy` (199 / null / 2), `sha256`. To także potwierdza, że zapis z 3b jest wierny.
  - `GET_import-archive_401.json`, `_file_400.json`, `_file_404.json` — ciała identyczne.
  - `GET_import-archive_stats.json` — kształt 1:1, `limitBajtow`, `retencjaDni` = 7. Jeden jawny
    wyjątek GATE: klucze `perMiesiac` to nazwy katalogów RRRR-MM, zależą od zegara.
  - `GET_import-archive_file.json` — treść bajt w bajt z próbką MO6, `Content-Disposition`
    i `Content-Length` jak w nagraniu. **`Content-Type` różni się wielkością liter w charset:**
    oryginał `text/csv; charset=utf-8` (bundel ma Express z `mime-types`), odbudowa
    `text/csv; charset=UTF-8` (Express 4, `mime` 1.x). Parametr charset jest nieczuły na wielkość
    liter (RFC 9110 §8.3.2) — test porównuje bez niej. Nie ruszamy tego.
  - `contract/openapi.yaml` — wszystkie odpowiedzi JSON walidowane `sprawdzZgodnoscZKontraktem`,
    pobranie `sprawdzZgodnoscZKontraktemNieJson`; `kontrakt.spojnosc.test.ts` zielony.
- **Path traversal — oryginał się broni, odstępstwa brak.** Regex `^\d{4}-\d{2}/[^/]+$` po
  zdekodowaniu parametrów + zakaz `..`. Testy (surowe żądania HTTP, bez normalizacji ścieżki
  po stronie klienta): `..%2F..%2Fdata.db`, `%2E%2E%2F…`, `%2E%2E` jako nazwa i jako miesiąc,
  `2026-9`, `..%5C..%5C`, `a..csv` → 400; surowe `../..` nie trafia w trasę (404, bez pliku).
- **Backend** (`rebuild/backend/`, Node 20): lint ✓, typecheck ✓, build ✓, test ✓ 1491/1491
  (91 plików), w tym nowy GATE 22/22.
- **Frontend** (`rebuild/frontend/`): lint ✓, typecheck ✓, build ✓, test ✓ 904/904 (52 pliki),
  w tym 13 nowych; `test:integracja` ✓ 39/39.
- E2E: pominięte — przepływ pokryty testem widoku (MSW z nagrań) i GATE backendu.

## Breaking changes
Brak. Nowe trasy i nowa pozycja menu; zapis archiwum bez zmian.

## Follow-up
- **Cutover (do koordynatora, zapisane w `docs/karty/PR.1/karta.md`):** `IMPORT_ARCHIVE_DIR`
  na produkcji musi wskazywać `/home/admin/private_apps/bridge/import_archive`, żeby widok
  pokazał pliki sprzed przełączenia. `docs/cutover.md:207` podaje w kolumnie „Domyślna” „obok
  `dist/`”, a w kodzie jest `<cwd>/import_archive` (`archiwum.ts:40`). Do tego pliki starsze
  niż 7 dni (po `mtime`) i tak zniknie pierwszy zapis po cutoverze (rotacja), a proces musi mieć
  do tego katalogu prawo zapisu.
- Dziwactwo oryginału zachowane świadomie: plik, którego nazwa w archiwum zawiera `..`
  (np. `a..csv`), jest nie do pobrania (400), choć zapis takie nazwy przepuszcza.
- Oryginał bez `.meta.json`: plik nie przechodzi filtrów `dostawca`/`status`, choć na liście
  wygląda jak `ok` — zachowane 1:1, przetestowane.
