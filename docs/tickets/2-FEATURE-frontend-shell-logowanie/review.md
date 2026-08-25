# 2-FEATURE-frontend-shell-logowanie — Code review

> Reviewed: 2026-08-25
> Branch: `feature/2-frontend-shell-logowanie`
> Diff: 49 plików (+9253), 4 commity

Weryfikacja uruchomieniowa (Node 20.20.2, worktree ticketa): `npm run lint` ✓,
`npm run typecheck` ✓, `npm test` ✓ 44/44, `npm run build` ✓ (`dist/` powstaje),
`npm run test:integracja` ✓ 6/6 przeciw żywemu backendowi. Czysty `npm ci` z lockfile ✓
(280 pakietów, lockfileVersion 3, spójny z `package.json`).

## BLOCKER

- [ ] `rebuild/frontend/tailwind.config.ts:30-49` — brak mapowania kolorów `*-border`, przez co klasy `border-primary-border` / `border-secondary-border` / `border-destructive-border` z oryginalnego `Button` (`src/components/ui/button.tsx:16-19`) **nie generują żadnej reguły CSS**.
  - Reason: produkcja ma je wprost — `mirror/frontend/assets/index-BVOkSOnE.css`: `.border-primary-border{border-color:var(--primary-border)}`, `.border-destructive-border{...}`, `.border-secondary-border{...}`. W naszym `dist/assets/index-*.css` tych selektorów nie ma w ogóle (`grep -c` → 0), a jedyne wygenerowane `border-color` to `--border`, `--card-border`, `--input`, `--sidebar-border`, `--button-outline`, `transparent`. Efekt: przycisk `variant="default"` ma `border` bez własnego koloru, więc dziedziczy `* { @apply border-border }` = `hsl(215 16% 88%)` — blada szara obwódka zamiast ciemniejszego bursztynu `--primary-border` (`hsl(from primary h s calc(l - 8))`). Widać to na CTA „Zaloguj się", czyli na sztandarowym ekranie tego ticketa. Tokeny `--primary-border` itd. są w `src/styles/index.css:135-165` zdefiniowane poprawnie — brakuje wyłącznie mostka do Tailwinda.
  - Suggestion: dodać do `theme.extend.colors` klucze `border` pod `primary`, `secondary`, `destructive`, `muted`, `accent` oraz `sidebar.primary`/`sidebar.accent` z wartością surową `"var(--primary-border)"` (bez `hsl()` i bez `<alpha-value>` — produkcja też nie ma tam kanału alfa).

- [ ] `tools/deploy-staging.sh:27` + `:61` + `:76` — `NODE_ENV=production` jest eksportowane przed oboma krokami build, więc `npm ci` **pomija devDependencies** i build nie ma czym się wykonać.
  - Reason: zweryfikowane empirycznie na tym lockfile — `npm ci` → 280 pakietów, `NODE_ENV=production npm ci` → 40 pakietów i pusty `node_modules/.bin` (brak `vite`, brak `tsc`). Skrypt ma `set -euo pipefail`, a backend buduje się pierwszy (`tsc -p tsconfig.build.json` przy `typescript` w devDeps), więc pierwszy deploy po merge'u przerwie się na `tsc: not found` i staging zostanie na placeholderze. To wywraca DoD „Ania widzi `/login` pod `test.agritires.eu`" i punkt „kontrakt deployu: `npm ci && npm run build` → `dist/`". Plik pochodzi z Iteracji 0, ale ten ticket jest pierwszym, który realnie odpala tę ścieżkę (guard z `:47` do tej pory pomijał build), więc problem ujawnia się dopiero teraz i blokuje właśnie ten ticket.
  - Suggestion: w obu krokach build użyć `npm ci --include=dev` (albo `NODE_ENV=development npm ci`); `npm ci --omit=dev` w `$RELEASE` (`:64`) zostaje bez zmian.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/components/ThemeProvider.tsx:33-40` — efekt zapisuje `bridge_theme` przy KAŻDYM montażu, nie tylko przy przełączeniu; już pierwsza wizyta utrwala aktualną preferencję systemową i aplikacja przestaje za nią podążać na zawsze.
  - Reason: O2 zatwierdza „zapis wyboru użytkownika", a nie zamrożenie `prefers-color-scheme`. Użytkownik, który nigdy nie kliknął przełącznika, po przejściu systemu w tryb ciemny zostanie w jasnym. Odstępstwo wychodzi poza to, co zatwierdzono.
  - Suggestion: zapisywać w handlerze `toggle`, a efekt zostawić wyłącznie do sterowania klasą `dark`.

- [ ] `rebuild/frontend/test/` — nic nie weryfikuje `credentials: "include"`, mimo że to pozycja z Definition of done i jedyny mechanizm sesji, gdy tokenu nie ma.
  - Reason: MSW nie widzi `credentials`, więc `test/api.test.ts:75` i `test/queryClient.test.ts:316` mimo nazw („wysyła cookie", „zawsze wysyła cookie") tego nie sprawdzają, a test integracyjny świadomie omija tę ścieżkę (`test/integracja/logowanie.integracja.test.ts:13-16`). Refaktor gubiący `credentials` przejdzie CI i wywali się dopiero na stagingu.
  - Suggestion: `vi.spyOn(globalThis, "fetch")` i asercja na drugim argumencie w `zadanie()` oraz w `zapytanieZwracajaceNullNa401`.

- [ ] `rebuild/frontend/test/tokeny.test.ts:74-92` — strażnik porównuje wyłącznie deklaracje z `:root`/`.dark`, więc nie widzi, czy klasy używane w kodzie faktycznie coś generują.
  - Reason: to dokładnie ten test, który miał chronić przed rozjazdem wyglądu, a przepuścił BLOCKER #1 (tokeny `--primary-border` są 1:1, tylko nikt ich nie renderuje). Test daje fałszywe poczucie bezpieczeństwa również kolejnym iteracjom.
  - Suggestion: dorzucić przypadek czytający zbudowany albo wygenerowany przez PostCSS arkusz i sprawdzający obecność selektorów dla listy klas przepisanych z oryginału (`border-primary-border`, `bg-sidebar`, `border-card-border`, `text-sidebar-foreground/80`, `bg-destructive/10`…).

- [ ] `rebuild/frontend/vite.config.ts:16` — `sourcemap: true` publikuje ~700 kB map źródłowych do publicznego docroota (`tools/deploy-staging.sh:78` rsynkuje całe `dist/` bez wykluczeń, a `deploy/staging/htaccess` nie ma żadnej autoryzacji).
  - Reason: pełne źródła TS panelu stają się dostępne pod `test.agritires.eu`. Produkcja map nie serwuje (`mirror/frontend/index.html` linkuje tylko bundle).
  - Suggestion: `sourcemap: false` dla builda albo wykluczenie `*.map` w rsyncu.

- [ ] `rebuild/frontend/test/logowanie.test.tsx:118` — asercja podciągiem (`toHaveTextContent`) maskuje realny tekst pokazywany użytkownikowi.
  - Reason: przy 401 `zadanie()` rzuca zanim `zaloguj()` sięgnie po `dane.error`, więc w `text-login-error` ląduje `401: {"error":"Nieprawidłowy email lub hasło"}` — surowy JSON ze statusem. Zachowanie jest **wierne oryginałowi** (`frontend-index.js:9031-9038` + `:9085-9097`) i nie jest błędem, ale plan.md („komunikat »Nieprawidłowy email lub hasło«") i raport.md („pokazuje komunikat backendu") sugerują coś innego — ktoś w kolejnej iteracji „poprawi" to jako literówkę.
  - Suggestion: asercja na dokładny string + jedno zdanie komentarza, że tak wygląda produkcja.

- [ ] `rebuild/frontend/package.json:12` — `build` = `npm run typecheck && vite build`, a `typecheck` (`:15`) obejmuje `tsconfig.test.json`.
  - Reason: produkcyjny build na stagingu wymaga wtedy `vitest`, `@testing-library/*` i `msw`. Kontrakt deployu robi się szerszy, niż musi, i splata się z BLOCKER #2.
  - Suggestion: `build` = `tsc --noEmit -p tsconfig.json && vite build`, a pełny `npm run typecheck` dopisać jawnie do joba `frontend` w `.github/workflows/ci.yml` (dziś CI go nie woła osobno).

- [ ] `docs/incoming/frontend-perplexity/dokumentacja/04_DESIGN_TOKENS.md`, `01_WARSTWA_WSPOLNA.md` — korekty zapowiedziane w plan.md (6 rozjazdów wartości, „NIEZNANY" mechanizm zapisu motywu, nieistniejące `refetchOnReconnect`, zakres ochrony tras) nie są w diffie.
  - Reason: to pozycja Definition of done. Jeśli zostaje na Fazę 5 (dokumentacja), trzeba ją domknąć przed zamknięciem ticketa — inaczej kolejna iteracja weźmie te pliki jako źródło i odtworzy błędne wartości.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/lib/api.ts:108` — `const maBody = body !== undefined`, a oryginał testuje prawdziwość (`headers: _g(!!n)`, `body: n ? JSON.stringify(n) : void 0`, `frontend-index.js:9045-9052`). Różnica ujawnia się tylko dla `null`/`0`/`""`/`false` jako body; dziś nikt tak nie woła, ale to cicha rozbieżność w warstwie oznaczonej „wierne odtworzenie".
- [ ] `rebuild/frontend/src/components/ui/button.tsx:18` — wariant `outline` zgubił `shadow-xs` z oryginału (`:16187`). Bez skutku wizualnego (produkcyjny arkusz nie generuje `.shadow-xs` w ogóle), ale warto odnotować w komentarzu, żeby nie wyglądało na przeoczenie.
- [ ] `rebuild/frontend/src/components/AppShell.tsx:49` — dodany `aria-label` na hamburgerze, którego oryginał (`:16348-16357`) nie ma. Zmiana na plus, ale to nieudokumentowane odstępstwo — dopisać jako O6 do README/raportu, żeby lista pozostała kompletna.
- [ ] `rebuild/frontend/src/styles/index.css:83-128` — blok `.dark` pomija 8 tokenów `--shadow-*`, które produkcja powtarza z identycznymi wartościami jak w `:root`. Efektywnie zero różnicy (dlatego test przechodzi), ale D3 deklarowało przepisanie „dosłownie 1:1".
- [ ] `docs/tickets/2-FEATURE-frontend-shell-logowanie/raport.md` — brak zbiorczej listy O1–O5 (jest tylko w `rebuild/frontend/README.md:103-109`, a raport wspomina O1–O4 mimochodem). DoD mówi wprost „wypisane w `raport.md`".
- [ ] `rebuild/frontend/index.html:5` — `maximum-scale=1` blokuje zoom na telefonie. Wierne produkcji (`mirror/frontend/index.html:5`), więc nie ruszać w tym tickecie; kandydat na wpis w `docs/rebuild-backlog.md`.
- [ ] `rebuild/frontend/test/api.test.ts:75`, `test/queryClient.test.ts:316` — nazwy testów obiecują sprawdzenie cookie, a asercje dotyczą wyłącznie nagłówka `Authorization`. Po naprawie SHOULD-FIX #2 nazwy zaczną odpowiadać treści.

## Plan compliance

### Done ✓
- Krok 1 — szkielet projektu: `package.json` ze skryptami, których szuka CI (`lint`, `test`, `build`), `vite.config.ts` (`base:"/"`, `outDir:"dist"`, proxy `/api`), trzy tsconfigi, ESLint, `.nvmrc`, `index.html` z tytułem/faviconem/fontami z produkcji, `.worktrees/` w korzeniowym `.gitignore`.
- Krok 2 — design tokens: `src/styles/index.css` = pełny `:root`/`.dark` z `mirror/frontend/assets/index-BVOkSOnE.css` (60 tokenów w `:root`, zero rozjazdów wartości — sprawdziłem własnym parserem), utility `hover-elevate`/`active-elevate-2`/`toggle-elevate` przepisane 1:1, `tailwind.config.ts` mapuje skalę kolorów **poza** wariantami `*-border` (BLOCKER #1).
- Krok 3 — `src/lib/api.ts`, `src/lib/auth.ts`: kolejność `ustawZapamietaj` przed żądaniem, `email.trim()`, Bearer tylko z tokenem, `Content-Type` tylko z body, format błędu `"<status>: <treść>"`, czyszczenie obu magazynów, klucze `bridge_auth_token`/`bridge_user`/`bridge_remember` dosłownie jak w oryginale, typ `Uzytkownik` = `{id,email,imieNazwisko}` z `GET_me.json`. Zgodne z `frontend-index.js:8996-9110` linia po linii.
- Krok 4 — `src/lib/queryClient.ts`: `queryKey.join("/")`, 401 → `null`, `refetchInterval/refetchOnWindowFocus:false`, `staleTime:Infinity`, `retry:false` + mutacje `retry:false`.
- Krok 5 — motyw (`:16228-16241` + O2), logo (SVG znak po znaku zgodny z `:16244-16285`), guard (`:27789-27801` + O5).
- Krok 6 — `Button`/`Input`/`Label`/`Card` przepisane z `:16183-16220`, `:20478-20488`, `:20518-20528`, `:16479-16533`; `cn` = clsx + tailwind-merge; `PageHeader` = `hn` (`:16458-16478`).
- Krok 7 — `AppShell` odtworzony klasa po klasie z `:16329-16456`: mobilny header `md:hidden h-14`, `aside w-64`, overlay, stopka (toggle → avatar z inicjałami → „Moje konto" → „Wyloguj" z `wyloguj()` + `queryClient.clear()` + `/login`), `main#$vMainScroll` z wrapperem `px-4 sm:px-6 lg:px-8 py-6 md:py-8 max-w-[1400px]`. Wszystkie `data-testid` zachowane.
- Krok 8 — `/login` 1:1 z `:26391-26509` (teksty PL, kolejność pól, `tabIndex={-1}` i `aria-label` na przełączniku hasła, checkbox, blok błędu, stan „Logowanie…") minus O4.
- Krok 9 — 12 tras routera (`/login` + 11 placeholderów) + catch-all 404; drzewo providerów bez Toastera/Tooltipa zgodnie z planem.
- Krok 10 — testy: 6 plików, 44 testy jednostkowe/komponentowe + 6 integracyjnych; mock budowany programowo z `contract/fixtures/GET_me.json` (`test/msw/kontrakt.ts:147-154`), nie przepisany ręcznie.
- Krok 11 — README frontendu z uruchomieniem, dev-proxy, testami, kontraktem buildu i tabelą O1–O5.
- Out of scope respektowany: brak treści 11 widoków, brak Toastera/TooltipProvidera, brak reszty shadcn/ui, nic z iteracji 7/8/11/12 nie wsiąkło.

### Missing or deviating ✗
- `tailwind.config.ts` nie zamyka Kroku 2 do końca — mapowanie tokenów jest niepełne (BLOCKER #1), przez co część klas przepisanych z produkcji jest martwa.
- Korekty do `04_DESIGN_TOKENS.md` i `01_WARSTWA_WSPOLNA.md` z Kroku 11 / Fazy 5 nie ma w diffie.
- Dwa nieudokumentowane drobne odstępstwa poza listą O1–O5: `aria-label` na hamburgerze (`AppShell.tsx:49`) oraz truthiness body w `zadanie()` (`api.ts:108`).

### Definition of done
- [x] `rebuild/frontend/` spełnia kontrakt deployu: `npm ci && npm run build` → `dist/` — zweryfikowane na czystym `npm ci` z lockfile. **Uwaga:** sam skrypt deployu tego kontraktu nie wykona z powodu BLOCKER #2.
- [x] `/login` odtworzony 1:1 wg `frontend-index.js:26391-26509` (minus O4), teksty PL, `data-testid` zachowane — z zastrzeżeniem koloru obramowania CTA (BLOCKER #1).
- [x] Shell z ciemnym sidebarem: 10 pozycji w kolejności z oryginału + stopka; 12 tras w routerze.
- [x] Przepływ auth 1:1: `email.trim()`, Bearer tylko gdy token, `credentials:"include"` równolegle, `bridge_user`, „remember me" przełączające store.
- [x] QueryClient: `on401:"returnNull"`, `staleTime:Infinity`, `retry:false`, `refetchOnWindowFocus:false`, klucz `queryKey.join("/")`.
- [ ] Design tokens = pełny `:root`/`.dark` z produkcyjnego CSS; Inter + JetBrains Mono ładowane — **wartości tokenów tak, ale trzy klasy z oryginału nie renderują się** (BLOCKER #1).
- [x] Testy jednostkowe warstwy auth + przepływ logowania przeciw mockowi z `contract/fixtures/GET_me.json` — zielone (44/44).
- [x] Test integracyjny przeciw żywemu `rebuild/backend` — uruchomiony przeze mnie w worktree, 6/6 zielonych, wynik zgodny z raportem.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — zielone.
- [ ] Zatwierdzone odstępstwa (O1–O5) wypisane w `raport.md`; korekty do `04_DESIGN_TOKENS.md` i `01_WARSTWA_WSPOLNA.md` naniesione — lista O1–O5 jest w README, nie w raporcie; korekt w docs brak (Faza 5 przed nami).
- [x] README `rebuild/frontend/`.

## Parallel-test concerns

Brak realnych kolizji — testy nadają się do równoległej pracy w wielu oknach.

- `npm test` jest hermetyczny: jsdom + MSW, zero portów, zero plików tymczasowych, `localStorage`/`sessionStorage` czyszczone w `test/setup.ts:202-207`, stan modułowy resetowany przez `zapiszToken(null)` + `_zresetujStanSesji()` w każdym `beforeEach`.
- `npm run test:integracja` bierze **wolny port** (`test/integracja/logowanie.integracja.test.ts:40-54`) i **świeży katalog tymczasowy** (`mkdtempSync`, `:80`), a `DB_PATH` przekazuje jawnie do `seed:dev` i do serwera — dwie instancje w dwóch worktree nie wejdą sobie w drogę. Jedyne teoretyczne ryzyko to wyścig „zwolniony port zajęty przez kogoś innego zanim backend go zajmie"; przy `fileParallelism:false` i jednym pliku jest znikome, nie warto komplikować.
- Nic nie pisze do współdzielonej bazy, nie zajmuje stałego portu ani nie dotyka `rebuild/backend/data/`.

## Overall assessment

Bardzo solidna robota jak na fundament: warstwa auth, QueryClient, shell i `/login` są przepisane
z bundla praktycznie linia po linii (sprawdziłem każdy z tych plików wobec wskazanych zakresów
`deminified/frontend-index.js` — kolejność operacji, klucze storage, teksty PL i `data-testid`
zgadzają się), testy realnie coś weryfikują (mock budowany z fixtura, integracja przeciw żywemu
backendowi, mutacyjnie sprawdzony strażnik tokenów), a odstępstwa są świadome i opisane.
Kierunek jest dobry i nic tu nie trzeba przerabiać koncepcyjnie.

Dwie rzeczy blokują merge i obie są jednolinijkowe. Pierwsza to luka w `tailwind.config.ts`:
tokeny `*-border` są przepisane co do znaku, ale nie mają mostka do Tailwinda, więc trzy klasy
z oryginalnego `Button` nie generują żadnej reguły i CTA na `/login` dostaje szarą obwódkę
zamiast bursztynowej — a strażnik tokenów tego nie łapie, bo patrzy tylko na deklaracje zmiennych.
Druga leży poza tym diffem, ale zabija DoD tego ticketa: `NODE_ENV=production` w `deploy-staging.sh`
sprawia, że `npm ci` nie zainstaluje `vite` ani `tsc`, więc pierwszy deploy po merge'u przerwie się
i Ania nie zobaczy `/login` na stagingu. Reszta uwag to porządki, które warto zrobić teraz,
zanim na tym fundamencie stanie jedenaście widoków.
