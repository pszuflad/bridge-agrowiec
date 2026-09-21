# 76-FEATURE-przewoznicy-serwer-paletowy — Code review

## Runda 1

> Reviewed: 2026-09-21
> Branch: feature/76-przewoznicy-serwer-paletowy
> Diff: 17 plików, 3 commity (`6af44a0`, `15a7c31`, `d445935`)

### BLOCKER

- [x] `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx:241-265` — pola `Input`
  edycji nazwy i dzielnika nie są zablokowane w trakcie zapisu (`disabled={zapisuje}` jest tylko na
  przyciskach usuń/dodaj/reset, linie 217, 279, 312 — pola tekstowe go nie mają).
  - Reason: `zatwierdzPole` (onBlur, linia 77) buduje nową listę przez `przewoznicy.map(...)`, gdzie
    `przewoznicy` to prop z poprzedniego renderu. `zapiszListe` woła `mutateAsync` bez oczekiwania
    (`void zapiszListe(...)`), a optymistyczny `setQueryData` w `onMutate` (`WagaGabarytowa.tsx:72-75`)
    ląduje w cache dopiero po `await klient.cancelQueries(...)` — czyli nie w tym samym takcie.
    Jeśli użytkownik zdąży opuścić DRUGIE pole (inny wiersz albo inna kolumna) zanim pierwszy zapis
    zdąży się odzwierciedlić w propsie `przewoznicy`, drugi `PUT` wyśle listę zbudowaną na starych
    danych i po zapisaniu **po cichu cofnie pierwszą zmianę** na serwerze (ostatni zapis wygrywa —
    zgodnie z założeniem D, ale tu przegrywa zapis, który użytkownik faktycznie zrobił jako pierwszy,
    nie „czyjś inny", tylko WŁASNA wcześniejsza edycja w tym samym oknie). To dokładnie scenariusz z
    dopisku pliku: „Ania dodaje tu własnych przewoźników i poprawia dzielniki" — czyli edycja kilku
    wierszy z rzędu jest głównym, oczekiwanym użyciem tego ekranu, nie przypadkiem brzegowym.
  - Suggestion: zablokować pola tekstowe tak jak przyciski (`disabled={zapisuje}` na `Input` przy
    nazwie i dzielniku), albo budować kolejną listę z `klient.getQueryData(KLUCZ_PRZEWOZNIKOW)` w
    momencie zapisu zamiast z propsa, albo serializować zapisy (kolejka/await poprzedniego zanim
    przyjmie się kolejny blur). Ten sam wzorzec dotyczy `usun` (linia 128) i `dodaj` (linia 135) —
    wszystkie budują listę z tego samego potencjalnie nieaktualnego propsa.
  - **Status po rundzie 2:** naprawione w commicie `52bf60e` przez przejście na aktualizator liczony
    z cache React Query — ale naprawa wprowadziła NOWY, subtelniejszy wariant tego samego problemu,
    patrz Runda 2 / BLOCKER.

### SHOULD-FIX

- [x] `rebuild/backend/src/waga-gabarytowa/przewoznicy.ts:56-66` — walidacja nie sprawdza, czy więcej
  niż jeden element ma `domyslny: true`.
  - Reason: nieszkodliwe dla obliczeń (front nie steruje wyborem po `domyslny`), ale niespójny stan
    w bazie (dwóch „domyślnych") nigdy nie jest sygnalizowany.
  - Suggestion: opcjonalnie — nie jest to część DoD, niski priorytet.
  - **Status po rundzie 2:** naprawione (`52bf60e`), reguła i test w `przewoznicy.ts:66-68`.
- [ ] `contract/README.md` — konwencja `x-odbudowa-nowa-trasa` nie jest tam opisana (jest tylko
  `x-odbudowa-auth`, linia 139).
  - Reason: sam raport.md (sekcja Follow-up) to przyznaje i odkłada na potem — zgadzam się z
    odłożeniem, ale odnotowuję, żeby nie zgubić się przy kolejnej trasie spoza produkcji.
  - Suggestion: dopisać przy najbliższej okazji, jak zapowiedziano w raporcie.
  - **Status po rundzie 2:** świadomie odłożone (dokumentacja, faza docs ticketa) — bez zmian.

### NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx:226` — kontener tabeli ma
  `overflow-hidden`, nie `overflow-x-auto` (jak `TabelaHistorii.tsx`, `TabelaNarzutow.tsx` i inne
  tabele w projekcie). Kolumna „Akcje" w trybie edycji zwiększa szerokość wiersza — na wąskim
  ekranie może się przycinać zamiast przewijać. Linia nietknięta w tym diffie (przedticketowa), więc
  nie blokuję, ale warto rozważyć przy kolejnej wizycie w tym pliku.
- [ ] `rebuild/backend/src/waga-gabarytowa/przewoznicy.ts:41` — brak górnego limitu długości listy
  (`cialo.length`); przy koncie z `requireAuth` ryzyko minimalne, ale warto rozważyć sensowny limit
  (np. 50) jako higieniczne zabezpieczenie.

### Plan compliance

#### Done ✓
- Migracja `007` — tabela + seed sześciu przewoźników, GEIS domyślny, `INSERT OR IGNORE`
  (`rebuild/schema/007_waga_gab_przewoznicy.sql`), zgodna z listą Ani; test `db.migracje.test.ts`
  liczy 27 tabel.
- Model Drizzle `wagaGabPrzewoznicy` (`domyslny` w trybie boolean) — `src/db/schema.ts`.
- `repos/przewoznicy.ts` — odczyt z jawną projekcją i `ORDER BY kolejnosc`, zapis w transakcji
  (DELETE + INSERT z `kolejnosc = indeks`), zgodnie z planem.
- `waga-gabarytowa/przewoznicy.ts` (backend) — czysta funkcja walidująca, komunikaty z numerem
  pozycji, dokładnie reguły z założenia E (pusta lista, brak tablicy, `id` niepusty bez duplikatów,
  `nazwa` niepusta po trim, `dzielnik` liczbą dodatnią, `domyslny` opcjonalny boolean, obce pola
  odcięte).
- `routes/waga-gabarytowa.ts` — `GET`/`PUT` za `requireAuth`, walidacja → odczyt „przed" → zapis →
  audyt w try/catch (wzorzec `atrybuty.ts`) → `200` z listą po zapisie. `/oblicz` bez zmian.
- `contract/openapi.yaml` — nowa ścieżka z `x-odbudowa-nowa-trasa`, kody 200/400/401, `security:
  bearerAuth`+`cookieAuth`; `/oblicz` bez zmian; `contract/fixtures/` nieruszane (potwierdzone
  `git status`).
- Frontend: `useQuery` listy, `useMutation` PUT z optymistycznym `setQueryData` i rollbackiem przez
  `invalidateQueries` przy błędzie; efekt D3 wyrównujący `wybrany` po `wczytano` (bez przedwczesnego
  resetu przed hydratacją IndexedDB — sprawdzone czytaniem kodu, brak pętli).
  `TabelaPrzewoznikow.tsx` — zapis na blur (D2), dwa `DialogPotwierdzenia` (usunięcie, reset),
  blokada przycisków w trakcie zapisu (częściowa — patrz BLOCKER).
  `KalkulatorPaletowy.tsx` — nowy, bez pamięci (D4), pełny wynik pięciu pól.
- Stary klucz IndexedDB `waga-gabarytowa-przewoznicy` (C) — potwierdzone: nie jest ani czytany, ani
  pisany (test FE `waga-gabarytowa.test.tsx:160-179` dowodzi wprost).
- `lib/magazynKV.ts`, `obliczenia.ts`, `formula.ts`, `historia/mapowanie.ts`, Spedycja,
  `contract/fixtures/` — potwierdzone nietknięte (`git diff --stat` puste dla tych ścieżek).
- Testy backendu (23 przypadki w `waga-gabarytowa.przewoznicy.test.ts`) i frontendu (MSW,
  scenariusze z karty) — uruchomione lokalnie, zielone (`vitest run`), nie tautologiczne: sprawdzają
  konkretne komunikaty, kolejność, `audit_log`, treść żądań `PUT`/`POST`.
- `npm run typecheck` (backend i frontend) — zielony lokalnie.

#### Missing or deviating ✗
- Brak — zakres z `Implementation plan` pokryty w całości; jedyne odstępstwo (kształt odpowiedzi
  200/400 w tekście markera zamiast inline w linii statusu) jest opisane i uzasadnione w
  raport.md „Deviations from plan" i widoczne w `contract/openapi.yaml`.

#### Definition of done
- [x] Migracja 007 tworzy tabelę i sześciu przewoźników w kolejności, GEIS `domyslny`.
- [x] `GET/PUT /api/waga-gabarytowa/przewoznicy` działają za `requireAuth`, walidują i audytują.
- [x] Kontrakt opisuje nowe trasy, `/oblicz` bez zmian, fixtures bez zmian.
- [x] Widok czyta listę z API, nie z IndexedDB; edycje zapisują się na serwer — **z zastrzeżeniem**:
      działa poprawnie dla pojedynczej edycji na raz; przy szybkiej edycji kilku pól z rzędu możliwa
      cicha utrata wcześniejszej zmiany (patrz BLOCKER).
- [x] Usunięcie i „Przywróć domyślne" pytają o potwierdzenie, anulowanie nic nie zmienia
      (potwierdzone testami FE).
- [x] Ostatniego przewoźnika nie da się usunąć; usunięcie wybranego przenosi wybór.
- [x] Wybór usunięty przez kogoś innego → pierwszy z listy.
- [x] Kalkulator paletowy woła `/oblicz` i pokazuje pełny wynik.
- [x] `waga-gabarytowa.obliczenia.test.ts` przechodzi bez zmian; bramki BE i FE zielone (lint,
      typecheck, build wg raport.md; typecheck i testy zweryfikowane lokalnie w tym review).

### Parallel-test concerns

None — backend testy używają `stworzSrodowiskoTestowe()` (baza tymczasowa, port efemeryczny, jak
reszta kanonu), frontend testy są RTL + MSW bez zasobów współdzielonych. Wszystkie równoległe.

### Overall assessment

Implementacja jest solidna i dobrze udokumentowana — trzy odstępstwa są jawnie oznaczone, kontrakt i
migracja mają wyczerpujące komentarze „dlaczego", a testy (backend i frontend) są konkretne, nie
tautologiczne, i faktycznie sprawdzają zachowanie z karty (potwierdzenia, blur-save, D3, walidację
400 pozycja po pozycji, audyt). Jedyny poważny problem to realna, niepokryta testem luka
współbieżności po stronie klienta: pola tekstowe edytora nie są blokowane w trakcie zapisu, więc
szybka edycja kilku wierszy z rzędu (opisana w komentarzu pliku jako główny scenariusz użycia) może
po cichu cofnąć wcześniejszą zmianę. To do naprawy przed merge — reszta to kosmetyka i notatki na
przyszłość.

---

## Runda 2

> Reviewed: 2026-09-21
> Branch: feature/76-przewoznicy-serwer-paletowy
> Diff: 18 plików, 5 commitów (`6af44a0`, `15a7c31`, `d445935`, `52bf60e`, `bb631bf`) vs `origin/develop`
> Fix z rundy 1 opisany w `raport.md` „Review fixes applied", commit `52bf60e`.

Zweryfikowane lokalnie: `npx vitest run test/waga-gabarytowa.przewoznicy.test.ts test/db.migracje.test.ts`
(backend, 33/33 zielone) i `npx vitest run test/waga-gabarytowa.test.tsx` (frontend, 28/28 zielone).
Mechanizm `isMutating`/`onSuccess` zweryfikowany też przez lekturę
`node_modules/@tanstack/query-core/build/modern/mutation.js` (v5.102.3) — patrz BLOCKER niżej — oraz
empirycznie: tymczasowy test lustrzany wobec `waga-gabarytowa.test.tsx:276-307`, z odwróconą
kolejnością zwolnienia dwóch wstrzymanych odpowiedzi `PUT`, uruchomiony i usunięty w trakcie tego
review (nie wchodzi do diffu, `git status` czysty).

### BLOCKER

- [ ] `rebuild/frontend/src/pages/WagaGabarytowa.tsx:72-79` — gate `isMutating({mutationKey}) <= 1`
  w `onSuccess` chroni tylko przed jednym z dwóch kierunków wyścigu: nie chroni przed odpowiedzią
  WCZEŚNIEJ zainicjowanego zapisu, która wraca z serwera PO TYM, jak PÓŹNIEJSZY zapis już się
  rozliczył.
  - Reason: w `@tanstack/query-core` (`mutation.js:105-113`) `options.onSuccess` mutacji jest
    wołane PRZED `this.#dispatch({type:"success"})` — czyli w momencie, gdy nasz `onSuccess` sam
    sprawdza `isMutating`, KOŃCZĄCA SIĘ mutacja sama nadal liczy się jako `status:"pending"`.
    Dzięki temu próg `<=1` poprawnie wykrywa „ktoś inny jeszcze leci" (wtedy `isMutating` zwraca 2:
    siebie + tego drugiego) — to naprawia dokładnie scenariusz z rundy 1 (odpowiedzi wracają W
    KOLEJNOŚCI inicjacji). Ale gdy PÓŹNIEJSZA mutacja B kończy się PIERWSZA (jej odpowiedź z sieci
    wraca szybciej niż odpowiedź wcześniej wysłanej mutacji A — całkowicie realne przy dwóch
    równoległych żądaniach HTTP do tego samego endpointu, bez żadnego prawdziwego wyścigu po
    stronie serwera), to w chwili, gdy A w końcu dostaje odpowiedź, B jest już rozliczone
    (`status:"success"`, nie liczy się w `isMutating`) — zostaje tylko A samo siebie liczące jako
    „pending" (=1), próg przechodzi, i STARA odpowiedź A **nadpisuje cache nowszą, już potwierdzoną
    zmianą B**. To NIE jest chwilowy UI-flicker: `zapiszListe` (linia 96-106) liczy kolejną zmianę z
    aktualnego cache, więc KOLEJNA edycja dowolnego pola zbuduje swój `PUT` na już cofniętej
    podstawie i trwale nadpisze na serwerze prawidłową wcześniejszą zmianę B. To dokładnie ten sam
    skutek, przed którym miał chronić fix z rundy 1 („szybka edycja kilku wierszy z rzędu cofa
    wcześniejszą zmianę"), tylko wywołany kolejnością ODPOWIEDZI SIECIOWYCH zamiast kolejnością
    RENDEROWANIA propsa.
  - Potwierdzone empirycznie: kopia testu `waga-gabarytowa.test.tsx:276-307` z odwróconą kolejnością
    `zwolnienia[1]()` przed `zwolnienia[0]()` — asercja `input-dzielnik-gls` ma wartość `4500` po
    spóźnionej odpowiedzi pierwszego zapisu **pada**, pole wraca do `4000` (starej wartości sprzed
    edycji GLS). Test tymczasowy usunięty po weryfikacji, nie wchodzi do diffu.
  - Ten sam mechanizm dotyczy ścieżki `przywrocDomyslne` (linia 360-364) i `usun`/`dodaj`
    (`TabelaPrzewoznikow.tsx:134-160`) — wszystkie dzielą tę samą mutację `zapis` i ten sam gate.
  - Regresyjny test rundy 2 (`rebuild/frontend/test/waga-gabarytowa.test.tsx:276-307`) sprawdza
    WYŁĄCZNIE kolejność zgodną z kolejnością inicjacji zapisów (`zwolnienia[0]()` przed
    `zwolnienia[1]()`) — nie łapie odwrotnej kolejności zakończenia, więc realny problem przeszedł
    przez tę rundę fixów nieuchwycony.
  - Suggestion: gate powinien odróżniać „czy JA jestem najnowszym wysłanym zapisem", a nie „ile
    zapisów jest teraz `pending`" — np. monotoniczny licznik/znacznik zapisany przy starcie każdego
    `zapiszListe` (poza reduktorem, w ref/module-scope), porównywany w `onSuccess` z ostatnim
    zapamiętanym znacznikiem; pisz do cache tylko, gdy to WCIĄŻ ten sam, najnowszy znacznik. To samo
    dotyczy `onError` (patrz SHOULD-FIX niżej) — mechanizm powinien być spójny dla obu ścieżek.

### SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/WagaGabarytowa.tsx:80-87` — `onError` wywołuje
  `invalidateQueries({queryKey: KLUCZ_PRZEWOZNIKOW})` bez żadnego gate'u odpowiadającego temu z
  `onSuccess`.
  - Reason: jeśli WCZEŚNIEJSZY zapis padnie (400/500/timeout), a PÓŹNIEJSZY wciąż leci, wymuszony
    refetch może wrócić z serwera ZANIM późniejszy zapis tam dotrze i na chwilę pokazać stan
    sprzed tej (wciąż poprawnej, w locie) zmiany, dopóki `onSuccess` późniejszego zapisu go nie
    skoryguje. Efekt tego samego braku „czy ktoś nowszy jeszcze leci", co w BLOCKERZE wyżej, tylko
    na ścieżce błędu — samo-naprawiający się (bo `onSuccess` późniejszego zapisu i tak nadpisze), a
    nie testowany.
  - Suggestion: przy naprawie BLOCKERA rozważyć spójny mechanizm dla obu callbacków (`onSuccess` i
    `onError`), nie tylko dla sukcesu.
- [ ] `rebuild/frontend/test/waga-gabarytowa.test.tsx:299-302` — asercja „wartość się nie zmieniła"
  oparta o realny `setTimeout(..., 50)`, nie o deterministyczne opróżnienie microtasków/`waitFor`.
  - Reason: test nie korzysta z zasobu współdzielonego (nie jest „nieparalelizowalny" w sensie
    portu/pliku/bazy), ale jest wrażliwy na obciążenie CPU/scheduler. Przy wolniejszym środowisku
    (np. kilku agentów pracujących równolegle na tej samej maszynie) 50 ms może nie starczyć, żeby
    łańcuch promisów (fetch mock → JSON → `onSuccess` → re-render) zdążył się wykonać PRZED
    asercją — test fałszywie przejdzie, nawet gdyby błąd (ten z BLOCKERA wyżej albo przyszły) się
    objawił, tylko odrobinę później niż 50 ms. To osłabia, nie unieważnia, wartość testu.
  - Suggestion: zamiast stałego opóźnienia, czekać na coś obserwowalnego (np. spy na
    `queryClient`/liczbę wywołań `setQueryData`, albo `await Promise.resolve()` kilka razy / mikro-
    task flush) albo wydłużyć margines i udokumentować, że to celowa heurystyka.

### NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx:247-271` — pola `Input`
  nazwy/dzielnika nadal nie mają `disabled={zapisuje}` (mają je tylko przyciski, linie 223, 285,
  318). Pierwotny powód flagowania tego w rundzie 1 (budowanie listy ze STAREGO propsa) jest już
  naprawiony inną drogą (aktualizator liczony z cache) — to, co zostaje, to czysto kosmetyczna
  niespójność UX (przyciski się blokują, pola tekstowe nie sygnalizują trwającego zapisu).
- [ ] Powtórka z rundy 1, wciąż aktualne i wciąż nice-to-have: `TabelaPrzewoznikow.tsx:226`
  (`overflow-hidden` zamiast `overflow-x-auto`) i `przewoznicy.ts:41` (brak górnego limitu długości
  listy w walidacji).

### Plan compliance

#### Done ✓ (nowe w rundzie 2, ponad to co już potwierdzone w rundzie 1)
- Reguła „najwyżej jeden `domyslny`" w walidacji backendu (`przewoznicy.ts:66-68`) + przypadek
  testowy dwóch domyślnych (`waga-gabarytowa.przewoznicy.test.ts:147-150`) — zamyka SHOULD-FIX z
  rundy 1.
- Test seeda migracji 007 przeniesiony do osobnego `describe("migracja 007", …)` z własnym
  `stworzSrodowiskoTestowe()` i BEZ `PUT` w `beforeEach` (`waga-gabarytowa.przewoznicy.test.ts:41-60`)
  — sprawdzone czytaniem kodu: rzeczywiście osobne środowisko, nie ten sam `srodowisko` co
  `describe("wspólna lista przewoźników", …)` niżej, więc test faktycznie mierzy stan „prosto po
  migracjach", nie tautologię po `PUT` tą samą listą.
- Aktualizator liczony z cache React Query (`WagaGabarytowa.tsx:96-106`,
  `TabelaPrzewoznikow.tsx:34, 96-97, 112-113, 138, 153-156`) — zamyka mechanizm z rundy 1 (stary prop
  jako źródło danych do `PUT`), choć wprowadza nowy problem opisany w BLOCKERZE wyżej.

#### Missing or deviating ✗
- Brak nowych odstępstw od planu — runda 2 to wyłącznie poprawki z rundy 1, zakres ticketu się nie
  zmienił.

#### Definition of done
- [ ] Widok czyta listę z API, nie z IndexedDB; edycje zapisują się na serwer — **nadal z
      zastrzeżeniem**: mechanizm z rundy 1 (stale prop) jest naprawiony, ale pojawił się nowy,
      węższy, ale wciąż realny wariant tej samej luki (kolejność ODPOWIEDZI sieciowych zamiast
      kolejności renderowania) — patrz BLOCKER. Reszta DoD z rundy 1 bez zmian, potwierdzona ponownie.

### Parallel-test concerns

Bez zmian względem rundy 1 — backend na `stworzSrodowiskoTestowe()` (baza tymczasowa, port
efemeryczny), frontend RTL + MSW bez zasobów współdzielonych. Dodatkowa uwaga (SHOULD-FIX wyżej):
`waga-gabarytowa.test.tsx:299-302` nie koliduje z innymi agentami (nie używa zasobu współdzielonego),
ale jego wynik zależy od obciążenia maszyny, co przy równoległej pracy kilku agentów na tej samej
maszynie może objawić się jako sporadyczne fałszywe „zielone” (nie „czerwone”) — czyli nie zepsuje
komuś buildu, ale osłabia pewność testu pod presją.

### Overall assessment

Fix z rundy 1 poprawnie usuwa mechanizm, który go spowodował (stary prop jako podstawa `PUT`), i
regresyjny test to udowadnia dla kolejności zgodnej z inicjacją zapisów. Ale wybrany gate
(`isMutating(...) <= 1` w `onSuccess`) rozróżnia tylko „czy ktoś inny jeszcze leci”, a nie „czy JA
jestem najnowszy” — te dwa pytania dają tę samą odpowiedź, gdy odpowiedzi wracają w kolejności
inicjacji, ale różną, gdy wracają odwrotnie (co przy dwóch równoległych żądaniach HTTP jest
zupełnie zwyczajne, nie wymaga żadnego prawdziwego wyścigu na serwerze). Efekt widoczny na ekranie
jest identyczny z tym, co miał naprawiać fix rundy 1 — po cichu cofnięta własna, wcześniejsza
zmiana — i tak samo jak w rundzie 1, kolejna edycja utrwali to cofnięcie na serwerze. To do naprawy
przed merge; reszta (ścieżka błędu bez analogicznego gate'u, wrażliwość testu na `setTimeout`) to
uzupełnienia tej samej poprawki, nie osobne problemy.

---

## Runda 3

> Reviewed: 2026-09-21
> Branch: feature/76-przewoznicy-serwer-paletowy
> Diff: 18 plików, 6 commitów (`6af44a0`, `15a7c31`, `d445935`, `52bf60e`, `bb631bf`, `98497c4`) vs `origin/develop`
> Fix z rundy 2 opisany w `raport.md` „Review fixes applied → Runda 2", commit `98497c4`.

Zweryfikowane lokalnie: `npx vitest run test/waga-gabarytowa.test.tsx` (frontend, 28/28 zielone, 5×
powtórzone dla samego testu „szybkie edycje z rzędu…" — deterministyczne, brak `setTimeout`),
`npx vitest run test/waga-gabarytowa.przewoznicy.test.ts test/db.migracje.test.ts` (backend, 33/33
zielone), `npm run typecheck` (frontend, zielony), `npx eslint` na obu zmienionych plikach (czysto).

Mechanizm zweryfikowany czytaniem źródeł `@tanstack/query-core@5.102.3`
(`node_modules/@tanstack/query-core/build/modern/{mutation,mutationCache,retryer,mutationObserver}.js`)
i `@tanstack/react-query@5.x` (`build/modern/useMutation.js`) — patrz szczegóły niżej — oraz
empirycznie: podmieniona tymczasowo treść `WagaGabarytowa.tsx` na wersję z rundy 2 (`git show 52bf60e:…`,
bez `scope`), test „szybkie edycje z rzędu…" **pada deterministycznie** na starym kodzie
(`zwolnienia` osiąga długość 2 zamiast 1 — oba PUT-y lecą naraz), plik przywrócony do stanu z HEAD
(`git status` czysty po przywróceniu, sprawdzone).

### Weryfikacja mechanizmu `scope`

- `MutationCache.canRun()` (`mutationCache.js:59-65`) pozwala wystartować mutacji tylko, gdy w tym samym
  `scope.id` nie ma innej mutacji o statusie `"pending"` przed nią w kolejności dodania. `Mutation.execute()`
  (`mutation.js:56-105`) liczy `isPaused = !retryer.canStart()` **zanim** sam dostanie status `"pending"` —
  więc dla pierwszego zapisu w scope `canRun` widzi pustą kolejkę i rusza od razu; dla drugiego (i kolejnych)
  `canRun` widzi pierwszy jako `"pending"` i wymusza `pause()` (`retryer.js:67-77`) — **realne wywołanie sieciowe
  (`config.fn()`, czyli `mutationFn`) nie następuje**, dopóki `pause()` się nie rozwiąże.
- `pause()` rozwiązuje dopiero `MutationCache.runNext()` (`mutationCache.js:66-70`), wołane w bloku `finally`
  mutacji poprzedzającej (`mutation.js:141-144`) — czyli **po** jej `dispatch({type:"success"|"error"})`, więc
  w tym momencie poprzednia mutacja nie liczy się już jako `"pending"` i kolejka przechodzi do następnej w
  kolejności `push` (FIFO, `mutationCache.js:28-40`). Potwierdza to zarówno mechanizm serializacji (drugi PUT
  faktycznie czeka na odpowiedź pierwszego), jak i to, że każda zakolejkowana mutacja rusza dokładnie raz, po
  kolei — nie wszystkie naraz po zwolnieniu pierwszej.
- `mutateAsync` (`useMutation.js:16`) to bezpośrednio `observer.mutate`, które synchronicznie woła
  `mutationCache.build()` (dopisanie do kolejki scope) i `mutation.execute()` (`mutationObserver.js:53-58`) —
  bez żadnej dodatkowej mikrotaskowej przerwy przed dopisaniem do kolejki. Ponieważ `zapiszListe`
  (`WagaGabarytowa.tsx:103-114`) inkrementuje `ostatniZapis.current` i woła `zapis.mutateAsync(...)`
  synchronicznie (bez `await` pomiędzy), kolejność numerów `nr` == kolejność wywołań == kolejność w
  kolejce scope — trzy niezależne mechanizmy (numer, FIFO scope, `onSuccess`/`onError` per-mutation) zgadzają
  się ze sobą, nie tylko przypadkiem w prostym scenariuszu z testu.
- `mutateAsync` zakolejkowanej (spauzowanej) mutacji **rozwiązuje się poprawnie** — `execute()` jest
  pojedynczą funkcją `async`, jej zwracana obietnica kończy się dopiero po faktycznym `retryer.start()`
  (który przechodzi przez `pause().then(run)`), więc `await zapis.mutateAsync(...)` w `zapiszListe` czeka na
  realny wynik zapytania, nie na sam moment zakolejkowania.
- `klient.isMutating()` liczy mutacje po statusie `"pending"`, a ten ustawia się **przed** faktycznym
  wysłaniem żądania (patrz wyżej) — więc `isMutating() === 2` w teście (linia 308) poprawnie odzwierciedla
  „oba zapisy zlecone", nie „oba lecą po sieci" — zgodne z założeniem testu i z komentarzem w kodzie
  (`WagaGabarytowa.tsx:73-77`).
- `onSuccess`/`onError` na poziomie opcji `useMutation` (używane tu do bramki `nr === ostatniZapis.current`,
  linie 82-94) są wołane **wewnątrz** `Mutation.execute()` na konkretnej instancji `Mutation`, niezależnie od
  tego, czy obiekt `MutationObserver` (jeden na komponent) w międzyczasie „przełączył się" na nowszą mutację
  przez kolejne `mutate()` (`mutationObserver.js:53` robi `removeObserver` na poprzedniej) — usunięcie
  obserwatora odłącza tylko UI-aktualizacje (`#currentResult`), nie opcje `onSuccess`/`onError` zapisane w
  samej instancji `Mutation` w momencie `build()`. Bramka `nr` działa więc niezależnie od tego odłączenia.

Wniosek: gate z rundy 2 (`isMutating <= 1`) był heurystyką podatną na kolejność odpowiedzi sieciowych.
Obecny mechanizm usuwa problem **u źródła** — drugi PUT fizycznie nie startuje, dopóki pierwszy się nie
rozliczy — więc odpowiedzi z definicji wracają w kolejności wysłania, a numer `nr` jest dodatkowym,
niezależnym zabezpieczeniem (i jedynym miejscem odczytywanym przez `onSuccess`/`onError`, nie samym
`isMutating`). Nie znalazłem scenariusza, w którym ten mechanizm dopuszcza nadpisanie nowszej, potwierdzonej
zmiany starszą odpowiedzią — łańcuch dowodowy jest domknięty (kod biblioteki + test empiryczny + regresja na
kodzie z rundy 2).

### BLOCKER

Brak.

### SHOULD-FIX

Brak nowych. Oba SHOULD-FIX z rundy 2 zamknięte:
- [x] `onError` bez gate'u analogicznego do `onSuccess` — naprawione tym samym numerem `nr`
  (`WagaGabarytowa.tsx:85-94`).
- [x] `setTimeout(50)` w teście — usunięty; test czeka na `isMutating()`, długość tablicy `zwolnienia` i
  atrapę serwera liczącą równoległe żądania (`waga-gabarytowa.test.tsx:283-329`), zero `setTimeout` w
  całym pliku (sprawdzone `grep`).

### NICE-TO-HAVE

Bez zmian względem rundy 2 (żaden z poniższych nie jest częścią zakresu diffu tej rundy):
- [ ] `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx:247,262,302,308` — pola `Input`
  nazwy/dzielnika nadal nie mają `disabled={zapisuje}` (tylko przyciski, linie 223, 285, 318). Czysto
  kosmetyczne — mechanizm kolejki i tak nie dopuszcza utraty zmian nawet bez tego atrybutu.
- [ ] `TabelaPrzewoznikow.tsx:232` — `overflow-hidden` zamiast `overflow-x-auto`, linia przedticketowa.
- [ ] `rebuild/backend/src/waga-gabarytowa/przewoznicy.ts:41` — brak górnego limitu długości listy.
- [ ] `contract/README.md` — konwencja `x-odbudowa-nowa-trasa` nieopisana, świadomie odłożone do fazy docs.

### Plan compliance

#### Done ✓ (nowe w rundzie 3, ponad to co już potwierdzone w rundach 1–2)
- Serializacja zapisów listy przez `scope: { id: "waga-gabarytowa-przewoznicy" }`
  (`WagaGabarytowa.tsx:79-80`) — zamyka BLOCKER z rundy 2 u źródła (kolejka FIFO na poziomie
  biblioteki, nie heurystyka `isMutating`).
- Numer zapisu (`ostatniZapis` w `useRef`, `WagaGabarytowa.tsx:70,83,91,107`) — jedyny warunek, od
  którego zależy dotknięcie cache w `onSuccess`/`onError`; spójny dla obu ścieżek.
- Test regresyjny „szybkie edycje z rzędu zapisują się po kolei i nie cofają się nawzajem"
  (`waga-gabarytowa.test.tsx:283-329`) — deterministyczny (bez `setTimeout`), sprawdza jednocześnie:
  liczbę równoległych żądań PUT po stronie atrapy serwera (musi być 1), kolejność wywołań,
  zawartość drugiego payloadu (musi zawierać już zmianę z pierwszego) i stan końcowy cache + serwera.
  Potwierdzone empirycznie, że pada na kodzie z rundy 2 (bez `scope`).

#### Missing or deviating ✗
- Brak nowych odstępstw od planu — runda 3 to wyłącznie poprawka z rundy 2, zakres ticketu się nie
  zmienił.

#### Definition of done
- [x] Widok czyta listę z API, nie z IndexedDB; edycje zapisują się na serwer — **zastrzeżenie z rund
      1–2 zamknięte**: mechanizm kolejki (`scope`) + numer zapisu eliminuje utratę wcześniejszej zmiany
      niezależnie od kolejności odpowiedzi sieciowych. Reszta DoD z rund 1–2 bez zmian, potwierdzona
      ponownie (testy backendu i frontendu zielone lokalnie w tej rundzie).

### Parallel-test concerns

Bez zmian względem rund 1–2 — backend na `stworzSrodowiskoTestowe()` (baza tymczasowa, port
efemeryczny), frontend RTL + MSW bez zasobów współdzielonych. Test z rundy 3 nie używa zegara ani
zasobów współdzielonych (atrapa serwera + `waitFor` na stanie klienta), więc nie jest wrażliwy na
obciążenie maszyny — usuwa też obawę zgłoszoną w rundzie 2 dla poprzedniej wersji tego testu.

### Overall assessment

Poprawka z rundy 3 usuwa problem strukturalnie, nie łatką na heurystyce: `scope` w bibliotece
`@tanstack/query-core` fizycznie serializuje wywołania sieciowe (drugi PUT nie startuje, dopóki
pierwszy się nie rozliczy), więc odpowiedzi z definicji nie mogą wrócić w odwrotnej kolejności —
scenariusz z BLOCKERA rundy 2 przestaje być możliwy, a nie tylko mniej prawdopodobny. Numer zapisu
(`nr`) jest dodatkowym, niezależnym zabezpieczeniem i jedynym warunkiem sterującym zapisem do cache,
spójnym dla `onSuccess` i `onError`. Zweryfikowałem to trzema niezależnymi drogami: lekturą
odpowiednich fragmentów biblioteki (kolejność `dispatch`/`canRun`/`pause`/`runNext`), testem
regresyjnym uruchomionym 5× (deterministyczny) i ręcznym cofnięciem pliku do wersji z rundy 2, na
której nowy test pada dokładnie tak, jak się spodziewano. Nie znalazłem żadnego BLOCKERA w tej
rundzie. Ticket gotowy do merge od strony code review.
