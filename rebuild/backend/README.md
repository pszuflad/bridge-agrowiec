# Bridge — backend (odbudowa)

Nowy backend „Bridge dla Agrowca", budowany pionowymi plastrami wg
[`docs/rebuild-roadmap.md`](../../docs/rebuild-roadmap.md). Stan: **Iteracja 1a** —
fundament + logowanie (`POST /api/login`, `POST /api/logout`, `GET /api/me`).

**Zasada naczelna: odtwarzamy udokumentowane zachowanie 1:1, nie wymyślamy nowego.**
Wzorcem jest produkcja — `contract/fixtures/` i `contract/openapi.yaml`, a gdy milczą,
zdeminifikowany oryginał (`deminified/backend-index.cjs`). Każde odstępstwo jest świadomą,
zatwierdzoną decyzją i jest opisane w kodzie oraz w `docs/tickets/*/plan.md`.

## Stos

Node ≥ 20 (`.nvmrc`) · TypeScript (strict, ESM) · Express 4 · better-sqlite3 (WAL) ·
Drizzle ORM · Vitest + supertest · ESLint 9 (flat config).

## Szybki start (lokalnie)

```bash
nvm use                       # bierze wersję z .nvmrc (20)
npm ci
cp .env.example .env          # uzupełnij JWT_SECRET (patrz niżej)

npm run build                 # tsc -> dist/ + kopia rebuild/schema/*.sql do dist/schema/
npm run migrate               # tworzy/aktualizuje bazę z DB_PATH (idempotentnie)
npm run seed:dev -- mail@example.test haslo123 "Imię Nazwisko"   # konto do klikania
npm start                     # nasłuch na HOST:PORT
```

Podczas pracy nad kodem wygodniejsze jest `npm run dev` (tsx watch) i `npm run migrate:dev`
(migracje prosto ze źródeł, bez buildu).

Sprawdzenie, że żyje:

```bash
curl -s localhost:5001/api/health
curl -s -H 'Content-Type: application/json' \
     -d '{"email":"mail@example.test","password":"haslo123"}' \
     localhost:5001/api/login
```

## Zmienne środowiskowe

Wzór i opisy: [`.env.example`](.env.example).

| Zmienna | Wymagana | Domyślnie | Uwagi |
|---|---|---|---|
| `JWT_SECRET` | **tak** | — | Bez niej serwer **nie wstaje**. Świadome odejście od oryginału, który miał zahardkodowany fallback (`deminified/backend-index.cjs:47853`). |
| `DB_PATH` | **tak** | — | Plik bazy SQLite. Staging: `~/private_apps/bridge-staging/data/data-nowy.db`. |
| `HOST` | nie | `127.0.0.1` | Staging: `127.0.0.1` (za proxy Apache). |
| `PORT` | nie | `5001` | |
| `NODE_ENV` | nie | `development` | `production` włącza `Secure` na cookie sesji. |
| `CORS_ORIGINS` | nie | *(puste)* | Lista po przecinku. Puste = CORS wyłączony. Staging jest same-origin, więc zostaje puste. Dla lokalnego dev frontendu: `http://localhost:5173`. |
| `COOKIE_SECURE` | nie | wg `NODE_ENV` | Ręczne nadpisanie flagi `Secure`. |
| `MIGRATIONS_DIR` | nie | auto | Nadpisuje wykrywanie katalogu z `*.sql`. |

Na stagingu `JWT_SECRET` wczytywany jest z pliku **poza repo**
(`~/private_apps/bridge-staging/.env`) przez `tools/deploy-staging.sh` —
instrukcja w [`docs/deploy-setup.md`](../../docs/deploy-setup.md).

## Testy i GATE odbudowy

```bash
npm test          # cała bateria, w tym GATE
npm run lint
npm run typecheck
```

**GATE** (`test/auth.gate.test.ts` + harness `test/gate/`) to siatka bezpieczeństwa odbudowy.
Sprawdza dwie rzeczy:

1. **Fixtures** — kształt odpowiedzi (klucze, typy, zagnieżdżenie) zgadza się **1:1** z nagraną
   odpowiedzią żywego backendu z `contract/fixtures/`. W Iteracji 1a: `GET_me.json`.
2. **Kontrakt** — ścieżka, metoda i zwrócony kod statusu są zadeklarowane w `contract/openapi.yaml`,
   a odpowiedź jest JSON-em.

> ⚠ **Zakres walidacji kontraktu.** `openapi.yaml` (wersja 2.3) zamraża ścieżki, metody, `security`
> i kody odpowiedzi, ale **nie zawiera schematów ciał** (request body to `{type: object}`, odpowiedzi
> mają tylko `description`). Realne zęby GATE-u daje więc porównanie z fixtures — i tam kształt jest
> sprawdzany dokładnie. Nie udajemy, że walidujemy więcej, niż kontrakt opisuje.

**Rozjazd z fixture'em = STOP.** Nie „poprawiamy" fixture'a pod nowy kod — to on pokazuje, co
produkcja realnie zwraca. Rozjazd zgłaszamy człowiekowi.

Testy nie używają mocków bazy: każdy dostaje **prawdziwą bazę SQLite** zbudowaną z kanonicznego
`rebuild/schema/001_schema.sql` w katalogu tymczasowym. HTTP idzie przez supertest, więc **żaden
port nie jest zajmowany** — testy są bezpieczne przy równolegle działającej aplikacji.

### Dopisanie GATE-u w kolejnej iteracji

Harness jest generyczny — nowa iteracja dokłada tylko ścieżki i fixtures:

```ts
import request from "supertest";
import {
  sprawdzZgodnoscZFixture, sprawdzZgodnoscZKontraktem, stworzSrodowiskoTestowe, SEKRET_TESTOWY,
} from "./gate/index.js";
import { podpiszToken } from "../src/auth/jwt.js";

const s = await stworzSrodowiskoTestowe();
const token = podpiszToken(s.uzytkownik, SEKRET_TESTOWY);
const odp = await request(s.app).get("/api/products").set("Authorization", `Bearer ${token}`);

sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/products", odpowiedz: odp });
sprawdzZgodnoscZFixture("GET_products.json", odp.body);
```

## Struktura

```
src/
  server.ts            wejście produkcyjne (dist/server.js) — listen + graceful shutdown
  app.ts               fabryka aplikacji Express (bez listen — testowalna)
  config/env.ts        walidacja zmiennych środowiskowych (fail-fast)
  db/index.ts          better-sqlite3 (WAL) + Drizzle
  db/schema.ts         WYGENEROWANY przez drizzle-kit z 001_schema.sql
  db/migrate.ts        idempotentne stosowanie rebuild/schema/*.sql
  auth/                jwt · password (bcrypt) · cookie bridge_session
  middleware/          optionalAuth · requireAuth · cors · errors
  repos/users.ts       dostęp do tabeli users
  routes/auth.ts       login · logout · me
test/
  gate/                harness GATE — współdzielony przez wszystkie iteracje
  *.test.ts            testy iteracji
```

## Auth — co dokładnie odtwarzamy

| Element | Zachowanie | Oryginał |
|---|---|---|
| Token | JWT HS256, payload `{id, email, imieNazwisko}`, ważność **30 dni** | `backend-index.cjs:47856-47859` |
| Kanały | `Authorization: Bearer <token>` **albo** cookie `bridge_session` — równolegle, Bearer ma pierwszeństwo | `:47870-47881` |
| Cookie | `bridge_session`, `HttpOnly`, `Path=/`, `Max-Age=2592000` | `:47934-47938` |
| Hasła | bcrypt, koszt **10**, format `$2b$` | `:47928` |
| `POST /api/login` | brak pól → `400 {error:"Email i hasło są wymagane"}`; złe dane → `401 {error:"Nieprawidłowy email lub hasło"}`; sukces → `{ok, user, token}` + cookie, zapis `ostatnie_logowanie` | `:48156-48174` |
| `POST /api/logout` | czyści cookie, `{ok:true}`; token pozostaje ważny (JWT bezstanowy) | `:48175-48178` |
| `GET /api/me` | `401 {error:"Nieautoryzowany"}` bez tokenu; inaczej **surowy payload JWT** (`id,email,imieNazwisko,iat,exp`), **nie** rekord z bazy | `:48179-48183`, `contract/fixtures/GET_me.json` |

Świadomie zachowane, choć kusi „poprawienie": ten sam komunikat 401 dla nieznanego e-maila
i błędnego hasła, brak rate-limitingu/lockoutu, brak wpisu do `audit_log` przy logowaniu,
dokładne (bez `trim`/`lowercase`) dopasowanie e-maila. Wszystko to zachowanie produkcji.

### Świadome odstępstwa od oryginału (zatwierdzone)

| # | Oryginał | Tutaj | Dlaczego |
|---|---|---|---|
| O1 | 17 tras publicznych; `/api/me` chronione ręcznym `if` | `requireAuth` nakładany jawnie na trasy danych; publiczne tylko `/api/login`, `/api/logout`, `/api/health` | zasada bezpieczeństwa `rebuild-roadmap.md §3` |
| O2 | `JWT_SECRET \|\| "bridge-agrowiec-secret-2026"` | `JWT_SECRET` wymagany, bez fallbacku | ujawniony sekret = możliwość podrobienia dowolnego tokenu |
| O3 | CORS odbija każdy `Origin` + `Allow-Credentials: true` | CORS domyślnie wyłączony, opcjonalna allowlista z env | dowolna strona mogła czytać dane zalogowanego użytkownika |
| O4 | cookie zawsze `Secure; SameSite=None` | flagi sterowane env; `SameSite=Lax` | staging jest same-origin, `Lax` chroni przed CSRF; bez tego dev po HTTP nie zapisze cookie |
| O5 | token podpisywany dwa razy | jeden `sign()` | czysta redundancja, bez wpływu na kontrakt |
| O6 | logout czyścił cookie bez `Secure`/`SameSite` | te same atrybuty co przy ustawianiu | inaczej przeglądarka potrafi nie nadpisać cookie |

## Schemat Drizzle

`src/db/schema.ts` jest **wygenerowany** — nie edytuj go ręcznie poza sekcją dopieszczeń
na dole pliku. Źródłem prawdy o strukturze jest `rebuild/schema/001_schema.sql`
(patrz [`rebuild/schema/README.md`](../schema/README.md)).

Regeneracja po dodaniu migracji `002_*.sql`:

```bash
mkdir -p .tmp && rm -f .tmp/introspect.db
node -e "const D=require('better-sqlite3'),f=require('fs');const d=new D('.tmp/introspect.db');
         for (const p of f.readdirSync('../schema').filter(x=>x.endsWith('.sql')).sort())
           d.exec(f.readFileSync('../schema/'+p,'utf8'));"
DB_PATH=./.tmp/introspect.db npx drizzle-kit pull
# skopiuj .drizzle/schema.ts do src/db/schema.ts i nanieś ponownie dopieszczenia
```

`drizzle-kit` jest zależnością **wyłącznie deweloperską** (release na VPS instaluje się
przez `npm ci --omit=dev`). `npm audit` zgłasza dla niego ostrzeżenia dziedziczone po
`esbuild` — dotyczą serwera deweloperskiego esbuilda, którego `drizzle-kit pull` nigdy nie
uruchamia, i nic z tego nie trafia na produkcję.

## Wdrożenie (staging)

CD jest pull-based: cron na VPS uruchamia `tools/deploy-staging.sh`, który buduje `rebuild/`,
stosuje migracje na `data-nowy.db`, atomowo podmienia release (symlink `current`) i robi
`pm2 reload`. Kontrakt, który spełnia ten pakiet: `npm ci && npm run build` → `dist/`,
wejście `dist/server.js`, `HOST`/`PORT`/`DB_PATH` z env, `npm run migrate` idempotentne.

> **Uwaga: sam backend jeszcze się nie zdeployuje.** `tools/deploy-staging.sh` pomija build,
> dopóki nie istnieją **jednocześnie** `rebuild/backend/package.json` **i**
> `rebuild/frontend/package.json`. Po zmergowaniu Iteracji 1a staging zostaje na placeholderze —
> backend wjedzie na `test.agritires.eu` razem z frontendem z **sesji 1b**. To świadoma decyzja
> (nie ruszamy działającego pipeline'u I0 dla połowy iteracji).
