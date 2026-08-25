# 3-FEATURE-katalog-odczyt — raport z implementacji

## Podsumowanie

Iteracja 2 odbudowy: backend dostał `GET /api/products` odtworzony 1:1 z produkcji (oba
kształty odpowiedzi, cap `limit`, filtr `dostawca`) oraz `GET /api/suppliers` / `GET /api/dostawcy`
z polami liczonymi w locie, a frontend — pełny widok `/katalog` z tabelą 59 kolumn, filtrami,
szukajką tokenową, sortowaniem, paginacją, wirtualizacją i podglądem produktu. Wszystkie trzy
ścieżki przechodzą GATE (kształt 1:1 z `contract/fixtures/` + walidacja wg `openapi.yaml`).
Endpointy zweryfikowane dodatkowo na **realnym snapshocie produkcji** (`db/snapshot.db`,
7 405 produktów, 10 dostawców).

## Zmiany

### Backend (`rebuild/backend/`)

- `src/db/schema.ts` — **dwie naprawy defektów introspekcji** (D5): `snow3Pmsf` → `snow3pmsf`
  oraz `{ mode: "boolean" }` na 10 kolumnach (`reinforced`, `extraLoad`, `cutResistant`,
  `heatResistant`, `stubbleResistant`, `nro`, `cho`, `ms`, `snow3pmsf`, `cfo`). Bez tego GATE
  zgłaszałby jednocześnie brakujący i nadmiarowy klucz oraz `0` zamiast `false`.
  `eanIsValid` celowo zostaje zwykłym `integer()`.
- **Nowy:** `src/repos/products.ts` — `listaProduktow` / `listaProduktowStronicowana`
  (odpowiedniki `U.listProducts*`, `backend-index.cjs:44699-44721`).
- **Nowy:** `src/repos/suppliers.ts` — `listaDostawcow` + wydzielona, testowalna `przeliczStatus`;
  `liczbaProduktow` z `count(*)`, znaczniki ostatnich zmian z zapytania okienkowego po
  `historia_cen` (`backend-index.cjs:45011-45036`).
- **Nowy:** `src/routes/products.ts` — `GET /api/products` za `requireAuth`, oba kształty
  odpowiedzi, `MAX_LIMIT = 2000`, `DOMYSLNY_LIMIT = 200`.
- **Nowy:** `src/routes/suppliers.ts` — jeden handler pod `/api/dostawcy` i `/api/suppliers`.
- `src/app.ts` — rejestracja obu routerów + `compression()` (D2).
- `package.json` — nowe zależności: `compression`, `@types/compression`.

### Testy backendu

- **Nowy:** `test/gate/dane.ts` — seed produktów/dostawców/`historia_cen` pokrywający pułapki
  typów, plus `przelaczSzerokoscNaText` (odtworzenie migracji `szertxt` na bazie testowej).
- **Nowy:** `test/katalog.gate.test.ts` — GATE dla trzech ścieżek (8 testów).
- **Nowy:** `test/produkty.test.ts` — parametry, oba kształty, cap, filtr, 401, strażnik `szerokosc` (15).
- **Nowy:** `test/dostawcy.test.ts` — cztery gałęzie statusu, `liczbaProduktow`, `historia_cen` (11).
- `test/gate/index.ts` — reeksport nowego modułu seedującego.

### Frontend (`rebuild/frontend/`)

- **Nowy:** `src/pages/Katalog.tsx` — widok główny (odtworzenie `AT()`, `frontend-index.js:23191-23830`).
- **Nowe:** `src/pages/katalog/` — `kolumny.ts` (59 definicji + 15 domyślnych, wygenerowane
  z bundla), `filtrowanie.ts` (czyste funkcje), `formatowanie.tsx` (`Wfmt` + `DT`),
  `wirtualizacja.ts`, `TabelaProduktow.tsx`, `KonfiguratorKolumn.tsx`, `WyborWielokrotny.tsx`,
  `PodgladProduktu.tsx`.
- **Nowy:** `src/lib/magazynKV.ts` — IndexedDB `bridge-store-v2` (`frontend-index.js:9161-9192`).
- **Nowe:** `src/components/ui/` — `badge.tsx`, `tabs.tsx`, `dropdown-menu.tsx`, `dialog.tsx`,
  `select.tsx`; klasy przepisane z produkcyjnego bundla.
- `src/App.tsx` + `src/pages/placeholdery.ts` — `/katalog` zdjęty z placeholderów, wpięty jako
  realna trasa. **Liczba tras routera bez zmian: 12.**
- `package.json` — `@radix-ui/react-{tabs,dropdown-menu,dialog,select}`.

### Testy frontendu

- **Nowe:** `test/katalog.filtrowanie.test.ts` (21), `test/katalog.formatowanie.test.tsx` (21),
  `test/katalog.test.tsx` (16).
- `test/msw/kontrakt.ts` — `produktyZFixtura()` i `dostawcyZFixtura()` (dane do mocków prosto
  z nagranych fixtures, nie z wyobrażenia o kształcie).
- `test/setup.ts` — polyfille jsdom dla Radiksa + **czyszczenie cache TanStack Query po każdym
  teście** (patrz „Odstępstwa", pkt 3).

## Odstępstwa od planu

1. **Test-strażnik `szerokosc` wymagał prawdziwej migracji kolumny, nie `UPDATE`.** Plan zakładał
   wpisanie `'10.00'` do kolumny REAL. Okazało się, że SQLite stosuje **type affinity** i sam
   konwertuje ten napis na liczbę `10.0` — kanoniczny schemat FIZYCZNIE nie potrafi przechować
   tego, co trzyma staging. Dołożyłem `przelaczSzerokoscNaText()`, która odtwarza na bazie
   testowej dokładnie tę samą operację co migracja produkcji (nowa tabela → przepisanie danych →
   podmiana nazwy → odtworzenie indeksów, DDL brany z `sqlite_master`). Dopiero na takiej bazie
   test dowodzi pass-through. Ustalenie samo w sobie jest wartościowe — patrz „Rozjazd `szerokosc`".
2. **Ostatnia kolumna tabeli to przycisk podglądu, nie menu „Akcje".** Wynika wprost z D4
   (mutacje poza zakresem), ale plan tego nie dopowiadał.
3. **Trzeba było wyczyścić cache TanStack Query między testami.** `queryClient` jest singletonem
   modułowym ze `staleTime: Infinity` (wiernie oryginałowi) — bez `queryClient.clear()`
   w `afterEach` kolejny test dostawał dane poprzedniego bez żadnego żądania, więc mock ustawiony
   przez `server.use` nigdy nie dochodził do głosu. To poprawka izolacji testów, nie zmiana
   zachowania aplikacji.
4. **`GET /api/dostawcy` doszedł „gratis" do `GET /api/suppliers`.** W oryginale to jeden handler
   pod dwiema ścieżkami, obie mają fixtures — rejestracja obu kosztowała dwie linijki i dała
   dodatkowy plik do GATE.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Sprawdzone ścieżki i pliki:
  | Ścieżka | Fixture | Wynik |
  |---|---|---|
  | `GET /api/products` (`openapi.yaml:802`) | `GET_products.json` | ✓ kształt 1:1 (72 klucze), kontrakt OK |
  | `GET /api/suppliers` (`openapi.yaml:1137`) | `GET_suppliers.json` | ✓ kształt 1:1 (17 pól), kontrakt OK |
  | `GET /api/dostawcy` (`openapi.yaml:560`) | `GET_dostawcy.json` | ✓ kształt 1:1, kontrakt OK |

  Jedyne świadome odstępstwo to **wartości** `szerokosc` na stagingu (backlog #3) — opisane niżej.
  Rozjazdu **typu** w GATE nie ma, bo baza testowa powstaje z kanonu.
- **Unit + integracyjne backendu:** ✓ 103 testy (12 plików), w tym 34 nowe.
- **Unit + integracyjne frontendu:** ✓ 110 testów (9 plików), w tym 62 nowe (po poprawkach z review).
- **Lint, typecheck, build:** ✓ czyste po obu stronach.
- **E2E:** pominięte — brak harnessu E2E w projekcie; rolę weryfikacji end-to-end pełni
  próbka na realnym snapshocie (niżej) plus przeklikanie przez Anię po deployu.

### Weryfikacja na realnych danych (`db/snapshot.db`, 7 405 produktów)

| Sprawdzenie | Wynik |
|---|---|
| `GET /api/products?limit=5` | `200`, `total: 7405` — **zgadza się co do jednego z fixturem** |
| liczba kluczy w pozycji | 72 |
| `szerokosc` | `620` (number) — jak w fixturze |
| `eanIsValid` | `1` (number, nie boolean) ✓ |
| `nro` / `cfo` / `stubbleResistant` | `false` (boolean, nie `0`) ✓ |
| `reinforced` (NULL w bazie) | `null`, nie `false` ✓ |
| `GET /api/products` bez parametrów | tablica 7 405 pozycji, 10,0 MB JSON |
| `GET /api/products?dostawca=MO9` | `total: 861`, `items: 200` (domyślny limit) ✓ |
| `GET /api/suppliers` | 10 dostawców, przeliczone statusy (`MO10:GRI:wstrzymany` — plik z 21.07 starszy niż 30 dni) i `liczbaProduktow` |
| `ostatniaAktualizacjaCeny` (MO1) | `2026-08-12T09:47:18.792Z` — okno po `historia_cen` działa na realnych danych |

**Zysk z kompresji (D2) na tym samym ładunku:** 10,0 MB → **0,84 MB**, współczynnik **12×**.

## Rozjazd `szerokosc` — ustalenia i propozycja domknięcia backlogu #3

To było główne pytanie otwarte tego ticketa. Trzy rzeczy ustalone w trakcie implementacji:

**1. Jak backend czyta `szerokosc` — pass-through, typ zależy od bazy.**
Drizzle `real()` nie ma mapowania z drivera, a SQLite jest dynamicznie typowany, więc ta sama
linia kodu oddaje:
- **liczbę** na kanonie i na `db/snapshot.db` (kolumna REAL) — potwierdzone: `620`, `typeof number`;
- **string** na stagingu po migracji `szertxt` (kolumna TEXT) — potwierdzone testem
  `produkty.test.ts` po przebudowie kolumny: `"10.00"`, `typeof string`.

**2. Kanon nie potrafi odtworzyć stanu stagingu bez migracji.** SQLite type affinity zamienia
`'10.00'` zapisane do kolumny REAL na liczbę `10.0`. To dlatego GATE nie łapie tego rozjazdu
i **nie może go złapać** — nie jest to luka w harnessie, tylko właściwość schematu.

**3. ⚠ Najważniejsze: w UI ten rozjazd jest w dużej mierze NIEWIDOCZNY — oryginał już go rozwiązał.**
Funkcja `Wfmt` (`frontend-index.js:23098-23119`, odtworzona jako `formatujSzerokosc`) nie ufa
wartości z bazy, tylko odzyskuje zapis z pola `rozmiar`: szuka w nim tokenu liczbowego równego
szerokości i zwraca go **w oryginalnym brzmieniu**. Skutek — dopóki `rozmiar` zawiera pasujący
token, `10` (REAL) i `"10.00"` (TEXT) renderują się **identycznie**. Utrwalone testem
„liczba i jej tekstowy odpowiednik dają TEN SAM wynik".

**Gdzie różnica JEST widoczna:** sortowanie po kolumnie „Szerokość opony" — liczby sortują się
numerycznie, stringi leksykalnie (`"100"` przed `"9"`). To zachowanie oryginału, nie nasza decyzja.

**Propozycja domknięcia #3 (do decyzji w tickecie importu/schematu, NIE tutaj):**
przyjąć stan `szertxt` w całości — `rebuild/schema/001_schema.sql:44` REAL → TEXT, Drizzle
`real()` → `text()`, i **przenagrać `GET_products.json`** (to jedyny fixture z tym polem, więc
koszt jest jednorazowy i mały). Argumenty: pole jest z natury prezentacyjne (ma zachować
„10.00"), a liczby do obliczeń i tak żyją osobno (`widthCm` w parserze). Warto przy tej okazji
rozstrzygnąć, czy sortowanie po szerokości ma zostać leksykalne — po przejściu na TEXT stanie
się jedynym wariantem, więc dziś-niewidoczna różnica stanie się trwała.

## Poprawki po review

Review: **0 BLOCKER · 3 SHOULD-FIX · 2 NICE-TO-HAVE** (`review.md`). Każdą uwagę zweryfikowałem
w oryginale, zanim ją naniosłem — wszystkie okazały się trafne i wszystkie zostały naprawione.

1. **`TabelaProduktow.tsx` — nagłówki tabeli rozjeżdżały się z oryginałem.** To był realny rozjazd
   wierności, i to z mojej winy: dodałem wskaźnik kierunku sortowania (`↑`/`↓`/`↕`), którego
   oryginał NIE MA — rysuje w każdym nagłówku tę samą, przygaszoną ikonę `ArrowUpDown`
   (`frontend-index.js:23650`, `:23689`), bez informacji, po czym lista jest posortowana. Etykiety
   też były nie te: „Nazwa-produktu" zamiast „Nazwa" i „Dost" zamiast „Dost.". Naprawione: wspólny
   komponent `NaglowekKolumny` odtwarza układ `inline-flex` z ikoną 1:1, dołożone brakujące
   `maxWidth` i `minWidth: 60` na kolumnie dostawcy. Propsy `sortKolumna`/`sortKierunek` stały się
   przez to zbędne i zostały usunięte. Nagłówek ostatniej kolumny (w oryginale „Akcje") dostał
   etykietę **„Podgląd"** — spójnie z D4, bo mieści wyłącznie podgląd read-only.
2. **`wirtualizacja.ts` — brakowało `ResizeObserver`.** Oryginał obserwuje kontener tabeli
   (`frontend-index.js:23246-23248`), bo sam `resize` okna nie łapie zmian layoutu, przy których
   tabela przesuwa się w pionie (np. zawinięcie paska zakładek dostawców) — bez tego offset
   wirtualizacji robił się nieaktualny. Dołożony wraz ze sprzątaniem w `cleanup`.
3. **`kolumny.ts` — dołożony retrofit `uzupelnijKodImportu`** (`MT()`, `frontend-index.js:23032-23035`).
   Review uznało to za nieistotne, bo IndexedDB jest per-origin, a nowy front stoi na innej domenie.
   Uznałem inaczej: **po cutoverze nowy panel stanie pod tą samą domeną co stary**
   (`rebuild-roadmap.md` §1a), więc zastane zapisy realnie tam będą i kolumna `kodImportu`
   znikałaby użytkownikom bez powodu. Doszły 4 testy jednostkowe.

**Świadomie NIE naprawione (1 NICE-TO-HAVE):** `colSpan` wierszy stanu i spacerów wirtualizacji
liczymy jako `kolumnyZmienne.length + 3 + 1`, podczas gdy oryginał liczy `_.length + 3` i nie
uwzględnia kolumny akcji. Nasza liczba jest po prostu poprawna — wiersz „Wczytuję katalog…"
rozciąga się na pełną szerokość tabeli, a w oryginale o jedną komórkę za mało. Odejście od
dosłowności bez wpływu na zachowanie, świadome.

Po poprawkach: **110 testów frontendu** (wcześniej 106) i 103 backendu — wszystkie zielone,
lint/typecheck/build czyste.

## Breaking changes

Brak. Zmiany w `src/db/schema.ts` (D5) dotykają tabeli `products`, której przed tym ticketem
nie czytał żaden endpoint — nic istniejącego się na nich nie opierało. Schemat bazy
(`001_schema.sql`) jest nietknięty, więc migracje i staging nie wymagają żadnej akcji.

## Follow-up

Rzeczy świadomie odłożone (żadna nie blokuje DoD tej iteracji):

1. **Eksport CSV do Shopera** — przycisk „Pobierz CSV" z oryginału wymaga `GET /api/config`
   (`shoper.separator`, `shoper.kolumny`). → I8 albo I11.
2. **Słowniki marek/kategorii z `GET /api/atrybuty`** — dziś listy filtrów powstają wyłącznie
   z danych, więc nie pokażą wartości słownikowej bez ani jednego produktu. → I7.
3. **Akcje wierszowe** (Edytuj, Wstrzymaj/Aktywuj, Usuń) i „Historia" — mutacje produktów. → I12
   („Historia" jest `disabled` także w oryginale, więc odtworzenie samego przycisku nic nie daje).
4. **Kolumna „Promocja"** jest w domyślnym zestawie i renderuje „—", bo dane liczy warstwa
   cenowa. → I4.
5. **Backlog #3 (`szerokosc`)** — propozycja domknięcia wyżej. → ticket importu/schematu.
6. **`openapi.yaml` nie deklaruje `GET /api/products/{id}`** i produkcja go nie ma. Utrwalone
   testem, który zaświeci, gdyby ktoś dołożył tę operację do kontraktu. → I12 (odświeżenie kontraktu).
7. **Nagranie fixtures dla wariantu „goła tablica"** (`GET /api/products` bez parametrów) —
   główna ścieżka używana przez katalog nie ma dziś siatki fixtures, tylko własne testy.
   Warto dograć przy najbliższym odświeżaniu `contract/fixtures/`.

## Aktualizacja dokumentacji

Cztery doc-checkery przejrzały równolegle dokumentację, którą ten ticket mógł zdezaktualizować.
Poza dopisaniem nowego stanu **naprawiły cztery zastane nieprawdy** (opisane niżej).

### `docs/rebuild-roadmap.md`
- §4 Tablica postępu: Iteracja 2 → ✅, `PR #4 · 2026-08-25`.
- §5 blok Iteracji 2 rozbudowany do formy zamkniętych iteracji (zakres BE i FE, ścieżki i fixtures
  GATE, decyzje D2/D3/D5/D6 z ostrzeżeniem operacyjnym, ustalenie o `szerokosc`, odhaczone DoD
  z jednym otwartym punktem — weryfikacja Ani po deployu).
- §2 Źródła prawdy: wiersz o harnessie GATE uzupełniony o moduł seedujący `test/gate/dane.ts`.
- **Naprawiona nieprawda:** Iteracja 11 miała w zakresie `GET /api/dostawcy` i `GET /api/suppliers`
  (listy) — I2 już je dostarczyła. Zakres I11 zawężony do detalu i mutacji, fixtures
  `GET_dostawcy.json`/`GET_suppliers.json` usunięte z jej GATE-a.
- Dopiski w blokach I3 (gotowa propozycja domknięcia backlogu #3), I4 (kolumna „Promocja" już
  jest w katalogu, czeka na dane) i I7 (domknie degradację list marek/kategorii z D3).

### `docs/rebuild-backlog.md`
- Wpis **#3** — nowa podsekcja „Ustalenia z Iteracji 2" z pięcioma zweryfikowanymi empirycznie
  faktami (pass-through, type affinity, maskowanie rozjazdu przez `Wfmt`, widoczność w sortowaniu,
  propozycja domknięcia). **Status decyzji świadomie NIE zmieniony — zostaje 🕒 PÓŹNIEJ**, bo to nie
  decyzja I2. Zweryfikowano też, że `rebuild/schema/001_schema.sql:44` nadal ma `szerokosc REAL`,
  i doprecyzowano zakres przenagrania fixtures: `GET_products.json` jest **jedynym** plikiem,
  w którym `szerokosc` jest typowanym kluczem odpowiedzi (w `GET_staging.json` siedzi wyłącznie
  wewnątrz zserializowanego `snapshotJson`, poza zasięgiem porównania kształtu).
- Wpis **#2** (`kategoriafix`) — jedno zdanie: od I2 katalog wyświetla i filtruje po `kategoria`,
  więc ta decyzja dotyczy teraz również tego, co Ania realnie widzi w panelu.

### `docs/spec-backend.md`
- Sekcja o auth: potwierdzenie, że trzy nowe trasy wjechały pod `requireAuth` zgodnie z zasadą §3
  **i zgodnie z kontraktem** (`security: [bearerAuth, cookieAuth]`), więc nie jest to odstępstwo;
  odnotowany brak `GET /api/products/{id}` w produkcji i w kontrakcie.
- Reszta pliku świadomie nietknięta — to audyt bezpieczeństwa, nie spec zachowania endpointów.

### `docs/spec-frontend.md` i `docs/plan.md`
- `spec-frontend.md`: akapit o zamkniętej Iteracji 2 (client-side'owa natura widoku, 59/15 kolumn
  w IndexedDB, trzy kolumny zawsze przyklejone, statyczna ikona sortowania, brak szczegółu
  w oryginale vs nasz podgląd read-only). **§7 sprawdzone i celowo nietknięte** — porównanie
  `02_WIDOKI.md` z ustaleniami ticketa nie ujawniło nowych rozjazdów.
- `plan.md`: **naprawione martwe linki** — `README.md`, `audyt-vps.sh` i oba `PROMPT-*.md`
  nie istnieją. Nagłówek zastąpiony notką kierującą do `rebuild-roadmap.md` jako aktualnego źródła
  prawdy; dokument zostaje jako zapis historyczny.

### README-y w `rebuild/`
- `rebuild/backend/README.md`: stan → Iteracja 2, nowe endpointy z pułapką dwóch kształtów
  odpowiedzi, `compression` w stosie, rozszerzona lista fixtures GATE, zaktualizowana struktura
  katalogów. **Najważniejsze:** sekcja „Schemat Drizzle" dostała ostrzeżenie o trzech dopieszczeniach
  do naniesienia po KAŻDEJ regeneracji `drizzle-kit pull` — bez niego następna regeneracja po cichu
  zepsułaby kontrakt `GET /api/products`. **Naprawiona nieprawda:** usunięta uwaga z I1a, że backend
  „jeszcze się nie zdeployuje" (oba `package.json` istnieją od I1b).
- `rebuild/frontend/README.md`: `/katalog` zrobiony, 11→10 placeholderów, 44→110 testów, nowa
  struktura, odstępstwo O8 (podgląd read-only) oraz udokumentowana pułapka `queryClient.clear()`
  w testach.
- `rebuild/schema/README.md`: **naprawiona nieprawda** — zdanie o „jednym ręcznym dopieszczeniu
  (`.unique()` na `users.email`)" przestało być prawdziwe; dopisane dwa z I2 i doprecyzowane,
  że `001_schema.sql` zostaje nietknięty, bo zmienia się mapowanie w Drizzle, a nie typy w bazie.

### Zastane problemy zgłoszone przez doc-checkery
- Szczegółowy opis endpointów produktów i dostawców (kształty odpowiedzi, limity, pola liczone
  w locie) **nie istnieje w żadnym pliku kanonicznym** poza artefaktami ticketa i kodem. Jeśli ma
  powstać zbiorczy spec backendu odbudowy, to osobne zadanie — poza zakresem tej sesji.
- Poza tym nie zgłoszono nic, czego ten ticket nie naprawił.
