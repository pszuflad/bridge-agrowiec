# 44-CHORE-i13c-migracje-konwencji — raport z implementacji

## Podsumowanie

Warstwa DANYCH Iteracji 13 (karta 13c). Trzy konwencje, które Ania wprowadziła na produkcji
2026-08-18 i 2026-09-01, odtworzone jako numerowane migracje `rebuild/schema/004`–`006`:
kategoria do Wielkiej litery, konstrukcja z kodów jednoliterowych na pełne słowa, nazwa na
WIELKIE litery wraz ze sprzątaniem wierszy `staging_items` CASE_ONLY. Migracje są idempotentne
TREŚCIOWO (nie tylko przez ewidencję `_migracje`), co jest warunkiem koniecznym, bo cutover idzie
na tej samej `data.db`, którą produkcja już zmigrowała. Fixtures pisząco-czytające przenagrane
z żywego oryginału postawionego na bazie doprowadzonej do stanu produkcji po 09-01.

## Zmiany

- **Nowy:** `rebuild/schema/004_kategoria_wielka_litera.sql` — backlog #2 + #57 (część
  migracyjna). Mapa = unia `KATEGORIA_CANONICAL_MAP` (`common.cjs:592-599`) i mapy
  z `mirror/backend/apply_kategoria.cjs:12`; obie są cząstkowe.
- **Nowy:** `rebuild/schema/005_konstrukcja_slowa.sql` — backlog #58 (część migracyjna).
  `normalizeKonstrukcja()` przyłożone do istniejących wierszy.
- **Nowy:** `rebuild/schema/006_nazwa_caps.sql` — backlog #59 (część migracyjna).
  `UPPER` na `products.nazwa` i `manual_overrides` pola `nazwa` + `DELETE` wierszy
  `staging_items` CASE_ONLY rekurencyjnym CTE.
- `rebuild/schema/README.md` — trzy pliki dopisane do tabeli; nowa sekcja o tym, że od 13c
  migracje niosą także DANE, i dlaczego idempotencja treściowa jest tu wymogiem.
- `rebuild/backend/test/db.migracje.test.ts` — `MIGRACJE` rozszerzone o trzy pliki; nowy
  `describe("migracje danych — konwencje 13c")` z siedmioma testami.
- `tools/record-write-fixtures.cjs` — `przygotujBaze()` dostaje krok `migrujKonwencje()`;
  zaktualizowane opisy dwóch nagrań `GET /api/products`.
- `contract/fixtures/GET_products.json`, `GET_products_bez-parametrow.json`,
  `PUT_products_id.json`, `PATCH_products_id.json` — przenagrane.

## Odstępstwa od planu

Brak odstępstw od planu. Plan powstał po pomiarach, więc implementacja poszła 1:1.

Odstępstwa od ORYGINAŁU (świadome, opisane w `plan.md` D6/D7 i w nagłówkach migracji):

- **D6 — bez wpisów w `history`.** `apply_kategoria.cjs` i `uppercase_fields.cjs` dopisywały
  wiersz `history` na każde zmienione pole (`zrodlo='fix-kategoria'`, `kto='Anna'`). Migracja
  SQL nie ma zegara ani autora — wpisywałaby do dziennika audytowego zmyśloną datę i cudze
  nazwisko. Stan tabel `products` / `manual_overrides` / `staging_items` jest identyczny.
- **D3/D4 — mapy szersze niż dosłowny SQL z CHANGELOG-a.** Migracje mapują po kluczu
  znormalizowanym (`LOWER(TRIM(...))`), więc obejmują też pełne słowa, warianty bez polskich
  znaków, `'-'` i `'rolnicze małe'`. Każdy dołożony klucz pochodzi z mapy produkcji
  (`KONSTRUKCJA_CANONICAL_MAP`, `KATEGORIA_CANONICAL_MAP`, `apply_kategoria.cjs`), a wszystkie
  są no-opem na bazie cutoveru. Zysk: idempotencja i odporność na stan bazy odbudowy.
- **D5 — reguła CASE_ONLY ostrożniejsza niż skrót z CHANGELOG-a** (każdy segment `powod`
  case-only, nie tylko segment `nazwa`). Zmierzona równoważność na realnych danych: obie reguły
  dają **739** wierszy, rozjazd 0. ⚠ Te 739 to pomiar RÓWNOWAŻNOŚCI REGUŁ, liczony w JS
  (`toUpperCase()`, Unicode-aware). Sam `DELETE` kasuje **723** wiersze i to jest liczba
  właściwa — patrz „Resztka diakrytyczna" niżej.

### Resztka diakrytyczna — 739 (JS) vs 723 (SQL), różnica 16 wierszy

Wyszło przy review i jest zapisane w nagłówku `006_nazwa_caps.sql` oraz przybite testem
`006 — case-only na polskim diakrytyku NIE jest kasowany`.

`UPPER()` SQLite jest ASCII-only nie tylko w `UPDATE … nazwa=UPPER(nazwa)`, ale **również
w predykacie CASE_ONLY**. Dla „prowadząca" vs „PROWADZĄCA" (id 710497 w snapshocie) zostawia
małe `ą` po lewej i duże `Ą` po prawej, więc wiersz nie jest uznany za case-only i ZOSTAJE —
na zawsze, bo ponowne uruchomienie też go nie złapie. Stąd `DELETE` kasuje 723, a nie 739.

**To jest spójne i zamierzone, nie przeoczenie.** Skoro `UPPER(nazwa)` zostawia w bazie
„PROWADZąCA", to plik dostawcy z „PROWADZĄCA" nadal się od niej różni i wiersz
`zmiana_kluczowa` jest tam zasadny. Produkcja użyła tego samego SQLite-owego `UPPER()`
w swoim `DELETE`, więc ma tę samą resztkę. Przestawienie predykatu na porównanie Unicode-aware
skasowałoby 16 wierszy, których produkcja nie skasowała — dlatego test pilnuje, żeby taka
„poprawka" zapaliła czerwone.

## Sprostowania faktów (znalezione w trakcie, wymagają korekty docs)

1. **Prompt startowy 13c i roadmapa mówiły, że wzorcem migracji jest „#2 kategoriafix, #3
   szertxt".** Backlog #2 NIE dostał migracji — zamknięto go w I3/3a **portem**
   (`capitalizeKategoria()` w `adapter.recordToSurowe()`). Jedynym wzorcem migracji było #3
   (`003_szerokosc_text.sql`). Kategoria migrację dostaje dopiero teraz, w 13c.
2. **Roadmapa bloku 13c pisała, że produkcja migrowała także `konstrukcja = '-'`.** SQL
   produkcji (CHANGELOG 09-01 11:35) objął wyłącznie `R`/`D`/`L`/`B`; klucz `'-'` istnieje tylko
   w `KONSTRUKCJA_CANONICAL_MAP` jako mapowanie dla PRZYSZŁYCH importów. Nasza migracja go
   obejmuje (D3 — jest kluczem mapy kanonicznej), ale twierdzenie o produkcji było błędne.
3. **Roadmapa zapowiadała DRUGIE przesunięcie wzorca charakteryzacji silnika po
   `UPPER(nazwa)`.** Zmierzone: **nie nastąpiło, diff = 0.** Harness
   (`scripts/charakteryzacja-silnik-nagraj.mjs:210-227`) karmi ORAZ oryginał, ORAZ nasz port
   z surowego `db/snapshot.db`, którego 13c nie dotyka — obie strony dostają identyczne
   wejście, więc migracja nie może wzorca przesunąć. Przenagranie potwierdziło: zero zmian
   w `test/charakteryzacja/`.

## Wyniki testów

### Gate odbudowy (fixtures/kontrakt) — ✓ zgodne

- **Przenagrane z oryginału @08.09** (`tools/record-write-fixtures.cjs`, 19 nagrań):
  `GET_products.json`, `GET_products_bez-parametrow.json` — `konstrukcja` `"R"`→`"Radialna"`,
  `"D"`→`"Diagonalna"` (5 miejsc), `nazwa` `"8.00x20 BKT TR135 E 8PR TT"`→`"8.00X20 …"`;
  `PUT_products_id.json`, `PATCH_products_id.json` — wyłącznie `dataAktualizacji` i `kodImportu`,
  czyli znany, opisany niedeterminizm nagrywarki (`contract/README.md`: „odtwarzalne znaczy
  ten sam KSZTAŁT"). Pozostałe 15 nagrań bez zmian.
- **Kontrakt:** `node tools/generate-openapi-schemas.cjs --sprawdz` → „contract/openapi.yaml
  aktualny wobec fixtures".
- **Ścieżki sprawdzone przez bramki:** `GET /api/products` (oba warianty), `GET /api/suppliers`,
  `GET /api/dostawcy`, mutacje produktu (`POST`/`PUT`/`PATCH`/`DELETE`), `GET /api/staging`,
  `GET /api/overrides`, `GET /api/analytics/*` — wszystkie zielone.

⚠ **Czego NIE udało się przenagrać i dlaczego — pełna lista, bez zamiatania.**
Skanowanie wszystkich 74 fixtures pod kątem trzech konwencji zostawia trzy pliki niosące
nazwy produktów w stanie sprzed 09-01:
`GET_analytics_ean_comparison.json`, `GET_analytics_ean-porownanie.json`,
`GET_analytics_suppliers_lifecycle.json` (np. `"520/85R42 Trelleborg TM600 157A8/157B TL"`).
Nie mają pola `_zrodlo`, czyli pochodzą ze starszej nagrywarki `tools/record-fixtures.sh`,
która nagrywa **przeciw ŻYWEJ produkcji** i wymaga logowania — sekretów nie mam i nie szukam,
a nagrywanie przeciw produkcji jest działaniem na zewnątrz. Dograć je z piaskownicy
(`record-write-fixtures.cjs`) technicznie by się dało, ale byłby to **downgrade wiarygodności**:
zamieniłbym nagranie z żywej produkcji (219 MB `data.db`) na nagranie z okrojonego snapshotu
(32 MB), zmieniając przy okazji wszystkie agregaty i rankingi, a nie tylko trzy konwencje.
`contract/README.md` stawia żywą produkcję wyżej niż piaskownicę dla tras GET.
Gate tych tras porównuje KSZTAŁT (`test/gate/ksztalt.ts` — klucze, typy, zagnieżdżenie),
więc nic nie jest zablokowane. Zgłoszone jako follow-up.

Fixtures, które pokazują `nazwa` mieszaną wielkością liter **i tak ma być**:
`GET_suppliers`/`GET_dostawcy`/`GET_admin_*` (to nazwy DOSTAWCÓW — „Bohnenkamp"),
`GET_markups` (nazwa reguły), `GET_staging*` (`staging_items.nazwa`), `GET_history`
(`history.nazwa`). Produkcja żadnej z tych kolumn nie migrowała.

### Testy jednostkowe i integracyjne

- **Pełny przebieg:** 80 plików, **1241 testów, wszystkie zielone** (po przenagraniu fixtures
  i po dołożeniu testu-strażnika resztki diakrytycznej z review).
- **Nowe:** `test/db.migracje.test.ts` — 7 testów migracji danych (łącznie 12 w pliku):
  mapowanie kategorii z zachowaniem wartości spoza map; kody konstrukcji z zachowaniem `X`/NULL;
  `UPPER` na `nazwa` i override `nazwa` z nietykalnością pozostałych pól override;
  ASCII-only `UPPER` przybity wprost jako fakt o produkcji; cztery przypadki CASE_ONLY
  (jednosegmentowy kasowany, wielosegmentowy case-only kasowany, realna zmiana w drugim polu
  ZOSTAJE, `ostrzezenie` ZOSTAJE, `powod` spoza `nazwa:%` ZOSTAJE, inny `typ_zmiany` ZOSTAJE);
  idempotencja treściowa; resztka diakrytyczna (case-only na `ą`/`Ą` NIE jest kasowany —
  strażnik przed „poprawieniem" predykatu na Unicode).
- **Pomiar na realnych danych** (kopia `db/snapshot.db`, 7405 produktów), przebieg 1 → przebieg 2:

  | Migracja | Zmienionych (1. przebieg) | Zmienionych (2. przebieg) |
  |---|---|---|
  | `004_kategoria_wielka_litera.sql` | 537 | **0** |
  | `005_konstrukcja_slowa.sql` | 7392 | **0** |
  | `006_nazwa_caps.sql` | 2647 | **0** |

  Stan po `004` to **dokładnie** rozkład, który Ania zweryfikowała na produkcji
  (CHANGELOG 09-01 10:35): Rolnicze 4533, Ciężarowe 1463, Przemysłowe 1195, Leśne 214.
  To niezależne potwierdzenie, że mapa jest kompletna.
- **Lint / typecheck / build:** zielone.

### Wzorzec charakteryzacji silnika

Przenagrany (`scripts/charakteryzacja-silnik-nagraj.mjs`) → **zero zmian w
`test/charakteryzacja/`**. Zapowiadane w roadmapie drugie przesunięcie nie nastąpiło —
uzasadnienie w „Sprostowania faktów" pkt 3.

## Breaking changes

Brak w API. Zmiana jest w DANYCH i jest zamierzona:

- `products.konstrukcja` przestaje zwracać kody `R`/`D`/`L`/`B` — od teraz `Radialna`/`Diagonalna`.
  **Konsument frontendu jest sparowany z tą kartą i wchodzi w 13e** (roadmapa: „konstr — FE strona
  konstrukcji"). Do czasu 13e panel radzi sobie sam: bundle produkcji od 09-01 ma pass-through
  wartości surowej (`n||""`), więc pełne słowo wyświetla bez zmian.
- `products.nazwa` i `manual_overrides.override_value` (pole `nazwa`) są WIELKIMI literami.
- `staging_items` traci wiersze CASE_ONLY (na `db/snapshot.db`: 723 z 1457 `zmiana_kluczowa`).

Migracja jest jednokierunkowa. `scripts/kopia-bazy.cjs` (kopia przed migracją, ticket 8) działa
bez zmian, a runner stosuje każdy plik w transakcji.

## Poprawki po review

- **SHOULD-FIX (poprawione):** nagłówek `006_nazwa_caps.sql` i `raport.md` podawały 739 jako
  liczbę kasowanych wierszy CASE_ONLY, a `DELETE` kasuje 723 — dokument przeczył sam sobie.
  739 to pomiar RÓWNOWAŻNOŚCI reguł R2≡R3 liczony w JS (Unicode), 723 to realny wynik SQL-a.
  Przyczyna (ASCII-only `UPPER` również w PREDYKACIE, nie tylko w `UPDATE`) opisana w nagłówku
  migracji i w sekcji „Resztka diakrytyczna"; dołożony test-strażnik.
- **NICE-TO-HAVE (poprawione):** predykat CASE_ONLY ma teraz wypisane wprost założenie, że
  pierwsze `: ` należy do etykiety, a pierwsze ` → ` do separatora, wraz z uzasadnieniem, że
  złamanie tego założenia działa wyłącznie w kierunku bezpiecznym (wiersz zostaje).
- **NICE-TO-HAVE (poprawione):** narracja 739/723 ujednolicona między sekcjami raportu.
- **BLOCKER ×2 (adresowane):** synchronizacja `docs/rebuild-roadmap.md` i
  `docs/rebuild-backlog.md` była zaplanowana jako osobny krok po review — patrz sekcja
  „Docs updates" niżej.

## Follow-up

Rzeczy zauważone i świadomie NIE zrobione w 13c.

1. **`manual_overrides` z nieprzemigrowanymi wartościami — luka produkcji, nie nasza.**
   `field_name='konstrukcja'` → 3 rekordy z wartością `'D'`; `field_name='kategoria'` →
   6944 rekordów ogółem, z tego 14 małą literą (9× `przemysłowe`, 5× `rolnicze`). Ania nie
   ruszyła ich ani 2026-08-18, ani 2026-09-01, więc my też nie (1:1). Skutek jest realny: przy
   kolejnym imporcie override wstrzykuje surową wartość z powrotem i te konkretne produkty
   wracają do kodu `D` / małej litery, mimo poprawnej kolumny w `products`. **Kandydat na wpis
   backlogu** — to zachowanie produkcji, więc naprawa byłaby świadomym odstępstwem do decyzji
   użytkownika.
2. **Trzy fixtures analityki z nazwami sprzed 09-01** — szczegóły i uzasadnienie w „Wyniki
   testów". Domknie je przebieg `tools/record-fixtures.sh` przeciw żywej produkcji (wymaga
   logowania Anny) albo świadoma decyzja o rozszerzeniu nagrywarki piaskownicowej o trasy
   analityki.
3. **`contract/fixtures/GET_atrybuty_liczniki.json`** — niesie nieaktualne klucze słownika
   `kategoria::rolnicze` i `konstrukcja::B/D/L/R/X` (oraz generowane z nich enumy w
   `contract/openapi.yaml:951-959,11547-11551`). Przenagrać się go NIE DA nagrywarką
   piaskownicową: moduł `atrybuty` oryginału ma zahardkodowane ścieżki produkcyjne i lokalnie
   się nie podnosi (`CLAUDE.md`, `contract/README.md`). Gate tej trasy
   (`sprawdzZgodnoscZFixtureSlownika`) sprawdza wyłącznie kształt słownika, więc nic nie blokuje.
4. **`test/gate/dane.ts`** — zasiew bramek nadal ma `konstrukcja: "R"`/`"-"` i
   `kategoria: "Przyczepy"`. Zasiew leci PO migracjach (wstrzykiwany bezpośrednio przez
   Drizzle), więc migracja go nie dotyka, a gate porównuje kształt, nie wartości. Zmiana zasiewu
   przestawiłaby wejście kilkunastu testów spoza zakresu 13c — świadomie nietknięte.
5. **`konstrukcja` z wartością `'X'` (1 rek. w snapshocie) i 12 NULL-i** — poza mapą kanoniczną,
   nietknięte przez migrację i przez produkcję. Produkcja pozbyła się ich backfillem, którego
   decyzją 13f nie odtwarzamy.

## Docs updates

Trzej doc-checkerzy równolegle, każdy na rozłącznym zbiorze plików.

### `docs/rebuild-roadmap.md`
- Wiersz zbiorczy I13: dopisane `13c: ✅ 44-CHORE-i13c-migracje-konwencji · 2026-09-09`,
  „Zostają 13c/13d/13e" → „Zostają 13d/13e".
- Blok 13c przepisany z ZAMIARU na ROZLICZENIE: trzy migracje, pomiar 537/7392/2647 → 0/0/0,
  723 skasowane wiersze staging, cztery przenagrane fixtures, bramki 80/1241.
  Otwarte pytanie bloku („czy katunify wymaga migracji") ma teraz odpowiedź: TAK, 537 rekordów.
- **Trzy obalone twierdzenia usunięte, nie dopisane obok** (`CLAUDE.md` obowiązek 4):
  „wzór: #2 kategoriafix" (#2 nigdy nie miał migracji), „decyzja Anny: `-` → Diagonalna" jako
  opis kroku produkcji (produkcja objęła tylko `R`/`D`/`L`/`B`), „⚠ Drugie przesunięcie wzorca
  do przewidzenia" (zmierzone: diff = 0, z uzasadnieniem).
- Zdanie o sześciu konfliktach MO8 z 13b oznaczone jako **NIEZWERYFIKOWANE w tej karcie**
  zamiast zgadywania wyniku.
- **Ustalenia dla 13e wpisane DO BLOKU 13e** (`CLAUDE.md` obowiązek 2): migracja już weszła,
  brak pilności (bundle produkcji ma pass-through od 09-01), `nazwa` jest CAPS — uwaga na
  formatowanie w FE, ASCII-only `UPPER` zostawia małe diakrytyki i FE nie ma tego „poprawiać".
- Blok 13d sprawdzony — nie zawiera zdania zależnego od konwencji konstrukcji, nic nie dopisano.

### `docs/rebuild-backlog.md`
- **#57** — `Iteracja`/`Status` z czasu przyszłego na ✅ zrobione w 13c; dopisany pomiar 537 rek.
  i wyjaśnienie unii dwóch cząstkowych map produkcji.
- **#58** — ✅ zrobione w 13c, pomiar 7392; **sprostowanie faktu**: `'-'` nie był częścią
  migracji produkcji; nota o nietkniętych `X`/`NULL`.
- **#59** — **WPIS DOMKNIĘTY W CAŁOŚCI** (silnik 13b + migracja 13c); dopisana „resztka
  diakrytyczna" jako zmierzony fakt o produkcji wraz z wyjaśnieniem rozjazdu 739/723.
- **#2** — dopisane, że port naprawiał tylko u źródła, a stronę DANYCH domknęła dopiero
  migracja 13c (to jest sprostowanie premisy promptu startowego).
- **#65 (nowy wpis)** — `manual_overrides` nieprzemigrowane (3 rek. `konstrukcja='D'`,
  14 rek. `kategoria` małą literą), `Do nowej wersji?` → ⬜ **do decyzji**, bo naprawa byłaby
  świadomym odstępstwem od 1:1.
- Tabela „Mapowanie zmian → karty I13": wiersz 13c oznaczony zrobionym.

### `docs/spec-backend.md`
- Nowy blockquote „Odbudowa (13c…)" po istniejącym bloku 13b, w tej samej konwencji —
  domyka forward-ref z 13b („szum case-only usuwa dopiero migracja `UPPER(nazwa)` — 13c").
  Poza tym forward-refem plik nie zawierał twierdzeń o kodach `konstrukcja` ani o konwencji
  wielkości liter, więc nic więcej nie wymagało korekty.

### `docs/cutover.md`
- Wiersz tabeli „Baza": „nie migrujemy danych" doprecyzowane — nie przenosimy plików do innej
  bazy, ale `npm run migrate` stosuje na niej migracje schematu (001–003) i DANYCH (004–006).
- Krok 5 („Migracje na ŻYWEJ bazie"): 004–006 mają być no-opem na produkcji — to dowód
  wierności, nie usterka.
- Nieaktualna liczba testów backendu 79/1223 → 80/1241 (doc-checker wpisał 1240 ze stanu
  sprzed testu-strażnika; Master poprawił po finalnym przebiegu).
- ⚠ **Korekta Mastera na dopisie doc-checkera:** twierdził, że `npm run migrate` wypisuje liczbę
  zmienionych wierszy. **Nieprawda** — `migrate-cli.ts` wypisuje wyłącznie, które PLIKI
  zastosował i które pominął. Zastąpione konkretnym zapytaniem `sqlite3` na KOPII bazy,
  uruchamianym PRZED migracją na żywej, z wypisanymi wartościami oczekiwanymi.

### `contract/README.md`
- Sekcja „Skąd się biorą nagrania": dopisany krok 4 procedury piaskownicy
  (`migrujKonwencje()`), pozostałe przenumerowane. Zapisana **zasada**: stan wejściowy
  piaskownicy doprowadzamy do stanu produkcji artefaktami PRODUKCJI, nigdy plikami
  `rebuild/schema/` — inaczej nagranie byłoby dowodem na naszą własną migrację.
  Odnotowany wyjątek: `DELETE` staging CASE_ONLY celowo nieodtwarzany (CHANGELOG podaje go
  z placeholderami, przepisanie byłoby zgadywaniem).

### `CLAUDE.md`
- Nowy akapit w serii pułapek „nie ufaj X": **`UPPER()`/`LOWER()` w SQLite są ASCII-only**,
  ze skutkiem zmierzonym w 13c (16 wierszy `staging_items` niezłapanych przez predykat
  CASE_ONLY) i morałem, żeby nie „poprawiać" tego na wariant Unicode-aware bez sprawdzenia,
  co zrobił oryginał.

### Pre-existing issues (do wiadomości użytkownika, POZA zakresem tego ticketa)

- `docs/cutover.md` linia 3 — nagłówek „Wersja dokumentu: 2026-09-08 (ticket 39…)" nie jest
  bumpowany przy kolejnych korektach treści. Plik nie ma konwencji aktualizowania tej daty,
  a 44 nie dotyka nagłówka merytorycznie — zostawione bez zmian.
- `docs/rebuild-roadmap.md` — linia „Kolejność: 13f → 13a → 13b → 13c → {13d, 13e}" opisuje
  plan sprzed realizacji. Nie jest fałszywa (kolejność faktycznie tak przebiegła), zostawiona.
- **`migrate-cli.ts` nie raportuje liczby zmienionych wierszy.** Dla migracji SCHEMATU to nie
  miało znaczenia, ale od 13c pliki niosą DANE i „ile wierszy ruszyło" jest istotną informacją
  operacyjną — zwłaszcza przy cutoverze, gdzie oczekiwanym wynikiem jest zero. Obejście
  (zapytanie na kopii) jest w `cutover.md`; docelowa poprawka runnera to kandydat na osobny
  ticket, świadomie poza zakresem 13c.
