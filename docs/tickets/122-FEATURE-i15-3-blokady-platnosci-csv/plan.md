# 122-FEATURE-i15-3-blokady-platnosci-csv — I15.3: blokowane formy płatności w katalogu + eksport CSV Selly

> Status: Draft → Approved → **Implemented**
> Branch: `feature/122-i15-3-blokady-platnosci-csv`
> Worktree: `.worktrees/122-FEATURE-i15-3-blokady-platnosci-csv`
> Karta: `docs/karty/I15.3/` (karta.md + wejscie-104/107/110/114) · Backlog: #73, #76, #77 (część CSV), #102, #104

## Opis ticketu

Karta I15.3 fali 2 iteracji 15. Pięć rzeczy:

1. **#73 w API i UI** — pole blokowanych form płatności wychodzi z katalogu (I15.1 ukryła je
   w `KOLUMNY_POZA_KONTRAKTEM` jako stan przejściowy) + kolumna „Blokowane formy płatności" w `/katalog`.
2. **#73 w CSV** — 60. kolumna `Blokowane-formy-platnosci`.
3. **#76** — nazwy kategorii sklepu w CSV (normalizator z polskimi znakami) + potwierdzenie testem,
   że odbudowa ma nagłówek `R/D` z wartościami „Radialna"/„Diagonalna".
4. **#77 + #104** — eksport obejmuje TYLKO produkty `aktywny`, zapis pliku atomowy.
5. **#102** — polecenie CLI uruchamiające generator, żeby cron produkcji mógł je wołać przy cutoverze.

## Kontekst

**Źródło prawdy: `origin/main` @ `88fa31c`** (produkcja zamrożona 23.09).
⚠ Na `origin/main` są dwa commity PO `88fa31c` (`4a26cb3`, `233524b`) — diff pokazuje wyłącznie
regenerowany plik wynikowy `mirror/frontend/ex-port-files/sellycsv-…csv`, **zero zmian kodu**.
`88fa31c` zostaje prawidłowym źródłem dla tej karty.

### Co produkcja realnie robi (`88fa31c:mirror/backend/generate_selly_export.cjs`, przeczytany w całości)

- **60 kolumn**, separator `;`, BOM UTF-8, złamania `\r\n`, plik kończy się `\r\n`.
- 60. kolumna: `['Blokowane-formy-platnosci', 'blokowane_formy_platnosci']`, z fallbackiem
  `paymentBlocks.getBlockedPaymentForms(row.dostawca)`, gdy wartość w bazie jest pusta.
- `Kategoria` idzie przez `toSellyCategoryName()`: `trim` → `toLocaleLowerCase('pl-PL')` →
  `normalize('NFD')` → usunięcie `\p{Diacritic}` → **`.replace(/ł/g,'l')`** → zbicie spacji →
  `Map` (`rolnicze`, `rolnicze male`, `lesne`, `przemyslowe`, `ciezarowe`), fallback = wartość surowa.
- `SELECT * FROM products WHERE status = 'aktywny' ORDER BY id`.
- **Zapis atomowy** (`:154-156`): `writeFileSync(outPath + '.tmp-' + process.pid)` → `renameSync`.
  ⚠ Researcher zgłosił to jako niezweryfikowane (czytał ~140 z 162 linii) — **zweryfikowane, jest w oryginale**.
  To wierny port, nie odstępstwo.
- stdout (`:159-162`): `Zapisano:` / **`Liczba produktow aktywnych:`** / `Liczba kolumn:` / `Rozmiar pliku (bajty):`.
- Mapa MO→formy płatności: `mirror/backend/payment_blocks.cjs`, MO1–MO5 + MO7–MO10.
  **MO6 (Uniglory) i nieznany dostawca → `null`** (CHANGELOG produkcji 2026-09-10 14:53: „nie będzie
  na razie w sprzedaży") — zamierzone, nie defekt.
- UI oryginału: `mirror/frontend/assets/payment-blocks-injection.js` wstrzykuje `<th>` o treści
  **`Blokowane formy płatności`** (z polskimi znakami), `min-width: 420px`, klasa `font-mono`,
  komórka `td.textContent = value || '—'`, `td.title = value`, wstawiana PRZED kolumną „Akcje".

### Stan odbudowy (`origin/develop`)

| Element | Stan |
|---|---|
| `rebuild/backend/src/selly/generator-csv.ts` | **59 kolumn**, brak `Blokowane-formy-platnosci`, brak `toSellyCategoryName`, `Kategoria` przechodzi surowo, zapis **nieatomowy** (`writeFileSync` wprost), stdout `Liczba produktow (aktywnych):` |
| filtr `status='aktywny'` | ✅ **już jest** (`.where(eq(products.status,"aktywny"))`) — pośredni stan #77 („wstrzymane ze stanem 0") nigdy nie wszedł do odbudowy, więc #104 nie ma tu czego cofać |
| nagłówek `R/D` | ✅ **już jest** (`["R/D","konstrukcja"]`) — odbudowa nigdy nie przejęła zmiany z 01.09; pkt 3 #76 to powrót produkcji do naszego stanu |
| `rebuild/backend/src/db/schema.ts:111` | ✅ `blokowaneFormyPlatnosci: text("blokowane_formy_platnosci")` |
| `rebuild/schema/011_blokowane_formy_i_triggery.sql` | ✅ kolumna + 6 triggerów (I15.1, ticket 107) |
| `rebuild/backend/src/repos/kolumny.ts:50-79` | ❌ `KOLUMNY_POZA_KONTRAKTEM.products = ["uwagaCena","blokowaneFormyPlatnosci"]` — komentarz wprost: „wystawia karta I15.3" |
| strażnicy 72 kluczy | `test/katalog.gate.test.ts:115-134`, `test/produkty.mutacje.test.ts:267-279` |
| CLI generatora | ❌ brak; jedyny konsument to `src/routes/selly.ts:374,391` |
| front `pages/katalog/kolumny.ts` | tablica `KOLUMNY` + `KOLUMNY_DOMYSLNE` + retrofit `uzupelnijKodImportu` (wołany w `Katalog.tsx:211`) |

⚠ **Router haszowy nie dotyczy odbudowy.** Poprawka `routefix` z `0c4d2f2` naprawiała rozpoznawanie
widoku po `location.pathname` w oryginale, który używa `#/katalog`. Odbudowa porzuciła routing po
hashu (odstępstwo O1 z I1, `docs/cutover.md:31-34`) i nie wstrzykuje niczego do cudzego DOM-u —
kolumna jest natywną kolumną tabeli React. **Cały mechanizm `MutationObserver`/`hashchange`/
`setInterval` z oryginału jest w odbudowie bezprzedmiotowy.** Z portu zostaje treść: etykieta,
szerokość, `font-mono`, `—` dla pustej wartości, `title` z pełną wartością, pozycja przed „Akcje".

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

| Ścieżka | Fixture | Co się zmienia |
|---|---|---|
| `GET /api/products` | `contract/fixtures/GET_products.json`, `GET_products_bez-parametrow.json` | **BEZ ZMIAN — 72 klucze** (patrz „Pomiar rozstrzygający") |
| `PATCH /api/products/{id}` | `contract/fixtures/PATCH_products_id.json` | bez zmian |
| `PUT /api/products/{id}` | `contract/fixtures/PUT_products_id.json` | bez zmian |
| `POST /api/selly/generate-csv` | brak fixture'a JSON (openapi `type: object`) | kształt odpowiedzi bez zmian; zmienia się `stdout` (liczba kolumn 59→60, tekst linii) |
| `GET /api/selly/csv-status` | `contract/fixtures/GET_selly_csv-status.json` | bez zmian |

### ⭐ Pomiar rozstrzygający (2026-09-23) — karta zakładała nieprawdę

Plan przewidywał tu 73 klucze i zapowiadał: „jeśli nagranie NIE da 73 kluczy — STOP i zgłoszenie,
bo to by znaczyło, że produkcja tego pola nie wystawia". **Dokładnie tak się stało.**

Metoda (ta sama, którą ticket 38 rozstrzygnął `uwagaCena`):
1. `git archive 88fa31c mirror/backend` → piaskownica (⚠ `mirror/` na `develop` jest NIEAKTUALNY,
   nie ma w nim `payment_blocks.cjs` — nagrywarka użyłaby złej wersji oryginału);
2. `db/snapshot.db` jako `data.db`, wygaszony scheduler dostawców;
3. baza doprowadzona do stanu produkcji **własnym modułem oryginału**:
   `payment_blocks.ensurePaymentBlocks(<ścieżka>)` → `{ ok: true, rows: 7405 }`, kolumna obecna,
   oba triggery założone (⚠ przy zwykłym starcie moduł pada lokalnie — ma zaszytą ścieżkę produkcyjną
   `/home/admin/private_apps/bridge/data.db`, stąd jawny argument);
4. start `index.cjs`, logowanie, `GET /api/products?limit=5`.

Wynik: **72 klucze, bez `blokowaneFormyPlatnosci`.**

Mechanizm: `grep -c blokowane_formy_platnosci mirror/backend/index.cjs` = **0** — bundle nie zna
kolumny dokładanej runtime'owym `ALTER TABLE`, a produkty czyta Drizzle bez jawnej listy pól, więc
oddaje pola MODELU. To jest ten sam przypadek co `uwagaCena` i dlatego właśnie produkcja liczy
kolumnę w katalogu **w przeglądarce** (`payment-blocks-injection.js`) — API nie miało jej skąd wziąć.

**Skutek dla zakresu:** zdjęcie pola z `KOLUMNY_POZA_KONTRAKTEM` byłoby ODSTĘPSTWEM, nie
domknięciem długu. Fixture'y, `openapi.yaml` i obaj strażnicy 72 kluczy **zostają bez zmian**;
poprawione zostały komentarze, które twierdziły, że to stan przejściowy.

⚠ `contract/fixtures/` czyta GATE **obu stron**: backend oraz
`rebuild/frontend/test/msw/kontrakt.ts:63-77` (`produktyZFixtura()` ładuje `GET_products.json`
wprost do mocków MSW). Zmiana fixture'a automatycznie zmienia dane testowe frontu.

**Format CSV nie ma dziś pliku wzorcowego w `contract/`** — zamraża go wyłącznie
`test/selly.generator-csv.test.ts`. Dokładamy mocniejszy dowód: test porównujący naszą **linię
nagłówkową** z linią nagłówkową **realnego pliku produkcji**
(`mirror/frontend/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv`, wersja z `88fa31c`).

## Decyzje

**Decyzje użytkownika (2026-09-23, ten ticket):**

- **D1 — kolumna w `/katalog`: domyślnie widoczna + retrofit.** Wpis w `KOLUMNY`
  (wybieralna w konfiguratorze) ORAZ w `KOLUMNY_DOMYSLNE`, plus funkcja retrofitu na wzór
  `uzupelnijKodImportu`, żeby zastane zapisy wyboru kolumn w IndexedDB (ten sam origin po
  cutoverze) też ją dostały. *Za:* efekt dla Ani = jak dziś na produkcji, kolumna jest.
  *Przeciw odrzuconym:* „tylko w konfiguratorze" znaczyłoby, że kolumna po cutoverze znika;
  „zawsze widoczna poza konfiguratorem" przybija 420 px do i tak szerokiej tabeli.
- **D2 — WYCOFANA 2026-09-23 PO POMIARZE.** Pierwotnie: „wartość kolumny w UI bierzemy z API".
  Decyzja opierała się na założeniu (moim, z karty), że produkcja to pole wystawia. **Pomiar je
  obalił** — patrz D2′ niżej. Zostawiam wpis, żeby było widać, co się zmieniło i dlaczego.
- **D2′ — wartość kolumny w UI liczy się z kodu dostawcy; pole NIE wychodzi z API.**
  Odtworzenie produkcji, zero odstępstwa. *Dowód:* sekcja „Pomiar rozstrzygający" niżej.
  *Za:* fixture i kontrakt zostają zgodne z nagraniem; brak pierwszego w projekcie fixture'a
  przeczącego oryginałowi (którego następna sesja mogłaby w dobrej wierze „naprawić"); spójne
  z tym, jak odbudowa portuje logikę frontu (`formatowanie.tsx` trzyma inne przeniesione mapy).
  *Przeciw:* trzecia kopia mapy MO w repo — ale produkcja ma ten sam podział
  (`payment_blocks.cjs` + skrypt front-endowy), a odstępstwo nie dałoby Ani nic widocznego.
  Wariant „wystawić mimo to" przedstawiony użytkownikowi i odrzucony jako droższy bez zysku.
- **D3 — fallback CSV portujemy 1:1.** `getBlockedPaymentForms(row.dostawca)` gdy kolumna pusta.
  *Za:* domyślna reguła projektu = odtwarzamy zachowanie 1:1; tani bezpiecznik dla wiersza
  wstawionego drogą omijającą trigger. *Efekt mierzalny:* pomiar 113 na żywej produkcji — 0 wierszy
  z pustym polem, więc fallback dziś nie zmienia ani jednej komórki pliku.
- **D4 — pomiar na `db/snapshot.db` + liczby z realnych plików produkcji.** Kopii produkcji z 23.09
  nie ma w repo. Pomiar odtwarzalny robimy na kopii `snapshot.db` z nałożonymi migracjami; obok
  raportujemy fakty z `mirror/frontend/ex-port-files/`.

**Decyzje własne (wynikają wprost ze źródeł, nie wymagały pytania):**

- **D5 — etykieta kolumny `Blokowane formy płatności`, szerokość 420.** To NIE jest wymyślona
  nazwa łamiąca konwencję etykiet bez ogonków — to dosłowny `th.textContent` z
  `payment-blocks-injection.js`. Ania widzi dziś dokładnie ten napis.
- **D6 — pole pozostaje TYLKO DO ODCZYTU.** `PATCH /api/products/{id}` go nie zapisuje (nie ma go
  na liście pól edytowalnych w `repos/products.ts`); wartość utrzymują wyłącznie triggery po zmianie
  `dostawca`. Tak jest w produkcji. Dopuszczenie ręcznej edycji byłoby nowym zachowaniem — poza zakresem.
- **D7 — stdout generatora wracamy na `Liczba produktow aktywnych:`** (bez nawiasów), zgodnie
  z `88fa31c:generate_selly_export.cjs:160`. Odbudowa ma dziś `Liczba produktow (aktywnych):`, czyli
  tekst sprzed zmian #77/#104. Ewolucja produkcji: `(aktywnych)` → `(aktywnych i wstrzymanych)` (#77,
  14.09) → `aktywnych` (#104, 22.09). Żaden fixture tej linii nie zamraża.
- **D8 — CLI idzie wzorcem `migrate`/`migrate:dev`:** `npm run selly:csv` = `node dist/selly/csv-cli.js`
  (to woła cron produkcji — bez `tsx` w ścieżce produkcyjnej), `npm run selly:csv:dev` =
  `tsx src/selly/csv-cli.ts`. Skrypt czyta `wczytajEnv()` jak `server.ts`, więc `SELLY_CSV_DIR/PLIK/URL`
  rozwiązują się identycznie jak w trasie. **`src/config/env.ts` NIE jest ruszany** — nie jest w wyłącznej
  własności tej karty.

**Świadome odstępstwa od oryginału:** brak nowych. Generowanie in-process zamiast podprocesu to
odstępstwo D5 przyjęte wcześniej (I8a) i tu bez zmian. D2 nie zmienia zachowania widocznego dla
użytkownika (ta sama wartość, inne źródło), a D1 daje zachowanie zgodne z produkcją plus możliwość
ukrycia kolumny, której produkcja nie miała.

## Plan implementacji

### Krok 1 — generator CSV (`rebuild/backend/src/selly/generator-csv.ts`)
1. `BLOKOWANE_FORMY_PLATNOSCI` — zamrożona mapa MO1–MO5, MO7–MO10 (port `payment_blocks.cjs`),
   z komentarzem wskazującym `rebuild/schema/011_blokowane_formy_i_triggery.sql` jako źródło kanoniczne
   i notą, że **MO6 celowo nie ma wpisu**.
2. `blokowaneFormyDlaDostawcy(kod)` — port `getBlockedPaymentForms`: `String(kod||'').trim().toUpperCase()`,
   zwraca `null` dla nieznanego.
3. `nazwaKategoriiSklepu(wartosc)` — port `toSellyCategoryName`, z jawnym `ł`→`l` PO usunięciu diakrytyków
   (NFD nie rozkłada `ł` — to był właśnie błąd naprawiony drugą łatką #76).
4. 60. wpis w `KOLUMNY`: `["Blokowane-formy-platnosci", "blokowaneFormyPlatnosci"]` na końcu.
   ⚠ NIE dodawać do `KOLUMNY_BOOL` — to `text`.
5. W pętli `zbudujCsvSelly`: `Kategoria` → `nazwaKategoriiSklepu`; `Blokowane-formy-platnosci`
   → fallback `blokowaneFormyDlaDostawcy(produkt.dostawca)` gdy wartość falsy.
6. `wygenerujCsvSelly`: zapis atomowy `pelna + ".tmp-" + process.pid` → `renameSync`; sprzątnięcie
   pliku tymczasowego przy błędzie. Nagłówek stdout → `Liczba produktow aktywnych:`.
   ⚠ `renameSync` musi iść w obrębie tego samego katalogu (cross-device rename rzuca `EXDEV`) — tmp
   leży obok pliku docelowego, tak jak w oryginale.
7. Nagłówek pliku (komentarz modułu): 59 → 60 kolumn.

### Krok 2 — CLI (`rebuild/backend/src/selly/csv-cli.ts` + `package.json`)
Wzorzec `src/db/migrate-cli.ts`: `wczytajEnv()` → `otworzBaze(env.DB_PATH)` → `wygenerujCsvSelly(db, sciezki)`
→ wypisanie `wynik.stdout` → `finally sqlite.close()`, kod wyjścia 1 przy błędzie.
Skrypty: `"selly:csv": "node dist/selly/csv-cli.js"`, `"selly:csv:dev": "tsx src/selly/csv-cli.ts"`.
⚠ Polecenie nadpisuje **wyłącznie plik CSV** (`renameSync` na `SELLY_CSV_DIR/SELLY_CSV_PLIK`) —
nie tworzy, nie czyta i nie kasuje `.htaccess` w katalogu eksportu.

### Krok 3 — pole w API
`src/repos/kolumny.ts`: usunięcie `"blokowaneFormyPlatnosci"` z `KOLUMNY_POZA_KONTRAKTEM.products`,
aktualizacja komentarza („ukryte do czasu I15.3" → „wystawione w I15.3, ticket 122"; `uwagaCena` zostaje).

### Krok 4 — przenagranie fixture'ów
`tools/record-write-fixtures.cjs` na kopii `db/snapshot.db` (pułapki z CLAUDE.md: wygaszenie
schedulera dostawców przed startem, CWD = katalog backendu). Zakres: `GET_products*`,
`PATCH_products_id`, `PUT_products_id`. Weryfikacja: 73 klucze, obecność `blokowaneFormyPlatnosci`.
Aktualizacja strażników na 73 klucze + asercja na obecność i wartość pola.

### Krok 5 — kontrakt
`contract/openapi.yaml`: opis pola `blokowaneFormyPlatnosci` w schemacie produktu katalogu
(`text`, nullable, tylko do odczytu, utrzymywane triggerem po `dostawca`).

### Krok 6 — front
- `pages/katalog/kolumny.ts`: wpis w `KOLUMNY` (na końcu → ląduje przed stałą kolumną „Akcje"),
  wpis w `KOLUMNY_DOMYSLNE`, funkcja retrofitu `uzupelnijBlokowaneFormy`.
- `pages/Katalog.tsx:211`: złożenie retrofitów przy odczycie zapisanego wyboru.
- `pages/katalog/filtrowanie.ts`: jawne pole w `type Produkt`.
- Render: sprawdzić, że `formatujKomorke` dla `null`/`""` daje `<Kreska />` („—"); jeśli domyślna
  gałąź tego nie robi — dołożyć. `title` z pełną wartością (jak `td.title` oryginału).

### Krok 7 — testy i pomiar
Kolejność: generator → CLI → API → front. Po każdym kroku `lint` + `typecheck`.

## Strategia testów

**GATE odbudowy (obowiązkowy — ticket dotyka kontraktu):**
- `GET /api/products`, `PATCH`/`PUT /api/products/{id}` vs przenagrane `contract/fixtures/` — kształt 1:1
  (73 klucze) + wartości deterministyczne.
- Walidacja odpowiedzi względem `contract/openapi.yaml`.
- Bramki frontu jadą po tym samym fixture (`test/msw/kontrakt.ts`) — muszą przejść bez ręcznej podmianki.

**Testy jednostkowe (`test/selly.generator-csv.test.ts`):**
- `LICZBA_KOLUMN === 60`, `kolumny[59] === "Blokowane-formy-platnosci"`.
- **Linia nagłówkowa identyczna z realnym plikiem produkcji** z `88fa31c` — najmocniejszy dowód formatu.
- `R/D` na pozycji 30 z wartościami „Radialna"/„Diagonalna" (#76 pkt 3 — *sprawdzone testem, nie założone*).
- `nazwaKategoriiSklepu`: `Rolnicze`→`Opony rolnicze`, `rolnicze male`→`Opony rolnicze`,
  `Leśne`→`Opony leśne`, **`Przemysłowe`→`Opony przemysłowe`** (przypadek `ł`, dla którego powstała
  druga łatka #76), `Ciężarowe`→`Opony ciężarowe`, wartość spoza mapy → bez zmian, `null` → `""`.
- Kolumna 60: wartość z bazy; fallback z mapy przy pustej wartości; **MO6 → puste**; nieznany dostawca → puste.
- Tylko `status='aktywny'` — produkt `wstrzymany` w bazie testowej NIE pojawia się w pliku.
- Zapis atomowy: po `wygenerujCsvSelly` w katalogu nie zostaje żaden plik `.tmp-*`.
- CSV nie przecieka do `KOLUMNY_BOOL` (wartość „201, 202, …" nie zamienia się w „Tak").

**Test CLI:** uruchomienie wejścia CLI na bazie tymczasowej i porównanie **bajt w bajt** z plikiem
z `wygenerujCsvSelly` (ta sama funkcja = ten sam plik; test pilnuje, że CLI nie rozjedzie się z trasą).

**Testy frontu:** kolumna widoczna domyślnie w `/katalog`, wartość z API, `—` dla `null` (MO6),
retrofit dokłada kolumnę do zastanego zapisu bez niej. ⚠ MSW `onUnhandledRequest:"error"` nie wywala
testu — asercje muszą sprawdzać TREŚĆ komórki, nie sam brak wyjątku.

**Pomiar (do raportu):** liczba wierszy pliku przed i po zmianie na kopii `db/snapshot.db`
(7405 produktów, 6898 `aktywny`) z nałożonymi migracjami, plus fakty z plików produkcji:
`.bak_20260922T160912Z_availability` = **8209** wierszy → dziś **5461** (z nagłówkiem).

## Poza zakresem

- `rebuild/backend/src/selly/rest/**` — Tor 2 / REST (I15.8, I15.10).
- Parsery i adapter importu (I15.2), staging i auto-wstrzymania (I15.4).
- `availability_sync.cjs` — wywoływanie generatora po zmianie dostępności (I15.10); tu tylko
  **wystawiamy** funkcję nadającą się do wywołania in-process i opisujemy sygnaturę.
- Ręczna edycja pola przez `PATCH` (D6).
- `rebuild/schema/` i model — zrobione w I15.1 (ticket 107).
- `docs/rebuild-roadmap.md` — zmienia wyłącznie koordynator.
- Przepięcie crona na produkcji — `docs/cutover.md`; tu tylko dokładne polecenie w „Do koordynatora".

## Definition of done

- [x] `LICZBA_KOLUMN === 60`, 60. nagłówek = `Blokowane-formy-platnosci`, linia nagłówkowa identyczna z plikiem produkcji z `88fa31c`
- [x] `nazwaKategoriiSklepu` pokrywa 5 kluczy mapy + przypadek `ł` (`Przemysłowe`), fallback bez zmian
- [x] Test potwierdza nagłówek `R/D` i wartości „Radialna"/„Diagonalna"
- [x] W pliku wyłącznie produkty `aktywny`; zapis atomowy, po generowaniu brak plików `.tmp-*`
- [x] Fallback kolumny 60 działa; MO6 i nieznany dostawca → puste pole
- [x] `npm run selly:csv` tworzy plik **bajt w bajt** identyczny z plikiem z trasy; nie dotyka `.htaccess`
- [x] ~~`GET /api/products` oddaje `blokowaneFormyPlatnosci`~~ → **rozstrzygnięte pomiarem: produkcja
      tego pola nie oddaje, więc ukrycie zostaje** (D2′). Fixture'y i openapi bez zmian.
- [x] ~~Strażnicy przestawieni na 73~~ → zostają na 72; poprawione komentarze, które błędnie
      zapowiadały ujawnienie
- [x] ~~Pole opisane w `contract/openapi.yaml`~~ → nie dotyczy, pole nie wychodzi z API
- [x] Kolumna „Blokowane formy płatności" widoczna domyślnie w `/katalog`, „—" dla MO6/nieznanego, retrofit działa
- [x] GATE: fixtures + openapi zgodne po OBU stronach (backend i front) — bez zmian, zgodne z nagraniem
- [x] Bramki zielone: `lint`, `typecheck`, `build`, `test` w `rebuild/backend/` i `rebuild/frontend/`
- [x] Pomiar wierszy przed/po w `raport.md`
- [ ] `docs/karty/I15.3/karta.md` opisuje STAN; sygnatura funkcji dla I15.10 i polecenie crona w „Do koordynatora" *(krok 13-15)*
