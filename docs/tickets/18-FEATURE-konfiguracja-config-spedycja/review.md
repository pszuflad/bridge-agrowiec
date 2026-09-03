# 18-FEATURE-konfiguracja-config-spedycja — Code review

> Reviewed: 2026-09-03
> Branch: feature/18-konfiguracja-config-spedycja
> Diff: 24 pliki, 3 commity (backend config+spedycja / GATE+testy backendu / cztery zakładki frontendu)

## BLOCKER

- [ ] `rebuild/frontend/src/pages/konfiguracja/Ai.tsx:35-36`, `Shoper.tsx:51-56` — pola formularza inicjalizują się z `useState(konfiguracja?.[...] ?? domyślna)`, a `konfiguracja` pochodzi z `useQuery`. Gdy zakładka montuje się (pierwszy raz w sesji, po kliknięciu w tab) ZANIM `GET /api/config` zdąży odpowiedzieć, `useState` zamraża wartość początkową (`""` / domyślne mapowanie) na stałe — kolejny render po nadejściu danych NIE resetuje już zainicjalizowanego stanu (`useState` inicjalizuje tylko przy mountcie). Formularz pokazuje wtedy puste/domyślne pola mimo że backend ma realne dane, a kliknięcie „Zapisz” bez świadomej edycji **nadpisuje zapisany `ai_fallback.klucz_api` / mapowanie Shopera pustką lub wartością domyślną** — realna utrata danych.
  - Zweryfikowane empirycznie: dodałem tymczasowy test z `msw` `delay(50)` na `GET /api/config` (usunięty po weryfikacji, nie zostawiony w repo) — z opóźnioną odpowiedzią pole `input-openai-key` NIGDY nie przyjmuje wartości z serwera, mimo że zapytanie faktycznie się kończy i `isLoading` przechodzi na `false`. Istniejący test w `konfiguracja.ustawienia.test.tsx` przechodzi tylko dlatego, że mock MSW odpowiada praktycznie natychmiast (bez sztucznego opóźnienia), więc w testowym środowisku wyścig nigdy się nie ujawnia — to fałszywe poczucie bezpieczeństwa, nie dowód poprawności.
  - Komentarz w `Konfiguracja.tsx:54-60` i w `Ai.tsx:33-34` twierdzi, że leniwe montowanie `TabsContent` + `staleTime: Infinity` chronią przed pustym startem — to nieprawda dla PIERWSZEGO wejścia w zakładkę w danej sesji (cache jest wtedy pusty, więc dokładnie wtedy `isLoading` jest `true` przy mountcie). Dodatkowo komentarz w `Ai.tsx:33` mówi „Klucz `key` na komponencie w `Konfiguracja.tsx` pilnuje…” — takiego `key` w `Konfiguracja.tsx` **nie ma** (sprawdzone), więc komentarz opisuje mechanizm, którego w kodzie nie ma.
  - Dla porównania: `Katalog.tsx:31-37` i oryginalny `XT()` (`:26020-26026`) rozwiązują dokładnie ten sam problem poprawnie — `useEffect` ustawia stan PO nadejściu danych, z osobną flagą `wczytano`/`n` blokującą render do czasu odczytu. `Spedycja.tsx` też jest bezpieczna (czyta `limity` bezpośrednio przy każdym renderze, nie zamraża jej w `useState`). Wzorzec z `Ai.tsx`/`Shoper.tsx` należy ujednolicić do tego samego `useEffect`-owego sposobu.
  - Uwaga do kontekstu 1:1: oryginalny `YT`/`GK` (`:25940-26018`, `:26208-26277`) mają teoretycznie tę samą klasę wyścigu, ale tam `cfg` jest ładowane RAZ na poziomie całego ekranu Konfiguracji (`eM`, `tt({queryKey:["/api/config"]})` przed `Tabs`), więc zapytanie startuje natychmiast po wejściu na `/konfiguracja` i zwykle kończy się, zanim użytkownik zdąży kliknąć w zakładkę. Port przeniósł `useQuery` w głąb leniwie montowanych komponentów liści, co realnie SKRACA okno bezpieczeństwa do zera przy pierwszym kliknięciu w zakładkę — to nie jest neutralny port 1:1, tylko pogorszenie względem oryginału, i akurat tego dotyczy uwaga nr 7 z briefu.
  - Sugestia: przenieść inicjalizację stanu z `useState(zawsze-tylko-raz)` na `useEffect(() => { if (konfiguracja) { ustawKluczApi(...); ustawModel(...); } }, [konfiguracja])`, albo nie montować wnętrza formularza dopóki `konfiguracja` nie istnieje (tak jak robi to `Katalog.tsx` z `wczytano`).

- [ ] `docs/rebuild-roadmap.md` (Iteracja 11, ok. linii 1066-1092) i `docs/rebuild-backlog.md` — nieaktualizowane w tym tickecie (`git diff origin/develop...HEAD --stat` nie pokazuje żadnej zmiany w tych plikach). Roadmapa nadal ma `Status: ⬜`, nadal pisze `GET/PUT /api/config` (błąd, który plan.md D6 wprost każe sprostować), i nadal mówi o „czterech zaślepkach: spedycja, shoper, katalog, ai” — stan sprzed tego ticketa.
  - Reason: to wprost pozycja z Definition of done w `plan.md:325-326` („Roadmapa: blok I11 oznaczony jako zrobiony, sprostowane „PUT” → `POST {klucz, wartosc}`; backlog: wpisy o D2 i D4”) — niespełniona. `raport.md` też nigdzie nie wspomina, że roadmapa/backlog zostały zaktualizowane. Zasady projektu (`CLAUDE.md`) traktują to jako obowiązek o wysokim priorytecie („roadmapa czyta następna sesja”), nie kosmetykę.
  - Suggestion: dopisać sekcję I11 w roadmapie (status ✅, data, poprawka PUT→POST, adnotacja o 3f przeniesionym wcześniej) i wpisy do backlogu o D2 (spedycja przez sieć — odstępstwo od 1:1) oraz D4 (whitelista configu, zamknięcie tej samej klasy dziury co #14).

## SHOULD-FIX

- [ ] `rebuild/backend/src/routes/spedycja.ts:58-66` — audyt `edycja_spedycji` loguje **surowe** `req.body`, nie odsiane `pola`/`dostawcaKod` — pole spoza whitelisty (np. próba wysłania `id`) trafia do `audit_log.szczegoly_json` jawnie, mimo że do bazy go nie zapisano. To świadome odstępstwo od planu (raport.md, „Odstępstwa od planu” #1), uzasadnione precedensem z `markups.ts` — akceptowalne, ale warto upewnić się, że przyszli czytelnicy `audit_log` (np. I12 `/api/audit-log`) wiedzą, że treść audytu i treść zapisu mogą się różnić. Nie blokuje, tylko odnotowuję zgodnie z pkt. 6 briefu.
- [ ] `rebuild/frontend/src/pages/konfiguracja/Ai.tsx` / `Shoper.tsx` — brak `useEffect` synchronizującego stan z danymi (patrz BLOCKER wyżej) sprawia też, że **odświeżenie configu w tle** (np. po zapisie w innej karcie i `invalidateQueries`, gdy React Query faktycznie refetchuje z serwera mimo `staleTime: Infinity` — np. po ręcznym `invalidateQueries` z poziomu tej samej karty) nie zaktualizuje pól, jeśli użytkownik już raz zmontował komponent. To ten sam mechanizm co BLOCKER, ale warto to naprawić razem, jednym patchem.
- [ ] Brak testu na race z BLOCKER-a wyżej — `konfiguracja.ustawienia.test.tsx` nie zawiera żadnego przypadku z opóźnioną odpowiedzią `GET /api/config` (np. `msw`'owe `delay()`), więc dokładnie ten scenariusz nigdy nie jest ćwiczony, a mock bez opóźnienia maskuje błąd. Po naprawie BLOCKER-a warto dodać test z `delay()` pilnujący, że pole finalnie pokazuje wartość z serwera.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/spedycja.ts:63-68` — rzutowanie `wiersz as Partial<typeof spedycjaLimity.$inferInsert> & {dostawcaKod: string}` jest trochę toporne; komentarz to tłumaczy (analogia do `markups.ts:97`), więc akceptowalne, ale warto rozważyć wspólny helper typu dla wszystkich repo korzystających z `odsiejPola`.
- [ ] `rebuild/frontend/src/pages/konfiguracja/Spedycja.tsx` — `aria-label` dodane do wszystkich pól (`Próg netto — <KOD>` itd.) to dobre uzupełnienie dostępności ponad oryginał (oryginał nie miał żadnych etykiet ARIA na inputach w tabeli) — pozytywna nota, nie problem.
- [ ] `rebuild/backend/src/routes/config.ts:70` — komunikat błędu 400 wylicza `KLUCZE_KONFIGURACJI.join(", ")` przy każdym nieudanym żądaniu; przy 13 elementach to nieszkodliwe, ale gdyby lista kiedyś urosła, warto rozważyć, czy taki komunikat nie zdradza za dużo szczegółów wewnętrznych nieautoryzowanemu klientowi (trasa i tak jest za `requireAuth`, więc ryzyko minimalne).

## Plan compliance

### Done ✓
- Krok 1 (schemat + seed) — `spedycjaLimity.dostawcaKod` ma `.unique()`, `seed-poczatkowy.ts` 1:1 z `xR`/`vR` (zweryfikowane bajt po bajcie względem `deminified/backend-index.cjs:45571-45644`).
- Krok 2 (repozytoria) — `odczytajCalaKonfiguracje`, `zapiszKonfiguracje`, `KLUCZE_KONFIGURACJI` (13 pozycji), `listaSpedycji` (bez `ORDER BY`, zgodnie z `U.listSpedycja()`), `zapiszLimitSpedycji` (select-then-write jak `U.upsertSpedycja`), `odsiejPolaSpedycji`.
- Krok 3 (trasy) — `GET/POST /api/config`, `GET/POST /api/spedycja`, oba za `requireAuth`, maskowanie `*klucz_api*` w audycie 1:1 z `:48746`, wpięcie w `app.ts`.
- Krok 4 (GATE) — cztery operacje kontraktu + dwa fixtures sprawdzone kształtem I wartościami, zero zadeklarowanych wyjątków, mutacje w osobnym środowisku (unika zależności od kolejności testów).
- Krok 5 (testy backendu) — whitelista, maskowanie na granicy `klucz_api`, upsert po `dostawcaKod`, filtr pól, 401 na wszystkich czterech trasach — wszystko pokryte i faktycznie asercyjne (nie testy „z definicji”).
- Krok 6-7 (klienci + zakładki) — `config.ts`/`spedycja.ts` klienci zgodni z opisem; `Spedycja.tsx`, `Katalog.tsx` wierne portowi (zweryfikowane linia po linii względem `qT()` i `XT()`); `Shoper.tsx`/`Ai.tsx` wierne w warstwie tekstów/testid/logiki zapisu, ale patrz BLOCKER wyżej ws. inicjalizacji stanu.
- Krok 8 (spięcie) — `domykaBlok`/`opis` usunięte z `zakladki.ts`, cztery nowe `TabsContent`, zaślepki usunięte.
- Krok 9 (testy frontendu) — `konfiguracja.spedycja.test.tsx` i `konfiguracja.ustawienia.test.tsx` pokrywają zakres z planu; `konfiguracja.test.tsx` zaktualizowany po zniknięciu zaślepek.

### Missing or deviating ✗
- Roadmapa i backlog nie zaktualizowane (patrz BLOCKER).
- Trzy odstępstwa od planu opisane w `raport.md` („Odstępstwa od planu”) są świadome i uzasadnione, nie wymagają dodatkowej korekty — audyt spedycji loguje surowe body (SHOULD-FIX wyżej dla świadomości), walidacja `wartosc` jako string (rozsądne dociągnięcie), usunięcie pola `opis` (spójne uzasadnienie).
- Punkt 7 z briefu Mastera („Zweryfikuj, czy założenie o leniwym montowaniu jest prawdziwe”) — założenie jest CZĘŚCIOWO fałszywe: chroni przed pustym stanem tylko wtedy, gdy dane są już w cache'u w momencie montowania karty; przy pierwszym wejściu w sesji nie chroni wcale. To realny, potwierdzony problem (BLOCKER wyżej).

### Definition of done
- [x] `GET /api/config` zwraca płaski obiekt zgodny 1:1 z fixture'em (potwierdzone GATE-em i ręcznie)
- [x] `POST /api/config` przyjmuje `{klucz, wartosc}`, odrzuca klucz spoza whitelisty (400), maskuje `*klucz_api*` w audycie
- [x] `GET /api/spedycja` zwraca gołą tablicę zgodną z fixture'em
- [x] `POST /api/spedycja` robi upsert po `dostawcaKod` i filtruje pola
- [x] Wszystkie cztery trasy za `requireAuth`
- [ ] Cztery zakładki renderują się i zapisują poprawnie — **spedycja i katalog tak, ale shoper i ai mają ryzyko startu z pustymi/domyślnymi wartościami i nadpisania zapisanej konfiguracji przy pierwszym wejściu w sesji** (patrz BLOCKER)
- [x] Zaślepki i `domykaBlok` zniknęły, sześć zakładek wypełnionych
- [x] GATE zielony, bez zadeklarowanych wyjątków
- [x] `lint`/`typecheck`/`build`/`test` czyste w obu pakietach (zweryfikowane ponownie: backend 629/629, frontend 299/299, lint i typecheck bez błędów)
- [ ] Roadmapa i backlog zaktualizowane — **nie zrobione** (patrz BLOCKER)

## Parallel-test concerns

Brak zastrzeżeń — testy backendu używają `stworzSrodowiskoTestowe()` (baza w katalogu tymczasowym, port efemeryczny przez supertest bez `listen()`), testy frontendu MSW + jsdom bez współdzielonych zasobów. GATE świadomie rozdziela odczyty i mutacje na dwa niezależne środowiska właśnie po to, by uniknąć zależności od kolejności wykonania. Żaden test nie odwołuje się do stałego portu ani ścieżki na dysku poza katalogami tymczasowymi.

## Overall assessment

Warstwa backendowa jest solidna: repozytoria, trasy, GATE i testy zachowania są wierne oryginałowi punkt po punkcie (zweryfikowałem to bezpośrednio względem `deminified/backend-index.cjs`), whitelisty domykają realną dziurę, a GATE faktycznie coś dowodzi (kontrola kluczy i wartości, nie tylko kształtu). Frontend jest w większości równie staranny (Spedycja, Katalog, Shoper/Ai w warstwie tekstów i zapisu) — ale ma jeden poważny, potwierdzony empirycznie błąd wyścigu w `Ai.tsx`/`Shoper.tsx`, który przy pierwszym wejściu w zakładkę na wolniejszym połączeniu może wyzerować zapisany klucz API OpenAI lub mapowanie CSV Shopera. To dokładnie ten typ ryzyka, o którym ostrzegał brief (pkt 7), i wymaga poprawki przed mergem. Do tego roadmapa/backlog zostały pominięte wbrew jawnemu punktowi w Definition of done — do uzupełnienia równolegle.

---

# Druga iteracja przeglądu

> Reviewed: 2026-09-03
> Branch: feature/18-konfiguracja-config-spedycja
> Diff: 31 plików, 5 commitów (backend config+spedycja / GATE+testy backendu / cztery zakładki frontendu / review fix — stan formularzy / sync docs)

## Status pozycji z pierwszej iteracji

### BLOCKER 1 (race w `Ai.tsx`/`Shoper.tsx`) — **ZAMKNIĘTE**

Zweryfikowane empirycznie, nie tylko z lektury:

- Przeczytałem aktualny kod `Ai.tsx`, `Shoper.tsx`, `Konfiguracja.tsx` — podział na komponent
  pobierający (`Ai`/`Shoper`, guard `if (!konfiguracja) return <Wczytywanie/>`) i formularz
  (`FormularzAi`/`FormularzShopera`) montowany DOPIERO z propsem `konfiguracja: Konfiguracja`
  (nie opcjonalnym) jest poprawny: `useState` w formularzu nie może już zainicjalizować się
  z `undefined`, bo formularz w ogóle nie istnieje, dopóki dane nie są gotowe.
- **Odtworzyłem regresję na żywo**, żeby sprawdzić, czy test faktycznie coś broni, nie tylko
  czy jest zielony: podmieniłem `Ai.tsx` z powrotem na stary wzorzec (jeden komponent,
  `useState(konfiguracja?.[...] ?? domyślna)`), uruchomiłem
  `test/konfiguracja.ustawienia.test.tsx` — dokładnie te dwa testy z bloku „pierwsze wejście
  w zakładkę” padły, i to z DOKŁADNIE tym efektem, o którym mówił poprzedni BLOCKER: pole
  modelu zostaje na `"gpt-4o-mini"` zamiast `"gpt-4o"` z serwera, a zapis bez edycji wysyła
  `wartosc: ""` zamiast `"sk-proj-zapisany-wczesniej"` — czyli realne skasowanie zapisanego
  klucza API. Po przywróceniu oryginalnego pliku (`diff` z commitem — zero różnic) wszystkie
  302 testy frontendu znowu zielone. Nie da się więc „oszukać” tego testu przypadkowo —
  łapie dokładnie tę klasę błędu, po którą został napisany.
- `Katalog.tsx` — potwierdzone ponownie: stan ładuje się przez `useEffect` + flagę `wczytano`,
  ten sam wzorzec co poprzednio, bez zmian w tym obszarze.
- `Spedycja.tsx` — potwierdzone ponownie: `wartosc()` czyta `limity` (wynik `useQuery`)
  bezpośrednio przy KAŻDYM renderze, nigdy nie zamraża go w `useState`; jedyny `useState` to
  `zmiany` (niezapisane edycje użytkownika) i `komunikat` — żadnego mechanizmu, który mógłby
  „zamrozić się na pustce”. Zero regresji tutaj.
- **Regresja po zapisie + `invalidateQueries`:** sprawdzona logicznie — `onSuccess` woła
  `invalidateQueries({queryKey: KLUCZ_KONFIGURACJI})`, co odświeża `konfiguracja` w `Ai()`/
  `Shoper()`, ale `FormularzAi`/`FormularzShopera` NIE re-inicjalizują `useState` z nowych
  propsów (React nie resetuje stanu przy zmianie propsa bez zmiany `key`) — to jest ŚWIADOMA
  decyzja opisana w komentarzu (`Ai.tsx:54-56`) i zgodna z oryginałem (`useState(e[...])`
  w `:25943` też nie resetuje się po odświeżeniu). Zachowanie sensowne: pola pokazują to, co
  użytkownik właśnie zapisał (bo sam je tam wpisał), nie różnią się od tego, co przyszło
  z serwera po `invalidateQueries` (te same wartości, bo właśnie je zapisano).

### BLOCKER 2 (roadmapa/backlog nieuzupełnione) — **ZAMKNIĘTE**

Sprawdzone: `docs/rebuild-roadmap.md` blok „Iteracja 11” przepisany ze stanu „zamiar” (⬜,
`GET/PUT /api/config`, „cztery zaślepki”) na stan faktyczny (✅ 2026-09-03, `POST /api/config`
z `{klucz, wartosc}`, `POST /api/spedycja` dopisane, DoD z checkboxami ✅). Sprostowanie
`PUT`→`POST` poprawione też w bloku 3f (linia 507), gdzie było powielone. Backlog: wpis #14
rozszerzony o `POST /api/spedycja`/`POST /api/config` jako naprawione w I11; nowe wpisy #26
(spedycja przez sieć, D2) i #27 (whitelista configu, D4) — oba z pełnym opisem „co robi
produkcja” / „decyzja użytkownika”, zgodnie z konwencją reszty backlogu.

**Sprawdzone zgodnie z zasadą #2 z `CLAUDE.md`** („ustalenie o przyszłym bloku wpisz DO TEGO
BLOKU”): dwie noty „⚠ WEJŚCIE Z ITERACJI 11” (nowe akcje w audycie, przycisk „Usuń wszystko
z katalogu”) siedzą fizycznie w sekcji „### Iteracja 12” (od linii 1124), nie w sekcji I11
(kończy się linią 1123) — potwierdzone przez `grep -n "^### Iteracja"`. Podobnie nota do I8
(`shoper.kolumny`/`shoper.separator` już zapisywane, jeszcze nie czytane) jest w sekcji
„Iteracja 8”, nie w I11. Rozmieszczenie jest poprawne.

`docs/spec-backend.md`, `docs/spec-frontend.md`, `CLAUDE.md` — zmiany przeczytane w całości,
treściwe, bez sprzeczności z tym, co faktycznie jest w kodzie (zweryfikowałem m.in. liczbę 13
kluczy w `KLUCZE_KONFIGURACJI` — zgadza się z opisem „11 z seeda + 2 z Shopera”).

### SHOULD-FIX „brak testu na race” — **ZAMKNIĘTE**

Blok `describe("pierwsze wejście w zakładkę (config spoza cache'u)")` — trzy testy, `delay(50)`
w MSW + config z wartościami jawnie różnymi od domyślnych (unika fałszywego zielonego wyniku,
bo akurat wartości domyślne pokrywały się z fixture'em). Zweryfikowane wyżej, że testy
faktycznie łapią regresję. `delay(50)` nie jest kruche — `findBy*` z testing-library czeka
domyślnie do 1000 ms (brak nadpisania `asyncUtilTimeout` w `test/setup.ts`), więc 50 ms ma
20× zapas nawet na wolnej maszynie.

### SHOULD-FIX „audyt spedycji loguje surowe ciało” — **BEZ ZMIAN, ZAAKCEPTOWANE**

Świadomie zostawione bez zmian — uzasadnienie w komentarzu przy trasie i w `raport.md`
(„Odstępstwa od planu” #1, „Review fixes applied”). To port 1:1 z precedensem `markups.ts`,
nie błąd. Nie wymaga dalszej akcji.

### NICE-TO-HAVE — bez zmian, odnotowane jako follow-up w `raport.md`. Bez zastrzeżeń.

## Nowe ustalenia tej iteracji

### SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/konfiguracja/Ai.tsx:39-47`, `Shoper.tsx:54-62` — guard
  `if (!konfiguracja)` traktuje TRWAŁY brak danych (`null` z wygasłej sesji) identycznie jak
  STAN ŁADOWANIA (`undefined`), pokazując w obu przypadkach „Wczytywanie…”. Przy 401 zapytanie
  się rozstrzyga (nie jest już w locie), ale `data` zostaje `null` na stałe (`staleTime:
  Infinity`, `refetchOnWindowFocus: false`, `refetchInterval: false` — nic nigdy nie odpali
  refetchu), więc napis „Wczytywanie…” zostaje tam już NA ZAWSZE, myląco sugerując trwającą
  operację. To realny, możliwy do wywołania scenariusz: sesja wygasa po stronie backendu, gdy
  zakładka jest już otwarta (albo użytkownik ją otworzy z lokalnym tokenem, którego backend już
  nie uznaje) — `AuthGate.tsx` sprawdza obecność użytkownika TYLKO lokalnie
  (`pobierzUzytkownika()`), więc nie przechwytuje tego przypadku i nie przekierowuje na
  `/login`. Odświeżenie strony nie pomaga (ten sam lokalny token, ten sam wynik).
  - Reason: to odstępstwo od wzorca reszty zakładek na tym samym ekranie. `Dostawcy.tsx:356`
    i `Spedycja.tsx:36` używają `isLoading` z `useQuery` (a nie testu prawdziwości danych), więc
    po rozstrzygnięciu zapytania (sukces LUB `null` z 401) pokazują funkcjonalny — choć pusty —
    widok, zgodnie z zamierzonym zachowaniem opisanym wprost w komentarzu
    `lib/queryClient.ts:13-16` („użytkownik zobaczy pusty widok, a twardy błąd dopiero przy
    mutacji”). `Ai`/`Shoper` łamią tę intencję: użytkownik nie widzi ani pustego widoku, ani
    twardego błędu przy próbie zapisu — bo formularza (i przycisku „Zapisz”) po prostu nigdy
    nie zobaczy.
  - To NIE jest nawrót BLOCKER-a 1 (nie ma tu ryzyka utraty danych — formularz się nie
    montuje, więc nie ma czego nadpisać) — to osobny, nowy efekt uboczny wybranego
    rozwiązania: zamiana klasy błędu (utrata danych) na inną (permanentnie mylący spinner
    bez żadnej informacji zwrotnej, bez wyjścia poza przeładowanie karty w innej sesji).
  - Sugestia: rozróżnić trzy stany zamiast dwóch — `isLoading` (prawdziwe ładowanie, jak
    w `Dostawcy`/`Spedycja`) i `konfiguracja === null` po rozstrzygnięciu (komunikat typu
    „Sesja wygasła — zaloguj się ponownie” zamiast „Wczytywanie…”, ewentualnie link do
    `/login`). Nie jest to pilne — scenariusz brzegowy, nie ścieżka główna — ale wart poprawki
    razem z resztą tego pliku, żeby nie zostawiać w kodzie napisu, który kłamie o tym, co się
    dzieje.

## Weryfikacja bramek (powtórzona)

- Backend: `npm run lint` / `npm run typecheck` / `npm run build` — czyste. `npm test` —
  **629/629** (38 plików).
- Frontend: `npm run lint` / `npm run typecheck` / `npm run build` — czyste. `npx vitest run` —
  **302/302** (20 plików), w tym potwierdzone przejście trzech nowych testów regresyjnych
  z `describe("pierwsze wejście w zakładkę…")`.
- Zero zmian w drzewie roboczym po zakończeniu (`git status --porcelain` puste) — tymczasowa
  podmiana `Ai.tsx` użyta do weryfikacji regresji została w pełni cofnięta.

## Czego NIE zweryfikowałem

- Zachowania w prawdziwej przeglądarce (E2E) — tylko jsdom/MSW, zgodnie z tym, co przewiduje
  plan (E2E świadomie pominięte, patrz `raport.md`).
- IndexedDB w zakładce „Katalog” poza jsdom (znany, udokumentowany brak pokrycia — `raport.md`,
  „Follow-up”) — nie próbowałem tego obejść, bo `raport.md` uczciwie to nazywa i uzasadnia.
- Dokładności `contract/openapi.yaml` linia po linii względem czterech tras — poprzednia
  iteracja to zrobiła (GATE + `sprawdzZgodnoscZKontraktem`), w tej iteracji poleziałem na tamto
  ustalenie i na wynik GATE-u (zielony, bez wyjątków), nie odczytywałem specyfikacji na nowo.

## Stan po poprawkach: BLOCKER / SHOULD-FIX / NICE-TO-HAVE

**BLOCKER: 0.** Oba blokery z pierwszej iteracji są zamknięte i zweryfikowane empirycznie —
gotowe do mergu od strony blokerów.

**SHOULD-FIX: 2** (jeden zamknięty, jeden nowy, jeden zaakceptowany bez zmian — patrz wyżej):
- [ ] `Ai.tsx`/`Shoper.tsx` — mylący permanentny „Wczytywanie…” przy `null` z wygasłej sesji,
  niespójny z `Dostawcy.tsx`/`Spedycja.tsx` (nowe ustalenie tej iteracji, wyżej).
- [x] ~~audyt spedycji loguje surowe ciało~~ — zaakceptowane jako świadome odstępstwo 1:1,
  nie wymaga zmiany.

**NICE-TO-HAVE: 3** (bez zmian względem pierwszej iteracji) — wspólny helper typu dla
`odsiejPola`, `aria-label` w `Spedycja.tsx` (pozytywna nota), długość komunikatu 400
w `POST /api/config`.

## Overall assessment (druga iteracja)

Oba blokery z pierwszej iteracji są naprawione i zweryfikowane nie tylko lekturą, ale
odtworzeniem regresji na żywo (tymczasowy powrót do starego kodu → dokładnie te same dwa testy
padają z dokładnie tym samym efektem co opisany BLOCKER; przywrócenie → 302/302 zielone, zero
różnic w drzewie). Dokumentacja (roadmapa, backlog, obie specyfikacje, `CLAUDE.md`) rzetelnie
opisuje STAN, nie zamiar, a noty dotyczące przyszłych bloków (I8, I12) trafiły we właściwe
sekcje, nie do I11 — zgodnie z własnymi zasadami projektu. Jedyne nowe ustalenie tej iteracji to
SHOULD-FIX, nie BLOCKER: `Ai`/`Shoper` po naprawie wyścigu wprowadziły przy okazji inny,
znacznie łagodniejszy efekt uboczny — permanentny, mylący napis „Wczytywanie…” przy wygasłej
sesji, niespójny z resztą ekranu Konfiguracji. Nie blokuje mergu, ale wart poprawki przy
najbliższej okazji dotykania tego pliku. Bramki (lint/typecheck/build/test) czyste w obu
pakietach, zgodnie z deklaracją w `raport.md`.
