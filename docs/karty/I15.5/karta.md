# I15.5 — Staging v2 — frontend: przycisk i okno „Rozstrzygnij”, komunikaty blokady akceptacji

> **Stan:** ✅ 2026-09-23 · `140-FEATURE-staging-rozstrzygnij-frontend`
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #99 · **Zależy od:** I15.4c
> **Ticket:** `140-FEATURE-staging-rozstrzygnij-frontend` (PR do `develop`)

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Port `mirror/frontend/assets/staging-policy-injection.js` (z `origin/main`, faktyczne źródło **`88fa31c`**,
wersja `20260923dotchoice`) do widoku `/staging` w React: przycisk „Rozstrzygnij”/„Sprawdź kartę” przy
zgłoszeniach z niejednoznacznym dopasowaniem albo sprawą starej karty, okno w **trzech rozłącznych gałęziach**
(stara karta · dopasowanie · sprzeczne wiersze pliku — trasy `review`/`resolve`/`choose-absence-card`, nie tylko
`review`/`resolve`), okno „Nie zapisano zmian” z komunikatem 409 przy blokadzie akceptacji. Teksty dosłownie.
Zachowaj zmiany UI stagingu z I14 (14a/14b/14c) — skrypt wstrzykiwany nie znał ich układu.
⚠ Pułapka MSW (CLAUDE.md): nowe zapytania wymagają handlerów we współdzielonych mockach stagingu.

## Pliki (wyłączna własność)
`rebuild/frontend/src/pages/staging/**`, testy FE stagingu. NIE: backend.

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona — źródło prawdy dla tej karty to `origin/main` na commicie `88fa31c` (23.09 13:00)**;
nowy kod na `main` = zgłoś.

## Dowiezione

**Zakres dowieziony w całości** (ticket `140-FEATURE-staging-rozstrzygnij-frontend`, 2026-09-23). Bramki
rozliczone: `lint`/`typecheck`/`build` ✓, `npm test` ✓ **991 testów w 56 plikach** (przed kartą 957 w 55),
Node 20.20.2.

### Co weszło

- **Nowy** `src/pages/staging/polityka.ts` — typy czterech tras z `contract/openapi.yaml`, warunek i etykieta
  przycisku, rozpakowanie komunikatu 409 z ciała odpowiedzi, warunki włączania wyborów, trzy warianty notatki
  (teksty dosłowne).
- **Nowy** `src/pages/staging/OknoRozstrzygniecia.tsx` — okno z trzema gałęziami, `useQuery` po
  `["/api/staging", id, "review"]`, mutacje `resolve` i `choose-absence-card`, potwierdzenie przez
  `DialogPotwierdzenia`.
- **Nowy** `src/pages/staging/OknoBlokady.tsx` — „Nie zapisano zmian”.
- `src/pages/staging/TabelaStagingu.tsx` — nowy wymagany prop `otworzRozstrzygniecie`, przycisk w kolumnie
  „Akcje” za „Szczegóły” (tam, gdzie oryginał doklejał go przez `row.lastElementChild`).
- `src/pages/Staging.tsx` — montaż obu okien, stan `rozstrzyganeId`/`blokada`; mutacja `akcja` przyjmuje
  teraz `{wykonaj, akceptacja}` zamiast gołej funkcji — `akceptacja: true` kieruje błąd do okna „Nie zapisano
  zmian”, `false` do paska.
- **Nowy** `test/msw/staging.ts` — `handleryStagingu()` (lista, mutacje, cztery trasy polityki) + fabryki
  `przegladDopasowania()`, `przegladStarejKarty()`, `przegladSprzecznychWierszy()`.
- `test/staging.test.tsx` — przepięty na współdzielone mocki, 28/28 bez zmiany asercji.
- **Nowy** `test/staging.rozstrzygnij.test.tsx` — 34 testy.

### Gdzie karta odbiegła od pierwotnego założenia (decyzje D1–D6, 2026-09-23)

1. **Okno ma TRZY gałęzie, nie jedną.** Nagłówek karty i pierwotny prompt wymieniały „okno wyboru”
   (`review`/`resolve`). Realnie: stara karta (`absenceReview`) · dopasowanie (`matchIssue &&
   !duplicateSource`) · sprzeczne wiersze z jednego pliku (`duplicateSource`, sam podgląd bez akcji). Wszystkie
   trzy otwiera TEN SAM przycisk — bez trzeciej gałęzi „Rozstrzygnij” otwierałby czasem puste okno.
2. **D1 — przycisk „Pozostaw starą wstrzymaną i zamknij sprawę” NIE WSZEDŁ.** Zamrożona produkcja `88fa31c`
   go nie ma: łatka `20260923_dotchoice` (23.09 12:31) zastąpiła go przyciskiem „Zapisz wybór w katalogu”
   wołającym `choose-absence-card`. Dowód: `git diff 58d9d1d 88fa31c --
   mirror/frontend/assets/staging-policy-injection.js` (linie z `'Pozostaw starą wstrzymaną i zamknij sprawę'`
   i `close-absence-review` USUNIĘTE). Zakres karty (i prompt) opisywał wersję sprzed 12:31. Trasa
   `POST /api/staging/{id}/close-absence-review` zostaje w backendzie NIEUŻYWANA przez frontend.
3. **D2** — warunek pokazania przycisku czytany z pól `pozycja.powod`/`pozycja.ostrzezenie`, nie z
   `row.textContent` wiersza — w oryginale ukrycie kolumny „Powód” chowało przycisk (niezamierzony efekt
   uboczny wstrzykiwanej nakładki, nie funkcja).
4. **D3** — po sukcesie unieważnienie zapytań (`odswiez()`), nie `location.reload()`.
5. **D4** — okno „Nie zapisano zmian” podpięte w `onError` mutacji akcji akceptacji, bez nakładki na
   globalny `window.fetch`.
6. **D5/D6** — `window.confirm()` → `DialogPotwierdzenia` (teksty dosłowne, wzorzec z 7b/12e); mocki
   wydzielone do `test/msw/staging.ts`, gotowy punkt startu dla I15.11.

### Fakt zmierzony w trakcie, wart zapamiętania (błąd złapany w code review)

Reviewer zauważył, że oryginał ma DWA osobne elementy błędu (`:113`, `:127`) dla gałęzi „stara karta” i
„dopasowanie” — komentarz w kodzie sugerował, że mogą wystąpić razem. **Sprawdzone w importerze: nieprawda.**
`_absenceReview` ustawiają WYŁĄCZNIE `src/import/polityka/fabryka.ts:855` i `:902`, obie budując snapshot od
zera z PRODUKTU KATALOGOWEGO, który `_matchIssue` nie niesie — to pole powstaje w ścieżce dopasowania wiersza
importu (`:485`, `:501`) i kończy się własnym `dodajZgloszenie()` + `continue`. Gałęzie `absenceReview` i
`matchIssue` są więc w danych ROZŁĄCZNE, mimo że oryginał ma dwa osobne elementy DOM dla nich. **Morał: dwa
osobne elementy DOM w oryginale nie dowodzą, że oba stany są osiągalne — sprawdź, co produkuje backend.** Port
ma jeden stan błędu; poprawione w miejscu w komentarzu `OknoRozstrzygniecia.tsx` i w `plan.md`.

### Dowód wierności zamiast GATE na fixtures

Dla czterech tras (`review`, `resolve`, `choose-absence-card`, `close-absence-review`) `contract/fixtures/`
nie zawiera nic i nie było czego nagrać (D129.5 z I15.4c — nagrania obejmują wyłącznie `GET_staging.json` i
`GET_staging_paged.json`). Zamiast tego: asercje na DOSŁOWNĄ treść okna, porównaną znak w znak z oryginałem, a
ciała żądań ze schematami z `contract/openapi.yaml`. Skuteczność potwierdzona dwiema mutacjami tekstu
(podmiana notatki i frazy „RÓŻNY — nie łączyć” → 2 próby, 2 trafienia).

## Do koordynatora

1. **`POST /api/staging/{id}/close-absence-review` jest martwa z perspektywy frontendu** (D1). Do decyzji
   przy cutoverze: przywrócić przycisk „Pozostaw starą wstrzymaną i zamknij sprawę” jako świadome odstępstwo,
   albo odnotować trasę jako nieużywaną. Skutek praktyczny: przy RÓŻNYM DOT użytkowniczka nie ma żadnej akcji
   poza zamknięciem okna, a sprawa wraca przy każdym imporcie, dopóki dostawca nie zmieni danych — to
   zachowanie zamrożonej produkcji, nie defekt portu.
2. **`lib/api.ts::zadanie()` gubi strukturę ciała błędu** — rzuca `Error("<status>: <surowy tekst>")`.
   Rozpakowujemy to lokalnie w `staging/polityka.ts::komunikatBledu()`. Typowany błąd w `lib/api.ts` ruszyłby
   wszystkie widoki naraz → osobny ticket, nie ta karta.
3. **Brak globalnego error middleware w backendzie** — nota z I15.4c „Do koordynatora” p. 6 nadal aktualna;
   bez niego okno „Nie zapisano zmian” pokaże tekst zapasowy zamiast treści błędu dla wyjątków spoza
   `POST /api/staging/accept`.
4. **Zakres I15.11 — ROZSTRZYGNIĘTY, nic do decyzji.** Ticket 140 zgłosił to jako otwartą sprawę
   („zmiana przypisania zakresu”) niepotrzebnie: koordynator zawęził I15.11 do panelu **„Braki
   w cenniku”** jeszcze zanim wydał prompt, a karta chodzi od 2026-09-23 jako ticket
   **`142-FEATURE-braki-w-cenniku`** (gałąź `feature/142-braki-w-cenniku`). Sprostowane
   ticketem `145-DOCS-ustalenia-i15-5` (2026-09-24).
   **Fakt, który zostaje w mocy:** gałąź `absenceReview` — stara karta obok możliwego odpowiednika,
   ocena zgodności EAN i DOT, stan obu kart, wybór jednej karty — **została dowieziona TU**, bo
   siedziała w `mirror/frontend/assets/staging-policy-injection.js` @ `88fa31c`, a nie w żywym
   bundlu `index-PRICEFMT1783512500.js`, jak sugerował opis w `wejscie-110.md`.
   **Morał dla kolejnych kart:** zanim zgłosisz „zmianę przypisania zakresu”, sprawdź stan fali
   (`tools/stan-kart.sh`, `git worktree list`, `git ls-remote --heads origin`) — karta, o którą
   pytasz, może już chodzić z zawężonym zakresem.

**Do rozstrzygnięcia zostają wyłącznie punkty 1–3.** Punkt 1 jest decyzją produktową na cutover,
punkty 2 i 3 to osobne tickety techniczne, nie zakres żadnej karty I15.
