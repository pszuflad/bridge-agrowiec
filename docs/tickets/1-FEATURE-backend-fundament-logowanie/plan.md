# 1-FEATURE-backend-fundament-logowanie — Iteracja 1a: fundament backendu + logowanie

> Status: Draft
> Branch: `feature/1-backend-fundament-logowanie`
> Worktree: `.worktrees/1-FEATURE-backend-fundament-logowanie`

## Opis ticketa

Iteracja 1, sesja 1a (BACKEND) wg `docs/rebuild-roadmap.md` (§5 „Iteracja 1" + §1a środowiska
+ §3 zasady przekrojowe). Pierwsza iteracja właściwej odbudowy — kładzie szkielet backendu,
na którym staną wszystkie kolejne. Frontend (1b) to OSOBNA sesja po merge'u tej.

Zakres (tylko backend):
- Szkielet Node + Express + Drizzle + better-sqlite3 (WAL) na schemacie `rebuild/schema/001_schema.sql`.
- Auth: `POST /api/login`, `POST /api/logout`, `GET /api/me` — wiernie wg `docs/spec-frontend.md §5`,
  `contract/openapi.yaml` i `contract/fixtures/GET_me.json`.
- Middleware auth wymagany na trasach danych OD STARTU (świadome odejście od publicznych tras
  oryginału — zasada bezpieczeństwa §3).
- Harness GATE (współdzielony przez kolejne iteracje): ładuje `contract/fixtures/`, waliduje
  odpowiedzi wg `contract/openapi.yaml`; baza testowa świeża z `001_schema.sql`.
- README `rebuild/backend/`.

Kontrakt deployu (musi pasować do `tools/deploy-staging.sh`): `npm ci && npm run build` → `dist/`,
wejście `dist/server.js`; `process.env.HOST:process.env.PORT` (staging `127.0.0.1:5001`),
baza z `process.env.DB_PATH`; `npm run migrate` idempotentnie; `npm test` odpala GATE.

## Kontekst

`rebuild/` jest dziś praktycznie puste (`.gitkeep` + `schema/001_schema.sql` + `schema/README.md`) —
to pierwszy kod backendu w nowym stosie. Pipeline z I0 już stoi: CI (`.github/workflows/ci.yml`)
wykrywa `rebuild/backend/package.json` i odpala `npm ci / lint / typecheck / test / build`;
CD (`tools/deploy-staging.sh`) buduje i podmienia release na VPS.

Zachowanie do odtworzenia ustalone w oryginale (`deminified/backend-index.cjs`), potwierdzone
cytatami:

| Element | Ustalenie | Źródło |
|---|---|---|
| JWT | `jsonwebtoken.sign(payload, secret, {expiresIn:"30d"})`, payload `{id,email,imieNazwisko}` | `backend-index.cjs:47856-47859` |
| Sekret | `process.env.JWT_SECRET \|\| "bridge-agrowiec-secret-2026"` (zahardkodowany fallback) | `:47853` |
| Token z żądania | `Authorization: Bearer <t>` **albo** cookie `bridge_session` | `iV`/`nV` `:47870-47881` |
| Middleware opcjonalny | `C4` — globalne `e.use(C4)`, ustawia `req.user` gdy token ważny | `:47883-47890`, `:48156` |
| Gate auth | `we` → `401 {error:"Nieautoryzowany"}` gdy brak `req.user` | `:47892-47897` |
| `POST /api/login` | brak email/hasła → `400 {error:"Email i hasło są wymagane"}`; złe dane → `401 {error:"Nieprawidłowy email lub hasło"}` (jeden komunikat dla obu przypadków); sukces → cookie + `{ok:true,user:{id,email,imieNazwisko},token}` | `:48156-48174` |
| Weryfikacja hasła | `bcrypt.compare(password, user.hasloHash)`; przy sukcesie `updateUserLogin(id)` → `ostatnie_logowanie = new Date().toISOString()` | `j4` `:47898-47904`, `:45060-45063` |
| Wyszukanie usera | `where eq(users.email, email)` — **dokładne dopasowanie, bez trim/lowercase po stronie BE** (trim robi frontend) | `:45052-45054`, `spec-frontend.md §5` |
| Hash haseł | `bcryptjs`, cost **10** (`hash(n,10)`); snapshot produkcji ma `$2b$10$...` | `:47928`, `db/snapshot.db` |
| Cookie | `bridge_session`, `Path=/`, `HttpOnly`, `Max-Age=2592000`, `SameSite=None`, `Secure` (flaga `i=true` zahardkodowana) | `R4` `:47934-47938` |
| `POST /api/logout` | czyści cookie (`Max-Age=0`) i zwraca `{ok:true}`; brak invalidacji tokenu (JWT bezstanowy) | `:48175-48178`, `z4` `:47940-47942` |
| `GET /api/me` | **nie używa `we`** — ręczne `if(!req.user)` → `401`, inaczej `res.json(req.user)` = **surowy zdekodowany payload JWT** (`id,email,imieNazwisko,iat,exp`), NIE rekord z bazy | `:48179-48183` |
| Rate-limit / lockout / audit-log przy loginie | **brak** w oryginale | `:48156-48174` |
| CORS | globalny middleware odbija dowolny `Origin` + `Allow-Credentials: true` | `:48926-48930` |

Tabela `users` (`rebuild/schema/001_schema.sql:186-193`): `id INTEGER PK AUTOINCREMENT`,
`email TEXT NOT NULL UNIQUE`, `haslo_hash TEXT NOT NULL`, `imie_nazwisko TEXT NOT NULL`,
`utworzono TEXT NOT NULL`, `ostatnie_logowanie TEXT`. **Brak tabeli sesji/tokenów** — auth
w pełni bezstanowy. Konwencja: baza snake_case → API camelCase (`imieNazwisko`), potwierdzona
w `contract/fixtures/GET_users.json` i `GET_audit-log.json`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ścieżki `contract/openapi.yaml`, które ten ticket musi spełnić:**

| Operacja | Linie | `security` w kontrakcie | Kody odpowiedzi |
|---|---|---|---|
| `POST /api/login` | `openapi.yaml:675-685` | `[]` (publiczne) | 200, 400 |
| `POST /api/logout` | `openapi.yaml:686-696` | `[]` (publiczne) | 200, 400 |
| `GET /api/me` | `openapi.yaml:754-761` | `[]` (publiczne) | 200, 400 |

**Fixtures:** `contract/fixtures/GET_me.json` — jedyny fixture w zakresie
(POST-y świadomie nie zostały nagrane w Kroku 2.4, bo modyfikowałyby produkcję).
Wymagany kształt odpowiedzi `GET /api/me` (200):

```json
{ "id": 1, "email": "…", "imieNazwisko": "…", "iat": 1786982455, "exp": 1789574455 }
```

Dokładnie 5 kluczy, typy `number/string/string/number/number`, `exp - iat = 2592000` (30 dni).

**⚠ Ograniczenie kontraktu (odnotowane jawnie):** `openapi.yaml` (2.3) zamraża **ścieżki, metody,
`security` i kody odpowiedzi**, ale **nie zawiera schematów ciał** — request body to `{type: object}`,
a odpowiedzi mają tylko `description`. Walidacja „wg openapi" w GATE może więc sprawdzić:
istnienie ścieżki+metody, zadeklarowany kod statusu, JSON-owatość odpowiedzi i zgodność z `security`.
**Realne zęby GATE-u daje porównanie z fixtures** — i tam kształt jest sprawdzany 1:1.
To nie jest obejście gate'u, tylko rzetelny opis tego, co kontrakt w tej wersji faktycznie zamraża.

**Rozjazdy i jak je rozstrzygamy:**

1. **`GET /api/me` ma `security: []` w kontrakcie, ale realnie wymaga tokenu.** Oryginał zwraca
   `401` bez tokenu — po prostu sprawdza `req.user` ręcznie, zamiast przez middleware `we`,
   więc inwentarz 2.3 zaklasyfikował go jako „publiczny". **Wzorzec = zachowanie produkcji:**
   endpoint wymaga auth. Zgodne też z zasadą §3 i z decyzją użytkownika. Fixture (200) i tak
   zakłada zalogowanego użytkownika.
2. **`POST /api/login` i `POST /api/logout` — `security: []` jest poprawne** i zostaje: to jedyne
   trasy, które muszą być publiczne (inaczej nikt się nie zaloguje).
3. **Brak fixtures dla POST-ów** — kształt odpowiedzi `/api/login` bierzemy z oryginału
   (`:48170-48174`) i ze `spec-frontend.md §5` (frontend oczekuje `{ok,user,token}`); oba źródła
   są zgodne, więc rozjazdu nie ma.
4. **Node: CI `20` vs `.nvmrc` `24` vs komentarz w `deploy-staging.sh` „build wymaga node 20"** —
   rozstrzygnięte decyzją użytkownika na **20** (patrz Decyzje).

## Decyzje

Wszystkie podjęte przez użytkownika w fazie pytań (2026-08-24).

**Szkielet:**
1. **TypeScript** (strict) — spójne z resztą stosu, typy chronią przy 26 tabelach.
2. **Vitest** — runner testów; GATE będzie rósł przez 12 iteracji, DX ma znaczenie.
3. **Drizzle `schema.ts` przez `drizzle-kit introspect`** z bazy zbudowanej z `001_schema.sql`,
   potem ręczne dopieszczenie. Wprost zalecane w `rebuild/schema/README.md` („nie pisz `schema.ts`
   ręcznie" — 26 tabel, `products` 72 kolumny).
4. **Layout `rebuild/backend/`** (później `rebuild/frontend/`, ewentualnie `rebuild/shared/`).
5. **Node 20** — ujednolicamy `.nvmrc` (dziś `24`) do CI i VPS; `engines: >=20`.
   Alternatywa (podniesienie wszystkiego do 24) wymagałaby instalacji node 24 na VPS — poza
   zakresem ticketa, a błąd ubija CD.

**Świadome odstępstwa od oryginału (każde zatwierdzone przez użytkownika):**

| # | Oryginał | Nowy backend | Uzasadnienie |
|---|---|---|---|
| O1 | 17 tras publicznych; `/api/me` chroniony tylko ręcznym `if` | **auth wymagany na wszystkich trasach danych**; `requireAuth` nałożony jawnie, publiczne zostają tylko `/api/login`, `/api/logout` (i `/api/health`) | zasada §3 „naprawić bezpieczeństwo od I1"; potwierdzone przez użytkownika |
| O2 | `JWT_SECRET \|\| "bridge-agrowiec-secret-2026"` | **`JWT_SECRET` wymagany z env, bez fallbacku** — serwer nie wstaje bez niego (fail-fast) | ujawniony sekret pozwala podrobić dowolny token; `spec-backend.md §6` flaguje to jako lukę; Iteracja 12 i tak tego wymaga |
| O3 | CORS odbija każdy `Origin` + `Allow-Credentials: true` | **domyślnie brak CORS-a** (staging jest same-origin przez proxy Apache), opcjonalna allowlista z `CORS_ORIGINS` dla lokalnego dev FE | „odbij każdy Origin + credentials" to realna luka (dowolna strona może czytać dane zalogowanego użytkownika) |
| O4 | cookie zawsze `Secure; SameSite=None` (zahardkodowane) | **flagi sterowane env**: produkcja/staging `Secure; SameSite=Lax`, dev/test po HTTP bez `Secure`; `HttpOnly`, `Path=/`, `Max-Age=2592000` **bez zmian** | staging jest same-origin, więc `None` jest niepotrzebne, a `Lax` daje ochronę CSRF; bez tego lokalny dev w 1b nie zapisze cookie po HTTP |
| O5 | `POST /api/login` podpisuje token **dwa razy** (raz w `R4` do cookie, raz do body) | **jeden `sign()`**, ten sam token w cookie i w body | czysta redundancja oryginału; oba tokeny były funkcjonalnie identyczne — brak wpływu na kontrakt |
| O6 | `logout` czyści cookie bez `Secure`/`SameSite` | czyszczenie **tymi samymi atrybutami**, którymi cookie było ustawione | inaczej przeglądarki potrafią nie nadpisać cookie ustawionego z `SameSite`/`Secure` |
| O7 | `POST /api/login` sprawdza tylko `if (!email || !password)`; przy nie-stringowym, prawdziwym polu (np. `{"email":{"a":1}}`) oryginał próbował związać obiekt w zapytaniu SQLite i kończył wyjątkiem → 500 | jawne sprawdzenie `typeof` → `400 {error:"Email i hasło są wymagane"}` | ścieżka błędna w oryginale (500 zamiast 400) i trywialna do wywrócenia z zewnątrz; ten sam komunikat i ten sam kod co pozostałe błędne żądania — bez wpływu na poprawny przepływ logowania |

> O7 dopisane po code review (2026-08-24) — kod już tak działał, brakowało wpisu w tabeli.
> Przy tej samej okazji przywrócono wierność w trzech miejscach, w których kod odbiegał od
> oryginału bez decyzji: limit ciała żądania **50 MB** (było 5 MB), kolejność middleware
> (CORS przed parserami) i komplet nagłówków CORS (`Expose-Headers: Set-Cookie`,
> `Cookie` w `Allow-Headers`).

**Odtwarzane wiernie 1:1 (świadomie, mimo że można by „ulepszyć"):**
- `GET /api/me` zwraca **surowy payload JWT** (`id,email,imieNazwisko,iat,exp`), nie świeży rekord
  z bazy — tak działa produkcja i tego oczekuje fixture. Konsekwencja: dane użytkownika mogą być
  nieaktualne aż do wygaśnięcia tokenu (30 dni). Potwierdzone przez użytkownika.
- Komunikaty błędów **verbatim po polsku**: `"Email i hasło są wymagane"` (400),
  `"Nieprawidłowy email lub hasło"` (401), `"Nieautoryzowany"` (401).
- Jeden komunikat dla „nieznany email" i „złe hasło" (oryginał nie rozróżnia).
- **Brak rate-limitingu/lockoutu** i **brak wpisu do `audit_log` przy logowaniu** — oryginał ich
  nie ma; dokładanie ich byłoby wymyślaniem. Do rozważenia w Iteracji 12 (hardening) → Follow-up.
- TTL tokenu 30 dni, nazwa cookie `bridge_session`, `Max-Age=2592000`.
- bcrypt cost **10** i format `$2b$` — **wymóg twardy**: staging używa snapshotu produkcji
  (`db/snapshot.db`) z realnymi hashami `$2b$10$...`, więc konta Ani muszą się logować tym samym
  hasłem. Dlatego **nie** argon2/scrypt.
- Email dopasowywany dokładnie (bez `trim`/`lowercase` po stronie backendu) — `trim` robi frontend.

**Seed testowy:** baza GATE jest świeża z `001_schema.sql` + osobny **seed testowy** (1 użytkownik,
znane hasło, hash bcrypt cost 10 liczony w setupie). `001_schema.sql` zostaje czystym punktem
zerowym bez danych. Dzięki temu GATE testuje pełną ścieżkę `login → me → logout`, łącznie
z `bcrypt.compare`.

**Deploy 1a:** `tools/deploy-staging.sh:36-39` pomija build, dopóki nie ma **jednocześnie**
`rebuild/backend/package.json` **i** `rebuild/frontend/package.json`. Decyzja: **nie ruszamy
skryptu I0** — po merge 1a staging zostaje na placeholderze, backend wjedzie razem z frontendem
po sesji 1b. Odnotowane w README, raporcie i PR, żeby brak deployu nie był zaskoczeniem.

**JWT_SECRET na VPS:** deploy eksportuje dziś tylko `PORT/HOST/NODE_ENV/DB_PATH`
(`deploy-staging.sh:26`). Dokładam w `deploy-staging.sh` **wczytanie pliku env spoza repo**
(`$STAGING_ROOT/.env`, jeśli istnieje) i opis kroku w `docs/deploy-setup.md`. Sekret nigdy nie
trafia do repo. To jedyna zmiana w skrypcie I0 (nie dotyka guardu ani logiki buildu).

## Plan implementacji

### Krok 1 — szkielet projektu i kontrakt deployu
`rebuild/backend/`: `package.json` (scripts: `build`, `start`, `dev`, `migrate`, `test`, `lint`,
`typecheck`; `engines.node >=20`), `tsconfig.json` (strict, `outDir: dist`), flat config ESLint,
`vitest.config.ts`, `.env.example`, `.gitignore`. Zależności: `express`, `better-sqlite3`,
`drizzle-orm`, `jsonwebtoken`, `bcryptjs`, `zod` (walidacja env); dev: `typescript`, `tsx`,
`vitest`, `supertest`, `drizzle-kit`, `js-yaml`, `eslint`, `@types/*`.
`.nvmrc` (repo root) `24` → `20`.

### Krok 2 — warstwa danych + migracje
- `src/config/env.ts` — parsowanie i walidacja env (`HOST`, `PORT`, `DB_PATH`, `JWT_SECRET` **wymagany**,
  `NODE_ENV`, `CORS_ORIGINS`, `COOKIE_SECURE`). Fail-fast z czytelnym komunikatem.
- `src/db/index.ts` — `better-sqlite3` + `PRAGMA journal_mode = WAL` + `foreign_keys` + Drizzle.
- `src/db/schema.ts` — **wygenerowany** `drizzle-kit introspect` z bazy tymczasowej zbudowanej
  z `rebuild/schema/001_schema.sql`, potem ręcznie dopieszczony (nazwy w camelCase po stronie TS,
  kolumny snake_case w bazie — zgodnie z konwencją API).
- `src/db/migrate.ts` + `npm run migrate` — stosuje `rebuild/schema/*.sql` po kolei, zapisuje
  zastosowane pliki w tabeli `_migracje`; idempotentne (`001` i tak ma `IF NOT EXISTS`).
  Katalog schematu: `MIGRATIONS_DIR` → `dist/schema/` → `../schema/` (build kopiuje `*.sql` do
  `dist/schema/`, żeby release na VPS był samowystarczalny).

### Krok 3 — auth (odtworzenie zachowania z tabeli w „Kontekst")
- `src/auth/jwt.ts` — `podpiszToken(payload)` / `zweryfikujToken(token)`, `expiresIn: "30d"`.
- `src/auth/password.ts` — `bcryptjs`, cost 10.
- `src/auth/cookie.ts` — `ustawCookieSesji` / `wyczyscCookieSesji`, nazwa `bridge_session`,
  flagi wg env (O4/O6).
- `src/middleware/auth.ts` — `optionalAuth` (odpowiednik `C4`, globalny) + `requireAuth`
  (odpowiednik `we`, `401 {error:"Nieautoryzowany"}`).
- `src/repos/users.ts` — `getUserByEmail`, `getUserById`, `updateUserLogin` (mapowanie
  snake_case → camelCase).
- `src/routes/auth.ts` — `POST /api/login`, `POST /api/logout`, `GET /api/me` (z `requireAuth`).
- `src/app.ts` — fabryka aplikacji (bez `listen`, testowalna): `express.json()`, `trust proxy`,
  opcjonalny CORS z allowlisty, `optionalAuth` globalnie, trasy, handler 404 i błędów.
- `src/server.ts` — wejście `dist/server.js`: `app.listen(env.PORT, env.HOST)`, graceful shutdown.
- `GET /api/health` — publiczny, bez danych (dla PM2/monitoringu); poza kontraktem, odnotowany.

### Krok 4 — harness GATE (współdzielony przez kolejne iteracje)
`test/gate/`:
- `kontrakt.ts` — ładuje `contract/openapi.yaml` (js-yaml), indeksuje operacje; `sprawdzKontrakt(metoda, sciezka, status, body)`:
  ścieżka+metoda istnieje, status zadeklarowany, odpowiedź jest JSON-em.
- `fixtures.ts` — ładuje `contract/fixtures/*.json`; `porownajKsztalt(actual, expected)`:
  rekurencyjne porównanie **kluczy, typów i zagnieżdżenia 1:1**; tablice — kształt elementów
  (fixtures przycięte do 5 elementów); czytelny komunikat z pełną ścieżką pola przy różnicy.
- `baza.ts` — świeża baza testowa z `001_schema.sql` w katalogu tymczasowym + seed testowy.
- `aplikacja.ts` — instancja `app` na bazie testowej + `supertest`.
- `repo.ts` — odnalezienie katalogu repo (chodzenie w górę do `contract/`), żeby harness działał
  z `rebuild/backend` i z CI.

Harness jest **generyczny** — kolejne iteracje dorzucają tylko listę ścieżek/fixtures.

### Krok 5 — testy
`test/`:
- `gate/auth.gate.test.ts` — `GET /api/me` (Bearer i cookie) vs `GET_me.json` (kształt 1:1 +
  `exp-iat=2592000`), kontrakt dla wszystkich 3 ścieżek.
- `auth.login.test.ts` — 400 bez pól, 401 zły email, 401 złe hasło (ten sam komunikat),
  200 `{ok,user,token}` + `Set-Cookie`, aktualizacja `ostatnie_logowanie`, brak wycieku `hasloHash`.
- `auth.me.test.ts` — 401 bez tokenu, 401 zły/wygasły token, 200 Bearer, 200 cookie, pierwszeństwo Bearer.
- `auth.logout.test.ts` — `{ok:true}` + `Set-Cookie` z `Max-Age=0`.
- `bcrypt.compat.test.ts` — hash w formacie `$2b$10$` weryfikuje się (zgodność ze snapshotem prod).
- `db/migrate.test.ts` — migracja na pustej bazie → 26 tabel; **druga migracja nie psuje danych** (idempotencja).
- `config/env.test.ts` — brak `JWT_SECRET` → czytelny błąd startu.

### Krok 6 — README + deploy env + docs
- `rebuild/backend/README.md` — uruchomienie lokalne, env, migracje, testy/GATE, kontrakt deployu,
  **notatka, że sam backend nie zdeployuje się przed 1b**.
- `tools/deploy-staging.sh` — wczytanie `$STAGING_ROOT/.env` (jeśli istnieje) przed buildem.
- `docs/deploy-setup.md` — krok „ustaw `JWT_SECRET` na VPS".
- `docs/rebuild-roadmap.md` — status Iteracji 1 (§4 i §5) po merge.

## Strategia testów

**GATE odbudowy (obowiązkowy — ticket dotyka API):**
1. **Fixtures** — `contract/fixtures/GET_me.json` porównany z odpowiedzią nowego `GET /api/me`:
   kształt (klucze, typy, zagnieżdżenie) **1:1**. Wartości `id/email/imieNazwisko` pochodzą
   z seeda testowego (fixture ma zsanityzowane dane produkcyjne), więc porównujemy **kształt +
   niezmienniki** (`exp-iat = 2592000`, typy). Zero różnic w zestawie kluczy.
2. **Kontrakt** — `POST /api/login`, `POST /api/logout`, `GET /api/me` istnieją w `openapi.yaml`
   pod właściwymi metodami; zwracane kody (200/400/401) są zadeklarowane; odpowiedzi to JSON.
   Ograniczenie zakresu walidacji opisane wyżej — kontrakt 2.3 nie zamraża schematów ciał.
3. **Rozbieżność = STOP** — fixtures nie tykamy; rozjazd zgłaszamy użytkownikowi.

**Testy jednostkowe/integracyjne** — bez mocków bazy: każdy test dostaje **realną bazę SQLite**
zbudowaną z kanonicznego `001_schema.sql` w katalogu tymczasowym (szybkie, prawdziwe, izolowane).
Bez mocków bcrypt i JWT — to prawdziwe biblioteki i to właśnie ich zachowanie chcemy sprawdzić.
Testy HTTP przez `supertest` na instancji `app` (bez zajmowania portu — brak ryzyka kolizji
z równolegle pracującymi agentami).

**Czego nie testujemy:** E2E z przeglądarką (brak frontendu do 1b); realnego zapisu cookie przez
przeglądarkę (sprawdzamy nagłówek `Set-Cookie`); deployu na VPS (nie da się lokalnie).

## Poza zakresem

- Frontend (sesja 1b) — React/Wouter/TanStack Query, `/login`, shell aplikacji.
- Pozostałe endpointy z kontraktu (products, staging, import, analytics…) — iteracje 2+.
- `POST /api/password/change`, `GET /api/users`, ekrany admin — Iteracja 12.
- Domknięcie auth na 17 publicznych trasach — zasada wchodzi teraz, ale same trasy powstają
  w kolejnych iteracjach; finalny audyt bezpieczeństwa w Iteracji 12.
- Rate-limiting/lockout logowania — oryginał ich nie ma; propozycja do Iteracji 12.
- Zmiana guardu w `tools/deploy-staging.sh` (decyzja: zostawiamy).

## Definition of done

- [ ] `rebuild/backend/` startuje: `npm ci && npm run build` → `dist/server.js`, nasłuch na `HOST:PORT`, baza z `DB_PATH`
- [ ] `npm run migrate` stosuje `001_schema.sql` idempotentnie (26 tabel; drugie uruchomienie bezpieczne)
- [ ] `POST /api/login` — 400/401/200 dokładnie jak oryginał, `{ok,user,token}` + cookie `bridge_session`
- [ ] `POST /api/logout` — `{ok:true}` + wyczyszczone cookie
- [ ] `GET /api/me` — 401 bez tokenu; 200 z surowym payloadem JWT, kształt 1:1 z `GET_me.json`
- [ ] Auth działa równolegle przez `Bearer` i cookie
- [ ] `requireAuth` gotowy do nakładania na trasy danych kolejnych iteracji
- [ ] GATE przechodzi: fixture `GET_me.json` + walidacja kontraktu dla 3 ścieżek
- [ ] Harness GATE generyczny — kolejna iteracja dokłada tylko ścieżki/fixtures
- [ ] `npm test`, `npm run lint`, `npm run typecheck` zielone; CI zielone
- [ ] `rebuild/backend/README.md` (uruchomienie, env, migracje, GATE, notatka o deployu po 1b)
- [ ] `JWT_SECRET` udokumentowany w `docs/deploy-setup.md` + wczytywany przez `deploy-staging.sh`
