# 1-FEATURE-backend-fundament-logowanie — Code review

> Reviewed: 2026-08-24
> Branch: `feature/1-backend-fundament-logowanie`
> Diff: 49 plików, 5 commitów (`origin/develop...HEAD`)

## BLOCKER

Brak. Nie znalazłem błędów logicznych, luk bezpieczeństwa ani rozjazdów z kontraktem, które
kwalifikowałyby się jako blokujące. `npm run lint`, `npm run typecheck`, `npm test` (64/64) i
`npm run build` przechodzą lokalnie z czystego stanu worktree; `npm run migrate` sprawdzony
ręcznie — pierwsze uruchomienie stosuje `001_schema.sql`, drugie poprawnie nic nie robi
(idempotencja potwierdzona poza samymi testami jednostkowymi).

## SHOULD-FIX

- [ ] `rebuild/backend/src/middleware/errors.ts:24-37` — `bladHandler` liczy `status` z błędu, ale
  używa go tylko do porównania `=== 400`; każdy inny błąd czterysetkowy (np. `PayloadTooLargeError`
  ze `status: 413`, gdy ciało przekroczy limit `express.json({limit:"5mb"})`) trafia do gałęzi `500`
  i loguje się jako błąd serwera, choć to błąd klienta.
  - Suggestion: `if (status >= 400 && status < 500) { res.status(status).json({ error: "Błędne żądanie" }); return; }` zamiast sztywnego `=== 400`.
- [ ] `rebuild/backend/src/app.ts:26` — limit ciała JSON zmieniony z `50mb` (oryginał,
  `deminified/backend-index.cjs:48932`) na `5mb`. To sensowne z punktu widzenia bezpieczeństwa, ale
  jest to **niezatwierdzona, nieudokumentowana zmiana** wobec tabeli odstępstw O1–O6 w `plan.md` —
  przyszłe iteracje (np. import produktów) mogą polegać na dużych payloadach. Warto dopisać jako
  odstępstwo (O7) w planie/README albo świadomie potwierdzić z użytkownikiem.
- [ ] `rebuild/backend/src/routes/auth.ts:34` — walidacja `POST /api/login` dokłada
  `typeof email !== "string" || typeof password !== "string"` ponad oryginalne `if (!l || !p)`
  (`deminified/backend-index.cjs:48158-48161`). To niezatwierdzone, nieudokumentowane odejście od
  1:1 (prawdopodobnie bezpieczniejsze — oryginał przy nie-stringowym, prawdziwym polu wiązałby
  nieprymitywną wartość w zapytaniu do better-sqlite3, co realnie kończyłoby się wyjątkiem/500;
  tu jest to świadomie złapane jako 400). Skoro tak, warto to dopisać do tabeli odstępstw zamiast
  zostawiać jako niewidoczny fakt w kodzie — inaczej kolejny agent nie będzie wiedział, że to
  świadoma decyzja, a nie przypadkowy dryf od oryginału.
- [ ] `rebuild/backend/test/db.migracje.test.ts` i `rebuild/backend/test/gate/baza.ts` — testy
  poprawnie używają katalogów tymczasowych (`mkdtempSync`) i nie zajmują portu, więc są w pełni
  równoległe; nie mam tu zastrzeżeń poza odnotowaniem tego w sekcji „Parallel-test concerns" niżej
  (informacyjnie, nie checklistowo).

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/app.ts:26-31` — kolejność middleware (`express.json()` → opcjonalny CORS
  → `optionalAuth`) różni się od oryginału (CORS → JSON, `deminified/backend-index.cjs:48920-48934`).
  Bez praktycznego wpływu przy domyślnie wyłączonym CORS (staging/prod są same-origin), ale przy
  włączonej allowliście preflight `OPTIONS` przechodzi teraz najpierw przez parser JSON-a zanim
  dotrze do obsługi CORS — dla pustych ciał OPTIONS nieszkodliwe, ale warto mieć to na uwadze przy
  ewentualnym dodaniu treści do preflightów.
- [ ] `rebuild/backend/src/middleware/cors.ts` — brak `Access-Control-Expose-Headers: Set-Cookie`
  (oryginał go ustawiał, `:48930`). Bez znaczenia funkcjonalnego (cookie i tak `HttpOnly`, JS nie
  odczyta go niezależnie od tego nagłówka), czysto kosmetyczna różnica względem oryginału.
- [ ] `rebuild/backend/src/repos/users.ts:16-18` — `pobierzUzytkownikaPoId` nieużywane w tej
  iteracji (świadomie odnotowane w raporcie pod Iterację 12) — OK, tylko przypominam żeby nie
  zniknęło z pola widzenia przy kolejnym sprzątaniu lintera pod `no-unused-exports`.

## Plan compliance

### Done ✓
- Krok 1 — szkielet `rebuild/backend/` (TS strict ESM, Express 4, Vitest, ESLint flat config,
  `.env.example`, `.gitignore`, `.nvmrc` 24→20) — zgodnie z planem.
- Krok 2 — `src/config/env.ts` (fail-fast bez `JWT_SECRET`), `src/db/index.ts` (WAL + foreign_keys +
  busy_timeout), `src/db/schema.ts` (wygenerowany introspekcją, z ręcznym `.unique()` na
  `users.email` — zgadza się z `001_schema.sql:186-193`), `src/db/migrate.ts` + `migrate-cli.ts`
  (idempotentne, katalog `MIGRATIONS_DIR → dist/schema → rebuild/schema`, potwierdzone testem i
  ręcznym uruchomieniem).
- Krok 3 — auth 1:1 z oryginałem: `jwt.ts` (`sign`/`verify`, `expiresIn:"30d"`), `password.ts`
  (bcrypt cost 10), `cookie.ts` (nazwa, `Path=/`, `HttpOnly`, `Max-Age=2592000`, flagi wg O4/O6),
  `middleware/auth.ts` (`optionalAuth`≈`C4`, `requireAuth`≈`we`), `repos/users.ts` (dokładne
  dopasowanie e-maila bez trim/lowercase), `routes/auth.ts` (400/401/200 verbatim jak w
  `:48156-48183`), `app.ts` (fabryka bez `listen()`), `server.ts` (wejście `dist/server.js` +
  graceful shutdown).
- Krok 4 — harness GATE (`test/gate/`) generyczny: `kontrakt.ts` poprawnie dopasowuje ścieżki z
  parametrami (`{id}` → `[^/]+`, potwierdzone testem `dopasowuje ścieżki z parametrem`), ignoruje
  query string, rozróżnia `security: []`; `ksztalt.ts` realnie wyłapuje brakujące/nadmiarowe klucze
  i niezgodne typy (potwierdzone testami i „weryfikacją, że GATE ma zęby" w raporcie — celowo
  wstrzyknięte nadmiarowe pole faktycznie wywaliło GATE).
- Krok 5 — komplet testów z planu obecny i realny (nie podbijają tylko licznika): 400/401/200 dla
  loginu, 401 warianty dla `/api/me` (obcy sekret, wygasły token, śmieci, brak prefiksu Bearer),
  pierwszeństwo Bearer nad cookie, brak wycieku `hasloHash`/`$2`, `ostatnie_logowanie` aktualizowane
  tylko przy sukcesie, bcrypt `$2a$`/`$2b$` kompatybilność, migracje idempotentne + 26 tabel/13
  indeksów, env fail-fast, CORS allowlisty, 404/400 w JSON, brak `X-Powered-By`.
- Krok 6 — README backendu kompletne (stos, quick start, zmienne env, GATE, struktura, tabela
  odstępstw O1–O6, wdrożenie); `tools/deploy-staging.sh` wczytuje `$STAGING_ROOT/.env` i ma guard
  na brak `JWT_SECRET` pod `set -euo pipefail` (sprawdzone — `${JWT_SECRET:-}` bezpieczne przy
  `set -u`, `set -a`/`set +a` wokół source'owania pliku env poprawne); `docs/deploy-setup.md` ma
  krok 4a z generowaniem sekretu i `chmod 600`.

### Missing or deviating ✗
- Brak elementów planu, które by nie zostały zrealizowane. Jedyne odchylenia to dwa **niezatwierdzone
  i nieudokumentowane w tabeli O1–O6** szczegóły opisane w SHOULD-FIX (limit body 5mb zamiast 50mb;
  dodatkowa walidacja `typeof` w `POST /api/login`) — oba defensywne i raczej korzystne, ale poza
  formalnym procesem odstępstw, który plan sam sobie narzucił.

### Definition of done
- [x] `rebuild/backend/` startuje: `npm ci && npm run build` → `dist/server.js`, nasłuch na `HOST:PORT`, baza z `DB_PATH` — zweryfikowane (`npm run build` + manualny `npm run migrate` na testowej bazie).
- [x] `npm run migrate` stosuje `001_schema.sql` idempotentnie — zweryfikowane ręcznie (dwa uruchomienia) + testem.
- [x] `POST /api/login` — 400/401/200 dokładnie jak oryginał, `{ok,user,token}` + cookie `bridge_session`.
- [x] `POST /api/logout` — `{ok:true}` + wyczyszczone cookie.
- [x] `GET /api/me` — 401 bez tokenu; 200 z surowym payloadem JWT, kształt 1:1 z `GET_me.json`.
- [x] Auth działa równolegle przez `Bearer` i cookie (pierwszeństwo Bearer potwierdzone testem).
- [x] `requireAuth` gotowy do nakładania na trasy danych kolejnych iteracji.
- [x] GATE przechodzi: fixture `GET_me.json` + walidacja kontraktu dla 3 ścieżek.
- [x] Harness GATE generyczny — `test/gate/index.ts` + przykład użycia w README pokazują wzorzec dla kolejnej iteracji.
- [x] `npm test`, `npm run lint`, `npm run typecheck` zielone — zweryfikowane lokalnie (Node 20).
- [x] `rebuild/backend/README.md` kompletne.
- [x] `JWT_SECRET` udokumentowany w `docs/deploy-setup.md` + wczytywany przez `deploy-staging.sh`.

## Parallel-test concerns

None — wszystkie testy (jednostkowe, GATE, migracje) używają katalogów tymczasowych
(`mkdtempSync(tmpdir(), "bridge-…")`) na osobne bazy SQLite i realnej instancji `app` przez
`supertest` bez `listen()`, więc żaden port ani wspólny plik nie jest zajmowany. Bezpieczne przy
kilku agentach pracujących równolegle.

## Overall assessment

Bardzo solidna robota jak na fundament — wierność oryginałowi jest dopięta niemal linia w linię
(potwierdzona bezpośrednim porównaniem z `deminified/backend-index.cjs:47850-47945` i
`:48156-48215`), a każde świadome odstępstwo (O1–O6) jest udokumentowane w trzech miejscach
(kod, README, plan) i pokryte testem-strażnikiem. Harness GATE ma realne zęby — porównywarka
kształtu poprawnie wyłapuje braki/nadmiary/niezgodne typy, a indeks kontraktu dobrze radzi sobie
z parametrami ścieżki i query stringiem; wzorzec użycia w kolejnej iteracji jest jasno opisany.
Jedyne zastrzeżenia to dwa drobne, niezatwierdzone odejścia od 1:1 (limit body, dodatkowa walidacja
typu w loginie) i jeden realny, choć niszowy bug w obsłudze błędów (413 mapowane na 500) — żadne z
nich nie blokuje merge'a, ale pierwsze dwa warto formalnie dopisać do tabeli odstępstw, żeby kolejny
agent nie musiał się domyślać, czy to celowe.

---

# Runda 2 — po naniesieniu poprawek z rundy 1

> Reviewed: 2026-08-24
> Branch: `feature/1-backend-fundament-logowanie`
> Diff: 51 plików łącznie (9 plików w commicie poprawek), 6 commitów (`origin/develop...HEAD`)
> Commit poprawek: `90cdabc` — „review fix - przywrócenie wierności oryginałowi (limit 50mb, kolejność middleware, nagłówki CORS) i statusy 4xx”

## Weryfikacja sześciu poprawek z rundy 1

Wszystkie sześć sprawdzone bezpośrednio w kodzie (nie tylko w opisie z raportu) i porównane
linia po linii z `deminified/backend-index.cjs:48926-48945` — zgodne z deklaracją:

1. **Limit ciała 50 MB** (`src/app.ts:32-33`) — `express.json({limit:"50mb"})` +
   dołożony `express.urlencoded({extended:false, limit:"50mb"})`, dokładnie jak oryginał
   (`:48931-48940`). Potwierdzone testem `przyjmuje ciało application/x-www-form-urlencoded`.
2. **Kolejność middleware** (`src/app.ts:26-33`) — CORS (jeśli włączony) montowany przed
   parserami ciała, zgodnie z oryginałem (`:48926-48940`). Ponieważ `stworzSrodowiskoTestowe()`
   nie ustawia `CORS_ORIGINS`, middleware CORS w ogóle się nie montuje w domyślnym środowisku
   testowym — więc ta zmiana kolejności nie wpływa na istniejące testy, co potwierdza czyste
   `npm test` (69/69).
3. **Nagłówki CORS** (`src/middleware/cors.ts:23-26`) — `Access-Control-Allow-Headers` z `Cookie`,
   `Access-Control-Allow-Methods` bez spacji (`GET,POST,PUT,DELETE,PATCH,OPTIONS`),
   `Access-Control-Expose-Headers: Set-Cookie` — 1:1 z `:48928`. Pokryte nowymi asercjami
   w `test/app.cors-i-bledy.test.ts:40-41`.
4. **`bladHandler` — pełny zakres 4xx** (`src/middleware/errors.ts:32-37`) — sprawdzone: w całym
   `src/` nie ma ani jednego miejsca, które rzuca błąd z własnym `status`/`statusCode` poza
   parserami Expressa (`grep -rn "new Error" src/` → tylko `env.ts`/`migrate.ts`, oba bez `status`).
   Rozszerzenie zakresu z `=== 400` na `>= 400 && < 500` jest więc **bezpieczne** — nie przepuszcza
   niczego, co wcześniej trafiało do gałęzi 500 z premedytacją; jedyne co realnie przez to przechodzi
   to `SyntaxError` (400) i `PayloadTooLargeError` (413) z `express.json`/`express.urlencoded`.
   Pokryte 4 nowymi testami jednostkowymi handlera (`test/middleware.bledy.test.ts`), w tym
   przypadkiem „nagłówki już wysłane → deleguj dalej”.
5. **Odstępstwo O7** dopisane w `plan.md:127-132` i w tabeli README (`README.md:153`) — treść zgadza
   się z tym, co kod faktycznie robi (`src/routes/auth.ts:34`).
6. **Nowe testy** — faktycznie dodane i przechodzą: `test/middleware.bledy.test.ts` (4 przypadki),
   `test/app.cors-i-bledy.test.ts` (+2 asercje/test). Łączny licznik zgadza się z raportem: **69
   testów w 9 plikach** (`npm test` lokalnie, Node 20, potwierdzone w tej rundzie).

## Szukanie regresji

Nie znaleziono regresji. W szczególności sprawdzone:
- **Zmiana kolejności CORS→parsery** nie psuje żadnego istniejącego testu ani przepływu — w
  domyślnym (produkcyjnym/testowym) ustawieniu `CORS_ORIGINS=""` middleware CORS w ogóle się nie
  montuje (`if (env.CORS_ORIGINS.length > 0)`), więc kolejność jest bez znaczenia poza scenariuszem
  lokalnego dev z ustawioną allowlistą — tam też zachowanie jest teraz identyczne z oryginałem.
- **Limit 50 MB** nie wprowadza nowego ryzyka DoS ponad to, co miała produkcja — to przywrócenie
  identycznego zachowania oryginału (`:48932`,`:48939`), nie nowa decyzja tego ticketa; brak
  rate-limitingu jest już świadomie zachowanym zachowaniem produkcji (patrz nagłówek zadania).
- **`bladHandler` przy szerszym zakresie 4xx** nie zaczyna „połykać” żadnych specyficznych
  komunikatów błędów biznesowych — potwierdzone grep-em, że żaden kod aplikacji nie rzuca
  własnych błędów ze statusem 4xx przez `next(err)`; wszystkie trasy odpowiadają bezpośrednio
  przez `res.status().json()`. Gdy w kolejnych iteracjach (np. import) pojawią się takie błędy,
  trzeba będzie pamiętać, że `bladHandler` teraz zwraca generyczne `{error:"Błędne żądanie"}` dla
  każdego z nich (nie przekazuje oryginalnej wiadomości) — to zamierzone (nie wyciekać szczegółów),
  ale warto mieć to na uwadze przy pisaniu nowych handlerów z niestandardowymi kodami 4xx.
- **`urlencoded` parser** dodany z `extended:false` (parser `querystring`, nie `qs`) — tak jak
  oryginał; nie wprowadza ryzyka prototype pollution charakterystycznego dla `extended:true`.

## Świeży przegląd całości — fidelity i harness GATE

- Ponownie porównane `deminified/backend-index.cjs:47850-47945` (JWT/cookie/auth middleware) i
  `:48156-48215` (routes login/logout/me/users/password-change) z `src/auth/jwt.ts`,
  `src/auth/cookie.ts`, `src/middleware/auth.ts`, `src/repos/users.ts`, `src/routes/auth.ts` —
  zgodność potwierdzona linia po linii, bez nowych rozbieżności.
- `test/gate/kontrakt.ts` i `test/gate/ksztalt.ts` (harness dla 11 kolejnych iteracji) przejrzane
  pod kątem logiki porównawczej: dopasowanie ścieżek z parametrami, ignorowanie query stringu,
  scalanie szablonu z przyciętych tablic fixture'ów, polityka `null`-i-ostrzeżeń — logika jest
  spójna i bezpieczna (błąd zawsze w stronę „za ostro”, nie „za luźno”: brakujący/nadmiarowy klucz
  i niezgodny typ to zawsze twarda różnica).
- Pole `Operacja.wymagaAuth` (`test/gate/kontrakt.ts:23,56`) jest wyliczane z `security` w
  kontrakcie, ale w tej iteracji nie jest nigdzie egzekwowane automatycznie — używane tylko
  w jednym teście `gate.harness.test.ts` do potwierdzenia, że się poprawnie liczy. To świadomie
  budulec dla kolejnych iteracji (harness dostarcza dane, testy per-endpoint z nich korzystają),
  nie błąd — zanotowane niżej jako NICE-TO-HAVE, żeby kolejny agent wiedział, że pole istnieje
  i można je wykorzystać zamiast pisać własne sprawdzanie 401.
- `contract/fixtures/GET_me.json` zgadza się z kształtem zwracanym przez `GET /api/me`
  (`test/auth.gate.test.ts`), a udokumentowany rozjazd kontrakt↔produkcja (401 nieopisane
  w `openapi.yaml` dla `/api/me`) jest jawnie przetestowany i wyjaśniony w kodzie testu —
  wzorowy przykład tego, jak kolejne iteracje powinny dokumentować podobne rozjazdy.

## BLOCKER

Brak.

## SHOULD-FIX

Brak nowych. Wszystkie trzy z rundy 1 potwierdzone jako naprawione (patrz sekcja weryfikacji
powyżej), bez regresji.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/gate/kontrakt.ts:23,56` — pole `wymagaAuth` jest liczone, ale
  nieużywane do automatycznej weryfikacji 401 na chronionych trasach w żadnym z testów per-endpoint
  (na razie nie ma jeszcze takich testów poza `/api/me`). Warto rozważyć w kolejnej iteracji dodanie
  wspólnej asercji (np. w `asercje.ts`) korzystającej z tego pola, żeby nie trzeba było ręcznie
  pamiętać, które trasy wymagają auth.
- [ ] `rebuild/backend/src/middleware/errors.ts:34-36` — przy rozszerzeniu zakresu 4xx handler
  zawsze zwraca ten sam komunikat `"Błędne żądanie"` niezależnie od realnej przyczyny (400 vs 413
  vs inny). To celowe (nie wyciekać szczegółów), ale warto to jednym zdaniem dopisać w komentarzu
  nad handlerem, żeby kolejny agent pisząc handler dla nowego kodu 4xx (np. 422 przy walidacji
  importu w Iteracji 3) wiedział, że musi obsłużyć własny komunikat błędu PRZED `next(err)`, a nie
  liczyć na to, że `bladHandler` odda coś specyficznego.

## Overall assessment

Wszystkie sześć poprawek z rundy 1 zostały wprowadzone dokładnie tak, jak deklaruje raport —
zweryfikowane bezpośrednim porównaniem kodu z `deminified/backend-index.cjs:48926-48945` oraz
uruchomieniem pełnego pipeline'u (`lint`, `typecheck`, `test` 69/69, `build`) z czystego stanu
worktree. Nie znaleziono żadnej regresji: zmiana kolejności middleware jest neutralna w domyślnej
konfiguracji (CORS wyłączony), limit 50 MB przywraca tożsamość z produkcją bez nowego ryzyka
ponad to, co produkcja już ma, a rozszerzenie `bladHandler` na cały zakres 4xx jest bezpieczne,
bo żaden kod aplikacji nie rzuca własnych błędów status-bearing poza parserami Expressa. Świeży
przegląd fidelity (linie 47850-47945, 48156-48215, 48920-48945) i harnessu GATE nie wykrył nic
nowego poza dwoma kosmetycznymi uwagami do rozważenia w kolejnych iteracjach. Gałąź gotowa do
merge'a.
