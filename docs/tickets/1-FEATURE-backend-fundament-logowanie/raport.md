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

---

## Review fixes applied

Code review: **0 BLOCKER**, 3 SHOULD-FIX, 3 NICE-TO-HAVE
(`docs/tickets/1-FEATURE-backend-fundament-logowanie/review.md`). Naprawione wszystkie sześć —
żadnej nie zostawiono jako follow-up, bo cztery z nich dotyczyły wierności oryginałowi, a to
główne kryterium tego ticketa.

**Najważniejsze: trzy ciche odejścia od oryginału, których nie było w tabeli odstępstw.**
Reviewer je wyłapał, ja potwierdziłem w `deminified/backend-index.cjs:48926-48940` i przywróciłem
wierność, zamiast dopisywać odstępstwo:

- `src/app.ts` — **limit ciała żądania podniesiony z 5 MB z powrotem do 50 MB** (oryginał:
  `:48932`, `:48939`). To była realna pułapka na przyszłość: import z Iteracji 3 przesyła duże
  pakiety danych i cicho obcięty limit objawiłby się dopiero tam, jako trudny do zdiagnozowania
  błąd. Dołożony też `express.urlencoded({extended:false, limit:"50mb"})`, którego oryginał używa.
- `src/app.ts` — **kolejność middleware wyrównana do oryginału**: CORS przed parserami ciała
  (było odwrotnie), żeby preflight `OPTIONS` nie przechodził przez parser JSON-a.
- `src/middleware/cors.ts` — **komplet nagłówków jak w oryginale** (`:48928`):
  `Access-Control-Expose-Headers: Set-Cookie` i `Cookie` w `Allow-Headers`. Różnica względem
  produkcji zostaje wyłącznie ta zatwierdzona: *które* originy je dostają (allowlista zamiast
  odbijania każdego).

**Poprawka poprawności:**
- `src/middleware/errors.ts` — handler błędów maskował jako `500` każdy status 4xx inny niż `400`.
  W praktyce oznaczało to, że przekroczenie limitu ciała (`PayloadTooLargeError`, status 413)
  wracało do klienta jako błąd serwera i śmieciło w logach. Teraz każdy status 4xx wraca ze swoim
  kodem. Dołożony test jednostkowy handlera (`test/middleware.bledy.test.ts`, 4 przypadki:
  413, 400, 500 bez wycieku treści błędu, delegacja przy już wysłanych nagłówkach).

**Uzupełnienie dokumentacji (odstępstwo O7):**
- `POST /api/login` odrzuca nie-stringowe `email`/`password` kodem `400`, podczas gdy oryginał
  próbował związać taką wartość w zapytaniu SQLite i kończył wyjątkiem → `500`. Kod tak działał
  od początku (jest na to test), ale nie było tego w tabeli odstępstw. Dopisane jako **O7**
  w `plan.md` i w README backendu.

**Nowe testy:** `test/middleware.bledy.test.ts` (4) + asercje na nagłówki CORS i na parser
`urlencoded` w `test/app.cors-i-bledy.test.ts` (2). Łącznie **69 testów w 9 plikach**, wszystkie
zielone; `lint`, `typecheck`, `build`, `migrate` bez zmian — zielone.

**Nie zmieniono** (świadomie): `pobierzUzytkownikaPoId` zostaje nieużywane do Iteracji 12 —
reviewer zgłosił to tylko jako przypomnienie, żeby nie zniknęło przy sprzątaniu lintera.

---

## Docs updates

Pięć doc-checkerów sprawdziło 15 plików dokumentacji równolegle. Zaktualizowano 6, sześć
świadomie zostawiono bez zmian (z uzasadnieniem), reszta bez uwag.

### `docs/rebuild-roadmap.md` — powierzchnia kontrolna odbudowy (7 edycji)
- **§4 Tablica postępu** — Iteracja 1: ⬜ → 🔨 (**nie** ✅ — 1b jeszcze nie zrobione), w kolumnie
  PR/data notatka „1a (backend) zrobione, 1b (frontend) jeszcze nie zaczęte".
- **§5 Iteracja 1** — zakres backendu przepisany z planowanego na faktycznie zrealizowany;
  frontend oznaczony jako nie zaczęty; odesłanie do ticketa po szczegóły odstępstw O1–O7.
  Do DoD dopisana **krytyczna uwaga**: `deploy-staging.sh:36-39` pomija build, dopóki nie ma
  obu `package.json`, więc punkt „Ania widzi `/login`" domyka się dopiero po 1b.
- **§3 Zasady przekrojowe** — wiersz „Stack BE / decyzje szkieletu" ⬜ → ✅ (TypeScript + Vitest
  + drizzle-kit introspect + layout `rebuild/backend/`); wiersz „Bezpieczeństwo" ⬜ → ✅ (auth na
  trasach danych, CORS zamknięty z allowlistą, `JWT_SECRET` bez fallbacku).
- **§2 Źródła prawdy** — dopisany `rebuild/backend/test/gate/` jako narzędzie GATE dla kolejnych
  iteracji + notka o rozjeździe kontrakt ↔ produkcja przy `GET /api/me`.
- **§1a Środowiska** — `deploy-staging.sh` wczytuje `$STAGING_ROOT/.env` przed buildem;
  `JWT_SECRET` wymagany (fail-fast).

### `contract/README.md` (3 edycje)
- Wskazany istniejący harness GATE (`rebuild/backend/test/gate/`), żeby kolejne iteracje nie
  budowały go drugi raz.
- **Dopisane ograniczenie kontraktu:** `openapi.yaml` (2.3) nie zamraża schematów ciał —
  walidacja sprawdza ścieżkę/metodę/kod/JSON-owatość, kształt ciała weryfikują wyłącznie fixtures.
- Dopisany rozjazd: `GET /api/me` ma `security: []` i kody 200/400, a produkcja realnie zwraca 401.

### `rebuild/schema/README.md` (2 edycje)
- Sekcja o Drizzle przepisana z czasu przyszłego na dokonany: `src/db/schema.ts` już istnieje
  (26 tabel, 269 kolumn, 13 indeksów), z dopieszczeniem `.unique()` na `users.email`; procedura
  regeneracji odesłana do README backendu zamiast duplikowana.
- Dopisane, że mechanizm migracji przyrostowych już działa (`npm run migrate`, tabela `_migracje`).

### `docs/deploy-setup.md` (3 edycje, ponad zmiany naniesione wcześniej w tym tickecie)
- „Kontrakt z aplikacją (musi spełnić Iteracja 1)" → „(spełniony przez Iterację 1a — backend)”.
- Doprecyzowany **prawdziwy powód**, dla którego staging nadal stoi na placeholderze: skrypt
  wymaga jednocześnie obu `package.json`, a frontendu jeszcze nie ma.

### `docs/spec-backend.md` (3 dopiski) i `docs/spec-frontend.md` (1 dopisek)
Krótkie, wyraźnie oznaczone adnotacje „**Odbudowa (I1a)**" przy opisach stanu zastanego —
bez zmieniania samego opisu produkcji: `requireAuth` na trasach danych, CORS domyślnie wyłączony,
`JWT_SECRET` bez fallbacku, cookie z flagami sterowanymi środowiskiem. W spec-frontend odnotowane
osobno, że **backend nie robi `trim()`** na e-mailu — dopasowanie jest dokładne, `.trim()` musi
zostać po stronie frontendu w sesji 1b.

### `docs/audit-2026-07-22.md` (2 adnotacje)
Dokument historyczny — opis stanu zastanego nietknięty. Dopisane tylko dwie adnotacje
„**Stan w odbudowie (I1a, 2026-08-24)**" przy punktach o zahardkodowanym `JWT_SECRET` i o CORS-ie
odbijającym każdy Origin. Doc-checker świadomie **nie** dopisał adnotacji o rate-limitingu ani
o `audit_log`, bo audyt ich nie zgłasza, a te rzeczy są w odbudowie odtworzone 1:1.

### Bez zmian (uzasadnione)
- `START.md`, `docs/plan.md` — dokumenty bootstrapowe/architektoniczne z 2026-07-24, sprzed procesu
  iteracyjnego; nie zawierają twierdzeń o stanie `rebuild/`, którym ta iteracja przeczy.
- `docs/rebuild-backlog.md` — żaden z trzech wpisów nie dotyczy auth/users/bezpieczeństwa
  (potwierdzenie ustalenia z fazy researchu).
- `docs/audit-delta.md` — opisuje deltę **produkcji**, nie dotyka `rebuild/`. Wzmianka
  o `JWT_SECRET` z fallbackiem dotyczy produkcji i nadal jest prawdziwa.
- `docs/vps-syncer-setup.md` — syncer zmian produkcji, niezależny od tej iteracji.

### Pre-existing issues zgłoszone przez doc-checkery
Brak. Żaden nie znalazł zastanych nieścisłości poza tymi, które ten ticket sam opisuje
(rozjazd `GET /api/me` `security: []` vs realne 401).
