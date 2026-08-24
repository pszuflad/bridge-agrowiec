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
