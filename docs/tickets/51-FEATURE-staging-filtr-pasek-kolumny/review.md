# 51-FEATURE-staging-filtr-pasek-kolumny — Code review

> Reviewed: 2026-09-18
> Branch: `feature/51-staging-filtr-pasek-kolumny`
> Diff: 7 plików (5 commitów), `1180 insertions(+), 169 deletions(-)`

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/staging/kolumny.ts:157-165` — `wczytajKolumny()` nie
  waliduje kształtu wartości odczytanej z `localStorage`; JSON `null` (poprawny JSON, więc
  NIE wpada do `catch`) powoduje, że stan komponentu staje się `null`, a `widoczneKolumny[klucz]`
  w `TabelaStagingu.tsx:78` i `KonfiguratorKolumn.tsx:114/138` rzuca `TypeError` w trakcie
  renderu. W apce nie ma żadnego `ErrorBoundary` (sprawdzone: brak wystąpień w `src/`), więc
  skutkiem jest biała strona CAŁEJ aplikacji, nie tylko wyłączenie konfiguratora.
  - Reason: To realny regres wobec oryginału. Oryginalny `loadPrefs()` ma ten sam brak walidacji,
    ale cały enhancer stoi w jednym `try{...}catch(e){console.warn(...)}` (`fe.js:28802` /
    `:29352-29354`), więc ten sam przypadek u Ani kończy się cichym wyłączeniem enhancera —
    reszta strony (w tym tabela) działa dalej. Tu nie ma odpowiednika tego zewnętrznego `catch`,
    więc awaria propaguje wyżej. Plan (sekcja „Testing strategy") explicite zapowiadał jeden test
    „nie wywraca się" dla zablokowanego `localStorage" — w diffie go nie ma (sprawdzone
    `grep -n "spyOn\|throw" test/staging.test.tsx` → pusto), więc luka nie została złapana.
  - Suggestion: w `wczytajKolumny()` dodać strażnika typu (`typeof odczyt === "object" &&
    odczyt !== null`) przed zwróceniem sparsowanej wartości, z fallbackiem do
    `domyslneKolumny()`; dorzucić test na `localStorage.setItem(KLUCZ, "null")`.

- [ ] `rebuild/frontend/src/pages/staging/kolumny.ts:116-129` (`KOLEJNOSC_KOLUMN`) —
  stała jest wyeksportowana i opisana w komentarzu `TabelaStagingu.tsx:11` jako „źródło prawdy",
  ale nigdzie nie jest importowana ani używana (`grep -rn "KOLEJNOSC_KOLUMN" src test` → tylko
  definicja + dwa komentarze). Kolejność kolumn w `TabelaStagingu.tsx:110-119` jest w praktyce
  DRUGĄ, ręcznie utrzymywaną listą tych samych 10 kluczy w JSX.
  - Reason: Dwa niezależne źródła tej samej kolejności mogą się rozjechać przy przyszłej
    zmianie — nic w systemie typów tego nie wymusi, jedynym zabezpieczeniem jest test tekstowy
    nagłówków (`staging.test.tsx:118-124`), który złapie rozjazd dopiero w CI, nie w edytorze.
    Komentarz obiecuje więcej niż kod faktycznie daje.
  - Suggestion: albo zmapować JSX z `KOLEJNOSC_KOLUMN.map(...)` (jeden switch/render na klucz),
    albo usunąć zdanie „źródłem prawdy jest..." i zostawić `KOLEJNOSC_KOLUMN` jako czystą
    dokumentację referencyjną, bez sugerowania wymuszonej spójności.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/staging/kolumny.ts:107` — przecinek końcowy przed `];`
  w literale `KOLUMNY_STAGINGU` (`{ ... dodatkowa: true },];`) — nieszkodliwe, ale niespójne
  z formatowaniem reszty pliku (Prettier/ESLint akurat to przepuszcza).
- [ ] Kilka komentarzy z numerami linii oryginału jest przesuniętych o 1–4 linie względem
  faktycznej lokalizacji w `deminified/frontend-index.js` (np. `Staging.tsx:191` cytuje
  `fe.js:20710`, realnie placeholder jest w linii 20714; `kolumny.ts:110` cytuje `:29155`,
  realnie `POS_KEYS` jest w linii 29156). Różnice są na tyle małe, że nie utrudniają
  odnalezienia miejsca, ale warto przy okazji następnej zmiany w tych plikach zweryfikować
  numerację ponownie (CLAUDE.md pkt 5 — błędny numer linii to dług, któremu wierzy kolejna sesja).

## Plan compliance

### Done ✓
- Krok 1 — `pages/staging/kolumny.ts`: 61 kolumn 1:1 z `STAGING_COLS` (zweryfikowane
  programowo: klucze, etykiety, `locked`/`def`/`extra` — wszystkie 61 pozycji zgodne co do
  bajta z `deminified/frontend-index.js:28808-29105`), klucz `bridge_staging_cols_v2`,
  `domyslneKolumny`/`wczytajKolumny`/`zapiszKolumny` z połykaniem błędów jak `loadPrefs`/`savePrefs`.
- Krok 2 — `KonfiguratorKolumn.tsx`: popover z trzema skrótami o zweryfikowanej (poprawnej)
  semantyce zasięgu („Wszystkie"/„Żadna" pomijają `extra`, „Domyślne" resetuje wszystko),
  dwie sekcje z notką oryginału, `locked` bez przełącznika, przycisk stoi w pasku przed
  „Akceptuj widoczne" (rozwiązanie F1/D4 zweryfikowane wobec `injectButton()` z oryginału).
- Krok 3 — `TabelaStagingu.tsx`: kolejność kolumn = `POS_KEYS` (`checkbox, typ, kod, nazwa,
  dostawca, magazyn, stan, cenaZ, cenaS, zmiana, powod, akcje`), nagłówek „Powód", warunkowy
  render przez `widoczneKolumny` (D9).
- Krok 4 — `Staging.tsx`: `useState("nowa")` (D1), placeholder z trzema kropkami ASCII,
  nagłówek i podtytuł z D6, przyciski masowe z D7 (ikony `Check`/`X` zweryfikowane wobec
  `vr`/`wr` z oryginału — `fe.js:11872`, `:12641`), pasek w jednym rzędzie poza `Card`,
  „zaznaczone" renderowane warunkowo (`idZaznaczone.length > 0 ? ... : null`).
- Krok 5 — `test/staging.test.tsx`: 4 testy poprawione pod D1, 10 nowych — w tym asercja pełnej
  listy nagłówków (łapie przyszłe przestawienie, nie tylko pojedynczy nagłówek) i test sekcji
  „Dodatkowe", który realnie dowodzi martwoty przełączników (liczba `columnheader` się nie
  zmienia po kliknięciu).
- Własność plików: `git diff --name-only origin/develop...HEAD` = dokładnie 7 plików z listy
  dozwolonej dla karty 14b (`plan.md`, `raport.md`, `Staging.tsx`, `KonfiguratorKolumn.tsx`,
  `TabelaStagingu.tsx`, `kolumny.ts`, `staging.test.tsx`) — brak `pages/katalog/**`,
  `pages/konfiguracja/**`, `rebuild/backend/**`, `contract/**`.
- Bramki: `npm run lint`, `npm run typecheck`, `npm run build` — zielone (zweryfikowane
  samodzielnie). `npm test` — **761/761 w 48 plikach**, zgodnie z raportem; `staging.test.tsx`
  osobno: 27/27.

### Missing or deviating ✗
- Krok 4 planu opisywał zapis wyboru kolumn jako „stan `widoczneKolumny` + `useEffect`
  zapisujący do `localStorage`" — w implementacji zapis idzie bezpośrednio w handlerze
  `zmienKolumny` (`Staging.tsx:79-82`), bez `useEffect`. Funkcjonalnie równoważne (ten sam
  efekt: zmiana → zapis), różnica czysto techniczna, nie wpływa na DoD — odnotowuję jako
  drobne odstępstwo od opisu kroku, nie jako problem.
- Test „nie wywraca się" przy zablokowanym/uszkodzonym `localStorage`, zapowiedziany w sekcji
  „Testing strategy" planu, nie wszedł do diffu — patrz SHOULD-FIX wyżej.

### Definition of done
- [x] Widok startuje z filtrem „Nowe produkty"; pierwsze żądanie ma `typZmiany=nowa`.
- [x] Przycisk „Akceptuj/Odrzuć wszystkie (N)" liczy i wysyła bieżący filtr (opisane w raporcie
      w formie do przekazania Ani).
- [x] Placeholder szukajki dosłownie jak w oryginale.
- [x] Pasek akcji w jednym rzędzie, w kolejności z oryginału; „zaznaczone" renderowane
      warunkowo; „wszystkie" w nagłówku.
- [x] Nagłówek i warianty przycisków masowych 1:1 (D6, D7).
- [x] Kolumny tabeli w kolejności `POS_KEYS`, nagłówek „Powód" (D2).
- [x] Konfigurator „Kolumny" w pasku przed „Akceptuj widoczne"; obie sekcje; trzy skróty
      z oryginalną semantyką; ustawienie przeżywa przeładowanie — z zastrzeżeniem SHOULD-FIX
      o braku walidacji kształtu wpisu z pamięci.
- [x] `npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/frontend/`
      — zweryfikowane samodzielnie, wszystko zielone (761/761, 48 plików).
- [x] Żaden plik spoza własności 14b nie jest w diffie gałęzi.
- [ ] Podblok 14b w roadmapie opisuje STAN — **celowo pominięte w tym review**: zgodnie
      z instrukcją zlecenia dokumentacja (`docs/rebuild-roadmap.md`) jest jeszcze
      niezaktualizowana i to jest zapowiedziany następny krok, nie usterka tej karty.

## Parallel-test concerns

None — wszystkie nowe i zmienione testy w `staging.test.tsx` czyszczą `localStorage`,
`sessionStorage` i `queryClient` w `beforeEach`, nie używają twardo zakodowanych portów ani
plików tymczasowych, MSW mockuje sieć w pamięci procesu testowego. Bezpieczne do równoległego
uruchamiania przez wielu agentów.

## Overall assessment

Wierność wobec oryginału jest tu potraktowana bardzo poważnie i w większości miejsc
zweryfikowana nie na słowo: lista 61 kolumn, `POS_KEYS`, semantyka trzech skrótów, warianty
przycisków masowych (ikony, warianty, kolejność) i pozycja przycisku „Kolumny" zgadzają się
z `deminified/frontend-index.js` co do klucza, etykiety i flagi — sprawdzone programowo, nie
tylko wzrokowo. Testy są rzeczowe: asercja pełnej listy nagłówków i test martwoty sekcji
„Dodatkowe" faktycznie coś dowodzą, nie tylko powtarzają implementację. Jedyna realna luka to
brak walidacji kształtu wpisu z `localStorage` w nowo dodanym `wczytajKolumny()` — edge case
wąski, ale w projekcie bez `ErrorBoundary` kończy się bielszym ekranem niż w oryginale, i sam
plan zapowiadał test, którego zabrakło. Do mergowania po ewentualnym uzupełnieniu tego
zabezpieczenia; nic w SHOULD-FIX nie blokuje samo w sobie.
