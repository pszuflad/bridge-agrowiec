# Mapa odbudowy Bridge — roadmap iteracji (kontrolna)

Powierzchnia kontroli nad **wierną odbudową** „Bridge dla Agrowca" w nowym stosie
(`rebuild/`), realizowaną **pionowymi plastrami** (jedna funkcja end-to-end na iterację).
Ten plik jest źródłem prawdy o **kolejności, zakresie i stanie** prac. Każda nowa sesja
Claude Code otwiera go, bierze następny niezrobiony ticket i po skończeniu odznacza status.

> **Powiązane pliki:** `docs/rebuild-backlog.md` (zmiany Ani do naniesienia — decyzje TAK/NIE),
> `.claude/commands/feature.md` (komenda realizująca pojedynczy ticket end-to-end),
> `docs/triage-state.txt` (marker triażu produkcji).

---

## 0. Jak korzystać z tego pliku (każda nowa sesja)

1. Otwórz **§4 Tablica postępu** — znajdź pierwszy ticket ze statusem ⬜ (albo 🔨, jeśli ktoś
   go zaczął). Kolejność jest wiążąca — nie wyprzedzaj zależności z kolumny „Zależy od".
2. Przejdź do jego bloku w **§5** — masz tam dokładny zakres backendu, frontendu, ścieżki
   kontraktu, pliki fixtures (to jest GATE tej sesji) i Definition of done.
3. Przeczytaj **§3 Zasady przekrojowe** — obowiązują w KAŻDEJ iteracji.
4. Uruchom **`/feature`** z opisem tego ticketa (komenda sama pociągnie research po źródłach
   prawdy, plan, worktree, implementację, review, GATE fixtures/kontrakt, docs i PR).
5. Po zmergowaniu PR: **zmień status** ticketa w §4 i §5 na ✅, wpisz numer PR i datę.
6. Jeśli iteracja jest podzielona na sesję **BE** i **FE** — najpierw kończy się i merge'uje
   BE (endpointy muszą istnieć, żeby FE miało co wołać i żeby GATE był odtwarzalny), potem
   FE branchuje się z `develop` (już z BE) i robi widok.

**Zasada gałęzi:** producent (zmiany Ani) pisze do `main`; my pracujemy na `develop`. Każdy
ticket = własny worktree + branch z `origin/develop`, PR z powrotem do `develop`. Okresowo
`git merge main` do `develop`, żeby nadążać za produkcją.

---

## 1. Metodyka — pionowe plastry

- **1 iteracja = 1 funkcja przez cały stos.** Backend (parser/logika → zapis → endpoint)
  **+** frontend (ekran). Cel: rzecz, którą **Ania przeklika** i porówna ze swoją wersją.
- **Podział na sesje.** Mała iteracja = 1 sesja (BE+FE razem). Duża = 2+ sesje
  (osobno BE, osobno FE; ewentualnie kilka pod-ticketów jak w Iteracji 3).
- **Zamknięcie iteracji = GATE + człowiek.**
  1. **GATE automatyczny** (wpięty w `feature.md`, Krok 9): odpowiedzi nowego backendu
     zgodne z `contract/fixtures/` (kształt 1:1, wartości deterministyczne) i walidne wg
     `contract/openapi.yaml`. Rozjazd = STOP, nie „poprawiaj" fixtures.
  2. **Weryfikacja Ani:** klika ekran, potwierdza, że działa jak w oryginale.
- **Kolejność = zależności danych.** Najpierw „okno" (odczyt katalogu), potem „silnik"
  (import), który je zapełnia — żeby każdą kolejną rzecz było gdzie zobaczyć.
- **Wierność, nie wymyślanie.** Odtwarzamy udokumentowane zachowanie 1:1. Każde odstępstwo
  (naprawa buga, zmiana bezpieczeństwa, „lokalne→API") jest **świadomą decyzją** — patrz §3.

---

## 1a. Środowiska i wdrożenia (CI/CD)

Trzy środowiska — uwaga: **`main` NIE jest kodem do wdrażania**, tylko lustrem starej produkcji.

| Środowisko | Gałąź | Co to jest | Wdrażane |
|---|---|---|---|
| Stara PRODUKCJA | — | żywy panel Ani (agritires.eu), **nietknięty** | nie z tego repo |
| Lustro produkcji | `main` | producent zrzuca tu zmiany Ani | nie wdrażane |
| **STAGING (nowa wersja)** | `develop` | odbudowa `rebuild/` | **auto-deploy z `develop`** |
| PRODUKCJA (nowa) | `main` po cutoverze | dopiero na końcu odbudowy | później |

**Przepływ iteracji:**
`ticket → PR do develop → CI (testy + GATE fixtures/kontrakt) zielone → merge → CD (pull na VPS) → podmiana staging → Ania klika test.agritires.eu`

**Ustalenia (2026-08-20):**
- **Staging = ten sam VPS co produkcja, izolowany:** osobny katalog (`bridge-nowy`), osobny port,
  proces PM2 (`bridge-backend-nowy`), subdomena (np. `test.agritires.eu`), **osobny plik bazy** `data-nowy.db`.
- **Dane staging = snapshot produkcji** do `data-nowy.db` (realne dane, które Ania rozpoznaje;
  odświeżanie **na żądanie**, żeby nie kasować testów importu).
- **CD = pull-based cron na VPS** (`tools/deploy-staging.sh`): build `rebuild/` → migracje na
  `data-nowy.db` → **atomowa podmiana (symlink current→release)** → `pm2 reload`. Bez sekretów w GitHubie.
- **CI = GitHub Actions** na PR/push do `develop` + **branch protection** (merge tylko z zielonym CI).
- **Cutover** (koniec odbudowy): wprowadzimy `main → produkcja` i przełączymy żywy panel na nowy stos
  (ta sama `data.db`).
- **Kontrakt deployu (od I1):** `rebuild/backend` i `rebuild/frontend` budują się przez
  `npm ci --include=dev && npm run build` → `dist/`. Flaga `--include=dev` jest KONIECZNA, bo skrypt
  eksportuje `NODE_ENV=production` (dla runtime), przy którym `npm ci` pomija devDependencies —
  bez niej build padał na `tsc: not found`. Runtime backendu dalej instaluje się `--omit=dev`.
- **Sekrety poza repo (od I1):** `deploy-staging.sh` wczytuje `$STAGING_ROOT/.env` (poza repo) przed
  buildem — tam m.in. wymagany `JWT_SECRET` (backend nie startuje bez niego, fail-fast); instrukcja
  ustawienia na VPS: `docs/deploy-setup.md`, krok 4a.

---

## 2. Źródła prawdy (czytaj je, nie zgaduj)

Kolejność wiarygodności: **fixtures/kontrakt > spec > mapa kodu > oryginał**.

| Plik | Co daje |
|---|---|
| `contract/fixtures/` (55 GET) | nagrane odpowiedzi żywego backendu — siatka bezpieczeństwa |
| `contract/openapi.yaml` (94 ścieżki) | zamrożony kontrakt API (metody, kształty) |
| `docs/spec-backend.md` | zweryfikowana specyfikacja backendu (auth, import `tk()`, liczby) |
| `docs/spec-frontend.md` | 12 widoków, blueprint auth, design tokens, mapa napraw |
| `rebuild/schema/001_schema.sql` | kanoniczny schemat bazy (26 tabel, `products` 72 kol.) |
| `docs/prompts/mapa-kodu-do-wiki.md` | mapa starego kodu (funkcje/pliki) |
| `deminified/` + `mirror/backend`, `mirror/frontend` | zdeminifikowany oryginał — ostateczne źródło, gdy spec milczy |
| `docs/incoming/*-perplexity/` | kanoniczne dokumentacje BE/FE (cytują plik:linia) |
| `docs/reference/Instrukcja_obslugi_Bridge.docx` (17 zrzutów) | wygląd/UX (wersja 5, starsza niż bundle) |
| `rebuild/backend/test/gate/` | harness GATE (od I1, rozbudowany w I2 o moduł seedujący `test/gate/dane.ts` — produkty/dostawcy/`historia_cen`): porównanie odpowiedzi z `contract/fixtures/` + walidacja wg `contract/openapi.yaml`, generyczny — kolejne iteracje dokładają tylko ścieżki/fixtures/seed |

> **Rozjazd kontrakt↔produkcja (wykryty w I1):** `contract/openapi.yaml` (2.3) nie zamraża schematów
> ciał (tylko ścieżkę/metodę/kod statusu) i oznacza `GET /api/me` jako publiczny (`security: []`)
> mimo że produkcja realnie zwraca `401` bez tokenu; kontrakt nie deklaruje `401` też dla
> `POST /api/login`. **Wzorcem jest zawsze zachowanie produkcji.** Odświeżenie kontraktu (kody
> błędów + schematy ciał) — do rozważenia w Iteracji 12.

---

## 3. Zasady przekrojowe (obowiązują w KAŻDEJ iteracji)

| Temat | Ustalenie / decyzja | Rekomendacja | Status decyzji |
|---|---|---|---|
| **Język** | artefakty i rozmowa PL; terminy domenowe w kodzie PL (`kategoria`, `zastosowanie`, `cenaZakupu`, `dostawca`, `bieznik`, `szerokosc`) — nie tłumaczyć | wg `feature.md` | ✅ ustalone |
| **Bezpieczeństwo** | produkcja ma 17 tras publicznych (m.in. `export/shoper`, `audit-log`, `history`, `config`) + CORS odbija każdy Origin + zahardkodowany fallback `JWT_SECRET` (spec-backend §2) | **zaklepane w I1 (1a):** auth wymagany na trasach danych (`requireAuth`), CORS domyślnie zamknięty z allowlistą z env (`CORS_ORIGINS`), `JWT_SECRET` wymagany bez fallbacku (fail-fast) | ✅ ustalone |
| **Stack FE** | React 18 · Wouter v3 · TanStack Query · Radix/shadcn · Tailwind | **postawione w I1 (1b)** (`rebuild/frontend/`); routing po ścieżkach, nie po hashu (odstępstwo O1) | ✅ ustalone |
| **Wygląd** | design tokens: Inter + JetBrains Mono, primary `hsl(35 70% 45%)`, sidebar `hsl(215 28% 12%)`, tło `hsl(210 20% 98%)` | **wniesione w I1 (1b)** — źródłem jest surowy `mirror/frontend/assets/index-BVOkSOnE.css` (nie `04_DESIGN_TOKENS.md`, który ma 6 rozjazdów); test-strażnik w `rebuild/frontend/test/tokeny.test.ts` | ✅ ustalone |
| **Auth flow** | `POST /api/login {email:trim,password}` → `{ok,user,token}`; `Bearer` gdy token + `credentials:include` równolegle; `bridge_user` w `localStorage` albo `sessionStorage` wg `bridge_remember`; Query `on401:returnNull,staleTime:Infinity,retry:false` | **odtworzone 1:1 w I1 (1b)** (`rebuild/frontend/src/lib/`) | ✅ ustalone |
| **Martwe ścieżki FE** | FE woła `/api/attributes` (8×) i `/api/attribute-kinds` (6×) — backend ma `/api/atrybuty(/rodzaje)` | naprawić w I7 (wołać natywne) | ⬜ do zaklepania |
| **Skrypty injection** | `pending-injection.js`, `selly-injection.js`, `freq-injection.js` łatają UI spoza Reacta | wchłonąć natywnie: I7 / I8 / I11 | ⬜ do zaklepania |
| **Lokalne vs API** | alerty, waga gabarytowa, staging auto-accept liczone lokalnie mimo endpointów (spec-frontend §4) | decydować per iteracja (I6, I9, I3) | ⬜ per iteracja |
| **Stack / decyzje szkieletu** | TypeScript vs JS; framework testów; drizzle introspect vs ręczny; layout `rebuild/` | **zaklepane w I1:** TypeScript (strict, ESM) + Vitest po obu stronach; BE: Express 4 + better-sqlite3 + `drizzle-kit introspect`; FE: Vite + Tailwind 3 + shadcn/ui, testy z Testing Library + MSW; layout `rebuild/backend/` + `rebuild/frontend/` (ewentualnie `rebuild/shared/`) | ✅ ustalone |

---

## 4. Tablica postępu

Legenda statusu: ⬜ nie zaczęte · 🔨 w toku · ✅ zrobione (PR zmergowany) · ⏸ wstrzymane

| # | Iteracja | Sesje | Zależy od | Status | PR / data |
|---|---|---|---|---|---|
| 0 | CI/CD + środowisko staging | 1 (DevOps) | — | ✅ | pipeline HTTPS + CI + branch protection; test.agritires.eu · 2026-08-24 |
| 1 | Fundament + logowanie | 1a BE · 1b FE | 0 | ✅ | 1a: PR #2 · 1b: PR #3 · 2026-08-25 |
| 2 | Katalog (odczyt) | 1 (BE+FE) | 1 | ✅ | PR #4 · 2026-08-25 |
| 3 | Import — rdzeń | 3a BE · 3b BE · 3c BE · 3d FE | 2 | ⬜ | |
| 4 | Narzuty + promocje (ceny) | 1–2 | 2, 3 | ⬜ | |
| 5 | Historia | 1 | 3 | ⬜ | |
| 6 | Alerty | 1 | 3 | ⬜ | |
| 7 | Atrybuty (+ pending-injection) | 1a BE · 1b FE | 2 | ⬜ | |
| 8 | Selly / sprzedawarka (+ selly-injection) | 1a BE · 1b FE | 2, 4 | ⬜ | |
| 9 | Waga gabarytowa | 1 | 2 | ⬜ | |
| 10 | Analityka + pulpit | 2–3 | 2, 3, 4 | ⬜ | |
| 11 | Konfiguracja + dostawcy + spedycja (+ freq-injection) | 1–2 | 1 | ⬜ | |
| 12 | Konto + admin + hardening bezpieczeństwa | 1–2 | wszystkie | ⬜ | |

---

## 5. Iteracje (szczegółowo)

Każdy blok: cel (co Ania klika), zakres BE, zakres FE, ścieżki+fixtures (GATE), decyzje, DoD.

---

### Iteracja 0 — CI/CD + środowisko staging
- **Status:** ✅ **zrobione** (2026-08-24 — pipeline HTTPS, CI zielone, branch protection przez ruleset z bypassem admina, placeholder na `test.agritires.eu`)  **Sesje:** 1 (DevOps)  **Zależy od:** —
- **Cel:** działający pipeline `develop → staging`. Po tej iteracji każdy zmergowany ticket
  automatycznie ląduje na serwerze i Ania widzi go pod subdomeną.
- **CI (GitHub Actions):** workflow na PR i push do `develop` — install → lint → typecheck →
  **test (unit + GATE: fixtures + openapi)** → build BE+FE. **Branch protection na `develop`**:
  merge tylko z zielonym CI.
- **Fakty hosta (zwiad 2026-08-21):** Apache z działającym `mod_proxy` w `.htaccess` (flaga `[P]`)
  — **nie trzeba „Custom HTTPD Configurations"**. Prod Node = PM2 `bridge-backend`, port **5000**.
  Docroot subdomeny: `/home/admin/domains/agritires.eu/public_html/test`. User `admin` (bez roota).
- **Środowisko staging na VPS (izolowane, ten sam serwer co prod):**
  - Backend: katalog `/home/admin/private_apps/bridge-staging` (build z `rebuild/backend`), PM2
    `bridge-backend-staging`, port **5001**, **nasłuch tylko na `127.0.0.1`** (bezpieczniej niż prod na 0.0.0.0).
  - Frontend: subdomena `test.agritires.eu`, docroot `.../public_html/test`; build `rebuild/frontend` (base `/`).
  - Reverse proxy: `.htaccess` w docroocie `test` (wzór z prod `panel/.htaccess`):
    `RewriteRule ^api/(.*)$ http://127.0.0.1:5001/api/$1 [P,L,QSA]` + SPA fallback + wymuszenie HTTPS + no-cache html/js/css.
  - Baza: osobny plik `data-nowy.db` ze schematu `001_schema.sql`, **zasilony snapshotem produkcji**; skrypt odświeżenia na żądanie.
- **CD (pull-based na VPS):** dedykowany klon repo `~/bridge-deploy` (osobny od producenta `~/bridge-sync`)
  śledzący `develop`. `deploy-staging.sh`: `git pull develop` → build `rebuild/backend`+`rebuild/frontend`
  → migracje na `data-nowy.db` → **atomowa podmiana** (symlink release dla BE, rsync buildu FE do docroota)
  → `pm2 reload bridge-backend-staging`. Wyzwalany cronem DirectAdmin (poll), log + ewentualny mail. Rollback = symlink.
- **Dokumentacja:** `docs/deploy-setup.md` (architektura, odświeżanie bazy, rollback, porty/ścieżki).
- **Prerekwizyty:** ✅ subdomena `test.agritires.eu` założona (docroot `.../public_html/test`).
  Do potwierdzenia: wersja Node/npm na VPS, sqlite3, obecność `sudo`.
- **DoD:** PR do `develop` uruchamia CI; merge → `deploy-staging.sh` podmienia aplikację;
  `test.agritires.eu` odpowiada (health/placeholder); baza staging = snapshot prod; rollback
  przez symlink udokumentowany i przetestowany.

---

### Iteracja 1 — Fundament + logowanie
- **Status:** ✅ **zrobione** (2026-08-25 — 1a `docs/tickets/1-FEATURE-backend-fundament-logowanie/` (PR #2), 1b `docs/tickets/2-FEATURE-frontend-shell-logowanie/`)  **Sesje:** 1a (backend) → 1b (frontend)  **Zależy od:** 0
- **Cel (Ania klika):** loguje się mailem/hasłem, widzi szkielet panelu z sidebarem i **10 pozycjami nawigacji** (12 = liczba tras routera: 10 pozycji + `/moje-konto` ze stopki + `/login`).
- **Backend (1a) — ✅ zrobione** (`rebuild/backend/`; 69 testów, CI zielone; szczegóły w tickecie wyżej):
  - Szkielet Node 20 + TypeScript (strict, ESM) + Express 4; warstwa danych better-sqlite3 (WAL) + Drizzle
    (`schema.ts` wygenerowany `drizzle-kit introspect`) na `rebuild/schema/001_schema.sql`.
  - Endpointy: `POST /api/login`, `POST /api/logout`, `GET /api/me` — wiernie odtworzone z oryginału.
  - Middleware auth (`requireAuth`, odpowiednik `we`) — **wymagany na trasach danych** (zasada
    bezpieczeństwa §3), gotowy do nakładania w kolejnych iteracjach.
  - **Harness GATE** (`rebuild/backend/test/gate/`, współdzielony przez kolejne sesje): ładuje
    `contract/fixtures/`, waliduje wg `openapi.yaml`; baza testowa świeża z kanonu + seed testowy.
  - README `rebuild/backend/` (uruchomienie, env, migracje, testy/GATE, kontrakt deployu).
- **Frontend (1b) — ✅ zrobione** (`rebuild/frontend/`; 48 testów + 6 integracyjnych przeciw żywemu backendowi, CI zielone):
  - Szkielet React 18 · Wouter v3 · TanStack Query · Radix/shadcn · Tailwind (Vite + TypeScript);
    **design tokens** (§3) przepisane 1:1 z produkcyjnego CSS, wierności pilnuje test-strażnik.
  - Widok `/login` + shell aplikacji (ciemny sidebar, **10 pozycji nawigacji** + stopka: motyw, avatar,
    „Moje konto", „Wyloguj"); **12 tras routera**, z czego 11 to placeholdery na kolejne iteracje.
  - Przepływ auth 1:1 (spec-frontend §5): Bearer gdy token + `credentials:include`; `bridge_user`
    w `localStorage`/`sessionStorage` wg „Zapamiętaj mnie"; Query `on401:returnNull`.
  - README `rebuild/frontend/` (uruchomienie, dev z proxy na `:5001`, testy, kontrakt deployu).
- **Ścieżki (GATE):** `/api/login`, `/api/logout`, `/api/me`.  **Fixtures:** `GET_me.json`.
- **Decyzje 1a (zaklepane):** TypeScript + Vitest + `drizzle-kit introspect` + layout `rebuild/backend/`;
  auth wymagany na trasach danych; CORS domyślnie zamknięty z allowlistą z env; `JWT_SECRET` wymagany
  bez fallbacku. Szczegóły i świadome odstępstwa od oryginału (O1–O7): `docs/tickets/1-FEATURE-backend-fundament-logowanie/plan.md`.
- **Decyzje 1b (wiążące dla kolejnych iteracji FE):** **routing po ścieżkach** (`/katalog`), nie po hashu
  jak oryginał (`useHashLocation`) — stare zakładki `/#/katalog` nie przeniosą się; **brak globalnego
  auto-wylogowania po 401** (wiernie produkcji: odczyty zwracają `null`, mutacje rzucają — wygasła sesja
  daje pusty widok; kandydat na zmianę w I12); klucze Query zawierają pełne `/api/...`, `API_BASE=""`;
  z shadcn/ui wniesione tylko `Button`/`Input`/`Label`/`Card` — resztę dokłada iteracja, która jej użyje
  (Toaster i TooltipProvider jeszcze nie ma). Pełna lista odstępstw (O1–O6) i uzasadnienia:
  `docs/tickets/2-FEATURE-frontend-shell-logowanie/raport.md`.
- **DoD:** ✅ backend startuje; ✅ login/logout/me działają; ✅ harness GATE gotowy; ✅ FE loguje i pokazuje shell;
  ✅ `GET_me.json` przez GATE; ✅ README (BE i FE); ✅ **kontrakt deployu spełniony — po merge'u 1b
  `deploy-staging.sh` przestaje pomijać build (guard wymaga OBU `package.json`) i podmienia placeholder
  z I0 na realny panel pod `test.agritires.eu`**. Ostatni punkt: weryfikacja Ani po pierwszym deployu.
  - **Sprostowania do kanonicznej dokumentacji FE (z 1b):** `04_DESIGN_TOKENS.md` ma 6 rozjazdów wartości
    vs produkcyjny CSS i nierozstrzygnięty „NIEZNANY" zapis motywu; `01_WARSTWA_WSPOLNA.md` podaje
    nieistniejące `refetchOnReconnect:false` i „NIEZNANY" zakres ochrony tras. Spisane w
    **`docs/spec-frontend.md` §7** — to on jest warstwą weryfikacji nad `docs/incoming/`, które
    zostawiamy jako artefakt „jak dostaliśmy". **Zanim I2+ sięgnie po `docs/incoming/`, czyta §7.**
    Zasada, którą 1b potwierdziła w praktyce: **oryginał > spec**.

---

### Iteracja 2 — Katalog (odczyt)
- **Status:** ✅ **zrobione** (2026-08-25 — `docs/tickets/3-FEATURE-katalog-odczyt/`, PR #4)  **Sesje:** 1 (BE+FE)  **Zależy od:** 1
- **Cel (Ania klika):** otwiera `/katalog`, widzi listę opon (realne ~7 405 produktów z istniejącej bazy), filtruje i wyszukuje.
- **Backend — ✅ zrobione** (`rebuild/backend/`; 103 testy):
  - `GET /api/products` odtworzony 1:1 z produkcji: **dwa kształty odpowiedzi** — bez `limit` i bez
    `dostawca` → goła tablica wszystkich produktów; w przeciwnym razie → `{items,total,limit,offset}`
    (`total` liczony po filtrze `dostawca`). Cap `limit` = 2000, domyślny 200 (`Math.min(parseInt(...)‖200,2000)`).
  - `GET /api/suppliers` + `GET /api/dostawcy` — jeden handler, dwie trasy; `liczbaProduktow`, `status`
    (4-gałęziowe przeliczenie wg progu 30 dni) i `ostatniaAktualizacjaCeny`/`Stanu` liczone w locie
    (okno `LAG` po `historia_cen`, w `try/catch`).
  - `compression()` (gzip/brotli) wpięte w `app.ts` — warstwa transportu, zero zmian w kontrakcie.
  - Naprawa dwóch defektów `drizzle-kit pull` w `src/db/schema.ts` (`snow3Pmsf`→`snow3pmsf`,
    10 kolumn na `{mode:"boolean"}`) — bez tego GATE nie zgadzał kluczy/typów z fixture.
  - Wszystkie trzy trasy za `requireAuth`, zgodnie z kontraktem i zasadą §3.
- **Frontend — ✅ zrobione** (`rebuild/frontend/`; 110 testów):
  - Widok `/katalog` — tabela 59 kolumn (15 domyślnych), szukajka tokenowa (16 pól, AND/OR, case-insensitive),
    filtry marka/kategoria/status, zakładki dostawców, sortowanie po nagłówkach, paginacja 25/50/100/Wszystkie,
    wirtualizacja > 150 wierszy, konfigurator widoczności kolumn w IndexedDB (`bridge-store-v2`).
  - Modal podglądu produktu **read-only** — oryginał ma tu modal edycji, my dajemy tylko podgląd (D4).
  - `/katalog` zdjęty z placeholderów. **Liczba tras routera bez zmian: 12.**
- **Ścieżki (GATE):** `GET /api/products`, `GET /api/suppliers`, `GET /api/dostawcy`.
  **Fixtures:** `GET_products.json`, `GET_suppliers.json`, `GET_dostawcy.json`.
- **Decyzje (zaklepane, wiążące dla kolejnych iteracji):**
  - **D2 — pobieranie 1:1 + kompresja transportu:** frontend woła `/api/products` bez parametrów i
    filtruje/sortuje/paginuje client-side, jak oryginał; kompresja to tylko warstwa transportu
    (10,0 MB → 0,84 MB, 12× dla pełnego katalogu), kontrakt API się nie zmienia.
  - **D3 — świadomie NIE dołożono `GET /api/config` (I11) ani `GET /api/atrybuty` (I7):** katalog
    degraduje się łagodnie — listy marek/kategorii budowane tylko z danych produktów, eksport CSV
    (zależny od `/api/config`) odłożony.
  - **D5 — `src/db/schema.ts` ma teraz sekcje „dopieszczeń" po introspekcji** (`snow3pmsf` + 10×
    `mode:"boolean"`, komentarz z cytatem oryginału). **⚠ Kolejne iteracje muszą je nanieść ponownie,
    jeśli ktoś przegeneruje `schema.ts` przez `drizzle-kit pull`.**
  - **D6 — `GET /api/products/{id}` NIE ISTNIEJE** w produkcji ani w kontrakcie — nie tworzyć go.
  - Pełne uzasadnienia (D1, D4 i alternatywy odrzucone): `docs/tickets/3-FEATURE-katalog-odczyt/plan.md`.
- **Ustalenie o `szerokosc` (backlog #3):** backend przepuszcza wartość bez konwersji — liczba na
  kanonie/`db/snapshot.db`, string na stagingu po migracji `szertxt` (SQLite jest dynamicznie typowany,
  Drizzle `real()` nie ma mapowania z drivera). W UI rozjazd jest w większości **niewidoczny** — formatter
  `Wfmt`/`formatujSzerokosc` odzyskuje oryginalny zapis z pola `rozmiar`, nie z `szerokosc`; różnica
  zostaje widoczna tylko w sortowaniu po tej kolumnie (liczby numerycznie, stringi leksykalnie).
  Propozycja domknięcia (schemat REAL→TEXT + przenagranie `GET_products.json`) i pełny wywód:
  `docs/tickets/3-FEATURE-katalog-odczyt/raport.md` (sekcja „Rozjazd `szerokosc`"), decyzja należy do
  ticketu importu/schematu, nie do I2.
- **Uwaga:** to „okno", w którym Ania będzie później weryfikować efekty importu (I3). `POST /api/products/clear`
  (destrukcyjne) → I12, nie tu. `GET /api/products/{id}` nie powstał (D6) — frontend operuje na obiekcie
  już wczytanym z listy.
- **DoD:** ✅ oba kształty `GET /api/products` + cap/filtr/auth; ✅ `GET /api/suppliers`/`GET /api/dostawcy`
  z polami liczonymi w locie; ✅ `src/db/schema.ts` naprawiony (D5); ✅ kompresja włączona; ✅ GATE —
  wszystkie trzy fixtures zielone; ✅ `/katalog` renderuje realne dane (12 tras bez zmian); ✅ szukajka/
  filtry/zakładki/sortowanie/paginacja/konfigurator kolumn/wirtualizacja; ✅ modal podglądu read-only;
  ✅ `lint`/`typecheck`/`test` zielone po obu stronach; ✅ rozjazd `szerokosc` opisany z propozycją domknięcia
  backlogu #3. Otwarte: **weryfikacja Ani po deployu na `test.agritires.eu`.**

---

### Iteracja 3 — Import — rdzeń (najcenniejszy zasób)
- **Status:** ⬜  **Sesje:** 3a BE (parser+staging) · 3b BE (silnik `tk()`) · 3c BE (overrides) · 3d FE (`/staging`)  **Zależy od:** 2
- **Cel (Ania klika):** uruchamia import (URL/plik), widzi wynik w `/staging`, akceptuje/odrzuca, a zmiany widać w katalogu (I2) i historii (I5).
- **Backend 3a — parser + adapter → staging:**
  - Parsery dostawców + `adapter.recordToSurowe()` z **blokiem normalizacji końcowej** (kategoria, zastosowanie, flagi etykiety, szerokość).
  - **Tu wracają decyzje z backlogu:** #1 sniegfix, #2 kategoriafix, #3 szerokość (`docs/rebuild-backlog.md`).
    Dla #3 — I2 zostawiła gotową propozycję domknięcia (schemat REAL→TEXT + przenagranie fixture):
    `docs/tickets/3-FEATURE-katalog-odczyt/raport.md`, sekcja „Rozjazd `szerokosc`".
  - Endpointy: `POST /api/import/from-url`, `POST /api/import/parse-file`, `POST /api/ai-fallback/parse`.
- **Backend 3b — silnik `tk()`** (spec-backend §5, `03_IMPORT_tk.md`):
  - Dopasowanie kod → EAN → kod zastępczy `Lq()` (tylko opona); klasyfikator `Zc()`.
  - Auto-zatwierdzenie **tylko** cena/marża/stan/magazyn → wpis do `historia_cen`.
  - Wycofanie po **3 kolejnych** nieobecnościach (`nieobecnosc_pod_rzad`, próg=3).
  - EAN auto tylko dla długości 8/12/13/14 i nie kończący się 5 zerami; `kod_importu` = `bridge_ext.assignKodImportu` (grupa po EAN lub marka+rozmiar+bieznik+nazwa).
  - Staging: `GET /api/staging`, `/api/staging/paged`, `/api/staging/{id}`, `POST /api/staging/accept`, `/reject`, `/import`, `/clear`.
- **Backend 3c — manual_overrides `Gq()`:** przy konflikcie zachowuje wartość Marty, zapis do `snapshotJson`. `GET /api/overrides`, `PUT/DELETE /api/overrides/{id}`.
- **Frontend 3d:** widok `/staging` — przegląd pozycji importu, akcje accept/reject, podgląd różnic. **Decyzja:** staging auto-accept vs ręczny (spec-frontend §4).
- **Ścieżki (GATE):** staging×7, import×2, overrides×2, ai-fallback.  **Fixtures:** `GET_staging.json`, `GET_staging_paged.json`, `GET_overrides.json`.
- **DoD:** import przetwarza plik/URL do stagingu; `tk()` odtwarza reguły dopasowania/auto-approve/wycofania; overrides Marty respektowane; fixtures przez GATE; Ania przeklika pełny cykl importu.

---

### Iteracja 4 — Narzuty + promocje (ceny)
- **Status:** ⬜  **Sesje:** 1–2  **Zależy od:** 2, 3
- **Cel (Ania klika):** ustawia narzut/promocję, widzi przeliczoną `cena_sprzedazy`/marżę w katalogu.
- **Backend:** markups `Bt` (`GET/POST /api/markups`, `PUT/DELETE /api/markups/{id}`), promotions `hn` (`/api/promotions`, `/api/promotions/{id}`). Reguły przeliczania ceny sprzedaży.
- **Frontend:** widok `/narzuty` (reguły narzutów + promocje). Kolumna „Promocja" w `/katalog` (I2)
  już istnieje w domyślnym zestawie, dziś renderuje puste — I4 dostarcza dla niej dane.
- **Ścieżki (GATE):** markups×2, promotions×2.  **Fixtures:** `GET_markups.json`, `GET_promotions.json`.
- **DoD:** narzuty/promocje liczą ceny zgodnie z oryginałem; fixtures przez GATE; ceny widoczne w katalogu.

---

### Iteracja 5 — Historia
- **Status:** ⬜  **Sesje:** 1  **Zależy od:** 3
- **Cel (Ania klika):** otwiera `/historia`, widzi zmiany cen/stanów z importów.
- **Backend:** `GET /api/history`, `/api/history/meta`, `/api/history/paged` (`Wa` = `historia_cen`). Uwaga: w oryginale `meta`/`paged` były publiczne przez podwójną rejestrację — u nas z auth (§3).
- **Frontend:** widok `/historia` (tabela + paginacja + filtry).
- **Ścieżki (GATE):** history×3.  **Fixtures:** `GET_history.json`, `GET_history_meta.json`, `GET_history_paged.json`.
- **DoD:** historia renderuje realne wpisy; paginacja działa; fixtures przez GATE.

---

### Iteracja 6 — Alerty
- **Status:** ⬜  **Sesje:** 1  **Zależy od:** 3
- **Cel (Ania klika):** otwiera `/alerty`, widzi i obsługuje alerty.
- **Backend:** `GET /api/alerts`, `PATCH /api/alerts/{id}` (`Ki`).
- **Frontend:** widok `/alerty`. **Decyzja:** status/obsługa lokalnie vs przez API (spec-frontend §4) — rekomendacja: przez API (spójność stanu).
- **Ścieżki (GATE):** alerts×2.  **Fixtures:** `GET_alerts.json`.
- **DoD:** alerty listują i zmieniają stan; decyzja lokalne/API zapisana; fixtures przez GATE.

---

### Iteracja 7 — Atrybuty (+ wchłonięcie `pending-injection.js`)
- **Status:** ⬜  **Sesje:** 7a BE · 7b FE  **Zależy od:** 2
- **Cel (Ania klika):** zarządza rodzajami/wartościami atrybutów, obsługuje kolejkę „pending" (akceptuj / jako alias / z edycją / odrzuć) — **natywnie w Reakcie**, bez skryptu injection.
- **Backend:** `/api/atrybuty`, `/atrybuty/liczniki`, `/atrybuty/uzycie`, `/atrybuty/wartosci(+{id})`, `/atrybuty/rodzaje(+{value})`, `/atrybuty/pending`, `/atrybuty/pending/{id}/akceptuj|akceptuj-jako-alias|akceptuj-z-edycja|odrzuc`, `/atrybuty/scan-pending`. Tabele `atrybuty_wartosci_pending`, `..._odrzucone`.
- **Frontend:** widok `/atrybuty` natywnie (bez React Fiber/MutationObserver); jeden Query key `/api/atrybuty`, mutacje + invalidacje. **Naprawa martwych ścieżek:** wołać `/api/atrybuty(/rodzaje)`, nie `/api/attributes(-kinds)`.
- **Ścieżki (GATE):** atrybuty×13.  **Fixtures:** `GET_atrybuty.json`, `_liczniki`, `_pending`, `_rodzaje`, `_uzycie`, `_wartosci`.
- **DoD:** pełen CRUD + workflow pending natywnie; martwe ścieżki naprawione; fixtures przez GATE; parytet z `pending-injection.js` (57 KB) bez samego skryptu.
- **Efekt uboczny dla I2:** `/api/atrybuty` domyka degradację D3 z I2 — listy marek/kategorii w `/katalog`
  dziś powstają wyłącznie z danych produktów, po I7 mogą korzystać ze słowników.

---

### Iteracja 8 — Selly / sprzedawarka (+ wchłonięcie `selly-injection.js`)
- **Status:** ⬜  **Sesje:** 8a BE · 8b FE  **Zależy od:** 2, 4
- **Cel (Ania klika):** otwiera `/selly`, generuje/eksportuje CSV do marketplace, widzi status/log/słowniki — natywnie.
- **Backend:** `/api/selly/status|ping|csv-status|log|dictionaries|categories|producers`, `POST /api/selly/generate-csv|sync-product|sync-supplier`; `GET /api/export/shoper`, `/api/export-shoper` (pełny katalog CSV — **z auth**, §3). Tabele `selly_kategoria_norm_map`, `selly_zastosowanie_category_map`.
- **Frontend:** trasa Wouter `/selly` + komponenty React/TanStack (zamiast overlay + routing przez hash).
- **Ścieżki (GATE):** selly×10, export×2.  **Fixtures:** `GET_selly_status.json`, `_ping`, `_csv-status`, `_log`, `_dictionaries`.
- **DoD:** panel Selly natywny; eksport CSV działa i jest chroniony auth; fixtures przez GATE; parytet z `selly-injection.js` (26 KB).

---

### Iteracja 9 — Waga gabarytowa
- **Status:** ⬜  **Sesje:** 1  **Zależy od:** 2
- **Cel (Ania klika):** otwiera `/waga-gabarytowa`, liczy wagę gabarytową dla opony.
- **Backend:** `POST /api/waga-gabarytowa/oblicz`. **Decyzja:** liczyć w przeglądarce (jak dziś) vs przez API (spec-frontend §4) — rekomendacja: przez API (jedno źródło logiki).
- **Frontend:** widok `/waga-gabarytowa` (formularz + wynik).
- **Ścieżki (GATE):** `POST /api/waga-gabarytowa/oblicz` (brak fixtura GET — walidacja przez openapi + test logiki).
- **DoD:** kalkulacja zgodna z oryginałem; decyzja lokalne/API zapisana.

---

### Iteracja 10 — Analityka + pulpit
- **Status:** ⬜  **Sesje:** 2–3 (podział po grupach: EAN / ceny / dostawcy / dostępność-rotacja / KPI)  **Zależy od:** 2, 3, 4
- **Cel (Ania klika):** otwiera `/analityka` (20+ dashboardów) i pulpit `/` (agregaty).
- **Backend:** 27 tras `/api/analytics/*` (KPI, marże, EAN coverage/comparison/unique/rank/details, ceny inflation/last-import/product-history, dostawcy stats/lifecycle/stability/stock, dostępność products/sell-through, rotacja inactive, sezonowość, importy-timeline, top-zmiany, filters, status, bootstrap-current, export/{view}, market/group-prices, lifecycle/models).
- **Frontend:** widok `/analityka` (`fe.js:27804`) + pulpit `/`.
- **Ścieżki (GATE):** analytics×27.  **Fixtures:** wszystkie `GET_analytics_*.json` (25).
- **DoD:** dashboardy renderują realne agregaty; fixtures przez GATE; pulpit pokazuje kluczowe metryki.

---

### Iteracja 11 — Konfiguracja + dostawcy + spedycja (+ wchłonięcie `freq-injection.js`)
- **Status:** ⬜  **Sesje:** 1–2  **Zależy od:** 1
- **Cel (Ania klika):** edytuje konfigurację, dostawców (w tym **częstotliwość importu** natywnie) i limity spedycji.
- **Backend:** `GET/PUT /api/config` (`Jt`); `/api/dostawcy/{id}`, `POST /api/dostawcy/{kod}/synchronizuj-teraz`, `/api/dostawcy/{kod}/upload`; `GET /api/spedycja` (`gn`). **`GET /api/dostawcy` i `GET /api/suppliers` (listy) już dostarczone w I2** — tu dochodzą tylko detal i mutacje dostawcy.
- **Frontend:** widoki `/konfiguracja` + edycja dostawcy z polem `czestotliwoscMinuty` (zamiast `freq-injection.js` PATCH poza Reactem). `GET /api/config` odblokuje też eksport CSV w `/katalog` (I2, follow-up).
- **Ścieżki (GATE):** config, dostawcy×3 (detal + 2 mutacje), spedycja.  **Fixtures:** `GET_config.json`, `GET_spedycja.json` (`GET_dostawcy.json`/`GET_suppliers.json` już zielone od I2).
- **DoD:** konfiguracja/dostawcy/spedycja edytowalne; częstotliwość natywnie; fixtures przez GATE.

---

### Iteracja 12 — Konto + admin + hardening bezpieczeństwa
- **Status:** ⬜  **Sesje:** 1–2  **Zależy od:** wszystkie (finalny przegląd)
- **Cel (Ania klika):** zmienia hasło w `/moje-konto`; admin zarządza użytkownikami/konfiguracją dostawców i utrzymaniem.
- **Backend:** `POST /api/password/change`; `GET /api/users`; `GET/PUT /api/admin/supplier-config(+{kod})`, `/api/admin/suppliers-list`; `POST /api/maintenance/usun-nieopony`, `POST /api/products/clear`; `GET /api/audit-log`.
  - **Finalny przegląd bezpieczeństwa:** potwierdzić auth na WSZYSTKICH trasach danych, zamknięty CORS, brak zahardkodowanego `JWT_SECRET` z fallbackiem.
- **Frontend:** `/moje-konto` (pełne) + ekrany admin.
- **Ścieżki (GATE):** password, users, admin×3, maintenance, products/clear, audit-log.  **Fixtures:** `GET_users.json`, `GET_admin_supplier-config.json`, `GET_admin_suppliers-list.json`, `GET_audit-log.json`.
- **DoD:** konto/admin/maintenance działają; audyt bezpieczeństwa domknięty; fixtures przez GATE; **kompletny przegląd 12 widoków z Anią**.

---

## 6. Po zakończeniu wszystkich iteracji
- Pełny przegląd 12 widoków + parytet fixtures/kontraktu (55/55).
- Plan cutoveru (big-bang): przełączenie Apache/PM2 na nowy stos, ta sama baza `data.db`.
- Rozliczenie backlogu (`docs/rebuild-backlog.md`) — wszystkie wpisy TAK naniesione, NIE świadomie pominięte.

*Utworzono 2026-08-20 (Faza 3–4). Aktualizuj §4 i statusy w §5 po każdym zmergowanym tickecie.*
