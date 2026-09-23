# 129-FEATURE-akceptacja-stagingu — Code review

> Reviewed: 2026-09-23
> Branch: `feature/129-akceptacja-stagingu`
> Diff: 20 plików, 4 commity (`git diff origin/develop...HEAD`)

## BLOCKER

- [ ] `rebuild/backend/src/import/polityka/zgloszenia.ts:159-171` (`rozstrzygnijZgloszenie`) —
  brakuje czyszczenia pary `(dostawca, kod DOCELOWY)` przed wstawieniem nowego zgłoszenia; gdy
  `code !== row.kod` (czyli praktycznie każde `action:"link"` i część `action:"new"` po kolizji
  kodu), a dla pary `(dostawca, code)` już istnieje inne, otwarte zgłoszenie stagingu — insert
  wybucha `UNIQUE constraint failed: staging_items.dostawca, staging_items.kod` zamiast wejść tak,
  jak robi to produkcja.
  - Reason: Oryginał (`staging_policy.cjs:244-245`) robi `clear.run(row.dostawca,row.kod)`,
    a POTEM woła `U.addStaging({...,kod:code,...})`, które WEWNĄTRZ SIEBIE (`:163-167`)
    jeszcze raz czyści parę `(row.dostawca, code)` — czyli oryginał czyści DWIE pary: starą i
    docelową. Port robi tylko `usunZgloszeniaPary(db, row.dostawca, row.kod)`
    (`zgloszenia.ts:160`) i wstawia bezpośrednio przez `dodajPozycjeBazowo` (`:161`), z
    pominięciem drugiego czyszczenia. Zweryfikowane empirycznie różnicowym testem na tym samym
    harnessie co GATE (`obieStrony`/`zaladujPolityke`): dla scenariusza „`link` na `P9`, a w
    stagingu już wisi osobne zgłoszenie dla `(MO5, P9)`" — oryginał kończy się `blad: null` i
    JEDNYM wierszem `staging_items` (id=3, zastępuje oba stare), port rzuca `UNIQUE constraint
    failed: staging_items.dostawca, staging_items.kod` i zostawia DWA wiersze. Trasa
    `POST /api/staging/:id/resolve` (`staging-polityka.ts:163-179`) łapie to ogólnym
    `catch`/`odpowiedzBledem`, więc użytkownik dostaje **500** z treścią SQL-a
    (`UNIQUE constraint failed: staging_items.dostawca, staging_items.kod`) zamiast działania,
    które w produkcji się po prostu udaje. Scenariusz jest realny — dokładnie taki układ
    (dwa niezależne zgłoszenia w stagingu, z których jedno trzeba połączyć z drugim przez
    `resolveStaging`) jest tym, do czego trasa `resolve` służy.
  - Suggestion: w `rozstrzygnijZgloszenie` czyścić OBIE pary przed insertem — albo dodatkowe
    `usunZgloszeniaPary(db, row.dostawca, code)`, albo (czyściej) użyć już istniejącej
    `dodajZgloszenie()` (`zgloszenia.ts:56-61`, port `U.addStaging`, dziś nigdzie nie wołanej w
    tym tickecie) zamiast gołego `dodajPozycjeBazowo`. Dopisać też scenariusz kolizji do
    `test/polityka.charakteryzacja.test.ts` w sekcji „GATE — `resolveStaging`" — dziś żaden z
    pięciu scenariuszy `resolve` nie zasiewa konkurencyjnego zgłoszenia dla kodu docelowego,
    więc GATE tego nie złapał.

- [ ] `docs/karty/I15.4c/karta.md` i `docs/rebuild-backlog.md` (wpisy `#99`, `#103`
  „Braki w cenniku…", `#104`, `#106`) — nie zaktualizowane mimo jawnej decyzji D129.3
  („statusy wpisów podnoszę na ✅ z datą i numerem ticketa 129") i mimo pozycji w DoD planu
  („`karta.md` opisuje STAN..., statusy backlogu zaktualizowane").
  - Reason: `karta.md` ma dalej `> Stan: ⬜ po I15.4a`, `## Dowiezione` = `—`, `## Do
    koordynatora` = `—` — czyli dokładnie stan sprzed ticketa, nie stan faktycznie dowieziony
    (naruszenie CLAUDE.md, sekcja „Roadmapa…", pkt 1, i pkt 0 co do miejsca zapisu). W
    backlogu `#99` (`docs/rebuild-backlog.md:4484`) dalej wymienia „I15.4c (akceptacja i trasy)"
    jako „Otwarte"; `#106` (`:4744`) dalej ma „logika wciąż otwarta — karty I15.4c/I15.11";
    `#104` (`:4602` okolice) dalej ma „auto-wstrzymania... I15.4b/I15.10, zostaje otwarta" mimo
    że `wstrzymajAutomatycznie`/`chooseAbsenceCard` z tej samej logiki są w tym tickecie
    dowiezione. To dokładnie ryzyko, przed którym ostrzega CLAUDE.md (roadmapa/backlog jako
    wejście dla następnej sesji) — koordynator planujący dalsze fale (I15.5, I15.11) przeczyta
    stan sprzed ticketa 129 i może zdublować robotę albo źle rozdzielić zakres.
  - Suggestion: uzupełnić `karta.md` (Stan/Dowiezione/Do koordynatora) i podnieść statusy
    `#99`/`#103`(druga pozycja)/`#104`/`#106` w `docs/rebuild-backlog.md` zgodnie z faktycznie
    dowiezionym zakresem tego ticketa, zostawiając w nich jasno wypisane, co nadal czeka na
    I15.4b/I15.5/I15.10/I15.11.

## SHOULD-FIX

- [ ] `rebuild/backend/test/silnik.gate.test.ts:222-246` — plan (D129.7) i DoD zapowiadały
  „test `silnik.gate.test.ts` opisujący okno przejściowe przepisuję na oczekiwaną blokadę", a
  `raport.md` w sekcji „Wyniki testów" twierdzi wprost, że 14i zostało zdjęte i `silnik.gate.test.ts`
  z tym „przepisany". Plik jest w diffie z zerem zmian — test dalej opisuje „STAN PRZEJŚCIOWY D4"
  i kończy się komentarzem „przy porcie silnika w I15.4 trzeba go przepisać na oczekiwaną
  blokadę". To rzeczywiście zależy od importera (I15.4b, poza zakresem tego ticketa — `_eanLossy`
  ustawia dopiero `importer()`), więc samo NIEZROBIENIE jest zrozumiałe, ale `raport.md` w
  sekcji „Odstępstwa od planu" wymienia tylko D129.8, nie wspominając, że obietnica z D129.7 o
  przepisaniu tego konkretnego testu nie została zrealizowana. Rozjazd między tym, co plan i DoD
  obiecują, a tym, co raport referuje jako zrobione, wprowadza w błąd czytelnika raportu.
  - Suggestion: dopisać do „Odstępstwa od planu" w raporcie, że `silnik.gate.test.ts` zostaje
    nieprzepisany do czasu merge'a I15.4b (analogicznie do D129.8), i odznaczyć odpowiedni punkt
    DoD jako niezrealizowany zamiast milczeć.

- [ ] `rebuild/backend/src/import/polityka/zgloszenia.ts:30-44` (`dodajPozycjeBazowo`) — funkcja
  jest wierną, jednowierszową kopią `U.addStaging`/bazowego `addStaging` z bundla
  (`deminified/backend-index.cjs:44923-44927`), ale poza `dodajZgloszenie` (`:56-61`) nikt jej
  dziś nie woła poza `rozstrzygnijZgloszenie`. Sama funkcja jest OK (wierna produkcji, dedup bez
  `dostawca` w zapytaniu to też wierne odtworzenie), ale brak jej użycia przez
  `rozstrzygnijZgloszenie` przez `dodajZgloszenie()` jest właśnie źródłem BLOCKERA wyżej — zgłaszam
  tu jako wskazówkę do naprawy, nie osobny problem.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/routes/staging-mutacje.ts:181-190` — podwójny fallback
  `(e as {status?:number}).status ?? (e as {statusCode?:number}).statusCode ?? 500` czyta
  `status` z tego samego obiektu przez dwa różne rzutowania; działa, ale czytelniej byłoby jedno
  rzutowanie `{status?: number; statusCode?: number}`. Nie wpływa na zachowanie.

## Plan compliance

### Done ✓
- Siedem `fail()` z `checkAcceptance` (`blokady.ts`), komunikaty i kolejność sprawdzone GATE-em
  charakteryzacyjnym na uruchomionym `staging_policy.cjs` (22 scenariusze, w tym „kolejność
  blokad — pierwsza wygrywa").
- `acceptStaging` jako warstwa NAD `zatwierdzPozycjeStagingu` — `original.accept`
  (`zatwierdzPozycjeStagingu`) faktycznie niezmienione, blokady żyją wyłącznie w warstwie
  (`akceptacja.ts` w `polityka/`).
- `addStaging`/`updateStaging` (`zgloszenia.ts`) — kasowanie starej pary, synchronizacja
  bieżnika z modelem, przeliczenie statusu EAN przy edycji; wpięte w `PUT /api/staging/{id}`.
- #106: `candidates_hash` z `[kod,ean,dot]` i `.sort()` bez komparatora odtworzone dosłownie
  (`nieobecne.ts:41-44`); trzy różne zapisy na `selected_source_code` zweryfikowane —
  `zamknijPrzegladNieobecnej` go nie rusza, `wybierzKarteNieobecnej` go ustawia albo zeruje w
  zależności od gałęzi, zgodnie z `repos/staging-polityka.ts` (I15.4a, niezmieniony).
  `aktualizujProdukt` w `nieobecne.ts` odpowiada `originalUpdate` oryginału (znacznik
  auto-wstrzymania kasowany osobnym wywołaniem, tak jak w `:313`/`:314`).
  Trójstronna zgodność DOT w `options` odtworzona identycznie w `nieobecne.ts` i w
  `GET .../review` (`staging-polityka.ts`).
- Grupowanie `kod_importu` przez `compatibility()` wstrzyknięte do OBU ścieżek akceptacji
  (`akceptacja.ts:174` przez domyślny parametr, `zatwierdzPozycjeZPolityka` przez
  `nadajKodImportu`), `bridge-ext.ts`/`bulk.ts` nietknięte, zgodnie z D129.4.
- Odstępstwo 14i usunięte z `import/akceptacja.ts` (nie zakomentowane — skasowane), potwierdzone
  jako nieosiągalne: jedyne produkcyjne wywołanie `zatwierdzPozycjeStagingu` idzie przez
  `zatwierdzPozycjeZPolityka`, która blokuje błędny EAN wcześniej (`sprawdzAkceptacje`).
- Cztery trasy (`staging-polityka.ts`) + `contract/openapi.yaml`, kształt `{message}` (nie
  `{error}`) odtworzony świadomie i opisany w kontrakcie.
- Harness charakteryzacyjny (`oryginal.mjs`) instaluje politykę na KOPII `bridgeExt`
  (`{ ...bridgeExt }`), nie na współdzielonym module — zweryfikowane czytaniem kodu.
- Pomiar #107 wykonany i opisany (raport + zapowiedź wpisu do `karta.md`, choć `karta.md` samo
  tego nie ma — patrz BLOCKER wyżej).
- Bramki: `lint` ✓, `typecheck` ✓, `build` ✓, `test` ✓ — **1799/1799** testów, 109 plików,
  potwierdzone niezależnym uruchomieniem podczas review (`SNAPSHOT_DB` ustawione, Node 20.20.2).

### Missing or deviating ✗
- `zgloszenia.ts::rozstrzygnijZgloszenie` gubi drugie czyszczenie pary `(dostawca, kod
  docelowy)`, które w oryginale robi wewnętrzne `U.addStaging` — patrz BLOCKER.
- `silnik.gate.test.ts` nie przepisany na oczekiwaną blokadę, mimo że D129.7 i DoD to
  zapowiadają; odstępstwo nieujawnione w `raport.md` — patrz SHOULD-FIX.
- `karta.md` i statusy backlogu (`#99`, `#103`/druga pozycja, `#104`, `#106`) nie zaktualizowane
  mimo D129.3 i DoD — patrz BLOCKER.

### Definition of done
- [x] Siedem `fail()` z `checkAcceptance` odtworzonych, komunikaty znak w znak zgodne z `:188-200`
- [x] Cztery trasy działają i są opisane w `contract/openapi.yaml`
- [x] `addStaging` zastępuje poprzednie zgłoszenie pary; `updateStaging` przelicza status EAN
- [~] #106: `candidates_hash`, obie gałęzie wyboru karty i `selected_source_code` poprawne —
      ALE ścieżka `resolveStaging`, która współdzieli mechanikę „zastąp zgłoszenie", ma lukę w
      czyszczeniu (BLOCKER wyżej); samo #106 (`chooseAbsenceCard`/`closeAbsenceReview`) jest OK.
- [x] Grupowanie `kod_importu` przez `compatibility()` na obu ścieżkach akceptacji
- [x] Odstępstwo 14i usunięte
- [ ] `silnik.gate.test.ts` przepisany na blokadę — NIE zrobione, niezgłoszone w raporcie
- [x] Testy charakteryzacyjne przeciw żywemu `staging_policy.cjs` zielone (GATE) — 22/22, ale nie
      pokrywają kolizji zgłoszeń przy `resolve` (patrz BLOCKER)
- [x] Wszystkie testy zastane zielone; `lint`, `typecheck`, `build`, `test` — potwierdzone
- [x] Pomiar #107 wykonany i opisany w raporcie
- [ ] `karta.md` opisuje STAN, statusy backlogu zaktualizowane — NIE zrobione

## Parallel-test concerns

None — wszystkie nowe testy (`polityka.charakteryzacja.test.ts`, `staging-polityka.trasy.test.ts`,
`akceptacja.odstepstwa.test.ts`) używają `stworzTestowaBaze()`/`stworzSrodowiskoTestowe()` z
katalogiem tymczasowym i efemerycznymi portami, tak jak reszta pakietu. `scripts/pomiar-107.ts`
to osobny skrypt pomiarowy uruchamiany ręcznie na kopii `db/snapshot.db`, nie wchodzi w `npm test`.

## Overall assessment

Bardzo staranna robota pod kątem wierności: siedem blokad, obie gałęzie #106 i grupowanie
`kod_importu` są dowiedzione różnicowym GATE-em na URUCHOMIONYM oryginale, nie na czytaniu kodu —
dokładnie tak, jak wymaga ten projekt, i widać w kodzie systematyczne cytowanie linii
`staging_policy.cjs`. Warstwowa architektura `acceptStaging` jest rzeczywiście warstwą, a nie
zmianą w środku. Jest jednak jedna realna luka wierności poza siatką testów — `resolveStaging`
gubi drugie czyszczenie pary przy `action:"link"`/kolizji kodu, co w konkretnym, wcale nie
egzotycznym układzie danych kończy się nieobsłużonym 500 zamiast działania zgodnego z produkcją —
i wymaga naprawy przed merge'em. Druga sprawa to zaniedbana „papierologia" tego samego rodzaju,
przed którą CLAUDE.md wprost ostrzega: `karta.md` i statusy backlogu zostały bez aktualizacji mimo
jawnej decyzji D129.3, co bezpośrednio myli planowanie kolejnych fal (I15.5/I15.10/I15.11).
