## Ticket
129-FEATURE-akceptacja-stagingu — akceptacja stagingu: blokady `checkAcceptance`, cztery trasy polityki, decyzje o nieobecnych kartach (karta **I15.4c**)

## Summary
Sportowana druga połowa `staging_policy.cjs` @ `88fa31c` — ścieżka odczytu i decyzji użytkownika: bramka akceptacji, nadpisania dodawania i edycji zgłoszenia, rozstrzyganie dopasowań, decyzje o nieobecnych kartach (#106) i cztery trasy HTTP. Wierność dowiedziona GATE-em różnicowym na **uruchomionym** oryginale (23 scenariusze porównujące komunikat, status i stan pięciu tabel). Odstępstwo 14i zdjęte decyzją D4; pomiar #107 wykonany.

## Problem / Motivation
Karta I15.4c to druga połowa podziału dawnej karty I15.4 (665 linii `staging_policy.cjs` na jeden przegląd to za dużo). Fundament — migracja 012, model i repozytoria — dowiozła I15.4a (ticket 124); importer robi równolegle I15.4b (ticket 130). Bez tej karty odbudowa nie ma ani kontroli aktualności przy akceptacji, ani tras, którymi człowiek rozstrzyga to, czego import nie zatwierdził sam.

## Solution
- **`checkAcceptance` — SIEDEM blokad 409** (`staging_policy.cjs:188-200`), komunikaty znak w znak; kolejność sprawdzeń zachowana, bo pierwszy `fail()` wygrywa.
- **Akceptacja jako WARSTWA** nad istniejącym `zatwierdzPozycjeStagingu` — dokładnie jak `original.accept` w oryginale; bazowa akceptacja nietknięta, więc jej charakteryzacja dalej pilnuje wierności.
- **Dodawanie i edycja zgłoszenia** — nowe zastępuje poprzednie tej samej pary `(dostawca, kod)`; edycja przelicza `eanRaw`/`eanIsValid`/`eanSourceStatus`/`_eanIssue`.
- **Decyzje o nieobecnych kartach (#106)** — `closeAbsenceReview` i `chooseAbsenceCard`, obie gałęzie wyboru, trójstronna zgodność DOT, `candidates_hash` z `[kod, ean, dot]`.
- **Cztery trasy** + `contract/openapi.yaml`: `review`, `resolve`, `choose-absence-card`, `close-absence-review`.
- **Grupowanie `kod_importu` przez `compatibility()`** wstrzykiwane w ścieżkę akceptacji.
- **Odstępstwo 14i usunięte**; testy 14i przepisane na dowód, że zostało zdjęte.
- **`scripts/pomiar-107.ts`** — powtarzalny pomiar zatwierdzania zbiorczego.

## Design decisions
- **D129.1 — cztery trasy, nie dwie.** Karta wymieniała `review` i `resolve`; `registerRoutes` (`:620-664`) ma też `choose-absence-card` (`:640`) i `close-absence-review` (`:649`) — czyli dokładnie te, które wystawiają #106. Bez nich logika byłaby wdrożona, ale niewywoływalna.
- **D129.2 — siedem `fail()`, nie „cztery blokady”.** Poza czwórką z karty: `_absenceReview`, próg trzech dowodów nieobecności i `_catalogVersion`. Pominięcie któregokolwiek byłoby cichym odstępstwem.
- **D129.3 — `88fa31c` = decyzja już podjęta.** D3 („Staging v2 przenosimy”) obejmuje całość zamrożonej produkcji, więc logika #103/#104/#106 wchodzi, a statusy backlogu idą w górę.
- **D129.4 — `assignKodImportu` wstrzykiwane, nie podmieniane globalnie.** W produkcji to globalny monkey-patch; u nas parametr z domyślną starą wersją. Powód: `bridge-ext.ts` dzieli z nami równoległa karta I15.4b, a harness charakteryzacyjny bazowej akceptacji tnie oryginał **bez** `install()` i musi dalej widzieć stare grupowanie.
- **D129.5 — dowód wierności inny niż fixtures.** Dla tych tras `contract/fixtures/` nie ma nic. `staging_policy.cjs` nie jest zminifikowany i dostaje `db` argumentem, więc da się go `require()` i uruchomić — GATE porównuje z nim port zamiast z nagraniem.
- **D129.6 — pomiar #107 na kopii `db/snapshot.db` (13.08)**, bo staging to serwer zdalny i lokalnie nie ma kopii z 23.09.
- **D129.7 — odstępstwo 14i usuwane, nie zostawiane jako martwy kod.**
- **D129.8 — wpinamy mimo zależności od I15.4b** (patrz Breaking changes).

## Tests
- **Gate odbudowy:** ✓ — dla czterech tras **fixtures nie istnieją**, więc gate zbudowany inaczej i mocniej: `test/polityka.charakteryzacja.test.ts` ładuje PRAWDZIWY `staging_policy.cjs` @ `88fa31c`, wykonuje `install()` na `U` wyciętym z produkcyjnego bundla i porównuje z portem komunikat + status + stan pięciu tabel w **23 scenariuszach**. Dwa istniejące fixtures stagingu przechodzą bez zmian.
- **Testy HTTP tras:** ✓ 14/14 — kody 200/401/404/409, kształt `{message}`, wpisy audytu.
- **Pełny przebieg:** ✓ **1800 testów w 109 plikach** (przed ticketem 1761 w 107).
- **Bramki:** `lint` ✓, `typecheck` ✓, `build` ✓, `test` ✓ (Node 20.20.2, `SNAPSHOT_DB`).
- ⚠ Przy `load average ≈ 22` (równoległe karty) potrafią wypaść na timeoucie `alerty-katalogu.gate`, `silnik.charakteryzacja` (MO1/MO2/MO5) i `scheduler` — osobno wszystkie przechodzą, żaden nie dotyka kodu tej karty.

### Pomiar #107

| wariant | średnia/pozycja | p95 | najwolniejsza | 200 pozycji |
|---|---|---|---|---|
| bazowy (grupowanie po EAN) | 6,7 ms | 10,8 ms | 20,0 ms | 1,3 s |
| Staging v2 (`compatibility()`) | 386,0 ms | 588,8 ms | 863,7 ms | 77,2 s |

**(a) Problemu z #107 u nas NIE MA** — pięć sekund brało się z osobnego połączenia w `uwaga_cena_patch.cjs`; mamy jedno połączenie i kolumnę modelu, najwolniejsza pozycja 0,86 s wobec progu 5 s. Łatki nie portujemy.
**(b) Pomiar odsłonił INNY koszt** — Staging v2 jest 58× wolniejszy, bo nadpisane `assignKodImportu` woła `listProducts()` dla każdej pozycji i przepuszcza katalog przez `compatibility()` (zmierzone: 251,7 + 116,4 ms = 95 % z 386 ms). **To kod produkcji i świadomie go nie optymalizuję** — zapisany jako `#129.1` w backlogu.

## Breaking changes
**Jedna, świadoma i uzgodniona (D129.8).** `POST /api/staging/accept` odrzuca teraz pozycje bez `_policyVersion` (409). To pole ustawia **wyłącznie `importer()`** (`:428`, `:571`, `:588`, `:606`) — czyli kod karty **I15.4b (ticket 130)**. Do czasu jej merge'a akceptacja odrzuca wszystko, co produkuje obecny importer.
➡ **Obie karty powinny wejść do `develop` tą samą falą.**

Drugorzędnie: `POST /api/staging/accept` może zwrócić 409 z `{message}` (wcześniej tylko 200). Trasy polityki używają klucza `message`, nie `error` — wierne odtworzenie dwóch osobnych modułów produkcji, świadomie nieujednolicane.

## Follow-up
1. **Kolejność merge'a z I15.4b** — jak wyżej.
2. **Globalny error middleware** (`:48977-48982`) — odbudowa go nie ma; odtworzony lokalnie w trasie `accept`, dołożenie globalnie to osobny ticket.
3. **`U.updateProduct` override (`:113-119`) bez gospodarza** — ręczne odwstrzymanie nie zdejmuje znacznika auto-wstrzymania; dotyczy `PUT /api/products/:id`, czyli plików spoza kart I15.4a/b/c.
4. **`bulk.ts` zostaje na starym grupowaniu `kod_importu`** — wymaga tego samego zabiegu z wstrzykiwaniem plus decyzji, czy przenagrać wzorzec charakteryzacji.
5. **Wydajność zatwierdzania zbiorczego** — `#129.1`; ewentualna optymalizacja wymaga decyzji o świadomym odstępstwie.
6. **`silnik.gate.test.ts`** — przepisanie należy do portu silnika (I15.4b).
7. **`PustyImportBlad` vs `feed_safety`** — rozstrzygnięcie siedzi w `parsuj.ts` (I15.4b).

## Review
<details>
<summary>Code review</summary>

# 129-FEATURE-akceptacja-stagingu — Code review

> Reviewed: 2026-09-23
> Branch: `feature/129-akceptacja-stagingu`
> Diff: 20 plików, 4 commity (`git diff origin/develop...HEAD`)

## Stan po poprawkach (uzupełnione przez autora ticketa, 2026-09-23)

| Uwaga | Stan |
|---|---|
| **BLOCKER** — `rozstrzygnijZgloszenie` gubiło czyszczenie pary kodu DOCELOWEGO | ✅ **naprawione**. `zgloszenia.ts:166` woła teraz `dodajZgloszenie` (port nadpisanego `U.addStaging`) zamiast `dodajPozycjeBazowo`. Dołożony scenariusz regresyjny do GATE-u; **sprawdzone, że naprawdę łapie** — z poprzednią wersją pada na `UNIQUE constraint failed: staging_items.dostawca, staging_items.kod`. GATE: 23 scenariusze. |
| **BLOCKER** — `karta.md` i backlog nieaktualne | ✅ **uzupełnione**. `docs/karty/I15.4c/karta.md` ma `Stan: ✅`, sekcje „Dowiezione" i „Do koordynatora" (8 punktów); statusy `#99`/`#103`/`#104`/`#106`/`#107` podniesione w miejscu w `docs/rebuild-backlog.md`; nowy wpis `#129.1` w `docs/rebuild-backlog/wpis-129.md`; wejścia dla kart I15.4b, I15.10 i I15.11; `docs/spec-backend/wpis-129.md`. Review powstało **przed** fazą dokumentacji ticketa — stąd uwaga była trafna w chwili przeglądu. |
| **SHOULD-FIX** — `test/silnik.gate.test.ts` nieprzepisany | ⚪ **świadomie zostawione karcie I15.4b**, teraz opisane wprost w `raport.md` („Odstępstwa od planu") i w „Do koordynatora" karty. Test sprawdza wyjście SILNIKA (`tk.ts`), którego ta karta nie dotyka — asercje są nadal prawdziwe i test przechodzi. Nieaktualny jest tylko jego komentarz, a przepisanie należy do portu silnika. |

Pozostałe uwagi rozliczone niżej w treści przeglądu.

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

</details>

---
Ticket docs: `docs/tickets/129-FEATURE-akceptacja-stagingu/`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
