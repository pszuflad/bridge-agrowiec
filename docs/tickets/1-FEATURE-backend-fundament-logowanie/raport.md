# 1-FEATURE-backend-fundament-logowanie — raport z implementacji

## Podsumowanie

Powstał `rebuild/backend/` — szkielet Node 20 + TypeScript (ESM, strict) + Express 4 + Drizzle
+ better-sqlite3 (WAL) na kanonicznym `rebuild/schema/001_schema.sql`, z wiernie odtworzonym
logowaniem (`POST /api/login`, `POST /api/logout`, `GET /api/me`) i middlewarem auth gotowym
do nakładania na trasy danych kolejnych iteracji. Do tego generyczny **harness GATE**
(`test/gate/`), który porównuje odpowiedzi z `contract/fixtures/` i waliduje je wobec
`contract/openapi.yaml` — współdzielony przez wszystkie następne iteracje.

64 testy w 8 plikach, `lint`/`typecheck`/`test`/`build` zielone z czystego `npm ci`.

## Zmiany

**Nowe — `rebuild/backend/` (szkielet i konfiguracja):**
- `package.json` — skrypty `build`/`start`/`dev`/`migrate`/`seed:dev`/`test`/`lint`/`typecheck`, `engines.node >=20`
- `tsconfig.json`, `tsconfig.build.json` — strict, ESM (`NodeNext`), `dist/` z samego `src/`
- `eslint.config.js`, `vitest.config.ts`, `drizzle.config.ts`, `.env.example`, `.gitignore`
- `scripts/copy-schema.mjs` — kopiuje `rebuild/schema/*.sql` do `dist/schema/`, żeby release na VPS był samowystarczalny
- `scripts/seed-dev.ts` — konto deweloperskie do klikania lokalnie (nieużywane w testach ani na stagingu)

**Nowe — warstwa danych:**
- `src/config/env.ts` — walidacja env (zod), fail-fast bez `JWT_SECRET`
- `src/db/index.ts` — better-sqlite3 z `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout` + Drizzle
- `src/db/schema.ts` — **wygenerowany** przez `drizzle-kit pull` z bazy zbudowanej z `001_schema.sql` (26 tabel, 269 kolumn); ręczne dopieszczenie: `.unique()` na `users.email`
- `src/db/migrate.ts` + `src/db/migrate-cli.ts` — idempotentne stosowanie `*.sql` z ewidencją w tabeli `_migracje`; katalog wykrywany: `MIGRATIONS_DIR` → `dist/schema` → `rebuild/schema`

**Nowe — auth (odtworzenie oryginału):**
- `src/auth/jwt.ts` — sign/verify, `expiresIn: "30d"`, walidacja kształtu payloadu
- `src/auth/password.ts` — bcryptjs, koszt 10
- `src/auth/cookie.ts` — `bridge_session`, `HttpOnly`, `Path=/`, `Max-Age=2592000`, ręczny odczyt cookie (bez `cookie-parser`)
- `src/middleware/auth.ts` — `optionalAuth` (odpowiednik `C4`) + `requireAuth` (odpowiednik `we`)
- `src/middleware/cors.ts` — CORS z allowlisty (domyślnie wyłączony)
- `src/middleware/errors.ts` — `asyncRoute`, 404 i handler błędów w JSON
- `src/repos/users.ts` — `pobierzUzytkownikaPoEmailu`/`PoId`, `zapiszOstatnieLogowanie`
- `src/routes/auth.ts` — `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `src/app.ts` — fabryka Expressa bez `listen()` (testowalna); `src/server.ts` — wejście `dist/server.js` z graceful shutdown
- `src/types/express.d.ts` — `req.user`

**Nowe — harness GATE (`test/gate/`, współdzielony przez kolejne iteracje):**
- `repo.ts` — lokalizowanie repo po `contract/openapi.yaml` (działa z każdego cwd i z CI)
- `fixtures.ts` — ładowanie `contract/fixtures/*.json`
- `ksztalt.ts` — rekurencyjne porównanie kształtu (klucze/typy/zagnieżdżenie), scalanie szablonu z przyciętych tablic, obsługa `null` i kluczy technicznych
- `kontrakt.ts` — indeks operacji z `openapi.yaml` (z dopasowaniem `{id}`), sprawdzanie kodu statusu i `security`
- `baza.ts` — świeża baza z `001_schema.sql` w katalogu tymczasowym + seed testowy (bcrypt cost 10)
- `aplikacja.ts` — gotowe środowisko testowe (baza + user + app)
- `asercje.ts`, `index.ts` — `sprawdzZgodnoscZKontraktem`, `sprawdzZgodnoscZFixture`

**Nowe — testy:** `test/auth.gate.test.ts`, `test/auth.login.test.ts`, `test/auth.me-logout.test.ts`,
`test/auth.bcrypt-kompatybilnosc.test.ts`, `test/db.migracje.test.ts`, `test/config.env.test.ts`,
`test/app.cors-i-bledy.test.ts`, `test/gate.harness.test.ts`

**Nowe — dokumentacja:** `rebuild/backend/README.md`

**Zmienione:**
- `tools/deploy-staging.sh` — wczytywanie sekretów z `$STAGING_ROOT/.env` (poza repo) + guard przerywający deploy z jasnym komunikatem, gdy brak `JWT_SECRET`. Guard „BE+FE" **nietknięty** (decyzja użytkownika).
- `docs/deploy-setup.md` — krok 4a: utworzenie pliku z `JWT_SECRET` na VPS; wzmianka w kontrakcie z aplikacją.
- `.nvmrc` — `24` → `20` (zgodność z CI i VPS).

## Odstępstwa od planu

Brak. Zrealizowano wszystkie 6 kroków planu w zaplanowanym kształcie. Dwa uzupełnienia
mieszczące się w zakresie:

- `npm run seed:dev` — plan wymieniał go jako wariant opcji C w pytaniu o seed; dodany, bo bez
  konta lokalnego sesja 1b nie miałaby jak kliknąć logowania.
- `test/gate.harness.test.ts` (12 testów samego harnessu) — nie było wprost w planie, ale harness
  będzie obsługiwał 11 kolejnych iteracji, więc jego porównywarka kształtu musi być sprawdzona.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.**
  - **Fixtures:** `contract/fixtures/GET_me.json` — kształt odpowiedzi `GET /api/me` zgodny **1:1**
    (dokładnie 5 kluczy `id, email, imieNazwisko, iat, exp`, zgodne typy, zero pól nadmiarowych,
    zero ostrzeżeń o `null`). Dodatkowo niezmiennik `exp - iat = 2592000` (30 dni) sprawdzony
    i po stronie fixture'a, i po stronie odpowiedzi.
  - **Kontrakt:** `POST /api/login` (200, 400), `POST /api/logout` (200), `GET /api/me` (200) —
    ścieżki i metody istnieją w `contract/openapi.yaml`, zwrócone kody są tam zadeklarowane,
    odpowiedzi są JSON-em.
  - **Weryfikacja, że GATE ma zęby:** celowo dodano nadmiarowe pole do odpowiedzi `/api/me` →
    GATE padł z komunikatem `$.dodatkowePole: klucz nadmiarowy — nie ma go w fixture`.
    Zmianę cofnięto. GATE nie jest wydmuszką.
- **Unit + integracyjne: ✓ 64/64** (8 plików) — bez mocków bazy: każdy test dostaje prawdziwy
  SQLite zbudowany z `001_schema.sql` w katalogu tymczasowym; HTTP przez supertest (żaden port
  nie jest zajmowany, więc bezpiecznie przy równoległej pracy).
  - `auth.gate.test.ts` (6) — GATE
  - `auth.login.test.ts` (10) — 400/401/200, cookie, `ostatnie_logowanie`, brak wycieku hasha, dokładne dopasowanie e-maila, odporność na nie-stringowe pola
  - `auth.me-logout.test.ts` (11) — 401 (brak/obcy sekret/wygasły/śmieci), 200 przez Bearer i przez cookie, pierwszeństwo Bearer, surowy payload JWT, czyszczenie cookie, bezstanowość JWT po wylogowaniu
  - `auth.bcrypt-kompatybilnosc.test.ts` (5) — format `$2b$10$`, zgodność ze snapshotem produkcji, obsługa `$2a$`
  - `db.migracje.test.ts` (4) — 26 tabel / 13 indeksów, tryb WAL, idempotencja (drugi przebieg nie rusza danych), kolumny `users`
  - `config.env.test.ts` (8) — fail-fast bez `JWT_SECRET` (strażnik odstępstwa O2), domyślne HOST/PORT, `cookieSecure`, `CORS_ORIGINS`
  - `app.cors-i-bledy.test.ts` (6) — CORS wyłączony domyślnie, allowlista, 404/400 w JSON, brak `X-Powered-By`
  - `gate.harness.test.ts` (14) — porównywarka kształtu i indeks kontraktu
- **E2E: pominięte** — brak frontendu do sesji 1b. W zamian wykonany **ręczny smoke test na
  prawdziwym, nasłuchującym serwerze** (`node dist/server.js`, port 5199): health, 401 bez tokenu,
  400 bez pól, 401 złe hasło, 200 login z `Set-Cookie`, `/api/me` przez Bearer i przez cookie,
  logout czyszczący cookie, zapis `ostatnie_logowanie` w bazie — wszystko zgodne.
- **Pipeline jak w CI:** z czystego `npm ci` → `lint` ✓, `typecheck` ✓, `test` ✓ (64), `build` ✓
  (`dist/server.js` + `dist/schema/001_schema.sql`), `npm run migrate` ✓ (idempotentny przy drugim przebiegu).

## Rozjazdy kontrakt ↔ produkcja (do świadomości, nie do „naprawy" w tym tickecie)

1. **`GET /api/me` ma `security: []` i kody 200/400 w `contract/openapi.yaml:754-761`, ale produkcja
   realnie zwraca 401 bez tokenu.** Inwentarz 2.3 klasyfikował trasę po tym, czy ma wpięty wspólny
   middleware `we`; oryginał chroni ją ręcznym `if (!req.user)` (`backend-index.cjs:48179-48183`).
   **Wzorcem jest produkcja** — odtwarzamy 401. Dla tej odpowiedzi świadomie nie wołamy walidacji
   kontraktu (bo kontrakt kodu 401 nie zna); test utrwala ten rozjazd asercją, więc odświeżenie
   kontraktu od razu tu zaświeci. To samo dotyczy 401 z `POST /api/login`.
2. **`contract/openapi.yaml` (wersja 2.3) nie zamraża schematów ciał** — request body to
   `{type: object}`, odpowiedzi mają tylko `description`. Walidacja „wg kontraktu" sprawdza więc
   ścieżkę, metodę, kod statusu i JSON-owatość; **kształt ciała weryfikują fixtures**. Opisane
   wprost w README i w komentarzu harnessu, żeby nikt nie czytał tego jako mocniejszej gwarancji.

## Breaking changes

Brak dla działającego systemu — produkcja nie jest dotykana, a `rebuild/` było puste.

Dwie zmiany wymagają **jednorazowej akcji na VPS przed pierwszym wdrożeniem backendu**:
1. **`JWT_SECRET` musi zostać ustawiony** w `~/private_apps/bridge-staging/.env` (instrukcja:
   `docs/deploy-setup.md`, krok 4a). Bez niego `deploy-staging.sh` przerwie deploy z komunikatem
   w logu (celowo — lepiej to niż crash-loop PM2).
2. `.nvmrc` zmienione z `24` na `20`. Nikt nie musi nic robić — to wyrównanie do stanu faktycznego
   CI i VPS.

## Follow-up (świadomie odłożone)

- **Sam backend nie zdeployuje się na staging.** `tools/deploy-staging.sh:36-39` wymaga
  jednocześnie `rebuild/backend/package.json` i `rebuild/frontend/package.json`. Po merge tej
  sesji `test.agritires.eu` zostaje na placeholderze — backend wjedzie razem z frontendem
  z **sesji 1b**. Decyzja użytkownika: nie ruszamy pipeline'u I0 dla połowy iteracji.
  DoD Iteracji 1 („Ania widzi `/login`") domyka się dopiero po 1b.
- **Rate-limiting / lockout logowania** — oryginał ich nie ma, więc ich nie dodajemy (wierność 1:1).
  Naturalne miejsce: Iteracja 12 (hardening bezpieczeństwa).
- **Wpis do `audit_log` przy logowaniu** — oryginał loguje tam tylko zmianę hasła. Do rozważenia
  w Iteracji 12.
- **Odświeżenie `contract/openapi.yaml`** o realne kody (401) i schematy ciał dla POST-ów —
  wymaga nagrania fixtures POST przeciwko kopii bazy (Faza 4 wg `contract/README.md`).
  Wzmocniłoby GATE dla wszystkich iteracji.
- **`drizzle-kit`** zostaje devDependency (potrzebny przy migracjach `002_*`); `npm audit` zgłasza
  dla niego ostrzeżenia dziedziczone po `esbuild` — dotyczą serwera deweloperskiego esbuilda,
  którego `drizzle-kit pull` nie uruchamia, i nic z tego nie trafia na release
  (`npm ci --omit=dev`). Odnotowane w README.
- **`src/repos/users.ts`** ma `pobierzUzytkownikaPoId` nieużywane w tej iteracji — świadomie
  zostawione, bo `POST /api/password/change` (Iteracja 12) tego potrzebuje i jest to
  jednolinijkowy odpowiednik istniejącej funkcji oryginału.
