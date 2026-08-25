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

**Zmienione**
- `.gitignore` — dopisane `.worktrees/` (procedura `feature.md` zakładała, że tam jest, a nie było)

## Deviations from plan

Plan zrealizowany 1:1 co do zakresu. Dwie korekty techniczne podjęte w trakcie, bez wpływu
na zachowanie aplikacji:

1. **Rozdzielenie konfiguracji TypeScriptu na `tsconfig.json` + `tsconfig.test.json`.**
   Plan przewidywał jedną. Testy muszą sięgać po API Node (odczyt fixtures, start backendu),
   ale wpuszczenie typów Node do wspólnej konfiguracji pozwoliłoby użyć `process` w kodzie
   przeglądarkowym. `src/` zostaje czysto przeglądarkowe.
2. **`fetch` w `zadanie()` dostaje `body` przez rozwinięcie obiektu**, a nie jako
   `body: undefined` — wymóg `exactOptionalPropertyTypes`. Zachowanie identyczne.

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
- **Unit + komponentowe:** ✓ **44 testy, 6 plików** (`npm test`) — bez backendu, żądania przez MSW.
- **Integracyjne (bez mocków):** ✓ **6 testów** (`npm run test:integracja`) — prawdziwy
  `rebuild/backend` na wolnym porcie, świeża baza, zasiany użytkownik; złe hasło, puste pola,
  udane logowanie, cookie sesji, `GET /api/me`, 401 → `null` po wylogowaniu.
- **Strażnik design tokenów:** ✓ — porównuje efektywne wartości wszystkich tokenów obu motywów
  z `mirror/frontend/assets/index-BVOkSOnE.css`. Sprawdzony **testem mutacyjnym**: zmiana
  `--primary` o 1% jasności wywala 2 testy.
- **Lint / typecheck / build:** ✓ zielone. Build produkuje `dist/` (index.html 1,67 kB,
  CSS 21,87 kB, JS 230,63 kB).
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

## Follow-up

Rzeczy zauważone przy okazji, świadomie NIE zrobione w tym tickecie:

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
