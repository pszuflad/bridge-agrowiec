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
| **Martwe ścieżki FE** | FE woła `/api/attributes` (8×) i `/api/attribute-kinds` (6×) — backend ma `/api/atrybuty(/rodzaje)` | **naprawione w 7b (2026-09-04, ticket `31-FEATURE-atrybuty-frontend`)** — front woła wyłącznie `/api/atrybuty(/rodzaje)` | ✅ zrobione |
| **Skrypty injection** | `pending-injection.js`, `selly-injection.js`, `freq-injection.js` łatają UI spoza Reacta | wchłonięte natywnie WSZYSTKIE TRZY: **`freq-injection.js` ✅ 3f-2 (2026-09-01)**, **`pending-injection.js` ✅ 7b (2026-09-04, `31-FEATURE-atrybuty-frontend`)**, **`selly-injection.js` ✅ 8b (2026-09-04, `30-FEATURE-selly-panel-frontend`)** | ✅ zrobione |
| **Lokalne vs API** | **Oba tematy rozstrzygnięte 2026-09-03, każdy INNYM rozstrzygnięciem — bo to były dwa różne problemy, nie jeden.** **I6 (alerty, D3): przez API.** `PATCH /api/alerts/{id}` jest jedynym źródłem prawdy o statusie, zero IndexedDB/localStorage. Wcześniejszy zapis w tym wierszu mylił — oryginalny widok `/alerty` (`HT()`, `frontend-index.js:25177-25340`) w ogóle nie czytał `/api/alerts`: liczył pseudo-alerty katalogowe z `GET /api/products` i trzymał ich status w IndexedDB (`alerty-statusy`, `fe.js:9165-9193`); to inny zestaw danych, nie kwestia miejsca przechowywania statusu. **I9 (waga gabarytowa, D1): lokalnie, FAKTEM.** To DWA różne kalkulatory pod jedną nazwą (paletowy w BE vs wolumetryczny w FE), nie jeden wzór w dwóch miejscach — nie było czego deduplikować. Dowieziono oba 1:1, FE liczy lokalnie i endpointu nie woła, jak produkcja. **Wniosek na przyszłość: pytanie „lokalnie czy przez API” rozstrzyga się dopiero po sprawdzeniu, czy obie strony liczą TO SAMO** — dwa razy z rzędu okazało się, że nie. | — | ✅ I6 · ✅ I9 |
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
| 4 | Narzuty + promocje (ceny) | 4a BE · 4b FE | 2, 3 | ✅ | 4a: ticket `15-FEATURE-narzuty-promocje-ceny` · 2026-09-02 · 4b: ticket `16-FEATURE-widok-narzuty-promocje` · 2026-09-02 |
| 5 | Historia | 1 | 3 | ✅ | PR #24 · 2026-09-02 |
| 6 | Alerty | 1 | 3 | ✅ | ticket `18-FEATURE-widok-alerty` · 2026-09-03 |
| 7 | Atrybuty (+ pending-injection) | 7a BE · 7b FE · 7c FE | 2 | 🔨 | 7a: `29-FEATURE-atrybuty-backend` · 2026-09-04 · 7b: `31-FEATURE-atrybuty-frontend` · 2026-09-04 · 7c: ⬜ |
| 8 | Selly / sprzedawarka (+ selly-injection) | 8a BE · 8b FE | 2, 4 | ✅ | 8a: ticket `28-FEATURE-selly-eksport-backend` · 2026-09-04 · 8b: ticket `30-FEATURE-selly-panel-frontend` · 2026-09-04 |
| 9 | Waga gabarytowa | 1 | 2 | ✅ | ticket `18-FEATURE-waga-gabarytowa` · 2026-09-03 |
| 10 | Analityka + pulpit | 10a→[10b·10c·10d·10e]→10f | 2, 3, 4 | ✅ | 10a: `19-FEATURE-analityka-fundament` · 10c: `22-FEATURE-analityka-ean` · 10d: `23-FEATURE-analityka-dostawcy` — wszystkie 2026-09-03 · 10b: `24-FEATURE-analityka-ceny` · 10e: `25-FEATURE-analityka-dostepnosc-rotacja` — obydwa 2026-09-04 · 10f: `26-FEATURE-analityka-export-pulpit` · 2026-09-04. |
| 11 | Konfiguracja: spedycja / shoper / katalog / ai (dostawcy i `freq-injection` ✅ w 3f-2) | 1 | 1 | ✅ | ticket `18-FEATURE-konfiguracja-config-spedycja` · 2026-09-03 |
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
    (zależny od `/api/config`) odłożony. **Oba endpointy już istnieją** (`/api/config` od I11,
    `/api/atrybuty` od 7a — 2026-09-04), więc degradacja jest do zdjęcia w dowolnym momencie.
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
  | Słowniki marek/kategorii z `GET /api/atrybuty` (znosi degradację z D3) | **7c** | endpoint gotowy od 7a; podpięcie w `/katalog` czeka na 7c (po merge 8b) — patrz blok Iteracji 7 |
  | Dane kolumny „Promocja" (dziś renderuje `—`) | — | **sprostowanie (4b, 2026-09-02): kolumna zostaje MARTWA, port 1:1 (decyzja D1).** Oryginał nie ustawia `_reguly` NIGDZIE w bundlu i żadne z 66 pól `GET_products.json` nie niesie promocji — nie było skąd wziąć danych. Kandydat na I12, jeśli backend kiedyś dołoży pole. |
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
      przemilczane. **✅ Domknięte w 4a (2026-09-02)** — patrz blok Iteracja 4.
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
      `GET/POST /api/config`, `GET/POST /api/spedycja` i zakładki spedycja / shoper / katalog / ai
      — ✅ dowiezione 2026-09-03 (patrz blok I11).
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
- **⚠ CO ZOSTAJE OTWARTE PO ITERACJI 3 — świadomie, z właścicielem:** zamknięcie iteracji NIE znaczy, że nie ma tu długu. Pięć rzeczy wychodzą dalej i **żadna nie blokuje I4**:
  - **Fallback `Wc()` NIE wchodzi** (decyzja zaklepana 2026-09-01, blok 3f) — dziesięć starych parserów zaszytych w bundlu, port wielkości sesji 3a. **Luka otwarta, właściciel do ustalenia.**
  - **Alerty bez dławika** (decyzja 3f-2) → zwijanie powtórek dowiezione **widokiem alertów w Iteracji 6 ✅ 2026-09-03**. Po włączeniu automatu z 3f-3 tempo to ~24 alerty/dobę na trwale padniętego dostawcę.
  - **Rozmiar odpowiedzi `GET /api/alerts` rośnie ze schedulerem** (follow-up z Iteracji 6, `18-FEATURE-widok-alerty`) — `GET /api/alerts` jest bez limitu 1:1 (D9); po włączeniu automatu z 3f-3 (120 pobrań/dobę → część kończy się alertem) tabela `alerts` rośnie liniowo, dziś ~3000 wierszy, za rok rzędu 45 tys. Wtedy potrzebna decyzja: limit czasowy w zapytaniu albo agregacja po stronie backendu — zmieniłaby kontrakt, nie robić bez decyzji użytkownika. **Właściciel do ustalenia** przy włączaniu schedulera na produkcji.
  - **Dwa pojęcia statusu dostawcy** (backlog **#17** i **#18**, znalezione w 3f-3, odtworzone 1:1) — samozakleszczenie po 30 dniach, świeża baza planująca zero, oraz „wstrzymany" niewidoczny na karcie. Propozycje napraw w backlogu; **właściciel do ustalenia**, bo #17 zmienia dobór dostawców do automatu, a #18 dokłada klucz do kontraktu `GET /api/dostawcy` (przenagranie `GET_dostawcy.json` i `GET_suppliers.json`).
  - **`PATCH /api/markups/{id}` i `/api/promotions/{id}` zapisywały CAŁE ciało żądania** (backlog #14, wejście z 3f-2) → **domknięte w 4a** (`POLA_EDYTOWALNE_NARZUTU`/`POLA_EDYTOWALNE_PROMOCJI`, filtr na PATCH i POST).

---

### Iteracja 4 — Narzuty + promocje (ceny)
- **Status:** ✅ **zrobione — ITERACJA ZAMKNIĘTA** — **4a (BE) ✅ 2026-09-02** (ticket
  `15-FEATURE-narzuty-promocje-ceny`), **4b (FE) ✅ 2026-09-02** (ticket
  `16-FEATURE-widok-narzuty-promocje`)
  **Sesje:** 4a BE · 4b FE  **Zależy od:** 2, 3
- **Cel (Ania klika):** ustawia narzut/promocję, widzi przeliczoną `cena_sprzedazy`/marżę w katalogu.

- **4a · CRUD `/api/markups`/`/api/promotions` + silnik cen + wpięcie w import** (BE) — ✅
  **zrobione** (ticket `15-FEATURE-narzuty-promocje-ceny`, 2026-09-02).
  Osiem tras za `requireAuth`: `GET/POST/PATCH/DELETE /api/markups` i `/api/promotions`.
  **To `PATCH`, nie `PUT`** — sprostowanie starego opisu tego bloku: oryginał
  `e.patch("/api/markups/:id", …)` (`:48699`) i `e.patch("/api/promotions/:id", …)` (`:48722`),
  `contract/openapi.yaml:739-751`/`:901-913` też mają wyłącznie `patch`.
  Silnik cen `rebuild/backend/src/repos/ceny.ts` (`dopasujWarunek`, `narzutPasuje`,
  `promocjaPasuje`, `wybierzNarzut`, `wybierzPromocje`, `zastosujRegulyCenowe`,
  `przeliczCenyZRegul`) — port `:44572-44693`. Każda mutacja narzutu/promocji przelicza CAŁY
  katalog synchronicznie (`try/catch`, jak oryginał).
  - **Zaległość z Iteracji 3 DOMKNIĘTA dla `acceptStaging`.** Gałąź cenowa wpięta
    w `rebuild/backend/src/import/akceptacja.ts`, w tym samym miejscu sekwencji co oryginał
    (`:44884-44892`). Charakteryzacja 3d-2 rozszerzona o 13 scenariuszy z regułami narzutów
    i promocji w tabelach, zielona — port liczy ceny tymi samymi liczbami co uruchomiony
    oryginał. Przydatność próby zmierzona, nie założona: po tymczasowym wyłączeniu wpięcia
    pada 10 z 13 nowych scenariuszy, plus osobna kontrola negatywna na samym oryginale.
    **`addProductsBulk` NIE wchodzi w zakres 4a — czeka na I12 (patrz tamten blok).**
  - **Lista pól edytowalnych zamyka backlog #14 dla narzutów i promocji.**
    `POLA_EDYTOWALNE_NARZUTU` (`rebuild/backend/src/repos/markups.ts`, 8 pól) i
    `POLA_EDYTOWALNE_PROMOCJI` (`promotions.ts`, 8 pól); filtr działa na PATCH **i** POST.
  - **Audyt loguje SUROWE `c.body` w całości** (`:48699-48737`, wszystkie sześć wywołań
    `be(...)`) — potwierdzone lekturą, port 1:1. Niespójności znanej od dostawców (audyt
    tylko wybranych pól, zapis przez filtr) tu NIE MA.
  - **Rozliczenie gate'u:** `GET_markups.json`/`GET_promotions.json` przez fixtures i kontrakt
    + 401 na wszystkich ośmiu operacjach; 34 testy silnika cen; 18 testów pól
    edytowalnych/audytu/przeliczania; **523 testy w 33 plikach** ogółem; lint/typecheck/build
    czyste. Pełny wywód (formuła cenowa, decyzje D1–D5): `docs/tickets/
    15-FEATURE-narzuty-promocje-ceny/plan.md` i `raport.md`.

- **4b · Widok `/narzuty`** (FE) — ✅ **zrobione 2026-09-02** (ticket
  `16-FEATURE-widok-narzuty-promocje`). Dwie zakładki (`Tabs`, domyślna „narzuty"): tabela
  narzutów + symulator ceny w pierwszej, tabela promocji w drugiej; wspólny dialog
  dodawania/edycji z builderem warunków — **9 typów** (6 z oryginału + `konstrukcja`/
  `srednica`/`vfIf`, świadome rozszerzenie). Pełny CRUD obu zasobów na React Query, **bez**
  IndexedDB/optimistic update oryginału (świadome odstępstwo — backend przelicza ~7 400
  produktów synchronicznie przy każdej mutacji, więc widok pokazuje uczciwy stan ładowania
  zamiast iluzji natychmiastowości). Kontrola „poniżej kosztu" przed zapisem promocji własnym
  dialogiem + pasek ostrzegawczy na żywo w formularzu, liczone **metodą oryginału**
  (`cenaSprzedazy × (1−rabat)`, matcher osobny od silnika cen). Silnik cen po stronie klienta
  (symulator + kontrola kosztu) świadomie liczy **zgodnie z backendem** (`repos/ceny.ts`), nie
  z oryginalnym `Mb()`, który się z nim rozjeżdża. `Toaster` wszedł do drzewa aplikacji
  (`src/App.tsx`) — pierwsza iteracja, która go realnie używa; istniejące widoki dalej mają
  komunikaty inline, `TooltipProvider` nadal czeka na pierwszą iterację z tooltipem.
  `/narzuty` zdjęte z `placeholdery.ts`, **liczba tras routera dalej 12**. **278 testów
  w 18 plikach** (frontend), lint/typecheck/build czyste. Pełny wywód, D1–D8 i lista
  odstępstw: `docs/tickets/16-FEATURE-widok-narzuty-promocje/plan.md` i `raport.md`.
  - **Kolumna „Promocja" w `/katalog` zostaje MARTWA (D1) — sprostowanie starego zapisu tego
    bloku.** Oryginał nie ustawia `_reguly` NIGDZIE w bundlu (jedno wystąpienie, wyłącznie
    odczyt) i żadne z 66 pól `GET_products.json` nie niesie promocji ani rabatu — nie było
    skąd wziąć danych. 4b portuje 1:1, kolumna nadal renderuje `—`. Ożywienie wymagałoby
    duplikować silnik dopasowania reguł w przeglądarce (patrz nota w Iteracji 12).
  - **`PATCH /api/promotions/{id}` NIE MA 404** — dla nieistniejącego id oddaje **200 z pustym
    ciałem** (`res.json(undefined)` → puste `text`, nie `{}`). Bliźniacza trasa narzutu 404 MA.
    Klient promocji 4b czyta `text()` i parsuje warunkowo — pusta odpowiedź to „nie znaleziono".
  - **Silnik cen backendu IGNORUJE daty `start`/`koniec` promocji** — wygasła promocja nadal
    obniża ceny (port 1:1, `__bridgePromoMatches`). Frontend produkcji mimo to **przelicza
    etykietę statusu z dat przy każdym odczycie** `/api/promotions` (`_b()`,
    `frontend-index.js:9508`, wołane z `queryFn` `:9568`) i zapisuje wynik do IndexedDB —
    **nigdy na serwer**; kolumna `status`, której używa silnik cen, zostaje nietknięta. Skutek
    w produkcji: lista pokazuje „zakończona" przy promocji, którą backend nadal stosuje. 4b
    odtworzyło to 1:1 i dołożyło widoczny **znacznik rozbieżności** na wierszu, gdy przeliczona
    etykieta nie zgadza się z kolumną `status` z serwera, plus naprawiony badge `"zaplanowana"`
    (oryginał ma tu literówkę i wyświetla ją jako „zakończona"). Wyłączenie promocji „na
    sztywno" to nadal zmiana `status`, a nie upływ daty — silnika to nie rusza (backlog #19).
  - **Listy marek i kategorii w `DialogReguly.tsx` powstawały z danych produktów** (ta sama
    degradacja co D3 w I2), bo 4b nie miało endpointu słowników — **domknięte w 7b
    (2026-09-04, ticket `31-FEATURE-atrybuty-frontend`):** dialog czyta `["/api/atrybuty"]`,
    marki = suma słownika i katalogu, kategorie WYŁĄCZNIE ze słownika, kategoria spoza
    katalogu jest wybieralna. Szczegóły w bloku Iteracji 7 (podblok 7b).
  - Aktywny status promocji to `"aktywna"` (rodzaj żeński), narzutu — `"aktywny"`.
  - `warunki` w obu tabelach to **STRING ze zserializowanym JSON-em**, nie tablica — 4b wysyła
    dokładnie tak.
  - Odpowiedzi `GET` to **gołe tablice**, nie koperty.
- **Ścieżki (GATE):** markups×2 (`GET/POST` + `PATCH/DELETE {id}`), promotions×2 (jw.) —
  osiem operacji, **✅ zielone od 4a**.  **Fixtures:** `GET_markups.json`, `GET_promotions.json`
  — **✅ zielone od 4a**.
- **DoD:** ✅ narzuty/promocje liczą ceny zgodnie z oryginałem (4a); ✅ fixtures przez GATE (4a);
  ✅ widok `/narzuty` z pełnym CRUD, builderem warunków, symulatorem i kontrolą kosztu (4b);
  kolumna „Promocja" w `/katalog` świadomie zostaje martwa (D1) — przeliczona `cena_sprzedazy`
  jest widoczna w katalogu, ale nie ta kolumna.

---

### Iteracja 5 — Historia
- **Status:** ✅ **2026-09-02** (`15-FEATURE-historia-zmian`, PR #24)  **Sesje:** 1  **Zależy od:** 3
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
- **Status:** ✅ **2026-09-03** (`18-FEATURE-widok-alerty`)  **Sesje:** 1  **Zależy od:** 3
- **Cel (Ania klika):** otwiera `/alerty`, widzi i obsługuje alerty (zmiana statusu) — ✅ dowiezione.
- **Backend:** `GET /api/alerts` + `PATCH /api/alerts/{id}` w NOWYM
  `rebuild/backend/src/routes/alerts.ts` (wzorzec `routes/overrides.ts`), obie za `requireAuth`
  (odstępstwo D2, precedens I1 — oryginał i `openapi.yaml` mają `GET` publiczny). Repo
  `src/repos/alerts.ts` (istniejące od 3f-1, `zapiszAlert` + typy `PoziomAlertu`/`StatusAlertu`)
  rozszerzone o `listAlerts`/`updateAlertStatus` — port `U.listAlerts`/`U.updateAlertStatus` 1:1:
  bez limitu (D9), `PATCH` bez audytu/walidacji/404 (D4 — `status` dowolny string, zawsze
  `{ok:true}`, także dla nieistniejącego `id`).
- **⚠ Oryginalny widok `/alerty` NIE czytał `/api/alerts` — pseudo-alerty katalogowe świadomie
  pominięte (D1).** `HT()` (`deminified/frontend-index.js:25177-25340`) pobierał
  `GET /api/products` i liczył pseudo-alerty katalogowe (`pv()`, `:16631-16705`: marża ujemna,
  niska marża, „nie-opona"), a status trzymał w IndexedDB (`alerty-statusy`, `fe.js:9165-9193`),
  operując poziomem `krytyczny` i statusem `przejrzany`, których backend NIGDY nie produkuje.
  To nie był wybór miejsca przechowywania statusu tych samych alertów — to dwa różne zestawy
  danych. Widok tej iteracji stoi WYŁĄCZNIE na `/api/alerts` (alerty importu); pseudo-alerty
  katalogowe pominięte świadomie, wpis **`docs/rebuild-backlog.md` #26** (⬜ do decyzji).
- **Widok zwija powtórki — wymóg z 3f-2 rozliczony.** Grupowanie po (`dostawca`, `typ`, `status`)
  w `pages/alerty/grupowanie.ts` (`pogrupujAlerty`/`filtrujAlerty`/`wartosciFiltrow`): grupa
  domyślnie zwinięta, licznik + czas ostatniego wystąpienia („MO3 — Błąd pobierania · 23× ·
  ostatnio 14:45"), rozwinięcie do pojedynczych wpisów; dowiedzione testem na danych z
  powtórkami (24 alerty → 2 grupy w DOM, pojedyncze `opis`y nieobecne przed rozwinięciem).
  Domyślny filtr `status = nowy` (D7), filtry status/dostawca/typ z wartości w danych (D8).
  Zmiana statusu — na grupie i na pojedynczym wpisie, w obie strony, WYŁĄCZNIE przez API (D3):
  `PATCH /api/alerts/{id}` jedyne źródło prawdy, zero IndexedDB/localStorage; akcja grupowa to
  N `PATCH`-y z limitem równoległości 8 (`pages/alerty/api.ts`, największa grupa w produkcji —
  150 wpisów).
- **⚠ Typ alertu „Błąd pobierania" obejmuje TAKŻE błędy parsera** — oryginał ma jeden blok
  `catch` wokół pobrania i parsowania (`:48100`). Grupowanie po `typ` zmiesza więc dwie
  przyczyny; powód jest w treści (`opis`), nie w typie. Nie naprawione zmianą typu przy
  zapisie — port 1:1, widok się dostosował.
- **Frontend:** `pages/Alerty.tsx` + `pages/alerty/{api,grupowanie,TabelaAlertow}.tsx`, wpięty
  w `App.tsx`; placeholder `/alerty` zdjęty z `pages/placeholdery.ts` (liczba tras routera bez zmian).
- **Ścieżki (GATE):** alerts×2 ✅.  **Fixtures:** `GET_alerts.json` ✅ (dla `PATCH` brak nagranej
  próbki — kształt stoi wyłącznie na kodzie oryginału `:48688-48691`; follow-up: nagrać przy
  najbliższym kontakcie z produkcją).
- **DoD:** ✅ obie trasy za `requireAuth`, GATE fixtures/kontrakt zielony; widok listuje zwinięte
  grupy, rozwijalne, filtry status/dostawca/typ działają; decyzja D3 (przez API) i D1 (pominięcie
  pseudo-alertów katalogowych, backlog #26) zapisane; lint/typecheck/build/test czyste w BE i FE.
  Szczegóły: `docs/tickets/18-FEATURE-widok-alerty/`.

---

### Iteracja 7 — Atrybuty (+ wchłonięcie `pending-injection.js`)
- **⚠ Nota z 3e (2026-09-01): `GET /api/atrybuty` w widoku `/staging` jest MARTWE.** Oryginał
  je tam pobiera (`frontend-index.js:20630-20633`), ale zmienna z wynikiem nie występuje nigdzie
  w regionie widoku — to pozostałość, nie funkcja. 3e świadomie tego nie przeportowała. Jeśli
  ta iteracja chciałaby ożywić słowniki w stagingu (np. podpowiedzi kategorii przy edycji),
  będzie to **nowa decyzja**, a nie odtworzenie produkcji.
- **Status:** 🔨 **iteracja w połowie** — **7a (BE) ✅ 2026-09-04** (ticket
  `29-FEATURE-atrybuty-backend`), **7b (FE) ✅ 2026-09-04** (ticket
  `31-FEATURE-atrybuty-frontend`), **7c (FE) ⬜ do zrobienia** (po merge sesji 8b)
  **Sesje:** 7a BE · 7b FE · 7c FE  **Zależy od:** 2
- **Cel (Ania klika):** zarządza rodzajami/wartościami atrybutów, obsługuje kolejkę „pending" (akceptuj / jako alias / z edycją / odrzuć) — **natywnie w Reakcie**, bez skryptu injection.
- **Ekran produkcyjny `/atrybuty` ma TRZY warstwy, nie dwie** (ustalenie 7b; mapa kodu
  `docs/prompts/mapa-kodu-do-wiki.md:57` wymienia tylko injection): poza bazowym widokiem React
  i `pending-injection.js` w samym bundlu siedzi **mostek** (`deminified/frontend-index.js:9960-10268`)
  — `setQueryDefaults`/`setQueryData` na martwych kluczach, `fetch("/panel/api/atrybuty")` oraz
  **write-through**: opatchowane `Hb`/`Qb`/`Gb` wysyłają POST/PUT/DELETE na `/atrybuty/wartosci`,
  a `window.__atrybutyAddRodzaj` POST-uje na `/rodzaje`. Licznik użycia i modal podglądu
  produktów są WBUDOWANE w bazowy bundle (`:29404-29469`), nie w injection.

- **7a · Backend atrybutów + kolejka pending** — ✅ **zrobione** (ticket
  `29-FEATURE-atrybuty-backend`, 2026-09-04). **13 ścieżek / 18 operacji** za `requireAuth`:
  `/api/atrybuty`, `/atrybuty/liczniki`, `/atrybuty/uzycie`, `/atrybuty/rodzaje` (`GET`/`POST`)
  + `/rodzaje/{value}` (`PUT`/`DELETE`), `/atrybuty/wartosci` (`GET`/`POST`) + `/wartosci/{id}`
  (`PUT`/`DELETE`), `/atrybuty/pending` (**`GET` i `DELETE`**),
  `/atrybuty/pending/{id}/akceptuj|akceptuj-jako-alias|akceptuj-z-edycja|odrzuc`,
  `POST /atrybuty/scan-pending`. Tabele `atrybuty_wartosci_pending`, `..._odrzucone` — kanon
  `001_schema.sql` miał je już w komplecie, **migracji nie było**.
  - **`DELETE /api/atrybuty/pending` realnie istnieje** (`pending_module.cjs:377-390`) i woła ją
    UI produkcji (`pending-injection.js:990`) — czyści kolejkę (`?rodzaj=` zawęża zakres),
    zwraca `{ok, usunieto, rodzaj}`. Stare wyliczenie tego bloku ją pomijało; jest w kontrakcie
    i w zakresie 7a.
  - **Atrybutów NIE MA w rdzeniu backendu — zweryfikowane grafem wywołań.**
    `grep "'/api/atrybuty" mirror/backend/index.cjs` = 0 trafień; klaster `ATTR_CORE_KINDS` /
    `listAtrybuty` / `upsertAtrybutRodzaj` (`mirror/backend/index.cjs:295`) jest MARTWY — żadna
    trasa go nie rejestruje i nie został odtworzony. Żywe źródło to dwa moduły Extensions:
    `atrybuty_module.cjs` (11 tras) i `pending_module.cjs` (7 tras).
  - **`requireAuth` na wszystkich 18 operacjach to odtworzenie 1:1, NIE odstępstwo** — oryginał
    wpina middleware auth (`we`) w każdą trasę obu modułów (`extensions.cjs:80,105`). W tym
    zakresie nie ma czego odnotowywać jako zmianę wobec produkcji.
  - **Dwa skutki dla procesu, oba 1:1 z produkcją:** `stworzApp` sieje słownik przy każdym
    starcie (`zasiejSlownikAtrybutow`, w `try/catch` — baza bez tabel atrybutów nie wywraca
    startu), a `POST /api/staging/accept` uruchamia skan kolejki. Jedyne odstępstwo: skan idzie
    przed odpowiedzią zamiast w `res.on('finish')` — ciało i kod odpowiedzi bez zmian.
  - **Rozliczenie gate'u:** 18 operacji obecnych w `contract/openapi.yaml`, każda oddaje 401 bez
    tokenu; z sześciu fixtures pięć sprawdzanych kształtem 1:1 (`_uzycie` nagrany jako **400**),
    a `GET_atrybuty_liczniki.json` przez nową asercję `sprawdzZgodnoscZFixtureSlownika` (5348 kluczy dynamicznych — porównanie
    dosłowne nie miałoby sensu). 71 testów w domenie atrybutów, suita **917 testów / 58 plików**,
    lint/typecheck/build czyste. Pełny wywód (D1–D6, quirki produkcji — m.in. seed `bieznik`
    z `products.model` i dwie rozjeżdżone mapy rodzaj→kolumna, 15 dla liczników i 13 dla
    kolejki): `docs/tickets/29-FEATURE-atrybuty-backend/`.

- **7b · Widok `/atrybuty`** (FE) — ✅ **zrobione** (ticket `31-FEATURE-atrybuty-frontend`,
  2026-09-04). Widok natywny: kafle rodzajów → panel wartości (CRUD) → kolejka „Do akceptacji"
  z badge'em; bez React Fiber, `MutationObservera`, `tick()`/`cleanup()`, chowania treści
  bazowego widoku i wstrzykiwania CSS. Placeholder zdjęty — w `src/pages/placeholdery.ts`
  został wyłącznie `/moje-konto` (Iteracja 12). Martwe ścieżki naprawione: zero wywołań
  `/api/attributes(-kinds)` w `rebuild/frontend/src` (pozostałe trafienia grepa to komentarze
  i `data-testid` przeniesione 1:1 z oryginału). **Gate:** 564 testy / 38 plików (było 504)
  + 17 testów integracyjnych przeciw żywemu backendowi; lint/typecheck/build czyste.
  - **Zatwierdzone odstępstwa (D2, D4, D7):** `window.prompt`/`confirm` zastąpione dialogami
    Radix z zachowaniem dosłownych tekstów; pominięty martwy filtr „Źródło" (żadna trasa nie
    zwraca `origin`); dialogi akcji masowych pokazują liczbę produktów, których dotknie
    `UPDATE` (`GET /atrybuty/uzycie` → `count`), a toast — `produktow_zaktualizowano` (bo
    backend tych akcji NIE audytuje, backlog #39).
  - **NIE odtworzono kafla „Wszystkie atrybuty" (D3)** — istnieje tylko w bazowym Reakcie,
    injection go chowa, Ania go nie widzi.
  - **Trzy operacje backendu 7a nie mają konsumenta w UI i to jest zgodne z produkcją (D5):**
    `PUT /api/atrybuty/rodzaje/{value}` (zero wywołań w całym froncie), `DELETE
    /api/atrybuty/rodzaje/{value}` („Usuń rodzaj" jest w bazowym Reakcie, ale injection chowa
    kafle, a mostek tej ścieżki nie patchuje → w produkcji nieosiągalne), `POST
    /api/atrybuty/scan-pending` (skan odpala backend po `POST /api/staging/accept`).
  - **CZĘŚĆ B — `DialogReguly.tsx` (`/narzuty`) czyta słownik z `["/api/atrybuty"]`, dostawców
    z `["/api/suppliers"]`:** marki = suma słownika i katalogu (bez `"—"`), kategorie WYŁĄCZNIE
    ze słownika (kategoria spoza katalogu jest wybieralna), `konstrukcja`/`vfIf` przełączone
    z pól tekstowych na selecty słownikowe (oryginał ma dla nich gotowe selecty, `:24286-24313`
    — były nieosiągalne tylko przez sześciopozycyjną listę typów), dostawcy value=`kod`,
    etykieta `"kod · nazwa"`, bez dedupu i sortowania (`:24193`) — degradacja z I4b zamknięta.
- **Ścieżki (GATE):** atrybuty — **13 ścieżek, ale 18 operacji**: różnica bierze się z
  `/api/atrybuty/pending`, które ma i GET, i DELETE. **✅ zielone od 7a**.  **Fixtures:**
  `GET_atrybuty.json`, `_liczniki`, `_pending`, `_rodzaje`, `_uzycie`, `_wartosci`
  — **✅ zielone od 7a**.
- **DoD:** ✅ pełen CRUD + workflow pending w backendzie (7a); ✅ fixtures przez GATE (7a);
  ✅ widok natywny, ✅ martwe ścieżki naprawione, ✅ parytet z `pending-injection.js` (57 KB)
  bez samego skryptu (7b). **Iteracja zamyka się dopiero po 7c** (`/katalog`, listy filtrów
  ze słownika).

- **7c · `/katalog` — listy filtrów ze słownika** (FE) — ⬜ **do zrobienia.** Zależność
  kolejnościowa: startuje PO merge sesji 8b (`30-FEATURE-selly-panel-frontend`), bo dotyka
  `src/pages/Katalog.tsx`, na którym 8b pracuje równolegle.
  - **Efekt uboczny dla I2 (degradacja D3):** `rebuild/frontend/src/pages/katalog/filtrowanie.ts:136-149`
    buduje listy marek i kategorii WYŁĄCZNIE z danych produktów; `/api/atrybuty` działa od 7a,
    więc degradacja czeka już tylko na podpięcie.
  - **Oryginał woła NATYWNĄ ścieżkę:** `useQuery(["/api/atrybuty"])` w
    `deminified/frontend-index.js:23286` — w `/katalog` klucz Query jest ZGODNY z backendem
    (inaczej niż w dialogu reguł 7b, gdzie był martwy `["/api/attributes"]` karmiony mostkiem).
  - **Reguła budowy list (`:23287-23295`) i jej ASYMETRIA:**
    - MARKI (`:23288-23291`): z produktów `map(marka).filter(e => e && !/\d/.test(e))` —
      **filtr „bez cyfr" dotyczy TYLKO marek z produktów**; wartości ze słownika
      (`rodzaj === "marka"`) wchodzą BEZ tego filtra; suma przez `Set`, sort
      `localeCompare(…, "pl")`.
    - KATEGORIE (`:23292-23295`): z produktów BEZ filtra cyfr + wartości słownika
      (`rodzaj === "kategoria"`); suma przez `Set`, **zwykły `.sort()` bez `localeCompare`**.
    - ⚠ **Rozstrzygnięte:** filtr „bez cyfr" NIE obejmuje wartości słownikowych — to fakt,
      nie pytanie otwarte.
    - ⚠ **W `/katalog` KATEGORIE to SUMA słownika i produktów** — INNA reguła niż w dialogu
      reguł `/narzuty` (7b), gdzie kategorie idą WYŁĄCZNIE ze słownika (`:24210`). Nie kopiować
      reguły z 7b do 7c.
  - **CZWARTY konsument słownika, prawdopodobnie NIEPRZEPORTOWANY:** `LT()`
    (`deminified/frontend-index.js:23909-23980`) — dialog EDYCJI produktu, czyta
    `["/api/atrybuty"]` (`:23917`) i buduje selecty pomocnikiem
    `(o?.wartosci||[]).filter(t => t.rodzaj === e).map(...).sort(localeCompare "pl")`
    (`:23966`), a obok czyta `["/api/overrides", dostawca, kod]` i kasuje override'y
    (`DELETE /api/overrides/{id}`). W odbudowie `src/pages/katalog/` ma tylko
    `PodgladProduktu.tsx` (bez edycji) — **7b nie znalazła tego dialogu przypisanego do żadnej
    sesji w roadmapie.** Otwarte pytanie o przypisanie zakresu — decyzja użytkownika, nie
    zadanie 7c.

---

### Iteracja 8 — Selly / sprzedawarka (+ wchłonięcie `selly-injection.js`)
- **⚠ ZALEGŁOŚĆ Z ITERACJI 3 (zapisana 2026-09-01 przez 3d-2) — `products.zastosowanie`.**
  `POST /api/staging/accept` woła w produkcji `__restoreZastosowanie()` (`:44105`), które po
  każdej akceptacji odtwarza puste `zastosowanie` z CSV spoza repo. 3d-2 tego NIE przeportowała
  (decyzja użytkownika); 8a (2026-09-04) tę decyzję potwierdziła (D3) — nadal NIE portujemy.
  **Właścicielstwo rozstrzygnięte: I8, nie I7** — `selly_zastosowanie_category_map` i jej jedyny
  konsument (`mapujZastosowanieNaKategorie`, `src/selly/mapper.ts`) mieszkają w tym bloku.
  Konsekwencja dla Selly (gałąź `fallback_kategoria`/`skipped`) jest zmierzona i zamrożona
  w testach: **`docs/rebuild-backlog.md` #12**.
- **Status:** ✅ **zrobione (2026-09-04)** — **8a (BE)** `28-FEATURE-selly-eksport-backend` ·
  **8b (FE)** `30-FEATURE-selly-panel-frontend`  **Zależy od:** 2, 4
- **Cel (Ania klika):** otwiera `/selly`, generuje/eksportuje CSV do marketplace, widzi status/log/słowniki — natywnie. **Zrobione.**
- **Backend (8a ✅ 2026-09-04):** panel Selly — **5 GET** (`status`, `ping`, `csv-status`, `log`,
  `dictionaries`) + **5 POST** (`categories`, `producers`, `generate-csv`, `sync-product`,
  `sync-supplier`) — w oryginale JUŻ za auth (`extensions.cjs:456-458`, `requireAuth: we`), u nas
  bez zmiany. `GET /api/export/shoper`, `/api/export-shoper` (pełny katalog CSV) są w oryginale
  publiczne — u nas **+`requireAuth`** (odstępstwo świadome §3, D1). Tabele
  `selly_kategoria_norm_map`, `selly_zastosowanie_category_map` już istniały w schemacie
  (`rebuild/schema/001_schema.sql:257-311`) — migracja nie była potrzebna.
  **Sześć z dziesięciu tras panelu gadają z realnym API Selly.pl** (OAuth2 `client_credentials`,
  sekrety `SELLY_SHOP_URL/CLIENT_ID/CLIENT_SECRET/SCOPE`): `ping`, `dictionaries`, `producers`,
  `categories`, `sync-product`, `sync-supplier`. Lokalne (czysty SQLite/plik, zero HTTP) są tylko
  cztery: `status`, `log`, `csv-status`, **`generate-csv`**. Szczegóły portu (klient/mapper/
  generator CSV, decyzje D1–D8): `docs/tickets/28-FEATURE-selly-eksport-backend/`.
- **Frontend (8b ✅ 2026-09-04, `30-FEATURE-selly-panel-frontend`):** `/selly` jest natywną
  trasą Wouter (React/TanStack), pokrywa cały zakres żywego
  `mirror/frontend/assets/selly-injection.js` (**30 936 B**, nie 26 KB — poprzedni wpis mylił
  jednostki; `VERSION='v5-csvstatus-genbtn'`): pięć sekcji („Status połączenia", „Codzienna
  synchronizacja CSV", „Mapowanie dostawców", „Sync dostawcy", „Historia operacji"), sześć tras
  API (`ping`, `csv-status`, `generate-csv`, `status`, `log?limit=10`, `sync-supplier`). Przycisk
  eksportu CSV w `/katalog`, odłożony z I2, jest dowieziony — w 100% kliencki, jak w oryginale.
  Szczegóły portu: `docs/tickets/30-FEATURE-selly-panel-frontend/plan.md`.
  - **`mirror/frontend/selly.html` (8 587 B, mtime 2026-07-31 08:53) to martwy POPRZEDNIK** —
    brak przycisku „Wygeneruj CSV teraz"/`generate-csv`, nielinkowany z niczego, dostępny tylko
    po bezpośrednim URL. Żywy jest `selly-injection.js` (mtime 09:19, plik `.bak_pre_genbtn`
    obok). Plik zostaje w `mirror/` nietknięty (`mirror/` jest lustrem produkcji, D6) — to
    ustalenie ma nie być odkrywane drugi raz.
  - **D4 — brak sekretów `SELLY_*`:** sześć tras zewnętrznych oddaje 500 z `[Selly] Brak
    konfiguracji: …` (1:1 z produkcją), panel rozpoznaje ten konkretny komunikat i pokazuje
    „Selly nieskonfigurowane"; każdy inny błąd leci surowo, jak w oryginale.
  - **D3 — potwierdzenie przed pełnym syncem (świadome odstępstwo).** `POST
    /api/selly/sync-supplier` z `dry_run:false` realnie modyfikuje cudzy, żywy sklep. Dialog
    potwierdzenia obejmuje **oba** wejścia: przycisk „Wyślij do Selly" ORAZ przycisk **„Sync"
    per wiersz w tabeli „Mapowanie dostawców"** (`selly-injection.js:637-646`) — w oryginale ten
    drugi odpalał pełny, niedry-runowy sync jednym kliknięciem, bez pytania; to najgroźniejszy
    przycisk panelu i 8b go ubezpiecza. „Test dry-run" leci bez pytania (nic nie zapisuje).
  - **D5 — lista dostawców do „Sync dostawcy" liczona dynamicznie z `GET /api/selly/status`**
    (`items[].dostawca`, sortowanie MO1…MO10 numeryczne), zamiast zahardkodowanego
    `['MO1'…'MO10']` z oryginału (`:499`) — bez dodatkowego żądania, bo `/status` i tak jest
    wołane do tabeli mapowania.
  - **D7 — ikona sidebara `PackageOpen` z lucide** zamiast wklejonego SVG „karton" z oryginału
    (`Package` zajęte przez „Katalog").
  - **O1 — `/selly` jako trasa Wouter + 11. pozycja sidebara.** W oryginale Selly **nie było
    trasą Reacta w ogóle** — injection dokładał link i overlayował `<main>` po fladze
    `sessionStorage.sellyViewActive`, hash zostawał `#/`. Stąd router ma teraz **13 tras**
    (oryginał 12), sidebar **11 pozycji** (oryginał 10) — komentarze liczbowe w `App.tsx`/
    `placeholdery.ts`/`nawigacja.ts` niosą to uzasadnienie.
  - **⭐ Sprostowanie faktograficzne — przycisk „Pobierz CSV (Shoper)" w `/katalog` domyślnie
    NIE jest w trybie Shoper.** Stan wybranych kolumn inicjalizuje się jako 15 kolumn
    domyślnych (`frontend-index.js:23272`, hook `_T()` :23039) i warunek „zero kolumn wybranych"
    zachodzi **wyłącznie**, gdy Ania odznaczy w konfiguratorze WSZYSTKIE kolumny. Domyślna
    ścieżka codziennego użycia to więc gałąź „wybrane kolumny": separator wymuszony na `";"`
    (konfiguracja Shoper IGNOROWANA), plik `katalog_wszyscy_wybrane_<data>.csv`, etykieta
    **„Pobierz CSV (15 kol.)"**. Format Shoper (zahardkodowana 13-kolumnowa lista `TT`, klucze
    `shoper.kolumny`/`shoper.separator` z `/konfiguracja` → „Shoper", zapisywane tam od I11) jest
    osiągalny dopiero po odznaczeniu wszystkich kolumn — kod czyta oba źródła i podłącza je
    poprawnie, tylko druga gałąź jest praktycznie nieosiągalna w codziennym użyciu. Poprzedni
    wpis w tym miejscu („przycisk zawsze wpada w fallbacki, `shoper.kolumny`/`shoper.separator`
    trzeba dopiero podłączyć") był nieaktualny — klucze SĄ podłączone od tej sesji, obie gałęzie
    odtworzone 1:1 i zamrożone testami. Dwie trasy eksportu serwerowego z 8a
    (`GET /api/export-shoper` z `?dostawca=`, `GET /api/export/shoper` z `?supplier=`, pierwsza
    bez parametru oddająca ZIP) zostają bez konsumenta we froncie — zgodnie z produkcją (D2 planu).
- **Ścieżki (GATE):** selly×10 (5 GET + 5 POST), export×2.  **Fixtures 8a:** `GET_selly_status.json`,
  `_ping`, `_csv-status`, `_log`, `_dictionaries`. — **GATE 8a ✅ zielony** (12/12 ścieżek,
  5/5 fixtures 1:1, 954/954 testów). **GATE 8b ✅ zielony** — panel konsumuje **cztery** z pięciu
  fixtures (`_ping`, `_csv-status`, `_status`, `_log`); piąty, `_dictionaries`, świadomie poza
  zakresem, bo trasa `dictionaries` nie ma konsumenta w UI (D1 planu 8b). Testy frontendu
  **572/572**; build: wspólny chunk 514,52 kB (gzip 156,65 kB), `Analityka` 444,15 kB.
- **DoD:** ✅ panel Selly natywny; ✅ eksport CSV — serwerowy (8a, za `requireAuth`) + przycisk
  w `/katalog` odłożony z I2 (8b); ✅ fixtures przez GATE (8a i 8b); ✅ parytet z
  `selly-injection.js` odnotowany faktyczną wielkością pliku (**30 936 B**).
- **📄 Instrukcja testów dla Ani: `docs/instrukcja-testow-I8.md`** (`33-DOCS-instrukcja-testow-i8`).
  ⚠ Jedyna instrukcja w projekcie, która NIE zaczyna się od „to staging, testuj bez skrupułów":
  `POST /api/selly/sync-supplier` z `dry_run=false` realnie modyfikuje sklep Selly, a staging
  i produkcja mogą wskazywać ten sam sklep. Dokument opisuje **trzy tryby testowania**
  (A: bez sekretów — zero ryzyka i ~80% zakresu; B: podłączony, tylko odczyt i dry-run;
  C: pełny zapis) oraz odpowiada na pytanie o sandbox: **Bridge nie ma sandboxa Selly**,
  konfigurowalny jest wyłącznie `SELLY_SHOP_URL`; istnienie instancji testowej po stronie
  Selly.pl jest do ustalenia z nimi, nie z repo.

---

### Iteracja 9 — Waga gabarytowa
- **Status:** ✅ **zrobione** (2026-09-03, ticket `18-FEATURE-waga-gabarytowa`)  **Sesje:** 1  **Zależy od:** 2
- **Cel (Ania klika):** otwiera `/waga-gabarytowa`, liczy wagę gabarytową dla opony — **zrobione**.
- **⚠ Backend i frontend to DWA RÓŻNE kalkulatory, nie jeden wzór w dwóch miejscach** — ustalone
  grafem wywołań, obala poprzednie założenie tego bloku. Backend (`POST /api/waga-gabarytowa/oblicz`,
  `deminified/backend-index.cjs:48749-48769`) liczy wagę **paletową/oponową**: zaokrągla szerokość
  do progów półpalety (≤55→60 cm stała) / palety (≤80→80 cm), dolicza wysokość palety (+10 cm),
  mnoży przez współczynnik `0.000167`, wszystko z configu `waga_gab.*`. Frontend
  (`deminified/frontend-index.js:26514-26953`) liczy wagę **wolumetryczną kurierską**
  (`dł×szer×wys/dzielnik`, dzielnik per przewoźnik: GEIS 10000, DPD 6000, GLS 4000,
  InPost/UPS/DHL 5000) + objętość m³ + „waga do wyceny", lokalnie, stan w IndexedDB, **zero
  wywołań API**. **Decyzja D1 (dowieziona):** oba 1:1, każdy jak w oryginale; FE nie woła
  endpointu. Szczegóły: `docs/tickets/18-FEATURE-waga-gabarytowa/plan.md`.
- **Backend:** `POST /api/waga-gabarytowa/oblicz` dowieziony, formuła 1:1, za `requireAuth`
  (⚠ odstępstwo świadome D2 — produkcja i kontrakt mają trasę publiczną `security: []`,
  kontynuacja D1 z I1; kontraktu nie ruszano). Endpoint **bez konsumenta** — FE go nie woła.
- **Frontend:** widok `/waga-gabarytowa` dowieziony — formularz + wynik + pełny edytor
  przewoźników/dzielników (D3), trwałość w IndexedDB przez `magazynKV`.
- **Ścieżki (GATE):** `POST /api/waga-gabarytowa/oblicz` — **fixtures faktycznie brak**
  (potwierdzone), siatka oparta na `sprawdzZgodnoscZKontraktem` + teście jednostkowym formuły
  jako głównym dowodzie zgodności; 401 bez tokenu asertowany wprost poza checkerem (kontrakt
  tego kodu nie zna dla tej ścieżki — ten sam zabieg co `GET /api/markups`).
- **DoD:** kalkulacja zgodna z oryginałem po obu stronach; decyzja lokalne/API rozstrzygnięta
  (D1) — rekomendacja „przez API" odrzucona, bo opierała się na fałszywej przesłance
  (wzory nie są tożsame).

---

### Iteracja 10 — Analityka + pulpit
- **Status:** ✅ **zrobione**  **Sesje (6 bloków, dekompozycja 2026-09-02):** 10a fundament → [10b·10c·10d·10e równolegle] → 10f  **Zależy od:** 2, 3, 4  **Wszystkie sześć bloków zamknięte:** 10a i 10d — 2026-09-03; 10c — 2026-09-03; 10b i 10e — 2026-09-04; 10f (`26-FEATURE-analityka-export-pulpit`) — 2026-09-04, zamyka iterację.
- **Cel (Ania klika):** otwiera `/analityka` (20+ dashboardów) i pulpit `/` (agregaty).
- **📄 ŚCIĄGA WYKONAWCZA DLA BLOKÓW 10b–10f: `docs/analityka-bloki-10b-10f.md`.**
  Przeczytaj JĄ, zanim napiszesz plan bloku. Per trasa: numer linii handlera, parametry query,
  LIMIT-y i kształt odpowiedzi; per zakładka: karty oryginału z kolumnami i etykietami PL;
  do tego lista **ośmiu tras, których oryginalny frontend NIE WOŁA W OGÓLE** (`kpi`,
  `dostawcy-stats`, `top-zmiany`, `importy-timeline`, `ean-porownanie`, `ean/details`,
  `bootstrap-current`, plus martwy fetch `market/group-prices`), lista fixtures z pustymi
  tablicami i lista tego, co 10a już zbudowało. Sesja 10a musiała ustalić to sama i kosztowało
  ją to osobną rundę pytań — kolejne bloki mają to gotowe.
- **⚠ `historia_cen` — stan po 10b (sprostowane 2026-09-04).**
  Tabela ma dziś **dwóch pisarzy**: blok 3d-1 (`rebuild/backend/src/repos/historia.ts`,
  `zapiszHistorieCen` — migawka cenowa przy auto-zatwierdzeniu importu w `tk()`) oraz blok 10a
  (`POST /api/analytics/bootstrap-current` — migawka całego aktywnego katalogu). I5 tej tabeli
  **nie dotknęła w ogóle** — widok `/historia` to log zdarzeń z `audit_log`
  (import/eksport/edycja), nie lista zmian cen per produkt.
  **Pierwszego czytelnika dowiozło 10a:** `GET /api/analytics/status` (agregat
  `{hasHistory, snapshots, od, do}`). Czytelnika per produkt dowiózł **blok 10b** ✅
  (`24-FEATURE-analityka-ceny`, 2026-09-04): `GET /api/analytics/prices/product-history`
  (`mirror/backend/analytics_module.cjs:250`,
  fixture `contract/fixtures/GET_analytics_prices_product-history.json`).
  ⚠ Z tej tabeli liczy się też `hasHistory` w siedmiu innych trasach — na pustej tabeli
  zwracają `{hasHistory: false, rows: []}` i to jest poprawne zachowanie, nie awaria.
- **Tu też należy `GET /api/history` jako źródło danych dla Pulpitu** (`frontend-index.js:16852`).
  Endpoint jest już zaimplementowany i przetestowany w I5 (`src/routes/history.ts`), czyta
  tabelę `history`; na stagingu zwraca dziś `[]`, bo ta tabela nie ma jeszcze pisarza (patrz I5).
- **⭐ Kolejność:** 10a zrobione (2026-09-03) — szkielet `/analityka`, filtry globalne, nagłówek
  KPI i wzorzec sekcji/wykresu stoją. 10c i 10d zrobione (2026-09-03), 10b i 10e (2026-09-04)
  — **wszystkie pięć zakładek widoku `/analityka` niesie treść**, a zakładka `marza` ma komplet
  trzech kart oryginału. Komponent-zaślepka `ZakladkaWPrzygotowaniu` zniknął z `Analityka.tsx`,
  bo nie ma już czego zastępować. **10f zrobione 2026-09-04** — moduł analityki kompletny,
  27/27 tras, Pulpit `/` odtworzony, Iteracja 10 zamknięta.
- **10a · Fundament analityki** ✅ (BE+FE) — `19-FEATURE-analityka-fundament` · 2026-09-03.
  Backend: pięć tras za `requireAuth` (`filters`, `status`, `kpi`, `margins`,
  `bootstrap-current` POST), agregaty 1:1 z `analytics_module.cjs`. Frontend: szkielet
  `/analityka`, pięć zakładek 1:1 z oryginałem (`dostawcy`→`ean`→`ceny`→`dostepnosc`→`marza`,
  domyślna „Dostawcy"), wypełniona wyłącznie karta „Marża per dostawca/kategoria/marka" jako
  wzorzec (wykres + tabela), pozostałe zakładki puste ale nazwane. **Prompt bloku opisywał
  inny ekran niż ma oryginał** — zweryfikowane w kodzie i rozstrzygnięte czterema decyzjami
  użytkownika 2026-09-03 (D1–D4, `docs/tickets/19-FEATURE-analityka-fundament/plan.md`):
  - O-10a-1 — nagłówek KPI (4 kafle) czyta `/api/analytics/kpi`, którego **oryginalny frontend
    nie woła ani razu** (`analytics_module.cjs:324`: „backward-compatible alias"); oryginalne
    4 kafle liczą co innego (`filters.dostawcy.length`, `ean/comparison`, `ean/unique`,
    `status.snapshots`) i wymagają tras z 10c.
  - O-10a-2 — globalny pasek 6 wyszukiwalnych filtrów: oryginał pobiera `/filters`, ale
    renderuje z nich wyłącznie `dostawcy.length` — paska filtrów w UI oryginału nie ma.
    Filtrowanie w 10a jest **klienckie** (`useMemo`): `GET /margins` nie przyjmuje żadnego
    query param, `currentWhere()` (`analytics_module.cjs:60-74`) ma zero wywołań w 27 trasach
    modułu — martwy kod, świadomie nieożywiony.
  - O-10a-3 — wykres słupkowy w sekcji marż: oryginał **nie ma ani jednego wykresu** (grep
    `recharts|chart.js|d3|apexcharts|echarts|nivo` po `mirror/frontend/assets/*.js` → 0
    trafień); infrastruktura (Recharts 3.x, `components/ui/chart.tsx`, paleta `--chart-1..5`)
    stawiana jako fundament pod 10b–10e.
  - O-10a-4 — zakładki `ean`/`ceny`/`dostepnosc` puste do czasu 10b–10e (zakres bloku, nie
    zmiana zachowania).
  - Gate: fixtures kpi/filters/status/margins (kształt 1:1 + openapi; bootstrap-current tylko
    openapi, brak fixtura zapisu) — zielony za pierwszym uruchomieniem, zero `WyjatekGate`.
  - **Wzorzec sekcji dashboardu dla 10b–10e:** `rebuild/frontend/src/pages/analityka/README.md`.
- **Wzorzec i pułapki dla 10c–10e (z 10a/10b, obowiązujące 1:1):** podział plików `api.ts` /
  `filtrowanie.ts` / `Sekcja<Nazwa>.tsx`; reużyć `TabelaAnalityki` (port `I()`, limit 300
  wierszy), `KontenerWykresu` + paletę (zamrożona, `--chart-1..5`, chroni
  `test/tokeny.test.ts`, nie zmieniać), `WyborZWyszukiwarka`, `formatowanie.ts`,
  `FiltryGlobalne`. Parametr idzie do zapytania tylko tam, gdzie **oryginalna trasa naprawdę
  czyta `req.query`** (potwierdzone: `market/group-prices?group`, `prices/product-history?ean&kod`
  w 10b; `rotation/inactive?days` w 10e; `ean/comparison?minDiffPct`, `ean/details?ean`,
  `ean-porownanie?ean` w 10c — backend odtwarza te trzy parametry 1:1, ale **oryginalny front
  żadnego z nich nie podaje**, więc hooki 10c wołają te trasy bez query, D3 w
  `22-FEATURE-analityka-ean`) — reszta filtruje klientem przez `zastosujFiltry`+
  `useMemo`. **⚠ Nie ufaj samemu faktowi „trasa czyta query" jako sygnałowi, że front go
  wysyła** — zweryfikuj grepem hook w `deminified/frontend-index.js`, tak jak w 10c.
  **⚠ Sprostowane w 10b — JAK parametr trafia do URL:** oryginał NIE skleja segmentów
  `queryKey` w ścieżkę, tylko pisze własny `queryFn` z jawnym query stringiem (`?ean=&kod=`),
  a klucz trzyma jako listę wartości (`deminified/frontend-index.js:27870-27877`). Wzorzec do
  skopiowania: `useHistoriaCenyProduktu` w `pages/analityka/api.ts`; pełny opis
  w `pages/analityka/README.md` §2.2. Dotyczy `rotation/inactive?days` w 10e.
  Trzy pułapki z 10a: (a) `_przyciete` w fixtures to adnotacja nagrywarki, nie pole
  API — zwrócenie go wywala GATE; (b) puste tablice **po ŻADNEJ ze stron** (fixture lub
  odpowiedź testowa) nie dowodzą kształtu wiersza — `test/gate/ksztalt.ts:50` porównuje
  elementy tablicy parami, więc pusta odpowiedź przechodzi bez dowodu tak samo jak pusta
  fixture; testy GATE muszą asercją wymuszać niepustą odpowiedź, a zasiew musi ją zapewnić
  (wzorem `zasiejHistorieCenDlaCen` z 10b, `test/gate/dane.ts`) — pokryć też testem
  jednostkowym; (c) przed odtwarzaniem czegokolwiek zgrepować ścieżkę w
  `deminified/frontend-index.js` — `kpi` ma fixture, a oryginalny FE go nie woła.
  `openapi.yaml` nie ma schematów odpowiedzi dla żadnej trasy analityki (tylko kody +
  `security`) — kształt niosą wyłącznie fixtures. Auth nie jest tu odstępstwem D1: wszystkie
  trasy analityki mają w kontrakcie `security: [{bearerAuth},{cookieAuth}]`, a oryginał
  wszędzie podaje `requireAuth` — zgodność pełna.
  **Od 10e (2026-09-04) doszły dwa reużywalne kawałki, którymi 10b/10c/10d nie muszą pisać
  drugi raz:** generyk `zastosujFiltry(wiersze, wybor, mapowanie)` + `wymiaryZMapowania` w
  `pages/analityka/filtrowanie.ts` (istniejące `zastosujFiltryMarz` to już tylko cienka
  nakładka na ten generyk) oraz wspólny nagłówek karty `pages/analityka/NaglowekSekcji.tsx`.
- **Techniczne (z 10a):** `/analityka` ładowana leniwie (`lazy`+`Suspense` w `App.tsx`) —
  Recharts podnosił wspólny bundle FE z 451 kB do 837 kB, a używa go tylko ten widok; po
  podziale wspólny 452 kB, chunk `Analityka` 385 kB (stan po 10a). **Stan po 10c i 10d (2026-09-04):**
  chunk `Analityka` 398 kB, wspólny 484 kB — wzrost wspólnego bundla nie pochodzi z tych bloków
  (wszystkie pliki dodane w 10c i 10d są importowane wyłącznie przez leniwie ładowaną
  `Analityka.tsx`, zweryfikowane grepem). 10b/10e dokładają wykresy do tego samego chunku,
  nic nie trzeba zmieniać. Nowe zależności FE: `recharts@^3.10.1`, `@radix-ui/react-popover@^1.1.0`.
- **Wzorzec i gotowa infrastruktura z 10c i 10d (dla 10b/10e, obowiązujące 1:1):**
  (a) `components/ui/chart.tsx` ma `PROMIEN_SLUPKA_PIONOWEGO` dla wykresów słupkowych pionowych
  (10c) — reużyć, nie duplikować; (b) `pages/analityka/formatowanie.ts` ma `zaokraglij()` (10c) —
  używać go zamiast własnego `Math.round(x*100)/100`; (c) `pages/analityka/filtrowanie.ts` ma
  generyczne `zastosujFiltryDostawcow()` (10d) dla KAŻDEGO wiersza z kolumną `dostawca` — nie
  pisać drugiej funkcji o tym samym działaniu pod inną nazwą (10c i 10d zrobiły dokładnie to
  równolegle; duplikat usunięto przy scalaniu 2026-09-04); (d) `pages/analityka/PasekDostepnosci.tsx`
  (10d) — pasek postępu dla kolumny „Dostępność", **blok 10e ma go zaimportować**;
  (e) **każdy blok zakłada WŁASNE pliki testowe** (`analityka.<blok>.gate.test.ts`,
  `analityka.<blok>.test.ts(x)` itd.) zamiast dopisywać do plików 10a — bloki idą równolegle,
  wspólne pliki testowe to gwarantowany konflikt przy merge'u. **Jeden wyjątek, sprawdzony
  w praktyce:** handlery MSW nowej zakładki trzeba dodać do `zamockujApi` w `analityka.test.tsx`
  ORAZ do plików widoku pozostałych bloków — widok pobiera KOMPLET tras przy każdym wejściu,
  niezależnie od aktywnej zakładki, a `onUnhandledRequest: "error"` wywala test bez nich;
  (f) progi czasowe testów frontendu są już podniesione (`vitest.config.ts`
  `testTimeout`/`hookTimeout` 20 s, `test/setup.ts` `asyncUtilTimeout` 5 s) — bez tego pełny
  `vitest run` był niedeterministyczny pod obciążeniem (znaleziono przy review 10c), nie trzeba
  tego robić drugi raz.
- **10b · Ceny** ✅ (BE+FE) — `24-FEATURE-analityka-ceny` · 2026-09-04.
  Backend: pięć tras za `requireAuth` (`market/group-prices`, `prices/last-import`,
  `prices/product-history`, `prices/inflation`, `top-zmiany`), agregaty 1:1 z
  `mirror/backend/analytics_module.cjs:237-268,333`. Frontend: zakładka `ceny` z trzema
  kartami 1:1 z oryginałem (`deminified/frontend-index.js:28295-28416`) — „3.1 Zmiany cen
  z ostatnich importów”, „3.2 / 3.3 Historia ceny wybranej opony”, „3.6 Inflacja cennika”.
  Nowe pliki: `pages/analityka/SekcjaCeny.tsx`, `pages/analityka/useOpoznionaWartosc.ts`
  (debounce, reużywalny w 10c/10e — patrz niżej).
  - **D1** — `top-zmiany`: backend TAK, UI NIE (zero wywołań w bundlu produkcji — trasa bez
    konsumenta).
  - **D2** — `market/group-prices`: backend TAK, UI NIE (potwierdzony martwy fetch:
    `group=marka` na sztywno, wynik nigdzie nieużyty, selektora grupy w UI nie ma).
  - **D3** → **O-10b-1** (odstępstwo) — debounce 300 ms na polach EAN/Kod. Oryginał pyta na
    każde naciśnięcie klawisza, a trasa nie ma LIMIT-u i skanuje `historia_cen` (15 597
    wierszy w nagraniu).
  - **D4** — `stats {min,max,avg}` z `product-history` pobierane i NIERENDEROWANE, dokładnie
    jak `margins.low`/`high` w 10a.
  - **O-10b-2** (odstępstwo, rozszerzenie O-10a-3) — wykres liniowy w karcie inflacji.
    Próg `MIN_MIESIECY_NA_WYKRESIE = 2` — linia przez jeden punkt to nie szereg czasowy;
    karta wtedy pokazuje samą tabelę.
  - Przycisk „CSV” przy karcie „3.1” świadomie pominięty (trasa `export/{view}` — **10f**).
  - Gate: pięć fixtures (kształt 1:1 + kontrakt + 401), zielony za pierwszym uruchomieniem,
    zero `WyjatekGate`; zasiew `zasiejHistorieCenDlaCen` w `test/gate/dane.ts` (wielu
    dostawców × dwa miesiące × niepusty `ean` — patrz pułapka (b) niżej). Backend 719
    testów ✓, frontend 410 ✓, lint/typecheck/build ✓ w obu projektach.
  - Agregaty sprawdzone dodatkowo na snapshocie produkcji (`db/snapshot.db`) — odtwarzają
    wartości nagrań, nie tylko kształt: `group-prices` 92 wiersze (fixture 92), `inflation`
    17 (fixture 17, pierwszy wiersz identyczny), `top-zmiany` pierwszy wiersz identyczny,
    `product-history` min/max identyczne.
  - Chunk `Analityka`: 385 kB (10a) → 436 kB po scaleniu 10b z 10c i 10d; wspólny bundle bez zmian.
  - 📄 Szczegóły trasa po trasie i karty oryginału: `docs/analityka-bloki-10b-10f.md` §4.
- **10c · EAN** ✅ (BE+FE) — `22-FEATURE-analityka-ean` · 2026-09-03. Sześć tras za `requireAuth`
  (`ean/comparison`, `ean/coverage`, `ean/details`, `ean/supplier-rank`, `ean/unique`,
  `ean-porownanie`), agregaty 1:1 z `analytics_module.cjs`, zweryfikowane liczbowo na kopii
  `db/snapshot.db`. Frontend: zakładka `ean` wypełniona trzema kartami oryginału („2.1-2.4
  Porównanie cen po EAN", „2.5 Pozycje unikalne", „2.6 Pokrycie wspólne i ranking dostawcy" —
  jedna karta, dwie tabele w gridzie) + dwa wykresy (odstępstwo O-10c-1, jak O-10a-3 w 10a).
  `ean/details` i `ean-porownanie` dowiezione jako trasy bez UI (D6 — zero konsumentów
  w oryginalnym froncie, jak `bootstrap-current` w 10a). **`minDiffPct` w UI i przyciski
  „CSV" świadomie pominięte** (D3, D5) — patrz noty w bloku **10f** niżej.
  - 📄 Szczegóły trasa po trasie i karty oryginału: `docs/analityka-bloki-10b-10f.md` §5.
  - Gate: fixtures EAN (6), zielone. `ean/comparison` czyta `?minDiffPct`, `ean/details` i
    `ean-porownanie` czytają `?ean` — patrz poprawka w sekcji „Wzorzec i pułapki" niżej.
- **10d · Dostawcy** ✅ (BE+FE) — `23-FEATURE-analityka-dostawcy` · 2026-09-03.
  Backend: cztery trasy `GET /api/analytics/{suppliers/stability, suppliers/lifecycle,
  suppliers/stock, dostawcy-stats}` za `requireAuth`, agregaty 1:1 z `analytics_module.cjs`
  (`:110-154`, `:332`), żadna nie czyta `req.query`. Frontend: zakładka `dostawcy` —
  **domyślna zakładka widoku** — wypełniona trzema kartami wg wzorca 10a: „1.1 Stabilność
  cennika dostawcy" (7 kolumn), „1.2 Nowości i wycofania" (6), „1.4 / 1.5 Stan i dostępność
  dostawcy" (5, z paskiem postępu). Gate: 4/4 fixtures + kontrakt, zero zadeklarowanych
  wyjątków; backend 703 testy, frontend 408.
  - O-10d-1 — wykres słupkowy dostępności w karcie „1.4 / 1.5" (kontynuacja O-10a-3, oryginał
    nie ma żadnych wykresów), decyzja użytkownika D2 z 2026-09-03.
  - O-10d-2 — filtrowanie klienckie + notka o wymiarach nieobsługiwanych: wiersze wszystkich
    trzech tras niosą wyłącznie wymiar `dostawca`.
  - D1 — karta „1.1" odtworzona 1:1 mimo że 7 kolumn UI nie pokrywa się z żadną z dwóch
    gałęzi SQL (`hasHistory: true`/`false` zwracają różne podzbiory kolumn); puste komórki
    pokazują „—" bez adnotacji — to zastane zachowanie oryginału, nie bug.
  - D3 — `dostawcy-stats` dowiezione bez konsumenta w UI (0 wywołań w oryginalnym bundlu),
    analogicznie do `POST bootstrap-current` z 10a.
  - D4 — pasek dostępności wydzielony od razu jako wspólny komponent:
    `rebuild/frontend/src/pages/analityka/PasekDostepnosci.tsx` (port `O(e)`,
    `deminified/frontend-index.js:27919-27936`). Blok 10e (karta „4.1 Historia dostępności
    pozycji") importuje ten sam komponent — obie karty stoją na jednym źródle (2026-09-04).
  - D5 — przyciski „CSV" świadomie pominięte we wszystkich trzech kartach (trasa eksportu → 10f).
  - 📄 Szczegóły: `docs/tickets/23-FEATURE-analityka-dostawcy/`.
- **10e · Dostępność / rotacja / cykl** ✅ (BE+FE) — `25-FEATURE-analityka-dostepnosc-rotacja` ·
  2026-09-04. Sześć tras (`availability/products`, `availability/sell-through`,
  `rotation/inactive`, `lifecycle/models`, `seasonality/monthly`, `importy-timeline`), agregaty
  1:1 z `analytics_module.cjs:156-334`. `rotation/inactive` i `lifecycle/models` dokładają się
  **pod** kartą marż z 10a w zakładce `marza` (jak w oryginale, `deminified/frontend-index.js:28516-28640`);
  `availability/*` + sezonowość (jedyny wykres bloku, jedna seria — O-10e-1) wypełniają zakładkę
  `dostepnosc`. `importy-timeline` — backend bez UI, oryginał tej trasy nie woła (D2).
  `?days` (rotacja) jedyny filtr serwerowy bloku; stan pola mieszka w `Analityka.tsx`, nie w
  sekcji (inaczej `Tabs.Content` bez `forceMount` resetuje go przy zmianie zakładki).
  **⚠ Odkrycie: `historia_cen` nie ma kolumny `nazwa`** — obie karty `availability/*` (4.1, 4.2)
  odtworzone 1:1 (port `safeAll`) zwracają w produkcji trwale `rows: []` mimo 15 597 migawek w
  historii; ⬜ do decyzji Ani, `docs/rebuild-backlog.md` #32/#33 (dotyczy też dwóch widoków
  eksportu CSV — wejście dla 10f, patrz niżej).
  - Uwaga z 10b o pustych fixtures rozliczona: GATE bloku ma własny, poszerzony zasiew
    (migawki z marką i modelem) i jawną asercję `rows.length > 0` przed porównaniem z fixture'em
    dla dwóch tras, których nagrania nie są puste.
  - ⚠ Nota z 10b zapowiadała dla `?days` własny `queryFn` z kluczem-listą, jak przy
    `prices/product-history?ean&kod`. 10e poszło prościej — CAŁY adres w JEDNYM segmencie klucza
    (`["/api/analytics/rotation/inactive?days=60"]`), tak jak `pages/Staging.tsx`
    i `pages/Historia.tsx`. Własny `queryFn` jest potrzebny wyłącznie tam, gdzie zapytanie ma
    się NIE wykonać przy pustych parametrach — a `?days` ma zawsze wartość domyślną.
  - 📄 Szczegóły trasa po trasie i karty oryginału: `docs/analityka-bloki-10b-10f.md` §7.
  - Gate: fixtures tej grupy (6) — zielone.
- **10f · Export + Pulpit** ✅ (BE+FE) — `26-FEATURE-analityka-export-pulpit` · 2026-09-04.
  Zamyka Iterację 10: moduł analityki kompletny, **27/27 tras**. Backend: 27. i ostatnia trasa
  `GET /api/analytics/export/{view}` (`analytics_module.cjs:305`) — dziesięć widoków CSV,
  **każdy z WŁASNYM SQL-em** portowanym z `analytics_module.cjs:311-320`, innym niż trasa
  dashboardu o tej samej nazwie (np. `export/suppliers-stability` liczy zawsze z `historia_cen`
  i oddaje kolumny `produkty, punkty, sredniaCena, sredniStan` — nie da się go zbudować z danych,
  które sekcja dashboardu ma już w pamięci). Frontend: przyciski „CSV" dołożone do dziesięciu
  kart `/analityka`, świadomie pominiętych przez 10a–10e (`M("margins")` z 10a,
  `M("prices-last")` z 10b, `M("ean-comparison")`/`M("unique")` z 10c,
  `M("suppliers-stability")`/`M("suppliers-lifecycle")`/`M("suppliers-stock")` z 10d,
  trzy karty 10e), oraz odtworzony Pulpit `/` — **ostatni placeholder Iteracji 10** zdjęty
  z `pages/placeholdery.ts` (zostają dwa wpisy: `/atrybuty`, `/moje-konto`; router dalej 12 tras).
  - **Sprostowanie wobec wcześniejszego zapisu w tym pliku i w `docs/analityka-bloki-10b-10f.md`
    §8.2 — Pulpit oryginału NIE woła żadnej trasy `/api/analytics/*`.** Zweryfikowane
    w `deminified/frontend-index.js:16836-17090` (`N2`): pobiera wyłącznie `/api/products`,
    `/api/staging`, `/api/suppliers`, `/api/history`; cztery kafle KPI liczy **klientem**
    (port `Si()`: ikona, `href`, trend) — to inne cztery liczby niż nagłówek `NaglowekKpi`
    z 10a i inny layout (D2). Jedyna trasa analityki, z którą Pulpit ma coś wspólnego, to
    zero — 10a/10c dostarczyły dane dla `/analityka`, nie dla `/`.
  - **D1 (kontynuacja D1 z I6, backlog #26) — alerty Pulpitu na realnym `/api/alerts`, NIE na
    pseudo-alertach katalogowych `pv()` z oryginału** (odstępstwo O-10f-1). Reużyty gotowy
    klient `pobierzAlerty()` (`pages/alerty/api.ts`, Iteracja 6) i logika filtrowania — bez
    drugiego klienta. Karta „Najnowsze powiadomienia" renderuje się tylko gdy `o.length > 0`,
    limit 5, sort poziom→data malejąco.
  - **D3 — kafel „Ostatni eksport CSV" odtworzony 1:1 jako TRWALE MARTWY.** Szuka
    `typ === "eksport"` w `GET /api/history` (I5), a ta trasa oddaje tabelę `history`, której
    wiersz nie ma pola `typ` (niesie je `GET /api/history/paged` z `audit_log`). Pokazuje zawsze
    „—"; naprawa czeka na decyzję Ani (`docs/rebuild-backlog.md`).
  - **Fakt — „LIMIT 5000" NIE dotyczy wszystkich dziesięciu widoków eksportu.** Mają go tylko
    sześć: `suppliers-lifecycle`, `prices-last`, `availability-products`, `sell-through`,
    `margins`, `rotation-inactive`; `suppliers-stability`, `suppliers-stock`, `ean-comparison`
    i `unique` **nie mają żadnego limitu** (`analytics_module.cjs:311-320`, zweryfikowane linia
    po linii). Portowane dosłownie, bez dokładania limitu, którego oryginał nie ma.
  - **Fakt — nieznany `{view}` → 200 i sam BOM, NIE 404** (`sendRows([])`, `analytics_module.cjs:321`).
  - **Fakt — eksport w oryginale to nawigacja przeglądarki** (`window.location.href`,
    `frontend-index.js:27938-27940`), **bez nagłówka `Authorization`, na samym cookie
    `bridge_session`** — działa, bo cookie ma `SameSite=Lax` (wysyłane przy nawigacji GET
    najwyższego poziomu) i staging jest same-origin; dowiedzione testem integracyjnym na
    prawdziwym serwerze.
  - **Otwarte, BEZ przypisania do konkretnego przyszłego bloku** (Iteracja 10 była ostatnią
    analityki):
    - O-10a-1 (nagłówek KPI `/analityka` czyta `/api/analytics/kpi` zamiast danych z
      `filters`/`ean/*`/`status`) — dane potrzebne do przepięcia są od 10c dostępne, ale
      przepięcie to osobna decyzja użytkownika, nikt jej nie podjął;
    - backlog #26 (pseudo-alerty katalogowe `pv()` zamiast `/api/alerts`) — D1 utrzymuje
      decyzję z I6 po raz drugi, teraz też na Pulpicie;
    - backlog #32/#33 (`historia_cen` bez kolumny `nazwa`, okno po niepełnym `GROUP BY`) —
      dotyczą teraz TAKŻE dwóch widoków eksportu (`export/availability-products`,
      `export/sell-through`), nie tylko dashboardu 10e.
  - 📄 Szczegóły trasa po trasie i karty oryginału: `docs/analityka-bloki-10b-10f.md` §8;
    pełny kontekst decyzji: `docs/tickets/26-FEATURE-analityka-export-pulpit/`.
  - Gate: `export/{view}` — kontrakt (ścieżka + status 200 wg `openapi.yaml:178-188`) plus
    jawna asercja `content-type: text/csv`; **fixture nie istnieje i istnieć nie może** —
    nagrywarka zapisywała wyłącznie JSON, trasa oddaje `text/csv`, a kontrakt dla tej ścieżki
    nie deklaruje żadnego `content`, więc CSV go nie narusza; kształt niosą testy jednostkowe.
    Backend 847 testów / 54 pliki, frontend 504 / 35, lint/typecheck/build czyste w obu.
- **Ścieżki (GATE):** analytics×27; fixtures `GET_analytics_*.json` (25) rozdzielone po blokach 10a–10e (10a: 4 · 10b: 5 · 10c: 6 · 10d: 4 · 10e: 6); `export/{view}` i `bootstrap-current` bez fixtura — walidacja tylko wg openapi (ścieżka + status), z różnych powodów: `export/{view}` oddaje `text/csv`, nie JSON, więc nagrywarka (zapisuje tylko JSON) nie mogła jej nagrać; `bootstrap-current` to `POST` nieidempotentny (`INSERT…SELECT` bez `ON CONFLICT`, zapisuje do `historia_cen`) — mutację nagrywarka pomija z innego powodu, mimo że sama odpowiedź jest JSON-em (`{ok, inserted, at}`). Zweryfikowane 2026-09-03 (`grep -c "app.get('/api/analytics\|app.post('/api/analytics" mirror/backend/analytics_module.cjs` → 27; `ls contract/fixtures/ | grep -c analytics` → 25) — rozdział po przeniesieniu `margins` do 10a nadal się zgadza.
- **DoD:** ✅ wszystkie bloki 10a–10f zielone; ✅ dashboardy renderują realne agregaty; ✅ fixtures przez GATE (poza deklarowaną luką `export/{view}`/`bootstrap-current`); ✅ pulpit pokazuje kluczowe metryki (kafle KPI liczone klientem, alerty z `/api/alerts` — D1).

---

### Iteracja 11 — Konfiguracja: spedycja, Shoper, katalog, AI
- **Status:** ✅ **2026-09-03** (`18-FEATURE-konfiguracja-config-spedycja`)  **Sesje:** 1  **Zależy od:** 1
- **Cel (Ania klika):** edytuje konfigurację i limity spedycji — ✅ dowiezione. Dostawcy i
  częstotliwość importu wyszły z tej iteracji do bloku 3f-2 ✅ 2026-09-01, wgrywanie do 3f-1.
- **Backend:** **nie ma `PUT /api/config`** — zapis to `POST /api/config` z ciałem
  `{klucz, wartosc}`, **jeden klucz na żądanie** (`Jt`, `:48740-48748`); zakładki AI i Shoper
  wysyłają przy zapisie serię osobnych POST-ów. Whitelista **13 kluczy** (D4, odstępstwo
  świadome — oryginał przyjmuje dowolny klucz spoza schematu); audyt `edycja_konfiguracji`
  maskuje wartość `"***"` tylko gdy nazwa klucza zawiera `klucz_api` (1:1, `:48746`) — więc
  `shoper.token_api` trafia do dziennika jawnie. `GET/POST /api/spedycja` (`gn`) — upsert po
  `dostawca_kod`, audyt `edycja_spedycji` (surowe ciało, nie odsiane, ten sam wybór co
  `markups.ts` w 4a). Wszystkie cztery trasy za `requireAuth` (D1, odstępstwo dziedziczone —
  kontrakt ma `security: []` dla obu GET-ów, jak w I1a/I2/3b/3d-2/4a/I5). Trasy dostawców są już
  dowiezione: listy w I2, `upload` w 3f-1, `PATCH /api/dostawcy/{id}` i
  `POST /api/dostawcy/{kod}/synchronizuj-teraz` w 3f-2.
- **⚠ WEJŚCIE Z ITERACJI 9 (2026-09-03) — ROZLICZONE.** I9 zgłosiła, że czterech kluczy
  `waga_gab.*` nikt nie zasiewa w bazie: formuła wagi gabarytowej działała na wartościach
  domyślnych zaszytych w kodzie (`repos/config.ts`, `DOMYSLNE_WAGA_GAB`), a nie na configu.
  **Zasiew jest w tej iteracji:** `src/db/seed-poczatkowy.ts` (port `vR`, `:45633-45644`) sieje
  komplet **11 kluczy**, w tym pięć `waga_gab.*` — z opisowym `waga_gab.opis_wspolczynnik`
  („DPD 1/6000 (1 m³ = 167 kg)"), którego kalkulator nie używa. Korzystają z niego `seed-dev.ts`
  i harness GATE, więc `GET /api/config` oddaje te klucze i zgadza się z fixture'em co do znaku.
  **Uwaga dla przyszłych sesji:** zasiew NIE oznacza, że Ania te pola zobaczy — edytora
  `waga_gab.*` nie ma ani w oryginale, ani tutaj (D7). Klucze są zapisywalne przez
  `POST /api/config` (są na whiteliście), ale bez UI. Dołożenie edytora to nowa funkcja, nie
  odbudowa. ⚠ `DOMYSLNE_WAGA_GAB` (4 wartości) i `KONFIGURACJA_POCZATKOWA` (11) to **dwa porty
  tego samego `vR`** — rozjazd między nimi byłby cichy.
- **Frontend:** cztery pozostałe zakładki wypełnione — **`/konfiguracja` nie ma już ani jednej
  zaślepki**, sześć z sześciu gotowe. Pola `domykaBlok` i `opis` zniknęły z `zakladki.ts` razem
  z blokiem renderującym zaślepki w `Konfiguracja.tsx`.
  - **Spedycja** (`Spedycja.tsx`, port `qT`) — tabela per dostawca (iteruje po `GET /api/dostawcy`,
    nie po wierszach limitów), zapis `POST /api/spedycja`. **Odstępstwo od 1:1 (D2, decyzja
    użytkownika):** w produkcji ta zakładka NIGDY nie łączy się z backendem —
    `setQueryDefaults(["/api/spedycja"], {queryFn: …})` + IndexedDB
    (`frontend-index.js:10365-10381`), limity żyją tylko w przeglądarce jednej osoby. Rebuild
    wybrał realny backend (dane trwałe, wspólne) — `GET/POST /api/spedycja` istnieją i UI je woła.
  - **Shoper** (`Shoper.tsx`, port `GK`) — mapowanie kolumn CSV (`shoper.kolumny`) i separator
    (`shoper.separator`), zapis = 2× `POST /api/config`. Klucze są teraz zapisywane, ale **nikt
    ich jeszcze nie czyta — czyta je dopiero eksport w I8** (patrz blok I8, aktualizacja).
  - **Ai** (`Ai.tsx`, port `YT`) — klucz i model AI Fallback, zapis = 3× `POST /api/config`
    (`ai_fallback.aktywny` wyprowadzony z niepustości klucza, 1:1, `:26000`).
  - **Katalog** (`Katalog.tsx`, port `XT`, bez części destrukcyjnej — D3) — **koryguje wcześniejsze
    założenie roadmapy: ta zakładka nie edytuje żadnego klucza `/api/config`.** To „Domyślne
    kolumny katalogu" w IndexedDB (`magazynKV`, klucz `konfig-domyslne-kolumny`) + „Przywróć
    fabryczne". Kluczy `waga_gab.*` nie edytuje w oryginale NIC (0 wystąpień w
    `frontend-index.js`, D7) — zostają w bazie i na whiteliście (czyta je
    `POST /api/waga-gabarytowa/oblicz`), ale bez UI. Przycisk „Usuń wszystko z katalogu"
    (`POST /api/products/clear`) zostaje **poza zakresem — dokłada go Iteracja 12** (D3, patrz
    blok I12), miejsce wpięcia jest w komponencie oznaczone adnotacją.
- **Ścieżki (GATE):** `GET/POST /api/config`, `GET/POST /api/spedycja` (dostawcy×3 rozliczone
  w I2 / 3f-1 / 3f-2).  **Fixtures:** `GET_config.json` (11 kluczy seeda `vR`, wartości co do
  znaku — puste `ai_fallback.klucz_api`/pola Shopera to realne dane seeda, nie maskowanie),
  `GET_spedycja.json` (10 wierszy `xR`, fixture przycięty do 5). Zero zadeklarowanych wyjątków.
- **DoD:** ✅ `GET/POST /api/config` i `/api/spedycja` za `requireAuth`; ✅ whitelista 13 kluczy +
  maskowanie audytu; ✅ upsert spedycji po `dostawca_kod`; ✅ sześć zakładek `/konfiguracja`
  wypełnionych, zaślepki i `domykaBlok`/`opis` zniknęły; ✅ GATE zielony bez wyjątków; ✅ backend
  629/629, frontend 302/302, `lint`/`typecheck`/`build` czyste. Szczegóły:
  `docs/tickets/18-FEATURE-konfiguracja-config-spedycja/`.

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
  - **⚠ WEJŚCIE Z ITERACJI 11 (2026-09-03) — `GET /api/audit-log` zobaczy dwie NOWE akcje.**
    `edycja_konfiguracji` (encja `config`, `encjaId` = nazwa klucza, `szczegoly_json` =
    `{"wartosc": …}`, zamaskowane `"***"` TYLKO gdy nazwa klucza zawiera `klucz_api` — więc
    `shoper.token_api` jest w dzienniku jawny, 1:1 z `:48746`) i `edycja_spedycji` (encja
    `spedycja`, `encjaId` = kod dostawcy, `szczegoly_json` = **surowe ciało żądania**, nie
    odsiane — nawet dla kodu spoza `suppliers`, bo trasa tego nie waliduje, 1:1 z `:48737`).
  - **⚠ WEJŚCIE Z ITERACJI 11 (2026-09-03) — przycisk „Usuń wszystko z katalogu" należy do
    zakładki „Katalog" w `/konfiguracja`, nie do widoku `/katalog`.** Port karty `XT()`
    (`Katalog.tsx`, `frontend-index.js:26020-26145`) jest już zrobiony BEZ tego przycisku
    (D3 ticketu 18). Ta iteracja dokłada `POST /api/products/clear` z ciałem
    `{potwierdzenie: "WYCZYSC"}`, poprzedzone `window.confirm` o treści „Usunąć wszystko
    z katalogu? Ta operacja usuwa wszystkie produkty i służy tylko do testów parsera." —
    po sukcesie unieważnia `["/api/products"]`, `["/api/alerts"]`, `["/api/analytics"]`.
    Miejsce wpięcia jest w `Katalog.tsx` oznaczone adnotacją.
  - **⚠ WEJŚCIE Z ITERACJI 8 (2026-09-04) — `AppShell` (sidebar) jest wpinany przez WIDOK, nie
    przez router.** `/`, `/konfiguracja` i placeholdery renderują sidebar; `/katalog`, `/staging`,
    `/narzuty`, `/alerty`, `/waga-gabarytowa`, `/analityka`, `/historia` i `/selly` — nie. Zastane
    zachowanie sprzed I8, spoza jej zakresu, wygląda na niezamierzone — warte decyzji przy
    finalnym przeglądzie tej iteracji.
  - **Jeśli kolumna „Promocja" w `/katalog` ma kiedyś ożyć (dziś martwa, D1 z 4b, 2026-09-02)
    — dane musi dostarczyć backend** (pole przy produkcie), bo liczenie po stronie klienta
    duplikowałoby silnik dopasowania z `repos/ceny.ts` w przeglądarce. Nie ma na to dziś
    zaplanowanej pracy — nota informacyjna, nie zadanie.
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
       ⚠ Gałąź cenowa `:44773-44783` **jest już gotowa** — wywołaj
       `zastosujRegulyCenowe(rekord, narzuty, promocje)` z `rebuild/backend/src/repos/ceny.ts`
       w tym samym miejscu sekwencji co oryginał (po wartościach domyślnych, przed
       `bridge_ext`), opakowaną w
       `try { if (Number(rekord.cenaZakupu) > 0) { …selecty obu tabel… } } catch {}`.
       **Nie pisz jej od nowa.** Decyzja użytkownika **D1 z 4a** (2026-09-02, `docs/tickets/
       15-FEATURE-narzuty-promocje-ceny/plan.md`): 4a świadomie NIE portowało `addProductsBulk`,
       bo ta metoda i `POST /api/products` w odbudowie nie istnieją, a roadmapa przypisuje je
       do I12 — przypisanie utrzymane po weryfikacji grafem wywołań (jedyne wywołanie
       `addProductsBulk` to trasa `:48308`, nieportowana).
    3. **Dopisać do `openapi.yaml` DWA endpointy `uwaga_cena`**, nie jeden:
       `GET /api/products/uwagi-cena` i `GET /api/products/hold-reasons`. Oba istnieją
       w produkcji jako monkey-patch `mirror/backend/uwaga_cena_patch.cjs` i obu brak
       w zamrożonym kontrakcie. `hold-reasons` liczy powód wstrzymania w locie (5 przypadków:
       `uwaga_cena` dosłownie / brak ceny i stanu / brak ceny / brak stanu / „sprawdź ręcznie").
  - **Finalny przegląd bezpieczeństwa:** potwierdzić auth na WSZYSTKICH trasach danych, zamknięty CORS, brak zahardkodowanego `JWT_SECRET` z fallbackiem.
    **Dopisane 2026-09-01 (3f-2):** przejrzeć WSZYSTKIE trasy mutacji pod kątem
    „`.set(req.body)` bez listy pól" i potwierdzić, że każda ma jawną listę — do tego czasu
    powinny ją mieć staging (port 1:1 z 3d-2), dostawcy (3f-2), narzuty i promocje (✅ 4a)
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
