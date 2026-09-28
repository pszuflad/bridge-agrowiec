# 9-FEATURE-acceptstaging-endpointy-mutacji — code review

> **Uwaga proceduralna:** review wykonany przez Mastera w sesji głównej, nie przez subagenta
> `reviewer` — ta sesja ma zakaz używania narzędzia Agent. Zakres i format bez zmian:
> pełny diff wobec `origin/develop`, ustalenia w kolejności wagi.

Diff: 806 wstawień / 11 usunięć w `src/`, plus harness i trzy pliki testów.
Bramki: `lint` / `typecheck` / `build` / `test` (387) — zielone.

---

## BLOCKER

Brak.

Zakres krytyczny — `acceptStaging` — jest pokryty porównaniem KOŃCOWEGO STANU SIEDMIU TABEL
z uruchomionym oryginałem wyciętym z produkcyjnego bundla, na 16 scenariuszach. Do tego
**16 mutacji, wszystkie złapane**. To jest podstawa tej oceny; przegląd kodu jest wtórny.

---

## SHOULD-FIX

### 1. ✅ NAPRAWIONE W TRAKCIE — trzy testy, które niczego nie pilnowały
Testowanie mutacyjne wykazało, że trzy mutacje przechodzą na zielono:
- **sortowanie listy poprawek** (`createdAt` malejąco) nie było w ogóle sprawdzane — a jest
  częścią kontraktu i widać je w nagranej próbce (od 06:22:26 do 06:22:00);
- **pola spoza listy edytowalnych** w `PUT /api/staging/{id}` — mój test sprawdzał kolumny
  wiersza, ale nie snapshot, a to właśnie przez snapshot pole przeciekłoby do katalogu;
- **D5** — mutacja była POZORNA: `zmiany.acknowledgedSourceValue = undefined` jest przez
  Drizzle ignorowane w `.set()`, więc „zawsze nadpisuj" nic nie zmieniało.
Testy wzmocnione, mutacja poprawiona (`?? null`), komplet świeci. **To jest realna wartość
testowania mutacyjnego w tym tickecie — bez niego trzy luki pojechałyby dalej.**

### 2. `req.user!` — trzy asercje non-null w trasach
`src/routes/overrides.ts:60`, `src/routes/staging-mutacje.ts:171` i `:305`. Wszystkie trzy
siedzą za `requireAuth`, który zwraca 401 przy braku `req.user` (`middleware/auth.ts:39-44`),
więc gwarancja jest realna — i **przetestowana**: „wszystkie trasy mutacji wymagają tokenu"
sprawdza 401 na ośmiu ścieżkach. Zostawiam. Alternatywa (`req.user?.id ?? null`) wymagałaby
dopuszczenia `null` w `createdBy` tam, gdzie oryginał zawsze ma id użytkownika, czyli
osłabiłaby typ zamiast go wzmocnić.

### 3. `tylkoKolumnyProduktu()` — odstępstwo techniczne, nie logiczne
Oryginał podaje Drizzle'owi cały zbudowany rekord, łącznie z polami pomocniczymi ze snapshotu
(`_srcConflict`, `rozmiarWykryty`). Produkcyjna wersja ORM-a je ignorowała, nasza rzuca —
stąd odsiew po `Object.keys(products)`. **Werdykt: zostaje**, bo zapisujemy dokładnie te
kolumny, które zapisałaby produkcja, i potwierdza to charakteryzacja (porównanie całych
wierszy `products`, nie wybranych pól). Opisane w kodzie jako most między zachowaniami ORM-a.

---

## NICE-TO-HAVE

### 4. Duplikacja obsługi `allFiltered` — świadomie NIE usunięta z tras
Oryginał ma ten sam blok filtrów dosłownie dwa razy (`accept` i `reject`). U nas jest raz,
w `wybierzId()` + `szczegolyMasowe()`. To jedyne miejsce, gdzie odeszliśmy od układu oryginału
— i tylko dlatego, że duplikat nie niesie żadnej informacji o zachowaniu. Zachowanie identyczne,
pokryte testami obu tras.

### 5. `idPozycjiZFiltrow` buduje SQL ręcznie
Filtry idą przez `sql` z parametrami (nie konkatenację), więc wstrzyknięcie nie przechodzi —
`search` trafia jako bound parameter. Testy pokrywają wszystkie trzy filtry i kombinację
z `typZmiany: "all"`. Zostawiam bez zmian: to najwierniejsze odwzorowanie `:48540`.

---

## Ustalenia z przeglądu, które NIE są usterkami — a warto je znać

- **`assignKodImportu` ma martwą pierwszą regułę.** Czyta `existing.kod_importu` (snake_case),
  a dostaje wiersz z Drizzle (`kodImportu`). Reguła „zachowaj istniejący numer" nigdy nie
  wypala; numer ratuje dopiero wyszukanie po grupie surowym SQL-em. Odtworzone 1:1
  i udokumentowane w moście — **nie naprawiać przy okazji**, to zachowanie produkcji.
- **`ean` bierze się WYŁĄCZNIE ze snapshotu.** Wiersz stagingu ma `eanRaw` i pochodne, ale
  `acceptStaging` czyta `r.ean ?? null`. Osobny scenariusz charakteryzacji tego pilnuje —
  mutacja „weź z `eanRaw`" jest łapana.
- **`marzaPct` jest zawsze 25**, nawet gdy cena sprzedaży przyszła gotowa z pliku i nie ma nic
  wspólnego z narzutem 25%. Niespójność oryginału, odtworzona świadomie, opisana w kodzie.
- **`PUT /api/staging/{id}` to jedyna ścieżka tworząca poprawki Marty** — nie „edycja
  z dodatkiem", tylko sedno trasy. Bez niej 3e nie miałaby czym edytować pozycji.
- **Wycięcie oryginału jest wzorcem do ponownego użycia.** Kotwice
  (`function __bridgeCondMatch` → `function recalcPricesFromRules`, `listStaging(){` →
  `listAlerts(){`) i wstrzykiwanie Drizzle'a działają dla KAŻDEJ metody obiektu `U`.
  I12 dostanie tą drogą `addProductsBulk` — zapisane w roadmapie.

---

## Werdykt

**Gotowe do merge.** Zakres z planu dowieziony w całości, plan B okazał się niepotrzebny,
`GET_overrides.json` — ostatni nieodhaczony fixture Iteracji 3 — jest zielony. Zero BLOCKER-ów.
Najcenniejszym ustaleniem review jest to, że testowanie mutacyjne wyłapało trzy własne luki
w testach, zanim wyłapał je ktoś inny.
