# 7-FEATURE-silnik-zatwierdzanie-wycofania-overrides — code review

> **Uwaga proceduralna:** review wykonany przez Mastera w sesji głównej, nie przez subagenta
> `reviewer` — ta sesja ma zakaz używania narzędzia Agent. Zakres i format bez zmian:
> pełny diff gałęzi wobec `origin/develop`, ustalenia w kolejności wagi.

Diff: 800 wstawień / 40 usunięć w `src/` i `rebuild/schema/`, plus harness i testy.
Bramki: `lint` / `typecheck` / `build` / `test` (328) — zielone.

---

## BLOCKER

Brak.

Zakres krytyczny — auto-zatwierdzanie, `historia_cen`, próg wycofania, precedencja
override'ów — jest pokryty porównaniem z uruchomionym oryginałem **pole po polu** i dodatkowo
**8 celowymi mutacjami, z których każda została złapana**. To jest mocniejszy dowód niż
przegląd kodu i traktuję go jako główną podstawę tej oceny.

---

## SHOULD-FIX

### 1. ✅ NAPRAWIONE W TRAKCIE — cicha awaria portu `bridge_ext`
`tire_dims.js` jest pierwszym plikiem `.js` w `src/import/legacy/`, a backend deklaruje
`"type": "module"`. `require('./tire_dims.js')` padało, a defensywny `try/catch` w
`bridge_ext.cjs` połykał błąd: `applyDims` zwracało `null`, wymiary paczki nigdy się nie
liczyły — bez wyjątku, bez logu, bez czerwonego testu. To był realny błąd, nie hipoteza:
odtworzony przed naprawą.
**Naprawa:** marker `src/import/legacy/package.json` (`"type": "commonjs"`) + `bridge-ext.test.ts`
sprawdzający WARTOŚCI wymiarów, nie sam brak wyjątku. Strażnik sha256 jawnie pomija ten jeden
plik, a osobny test pilnuje, żeby lista pominięć nie urosła.

### 2. ✅ NAPRAWIONE W TRAKCIE — twardy błąd zamiast cichej awarii w `uchwytSqlite()`
`db.$client` to szczegół implementacyjny Drizzle. Gdyby zniknął przy aktualizacji,
`applyLinkMemory` dostałoby `undefined`, a `bridge_ext` znów by zamilkł (`if (!db) return`).
Funkcja rzuca teraz opisowym błędem; jest test.

### 3. Pętla wycofań: ~1900 osobnych zapisów poza transakcją (wierne, ale warte odnotowania)
Dla MO5 (1989 produktów) pętla woła `aktualizujProdukt` per produkt, a każde wywołanie to
UPDATE + SELECT (zwrot wiersza), przy czym transakcja obejmuje wyłącznie zapis stagingu —
dokładnie jak w oryginale (`:47807-47847` woła `U.updateProduct` poza `ww.transaction`).
**Werdykt: NIE zmieniać w tym tickecie** — to wierne odtworzenie, a zmiana byłaby świadomym
odstępstwem wymagającym decyzji użytkownika. Odnotowane jako follow-up wydajnościowy;
przy dzisiejszych wolumenach (test MO5 ~1,4 s) bez znaczenia.

### 4. `catch {}` wokół `applyDims`/`applyLinkMemory` pozostaje cichy
Wierne wobec oryginału (`catch (_be) {}`), więc zostaje. Ryzyko jest jednak realne — patrz
ustalenie 1 — i dlatego ścieżka ŁADOWANIA modułu jest teraz zabezpieczona osobno (testem
i twardym błędem w `uchwytSqlite`). Cichy pozostaje wyłącznie błąd wykonania samej funkcji,
co jest zamierzone przez autorkę modułu.

---

## NICE-TO-HAVE

### 5. ✅ ZROBIONE — usunięte martwe `?? ""` przy `kod`
`products.kod` jest `notNull()`, więc `dopasowany.kod ?? ""` i `produkt.kod ?? ""` były
martwymi gałęziami sugerującymi nullowalność, której nie ma. Uproszczone do `produkt.kod`,
zgodnie i z typem, i z oryginałem (`u.kod`).

### 6. Duplikat DDL `products` w migracji 003
Migracja przepisuje 73 kolumny (SQLite nie ma `ALTER COLUMN`), więc definicja tabeli istnieje
w repo w dwóch kopiach. **Ryzyko domknięte testem** `db.migracje.test.ts` — porównuje kolumny
żywej tabeli z kanonem `001_schema.sql` i dopuszcza dokładnie dwie różnice (`szerokosc` TEXT,
doklejona `uwaga_cena`). Skuteczność strażnika sprawdzona mutacją (przestawienie dwóch kolumn
→ test czerwony). Zostawiam jak jest: duplikat DDL to standardowa cena za rebuild tabeli
w SQLite, a dryf jest wykrywany.

### 7. Rozmiar artefaktów charakteryzacji: 8,8 MB
`test/charakteryzacja/silnik/` urosło o katalog `overrides/` (12 620 wierszy w projekcji
5 kolumn). Dane są realne i to one odblokowały prawdziwe `Gq()` — bez nich zakres 3d-1 nie
miałby dowodu. Format „jeden JSON na wiersz" utrzymuje diff czytelnym. Akceptowalne.

---

## Ustalenia z przeglądu, które NIE są usterkami — a warto je znać

- **Kolejność wyników `getOverridesFor` jest znacząca.** Brak `ORDER BY` w zapytaniu NIE
  oznacza „kolejność wstawienia": indeks `UNIQUE(supplier_kod, supplier_product_id, field_name)`
  sprawia, że SQLite oddaje wiersze posortowane po `field_name`, a ta kolejność przecieka do
  komunikatu czytanego przez człowieka („plik nadpisuje poprawke Marty: bieznik, model").
  Udokumentowane w `src/repos/overrides.ts` i w atrapach — dodanie `ORDER BY` byłoby ZMIANĄ
  zachowania, nie porządkowaniem.
- **`Gq()` czyta wartość z pozycji WEJŚCIOWEJ, nie z akumulowanej kopii** (`e[s.fieldName]`,
  nie `r[...]`). Ma znaczenie, gdyby dwie poprawki dotyczyły tego samego pola. Odtworzone.
- **Wczesne wyjścia z `Gq()` nie zwracają `srcVals`** (w oryginale `undefined`). Nasz port
  zwraca `{}`, co jest równoważne, bo `srcVals` czyta się wyłącznie gdy `naruszono.length > 0`,
  a to na wczesnych wyjściach nie zachodzi.
- **Wyjątek GATE jest samoczyszczący.** Wyjątek, który przestaje cokolwiek pokrywać, zapala
  test — więc po przenagraniu fixtures w I12 nie da się go przeoczyć. Dodatkowo osobny test
  pilnuje, że lista ma dokładnie jedną pozycję. To odpowiedź na najpoważniejsze ryzyko
  mechanizmu wyjątków: że stanie się cichą furtką.

---

## Werdykt

**Gotowe do merge.** Zakres z planu dowieziony w całości, trzy realne błędy znalezione
i naprawione w trakcie (dwa z nich to były CICHE awarie, które nie zapaliłyby żadnego testu),
skuteczność bramki potwierdzona mutacjami. Zero BLOCKER-ów, ustalenia SHOULD-FIX albo
naprawione, albo świadomie zostawione jako wierne odtworzenie oryginału z zapisanym powodem.
