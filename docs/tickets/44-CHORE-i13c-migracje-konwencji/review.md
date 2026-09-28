# 44-CHORE-i13c-migracje-konwencji — Code review

> Reviewed: 2026-09-09
> Branch: chore/44-i13c-migracje-konwencji
> Diff: 12 plików (1062 insercji / 24 usunięcia), 3 commity

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:185,1970-1985` — blok 13c NIE jest oznaczony jako zrobiony.
  - Reason: Plan (`plan.md` DoD) wprost wymaga „roadmapa: blok 13c oznaczony zrobionym (data +
    ID), ustalenia dla 13e wpisane DO 13e". W diffie brak jakiejkolwiek zmiany w
    `docs/rebuild-roadmap.md` — linia zbiorcza I13 nadal nie wspomina ticketu 44, a opis bloku
    13c wciąż brzmi jak otwarte pytanie („weryfikacja czy katunify wymaga migracji…"), nie jak
    rozliczenie ze zmierzonym wynikiem. Dodatkowo blok 13c zawiera ostrzeżenie „Drugie
    przesunięcie wzorca do przewidzenia", które raport.md obala pomiarem (diff = 0) — ta
    korekta nigdzie nie trafiła do roadmapy, mimo że CLAUDE.md (zasada #1/#2) explicite każe
    wpisywać stan, nie zamiar, i przenosić ustalenia dla przyszłych bloków do NICH, a nie
    zostawiać w dokumentach ticketa.
  - Suggestion: Dopisać do linii zbiorczej I13 „13c: ✅ `44-CHORE-i13c-migracje-konwencji` ·
    2026-09-09"; przepisać opis bloku 13c na czas przeszły z realnymi liczbami (537/7392/2647,
    723 skasowanych wierszy staging); skorygować/usunąć ostrzeżenie o drugim przesunięciu
    wzorca; przenieść do bloku 13e fakt o pass-through konstrukcji w FE (już opisany w
    `raport.md` „Breaking changes", ale nie w roadmapie).
- [ ] `docs/rebuild-backlog.md:2589-2624` (#57/#58/#59) — statusy backlogu nie są zaktualizowane.
  - Reason: DoD planu wprost: „backlog: #57 / #58 / #59 → „zrobione w 13c"; #59 domknięte razem
    z częścią silnikową 13b". W diffie `docs/rebuild-backlog.md` nie występuje. Pola „Status" #57
    i #58 kończą się na „Migracja danych historycznych pozostaje 13c" (czas przyszły), a #59 na
    „Część migracyjna: ⬜ do portu (13c)" — po zmergowaniu tego ticketa to nieprawda, ale nic
    tego nie koryguje.
  - Suggestion: Zaktualizować pole „Status" wszystkich trzech wpisów na „✅ zrobione w 13c
    (44-CHORE-i13c-migracje-konwencji, 2026-09-09)" z realnymi liczbami z pomiaru.

## SHOULD-FIX

- [ ] `rebuild/schema/006_nazwa_caps.sql:56-59` — nagłówek migracji twierdzi „obie reguły dają
  739 wierszy, rozjazd 0", ale rzeczywisty predykat SQL (z realnym SQLite `UPPER()`) usuwa na
  `db/snapshot.db` tylko **723** wiersze, nie 739. Zweryfikowałem to niezależnie: JS z
  `.toUpperCase()` (Unicode) daje 739, a odtworzenie identycznego zapytania CTE w SQLite daje
  723 — różnica to dokładnie 16 wierszy, w których case-only różnica dotyczy polskiego znaku
  (`ą`→`Ą`, `ę`→`Ę`, np. id 710497 „prowadząca"→„PROWADZĄCA"). `UPPER()` SQLite jest
  ASCII-only (co migracja poprawnie dokumentuje dla `UPPER(nazwa)`, ale NIE dla użycia `UPPER`
  wewnątrz predykatu CASE_ONLY), więc `UPPER('prowadząca')` ≠ `UPPER('PROWADZĄCA')` bajt-w-bajt
  (małe „ą" zostaje małe, duże „Ą" zostaje duże) i wiersz nie zostaje uznany za case-only, mimo
  że semantycznie jest. Efekt: 16 realnie „case-only" wierszy `staging_items` NA ZAWSZE
  zostaje w tabeli (nie usuwa ich też ponowne uruchomienie — są poza zasięgiem predykatu).
  Nie jest to utrata danych (kierunek bezpieczny — wiersz zostaje, nie znika), ale:
  1) `raport.md:49` powiela błędną liczbę „739" w sekcji „Odstępstwa od planu", mimo że
     `raport.md:142` (Breaking changes) poprawnie podaje 723 — dokument sam sobie przeczy;
  2) przyczyna (diakrytyki + ASCII-only `UPPER` w PREDYKACIE, nie tylko w `UPDATE`) nigdzie nie
     jest wyjaśniona, więc ktoś może „naprawić" liczbę na 739 licząc narzędziem Unicode-aware
     i wprowadzić realną regresję (nadmiarowe kasowanie po zmianie na porównanie Unicode
     musiałoby być ostrożnie sprawdzone, bo mogłoby też zacząć kasować wiersze, których
     produkcja by nie skasowała — produkcja użyła tego samego ASCII-only `UPPER` w SQLite).
  - Suggestion: Zmierzyć i zapisać: SQL z realnym `UPPER()` SQLite daje 723 (nie 739), z 16
    „ocalałymi" wierszami case-only wskutek polskich diakrytyków — to jest wierne 1:1
    zachowaniu produkcji (jej `DELETE` też szedł przez SQLite `UPPER()`), więc NIE jest to błąd
    do naprawy w SQL-u, tylko luka w dokumentacji: poprawić `739`→`723` w nagłówku `006_*.sql`
    i w `raport.md:49`, dopisać jednym zdaniem przyczynę (diakrytyki), i rozważyć dodanie
    przypadku testowego z polskim znakiem do `test/db.migracje.test.ts` (obecne 6 testów tego
    nie łapie).

## NICE-TO-HAVE

- [ ] `rebuild/schema/006_nazwa_caps.sql:79-99` — predykat CASE_ONLY zakłada, że pierwsze
  wystąpienie `' → '` i `': '` w segmencie należy do separatora `etykieta: stara → nowa`.
  Trzyma się to tylko dlatego, że żadna z wartości pól `POLA_ROZNIC` (`nazwa`, `marka`, `model`,
  `kodDostawcy`, `ean`, `rozmiar`…) w praktyce nie zawiera dosłownie znaku strzałki „→" ani
  sekwencji „: ". Nie ma na to guardu ani testu z takim kontrprzykładem — teoretycznie wiersz ze
  strzałką/dwukropkiem wewnątrz nazwy produktu rozjechałby offsety (choć nie widzę sposobu,
  żeby to doprowadziło do BŁĘDNEGO skasowania wiersza z realną zmianą — najwyżej do niepotrzebnego
  zachowania wiersza, czyli znów kierunek bezpieczny). Można dopisać jedno zdanie w komentarzu
  wprost przyznające to założenie, żeby przyszły czytelnik nie musiał tego wyprowadzać sam.
- [ ] `docs/tickets/44-CHORE-i13c-migracje-konwencji/raport.md:49` vs `:142` — poza samą liczbą
  (patrz SHOULD-FIX wyżej) warto ujednolicić narrację między sekcjami „Odstępstwa od planu" i
  „Breaking changes", bo dziś czytelnik musi sam zauważyć rozjazd 739/723.

## Plan compliance

### Done ✓
- `004_kategoria_wielka_litera.sql`, `005_konstrukcja_slowa.sql`, `006_nazwa_caps.sql` — SQL
  zweryfikowany zgodnością WHERE↔CASE (brak ryzyka wpisania NULL), zgodnością z mapami
  produkcji (`KATEGORIA_CANONICAL_MAP`, `KONSTRUKCJA_CANONICAL_MAP`, `apply_kategoria.cjs` —
  porównane bajt-w-bajt z plikami źródłowymi).
- Idempotencja treściowa potwierdzona SAMODZIELNYM pomiarem (nie tylko wg raportu): dwa
  przebiegi na kopii `db/snapshot.db` dają 537/7392/2647 zmian w pierwszym przebiegu i 0/0/0
  w drugim — identyczne z liczbami w `raport.md`.
- Stan po `004` (Rolnicze 4533, Ciężarowe 1463, Przemysłowe 1195, Leśne 214) zmierzony
  niezależnie — zgadza się z CHANGELOG-iem produkcji i z raportem.
- `test/db.migracje.test.ts` — 6 nowych testów (jednosegmentowy/wielosegmentowy CASE_ONLY,
  realna zmiana w drugim polu, `ostrzezenie`, powod spoza `nazwa:%`, inny `typ_zmiany`,
  idempotencja) — realnie coś dowodzą, nie są trywialne.
- `tools/record-write-fixtures.cjs` — nowy krok `migrujKonwencje()` używa `apply_kategoria.cjs`
  Ani (podmieniona wyłącznie ścieżka) + SQL przepisany z CHANGELOG-a, NIE z `rebuild/schema/`
  — nagranie zostaje niezależnym dowodem, zgodnie z D9.
- 4 fixtures przenagrane (`GET_products.json`, `GET_products_bez-parametrow.json`,
  `PUT_products_id.json`, `PATCH_products_id.json`) — diff zawiera dokładnie oczekiwane pola
  (`konstrukcja` R/D→słowa, `nazwa`→CAPS w produktach; wyłącznie `dataAktualizacji`/`kodImportu`
  w mutacjach, znany nondeterminizm).
- `node tools/generate-openapi-schemas.cjs --sprawdz` — zielone (uruchomione samodzielnie).
- Bramki `lint`/`typecheck`/`build`/`test` — zielone, 80 plików / 1240 testów (uruchomione
  samodzielnie, zgadza się z raportem).
- Liczby z D7 (follow-up `manual_overrides`) zweryfikowane samodzielnie: `konstrukcja='D'` — 3
  rek., `kategoria` małą literą — 9 „przemysłowe" + 5 „rolnicze" = 14, razem 6944 rekordów
  `field_name='kategoria'`.

### Missing or deviating ✗
- Aktualizacja `docs/rebuild-roadmap.md` (blok 13c → zrobiony, ustalenia dla 13e) — brak w
  diffie mimo że jest punktem DoD. Patrz BLOCKER.
- Aktualizacja `docs/rebuild-backlog.md` (#57/#58/#59 → „zrobione w 13c") — brak w diffie mimo
  że jest punktem DoD. Patrz BLOCKER.
- Liczba wierszy CASE_ONLY faktycznie skasowanych (723) rozjeżdża się z liczbą przywołaną jako
  dowód równoważności reguł R2≡R3 w nagłówku migracji i w `raport.md:49` (739) — nieudokumentowana
  rozbieżność. Patrz SHOULD-FIX.

### Definition of done
- [x] `004`/`005`/`006` w `rebuild/schema/`, każdy z nagłówkiem cytującym źródło produkcji
- [x] `npm run migrate` stosuje je w transakcji; drugi przebieg = zero zmian (ewidencja `_migracje`)
- [x] idempotencja TREŚCIOWA udowodniona testem i potwierdzona niezależnym pomiarem reviewera
- [x] CASE_ONLY kasuje szum i NIE kasuje wierszy z realną zmianą — cztery przypadki w teście,
      zero przypadków nadmiarowego skasowania potwierdzone niezależnym porównaniem z regułą
      R3 liczoną w JS (Unicode) na całym zbiorze 1441 wierszy
- [x] fixtures przenagrane z oryginału @08.09 na bazie doprowadzonej do stanu produkcji po 09-01
- [x] `lint` + `typecheck` + `build` + `test` zielone w `rebuild/backend/`
- [ ] roadmapa: blok 13c oznaczony zrobionym (data + ID), ustalenia dla 13e wpisane DO 13e —
      NIE spełnione, brak zmian w `docs/rebuild-roadmap.md`
- [ ] backlog: #57 / #58 / #59 → „zrobione w 13c" — NIE spełnione, brak zmian w
      `docs/rebuild-backlog.md`
- [ ] PR do `develop` — poza zakresem tego code review (do zrobienia przez Mastera)

## Parallel-test concerns

Brak — testy nowego bloku (`describe("migracje danych — konwencje 13c")`) używają
`mkdtempSync`/bazy w katalogu tymczasowym per-test (`beforeEach`/`afterEach` z własnym
`katalog`), bez portów ani zasobów współdzielonych. Cała reszta bramek (`npm test`) także
przechodzi bez zmian w tym zakresie. Wszystkie testy równoległe.

## Overall assessment

SQL migracji jest solidny: WHERE i CASE są zawsze zgodne co do zestawu kluczy (zero ryzyka
wpisania NULL-a), mapy odtwarzają dosłownie kod produkcji, a idempotencja treściowa jest
potwierdzona nie tylko testem, ale i moim niezależnym pomiarem na `db/snapshot.db` (537/7392/2647
→ 0/0/0). Rekurencyjny CTE w `006` jest poprawny arytmetycznie — zweryfikowałem, że SQLite liczy
`instr`/`substr` w ZNAKACH (nie bajtach) dla UTF-8, więc offsety wokół `' • '`/`' → '` z polskimi
diakrytykami działają poprawnie — i nie znalazłem scenariusza, w którym kasowałby wiersz z realną
zmianą (kierunek błędu jest zawsze bezpieczny: raczej zbyt mało kasuje niż za dużo). Jedyna realna
usterka, jaką znalazłem, to rozjazd między zapowiedzianą w dokumentacji liczbą 739 a faktycznym
wynikiem 723 (SQLite `UPPER()` ASCII-only w samym PREDYKACIE, nie tylko w `UPDATE`, gubi 16
wierszy z polskimi diakrytykami) — nieszkodliwy dla danych, ale dokumentacja się temu zaprzecza
sama sobie i wymaga korekty. Największym realnym problemem tego PR-a jest niedopełnienie DoD po
stronie roadmapy/backlogu, co ten projekt (wg CLAUDE.md) traktuje jako pierwszej klasy obowiązek,
a nie kosmetykę — bez tego następna sesja (13e) czyta nieaktualny opis bloku 13c.
