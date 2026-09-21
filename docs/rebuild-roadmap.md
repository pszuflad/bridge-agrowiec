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
5. Po zmergowaniu PR: status karty jest w **`docs/karty/<ID>/karta.md`** (zapisała go sama
   karta). §4 i tabele kart w §5 odświeża **koordynator**, nie karta — patrz niżej.
6. Jeśli iteracja jest podzielona na sesję **BE** i **FE** — najpierw kończy się i merge'uje
   BE (endpointy muszą istnieć, żeby FE miało co wołać i żeby GATE był odtwarzalny), potem
   FE branchuje się z `develop` (już z BE) i robi widok.

**Praca równoległa — kto pisze gdzie (od ticketu 82, 2026-09-21).** Ten plik zmienia
**wyłącznie koordynator** (sesja, która planuje falę i pisze prompty do kart). Karta pisze tylko
w swoim katalogu `docs/karty/<ID>/` (`karta.md`) i zakłada nowe pliki `wejscie-<N>.md` w
katalogach przyszłych kart — nigdy nie edytuje roadmapy, bo każda wspólna linia (wiersz §4,
sąsiednie wiersze tabeli kart, dopisek na końcu sekcji) kończyła się konfliktem przy merge'u.
Stan kart: `tools/stan-kart.sh`. Pełne zasady, szablony i etap 2 migracji (przeniesienie treści
otwartych kart planu P z §5 do `docs/karty/`): **`docs/karty/README.md`**.

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
| `contract/fixtures/` (73: 59 GET + 14 zapisujące) | nagrane odpowiedzi żywego backendu — siatka bezpieczeństwa |
| `contract/openapi.yaml` (96 ścieżek / 113 operacji, 80 schematów w `components/schemas`) | zamrożony kontrakt API (metody, kształty ciał z nagrań) |
| `docs/spec-backend.md` | zweryfikowana specyfikacja backendu (auth, import `tk()`, liczby) |
| `docs/spec-frontend.md` | 12 widoków, blueprint auth, design tokens, mapa napraw |
| `rebuild/schema/001_schema.sql` | kanoniczny schemat bazy (26 tabel, `products` 72 kol.) |
| `docs/prompts/mapa-kodu-do-wiki.md` | mapa starego kodu (funkcje/pliki) |
| `deminified/` + `mirror/backend`, `mirror/frontend` | zdeminifikowany oryginał — ostateczne źródło, gdy spec milczy. ⚠ `deminified/frontend-index.js` to bundle z **2026-08-13**, STARSZY niż produkcja o cztery łatki (`konstr`, `tr_fix`, `ackalerts`, `szer_marka`) — lista i sposób czytania żywego bundla z `main`: `deminified/README.md` |
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

> **Rozjazd kontrakt↔produkcja (wykryty w I1, domknięty w 12d).** `contract/openapi.yaml` (2.3)
> nie zamrażał schematów ciał i oznaczał `GET /api/me` jako publiczny (`security: []`) mimo że
> produkcja realnie zwraca `401` bez tokenu; `POST /api/login` też nie miał `401`. Sesja 12d
> zmierzyła zachowanie na uruchomionym oryginale i dopisała: `401` dla obu tras (realna luka
> dawnego inwentarza 2.3, NIE odstępstwo odbudowy) oraz `401` + adnotacja `x-odbudowa-auth` przy
> 14 trasach, które produkcja realnie oddaje bez tokenu (`security: []`), a odbudowa świadomie
> chroni `requireAuth`em. Schematy ciał dla 71 operacji powstały generatorem z `contract/fixtures/`
> (nagrania oryginału), nie z `rebuild/`. Spójność adnotacji z realnym zachowaniem pilnuje
> `rebuild/backend/test/kontrakt.spojnosc.test.ts`. Szczegóły:
> `docs/tickets/38-CHORE-kontrakt-fixtures-odswiezenie/`.

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
| **Lokalne vs API** | **Oba tematy rozstrzygnięte 2026-09-03, każdy INNYM rozstrzygnięciem — bo to były dwa różne problemy, nie jeden.** **I6 (alerty, D3): przez API.** `PATCH /api/alerts/{id}` jest jedynym źródłem prawdy o statusie, zero IndexedDB/localStorage. Wcześniejszy zapis w tym wierszu mylił — oryginalny widok `/alerty` (`HT()`, `frontend-index.js:25177-25340`) w ogóle nie czytał `/api/alerts`: liczył pseudo-alerty katalogowe z `GET /api/products` i trzymał ich status w IndexedDB (`alerty-statusy`, `fe.js:9165-9193`); to inny zestaw danych, nie kwestia miejsca przechowywania statusu. **I9 (waga gabarytowa, D1): lokalnie, FAKTEM — stan do 2026-09-03.** To DWA różne kalkulatory pod jedną nazwą (paletowy w BE vs wolumetryczny w FE), nie jeden wzór w dwóch miejscach — nie było czego deduplikować. Dowieziono oba 1:1, FE liczył lokalnie i endpointu nie wołał, jak produkcja. **Wniosek na przyszłość: pytanie „lokalnie czy przez API” rozstrzyga się dopiero po sprawdzeniu, czy obie strony liczą TO SAMO** — dwa razy z rzędu okazało się, że nie. ⚠ **Od 2026-09-21 (P9.1, ticket `76`) wolumetryczny FE dalej liczy lokalnie, ale kalkulator paletowy dostał świadomie konsumenta w UI** (odstępstwo O3, zatwierdzone przez Anię) — endpoint już nie jest bez konsumenta. | — | ✅ I6 · ✅ I9 |
| **Staging auto-accept — LOKALNIE czy przez API** | **rozstrzygnięte 2026-08-27 (3d-1) FAKTEM, nie preferencją: auto-zatwierdzanie jest BACKENDOWE.** Siedzi w gałęzi `else if` żywego `tk()` (`backend-index.cjs:47791-47806`) i od 3d-1 jest odtworzone razem ze skutkami (`updateProduct` + `historia_cen` + `applyDims`). Frontend NIE liczy go lokalnie: bundle woła `POST /api/staging/accept` (czyli API) i nie zawiera ani `autoZatwierdzone`, ani żadnej lokalnej logiki auto-akceptacji (grep po `mirror/frontend/assets/*.js`: 0 trafień). Zdanie ze `spec-frontend` §4 („instrukcja v5 zakłada ręczną obsługę, kod auto-przyjmuje zmiany ceny/stanu") mówi o rozjeździe INSTRUKCJI z KODEM, a nie o liczeniu czegokolwiek w przeglądarce. **Skutek dla 3e:** UI ma tylko pokazywać to, co przyszło ze stagingu — pozycje auto-zatwierdzone w ogóle się w nim nie pojawiają. Przestarzała jest instrukcja v5, nie kod. | — | ✅ ustalone |
| **Utrzymanie roadmapy** | roadmapa jest wejściem dla NASTĘPNEJ sesji, a prompt jest jednorazowy — wiedza z bloku musi lądować tutaj, nie w prompcie | **zaklepane 2026-08-26:** po każdym zamkniętym bloku roadmapa opisuje STAN, nie zamiar; ustalenie dotyczące PRZYSZŁEGO bloku wpisuje się DO TEGO BLOKU (sesja 3c czyta blok 3c); **przypisanie funkcji do sesji weryfikuje się GRAFEM WYWOŁAŃ, nie nazwą** (`bridge_ext` trafił do złej sesji dwa razy — 3a i 3c); prompt nie koryguje roadmapy, tylko roadmapa siebie. Pełna reguła: `CLAUDE.md`, krok operacyjny: `.claude/commands/feature.md` Krok 13 | ✅ ustalone |
| **Stack / decyzje szkieletu** | TypeScript vs JS; framework testów; drizzle introspect vs ręczny; layout `rebuild/` | **zaklepane w I1:** TypeScript (strict, ESM) + Vitest po obu stronach; BE: Express 4 + better-sqlite3 + `drizzle-kit introspect`; FE: Vite + Tailwind 3 + shadcn/ui, testy z Testing Library + MSW; layout `rebuild/backend/` + `rebuild/frontend/` (ewentualnie `rebuild/shared/`) | ✅ ustalone |

---

## 4. Tablica postępu

> **Stan na 2026-09-08: WSZYSTKIE iteracje 0–12 są zamknięte — pierwotna odbudowa Bridge jest
> dowieziona.** I12 (konto, admin, hardening) zebrała po drodze wejścia z I2, I5, I7 i I11
> i była podzielona na pięć sesji (12a–12e); **zamknięte są 12a** (mutacje produktów, BE),
> **12b** (konto/admin/maintenance) i **12c** (dialog edycji produktu) — wszystkie 2026-09-05,
> 12b i 12c równolegle — **12d** (przenagranie fixtures + schematy ciał, 2026-09-08) oraz
> **12e** (finalny audyt bezpieczeństwa + rozliczenie backlogu + plan cutoveru + przegląd
> 12 widoków, 2026-09-08). Audyt 12e **nie znalazł ani jednej otwartej dziury** w auth/CORS/
> JWT/mass-assignment. Zostają dwa zdarzenia POZA odbudową: **przegląd 12 widoków przez Anię**
> (`docs/przeglad-12-widokow.md`) i **cutover** (`docs/cutover.md`) — patrz §6. Czytaj blok
> I12 w całości, bo urósł ponad pierwotny zakres (m.in. dialog edycji produktu z `/katalog`).
>
> **I13 to NOWA rodzina zmian dołożona PO odbudowie** — nie część pierwotnego zakresu 0–12, tylko
> delty, które Ania wdrożyła na produkcji 26.08–08.09 (producent milczał, zaległości wciągnięte
> ręcznie w `6872aea`, striażowane `40-CHORE-triaz-i13-plan`). Sześć sesji 13a–13f (podział wg
> mechanizmu portu) — czytaj blok I13. **Musi być rozliczona przed cutoverem** — cutover idzie ze
> stanu produkcji 08.09, nie 25.08.
>
> **I14 to ODDZIELNA rodzina — uwagi Ani z testów I3, nie delta produkcji** (2026-09-18).
> Trzy karty FE (14a/14b/14c) rozłączne plikowo, więc idą równolegle, plus 14d (docs) na końcu.
> Nie blokuje cutoveru tak jak I13, ale dotyczy ekranów, z których Ania korzysta codziennie —
> czytaj blok I14 w §5.

Legenda statusu: ⬜ nie zaczęte · 🔨 w toku · ✅ zrobione (PR zmergowany) · ⏸ wstrzymane

| # | Iteracja | Sesje | Zależy od | Status | PR / data |
|---|---|---|---|---|---|
| 0 | CI/CD + środowisko staging | 1 (DevOps) | — | ✅ | pipeline HTTPS + CI + branch protection; test.agritires.eu · 2026-08-24 |
| 1 | Fundament + logowanie | 1a BE · 1b FE | 0 | ✅ | 1a: PR #2 · 1b: PR #3 · 2026-08-25 |
| 2 | Katalog (odczyt) | 1 (BE+FE) | 1 | ✅ | PR #4 · 2026-08-25 |
| 3 | Import — rdzeń | 3a·3b·3c·3d-1·3d-2 BE · 3e FE · **3f-1·3f-2·3f-3** | 2 | ✅ | 3a: #6 · 3b: #7 · 3c: #11 · 3d-1: #12 · 3d-2: #15 · 3e: #16 · **3f dołożone 2026-09-01, 3f-1: #19, 3f-2 i 3f-3: 2026-09-01** |
| 4 | Narzuty + promocje (ceny) | 4a BE · 4b FE | 2, 3 | ✅ | 4a: ticket `15-FEATURE-narzuty-promocje-ceny` · 2026-09-02 · 4b: ticket `16-FEATURE-widok-narzuty-promocje` · 2026-09-02 · **domknięta kartami z I14:** 14e diagnoza (`53-…`), 14f daty kończą promocję + potwierdzenie usuwania (`64-…`), 14h kolumna „Promocja" (`61-…`), 14m instrukcja I4-v2 (`65-…`) |
| 5 | Historia | 1 + P5.1–P5.3 | 3 | ✅ | PR #24 · 2026-09-02 · **domknięta kartami planu P (2026-09-21):** P5.1 `69-FEATURE-historia-bez-limitu` (limit 5000 wierszy audytu zdjęty, backlog #87), P5.2 `70-CHORE-eksport-zip-odstepstwo` (#93), P5.3 `73-DOCS-instrukcja-testow-i5-v2` (delta instrukcji I5-v2) |
| 6 | Alerty | 1 | 3 | ✅ | ticket `18-FEATURE-widok-alerty` · 2026-09-03 |
| 7 | Atrybuty (+ pending-injection) | 7a BE · 7b FE · 7c FE | 2 | ✅ | 7a: `29-FEATURE-atrybuty-backend` · 7b: `31-FEATURE-atrybuty-frontend` · 7c: `32-FEATURE-katalog-slowniki-atrybutow` — wszystkie 2026-09-04 |
| 8 | Selly / sprzedawarka (+ selly-injection) | 8a BE · 8b FE | 2, 4 | ✅ | 8a: ticket `28-FEATURE-selly-eksport-backend` · 2026-09-04 · 8b: ticket `30-FEATURE-selly-panel-frontend` · 2026-09-04 |
| 9 | Waga gabarytowa | 1 + P9.1 | 2 | ✅ | ticket `18-FEATURE-waga-gabarytowa` · 2026-09-03 · P9.1: `76-FEATURE-przewoznicy-serwer-paletowy` · 2026-09-21 (lista przewoźników na serwerze, potwierdzenia, kalkulator paletowy w UI) |
| 10 | Analityka + pulpit | 10a→[10b·10c·10d·10e]→10f | 2, 3, 4 | ✅ | 10a: `19-FEATURE-analityka-fundament` · 10c: `22-FEATURE-analityka-ean` · 10d: `23-FEATURE-analityka-dostawcy` — wszystkie 2026-09-03 · 10b: `24-FEATURE-analityka-ceny` · 10e: `25-FEATURE-analityka-dostepnosc-rotacja` — obydwa 2026-09-04 · 10f: `26-FEATURE-analityka-export-pulpit` · 2026-09-04. |
| 11 | Konfiguracja: spedycja / shoper / katalog / ai (dostawcy i `freq-injection` ✅ w 3f-2) | 1 | 1 | ✅ | ticket `18-FEATURE-konfiguracja-config-spedycja` · 2026-09-03 |
| 12 | Konto + admin + hardening bezpieczeństwa | 12a BE · 12b BE+FE · 12c FE · 12d · 12e | wszystkie | ✅ | 12a: `35-FEATURE-mutacje-produktow-backend` · 12b: `36-FEATURE-konto-admin-maintenance` · 12c: `37-FEATURE-katalog-edycja-produktu` — wszystkie 2026-09-05 · 12d: `38-CHORE-kontrakt-fixtures-odswiezenie` · 2026-09-08 · 12e: `39-CHORE-audyt-bezpieczenstwa-domkniecie` · 2026-09-08 |
| 13 | Delty produkcji Ani 26.08–08.09 (post-odbudowa) | 13f decyzja · 13a BE(parsery) · 13b BE(silnik) · 13c BE+BAZA(migracje) · 13d BE(Selly, nowy, 13d-1/2/3) · 13e FE | 3, 8 | 🔨 | Podział wg mechanizmu portu (parsery-kopia/silnik-TS/migracje/Selly/FE/decyzja). 13f: ✅ decyzja `41-CHORE-i13f-decyzja-backfille` · 2026-09-08. 13a: ✅ `42-CHORE-i13a-resync-parserow` · 2026-09-08. 13b: ✅ `43-CHORE-i13b-silnik-p3-caps` · 2026-09-09. 13c: ✅ `44-CHORE-i13c-migracje-konwencji` · 2026-09-09. 13e: ✅ `47-CHORE-i13e-frontend-bridgeone` · 2026-09-09 (realny kod tylko `szer_marka` — reszta etykiet bez kodu, patrz blok). **13d: ⛔ ODŁOŻONE** — 13d-1 sportowane (`45-FEATURE-selly-rest-sync-tor1`) i **COFNIĘTE** (revert #58, 2026-09-09), Selly dociera u Ani. Zostaje 13d. |
| 14 | Uwagi Ani z testów I3 i I4 (UI importu, staging, silnik cen) | FALA 1: 14a FE · 14b FE · 14c FE · 14d DOCS — FALA 2: 14e diagnoza · 14f wygaszacz · 14h BE · 14i BE · 14j pomiar · 14m docs (14g skasowana) | 3, 4 | ✅ | **FALA 1 ZAMKNIĘTA 2026-09-18:** 14a: ✅ `49-CHORE-i14a-wgrywanie-reczne` · 14b: ✅ `51-FEATURE-staging-filtr-pasek-kolumny` · 14c: ✅ `50-FEATURE-i14c-karta-dostawcy-upload` · 14d: ✅ `56-DOCS-instrukcja-testow-i14` (nowy `docs/instrukcja-testow-I3-v2.md` + banner w I3). **FALA 2 ZAMKNIĘTA W CAŁOŚCI:** 14e ✅ `53-CHORE-i14e-diagnoza-promocji` (rozpoznanie, bez kodu); 14f ✅ `64-FEATURE-i14f-daty-koncza-promocje` · 2026-09-19 (wygaszacz statusu promocji w obie strony + potwierdzenie usuwania z liczbą produktów); 14h ✅ `61-FEATURE-promocja-kolumna-katalog` · 2026-09-18 (czysto backendowa); 14i ✅ `58-FEATURE-i14i-ean-naukowy-pusty` · 2026-09-18; 14j ✅ `59-CHORE-i14j-oracle-diff-historii` · 2026-09-18 (pomiar, zero kodu produkcyjnego); 14m: ✅ `65-DOCS-instrukcja-testow-i4-v2` · 2026-09-19 (nowy `docs/instrukcja-testow-I4-v2.md` + banner w I4). Źródło: wypełnione `instrukcja-testow-I3.md` i `-I4.md` (uwagi Ani + zrzuty). Oś podziału = PLIK, nie temat. Czytaj blok I14. |

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
  - **Wejście z 3b do dalszych sesji:** backlog **#7** ZREALIZOWANY (kolumna `suppliers.import_wylaczony` + strażnik), ale `UPDATE ... WHERE kod='MO6'` w migracji działa tylko, gdy wiersz MO6 już istnieje w `suppliers` — w świeżej bazie z kanonu tabela jest pusta i flaga nie ma czego ustawić; domknięcie → **I11** albo seed produkcyjny. Backlog **#8** zaadresowany bezpiecznikiem (0 pozycji z parsera → 400, bez zapisu), sam parser MO8 przyjdzie portem (#6); ten sam cichy zerowy wynik daje też MO10 przy śmieciowej treści. Backlog **#3** (`szerokosc` REAL→TEXT) świadomie NIE ruszony w 3b — decyzja przesunięta do 3d. **Rozstrzygnięta i naniesiona w 3d-1 (2026-08-27):** migracja `003_szerokosc_text.sql`, a rozjazd z fixture'em przykryty zadeklarowanym wyjątkiem GATE do czasu przenagrania — **wyjątek usunięty w 12d (2026-09-08) po przenagraniu `GET_products.json`**. **Nowy wzorzec do naśladowania:** jawna projekcja kontraktowa (`src/repos/kolumny.ts`) — repozytoria wybierają kolumny jako „wszystkie z tabeli MINUS jawnie zadeklarowane wewnętrzne", więc nowe kolumny poza kanonem (jak D5/D9) nie rozlewają się do API bez świadomego wpisu. **Infra:** backend wymaga Node ≥ 20 (`better-sqlite3`); wdrożenie wymaga migracji `002_import.sql` (`npm run migrate`).
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
    `POLA_EDYTOWALNE_PROMOCJI` (`promotions.ts`, 8 pól — **7 od 14f**, `status` odcięty jako pole
    WYLICZANE, patrz blok I14 14f); filtr działa na PATCH **i** POST.
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
  - **Silnik cen backendu IGNORUJE daty `start`/`koniec` promocji** — to opis PRODUKCJI, wciąż
    prawdziwy: wygasła promocja nadal obniża ceny (port 1:1, `__bridgePromoMatches`). Frontend
    produkcji mimo to **przelicza etykietę statusu z dat przy każdym odczycie** `/api/promotions`
    (`_b()`, `frontend-index.js:9508`, wołane z `queryFn` `:9568`) i zapisuje wynik do IndexedDB —
    **nigdy na serwer**; kolumna `status`, której używa silnik cen, zostaje nietknięta. Skutek
    w produkcji: lista pokazuje „zakończona" przy promocji, którą backend nadal stosuje. 4b
    odtworzyło to 1:1 i dołożyło widoczny **znacznik rozbieżności** na wierszu, gdy przeliczona
    etykieta nie zgadza się z kolumną `status` z serwera, plus naprawiony badge `"zaplanowana"`
    (oryginał ma tu literówkę i wyświetla ją jako „zakończona").
    ⚠ **Stan ODBUDOWY po 14f (`64-FEATURE-i14f-daty-koncza-promocje`, 2026-09-19): naprawione.**
    Nowy wygaszacz (`src/promocje/wygaszacz.ts`) przestawia `status` z dat automatycznie (start
    procesu + wejście `przeliczCenyZRegul` + cyklicznie), więc wygasła promocja w odbudowie
    przestaje obniżać ceny — silnik (`promocjaPasuje`) sam pozostaje NIETKNIĘTY, zmieniają się
    dane, które dostaje. Znacznik rozbieżności stał się martwym kodem i został usunięty; `status`
    przestał być polem edytowalnym, więc „wyłączenie promocji na sztywno zmianą `status`" już nie
    działa — promocję wyłącza teraz wyłącznie data albo usunięcie. Backlog #19 zamknięty.
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
- **Status:** ✅ **2026-09-02** (`15-FEATURE-historia-zmian`, PR #24)  **Sesje:** 1 + P5.1–P5.3
  **Zależy od:** 3. **Iteracja ZAMKNIĘTA 2026-09-21** kartami planu P: P5.1
  (`69-FEATURE-historia-bez-limitu`, limit 5000 wierszy audytu zdjęty), P5.2
  (`70-CHORE-eksport-zip-odstepstwo`, #93) i P5.3 (`73-DOCS-instrukcja-testow-i5-v2`, delta
  `docs/instrukcja-testow-I5-v2.md`) — patrz podbloki niżej i blok „Poprawki po testach Ani”.
- **Cel (Ania klika):** otwiera `/historia`, widzi log importów/eksportów/edycji z audytu — ✅ dowiezione.
- **Backend — sprostowanie faktu, na którym stał ten blok: `Wa` to tabela `history`, NIE `historia_cen`**
  (`deminified/backend-index.cjs:43833`, jedno wystąpienie `Wa =`, brak cieniowania).
  `GET /api/history` czyta `history` (`listHistory()`, `:44962`); `GET /api/history/meta` i
  `/paged` **nie** czytają `history` ani `historia_cen` — czytają **`audit_log`**
  (ORYGINAŁ: `listAudit(5000)`, `:45068`; ODBUDOWA od **P5.1**: bez limitu, patrz podblok P5.1
  niżej) i mapują `akcja → typ` sztywnym słownikiem pięciu wartości
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
  - **Tabela `history` dostała pisarza w sesji 12a (`35-FEATURE-mutacje-produktow-backend`,
    2026-09-05).** Jedyny pisarz oryginału to ręczna edycja produktu w katalogu
    (`PUT`/`PATCH /api/products/:id`, `:48435`/`:48475`) — sportowana jako
    `zapiszWpisDziennika` (`src/repos/dziennik-zmian.ts`), wołana z handlera edycji produktu.
    Od tej sesji `GET /api/history` przestał zwracać na stagingu `[]`.
  - **Rejestracji `/meta`+`/paged` w oryginale są TRZY, nie dwie:** rdzeń bez auth (`:48335`,
    `:48352`) + `mirror/backend/pagination_module.cjs:136,168` z auth, ładowany dwukrotnie
    (`extensions.cjs:449-451` + wprost z `index.cjs`). Wygrywa rdzeń, więc w produkcji trasy są
    publiczne. `docs/spec-backend.md` §2 mówiło o dwóch — sprostowane w tym samym tickecie.
  - **Clamp paginacji różni się od `/api/staging/paged`:** tu fallback `|| 1`/`|| 50` stoi PO
    `parseInt`, więc `NaN` nie wycieka; w `pagination_module` używanym przez staging `||` działa
    na stringu i `NaN` dochodzi do SQLite. Zastane, nie do ujednolicenia.
  - **ORYGINAŁ czyta tylko 5000 najświeższych wierszy audytu PRZED filtrowaniem** —
    przy większym `audit_log` starsze wpisy stają się niedostępne niezależnie od strony, a
    `total` przestaje być liczbą wszystkich wpisów. To był port 1:1 do **P5.1** — od P5.1
    (`69-FEATURE-historia-bez-limitu`, ✅ 2026-09-21) odbudowa tego limitu już nie ma,
    patrz podblok P5.1 niżej.
- **Ścieżki (GATE):** history×3.  **Fixtures:** `GET_history.json`, `GET_history_meta.json`, `GET_history_paged.json`.
- **DoD:** ✅ trzy trasy za auth przechodzą GATE (kształt 1:1 + komplet kluczy); mapowanie
  akcja→typ i clamp odtworzone 1:1; NULL/zepsuty JSON i `encja_id` niezłączalny nie wywracają
  odczytu (testy); widok wpięty, filtry i paginacja działają; `lint`/`typecheck`/`test`/`build`
  czyste po obu stronach. Szczegóły: `docs/tickets/15-FEATURE-historia-zmian/`.

##### P5.1 — Historia bez limitu 5000 · ✅ ZROBIONE 2026-09-21 (`69-FEATURE-historia-bez-limitu`, backlog #87 wariant c)

Zamyka backlog #87 (limit `LIMIT_AUDYTU = 5000` z 14j). **Świadome odstępstwo od oryginału**
(decyzja D1 użytkownika 2026-09-21): `/meta` i `/paged` przestają ciąć `audit_log` do 5000
najświeższych wierszy PRZED filtrowaniem.

**Zakres dowieziony — hybryda (D2), nie litera wariantu (c):** w SQL tylko odsiew do akcji
ze słownika (przy konkretnym `typ` — akcje tego typu) plus `ORDER BY kiedy DESC, id DESC`,
bez limitu (`repos/audit-historia.ts::audytDlaHistorii`). Mapowanie, `dostawca`, fraza, `total`
i paginacja zostają w pamięci jak dotąd, bo to pola WYLICZANE po zmapowanym wpisie —
paginacja więc nie trafiła do SQL (odejście od litery (c) przy zachowanym skutku: obie usterki
#87 znikają). Słownik akcja→typ (`SLOWNIK_AKCJI`, `Map`) zostaje jednym źródłem prawdy dla
`typWpisu()` i nowego `akcjeHistorii(typ)`. Remis `kiedy` rozstrzyga `id DESC` (D4) —
w danych produkcji remisów jest 0.

**Gate rozliczony bez przenagrania.** Kontrakt i fixtures (`GET_history_meta.json`,
`GET_history_paged.json`) NIETKNIĘTE — kształt odpowiedzi się nie zmienił. Wyrocznia
14j (`historia.wyrocznia.json`, 270 wierszy) też nietknięta i zielona **13/13 bez wyjątku**,
ale z zastrzeżeniem: zasiewa wyłącznie akcje ze słownika, więc strukturalnie nie widzi, czy
odsiew dzieje się w SQL czy w pamięci — dowód siły daje pomiar danych, nie sam zielony test
(patrz niżej). Nowy `test/historia.powyzej-progu.test.ts` (5200 wierszy `auto_pull` nad
widocznymi) świadomie NIE wchodzi do wyroczni (oryginał w tym reżimie gubi wpisy z założenia,
nie ma z czym porównywać) — wykazano, że 5/6 przypadków pada na kodzie sprzed P5.1.

**Pomiar, który uzasadnia bezpieczeństwo zmiany porządku:** w `db/snapshot.db` wszystkie
3873 wiersze `kiedy` mają jeden format (ISO, `Z`), remisów 0, inwersji między porządkiem
tekstowym SQL i porządkiem `Date` z JS też 0 — więc przeniesienie sortowania do SQL nie
zmienia kolejności. Tempo zapisu (ok. 2400 wierszy/miesiąc w lipcu, 1476 w sierpniu) sugeruje,
że próg 5000 w produkcji **już jest przekroczony**, czyli defekt #87 tam dziś realnie występuje.

Szczegóły: `docs/tickets/69-FEATURE-historia-bez-limitu/`.

Sprostowanie instrukcji I5 §11 pkt 9 dowiezione w P5.3 (`73-DOCS-instrukcja-testow-i5-v2`,
2026-09-21) — `docs/instrukcja-testow-I5-v2.md`, punkty 2.1 i 3.1.

##### P5.2 — eksport ZIP jako świadome odstępstwo · ✅ ZROBIONE 2026-09-21 (`70-CHORE-eksport-zip-odstepstwo`)

Karta backlogu #93. `GET /api/export-shoper` bez `?dostawca=` (eksport wszystkich dostawców do
ZIP-a) w produkcji zawsze oddaje HTTP 500 — `archiver@5.3.2` produkcji nie eksportuje
`ZipArchive`. Decyzja D1 (`62-DOCS-decyzje-po-i14j`, 2026-09-18): **nie odtwarzamy defektu**,
odbudowa z `archiver@^8.0.0` dalej zwraca działający ZIP. Ta karta domknęła stronę dowodową i
jeden realny defekt znaleziony przy okazji:
- Bramka (`test/eksport-shoper.gate.test.ts`, `test/eksport-shoper.format.test.ts`) sprawdzała
  wcześniej tylko nagłówki/sygnaturę `PK`; teraz otwiera ZIP własnym czytnikiem
  `test/gate/czytnik-zip.ts` (EOCD, katalog centralny, CRC-32, bez nowej zależności — w
  `node_modules` są tylko pakiety piszące ZIP) i sprawdza, że każdy wpis archiwum jest bajt w
  bajt równy pojedynczemu eksportowi tego dostawcy.
- Nowy strażnik dryfu wersji `test/zaleznosci.archiver.test.ts` pada, jeśli zainstalowany
  `archiver` przestanie eksportować `ZipArchive`. `package.json` zostaje na zakresie `^8.0.0`
  bez pinu (D3) — lockfile i tak trzyma `npm ci` na 8.0.0, strażnik łapie regresję przy
  regeneracji locka.
- **Defekt znaleziony i naprawiony (D2):** błąd zgłoszony PO wysłaniu nagłówków odpowiedzi ZIP
  (np. zapis audytu po `pipe(res)`) zostawiał klienta wiszącego bez końca — `on("error")` przy
  `headersSent === true` nic nie robił. Teraz `archiwum.abort()` + `res.destroy()` kończą
  połączenie (`ECONNRESET`) zamiast wiszenia; błąd PRZED nagłówkami dalej daje 500 jak w
  oryginale. Produkcja do tej ścieżki nie dochodzi (pada wcześniej, na konstruktorze), więc
  zmiana nie rusza obserwowalnego zachowania produkcji.
- **Fakty do zapamiętania:** wierne przepisanie kodu nie chroni przed różnicą wersji zależności
  między lockfile'ami — trasa jest identyczna, wynik inny; błąd w trakcie strumieniowania ZIP-a
  (po `pipe`) kończy się zerwanym połączeniem klienta, nie odpowiedzią z kodem błędu. Szczegóły:
  `docs/tickets/70-CHORE-eksport-zip-odstepstwo/`.

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
  Domyślny filtr `status = nowy` (D7), filtry status/dostawca/typ z wartości w danych (D8) —
  **od P6.1 (72-FEATURE-alerty-przejrzany-szukajka, 2026-09-21): trzeci status `przejrzany`
  i domyślny filtr „Nierozwiązane"**, patrz Iteracja 6 w §5.
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
- **Status:** ✅ **ZAMKNIĘTA 2026-09-04** — **7a (BE)** `29-FEATURE-atrybuty-backend` ·
  **7b (FE)** `31-FEATURE-atrybuty-frontend` · **7c (FE)** `32-FEATURE-katalog-slowniki-atrybutow`
  **Sesje:** 7a BE · 7b FE · 7c FE  **Zależy od:** 2
  - **Podział na trzy sesje był decyzją użytkownika (2026-09-04), nie planem pierwotnym.** Część
    katalogowa została wydzielona z 7b do 7c, bo kolidowała plikowo z równoległą sesją 8b
    (`Katalog.tsx`). 7c weszła po merge 8b i rebase — konflikt wypadł dokładnie tam, gdzie
    przewidywano (dwa miejsca), i sprowadził się do zachowania obu zmian.
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
    wtedy z `products.model` i dwie rozjeżdżone mapy rodzaj→kolumna, 15 dla liczników i 13 dla
    kolejki): `docs/tickets/29-FEATURE-atrybuty-backend/`. Mapy uzgodniono w P7.1 (ticket 74,
    2026-09-21): jest jedna `RODZAJ_KOLUMNA` (15), a zakres skanu to jawna lista `ZAKRES_SKANU` (13).
    Seed `bieznik` przełączony na `products.bieznik` w P7.2 (ticket 78, 2026-09-21, świadome
    odstępstwo D5).

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
    `UPDATE` (`GET /atrybuty/uzycie` → `count`), a toast — `produktow_zaktualizowano` (w 7b backend
    tych akcji nie audytował, backlog #39; od P7.1, ticket 74, audytuje i pokazuje je w Historii).
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
- **DoD — wszystko dowiezione:** ✅ pełen CRUD + workflow pending w backendzie (7a);
  ✅ fixtures przez GATE (7a); ✅ widok natywny, ✅ martwe ścieżki naprawione, ✅ parytet
  z `pending-injection.js` (57 KB) bez samego skryptu (7b); ✅ listy filtrów `/katalog`
  ze słownika, czyli domknięcie degradacji D3 z I2 (7c).

- **7c · `/katalog` — listy filtrów ze słownika** (FE) — ✅ **zrobione** (ticket
  `32-FEATURE-katalog-slowniki-atrybutow`, 2026-09-04). Domknięta **degradacja D3 z Iteracji 2**:
  listy marek i kategorii w filtrach katalogu to teraz SUMA słownika atrybutów i danych katalogu,
  a nie same dane. Marka bez ani jednego produktu jest wybieralna.
  - **Reguła odtworzona 1:1 (`deminified/frontend-index.js:23285-23295`), z obiema asymetriami:**
    - MARKI: z produktów `map(marka).filter(e => e && !/\d/.test(e))` + wartości słownika
      (`rodzaj === "marka"`); suma przez `Set`, sort `localeCompare(…, "pl")`.
      **Filtr „bez cyfr" wisi WYŁĄCZNIE na gałęzi produktowej** (`:23288`), więc wartość
      słownikowa z cyfrą zostaje na liście, a śmieć z importu w rodzaju „11.2-24" wypada.
      ⚠ **Zdanie wyżej opisuje stan do 2026-09-04** — łatka `szer_marka` rozszerzyła filtr
      „bez cyfr" także na gałąź SŁOWNIKOWĄ marek; sportowane w 13e
      (`47-CHORE-i13e-frontend-bridgeone`). Asymetria marka↔kategoria (niżej) ZOSTAJE.
    - KATEGORIE: z produktów BEZ filtra cyfr + wartości słownika; suma przez `Set`,
      **zwykły `.sort()`**, nie `localeCompare`.
  - **⚠ To INNA reguła niż w dialogu reguł `/narzuty` (7b)**, gdzie kategorie idą WYŁĄCZNIE
    ze słownika (`:24210`), bo regułę cenową zakłada się także na kategorię spoza katalogu.
    Tu filtr zawęża to, co widać w tabeli, więc źródła się sumują. Osobny test pilnuje, żeby
    ktoś nie skopiował jednej reguły w miejsce drugiej.
  - **Zakres zmiany:** `src/pages/katalog/filtrowanie.ts` (drugie źródło + lokalny, strukturalny
    typ `WartoscSlownika`, domyślne `= []` dla zgodności wstecz), `src/pages/Katalog.tsx`
    (jedno `useQuery` na wspólnym kluczu `["/api/atrybuty"]` z `queryFn: pobierzSlownik` — ten sam
    loader co w `/atrybuty` i w dialogu reguł, więc CRUD słownika odświeża wszystkie trzy miejsca
    jednym `invalidateQueries`). Testy: +7 przypadków w `test/katalog.filtrowanie.test.ts`,
    mock `/api/atrybuty` w `test/katalog.test.tsx`. Suita **640 testów / 43 pliki**, bramki czyste.
  - **Nota dla przyszłych sesji:** widok pobiera KOMPLET swoich tras przy każdym wejściu
    (`/api/products`, `/api/suppliers`, `/api/config`, `/api/atrybuty`), a testy stoją na
    `onUnhandledRequest: "error"` — dołożenie kolejnego zapytania do `Katalog.tsx` wymaga
    dołożenia mocka w `test/katalog.test.tsx`, inaczej padnie cały plik.

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
- **🔒 Zabezpieczenie środowisk (2026-09-04, `34-FEATURE-selly-blokada-srodowiska`).**
  Dołożone PO zamknięciu 8b, na wniosek użytkownika. Dwie rzeczy:
  1. **`SELLY_TRYB`** (`wylaczony` / `tylko-odczyt` / `pelny`, **domyślnie `wylaczony`**) —
     twarda blokada w obwolucie klienta (`src/selly/tryb.ts`), niezależna od tego, czy sekrety
     `SELLY_*` są ustawione. Odstępstwo świadome, wzorowane na `IMPORT_SCHEDULER` z 3f-3 i z tego
     samego powodu. Tryb `tylko-odczyt` przepuszcza dry-run bez ani jednej linijki kodu na ten
     temat — bo dry-run nigdy nie woła metody zapisującej. **Produkcja musi ustawić `pelny`
     jawnie.**
  2. ⚠ **`SELLY_CSV_DIR` wskazywał domyślnie katalog PRODUKCYJNY**, a staging stoi na TYM SAMYM
     VPS (`docs/deploy-setup.md:4`) — „Wygeneruj CSV teraz" na stagingu nadpisywał plik, po który
     Selly przychodzi o 6:00, treścią z bazy stagingowej. To trasa LOKALNA, więc brak sekretów
     przed tym NIE chronił. Naprawione w `tools/deploy-staging.sh` (wersjonowane, nie ręcznie
     w `.env`); wartości domyślne w `env.ts` zostają — dla produkcji są poprawne.
  Szczegóły: `docs/rebuild-backlog.md` #46 i #47.
- **📄 Instrukcja testów dla Ani: `docs/instrukcja-testow-I8.md`** (`33-DOCS-instrukcja-testow-i8`).
  ⚠ Jedyna instrukcja w projekcie, która NIE zaczyna się od „to staging, testuj bez skrupułów":
  `POST /api/selly/sync-supplier` z `dry_run=false` realnie modyfikuje sklep Selly, a staging
  i produkcja mogą wskazywać ten sam sklep. Dokument opisuje **trzy tryby testowania**
  odpowiadające trzem wartościom `SELLY_TRYB` (A: `wylaczony` — ustawiany automatycznie przy
  deployu stagingu, pokrywa ~80% zakresu; B: `tylko-odczyt` — połączenie i dry-run, zapis
  wymuszenie zablokowany; C: `pelny` — pełna wysyłka).
  **Sandbox:** Bridge go nie ma; istnienie instancji testowej po stronie Selly.pl jest do
  ustalenia z nimi, nie z repo. Praktycznym zamiennikiem jest `SELLY_TRYB` (ticket 34).

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
  **⚠ Nieaktualne od 2026-09-21 (P9.1, ticket `76-FEATURE-przewoznicy-serwer-paletowy`):** to
  świadome odstępstwo od produkcji, zatwierdzone przez Anię — kalkulator paletowy dostał
  konsumenta w UI (druga sekcja obok wolumetrycznego), patrz karta P9.1 niżej.
- **Backend:** `POST /api/waga-gabarytowa/oblicz` dowieziony, formuła 1:1, za `requireAuth`
  (⚠ odstępstwo świadome D2 — produkcja i kontrakt mają trasę publiczną `security: []`,
  kontynuacja D1 z I1; kontrakt od 12d ma na tej trasie `401` + adnotację `x-odbudowa-auth`).
  Endpoint **bez konsumenta** — FE go nie woła.
  **⚠ Nieaktualne od 2026-09-21 (P9.1):** FE dostał konsumenta (`KalkulatorPaletowy.tsx`).
- **Frontend:** widok `/waga-gabarytowa` dowieziony — formularz + wynik + pełny edytor
  przewoźników/dzielników (D3), trwałość w IndexedDB przez `magazynKV`.
  **⚠ Nieaktualne od 2026-09-21 (P9.1):** lista przewoźników/dzielników przeniosła się na
  serwer (`waga_gab_przewoznicy`, wspólna dla wszystkich zalogowanych); w IndexedDB zostały
  tylko wybór, ostatni wynik i ostatnie wymiary (założenie A karty P9.1).
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
    (`POST /api/products/clear`) zostawał **poza zakresem — dołożyła go sesja 12b** ✅ 2026-09-05
    (D3), w miejscu wpięcia oznaczonym adnotacją.
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
- **Status:** ✅ **zrobione** — sesje 12a, 12b, 12c, 12d i 12e zamknięte (12a/12b/12c
  2026-09-05, 12b i 12c szły równolegle; 12d i 12e 2026-09-08). **Iteracja 12 jest ostatnią
  iteracją odbudowy — I0–I12 zamknięte w całości.**
  **Sesje:** 12a BE ✅ (mutacje produktów) · 12b BE+FE ✅ (konto/admin/maintenance) ·
  12c FE ✅ (dialog edycji `LT()` + menu „Akcje") · 12d ✅ (przenagranie fixtures + schematy
  ciał) · 12e ✅ (finalny audyt bezpieczeństwa + rozliczenie backlogu + plan cutoveru +
  przegląd 12 widoków)  **Zależy od:** wszystkie (finalny przegląd)
- **Cel (Ania klika):** zmienia hasło w `/moje-konto` ✅ (12b); admin zarządza użytkownikami/
  konfiguracją dostawców i utrzymaniem ✅ (12b); edytuje/wstrzymuje/usuwa produkty wprost
  z `/katalog` ✅ (backend 12a + UI 12c). **Cel iteracji dowieziony w całości — kontrakt
  i fixtures odświeżone (12d), audyt bezpieczeństwa zamknięty bez znalezisk (12e).**

#### Sesja 12a — Backend: mutacje produktów — ✅ zrobiona 2026-09-05 (`35-FEATURE-mutacje-produktow-backend`)
Domyka katalog (I2) do parytetu ZAPISU z produkcją. Dowiezione:
- `POST /api/products` (bulk) — port `addProductsBulk` (`:44746-44806`) w `src/import/bulk.ts`,
  z gałęzią cenową (`zastosujRegulyCenowe` z `repos/ceny.ts`, obie tabele czytane przy KAŻDYM
  rekordzie wewnątrz transakcji, próg `cenaZakupu > 0`), **sześcioma** rozszerzeniami
  `bridge_ext` — piąta i szósta to `applyWagaPamiec` i **`rememberLink`**, to ostatnie wołane
  PO zapisie produktu (`:44801-44803`, tak samo jak w `acceptStaging`) — i natywną propagacją
  `uwagaCena`. Dwa dopuszczalne kształty ciała: goła tablica albo `{items: […]}`. Odpowiedź
  `{ok, dodano}` niesie LICZBĘ.
- **`PUT`/`PATCH /api/products/{id}` — wspólny handler w odbudowie, ale to ŚWIADOME, kosmetyczne
  odstępstwo (D2), nie fakt o oryginale.** Oryginał ma DWIE osobne funkcje: `:48415-48449` to
  handler wyłącznie `PUT` (`e.put(…, i)`, `:48451`); `PATCH` ma własną, niemal identyczną funkcję
  (`:48452-48487`), różniącą się wyłącznie kolejnością audytu względem pętli override/history —
  stan końcowy bazy i odpowiedź są identyczne, więc port scala je w jedną funkcję.
  **Lista 42 pól edytowalnych** (`POLA_EDYTOWALNE_PRODUKTU` w `repos/products.ts`) — zbiór pól,
  które produkcyjny dialog `LT()` realnie wysyła (`deminified/frontend-index.js:24020-24090`);
  odcina kolumny wyliczane, `id`/`kod`/`dataAktualizacji`, `uwagaCena` i `dostawca` (dialog ma go
  `disabled`, a `manual_overrides` kluczuje się po nim). Domyka backlog #14 dla produktów.
  **Trasa pisze do DWÓCH tabel, nie jednej** — `manual_overrides` (`:48427`) ORAZ `U.addHistory`
  (`:48435-48445`, port `zapiszWpisDziennika` w `dziennik-zmian.ts`) per zmienione pole.
  Auto-status `wstrzymany` przy cenie spadającej do 0 (`:44729-44738`, `backend-index.cjs`),
  z wyłącznikiem przy jawnym `status` w ciele.
- `DELETE /api/products/{id}` — bez kaskad (osierocone `manual_overrides`/`history` to zastane
  zachowanie oryginału).
- `GET /api/products/uwagi-cena` i `GET /api/products/hold-reasons` — port monkey-patcha
  `mirror/backend/uwaga_cena_patch.cjs` (który patchuje TAKŻE `U.addProductsBulk`, `:72-93` —
  propaguje `uwagaCena` z payloadu do kolumny; nie jest wyłącznie źródłem tych dwóch
  endpointów), w tym klucz `uwaga_cena` w **snake_case** (produkcja czyta surowym
  `better-sqlite3`) i pięć powodów wstrzymania z dosłownymi tekstami.
- **⭐ Tabela `history` dostała PIERWSZEGO PISARZA** (`zapiszWpisDziennika`) — domyka fakt
  zapisany przez I5 (patrz jej blok wyżej): `GET /api/history` przestał zwracać na stagingu `[]`.
- `contract/openapi.yaml`: dopisane `404` przy trzech operacjach `/api/products/{id}` + dwie
  ścieżki `uwaga_cena` (schematy ciał dopisane generatorem z nagrań w 12d).
- Dowód wierności: harness charakteryzacji poszerzony o TRZECI wycinek bundla (kotwice
  `updateProduct(t,e){` → `listStaging(){`); dwa wycinki z 3d-2 nietknięte. 22 testy
  porównawcze. Suita backendu **1103 testy / 68 plików** (było 1024/64); lint/typecheck/build
  czyste. Szczegóły: `docs/tickets/35-FEATURE-mutacje-produktow-backend/`.

#### Sesja 12b — Konto/admin/maintenance (BE+FE) — ✅ zrobiona 2026-09-05 (`36-FEATURE-konto-admin-maintenance`)
Osiem operacji backendu za `requireAuth`: `POST /api/password/change`, `GET /api/users`,
`GET /api/admin/supplier-config`, **`PATCH /api/admin/supplier-config/{kod}`**,
`GET /api/admin/suppliers-list`, `POST /api/maintenance/usun-nieopony`,
`POST /api/products/clear` (ciało `{potwierdzenie:"WYCZYSC"}`), `GET /api/audit-log`.
- **⚠ SPROSTOWANIE FAKTU: metoda to `PATCH`, NIE `PUT`.** Ten plik pisał wcześniej
  `GET/PUT /api/admin/supplier-config(+{kod})` — błędnie. Metody `PUT` na tej ścieżce nie ma
  nigdzie: `contract/openapi.yaml:28-41` ma `patch:`, oryginał `mirror/backend/extensions.cjs:344`
  ma `app.patch(...)`. Trzecia z rzędu pomyłka roadmapy w opisie metody endpointu (po `PUT
  /api/config` w I11) — metodę sprawdzaj w kontrakcie i w oryginale, zanim jej użyjesz.
- **⚠ SPROSTOWANIE FAKTU: `GET /api/audit-log` NIE parsuje `szczegoly_json` i nie ma parsować.**
  Wcześniejsza nota w tym pliku mówiła, że da się tu skorzystać z `parsujSzczegoly` z I5 „bez
  pisania drugiej wersji" — to nieprawda. Cała trasa oryginału to
  `e.get("/api/audit-log",(c,u)=>u.json(U.listAudit(500)))` (`deminified/backend-index.cjs:48735`),
  a `contract/fixtures/GET_audit-log.json` zamraża `szczegolyJson` jako **STRING**. Sparsowanie
  po stronie backendu ŁAMIE GATE — sprawdzone empirycznie („typ object, oczekiwano string").
  Parser żyje we froncie (`pages/konfiguracja/dziennik.ts`) jako druga, świadoma kopia (D4):
  `rebuild/backend` i `rebuild/frontend` to rozłączne projekty bez wspólnego pakietu.
  Backlog **#50**.
- **Trasa znosi wiersze, których `/historia` nie pokazuje:** `szczegoly_json = NULL`
  (`synchronizacja_reczna`, `:48240`, wejście z I5) i `encja_id` niezłączalny z `suppliers`
  (audyt zapisuje ZAMIAR, przed sprawdzeniem, czy dostawca istnieje) — dowiedzione testem na
  danych, nie tylko typem. Widać tu surowo także `edycja_konfiguracji` i `edycja_spedycji`
  (I11) oraz **`edycja_produktu` i `usuniecie_produktu` (12a)** — `encjaId` niespójne między
  tymi dwiema akcjami (`kod` vs `id` jako tekst), port 1:1
  (`docs/tickets/35-FEATURE-mutacje-produktow-backend/raport.md`, „Follow-up").
- **Frontend:** `/moje-konto` (port `lM()`, `frontend-index.js:27624-27780`) — **ostatni
  placeholder frontu zniknął**, `pages/placeholdery.ts` i `WidokWPrzygotowaniu.tsx` USUNIĘTE,
  nota o 13 trasach przeniesiona do nagłówka `App.tsx`. Przycisk „Usuń wszystko z katalogu"
  w zakładce „Katalog" (`window.confirm`, trzy `invalidateQueries`) — **odstępstwo D3 ticketu 18
  zniesione, karta kompletna wobec oryginału**. ⚠ To OSOBNA trasa od `DELETE /api/products/{id}`
  (12a): kasuje CAŁY katalog, nie pojedynczy produkt.
- **DWIE NOWE zakładki `/konfiguracja` — „Admin" i „Dziennik" — to ŚWIADOME ODSTĘPSTWO (D1/D3).**
  Tych ekranów NIE MA w oryginalnym React SPA (zero trafień w `deminified/frontend-index.js`
  i `mirror/frontend/assets/*.js` dla `admin/supplier-config`, `admin/suppliers-list`,
  `/api/users`, `usun-nieopony`, `audit-log`); produkcja obsługuje te trasy serwerowymi
  stronami HTML poza SPA (`extensions.cjs:290-295,410-415`). `zakladki.ts` przestał być
  lustrem oryginału — porównując z `:26299-26338`, oczekuj sześciu pozycji, nie ośmiu.
- **Pozostałe odstępstwa:** **D2** — `requireAuth` na wszystkich ośmiu trasach, w tym na
  `/api/audit-log`, mimo `security: []` w kontrakcie (kontynuacja D1 z I1); **D5** — kopia
  bazy przed `products/clear` robi `wal_checkpoint(TRUNCATE)` przed `copyFileSync`, bo baza
  chodzi w WAL i goła kopia `.db` byłaby bezpiecznikiem pozornym.
- **Port wierniejszy od planowanego:** `delete lastRunPerSupplier[kod]` (`extensions.cjs:387`)
  ma w odbudowie gotowy odpowiednik `przeplanujScheduler` (3f-3) — podpięty do `PATCH` przy
  zmianie częstotliwości.
- **GATE:** zielony na czterech fixtures (`GET_users.json`, `GET_admin_supplier-config.json`,
  `GET_admin_suppliers-list.json`, `GET_audit-log.json`); obie listy admina idą po **kodach
  dispatchera (10), nie po tabeli `suppliers`**, więc mają 10 pozycji także przy pustej bazie.
  Cztery mutacje mają teraz też nagrania oryginału (12d).
- **Finalny przegląd bezpieczeństwa (kontynuacja w 12e):** przejrzeć WSZYSTKIE trasy mutacji
  pod kątem „`.set(req.body)` bez listy pól" i potwierdzić, że każda ma jawną listę — mają ją
  już staging (3d-2), dostawcy (3f-2), narzuty i promocje (4a) oraz **produkty (12a)**.
  **Zasada przyjęta na stałe:** kolumny wyliczane i kolumny własne odbudowy (`importWylaczony`,
  `uwagaCena`) nigdy nie wchodzą na listę pól edytowalnych. Kontekst i lista tras:
  `rebuild-backlog.md` #14 (dla produktów domknięty w 12a).
- Szczegóły: `docs/tickets/36-FEATURE-konto-admin-maintenance/`.

#### Sesja 12c — Frontend: dialog edycji `LT()` + menu „Akcje" w `/katalog` — ✅ zrobiona 2026-09-05 (`37-FEATURE-katalog-edycja-produktu`)
Domyka katalog (I2) do parytetu edycji z produkcją. Dowiezione:
- `src/pages/katalog/DialogEdycjiProduktu.tsx` — port `LT()`, 42 pola formularza opisane
  deklaratywnie w `poleEdycji.ts` (etykiety dosłowne, bez polskich znaków, jak w oryginale),
  selecty słownikowe z `["/api/atrybuty"]`, znaczniki i kasowanie override'ów
  (`["/api/overrides", dostawca, kod]`, `DELETE /api/overrides/{id}`); warstwa mutacji
  w `src/pages/katalog/api.ts` (`PATCH`/`DELETE /api/products/{id}`, tylko dotknięte pola).
- `src/pages/katalog/MenuAkcji.tsx` — menu wierszowe w tabeli. **Kolejność 1:1 z
  `deminified/frontend-index.js:23763-23814`: Edytuj → Historia (`disabled`) → separator →
  Wstrzymaj/Aktywuj → Usuń** (nie „Edytuj / Wstrzymaj-Aktywuj / Usuń, Historia na końcu", jak
  wcześniej sugerował ten wpis — „Historia" stoi DRUGA). **„Wstrzymaj/Aktywuj" to JEDNA pozycja
  przełączająca** (`:23796`, `:23807`), etykieta i cel wynikają z bieżącego `status`, nie dwie
  osobne akcje.
- **`PodgladProduktu.tsx` USUNIĘTY — odstępstwo D4 z I2 zniesione.** Nagłówek ostatniej kolumny
  tabeli wrócił z „Podgląd" na **„Akcje"**, 1:1 z `:23693-23695`.
- **Invalidacje po mutacjach — wyłącznie `["/api/products"]`.** `Og()` (`:9149`) i `jb()`
  (`:9152`) w oryginale wołają tylko `Uo("/api/products")` — **bez** `["/api/alerts"]` ani
  `["/api/analytics"]`. Odbudowa dokłada `["/api/history"]` (patrz `Yb()` niżej); pilnuje tego
  asercja negatywna w teście, żeby kolejna sesja nie „poprawiła" tego z powrotem.
- **`Yb()` (`:10290-10303`) NIE jest wywołaniem API** — to lokalny dziennik w IndexedDB,
  który nadpisuje cache `["/api/history"]` przez `setQueryData`. Świadomie NIE portowany
  (decyzja D2): od 12a historię pisze naprawdę backend, a `queryClient` ma
  `staleTime: Infinity`, więc port zastępuje `Yb` jawną invalidacją `["/api/history"]`.
- **`szerokosc` — decyzja D3: port 1:1 z zastaną wadą produkcji**, świadomie, udokumentowany
  w kodzie i pokryty testem. Pole zostaje `type="number" step="0.01"` + `parseFloat`
  (`frontend-index.js:24076-24079`), mimo że kanon trzyma `szerokosc` jako TEXT — ręczna edycja
  gubi zera końcowe („10.00" → „10"), tak samo jak w produkcji.
- „Usuń" pyta przez `DialogPotwierdzenia` z dosłownym tekstem `Usunąć {kod}?` (D1, kontynuacja
  precedensu D2 z 7b / D6 z narzutów) zamiast `window.confirm`.
- Suita FE: **683 testy / 45 plików** (było 646/43 baseline); lint/typecheck/build czyste.
  Backend nietknięty (ticket czysto frontendowy). Szczegóły:
  `docs/tickets/37-FEATURE-katalog-edycja-produktu/`.
- **Nota zamknięta:** pozycja „Historia" w menu jest martwa 1:1 z produkcją; backend ma dane
  od 12a, więc jej ożywienie byłoby NOWĄ funkcją, nie portem — nie zadanie tej sesji.
- **Jeśli kolumna „Promocja" w `/katalog` ma kiedyś ożyć** (dziś martwa, D1 z 4b, 2026-09-02)
  — dane musi dostarczyć backend (pole przy produkcie), bo liczenie po stronie klienta
  duplikowałoby silnik dopasowania z `repos/ceny.ts` w przeglądarce. Nie ma na to dziś
  zaplanowanej pracy — nota informacyjna.

#### Sesja 12d — Przenagranie fixtures + schematy ciał w `openapi.yaml` — ✅ zrobiona 2026-09-08 (`38-CHORE-kontrakt-fixtures-odswiezenie`)
Domyka zaległość #1 z I3 (3d-1, `WYJATKI_SZEROKOSC`) i braki nagrań z 12a/12b. Dowiezione:
- **Nowe narzędzie `tools/record-write-fixtures.cjs`** — stawia ORYGINAŁ (`mirror/backend/index.cjs`)
  na kopii `db/snapshot.db`, wygasza scheduler dostawców w kopii (rusza po 60 s, patrz niżej),
  stosuje własny skrypt migracyjny Ani `migrate_szer_to_text.cjs` (ścieżka podmieniona,
  reszta bajt w bajt) i odgrywa **19 scenariuszy**. Odtwarzalne offline, bez sekretów, bez
  dotykania produkcji; nic nie importuje z `rebuild/`.
- **`contract/fixtures/` z 55 na 73** (59 GET + 14 zapisujących): przenagrany `GET_products.json`
  (`szerokosc` jako TEXT z zerami końcowymi, np. `"8.00"`), nowy wariant `GET /api/products`
  **bez parametrów** (goła tablica), `uwagi-cena`, `hold-reasons` oraz **12 operacji zapisujących**
  (4 mutacje produktów z 12a, 4 mutacje konto/admin z 12b, `login`/`logout`) plus kody 400/401/404.
  **Zakres nagrań zapisujących to te 12 operacji, nie wszystkie 52 zapisujące trasy kontraktu**
  (decyzja D3) — reszta (staging, dostawcy, narzuty, promocje, overrides, atrybuty, config,
  spedycja, waga) zostaje bez fixtures, nagrywarka jest w repo, rozszerzenie to dopisanie
  scenariuszy (Follow-up).
- **Nowe narzędzie `tools/generate-openapi-schemas.cjs`** — schematy ciał **z nagrań, nie
  z `rebuild/`**; `contract/openapi.yaml` ma teraz **96 ścieżek / 113 operacji**, z tego **71
  ze schematem odpowiedzi**, **80 schematów w `components/schemas`**, **8 schematów ciał
  żądań**. Idempotentny, tryb `--sprawdz` wpięty w testy.
- **`401` dla `GET /api/me` i `POST /api/login`** — zmierzone na żywym oryginale, nie założone
  (luka dawnego inwentarza 2.3, NIE odstępstwo odbudowy). **`x-odbudowa-auth` + `401` przy 14
  trasach**, które produkcja realnie oddaje **bez tokenu (200)** mimo `security: []` w kontrakcie
  — pełna lista i materiał do audytu w bloku 12e niżej. Dawna osobna nota o `GET /api/audit-log`
  (401 sprawdzany poza kontraktem, w `test/audit-log.test.ts`) jest nieaktualna — trasa ma teraz
  `401` zadeklarowany wprost w `openapi.yaml`. Spójność adnotacji z realnym zachowaniem (mierzonym
  żądaniem, nie deklaracją) pilnuje nowy `rebuild/backend/test/kontrakt.spojnosc.test.ts`.
- **Wyjątek `WYJATKI_SZEROKOSC` USUNIĘTY** z `test/katalog.gate.test.ts` po przenagraniu
  `GET_products.json` — samoczyszczący mechanizm zapalił się dokładnie tak, jak zaprojektowała
  to 3d-1. `WyjatekGate` (typ harnessu) zostaje, dostał nowego jedynego użytkownika i własne
  testy w `gate.harness.test.ts`.
- **⚠ SPROSTOWANIE — `products.uwaga_cena` ZOSTAJE UKRYTA, wcześniejszy zapis tego bloku był
  BŁĘDNY (decyzja D1).** Ten wpis wcześniej zakładał, że przenagranie fixtures „przy okazji
  ujawni" `products.uwaga_cena`, dziś ukrytą projekcją `src/repos/kolumny.ts`. **Obalone dowodem:**
  `U.listProducts()` to `X.select().from(he).all()` (`deminified/backend-index.cjs:44699-44701`)
  — Drizzle bez jawnej listy kolumn oddaje pola MODELU, nie kolumny tabeli; model `he` nie zna
  `uwagaCena` (`grep -c "uwagaCena" mirror/backend/index.cjs` = 0); `uwaga_cena_patch.cjs`
  monkey-patchuje `acceptStaging`/`addProductsBulk`, ale NIE `listProducts`. Zmierzone na żywym
  oryginale (kolumna już dodana przez patch przy starcie): `GET /api/products` i
  `PUT`/`PATCH /api/products/{id}` oddają **72 klucze bez `uwagaCena`**. Ukrycie kolumny jest
  więc **odtworzeniem produkcji, nie długiem** — ujawnienie byłoby odstępstwem. `kolumny.ts` ma
  komentarz oparty na tym dowodzie (zero zmian logiki); test-strażnik pilnuje 72 kluczy bez
  `uwagaCena`.
- **Fakty o oryginale, warte pamiętania przy kolejnych nagraniach:** scheduler dostawców rusza
  60 s po starcie (`mirror/backend/extensions.cjs:811-838`, 6/10 dostawców ma częstotliwość
  ustawioną — nagrywarka musi to wygasić w kopii); baza otwierana relatywnie
  (`new Database("data.db")`), ale `POST /api/products/clear` kopiuje przez
  `path.join(__dirname, "data.db")` — proces musi startować z CWD = katalog backendu; moduły
  `atrybuty` i `pending` mają zahardkodowane ścieżki produkcyjne i lokalnie padają — trasy
  `/api/atrybuty*` są w piaskownicy martwe, blokuje to rozszerzenie nagrań o atrybuty;
  `db/snapshot.db` (2026-08-13) jest starszy niż migracja `szertxt` i patch `uwaga_cena` — obie
  luki domyka kod produkcji (patch przy starcie + skrypt Ani), nie nasz.
- Bramki: **1209 testów / 77 plików** (było 1199), lint/typecheck/build czyste. Szczegóły:
  `docs/tickets/38-CHORE-kontrakt-fixtures-odswiezenie/`.

#### Sesja 12e — Finalny audyt bezpieczeństwa + rozliczenie backlogu + plan cutoveru + przegląd 12 widoków — ✅ zrobiona 2026-09-08 (`39-CHORE-audyt-bezpieczenstwa-domkniecie`)
**OSTATNIA sesja całej odbudowy (I0–I12).** Audyt **nie znalazł ani jednej otwartej dziury**
w auth/CORS/JWT/mass-assignment. Dowiezione:

- **Auth (A1) — OK.** ~95 operacji w 21 plikach `rebuild/backend/src/routes/*.ts`, każda trasa
  danych ma `requireAuth` bezpośrednio przy rejestracji (nie przez `router.use`, więc nie da się
  tego zgubić przy refaktorze routera). Publiczne są dokładnie trzy: `POST /api/login`
  (`auth.ts:31`), `POST /api/logout` (`auth.ts:62` — JWT bezstanowy), `GET /api/health`
  (`app.ts:135` — healthcheck PM2, nie oddaje danych).
- **Luka PROCESU zamknięta (A2).** Testy auth dotąd chodziły po listach (kontrakt +
  kuratorowane tablice w ośmiu plikach) — nowa trasa bez `requireAuth` **i** bez wpisu
  w `openapi.yaml` przeszłaby CI. Zamknięte nowym `rebuild/backend/test/auth.rejestr.test.ts`:
  skanuje realny rejestr Express (`app._router.stack`) i porównuje z jawną listą trzech tras
  publicznych.
- **⚠ CORS — OBALONE ZAŁOŻENIE, usunięte z roadmapy.** Wcześniejsza obawa z promptu audytu, że
  pusty `CORS_ORIGINS` zostawia CORS „de facto otwarty" i że staging/produkcja MUSZĄ mieć
  allowlistę — **nie potwierdziła się**.
  Zmierzone: przy pustym `CORS_ORIGINS` middleware CORS w ogóle się nie montuje (`app.ts:116`),
  więc nie ma nagłówków `Access-Control-Allow-*` i przeglądarka blokuje cross-origin sama.
  Architektura jest same-origin — Apache `mod_proxy [P]` proxuje `/api/*` pod tą samą subdomeną
  co statyczny front (`deploy/staging/htaccess:11`) — więc allowlista jest **zbędna**, a jej
  wymuszanie byłoby konfiguracją na wyrost. Odbudowa jest tu bezpieczniejsza niż oryginał, który
  odbijał dowolny origin z `credentials:true` (`cors.ts:4-12`). Zamiast wymuszania allowlisty
  doszedł strażnik: **`CORS_ORIGINS` zawierający `*` przy `NODE_ENV=production` zatrzymuje start
  procesu** (D2b), plus jawny log stanu CORS przy starcie (`server.ts`).
- **JWT — OK, wzmocnione.** `algorithms: ["HS256"]` przypięte w `jwt.verify` (`auth/jwt.ts:29`,
  D2c) — token podpisany innym algorytmem jest teraz jawnie odrzucany, nie tylko przypadkiem
  poprawny. `JWT_SECRET` bez fallbacku (fail-fast) potwierdzone bez zmian.
- **Mass-assignment (backlog #14) — OK, domknięty na wszystkich ~13 grupach tras mutacji**
  (produkty, dostawcy, narzuty, promocje, staging, spedycja, config, admin, konto, maintenance,
  atrybuty, Selly) — każda ma jawny filtr pól, żadna nie robi `Object.keys(req.body)` do `UPDATE`.
  Szczegóły i tabela `plik:linia`: `docs/tickets/39-CHORE-audyt-bezpieczenstwa-domkniecie/raport.md`.
- **Sidebar (D1, backlog #36) — naprawiony, nota z I8 zamknięta.** `AppShell` przeniesiony
  z pięciu widoków do routera (`App.tsx`, tabela `TRASY_Z_RAMA`) — sidebar renderuje się na
  wszystkich 12 trasach zalogowanego, `/login` i 404 zostają bez niego, jak w oryginale
  (`mn()`, 12 wywołań w `deminified/frontend-index.js`). Padding siedmiu widoków, które dostały
  ramę, sprawdzony (`Katalog.tsx` miał zdublowany `p-6`, zdjęty).
  **Ważny efekt uboczny — wirtualizacja katalogu była martwa w przeglądarce.**
  `useWirtualizacja` (`pages/katalog/wirtualizacja.ts`) wychodzi z efektu, gdy nie znajdzie
  `#$vMainScroll`, a ten element mieszka w `AppShell`. Skoro `/katalog` do 12e nie renderował
  `AppShell`, okno wierszy nigdy się nie przesuwało — widoczne przy rozmiarze strony „Wszystkie"
  (powyżej progu 150 wierszy). Naprawa D1 to odblokowała.
- **Potwierdzenia (D5, backlog #51) — ujednolicone, nota ze scalenia 12b+12c zamknięta.**
  `Staging.tsx:177,210` i `konfiguracja/Admin.tsx:233` przeszły z `window.confirm` na
  `DialogPotwierdzenia`, z dosłownym tekstem pytania. `konfiguracja/Katalog.tsx:45` zostaje jako
  świadomy, opisany komentarzem wyjątek (operacja nieodwracalna).
- **Rozliczenie backlogu:** **#36 ✅** (sidebar naprawiony), **#49 ✅** (retencja 5 kopii bazy po
  `POST /api/products/clear`, best-effort, świadome odstępstwo od produkcji, która nie sprząta
  wcale), **#51 ✅** (potwierdzenia ujednolicone) — naprawione. **#45 ❌** (martwy filtr „Źródło",
  decyzja D4 z 7b utrzymana), **#48 ❌** (brak kolumny roli w `users`, zostaje 1:1 z produkcją —
  patrz niżej), **#50 ❌** (`parsujSzczegoly` w dwóch kopiach, zamierzony duplikat, decyzja D4
  z ticketu 36) — świadomie pominięte. **#52 rozstrzygnięty na stałe:** odstępstwo D1 z I1
  (14 tras pod `requireAuth`, choć produkcja oddaje je publicznie) zostaje — nie cofamy niczego
  do wariantu publicznego, to najgroźniejsza dziura oryginału (`/api/export/shoper` oddaje cały
  katalog, `/api/audit-log` log działań).
  **#48 rozstrzygnięcie:** brak kolumny roli w `users` zostaje świadomie 1:1 z produkcją — nie
  jest to regresja odbudowy (oryginał chroni `/admin/*` samym `requireAuth`), wprowadzenie ról
  to nowa funkcja (migracja schematu + `requireAdmin` + decyzja, kto dostaje rolę) — kandydat na
  osobny ticket PO cutoverze, odnotowany w `docs/cutover.md` i w checkliście Ani.
- **`docs/cutover.md` (nowy)** — plan big-bang: przełączenie Apache/PM2 na nowy stos na TEJ
  SAMEJ bazie `data.db`. Warunki wstępne · weryfikacja schematu `PRAGMA table_info(products)`
  przed migracją · migracje 001→003 · różnice env staging vs produkcja (`SELLY_TRYB`,
  `IMPORT_SCHEDULER`) · kroki przełączenia · rollback · smoke-testy. **Dokument, nie wykonanie.**
- **`docs/przeglad-12-widokow.md` (nowy)** — checklista dla Ani, 12 sekcji (jedna na trasę) +
  logowanie, „rzeczy, które celowo wyglądają inaczej" i „co jest znane i nienaprawione" (#48).
- **Ścieżki (GATE) całej Iteracji 12:** password, users, admin×3, maintenance, products/clear,
  audit-log — **✅ gotowe od 12b**; **products×6 — ✅ gotowe od 12a** (`POST` + `PATCH`/`PUT`/`DELETE {id}` +
  `uwagi-cena` + `hold-reasons`).  **Fixtures:** `GET_users.json`, `GET_admin_supplier-config.json`,
  `GET_admin_suppliers-list.json`, `GET_audit-log.json` — **✅ zielone od 12b** + fixtures
  zapisujące dla czterech operacji produktów, czterech mutacji 12b i `login`/`logout`,
  nagrane z oryginału w 12d (`contract/README.md`). **12e nie zmienia kształtu ani wartości
  żadnej odpowiedzi API — `contract/` nietknięty.**
- **Bramki:** backend **79 plików / 1223 testy** (było 1209, +14); frontend **48 plików /
  747 testów** (było 731, +16) + 5 plików / 39 testów integracyjnych; lint/typecheck/build
  czyste po obu stronach.
- **DoD Iteracji 12 — spełnione w całości:** konto/admin/maintenance ✅ (12b); mutacje produktów
  ✅ i akcje wierszowe w `/katalog` ✅ (12c, odstępstwo D4 z I2 zniesione); kontrakt i fixtures
  odświeżone ✅ (12d); audyt bezpieczeństwa domknięty bez znalezisk ✅ (12e); fixtures przez
  GATE ✅; `docs/cutover.md` i `docs/przeglad-12-widokow.md` gotowe ✅ (12e).
  Szczegóły: `docs/tickets/39-CHORE-audyt-bezpieczenstwa-domkniecie/`.

---

### Iteracja 13 — Delty produkcji Ani 26.08–08.09 (post-odbudowa)

- **Status:** 🔨 w toku — zaplanowana 2026-09-08 (`40-CHORE-triaz-i13-plan`); zrobione 13f, 13a, 13b,
  13c i 13e, zostaje 13d (Selly). **Zależy od:** 3 (import), 8 (Selly).
- **Skąd się wzięła.** Producent (`tools/vps-sync.sh`) **milczał 25.08–08.09** (grep `\.bak_pre_`
  przestał trafiać po zmianie nazewnictwa kopii `.bak` Ani → skrypt ubijał się pod `set -euo pipefail`
  przed `git push`; naprawione w `d88ac15` na main). Dwa tygodnie zmian produkcji wciągnięto RĘCZNIE
  w commit **`6872aea`** (64 pliki). **Źródło prawdy tej iteracji:** `mirror/backend/CHANGELOG.md`
  (wpisy 2026-08-25…09-08), `db/schema.sql`, `mirror/backend/parsers/*.cjs`, `mirror/backend/selly/*`.
  Backlog: nowe wpisy **#53–#64** + domknięcie audytowych **#3/#8/#9/#10** (to były NASZE findingi
  „audytu Claude'a", na które Ania wprost zareagowała — patrz CHANGELOG „Bug #1/#2/#3/#4").
- **Cel:** odtworzyć w `rebuild/` te zmiany 1:1 (PORT parserów, migracje, nowy podsystem Selly),
  żeby cutover big-bang szedł ze stanu produkcji z 08.09, nie z 25.08.

**Oś podziału = MECHANIZM PORTU, nie logiczne grupy zmian.** `src/import/legacy/**` jest bajt-w-bajt
kopią `mirror/backend/**` (parsery WYKONUJĄ się jako oryginalny kod), a silnik `tk()`/`acceptStaging`
to reimplementacja TS porównywana z żywym oryginałem. Dlatego nie da się rozdzielić „b4" od „katunify"
w `tyre_params.cjs` — to jeden plik, kopia jest atomowa. Karty idą więc po WARSTWACH: parsery (kopia) →
silnik (TS) → migracje/fixtures → Selly → FE → decyzja. Każda karta bumpuje SPÓJNY wycinek `mirror/`
z main@08.09 + port + przenagrywa swoje bramki → develop zielony po każdej. Mapowanie zmian→kart:
`docs/rebuild-backlog.md` (sekcja „Delty produkcji…", tabela na początku). Prompty startowe:
`docs/tickets/40-CHORE-triaz-i13-plan/prompty-13a-13f.md`.

**Fakt operacyjny (odkryty w 13a, dotyczy każdej karty I13 dociągającej port):** gałąź `main` NIE
zawiera katalogu `rebuild/` — jest czystym lustrem produkcji, nie repozytorium odbudowy. Komenda
`git checkout main -- rebuild/...` na porcie zawodzi; port dociąga się przez
`git show main:mirror/backend/<plik> > rebuild/backend/src/import/legacy/<plik>`, tym samym blobem
co oracle, żeby obie kopie pochodziły z jednego źródła.

**Podział na sesje (każda = osobny ticket `/feature`):**

- **13f — Backfille: ✅ ROZSTRZYGNIĘTE 2026-09-08 — BEZ KODU** [decyzja, `41-CHORE-i13f-decyzja-backfille`].
  Dotyczyło: **tl_tt** 628 rek. (A: jawne TL; B: Ciężarowe+Radialna+śr≥17.5→TL; C: BKT MAGLIFT+Diagonalna+śr≤12→TT),
  **szerokości ułamkowe** 10 rek., **JMK marka/model** 14 rek. + 27 overrides. **Decyzja użytkownika: NIE
  odtwarzamy backfilli jako kod/migracje.** Powód rozstrzygający: cutover jest big-bang na **TEJ SAMEJ
  `data.db`** (`docs/cutover.md` — „nie migrujemy danych"), którą Ania już zbackfillowała — wartości już
  są w bazie, na której odbudowa wystartuje. Reguły **tl_tt B/C NIE wchodzą** do parsera/mapowania (były
  jednorazowym czyszczeniem historycznych NULL-i; dodanie = świadome odstępstwo od 1:1, którego nie robimy).
  Na PRZYSZŁE importy wystarcza parserowy default TL dla Ciężarowych (wchodzi z 13a) + overrides JMK (już
  w bazie). ⚠ Świadomy skutek uboczny: `products/clear` + reimport NIE odtworzy wartości B/C — tak samo
  jak w produkcji (jej parser też ich nie derywuje), więc zgodność 1:1 zachowana. **Nic nie blokuje 13c.**
- **13a — Parsery: re-sync warstwy `legacy` (kopia bajtowa) — ✅ zrobione 2026-09-08
  (`42-CHORE-i13a-resync-parserow`).** Zsynchronizowano bajt-w-bajt z `main@6872aea` (08.09) RÓWNOLEGLE
  `mirror/backend/` i `src/import/legacy/`: `common.cjs`, `parsers/{adapter,tyre_params,mo1_bohnenkamp,
  mo2_jmk,mo6_agrowiec,mo7_nokian,mo8_trelleborg,mo9_agrorami_api}.cjs` — dokładnie 9 plików, nic poza
  listą. Kopia wniosła ATOMOWO: **b4** (WxSxD — ⚠ NIE była w baseline 25.08, 0 wystąpień
  „POPRAWKA 2026-08-31" w `mirror@develop` sprzed karty; realnie uruchomiona próbkami, 4 rek. MO8),
  **b10** (Handlopex sufiksy `model`, 2 rek. MO4), **p2_4** (parseSize L-series/ułamki, 7 rek.),
  **mo9expand** (kod jest, próbki go nie uruchamiają — brak indeksów pasujących do wzorca), **odswinch**
  (⚠ niezalogowana w CHANGELOG, rozłożona diffem w raporcie karty — nowy wariant calowy OD×SW-Rim,
  98 rek.), **bug1** (MO1 `odrzuconePrzezAdapter` 1→0), **bug2** (NRO/CHO→`Tak`/null, 255 rek.),
  **bug4** (kod jest, próbka MO8 to tylko XLSX, gałąź CSV nieuruchomiona), **katunify** (kod jest,
  próbki nie mają surowej kolumny kategorii więc fallback `classifyByName` go omija), **konstr**
  (kody→słowa, uruchomione u wszystkich 10 dostawców, 1837 rek.). Rozbicie liczb per dostawca:
  `docs/tickets/42-CHORE-i13a-resync-parserow/raport.md`. **Bramki:** `charakteryzacja` byte-for-byte
  (9 plików + całe drzewo `legacy/**`) zielone; field-char MO1–MO10 przenagrane i zielone. **Ponad
  pierwotny zakres (decyzja użytkownika w trakcie):** przenagrano też wzorzec charakteryzacji SILNIKA
  (`test/charakteryzacja/silnik/MO*.expected.json`) — stan przejściowy, patrz blok 13b niżej.
- **13b — Silnik `tk()`/`acceptStaging`: P3 + CAPS/Xq — ✅ zrobione 2026-09-09
  (`43-CHORE-i13b-silnik-p3-caps`).** Reimplementacja TS (te zmiany są w `index.cjs`, nie w
  `legacy/`): **P3** fallback marki → `"UNKNOWN"` (zamiast `nazwa.split`) — **w `U.acceptStaging`,
  NIE w `tk()`** (sprostowanie faktu: offset fallbacku 1 350 905, przed obiema definicjami `tk`);
  **CAPS/Xq** — `wartosciRowne()` (port `Xq`) equality case-insensitive. **Bramki zielone:** kotwica
  sha „wycięty fragment `index.cjs`" (`helpery` 584611d4→62d7202a, `silnik` bez zmian) +
  `silnik.charakteryzacja` + `akceptacja.charakteryzacja` (nowy scenariusz marka „UNKNOWN"). Pełny
  przebieg 80 plików / 1234 testy. **Cieniowanie (CLAUDE.md §5), zweryfikowane liczeniem w
  `mirror/backend/index.cjs@main`:** `function tk(` 1× (martwa, `_KP` 5 pól), `tk=function(` 1×
  (**ŻYWA**, łatka po bundlu, `_KP` 7 pól), `function Xq(` 1× — **brak cieniowania**, jedna
  definicja wspólna dla obu `tk`.
  **Zależność:** 13a (silnik konsumuje wyjście parserów) — spełniona.
  **Stan przejściowy z 13a rozliczony.** `test/charakteryzacja/silnik/MO*.expected.json` przenagrany
  ponownie PO bumpie `mirror/backend/index.cjs` na 08.09 — fragment `helpery` (zawiera `Xq`) zmienił
  sha, fragment `silnik` (żywy `tk`) **bez zmian**, zgodnie z przewidywaniem. Przy przenagraniu
  zmieniło się **57 pól `powod`** w MO1–MO5 i **zero innych pól**; wszystkie te wiersze zostały
  `typZmiany: "zmiana_kluczowa"` — patrz nota niżej w bloku **13c**, bo to tam się rozstrzyga.
- **13c — Migracje danych + fixtures konwencji** [BAZA + BE] — ✅ zrobione 2026-09-09
  (`44-CHORE-i13c-migracje-konwencji`). Trzy migracje SQL, stosowane runnerem `npm run migrate`
  w transakcji, w kolejności chronologicznej produkcji: `rebuild/schema/004_kategoria_wielka_litera.sql`,
  `005_konstrukcja_slowa.sql`, `006_nazwa_caps.sql`. Pomiar na kopii `db/snapshot.db` (7405
  produktów): pierwszy przebieg zmienił **537 / 7392 / 2647** wierszy (kolejno kategoria /
  konstrukcja / nazwa+overrides), **drugi przebieg 0 / 0 / 0** — idempotencja TREŚCIOWA
  (przybita testem, nie tylko przez ewidencję `_migracje`). `staging_items` stracił **723**
  wiersze CASE_ONLY. Fixtures przenagrane: `GET_products.json`, `GET_products_bez-parametrow.json`,
  `PUT_products_id.json`, `PATCH_products_id.json`. **Bramki:** backend 80 plików / 1241 testów,
  **frontend 48 plików / 748 testów**, `lint`/`typecheck`/`build` po obu stronach,
  `tools/generate-openapi-schemas.cjs --sprawdz` — wszystko zielone.
  ⚠ **Nauka dla kolejnych kart: `contract/fixtures/` są WSPÓLNE dla backendu i frontendu.**
  13c puściła najpierw same bramki backendu (bo `CLAUDE.md` wymienia „Bramki backendu") i CI
  zapaliło się na `katalog.formatowanie.test.tsx`, który porównuje się z prawdziwą pozycją
  z `GET_products.json`. **Ticket ruszający fixtures musi puścić bramki OBU stron.**
  **Znalezisko 13a rozstrzygnięte:** `katunify` NIE unifikował kategorii `'rolnicze małe'` w
  warstwie parserów (MO2, 3 rek.) — Wielką literę nadaje `mirror/backend/apply_kategoria.cjs:12`,
  spoza warstwy parserów. **katunify WYMAGAŁ migracji historycznych kategorii** — 537 rekordów
  z małej litery (dokładnie liczba z backlogu #2). Stan po migracji odpowiada DOKŁADNIE
  rozkładowi zweryfikowanemu przez Anię na produkcji (CHANGELOG 2026-09-01 10:35): Rolnicze 4533,
  Ciężarowe 1463, Przemysłowe 1195, Leśne 214. Mapa migracji = unia `KATEGORIA_CANONICAL_MAP`
  (`common.cjs`) i mapy z `apply_kategoria.cjs`, bo obie są cząstkowe (szczegóły:
  `docs/tickets/44-CHORE-i13c-migracje-konwencji/plan.md` D4).
  ⚠ **Sprostowanie:** ta karta NIE jest wzorowana na „#2 kategoriafix" — #2 migracji nigdy nie
  dostał, zamknięto go portem `capitalizeKategoria()` w 3a. Jedynym wcześniejszym wzorcem
  migracji było #3 (`003_szerokosc_text.sql`); kategoria migrację dostaje dopiero w tej karcie.
  ⚠ **Sprostowanie:** produkcja (CHANGELOG 2026-09-01 11:35) migrowała `konstrukcja` wyłącznie dla
  kluczy `R`/`D`/`L`/`B`. Klucz `'-'` → `Diagonalna` istnieje tylko w `KONSTRUKCJA_CANONICAL_MAP`
  jako mapowanie dla PRZYSZŁYCH importów, nie jako migracja, którą Ania faktycznie wykonała —
  nasza migracja go obejmuje (bo mapuje wg mapy kanonicznej), ale to była nasza decyzja (D3),
  nie odtworzenie kroku produkcji.
  **Bramki/fixtures:** przenagrane, pokazują Wielką literę kategorii, słowa konstrukcji, WIELKIE
  nazwy.
  ⚠ **Rozjazd CHANGELOG↔kod (znalezisko 13b) — ta karta go rozstrzyga.** CHANGELOG Ani
  (2026-09-01 12:30) i backlog #59 twierdzą, że case-insensitive `Xq` sprawia, iż „Kleber GRIPKER"
  vs „KLEBER GRIPKER" NIE generuje `staging_items` typu `zmiana_kluczowa`. **Kod produkcji tego nie
  robi** — w żywym `tk` klasyfikacja `_ck` liczy się BEZ `Xq`, jest case-SENSITIVE
  (`_KP=["rozmiar","indeksNosnosci","indeksPredkosci","model","marka","nazwa","kodDostawcy"]`,
  porównanie `String(vS??"")!==String(vN??"")`); diff 08.09 tego fragmentu nie tknął. `Xq` wpływa
  realnie tylko na narrację `powod` (`POLA_ROZNIC`) i na auto-patch PIĘCIU pól: `cenaZakupu`/
  `cenaSprzedazy`/`marzaPct`/`stan`/`magazyn` — **bez `ean`**, bo `AP.ean` istnieje wyłącznie
  w MARTWEJ definicji `tk`; żywy `tk` ma dokładnie 6 wywołań `Xq` (1 w pętli `powod` + 5 wyżej). Dowód empiryczny z 13b: przenagranie wzorca zmieniło
  57 pól `powod` i ZERO innych pól — wiersze zostały `typZmiany: "zmiana_kluczowa"`. **Migracja
  danych tej karty (`UPPER(nazwa)` + `DELETE` wierszy staging CASE_ONLY, reguła R3 — każdy
  segment `powod` case-only) usunęła ten szum** — 723 wiersze skasowane (16 wierszy z polskim
  diakrytykiem w case-only różnicy ZOSTAJE nietknięte na zawsze, bo SQLite `UPPER()` jest
  ASCII-only również w predykacie DELETE, nie tylko w `UPDATE nazwa=UPPER(nazwa)` — zamierzone,
  wierne 1:1 produkcji, przybite testem-strażnikiem). **NIEZWERYFIKOWANE w tej karcie:** czy
  sześć konfliktów MO8 z 13b (staging 25→31) zniknęło po tej migracji — 13c nie mierzyła tego
  scenariusza, nie zgadywać wyniku.
  ⚠ **Zmierzony fakt (obala wcześniejszą zapowiedź „drugie przesunięcie wzorca"):** przenagranie
  `test/charakteryzacja/silnik/MO*.expected.json` po migracji `UPPER(nazwa)` dało **diff = 0**.
  Powód: harness `scripts/charakteryzacja-silnik-nagraj.mjs:210-227` karmi ORAZ oryginał, ORAZ
  nasz port surowym `db/snapshot.db`, którego 13c nie dotyka — obie strony dostają identyczne
  wejście, więc migracja danych nie mogła przesunąć wzorca zbudowanego na innym źródle.
  **Zależy od:** 13a, 13b (spełnione).
- **13d — Selly REST sync (NOWY podsystem)** [BE] — ⛔ **ODŁOŻONE, START WSTRZYMANY**. Reimplementacja TS
  7 plików `selly/*` (`discovery`/`sync_delta`/`sync_full`/`mapper_v2`/`rate_limiter`/`scheduler_selly`/
  `routes_sync`) + przeprojektowana `selly_products` (klucz `(kod_importu,dostawca)`→`(selly_product_id,
  selly_variant_id)` + `feature_id_magazyn`; stara → `selly_products_old`). Model wariantowy: cena/stan
  PER WARIANT (`PUT .../variants/{vid}`), rate limiter 250/60s + `apiWithRetry`, `provider_code=kod_importu`.
  **Zależy od:** 8; **wykracza poza I8** (I8 = eksport CSV). Niezależne od 13a–13c. Podział (docelowy):
  13d-1 discovery+delta (Tor 1), 13d-2 sync_full (Tor 2), 13d-3 przyciski sync w panelu FE.
  - **HISTORIA:** 13d-1 zostało sportowane i zmergowane (`45-FEATURE-selly-rest-sync-tor1`, PR #57), a
    następnie **COFNIĘTE** (`46-CHORE-revert-13d1-selly`, `git revert -m 1`) 2026-09-09.
  - **DLACZEGO cofnięte:** Ania (2026-09-09) potwierdziła, że podsystem Selly **NIE jest zamrożony** —
    dostawcy aktualizują się przez ~tydzień i ona łata błędy w `selly/*` na bieżąco. Port z 08.09 był
    ruchomym celem. **Całe 13d przepisujemy ŚWIEŻO po ustabilizowaniu**, nie odświeżamy prowizorki.
  - **SYGNAŁ STARTU (zielone światło):** `git log --since="7 days ago" --oneline main -- mirror/backend/selly/`
    przez kilka dni **nic nowego** (albo Ania mówi „stabilne"). Rewizja orientacyjnie **~2026-09-16**.
  - **STAN 2026-09-09 (triaż w 46-CHORE):** docieranie TRWA — 3 commity producenta (`d88ac15..94bdf11`):
    `sync_full` przepisany (428 linii; usunięte PUT features po Selly 400 „Malformed JSON"), `mapper_v2 v2.1`
    (bez `vat_rate` — VAT na kategorii w Selly), `discovery.buildProductCodeCache` (paginacja `/api/products`),
    weryfikacja pierwszego nocnego Tor 2 (MO5: 1713 ok, 0 błędów). **Zegar startu ZRESETOWANY** — port dziś
    byłby nieaktualny w 428 liniach. Potwierdza trafność revertu 13d-1. Nowej karty NIE zakładamy.
  - **STAN 2026-09-18 (triaż `94bdf11..9d1b09f`, `52-CHORE-triaz-produkcja-i14`): DOCIERANIE NADAL TRWA,
    zegar startu ZNOWU ZRESETOWANY.** W oknie 09–18.09 padło kolejnych 5 commitów w `selly/*` — ostatni
    **17.09 wieczorem**, czyli PO orientacyjnej dacie rewizji ~16.09. Sygnał startu **nie zapalił się**.
    Nowej karty NIE zakładamy; następna rewizja po kolejnym cichym tygodniu.
  - **⭐ USTALENIE Z 08.09 OBALONE — czytaj to, ZANIM zaczniesz przepisywać 13d.** Komentarz
    „PUT /api/products/{pid} NIE akceptuje `features` (HTTP 400 Malformed JSON)", na podstawie którego
    13d-1 wyciął `PUT features`, **przestał obowiązywać**: `mirror/backend/selly/sync_full.cjs` mówi dziś
    „Test produkcyjny 2026-09-17 potwierdzil, ze PUT /api/products/{pid} przyjmuje pelna tablice `features`
    mimo braku tego pola w fields_edit" (commit `5dedefb`). Ścieżka A robi teraz `GET /api/products/{pid}`
    → payload z `includeFeatures:true` → `PUT` z cechami i `category_id`. Backlog **#81**.
  - **DECYZJA UŻYTKOWNIKA 2026-09-18:** backlog **#81** (właściciel metadanych produktu +
    przywrócone `PUT features`) jest **formalnie ODŁOŻONY DO 13d** — nie zakładamy osobnej karty,
    nie nanosimy tego poza 13d. Wpis ma w backlogu „Do nowej wersji?" = 🕒 PÓŹNIEJ. Ta linia jest
    po to, żeby przy starcie 13d nikt nie szukał tematu w backlogu — **#81 jest częścią zakresu 13d**.
    Tą samą decyzją #74 i część delta z #77 również czekają na 13d (patrz niżej).
  - **Co jeszcze doszło w `selly/*` i wchodzi do zakresu przepisania** (szczegóły w backlogu):
    **#74** — kategorie Selly przebudowane, stare ID 137/259/377 zwracają 404, żywe to 1/2/3/4;
    ID siedzą w `selly_kategoria_norm_map` (dane), nie w kodzie — **nie hardkodować**.
    **#77** — `sync_delta.findDeltaProducts()` obejmuje `wstrzymany` z istniejącym wariantem i wysyła
    dla nich stan 0 (bez tworzenia nowych produktów).
    **#81** — `sync_full`: `metadataScore()`/`isMetadataOwner()` (jeden kanoniczny rekord Bridge pisze
    cechy i kategorię wspólnego produktu; grupa o różnych kategoriach jest pomijana), usunięta martwa
    `fetchVariantFeatures()`, `mapper_v2.buildFeaturesMirror()` nie dziedziczy już starej wartości cechy
    zarządzanej przez Bridge, gdy bieżąca jest pusta. To **nowa logika biznesowa**, nie defekt do
    odtworzenia 1:1 — wchodzi świadomie, jako decyzja.
    **Do opisania jako defekt:** usunięcie produktu nie sprząta mapowań `selly_products` (osierocony
    rekord trzymał stare zastosowanie w wyszukiwarce sklepu — `5cfb7ab`, 17.09).
  - **⚠ PUŁAPKA:** revert merge’a #57 sprawia, że git uzna `feature/45` za „już zmergowane". Rewrite MUSI
    iść na **NOWEJ gałęzi** (świeży port z finalnego `mirror/selly/`), NIE przez re-merge `feature/45`.
- **13e — Frontend: `szer_marka` (rebrand i `PRICEFMT` odbudowa miała już 1:1)** [FE] — ✅ zrobione
  2026-09-09 (`47-CHORE-i13e-frontend-bridgeone`, backlog #61). Z pięciu etykiet z bundla
  produkcji realny kod dotyczy **wyłącznie `szer_marka`** — i to NIE „kolumny szerokość/marka",
  lecz dwóch poprawek z 2026-09-04 15:00: **(a)** `Wfmt`/`formatujSzerokosc` traci gałąź „cała
  notacja `AxB`", **(b)** filtr „marka bez cyfr" obejmuje też wartości ze SŁOWNIKA (`listaMarek`).
  `listaKategorii` filtra dalej nie ma w żadnej gałęzi — asymetria marka↔kategoria ZOSTAJE i nie
  wolno jej „domykać". **Zależy od:** 13c (✅ 2026-09-09). API nietknięte, więc **GATE N/D**
  (`contract/`, `rebuild/backend/`, `mirror/` bez zmian w diffie gałęzi); bramki FE
  `lint`/`typecheck`/`build`/`test` zielone (751/751, 48 plików).
  **Fakty ustalone rozkładem diffu bundla** (kopie `.bak` istnieją tylko na `main`, czyta się je
  `git show main:mirror/frontend/assets/<plik>`; pełny rozkład i materiał dowodowy:
  `docs/tickets/47-CHORE-i13e-frontend-bridgeone/plan.md`):
  - **Żywy bundle to `index-PRICEFMT1783512500.js`** (`mirror/frontend/index.html:16`).
    `index-BRIDGEONE21783342500.js` jest MARTWY od łatki `pricefmt` z 31.07.
  - **Rebrand „Bridge ONE" i `PRICEFMT`: odbudowa miała je JUŻ 1:1 — zero kodu w tej karcie.**
    Rebrand jest z 2026-07-31 (data „09-01…04" w backlogu opisywała nazwę PLIKU bundla, nie
    zmianę), a `deminified/frontend-index.js` to bundle PRICEFMT sprzed 04.09 — port z I0–I12
    wciągnął oba automatycznie (`index.html:6`, `AppShell.tsx:47,73`, `Login.tsx:48`,
    `katalog/formatowanie.tsx:167,169`).
  - **`tr_fix` i `ackalerts` nie mają w odbudowie NOŚNIKA — nie ma czego portować.** Obie łatki
    żyją w silniku PSEUDO-ALERTÓW katalogowych (`pv`/`v2`/`h2` + IndexedDB `alerty-statusy`),
    którego odbudowa świadomie nie ma (D1 z I6, backlog #26); `/alerty` stoi na REALNYCH alertach
    importu z `GET /api/alerts`.
  - **Pomiar (a) na `db/snapshot.db`: 587 z 7395 pozycji zmienia zapis.** ⚠ Zniesiona gałąź
    oddawała DWA PIERWSZE CZŁONY, a nie cały `rozmiar` — czytaj jako `rozmiar` → dziś (dawniej):
    `8.00x20` → `8.00` (dawniej `8.00x20`), `14.9x28` → `14.9` (dawniej `14.9x28`),
    `16x6-8` → `16` (dawniej `16x6`), `23x10.50-12` → `23` (dawniej `23x10.50`). Zera końcowe
    niesie pętla po tokenach `rozmiar` — nie upraszczać jej.
  - **Zasięg (a) obejmuje eksport CSV.** W oryginale `Wfmt` woła `DT` (tabela) i `OT` (CSV),
    w odbudowie `eksport.ts:78` woła to samo `formatujSzerokosc`. Dialog reguł `/narzuty` ma
    własną listę marek i filtra cyfr NIE dostaje — tak jak memo `h` w oryginale.
  - **`products.nazwa` CAPS a formatowanie nazwy we froncie: zmierzone — BEZPRZEDMIOTOWE.** FE
    nigdzie nie robi capitalize/title-case na `nazwa` (zero trafień w `rebuild/frontend/src/`;
    jedyne `toLowerCase` to szukajka katalogu). Konwencja CAPS z 13c i ASCII-only `UPPER`
    („PROWADZąCA") przechodzą przez warstwę prezentacji surowe — tak jak w produkcji.
  - ⚠ **`konstr` po stronie FE zrobiony W 13c, nie tutaj** (pass-through `n||""`/`n||null` obok
    mapowania kodów — szczegóły w bloku 13c). Skutek uboczny wpisany do testów: wartość spoza mapy
    przechodzi surowa, więc jedyny produkt z `konstrukcja='X'` w `db/snapshot.db` pokaże się jako
    „X", a nie „—". Nie „poprawiać". **Żywa produkcja tego pass-through nie ma** — patrz D4 niżej
    i nota o cutoverze w §6.
  **Decyzje użytkownika (2026-09-09):**
  - **D1 — rebrand zostaje jak jest, bez kodu.** Odtwarzamy rozjazd zapisu z bundla Ani: „Bridge
    ONE" w `<title>`, „BridgeOne" (bez spacji) w trzech miejscach UI. Ujednolicenie byłoby
    odstępstwem. Backlog #61 rozstrzygnięty.
  - **D2 — `tr_fix` i `ackalerts` pkt 1–3: nie portujemy** (kontynuacja D1 z I6, backlog #26).
    Pkt 2 („pulpit respektuje potwierdzenia") odbudowa spełnia konstrukcyjnie — `aktywneAlerty()`
    filtruje po `status === "nowy"` z realnej odpowiedzi API, bez IndexedDB.
  - **D3 — `ackalerts` pkt 4 (ukrycie statusu `rozwiazany`): nie portujemy.** Oryginał ma trzy
    statusy i domyślny filtr „wszystkie", odbudowa (w tym momencie, 2026-09-09) dwa i domyślny
    filtr `nowy` — ta sama reguła zdegenerowałaby opcję „Wszystkie statusy" do duplikatu opcji
    „nowy". *(Nieaktualne od P6.1 — 72, 2026-09-21: odbudowa ma już trzy statusy i domyślny filtr
    „Nierozwiązane", degeneracja nie zachodzi.)*
  - **D4 — pass-through `konstrukcja` ZOSTAJE mimo regresji żywej produkcji.** Od 2026-09-09 to
    świadome odstępstwo: odbudowa jest POPRAWNIEJSZA niż produkcja. Odrzucone: zdjęcie
    pass-through, żeby odtworzyć zepsute zachowanie (cofałoby 13c).
  **Follow-up (nierozliczone):** silnik pseudo-alertów — backlog #26 ⬜; gdyby kiedyś wszedł,
  wchodzi OD RAZU w wersji po łatkach z 04.09. Trzeci status alertu `przejrzany` istnieje od
  P6.1 (72, 2026-09-21) też w odbudowie — ale wyłącznie dla alertów IMPORTU; pseudo-alerty
  katalogowe (#26/P6.2) go nadal nie mają. Enhancer konfiguratora kolumn stagingu
  (`ex_marka`/`ex_szerokosc`) — **rozliczone w 14b** (`51-FEATURE-staging-filtr-pasek-kolumny`,
  2026-09-18): wchłonięty jako komponent React; `ex_marka`/`ex_szerokosc` to dwie z 49 pozycji
  sekcji „Dodatkowe (z katalogu)", która w oryginale nic nie robi (`applyCss()` zaczyna od
  `if (c.extra) return`, `fe.js:29134`) i odtworzona 1:1 razem z tą martwotą (D3 w bloku 14b).
  Skojarzenie z etykietą `szer_marka` było mylące — to inna zmiana.

**Kolejność:** 13f (decyzja) → **13a** → **13b** → **13c** → **13e** ; **13d ODŁOŻONE** (przepisanie świeże
po ustabilizowaniu `mirror/selly/` u Ani, ~2026-09-16 — patrz blok 13d; 13d-1 sportowane i cofnięte 09.09).
13d jest niezależne od 13a–13c (inny podsystem), więc może startować równolegle po 13a. 13a jest twardym
fundamentem — nie zaczynaj 13b/13c przed jego merge.

---

### Iteracja 14 — Uwagi Ani z testów Iteracji 3 (warstwa UI importu i stagingu)

- **Status:** ✅ ZAMKNIĘTA 2026-09-19 (zaplanowana 2026-09-18). **FALA 1 ZAMKNIĘTA 2026-09-18:** 14a ✅
  (`49-CHORE-i14a-wgrywanie-reczne`), 14b ✅ (`51-FEATURE-staging-filtr-pasek-kolumny`),
  14c ✅ (`50-FEATURE-i14c-karta-dostawcy-upload`), 14d ✅ (`56-DOCS-instrukcja-testow-i14`).
  **FALA 2 ZAMKNIĘTA W CAŁOŚCI 2026-09-19:** 14e ✅ (`53-CHORE-i14e-diagnoza-promocji`),
  14f ✅ (`64-FEATURE-i14f-daty-koncza-promocje`, 2026-09-19), 14h ✅
  (`61-FEATURE-promocja-kolumna-katalog`, 2026-09-18), 14i ✅ (`58-FEATURE-i14i-ean-naukowy-pusty`,
  2026-09-18), 14j ✅ (`59-CHORE-i14j-oracle-diff-historii`, 2026-09-18), 14m ✅
  (`65-DOCS-instrukcja-testow-i4-v2`, 2026-09-19), 14g skasowana.
  **Zależy od:** 3 (import), konkretnie widoków z 3e i 3f.
  Niezależna od otwartego 13d (inny podsystem, inne pliki).
- **Skąd się wzięła.** Ania przeszła `docs/instrukcja-testow-I3.md` i wypełniła pola UWAGI (komentarze
  + zrzuty ekranu). **To NIE jest kolejna delta produkcji** jak I13 — produkcja się nie zmieniła.
  I13 portowała KOD, którego odbudowa nie miała; I14 nadrabia to, czego odbudowa nie przeniosła
  z **warstwy UI** oryginału, plus rozstrzyga decyzje, o które Ania poprosiła w rozdz. 12 i 13
  instrukcji. Większość jej uwag o parserach i silniku wypadła — 13a/13b/13c je już dowiozły.
- **Cel:** dociągnąć trzy ekrany do kształtu oryginału (1:1) i zaktualizować instrukcję testów I3,
  która w rozdz. 12 i 13 opisuje stan sprzed I13.

**Oś podziału = PLIK, nie temat.** Karty 14a/14b/14c mają ROZŁĄCZNE zestawy plików źródłowych
i testowych, dzięki czemu idą RÓWNOLEGLE na trzech gałęziach. Pierwszy podział był tematyczny
i stawiał przycisk „Wgraj plik" z karty dostawcy w jednej karcie z zakładką „Wgrywanie ręczne" —
a to dwa różne pliki i dwie różne implementacje (w oryginale też: kafle w zakładce wołają wspólny
dialog, przycisk na karcie dostawcy ma własny, samodzielny upload). Własność plików:

| Karta | Pliki źródłowe (wyłączna własność) | Testy |
|---|---|---|
| 14a | `src/pages/konfiguracja/Wgrywanie.tsx`, `detekcja.ts`, `wgrywanie.ts` | `test/konfiguracja.test.tsx` |
| 14b | `src/pages/Staging.tsx`, `src/pages/staging/**` | `test/staging.test.tsx` |
| 14c | `src/pages/konfiguracja/Dostawcy.tsx`, `DialogKonfiguracjiDostawcy.tsx`, `dostawcy.ts` | `test/konfiguracja.dostawcy.test.tsx`, `test/konfiguracja.admin.test.tsx` |

⚠ Ta tabela w wersji przed 50-FEATURE-i14c-karta-dostawcy-upload pomijała `dostawcy.ts`, mimo że
to moduł wspierający `Dostawcy.tsx` (typy, `PRESETY_CZESTOTLIWOSCI`, `formatujCzestotliwosc`,
`synchronizujTeraz`, `zapiszDostawce` — `grep -n "from \"./dostawcy\"" Dostawcy.tsx`). Skutek w
50-FEATURE-i14c-karta-dostawcy-upload: klient uploadu musiał wylądować wewnątrz `Dostawcy.tsx`,
bo lista była whitelistą. Poprawione tutaj.

Żadna z trzech kart nie rusza `contract/`, `rebuild/backend/` ani `contract/fixtures/` — **bramki
backendu są dla nich N/D**. Gdyby któraś musiała ruszyć fixtures, ma się ZATRZYMAĆ i zapytać
(fixtures są wspólne dla BE i FE — nauka z 13c).

⚠ **`deminified/frontend-index.js` jest bundlem z 13.08**, czyli sprzed łatek FE Ani. Numery linii
niżej są z niego i były weryfikowane pod kątem ISTNIENIA zachowania, nie jego najnowszej wersji.
Zanim zmienisz etykietę albo tekst, potwierdź go w ŻYWYM bundlu
(`mirror/frontend/assets/index-PRICEFMT1783512500.js`, ścieżka w `mirror/frontend/index.html`).

**14a — zakładka „Wgrywanie ręczne"** [FE] — ✅ **ZROBIONE 2026-09-18**, ticket
`49-CHORE-i14a-wgrywanie-reczne`. Wszystkie cztery braki dowiezione:
- **Wgrywanie zbiorcze jest MODALEM** za „Wgraj pliki" (`button-multi-upload`), dialog
  „Wgraj wiele plików — auto-detekcja dostawcy" z „Dodaj kolejny plik" / „Wyczyść" /
  „Importuj do staging" (`:26155-26166`, `:18957`, `:19171`).
- **Sekcja „Wgrywanie pojedyncze (z wymuszonym dostawcą)"** — siatka kafli `upload-tile-{kod}`
  (kod · nazwa · e-mail · „Wgraj plik"), otwierających TEN SAM dialog z wymuszonym dostawcą
  (`:26169-26200`). Kafle renderują WSZYSTKICH dostawców, bez filtrowania i sortowania, jak
  oryginał — dostawcę wyłączonego z importu odrzuca backend, front nie dubluje reguły.
- **Toast po imporcie** odtworzony co do znaku z `:19142-19153`, razem z osobliwością oryginału:
  `odrzuconeBrakDanych` jest sumowane, ale **nigdy nie wyświetlane** — nie „naprawiać" tego
  dopisaniem członu. Błąd wczytania pliku i błąd importu idą toastem `destructive`.
- **Licznik „Wgraj (0)" usunięty.** Oryginał NIE MA licznika w etykiecie; przycisk wyłącza
  wyłącznie warunek „żaden plik nie ma rozpoznanego dostawcy" (`:19161`, `:19171`). Naprawa
  polegała na usunięciu licznika, nie na przeliczeniu go inaczej.
- Bez zmian, zgodnie z założeniem: podgląd 5 pozycji dalej z odpowiedzi backendu (decyzja 3f-1),
  endpointy, limit 50 MB, CSV+XLSX.

⭐ **ROZSTRZYGNIĘTE: wariant „Importuj do katalogu" (`:19171`) to MARTWA GAŁĄŹ — nie portowany.**
Propsy `prostoDoKatalogu` i `buttonLabel` istnieją w deklaracji dialogu `Cd` (`:18853-18855`), ale
`Cd` jest w CAŁYM bundlu wołane dokładnie dwa razy (`:26157`, `:26190`) i żadne z wywołań ich nie
przekazuje; `prostoDoKatalogu` domyślnie `false`, a trzeci argument `sP(e,t,n)` nie jest w ciele
funkcji nawet czytany (`:18821`). Etykieta w produkcji zawsze brzmi „Importuj do staging".

**Zweryfikowane przy okazji:** żywy bundel `index-PRICEFMT1783512500.js` jest dla bloków `JT` i `Cd`
**znak w znak zgodny z deminifikatem z 13.08** (porównane bloki + liczniki wszystkich
charakterystycznych stringów). Żadna z czterech łatek FE tej zakładki nie ruszała, więc ostrzeżenie
o nieaktualnym deminifikacie (wyżej) dla TEJ zakładki nie obowiązuje.

**Nowy plik:** `src/pages/konfiguracja/DialogWgrywania.tsx` (port `Cd()`) — jeden dialog obsługuje
oba wejścia. `detekcja.ts` i `wgrywanie.ts` nie wymagały zmian; `wymusDostawce` już ustawiało
dokładnie to, co `:18868`.

**Świadome odstępstwa (zatwierdzone przez użytkownika w Q&A karty):** wynik importu z podglądem
5 pozycji renderuje się w sekcji „Ostatni import" POD kaflami, a nie w dialogu — oryginał pokazuje
podgląd PRZED wysłaniem z parsowania w przeglądarce, którego odbudowa nie robi (3f-1), więc podgląd
powstaje dopiero z odpowiedzi backendu; sam dialog zachowuje się 1:1 (po sukcesie zamyka się
i czyści listę). Teksty o formatach mówią „CSV i XLSX … do 50 MB" zamiast oryginalnego
„CSV … do 10 MB", bo odbudowa realnie przyjmuje XLSX i 50 MB.

⚠ **Luka w siatce bezpieczeństwa, wykryta przy tej karcie, NIE naprawiona:**
`POST /api/dostawcy/{kod}/upload` **nie ma fixture** — `contract/openapi.yaml:19314-19328` deklaruje
`200` bez schematu, a w `contract/fixtures/` nie ma żadnego pliku uploadu (multipartu nie dało się
nagrać `tools/record-write-fixtures.cjs`). Kształt odpowiedzi — od którego zależy cały toast — jest
wiążąco znany tylko z kodu (oryginał `backend-index.cjs:48277-48281` ≡ port `suppliers.ts:213-221`).
14a nie mogła tego ruszyć (`contract/` jest wspólne dla BE i FE, nauka z 13c). **Do osobnej karty.**

**14b — Staging** [FE] — ✅ zrobione 2026-09-18 (`51-FEATURE-staging-filtr-pasek-kolumny`).
Cztery pozycje pierwotnego zakresu dowiezione:
- **Filtr domyślny wrócił na `useState("nowa")`** = „Nowe produkty" (D1). Skutek: „Akceptuj/Odrzuć
  wszystkie (N)" domyślnie liczy i wysyła tylko pozycje typu `nowa`; żeby ruszyć cały staging, trzeba
  świadomie przestawić „Typ sprawy" na „Wszystkie" — to zachowanie produkcji, chroni przed masowym
  zatwierdzeniem błędów i wycofań jednym kliknięciem.
- **Konfigurator kolumn („Kolumny") wchłonięty jako komponent React** w `pages/staging/`
  (`KonfiguratorKolumn.tsx`, `kolumny.ts`) — wzorzec z `freq-injection.js` → `Dostawcy.tsx` (3f-2):
  układ, teksty i semantyka trzech skrótów („Wszystkie"/„Domyślne"/„Żadna") 1:1, warstwa manipulacji
  DOM-em znika (D8, D9). Ustawienia w `localStorage`, klucz `bridge_staging_cols_v2` (D5, tak jak
  oryginał — nie IndexedDB jak konfigurator katalogu).
- **Placeholder szukajki** poprawiony na „Szukaj po kodzie, nazwie, dostawcy lub EAN..." (dosłownie,
  z trzema kropkami ASCII).
- **Pasek akcji złożony w jeden rząd** wg `fe.js:20707-20770`: szukajka → „Typ sprawy" → licznik
  „N zmian" → „Akceptuj/Odrzuć zaznaczone (N)" (tylko przy zaznaczeniu) → „Kolumny" → „Akceptuj/Odrzuć
  widoczne"; „Akceptuj/Odrzuć wszystkie (N)" w nagłówku karty.

**Dwa rozjazdy, których pierwotny opis tego bloku NIE MIAŁ, a karta naprawiła (wykryte rozpoznaniem,
nie z tego opisu):**
- **Kolejność kolumn tabeli** — `Magazyn` wrócił z 9. na 6. pozycję, zaraz za `Dostawca`, bo
  konfigurator mapuje kolumny POZYCYJNIE przez `POS_KEYS` (`fe.js:29156`) — rozjazd kolejności
  nie był wyłącznie kosmetyką, tylko psuł mapowanie widoczności (D2).
- **Nagłówek kolumny** wrócił z „Powód / co sprawdzić" na „Powód" (D2).

Do tego, też poza pierwotnym opisem: nagłówek widoku wyrównany do oryginału — tytuł
„Staging — zmiany do akceptacji", podtytuł „Do decyzji Marty trafiają tylko nowe, wycofane, błędne
i kluczowo zmienione pozycje..." (D6); warianty przycisków masowych 1:1 — „Akceptuj wszystkie (N)"
`variant="default"` + ikona `Check`, „Odrzuć wszystkie (N)" `variant="outline"` + ikona `X`, czerwony
`destructive` znika (D7). Bezpiecznikiem zostaje `DialogPotwierdzenia`, którego oryginał w ogóle nie
ma — zastane odstępstwo z 12e (backlog #51), poza zakresem tej karty.

⚠ **Pułapka `data-testid`, wpływa na to GDZIE realnie ląduje przycisk „Kolumny":** w oryginale
`data-testid` przycisków masowych są semantycznie ZAMIENIONE względem odbudowy — „Akceptuj wszystkie
(N)" w nagłówku ma tam `button-accept-selected`, a „Akceptuj widoczne" w pasku ma `button-accept-all`.
Enhancer wstrzykuje przycisk „Kolumny" przed `button[data-testid="button-accept-all"]`
(`:29317-29334`), co w oryginale znaczy PASEK, przed „Akceptuj widoczne" — nie nagłówek, jak
sugerowałaby nazwa czytana wprost. **Decyzja D4: `data-testid` w odbudowie ZOSTAJĄ w konwencji
odbudowy** (niezamienione) — świadome odstępstwo, bo atrybut jest niewidoczny dla użytkownika,
a wierność utrwaliłaby mylącą nazwę w naszym kodzie.

**Deminifikat tu WIARYGODNY**, mimo ostrzeżenia o bundlu z 13.08 wyżej w bloku: `STAGING_COLS`
i `POS_KEYS` w ŻYWYM bundlu (`main:mirror/frontend/assets/index-PRICEFMT1783512500.js`) są bajt
w bajt identyczne z `deminified/frontend-index.js` — żadna z czterech łatek FE Ani tego enhancera
nie tknęła.

**GATE odbudowy: N/D** — `contract/`, `contract/fixtures/` i `rebuild/backend/` poza diffem gałęzi;
jedyna zmiana w wywołaniach API to WARTOŚĆ `typZmiany` w pierwszym żądaniu (`all` → `nowa`), legalna
w enumie od zawsze. Bramki FE zielone: `lint`/`typecheck`/`build`/`test` **762/762 w 48 plikach**
(przed kartą 751).

⚠ **Dwie zmiany widoczne dla Ani, do uprzedzenia przy przeglądzie 12 widoków** (obie odtwarzają
produkcję, nie regresja): **(1)** ekran startuje z filtrem „Nowe produkty" — patrz D1 wyżej;
**(2)** kolumny „Stan", „Cena zakupu" i „Cena sprzedaży" są DOMYŚLNIE UKRYTE, bo jako jedyne kolumny
tabeli nie mają `def:true` w `STAGING_COLS` — włącza się je przyciskiem „Kolumny".

Reset strony przy zmianie rozmiaru strony ZOSTAJE (bez zmian w tej karcie) — świadome odstępstwo
z 3e, opisane Ani w **§3.3, linia 95** instrukcji (sprostowanie referencji: dokument kończy się na
§8, „§9.3" nie istnieje; sama decyzja niezmieniona).

**14c — karta dostawcy** [FE]. **Zrobione 2026-09-18, `50-FEATURE-i14c-karta-dostawcy-upload`.**
Zakres faktycznie dowieziony:
- **Przycisk „Wgraj plik" na kartach dostawców** — dodany w `Dostawcy.tsx` dla
  `sposobDostarczania ∈ {upload, mail}`: ukryty `<input type="file" accept=".csv,.xml,.xlsx">`,
  `FormData` z polem `plik`, `POST /api/dostawcy/{kod}/upload`, po sukcesie toast „Plik wczytany",
  unieważnienie `["/api/dostawcy"]` + `["/api/staging"]` (nie `["/api/suppliers"]` jak w oryginale —
  odbudowa pobiera ten ekran innym kluczem, komentarz w kodzie). Zweryfikowane bajt w bajt z żywym
  bundlem `mirror/frontend/assets/index-PRICEFMT1783512500.js:25690-25802`.
- **NIE reużyto `DialogWgrywania.tsx` z 14a** — oryginał ma na karcie dostawcy WŁASNY,
  samodzielny upload (`:25756-25802`), a nie wspólny dialog zakładki „Wgrywanie ręczne".
  Klient multipart siedzi więc wprost w `Dostawcy.tsx`. Druga przyczyna: `dostawcy.ts` nie był
  w tabeli własności 14c (patrz wyżej), a `wgrywanie.ts` należy do 14a — duplikat jest
  wymuszony rozłącznością kart i czeka na scalenie po zmergowaniu obu.
- **Pole „liczba minut" schowane za „Inna wartość (minuty)…"** — reguła widoczności 1:1 z
  `freq-injection.js:138-147`. Dostawca bez harmonogramu startuje na „Inna wartość" z pustym
  polem, NIE na „5 min" jak dałoby dosłowne 1:1 (**D5**, patrz niżej).
- **Etykieta przycisku synchronizacji zmieniona na „Synchronizuj"** — FAKT, nie „do sprawdzenia":
  żywy bundle (`grep -o 'Synchronizuj[a-zęą ]\{0,10\}'` na
  `mirror/frontend/assets/index-PRICEFMT1783512500.js`) ma jedno trafienie, `Synchronizuj`, zgodnie
  z deminifikatem. „Synchronizuj teraz" było tylko w odbudowie.
- **Dialog admina (`DialogKonfiguracjiDostawcy.tsx`) BEZ ZMIAN funkcjonalnych** — decyzja **D3**:
  zostaje surowe pole „Częstotliwość (minuty)", bez selectu presetów, bo to osobna trasa
  (`PATCH /api/admin/supplier-config/{kod}`) o innej semantyce (rozróżnia „nie ruszaj" od „wyczyść"
  przez `hasOwnProperty`, select by to popsuł) i w oryginale nie ma dla niej żadnego React UI.
  Utrwalone komentarzem w kodzie + testem-strażnikiem (`konfiguracja.admin.test.tsx`).

Trzy zatwierdzone odstępstwa od oryginału (pełne uzasadnienia:
`docs/tickets/50-FEATURE-i14c-karta-dostawcy-upload/plan.md`, sekcja Decisions):
- **D1** — toast uploadu czyta realne pola `nowe`/`zmienione`, nie `nowych`/`zmian` jak oryginał.
  Oryginalny bundle woła pola, których trasa `POST /api/dostawcy/:kod/upload` nigdy nie zwracała
  (`tk()` daje `nowe`/`zmienione`/`wycofane`/…), więc produkcja od zawsze wyświetla „undefined
  nowych, undefined zmian" — naprawa zamiast odtworzenia buga.
- **D5** — dostawca bez `czestotliwoscMinuty` startuje na „Inna wartość" z pustym polem, nie na
  „5 min" (co dałoby dosłowne 1:1 z `freq-injection.js:138-147`, bo żadna gałąź reguły nie ustawia
  `select.value`, gdy `currentMin` jest null/0). Powód: formularz odbudowy zapisuje cztery pola
  karty naraz, więc „5 min" jako wartość startowa po cichu włączyłoby polling przy zapisie
  DOWOLNEGO innego pola karty.
- **D6** — `<input type="file">` jest czyszczony po wysyłce (oryginał tego nie robi) — inaczej
  wgranie tego samego pliku drugi raz z rzędu nie wywołuje `onChange` i UI wygląda zawieszone.

**14d — aktualizacja instrukcji testów** [DOCS] — ✅ **ZROBIONE 2026-09-18**, ticket
`56-DOCS-instrukcja-testow-i14`. Weszło PO zmergowaniu 14a/14b/14c (zweryfikowane na
`origin/develop` 4cd5cd9 przed startem).

**Co faktycznie dowiezione** (różni się od pierwotnego zamiaru — patrz decyzja D1 niżej):
- **Nowy plik `docs/instrukcja-testow-I3-v2.md`** — **JEDEN dokument** (nie „I14"; nazwa to
  decyzja użytkownika: dla Ani to druga wersja instrukcji, którą wypełniała, a nie nowa
  iteracja). Zawężony wyłącznie do jej uwag; **wyjaśnienie i kroki są w tej samej pozycji**,
  bo rozdzielenie ich na dwa pliki (instrukcja + scenariusze) zostało odrzucone przez
  użytkownika jako niewygodne w przekazaniu.
  Układ: 0 przygotowanie i pliki testowe · **1–3 trzy ekrany po 14a/14b/14c** · 4 dwa dziwactwa
  naprawione · 5 „czego NIE zgłaszaj ponownie" · 6 test rozstrzygający · 7 podsumowanie
  · 8 jak zgłosić. **Każda pozycja ma pięć części:** „Zgłosiłaś" → „Jak to naprawiliśmy"
  (wyjaśnienie) → „Sprawdź" (ponumerowane kroki) → „Ma się stać" → **„Twoja ocena"**
  (☐ OK ☐ ŹLE + miejsce na uwagi). Osiemnaście pozycji do odhaczenia, zebranych w tabeli w §7.
  **Świadomie NIE ma** rozdziałów „Co jest nieaktualne w I3" i „Czego jeszcze NIE MA" —
  to materiał meta, nie zadanie testowe; pierwszy zastąpiony bannerem w samym I3.
  **Plik `docs/instrukcja-testow-I14.md` ani `scenariusze-testow-I14.md` NIE ISTNIEJĄ** —
  były wersjami pośrednimi w trakcie tej karty, scalonymi do jednego pliku.
- **`docs/instrukcja-testow-I3.md` — TYLKO banner** na górze, kierujący do v2 i wymieniający
  zdezaktualizowane sekcje. **Treść I3 nietknięta**, w szczególności 9 wystąpień „Synchronizuj
  teraz" ZOSTAJE w I3 (konwencja I13: „starsze instrukcje zostają bez zmian, wierz tej kartce").
- `docs/rebuild-backlog.md` — **bez zmian**, patrz sprostowanie niżej.

**⭐ DECYZJA UŻYTKOWNIKA (2026-09-18) — DELTA JEST FORMATEM DOCELOWYM instrukcji testów.**
Obowiązuje od teraz dla KAŻDEJ kolejnej iteracji, nie tylko dla I14. Z tego wynika:
- instrukcja iteracji zawiera **wyłącznie to, co Ania zgłosiła i ma zweryfikować** — nie
  powtarza scenariuszy, które już przeszły i których nie reklamowała;
- **starszych instrukcji się nie przepisuje** — dostają banner „częściowo nieaktualne, patrz
  I<n>" i zostają jako zapis stanu z danej daty;
- **temat odtworzenia 17-rozdziałowej wersji Ani jest ZAMKNIĘTY** — nie robimy tego; rozjazd
  przestaje być długiem, bo pełny przewodnik przestał być formatem docelowym.

**Decyzja D1 (2026-09-18) — droga do powyższego.** Rozważane: (A) aktualizacja 8-rozdziałowej
wersji w repo, (B) odtworzenie w repo 17-rozdziałowej wersji Ani. **Wybrane: ani A, ani B —
osobna delta I14**, a następnie (po przeglądzie pierwszej wersji) **zawężona wyłącznie do uwag
Ani**: z dokumentu wypadły rozdziały „Co jest nieaktualne w I3" i „Czego jeszcze NIE MA"
jako materiał meta, a każda pozycja dostała układ **„Zgłosiłaś → Jest teraz → Sprawdź"**.
Osiem rozdziałów zamiast trzynastu.

⚠ **FAKT sprostowany — numeracja w tym opisie pochodziła z wersji, której w repo NIE MA.**
`docs/instrukcja-testow-I3.md` w gicie ma **8 rozdziałów** (494 linie, 2026-09-01). Wersja, którą
Ania wypełniała (2026-09-02, 17 rozdziałów, ze ściągą dostawców i rozdziałami „Świadome
ODSTĘPSTWA" / „Dziwactwa ODTWORZONE CELOWO") **nigdy nie trafiła do repozytorium**. Dlatego
odwołania „rozdz. 12 pkt 12/13" i „rozdz. 13" z poprzedniej wersji tego opisu **nie mają
odpowiednika w repo**. Zweryfikowane grepem:
- WULSTBAND, `nro`/`cho`, test rozstrzygający, rozdz. „Świadome ODSTĘPSTWA", ściąga dziesięciu
  dostawców — **zero trafień w wersji repo**;
- „zapis naukowy" jest rozdz. **4 poz. 4**, status dostawcy rozdz. **4 poz. 11** (nie 10);
- rozdz. 4 ma **11 pozycji, nie 13**; „Czego jeszcze NIE MA" to rozdz. **5**.

⚠ **SPROSTOWANIE — backlog #9 i #10 NIE wymagały rozliczenia przez 14d.** Poprzednia wersja
tego opisu mówiła „Backlog #9/#10 do rozliczenia"; to było **błędne założenie**. Oba wpisy są
zamknięte od **2026-09-08**: fix Ani z 01.09 sportowany i **POTWIERDZONY POMIAREM** w
`42-CHORE-i13a-resync-parserow` (`nro` `1`→`'Tak'`, `0`→`null` — MO1 199, MO3 44, MO9 12 rek.;
MO1 `odrzuconePrzezAdapter` 1→0 przy tych samych 199 kodach). 14d **niczego w backlogu nie
zmieniała** — tylko opisała naprawę Ani w instrukcji (v2 rozdz. 4).

**Rozliczenie uwag przekazanych przez 14a/14b/14c** (wszystkie trafiły do v2, rozdz. 1–3):
- **14a:** nowy przepływ „Wgraj pliki" → modal → „Importuj do staging" → toast; druga ścieżka
  przez kafel dostawcy; brak licznika na przycisku importu; podgląd PO imporcie, nie przed.
  `data-testid` **świadomie pominięte w instrukcji** — Ania klika po etykietach, nie po testidach.
- **14b:** domyślny filtr `nowa` i konsekwencja dla „Akceptuj/Odrzuć wszystkie (N)"; trzy kolumny
  domyślnie ukryte + przycisk „Kolumny"; martwa sekcja „Dodatkowe (z katalogu)".
  Sprostowanie liczbowe: sekcja „W tabeli stagingu" ma **10 przełączników** (7 widocznych
  + 3 ukryte), nie 9 — policzone w `pages/staging/kolumny.ts` (12 kolumn tabeli minus
  `checkbox` i `akcje`, które są `zablokowana`).
- **14c:** „Synchronizuj" zamiast „Synchronizuj teraz"; przycisk „Wgraj plik" przy
  `upload`/`mail`; pole minut za „Inna wartość (minuty)…", puste po przełączeniu z presetu.

**⚠ AUDYT 14d — etykieta „Synchronizuj teraz" żyje jeszcze w TRZECH dokumentach poza własnością
tej karty.** `grep -rn "Synchronizuj teraz" docs/` (bez `docs/tickets/`) daje sześć wystąpień:
`instrukcja-testow-I6.md:49,50,58,125` · `instrukcja-testow-I10.md:56` ·
`przeglad-12-widokow.md:198`. **Najpilniejszy jest I6** — to instrukcja scenariuszowa, której
krok „kliknij Synchronizuj teraz jeszcze cztery razy" jest nie do wykonania pod nazwą, której
nie ma na ekranie. 14d nie mogła ich ruszyć (zamknięta lista własności plików + równoległe karty).
Czyste, sprawdzone: `spec-frontend.md`, `spec-backend.md`, `cutover.md`.

**⚠ Do rozliczenia przez kartę zamykającą DRUGĄ FALĘ I14 (nie przez 14d):**
`docs/instrukcja-testow-I4.md` jest **nietknięta i częściowo nieaktualna** — decyzje Ani
unieważniły jej rozdziały 4 i 5. **14i (EAN w notacji naukowej) jest zrobiona** (`58-FEATURE-i14i-ean-naukowy-pusty`,
2026-09-18) i znika jako blokada; zostaje zależność wyłącznie od **14f** (daty promocji), która
w chwili zamykania 14d jeszcze nie ma. 14d celowo jej nie ruszała (ograniczenie własności plików).
Karta domykająca falę 2 powinna zrobić dla I4 to, co 14d zrobiła dla I3: deltę + banner.

---

#### Druga fala I14 — uwagi Ani z testów Iteracji 4 (karty 14e–14i)

- **Skąd.** Ania wypełniła `docs/instrukcja-testow-I4.md` (silnik cen: narzuty i promocje).
  **Osiem z jedenastu scenariuszy wyszło „działa prawidłowo"**, w tym oba oznaczone gwiazdką
  (symulator zgadza się z katalogiem, reguła szczegółowa bije globalną, reguła nadpisuje cenę
  wpisaną ręcznie w stagingu). Zostały dwie decyzje, jedno zgłoszenie i jedna prośba o funkcję.
- **Decyzje Ani z 2026-09-18** (odpowiedzi na pytania wysłane po testach) — zapisane też
  w `docs/rebuild-backlog.md` przy wpisach #11/#19/#22/#25:
  - **Usuwanie reguły MA pytać o potwierdzenie** (§3.6). Jej pierwotny wpis precyzuje: razem
    z informacją, ilu produktów dotyczy zmiana. Liczbę da się policzyć po stronie klienta —
    ten sam materiał, z którego liczy się ostrzeżenie „poniżej kosztu". To ŚWIADOME ODSTĘPSTWO:
    oryginał kasuje bez pytania.
  - **Przełącznika statusu przy promocjach NIE dokładamy** (§3.9, pytanie o wyłączanie ręczne):
    „zostawiamy tak jak obecnie działa, promocje po prostu się usuwa".
  - **Globalnej promocji NIE naprawiamy i nie blokujemy** (backlog #25): „nie, zostawiamy tak
    jak jest, nie dodajemy nowych reguł". Pułapka zostaje odtworzona 1:1, bez blokady w UI.
  - **Komunikat po edycji reguły — Ania zdecydowała, że różnica jej nie interesuje** (§3.11):
    „dodana czy zaktualizowana to nie ma różnicy, zostaw to tak jak jest". Wątek zamknięty bez
    kodu — i słusznie: pomiar 14e potwierdził, że §3.11 starej instrukcji mówi PRAWDĘ, defektu
    nigdy nie było. Komunikat po edycji brzmi „Reguła zaktualizowana" (przy promocji „Promocja
    zaktualizowana"), zgodnie z `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:270-282`;
    potwierdzone testem `rebuild/frontend/test/narzuty.edycja-toast.test.tsx` (11/11 zielone,
    `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md:160-173`). Ustalone dopiero przy
    karcie **65-DOCS-instrukcja-testow-i4-v2** (2026-09-19) — do tego czasu roadmapa błędnie
    sugerowała, że komunikat po edycji nadal brzmi „Reguła dodana".
  - **EAN w notacji naukowej ma trafiać do katalogu jako PUSTE pole** (backlog #11). To
    rozstrzyga wpis, który od 26.08 czekał na jej decyzję, i jest ŚWIADOMYM ODSTĘPSTWEM —
    produkcja zapisuje wartość i wypisuje komunikat „zapis naukowy ma tylko null cyfr znaczących".
  - **Kolumna „Promocja" w katalogu jest POTRZEBNA** (backlog #22): „mają się wyświetlać
    aktualne promocje dla danych produktów".
- ⚠ **Sprostowanie do #22, zmierzone 2026-09-18.** Ania pamięta, że kolumna „działała w starym
  Bridge" i przypuszcza, że nadpisał ją któryś backup. **Kod tego nie potwierdza w żadnej
  wersji, którą mamy:** pole `_reguly.promocja` ma DOKŁADNIE JEDNO wystąpienie w żywym bundlu
  produkcji (`mirror/frontend/assets/index-PRICEFMT1783512500.js`) — miejsce ODCZYTU — i ani
  jednego w żywym backendzie (`mirror/backend/index.cjs`; dwa trafienia `grep -o "_reguly"` to
  substring kolumny `dodatkowe_reguly` ze `spedycja_limity`, nie to pole). `git log -S'_reguly:'
  --all` nie zwraca ANI JEDNEGO commita od baseline'u 13.08 po 18.09. Wniosek: karta 14h to
  **nowa funkcja i świadome odstępstwo**, a nie przywrócenie czegoś, co się zepsuło — i tak
  trzeba ją wycenić i opisać Ani, żeby nie liczyła na „powrót do stanu sprzed backupu".
- ⭐ **ROZSTRZYGNIĘTE 2026-09-18 (backlog #19): DATA MA NAPRAWDĘ KOŃCZYĆ PROMOCJĘ.** Pierwsza
  odpowiedź Ani była rozbieżna z jej wpisem w instrukcji, bo pytanie było zbyt otwarte; zadane
  ponownie — z opisem stanu faktycznego („po dacie końca promocja nadal obniża ceny") — dało
  jednoznaczne: *„data ma naprawdę kończyć promocje"*. **To NAJDROŻSZA pozycja I14 i jedyne
  świadome odstępstwo, które rusza silnik cen.**
- **Kierunek do wyceny w 14e, NIE przesądzony.** Są dwie drogi i różnią się kosztem o rząd
  wielkości:
  **(a) silnik czyta daty** — `promocjaPasuje` dostaje warunek na `start`/`koniec`. Proste w kodzie,
  ale zmienia zachowanie funkcji porównywanej z oryginałem, więc **wymaga wyjątku w charakteryzacji**
  (koszt opisany w `repos/ceny.ts:108-116`).
  **(b) wygaszacz statusu** — osobny krok przestawia w bazie `status` na `zakonczona`, gdy minęła
  data końca (na starcie i przy każdym przeliczeniu cen), a silnik zostaje NIETKNIĘTY i dalej
  patrzy wyłącznie na `status`. Charakteryzacja zostaje nienaruszona, bo funkcja zachowuje się
  identycznie jak w oryginale — zmieniają się DANE, które dostaje. Dodatkowo (b) naturalnie
  spełnia to, co Ania opisała słowami „reguła znika po końcu obowiązywania": wiersz dostaje status
  `zakonczona` i przestaje obniżać ceny.
  **Rekomendacja: (b)**, o ile 14e nie wykaże przeciwwskazań.
- ⭐ **DECYZJA UŻYTKOWNIKA 2026-09-18 — WARIANT (b), TRZY ROZSTRZYGNIĘCIA NARAZ.** Podjęta po
  przedstawieniu wyceny z 14e; wszystkie trzy zgodne z rekomendacją:
  1. **Wariant (b) — wygaszacz przestawia `status`.** Silnik NIETKNIĘTY, dalej patrzy wyłącznie
     na `status`; zmieniają się DANE, nie zachowanie porównywanej funkcji. Zero wyjątków
     w wyroczni (0 scenariuszy z 31 kontra 1 przy wariancie (a)).
  2. **Wygaszacz chodzi RÓWNIEŻ CYKLICZNIE**, nie tylko przy starcie i przy mutacji reguł.
     Powód: bez tego zostaje okno, w którym wygasła promocja **nadal obniża cenę przy każdym
     imporcie** — a importy chodzą co godzinę u pięciu dostawców, więc okno realnie sięga dni.
     ⚠ **14f ma to NAJPIERW ZMIERZYĆ, nie założyć:** potwierdzić, że wariant cykliczny faktycznie
     nie wchodzi w ścieżkę charakteryzacji. Gdyby wchodził — wrócić do użytkownika, a nie
     „po cichu" rezygnować z cykliczności albo z wierności.
  3. **`status` zostaje ODCIĘTY od `POLA_EDYTOWALNE_PROMOCJI`** (`repos/promotions.ts:29-38`).
     Powód: po (b) `status` jest polem WYLICZANYM, więc zostawienie go edytowalnym znaczyłoby,
     że wygaszacz nadpisuje ręczne ustawienia użytkownika bez ostrzeżenia.
  ⚠ **Skutek dla instrukcji:** rada „żeby naprawdę wyłączyć promocję, zmień jej status" przestaje
  obowiązywać — po 14f promocję wyłącza data albo usunięcie. **14f ✅ dowiozła to 2026-09-19.**
  Sprostowanie instrukcji: **14m** ✅ `65-DOCS-instrukcja-testow-i4-v2` · 2026-09-19.
- **Skutek uboczny dla 14f:** pomarańczowy znacznik rozbieżności (`rozbieznoscStatusu`, dodany
  w 4b jako D5) traci rację bytu w wariancie (b) — etykieta z dat i kolumna `status` przestaną
  się rozjeżdżać. Znacznik należy usunąć ŚWIADOMIE i odnotować, a nie zostawić jako martwy kod.
  **✅ Usunięty w 14f** — znacznik NIE ISTNIEJE już w `status.ts`/`TabelaPromocji.tsx`.
- **Zamknięte tą samą turą odpowiedzi (2026-09-18):**
  - **§3.7 nie jest błędem cen** — Ania: *„tylko się nie wyświetlało, cena się oblicza
    prawidłowo"*. Zadanie A karty 14e (polowanie na defekt w dopasowaniu promocji) jest
    **bezprzedmiotowe**; zostaje wyłącznie wycena z punktu wyżej.
  - **Kolumna „Promocja" — potwierdzona do zrobienia** (*„dodaj regułę wypełniania kolumny
    promocja"*). Ania nie odniosła się do ustalenia, że kolumna nigdy nie działała — przyjmujemy,
    że akceptuje to jako nową funkcję (karta 14h).
  - **Potwierdzenie usuwania reguły ma podawać liczbę produktów** (*„pokazuj ilu produktów ma
    dotyczyć zmiana"*) — zakres 14f przesądzony, bez wariantu minimalnego.

**Karty drugiej fali.** Klaster `/narzuty` jest mały i gęsty, więc rozłączność wymusza inny
podział niż w pierwszej fali; poniżej własność plików, która gwarantuje pracę równoległą.

| Karta | Zakres | Pliki (wyłączna własność) | Testy |
|---|---|---|---|
| **14e** | ⚠ ZAKRES ZAWĘŻONY 19.09: wycena #19 — wariant (a) czy (b), z liczbami. Zadania „czy promocja obniża ceny" i „komunikat po edycji" ZAMKNIĘTE odpowiedziami Ani | `docs/tickets/<N>/**`, ewentualny NOWY test w `rebuild/backend/test/` | — |
| **14f** | ✅ **ZROBIONE 2026-09-19**, `64-FEATURE-i14f-daty-koncza-promocje`. Wariant (b) dowieziony: NOWY `src/promocje/wygaszacz.ts` przestawia `status` z dat w OBIE strony (start procesu + wejście `przeliczCenyZRegul` + cyklicznie co `PROMO_WYGASZACZ_MINUTY`, domyślnie 5 min, `0` wyłącza) — silnik (`promocjaPasuje`) NIETKNIĘTY, charakteryzacja zielona bez wyjątku (0 z 31 + 0 z 17). `status` odcięty od `POLA_EDYTOWALNE_PROMOCJI` (7 pól), `dodajPromocje` liczy go z dat. Znacznik rozbieżności i stara nota w dialogu usunięte/przepisane. Usuwanie narzutu I promocji pyta o potwierdzenie z liczbą dotkniętych produktów, liczoną silnikiem `wybierzNarzut`/`wybierzPromocje` (nie matcherem ostrzeżenia) | BE: NOWY `src/promocje/wygaszacz.ts`, `repos/ceny.ts`, `repos/promotions.ts`, `config/env.ts`, `server.ts` · FE: `narzuty/TabelaNarzutow.tsx`, `narzuty/TabelaPromocji.tsx`, `narzuty/status.ts`, `narzuty/ceny.ts`, `narzuty/DialogReguly.tsx` | BE: `test/wygaszacz.test.ts` (27) + `test/narzuty.patch.test.ts` · FE: `test/narzuty.test.tsx`, `test/narzuty.ceny.test.ts`, `test/narzuty.dialog.test.tsx` |
| **14m** | ✅ **ZROBIONE 2026-09-19**, `65-DOCS-instrukcja-testow-i4-v2`. Delta dla Ani: nowy `docs/instrukcja-testow-I4-v2.md` (§4 pkt 6/1/5/8, §3.6, §3.9, rada „zmień status" sprostowane, plus §5 rozliczone i sygnał o nadal otwartej „edycji priorytetu reguły z formularza") + wyłącznie banner w `docs/instrukcja-testow-I4.md` — domyka FALĘ 2 I14 i całą Iterację 4 | `docs/instrukcja-testow-I4.md`, NOWY `docs/instrukcja-testow-I4-v2.md` | — |
| **14h** | ✅ **ZROBIONE 2026-09-18**, `61-FEATURE-promocja-kolumna-katalog`. Kolumna „Promocja" w katalogu — NOWA funkcja: `GET /api/products` dokłada opcjonalny `_reguly.promocja` (`{wartosc, nazwa}`) przez istniejące `wybierzPromocje`/`promocjaPasuje` z `repos/ceny.ts` (silnik NIETKNIĘTY, zakres 14f). Karta okazała się czysto backendowa — renderer, piker i typ `Produkt` na FE już były gotowe od 4b | BE: `repos/products.ts` (`dolaczReguly`), `routes/products.ts`, `contract/openapi.yaml` (komentarz nad ścieżką, bez węzła schematu) | BE: `test/katalog.promocja.test.ts` + nowy strażnik w `test/katalog.gate.test.ts` · FE: 2 nowe przypadki w `test/katalog.formatowanie.test.tsx` |
| **14i** | ✅ **ZROBIONE 2026-09-18**, `58-FEATURE-i14i-ean-naukowy-pusty`. EAN w notacji naukowej → puste pole w katalogu | BE: zapis do katalogu (akceptacja), `src/import/akceptacja.ts` | `test/akceptacja.odstepstwa.test.ts` + bramki charakteryzacji (nietknięte) |
| **14j** ✅ | Automatyczne porównanie Historii z oryginałem — zastępuje niewykonany test §9 z I5. Karta POMIAROWA, zero kodu produkcyjnego | `docs/tickets/59-*/**` · NOWY `rebuild/backend/test/historia.wyrocznia.*` · backlog (tylko #87) | `test/historia.wyrocznia.test.ts` (13 przypadków) |

- **14g SKASOWANA** — obie jej pozycje (globalna promocja, komunikat po edycji) Ania zamknęła
  decyzją „zostaw jak jest". Litery nie przenumerowujemy, żeby nie rozjechać się z promptami,
  które już poszły do sesji.
- **Równoległość:** 14e ∥ 14f ∥ 14h ∥ 14i — zero wspólnych plików; wszystkie cztery są też
  rozłączne z 14a/14b/14c z pierwszej fali. **14i NIE ruszyła `contract/` w ogóle** (decyzja
  użytkownika, `58-FEATURE-i14i-ean-naukowy-pusty` D4), więc zakładana kolizja z 14h w
  `contract/openapi.yaml` była bezprzedmiotowa. **14h ✅ potwierdziła to w praktyce** — dotknęła
  kontraktu wyłącznie komentarzem nad `/api/products` (D4, `61-FEATURE-promocja-kolumna-katalog`),
  zero `contract/fixtures/`.
- **14i skorygowała własne przypisanie zakresu (D5, zmierzone grafem wywołań).** Cięcie stoi
  w `akceptacja.ts` (zapis do katalogu), nie w silniku normalizacji EAN — `tk.ts:302-305`
  dopasowuje pozycję do produktu w katalogu po `znormalizowana.ean`, więc zerowanie EAN-u przy
  normalizacji zerwałoby to dopasowanie (klasyfikacja „nowa" zamiast „zmiana_kluczowa", ryzyko
  duplikatu w katalogu; dowodzi tego `silnik.gate.test.ts`, „dopasowanie po EAN ZNORMALIZOWANYM").
  **14i nie ruszyła silnika ani charakteryzacji** — 0 scenariuszy, 0 testów, 0 fixtures dotkniętych;
  `test/charakteryzacja/silnik/scenariusze.expected.json` jest zamrożony i nagrywany skryptem,
  który uruchamia żywy oryginał (nie zna decyzji Ani), więc „przenagranie wzorców" było
  niewykonalne i nie było potrzebne.
- **Follow-up z 14i (nierozliczone):** `GETProducts200ItemsPozycja.ean` w `contract/openapi.yaml`
  jest `type: string`, `required`, bez `nullable: true`, mimo że produkcja realnie zwraca `null`
  dla 157 z 7405 produktów w `db/snapshot.db` — artefakt próbkowania fixtures, sprzed 14i, nie
  pogłębiony przez nią; nie da się poprawić ręczną edycją (generator + `kontrakt.spojnosc.test.ts
  --sprawdz`), legalne drogi opisane w `docs/tickets/58-FEATURE-i14i-ean-naukowy-pusty/raport.md`.
  Osobno: `POST /api/products` (bulk, `bulk.ts:71-87`) nie woła `normalizujEan()`, więc decyzja
  Ani (14i) tej trasy nie obejmuje.
- **Ten sam mechanizm rozwiąże też odstępstwo z 14h (`_reguly.promocja`).** 14h opisała
  `_reguly` w `contract/openapi.yaml` KOMENTARZEM nad `/api/products`, nie schematem, bo blok
  `components.schemas` (`:18`–`:18716`) jest generowany wyłącznie z `contract/fixtures/` i
  generator z definicji pomija klucze `_*` (`tools/generate-openapi-schemas.cjs:53,65`) — nie da
  się też „nagrać" pola z oryginału, bo produkcja nigdy go nie wypełnia. Pełne, walidujące
  opisanie (i `ean nullable` wyżej) wymaga rozszerzenia generatora o tabelę świadomych
  odstępstw — **kandydat na jedną, wspólną kartę zamiast dwóch osobnych**. Szczegóły:
  `docs/tickets/61-FEATURE-promocja-kolumna-katalog/plan.md` (D4).
- **Fakty o kontrakcie zweryfikowane empirycznie w 14h, przydatne każdej następnej karcie
  ruszającej `contract/openapi.yaml`:** klucz `schemas:` leży WEWNĄTRZ bloku generowanego, więc
  nie ma w `components.schemas` miejsca na ręczny schemat — dopisanie własnego `schemas:` przed
  znacznikiem KONIEC dałoby zduplikowany klucz YAML; `--sprawdz` porównuje CAŁY plik tekstowo i
  jest realną bramką `npm test` (`rebuild/backend/test/kontrakt.spojnosc.test.ts:112`); komentarz
  nad ścieżką w sekcji `paths` PRZEŻYWA zarówno `--sprawdz`, jak i pełny bieg generatora
  (sprawdzone: kopia pliku → regeneracja → `diff` → bez różnic).
- **14f zależy** od rozstrzygnięcia #19 tylko w jednym punkcie: jeśli daty MIAŁYBY wyłączać
  promocje, `TabelaPromocji.tsx` zmienia się w tej samej karcie. Dlatego 14f startuje po
  odpowiedzi Ani, nie przed.

##### 14j — automatyczne porównanie Historii z oryginałem · ✅ ZROBIONE 2026-09-18 (`59-CHORE-i14j-oracle-diff-historii`)

**Po co była.** Ania przeszła `docs/instrukcja-testow-I5.md` bez ani jednej usterki, ale
zostawiła PUSTE pole przy rozdziale 9 („Porównanie ze starym Bridge" — najcenniejszym teście
iteracji) i przy rozdziale 8 („Szczegóły"). Karta zastąpiła ten test POMIAREM, metodą 14e
(dwa żywe backendy na kopiach tej samej bazy). **Zero kodu produkcyjnego** — `rebuild/backend/src/`
nietknięty.

**Co faktycznie dowieziono** (zakres zgodny z planem, trzy odstępstwa wykonawcze w raporcie):

| Zadanie | Wynik |
|---|---|
| **A — oracle diff** `GET /api/history`, `/meta`, `/paged` | **59/59 przypadków zgodnych · 0 rozjazdów · 49 813 wpisów porównanych**; drugi przebieg z zasianą gałęzią eksportu: 59/59, 0 rozjazdów, 49 846 wpisów |
| **B — ślad po mutacjach** | edycja produktu: **2/2 wiersze `history`**, 0 różnic w treści i w `/paged`; sonda allowlisty (#14/D1): oryginał 1 wiersz, odbudowa 0 |
| **C — backlog** | nowy wpis **#87** (limit `LIMIT_AUDYTU = 5000`) — **✅ zdecydowany (wariant c) i zrealizowany w P5.1** (`69-FEATURE-historia-bez-limitu`, 2026-09-21, blok Iteracja 5) |

**Gate rozliczony:** karta nie rusza kontraktu ani kodu, więc gate w wersji regresyjnej —
`test/historia.gate.test.ts` przechodzi bez zmian. Bramki backendu zielone: **82 pliki,
1262 testy** (przed kartą 1249; +13 to nowy `test/historia.wyrocznia.test.ts`).

**Co ta karta ZOSTAWIA do ponownego użycia:**
- `docs/tickets/59-CHORE-i14j-oracle-diff-historii/oracle-diff-historii.cjs` — gotowy oracle-diff,
  uruchamiany jednym poleceniem; `--zasiew-eksportu` dokłada gałąź eksportu, `--zostaw-piaskownice`
  zostawia katalogi do obejrzenia;
- `rebuild/backend/test/historia.wyrocznia.test.ts` + `historia.wyrocznia.json` — odpowiedzi
  ŻYWEGO oryginału zamrożone w bramkach (270 wierszy `audit_log` + 20 wierszy `history` + 8 pełnych
  odpowiedzi). Chodzi bez oryginału.

**⚠ FAKTY USTALONE POMIAREM — poprawiają to, co wcześniej zakładaliśmy:**
1. **Pułapka „projekcja Drizzle" NIE dotyczy historii.** `listHistory()` oryginału to Drizzle
   (`X.select().from(Wa).orderBy(desc(Wa.data)).all()`, `:44962-44964`), więc oryginał sam oddaje
   camelCase — inaczej niż `GET /api/selly/log`, który jest raw-SQL. Zestaw kluczy porównany
   osobno i identyczny.
2. **Migracje 001–006 nie dotykają `history` ani `audit_log`** — ani DDL, ani DML. Zweryfikowane
   asercją startową (liczba wierszy + `PRAGMA table_info` + min/max/suma `id`), nie założeniem.
3. **Przepis na piaskownicę oryginału wymaga `npm ci`, NIE `npm install`.** `mirror/backend/package.json`
   deklaruje sześć zależności, a lockfile ma ich więcej (m.in. `archiver`). Przy `npm install`
   część tras oddaje 500 z powodu piaskownicy, nie produkcji — kosztowało to jeden fałszywy
   wynik. **Dotyczy każdej przyszłej karty stawiającej oryginał.**
4. **`db/snapshot.db` nie zawiera ANI JEDNEGO wiersza `eksport_csv`, `eksport_shoper`
   ani `import_cennika`** (`audit_log` = 3873 wiersze, z czego 270 rozpoznawanych: 178 `edycja_produktu`
   + 92 `upload_pliku`). Gałąź „eksport" mapowania jest na żywych danych nieosiągalna i wymaga zasiewu.
5. **Odbudowa ZAPISUJE audyt eksportu** (`routes/export-shoper.ts:108,133,171`) — wcześniejsze
   założenie, że tego nie robi, było nieprawdziwe.

**⚠ ZNALEZISKO UBOCZNE — DEFEKT PRODUKCJI, NIE NAPRAWIONY (poza zakresem karty).**
`GET /api/export-shoper` bez `?dostawca=` (eksport wszystkich dostawców do ZIP-a) oddaje
w produkcji **zawsze HTTP 500**. Przyczyna zmierzona, nie wydedukowana: `rV()`
(`deminified/backend-index.cjs:48139`) czyta `ZipArchive` z archivera, a lockfile produkcji
przypina **`archiver@5.3.2`**, który takiego eksportu nie ma (`create, registerFormat,
isRegisteredFormat`) — log procesu: `zip pipeline failed TypeError: oh is not a constructor`,
przy potwierdzonym `archiver w piaskownicy: JEST`. Odbudowa ma `archiver@^8.0.0`, gdzie
`ZipArchive` istnieje, więc **działa** — czyli wierne przepisanie kodu dało zachowanie INNE niż
produkcja, bo różnica siedzi w wersji zależności. Skutek dla Historii: w produkcji nie powstaje
ani jeden wpis `eksport_csv` z tej gałęzi. **Decyzja zapadła 2026-09-18** (D1, karta
`62-DOCS-decyzje-po-i14j`): nie odtwarzamy defektu, zostajemy przy działającej wersji. Karta
domykająca (bramka na zawartość ZIP-a + naprawa wiszącego połączenia przy błędzie w trakcie
strumienia): podblok **P5.2** wyżej w tym pliku (Iteracja 5), `docs/rebuild-backlog.md` #93.

##### 14m — sprostowanie `docs/instrukcja-testow-I4.md` · ✅ ZROBIONE 2026-09-19 (`65-DOCS-instrukcja-testow-i4-v2`, domyka FALĘ 2 I14 i całą Iterację 4)

Zostawione przez **14f** (`64-FEATURE-i14f-daty-koncza-promocje`, ✅ 2026-09-19 — jawne
ograniczenie własności plików w tamtej karcie: `docs/instrukcja-testow-I4.md` poza jej
zakresem). Zrobiła dla I4 to, co 14d zrobiła dla I3 — deltę + banner, metodą 14d (delta jako
format docelowy, „starszych instrukcji się nie przepisuje"): nowy `docs/instrukcja-testow-I4-v2.md`
(598 linii, 8 rozdziałów, 11 punktów z polem oceny) + wyłącznie banner w `docs/instrukcja-testow-I4.md`
(14 wstawek, 0 usunięć, treść starej instrukcji nietknięta).

**Sprostowane wszystkie trzy punkty przewidziane blokiem** — §4 pkt 6, §3.9 i rada „zmień status,
żeby wyłączyć promocję". **Dołożone ponad pierwotny zakres bloku:** §3.6, §4 pkt 1, §4 pkt 5,
**§4 pkt 8** (mówi to samo co §3.6 i też jest nieprawdą — blok go nie wymieniał) i pozycja
checklisty §6 starej instrukcji („Wygasła promocja dalej obniża ceny, a znacznik mówi o tym
wprost").

Co 14f unieważniła w rozdziałach 4 i 5, sprostowane w v2 i w bannerze:
- **§4 pkt 6 — nieprawdziwy.** Twierdzi, że promocja z datą startu w przyszłości od razu obniża
  ceny; po 14f dostaje `status: "zaplanowana"` po stronie serwera i nie obniża niczego.
- **§3.9 przestaje obowiązywać.** Promocja przestawiona na daty z 2020 (koniec w przeszłości) już
  NIE zostaje „aktywna" — wygaszacz (start procesu / wejście `przeliczCenyZRegul` / cyklicznie co
  `PROMO_WYGASZACZ_MINUTY`) przestawia ją na `zakonczona`.
- **Rada „żeby naprawdę wyłączyć promocję, zmień jej status" — usunięta.** `status` przestał
  być polem edytowalnym (`POLA_EDYTOWALNE_PROMOCJI`, 7 pól po 14f); promocję wyłącza teraz
  wyłącznie data albo usunięcie.

**§5 starej instrukcji rozliczone w całości** (tabela w `docs/instrukcja-testow-I4-v2.md` §6.3)
wobec czterech pozycji: 1. kolumna „Promocja" ✅ dowieziona (14h), 2. wyłączanie promocji datą
✅ dowiezione (14f), 3. przełącznik statusu przy promocjach ❌ świadomie nie — decyzja Ani
2026-09-18, 4. **edycja priorytetu reguły z formularza — nadal otwarta**, bez wpisu w backlogu
i bez czyjejkolwiek decyzji; dokument zadaje o nią Ani pytanie z kratką (patrz „Poza zakresem
I14" niżej — czeka na odpowiedź, pytanie zadane 2026-09-19).

**Dla cutoveru — nota przekazana Ani** (rozdział 1 `docs/instrukcja-testow-I4-v2.md`, przed
scenariuszami): pierwszy start procesu po wdrożeniu 14f zamiótł statusy WSZYSTKICH promocji
rozjechanych z datami — na dziś (`promotions` w `db/snapshot.db` PUSTA) realnie 0 zmian; drugi
powód uprzedzenia obok znaleziska 14e: samo `przeliczCenyZRegul`, bez żadnej promocji, zmienia
2050 z 7405 cen (prostuje pozycje rozjechane z aktualnym narzutem — zachowanie oryginału, nie
defekt, ale wygląda jak masowa, niezamówiona zmiana cen).

**⚠ DLA KARTY 14k (backlog #21) — PRZECZYTAJ, ZANIM ZACZNIESZ.** Bloku „14k" w tej roadmapie
jeszcze NIE MA; 14j nie miała prawa go założyć (własność plików), więc pierwsza rzecz do zrobienia
przy planowaniu 14k to spisanie jej zakresu tutaj. Wejście, które 14j zostawia:
- rozszerzenie słownika `akcja → typ` **zmieni wynik oracle-diffu** — po zmianie trzeba PONOWNIE
  uruchomić `oracle-diff-historii.cjs` i PONOWNIE nagrać `historia.wyrocznia.json`; stara wyrocznia
  zacznie świecić i **to będzie poprawne zachowanie**, a nie regresja;
- **#87 już zdecydowany i zrealizowany (P5.1, `69-FEATURE-historia-bez-limitu`, 2026-09-21,
  blok Iteracja 5) — limit 5000 zdjęty**, więc ten punkt nie obowiązuje: rozstrzygnięcie #21
  na „tak" powiększy zbiór mapowany w pamięci, ale nie ma już progu, przy którym cokolwiek
  się gubi;
- podzbiór 270 wierszy w wyroczni jest ważny **tylko dopóki** odsiew działa przed filtrowaniem
  i paginacją; zmiana tej kolejności unieważnia skrót i test to wykryje asercją `limitNieGryzie`.

**⚠ `docs/instrukcja-testow-I5.md` jest w dwóch miejscach NIEAKTUALNA** — §3.3 obiecuje Ani, że
wpisów typu *edycja* nie przybędzie (nieprawda od 12a/12c — zmierzone), a §8.2 że „nowych eksportów
nie wygenerujesz" (odbudowa eksporty ma i audytuje). **Uwaga: pliku nie ma na `develop`** — leży
wyłącznie na niezmergowanej gałęzi `origin/docs/instrukcja-testow-i5` (commity `322a176`, `4ea3b92`).
Do rozstrzygnięcia osobno: domknąć tę gałąź czy przenieść treść do aktualnej instrukcji.

**Poza zakresem I14, wymaga osobnych decyzji i kart:**
- **Status dostawcy w dwóch polach** (ustawienie ręczne + osobny wyliczony status techniczny) —
  propozycja Ani z §12 pkt 10, backlog **#18**. Rusza BE + schemat + kontrakt, więc GATE i bramki
  obu stron; dziś odbudowa odtwarza 1:1 zachowanie oryginału (wyliczony nadpisuje zapisany).
  **To prośba o świadome odstępstwo, nie usterka** — czeka na decyzję użytkownika.
- **Edycja priorytetu reguły z formularza** (§5 poz. 4 starej instrukcji I4) — jedyna pozycja §5
  bez czyjejkolwiek decyzji, wisi od 2026-09-02 bez wpisu w backlogu. `docs/instrukcja-testow-I4-v2.md`
  (karta **65-DOCS-instrukcja-testow-i4-v2**) zadaje o nią Ani pytanie z kratką 2026-09-19 — jej
  odpowiedź będzie wymagała wpisu w backlogu i być może osobnej karty.
- **Sortowanie kolumny „Promocja" w katalogu nie działa.** Zmierzone kartą 65:
  `rebuild/frontend/src/pages/katalog/filtrowanie.ts:107-123` — `sortuj()` czyta
  `produkt["promocja"]`, a wartość siedzi w `_reguly.promocja`, więc obie strony porównania to
  `""`. **Identycznie w oryginale** (`frontend-index.js:23307-23311`) — wierne odtworzenie, nie
  regresja. `docs/instrukcja-testow-I4-v2.md` uprzedza o tym Anię i pyta, czy sortowanie byłoby
  przydatne; „tak" wymaga osobnej karty (materializacja pola albo wyjątek w `sortuj()`).
- **Wygasłe promocje zostają w tabeli, nie znikają.** Ania spodziewała się, że „reguła znika po
  końcu obowiązywania" (`docs/rebuild-backlog.md:1368`); wiersz zostaje z odznaką „zakończona"
  (zachowanie oryginału). `docs/instrukcja-testow-I4-v2.md` pyta Ani, czy chce je ukrywać —
  ewentualne „tak" to świadome odstępstwo i osobna decyzja/karta.
- ~~**EAN w notacji naukowej** (backlog #11)~~ — **ROZSTRZYGNIĘTE 2026-09-18**: Ania chce puste
  pole w katalogu. Karta **14i** ✅ `58-FEATURE-i14i-ean-naukowy-pusty` · 2026-09-18, opis
  w sekcji drugiej fali wyżej.
- **Nowe priorytety Ani z §13 — częściowo już ruszone przez samą Anię** (stan po triażu 2026-09-18,
  `52-CHORE-triaz-produkcja-i14`):
  - kolizje `kod_importu` — **bez zmian, nadal brak wpisu w backlogu**;
  - rozróżnienie „nowy produkt" od „nowy magazyn dla istniejącego EAN" — **bez zmian, brak wpisu**;
  - aktualizacja CECH istniejących produktów w Selly — ⚠ **przesłanka NIEAKTUALNA**: `PUT features`
    nie jest już „usunięty po HTTP 400", Ania przywróciła go 17.09 po teście produkcyjnym. Temat
    ma wpis **#81** i należy do przepisywanego **13d** — szczegóły w bloku 13d wyżej;
  - uporządkowanie danych MO9 — **ruszone przez Anię 17.09**, ma dwa wpisy: **#78** (odrzucanie po ID
    kategorii Magento 163 — quady/kosiarki) i **#79** (koniec reguły „inne → Rolnicze", klasyfikacja
    po rodzinach bieżników BKT). Oba ⬜ do decyzji.
- **⭐ ŚWIEŻA PARTIA DELT PRODUKCJI (triaż 2026-09-18) — backlog #72–#83, JUŻ ROZSTRZYGNIĘTA.**
  Decyzja użytkownika z 2026-09-18: **10 × ✅ TAK**, **1 × ❌ NIE** (#72 — odbudowa ma lepsze
  rozwiązanie), **1 × 🕒 PÓŹNIEJ** (#81 → do 13d). ✅ **Blokada #82/#83 zdjęta 2026-09-18** (triaż `9d1b09f..86d9090`,
  `57-CHORE-triaz-uzasadnienia-ani`): Ania dosłała brakujący wpis CHANGELOG. Powód obu zmian jest
  **produktowy — porządki w wartościach filtrów katalogu**: „Ładowarka" ma zniknąć z filtra
  Rolniczych (#82), a `5`/`5.0`/`5.00` przestać rozbijać filtr „Szerokość opony" (#83; **świadome**
  odwrócenie decyzji Anny z 19.08). **Cała partia #72–#83 jest gotowa do implementacji.**
  Okno `94bdf11..9d1b09f`, 24 commity producenta. **To NIE jest zakres I14** (I14 jest FE-only i nic
  z tego nie dotyka `rebuild/frontend/`), ale **nie może umknąć**, bo część trafia w kod, który
  odbudowa ma już 1:1 i który od 18.09 rozjeżdża się z produkcją:
  - **rdzeń importu (I3/13a):** #75, #79, #80, #82 (nowy moduł `application_rules.cjs` — cztery
    kolejne warstwy, nanosić jako JEDEN stan końcowy) oraz **#83** (`products.szerokosc` — odwrócenie
    decyzji Anny z 19.08 „zachowaj zera końcowe"; `rebuild/.../tyre_params.cjs:336-366` ma dziś
    dokładnie ten blok, który Ania usunęła). Dodatkowo #78/#79 w parserze MO9;
  - **eksport CSV (I8):** #73 (60. kolumna `Blokowane-formy-platnosci`), #76 (nazwy kategorii sklepu
    + `ł`→`l`), #77 (`wstrzymany` ze stanem 0) — trzy wpisy na tym samym pliku
    `rebuild/backend/src/selly/generator-csv.ts`, **do jednego ticketu**, bo ruszają fixture CSV
    i asercję `stdout` w `test/selly.generator-csv.test.ts:155`;
  - **Selly REST (13d):** #74, #77 (część delta), #81 — opisane w bloku 13d wyżej;
  - **zamknięte tym triażem:** #71 (Ania naprawiła `konstrukcja` w żywym bundlu — patrz #72),
    #65 zawężone do 3 wpisów `field_name='konstrukcja'`.
  - ~~Dwa wpisy bez uzasadnienia biznesowego: #82 i #83.~~ ✅ **Domknięte 2026-09-18** — Ania
    dopisała wpis CHANGELOG (`86d9090`), oba mają już „dlaczego" i są gotowe do implementacji.
    Oczekiwania do testów są w backlogu: #82 → 265 rekordów backfillu; #83 → 1297 ujednoliconych
    szerokości + rekord kontrolny `products.id=105986` dla `$` w MO9.
- **Zadania środowiskowe przed cutoverem:** Ania nie mogła przetestować §7 (scheduler — brak restartu
  backendu) ani §14 „trzy drogi importu / konfiguracja", bo **dostawcy nie są podpięci produkcyjnie
  na stagingu** („nie da się wstrzymać synchro"). ⚠ Osobno: **test rozstrzygający §8.1 (ta sama
  liczba pozycji w starym i nowym Bridge) NADAL NIE ZOSTAŁ WYKONANY** — tabela jest wypełniona tylko
  dla MO1 i to „na oko, bez liczb"; MO9 się nie da (API, brak pliku). To najcenniejszy test całej
  instrukcji i wymaga osobnego podejścia z konkretnymi plikami.

**14e — wycena kosztu „daty kończą promocję" (#19)** [ROZPOZNANIE] — **ZROBIONE 2026-09-18,
ticket `53-CHORE-i14e-diagnoza-promocji`.** Karta zamknięta **bez zmian w kodzie produkcyjnym**.

**⚠ ZAKRES ZAWĘŻONY W TRAKCIE** odpowiedziami Ani z 19.09. Pierwotnie karta miała trzy zadania;
dwa zamknęły się jej odpowiedziami, zanim doszło do wniosków:
- **A (czy promocja z warunkiem obniża ceny) — BEZPRZEDMIOTOWE.** Ania: „tylko się nie
  wyświetlało, cena się oblicza prawidłowo". Pomiar zdążył to potwierdzić niezależnie: promocja
  `marka→BKT` 10% obniżyła ceny **954 produktów** wg `floor(zakup × 1,06 × 0,90 × 1,23)`,
  a porównanie pełnego katalogu **oryginał ↔ odbudowa dało 0 różnic na 7405 produktach**.
  Regresji nie ma i nie było. Przy okazji zmierzony zasięg pułapki #25: promocja „globalna"
  obejmuje **1 produkt na 7405**.
- **B (komunikat po edycji reguły) — ZAMKNIĘTE bez zmian.** Ania: „dodana czy
  zaktualizowana to nie ma różnicy, zostaw to tak jak jest". Pomiar i tak wykazał, że defektu
  nie ma: zapis z dialogu edycji leci `PATCH` na id, zero `POST`-ów, **druga reguła nie powstaje**,
  a sam komunikat brzmi „Reguła zaktualizowana", nie „Reguła dodana" (potwierdzone dopiero kartą
  **65-DOCS-instrukcja-testow-i4-v2** — zobacz sprostowanie wyżej w „Druga fala I14").

**⭐ USTALENIE, KTÓRE PRZESĄDZA O KOSZCIE #19 — status promocji jest zapisywany RAZ.**
To nie jest „silnik ignoruje daty" w oderwaniu od reszty, tylko **brak przeliczania statusu**:
- **POST** (`dodajPromocje`) wysyła `status: statusZDat(start, koniec)` — więc promocja
  utworzona z datą startu w przyszłości ląduje w bazie jako `zaplanowana`;
- **PATCH** wysyła SIEDEM pól i **`status` NIE jest wśród nich** (`DialogReguly.tsx:209-224`,
  1:1 z `Eb()` oryginału) — edycja dat nigdy nie zmienia statusu;
- **nic po stronie serwera nigdy statusu nie przelicza** — ani u nas (`grep` po `statusZDat`,
  `zakonczona`, `zaplanowana` w `rebuild/backend/src/` nie zwraca nic), ani w produkcji
  (w `mirror/backend/index.cjs` te napisy padają wyłącznie w danych seeda).

**Silnik JUŻ honoruje status — zmierzone** (`floor` bez rabatu 1303, z rabatem 10% 1173):

| Stan promocji | Cena | Rabat |
|---|---|---|
| `aktywna`, daty bieżące | 1173 | działa |
| `aktywna`, koniec w PRZESZŁOŚCI | 1173 | **działa — to jest defekt #19** |
| `aktywna`, start w PRZYSZŁOŚCI | 1173 | działa |
| `zakonczona`, koniec w przeszłości | 1303 | **nie działa** |
| `zaplanowana`, start w przyszłości | 1303 | **nie działa** |

Z tego wynika rzecz najważniejsza dla 14f: **wpisanie właściwego `status` do bazy wyłącza rabat
bez tknięcia silnika.** Słownik statusów już istnieje, silnik już go respektuje.

**⚠ DWA SPROSTOWANIA DO `docs/instrukcja-testow-I4.md` — dokument wprowadza Anię w błąd.**
Nie naprawione tutaj (plik poza własnością 14e). ⚠ **PRZYPISANIE SPROSTOWANE 2026-09-18
w `56-DOCS-instrukcja-testow-i14`: NIE robi tego 14d, tylko karta domykająca FALĘ 2** (stan
2026-09-18: 14h i 14i już zrobione, zostaje 14f). Decyzja użytkownika przy zakładaniu 14d, wprost: „NIE ruszaj
`docs/instrukcja-testow-I4.md` — to zależy od kart 14f/14h/14i, których jeszcze nie ma".
Powód merytoryczny: oba sprostowania niżej opisują stan, który **14f ma zmienić** — opisanie go
Ani teraz znaczyłoby opisanie stanu, który za chwilę przestanie obowiązywać. 14d dotyczyła
wyłącznie `instrukcja-testow-I3.md` (fala 1). Treść sprostowań zostaje tu bez zmian:
- **§4 pkt 6 jest NIEPRAWDZIWY.** Mówi, że „promocja z datą startu w przyszłości od razu obniża
  ceny", a założona przez dialog dostaje `status: "zaplanowana"` i **nie obniża niczego**;
  nie pokaże też znacznika rozbieżności, bo etykieta z dat i kolumna `status` się zgadzają.
- **Jest za to defekt ODWROTNY, nigdzie nieopisany: promocja „zaplanowana" NIGDY SIĘ NIE
  WŁĄCZA.** Status zostaje `zaplanowana` na zawsze, bo nic go nie przelicza po nadejściu daty
  startu. Karta 14f musi to objąć, inaczej naprawi wygaszanie i zostawi niedziałające planowanie.
- §3.9 był **poprawny w chwili pisania** i wiadomo dlaczego: PATCH nie ruszał statusu, więc
  promocja utworzona jako „aktywna" i przestawiona na daty z 2020 zostawała w bazie „aktywna".
  **Po 14f ✅ (2026-09-19) §3.9 PRZESTAJE OBOWIĄZYWAĆ** — wygaszacz przestawi taką promocję na
  `zakonczona` (na starcie procesu, na wejściu `przeliczCenyZRegul`, albo cyklicznie w ciągu
  `PROMO_WYGASZACZ_MINUTY`). Sprostowanie instrukcji: **14m** ✅ `65-DOCS-instrukcja-testow-i4-v2` · 2026-09-19.

**WYCENA DWÓCH WARIANTÓW — liczby**

| Pozycja | (a) silnik czyta daty | (b) wygaszacz przestawia `status` |
|---|---|---|
| Scenariusze charakteryzacji akceptacji | **1 z 31** (`promocja-wygasla-nadal-obniza-cene`) — 3 pola (`cena_sprzedazy`, `marza_pct`, `status`) w 1 wierszu `products` | **0 z 31** — pod warunkiem opisanym niżej |
| Scenariusze charakteryzacji `bulk` | **0 z 17** | **0 z 17** |
| Testy jednostkowe BE do przepisania | **2** (`ceny.silnik.test.ts:246-252` — 2 asercje, `narzuty.patch.test.ts:319-331` — 1 asercja) | **1** (`narzuty.patch.test.ts:319-331`) |
| Fixtures w `contract/` do przenagrania | **0** | **0** |
| Realne ceny zmienione dziś w produkcji | **0** (`promotions` jest pusta) | **0** |
| Wyjątek w wyroczni charakteryzacji | **TAK** | **NIE** |

**⚠ (b) jest darmowe dla charakteryzacji TYLKO dopóki wygaszacz nie wchodzi do ścieżki importu.**
Harness porównuje `acceptStaging`, a ta woła `zastosujRegulyCenowe`, nie `przeliczCenyZRegul`
(zweryfikowane grafem wywołań: `przeliczCenyZRegul` wołane wyłącznie z `repos/markups.ts:113`
i `repos/promotions.ts:97`). Wygaszacz odpalany przy starcie i w `przeliczCenyZRegul` jest więc
dla harnessu niewidoczny. **Gdyby dołożyć go też do ścieżki importu, koszt zrównuje się z (a)** —
i to gorzej: rozjechałyby się DWIE tabele naraz (`products` i `promotions`), bo nasz port
zmieniłby dane, których oryginał nie rusza.

**Gdzie odpalać wygaszacz — rekomendacja z uzasadnieniem:** przy starcie **i** na wejściu
`przeliczCenyZRegul`. Start łapie wygaśnięcia z czasu postoju, przeliczenie — wygaśnięcia między
mutacjami reguł. **Zostaje okno:** promocja wygasająca przy działającym procesie, bez żadnej
mutacji reguły, nadal obniża ceny przy imporcie aż do najbliższego zamiatania. Zamknięcie tego
okna kosztuje 1 scenariusz charakteryzacji (patrz wyżej) — **to jest realny wybór do podjęcia
w 14f**, nie szczegół implementacyjny.

**Znacznik `rozbieznoscStatusu` (D5 z 4b) — różnica między wariantami, nie detal:**
- w **(b)** nigdy się nie zapali, bo `status` w bazie zrówna się z etykietą z dat → martwy kod,
  usunąć świadomie;
- w **(a)** **nadal będzie się zapalał i będzie KŁAMAŁ** — powie „nadal obniża ceny" o promocji,
  która już ich nie obniża. Tu usunięcie jest nie kosmetyką, tylko warunkiem poprawności.

**Rekomendacja: (b), i pomiar ją potwierdza** — ale nie dlatego, że była wskazana z góry, tylko
dlatego, że (b) nie wymaga wyjątku w wyroczni, ma o jeden test mniej do przepisania, nie zostawia
kłamiącego znacznika i **odtwarza regułę, którą system już stosuje przy tworzeniu promocji**
(`status = statusZDat(...)`), zamiast wprowadzać nową. ⚠ Cztery zastrzeżenia/fakty do 14f, dwa pierwsze zapisane wcześniej, dwa kolejne z 14h:
1. **Wygaszacz musi działać w OBIE strony** (`zakonczona` po końcu, `aktywna` po nadejściu startu),
   inaczej zostanie defekt „zaplanowana nigdy się nie włącza".
2. **`status` jest polem edytowalnym przez API** (`POLA_EDYTOWALNE_PROMOCJI`), więc wygaszacz
   będzie nadpisywał ręczne ustawienia. Dziś instrukcja mówi Ani wprost, że „żeby wyłączyć
   promocję, trzeba zmienić status" — po (b) status staje się polem WYLICZANYM i ta rada
   przestaje mieć sens. Do rozstrzygnięcia w 14f: czy odciąć `status` od listy edytowalnych.
3. **Kolumna „Promocja" w katalogu (14h ✅) korzysta z tej samej `wybierzPromocje`/`promocjaPasuje`**
   (`repos/products.ts` → `dolaczReguly`, wołane z `routes/products.ts`), więc gdy 14f wejdzie
   w życie, kolumna zacznie respektować daty **sama, bez żadnej zmiany w `repos/products.ts`** —
   dotyczy to zwłaszcza wariantu (b) (wygaszacz zmienia tylko dane, nie silnik), ale zadziała
   też przy (a), bo to ta sama funkcja.
4. **⚠ DEFEKT DO ROZWAŻENIA, ujawniony przez 14h:** `promocjaPasuje` robi
   `zasieg.includes(tekst(produkt.marka))`, a każdy napis zawiera pusty napis — produkt z pustą
   `marka` ORAZ pustą `kategoria` (obie `NOT NULL` w schemacie, więc osiągalny jest pusty napis,
   nie `NULL`) łapie KAŻDĄ promocję o niepustym zasięgu. Defekt odziedziczony po oryginale,
   utrwalony testem w `rebuild/backend/test/katalog.promocja.test.ts`; dotąd był niewidoczny, bo
   kolumna była martwa, choć na cenę wpływał tak samo, po cichu. **Naprawa należy do silnika cen,
   czyli do 14f.**
   **Skala ZMIERZONA w 14h, nie oszacowana: ZERO** — na `db/snapshot.db` (7405 produktów) ani
   jeden nie ma jednocześnie pustej `marka` i pustej `kategoria`. Defekt jest więc realny, ale
   dziś nikogo nie dotyczy: to pułapka czekająca na dane (np. import od dostawcy bez marki),
   nie usterka do gaszenia. **Nie podnoś mu priorytetu w 14f** — wystarczy, że wpis zostaje.
   Źródło: `docs/tickets/61-FEATURE-promocja-kolumna-katalog/raport.md`, Follow-up #1;
   wpis backlogu **#88**.
   ⚠ **FAKT po 14f (2026-09-19): NIE naprawione.** `promocjaPasuje` zostało w wariancie (b)
   świadomie NIETKNIĘTE (D1 — wygaszacz przestawia tylko `status`, silnik dostaje inne dane, nie
   inny kod), więc backlog #88 zostaje otwarty; „naprawa należy do 14f" wyżej okazała się błędnym
   założeniem sprzed decyzji o wariancie.

**Siatki zostawione przez 14e** (nie wymuszają żadnej zmiany, pilnują stanu):
`rebuild/backend/test/promocja-warunek-obniza-cene.test.ts` (8 przypadków) i
`rebuild/frontend/test/narzuty.edycja-toast.test.tsx` (11 przypadków).

**Znalezisko uboczne dla cutoveru:** samo `przeliczCenyZRegul`, bez żadnej promocji, zmienia
**2050 z 7405 cen** (2049 spoza BKT + 1 BKT) — prostuje pozycje rozjechane z aktualnym narzutem.
Zachowanie oryginału, nie defekt, ale pierwszy zapis dowolnej reguły na produkcji będzie wyglądał
jak masowa, niezamówiona zmiana cen. Uprzedzić Anię.

Pełne liczby i metoda: `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md`.

**Kolejność:** FALA 1 — **14a ∥ 14b ∥ 14c** (równolegle, rozłączne pliki, merge w dowolnej
kolejności) → **14d** (docs, na końcu). FALA 2 — **14e ∥ 14f ∥ 14h ∥ 14i**, rozłączne z falą 1,
więc mogą iść razem z nią; 14f czekała na rozstrzygnięcie #19, dostała je 2026-09-18 i
**✅ zrobiona 2026-09-19** (`64-FEATURE-i14f-daty-koncza-promocje`). **14i ✅ zrobiona i nie
ruszyła `contract/`** (decyzja użytkownika), a **14h ✅ zrobiona** dotknęła kontraktu tylko
komentarzem (D4, `61-FEATURE-promocja-kolumna-katalog`) — obie weszły bez blokady kolejnościowej
i bez wspólnych fixtures. **14m ✅ zrobiona 2026-09-19** (`65-DOCS-instrukcja-testow-i4-v2`,
sprostowanie `docs/instrukcja-testow-I4.md`, domykała falę 2 — startowała po 14f).
**14g skasowana** (decyzje Ani z 18.09).
Każda z trzech kart dopisuje TYLKO swój podblok wyżej i NIE rusza tablicy postępu §4 — wiersz iteracji
zamyka 14d. Prompty startowe trzech kart powstały w sesji planującej 2026-09-18.

---

---

### Poprawki po testach Ani — iteracje 5, 6, 7, 9, 10 i przegląd 12 widoków (plan P)

- **Status:** 🔨 w toku — zaplanowane 2026-09-21. Iteracje 3 i 4 zamknięte w bloku I14 wyżej
  (karty `14a`–`14m`). Ten blok przejmuje dalszy ciąg z **nową numeracją**.
- **Skąd.** Ania przeszła instrukcje I5, I6, I7, I9, I10 i przegląd 12 widoków, a potem odpowiedziała
  na dwie rundy pytań zbiorczych (`docs/pytania-do-ani-2026-09-18.md` i runda 2 z 21.09).
  **Po jej stronie nie ma już ani jednej otwartej sprawy.** Wszystkie decyzje są w backlogu.
- ⚠ **Od ticketu 82 karty tego planu NIE edytują roadmapy** — stan i ustalenia piszą w
  `docs/karty/<ID>/` (zasady: `docs/karty/README.md`). Kolumna „Stan” w tabelach niżej jest
  zamrożona do etapu 2 migracji; aktualny stan: `tools/stan-kart.sh` + ta tabela.

**Nazewnictwo — trzy różne rzeczy, trzy systemy, nie mieszać:**

| Co to jest | Oznaczenie | Przykład |
|---|---|---|
| znalezisko / zmiana produkcji — rejestr WIEDZY | `#N`, globalnie rosnąco | `#39`, `#93` |
| karta do wykonania — jednostka PRACY | **`P{iteracja}.{kolejność}`** | `P7.1` |
| ticket — folder i gałąź | `{numer}-{TYP}-{slug}` | `69-FEATURE-historia-bez-limitu` |

`P` jak poprawki; numer iteracji = **skąd pochodzi uwaga Ani**, nie kiedy to robimy. `PR` = przegląd
12 widoków (nie `P12`, żeby nie mylić z Iteracją 12 — konto i admin). Karty `14a`–`14m` zostają
pod starymi nazwami: przemianowanie zerwałoby **719 odwołań w 38 plikach**.

#### Iteracja 5 — Historia

| Karta | Zakres | Wpisy | Stan |
|---|---|---|---|
| **P5.1** | Historia przestaje gubić najstarsze zdarzenia — hybryda: odsiew akcji w SQL bez limitu, reszta w pamięci (decyzja D2) | #87 | ✅ `69-FEATURE-historia-bez-limitu` · 2026-09-21 |
| **P5.2** | eksport ZIP działa u nas, w produkcji nie — utrwalić jako świadome odstępstwo | #93 | ✅ 2026-09-21, ticket 70 — szczegóły: podblok „P5.2” w bloku „Iteracja 5 — Historia” |
| **P5.3** | delta instrukcji I5 dla Ani | — | ✅ `73-DOCS-instrukcja-testow-i5-v2` · 2026-09-21 |

Karta `14j` (oracle diff historii, 0 różnic na 49 813 wpisach) i skasowana `14k` (#21 — NIE) też
należą do tej iteracji. Baza dla P5.3: `docs/instrukcja-testow-I5.md`, odtworzony 21.09 z PDF-a Ani
(ticket 67) — wcześniej nie istniał w repo.

**Iteracja 5 ZAMKNIĘTA 2026-09-21 — wszystkie trzy karty zrobione.** Delta dla Ani:
`docs/instrukcja-testow-I5-v2.md` (P5.3); pierwsza wersja dostała banner „częściowo nieaktualne”
i zostaje jako zapis stanu z 2026-09-02 (numery paragrafów wiążące). Ustalenia P5.3, które
przydadzą się dalej:
- **Eksport ZIP nie ma przycisku w UI (ani oryginał, ani odbudowa)** — delta daje Ani gotowy link
  `https://test.agritires.eu/api/export-shoper` (decyzja użytkownika 2026-09-21, świadome wyjście
  poza regułę „zero tras API” w instrukcjach). Wpis w Historii: typ `eksport`, Dostawca „—”
  (`encja_typ = 'dostawcy'`, liczba mnoga, nie łapie się na `encja_typ === 'dostawca'`), Pozycji =
  liczba dostawców, Szczegóły „Format: csv Format: csv” (dublowanie `format` + `uwagi` wierne
  oryginałowi, `fe.js:25537-25545`).
- **Różnica po P5.1 jest dziś niewidoczna na stagingu** (snapshot 3873 wierszy `audit_log` < 5000,
  scheduler stagingu wyłączony). Jedyny widoczny objaw: stary Bridge może zaczynać Historię później
  niż nowy — delta każe tego nie zgłaszać.
- **§3.3 i §12 („ręczna edycja”) pierwszej wersji były nieaktualne od 12a**, nie od P5.x — edycja
  produktu z Katalogu („Akcje” → „Edytuj”) pisze `edycja_produktu`; delta prostuje to w osobnej
  podsekcji. Dla przenagrywania wyroczni 14j (`oracle-diff-historii.cjs`) nadal obowiązuje: działa
  tylko na bazie PONIŻEJ 5000 wierszy `audit_log` (warunek `limitNieGryzie` w
  `historia.wyrocznia.test.ts`).

#### Iteracja 6 — Alerty

| Karta | Zakres | Wpisy | Stan |
|---|---|---|---|
| **P6.1** | ✅ 2026-09-21 (72) — trzeci status `przejrzany` (przyciski słownictwem oryginału + nasza „Otwórz ponownie", domyślny filtr „Nierozwiązane") i wyszukiwarka po `opis` filtrująca wpisy PRZED grupowaniem; wspólny moduł `pages/alerty/statusy.ts` + `PrzyciskiStatusu.tsx` pod P6.2 — decyzje w `docs/tickets/72-FEATURE-alerty-przejrzany-szukajka/plan.md` | #90, #26 (część) | ✅ zrobione |
| **P6.2** ⭐ | pseudo-alerty katalogowe — nowy mechanizm liczony z katalogu; **importuje** `statusy.ts`/`PrzyciskiStatusu.tsx` z P6.1, nie duplikuje | #26 | ⬜ gotowe — **P6.1 zmergowana, można startować** |
| **P6.3** | delta instrukcji I6 dla Ani — lista tego, co P6.1 obaliła w `docs/instrukcja-testow-I6.md`, jest w `raport.md` ticketu 72 (sekcja Follow-up) | — | ⬜ po P6.1 i P6.2 |

**Dlaczego #26 jest rozdzielone na dwie karty.** Trzeci status dla ISTNIEJĄCYCH alertów jest tani —
`PATCH /api/alerts/:id` nie waliduje statusu (oryginał też nie, `routes/alerts.ts:45`), wystarczy
poszerzyć typ `StatusAlertu` (`repos/alerts.ts:16`) i dołożyć przycisk. Pseudo-alerty to osobny, duży
mechanizm: w oryginale liczone w PRZEGLĄDARCE z katalogu (`frontend-index.js:25177-25340` `HT()`,
`:16631-16705` `pv()`), status w IndexedDB (`:9165-9193`). Rozłączność plików: P6.1 ma
`TabelaAlertow.tsx`, `grupowanie.ts`, `repos/alerts.ts`, `test/alerty.*` i (nowe, współdzielone
z P6.2) `pages/alerty/statusy.ts` + `PrzyciskiStatusu.tsx`; P6.2 ma NOWE pliki i powłokę strony
`/alerty` (`pages/Alerty.tsx`, nietknięty przez P6.1). Dzięki temu idą równolegle.

**Dla P6.2:** mutacja zapisu statusu i toast „Zmieniono X z N alertów" zostały w
`TabelaAlertow.tsx` (P6.1 ich nie wydzieliła), bo są przywiązane do `PATCH /api/alerts/:id` alertów
IMPORTU. Status pseudo-alertów ma iść na serwer (decyzja 2 niżej), ale inną drogą niż `alerts` —
P6.2 dokłada własny zapis; wspólne są tylko statusy, etykiety i przyciski.

⚠ **P6.2 jest jedną z dwóch rzeczy, które Ania nazwała mogącymi wstrzymać cutover** — musi wejść przed
przełączeniem produkcji.

**Decyzje dla P6.2 — PODJĘTE 2026-09-21, wszystkie zgodnie z rekomendacją** (pełna treść: backlog #26):
1. **Gdzie:** zakładki na `/alerty` — „Import" i „Katalog".
2. **Status:** na SERWERZE, spójnie z decyzją D1 z I6 dla alertów importu (świadome odstępstwo: oryginał
   trzyma go w IndexedDB przeglądarki).
3. **Pulpit:** karta powiadomień pokazuje OBA źródła, z podziałem.
4. **Odwrócenie D3 z karty 13e:** ukrywanie rozwiązanych (`ackalerts` pkt 4) WCHODZI — zbieżne z domyślnym
   filtrem „nierozwiązane" z P6.1, więc obie listy zachowują się tak samo.
5. **Liczenie:** w przeglądarce, jak w oryginale — ALE karta ma najpierw zmierzyć koszt na Pulpicie.

**Zależność:** P6.2 startuje PO merge'u P6.1, bo korzysta z wydzielonego tam wspólnego modułu statusów
i przycisków.

⚠ **Numeracja migracji — jeśli status pseudo-alertów na serwerze (decyzja 2) potrzebuje nowej tabeli
(migracja SQL), następny wolny numer to `008`** — `007` zajął `waga_gab_przewoznicy` (karta P9.1,
ticket `76`, 2026-09-21). Sprawdź `ls rebuild/schema/` przed pisaniem pliku, PR.3 może w
międzyczasie zająć `008`.

⚠ **Pułapka źródła, zademonstrowana 2026-09-21:** silnik pseudo-alertów czytać WYŁĄCZNIE z `origin/main`
(`git show origin/main:mirror/frontend/assets/index-PRICEFMT1783512500.js`). Na `develop` `mirror/` jest
cofnięty do 25.08, a `deminified/` jest z 13.08 — oba są SPRZED łatek z 4.09 (`tr_fix`, `ackalerts`).
Przy planowaniu tej karty odczyt z `develop` dał fałszywą „rozbieżność" z opisem karty 13e; na `main`
odciski wartości w identyfikatorach alertów są obecne, a opis 13e jest poprawny.

#### Iteracja 7 — Atrybuty

| Karta | Zakres | Wpisy | Stan |
|---|---|---|---|
| **P7.1** | ślad akcji kolejki w Historii + uzgodnienie map rodzaj→kolumna | #39, #41 | ✅ 2026-09-21, ticket `74-FEATURE-slad-kolejki-atrybutow` |
| **P7.2** | seed bieżników z `products.bieznik` + sprzątanie kolejki z self-matchy + podobieństwo case-insensitive | #40, #42 | ✅ 2026-09-21, ticket `78-FEATURE-seed-bieznikow-podobienstwo` — kolejka 498→61 pozycji, 0 self-matchy, 13 nowych sugestii aliasów |
| **P7.3** | test niezmiennika „ostrzeżenie = liczba realnie przepisanych" | — | ✅ `75-CHORE-niezmiennik-atrybutow` · 2026-09-21 — niezmiennik trzyma się: liczba w ostrzeżeniu = liczba przepisanych wierszy, 0 rozjazdów na 4148 pomiarach na snapshocie; test `atrybuty.niezmiennik.test.ts` w bramce |
| **P7.4** | delta instrukcji I7 dla Ani | — | ⬜ po P7.1–P7.3 i P7.5 · wejście od P7.3 niżej |
| **P7.5** | tekst ostrzeżenia w kolejce atrybutów zgodny ze śladem w Historii (tylko frontend) | #39 | ✅ 2026-09-21, ticket `81-FEATURE-ostrzezenie-kolejki-historia` — oba okienka (edycja, alias) mówią o wpisie w Historii zamiast o braku audytu; test obejmuje oba |

⚠ P7.1 i P7.2 dzielą klaster backendu atrybutów — przed puszczeniem obu naraz sprawdzić rozłączność
plików, inaczej połączyć. P7.3 jest czysto testowa, idzie równolegle z czymkolwiek.

**Wejście od P7.3 (ticket 75, 2026-09-21)** — pomiar i tabela: `docs/tickets/75-CHORE-niezmiennik-atrybutow/raport.md`.

- **Dla P7.1:** po wprowadzeniu `model` / `zastosowanie` do akceptacji dopisać je do listy `RODZAJE`
  w `rebuild/backend/test/atrybuty.niezmiennik.test.ts`. P7.3 je pominęła, bo dziś dają 400
  „Nieznany rodzaj". Test nie importuje map rodzaj→kolumna i nie sprawdza `audit_log`, więc audyt
  akcji i przebudowa map go nie ruszają. **Zrobione w P7.1 (ticket 74):** zamiast dopisania do
  `RODZAJE` doszła osobna lista `RODZAJE_POZA_SKANEM` — skan tych rodzajów nie przegląda, więc
  pozycję kolejki test wstawia ręcznie i sprawdza B == C == realna zmiana.
- **Dla P7.2 (zrealizowane, ticket 78):** pozycje kolejki, które podpowiadały same siebie ze
  100%, dawały fałszywą liczbę przy aliasie — ostrzeżenie/toast liczyły wiersze dopasowane, nie
  zmienione. W snapshocie takich pozycji było 437 z 498 (nie z 500 — ta liczba to stan PO
  skanie, który dokłada 2 pozycje `konstrukcja`). Sama zmiana seedu `bieznik` na
  `products.bieznik` usuwała co najwyżej 72 z nich; resztę zdjęło dopiero sprzątanie kolejki
  (D1, #40) — pełny zakres w „P7.2 dowieziona" niżej.
- **Dla P7.4 — ⚠ instrukcja I7 §3.11 obiecuje coś, co nie jest prawdą.**
  `docs/instrukcja-testow-I7.md:206-208` mówi, że liczba w ostrzeżeniu „ma odpowiadać temu, co
  pokazuje kolumna *Wystąpień*". Tak nie jest i być nie musi. Ostrzeżenie liczy na żywo
  (`GET /api/atrybuty/uzycie`), a kolumna to migawka ze skanu. Pozycji już obecnych w słowniku
  skan nie odświeża nigdy, więc w snapshocie **126 z 500** pozycji ma w kolumnie inną liczbę niż
  w ostrzeżeniu. Dotyczy to także przykładu z samej instrukcji: „AGRI STAR II" ma 186 w kolumnie
  i 188 w ostrzeżeniu. Inny przykład: ALLIANCE, 780 w kolumnie i 848 w ostrzeżeniu. Delta ma to
  sprostować. Wiarygodna jest liczba z OSTRZEŻENIA i ona ma się równać liczbie z toastu
  „Zaktualizowano produktów" (P7.3 to potwierdziła: 0 rozjazdów). Właściwym zgłoszeniem z §5
  (`:424`) jest więc rozjazd ostrzeżenie ↔ toast ↔ katalog, a nie ostrzeżenie ↔ kolumna.
  **Nieaktualne po P7.2 (ticket 78):** wcześniej ten akapit opisywał wyjątek „kliknięcie sugestii
  tą samą wartością (100%) pokazuje N, choć w katalogu nic się nie zmienia" — sugestii
  identycznych z pozycją już nie ma (D1), więc wyjątku nie ma.

**P7.1 dowieziona (2026-09-21, ticket 74):** sześć tras kolejki (`akceptuj`, `akceptuj-z-edycja`,
`akceptuj-jako-alias`, `odrzuc`, `DELETE /api/atrybuty/pending`, `POST /api/atrybuty/scan-pending`)
pisze do `audit_log` (`atrybut_pending_*`); dwie z nich (edycja, alias) są widoczne w
`GET /api/history/paged` jako `edycja`, z realną liczbą przepisanych produktów i opisem
przed → po (wymagało gałęzi w `naWpisHistorii()`, nie tylko wpisu w słowniku). `RODZAJE_KOLUMNY`
zniknęła — jedna mapa `RODZAJ_KOLUMNA` (15) obsługuje liczniki, użycie i obie akceptacje; zakres
skanu został osobną, jawną listą `ZAKRES_SKANU` (13, bez zmiany zawartości). Szczegóły:
`docs/tickets/74-FEATURE-slad-kolejki-atrybutow/`.

**P7.2 dowieziona (2026-09-21, ticket 78):** trzy świadome odstępstwa zatwierdzone przez Anię
(#40, #42): **D1** — pozycja kolejki obecna dosłownie (porównanie BINARY) w słowniku tego samego
rodzaju znika po każdym skanie (`POST /api/staging/accept`, `POST /api/atrybuty/scan-pending`) i
przy starcie procesu zaraz po seedzie, a reguła sugestii nigdy nie proponuje napisu identycznego
z pozycją; **D5** — seed `bieznik` bierze `SELECT DISTINCT bieznik FROM products` zamiast
`model`; **D6** — podobieństwo liczone po normalizacji (`trim`, `toLowerCase`, zwinięcie spacji),
próg 0,9 i reguła `+` bez zmian. Bez migracji (D3) — pomiar na snapshocie: 0 wartości słownika
pochodzi wyłącznie z `products.model`, więc nie było czego sprzątać. Fixture
`GET_atrybuty_pending.json` zostaje bez zmian (D2), gate porównuje kształtem, nie wartościami. Na
snapshocie kolejka spada z 498 do 61 po starcie (63 po pierwszym skanie), self-matchy z 437 do 0,
dochodzi 13 nowych par sugestii różniących się wielkością liter. Po pytaniu zwrotnym do
użytkownika odwrócony jeden przypadek niezmiennika P7.3 w `atrybuty.niezmiennik.test.ts`, reszta
pliku nietknięta. `atrybuty_wartosci.rodzaj` ma FK do `atrybuty_rodzaje`, a seed rebuildu zakłada
tylko 5 rodzajów rdzenia (produkcja ma 15) — na świeżej bazie akceptacja rodzaju spoza piątki
nadal kończy się 500 (rollback, stan zastany, nie zmieniony w 78). Szczegóły:
`docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/`.

**Dla P7.4 — ostateczne brzmienie ostrzeżenia (P7.5, ticket 81, do cytowania znak w znak).**
Oba okienka, „Akceptuj z edycją” i „Akceptuj jako alias”, pokazują ten sam komponent:
„Zmiana przepisze pole <rodzaj> w <N> produktach katalogu. Operacji nie da się cofnąć. Zostanie
po niej wpis w Historii (typ „edycja”).” Pod nim okienko aliasu ma dodatkowe, niezmienione zdanie:
„Do słownika nie trafi nic — mapowanie nie jest nigdzie zapisywane, zmieniają się wyłącznie
produkty.” Stare zdanie „…ani odtworzyć z dziennika — akcje kolejki nie trafiają do audytu”
już nie występuje. Produkcja nie ma ani ostrzeżenia (dodatek D7 rebuildu), ani audytu kolejki.

**Dla P7.4 (delta instrukcji I7):** `docs/instrukcja-testow-I7.md` §4 pkt 4 jest po 74
nieprawdziwy dwukrotnie — `model`/`zastosowanie` NIE trafiają do kolejki (skan ich nie tworzy,
0 wierszy na snapshocie), a błąd „Nieznany rodzaj" dla nich już nie występuje (jedna mapa,
akceptacja je przyjmuje). §4 pkt 7 też nieaktualny — ślad w Historii już jest (patrz wyżej).
Jeśli Ania chce, żeby `model`/`zastosowanie` trafiały do kolejki, to zmiana zakresu skanu (I15),
która zalałaby kolejkę (#40) — do wyjaśnienia z nią, nie do cichej zmiany. **Po ticketcie 78 §4
pkt 1 i pkt 2 też przestają być prawdziwe** (self-match „AGRI STAR II" i „BKT"/„bkt" bez
sugestii) — do dopisania w delcie: kolejka po wdrożeniu jest krótsza (≈61 zamiast 498); marki i
bieżniki z katalogu znikają z kolejki po restarcie (semantyka seedu — akceptuje przy starcie
wszystko, co jest w `products`); nowe sugestie różniące się wielkością liter bywają w formie z
małymi literami („Farmax R75", „MG638  napęd") — sprawdzić formę kanoniczną przed „jako alias";
sugestie 91% mogą łączyć różne produkty („MG628"→„MG638"); wyjątek opisany wyżej (§3.11,
„kliknięcie sugestii tą samą wartością") jest już nieaktualny, bo self-matchy nie ma. Pełna lista:
`docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/raport.md`, sekcja Follow-up.

#### Iteracja 9 — Waga gabarytowa

| Karta | Zakres | Wpisy | Stan |
|---|---|---|---|
| **P9.1** | wspólna lista przewoźników na serwerze + potwierdzenie usuwania + kalkulator paletowy | #27, #28 | ✅ **2026-09-21**, ticket `76-FEATURE-przewoznicy-serwer-paletowy` |
| **P9.2** | delta instrukcji I9 dla Ani | — | ⬜ gotowe do startu (P9.1 zamknięta) |

Trzy rzeczy w jednej karcie świadomie — wszystkie w `waga-gabarytowa/**`. Seed potwierdzony przez Anię
21.09 bez poprawek: GEIS 10 000 · DPD 6 000 · GLS 4 000 · InPost / UPS / DHL 5 000. Edytuje każdy
zalogowany.

**P9.1 — dowieziony zakres (2026-09-21).** Trzy świadome odstępstwa od produkcji (O1–O3,
zatwierdzone przez Anię): lista przewoźników/dzielników przeniesiona z IndexedDB (`magazynKV`) na
serwer, tabela `waga_gab_przewoznicy` (migracja `007`, seed sześciu przewoźników jak wyżej, GEIS
domyślny — `INSERT OR IGNORE`, trafia do produkcji przy cutoverze przez `npm run migrate`);
`GET`/`PUT /api/waga-gabarytowa/przewoznicy` za `requireAuth`, walidacja 400 (niepusta lista,
unikalne `id`, `nazwa` niepusta po trim, `dzielnik` liczbą dodatnią, najwyżej jeden `domyslny`) i
audyt (`edycja_przewoznikow`, `{przed, po}`, try/catch jak `atrybuty.ts`); usunięcie przewoźnika i
„Przywróć domyślne" pytają o potwierdzenie (`DialogPotwierdzenia`, z ostrzeżeniem, że lista jest
wspólna); kalkulator **paletowy** (`POST /api/waga-gabarytowa/oblicz`, wcześniej bez konsumenta)
dostał ekran obok wolumetrycznego, bez pamięci wyniku. W IndexedDB zostają tylko wybór, ostatni
wynik i ostatnie wymiary (założenie A) — stare lokalne listy przewoźników **nie są importowane**
(świadome, Ania potwierdziła seed). Szczegóły, w tym mechanizm serializacji zapisów (kolejka
`scope` w React Query, dowieziona dopiero w rundzie 3 code review) i pełna lista decyzji Q&A:
`docs/tickets/76-FEATURE-przewoznicy-serwer-paletowy/{plan.md,raport.md,review.md}`.

**Odstępstwo od planu:** kontrakt dla nowych tras opisuje kształt odpowiedzi 200/400 w TEKŚCIE
markera `x-odbudowa-nowa-trasa`, nie inline w linii statusu — generator schematów
(`tools/generate-openapi-schemas.cjs`) przepisuje i czyści linie statusów bez fixture'a, a dla tras
spoza produkcji fixture nie istnieje i nie może istnieć. Inline zostaje tylko schemat `requestBody`
PUT.

**Numeracja migracji (fakt):** `007` zajęty przez `waga_gab_przewoznicy` (ta karta, 2026-09-21).
Konsekwencja dla kart PR.3 i P6.2 (obie mogą chcieć migracji SQL) zapisana w ICH blokach niżej.

**P9.2 — delta instrukcji I9 dla Ani (do napisania).** `docs/instrukcja-testow-I9.md` po P9.1 ma
nieaktualne fragmenty: §3.11, §4 pkt 4 i pkt 6 oraz wszystkie opisy „lista żyje w Twojej
przeglądarce" przestały być prawdziwe (lista jest teraz na serwerze). Do instrukcji dochodzi:
- potwierdzenie usunięcia przewoźnika (z ostrzeżeniem, że lista jest wspólna);
- potwierdzenie „Przywróć domyślne" (zmienia listę całej firmie, nie tylko przeglądarce);
- wspólna lista — edytuje ją każdy zalogowany, zmiany widzą wszyscy;
- zapis nazwy/dzielnika dopiero po opuszczeniu pola (pusta nazwa albo zły dzielnik → komunikat i
  powrót do poprzedniej wartości, bez zapisu);
- nowa sekcja „kalkulator paletowy" pod tabelą przewoźników: pola szerokość/długość/wysokość (cm),
  wynik `wagaGabarytowa`/`szerokoscEfektywna`/`wysokoscZPaleta`/`wspolczynnik`/`opis`; progi z
  `db/snapshot.db` (`szer_polpaleta = 55`, `szer_paleta = 80`, `wys_palety = 10`,
  `wspolczynnik = 0.000167`);
- stare listy przewoźników z lokalnego IndexedDB przeglądarki **nie są importowane** — po P9.1
  startuje się z seeda serwera, nie z tego, co ktoś miał lokalnie.

#### Iteracja 10 — Analityka i Pulpit

| Karta | Zakres | Wpisy | Stan |
|---|---|---|---|
| **P10.1** | klaster backendu analityki: ożywienie kart „Dostępności" + trzy poprawki towarzyszące | #31, #32, #33, #35 | ⬜ gotowe — decyzje 2026-09-21 |
| **P10.2** | kafel „Ostatni eksport CSV" pokazuje datę | #34 | ⬜ gotowe |
| **P10.3** | eksport CSV respektuje filtry | #91 | ⏸ zakres do decyzji |
| **P10.4** | delta instrukcji I10 dla Ani | — | ⬜ po P10.1–P10.3 |

P10.3 rusza ten sam plik tras co P10.1 — po niej, nie równolegle.

**Decyzje dla P10.1 — PODJĘTE 2026-09-21 przez użytkownika, wszystkie zgodnie z rekomendacją** (pełna treść
w backlogu). Do 21.09 wiersz stał na „gotowe", choć #31, #33 i #35 miały w backlogu „do decyzji" —
rozjazd zamknięty. Przy #32 Ania zatwierdziła NAPRAWĘ, a wybór WARIANTU był decyzją techniczną użytkownika.

| Wpis | Decyzja |
|---|---|
| **#32** | wariant (a): nazwa z katalogu, `LEFT JOIN products` po **`dostawca` + `kod`**; usunięty produkt → kreska |
| **#33** | naprawić razem z #32; z duplikatów klucza brać **ostatni wpisany** (`MAX(id)`) — karta najpierw MIERZY, co import zostawia w katalogu |
| **#31** | naprawić: nie dokładać migawki, jeśli produkt ma już dzisiejszą; **bez** indeksu unikalnego |
| **#35** | lista znanych widoków eksportu, reszta **404** (zamiast `200` z samym BOM) → zmiana kontraktu |

⚠ **Skutek dla PR.2** (kafle KPI analityki) i **P10.2** (kafel na Pulpicie): P10.1 ożywia dane, które te karty
mogą pokazywać — obie po P10.1. P10.2 dodatkowo po P6.2 (obie ruszają Pulpit).

#### Przegląd 12 widoków

| Karta | Zakres | Wpisy | Stan |
|---|---|---|---|
| **PR.1** ⭐ | Archiwum importów — trzy trasy + widok z POBIERANIEM pliku | — | ⬜ gotowe |
| **PR.2** | kafle KPI analityki jak na produkcji | — | ⬜ gotowe |
| **PR.3** | migracja typów alertów (`B??d` → `Błąd`, 435 wierszy) | — | ⬜ gotowe |
| **PR.4** | diagnoza Selly „Wygeneruj CSV" na stagingu | — | ⬜ gotowe |
| **PR.5** | duplikat marki `ALLIANCE` / `Alliance` | #92 | ⏸ decyzja |
| **PR.6** | aktualizacja przeglądu 12 widoków | — | ⬜ na końcu |

PR.1 to jedyny w całym projekcie **czysty brak funkcji obecnej w produkcji** (`archive-injection.js`
+ `archive_module.cjs`, trzy trasy). Zakres doprecyzowany odpowiedzią Ani 12.1: używa archiwum do
porównywania, czy plik zgadza się z katalogiem, i do weryfikacji brakujących pozycji — więc widok MUSI
pozwalać pobrać plik, nie tylko pokazać listę.

⚠ **PR.3 — jeśli poprawka `B??d`→`Błąd` idzie migracją SQL (jak `006_nazwa_caps.sql`), następny wolny
numer to `008`** — `007` zajął `waga_gab_przewoznicy` (karta P9.1, ticket `76`, 2026-09-21); sprawdź
`ls rebuild/schema/` przed pisaniem pliku, nie ufaj temu numerowi bez świeżego sprawdzenia.

**Dla PR.5 (fakt z P7.2, ticket 78, 2026-09-21):** po sprzątaniu kolejki (D1) kolejka nie
zaproponuje już aliasu `ALLIANCE → Alliance` — pozycja `ALLIANCE` jest dosłownie w słowniku
`marka` i znika przy sprzątaniu, zanim reguła sugestii ją zobaczy. Słownik `marka` ma dziś obie
formy naraz. Duplikat trzeba rozwiązać po stronie danych, decyzja #92 dalej otwarta.

#### ⭐ Pomiar parserów na prawdziwych cennikach (2026-09-21) — zastępuje test §8.1 instrukcji I3

Ania odmówiła ręcznego testu §8.1 z uzasadnionych powodów (wgrywanie do żywego Bridge'a = dzień
akceptowania stagingu dla Marty; ręczne wgranie nie sprawdza synchronizacji po URL). Zamiast tego
przysłała **osiem aktualnych plików** — dokładnie te, które produkcyjny automat ściąga spod adresów
z `dispatcher.cjs` — i porównaliśmy dwa potoki `dispatcher.parseByKod()` → `adapter.recordsToSurowe()`
na tych samych plikach: **produkcja dziś (`origin/main`) kontra nasz port (`src/import/legacy`)**.

⚠ Porównanie z `mirror/` na `develop` byłoby BEZWARTOŚCIOWE: tam parsery są co do bajta identyczne
z naszym portem (oba zsynchronizowane na 08.09 w 13a), więc wyszłoby zawsze zero różnic.

**Liczba pozycji zgadza się co do sztuki w 7 z 7 testowalnych plików, zero rekordów po jednej stronie:**
MO1 715 · MO3 582 · MO4 309 · MO5 1572 · MO7 285 · MO8 704 · MO10 219.

**Różnice w polach — KAŻDA wyjaśniona wrześniową zmianą produkcji, żadna niewyjaśniona:**

| Pole | Co produkcja robi inaczej | Wpis |
|---|---|---|
| `blokowaneFormyPlatnosci` | dokłada pole, stałe per dostawca | #73 |
| `zastosowanie` | dokłada pole z zamkniętej listy per kategoria | #75 |
| `szerokosc` | obcina zera końcowe (`"10"` vs nasze `"10.0"`) | #83 |
| `kategoria` (tylko MO8, 50 rek.) | Wielka litera już w parserze (`"Leśne"` vs `"leśne"`) | #79 |

**Wniosek: port jest wierny; cała różnica to nieprzeniesione zmiany września (materiał I15).**
Produkcja wciągnęła te zmiany WPROST do potoku parsowania — parsery ciągną dziś dwa moduły, których
odbudowa nie ma: `application_rules.cjs` i `payment_blocks.cjs`. Port #73 i #75 będzie więc zmianą
w warstwie parserów, nie kosmetyką. ⚠ `payment_blocks.cjs` ma zahardkodowaną ścieżkę produkcyjną
`/home/admin/private_apps/bridge/data.db` — ale funkcja używana przez adapter
(`getBlockedPaymentForms`) jest czysta i bazy nie dotyka.

**Znaleziska po drodze:**
- **MO8 Trelleborg w CSV działa** — 704 pozycje po obu stronach. W starym Bridge ten sam przypadek
  dawał zero pozycji po cichu (backlog #8, zrzut Ani z I3). Poprawka `bug4` z 13a potwierdzona na
  prawdziwym pliku.
- **Trelleborg ma EAN w notacji naukowej** (`8,05997E+12`) — realny przypadek dla 14i.
- **MO7 Nokian: 14 zdublowanych kodów**, ale to IDENTYCZNE wiersze w pliku dostawcy — nic nie ginie.
  To NIE jest kolizja `kod_importu` w sensie, o którym mówiła Ania (różne produkty pod jednym kodem).
- **Szerokość: produkcja złamała obietnicę z instrukcji I3 §11 pkt 10** („10.00 zostaje takie, jakie
  jest w pliku") — od 18.09 obcina zera (#83, odwrócenie decyzji z 19.08). Przy porcie #83 sprostować.
- **MO9 nie da się przetestować plikiem** — parser „plikowy" ignoruje plik i idzie do API. Nie wyszło
  żadne żądanie (padło na braku haseł).
- **MO2 (JMK) nieprzetestowany** — brak pliku.

**Narzędzie i reprodukcja.** Skrypt: `docs/tickets/71-DOCS-plan-poprawek/porownaj-parsery.cjs`.
Uruchomienie: drzewo parserów z `origin/main` (+ `application_rules.cjs`, `payment_blocks.cjs`) do
katalogu tymczasowego, potem `NODE_PATH=rebuild/backend/node_modules node porownaj-parsery.cjs
<prod> rebuild/backend/src/import/legacy '<JSON par [kod, plik]>'`, Node ≥ 20.
**To gotowy test akceptacyjny portu I15:** po przeniesieniu #73/#75/#79/#83 ma wyjść zero różnic
w polach. ⚠ **Cenników NIE commitujemy** — to pełne dane handlowe dostawców, leżą poza repo.

#### Po stronie użytkownika — decyzje, które zostały

| Decyzja | Odblokowuje | Rekomendacja |
|---|---|---|
| **#91** — zakres „zapisz to, co widzę" | P10.3 | do rozstrzygnięcia |
| **#92** — duplikat marek: dane czy prezentacja | PR.5 | łącznie z #42 |

#### Kolejność

Iteracjami: 5 → 6 → 7 → 9 → 10 → przegląd. Wewnątrz iteracji karty rozłączne plikowo idą równolegle.
**Dwa świadome wyjątki od kolejności:** PR.1 (jedyny brak funkcji) i P6.2 (bloker cutoveru) — oba
warto puścić wcześniej, bo są rozłączne ze wszystkim innym.


## 6. Po zakończeniu wszystkich iteracji

> **Stan 2026-09-08: pierwotna odbudowa DOWIEZIONA — I0–I12 zamknięte, ostatnia sesja 12e domknęła
> audyt bezpieczeństwa bez znalezisk.** Zostają dwa zdarzenia POZA pierwotną odbudową, opisane niżej:
> przegląd 12 widoków przez Anię i cutover. **Doszła jednak I13** — nowa rodzina zmian, które Ania
> wdrożyła na produkcji 26.08–08.09 (patrz blok I13 w §5); **musi być rozliczona PRZED cutoverem**,
> bo cutover idzie ze stanu produkcji z 08.09 (`6872aea`), nie 25.08 — inaczej wdrażamy stan sprzed
> dwóch tygodni. **Doszła też I14** — uwagi Ani z testów Iteracji 3 (warstwa UI importu
> i stagingu, blok I14 w §5); w odróżnieniu od I13 **nie blokuje cutoveru**. Poza I13, I14
> i tymi dwoma zdarzeniami żadna kolejna sesja programistyczna nie jest przewidziana w tym
> dokumencie.

**Zrobione w 12e (patrz blok Sesja 12e w §5 po szczegóły):**
- Audyt bezpieczeństwa (auth, CORS, JWT, mass-assignment) — bez otwartych dziur; luka procesu
  w testach auth zamknięta testem skanującym rejestr Express.
- Sidebar ujednolicony przez router (`AppShell` w `App.tsx`) — nota z I8 zamknięta, przy okazji
  naprawiona martwa wirtualizacja katalogu.
- Potwierdzenia ujednolicone do `DialogPotwierdzenia` (poza świadomym wyjątkiem
  `konfiguracja/Katalog.tsx`).
- Backlog rozliczony w `docs/rebuild-backlog.md`: **#36 ✅, #49 ✅, #51 ✅** (naprawione);
  **#45 ❌, #48 ❌, #50 ❌** (świadomie pominięte, z notą uzasadnienia przy każdym wpisie);
  **#52** rozstrzygnięty na stałe (odstępstwo D1 z I1 zostaje). Pozostałe ⬜ w backlogu
  (#11, #12, #19, #21, #25, #26, #31–#35, #39–#43) to **defekty PRODUKCJI odtworzone świadomie
  1:1** — żaden nie jest regresją odbudowy i żaden nie blokuje cutoveru; czekają na decyzję Ani
  po cutoverze.

**Zostaje jako zdarzenie poza odbudową:**
- **Przegląd 12 widoków przez Anię** — checklista gotowa w `docs/przeglad-12-widokow.md`
  (12 sekcji + logowanie, „wygląda inaczej i to OK", „znane i nienaprawione"). Sam przegląd
  klika Ania na stagingu (test.agritires.eu).
- **Cutover (big-bang)** — plan gotowy w `docs/cutover.md`: przełączenie Apache/PM2 na nowy
  stos, ta sama baza `data.db`. Warunki wstępne (zielony przegląd Ani, zielone bramki, kopia
  bazy), weryfikacja schematu przed migracją, migracje 001→003, różnice env staging vs
  produkcja, kroki przełączenia, rollback, smoke-testy. **To dokument — wykonanie jest osobnym
  zdarzeniem z Anią**, poza zakresem tej roadmapy.

> ⚠ **Fakt dla cutoveru i dla przeglądu 12 widoków (ustalony w 13e, 2026-09-09): kolumna
> „Konstrukcja opony" jest dziś w ŻYWEJ produkcji PUSTA.** Łatka pass-through z 2026-09-01 11:22
> trafiła do MARTWEGO bundla `index-BRIDGEONE21783342500.js`, a `mirror/frontend/index.html:16`
> ładuje `index-PRICEFMT1783512500.js` — więc po migracji `konstrukcja` na pełne słowa produkcja
> pokazuje „—" w tej kolumnie i pustą kolumnę w eksporcie CSV dla 7392 wierszy. **Odbudowa jest
> POPRAWNA** (pass-through od 13c, decyzja D4 w bloku 13e), więc po cutoverze Ania zobaczy tam
> pełne słowa zamiast kresek. To zmiana na lepsze, ale ma prawo ją zaskoczyć — uprzedzić przy
> przeglądzie widoków. Naprawa po stronie produkcji (przeniesienie łatki do żywego bundla) to
> robota na VPS, nie w odbudowie.

Fixtures/kontrakt: 73 nagrania / 96 ścieżek — 12 operacji zapisujących z D3 (12d) mają nagranie,
reszta zapisujących tras lokalnych zostaje bez fixtures (Follow-up 38, `contract/README.md`).
12e nie zmieniła kształtu ani wartości żadnej odpowiedzi API — `contract/` nietknięty.

*Utworzono 2026-08-20 (Faza 3–4). Zamknięte 2026-09-08 (12e, `39-CHORE-audyt-bezpieczenstwa-domkniecie`)
— dalsze zmiany tego pliku to już follow-up po cutoverze, nie kontynuacja planu odbudowy.*
