# 39-CHORE-audyt-bezpieczenstwa-domkniecie — Iteracja 12e: finalny audyt bezpieczeństwa + rozliczenie + domknięcie

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `chore/39-audyt-bezpieczenstwa-domkniecie`
> Worktree: `.worktrees/39-CHORE-audyt-bezpieczenstwa-domkniecie`

## Opis ticketa

Iteracja 12, sesja **12e** — OSTATNIA sesja całej odbudowy Bridge (12a–12d zamknięte).
Charakter: audyt + weryfikacja + rozstrzygnięcia + domknięcie, **nie nowe funkcje**.

Cel: potwierdzić bezpieczeństwo i parytet całości, rozliczyć backlog, udokumentować plan
cutoveru, przygotować przegląd 12 widoków dla Ani i zamknąć roadmapę.

Zakres wg promptu:
- **A. Audyt bezpieczeństwa** — auth na wszystkich trasach danych; CORS (bezpieczny stan
  domyślny); `JWT_SECRET` bez fallbacku; mass-assignment na KAŻDEJ trasie mutacji.
- **B. Niespójność sidebara** (nota z I8, backlog #36) — zdecydować i ujednolicić.
- **C. Rozliczenie backlogu** — potwierdzić ✅/❌, rozstrzygnąć pozostałe ⬜ (#45, #48, #49, #50,
  a także #51, który roadmapa parkuje wprost na 12e).
- **D. Plan cutoveru** (big-bang) — `docs/cutover.md`, DOKUMENT, nie wykonanie.
- **E. Przegląd 12 widoków** — checklista dla Ani; sam przegląd klika Ania.

Poza zakresem: nowe funkcje; sam cutover/go-live (osobne zdarzenie z Anią).

## Kontekst — wynik audytu (zmierzony, nie założony)

Pomiar wykonany przez researchera na `rebuild/` (nie na roadmapie). **Obszary A/B/C/D audytu
wypadają czysto — nie ma ani jednej otwartej dziury.** Szczegóły:

**Auth (A1).** ~95 operacji w 21 plikach `rebuild/backend/src/routes/*.ts` — **każda trasa
danych ma `requireAuth` bezpośrednio przy rejestracji** (nie przez `router.use`, więc nie da się
tego zgubić przy refaktorze routera). Publiczne są dokładnie trzy: `POST /api/login`
(`auth.ts:31`), `POST /api/logout` (`auth.ts:62` — JWT bezstanowy, czyszczenie cookie nie
wymaga tokenu; zgodne z oryginałem `deminified/backend-index.cjs:48175-48178`),
`GET /api/health` (`app.ts:135` — healthcheck PM2, nie oddaje danych).
Kolejność middleware w `app.ts:84-198`: CORS → `compression` → parsery → `optionalAuth`
(globalny, tylko wypełnia `req.user`, nigdy nie blokuje) → `/api/health` → routery →
`nieZnalezionoHandler` (404 JSON) → `bladHandler`. Nic nie jest montowane przed `optionalAuth`
poza CORS i parserami; `OPTIONS` obsłużone w `cors.ts:28-31`; 404 nie wycieka stack trace'ów.
**Ocena: OK.**

**Auth — luka PROCESU, nie implementacji (A2).** `test/kontrakt.spojnosc.test.ts:143` iteruje po
operacjach z `contract/openapi.yaml`, nie po realnym rejestrze Express. Osiem testów modułowych
(`admin.gate.test.ts:238`, `narzuty.gate.test.ts:149`, `produkty.mutacje.test.ts:78`,
`selly.gate.test.ts:241`, `konfiguracja.test.ts:159` i in.) używa **kuratorowanych list tras**.
Skutek: nowa trasa dodana bez `requireAuth` **i** nieopisana w kontrakcie przeszłaby CI.
Dziś nic takiego nie istnieje — to zabezpieczenie na przyszłość. **Do naprawy (D2a).**

**CORS (B).** `app.ts:116` montuje `corsZAllowlisty` tylko gdy `env.CORS_ORIGINS.length > 0`.
Przy pustym `CORS_ORIGINS` **middleware w ogóle się nie montuje** → brak nagłówków
`Access-Control-Allow-*` → przeglądarka blokuje cross-origin. To jest **stan bezpieczny**, a nie
„CORS de facto otwarty" (obawa z promptu **nie potwierdziła się**). Architektura jest
same-origin: Apache `mod_proxy [P]` proxuje `/api/*` na `127.0.0.1:5001` pod tą samą subdomeną
co statyczny front (`deploy/staging/htaccess:11`, `docs/deploy-setup.md`). W repo **nie ma
nigdzie** `Access-Control-Allow-Origin: *`; `tools/deploy-staging.sh` nie ustawia
`CORS_ORIGINS`, więc na stagingu CORS jest wyłączony — spójnie z same-origin.
Gdy origin JEST na allowliście, `cors.ts:13-35` odsyła **konkretny origin z allowlisty** razem
z `Allow-Credentials: true`, nigdy `*` i nigdy echa dowolnego originu z żądania — to jawnie
udokumentowana naprawa wobec produkcji (komentarz `cors.ts:4-12`: oryginał odbijał DOWOLNY
origin z `credentials:true`, realna dziura). **Ocena: OK, bezpieczniej niż oryginał.**
Wniosek dla promptu: **wymaganie „staging/prod muszą mieć allowlistę" jest nietrafione** —
przy same-origin allowlista jest zbędna, a jej wymuszenie byłoby konfiguracją na wyrost.
Zamiast tego domykamy pomyłkę konfiguracyjną w drugą stronę (D2b).

**JWT (C).** `config/env.ts:36`: `JWT_SECRET: z.string().min(1, …)` — bez `.default()`,
`wczytajEnv` rzuca (`env.ts:125-135`), serwer nie wstaje. Komentarz `env.ts:6-9` cytuje
oryginał: `process.env.JWT_SECRET || "bridge-agrowiec-secret-2026"`
(`deminified/backend-index.cjs:47853`) i odnotowuje naprawę. `grep` po całym `rebuild/`
(bez `node_modules`): jedyne wystąpienia to produkcyjny kod przez `env.JWT_SECRET` oraz
stałe **testowe** (`test/gate/aplikacja.ts:14` — `SEKRET_TESTOWY`), żadna nie sięga ścieżki
produkcyjnej. Pokryte testem `config.env.test.ts:11`. **Ocena: OK, fail-fast bez fallbacku.**
Token: `expiresIn: "30d"` (`auth/jwt.ts:20`, zgodne z oryginałem). `jwt.verify` bez jawnego
`algorithms` — przy sekrecie symetrycznym ryzyko „algorithm confusion" jest zerowe (wymaga
klucza asymetrycznego, którego backend nie ma), ale przypięcie to jedna linia (D2c).

**Mass-assignment (D) — backlog #14 DOMKNIĘTY na wszystkich trasach.** Żadna trasa mutacji nie
robi `Object.keys(req.body)` do `UPDATE` ani spreadu całego ciała do `SET` (potwierdzone
`grep`em). Wykaz:

| Trasa | Handler | Filtr pól | Gdzie |
|---|---|---|---|
| `PATCH /api/dostawcy/:id` | `suppliers.ts:282` | `odsiejPolaEdytowalne` | `repos/suppliers.ts` (`POLA_EDYTOWALNE_DOSTAWCY`, 3f-2) |
| `POST/PATCH /api/markups` | `markups.ts:46,90` | `odsiejPolaNarzutu` | `repos/markups.ts` (4a) |
| `POST/PATCH /api/promotions` | `promotions.ts:39,74` | `odsiejPolaPromocji` | `repos/promotions.ts` (4a) |
| `PUT /api/staging/:id` | `staging-mutacje.ts:266,289` | `POLA_EDYTOWALNE` | `staging-mutacje.ts:35` (port 1:1) |
| `POST /api/spedycja` | `spedycja.ts:43` | `odsiejPolaSpedycji` | `repos/spedycja.ts` (I11) |
| `POST /api/config` | `config.ts:56` | jawne `{klucz, wartosc}` + whitelista kluczy | odstępstwo #30 |
| `PUT/PATCH /api/products/:id` | `products.ts:271-272` | `odsiejPolaEdytowalneProduktu` | `repos/products.ts:199` |
| `POST /api/products` (bulk) | `products.ts:161` | `tylkoKolumnyProduktu` (poziom kolumn) | `repos/products.ts:161`, komentarz 149-159 |
| `PATCH /api/admin/supplier-config/:kod` | `admin.ts:137-193` | pole-po-polu z walidacją | `admin.ts` |
| `POST /api/password/change` | `konto.ts:44` | destrukturyzacja | `konto.ts` |
| `POST /api/maintenance/usun-nieopony`, `POST /api/products/clear` | `maintenance.ts:79,123` | `{potwierdzenie}` | `maintenance.ts` |
| `POST/PUT/DELETE /api/atrybuty/*` | `atrybuty.ts` | destrukturyzacja per handler | `atrybuty.ts` |
| `POST /api/selly/*` (6 tras) | `selly.ts` | pola używane selektywnie | `selly.ts` |

**Zasada stała utrzymana:** `POLA_EDYTOWALNE_PRODUKTU` (`repos/products.ts:184-199`) jawnie
wyklucza 26 kolumn wyliczanych, `uwagaCena`, `id`/`kod`/`dataAktualizacji` i `dostawca`;
`POLA_EDYTOWALNE_DOSTAWCY` nie zawiera `importWylaczony`. Jedyny wyjątek — `POST /api/products`
(bulk import) — filtruje na poziomie **kolumn tabeli**, nie „pól edytowalnych", bo import
z definicji MUSI zapisać kolumny wyliczane; jest to opisane komentarzem i zamierzone.
**Ocena: OK, brak znalezisk.**

**Sidebar (B ticketa, backlog #36).** `AppShell` renderuje 5 z 12 widoków (`Pulpit.tsx:99`,
`Konfiguracja.tsx:24`, `Atrybuty.tsx:80`, `Selly.tsx:141`, `MojeKonto.tsx:78`); nie renderuje
7 (`Katalog`, `Staging`, `Historia`, `Narzuty`, `Alerty`, `WagaGabarytowa`, `Analityka`).
**Oryginał pokazuje sidebar na WSZYSTKICH ekranach zalogowanego** — `mn()`
(`deminified/frontend-index.js:16329`) owija JSX każdego komponentu z tabeli routera
(`:28641-28680`), 12 wywołań `mn(`; bez niego są tylko `/login` i 404. To jest więc **rozjazd
z wiernością**, nie kwestia stylu odbudowy. `AppShell` (`components/AppShell.tsx:19`) przyjmuje
**wyłącznie `children`** — brak propsów per-widok, więc hoisting do routera jest mechaniczny.
Testy FE: `test/shell.test.tsx` sprawdza sidebar tylko na `/`; żaden test nie zakłada
nieobecności `AppShell` na pozostałych widokach.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ticket nie zmienia kształtu ani wartości żadnej odpowiedzi API.** Zmiany backendowe są dwie
i obie są poza ciałem odpowiedzi:
- **CORS (D2b)** — walidacja konfiguracji przy starcie procesu (fail-fast + log), zero wpływu
  na odpowiedzi tras.
- **JWT `algorithms` (D2c)** — parametr weryfikacji podpisu; token podpisywany jest tym samym
  HS256 co dotąd, więc istniejące tokeny i odpowiedzi `login`/`me` nie zmieniają się.
- **Retencja kopii (D2d)** — kasowanie plików `*.bak_before_clear_*` na dysku po wykonaniu
  operacji; odpowiedź `POST /api/products/clear` bez zmian.
- **Test rejestru (D2a)** — wyłącznie nowy test, zero zmian w kodzie produkcyjnym.

Wobec tego **zakresem GATE jest cała dotychczasowa siatka** — 73 nagrania / 96 ścieżek
z `contract/fixtures/` i `contract/openapi.yaml` — z wymaganiem, żeby **nic się nie zmieniło**:
pełny `npm test` w `rebuild/backend` (obejmuje `kontrakt.spojnosc.test.ts` i wszystkie testy
GATE porównujące odpowiedzi z fixtures) musi przejść bez ani jednej modyfikacji pliku
w `contract/`. **Jakakolwiek konieczność ruszenia fixture'a = STOP i rozmowa z użytkownikiem** —
w tym tickecie nie ma zatwierdzonego odstępstwa, które by ją usprawiedliwiało.

Znane rozjazdy i jak je rozstrzygamy: **żadnych nowych.** Odstępstwo D1 z I1 (`requireAuth` na
14 trasach, które produkcja oddaje publicznie) zostaje **utrzymane** — jest zmierzone na
uruchomionym oryginale w 12d, oznaczone w kontrakcie adnotacją `x-odbudowa-auth` z jawnym
`401`, i pilnowane przez `kontrakt.spojnosc.test.ts`. Backlog #52 to potwierdza; 12e nie cofa
niczego do wariantu publicznego.

## Decyzje

Wszystkie z rundy Q&A z użytkownikiem (2026-09-08).

- **D1 — sidebar: wspólny layout w `App.tsx`.** `AppShell` przenosimy z widoków do routera, tak
  by wszystkie 12 tras zalogowanego renderowały sidebar; `/login` i 404 zostają bez niego (jak
  w oryginale). *Za:* przywraca wierność wobec `mn()` z oryginału, jedno miejsce zamiast
  siedmiu, `AppShell` bezpropsowy więc zmiana mechaniczna. *Przeciw:* dotyka wyglądu 7 widoków
  tuż przed przeglądem — dlatego obowiązkowo sprawdzamy dublujący się padding (`AppShell.tsx:154`
  daje `px-4 sm:px-6 lg:px-8 py-6`, a widoki bez shella mają własne `p-6`, np. `Katalog.tsx:172`).
  Backlog **#36** → ✅ TAK (naprawa rozjazdu z oryginałem, nie odstępstwo).

- **D2 — cztery drobne wzmocnienia, wszystkie w tym tickecie** (żadne nie łata dzisiejszej
  dziury; wszystkie są tanie i domykają temat na papierze):
  - **D2a — test skanujący realny rejestr Express.** Nowy test przechodzi rekurencyjnie po
    `app._router.stack`, zestawia znalezione trasy z jawną, krótką listą DOZWOLONYCH publicznych
    (`POST /api/login`, `POST /api/logout`, `GET /api/health`) i pada, gdy pojawi się cokolwiek
    poza nią bez `requireAuth`. *Za:* zamyka lukę procesu — nowa trasa bez auth i bez wpisu
    w kontrakcie nie przejdzie już CI. *Przeciw:* dotyka wewnętrznego API Express
    (`_router`) — trzeba to opisać komentarzem i zrobić odporne na wersję.
  - **D2b — twardy CORS w produkcji.** Jawny log przy starcie mówiący, czy CORS jest wyłączony
    (same-origin) czy z allowlistą, oraz **fail-fast, gdy `NODE_ENV=production` a `CORS_ORIGINS`
    zawiera `*`**. *Za:* dzisiejszy stan domyślny jest bezpieczny, ale cicho — jeden log usuwa
    wątpliwość „czy na pewno zamknięty?", a strażnik `*` zamyka jedyną realną pomyłkę
    konfiguracyjną. *Przeciw:* brak; nie zmienia zachowania poprawnej konfiguracji.
  - **D2c — przypięcie algorytmu JWT.** `jwt.verify(..., { algorithms: ["HS256"] })`.
    *Za:* jedna linia, jawna intencja. *Przeciw:* brak (sekret jest symetryczny, ryzyko
    praktyczne było zerowe — to porządek, nie naprawa).
  - **D2d — retencja kopii bazy (backlog #49).** Po wykonaniu kopii `*.bak_before_clear_<ISO>`
    trasa `POST /api/products/clear` kasuje najstarsze pliki, zostawiając **5 najnowszych**;
    best-effort, błąd sprzątania nie przerywa operacji (tak jak sama kopia jest best-effort).
    *Za:* zapobiega niekontrolowanemu wzrostowi katalogu danych przy częstym testowaniu
    parsera. *Przeciw:* **świadome odstępstwo od 1:1** — produkcja nie ma retencji; zmiana jest
    czysto operacyjna (dysk), nie dotyka API ani danych w bazie. Backlog **#49** → ✅ TAK.

- **D3 — backlog #48 (brak kolumny roli w `users`): zostaje 1:1 z produkcją.** Nie wprowadzamy
  ról ani `requireAdmin`. *Za:* to nie jest regresja odbudowy — oryginał chroni `/admin/*` samym
  `requireAuth` (`mirror/backend/extensions.cjs:296+`); wprowadzenie ról to zmiana schematu
  (migracja 004), nowe middleware i decyzja, kto dostaje admina — czyli **nowa funkcja**, dzień
  przed cutoverem. *Przeciw:* znana, udokumentowana słabość zostaje (każdy zalogowany widzi
  zakładki Admin i Dziennik). Wpis zamykamy jako ❌ NIE **w odbudowie**, z jawną notą, że to
  kandydat na osobny ticket po cutoverze — decyzja produktowa Ani, nie techniczna.

- **D4 — backlog #45 i #50: oba ❌ NIE, domknięte.** Obie sprawy mają już podjętą i uzasadnioną
  decyzję w tickietach źródłowych, więc status ⬜ wprowadzał w błąd, sugerując że coś czeka.
  **#45** (martwy filtr „Źródło") — odbudowa go pominęła decyzją D4 z 7b, bo odtwarzanie
  martwego elementu UI byłoby parytetem usterki, nie zachowania; ożywienie wymagałoby
  wystawienia `origin` w API, czego produkcja nie robi (= nowa funkcja).
  **#50** (`parsujSzczegoly` w dwóch kopiach) — zamierzony duplikat, decyzja D4 z ticketu 36:
  wspólny pakiet `rebuild/shared/` przebudowałby buildy, tsconfigi, lint i deploy obu stron
  za 12 linii kodu. Oba wpisy dostają odsyłacz do decyzji źródłowej.

- **D5 — backlog #51: ujednolicić do `DialogPotwierdzenia`.** Trzy wywołania `window.confirm`
  bez uzasadnienia (`Staging.tsx:177,210`, `konfiguracja/Admin.tsx:233`) przechodzą na komponent
  używany przez resztę odbudowy, z **dosłownym tekstem** z oryginału (zasada D2 z 7b).
  `konfiguracja/Katalog.tsx:45` **zostaje** jako świadomy, opisany komentarzem wyjątek.
  *Za:* jedna reguła zamiast trzech; znika podmienianie globalu `window.confirm` w testach.
  *Przeciw:* drobna zmiana UX (dialog własny zamiast natywnego) — bez regresu wobec produkcji,
  bo to niespójność wewnątrz odbudowy, nie rozjazd z oryginałem. Backlog **#51** → ✅ TAK.

- **D6 — odstępstwo D1 z I1 zostaje na stałe** (backlog #52). 14 tras, które produkcja oddaje
  bez tokenu, w odbudowie zostają pod `requireAuth`. Nie cofamy niczego do wariantu publicznego
  — to najgroźniejsza dziura oryginału (`/api/export/shoper` oddaje cały katalog, `/api/audit-log`
  log działań). Wpis #52 zamykamy jako rozstrzygnięty w 12e.

- **D7 — plan cutoveru zawiera dwa kroki proceduralne wskazane przez audyt** (nie było pytaniem
  biznesowym, zapisane jako decyzja, bo dokument bez nich byłby niebezpieczny):
  weryfikację `PRAGMA table_info(products)` na kopii produkcji **przed** `npm run migrate`
  (migracja `003_szerokosc_text.sql` przebudowuje `products`, a produkcja ma `szerokosc` już
  jako TEXT po migracji Ani `szertxt` — na stagingu ten sam rozjazd wywołał realny incydent,
  `docs/deploy-setup.md:198-223`), oraz osobną sekcję **„różnice env staging vs produkcja"**
  (`SELLY_TRYB` i `IMPORT_SCHEDULER` mają defaulty bezpieczne dla stagingu, ale NIEwierne
  produkcji — przeoczenie po cichu wyłączyłoby integrację Selly i harmonogram importu).

**Świadome odstępstwa od zachowania oryginału wprowadzane w tym tickecie:** tylko **D2d**
(retencja kopii bazy). D2b i D2c dotyczą konfiguracji/weryfikacji podpisu, nie zachowania
widocznego przez API. D1 i D5 **przywracają** zgodność (D1 z oryginałem, D5 z wewnętrznym
wzorcem odbudowy), więc odstępstwami nie są.

## Plan implementacji

Kolejność: backend (izolowane, tanie) → frontend (dotyka wyglądu) → dokumenty → roadmapa.
Jeden krok = jeden commit.

**Krok 1 — backend, wzmocnienia D2b + D2c.**
- `rebuild/backend/src/config/env.ts` — walidacja: gdy `NODE_ENV === "production"` i
  `CORS_ORIGINS` zawiera `*`, `wczytajEnv` rzuca z czytelnym komunikatem po polsku.
- `rebuild/backend/src/app.ts` (okolice :116) — jawny log przy starcie: „CORS: wyłączony
  (same-origin)" albo „CORS: allowlista N originów". Komentarz wyjaśniający, że brak middleware
  to stan bezpieczny, nie przeoczenie (żeby następny czytelnik nie „naprawił" tego z powrotem).
- `rebuild/backend/src/auth/jwt.ts:29` — `algorithms: ["HS256"]` w `jwt.verify`, komentarz.
- Testy: rozszerzyć `test/config.env.test.ts` o przypadek `production` + `*`; test, że token
  podpisany innym algorytmem nie przechodzi weryfikacji.

**Krok 2 — backend, retencja kopii D2d.**
- `rebuild/backend/src/routes/maintenance.ts` (`POST /api/products/clear`, port `:48319-48331`)
  — po `copyFileSync` + checkpoint WAL usunąć najstarsze `*.bak_before_clear_*` ponad limit 5.
  Stała `LIMIT_KOPII_PRZED_CZYSZCZENIEM = 5` z komentarzem, że to **odstępstwo od produkcji**
  (backlog #49, decyzja D2d) — produkcja nie sprząta wcale. Best-effort w `try/catch`: błąd
  sprzątania logujemy, ale nie przerywamy czyszczenia katalogu i nie zmieniamy odpowiedzi.
- Test: po trzech wywołaniach przy limicie 2 zostają dwa najnowsze pliki; błąd `unlink` nie
  psuje odpowiedzi trasy.

**Krok 3 — backend, test rejestru tras D2a.**
- Nowy `rebuild/backend/test/auth.rejestr.test.ts` — buduje aplikację przez istniejący helper
  `test/gate/aplikacja.ts`, przechodzi rekurencyjnie po `app._router.stack` (routery zagnieżdżone
  przez `app.use`), zbiera pary metoda+ścieżka wraz z listą warstw handlera, i sprawdza, że każda
  z nich albo ma w łańcuchu `requireAuth`, albo należy do jawnej stałej
  `TRASY_PUBLICZNE = ["POST /api/login", "POST /api/logout", "GET /api/health"]`.
  Komentarz: dlaczego `_router` (Express nie ma publicznego API introspekcji) i co zrobić, gdyby
  wersja Express to zmieniła. Test ma też asercję „lista publicznych ma dokładnie 3 pozycje",
  żeby jej rozszerzenie wymagało świadomej zmiany testu.

**Krok 4 — frontend, sidebar D1.**
- `rebuild/frontend/src/App.tsx` — owinąć trasy zalogowanego wspólnym `AppShell`
  (Wouter: `<AppShell>` wokół `<Switch>` z trasami chronionymi, `/login` i 404 poza nim).
- Zdjąć `<AppShell>` z wnętrza pięciu widoków: `Pulpit.tsx:99`, `Konfiguracja.tsx:24`,
  `Atrybuty.tsx:80`, `Selly.tsx:141`, `MojeKonto.tsx:78`.
- Przejrzeć padding siedmiu widoków, które dostaną shell (`Katalog`, `Staging`, `Historia`,
  `Narzuty`, `Alerty`, `WagaGabarytowa`, `Analityka`) — `AppShell.tsx:154` daje już
  `px-4 sm:px-6 lg:px-8 py-6`, więc własne `p-6` w widoku (np. `Katalog.tsx:172`) trzeba zdjąć,
  żeby nie zdublować marginesu.
- Test: rozszerzyć `test/shell.test.tsx` o asercję, że sidebar renderuje się na wybranych
  trasach spoza `/` i **nie** renderuje się na `/login`.

**Krok 5 — frontend, potwierdzenia D5.**
- `rebuild/frontend/src/pages/Staging.tsx:177,210` i
  `rebuild/frontend/src/pages/konfiguracja/Admin.tsx:233` — zamiana `window.confirm` na
  `DialogPotwierdzenia` (`components/DialogPotwierdzenia.tsx`), **tekst dosłownie** taki jak
  w dzisiejszym `confirm`. Wzorzec do skopiowania: użycia z 7b (D2), narzutów (D6) i 12c (D1).
- `konfiguracja/Katalog.tsx:45` — bez zmian, wyjątek zostaje.
- Testy: zaktualizować te, które podmieniają globalny `window.confirm` dla tych trzech miejsc.

**Krok 6 — `docs/cutover.md` (nowy).** Plan big-bang: przełączenie Apache/PM2 na nowy stos na
TEJ SAMEJ bazie `data.db` (`/home/admin/private_apps/bridge/data.db`). Sekcje:
warunki wstępne (zielony przegląd Ani, zielone bramki, kopia bazy) · **weryfikacja schematu
przed migracją** (`PRAGMA table_info(products)` vs kanon — D7) · migracje w kolejności 001→003
z notą, że runner `db/migrate.ts:39-78` śledzi je w tabeli `_migracje`, więc powtórzenie
`npm run migrate` jest bezpieczne · **różnice env staging vs produkcja** (D7: `DB_PATH`,
`JWT_SECRET` — wymagane bez fallbacku; `NODE_ENV`, `HOST`/`PORT` 0.0.0.0:5000,
`IMPORT_SCHEDULER` + `IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG`, `SELLY_TRYB=pelny` i sekrety
`SELLY_*`, `CORS_ORIGINS` pusty przy same-origin) · kroki przełączenia (PM2, `.htaccess`
w `public_html/panel/`) · **rollback** (stary bundle + PM2 wstecz, baza z kopii) · checklista
smoke-testów po przełączeniu. **To dokument, nie wykonanie.**

**Krok 7 — `docs/przeglad-12-widokow.md` (nowy).** Checklista dla Ani na staging
(https://test.agritires.eu), format jak `docs/instrukcja-testow-I*.md` (po polsku, językiem
Ani, nie technicznym). Po jednej sekcji na trasę: `/` · `/katalog` · `/staging` · `/narzuty` ·
`/alerty` · `/analityka` · `/historia` · `/konfiguracja` · `/waga-gabarytowa` · `/atrybuty` ·
`/moje-konto` · `/selly`. W każdej: co ma się pokazać, 2–4 konkretne rzeczy do kliknięcia,
miejsce na ✅/❌. Osobna sekcja „rzeczy, które celowo wyglądają inaczej niż w starym Bridge"
(świadome odstępstwa z backlogu — żeby Ania nie zgłaszała ich jako błędów) i „co jest znane
i nienaprawione" (#48 — każdy zalogowany widzi zakładki Admin/Dziennik).

**Krok 8 — dokumenty odbudowy (Faza 5, doc-checkerzy).** `docs/rebuild-roadmap.md`:
§4 tablica — I12 na ✅ z datą i ID ticketa; §5 blok 12e — status ✅ i **zakres faktycznie
dowieziony** (w tym: obawa o otwarty CORS z promptu się nie potwierdziła); §6 „Po zakończeniu"
— przepisane na stan po domknięciu, z odsyłaczem do `cutover.md` i checklisty.
`docs/rebuild-backlog.md`: #36 ✅, #49 ✅, #51 ✅, #45 ❌, #48 ❌, #50 ❌, #52 ✔ rozstrzygnięty.
Do przejrzenia także `docs/spec-backend.md` §2 (dopisać wynik audytu 12e) i
`docs/deploy-setup.md` (odsyłacz do `cutover.md`).

## Strategia testów

- **GATE odbudowy:** pełny `npm test` w `rebuild/backend` (77 plików, ~1209 testów) — obejmuje
  `kontrakt.spojnosc.test.ts` (walidacja względem `contract/openapi.yaml`, w tym 14 adnotacji
  `x-odbudowa-auth`) oraz wszystkie testy GATE porównujące odpowiedzi z `contract/fixtures/`.
  **Warunek zaliczenia: zielono BEZ ani jednej zmiany w `contract/`** — `git status contract/`
  musi być pusty na koniec ticketa. To jest sprawdzian, że audyt niczego nie zepsuł.
- **Nowe testy jednostkowe:** walidacja env dla `production` + `CORS_ORIGINS=*` (D2b);
  odrzucenie tokenu o innym algorytmie (D2c); retencja kopii — limit i odporność na błąd
  `unlink` (D2d).
- **Nowy test strukturalny:** skan rejestru Express pod kątem `requireAuth` (D2a) — to jedyny
  test w tym tickecie, który ma wartość regresyjną na przyszłość, a nie tylko potwierdzającą.
- **Frontend:** `npm test` + `npm run test:integracja`; rozszerzenie `test/shell.test.tsx`
  o obecność sidebara poza `/` i jego brak na `/login` (D1); aktualizacja testów podmieniających
  `window.confirm` (D5).
- **Bramki obu stron:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
  w `rebuild/backend` i `rebuild/frontend`.
- **Czego NIE robimy:** nie uruchamiamy oryginału ani nie nagrywamy nowych fixtures (12d to
  zamknęła, ticket nie zmienia kształtu odpowiedzi); nie odpalamy `POST /api/selly/sync-supplier`
  z `dry_run=false`; nie wykonujemy cutoveru — `docs/cutover.md` to dokument.

## Poza zakresem

- Nowe funkcje jakiegokolwiek rodzaju.
- Sam cutover / go-live — osobne zdarzenie z Anią, ten ticket dostarcza wyłącznie dokument.
- Kolumna roli w `users` i `requireAdmin` (D3 — świadomie NIE).
- Wystawienie `origin` w API atrybutów i ożywienie filtra „Źródło" (D4 — świadomie NIE).
- Wspólny pakiet `rebuild/shared/` dla `parsujSzczegoly` (D4 — świadomie NIE).
- Cofanie odstępstwa D1 z I1 (14 tras zostaje pod `requireAuth` — D6).
- Sam przegląd 12 widoków — klika go Ania, my dostarczamy checklistę.

## Definition of done

- [ ] Audyt A–D udokumentowany w `raport.md` z konkretnymi `plik:linia` — auth, CORS, JWT,
      mass-assignment; każde znalezisko albo naprawione, albo świadomie zamknięte decyzją.
- [ ] D2a — test skanujący rejestr Express zielony; lista publicznych ma dokładnie 3 pozycje.
- [ ] D2b — fail-fast na `CORS_ORIGINS=*` w produkcji + log stanu CORS przy starcie.
- [ ] D2c — `algorithms: ["HS256"]` w `jwt.verify`.
- [ ] D2d — retencja 5 kopii po `POST /api/products/clear`, best-effort, z testem.
- [ ] D1 — `AppShell` w routerze; sidebar na wszystkich 12 trasach zalogowanego, brak na
      `/login` i 404; padding sprawdzony na 7 widokach, które go dostały.
- [ ] D5 — `Staging.tsx` i `konfiguracja/Admin.tsx` na `DialogPotwierdzenia` z dosłownym
      tekstem; `konfiguracja/Katalog.tsx` bez zmian.
- [ ] `docs/cutover.md` — warunki wstępne, weryfikacja schematu, migracje, różnice env,
      kroki, rollback, smoke-testy.
- [ ] `docs/przeglad-12-widokow.md` — checklista dla Ani, 12 sekcji + odstępstwa + znane braki.
- [ ] Backlog rozliczony: #36 ✅, #49 ✅, #51 ✅, #45 ❌, #48 ❌, #50 ❌, #52 rozstrzygnięty;
      żaden wpis nie zostaje ⬜ bez świadomej noty, że to follow-up po cutoverze.
- [ ] Roadmapa: I12 ✅ w §4 i §5 (data + ID ticketa), blok 12e opisuje STAN, §6 przepisane.
- [ ] Bramki zielone po obu stronach; `git status contract/` pusty.
- [ ] Całość na stagingu (merge do `develop` uruchamia deploy).
