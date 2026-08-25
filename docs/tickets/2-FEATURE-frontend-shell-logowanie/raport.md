# 2-FEATURE-frontend-shell-logowanie — Raport z implementacji

## Summary

Powstał `rebuild/frontend/` — szkielet nowego panelu (React 18 · Wouter v3 · TanStack Query ·
Radix/shadcn · Tailwind, budowany Vite + TypeScript) z widokiem `/login` i ramą aplikacji
odtworzonymi 1:1 z produkcyjnego bundla. Design tokens przepisano dosłownie z odnalezionego
produkcyjnego arkusza CSS, a wierności pilnuje test porównujący je automatycznie.
Logowanie jest zweryfikowane nie tylko przeciw mockowi z fixtures, ale też **end-to-end
przeciw prawdziwemu backendowi z Iteracji 1a**.

## Changes

**Nowe — konfiguracja projektu**
- `rebuild/frontend/package.json` — skrypty zgodne z tym, czego szuka CI (`lint`, `test`, `build`); `build` = typecheck + Vite
- `rebuild/frontend/vite.config.ts` — `base:"/"`, `outDir:"dist"`, proxy `/api` → `127.0.0.1:5001` (dev same-origin jak staging)
- `rebuild/frontend/tsconfig.json` / `tsconfig.test.json` / `tsconfig.node.json` — `src/` bez typów Node, testy z nimi
- `rebuild/frontend/tailwind.config.ts` — mapowanie tokenów na skalę Tailwinda pod nazwy klas z oryginału
- `rebuild/frontend/eslint.config.js`, `postcss.config.js`, `.nvmrc` (20), `.gitignore`
- `rebuild/frontend/index.html` — `lang="pl"`, tytuł i favicon z produkcji; fonty ograniczone do Inter + JetBrains Mono
- `rebuild/frontend/vitest.config.ts`, `vitest.integracja.config.ts`
- `rebuild/frontend/README.md` — uruchomienie, testy, kontrakt deployu, zasady i odstępstwa

**Nowe — kod aplikacji**
- `src/styles/index.css` — pełny `:root`/`.dark` przepisany z `mirror/frontend/assets/index-BVOkSOnE.css` + utility `hover-elevate`/`active-elevate-2`/`toggle-elevate`
- `src/lib/api.ts` — warstwa HTTP wg `frontend-index.js:8996-9053`: nagłówki, token, wybór magazynu, format błędu
- `src/lib/auth.ts` — sesja wg `:9080-9110`: `zaloguj`, `wyloguj`, `pobierzUzytkownika`
- `src/lib/queryClient.ts` — QueryClient wg `:9054-9079` (klucz = `queryKey.join("/")`, 401 → `null`)
- `src/lib/utils.ts` — `cn` (odpowiednik `Ce`)
- `src/components/AppShell.tsx` — rama wg `:16329-16456`
- `src/components/nawigacja.ts` — 10 pozycji wg `:16287-16327`
- `src/components/AuthGate.tsx` — ochrona tras wg `:27789-27801`
- `src/components/ThemeProvider.tsx` — motyw wg `:16228-16241` (+ O2)
- `src/components/Logo.tsx` — SVG wg `:16244-16285`
- `src/components/PageHeader.tsx` — wg `:16458-16478`
- `src/components/ui/{button,input,label,card}.tsx` — wg `:16183-16220`, `:20478-20488`, `:20518-20528`, `:16479-16533`
- `src/pages/Login.tsx` — wg `:26391-26509` (minus O4)
- `src/pages/NotFound.tsx` — wg `:16534-16556` (+ O3)
- `src/pages/WidokWPrzygotowaniu.tsx`, `src/pages/placeholdery.ts` — 11 tras-placeholderów
- `src/App.tsx`, `src/main.tsx` — drzewo providerów i router wg `:28640-28699` (+ O1)

**Nowe — testy**
- `test/api.test.ts`, `test/auth.test.ts`, `test/queryClient.test.ts` — logika warstwy auth
- `test/logowanie.test.tsx` — przepływ logowania w UI
- `test/shell.test.tsx` — sidebar, nawigacja, motyw, wylogowanie
- `test/tokeny.test.ts` — strażnik wierności design tokenów
- `test/setup.ts`, `test/msw/server.ts`, `test/msw/kontrakt.ts` — środowisko testowe
- `test/integracja/logowanie.integracja.test.ts` — FE ↔ żywy backend, bez mocków

**Zmienione (poza `rebuild/frontend/`)**
- `.gitignore` — dopisane `.worktrees/` (procedura `feature.md` zakładała, że tam jest, a nie było)
- `tools/deploy-staging.sh` — `npm ci --include=dev` w obu krokach build (patrz „Review fixes applied")
- `.github/workflows/ci.yml` — job `frontend` woła teraz `npm run typecheck` jawnie

## Deviations from plan

Plan zrealizowany 1:1 co do zakresu. Dwie korekty techniczne podjęte w trakcie, bez wpływu
na zachowanie aplikacji:

1. **Rozdzielenie konfiguracji TypeScriptu na `tsconfig.json` + `tsconfig.test.json`.**
   Plan przewidywał jedną. Testy muszą sięgać po API Node (odczyt fixtures, start backendu),
   ale wpuszczenie typów Node do wspólnej konfiguracji pozwoliłoby użyć `process` w kodzie
   przeglądarkowym. `src/` zostaje czysto przeglądarkowe.
2. **`fetch` w `zadanie()` dostaje `body` przez rozwinięcie obiektu**, a nie jako
   `body: undefined` — wymóg `exactOptionalPropertyTypes`. Zachowanie identyczne.

## Zatwierdzone odstępstwa od oryginału

Domyślnie odtwarzamy zachowanie 1:1. Poniżej KOMPLETNA lista miejsc, w których świadomie
odeszliśmy od produkcji. O1–O5 zatwierdził użytkownik w fazie pytań; O6 dołożone po review.

| # | Odstępstwo | Powód |
|---|---|---|
| O1 | routing po ścieżkach zamiast po hashu (`/katalog`, nie `/#/katalog`) | hash był obejściem Replita; `.htaccess` stagingu ma poprawny SPA fallback |
| O2 | zapis wybranego motywu w `localStorage.bridge_theme` | oryginał nie zapisywał — wybór ginął po odświeżeniu |
| O3 | ekran 404 po polsku i na design tokenach | oryginał miał angielski tekst poza tokenami, jedyny taki ekran |
| O4 | pominięte konta testowe z hasłami w kodzie i martwy `list="konta-testowe-email"` | wyciek danych logowania; atrybut wskazywał na nieistniejącą `<datalist>` |
| O5 | stan „Ładowanie…" w `AuthGate` zamiast `null` | oryginał migał białym ekranem przed przekierowaniem na `/login` |
| O6 | `aria-label` na przycisku menu mobilnego | oryginał miał tam samą ikonę, bez nazwy dla czytnika ekranu |

Świadomie NIE „poprawione", mimo że kuszą — bo tak działa produkcja: brak globalnego
auto-wylogowania po 401, brak wołania `GET /api/me` (FE ufa `bridge_user`), komunikat błędu
logowania w postaci `401: {"error":"…"}` zamiast samego tekstu, `maximum-scale=1` blokujące
zoom na telefonie.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** **N/D w wersji z Kroku 9** — ten ticket nie implementuje
  API, tylko je konsumuje; GATE porównujący odpowiedzi backendu z `contract/fixtures/`
  należy do sesji 1a i jest tam zaliczony. Lustrzane zobowiązanie frontendu zostało
  zweryfikowane:
  - **`contract/fixtures/GET_me.json`** — czytany w testach programowo (`test/msw/kontrakt.ts`),
    nie przepisany ręcznie; typ `Uzytkownik` (`{id, email, imieNazwisko}`) i mocki `/api/login`
    są z niego budowane, więc zmiana kształtu fixtura wywali testy.
  - **`POST /api/login`, `POST /api/logout`, `GET /api/me`** (`contract/openapi.yaml:675-696,752-758`)
    — zweryfikowane przeciw **żywemu backendowi**, nie przeciw opisowi: kształt żądania
    (`{email, password}` z przyciętym e-mailem), kody 400/401/200, kształt `user`,
    obecność cookie `bridge_session`, payload `/api/me` z `iat`/`exp`.
- **Unit + komponentowe:** ✓ **48 testów, 6 plików** (`npm test`) — bez backendu, żądania przez MSW.
- **Integracyjne (bez mocków):** ✓ **6 testów** (`npm run test:integracja`) — prawdziwy
  `rebuild/backend` na wolnym porcie, świeża baza, zasiany użytkownik; złe hasło, puste pola,
  udane logowanie, cookie sesji, `GET /api/me`, 401 → `null` po wylogowaniu.
- **Strażnik design tokenów:** ✓ — dwie warstwy. Pierwsza porównuje efektywne wartości
  wszystkich tokenów obu motywów z `mirror/frontend/assets/index-BVOkSOnE.css`; druga
  uruchamia prawdziwy potok PostCSS + Tailwind i sprawdza, że klasy przepisane z oryginału
  FAKTYCZNIE generują reguły. Obie sprawdzone **testami mutacyjnymi**: zmiana `--primary`
  o 1% jasności wywala pierwszą, usunięcie mapowania `primary.border` — drugą.
- **Ochrona cookie:** ✓ — `credentials:"include"` weryfikowane szpiegiem na `fetch`
  (MSW tej opcji nie widzi). Sprawdzone mutacyjnie: usunięcie opcji wywala test.
- **Lint / typecheck / build:** ✓ zielone. Build produkuje `dist/` (index.html 1,67 kB,
  CSS 25,97 kB, JS 230,61 kB; bez sourcemap).
- **Smoke zbudowanej aplikacji:** ✓ `dist/` serwowany przez `vite preview` oddaje poprawny
  `<title>`, assety i obsługuje SPA fallback na `/login` (200).
- **E2E w przeglądarce:** pominięte świadomie — Playwrighta nie ma w repo, a test integracyjny
  pokrywa realny kontrakt z backendem.

## Breaking changes

Brak w sensie API. Dwie zmiany operacyjne, które wchodzą w życie po merge'u:

1. **Staging zacznie budować i wdrażać aplikację.** `tools/deploy-staging.sh:47` pomijał build,
   dopóki brakowało `rebuild/frontend/package.json`. Teraz oba warunki są spełnione, więc
   pierwszy deploy po merge'u podmieni placeholder na realny panel. To jest cel Iteracji 1,
   ale warto wiedzieć, że stanie się automatycznie.
2. **Adresy widoków bez hasha** (odstępstwo O1) — zakładki ze starego panelu w formie
   `/#/katalog` nie przeniosą się 1:1 na nowy staging.

## Review fixes applied

Reviewer zgłosił 2 BLOCKER, 7 SHOULD-FIX i 7 NICE-TO-HAVE. Oba blokery potwierdziłem
empirycznie, zanim je naprawiłem.

**BLOCKER 1 — martwe klasy obramowań przycisków.** `tailwind.config.ts` nie mapował tokenów
`*-border`, więc `border-primary-border` / `-secondary-` / `-destructive-` z `Button` nie
generowały żadnej reguły: CTA „Zaloguj się" dostawało szarą obwódkę z `* { border-border }`
zamiast bursztynowej. Potwierdzone: `grep` po `dist/assets/*.css` → 0 trafień, przy
`.border-primary-border{border-color:var(--primary-border)}` obecnym w arkuszu produkcji.
Dodałem mapowania jako wartości SUROWE (`var(--primary-border)`, bez `hsl()` i `<alpha-value>`)
— wygenerowana reguła jest teraz znak w znak taka jak produkcyjna.

**BLOCKER 2 — deploy stagingu nie zbudowałby aplikacji.** `tools/deploy-staging.sh:27`
eksportuje `NODE_ENV=production`, przy którym `npm ci` pomija devDependencies. Zweryfikowane
na naszym lockfile: 383 pakiety normalnie vs **23** z `NODE_ENV=production`, bez `vite`
i bez `tsc` w `node_modules/.bin`. Przy `set -euo pipefail` pierwszy deploy po merge'u
przerwałby się na `tsc: not found` i Ania zostałaby z placeholderem — czyli DoD tej iteracji
nie zostałby spełniony. Zmieniłem oba kroki build na `npm ci --include=dev`
(`npm ci --omit=dev` dla release'u backendu zostaje bez zmian) i potwierdziłem, że przy
`NODE_ENV=production` instaluje się komplet.

**SHOULD-FIX — naprawione wszystkie:**
- `ThemeProvider` zapisywał motyw przy każdym montażu, więc pierwsza wizyta zamrażała
  `prefers-color-scheme` na zawsze. Zapis przeniesiony do `toggle` (O2 zatwierdzało
  utrwalanie *wyboru*, nie zamrożenie preferencji systemu); doszedł test regresyjny.
- Dodane testy `credentials:"include"` dla `zadanie()` i `queryFn` — MSW tej opcji nie widzi,
  więc podglądamy wywołanie `fetch`. Wcześniej testy miały to w nazwie, ale nie sprawdzały.
- Strażnik tokenów rozszerzony o drugą warstwę (patrz „Test results") — to on przepuścił
  BLOCKER 1, bo patrzył wyłącznie na deklaracje zmiennych.
- `sourcemap: false` — `deploy-staging.sh` rsynkuje całe `dist/` do publicznego docroota
  bez autoryzacji, więc ~700 kB map wystawiłoby pełne źródła panelu w internet.
- Asercja na DOKŁADNY komunikat błędu logowania: użytkownik widzi
  `401: {"error":"Nieprawidłowy email lub hasło"}`, bo `rzucGdyBlad` rzuca zanim `zaloguj()`
  sięgnie po pole `error`. To jest wierne oryginałowi — asercja i komentarz mają powstrzymać
  kolejną iterację przed „poprawieniem" tego jako literówki.
- `build` zawężony do `tsc -p tsconfig.json && vite build`, żeby produkcyjny build nie
  wymagał `vitest`/`msw`/`@testing-library`; pełny `typecheck` dopisany jawnie do CI.

**NICE-TO-HAVE — zrobione:** truthiness `body` w `zadanie()` zgodnie z oryginałem
(`Boolean(body)` zamiast `!== undefined`); przywrócony `shadow-xs` w wariancie `outline`
z komentarzem, że ani produkcja, ani Tailwind 3 nie generują dla niego reguły; `aria-label`
na hamburgerze udokumentowany jako **O6**; cienie dopisane do `.dark` dla dosłowności D3;
lista O1–O6 wprost w tym raporcie; nazwa klasy w komentarzu `NotFound.tsx` przestała
generować martwą regułę w bundlu.

**Odrzucone:** brak — wszystkie uwagi zaadresowane. Uwaga o `maximum-scale=1` blokującym
zoom zostaje świadomie niezmieniona (wierność produkcji), odnotowana w „Follow-up".

## Follow-up

Rzeczy zauważone przy okazji, świadomie NIE zrobione w tym tickecie:

0. **`maximum-scale=1` w `index.html`** blokuje zoom na telefonie (problem dostępności).
   Wierne produkcji (`mirror/frontend/index.html:5`), więc nie ruszam w tym tickecie —
   kandydat na świadomą decyzję przy przeglądzie z Anią (Iteracja 12).
1. **Test integracyjny FE↔BE poza CI.** Job `frontend` w `.github/workflows/ci.yml` instaluje
   wyłącznie `rebuild/frontend`, więc `npm run test:integracja` uruchamiam lokalnie.
   Wpięcie go w CI (osobny job instalujący oba pakiety) to zadanie infrastrukturalne —
   warte zrobienia, zanim liczba endpointów urośnie.
2. **Kolejność reguł w `deploy/staging/htaccess`.** Wymuszenie HTTPS (reguła 3) stoi PO
   SPA fallbacku (reguła 2), który kończy się `[L]`. Żądanie HTTP trafia najpierw w rewrite
   do `index.html`, a przekierowanie na HTTPS łapie dopiero drugi przebieg. Działa, ale jest
   krucha — HTTPS powinno być pierwsze, zaraz za wyjątkiem na `.well-known`. Nie ruszam,
   bo to plik z Iteracji 0 i zmiana dotyka żywego stagingu.
3. **Brak globalnego wylogowania po 401.** Wierne oryginałowi: zapytania odczytowe zwracają
   `null`, mutacje rzucają. Wygasła sesja objawia się pustym widokiem, a nie powrotem na
   `/login`. Jeśli Ania uzna to za mylące — kandydat na zmianę w Iteracji 12 (hardening).
4. **Toaster i TooltipProvider** z drzewa oryginału nie zostały wniesione — Iteracja 1 ich
   nie używa. Doda je pierwsza iteracja, która faktycznie ich potrzebuje.
5. **Korekty do dokumentacji referencyjnej** (naniesione w Fazie 5): `04_DESIGN_TOKENS.md`
   ma 6 rozjazdów wartości względem produkcyjnego CSS oraz nierozstrzygnięte „NIEZNANE"
   przy zapisie motywu; `01_WARSTWA_WSPOLNA.md` podaje nieistniejącą opcję
   `refetchOnReconnect:false` i „NIEZNANY" zakres ochrony tras.
