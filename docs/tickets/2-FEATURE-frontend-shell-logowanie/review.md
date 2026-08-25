# 2-FEATURE-frontend-shell-logowanie — Code review (iteracja 2)

> Reviewed: 2026-08-25 (runda 2, po commicie naprawczym `2e7eb90`)
> Branch: `feature/2-frontend-shell-logowanie`
> Diff: 52 pliki (+9617/-6), 5 commitów; same naprawy: 19 plików (+506/-24)

Weryfikacja uruchomieniowa w tym worktree (Node 20.20.2): `npm run lint` ✓,
`npm run typecheck` ✓, `npm test` ✓ **48/48** (było 44), `npm run build` ✓,
`npm run test:integracja` ✓ 6/6 przeciw żywemu backendowi. Po testach mutacyjnych
drzewo przywrócone do HEAD (`git status --porcelain` puste).

**Rekomendacja: MERGE.** Oba blokery z rundy 1 są naprawione i zweryfikowane empirycznie,
nie na słowo. Nowe znaleziska to jeden drobiazg wierności (1 px) i dwa porządki — nic,
co uzasadniałoby kolejną rundę przed merge'em.

---

## Status uwag z rundy 1

### BLOCKER

| # | Uwaga | Status | Dowód |
|---|---|---|---|
| B1 | `tailwind.config.ts` — martwe klasy `*-border` | **naprawione** | `dist/assets/index-4dhx9st6.css` zawiera `.border-primary-border{border-color:var(--primary-border)}`, `.border-secondary-border{…}`, `.border-destructive-border{…}` — **znak w znak** jak `mirror/frontend/assets/index-BVOkSOnE.css` |
| B2 | `deploy-staging.sh` — `npm ci` bez devDependencies | **naprawione** | `NODE_ENV=production npm ci --include=dev` na czystym katalogu z lockfile: frontend rc=0, 280 pakietów, `node_modules/.bin` ma `vite`+`tsc`+`eslint`; backend rc=0, 258 pakietów, `tsc`+`vitest` obecne |

Szczegóły weryfikacji B1 — porównałem **wszystkie** reguły naszego arkusza z produkcyjnym
(własny parser, 243 selektory u nas, 868 w produkcji, 236 wspólnych): rozjazdów merytorycznych
zostało **dwa** (`.rounded-lg` — patrz SHOULD-FIX poniżej, oraz `inset:0` vs
`top/right/bottom/left:0`, co jest wyłącznie różnicą zapisu autoprefixera i daje identyczny
render). Bloki `:root` i `.dark` mają teraz komplet tokenów włącznie z cieniami w `.dark`.

### SHOULD-FIX

| # | Uwaga | Status | Dowód |
|---|---|---|---|
| S1 | `ThemeProvider` zapisywał motyw przy każdym montażu | **naprawione** | zapis wyłącznie w `toggle` (`ThemeProvider.tsx:40-48`), efekt tylko przełącza klasę; test `shell.test.tsx:120` „sama wizyta bez kliknięcia NIE utrwala preferencji" |
| S2 | brak testów `credentials:"include"` | **naprawione** | `api.test.ts:103` i `queryClient.test.ts:66` przez `vi.spyOn(globalThis,"fetch")` |
| S3 | strażnik tokenów nie widział martwych klas | **naprawione** | `tokeny.test.ts:116-180` — realny potok PostCSS + Tailwind, 20 klas + 4 warianty z alfą + asercja na SUROWĄ wartość `var(--primary-border)` |
| S4 | `sourcemap: true` wystawiał źródła na staging | **naprawione** | `vite.config.ts:16` → `false`; po `npm run build` `find dist -name "*.map"` → **0** plików |
| S5 | asercja podciągiem na komunikacie 401 | **naprawione** | `logowanie.test.tsx:118-126` — dokładny string `401: {"error":"Nieprawidłowy email lub hasło"}` + komentarz, że tak działa oryginał |
| S6 | `build` ciągnął devDependencies testów | **naprawione** | `package.json:12` → `tsc --noEmit -p tsconfig.json && vite build`; pełny `typecheck` dopisany do `.github/workflows/ci.yml:61` |
| S7 | korekty w `04_DESIGN_TOKENS.md` / `01_WARSTWA_WSPOLNA.md` | **nie naprawione — zgodnie z planem** | `git diff origin/develop...HEAD -- docs/incoming` pusty; DoD w `plan.md` mówi wprost „naniesione **w Fazie 5**", więc to dług fazy dokumentacji, nie tego diffu |

### NICE-TO-HAVE

Wszystkie 7 zaadresowanych: `Boolean(body)` z komentarzem (`api.ts:108`), `shadow-xs`
w wariancie `outline` (`button.tsx:18`), O6 w `README.md:110` i w raporcie, cienie w `.dark`
(`index.css:131-138`), tabela O1–O6 w `raport.md:70-79`, nazwy testów cookie poprawione,
`maximum-scale=1` świadomie zostawione i odnotowane w „Follow-up".
Bonus poza listą: nazwa klasy `bg-gray-50` zniknęła z komentarza w `NotFound.tsx` (Tailwind
skanuje też komentarze i generował z niej martwą regułę).

---

## Testy mutacyjne (czy nowe testy naprawdę łapią regresje)

Pięć mutacji, każda przywrócona po sprawdzeniu — **wszystkie pięć zabite**:

1. usunięcie `border: "var(--primary-border)"` z `tailwind.config.ts` → `tokeny.test.ts` czerwony (`brakujace` niepuste);
2. „poprawienie" wartości na `hsl(var(--primary-border) / <alpha-value>)` → `tokeny.test.ts` czerwony na asercji o surowej wartości — czyli strażnik broni też przed pozornie niewinnym ujednoliceniem;
3. usunięcie `credentials:"include"` z `api.ts:116` → `api.test.ts` czerwony;
4. usunięcie `credentials:"include"` z `queryClient.ts:21` → `queryClient.test.ts` czerwony;
5. przeniesienie `localStorage.setItem` z powrotem do efektu w `ThemeProvider` → `shell.test.tsx` czerwony.

## Regresje po naprawach — sprawdzone, brak

- `Boolean(body)` a `wyloguj()`: `auth.ts:83` woła `zadanie("POST","/api/logout")` **bez** trzeciego argumentu, więc `maBody` było i jest `false` — bez `Content-Type`, bez ciała. Jedyny wołający z ciałem (`auth.ts:50`) przekazuje obiekt, zawsze prawdziwy. Zero zmiany zachowania, zysk to zgodność z oryginałem dla `null`/`0`/`""`.
- Motyw bez `localStorage`: `czyCiemnyNaStarcie()` i `toggle()` mają własne `try/catch`, a `setDark(nowy)` jest **poza** `try`, więc przy zablokowanym storage przełącznik dalej działa — tylko bez utrwalenia. Poprawnie.
- Zawężenie `build`: `tsconfig.node.json` (czyli `vite.config.ts`, `tailwind.config.ts`, konfiguracje vitest) nie jest już sprawdzany przy buildzie, ale CI woła `npm run typecheck` osobno — luka domknięta.
- `deploy-staging.sh`: `npm ci --omit=dev` w `$RELEASE` (`:64`) nietknięte, runtime backendu dalej bez devDependencies.

---

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/tailwind.config.ts:85-89` — skala `borderRadius` rozjeżdża się z produkcją dla `lg` i `sm`: nasze `lg: var(--radius)` daje `8px`, produkcja generuje `.rounded-lg{border-radius:.5625rem}` (**9px**); nasze `sm` = `calc(var(--radius) - 4px)` = `4px`, produkcja `.rounded-sm{border-radius:.1875rem}` = `3px`. `md` (6px) i `xl` (12px) zgadzają się.
  - Reason: dziś widać to w jednym miejscu — karta logowania (`src/pages/Login.tsx:51`, `rounded-lg`) ma promień o 1 px mniejszy niż oryginał. Znaczenie ma jednak to, że jest to rozjazd **skali**, a nie pojedynczej klasy: jedenaście widoków, które staną na tym fundamencie, odziedziczy go po cichu, a strażnik tokenów tego nie łapie (porównuje wartości `--radius`, a nie wyliczoną skalę). To ta sama klasa błędu co B1, tylko o rząd wielkości łagodniejsza — nie blokuje merge'a.
  - Suggestion: wpisać wartości wprost (`lg: ".5625rem"`, `md: ".375rem"`, `sm: ".1875rem"`) albo dopisać `rounded-lg`/`rounded-sm` do listy porównywanej z produkcyjnym arkuszem w `test/tokeny.test.ts`.

- [ ] `docs/incoming/frontend-perplexity/dokumentacja/04_DESIGN_TOKENS.md`, `01_WARSTWA_WSPOLNA.md` — przeniesione z rundy 1, nadal nie w diffie.
  - Reason: pozycja Definition of done; `plan.md` sam adresuje ją do Fazy 5, więc nie blokuje merge'u kodu, ale ticket nie może się bez niej zamknąć — inaczej następna iteracja weźmie te pliki jako źródło i odtworzy błędne wartości.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/components/ThemeProvider.tsx:41` — wyrażenie `const nowy = !dark;` jest przez skaner Tailwinda odczytywane jako kandydat na klasę `!dark`, przez co bundle dostał martwą regułę `.\!dark{…!important}` (~1,4 kB, ósemka tokenów `*-border` z `!important`). Produkcja jej nie ma. Dokładnie ten sam mechanizm, który autor sam zamknął w komentarzu `NotFound.tsx` — tyle że tym razem wpuszczony razem z naprawą S1.
  - Suggestion: `blocklist: ["!dark"]` w `tailwind.config.ts` albo zapis negacji bez sklejenia z nazwą (np. `const nowy = dark === false;`).
- [ ] `rebuild/frontend/vitest.config.ts:10-20` — brak `restoreMocks: true`, a nowe testy przywracają szpiega dopiero w ostatniej linii (`api.test.ts:112`, `queryClient.test.ts:75`). Gdy asercja padnie, `mockRestore()` nie wykona się i podmieniony `globalThis.fetch` zostaje na resztę pliku, zaciemniając kolejne błędy.
- [ ] `rebuild/frontend/src/components/ui/card.tsx:10` — `shadcn-card` nie generuje reguły ani u nas, ani w produkcji (sprawdziłem: 0 trafień w `index-BVOkSOnE.css`). Wierne oryginałowi, zostawić — odnotowane tylko po to, żeby nie wracało w kolejnych przeglądach.

## Plan compliance

### Done ✓

Wszystko z rundy 1 (kroki 1–11 potwierdzone tam linia po linii) plus domknięcie dwóch luk:

- Krok 2 zamknięty do końca — `tailwind.config.ts` mapuje komplet wariantów `*-border`
  (`primary`, `secondary`, `muted`, `accent`, `destructive`, `sidebar.primary`, `sidebar.accent`)
  wartościami surowymi, a wygenerowany arkusz zgadza się z produkcyjnym.
- Kontrakt deployu realnie wykonalny — `tools/deploy-staging.sh:64,79` buduje z devDependencies.
- Test tokenów ma drugą warstwę, która broni już nie deklaracji, lecz **efektu**.
- Lista odstępstw kompletna i w obu miejscach: `raport.md:70-79` (O1–O6) i `README.md:103-110`.

### Missing or deviating ✗

- Korekty do `04_DESIGN_TOKENS.md` i `01_WARSTWA_WSPOLNA.md` — świadomie odłożone do Fazy 5 (tak stanowi `plan.md`).
- Skala `borderRadius` (`lg`, `sm`) odbiega o 1 px od produkcyjnej — patrz SHOULD-FIX.

### Definition of done

- [x] `npm ci && npm run build` → `dist/` — zweryfikowane; **skrypt deployu też to teraz wykona** (B2 naprawione).
- [x] `/login` 1:1 wg `frontend-index.js:26391-26509` (minus O4) — z jednym 1-pikselowym rozjazdem promienia karty (SHOULD-FIX).
- [x] Shell z ciemnym sidebarem: 10 pozycji + stopka; 12 tras w routerze.
- [x] Przepływ auth 1:1 — `credentials:"include"` teraz **realnie** pod testem (mutacja zabita).
- [x] QueryClient: `on401:"returnNull"`, `staleTime:Infinity`, `retry:false`, `refetchOnWindowFocus:false`, `queryKey.join("/")`.
- [x] Design tokens = pełny `:root`/`.dark`; Inter + JetBrains Mono — **domknięte**: tokeny i wygenerowane reguły zgodne z produkcją.
- [x] Testy jednostkowe auth + przepływ logowania przeciw mockowi z `contract/fixtures/GET_me.json` — 48/48.
- [x] Test integracyjny przeciw żywemu `rebuild/backend` — 6/6, uruchomiony przeze mnie.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — zielone.
- [ ] Odstępstwa w `raport.md` ✓ (O1–O6); korekty do `04_DESIGN_TOKENS.md` / `01_WARSTWA_WSPOLNA.md` — **do Fazy 5**.
- [x] README `rebuild/frontend/`.

## Parallel-test concerns

Bez zmian wobec rundy 1 — brak kolizji. Nowy test `tokeny.test.ts` uruchamia PostCSS +
Tailwind **w pamięci** (`process()` bez zapisu na dysk, ścieżki liczone z `korzenFrontendu`),
nie zajmuje portu ani pliku tymczasowego i dokłada ~0,3 s. Testy integracyjne dalej biorą
wolny port i `mkdtempSync`. Kilka okien naraz nie wejdzie sobie w drogę.

## Overall assessment

Naprawy są zrobione porządnie i — co ważniejsze — **udowodnione**: strażnik tokenów urósł
o warstwę, która sprawdza efekt, a nie deklarację, i to właśnie ona zabija mutację, która
odtwarzała pierwotny bloker. Sprawdziłem mutacyjnie pięć najważniejszych nowych asercji
i każda z nich realnie broni kodu; komentarze w miejscach napraw tłumaczą „dlaczego",
więc następna iteracja nie cofnie ich przez pomyłkę.

Nic nie blokuje merge'a. Zostają dwa drobiazgi: skala `borderRadius` rozjeżdża się
z produkcją o 1 px na `rounded-lg`/`rounded-sm` (warto zamknąć teraz, zanim odziedziczy
to jedenaście widoków) oraz martwa reguła `.\!dark`, którą naprawa motywu przypadkiem
wpuściła do bundla przez skaner Tailwinda. Dług dokumentacyjny (`04_DESIGN_TOKENS.md`,
`01_WARSTWA_WSPOLNA.md`) jest planowo po stronie Fazy 5 i musi zniknąć przed zamknięciem
ticketa, nie przed merge'em.
