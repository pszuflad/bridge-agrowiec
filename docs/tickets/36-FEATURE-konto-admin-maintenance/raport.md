# 36-FEATURE-konto-admin-maintenance — raport z implementacji

## Podsumowanie

Iteracja 12, sesja 12b dowieziona w całości: osiem operacji backendu (konto, admin, utrzymanie,
surowy audyt) za `requireAuth`, pełny widok `/moje-konto`, przycisk „Usuń wszystko z katalogu"
w zakładce „Katalog" oraz dwie nowe zakładki `/konfiguracja` — „Admin" i „Dziennik".
GATE przeszedł na czterech fixtures; siatka bezpieczeństwa została **zweryfikowana odwrotnie**
(celowe sparsowanie `szczegolyJson` zapaliło STOP, po czym zmianę wycofano). Backend:
1086 testów / 70 plików. Frontend: 688 testów / 46 plików. Bramki czyste po obu stronach.

## Zmiany

### Backend

- **Nowy:** `src/routes/konto.ts` — `POST /api/password/change` + `GET /api/users`
  (port `:48195-48223`), mapowanie kodu błędu na status (401 tylko dla `WRONG_OLD_PASSWORD`).
- **Nowy:** `src/auth/zmiana-hasla.ts` — port `P4()` (`:47905-47931`) z zachowaną kolejnością
  czterech sprawdzeń; reużywa `porownajHaslo`/`zahashujHaslo`.
- **Nowy:** `src/routes/admin.ts` — `GET /api/admin/supplier-config`,
  `PATCH /api/admin/supplier-config/{kod}`, `GET /api/admin/suppliers-list` (port
  `extensions.cjs:296-405`) oraz `GET /api/audit-log` (port `:48735`).
- **Nowy:** `src/routes/maintenance.ts` — `POST /api/maintenance/usun-nieopony` (port
  `:48392-48405`, reużywa `czyOpona()` z silnika importu) i `POST /api/products/clear`
  (port `:48315-48334` wraz z kopią pliku bazy).
- `src/repos/users.ts` — `listaUzytkownikow` (projekcja jawna trzech pól) i `zapiszHasloUzytkownika`.
- `src/repos/products.ts` — `wyczyscProdukty` (port `U.clearProducts`).
- `src/app.ts` — rejestracja trzech routerów; `ZaleznosciApp` przyjmuje opcjonalny `sqlite`
  (potrzebny wyłącznie do checkpointu WAL przed kopią bazy).
- `src/server.ts`, `test/gate/aplikacja.ts` — przekazanie uchwytu `sqlite`.
- **Nowe testy:** `test/konto.haslo.test.ts` (11), `test/admin.supplier-config.test.ts` (20),
  `test/audit-log.test.ts` (9), `test/maintenance.test.ts` (12), `test/admin.gate.test.ts` (10).
- `test/gate/dane.ts` — `DOSTAWCY_ADMINA` (10 kodów dispatchera), `zasiejDostawcowAdmina`,
  `zasiejAudytSurowy`.

### Frontend

- **Nowy:** `src/pages/MojeKonto.tsx` + `src/pages/moje-konto/api.ts` — port `lM()`
  (`frontend-index.js:27624-27780`), teksty i `data-testid` 1:1.
- **Nowy:** `src/pages/konfiguracja/Admin.tsx`, `DialogKonfiguracjiDostawcy.tsx`, `admin.ts`
  — zakładka „Admin" (dostawcy + użytkownicy + utrzymanie).
- **Nowy:** `src/pages/konfiguracja/Dziennik.tsx`, `dziennik.ts` — zakładka „Dziennik"
  (surowy audyt, filtry, `parsujSzczegoly` z kotwicą do backendu).
- **Nowy:** `src/pages/konfiguracja/katalog.ts` — klient `POST /api/products/clear`.
- `src/pages/konfiguracja/Katalog.tsx` — przycisk „Usuń wszystko z katalogu"
  (`window.confirm` + trzy `invalidateQueries`); nagłówek pliku zaktualizowany.
- `src/pages/konfiguracja/zakladki.ts` — dwie nowe pozycje + nota, że lista NIE jest już
  lustrem oryginału.
- `src/pages/Konfiguracja.tsx`, `src/App.tsx` — wpięcie zakładek i trasy `/moje-konto`.
- **Usunięte:** `src/pages/placeholdery.ts`, `src/pages/WidokWPrzygotowaniu.tsx` — ostatni
  placeholder zniknął, oba pliki stały się martwe. Nota o 13 trasach przeniesiona do nagłówka
  `App.tsx`; odsyłacz w `test/shell.test.tsx` poprawiony.
- **Nowe testy:** `test/moje-konto.test.tsx` (10), `test/konfiguracja.admin.test.tsx` (17),
  `test/konfiguracja.dziennik.parser.test.ts` (18); `test/konfiguracja.test.tsx` rozbity na
  asercję sześciu zakładek oryginału i osobną dla dwóch dołożonych.
- `test/msw/kontrakt.ts` — cztery loadery fixtures (`konfiguracjaDostawcowZFixtura`,
  `listaDostawcowZFixtura`, `uzytkownicyZFixtura`, `audytZFixtura`).

## Odstępstwa od planu

**Jedno, na plus wobec planu.** Plan zakładał, że `delete lastRunPerSupplier[kod]`
(`extensions.cjs:387-389`) zostanie pominięte, bo scheduler odbudowy trzyma stan inaczej.
Przy implementacji okazało się, że odpowiednik JEST gotowy: `przeplanujScheduler` (3f-3),
podawany już do `trasyDostawcow`. Podpięty do `PATCH` przy zmianie częstotliwości — port
wierniejszy niż planowany.

Reszta bez odstępstw. Decyzje D1–D8 z planu zrealizowane w całości.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Sprawdzone ścieżki i pliki:
  - `GET /api/users` ↔ `GET_users.json` — kształt 1:1 + komplet kluczy;
  - `GET /api/admin/supplier-config` ↔ `GET_admin_supplier-config.json` — 1:1, lista 10 pozycji;
  - `GET /api/admin/suppliers-list` ↔ `GET_admin_suppliers-list.json` — 1:1, lista 10 pozycji;
  - `GET /api/audit-log` ↔ `GET_audit-log.json` — 1:1, `szczegolyJson` pozostaje **stringiem**.
  - Mutacje (`PATCH supplier-config/{kod}`, `POST password/change`, `POST usun-nieopony`,
    `POST products/clear`) — walidacja wyłącznie względem `openapi.yaml` (ścieżka, metoda,
    kod odpowiedzi); fixtures zapisujących nie ma, dojdą w 12d.
  - **Kontrola siatki:** celowe sparsowanie `szczegolyJson` w handlerze zapaliło GATE
    („typ object, oczekiwano string" ×4, STOP) — zmianę wycofano. Gate realnie broni kontraktu,
    nie przechodzi „z rozpędu".
- Backend: ✓ **1086 testów / 70 plików**; `lint`, `typecheck`, `build` czyste.
- Frontend: ✓ **688 testów / 46 plików**; `lint`, `typecheck`, `build` czyste.
- E2E: pominięte — projekt nie ma harnessu E2E, ścieżki pokryte integracyjnie
  (realny SQLite w katalogu tymczasowym po stronie BE, MSW po stronie FE).

Dwa testy wykryły błędy **w samych testach**, nie w kodzie, i oba zostały opisane w komentarzu,
bo łatwo je powtórzyć:
- `Number.NaN` w ciele żądania nie dociera jako `NaN` — `JSON.stringify` zamienia go na `null`,
  czyli na legalne polecenie wyczyszczenia pola (żądanie kończy się 200, nie 400);
- domyślna kategoria `"opony"` w danych testowych uznawała za oponę KAŻDĄ pozycję, bo
  `czyOpona()` skleja nazwę z kategorią — test straciłby przedmiot.

## Breaking changes

Brak w API. Dwie zmiany wewnętrzne warte odnotowania:

1. `ZaleznosciApp` przyjmuje nowe, **opcjonalne** pole `sqlite`. Pominięcie = kopia bazy przed
   czyszczeniem katalogu powstaje bez checkpointu WAL (czyli dokładnie jak w oryginale).
2. `src/pages/placeholdery.ts` i `src/pages/WidokWPrzygotowaniu.tsx` **usunięte**. Nic ich już
   nie importuje; liczba tras routera bez zmian (13).

## Follow-up

- **Tabela `users` nie ma kolumny roli.** „Admin" nie jest technicznie odróżnialny od zwykłego
  użytkownika — zakładki „Admin" i „Dziennik" widzi każdy zalogowany, tak samo jak w produkcji
  (gdzie strony `/admin/*` chroni sam `requireAuth`). Wprowadzenie ról to zmiana schematu
  i decyzja Ani, nie tej sesji. Kandydat do rozstrzygnięcia w 12e (finalny przegląd
  bezpieczeństwa).
- **`parsujSzczegoly` istnieje w repo w dwóch miejscach** (backend `historia/mapowanie.ts:87`,
  frontend `konfiguracja/dziennik.ts`) — świadomie, decyzją użytkownika (D4), wzorem
  `waga-gabarytowa/obliczenia.ts` vs `formula.ts`. Gdyby `rebuild/` kiedyś dostało wspólny
  pakiet, to jeden z pierwszych kandydatów do przeniesienia.
- **Fixtures dla mutacji nie istnieją** (`POST password/change`, `PATCH supplier-config/{kod}`,
  `POST usun-nieopony`, `POST products/clear`) — GATE sprawdza dla nich wyłącznie kontrakt.
  Przenagranie należy do 12d.
- **`openapi.yaml` nie deklaruje `401` dla `GET /api/audit-log`** (trasa jest tam publiczna),
  więc test 401 dla tej jednej ścieżki nie może przejść przez `sprawdzZgodnoscZKontraktem`.
  Do uporządkowania przy odświeżaniu kontraktu w 12d — razem z resztą realnych kodów błędów.
- **Kopia bazy przy `products/clear` nie jest sprzątana.** Każde czyszczenie katalogu zostawia
  plik `<baza>.bak_before_clear_<ts>` i nikt ich nie usuwa — tak samo jak w produkcji. Przy
  częstym używaniu przycisku katalog danych będzie rósł. Zastane, nie naprawiane w tej sesji.

## Review fixes applied

Review: 1 BLOCKER / 3 SHOULD-FIX / 3 NICE-TO-HAVE.

**BLOCKER (roadmapa nietknięta) — nie było pominięciem, tylko kolejnością.** Aktualizacja
`docs/rebuild-roadmap.md` i `docs/rebuild-backlog.md` należy do Fazy 5 procesu (doc-checkery),
która w chwili review jeszcze nie nastąpiła. Wykonana zaraz po review — patrz „Docs updates".

**SHOULD-FIX 1 — mylący komentarz w `historia/mapowanie.ts` (naprawione).** Zdanie „Ten sam
parser obsłuży `/api/audit-log` w I12" zastąpione notą, która mówi wprost: ta trasa NIE używa
tej funkcji i nie ma używać (fixture zamraża string, sparsowanie łamie GATE), a parsowanie
robi front, który ma własną kopię — z odsyłaczem w obie strony.

**SHOULD-FIX 2 — dwa toasty w `/moje-konto` (naprawione).** Oryginał rozróżnia odpowiedź
błędu („Nie udało się zmienić hasła" + `error` z ciała, `:27684`) od awarii `fetch`
(„Błąd" + `e.message`, `:27694`); port zlewał oba w jeden. Dołożona klasa
`BladOdpowiedziSerwera` w `moje-konto/api.ts` rozdziela przypadki, komponent ma dwie gałęzie.
Nowy test: awaria sieci daje „Błąd", a NIE „Nie udało się zmienić hasła".

**SHOULD-FIX 3 — brak `try/catch` w trasach admina: rozstrzygnięte inaczej, jako świadome
pominięcie.** Oryginał oddaje klientowi `e.message` (`extensions.cjs:313-315,334-336,394-396`),
ale odbudowa ma w tej sprawie własną, wcześniejszą decyzję: `middleware/errors.ts` zwraca
`{error: "Błąd serwera"}` i loguje szczegóły serwerowo, „nie wypuszczamy stack trace'ów ani
treści błędu do klienta". Komunikat SQLite potrafi nieść nazwy kolumn i fragmenty danych, więc
port 1:1 byłby tu wyciekiem informacji, nie wiernością. Status odpowiedzi jest ten sam (500),
różni się tylko treść `error`; gałęzie 400/404 obsługujemy wprost. Pominięcie opisane
w nagłówku `routes/admin.ts`. (Uwaga na marginesie: review sugerowało wzorowanie się na
`GET /api/admin/suppliers-list`, „które go ma" — ta trasa również go nie ma; wzorzec jest
w całej odbudowie spójny.)

**NICE-TO-HAVE 1 — test trzech `invalidateQueries` (dołożony).** Sprawdza komplet i kolejność
kluczy `["/api/products"]`, `["/api/alerts"]`, `["/api/analytics"]` po udanym czyszczeniu.
Pozostałe dwa (pamięciożerność `listaProduktow` w `usun-nieopony`, brak timeoutu w `fetch`)
zostają jako follow-up: pierwsze to port 1:1 zachowania oryginału, drugie to wzorzec całego
frontu i temat na 12e.

Po poprawkach: backend **1086 testów / 70 plików**, frontend **688 testów / 46 plików**,
`lint`/`typecheck`/`build` czyste po obu stronach.

## Docs updates

Cztery pliki `docs/` zaktualizowane równolegle przez doc-checkery, po review.

### `docs/rebuild-roadmap.md`
- **Sprostowane fakty:** `GET/PUT /api/admin/supplier-config(+{kod})` → `PATCH
  /api/admin/supplier-config/{kod}` z dowodem z dwóch źródeł (`contract/openapi.yaml:28-41`,
  `mirror/backend/extensions.cjs:344`). Usunięta myląca nota, jakoby `GET /api/audit-log` miał
  reużyć `parsujSzczegoly` z I5 — zastąpiona faktem: trasa oddaje surowy `listAudit()` bez
  mapowania (`:48735`), parser żyje we froncie (D4), a parsowanie w backendzie łamie fixture.
- **Iteracja 12 rozbita na jawne podsesje 12a–12e** (wzorem 3a–3f); §4 (tabela postępu),
  §6 i nagłówek §4 zaktualizowane. Blok 12b odhaczony (2026-09-05, ID ticketa) z faktycznym
  zakresem, odstępstwami D1/D2/D3/D5 i notą o `przeplanujScheduler`.
- **Ustalenia rozdzielone do WŁAŚCIWYCH bloków** (nie do zamkniętego 12b): 12a — nie mylić
  `wyczyscProdukty` (bulk, z 12b) z `usunProdukt(id)`; 12c — `/moje-konto` gotowe, więc
  `/katalog` zostaje ostatnim widokiem z odstępstwem D4 z I2; 12d — brak nagrań czterech
  mutacji + brak `401` dla `GET /api/audit-log` w `openapi.yaml`; 12e — brak kolumny roli
  w `users` i niesprzątane kopie `.bak_before_clear_*`.
- Nota w bloku I11 o przycisku „Usuń wszystko z katalogu" („poza zakresem do Iteracji 12")
  poprawiona na „dowieziony w 12b".

### `docs/rebuild-backlog.md`
- **Nowe wpisy:** **#48** brak kolumny roli w `users` (⬜ do decyzji, stan zastany zgodny
  z produkcją, nie regresja); **#49** niesprzątane kopie bazy po `products/clear` (⬜);
  **#50** dwie kopie `parsujSzczegoly` — wpis dotyczy pytania „czy `rebuild/` ma dostać
  wspólny pakiet", samą duplikację oznaczono jako świadomą i zrobioną.
- **#36 (AppShell)** sprostowany: `WidokWPrzygotowaniu.tsx` usunięty, `MojeKonto.tsx` dopisany
  do listy widoków renderujących sidebar; licznik poprawiony.
- Wpisów o `PUT` dla supplier-config ani o parsowaniu `audit-log` w backlogu nie było
  (sprawdzone grepem) — nie było czego prostować.

### `docs/spec-backend.md`
- Dopisany akapit „Potwierdzone w 12b" z ośmioma operacjami: kolejność kodów błędu `P4()`,
  projekcja jawna w `GET /api/users`, pętla po dispatcherze (nie po `suppliers`) w obu listach
  admina, metoda `PATCH`, surowy `audit-log` ze `szczegolyJson` jako stringiem, kopia bazy
  z checkpointem WAL.

### `docs/spec-frontend.md`
- Usunięte nieprawdziwe już zdania: „pozostał 1 placeholder (`/moje-konto`)" oraz „przycisk
  zostaje poza zakresem do Iteracji 12 (D3)".
- Dopisany blok „Odbudowa (12b)": `/moje-konto` (dwa różne toasty błędu), zerowanie
  placeholderów, dwie nowe zakładki jako odstępstwo D1, przycisk czyszczenia katalogu
  i `window.confirm` jako świadomy wyjątek od reguły Radix z 7b.

### Pre-existing issues (NIE naprawiane — poza zakresem ticketa)
- `docs/rebuild-backlog.md:1841,1846` (#36) — tekst mówi „na ośmiu ekranach", a wypisana lista
  widoków bez `AppShell` ma siedem pozycji. Niejasne, czy to błąd, czy liczono coś dodatkowego.
- `docs/spec-frontend.md:389` (blok 7b) mówi „router ma 12 tras, 1 placeholder", a blok 8b
  (linie 69-83, ta sama data) już mówi o 13 trasach po dodaniu `/selly`. Rozbieżność wymaga
  ustalenia realnej chronologii 7b vs 8b — obie noty mają datę 2026-09-04.

## Scalenie z `develop` (2026-09-05)

`develop` dostał w międzyczasie trzy tickety — **33** (instrukcja testów I8), **34** (blokada
środowiskowa Selly) i **35 = sesja 12a** (mutacje produktów, BE). Cztery konflikty, wszystkie
rozwiązane przez **zachowanie obu stron**; żadna zmiana nie została porzucona.

- **`rebuild/backend/src/repos/products.ts`** — konflikt czysto addytywny: 12b dopisało
  `wyczyscProdukty` (bulk `DELETE FROM products`), 12a — `tylkoKolumnyProduktu`,
  `POLA_EDYTOWALNE_PRODUKTU`, `produktPoId`, `wKontrakcie` i `odsiejPolaEdytowalneProduktu`.
  Obie gałęzie zachowane obok siebie.
- **`docs/spec-backend.md`** — dwie niezależne noty („Potwierdzone w 12a" i „…w 12b"),
  zachowane obie, w kolejności sesji.
- **`docs/rebuild-roadmap.md`** — cztery starcia (wstęp §4, wiersz tabeli, cały blok I12, §6).
  **Za bazę wzięta struktura z `develop`** (nagłówki `#### Sesja 12a…12e` są czytelniejsze niż
  lista punktów, którą wniosła 12b), a w nią wpięty stan faktyczny 12b. Skutki:
  - sekcja „Sesja 12b — ⬜" zastąpiona wersją odhaczoną; **`develop` nadal miał w niej stary błąd
    `GET/PUT /api/admin/supplier-config`** — sprostowany razem z notą, że to trzecia z rzędu
    pomyłka roadmapy w opisie metody endpointu;
  - zachowana nota z 12a, że `GET /api/audit-log` zobaczy też `edycja_produktu`
    i `usuniecie_produktu` (z niespójnym `encjaId`: `kod` vs `id` jako tekst);
  - wejścia 12b dołożone do bloków **12d** (brak nagrań czterech mutacji, brak `401` dla
    `audit-log` w kontrakcie) i **12e** (brak kolumny roli, niesprzątane kopie bazy);
  - GATE i DoD Iteracji 12 odhaczone dla obu zamkniętych sesji.
- **`docs/rebuild-backlog.md`** — ⚠ **kolizja numerów**: ticket 34 zajął na `develop` wpisy
  **#46** i **#47**, a doc-checker 12b nadał te same numery swoim trzem wpisom. Nasze
  przenumerowane na **#48** (brak kolumny roli), **#49** (niesprzątane kopie bazy) i **#50**
  (dwie kopie `parsujSzczegoly`); odsyłacze w roadmapie i w tym raporcie poprawione.
  Numeracja sprawdzona — brak duplikatów.

**Bramki po scaleniu:** backend **1184 testy / 75 plików**, frontend **694 testy / 46 plików**,
`lint`/`typecheck`/`build` czyste po obu stronach. Przyrost wobec stanu sprzed merge'a
(1086/688) pochodzi z testów ticketu 35 i 34.
