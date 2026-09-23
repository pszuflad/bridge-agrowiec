# 154-BUG — Raport wdrożenia

## Summary

Generator CSV dla Selly czyta teraz dziesięć kolumn flagowych **surowo**, z pominięciem mappera
boolean Drizzle — dzięki czemu flaga zapisana w bazie jako tekst `'Tak'` trafia do pliku jako `Tak`,
a nie jako pustka. Model Drizzle został nietknięty (karta `FIX.1`), więc `GET /api/products` zachowuje
się jak dotąd i `contract/fixtures/GET_products.json` jest bez zmian. Dowód wierności na stagingu
wypadł **bajt w bajt**: nasz plik i plik generatora produkcji mają tę samą sumę MD5, a ten sam pomiar
na kodzie sprzed naprawy odtworzył dokładnie 899 różniących się wierszy z wpisu `#153.1`.

## Changes

- `rebuild/backend/src/selly/generator-csv.ts`
  - **nowe** `FLAGI_SUROWE` — dziesięć pól z `boolCols` oryginału zbudowanych jako
    `` sql<WartoscSurowaFlagi>`${products.<pole>}` ``, co w Drizzle omija `column.mapFromDriverValue`
    (a więc `Number(v) === 1`) i oddaje wartość surową z drivera;
  - **nowy typ** `WartoscSurowaFlagi = string | number | null`;
  - `KOLUMNY_BOOL` **wyprowadzone** z `Object.keys(FLAGI_SUROWE)` — jedna lista zamiast dwóch, więc
    projekcja i warunek `"Tak"`/pusto nie mogą się rozjechać;
  - `zbudujCsvSelly()` czyta `.select({ ...getTableColumns(products), ...FLAGI_SUROWE })` zamiast
    `.select()`; **pętla formatująca bez żadnej zmiany** — warunek `wartosc ? "Tak" : ""` zostaje
    dosłownie taki, jaki był, tylko dostaje już surową wartość;
  - import rozszerzony o `getTableColumns`, `sql`, `type SQL`;
  - **usunięty nieprawdziwy komentarz** nad `KOLUMNY_BOOL` („Warunek `v ? "Tak" : ""` działa tak samo
    dla obu") — zastąpiony opisem mieszanych typów, liczbami z pomiaru i cytatem z kodu Drizzle
    wyjaśniającym, dlaczego `sql` omija mapper.
- `rebuild/backend/test/selly.generator-csv.test.ts` — nowy blok `describe` „flagi zapisane jako tekst
  (#153.1, karta FIX.1)", 6 nowych przypadków (+2 istniejące nietknięte): regresja na pięciu kolumnach
  z pomiaru, wszystkie dziesięć kolumn, tabelka reguły prawdziwości, dowód powinowactwa typów SQLite,
  kontrola że surowy odczyt nie przecieka do pliku jako `1`/goły tekst.
- **Nowe:** `docs/tickets/154-BUG-csv-selly-flagi-tak/{plan.md,raport.md,pr-body.md}`.

Nie zmieniono: `src/db/schema.ts`, `src/selly/mapper.ts`, `src/selly/csv-cli.ts`,
`src/selly/dostepnosc.ts`, tablicy `KOLUMNY`, `contract/**`, `mirror/**`, sygnatur publicznych.

## Deviations from plan

**Jedna korekta faktu, bez zmiany podejścia i zakresu.** Plan (D3) zakładał — rozumując z samej
truthiness JS — że tekstowe `'0'` da `„Tak"`, bo niepusty napis jest truthy. Pomiar pokazał, że
**tak się nie stanie, i to nie z powodu naszego kodu**: kolumna jest zadeklarowana `INTEGER`, więc
działa na niej powinowactwo typów SQLite i napis dający się przeczytać jako liczba jest
KONWERTOWANY przy zapisie, zanim jakikolwiek kod go zobaczy. Zmierzone na tym samym silniku:

| Zapisywana wartość | `typeof` w kolumnie | Wynik w CSV |
|---|---|---|
| `'0'` | `integer` (0) | pusto |
| `'1'` | `integer` (1) | `Tak` |
| `'Tak'` | `text` | `Tak` |
| `'Nie'` | `text` | `Tak` |
| `''` | `text` | pusto |

Wniosek dla wierności jest **niezmieniony**: produkcja stoi na tym samym SQLite z tą samą deklaracją
kolumny, więc zachowuje się identycznie — decyzja „odtwarzamy wiernie, bez zawężania reguły" stoi.
Zmieniło się tylko to, że jeden brzeg z tabelki D3 jest fizycznie nieosiągalny, a nie „teoretyczny".
Mechanizm jest teraz udokumentowany komentarzem i osobnym testem, żeby nie trzeba było go odkrywać
po raz drugi. Reszta planu zrealizowana 1:1.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** **N/D — ticket nie dotyka kontraktu.** Zmiana siedzi wyłącznie
  w warstwie odczytu generatora pliku CSV, który nie jest odpowiedzią HTTP. Żaden plik w
  `contract/fixtures/` nie niesie treści CSV (są tylko `GET_selly_csv-status.json`,
  `GET_selly_status.json`, `GET_selly_log.json`, `GET_selly_ping.json`,
  `GET_selly_dictionaries.json`); `contract/openapi.yaml` dla `POST /api/selly/generate-csv`
  i `GET /api/selly/csv-status` bez zmian (kształt odpowiedzi, `stdout`, `LICZBA_KOLUMN` = 60).
  `contract/fixtures/GET_products.json` **celowo nietknięty** — te dziesięć pól ma tam zostać
  `boolean`/`null`, bo oryginał trzyma kolumny w trybie boolean
  (`deminified/backend-index.cjs:43733-43752`) i produkcyjne `GET /api/products` zwraca na `'Tak'`
  to samo `false` co my. Zamiast gate'u na fixtures obowiązywał **pomiar porównawczy na stagingu**
  (niżej) — tak wymaga karta `FIX.1`.
- **Unit:** ✓ `112/112` plików, `1849` testów przeszło, `7` pominiętych (`npm test`,
  `rebuild/backend/`). Sam plik generatora: `36/36`.
- **Czułość testów sprawdzona (nie tylko „zielone"):** po cofnięciu warstwy odczytu do
  `.select()` **pada 5 z nowych testów**; z naprawą przechodzą wszystkie. Test powinowactwa typów
  przechodzi w obu wariantach, bo opisuje SQLite, nie nasz kod.
- **Bramki:** `npm run lint` ✓ · `npm run typecheck` ✓ · `npm run build` ✓ · `npm test` ✓.
- **Integration / E2E:** pominięte świadomie — kształt odpowiedzi trasy i `stdout` się nie zmieniają,
  a istniejące testy trasy `POST /api/selly/generate-csv` to pokrywają; brak przepływu użytkownika.

### Dowód wierności na stagingu (obowiązkowy wg karty FIX.1) — ✓ PUSTY DIFF

Data: 2026-09-24. Host: `vpshd1242.cyber-folks.pl` (`admin`). Generator produkcji: `origin/main`
@ `5bd4a7b`, `mirror/backend/generate_selly_export.cjs`. Nasz: `fix/154-csv-selly-flagi-tak`
@ `773aefe`, `dist/selly/csv-cli.js`.

**Odstępstwo od procedury z raportu 153, na korzyść dowodu:** raport 153 kazał puszczać oba generatory
„jeden po drugim", bo na stagingu chodzi scheduler importu i przerwa wprowadza szum w cenach i stanach.
Zamiast tego zrobiłem **mrożoną kopię bazy stagingu** (`better-sqlite3 backup()` z połączenia
`readonly`) i oba generatory czytały **tę samą kopię**. To usuwa szum całkowicie, zamiast go
minimalizować, i dodatkowo gwarantuje, że baza stagingu nie jest otwierana do zapisu.

| Pomiar | Wynik |
|---|---|
| Produktów aktywnych | **5396 = 5396** |
| Kolumn w nagłówku | **60 = 60**, nagłówek identyczny |
| Rozmiar pliku | **2 454 470 = 2 454 470** bajtów |
| MD5 | **`3f8bec0d9ba03a552910971d5cef79eb`** — ten sam dla obu plików |
| `diff` | **PUSTY** (0 różniących się linii) |
| Rozkład różnic na kolumny | **brak różnic w żadnej kolumnie** |

**Kontrola pozytywna — plik naprawdę niesie flagi** (pusty diff nie bierze się z tego, że oba pliki
są puste; liczby zgadzają się z censusem typów w bazie, gdzie `Tak` = `text 'Tak'` + `integer 1`):

| Kolumna CSV | Produkcja | Nasz | = tekst `'Tak'` + `integer 1` w bazie |
|---|---|---|---|
| `Snieg-3PMSF` | 946 × `Tak` | 946 | 750 + 196 ✓ |
| `Bloto+snieg` | 913 × `Tak` | 913 | 713 + 200 ✓ |
| `CFO` | 60 × `Tak` | 60 | 52 + 8 ✓ |
| `NRO` | 25 × `Tak` | 25 | 12 + 13 ✓ |
| `CHO` | 12 × `Tak` | 12 | 10 + 2 ✓ |

**Kontrola czułości pomiaru — ten sam pomiar na kodzie SPRZED naprawy** (cofnięta wyłącznie warstwa
odczytu, ta sama kopia bazy) odtworzył wpis `#153.1` **co do wiersza**:

| | różniących się wierszy | rozkład na kolumny |
|---|---|---|
| przed naprawą | **899** | `Snieg-3PMSF` 750 · `Bloto+snieg` 713 · `CFO` 52 · `NRO` 12 · `CHO` 10 |
| po naprawie | **0** | — |

Czyli: pomiar jest czuły (widzi usterkę, gdy jest), liczby zgadzają się z niezależnym pomiarem
z ticketu 153, a po naprawie różnica znika w całości, bez reszty.

**Zachowane zabezpieczenia (sprawdzone, nie założone):**
- Generator produkcji uruchomiony **wyłącznie jako kopia z podmienionymi trzema stałymi**
  (`DB_PATH`, `OUT_DIR`, `OUT_FILE`); przed uruchomieniem `grep` potwierdził, że w kopii **nie ma
  ani jednej ścieżki produkcyjnej** (`private_apps/bridge/`, `public_html`) — oryginał celuje
  w `/home/admin/private_apps/bridge/data.db` i w produkcyjny katalog eksportu.
- Kopia otwiera bazę `{ readonly: true }` (linia 12 oryginału); `ensurePaymentBlocks()` / `ALTER TABLE`
  **nie występuje** w uruchomionym pliku — sprawdzone `grep`em.
- Nasz generator dostał `SELLY_CSV_DIR` w katalogu pomiarowym, **nigdy** produkcyjnego
  `public_html/panel/ex-port-files`.
- Po pomiarze `rm -rf ~/cmp154 ~/dist-154.tgz` — pliki zawierały kolumnę `Cena-zakupu` i leżały poza
  `public_html`. Potwierdzono, że nie zostały.
- Po pomiarze potwierdzone: produkcyjny plik CSV dla Selly ma mtime **09-23 17:57** (sprzed tej
  roboty, nietknięty), baza stagingu mtime **09-24 00:47** (niezmieniona — oba generatory czytały
  kopię). Deploy stagingu nietknięty: pomiar szedł w osobnym katalogu, `tools/deploy-staging.sh`
  nie był uruchamiany.

## Breaking changes

Brak. Zmiana **przywraca** zachowanie produkcji zamiast je zmieniać: plik CSV dla Selly staje się
identyczny z plikiem generatora produkcji. Kształt odpowiedzi API, `stdout` trasy, liczba i kolejność
kolumn oraz nazwa i lokalizacja pliku bez zmian. Po cutoverze 899 pozycji (17% katalogu) odzyska
oznaczenia `Śnieg 3PMSF`, `M+S`, `CFO`, `NRO`, `CHO`.

## Follow-up

1. **`src/selly/mapper.ts:197-203` ma DOKŁADNIE ten sam błąd — niezałatany, świadomie**
   (decyzja użytkownika, D4). Funkcja budująca tabelę atrybutów wysyłaną do Selly przez **sync REST**
   czyta te flagi z tego samego typu `ProduktWewnetrzny` (`p.ms ? "tak" : null`, `p.snow3pmsf`,
   `p.reinforced`, `p.extraLoad`, `p.cutResistant`, `p.heatResistant`, `p.stubbleResistant`), więc dla
   tych samych produktów gubi `M+S`, `3PMSF`, `Reinforced`, `Extra Load` i trzy odpornościowe.
   Karta `FIX.1` daje na wyłączną własność tylko `generator-csv.ts`, a sync REST jest zakresem kart
   Selly REST — dlatego zgłoszone, nie naprawione. Zapisane w „Do koordynatora" karty `FIX.1`
   oraz jako wpis backlogu `#154.1` (`docs/rebuild-backlog/wpis-154.md`).
2. **Wiersz roadmapy `⛔ przed cutoverem | FIX.1 | ⬜ BLOKADA`** (`docs/rebuild-roadmap.md:3489`)
   wymaga przestawienia na zrobione — to plik koordynatora, karta go nie edytuje. Prośba w sekcji
   „Do koordynatora" karty.
3. **`docs/karty/TEST.2/wejscie-153.md` zawiera warunkowe ostrzeżenie** „dopóki `FIX.1` nie jest
   zrobione, dowód nie wychodzi na zero — sprawdź stan `FIX.1` przed napisaniem tego akapitu".
   Warunek jest spełniony; karta `TEST.2` może już napisać, że pliki są identyczne (metoda + data
   w `wejscie-154.md`).
4. **Metoda „mrożona kopia bazy" warta przeniesienia do instrukcji TEST.2** — usuwa szum schedulera
   zamiast go minimalizować i gwarantuje readonly na bazie stagingu. Opisane w
   `docs/karty/TEST.2/wejscie-154.md`.
5. **`db/snapshot.db` w repo (13.08) nie odtwarza tej klasy usterek** — ma w tych kolumnach tylko
   `integer 0/1` i `null`, zero tekstu. Kto będzie dowodził czegokolwiek o mieszanych typach, musi
   wziąć kopię produkcji, nie ten snapshot. Odnotowane w karcie.
