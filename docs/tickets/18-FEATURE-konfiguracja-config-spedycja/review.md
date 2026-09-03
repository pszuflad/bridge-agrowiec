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
