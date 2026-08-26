# 7-FEATURE-silnik-zatwierdzanie-wycofania-overrides — raport z implementacji

## Podsumowanie

Silnik importu `tk()` jest kompletny: decyzje, które 3c tylko liczyła, mają teraz skutki.
Auto-zatwierdzanie aktualizuje katalog, dopisuje wiersz do `historia_cen` i przepuszcza patch
przez `bridge_ext.applyDims`; pętla wycofań wystawia pozycje `wycofana` po trzech nieobecnościach
pod rząd; poprawki Marty działają realnie i wygrywają z plikiem dostawcy. `products.szerokosc`
zmieniła typ na TEXT (backlog #3). Charakteryzacja silnika porównuje port z uruchomionym
oryginałem **pole po polu na 12 620 realnych poprawkach Marty** i jest zielona; 8 celowych
mutacji silnika zostało złapanych.

Brzeg HTTP (`acceptStaging` + 8 endpointów) świadomie nie wchodzi — to sesja **3d-2** (D0).

## Zmiany

**Port legacy**
- **Nowe:** `src/import/legacy/bridge_ext.cjs`, `src/import/legacy/tire_dims.js` — kopie
  bajt-w-bajt z `mirror/backend/`, objęte istniejącym porównaniem sha256.
- **Nowe:** `src/import/legacy/package.json` — marker `"type": "commonjs"`. JEDYNY plik
  w `legacy/` spoza portu; szczegóły w „Napotkane pułapki".
- **Nowe:** `src/import/silnik/bridge-ext.ts` — typowany most ESM→CJS + `uchwytSqlite()`.

**Silnik**
- `src/import/tk.ts` — efekty auto-zatwierdzania (`:47791-47806`) i pętla wycofań
  (`:47807-47847`); stała `WYCOFANIE_PROG_IMPORTOW = 3`; `poprawkiMarty(db)` zamiast stubu.
- `src/import/silnik/overrides.ts` — realne `Gq()` (`:47319-47348`) zamiast przepuszczającego
  stuba, z trzema niesymetriami oryginału opisanymi w kodzie.
- **Nowe:** `src/repos/historia.ts`, `src/repos/overrides.ts`.

**Schemat**
- **Nowe:** `rebuild/schema/003_szerokosc_text.sql` — `products.szerokosc` REAL→TEXT przez
  przebudowę tabeli (SQLite nie ma `ALTER COLUMN`).
- `src/db/schema.ts` — `szerokosc: real()` → `text()`.

**Testy i harness**
- `test/charakteryzacja/silnik/atrapy.mjs` — realne `getOverridesFor`, przechwytywanie
  `INSERT INTO historia_cen`, REALNY `bridge_ext` zamiast no-opa, licznik zapytań do pamięci
  linków, `zmianyProduktow()` mierzące skutek w katalogu; poprawione `deleteProduct`.
- `test/charakteryzacja/silnik/wzorzec.mjs` — usunięta sekcja `pozaZakresem3c`; do porównania
  wchodzą wiersze `wycofana`, licznik `wycofane`, `historia_cen` i zmiany produktów.
- `test/charakteryzacja/silnik/scenariusze.mjs` — 12 nowych scenariuszy celowanych.
- `scripts/charakteryzacja-silnik-nagraj.mjs` — ładuje `manual_overrides` ze zrzutu, zapisuje
  je do `silnik/overrides/`, konwertuje `szerokosc` do postaci po `szertxt`.
- **Nowe:** `test/silnik.decyzje.test.ts` (15 testów), `test/bridge-ext.test.ts` (6 testów).
- `test/gate/asercje.ts` — mechanizm **zadeklarowanych, samoczyszczących się wyjątków** GATE.
- `test/katalog.gate.test.ts`, `test/produkty.test.ts`, `test/gate/dane.ts`,
  `test/db.migracje.test.ts` — dostosowane do TEXT + strażnik DDL migracji 003.
- **Usunięte:** `przelaczSzerokoscNaText()` z `test/gate/dane.ts` — kanon jest już TEXT.

## Odstępstwa od planu

Plan zrealizowany bez odstępstw w zakresie. Dwie rzeczy dołożone ponad plan, obie
wymuszone przez znalezione błędy (opisane niżej): marker `package.json` w porcie legacy
i twardy strażnik w `uchwytSqlite()`.

## Napotkane pułapki (wszystkie złapane testem, nie przeglądem)

**1. Cicha awaria portu `bridge_ext` — najgroźniejsza rzecz w tym tickecie.**
`tire_dims.js` to pierwszy plik `.js` w `src/import/legacy/`, a backend ma `"type": "module"`,
więc Node potraktował go jako ESM i `require('./tire_dims.js')` padło. `bridge_ext` jest
**z założenia defensywny** — łapie ten wyjątek i zostawia `packageDims = null`, przez co
`applyDims` zwraca `null` i wymiary paczki NIGDY się nie liczą: bez wyjątku, bez logu, bez
czerwonego testu. Naprawione markerem `package.json` (`"type": "commonjs"`), tak jak ma to
`mirror/backend/`. Strażnikiem jest `test/bridge-ext.test.ts`, który sprawdza wartości
wymiarów, a nie sam fakt, że nic nie wybuchło.

**2. Atrapy oddawały poprawki Marty w złej kolejności.** `U.getOverridesFor` nie ma `ORDER BY`,
ale schemat ma `UNIQUE(supplier_kod, supplier_product_id, field_name)` — SQLite realizuje więc
filtr skanem tego indeksu i oddaje wiersze **posortowane po `field_name`** (potwierdzone
`EXPLAIN QUERY PLAN`). Kolejność przecieka do komunikatu dla człowieka: produkcja pisze
„plik nadpisuje poprawke Marty: **bieznik, model**", a nie „model, bieznik". Rację miał port,
błąd był w atrapach. Poprawione po obu stronach, z komentarzem w obu.

**3. Produkcyjne `deleteProduct` kasuje tylko z BAZY, nie z tablicy katalogu.** Pętla wycofań
idzie po tablicy pobranej przed kasowaniem, więc produkt skasowany w gałęzi nie-opony **nadal**
jest przez nią rozpatrywany i przy trzeciej nieobecności dostaje wiersz `wycofana` mimo że już
nie istnieje. Atrapy 3c wycinały go z tablicy (bez znaczenia, dopóki pętli wycofań nie było).
Odtworzone wiernie + scenariusz `kasowanie-a-potem-wycofanie`.

**4. `db/snapshot.db` jest STARSZY niż produkcyjna migracja `szertxt`.** Zrzut z 2026-08-13 ma
`szerokosc REAL`, migracja jest z 2026-08-19. Po zmianie naszego kanonu na TEXT obie strony
porównania dostawały różne wejście i charakteryzacja mierzyła wiek zrzutu zamiast wierności
silnika. Skrypt nagrywający konwertuje teraz `szerokosc` przez `String(liczba)` — a nie przez
`CAST(… AS TEXT)`, bo SQLite renderuje `REAL` 710 jako „710.0", czego parser nigdy nie zapisze
(dokłada to sztuczne różnice „szerokość: 710.0 → 710"). Po poprawce **wzorce wyników silnika
nie zmieniły się ani o bajt** — czyli zmiana typu kolumny nie rusza zachowania silnika,
tylko sposób przechowywania.

**5. Zabłąkany bajt NUL** w kluczu mapy poprawek w atrapach — po rozspójnieniu z odczytem
poprawki Marty przestały być w ogóle nakładane. Klucz ma teraz jawny separator `\u0000` (lepszy niż spacja: `supplier_product_id` to dowolny napis dostawcy i może spację zawierać).

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne. Ten ticket **nie dodaje ani nie zmienia
  żadnej ścieżki API** — gate obowiązuje w trybie regresji. Sprawdzone i zielone:
  `GET_products.json` (z jednym zadeklarowanym wyjątkiem, niżej), `GET_suppliers.json`,
  `GET_dostawcy.json`, `GET_staging.json`, `GET_staging_paged.json`, GATE I2
  (`katalog.gate.test.ts`), gate treści importu przez `POST /api/import/parse-file`.
- **⚠ Jeden ZADEKLAROWANY wyjątek GATE:** `$.items[*].szerokosc` w `GET_products.json`.
  Fixture nagrano PRZED produkcyjną migracją `szertxt`, więc ma tam liczby; produkcja i nasz
  kanon (po migracji 003) mają TEXT. Fixture'a nie ruszamy (Krok 9). Wyjątek jest opisany
  (`co`/`dlaczego`/`co domyka`), **wymuszany** — martwy wyjątek zapala test — i domyka go
  przenagranie fixtures w **I12**. Osobny test pilnuje, że lista wyjątków ma dokładnie
  jedną pozycję.
- **Charakteryzacja silnika:** ✓ 49 testów. Port == uruchomiony oryginał, porównanie pole po
  polu: 1838 rekordów wejścia, 7405 produktów katalogu, **12 620 realnych poprawek Marty**,
  286 auto-zatwierdzeń, 286 wierszy `historia_cen`, 149 wierszy `wycofana`, 5910 zmian stanu
  produktów, 31 scenariuszy celowanych.
- **Skuteczność bramki potwierdzona 8 mutacjami** — każda złapana: próg wycofania 3→2 i 3→4,
  brak zerowania licznika po wycofaniu, pominięty zapis do `historia_cen`, pominięte
  `applyDims`, override alarmujący mimo `acknowledgedSourceValue`, override meldujący bez
  nadpisania, `historia_cen` z ceną sprzed zmiany zamiast po.
- **Charakteryzacja parserów 3a:** ✓ bez zmian w samych testach (dołożone tylko dwa pliki do
  porównania sha256).
- **Testy decyzji:** ✓ 15 — auto-approve vs człowiek, wycofanie po TRZECIEJ nieobecności
  (jawnie: nie po drugiej, nie po czwartej), reset licznika przy dopasowaniu, precedencja
  override, `acknowledgedSourceValue`, bezpiecznik pustego wejścia.
- **Razem:** 328 testów zielonych (było 286 w 3c), 22 pliki.
- `npm run lint` / `typecheck` / `build` — czyste.

## Breaking changes

- **Wdrożenie wymaga migracji** `npm run migrate` (`003_szerokosc_text.sql`). Migracja
  PRZEBUDOWUJE tabelę `products` — na bazie produkcyjnej warto zrobić kopię przed wdrożeniem.
- `products.szerokosc` zmienia typ na TEXT: `GET /api/products` zwraca tam odtąd **string**,
  nie liczbę. Konsument frontendowy musi to znieść (I12 przenagra fixtures).

## Follow-up

- **3d-2 (API):** `acceptStaging` + `assignKodImportu` w `addProductsBulk`, propagacja
  `uwagaCena`, 8 endpointów (`POST /api/staging/accept|reject|import|clear`,
  `PUT`/`DELETE /api/staging/{id}`, `GET`/`POST /api/overrides`, `DELETE /api/overrides/{id}`),
  fixture `GET_overrides.json`. `src/repos/overrides.ts` czeka gotowe na `listOverrides`,
  `upsertOverride` i `deleteOverride` — dopisać TAM, nie w nowym pliku.
- **I12:** przenagranie `GET_products.json` → usunięcie zadeklarowanego wyjątku GATE;
  dopisanie `GET /api/products/uwagi-cena` **i `GET /api/products/hold-reasons`** do
  `openapi.yaml` (produkcja ma oba w `uwaga_cena_patch.cjs`).
- **I4:** `acceptStaging` w produkcji stosuje narzuty i promocje
  (`__bridgePickMarkup`/`__bridgePickPromo`, `:44884-44892`). W I3 obie tabele są puste, więc
  gałąź nie wchodzi i pominięcie jest bezpieczne — ale musi zostać domknięte w I4.
- **Wydajność (niepilne):** `poprawkiDla()` robi SELECT na pozycję, tak jak oryginał. Przy
  1838 rekordach × 12 620 poprawek jest to bez znaczenia; warte uwagi przy dużych buforach.
- **Backlog #11** (cieniowanie `Lq()`) — nietknięte, czeka na decyzję Ani.
