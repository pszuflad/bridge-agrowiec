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

> **Gdzie szukać „co dokładnie robi endpoint X" (ustalone 2026-08-25).** Świadomie **NIE zakładamy
> osobnego pliku ze specyfikacją endpointów odbudowy** — byłby czwartą kopią tej samej wiedzy obok
> kontraktu, fixtures i kodu, a projekt już raz oberwał od dokumentacji, która rozjechała się ze stanem
> faktycznym (`04_DESIGN_TOKENS.md`, spec-frontend §7). Zamiast tego obowiązuje łańcuch:
>
> 1. **kształt odpowiedzi** → `contract/fixtures/` (nagranie produkcji) i `contract/openapi.yaml`;
> 2. **zachowanie** (parametry, rozgałęzienia, pola liczone w locie, pułapki) → blok iteracji w §5 →
>    wskazany tam katalog `docs/tickets/<ID>/` (`plan.md` = decyzje, `raport.md` = ustalenia i dowody);
> 3. **ostateczne rozstrzygnięcie** → komentarz w kodzie `rebuild/`, który cytuje linię oryginału,
>    i sam zdeminifikowany oryginał.
>
> Łańcuch działa, bo każdy blok iteracji podaje swoje **Ścieżki (GATE)** i katalog ticketa. Jedyne
> miejsce, gdzie wiedza o zachowaniu ma się scalić maszynowo, to **odświeżenie `openapi.yaml` w I12** —
> i tam schematy powstają **z fixtures, nie z naszego kodu**.

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
| **Skrypty injection** | `pending-injection.js`, `selly-injection.js`, `freq-injection.js` łatają UI spoza Reacta | wchłonąć natywnie: I7 / I8 / **`freq-injection.js` ✅ wchłonięty w 3f-2 (2026-09-01)** | 🔨 częściowo |
| **Lokalne vs API** | alerty i waga gabarytowa liczone lokalnie mimo endpointów (spec-frontend §4) | decydować per iteracja (I6, I9) | ⬜ per iteracja |
| **Staging auto-accept — LOKALNIE czy przez API** | **rozstrzygnięte 2026-08-27 (3d-1) FAKTEM, nie preferencją: auto-zatwierdzanie jest BACKENDOWE.** Siedzi w gałęzi `else if` żywego `tk()` (`backend-index.cjs:47791-47806`) i od 3d-1 jest odtworzone razem ze skutkami (`updateProduct` + `historia_cen` + `applyDims`). Frontend NIE liczy go lokalnie: bundle woła `POST /api/staging/accept` (czyli API) i nie zawiera ani `autoZatwierdzone`, ani żadnej lokalnej logiki auto-akceptacji (grep po `mirror/frontend/assets/*.js`: 0 trafień). Zdanie ze `spec-frontend` §4 („instrukcja v5 zakłada ręczną obsługę, kod auto-przyjmuje zmiany ceny/stanu") mówi o rozjeździe INSTRUKCJI z KODEM, a nie o liczeniu czegokolwiek w przeglądarce. **Skutek dla 3e:** UI ma tylko pokazywać to, co przyszło ze stagingu — pozycje auto-zatwierdzone w ogóle się w nim nie pojawiają. Przestarzała jest instrukcja v5, nie kod. | — | ✅ ustalone |
| **Utrzymanie roadmapy** | roadmapa jest wejściem dla NASTĘPNEJ sesji, a prompt jest jednorazowy — wiedza z bloku musi lądować tutaj, nie w prompcie | **zaklepane 2026-08-26:** po każdym zamkniętym bloku roadmapa opisuje STAN, nie zamiar; ustalenie dotyczące PRZYSZŁEGO bloku wpisuje się DO TEGO BLOKU (sesja 3c czyta blok 3c); **przypisanie funkcji do sesji weryfikuje się GRAFEM WYWOŁAŃ, nie nazwą** (`bridge_ext` trafił do złej sesji dwa razy — 3a i 3c); prompt nie koryguje roadmapy, tylko roadmapa siebie. Pełna reguła: `CLAUDE.md`, krok operacyjny: `.claude/commands/feature.md` Krok 13 | ✅ ustalone |
| **Stack / decyzje szkieletu** | TypeScript vs JS; framework testów; drizzle introspect vs ręczny; layout `rebuild/` | **zaklepane w I1:** TypeScript (strict, ESM) + Vitest po obu stronach; BE: Express 4 + better-sqlite3 + `drizzle-kit introspect`; FE: Vite + Tailwind 3 + shadcn/ui, testy z Testing Library + MSW; layout `rebuild/backend/` + `rebuild/frontend/` (ewentualnie `rebuild/shared/`) | ✅ ustalone |

---

## 4. Tablica postępu

Legenda statusu: ⬜ nie zaczęte · 🔨 w toku · ✅ zrobione (PR zmergowany) · ⏸ wstrzymane

| # | Iteracja | Sesje | Zależy od | Status | PR / data |
|---|---|---|---|---|---|
| 0 | CI/CD + środowisko staging | 1 (DevOps) | — | ✅ | pipeline HTTPS + CI + branch protection; test.agritires.eu · 2026-08-24 |
| 1 | Fundament + logowanie | 1a BE · 1b FE | 0 | ✅ | 1a: PR #2 · 1b: PR #3 · 2026-08-25 |
| 2 | Katalog (odczyt) | 1 (BE+FE) | 1 | ✅ | PR #4 · 2026-08-25 |
| 3 | Import — rdzeń | 3a·3b·3c·3d-1·3d-2 BE · 3e FE · **3f-1·3f-2·3f-3** | 2 | ✅ | 3a: #6 · 3b: #7 · 3c: #11 · 3d-1: #12 · 3d-2: #15 · 3e: #16 · **3f dołożone 2026-09-01, 3f-1: #19, 3f-2 i 3f-3: 2026-09-01** |
| 4 | Narzuty + promocje (ceny) | 1–2 | 2, 3 | ⬜ | |
| 5 | Historia | 1 | 3 | ✅ | PR #23 · 2026-09-02 |
| 6 | Alerty | 1 | 3 | ⬜ | |
| 7 | Atrybuty (+ pending-injection) | 1a BE · 1b FE | 2 | ⬜ | |
| 8 | Selly / sprzedawarka (+ selly-injection) | 1a BE · 1b FE | 2, 4 | ⬜ | |
| 9 | Waga gabarytowa | 1 | 2 | ⬜ | |
| 10 | Analityka + pulpit | 2–3 | 2, 3, 4 | ⬜ | |
| 11 | Konfiguracja: spedycja / shoper / katalog / ai (dostawcy i `freq-injection` ✅ w 3f-2) | 1 | 1 | ⬜ | |
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
- **Uwaga:** to „okno", w którym Ania będzie później weryfikować efekty importu (I3). `GET /api/products/{id}`
  nie powstał (D6) — frontend operuje na obiekcie już wczytanym z listy.
- **Co I2 świadomie odłożyła i dokąd** (zakresy docelowych iteracji już to uwzględniają):

  | Odłożone | Dokąd | Stan zapisu |
  |---|---|---|
  | Mutacje produktów (`POST`, `PATCH`/`PUT`/`DELETE {id}`, `clear`) + menu „Akcje" i modal edycji w `/katalog` | **I12** | ✅ dopisane do zakresu I12 |
  | Odświeżenie kontraktu + nagranie fixtures zapisujących i wariantu „goła tablica" `GET /api/products` | **I12** | ✅ dopisane do zakresu I12 |
  | Słowniki marek/kategorii z `GET /api/atrybuty` (znosi degradację z D3) | **I7** | ✅ odnotowane w I7 |
  | Dane kolumny „Promocja" (dziś renderuje `—`) | **I4** | ✅ odnotowane w I4 |
  | `GET /api/config` (produkcja nie ma kluczy eksportu — patrz I8) | **I11** | ✅ odnotowane w I11 |
  | Sam przycisk „Pobierz CSV (Shoper)" w `/katalog` | **I8** | ✅ dopisane do zakresu I8 — zależność od `/api/config` okazała się nominalna |
  | Decyzja o `szerokosc` (backlog #3) | ticket importu/schematu (I3) | ✅ ustalenia w `rebuild-backlog.md` #3, odsyłacz w I3 |
- **DoD:** ✅ oba kształty `GET /api/products` + cap/filtr/auth; ✅ `GET /api/suppliers`/`GET /api/dostawcy`
  z polami liczonymi w locie; ✅ `src/db/schema.ts` naprawiony (D5); ✅ kompresja włączona; ✅ GATE —
  wszystkie trzy fixtures zielone; ✅ `/katalog` renderuje realne dane (12 tras bez zmian); ✅ szukajka/
  filtry/zakładki/sortowanie/paginacja/konfigurator kolumn/wirtualizacja; ✅ modal podglądu read-only;
  ✅ `lint`/`typecheck`/`test` zielone po obu stronach; ✅ rozjazd `szerokosc` opisany z propozycją domknięcia
  backlogu #3. Otwarte: **weryfikacja Ani po deployu na `test.agritires.eu`.**

---

### Iteracja 3 — Import — rdzeń (najcenniejszy zasób)
- **Status:** ✅ **ZAMKNIĘTA 2026-09-01** (3a ✅ · 3b ✅ · 3c ✅ 2026-08-26 · 3d-1 ✅ 2026-08-27 · 3d-2 ✅ · 3e ✅ 2026-09-01 · **3f-1 ✅ 2026-09-01 · 3f-2 ✅ 2026-09-01 · 3f-3 ✅ 2026-09-01**) — 2026-09-01 dołożono blok **3f** (brzeg operacyjny importu), wydzielony z I11 decyzją użytkownika. Powód: bez niego pełnego cyklu importu nie da się uruchomić z przeglądarki, a połowa dostawców jedzie w produkcji automatycznym pollingiem, którego roadmapa w ogóle nie miała  **Sesje (6, bottom-up):** 3a BE (port+charakteryzacja) · 3b BE (staging) · 3c BE (dopasowanie `tk()`) · **3d-1 BE (silnik: zatwierdzanie+wycofania+overrides)** · **3d-2 BE (API: `acceptStaging` + endpointy)** · 3e FE (`/staging`)  **Zależy od:** 2
  - **⚠ Blok 3d ZOSTAŁ PODZIELONY** (decyzja użytkownika, 2026-08-27, ticket `7-FEATURE-silnik-zatwierdzanie-wycofania-overrides`). Powód: blok zbierał 8 punktów, a lektura źródeł dołożyła kolejne 4 endpointy, których roadmapa nie wymieniała (patrz blok 3d-2) — wychodził największy blok całej iteracji. Szew: **3d-1 kończy się na `tk()`, 3d-2 zaczyna na brzegu HTTP.**
- **Cel (Ania klika):** uruchamia import (URL/plik), widzi wynik w `/staging`, akceptuje/odrzuca, a zmiany widać w katalogu (I2) i historii (I5).
- **⭐ Strategia parserów — PORT, nie rewrite (kluczowa decyzja):** parsery to **czytelne, utrzymywane źródło** (~5000 linii: `common.cjs`, `tyre_params.cjs`, `adapter.cjs`, `dispatcher.cjs`, parsery `mo1_bohnenkamp`…`mo10_gri`, `dictionaries/` — porcja 3a; `bridge_ext.cjs`/`tire_dims.js` nie są wołane przez żaden plik z `parsers/`, więc wypadły z portu 3a — a doprecyzowanie z 2026-08-26 przesunęło je do 3d — **ostatecznie przeportowane bajt-w-bajt w 3d-1, 2026-08-27**, razem z markerem `legacy/package.json`, bez którego `tire_dims.js` po cichu się nie ładował), które Ania wciąż edytuje. **Portujemy podsystem 1:1 jako moduły JS**, przepisujemy tylko **brzegi**: wejście (pobieranie plików/API dostawców) i wyjście (zapis do stagingu przez naszą warstwę Drizzle). Backend TS/ESM konsumuje moduły `.cjs` bez problemu; TS-yfikacja później, opcjonalnie. **Zysk:** wierność + łatwa re-synchronizacja z Anią (diff/patch) + bieżące poprawki parserów (backlog **#6**) wchodzą **automatycznie** przez port najświeższego źródła. Nie wymyślamy parserów od zera. Uczciwie: port przynosi trochę legacy — czyścimy stopniowo, poprawność > estetyka.
- **3a · Port + charakteryzacja parserów** (BE) — ✅ **zrobione** (ticket `4-FEATURE-port-parserow-charakteryzacja`, 2026-08-26). Podsystem `parsers/` (`common`, `tyre_params`, `adapter`, `dispatcher`, `dictionaries`, `mo1`…`mo10`) wciągnięty jako **kopia bajt-w-bajt** do `rebuild/backend/src/import/legacy/`; brzeg wejścia `parsujPlik`/`parsujBufor` (bez DB). Decyzje **#1 sniegfix / #2 kategoriafix / #3 szerokość / #4 uwaga_cena (warstwa parsera) / #6 poprawki** weszły **przez port najświeższego źródła**, bez reimplementacji.
  - **⚠ Korekta zakresu (wniesiona przez 3a):** pierwotny opis tej iteracji wymieniał `bridge_ext.cjs` i `tire_dims.js` w porcie 3a — sprawdzenie grafu wywołań w oryginale pokazało, że żaden plik z `parsers/` ich nie `require`uje; `applyDims`/`applyLinkMemory`/`assignKodImportu` są wołane wyłącznie wewnątrz `tk()` w `index.cjs`. Przeniesione do 3c, a stamtąd, po weryfikacji grafem wywołań przy planowaniu 3c, dalej do 3d. **Domknięte: port wykonany w 3d-1 (2026-08-27).** Przy okazji sprostowanie do samego uzasadnienia: `bridge_ext` ma 11 eksportów i `tk()` woła z nich tylko dwa (`applyDims`, `applyLinkMemory`) — pozostałe (`assignKodImportu`, `applyNazwaPamiec`, `applyWagaPamiec`, `rememberLink`, `ensure*Tables`) woła `acceptStaging`/`addProductsBulk`, czyli **3d-2**. Dlatego portowany jest CAŁY plik, a nie używany podzbiór.
  - **#3 szerokość:** stan końcowy `szertxt` jest w porcie, ale decyzja o schemacie (`products.szerokosc` REAL→TEXT) zostaje otwarta — 3a nie ma bazy. Przy realizacji znaleziono, że `szertxt` **nie jest kompletny**: fallback `parseWidthFallbackMm()` w `normalizeJmk`/`normalizeHandlopex` nadal zwraca milimetry jako float (szczegóły w backlogu #3).
  - **⭐ Gate (najważniejszy w całej odbudowie): ✅ zielony.** Charakteryzacja MO1–MO10 — 711 rekordów wzorca, porównanie pole po polu z wyjściem **oryginalnego** parsera; plus sha256 port↔`mirror/backend` i kontrola przydatności próbki. Skuteczność gate'u zweryfikowana celową mutacją. Audyt na **pełnych** plikach MO1–MO5: port == oryginał, liczby zgodne z `.meta.json` realnych przebiegów produkcji. `rebuild/backend/test/charakteryzacja.test.ts` + `test/charakteryzacja/ZRODLA.md`.
  - **Pokrycie (stan 2026-08-26):** MO1–MO5 z archiwum importów (historia gita), **MO7 i MO10 z prawdziwych plików od Ani** (285 i 223 rekordy) — podmienione za próbki odtworzone, przy czym odtworzenie się obroniło: 4 z 5 wspólnych rekordów zgadzały się we wszystkich 53 polach. MO6 i MO8 zostają odtworzone (po 2 wiersze z `test_tyres.cjs`). MO9 charakteryzowany bez sieci: podstawiony jest **wyłącznie** globalny `fetch`, więc wykonuje się realny `fetchAll()`; niepokryty zostaje sam transport HTTP.
  - **Wejście z 3a do dalszych sesji:** backlog **#7** (MO6 wycofany z importu — konfiguracja `suppliers`, nie parser) i backlog **#8** (MO8 przy pliku CSV importuje cicho zero pozycji) → oba zaadresowane w **3b** (patrz niżej).
- **3b · Zapis do stagingu** (BE) — ✅ **zrobione** (ticket `5-FEATURE-staging-endpointy-importu`, 2026-08-26). Wyjście parsera z 3a → tabela `staging_items` przez Drizzle (zapis wsadowy w transakcji); trzy kształty odczytu `GET /api/staging` (goła tablica / koperta), `/paged` (filtry, tokenizowany `search`, sortowanie `id DESC`), `/{id}`; brzeg importu kompletny: `POST /api/import/parse-file` (surowy strumień, limit 25 MB), `POST /api/import/from-url` (pobranie `http`/`https`, 60 s, przekierowania), archiwizacja bufora przed parsowaniem z retencją 7 dni/5 GB, aktualizacja `suppliers`, audit log. Backlog **#7** (MO6 wyłączony z importu — kolumna `suppliers.import_wylaczony`) i bezpiecznik dla backlogu **#8** (0 rekordów z parsera → 400, bez zapisu do stagingu) zrealizowane. Kolumna `products.uwaga_cena` (backlog **#4**) dodana; propagacja → **3d-2**, endpointy → **I12** (doprecyzowane w 3d-1).
  - **⚠ `tk()` NIE został przeportowany w 3b — podział 3b/3c odbiega od pierwotnego założenia.** Jest wydzielony jako jawny szew `SilnikStagingu = (kodDostawcy, surowe) => StatystykiImportu` (`rebuild/backend/src/import/tk.ts`), z implementacją oznaczoną jako świadomie niewierna. Powód: przejście gałęzi `nowa` w oryginale (`deminified/backend-index.cjs:47600-47737`) pokazało, że „import do pustego katalogu" NIE upraszcza tyle, ile zakładano — `Zc()`, `Hq()`, `Gq()`, `Lq()`, `Kq()` wykonują się na KAŻDYM rekordzie niezależnie od zawartości katalogu; pusty katalog zeruje tylko mapy dopasowania, diff `Vq`/`Xq`, auto-zatwierdzanie i wycofania. **Skutek dla 3c:** oprócz tego, co ta iteracja już wymienia niżej, 3c musi dowieźć też `Hq()` (normalizacja EAN → `eanRaw`/`eanIsValid`/`eanSourceStatus`/`eanCandidates` + `rozmiarWykryty`) i `Kq()` (błędny zapis nazwy) — w 3b te pola są NULL-em, a `snapshotJson` serializuje rekord PRZED normalizacją. `Gq()` (overrides) zostaje w 3d — **dowiezione w 3d-1**.
  - **⚠ Sprostowanie: AI fallback NIE jest wpięty w blok `catch` parsowania** — opis tej iteracji sugerował `/api/import/ai-fallback/parse` odpalany przy błędzie parsera; sprawdzone w oryginale, nieprawda. Realna ścieżka to `POST /api/ai-fallback/parse` (`contract/openapi.yaml:51`), wołana WYŁĄCZNIE ręcznie i **nigdy nie łącząca się z OpenAI** (bez klucza `ai_fallback.klucz_api` w `config` zwraca 5 zmyślonych pozycji jako „symulacja", z kluczem — pustą listę). Mechanizmem faktycznie użytym w `catch` jest `Wc()` (`backend-index.cjs:46910`) — stare parsery per-dostawca w rdzeniowym `POST /api/dostawcy/:kod/upload`, który należy do **I11**, nie do I3. Odtworzony w 3b jako stub 1:1 pod właściwą ścieżką.
  - **Gate 3b: ✅ zielony.** `GET_staging.json`/`GET_staging_paged.json` porównane po zasianiu `staging_items` nagranymi danymi z fixtures — treści pozycji (`typZmiany`, pola EAN, `snapshotJson`) wymagają `tk()`, którego 3b jeszcze nie ma; to testuje całą warstwę odczytu (projekcje, kopert, sortowanie, filtry) niezależnie od silnika. `katalog.gate.test.ts` i charakteryzacja 3a nadal zielone.
  - **Wejście z 3b do dalszych sesji:** backlog **#7** ZREALIZOWANY (kolumna `suppliers.import_wylaczony` + strażnik), ale `UPDATE ... WHERE kod='MO6'` w migracji działa tylko, gdy wiersz MO6 już istnieje w `suppliers` — w świeżej bazie z kanonu tabela jest pusta i flaga nie ma czego ustawić; domknięcie → **I11** albo seed produkcyjny. Backlog **#8** zaadresowany bezpiecznikiem (0 pozycji z parsera → 400, bez zapisu), sam parser MO8 przyjdzie portem (#6); ten sam cichy zerowy wynik daje też MO10 przy śmieciowej treści. Backlog **#3** (`szerokosc` REAL→TEXT) świadomie NIE ruszony w 3b — decyzja przesunięta do 3d. **Rozstrzygnięta i naniesiona w 3d-1 (2026-08-27):** migracja `003_szerokosc_text.sql`, a rozjazd z fixture'em przykryty zadeklarowanym wyjątkiem GATE do czasu przenagrania w I12. **Nowy wzorzec do naśladowania:** jawna projekcja kontraktowa (`src/repos/kolumny.ts`) — repozytoria wybierają kolumny jako „wszystkie z tabeli MINUS jawnie zadeklarowane wewnętrzne", więc nowe kolumny poza kanonem (jak D5/D9) nie rozlewają się do API bez świadomego wpisu. **Infra:** backend wymaga Node ≥ 20 (`better-sqlite3`); wdrożenie wymaga migracji `002_import.sql` (`npm run migrate`).
- **3c · Silnik `tk()` — dopasowanie + klasyfikator** (BE) — ✅ **zrobione** (ticket `6-FEATURE-silnik-tk-dopasowanie-klasyfikator`, PR #11, 2026-08-26). Ciało `tk()` przepisane 1:1 z żywego oryginału (`deminified/backend-index.cjs:47584-47851`) do czytelnego TS w `rebuild/backend/src/import/silnik/` (`ean.ts`, `rozmiar.ts`, `klasyfikator.ts`, `pozycja.ts`, `identyfikator.ts`, `overrides.ts`) — port `Zc`/`Hq`/`ZT`/`mm`/`zq`/`YT`/`JT`/`ek`/`Kq`/`Vq`/`Xq`/`Lq`. `silnikStagingu3b()` zastąpiona przez `silnikStagingu()` w `src/import/tk.ts`: mapy dopasowania (kod → EAN → EAN znormalizowany), łańcuch identyfikatora zastępczego `Lq()`, klasyfikacja `nowa`/`blad`/`zmiana_kluczowa`, budowa `ostrzezenie`/`powod`, konflikt EAN, reset `nieobecnosc_pod_rzad` przy dopasowaniu, kasowanie produktu przy nie-oponie. Nowe funkcje repo: `katalogDoImportu`, `aktualizujProdukt`, `usunProdukt` (`src/repos/products.ts`); deduplikacja `zapiszPozycjeStagingu` po `(kod, typZmiany, COALESCE(powod,''))` jak `U.addStaging` (D8). Bezpiecznik pustego wejścia (`PustyImportBlad`) przeniesiony do `tk()`, zakrywa teraz wszystkie trzy wejścia naraz.
  - **Poza zakresem 3c, oznaczone dla 3d — ✅ dowiezione w 3d-1 (2026-08-27):** efekty auto-zatwierdzania (`updateProduct`/`historia_cen`/`applyDims`+`applyLinkMemory`), pętla wycofań po 3 nieobecnościach, realne `Gq()`.
  - **⚠ Sprostowanie: reguła auto-aktualizacji EAN NIE wchodzi do zakresu 3c.** Pierwotny opis tej sesji („EAN auto tylko dla długości 8/12/13/14 i nie kończący się 5 zerami") cytował regułę, która istnieje **wyłącznie w martwej `function tk`** (`:47499-47512`); żywy `tk` (`:47584`) nigdy nie ustawia `AP.ean` — produkcja nie aktualizuje EAN istniejącego produktu przy imporcie. Nieprawidłowość ta sama, przed którą ostrzega `CLAUDE.md` (duplikaty definicji, wygrywa późniejsza). **Nie zaimplementowane, nigdzie w roadmapie.** Zgłoszone do `docs/rebuild-backlog.md` #11 razem z powiązanym błędem cieniowania `Lq()`.
  - **⚠ Pułapka: DWIE definicje `Lq()`** — `function Lq(t)` (`:46965`) liczy cyfry znaczące, a `function Lq(t, e)` (`:47312`) generuje identyfikator techniczny przez sha1 z `ean|nazwa|rozmiar|marka|model`. **Wygrywa `:47312`**, dokładnie jak `tk = function` z `:47584` wygrywa nad `function tk` z `:47378`. Konsekwencja odtworzona 1:1: `ZT()` woła `Lq(i)` licząc na licznik cyfr, ale trafia w generator sha1, więc dla EAN-u w notacji naukowej ostrzeżenie brzmi dosłownie „zapis naukowy ma tylko null cyfr znaczących" — żywy błąd produkcji, zgłoszony do `docs/rebuild-backlog.md` #11.
  - **Rozliczenie gate'u:** 286 testów zielonych (było 273) — 33 nowe testy charakteryzacji silnika (uruchomiony oryginał wycięty z `mirror/backend/index.cjs` po kotwicach tekstowych, sha256 na wycinku, cenniki MO1–MO10 + 18 scenariuszy celowanych) + 11 testów gate'u treści przez `POST /api/import/parse-file`. Porównanie pole po polu: 340 wierszy `staging_items` z 1838 realnych rekordów cennikowych na katalogu 7405 produktów ze zrzutu produkcji. Skuteczność gate'u potwierdzona 6 celowymi mutacjami — każda złapana. `GET_staging.json`/`GET_staging_paged.json`, GATE I2 (`katalog.gate.test.ts`) i charakteryzacja 3a (1838 rekordów, sha256) — zielone bez zmian w samych testach.
  - **Gate:** scenariusze dopasowania — nowy / po kodzie / po EAN / po EAN znormalizowanym / zastępczy `Lq()` / nie-opona z kasowaniem / konflikt EAN / błędny zapis nazwy / `blad` / pusty wynik (bezpiecznik).
- **3d-1 · Silnik: zatwierdzanie + historia + wycofania + overrides Marty** (BE) — ✅ **zrobione**
  (ticket `7-FEATURE-silnik-zatwierdzanie-wycofania-overrides`, PR #12, 2026-08-27).
  Dowiezione: port `bridge_ext.cjs` + `tire_dims.js` **bajt-w-bajt** do `src/import/legacy/`
  (wzorzec 3a, objęte istniejącym porównaniem sha256); efekty auto-zatwierdzania
  (`:47791-47806`) — `aktualizujProdukt` + wpis do `historia_cen` + `applyDims`/`applyLinkMemory`;
  pętla wycofań po **3** nieobecnościach pod rząd (`:47807-47847`, `WYCOFANIE_PROG_IMPORTOW`);
  realne `Gq()` (`:47319`) zamiast stuba — override wygrywa, wartość z pliku ląduje
  w `snapshotJson._srcConflict`, `naruszono` wymusza `blad` i blokuje auto-zatwierdzenie;
  nowe repozytoria `src/repos/historia.ts` i `src/repos/overrides.ts`; migracja
  `003_szerokosc_text.sql` (backlog **#3**, `products.szerokosc` REAL→TEXT).
  - **Rozliczenie gate'u:** 329 testów zielonych (było 286). Charakteryzacja silnika
    rozszerzona o cały zakres 3d-1 i przenagrana — porównanie pole po polu z uruchomionym
    oryginałem na **12 620 REALNYCH poprawkach Marty** ze zrzutu produkcji (3c jechała na
    pustej liście), 286 auto-zatwierdzeń, 286 wierszy `historia_cen`, 149 wierszy `wycofana`,
    5910 zmian stanu produktów, 31 scenariuszy celowanych. Skuteczność potwierdzona
    **8 celowymi mutacjami — każda złapana**. Nowe: `test/silnik.decyzje.test.ts` (15 testów
    czytelnych jako specyfikacja reguł) i `test/bridge-ext.test.ts` (6).
  - **⚠ NIE ufaj samemu „nie wybuchło" przy porcie `bridge_ext`.** Moduł jest z założenia
    DEFENSYWNY — łapie każdy wyjątek i milczy. Przy porcie okazało się, że `tire_dims.js`
    (pierwszy plik `.js` w `legacy/`, a backend ma `"type": "module"`) nie dawał się
    `require`ować, więc `applyDims` po cichu zwracało `null` i wymiary NIGDY się nie liczyły.
    Naprawione markerem `src/import/legacy/package.json` (`"type": "commonjs"`) — to JEDYNY
    plik w `legacy/` spoza portu, jawnie pominięty przez sha256. Testy sprawdzają WARTOŚCI
    wymiarów, nie brak wyjątku.
  - **⚠ Trzy fakty o oryginale wyszły dopiero przy uruchomieniu i są odtworzone 1:1:**
    (a) `U.getOverridesFor` nie ma `ORDER BY`, ale indeks `UNIQUE(supplier_kod,
    supplier_product_id, field_name)` sprawia, że SQLite oddaje wiersze **posortowane po
    `field_name`** — kolejność przecieka do komunikatu dla człowieka („plik nadpisuje poprawke
    Marty: **bieznik, model**"); dodanie `ORDER BY` byłoby ZMIANĄ zachowania.
    (b) `U.deleteProduct` kasuje **tylko z bazy**, nie z tablicy katalogu — więc produkt
    skasowany w gałęzi nie-opony nadal przechodzi przez pętlę wycofań i przy trzeciej
    nieobecności dostaje wiersz `wycofana`, mimo że już nie istnieje.
    (c) `applyLinkMemory` w `tk()` dostaje PATCH auto-zatwierdzenia (bez `kod` i bez
    `marka/model/rozmiar`), więc **nie czyta pamięci linków ani razu** — jedynym jego efektem
    jest przepisanie istniejącego `linkZdjecia`. Wzorzec pilnuje tego licznikiem zapytań.
  - **⚠ `db/snapshot.db` (2026-08-13) jest STARSZY niż produkcyjna migracja `szertxt`
    (2026-08-19)** i ma jeszcze `szerokosc REAL`. Skrypt nagrywający konwertuje tę kolumnę
    przez `String(liczba)` — NIE przez `CAST(… AS TEXT)`, bo SQLite renderuje `REAL` 710 jako
    „710.0", czego parser nigdy nie zapisze, i wzorzec dostawał sztuczne różnice. Kto podmieni
    zrzut na nowszy, może tę konwersję usunąć.

- **3d-2 · API: `acceptStaging` + endpointy mutacji stagingu i overrides** (BE) — ✅ **zrobione** (ticket `9-FEATURE-acceptstaging-endpointy-mutacji`, 2026-09-01).
  Brzeg HTTP silnika: `acceptStaging` (`:44827-44910`) + `assignKodImportu` w `addProductsBulk`
  (`:44746`, wywołanie `:44791`), propagacja `uwagaCena`, endpointy, fixture `GET_overrides.json`.
  - **Rozliczenie gate'u:** 387 testów zielonych (było 354). **`GET_overrides.json` zielony —
    ostatni nieodhaczony fixture Iteracji 3.** Charakteryzacja `acceptStaging` przeciw
    URUCHOMIONEMU oryginałowi (19 testów, 16 scenariuszy, porównanie stanu siedmiu tabel),
    28 testów endpointów przez HTTP, **16 mutacji — wszystkie złapane**.
  - **⭐ `acceptStaging` DAŁO SIĘ wyciąć z bundla — plan B nie był potrzebny.** `tk()` było
    samodzielną funkcją i szło nakarmić atrapami; `acceptStaging` jest metodą obiektu `U`
    i rozmawia wprost z Drizzle, więc harness (`test/charakteryzacja/akceptacja/oryginal.mjs`)
    wstrzykuje mu PRAWDZIWEGO Drizzle na bazie z naszego kanonu i porównuje KOŃCOWY STAN
    dwóch identycznie zasianych baz. Kotwice: `function __bridgeCondMatch` →
    `function recalcPricesFromRules` (pomocnicy narzutów) i `listStaging(){` → `listAlerts(){`
    (metody warstwy danych). **Wzorzec do naśladowania przy każdej kolejnej metodzie `U`** —
    m.in. `addProductsBulk` w I12.
  - **⭐ Charakteryzacja DOWODZI, że pominięcie narzutów/promocji jest bezpieczne w I3.**
    Pomocnicy `__bridgePickMarkup`/`__bridgePickPromo` są wycięci NAPRAWDĘ, nie jako zaślepki,
    więc oryginał wykonuje pełną gałąź cenową na pustych tabelach i wychodzi z tym samym
    wynikiem co nasz port. To zmierzone, nie wywnioskowane z lektury.
  - **⚠ Dwie pułapki odtworzone 1:1:** (a) `assignKodImportu` czyta `existing.kod_importu`
    w snake_case, a dostaje wiersz z Drizzle (`kodImportu`) — reguła „zachowaj istniejący
    numer" NIGDY nie wypala, numer ratuje dopiero wyszukanie po grupie surowym SQL-em;
    (b) `kod_importu` dla produktu bez grupy jest LOSOWY (`Math.random()`), więc
    charakteryzacja porównuje go po kształcie, a odziedziczony po grupie — dosłownie.
  - **⚠ Jedno odstępstwo techniczne od oryginału, bez zmiany zachowania:** rekord produktu
    przechodzi przez `tylkoKolumnyProduktu()`, bo snapshot z parsera niesie pola pomocnicze
    (`_srcConflict`), które produkcyjne Drizzle ignorowało, a nasze rzuca. Zapisujemy dokładnie
    te kolumny, które zapisałaby produkcja — potwierdza to charakteryzacja.
  - **⚠ Wejście z 3d-1 — CZYTAJ PRZED STARTEM.**
    - **⭐ ENDPOINTÓW JEST DZIEWIĘĆ, NIE CZTERY. Poprzedni opis bloku 3d był tu BŁĘDNY** —
      sprostowane 2026-08-27 przez porównanie żywego kodu z zamrożonym kontraktem:
      `POST /api/staging/accept` (`:48535`) · `/reject` (`:48561`) · `/clear` (`:48592`) ·
      `/import` (`:48502`) · **`DELETE /api/staging/{id}`** (`:48581`, `openapi.yaml:1105`) ·
      **`PUT /api/staging/{id}`** (`:48598`, `openapi.yaml:1125`) ·
      `GET /api/overrides` (`:48645`) · **`POST /api/overrides`** (`:48650`, upsert BEZ id) ·
      `DELETE /api/overrides/{id}` (`:48675`).
      **`PUT /api/overrides/{id}` NIE ISTNIEJE** — ani w kodzie, ani w kontrakcie; stary opis
      roadmapy go wymyślił. **`PUT /api/staging/{id}` jest JEDYNĄ ścieżką, która TWORZY
      poprawki Marty** (woła `U.upsertOverride` dla każdego edytowanego pola, `r` = lista
      8 pól edytowalnych) — bez niej 3e nie ma czym edytować pozycji stagingu.
    - **`acceptStaging` sięga do ITERACJI 4.** Woła `__bridgePickMarkup`/`__bridgePickPromo`
      (`:44884-44892`) — narzuty i promocje. W I3 obie tabele są PUSTE (nie ma endpointów,
      które by je wypełniły), więc gałąź `if (__mm || __pp)` nigdy nie wchodzi i pominięcie
      jej jest bezpieczne. **Ale musi zostać ZAPISANE jako luka do domknięcia w I4**, a nie
      przemilczane.
    - **`bridge_ext` jest już w repo i czeka gotowy** (`src/import/legacy/`). 3d-2 dołoży
      wywołania `assignKodImportu`, `applyNazwaPamiec`, `applyWagaPamiec` i `rememberLink` —
      wszystkie cztery woła `acceptStaging`/`addProductsBulk`. Typowany most jest
      w `src/import/silnik/bridge-ext.ts`; **dopisz tam brakujące funkcje do interfejsu**,
      nie twórz drugiego mostu.
    - **`src/repos/overrides.ts` istnieje i ma tylko `poprawkiDla()`.** `listOverrides`,
      `upsertOverride` i `deleteOverride` dopisz **TAM**, nie w nowym pliku.
    - **`acceptStaging` musi odtworzyć potwierdzanie konfliktu** (`:44843-44862`): dla każdego
      pola w `snapshotJson._srcConflict` robi `upsertOverride` z `acknowledgedSourceValue`
      ustawionym na wartość z pliku. To domyka pętlę: 3d-1 melduje konflikt, 3d-2 go wycisza
      po akceptacji. Ścieżka „konflikt potwierdzony → brak alarmu" jest już przetestowana
      po stronie silnika (`silnik.decyzje.test.ts`).
    - **`uwagaCena`: TYLKO propagacja** (odczyt ze `snapshotJson` w `acceptStaging` →
      `products.uwaga_cena`). Endpointy do I12 — patrz niżej.
    - **Bezpiecznik pustego wejścia JEST w `tk()`**, więc `POST /api/staging/import` rodzi się
      chroniona. Potwierdzić testem HTTP, że pusta tablica nie dociera do stagingu ani do
      liczników — w 3d-1 jest to sprawdzone na poziomie `tk()`, nie przez HTTP.
    - **Ta trasa jako pierwsza realnie uruchomi gałąź identyfikatora zastępczego `Lq()`** —
      ścieżka plikowa w nią nie wchodzi, bo adapter sam nadaje `kod`.
    - **⚠ Gdyby 3d-2 dokładała migrację: schemat staging NIE pochodzi z naszego kanonu.**
      Baza staging powstaje przez `.backup` z produkcji, a `001_schema.sql` jest idempotentny,
      więc na przywróconej bazie nic nie tworzy — zostaje kształt produkcji, a `_migracje`
      odnotowuje kanon jako zastosowany. Kanon i staging mogą się więc po cichu różnić,
      a bramki tego nie pokażą (testy budują własną bazę z kanonu). Wyszło to przy `szerokosc`
      REAL/TEXT w 3d-1. Szczegóły i procedura sprawdzenia: `docs/deploy-setup.md`,
      sekcja „Schemat bazy staging NIE pochodzi z naszego kanonu".
  - **Gate:** `GET_overrides.json` zielony; 8 ścieżek przez HTTP; `acceptStaging` porównany
    z oryginałem; pusty import nie dociera do stagingu.

- **3e · `/staging` (FE) + weryfikacja Ani** — ✅ **zrobione** (ticket `10-FEATURE-widok-staging`, 2026-09-01). Widok w pełnej parzystości z oryginałem: filtr typu (6 opcji), wyszukiwarka, stronicowanie 25/50/100, zaznaczanie, **trzy warianty akcji masowych** (zaznaczone / widoczne / wszystkie przefiltrowane), podgląd różnic i **edycja pozycji**. Decyzja o auto-accept była już rozstrzygnięta w §3 (jest backendowy) — ten blok jej nie otwierał.
  - **⭐ EDYCJA DAJE INTERFEJS POPRAWKOM MARTY.** `PUT /api/staging/{id}` to jedyna ścieżka tworząca `manual_overrides`; do 3e cały mechanizm z 3d-1/3d-2 działał, ale nikt nie mógł go użyć. Test integracyjny sprawdza to przez ŻYWY backend: edycja w widoku → wpis w `manual_overrides`.
  - **Rozliczenie gate'u:** 126 testów FE (było 110) — 16 testów widoku na fixture'ach przez MSW + 6 integracyjnych bez mocków, przez uruchomiony backend. **6 mutacji, wszystkie złapane** (jedna początkowo nie — brakowało symetrycznego testu ciała `allFiltered` dla akceptacji; test dołożony).
  - **⚠ GATE DOMYKA SIĘ TYLKO CZĘŚCIOWO — I TO JEST FAKT, NIE NIEDORÓBKA.** Pierwotne brzmienie („Ania klika PEŁNY cykl importu") zakładało, że wgrywanie pliku jest na `/staging`. **Nie jest**: w oryginale to zakładka „wgrywanie" na stronie Konfiguracja, przypisanej do **I11**. Bez niej nie ma z przeglądarki jak ZACZĄĆ importu. Decyzja użytkownika (2026-09-01): 3e buduje sam widok, import przygotowujemy my (`POST /api/import/parse-file`, instrukcja w raporcie ticketa), a Ania weryfikuje przegląd, filtry, akcje masowe, edycję i podgląd różnic. **Pełny cykl z przeglądarki domknie I11.**
  - **⚠ `GET /api/atrybuty` w tym widoku jest MARTWE.** Oryginał je pobiera (`fe.js:20630-20633`), ale zmienna z wynikiem nie występuje nigdzie w regionie widoku. Świadomie NIE przeportowane — I7 nie był i nie jest blokerem dla stagingu.
  - **Trzy rzeczy wzięte z oryginału dosłownie:** etykiety i kolory typów (`fe.js:597593`: `nowa` → „Nowa"/emerald, `zmiana_kluczowa` → „Zmiana kluczowa"/blue, `blad` → „Błąd"/red-700, `wycofana` → „Wycofana"/red-600); sześć opcji filtra (`fe.js:597086`) **łącznie z „Nowe produkty (stare)" dla wartości `nowy`, której nasz silnik nie produkuje**; komplet `data-testid` (`button-accept-*`, `checkbox-select-all`, `input-search-staging`, `select-filter-type`).
  - **Wejście z 3b (wykorzystane w 3e — zostaje jako zapis stanu):**
    - **Trzy trasy odczytu mają TRZY RÓŻNE kształty** (`src/repos/staging.ts`): `/api/staging` — 24 pola, `/paged` — 20, `/{id}` — 21. Konkretnie: `/paged` **nie zwraca `snapshotJson`**, więc podgląd różnic musi dociągnąć pozycję z `GET /api/staging/{id}`. `/paged` nie ma też `eanCandidates`, `magazynRaw` ani pary `zatwierdzilUzytkownikId`/`zatwierdzonoData` (zamiast niej jedno pole `zatwierdzono`).
    - **`GET /api/staging` wymaga auth (odstępstwo D1)** — kontrakt opisuje ją jako publiczną, my wymagamy tokenu, tak jak `/api/products` od I2. Klient musi wysyłać `Authorization`.
    - `/api/staging` bez parametru `limit` zwraca **gołą tablicę**, z `limit` — kopertę `{items,total,limit,offset}`. `/paged` sortuje `id DESC`, `/api/staging` nie sortuje wcale.
    - **Staging zawiera już WSZYSTKIE cztery typy**: `nowa`, `blad`, `zmiana_kluczowa`
      oraz — od 3d-1 — `wycofana` (149 wierszy na realnych cennikach MO1–MO10). Filtry
      i podgląd różnic da się przeklikać na realnych danych.
    - **⚠ Wiersz `wycofana` ma INNY kształt niż pozostałe i UI musi to znieść:**
      `snapshotJson` jest `null`, wszystkie pola `ean*` są `null`, `cenaZakupuNowa` i
      `zmianaPct` są `null`, a `stanNowy` to zawsze `0`. Podgląd różnic, który zakłada
      obecność `snapshotJson`, wywróci się na tym typie.
    - **Auto-zatwierdzone pozycje NIE POJAWIAJĄ SIĘ w stagingu** — import wpisuje je wprost
      do katalogu (§3, wiersz „Staging auto-accept"). UI nie ma czego dla nich pokazywać
      i nie ma ich liczyć; widać je dopiero w `historia_cen` (**Iteracja 10** — sprostowane
      2026-09-02: widok `/historia` z I5 czyta `audit_log`, nie `historia_cen`).
      Pola `ean*` i `snapshotJson` niosą realną treść (`snapshotJson` to rekord PO `Hq()`).
      W `ostrzezenie` pojawiają się komunikaty przeznaczone dla człowieka, w tym „Konflikt EAN —
      …", „błędny zapis nazwy: …", „nie wykryto rozmiaru opony (sprawdź ręcznie)" oraz —
      świadomie odtworzony błąd produkcji — „zapis naukowy ma tylko **null** cyfr znaczących"
      (backlog #11). UI ma je pokazywać, nie filtrować.
    - `zatwierdzilUzytkownikId`/`zatwierdzonoData` są w produkcji **martwe** — nic ich nigdy nie ustawia. Nie budować na nich UI.
  - **Gate:** fixtures FE + **Ania klika pełny cykl importu** na staging.
- **3f · Brzeg operacyjny importu** — ✅ **ZAMKNIĘTY 2026-09-01** (3f-1 ✅ · 3f-2 ✅ · 3f-3 ✅).
  **DOŁOŻONY DO ITERACJI 3 decyzją użytkownika (2026-09-01).**
  Zakres wydzielony z **Iteracji 11**, żeby Ania mogła przetestować **każdą ścieżkę importu
  używanej dziś produkcji**, a nie tylko efekt w stagingu. Dzielone na trzy części **po
  ŚCIEŻKACH IMPORTU, nie po warstwach** — inaczej niż 3d — bo każda część ma się kończyć czymś,
  co da się kliknąć. Podział BE/FE dałby Ani zero aż do końca drugiej części.
  - **⭐ TAK IMPORT DZIAŁA W PRODUKCJI — obraz, którego roadmapa wcześniej nie miała:**

    | Sposób dostarczania | Dostawcy | Częstotliwość |
    |---|---|---|
    | `url` — automatyczny polling | MO2, MO3, MO4, MO5, MO9 | **60 min każdy** |
    | `mail` — ręczne wgranie pliku | MO1, MO7, MO8, MO10 | — |
    | `upload` — ręczne wgranie | MO6 (wyłączony z importu) | — |

    ⚠ **SPROSTOWANIE FAKTU 2026-09-01 (3f-2), zmierzone w `db/snapshot.db`:** wcześniejszy
    zapis „40 / 60 / 60 / 60 / 1440 min" był nieprawdziwy. W bazie produkcji WSZYSCY
    dostawcy `url` mają `czestotliwosc_minuty = 60` — MO2 też (nie 40), MO9 też (nie 1440).
    `czestotliwoscMinuty = 10080` ma za to MO1, ale ma `sposobDostarczania = "mail"`, więc
    scheduler i tak go pomija. **Skutek dla 3f-3: automat obejmie PIĘCIU dostawców po 60 min,
    czyli 120 pobrań na dobę** — a nie mieszankę interwałów.

    **Połowa dostawców jedzie automatem.** Do 3f żadnej z tych ścieżek nie dało się uruchomić
    inaczej niż `curl`-em.
  - **⚠ LUKA 1, ZNALEZIONA PRZEGLĄDEM 2026-09-01: schedulera NIE BYŁO W ROADMAPIE.** `D4()`
    (`backend-index.cjs:48118-48131`) ustawia `setInterval` per dostawca i cyklicznie woła
    `L4(kod)`. Wyszukanie „scheduler / polling / setInterval" w tym pliku dawało **zero
    trafień** — mechanizm nie był przypisany do żadnej iteracji. Wchodzi do **3f-3**.
  - **⚠ LUKA 2: alerty PISANE przez import też nie miały właściciela.** Blok I6 obejmuje
    wyłącznie odczyt. Tworzy je import: `L4()` przy błędzie HTTP (`typ: "Błąd HTTP"`)
    i przy błędzie pobierania (`typ: "Błąd pobierania"`, dodatkowo `suppliers.status = "blad"`),
    oraz `upload` przy każdym wgraniu (`typ: "Ręczny upload"`, `status: rozwiazany`).
    **Dziś nasz `from-url` po nieudanym pobraniu MILCZY.** Wchodzi do **3f-2**.
  - **Decyzje zaklepane 2026-09-01 (NIE otwierać ponownie):**
    - **Zakres:** do 3f idzie `upload`, `synchronizuj-teraz`, `PATCH /api/dostawcy/{id}`,
      alerty pisane przez import, zakładki **dostawcy** i **wgrywanie**. **W I11 zostaje**
      `GET/PUT /api/config`, `GET /api/spedycja` i zakładki spedycja / shoper / katalog / ai.
    - **Scheduler portowany wiernie, ale za przełącznikiem `IMPORT_SCHEDULER`, domyślnie
      WYŁĄCZONYM.** Świadome odstępstwo: produkcja przełącznika nie ma. Powód — włączony
      scheduler na staging odpytywałby realne serwery dostawców co 40–60 min i podmieniał dane
      pod Anią w trakcie testów, co wygląda jak błąd, którym nie jest.
    - **Fallback `Wc()` NIE wchodzi.** Upload używa portu parserów z 3a; gdy parser rzuci —
      **czytelny błąd i alert**, zamiast cichej drugiej próby. `Wc()` (`:46910`) to osobny
      zestaw dziesięciu starych parserów zaszytych w bundlu, niezależnych od `parsers/*.cjs`;
      port wielkości sesji 3a, a fallback z definicji odpala się tylko wtedy, gdy główny parser
      zawiódł. Wolimy o tym WIEDZIEĆ, niż to zamieść. **Luka otwarta — właściciel do ustalenia.**

- **3f-1 · Wgrywanie plików** (BE+FE) — ✅ **2026-09-01 (#19).** `POST /api/dostawcy/{kod}/upload`
  (`:48243`) + strona `/konfiguracja` ze szkieletem sześciu zakładek i wypełnioną zakładką
  **wgrywanie**. Ania wgrywa cennik z przeglądarki; **gate 3e domknięty dla wszystkich
  czterech dostawców mailowych** (MO1, MO7 — CSV; MO8, MO10 — XLSX).
  - **Po tej części Ania wgrywa cennik z przeglądarki — i to ona DOMYKA GATE 3e** dla czterech
    dostawców mailowych (MO1, MO7, MO8, MO10).
  - **Backend:** multer (`memoryStorage`, limit **50 MB**, pole `plik`) — ta sama biblioteka
    i konfiguracja co produkcja (`:48150`). Po sparsowaniu: `tk()`, `updateSupplier`
    (`ostatniPlik`, `ostatniaSync`, `liczbaProduktow`, `status: aktywny`), alert
    „Ręczny upload" z podsumowaniem, audit log. Odpowiedź zawiera `podglad` — pierwsze
    5 rekordów.
  - **Rozstrzygnięcia sesji 3f-1 (2026-09-01, decyzje użytkownika):**
    - **Parsowanie klienckie — wariant „b": SAMA DETEKCJA, bez podglądu pozycji.** Portowane
      `FE()` + tablica `qu` + `nP`/`rP`/`$y`/`LE` (`src/pages/konfiguracja/detekcja.ts`,
      ok. 175 linii). Podgląd 8 pozycji z `oP()` (`tP()`, gałąź `HE()` dla MO1 i parser
      rozmiarów opon, ok. 305 linii) **NIE wchodzi** — byłby drugą implementacją mapowania,
      które ma już wierny port po stronie backendu (`src/import/legacy/`, charakteryzacja
      sha256 z 3a), i to tę kopię nic by nie pilnowało. Podgląd bierzemy z pola `podglad`
      (5 rekordów) w odpowiedzi uploadu — z portu parserów, czyli ze źródła prawdy.
    - **Limity: XLSX DOPUSZCZONY, próg 10 MB ZDJĘTY** — świadome odstępstwo. Wierne
      odtworzenie oznaczałoby, że MO8 i MO10 (oba XLSX, oba przychodzą mailem) są przez tę
      zakładkę niewgrywalne, czyli że gate 3e domknąłby się dla dwóch dostawców zamiast
      czterech. Oba ograniczenia były zresztą artefaktem tego, że `oP()` czytało CAŁY plik
      przez `arrayBuffer()`, żeby obejrzeć pierwsze 2048 znaków; my czytamy `slice(0, 64 KB)`,
      więc rozmiar przestał mieć znaczenie, a XLSX-a rozpoznajemy po nazwie pliku.
      Jedynym limitem zostaje **50 MB multera** po stronie backendu.
    - **Archiwizujemy — i to jest WIERNE.** ⚠ Wcześniejsza nota „produkcyjny upload NIE
      archiwizuje" była **nieprawdziwa i została skasowana**: archiwizacja siedzi wewnątrz
      `nq()` (`:48013-48022`, `zrodlo: "rdzen-nq"`, PRZED `parseByKod`), a upload idzie przez
      `nq()`. Zweryfikowane w wysłanym bundlu `mirror/backend/index.cjs`. Archiwizujemy tak
      samo — przed parsowaniem — żeby plik, który wywrócił parser, też został zapisany.
  - **⚠ ODSTĘPSTWO: `LE()` odsiewa puste nagłówki — naprawa defektu produkcji.** Oryginał
    dopasowuje nagłówki luźno w obie strony (`a.includes(b) || b.includes(a)`), a pusty łańcuch
    jest podciągiem KAŻDEGO tokenu. Cennik z kończącym średnikiem ma pustą ostatnią kolumnę,
    więc każda sygnatura dostaje komplet trafień i wygrywa najdłuższa, czyli **MO9**. Zmierzone
    na próbkach: MO4 2/6 → 8/8, MO5 2/6 → 8/8, MO7 6/6 → 8/8 — wszystkie trzy rozpoznają się
    jako **MO9 „z wysoką pewnością"**, gdy nazwa pliku nie pasuje do wzorca. Skutek jest cichy
    i kosztowny: cennik Handlopexu wgrany na katalog MO9. Pomijamy puste nagłówki; test
    regresyjny w `test/konfiguracja.detekcja.test.ts`.
  - **Zmierzone zachowanie detekcji, którego NIE ruszamy** (port 1:1): MO4 i MO5 mają
    identyczną sygnaturę nagłówków — po treści są nierozróżnialne i wygrywa MO4; rozstrzyga
    nazwa pliku. MO3 po samych nagłówkach przegrywa z MO9 (5 trafień własnych vs 6 cudzych),
    bo oryginał porównuje LICZBĘ trafień, nie udział. Oba przypadki mają wzorce nazwy pliku.
  - **Gate — rozliczony:** wgranie poprawnego pliku daje pozycje w stagingu, alert
    „Ręczny upload", `ostatniPlik`/`ostatniaSync`/`liczbaProduktow` i wpis w audycie ✅;
    plik nieparsowalny daje CZYTELNY błąd i alert `poziom: ostrzezenie` ✅; brak pliku → 400 ✅
    (przed sprawdzeniem dostawcy, jak w oryginale); nieznany dostawca → 404 ✅; MO6 → 400 ✅;
    test integracyjny przez ŻYWY backend ✅ (`test/integracja/wgrywanie.integracja.test.ts`);
    regresja `GET_dostawcy.json` / `GET_suppliers.json` i gate'y I1–I3 zielone ✅.
  - **Dowiezione:** BE `src/routes/suppliers.ts` (multer memoryStorage 50 MB, pole `plik`),
    `src/repos/alerts.ts` (SAMO `zapiszAlert`), `zapiszWynikImportu` rozszerzone o `ostatniaSync`.
    FE `src/pages/Konfiguracja.tsx`, `konfiguracja/{detekcja,wgrywanie,zakladki,typy}.ts`,
    `konfiguracja/Wgrywanie.tsx`, `components/ui/tabs.tsx` + `TabsContent`.
    `/konfiguracja` zdjęte z `placeholdery.ts` — router dalej ma **12 tras**.
  - **⚠ Do wiadomości kolejnych sesji FE: multipart przez `fetch` NIE DZIAŁA w jsdom** —
    żądanie wisi do timeoutu. Sprawdzone sondą na trywialnym serwerze HTTP; w środowisku
    `node` to samo żądanie przechodzi w kilkadziesiąt ms. Dlatego
    `test/integracja/wgrywanie.integracja.test.ts` ma `@vitest-environment node` i minimalną
    atrapę `Storage`. Testy widoku (MSW) zostają w jsdom i działają.

- **3f-2 · Dostawcy: URL, alerty i sterowanie** (BE+FE) — ✅ **2026-09-01.** Ścieżka URL
  domknięta, **awaria dostawcy przestała być cicha**, a Ania steruje dostawcami z panelu
  zamiast PATCH-em poza Reactem.
  - **⭐ Rozstrzygnięcia sesji 3f-2 (2026-09-01, decyzje użytkownika) — NIE otwierać ponownie:**
    - **DWA POBIERACZE ZOSTAJĄ OSOBNO (wariant „a").** `src/import/pobierz.ts` (port
      `downloadUrl`, node:http, 60 s) bez zmian; `L4()` dostał własny moduł
      `src/import/synchronizuj.ts` (fetch + AbortController, 30 s). Powód rozstrzygający:
      różnica jest OBSERWOWALNA — komunikaty undici („fetch failed", „This operation was
      aborted", „terminated") lądują dosłownie w treści alertu i tak wyglądają wszystkie
      339 alertów „Błąd pobierania" w `db/snapshot.db`. Sklejenie zmieniłoby też transport
      trasy `POST /api/import/from-url` z 3b i wymagałoby przemierzenia jej testów.
    - **`PATCH /api/dostawcy/{id}` DOSTAŁ LISTĘ PÓL EDYTOWALNYCH** — świadome odstępstwo
      (`POLA_EDYTOWALNE_DOSTAWCY` w `repos/suppliers.ts`): `status`, `url`,
      `czestotliwoscMinuty`, `sposobDostarczania`, `nazwa`, `email`, `formatPliku`,
      `parser`, `kodowanie`, `uwagi`. **Odcięte:** `importWylaczony` (inaczej bramkę D5 na
      MO6 zdejmuje się jednym PATCH-em — bramka z furtką nie jest bramką),
      `liczbaProduktow`/`ostatniPlik`/`ostatniaSync` (własność importu; `ostatniPlik`
      steruje `przeliczStatus`, więc dawało się nim podrobić status „aktywny"), `id`/`kod`.
      Odpowiedź idzie w projekcji kontraktowej — oryginał odsyła CAŁY wiersz, u nas
      wyciekłby `importWylaczony`.
      **Niespójność audytu ZOSTAJE 1:1** (zapis dziesięć pól, audyt cztery) — dlatego lista
      edytowalnych jest świadomie SZERSZA niż czwórka audytowana. Zawężenie jej do czwórki
      skasowałoby tę niespójność po cichu i uczyniło gate „pole spoza czwórki NIE trafia
      do audytu" niemożliwym do napisania.
    - **ALERTY BEZ DŁAWIKA — wiernie, problem przekazany do Iteracji 6.** Każda nieudana
      próba zostawia osobny wiersz. Zmierzone w produkcji: 339 alertów „Błąd pobierania"
      (MO3: 150, MO5: 102, MO4: 83, MO2: 4) wobec 4 × „Błąd HTTP" i 2127 × „Synchronizacja";
      rekord to 23 alerty na dobę dla samego MO3 (2026-08-08…10), a MO3+MO4+MO5 razem
      dawały wtedy ~60/dobę. Powód decyzji: liczba powtórzeń JEST sygnałem diagnostycznym
      (to z niej wiadomo, że trzej dostawcy padali nieprzerwanie przez tydzień), a dławik
      kasowałby go bezpowrotnie; właściwym miejscem na zwijanie powtórek jest ODCZYT,
      czyli widok z I6, gdzie decyzja ma komplet informacji. Wymóg wpisany DO BLOKU I6.
  - **Dowiezione:** BE `src/import/synchronizuj.ts` (port `L4()`), `repos/suppliers.ts`
    rozszerzone o `POLA_EDYTOWALNE_DOSTAWCY`, `POLA_AUDYTOWANE_DOSTAWCY`, `dostawcaPoId`,
    `dostawcaPoIdDoApi`, `odsiejPolaEdytowalne`, `aktualizujDostawce`, `oznaczBladDostawcy`;
    `routes/suppliers.ts` + `PATCH /api/dostawcy/:id` i `POST /api/dostawcy/:kod/synchronizuj-teraz`.
    FE `pages/konfiguracja/dostawcy.ts` + `Dostawcy.tsx`, zakładka „dostawcy" wypełniona,
    `defaultValue="dostawcy"` przywrócone. Testy: `test/dostawcy.synchronizacja.test.ts` (12),
    `test/dostawcy.patch.test.ts` (12), FE `test/konfiguracja.dostawcy.test.tsx` (12),
    `test/integracja/dostawcy.integracja.test.ts` (6, żywy backend + żywy serwer dostawcy).
  - **Gate — rozliczony:** serwer 500 → alert „Błąd HTTP" + `status: blad` ✅; serwer nie
    odpowiada → alert „Błąd pobierania" + `status: blad` ✅; sukces → `ostatniaSync`,
    `ostatniPlik`, `liczbaProduktow`, `status: aktywny` ✅; `wstrzymany` ręcznie PRZECHODZI,
    automatem NIE ✅; `czestotliwoscMinuty` w audycie, pole spoza czwórki nie ✅; testy stawiają
    LOKALNY serwer HTTP na porcie efemerycznym, `fetch` niemockowany ✅; regresja
    `GET_dostawcy.json`/`GET_suppliers.json` i gate'y I1–I3 zielone ✅ (BE 425, FE 183).
  - **⚠ Do wiadomości kolejnych sesji: `ostatniaSync` znaczy „kiedy PRÓBOWALIŚMY", nie
    „kiedy się udało".** `L4()` ustawia ją w OBU gałęziach błędu (`:48067`, `:48110`),
    nietknięty zostaje wtedy `ostatniPlik`. Widok podpisuje to pole „ostatnia próba".
  - **⚠ Wyjątek PARSERA daje alert typu „Błąd pobierania" — i to jest WIERNE.** Oryginał ma
    jeden blok `catch` wokół całości (`:48100`); po usunięciu fallbacku `Wc()` błąd parsera
    trafia tam bezpośrednio. Nazwa typu jest myląca, ale zostaje 1:1 — powód i tak jest
    w treści alertu, a widok z I6 grupuje po `typ` i musi widzieć te same wartości
    co produkcja.
  - **⚠ `freq-injection.js` JEST WCHŁONIĘTY — do skasowania z produkcji przy wdrożeniu.**
    Presety `[5,15,30,60,120,240,360,720,1440,2880,10080]`, `fmt()` i kotwica
    `data-testid="supplier-config-<KOD>"` są w `pages/konfiguracja/dostawcy.ts`. Zniknęła
    mapa `kod → id` (skrypt musiał ją trzymać, bo pracował na DOM-ie; React ma cały rekord)
    i cała warstwa `MutationObserver`. ⚠ Komentarz w samym skrypcie („whitelist pól:
    status, url, czestotliwoscMinuty, sposobDostarczania") jest BŁĘDNY — to lista audytu,
    nie zapisu; do 3f-2 żadnej listy zapisu nie było.
  - **Oryginalna karta `ZT()` NIE MIAŁA żadnej edycji** (`frontend-index.js:25661-25806`) —
    tylko „Synchronizuj" i „Wgraj plik". Edycja pól to nasz dodatek i właśnie po to
    powstał skrypt injection.
  - **Backend (dowiezione):** port `L4()` (`:48038-48116`): `!response.ok` → alert „Błąd HTTP"
    + `status: blad`; wyjątek → alert „Błąd pobierania" + `status: blad`; sukces →
    `ostatniaSync`, `ostatniPlik`, `liczbaProduktow`, `status: aktywny`. Flaga „ręcznie"
    pomija blokadę `status === "wstrzymany"`. Trasy:
    `POST /api/dostawcy/{kod}/synchronizuj-teraz` (`:48238`), `PATCH /api/dostawcy/{id}`
    (`:48227`).
  - **⚠ SPROSTOWANIE 2026-09-01 (fakt zweryfikowany w wysłanym bundlu): PRODUKCJA MA DWA
    RÓŻNE POBIERACZE, a nie jeden.** Wcześniejszy zapis „`pobierz.ts` rozszerzone do pełnej
    semantyki `L4()`" był błędny — rozszerzenie tamtego modułu po cichu zmieniłoby zachowanie
    `POST /api/import/from-url` z 3b, który go używa.

    | | `downloadUrl` (extensions.cjs:25-46) | `L4()` (rdzeń, `:48038`) |
    |---|---|---|
    | Transport | `node:http` / `node:https` | `fetch` + `AbortController` |
    | Timeout | **60 s** (`req.setTimeout`) | **30 s** (`setTimeout` → `abort`) |
    | Przekierowania | ręcznie, rekurencją po `location` | zostawione `fetch` (sam śledzi) |
    | Woła to | `POST /api/import/from-url` | `synchronizuj-teraz` + scheduler (3f-3) |
    | Nasz port | ✅ `src/import/pobierz.ts` (3b) | ⬜ **do napisania w 3f-2** |

    Nasz `pobierz.ts` jest portem **`downloadUrl`**, nie `L4()` — mówi to jego własny
    nagłówek. Zostaje bez zmian; `L4()` dostaje osobny moduł.
  - **`src/repos/alerts.ts` JUŻ ISTNIEJE** (3f-1) — `zapiszAlert` plus typy
    `PoziomAlertu`/`StatusAlertu`, port `U.addAlert` (`:44954`). Dołóż wywołania dla
    „Błąd HTTP" i „Błąd pobierania"; odczyt dalej należy do I6.
  - **⭐ CO ZOSTAWIŁA SESJA 3f-1 — czytaj przed planowaniem:**
    - **`zapiszWynikImportu` przyjmuje już opcjonalne `ostatniaSync`** (`repos/suppliers.ts`).
      `L4()` ustawia oba znaczniki, więc podaj je oba — bez tego pola trasy z 3b zapisują
      tylko `ostatniPlik` i ta różnica jest w oryginale, nie u nas.
    - **Zakładka „dostawcy" ma gotowe miejsce.** `src/pages/Konfiguracja.tsx` renderuje
      zaślepki z `konfiguracja/zakladki.ts` — dla `dostawcy` ustaw `domykaBlok: null`
      i dołóż `<TabsContent value="dostawcy">`. Zdejmij też komentarz przy `defaultValue`:
      3f-1 otwiera ekran na „wgrywanie" TYLKO dlatego, że tamta zakładka była wtedy jedyną
      wypełnioną — po 3f-2 wraca `defaultValue="dostawcy"`, jak w oryginale (`:26298`).
    - **`GET /api/dostawcy` liczy `liczbaProduktow` W LOCIE z tabeli `products`**
      (`repos/suppliers.ts:106-111`), a nie z kolumny `suppliers.liczba_produktow`. Po
      imporcie pozycje siedzą w STAGINGU, więc to pole zostaje zerowe do czasu zatwierdzenia.
      Nie buduj na nim UI „ile wczytano" — do tego jest `ostatniPlik`/`ostatniaSync`.
      Kosztowało to jedną fałszywą asercję w teście integracyjnym 3f-1.
    - **Multipart przez `fetch` nie działa w jsdom** — jeśli 3f-2 doda test wysyłający
      `FormData`, musi mieć `@vitest-environment node`. Szczegóły w bloku 3f-1.
    - **Klient uploadu jest w `src/pages/konfiguracja/wgrywanie.ts`** (`wgrajPlik`), a detekcja
      w `detekcja.ts`. „Synchronizuj teraz" to inna ścieżka (bez pliku) — nowy moduł, nie
      dopisek do tamtego.
  - **⚠ `PATCH /api/dostawcy/{id}` ma niespójność do odtworzenia 1:1:** aktualizuje dostawcę
    CAŁYM ciałem żądania, ale do audit logu wpisuje wyłącznie zmiany w czterech polach —
    `status`, `url`, `czestotliwoscMinuty`, `sposobDostarczania`. Zmiana czegokolwiek innego
    przechodzi bez śladu w audycie.
  - **Frontend (dowiezione):** zakładka **dostawcy** — lista z URL, częstotliwością, sposobem
    dostarczania, statusem i `ostatniaSync`; akcje „Synchronizuj teraz" i edycja pól,
    z wchłoniętym `freq-injection.js`.

- **3f-3 · Scheduler** (BE) — ✅ **2026-09-01.** Port `D4()` (`:48118-48131`) za `IMPORT_SCHEDULER`.
  **Pięciu dostawców URL odpytuje się samo — ale wyłącznie wtedy, gdy ktoś świadomie włączy.**
  - **⭐ Rozstrzygnięcia sesji 3f-3 (2026-09-01, decyzje użytkownika) — NIE otwierać ponownie:**
    - **START W `server.ts` PO `listen()`, nie w `stworzApp`** — świadome odstępstwo
      w UMIEJSCOWIENIU, bez zmiany zachowania procesu produkcyjnego. Oryginał woła `D4()`
      w `M4()` (`:48167`), czyli w odpowiedniku `stworzApp`, przed rejestracją tras
      (zweryfikowane grafem wywołań: `function D4(` raz i `D4(` dwa razy łącznie
      w `mirror/backend/index.cjs` — jedno wywołanie, żadnej trasy, żadnego duplikatu).
      Powód odstępstwa: `stworzApp` buduje KAŻDY test suity (supertest, `test/gate/aplikacja.ts`),
      więc wierne umiejscowienie przepuszczałoby całą suitę przez kod stawiający timery
      i nie miałoby gdzie zawiesić sprzątania. `server.ts` ma już `zamknij()` na SIGTERM/SIGINT
      i tam scheduler jest gaszony. W produkcji `stworzApp` jest wołane raz, tuż przed
      `listen()`, więc zachowanie procesu jest identyczne. Pilnuje tego test czytający
      `src/app.ts` i sprawdzający, że nie ma w nim `stworzScheduler` ani `setInterval`.
    - **`PATCH /api/dostawcy/{id}` PRZEPLANOWUJE SCHEDULER** — świadome odstępstwo.
      `D4()` nie jest wołane z żadnej trasy, więc w produkcji zmiana „co 4 godz." daje
      „Zapisano", a automat chodzi ze starym interwałem AŻ DO RESTARTU procesu. Do 3f-2 było
      to niewidoczne (częstotliwość zmieniało się PATCH-em z konsoli); po wchłonięciu
      `freq-injection.js` jest na to przycisk w panelu, więc cisza po zapisie stała się
      zachowaniem mylącym. ⚠ **Koszt przyjęty świadomie:** przebudowa jest HURTOWA (`D4()`
      czyści całą mapę), więc PATCH zeruje odliczanie WSZYSTKIM dostawcom, nie tylko
      zmienionemu — PATCH częstszy niż interwał zagłodziłby automat. Przeplanowanie **nigdy**
      nie odpala przebiegu startowego (inaczej każdy zapis w panelu waliłby w pięć serwerów
      dostawców naraz) i jest **nie-operacją**, gdy automat nie działa — czyli zawsze przy
      wyłączonym `IMPORT_SCHEDULER`. Podpięte przez `przeplanujScheduler?: () => void`
      w `ZaleznosciApp`/`ZaleznosciDostawcow`; pominięte (testy, dev) ⇒ zachowanie 1:1.
    - **PRZEBIEG STARTOWY ZA OSOBNYM PRZEŁĄCZNIKIEM `IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG`**
      (domyślnie WYŁĄCZONY). `D4()` stawia sam `setInterval`, więc po włączeniu automatu
      przez GODZINĘ nie dzieje się nic — dla produkcji bez znaczenia (proces żyje ciągle),
      dla testów Ani na stagingu to różnica między „widzę, że działa" a „nie wiem, czy
      wystartowało". Osobna zmienna, a nie zmiana samego `D4()`, **żeby proces produkcyjny
      został 1:1**: przy obu domyślnych wartościach zachowanie jest identyczne z oryginałem.
      Rozrzut `ODSTEP_PIERWSZEGO_PRZEBIEGU_MS = 5 s` między dostawcami, żeby piątka nie
      ruszyła w tej samej sekundzie. Sprawa rozstrzygana ODRĘBNIE od samego przełącznika
      `IMPORT_SCHEDULER`, który był zaklepany wcześniej.
    - **DRUGA LINIA LOGU Z POWODAMI POMINIĘCIA** — dodatek wyłącznie logowy, zero wpływu
      na dobór. Linia `[scheduler] zaplanowano N dostawców z URL polling` zostaje co do
      znaku 1:1 (`:48130`); pod nią nasza `[scheduler] pominięto: MO1 (sposób dostarczania:
      mail), …`. Powód: bez niej `zaplanowano 0` nie mówi, czy to konfiguracja, czy pułapka
      opisana niżej. Włączony scheduler loguje też jawnie, gdy jest wyłączony.
  - **⚠ ZNALEZIONE W TEJ SESJI — DWA POJĘCIA STATUSU (backlog #17 i #18, oba ODTWORZONE 1:1).**
    `D4()` dobiera po `U.listSuppliers()`, a ta funkcja **przelicza `status` w locie**
    (`:45026`); `L4()` sprawdza status z **surowego wiersza** (`getSupplierByKod`, `:48039`).
    Trzy konsekwencje, wszystkie portowane bez zmian:
    1. **Samozakleszczenie 30 dni** — dostawca bez udanego importu od ponad 30 dni ma
       wyliczony status „wstrzymany", więc wypada z automatu, więc nigdy się nie odświeży,
       więc już nie wróci bez ręcznego „Synchronizuj teraz" (backlog #17).
    2. **Świeża baza planuje ZERO** — przy `ostatniPlik = null` i zerze produktów wyliczony
       status to „wstrzymany" u WSZYSTKICH. Dotyczy też stagingu ze snapshotu: `db/snapshot.db`
       ma u piątki `url` `ostatni_plik = 2026-08-13`, czyli **po 2026-09-13 planuje zero**.
    3. **Wstrzymany dostawca ze świeżym `ostatniPlik` DOSTAJE timer** — bo `D4()` widzi
       status wyliczony („aktywny"), a blokada siedzi dopiero w `L4()`. Pobrania nie ma,
       więc skutek dla użytkownika jest właściwy, ale mechanizm inny niż sugeruje kod;
       gate „wstrzymany wyklucza z automatu" jest rozliczony na poziomie **braku pobrania**,
       nie braku timera. Objaw widoczny dla Ani (karta pokazuje „aktywny" po zapisaniu
       „wstrzymany") opisany w `docs/instrukcja-testow-I3.md` §4 pkt 11 (backlog #18).
    Propozycje napraw są w backlogu; **właściciel do ustalenia**, nie doklejamy ich do 3f-3,
    bo #17 zmienia dobór dostawców, a #18 dokłada 19. klucz do kontraktu `GET /api/dostawcy`.
  - **Dowiezione:** `src/import/scheduler.ts` (`stworzScheduler` → `uruchom` / `przeplanuj` /
    `zatrzymaj` / `czyDziala` / `liczbaTimerow`); `config/env.ts` + `IMPORT_SCHEDULER`
    i `IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG` (oba domyślnie wyłączone); `server.ts` — jedna
    instancja `synchronizujDostawce` na proces podawana i trasie, i schedulerowi, start pod
    warunkiem, gaszenie w `zamknij()`; `app.ts` + `routes/suppliers.ts` — przewód
    `synchronizuj` i `przeplanujScheduler`. Testy: `test/scheduler.test.ts` (24).
    Dokumentacja: `.env.example`, `docs/instrukcja-testow-I3.md` §3.13 i §4 pkt 11.
  - **Gate — rozliczony:** bez `IMPORT_SCHEDULER` zero timerów ✅ (plus test pilnujący, że
    `app.ts` nie zawiera `stworzScheduler` ani `setInterval`); dobór `url` + URL +
    częstotliwość + status ✅; `czestotliwoscMinuty = 0` wypada ✅; trzykrotne `uruchom()`
    nie mnoży timerów, a stary interwał jest GASZONY, nie tylko nadpisywany ✅;
    `wstrzymany` — zero pobrań automatem, ręczna synchronizacja przechodzi ✅; interwał
    faktycznie ODPALA pobranie — **żywy serwer HTTP na porcie efemerycznym, `fetch`
    niemockowany, PRAWDZIWE timery** ✅; awaria dostawcy nie wywraca pętli ✅; po
    `zatrzymaj()` nic nie wisi, interwały `unref`owane (sprawdzone
    `process.getActiveResourcesInfo()`) ✅; scheduler woła synchronizację BEZ flagi
    `recznie` ✅; PATCH przeplanowuje, ale nie odpala przebiegu startowego ✅; pułapki
    30 dni i świeżej bazy pokryte testami ✅. Regresja: gate'y I1–I3 zielone, **BE 449
    (425 + 24), FE 183** ✅. lint / typecheck / build / test czyste ✅.
  - **⚠ SZTUCZKA TESTOWA DO WIADOMOŚCI KOLEJNYCH SESJI:** krótki interwał bez fałszywych
    timerów bierze się z UŁAMKOWEJ `czestotliwoscMinuty` (0,005 min = 300 ms) wpisanej wprost
    do bazy. SQLite trzyma taką wartość jako REAL mimo deklaracji kolumny INTEGER, więc kod
    produkcyjny nie musi o tym wiedzieć — mnożenie `× 60 × 1000` jest to samo. Dzięki temu
    cały plik testowy chodzi na prawdziwych timerach i prawdziwym HTTP w ~8 s.
  - **⚠ `ostatniPlik` W ZASIEWIE TESTOWYM MUSI BYĆ ŚWIEŻY** — inaczej `przeliczStatus` daje
    „wstrzymany" i dostawca w ogóle nie kwalifikuje się do automatu. Kosztowało to trzynaście
    fałszywych porażek przy pierwszym uruchomieniu `test/scheduler.test.ts`.
  - **Dobór dostawców — portowany 1:1:** `sposobDostarczania === "url"` && `url` &&
    `czestotliwoscMinuty` && `status !== "wstrzymany"`, w tej kolejności (`:48123`). Ponowne
    wywołanie czyści poprzednie interwały (`clearInterval` po mapie); `unref()` na
    interwałach. ⚠ Warunek na status widzi wartość PRZELICZANĄ — patrz ostrzeżenie wyżej.
  - **Dlaczego to był osobny blok:** jedyna część z timerami w tle, jedyna bez UI i jedyna,
    która w razie pomyłki zaczyna sama odpytywać serwery dostawców.
  - **⭐ WEJŚCIE Z SESJI 3f-2 — ROZLICZONE, zostaje jako zapis zmierzonych faktów:**
    - **Funkcja pobierająca nie została napisana drugi raz** ✅ — scheduler woła
      `synchronizujDostawce()` z `src/import/synchronizuj.ts` **BEZ opcji**, jak oryginał
      (`L4(n.kod)`, `:48127`), więc blokada `status === "wstrzymany"` działa na automacie.
      Flaga `{recznie: true}` została wyłącznie przy trasie `synchronizuj-teraz` (`q4()`);
      osobny test sprawdza wprost, że scheduler przekazuje sam kod.
    - **Jedna instancja na proces** ✅ — tworzy ją `server.ts` (nie `app.ts`, bo tam
      przeniósł się start) i podaje i trasie, i schedulerowi.
    - **Ile realnie odpali automat:** pięciu dostawców `url` × 60 min = **120 pobrań/dobę**
      (patrz sprostowanie faktu w bloku 3f — snapshot, nie „40/60/1440").
    - **Alerty nie mają dławika** (decyzja 3f-2). Trwale padnięty dostawca da ~24 alerty
      na dobę, trzej padnięci naraz ~72 — to zmierzone zachowanie produkcji, nie regres.
      Dlatego `IMPORT_SCHEDULER` domyślnie WYŁĄCZONY ma tu drugie uzasadnienie: bez niego
      staging nie zaleje sobie tabeli alertów w trakcie testów Ani.
    - **`unref()` na interwałach jest KONIECZNY, nie kosmetyczny** ✅ zrobione i sprawdzone
      przez `process.getActiveResourcesInfo()`. Wiszący timer trzyma proces i wywraca
      `afterAll` w testach. Przy okazji: `L4()` produkcji nie czyści
      swojego 30-sekundowego timera po odrzuconym `fetch` — nasz port czyści go w `finally`
      (odstępstwo opisane w `synchronizuj.ts`), więc scheduler nie zostawia śmieci.
- **Wejście z triażu (2026-08-25, `rebuild-backlog.md`):**
  - **#6** bieżące poprawki parserów (flagsfix, mo8…) → objęte **portem**, zero osobnej pracy.
  - **#4 `uwaga_cena`** (cena „na zapytanie") → kolumna `products.uwaga_cena` **dodana w 3b** (osobna migracja, bez #3); propagacja w imporcie (`acceptStaging`) → **3d-2**; endpointy → **I12**. **Sprostowanie 2026-08-27 (3d-1): endpointy są DWA, nie jeden** — produkcja realizuje to monkey-patchem `mirror/backend/uwaga_cena_patch.cjs`, który dokłada `GET /api/products/uwagi-cena` ORAZ `GET /api/products/hold-reasons` (powód wstrzymania liczony w locie, 5 przypadków). Obu brak w zamrożonym kontrakcie — dopisać do openapi razem, w I12. Frontend tooltip = injection → późniejsza iteracja.
  - **#5 `frazy`** → ✅ **zbadane i rozstrzygnięte (3a, 2026-08-26): to NIE jest normalizacja w adapterze.** `frazy_migruj.cjs` to samodzielny skrypt jednorazowy czytający `/tmp/frazy_migracja.json` i wołający `selly/client.cjs` (PUT do Selly); w `common.cjs` słowo „frazy" nie występuje (0 trafień). **Poza zakresem I3** — do rozważenia przy I8 (Selly).
- **Ścieżki (GATE):** staging×9 (3× odczyt ✅ 3b, 6× mutacje ✅ 3d-2), import×2 ✅ 3b, ai-fallback ✅ 3b, overrides×3 (`GET`, `POST`, `DELETE {id}` — `PUT` NIE ISTNIEJE) ✅ 3d-2.  **Fixtures:** `GET_staging.json` ✅ 3b, `GET_staging_paged.json` ✅ 3b, **`GET_overrides.json` ✅ 3d-2**.
- **DoD — ROZLICZONY 2026-09-01, ITERACJA ZAMKNIĘTA:** charakteryzacja parserów zielona (port 1:1 z oryginałem na próbkach MO1–MO10) ✅ 3a; import przetwarza plik/URL do stagingu ✅ 3b; `tk()` odtwarza dopasowanie ✅ 3c oraz auto-approve/wycofanie ✅ 3d-1; overrides Marty respektowane (import nie nadpisuje) ✅ 3d-1; `acceptStaging` + endpointy mutacji ✅ 3d-2; widok `/staging` ✅ 3e; **wszystkie gate'y 3a–3f zielone** ✅; fixtures przez GATE ✅. **„Ania przeklika PEŁNY cykl importu"** ✅ — wgrywanie z przeglądarki 3f-1, ścieżka URL i alerty 3f-2, automat 3f-3. **Wszystkie trzy produkcyjne ścieżki importu (mail/upload → wgranie ręczne, url → „Synchronizuj teraz", url → automat) są uruchamialne z przeglądarki** ✅. Do 2026-09-01 punkt ten wskazywał na I11; zakres został stamtąd wydzielony do 3f.
  **Stan bramek na zamknięcie:** BE **449 testów** w 30 plikach, FE **183** w 13; lint / typecheck / build czyste.
- **⚠ CO ZOSTAJE OTWARTE PO ITERACJI 3 — świadomie, z właścicielem:** zamknięcie iteracji NIE znaczy, że nie ma tu długu. Cztery rzeczy wychodzą dalej i **żadna nie blokuje I4**:
  - **Fallback `Wc()` NIE wchodzi** (decyzja zaklepana 2026-09-01, blok 3f) — dziesięć starych parserów zaszytych w bundlu, port wielkości sesji 3a. **Luka otwarta, właściciel do ustalenia.**
  - **Alerty bez dławika** (decyzja 3f-2) → zwijanie powtórek należy do **widoku alertów w Iteracji 6**, wymóg wpisany w tamten blok. Po włączeniu automatu z 3f-3 tempo to ~24 alerty/dobę na trwale padniętego dostawcę.
  - **Dwa pojęcia statusu dostawcy** (backlog **#17** i **#18**, znalezione w 3f-3, odtworzone 1:1) — samozakleszczenie po 30 dniach, świeża baza planująca zero, oraz „wstrzymany" niewidoczny na karcie. Propozycje napraw w backlogu; **właściciel do ustalenia**, bo #17 zmienia dobór dostawców do automatu, a #18 dokłada klucz do kontraktu `GET /api/dostawcy` (przenagranie `GET_dostawcy.json` i `GET_suppliers.json`).
  - **`PATCH /api/markups/{id}` i `/api/promotions/{id}` zapisują CAŁE ciało żądania** (backlog #14, wejście z 3f-2) → **Iteracja 4**, wymóg wpisany w tamten blok.

---

### Iteracja 4 — Narzuty + promocje (ceny)
- **Status:** ⬜  **Sesje:** 1–2  **Zależy od:** 2, 3
- **Cel (Ania klika):** ustawia narzut/promocję, widzi przeliczoną `cena_sprzedazy`/marżę w katalogu.
- **Backend:** markups `Bt` (`GET/POST /api/markups`, `PUT/DELETE /api/markups/{id}`), promotions `hn` (`/api/promotions`, `/api/promotions/{id}`). Reguły przeliczania ceny sprzedaży.
  - **⚠ ZALEGŁOŚĆ Z ITERACJI 3 — DOMKNĄĆ TUTAJ (zapisane 2026-08-27 przez 3d-1).** Narzuty
    i promocje wchodzą do ceny NIE TYLKO przez `/api/markups`, ale też w DWÓCH miejscach
    importu: `acceptStaging` (`backend-index.cjs:44884-44892`) i `addProductsBulk`
    (`:44773-44783`) wołają `__bridgePickMarkup`/`__bridgePickPromo` i przeliczają
    `cenaSprzedazy` = `floor(zakup × (1+narzut/100) × (1−rabat/100) × (1+vat/100))`,
    ustawiając przy okazji `marzaPct` i `status`. Iteracja 3 świadomie tego NIE portuje,
    bo w I3 tabele `markups`/`promotions` są puste, więc gałąź `if (__mm || __pp)` nigdy
    nie wchodzi i zachowanie jest identyczne. **Od momentu, gdy I4 pozwoli wpisać pierwszą
    regułę, ta luka przestaje być nieszkodliwa** — import zacznie się rozjeżdżać z produkcją.
    Do przeniesienia razem z pomocniczymi `__bridgeMarkupMatches`/`__bridgePromoMatches`
    (`:44600-44660`) i `recalcPricesFromRules` (`:44658`).
    **Potwierdzone POMIAREM w 3d-2 (2026-09-01), nie lekturą:** charakteryzacja `acceptStaging`
    wycina tych pomocników NAPRAWDĘ i uruchamia oryginalną gałąź cenową obok naszego portu,
    który jej nie ma — na pustych tabelach obie strony dają identyczny wynik. Pierwsza reguła
    wpisana w I4 natychmiast je rozjedzie, i wtedy ten test zapali się jako pierwszy.
  - **⚠ WEJŚCIE Z BLOKU 3f-2 (2026-09-01): `PATCH /api/markups/{id}` i `/api/promotions/{id}`
    zapisują CAŁE ciało żądania.** `updateMarkup` (`:44975`) i `updatePromotion` (`:44998`)
    robią `X.update(...).set(e)` bez listy pól, a trasy (`:48701`, `:48724`) podają im
    `{...c.body, zmienilUzytkownikId, zmienionoData}` — czyli wszystko, co przyszło od
    użytkownika. **Stawka jest tu wyższa niż przy dostawcach:** obie metody wołają po zapisie
    `recalcPricesFromRules()`, więc pole wpuszczone przez pomyłkę przelicza ceny CAŁEGO
    katalogu. Analogiczna dziura w `PATCH /api/dostawcy/{id}` została w 3f-2 zamknięta listą
    pól edytowalnych — **ta iteracja ma podjąć tę samą decyzję świadomie**, a nie odziedziczyć
    ją przez przeoczenie. Precedens jest po obu stronach: produkcja SAMA używa listy pól
    w `PUT /api/staging/:id` (`:48598`, osiem pól), więc lista nie jest wymysłem odbudowy.
    Uwaga: `zmienilUzytkownikId` i `zmienionoData` ustawia SERWER — na listę wejść nie mogą.
    Wzorzec do skopiowania: `POLA_EDYTOWALNE_DOSTAWCY` w `rebuild/backend/src/repos/suppliers.ts`
    + testy `test/dostawcy.patch.test.ts`. Pełny rozbiór: `rebuild-backlog.md` #14.
  - **⚠ Sprawdź, czy audyt nie ma tej samej niespójności co dostawcy.** Przy dostawcach
    zapis obejmuje wszystkie pola, a audyt tylko cztery — i to jest odtworzone 1:1. Przy
    narzutach oryginał loguje `c.body` w całości (`:48709`), więc niespójności tam NIE MA;
    warto to potwierdzić przed portem, żeby nie skopiować rozwiązania z niewłaściwego miejsca.
- **Frontend:** widok `/narzuty` (reguły narzutów + promocje). Kolumna „Promocja" w `/katalog` (I2)
  już istnieje w domyślnym zestawie, dziś renderuje puste — I4 dostarcza dla niej dane.
- **Ścieżki (GATE):** markups×2, promotions×2.  **Fixtures:** `GET_markups.json`, `GET_promotions.json`.
- **DoD:** narzuty/promocje liczą ceny zgodnie z oryginałem; fixtures przez GATE; ceny widoczne w katalogu.

---

### Iteracja 5 — Historia
- **Status:** ✅ **2026-09-02** (`15-FEATURE-historia-zmian`, PR #23)  **Sesje:** 1  **Zależy od:** 3
- **Cel (Ania klika):** otwiera `/historia`, widzi log importów/eksportów/edycji z audytu — ✅ dowiezione.
- **Backend — sprostowanie faktu, na którym stał ten blok: `Wa` to tabela `history`, NIE `historia_cen`**
  (`deminified/backend-index.cjs:43833`, jedno wystąpienie `Wa =`, brak cieniowania).
  `GET /api/history` czyta `history` (`listHistory()`, `:44962`); `GET /api/history/meta` i
  `/paged` **nie** czytają `history` ani `historia_cen` — czytają **`audit_log`**
  (`listAudit(5000)`, `:45068`) i mapują `akcja → typ` sztywnym słownikiem pięciu wartości
  (`:48341`/`:48363`), reszta akcji odpada (`filter(Boolean)`). `historia_cen` (RAW SQL,
  `analytics_module.cjs`) do tego widoku nie należy w ogóle — jej pisarz i czytelnik są opisane
  w bloku **Iteracja 10**. Wszystkie trzy trasy za `requireAuth` (odstępstwo D1, §3) — w
  oryginale `meta`/`paged` są publiczne przez potrójną (nie podwójną) rejestrację, patrz niżej.
- **Filtr pięciu akcji audytu — FAKT rozstrzygnięty, port 1:1 (decyzja D2).** Backend rozpoznaje
  wyłącznie `upload_pliku`, `import_cennika`, `eksport_csv`, `eksport_shoper`, `edycja_produktu`.
  Z dwunastu akcji, które nasz backend zapisuje dziś (3d-2/3f-1/3f-2), przez ten filtr przechodzą
  **dwie**: `upload_pliku` i `import_cennika`. `import_z_url`, `import_pliku`,
  `synchronizacja_reczna` i reszta są w tym widoku niewidoczne — dokładnie jak w produkcji, to
  port 1:1, nie usterka. **`synchronizacja_reczna` (NULL `szczegoly_json`, `encja_id`
  niezłączalny z `suppliers`) i tak wypada na tym filtrze i do widoku nie dociera** — ostrzeżenie
  o niej dotyczy `/api/audit-log`, przeniesione do bloku **Iteracja 12**.
  Parser `szczegoly_json` (`src/historia/mapowanie.ts::parsujSzczegoly`, `try/catch` → `{}`,
  1:1 z `:48338-48342`) znosi NULL i zepsuty JSON dla WSZYSTKICH wierszy audytu (przed filtrem
  akcji), pokryte testami jednostkowymi i integracyjnymi.
- **Frontend:** widok `/historia` — tabela (Data/Typ/Dostawca/Użytkownik/Pozycji/Szczegóły) +
  filtry (szukaj/typ/dostawca) + paginacja 25/50/100, wpięty w router/shell.
  `isLoading`/`isError` wg wzorca `Staging.tsx` (odstępstwo D5).
- **Fakty do zapamiętania (dla kolejnych sesji):**
  - **Tabela `history` nie ma w rebuildzie pisarza.** Jedyny pisarz oryginału to ręczna edycja
    produktu w katalogu (`PUT`/`PATCH /api/products/:id`, `:48435`/`:48475`) — poza zakresem
    tego ticketa. Do czasu jej sportowania `GET /api/history` zwraca na stagingu `[]`.
  - **Rejestracji `/meta`+`/paged` w oryginale są TRZY, nie dwie:** rdzeń bez auth (`:48335`,
    `:48352`) + `mirror/backend/pagination_module.cjs:136,168` z auth, ładowany dwukrotnie
    (`extensions.cjs:449-451` + wprost z `index.cjs`). Wygrywa rdzeń, więc w produkcji trasy są
    publiczne. `docs/spec-backend.md` §2 mówiło o dwóch — sprostowane w tym samym tickecie.
  - **Clamp paginacji różni się od `/api/staging/paged`:** tu fallback `|| 1`/`|| 50` stoi PO
    `parseInt`, więc `NaN` nie wycieka; w `pagination_module` używanym przez staging `||` działa
    na stringu i `NaN` dochodzi do SQLite. Zastane, nie do ujednolicenia.
  - **`/paged` czyta tylko 5000 najświeższych wierszy audytu PRZED filtrowaniem** —
    przy większym `audit_log` starsze wpisy stają się niedostępne niezależnie od strony, a
    `total` przestaje być liczbą wszystkich wpisów. Port 1:1.
- **Ścieżki (GATE):** history×3.  **Fixtures:** `GET_history.json`, `GET_history_meta.json`, `GET_history_paged.json`.
- **DoD:** ✅ trzy trasy za auth przechodzą GATE (kształt 1:1 + komplet kluczy); mapowanie
  akcja→typ i clamp odtworzone 1:1; NULL/zepsuty JSON i `encja_id` niezłączalny nie wywracają
  odczytu (testy); widok wpięty, filtry i paginacja działają; `lint`/`typecheck`/`test`/`build`
  czyste po obu stronach. Szczegóły: `docs/tickets/15-FEATURE-historia-zmian/`.

---

### Iteracja 6 — Alerty
- **Status:** ⬜  **Sesje:** 1  **Zależy od:** 3
- **Cel (Ania klika):** otwiera `/alerty`, widzi i obsługuje alerty.
- **Backend:** `GET /api/alerts`, `PATCH /api/alerts/{id}` (`Ki`).
- **⚠ PISANIE alertów NIE należy do tej iteracji (ustalone 2026-09-01).** Ta iteracja dowozi
  wyłącznie ODCZYT i zmianę statusu. Alerty tworzy IMPORT — przy błędzie HTTP, przy błędzie
  pobierania i przy ręcznym uploadzie — i to wchodzi w blokach **3f-1** i **3f-2**, razem
  z repozytorium `src/repos/alerts.ts` (samo `zapiszAlert`). **Repo POWSTAŁO w 3f-1
  ✅ 2026-09-01** wraz z typami `PoziomAlertu`/`StatusAlertu` — dopisz do niego `listAlerts`
  i `updateAlertStatus`, nie twórz drugiego pliku. Alert „Ręczny upload" jest już pisany
  (`poziom: info`, `status: rozwiazany` przy powodzeniu; `poziom: ostrzezenie`,
  `status: nowy` przy nieudanym parsowaniu — to nasz dodatek, produkcja przy błędzie milczy).
- **⭐ WEJŚCIE Z SESJI 3f-2 (2026-09-01) — WIDOK MUSI ZWIJAĆ POWTÓRKI.** Decyzją użytkownika
  import pisze alert przy KAŻDEJ nieudanej próbie, **bez dławika po stronie zapisu**, bo
  liczba powtórzeń jest sygnałem diagnostycznym i dławik kasowałby go bezpowrotnie. Ciężar
  spada więc na TĘ iterację. Skala zmierzona w `db/snapshot.db`: **339 alertów „Błąd
  pobierania"** (MO3: 150, MO5: 102, MO4: 83, MO2: 4) wobec 4 × „Błąd HTTP" i 2127 ×
  „Synchronizacja"; rekord to 23 alerty na dobę dla samego MO3 (2026-08-08…10), a trzej
  dostawcy naraz dawali ~60/dobę. Surowa lista jest w tej sytuacji bezużyteczna. **Wymóg:**
  widok grupuje po (`dostawca`, `typ`, `status`) i pokazuje „MO3 — Błąd pobierania, 23 razy,
  ostatnio 14:45", z rozwinięciem do pojedynczych wierszy. Po włączeniu schedulera z 3f-3
  (120 pobrań/dobę) skala tylko rośnie.
- **⚠ Typ alertu „Błąd pobierania" obejmuje TAKŻE błędy parsera** — oryginał ma jeden blok
  `catch` wokół pobrania i parsowania (`:48100`). Grupowanie po `typ` zmiesza więc dwie
  przyczyny; powód jest w treści (`opis`), nie w typie. Nie „naprawiać" tego zmianą typu
  przy zapisie — to port 1:1 i widok ma się do niego dostosować.
- **Frontend:** widok `/alerty`. **Decyzja:** status/obsługa lokalnie vs przez API (spec-frontend §4) — rekomendacja: przez API (spójność stanu).
- **Ścieżki (GATE):** alerts×2.  **Fixtures:** `GET_alerts.json`.
- **DoD:** alerty listują i zmieniają stan; **powtórki zwinięte, nie wysypane surowo**;
  decyzja lokalne/API zapisana; fixtures przez GATE.

---

### Iteracja 7 — Atrybuty (+ wchłonięcie `pending-injection.js`)
- **⚠ Nota z 3e (2026-09-01): `GET /api/atrybuty` w widoku `/staging` jest MARTWE.** Oryginał
  je tam pobiera (`frontend-index.js:20630-20633`), ale zmienna z wynikiem nie występuje nigdzie
  w regionie widoku — to pozostałość, nie funkcja. 3e świadomie tego nie przeportowała. Jeśli
  ta iteracja chciałaby ożywić słowniki w stagingu (np. podpowiedzi kategorii przy edycji),
  będzie to **nowa decyzja**, a nie odtworzenie produkcji.
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
- **⚠ ZALEGŁOŚĆ Z ITERACJI 3 (zapisana 2026-09-01 przez 3d-2) — `products.zastosowanie`.**
  `POST /api/staging/accept` woła w produkcji `__restoreZastosowanie()` (`:44105`), które po
  każdej akceptacji odtwarza puste `zastosowanie` z CSV spoza repo. 3d-2 tego NIE przeportowała
  (decyzja użytkownika) — pełny opis, podejrzenia co do przyczyny i rekomendacja:
  **`docs/rebuild-backlog.md` #12**. Właściciel do ustalenia między tą iteracją a **I7**
  (atrybuty); tu wisi, bo `selly_zastosowanie_category_map` mieszka w tym bloku.
- **Status:** ⬜  **Sesje:** 8a BE · 8b FE  **Zależy od:** 2, 4
- **Cel (Ania klika):** otwiera `/selly`, generuje/eksportuje CSV do marketplace, widzi status/log/słowniki — natywnie.
- **Backend:** `/api/selly/status|ping|csv-status|log|dictionaries|categories|producers`, `POST /api/selly/generate-csv|sync-product|sync-supplier`; `GET /api/export/shoper`, `/api/export-shoper` (pełny katalog CSV — **z auth**, §3). Tabele `selly_kategoria_norm_map`, `selly_zastosowanie_category_map`.
- **Frontend:** trasa Wouter `/selly` + komponenty React/TanStack (zamiast overlay + routing przez hash).
  - **Eksport CSV odłożony z I2 — należy do TEJ iteracji** (rozstrzygnięte 2026-08-25): przycisk
    „Pobierz CSV (Shoper)" w `/katalog` (`frontend-index.js:23384-23422`). Uzasadnienie: to eksport
    Shoperowy, a I8 wnosi już jego serwerowy odpowiednik (`GET /api/export/shoper`,
    `backend-index.cjs:48843`) — jedna iteracja ma trzymać obie drogi emisji CSV spójnie.
  - **⚠ Zależność od `/api/config` jest NOMINALNA, nie realna** (zweryfikowane w `contract/fixtures/GET_config.json`):
    produkcja **nie ma** ani klucza `shoper.separator`, ani `shoper.kolumny` — ma tylko
    `shoper.format_eksportu`, którego katalog nie czyta (konsumuje go serwerowy eksport,
    `backend-index.cjs:48843`). Przycisk zawsze wpada więc w fallbacki: separator `";"` i zahardkodowana
    13-kolumnowa lista `TT` (`frontend-index.js:22706-22731`). **Wniosek: I8 dowozi ten przycisk w pełni
    wiernie, nie czekając na I11** — wystarczy czytać konfigurację defensywnie (brak wartości → fallback);
    gdy I11 doda `GET /api/config`, kod nie wymaga zmiany. Kolumny bierze z konfiguratora katalogu (I2).
- **Ścieżki (GATE):** selly×10, export×2.  **Fixtures:** `GET_selly_status.json`, `_ping`, `_csv-status`, `_log`, `_dictionaries`.
- **DoD:** panel Selly natywny; eksport CSV (serwerowy **oraz** przycisk w `/katalog` odłożony z I2) działa i jest chroniony auth; fixtures przez GATE; parytet z `selly-injection.js` (26 KB).

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
- **⚠ WEJŚCIE Z ITERACJI 5 (decyzja D3, 2026-09-02) — `historia_cen` ma pisarza, brak czytelnika.**
  Tabela `historia_cen` jest zapisywana od bloku 3d-1 (`rebuild/backend/src/repos/historia.ts`,
  `zapiszHistorieCen` — migawka cenowa przy auto-zatwierdzeniu importu w `tk()`). I5 tej tabeli
  **nie dotknęła w ogóle** — widok `/historia` to log zdarzeń z `audit_log`
  (import/eksport/edycja), nie lista zmian cen per produkt. Czytelnika dowozi TA iteracja:
  `GET /api/analytics/prices/product-history` (`mirror/backend/analytics_module.cjs:26-95`,
  fixture `contract/fixtures/GET_analytics_prices_product-history.json`).
- **Tu też należy `GET /api/history` jako źródło danych dla Pulpitu** (`frontend-index.js:16852`).
  Endpoint jest już zaimplementowany i przetestowany w I5 (`src/routes/history.ts`), czyta
  tabelę `history`; na stagingu zwraca dziś `[]`, bo ta tabela nie ma jeszcze pisarza (patrz I5).
- **Backend:** 27 tras `/api/analytics/*` (KPI, marże, EAN coverage/comparison/unique/rank/details, ceny inflation/last-import/product-history, dostawcy stats/lifecycle/stability/stock, dostępność products/sell-through, rotacja inactive, sezonowość, importy-timeline, top-zmiany, filters, status, bootstrap-current, export/{view}, market/group-prices, lifecycle/models).
- **Frontend:** widok `/analityka` (`fe.js:27804`) + pulpit `/`.
- **Ścieżki (GATE):** analytics×27.  **Fixtures:** wszystkie `GET_analytics_*.json` (25).
- **DoD:** dashboardy renderują realne agregaty; fixtures przez GATE; pulpit pokazuje kluczowe metryki.

---

### Iteracja 11 — Konfiguracja: spedycja, Shoper, katalog, AI
- **Status:** ⬜  **Sesje:** 1  **Zależy od:** 1
- **Cel (Ania klika):** edytuje konfigurację i limity spedycji. **Dostawcy i częstotliwość
  importu WYSZŁY z tej iteracji do bloku 3f-2 ✅ 2026-09-01** — są zrobione.
- **Backend:** `GET/PUT /api/config` (`Jt`), `GET /api/spedycja` (`gn`). **Wszystkie trasy
  dostawców są już dowiezione:** listy w I2, `upload` w 3f-1, `PATCH /api/dostawcy/{id}`
  i `POST /api/dostawcy/{kod}/synchronizuj-teraz` w 3f-2.
- **⚠ ZAKRES POMNIEJSZONY 2026-09-01 — import wydzielony do bloku 3f.** Z tej iteracji WYSZŁY:
  `POST /api/dostawcy/{kod}/upload`, `POST /api/dostawcy/{kod}/synchronizuj-teraz`,
  `PATCH /api/dostawcy/{id}`, zakładki **dostawcy** i **wgrywanie** oraz wchłonięcie
  `freq-injection.js`. Powód: to wszystko jest częścią pętli importu, a Ania potrzebowała jej
  w całości do testów Iteracji 3. **Zostaje tutaj:** `GET/PUT /api/config`, `GET /api/spedycja`
  i zakładki spedycja / shoper / katalog / ai. **Szkielet strony `/konfiguracja` z sześcioma
  zakładkami POWSTAŁ w 3f-1 ✅ 2026-09-01** — ta iteracja wypełnia cztery pozostałe. Zaślepki
  i przypisanie zakładek do bloków siedzą w `src/pages/konfiguracja/zakladki.ts`: zmień tam
  `domykaBlok` na `null` i dołóż `<TabsContent>` w `Konfiguracja.tsx`. Trasa `/konfiguracja`
  jest już zdjęta z `placeholdery.ts` i wpięta wprost w `App.tsx`.
  **Aktualizacja 2026-09-01 (3f-2):** zakładka **dostawcy** też jest już wypełniona
  (`pages/konfiguracja/Dostawcy.tsx`), a `freq-injection.js` wchłonięty. Zostają CZTERY
  zaślepki: spedycja, shoper, katalog, ai. Wzorzec karty z edycją i mutacją przez
  `useMutation` — patrz `Dostawcy.tsx`; wzorzec testu — `test/konfiguracja.dostawcy.test.tsx`.
- **Historyczne (zapisane 2026-09-01 przez 3e, przed wydzieleniem 3f):**
  Strona Konfiguracja ma w oryginale sześć zakładek: **dostawcy · wgrywanie · spedycja · shoper ·
  katalog · ai** (`frontend-index.js:791300-792300`). Zakładka **„wgrywanie"** (`JT`, `:784673`)
  to wgrywanie cenników — wiele plików naraz, z auto-detekcją dostawcy po nazwie pliku
  i nagłówkach; osobno każdy dostawca ma własny przycisk „Wgraj plik" (`ZT`, ok. `:772483`).
  **To jedyne miejsce w całej aplikacji, z którego da się ZACZĄĆ import z przeglądarki** —
  `/staging` (3e) pokazuje dopiero wynik. Dopóki tego nie ma, Ania nie przeklika pełnego cyklu
  importu i gate 3e zostaje domknięty tylko częściowo (patrz blok 3e). Backend jest gotowy od 3b:
  `POST /api/import/parse-file` i `POST /api/import/from-url`.
- **Frontend:** cztery pozostałe zakładki `/konfiguracja`. Eksport CSV w `/katalog` należy do I8, nie tu — produkcja
  nie ma kluczy `shoper.separator`/`shoper.kolumny`, więc `/api/config` nie jest dla niego blokerem.
- **Ścieżki (GATE):** config, spedycja (dostawcy×3 rozliczone w I2 / 3f-1 / 3f-2).  **Fixtures:** `GET_config.json`, `GET_spedycja.json` (`GET_dostawcy.json`/`GET_suppliers.json` już zielone od I2).
- **DoD:** konfiguracja i spedycja edytowalne; fixtures przez GATE. **Częstotliwość natywnie —
  ✅ dowiezione w 3f-2, nie powtarzać.**

---

### Iteracja 12 — Konto + admin + hardening bezpieczeństwa
- **Status:** ⬜  **Sesje:** 1–2  **Zależy od:** wszystkie (finalny przegląd)
- **Cel (Ania klika):** zmienia hasło w `/moje-konto`; admin zarządza użytkownikami/konfiguracją dostawców i utrzymaniem.
- **Backend:** `POST /api/password/change`; `GET /api/users`; `GET/PUT /api/admin/supplier-config(+{kod})`, `/api/admin/suppliers-list`; `POST /api/maintenance/usun-nieopony`, `POST /api/products/clear`; `GET /api/audit-log`.
  - **⚠ WEJŚCIE Z ITERACJI 5 (2026-09-02) — `GET /api/audit-log` musi znieść to samo, co `/api/history/{meta,paged}` już znosi.**
    `synchronizacja_reczna` nie ma `szczegoly_json` (trasa `POST /api/dostawcy/{kod}/synchronizuj-teraz`
    woła audyt bez czwartego argumentu, `:48240` — NULL) i powstaje TAKŻE dla dostawcy, który nie
    istnieje (audyt pisany przed synchronizacją i bezwarunkowo, więc `encja_id` bywa kodem spoza
    `suppliers`). W widoku `/historia` ta akcja jest odfiltrowana (nie ma jej w słowniku pięciu
    rozpoznawanych akcji), więc problem tam nie wystąpił — ale `/api/audit-log` pokazuje surowy
    audyt bez filtra typu, więc TU widok musi znieść `null` i niezłączalny `encja_id` wprost.
    Parser `parsujSzczegoly` z I5 (`src/historia/mapowanie.ts`) już to potrafi (`try/catch` → `{}`),
    da się z niego skorzystać bez pisania drugiej wersji.
  - **Mutacje produktów odłożone z I2:** `PATCH /api/products/{id}` (edycja, wstrzymanie/aktywacja —
    uwaga: oryginał sam ustawia `status: "wstrzymany"`, gdy któraś z cen spada do 0, `backend-index.cjs:44735-44741`),
    `PUT /api/products/{id}`, `DELETE /api/products/{id}`, `POST /api/products` (bulk). Katalog (I2) jest
    dziś wyłącznie do odczytu — te trasy domykają go do parytetu z produkcją.
    - **⚠ WEJŚCIE Z BLOKU 3f-2 (2026-09-01): `PATCH /api/products/{id}` zapisuje CAŁE ciało
      żądania.** Wspólny handler `PUT`/`PATCH` (`:48415-48424`, zarejestrowany w `:48452`) odsiewa wyłącznie klucz `_reason` i oddaje resztę do
      `updateProduct`, czyli **wszystkie 72 kolumny są zapisywalne**. U nas doszłaby jeszcze
      `uwagaCena` (migracja 002), dziś ukryta przed API projekcją kontraktową. Ta trasa
      dodatkowo zapisuje `manual_overrides` dla KAŻDEGO zmienionego pola (`:48427`),
      więc lista pól decyduje nie tylko o tym, co da się zapisać, ale też o tym, **czego import
      przestanie nadpisywać**. Dostawcy dostali listę pól w 3f-2 — tu trzeba podjąć tę samą
      decyzję świadomie. Wzorzec: `POLA_EDYTOWALNE_DOSTAWCY` w `repos/suppliers.ts`.
      Rozbiór wzorca systemowego: `rebuild-backlog.md` #14.
  - **⚠ ZALEGŁOŚCI Z ITERACJI 3 — DOMKNĄĆ TUTAJ (zapisane 2026-08-27 przez 3d-1).**
    1. **Przenagrać `contract/fixtures/GET_products.json`.** Fixture pochodzi sprzed
       produkcyjnej migracji `szertxt` i trzyma `szerokosc` jako LICZBĘ, podczas gdy produkcja
       i nasz kanon (migracja `003_szerokosc_text.sql`) mają tam TEXT. GATE I2 przepuszcza to
       dziś przez **zadeklarowany wyjątek** `WYJATKI_SZEROKOSC` w `test/katalog.gate.test.ts`.
       Wyjątek jest SAMOCZYSZCZĄCY — po przenagraniu przestanie cokolwiek pokrywać i test
       zapali się, żądając usunięcia. **To jest sygnał do usunięcia wyjątku, nie do naprawy testu.**
       Przy okazji: `products.uwaga_cena` (migracja 002) jest dziś ukryta przed API jawną
       projekcją (`src/repos/kolumny.ts`) — ujawnienie jej wymaga tego samego przenagrania.
    2. **`POST /api/products` (bulk) ma dowieźć TEŻ rozszerzenia importu** (decyzja użytkownika
       2026-09-01, ticket 9). `addProductsBulk` (`:44746`) woła `assignKodImportu`, `applyDims`,
       `applyLinkMemory`, `applyNazwaPamiec` i `applyWagaPamiec` — dokładnie ten sam zestaw co
       `acceptStaging`. 3d-2 świadomie tego NIE budowała, bo `addProductsBulk` ma tylko jedno
       wywołanie (`:48308`) i jest nim właśnie ta trasa, odłożona tutaj — pisarz bez wywołania
       nie dałby się przetestować end-to-end. **Port `bridge_ext` czeka gotowy w repo**
       (`src/import/legacy/`), a most `src/import/silnik/bridge-ext.ts` typuje już wszystkie
       potrzebne funkcje. Dowód wierności zbuduj tak jak 3d-2: `addProductsBulk` jest metodą
       obiektu `U`, więc da się ją wyciąć z bundla tym samym harnessem
       (`test/charakteryzacja/akceptacja/oryginal.mjs` — wystarczy poszerzyć kotwice).
       ⚠ `addProductsBulk` ma też własną gałąź narzutów/promocji (`:44773-44783`) — patrz I4.
    3. **Dopisać do `openapi.yaml` DWA endpointy `uwaga_cena`**, nie jeden:
       `GET /api/products/uwagi-cena` i `GET /api/products/hold-reasons`. Oba istnieją
       w produkcji jako monkey-patch `mirror/backend/uwaga_cena_patch.cjs` i obu brak
       w zamrożonym kontrakcie. `hold-reasons` liczy powód wstrzymania w locie (5 przypadków:
       `uwaga_cena` dosłownie / brak ceny i stanu / brak ceny / brak stanu / „sprawdź ręcznie").
  - **Finalny przegląd bezpieczeństwa:** potwierdzić auth na WSZYSTKICH trasach danych, zamknięty CORS, brak zahardkodowanego `JWT_SECRET` z fallbackiem.
    **Dopisane 2026-09-01 (3f-2):** przejrzeć WSZYSTKIE trasy mutacji pod kątem
    „`.set(req.body)` bez listy pól" i potwierdzić, że każda ma jawną listę — do tego czasu
    powinny ją mieć staging (port 1:1 z 3d-2), dostawcy (3f-2), narzuty i promocje (I4)
    oraz produkty (ta iteracja). **Zasada do przyjęcia na stałe: kolumny wyliczane i kolumny
    własne odbudowy (`importWylaczony`, `uwagaCena`) nigdy nie wchodzą na listę pól
    edytowalnych.** Kontekst i lista tras: `rebuild-backlog.md` #14.
  - **Odświeżenie kontraktu i fixtures** (zapowiedziane w §2, zebrane z iteracji 1–11).
    **⚠ Schematy ciał generujemy z `contract/fixtures/` — z nagrań produkcji, NIE z naszej implementacji.**
    Inaczej kontrakt przestaje być niezależnym dowodem i zaczynamy sprawdzać własną pracę własną pracą.
    Zakres:
    dopisać do `contract/openapi.yaml` realne kody błędów (m.in. `401` dla `GET /api/me` i `POST /api/login`)
    oraz schematy ciał, których wersja 2.3 nie zamraża; **przenagrać fixtures POST/PUT/PATCH/DELETE
    przeciw kopii bazy**; dograć wariant `GET /api/products` **bez parametrów** (goła tablica — główna
    ścieżka katalogu, dziś bez siatki fixtures, opisana tylko testami w `rebuild/backend/test/produkty.test.ts`).
    Jeśli backlog #3 zostanie do tego czasu przyjęty, tu wpada też przenagranie `GET_products.json`
    z `szerokosc` jako TEXT.
- **Frontend:** `/moje-konto` (pełne) + ekrany admin.
  - **Dokończenie `/katalog` z I2:** menu „Akcje" w wierszu tabeli (Edytuj / Wstrzymaj-Aktywuj / Usuń,
    „Historia" `disabled` — tak jak w oryginale) i modal EDYCJI produktu. Zastępuje modal podglądu
    read-only, który I2 wniosła jako świadome odstępstwo D4 — po tej iteracji odstępstwo znika.
- **Ścieżki (GATE):** password, users, admin×3, maintenance, products/clear, audit-log, **products×4 (POST + PATCH/PUT/DELETE `{id}`)**.  **Fixtures:** `GET_users.json`, `GET_admin_supplier-config.json`, `GET_admin_suppliers-list.json`, `GET_audit-log.json` + fixtures zapisujące nagrane w tej iteracji (dziś ich nie ma — `contract/README.md`).
- **DoD:** konto/admin/maintenance działają; **mutacje produktów i akcje wierszowe w `/katalog` domknięte** (odstępstwo D4 z I2 zniesione); audyt bezpieczeństwa domknięty; kontrakt i fixtures odświeżone; fixtures przez GATE; **kompletny przegląd 12 widoków z Anią**.

---

## 6. Po zakończeniu wszystkich iteracji
- Pełny przegląd 12 widoków + parytet fixtures/kontraktu (55/55).
- Plan cutoveru (big-bang): przełączenie Apache/PM2 na nowy stos, ta sama baza `data.db`.
- Rozliczenie backlogu (`docs/rebuild-backlog.md`) — wszystkie wpisy TAK naniesione, NIE świadomie pominięte.

*Utworzono 2026-08-20 (Faza 3–4). Aktualizuj §4 i statusy w §5 po każdym zmergowanym tickecie.*
