# 59-CHORE-i14j-oracle-diff-historii — Code review

> Reviewed: 2026-09-18
> Branch: chore/59-i14j-oracle-diff-historii
> Diff: 8 plików zmienionych, 4 commity (vs `origin/develop`)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md` — brak podbloku „14j", mimo że `raport.md:326` twierdzi wprost:
      „`docs/rebuild-roadmap.md` — **tylko** podblok „14j"".
  - Reason: `git diff origin/develop...HEAD -- docs/rebuild-roadmap.md` jest **pusty** —
    plik nie został tknięty ani razu na tej gałęzi (potwierdzone też `grep -n "14j"
    docs/rebuild-roadmap.md` → brak wyników). Wiersz statusu bloku 14 (linia 191) i podblok
    „FALA 2" (linie 2155-2488) wymieniają 14e/14f/14h/14i, ale nie 14j — następna sesja czytająca
    roadmapę nie dowie się, że ta karta w ogóle istniała ani że jest zamknięta. To dokładnie
    scenariusz, przed którym ostrzega `CLAUDE.md` (obowiązek 1: „roadmapa opisuje STAN, nie
    zamiar") i punkt 5 briefu reviewera („czy raport jest uczciwy"). `raport.md` zawiera więc
    nieprawdziwe twierdzenie o zakresie zmian w plikach.
  - Suggestion: dopisać podblok „14j" do bloku 14 (`docs/rebuild-roadmap.md`, wzorem 14e/14i:
    cel, status ✅ + data + numer ticketa, krótkie podsumowanie wyniku pomiaru i wskazanie
    follow-upów z `raport.md`), zaktualizować wiersz statusu bloku 14 (linia 191) o 14j, i
    dopiero wtedy uznać kartę za `Shipped`.

## SHOULD-FIX

- [ ] `docs/tickets/59-CHORE-i14j-oracle-diff-historii/oracle-diff-historii.cjs:610-761` —
      piaskownice nie są sprzątane, jeśli skrypt padnie PRZED wejściem w blok `try` (linie
      615-632: `zainstalujZaleznosci`, `wygasScheduler`, `zbudujBazeOdbudowy`,
      `zastosujMigracjeOdbudowy`, `zasiejEksport`, `asercjeStartowe`).
  - Reason: `finally` z `fs.rmSync(katalogOryginalu, …)` / `fs.rmSync(katalogOdbudowy, …)` jest
    zagnieżdżony wyłącznie w bloku `try` zaczynającym się w linii ~649 (start serwerów +
    porównanie); błąd `npm ci` (realny — raport opisuje, że pierwszy przebieg padł tu inaczej),
    nieudana asercja startowa albo błąd migracji zostawi katalog tymczasowy w `os.tmpdir()` na
    zawsze. Nie jest to krytyczne (skrypt nie chodzi w CI i nie będzie uruchamiany w tej
    recenzji), ale kolejna sesja (14k), która odpali skrypt ponownie po nieudanym przebiegu,
    zaśmieci `/tmp` bez ostrzeżenia.
  - Suggestion: objąć `try/finally` (albo `try/catch` z ręcznym `rmSync` w `catch`) już od
    utworzenia pierwszej piaskownicy, nie dopiero od startu serwerów.
- [ ] `docs/tickets/59-CHORE-i14j-oracle-diff-historii/oracle-diff-historii.cjs:392-440`
      (`roznice()`) — komunikat „ZESTAW KLUCZY" porównuje klucze przez `join("|")`, ale w razie
      różnicy wypisuje je przez `join(",")` (linie 421-429).
  - Reason: kosmetyczna niespójność w logu diagnostycznym (nie wpływa na wynik porównania, bo
    separator porównania i separator wyświetlania to różne linie kodu, więc `,` w nazwie klucza
    teoretycznie mógłby zafałszować tylko WYŚWIETLANY komunikat, nie samą detekcję różnicy).
    Niska stawka, bo skrypt nie jest uruchamiany w bramkach.
  - Suggestion: użyć tego samego separatora w obu miejscach.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/historia.wyrocznia.json` (`dziennikPierwszeWiersze`) — pierwsze 20
      wierszy zawiera dwie pary wpisów o identycznym `data` (np. `id 46915/46916` i
      `id 46913/46914`), a `listaDziennikaZmian()` (`rebuild/backend/src/repos/dziennik-zmian.ts:35`)
      sortuje wyłącznie `orderBy(desc(history.data))`, bez tiebreakera. Kolejność wewnątrz
      remisu zależy więc od planu zapytania SQLite, nie od jawnego kontraktu.
  - Reason: test `GET /api/history — te same wiersze...` (`historia.wyrocznia.test.ts:132`) używa
    `toEqual` na całej tablicy, czyli jest wrażliwy na tę niejawną kolejność. Dziś przechodzi
    (potwierdzone uruchomieniem `npm test`, 1261/1261 zielone) i zachowanie jest wierną kopią
    tej samej niejednoznaczności w oryginale (nie jest to błąd tej karty) — ale przy przyszłej
    zmianie wersji SQLite/silnika sortowania test mógłby zacząć migotać bez żadnej regresji w
    kodzie. Niska stawka, bo produkcja ma dokładnie tę samą niejednoznaczność.
  - Suggestion: nic pilnego; ewentualnie dopisać komentarz w teście ostrzegający, że kolejność
    remisów jest zależna od implementacji SQLite, żeby przyszły debugging nie szukał winy w
    kodzie.

## Plan compliance

### Done ✓
- Krok 1 (piaskownica obu stron, asercje startowe, `0 dostawców z URL polling`) — zaimplementowane
  i zmierzone, potwierdzone w `wynik-oracle-diff.json`.
- Krok 2 (oracle diff siatki 59 przypadków na danych produkcyjnych) — zaimplementowane, wynik
  „0 rozjazdów / 49 813 wpisów" potwierdzony w `wynik-oracle-diff.json` (`podsumowanie`).
- Krok 3 (przebieg D3 z zasianą gałęzią eksportu, oznaczony osobno) — zaimplementowane,
  `wynik-oracle-diff-zasiew.json` istnieje i raport rozdziela oba przebiegi.
- Krok 4 (zadanie B: dobór produktu D2, edycja B1, sonda allowlisty B2/D4, eksport B3) —
  zaimplementowane i zweryfikowane liczbami w JSON-ie zgodnymi z raportem.
- Krok 5 (trwały test `historia.wyrocznia.test.ts` + `historia.wyrocznia.json`) — istnieje,
  12 przypadków, `toEqual` (nie `toMatchObject`), dane pochodzą z żywego oryginału (potwierdzone
  czytaniem skryptu — `zapiszWyrocznie()` woła wyłącznie `portOryginalu`), test przechodzi.
- Krok 6 (backlog #87, `Do nowej wersji?` = ⬜) — zrobione, treść zgodna z formatem istniejących
  wpisów.
- Zero zmian w `rebuild/backend/src/` — potwierdzone (`git diff` pusty).
- Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (82 pliki / 1261
  testów) — uruchomione samodzielnie w tej recenzji, wszystkie zielone.

### Missing or deviating ✗
- Krok 7 — „Podblok »14j« w `docs/rebuild-roadmap.md`" **nie został wykonany**, mimo że
  `raport.md` twierdzi, że został (patrz BLOCKER wyżej).

### Definition of done
- [x] Oryginał i odbudowa na kopiach tego samego `db/snapshot.db`, log potwierdza `0 dostawców`
- [x] Asercje startowe `history`/`audit_log` identyczne
- [x] Trzy trasy porównane na komplecie pól/kolejności, z filtrami i paginacją
- [x] Zestaw KLUCZY porównany osobno (D5)
- [x] Każde „0 różnic" stoi razem z liczbą porównanych wpisów
- [x] Przebieg z zasianą gałęzią eksportu, oznaczony jako dane zasiane
- [x] Zadanie B: ślad po edycji zmierzony
- [x] Zadanie B: sonda allowlisty dała liczbę
- [x] Zadanie B: rozstrzygnięte pomiarem, czy odbudowa zapisuje eksport
- [x] Nowy trwały test przechodzi w bramkach
- [x] Wpis #87 w backlogu, `Do nowej wersji?` = ⬜
- [x] Raport zawiera 2-3 wpisy do kontroli wzrokowej
- [x] `npm run lint/typecheck/build/test` zielone
- [x] Zero zmian w `rebuild/backend/src/`
- [ ] (poza formalną listą DoD, ale z Implementation planu Kroku 7) Podblok „14j" w roadmapie —
      **NIE zrobione**, mimo deklaracji w `raport.md`

## Parallel-test concerns

None — nowy `historia.wyrocznia.test.ts` używa `stworzSrodowiskoTestowe()` (baza w
`mkdtempSync(tmpdir())`, supertest bez `listen()`, brak stałego portu), więc jest w pełni
izolowany i równoległy z innymi agentami. Skrypt pomiarowy `oracle-diff-historii.cjs` używa
portów efemerycznych (`net.createServer().listen(0, …)`) i katalogów tymczasowych — również
bezpieczny do równoległego uruchomienia, choć nie chodzi w bramkach.

## Overall assessment

Merytorycznie pomiar jest solidny i uczciwy: `roznice()` porównuje głęboko (w tym kolejność
tablic i zestawy kluczy), limit 25 zebranych różnic nie maskuje „zera różnic" (o zgodności
decyduje `roznicaCiala.length === 0`, nie liczba zebranych wpisów), wyrocznia w
`historia.wyrocznia.test.ts` faktycznie porównuje się z zamrożoną odpowiedzią żywego oryginału
(`toEqual`, nie `toMatchObject`), a nie z samą odbudową, redukcja zasiewu do 270 wierszy
`audit_log` jest poprawnie uzasadniona kodem `LIMIT_AUDYTU`/`typWpisu()` i zweryfikowana
asercją w samym teście. Znalezisko o `archiver@5.3.2` / HTTP 500 jest poparte realnym logiem
procesu, nie domysłem. Jedyny poważny problem to rozjazd między tym, co `raport.md` deklaruje
(„tylko podblok »14j«" w roadmapie) a stanem faktycznym (roadmapa nietknięta) — to dokładnie
rodzaj nieuczciwości artefaktu, przed którym ostrzega `CLAUDE.md`, i musi zostać poprawione
przed scaleniem.
