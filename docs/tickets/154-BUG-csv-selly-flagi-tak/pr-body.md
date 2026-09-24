## Ticket

154-BUG — generator CSV dla Selly gubi flagi zapisane jako tekst `'Tak'`

Realizuje kartę `docs/karty/FIX.1/karta.md` (⛔ blokada cutoveru) i wpis backlogu `#153.1`.

## Summary

Generator CSV dla Selly czyta teraz dziesięć kolumn flagowych **surowo**, z pominięciem mappera
boolean Drizzle — dzięki czemu flaga zapisana w bazie jako tekst `'Tak'` trafia do pliku jako `Tak`,
a nie jako pustka. Model Drizzle został nietknięty, więc `GET /api/products` zachowuje się jak dotąd
i `contract/fixtures/GET_products.json` jest bez zmian. Dowód wierności na stagingu wypadł **bajt
w bajt**: nasz plik i plik generatora produkcji mają tę samą sumę MD5, a ten sam pomiar na kodzie
sprzed naprawy odtworzył dokładnie 899 różniących się wierszy z wpisu `#153.1`.

## Problem / Motivation

Porównanie plików CSV wygenerowanych **z tej samej bazy** przez generator produkcji i przez nowy stos
dawało 5396 = 5396 produktów i identyczny nagłówek 60 kolumn, ale **899 wierszy różniło się w pięciu
flagach** (`Snieg-3PMSF`, `Bloto+snieg`, `CFO`, `NRO`, `CHO`) — produkcja wypisywała „Tak", my pustkę.

Przyczyna: te kolumny mają w `products` **mieszane typy**, bo SQLite pozwala trzymać tekst w kolumnie
`INTEGER` — obok `0`/`1` siedzi napis `'Tak'`. Czytaliśmy je przez pełną projekcję Drizzle, gdzie są
zadeklarowane `integer({ mode: "boolean" })`, a mapper robi `Number(v) === 1` — więc tekst dawał
`false` i `wartosc ? "Tak" : ""` wypisywało puste pole. Produkcyjny generator to osobny skrypt czytający
`SELECT *` przez `better-sqlite3`, który dostaje wartość surową.

Gdyby przeszło niezauważone: po cutoverze sklep dostałby 899 pozycji (17% katalogu) bez oznaczeń
`Śnieg 3PMSF`, `M+S`, `CFO`, `NRO`, `CHO` — czyli bez cech, po których klient filtruje opony zimowe
i specjalistyczne. Nic by nie zgłosiło błędu: plik ma poprawny nagłówek, poprawną liczbę wierszy
i poprawne ceny.

## Solution

- `rebuild/backend/src/selly/generator-csv.ts`:
  - nowe `FLAGI_SUROWE` — dziesięć pól z `boolCols` oryginału zbudowanych jako
    `` sql<WartoscSurowaFlagi>`${products.<pole>}` ``, co w Drizzle idzie przez `noopDecoder`,
    a nie przez `column.mapFromDriverValue`;
  - `zbudujCsvSelly()` czyta `.select({ ...getTableColumns(products), ...FLAGI_SUROWE })`;
    **pętla formatująca bez żadnej zmiany** — warunek `wartosc ? "Tak" : ""` zostaje dosłownie taki,
    jaki był, tylko dostaje już surową wartość;
  - `KOLUMNY_BOOL` **wyprowadzone** z `Object.keys(FLAGI_SUROWE)` — jedna lista zamiast dwóch, więc
    projekcja i warunek „Tak"/pusto nie mogą się rozjechać;
  - usunięty komentarz twierdzący nieprawdę („Warunek `v ? "Tak" : ""` działa tak samo dla obu"),
    zastąpiony opisem mieszanych typów, liczbami z pomiaru i cytatem z kodu Drizzle.
- `rebuild/backend/test/selly.generator-csv.test.ts` — 6 nowych przypadków: regresja na pięciu
  kolumnach z pomiaru, wszystkie dziesięć kolumn, tabelka reguły prawdziwości, dowód powinowactwa
  typów SQLite, kontrola że surowy odczyt nie przecieka do pliku.
- Dokumentacja: zamknięta karta `FIX.1`, status wpisu `#153.1`, nowy wpis `#154.1` o `mapper.ts`,
  wejście dla karty `TEST.2`, wpis `docs/spec-backend/wpis-154.md`, trzecia pułapka Drizzle
  w `CLAUDE.md`.

## Design decisions

- **D1. Modelu Drizzle NIE ruszamy.** Oryginał trzyma te kolumny w tym samym trybie boolean
  (`deminified/backend-index.cjs:43733-43752`), więc produkcyjne `GET /api/products` zwraca na `'Tak'`
  to samo `false` co my — API jest wierne i ma takie zostać. Zmiana schematu naprawiłaby CSV kosztem
  rozjazdu z `contract/fixtures/GET_products.json`. **API jest wierne, gdy mapuje; plik CSV jest
  wierny, gdy NIE mapuje.**
- **D2. Technika: nadpisanie dziesięciu pól wyrażeniem `sql<…>` w projekcji.** Jedno zapytanie, klucze
  zostają `camelCase` (tablica `KOLUMNY` bez zmian), sygnatura `zbudujCsvSelly(db: Baza)` bez zmian,
  `csv-cli.ts` i `dostepnosc.ts` nietknięte. Odrzucone: osobne surowe `SELECT *` przez
  `better-sqlite3` (wymaga rozszerzenia sygnatury o uchwyt `sqlite` i przepisania całej tablicy
  `KOLUMNY` na `snake_case`) oraz drugie zapytanie scalane po `id` (dwa przebiegi bez zysku).
- **D3. Reguła prawdziwości odtworzona wiernie, bez zawężania.** Warunek zostaje gołym
  `wartosc ? "Tak" : ""` na wartości surowej. Świadomie **nie** zawężamy go do
  `v === 1 || v === 'Tak'` — to rozjechałoby nas z produkcją dla każdego innego napisu.
- **D4. `src/selly/mapper.ts:197-203` ma ten sam błąd i jest świadomie NIENAPRAWIONY.** Poza wyłączną
  własnością karty `FIX.1`; sync REST jest zakresem kart Selly REST. Zgłoszone jako `#154.1`
  i w „Do koordynatora" karty.
- **D5. Żadnego odstępstwa od zachowania oryginału.** Ticket PRZYWRACA wierność, nie zmienia
  zachowania — dlatego wpis `#153.1` ma `Do nowej wersji? ✅ TAK`.

## Tests

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka kontraktu.** Zmiana siedzi wyłącznie
  w warstwie odczytu generatora pliku CSV, który nie jest odpowiedzią HTTP. Żaden plik
  w `contract/fixtures/` nie niesie treści CSV; `contract/openapi.yaml` dla
  `POST /api/selly/generate-csv` i `GET /api/selly/csv-status` bez zmian.
  `contract/fixtures/GET_products.json` celowo nietknięty (D1).
- **Unit:** ✓ 112/112 plików, 1849 testów przeszło, 7 pominiętych. Sam generator: 36/36.
- **Czułość testów sprawdzona:** po cofnięciu warstwy odczytu do `.select()` **pada 5 nowych testów**.
- **Bramki:** `lint` ✓ · `typecheck` ✓ · `build` ✓ · `test` ✓.

### Dowód wierności na stagingu (wymagany kartą FIX.1) — ✓ PUSTY DIFF

Oba generatory na **mrożonej kopii** bazy stagingu (`better-sqlite3 backup()` z połączenia
`readonly`), czyli z gwarantowanie identycznym wejściem — lepiej niż „jeden po drugim" z raportu 153,
gdzie szum wnosił scheduler importu. Generator produkcji: `origin/main` @ `5bd4a7b`.

| Pomiar | Wynik |
|---|---|
| Produktów aktywnych | **5396 = 5396** |
| Nagłówek | **60 = 60 kolumn, identyczny** |
| Rozmiar | **2 454 470 = 2 454 470** bajtów |
| MD5 | **`3f8bec0d9ba03a552910971d5cef79eb`** — ten sam dla obu |
| `diff` | **PUSTY** (0 różniących się linii) |
| Rozkład różnic na kolumny | **brak różnic w jakiejkolwiek kolumnie** |

**Kontrola pozytywna** (pusty diff nie bierze się z tego, że oba pliki są puste) — liczby `Tak`
zgadzają się z censusem typów w bazie (`text 'Tak'` + `integer 1`): `Snieg-3PMSF` 946 (750+196),
`Bloto+snieg` 913 (713+200), `CFO` 60 (52+8), `NRO` 25 (12+13), `CHO` 12 (10+2).

**Kontrola czułości** — ten sam pomiar na kodzie SPRZED naprawy odtworzył wpis `#153.1` co do wiersza:
**899** różnic w rozkładzie `Snieg-3PMSF` 750 · `Bloto+snieg` 713 · `CFO` 52 · `NRO` 12 · `CHO` 10;
po naprawie **0**.

**Zachowane zabezpieczenia:** generator produkcji uruchomiony wyłącznie jako kopia z podmienionymi
trzema stałymi (`DB_PATH`, `OUT_DIR`, `OUT_FILE`), z `grep`em potwierdzającym brak jakiejkolwiek
ścieżki produkcyjnej przed startem; baza otwierana `{ readonly: true }`, żadnego `ALTER TABLE`; nasz
generator pisał do katalogu pomiarowego, nigdy do `public_html/panel/ex-port-files`. Po pomiarze
`rm -rf` (pliki zawierały kolumnę `Cena-zakupu`). Potwierdzone po robocie: produkcyjny plik CSV
ma mtime 09-23 17:57 (nietknięty), baza stagingu mtime 09-24 00:47 (niezmieniona), deploy stagingu
nieruszany.

## Breaking changes

Brak. Zmiana **przywraca** zachowanie produkcji zamiast je zmieniać: plik CSV staje się identyczny
z plikiem generatora produkcji. Kształt odpowiedzi API, `stdout` trasy, liczba i kolejność kolumn oraz
nazwa i lokalizacja pliku bez zmian. Po cutoverze 899 pozycji odzyska oznaczenia flagowe.

## Follow-up

1. **`src/selly/mapper.ts:197-203` — ten sam błąd, świadomie niezałatany** (D4). Sync REST wysyła do
   Selly tabelę atrybutów bez `M+S`, `3PMSF`, `Reinforced`, `Extra Load` i trzech odpornościowych dla
   produktów z tekstem `'Tak'`. Łańcuch wywołań i pełny opis: `docs/rebuild-backlog/wpis-154.md`
   (`#154.1`). **Wymaga decyzji o przypisaniu do którejś karty Selly REST.**
2. **Wiersz roadmapy `⛔ przed cutoverem | FIX.1 | ⬜ BLOKADA` (`docs/rebuild-roadmap.md:3489`)
   do przestawienia — to plik koordynatora**, karta go nie edytuje. Prośba w „Do koordynatora".
3. **Karta `TEST.2` może już napisać, że pliki są identyczne** — warunek z `wejscie-153.md` jest
   spełniony. Metoda i wynik: `docs/karty/TEST.2/wejscie-154.md`.
4. **`db/snapshot.db` w repo (13.08) nie odtwarza tej klasy usterek** — w tych kolumnach ma tylko
   `integer 0/1` i `null`. Dowody o mieszanych typach wymagają kopii produkcji.

## Review

<details>
<summary>Code review</summary>

Review wskazał 2 BLOCKER-y (dokumentacja karty `FIX.1` i backlogu nie była jeszcze naniesiona
w chwili review — Faza 5 ticketu jeszcze nie przebiegła; naniesione przed tym PR-em),
2 SHOULD-FIX i 1 NICE-TO-HAVE. Wszystkie rozliczone:

- **SHOULD-FIX (naprawione, commit `d39595f`):** komentarz cytował `drizzle-orm/sqlite-core/utils.cjs:40-75`
  dla `mapResultRow`, a funkcja jest w `drizzle-orm/utils.cjs:40` (wybór dekodera `:45-52`, użycie `:63`).
  Mechanizm był opisany poprawnie, zła była ścieżka — dokładnie ten typ nieprawdziwego komentarza,
  przed którym ostrzega `CLAUDE.md`. Sprawdzone w `node_modules/drizzle-orm` 0.45.2.
- **SHOULD-FIX (naprawione):** brakujący `pr-body.md` — ten plik.
- **NICE-TO-HAVE (naprawione, commit `d39595f`):** test powinowactwa typów dostał adnotację, że
  **nie jest** regresją naszego kodu (przechodzi niezależnie od generatora).

Reviewer potwierdził niezależnie: dziesięć kolumn `FLAGI_SUROWE` zgadza się 1:1 z `boolCols`
oryginału (`origin/main:mirror/backend/generate_selly_export.cjs:76`), mechanizm `sql<…>` omijający
mapper boolean potwierdzony w `node_modules/drizzle-orm@0.45.2` i przez `.toSQL()` (poprawne
referencje także dla kolumn aliasowanych `extra_load`/`snow_3pmsf`, brak duplikatów w projekcji),
brak naruszeń kontraktu/fixtures, testy nietautologiczne, bramki zielone, testy w pełni izolowane
(`mkdtempSync` per test).

Pełna treść: `docs/tickets/154-BUG-csv-selly-flagi-tak/review.md`.

</details>

---
Ticket docs: `docs/tickets/154-BUG-csv-selly-flagi-tak/`
Zsynchronizowane z `develop` (`6288066`) — gałąź zawierała już całe `origin/develop`, nic nie doszło; bramki (`lint`/`typecheck`/`build`/`test`) i dowód wierności na stagingu przebiegły na tej właśnie bazie.
