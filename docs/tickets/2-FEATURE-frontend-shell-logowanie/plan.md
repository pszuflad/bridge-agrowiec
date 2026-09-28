# 2-FEATURE-frontend-shell-logowanie — Iteracja 1b: fundament frontendu + logowanie

> Status: Draft
> Branch: `feature/2-frontend-shell-logowanie`
> Worktree: `.worktrees/2-FEATURE-frontend-shell-logowanie`

## Opis ticketa

Iteracja 1, sesja 1b (FRONTEND) wg `docs/rebuild-roadmap.md` (§5 „Iteracja 1" + §1a środowiska
+ §3 zasady). Druga połowa fundamentu — szkielet UI + logowanie.

Zakres (tylko frontend):
- Szkielet React 18 + Wouter v3 + TanStack Query + Radix/shadcn + Tailwind (wg `docs/spec-frontend.md` §5).
- Design tokens wiernie: Inter (UI) + JetBrains Mono (kod/EAN), primary `hsl(35 70% 45%)`,
  ciemny sidebar `hsl(215 28% 12%)`, tło `hsl(210 20% 98%)`.
- Widok `/login` + shell aplikacji z ciemnym sidebarem — 12 tras routera, trasy-placeholdery.
- Przepływ auth 1:1 (spec-frontend §5): `POST /api/login {email:trim, password}` → `{ok,user,token}`;
  `Authorization: Bearer <token>` TYLKO gdy token jest + `credentials:"include"` równolegle;
  dane usera w `bridge_user`; „remember me" → wybór `localStorage`/`sessionStorage`.
  TanStack Query: `on401:"returnNull"`, `staleTime:Infinity`, `retry:false`,
  `refetchOnWindowFocus:false`, klucz = `queryKey.join("/")`.
- API base `/api` (na staging proxowane przez `.htaccess`). Bez prefiksu `/panel`.

Kontrakt deployu (musi pasować do `tools/deploy-staging.sh:65-67`):
`rebuild/frontend/`: `npm ci && npm run build` → `dist/` (Vite, base `"/"`).

DoD z ticketa: FE loguje i pokazuje shell; przepływ auth i design tokens wierne; build przechodzi;
Ania widzi `/login` pod `test.agritires.eu`.

## Kontekst

**Sesja 1a jest już zmergowana** (PR #2, `origin/develop` = `03002f1`) — wbrew założeniu z opisu
ticketa backend już istnieje. To zmienia dwie rzeczy na korzyść:
- logowanie da się przetestować **end-to-end przeciw prawdziwemu backendowi**, nie tylko przeciw mockowi;
- po merge'u tego PR `deploy-staging.sh` przestaje pomijać build (guard wymaga OBU:
  `rebuild/backend/package.json` i `rebuild/frontend/package.json`, `tools/deploy-staging.sh:47`),
  więc staging ożywa od razu.

Backend z 1a (`rebuild/backend/src/routes/auth.ts`) daje dokładnie to, czego FE oczekuje:
`POST /api/login` → 400 `{error:"Email i hasło są wymagane"}` / 401 `{error:"Nieprawidłowy email lub hasło"}`
/ 200 `{ok:true,user:{id,email,imieNazwisko},token}` + cookie `bridge_session`;
`POST /api/logout` → `{ok:true}`; `GET /api/me` → 401 `{error:"Nieautoryzowany"}` albo payload JWT.
CORS jest domyślnie wyłączony, z allowlistą `CORS_ORIGINS` przewidzianą pod lokalny dev Vite.

**Zachowanie do odtworzenia — ustalone w oryginale, potwierdzone cytatami:**

| Element | Ustalenie | Źródło |
|---|---|---|
| Baza URL | `Vd = "/panel"`, URL = `` `${Vd}${path}` ``, a dla query `` `${Vd}${queryKey.join("/")}` `` | `frontend-index.js:8996,9045,9054` |
| Klucz Query | `queryKey.join("/")`, klucze zawierają pełne `/api/...` | `:9054-9063` |
| Nagłówki | `Content-Type` tylko gdy body; `Authorization: Bearer` tylko gdy token | `:9039-9044` |
| Cookie | `credentials:"include"` zawsze, także przy query | `:9045-9053` |
| „Remember me" | `localStorage.bridge_remember === "1" ? localStorage : sessionStorage` — jeden wybór store'u dla tokenu **i** `bridge_user` | `:9000-9013` |
| Token | klucz `bridge_auth_token`, cache modułowy, przy `null` czyszczony z **obu** store'ów | `:9015-9037` |
| Login | `bridgeSetRemember` PRZED requestem; `{email: email.trim(), password}`; gdy `!ok \|\| !user` → `throw new Error(resp.error \|\| "Nieprawidłowy email lub hasło")` | `:9085-9097` |
| Logout | `POST /api/logout` z połkniętym błędem, `Tg(null)`, `removeItem("bridge_user")` z obu store'ów, `bridgeSetRemember(false)` | `:9098-9107` |
| Błąd HTTP | `throw new Error(`${status}: ${text \|\| statusText}`)` | `:9031-9038` |
| 401 w query | zwraca `null`, nie rzuca | `:9054-9062` |
| QueryClient | `refetchInterval:false, refetchOnWindowFocus:false, staleTime:Infinity, retry:false`; mutacje `retry:false` | `:9063-9079` |
| Stan usera | modułowy, hydratowany RAZ na starcie z `bridge_user`; **FE nigdy nie woła `GET /api/me`** | `:9080-9084` |
| Guard | `/login` przepuszczany; brak usera → `setLocation("/login")`; inaczej `UserContext.Provider` | `:27789-27801` |
| Nawigacja | 10 pozycji, kolejność: `/` Pulpit, `/staging`, `/katalog`, `/narzuty` „Narzuty i promocje", `/atrybuty`, `/alerty`, `/waga-gabarytowa` „Waga gabarytowa", `/analityka`, `/historia`, `/konfiguracja` | `:16287-16327` |
| Shell | mobilny header `md:hidden h-14` + hamburger, `aside w-64 bg-sidebar`, stopka: toggle motywu → avatar (inicjały z `imieNazwisko`) + imię + email → „Moje konto" → „Wyloguj"; `main` z wrapperem `px-4 sm:px-6 lg:px-8 py-6 md:py-8 max-w-[1400px] mx-auto` | `:16329-16456` |
| Motyw | init `prefers-color-scheme`, toggle dodaje/usuwa klasę `dark` na `<html>`, **bez zapisu** | `:16228-16241` |
| Logo | SVG 40×40 `currentColor`: dwa filary, łuk `M6 28 Q 20 4, 34 28`, cieńszy łuk `Q 20 14`, linia pomostu | `:16244-16285` |
| `/login` | logo `w-16 h-16 text-primary`, `h1 "BridgeOne"`, karta `border border-border rounded-lg bg-card p-6 shadow-sm`, `h2 "Zaloguj się"`, podtytuł, pola Email/Hasło z toggle widoczności, checkbox „Zapamiętaj mnie", błąd `text-destructive bg-destructive/10`, submit `w-full` ze stanem „Logowanie..." | `:26391-26509` |
| Tokeny CSS | pełny `:root` i `.dark` | `mirror/frontend/assets/index-BVOkSOnE.css` |
| `<title>` | „Bridge ONE — konsolidacja cenników opon", `lang="pl"`, favicon = inline SVG data-URI (`#d97706`) | `mirror/frontend/index.html:2,6,8` |

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ścieżki:** `POST /api/login`, `POST /api/logout`, `GET /api/me` (`contract/openapi.yaml:675-696,752-758`).
**Fixture:** `contract/fixtures/GET_me.json` → `{id, email, imieNazwisko, iat, exp}`.

**Ten ticket NIE implementuje API — konsumuje je.** GATE fixtures/kontraktu w formie z Kroku 9
(porównanie odpowiedzi backendu z fixtures) należy do sesji 1a i **jest tam zaliczony**
(`docs/tickets/1-FEATURE-backend-fundament-logowanie/raport.md`). Tutaj zobowiązanie kontraktowe
jest lustrzane i sprowadza się do trzech rzeczy, które weryfikujemy testami:

1. **Kształt żądania** — `POST /api/login` wysyła dokładnie `{email, password}` z przyciętym e-mailem,
   `POST /api/logout` bez body.
2. **Kształt odpowiedzi, na którym FE polega** — `{ok, user:{id,email,imieNazwisko}, token}`;
   typ `Uzytkownik` w FE musi się zgadzać z `GET_me.json` (bez pola `rola` — go nie ma).
   Mock w testach jest budowany **z `contract/fixtures/GET_me.json`**, nie z wymyślonych danych.
3. **Zgodność z żywym backendem** — poza mockiem uruchamiamy klienta FE przeciw realnemu
   `rebuild/backend` (test integracyjny, patrz „Testing strategy"), więc rozjazd kontraktu
   wyjdzie od razu, a nie dopiero na stagingu.

**Rozjazdy odnotowane i rozstrzygnięte:**

| Rozjazd | Rozstrzygnięcie |
|---|---|
| Ticket: „sidebar z 12 pozycjami" vs oryginał: 10 pozycji nawigacji (`:16287-16327`) | 12 = liczba **tras routera** (`spec-frontend.md:61-63` mówi poprawnie „12 tras"). Robimy 10 pozycji + „Moje konto"/„Wyloguj" w stopce. **Decyzja D2.** |
| `04_DESIGN_TOKENS.md` vs surowy `index-BVOkSOnE.css` — różne wartości ciemnego motywu (`--input` `215 22% 20%` vs `215 20% 24%`, `--border` `215 22% 18%` vs `215 20% 18%`, `--secondary` `215 22% 17%` vs `215 20% 18%`, `--muted-foreground` `215 16% 62%` vs `215 12% 65%`, `--accent` `35 45% 17%/35 80% 65%` vs `35 30% 22%/35 80% 80%`; jasny: `--secondary-foreground` `215 25% 20%` vs `215 25% 14%`) | **Wygrywa surowy CSS** (zasada: oryginał > spec). Korekta do propagacji w docs. **Decyzja D3.** |
| `04_DESIGN_TOKENS.md:73` „mechanizm zapisu trybu ciemnego NIEZNANY" | Rozstrzygnięte: **nie ma zapisu** (`:16228-16241`). Do propagacji. |
| `01_WARSTWA_WSPOLNA.md` podaje `refetchOnReconnect:false` | **Nie ma tego w kodzie** (`:9063-9079`) — jest `refetchInterval:false`. Odtwarzamy kod. Do propagacji. |
| `01_WARSTWA_WSPOLNA.md` „ochrona pozostałych tras NIEZNANA" | Rozstrzygnięte: `cM` (`:27789`) chroni wszystkie trasy poza `/login`. Do propagacji. |
| Zrzut z instrukcji v5 („Bridge / dla Agrowca", bez checkboxa, blok kont testowych) vs bundle („BridgeOne", checkbox, bez kont) | **Wygrywa bundle** — nowszy stan produkcji. |
| `openapi.yaml:752` daje `GET /api/me` `security: []` | Stan faktyczny: backend zwraca 401 bez sesji. Bez wpływu na FE (nie woła `/me`). |

`docs/rebuild-backlog.md`: wpisy #1–#3 dotyczą importu/adaptera, żaden nie ma ✅ TAK i żaden nie
dotyka logowania, layoutu ani wyglądu. **Zero wpływu na ten ticket.**

## Decisions

**D1 — Routing: czyste ścieżki (history) zamiast hasha.** Oryginał używa `useHashLocation`
+ `window.location.hash ||= "#/"` (`:28695,28699`) — obejście z Replita dające adresy `/#/katalog`.
Wybieramy `useBrowserLocation` (domyślny hook Woutera), bo `.htaccess` stagingu ma poprawny SPA
fallback (`deploy/staging/htaccess:16-20`). **To pierwsze świadome odstępstwo (O1)** — zapisane,
bo zakładki Ani ze starego panelu (`#/katalog`) nie przeniosą się 1:1.

**D2 — Sidebar wiernie: 10 pozycji nawigacji + stopka.** Wbrew literalnemu „12 pozycji" z ticketa.
Router ma wszystkie 12 tras; `/moje-konto` jest linkiem w stopce przy avatarze, `/login` nie ma
w żadnym menu. Powód: 1:1 z produkcją, Ania rozpozna układ.

**D3 — Design tokens: pełny `:root`/`.dark` przepisany z `mirror/frontend/assets/index-BVOkSOnE.css`.**
Łącznie z tokenami spoza `04_DESIGN_TOKENS.md` (`--popover-*`, `--card-border`, `--sidebar-ring`,
`--chart-1..5`, `--shadow-*`, `--elevate-1/2`, `--button-outline`, `--badge-outline`,
`--*-border` liczone przez `hsl(from ...)`, `--tracking-normal`) oraz utility
`hover-elevate` / `active-elevate-2` / `toggle-elevate`, na których stoją Button i Badge.
Powód: kolejne iteracje nie doklejają tokenów i wygląd się nie rozjeżdża. Martwe tokeny
(cienie mają alpha 0) przepisujemy też — dosłownie 1:1.

**D4 — Odstępstwa drobne (zatwierdzone przez użytkownika):**
- **O2 — zapis trybu ciemnego** do `localStorage` (klucz `bridge_theme`); oryginał nie zapisuje
  (`:16228-16241`), więc wybór ginął po odświeżeniu. Init: zapisana preferencja → `prefers-color-scheme`.
- **O3 — ekran 404 po polsku i na tokenach**; oryginał ma angielski tekst „404 Page Not Found" /
  „Did you forget to add the page to the router?" na `bg-gray-50` (`:16534-16556`) — jedyny ekran
  bez design tokenów, wygląda na niedokończony.
- **O4 — pominięcie martwych artefaktów logowania**: `list="konta-testowe-email"` wskazujący na
  nieistniejącą `<datalist>` (`:26443`) oraz tablica `Yy` z kontami testowymi **i hasłami w kodzie**
  (`:26384-26390`). Powód: hasła w bundlu to wyciek, atrybut i tak nic nie robi.
- **O5 — krótki stan ładowania w guardzie** zamiast `null`; oryginał renderuje `null` w pierwszym
  cyklu (`:27801`), więc przy wejściu bez sesji miga biały ekran.

**D5 — Baza URL: `API_BASE = ""` + klucze Query z pełnym `/api/...`.** Decyzja techniczna, bez
wpływu na zachowanie. W oryginale `Vd="/panel"` sklejane z `queryKey.join("/")`, a klucze to
`["/api/staging"]` → `/panel/api/staging`. Ustawienie `API_BASE="/api"` przy zachowaniu kluczy
dałoby `/api/api/staging`; zmiana kluczy na bezprefiksowe rozjechałaby je ze specyfikacją,
oryginałem i wszystkimi invalidacjami w kolejnych iteracjach. Zostawiamy klucze 1:1 i zerujemy
prefiks — efekt to dokładnie wymagane „API base `/api`", bo każda ścieżka zaczyna się od `/api`.
Stała zostaje w kodzie (nie znika), żeby przyszła zmiana montowania była jednym miejscem.

**D6 — Stack i narzędzia** (wg rekomendacji z ticketa): Vite 6 + TypeScript, Vitest + Testing
Library + jsdom, MSW do mocka `/api` w testach, Tailwind 3 + shadcn/ui (Radix) w
`rebuild/frontend/`. ESLint spójny z `rebuild/backend`. Dev: proxy Vite `/api` →
`http://127.0.0.1:5001`, żeby lokalnie było **same-origin jak na stagingu** (żadnego CORS-u,
cookie `bridge_session` działa bez wyjątków).

**D7 — Zakres komponentów shadcn: tylko to, czego używa 1b** (`Button`, `Input`, `Label`)
plus wspólny `PageHeader` (`hn`, `:16459-16478`) i `Card` (`Ke`, `:16479-16487`) potrzebne
placeholderom. Reszta biblioteki dochodzi w iteracjach, które jej faktycznie użyją — inaczej
wnosimy setki linii martwego kodu.

## Implementation plan

Kolejność = kolejność commitów.

**Krok 1 — szkielet projektu.** `rebuild/frontend/`: `package.json` (scripts `dev`, `build`,
`preview`, `lint`, `typecheck`, `test`, `test:watch` — nazwy zgodne z tym, czego szuka
`.github/workflows/ci.yml:56-62`), `vite.config.ts` (`base: "/"`, `build.outDir: "dist"`,
`server.proxy["/api"] → http://127.0.0.1:5001`), `tsconfig.json` + `tsconfig.node.json`,
`eslint.config.js`, `.gitignore`, `.nvmrc` (20, jak w backendzie), `index.html`
(`lang="pl"`, `<title>Bridge ONE — konsolidacja cenników opon</title>`, meta description,
favicon inline SVG z `mirror/frontend/index.html:8`, preconnect + link do Google Fonts
**tylko Inter + JetBrains Mono** — nie 25 rodzin z artefaktu Replita).
Dodatkowo: `.worktrees/` do `.gitignore` w korzeniu repo (procedura zakłada, że tam jest, a nie ma).

**Krok 2 — design tokens + Tailwind.** `src/styles/index.css`: `@tailwind` + pełny `:root`
i `.dark` przepisane z `mirror/frontend/assets/index-BVOkSOnE.css` + utility
`hover-elevate`/`active-elevate-2`/`toggle-elevate`. `tailwind.config.ts`: mapowanie tokenów
na skalę (`colors.background` → `hsl(var(--background))` itd.), `fontFamily` sans/serif/mono
z `--font-*`, `borderRadius` z `--radius`. Test jednostkowy sprawdzający, że kluczowe tokeny
mają wartości z produkcji (chroni przed cichym rozjazdem w kolejnych iteracjach).

**Krok 3 — warstwa API/auth (`src/lib/api.ts`, `src/lib/auth.ts`).** Wierne odtworzenie
`frontend-index.js:8996-9110` z czytelnymi nazwami: `pobierzStore()`, `ustawZapamietaj()`,
`zapiszToken()`, `pobierzToken()`, `naglowki(maBody)`, `zadanie(metoda, sciezka, body)`,
`zaloguj(email, haslo, zapamietaj)`, `wyloguj()`, `pobierzUzytkownika()`. Klucze storage
**dosłownie jak w oryginale**: `bridge_auth_token`, `bridge_user`, `bridge_remember`.
Typ `Uzytkownik = {id: number; email: string; imieNazwisko: string}` (z `GET_me.json`).

**Krok 4 — QueryClient (`src/lib/queryClient.ts`).** `queryFn` z `queryKey.join("/")`,
401 → `null`, `defaultOptions` 1:1 z `:9063-9079`.

**Krok 5 — motyw + logo + guard.** `src/components/ThemeProvider.tsx` (z O2 — zapis do
`bridge_theme`), `src/components/Logo.tsx` (SVG 1:1 z `:16244-16285`),
`src/components/AuthGate.tsx` (`:27789-27801` + O5).

**Krok 6 — prymitywy UI.** `src/components/ui/{button,input,label,card}.tsx` — shadcn/ui
w wariancie z oryginału (Button z `hover-elevate`, Card z `border-card-border`),
`src/lib/utils.ts` (`cn` = clsx + tailwind-merge), `src/components/PageHeader.tsx` (`hn`).

**Krok 7 — shell (`src/components/AppShell.tsx`).** Wierne `mn` (`:16329-16456`): tablica
`POZYCJE_NAWIGACJI` (10 pozycji, ikony lucide-react: `LayoutDashboard`, `Inbox`, `Package`,
`Percent`, `Tags`, `Bell`, `Scale`, `TrendingUp`, `History`, `Settings`), mobilny header
z hamburgerem, overlay, stopka (toggle motywu, avatar z inicjałami, „Moje konto" `KeyRound`,
„Wyloguj" `LogOut` → `wyloguj()` + `queryClient.clear()` + `/login`). Zachowujemy wszystkie
`data-testid` z oryginału.

**Krok 8 — widok `/login` (`src/pages/Login.tsx`).** Wierne `tM` (`:26391-26509`) minus O4.
Wszystkie teksty PL i `data-testid` 1:1.

**Krok 9 — trasy i placeholdery.** `src/App.tsx` (drzewo
`QueryClientProvider > ThemeProvider > TooltipProvider > [Toaster, Router > AuthGate > Switch]`
— w 1b bez Toastera/Tooltipa, dochodzą gdy pierwsza iteracja ich użyje; zaznaczyć w kodzie),
`src/main.tsx`, 11 placeholderów w `src/pages/` (każdy w `AppShell` + `PageHeader` z tytułem
z nawigacji i notką „Widok powstanie w Iteracji N" wg roadmapy) + `src/pages/NotFound.tsx` (O3).

**Krok 10 — testy** (patrz niżej).

**Krok 11 — README `rebuild/frontend/`** (uruchomienie, dev z proxy, testy, kontrakt buildu)
+ aktualizacja docs (Faza 5).

## Testing strategy

**Warstwa 1 — testy jednostkowe warstwy auth (bez UI, jsdom).** `api.test.ts`, `auth.test.ts`:
`email.trim()`, Bearer tylko gdy token, `credentials:"include"` zawsze, `Content-Type` tylko
z body, wybór store'u wg `bridge_remember`, czyszczenie obu store'ów przy logout,
komunikat błędu z `resp.error`, format błędu HTTP `"401: ..."`, 401 w `queryFn` → `null`,
`queryKey.join("/")`. To jest logika, którą realnie łatwo zepsuć — testujemy ją wprost.

**Warstwa 2 — test przepływu logowania (Testing Library + MSW).** Renderuje `/login`,
wpisuje e-mail ze spacjami i hasło, zaznacza „Zapamiętaj mnie", submit → sprawdza, że
handler MSW dostał `{email: <przycięty>, password}`, że token wylądował w `localStorage`
(a bez checkboxa w `sessionStorage`), że `bridge_user` się zapisał i że nastąpiła nawigacja
na `/`. Drugi przypadek: 401 → komunikat „Nieprawidłowy email lub hasło" w `text-login-error`,
brak nawigacji. **Odpowiedź mocka budowana z `contract/fixtures/GET_me.json`** — plik jest
czytany w teście, nie przepisany ręcznie, więc zmiana kontraktu wywali test.

**Warstwa 3 — test integracyjny przeciw ŻYWEMU backendowi (bez mocków).** Skoro 1a jest
zmergowane, `npm run test:integracja` startuje realny `rebuild/backend` (`tsx src/server.ts`)
na wolnym porcie, ze świeżą bazą tymczasową i zasianym użytkownikiem, po czym przepuszcza
przez niego prawdziwego klienta FE: `zaloguj()` → `pobierzUzytkownika()` → `queryFn` na
`/api/me` → `wyloguj()` → `queryFn` na `/api/me` zwraca `null`. To weryfikuje kontrakt
naprawdę, a nie moje wyobrażenie o nim.
**Nie wpinam tego w `npm test`**, bo job `frontend` w CI (`ci.yml:44-62`) instaluje wyłącznie
`rebuild/frontend` — test padłby na braku zależności backendu. Uruchamiam lokalnie i wynik
raportuję w `raport.md`. (Wpięcie w CI = osobny ticket infrastrukturalny, do follow-up.)

**Warstwa 4 — smoke buildu.** `npm run build` musi wyprodukować `dist/index.html` + assety,
bo to jest kontrakt z `tools/deploy-staging.sh:65-67`. Weryfikuję ręcznie i odnotowuję.

**Czego NIE robimy i dlaczego:** brak testów snapshotowych wyglądu (kruche, a wierność
tokenów pilnuje test z Kroku 2); brak E2E w przeglądarce (Playwrighta nie ma w repo,
a Warstwa 3 pokrywa realny kontrakt bez niego).

**GATE odbudowy:** ten ticket nie implementuje API, więc GATE fixtures/kontraktu w wersji
z Kroku 9 nie obowiązuje (zaliczony w 1a). Lustrzane zobowiązanie FE — zgodność kształtu
żądania/odpowiedzi — pokrywają Warstwy 2 i 3.

## Out of scope

- Treść 11 widoków (`/`, `/staging`, `/katalog`, `/narzuty`, `/alerty`, `/analityka`,
  `/historia`, `/konfiguracja`, `/waga-gabarytowa`, `/atrybuty`, `/moje-konto`) — tylko
  placeholdery; każdy ma swoją iterację w roadmapie.
- `POST /api/password/change` i pełne `/moje-konto` — Iteracja 12.
- Wchłonięcie skryptów injection (`pending-`, `selly-`, `freq-`) — Iteracje 7/8/11.
- Naprawa martwych ścieżek `/api/attributes`, `/api/attribute-kinds` — Iteracja 7.
- Toaster i TooltipProvider — dochodzą, gdy pierwsza iteracja ich użyje.
- Wpięcie testu integracyjnego FE↔BE w CI — follow-up.
- Reszta biblioteki shadcn/ui poza `Button`/`Input`/`Label`/`Card`.

## Definition of done

- [ ] `rebuild/frontend/` spełnia kontrakt deployu: `npm ci && npm run build` → `dist/` (Vite, base `/`).
- [ ] `/login` odtworzony 1:1 wg `frontend-index.js:26391-26509` (minus zatwierdzone O4), teksty PL, `data-testid` zachowane.
- [ ] Shell z ciemnym sidebarem: 10 pozycji nawigacji w kolejności z oryginału + stopka (motyw, avatar, „Moje konto", „Wyloguj"); 12 tras w routerze.
- [ ] Przepływ auth 1:1: `email.trim()`, Bearer tylko gdy token, `credentials:"include"` równolegle, `bridge_user`, „remember me" przełączające store.
- [ ] QueryClient: `on401:"returnNull"`, `staleTime:Infinity`, `retry:false`, `refetchOnWindowFocus:false`, klucz `queryKey.join("/")`.
- [ ] Design tokens = pełny `:root`/`.dark` z produkcyjnego CSS; Inter + JetBrains Mono ładowane.
- [ ] Testy jednostkowe warstwy auth + test przepływu logowania przeciw mockowi zbudowanemu z `contract/fixtures/GET_me.json` — zielone.
- [ ] Test integracyjny przeciw żywemu `rebuild/backend` przechodzi lokalnie (login → me → logout), wynik w `raport.md`.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — zielone.
- [ ] Zatwierdzone odstępstwa (O1–O5) wypisane w `raport.md`; korekty do `04_DESIGN_TOKENS.md` i `01_WARSTWA_WSPOLNA.md` naniesione w Fazie 5.
- [ ] README `rebuild/frontend/`.
