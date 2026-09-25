# 155-FEATURE-dziedziczenie-wagi-po-rozmiarze — raport implementacji

## Summary

Dodano nowy mechanizm dziedziczenia wagi produktu po marce+rozmiarze+bieżniku (NOWA logika
biznesowa, nie odtworzenie produkcji — potwierdzone w kroku research). Gdy nowy produkt (import
albo ręczne dodanie z UI, jedna wspólna ścieżka zapisu) trafia bez wagi albo z wagą `0`, a w
bazie jest już inny produkt tej samej marki/rozmiaru/bieżnika z wypełnioną wagą, nowy produkt
dziedziczy najwyższą wagę spośród pasujących kandydatów. Dodano też skrypt CLI do wstecznego
dociągnięcia wagi dla produktów już w katalogu oraz widoczny w UI tooltip/ikonę przy wadze
uzupełnionej automatycznie.

## Changes

- `rebuild/schema/014_waga_auto_uzupelniona.sql` — **nowa migracja**: `products.waga_auto_uzupelniona`
  (nullable, `DEFAULT 0`, celowo bez `NOT NULL` — patrz „Odstępstwa od planu").
- `rebuild/backend/src/db/schema.ts` — nowa kolumna w modelu Drizzle (`integer(...boolean).default(false)`).
- `rebuild/backend/src/import/dziedziczenieWagi.ts` — **nowy moduł**: `jestPustaWaga`,
  `kluczZRekordu`, `znajdzWageDoDziedziczenia`, `applyWagaDziedziczona`. Cała nowa logika,
  odseparowana od portu (`bridge-ext.ts`).
- `rebuild/backend/src/import/akceptacja.ts`, `rebuild/backend/src/import/bulk.ts` — wpięcie
  `applyWagaDziedziczona` tuż po `applyWagaPamiec` (priorytet pamięci wagi/ręcznej edycji
  wynika z kolejności wywołań). `bulk.ts` obsługuje też `POST /api/products` (ręczne dodanie).
- `rebuild/backend/src/repos/products.ts` — `aktualizujProdukt`: ręczna edycja pola `waga`
  resetuje `wagaAutoUzupelniona` na `false`.
- `rebuild/backend/scripts/dziedzicz-wage.ts` — **nowy skrypt CLI** (`npm run dziedzicz-wage`,
  wymaga `DB_PATH`), dociąga wagę wstecznie dla produktów z pustą/zerową wagą, pomijając te
  chronione ręczną poprawką (`manual_overrides.fieldName = 'waga'`).
- `contract/openapi.yaml` — dodane pole `wagaAutoUzupelniona: boolean` do schematu produktu
  (wygenerowane ponownie przez `tools/generate-openapi-schemas.cjs` z fixtures).
- `contract/fixtures/GET_products.json`, `GET_products_bez-parametrow.json`,
  `PUT_products_id.json`, `PATCH_products_id.json` — dopisane pole `wagaAutoUzupelniona: false`
  do każdego istniejącego obiektu produktu (rozszerzenie kontraktu, nie zmiana istniejących pól).
- `rebuild/frontend/src/pages/katalog/filtrowanie.ts` — typ `Produkt` ma opcjonalne
  `wagaAutoUzupelniona?: boolean`.
- `rebuild/frontend/src/pages/katalog/formatowanie.tsx` — nowa gałąź dla kolumny `waga`:
  przy `wagaAutoUzupelniona === true` renderuje wartość + ikonę `Info` (lucide-react) z
  tooltipem `title` (decyzja użytkownika: tylko ikona/tooltip, bez stałego Badge).
- Testy: `test/dziedziczenie-wagi.test.ts` (22 jednostkowe), `test/dziedziczenie-wagi.integracja.test.ts`
  (4 integracyjne na realnym SQLite), `test/katalog.formatowanie.test.tsx` (+3 dla renderera wagi).
- Poprawki gate'ów po dodaniu kolumny (patrz „Odstępstwa od planu" — nieprzewidziane w planie,
  ale konieczne, żeby istniejące testy nie fałszywie czerwieniły się z powodu nowej kolumny):
  `test/db.migracje.test.ts`, `test/db.migracja-011.test.ts`, `test/db.migracje-produkcja.test.ts`,
  `test/katalog.gate.test.ts`, `test/produkty.mutacje.test.ts`, `test/projekcja.test.ts`,
  `test/charakteryzacja/silnik/wzorzec.mjs` (normalizacja snapshotu silnika stagingu — nowa
  kolumna jest generycznie snapshotowana razem z całym wierszem `products`, mimo że nie ma z nią
  nic wspólnego; usuwana z porównania tak samo jak `_catalogVersion`).

## Odstępstwa od planu

1. **Kolumna `waga_auto_uzupelniona` jest NULLABLE, nie `NOT NULL DEFAULT 0`, jak plan zakładał.**
   Powód: `test/charakteryzacja/silnik/polityka.mjs` (`stworzPolitykeOryginalu`) wstawia produkty
   testowe RAW SQL-em, jawnie podając `NULL` dla każdej kolumny, której scenariusz nie ustawił
   (introspekcja `PRAGMA table_info`) — `NOT NULL` wywracało ten insert. Aplikacja i tak traktuje
   `null`/`undefined` jak `false` (falsy), więc semantyka jest identyczna; przy zapisie przez
   Drizzle (import/ręczne dodanie) kolumna i tak dostaje `false`/`true` explicite albo SQL
   `DEFAULT 0`.
2. **Nieprzewidziane w planie: siedem plików testowych i fixtures wymagało aktualizacji liczby
   kluczy (72→73/74) po dodaniu kolumny do `products`/kontraktu.** Plan zakładał tylko sprawdzenie
   zgodności fixtures z kontraktem — nie przewidział, że sama LICZBA kluczy produktu jest
   zaszyta w kilku niezależnych testach charakteryzacyjnych/gate. Wszystkie poprawki są
   mechaniczne (aktualizacja liczby/listy oczekiwanych kluczy), nie zmieniają zachowania.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne — rozszerzenie, nie łamanie. `GET_products.json`,
  `GET_products_bez-parametrow.json`, `PUT_products_id.json`, `PATCH_products_id.json`
  zaktualizowane o nowe pole; `contract/openapi.yaml` przebudowany generatorem z fixtures
  (`test/kontrakt.spojnosc.test.ts` zielony — schemat jest AKTUALNY wobec fixtures).
- Unit: ✓ 22/22 (`dziedziczenie-wagi.test.ts`) — `jestPustaWaga`, `kluczZRekordu`,
  `znajdzWageDoDziedziczenia` (MAX przy rozjeździe, tolerancja pustego bieżnika w obie strony,
  wykluczenie kandydatów z pustą/zerową wagą, brak dopasowania po marce/rozmiarze/konstrukcji).
- Integration: ✓ 4/4 (`dziedziczenie-wagi.integracja.test.ts`) — dziedziczenie przez
  `dodajProduktyBulk` (pokrywa import bulk i `POST /api/products`), priorytet wagi z importu,
  reset flagi przy ręcznej edycji przez `aktualizujProdukt`.
- Frontend: ✓ 3/3 nowe (`katalog.formatowanie.test.tsx`) — brak ikony bez dziedziczenia, ikona +
  tooltip z dziedziczeniem, pusta waga nadal jako kreska.
- Backend pełny: ✓ `npm run lint && npm run typecheck && npm run build && npm test` —
  **1871/1871 testów zielonych** (12 pominiętych, jak wcześniej), 0 regresji.
- Frontend pełny: ✓ `npm run lint && npm run typecheck && npm run build && npm test` —
  **995/995 testów zielonych**, 0 regresji.
- Skrypt backfill: ✓ ręcznie zweryfikowany na tymczasowej bazie (3 produkty tej samej
  marki/rozmiaru/bieżnika: jeden z wagą 78, jeden z wagą 0, jeden z wagą `null` — backfill
  zaktualizował 2/2 oczekiwanych, log: „zaktualizowano 2/2 produktów").

## Breaking changes

Brak. Rozszerzenie kontraktu (nowe opcjonalne pole `wagaAutoUzupelniona`), zgodne wstecznie.

## Follow-up

- Skrypt `dziedzicz-wage` nie jest uruchamiany automatycznie nigdzie — użytkownik (Ania)
  odpala go ręcznie po wdrożeniu, kiedy zechce dociągnąć wagi wstecznie. Warto rozważyć wpisanie
  jednorazowego przebiegu do procedury cutoveru, jeśli użytkownik chce mieć katalog uzupełniony
  od razu po wdrożeniu (decyzja użytkownika, nie zrobione automatycznie w tym tickecie).
- Backfill NIE jest opakowany w transakcję SQL na poziomie całego przebiegu (każdy `UPDATE` jest
  osobnym zapisem) — przy bardzo dużym katalogu mogłoby to być wolniejsze niż wsad
  transakcyjny; przy obecnej skali katalogu (rząd tysięcy produktów) nie jest to problemem, więc
  świadomie pominięte dla prostoty kodu.
