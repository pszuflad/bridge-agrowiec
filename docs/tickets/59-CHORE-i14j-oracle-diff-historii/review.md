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

---

# DRUGA ITERACJA — review po poprawkach (commit `85cc628`)

> Reviewed: 2026-09-18
> Branch: chore/59-i14j-oracle-diff-historii
> Diff względem pierwszej iteracji: `91d118b..HEAD` (1 commit, 7 plików)

## Weryfikacja czterech zgłoszonych poprawek

**1. BLOCKER (brak podbloku 14j w roadmapie) — NAPRAWIONE.**
`docs/rebuild-roadmap.md` ma teraz podblok `##### 14j — automatyczne porównanie Historii z
oryginałem · ✅ ZROBIONE 2026-09-18 (59-CHORE-i14j-oracle-diff-historii)` (linie ~2495-2567),
wpis w tabeli kart drugiej fali (linia 191) i w komórce statusu I14. Opisuje STAN: data,
numer ticketa, gate rozliczony („Gate rozliczony: karta nie rusza kontraktu ani kodu… przechodzi
bez zmian"), tabela faktycznie dowiezionego zakresu z liczbami zgodnymi z `raport.md`
(59/59, 0 rozjazdów, 49 813/49 846 wpisów, 270+20 wierszy wyroczni). Zweryfikowane liczby
zgadzają się 1:1 z `raport.md` i `historia.wyrocznia.json`.

**2. SHOULD-FIX (piaskownice nie sprzątane przy wywrotce przed serwerami) — NAPRAWIONE.**
`PIASKOWNICE` rejestruje oba katalogi w momencie `mkdtempSync` (linie 138-139, 205-206 w kodzie
po zmianie — `zbudujPiaskowniceOryginalu`, `zbudujBazeOdbudowy`), obie funkcje wołane PRZED
blokiem `try` z serwerami. `posprzatajPiaskownice()` wisi na `.finally()` doczepionym do
`main().catch(...)` na samym końcu pliku — uruchamia się niezależnie od tego, gdzie main() padnie.
Dokładnie adresuje zgłoszony scenariusz (błąd `npm ci`/migracji/asercji startowej przed startem
serwerów).

**3. SHOULD-FIX (niespójny separator w `roznice()`) — NAPRAWIONE.**
`kluczeA.join(",") !== kluczeB.join(",")` (było `"|"` przy porównaniu, `","` przy wyświetlaniu) —
teraz oba miejsca używają `","`. Zgodne też z `kluczeWpisu` gdzie indziej w pliku.

**4. NICE-TO-HAVE (remisy czasowe w wyroczni) — potwierdzone jako REALNY problem i naprawione
u źródła.** Nagrywarka (`zapiszWyrocznie()`) filtruje teraz `dziennik.cialo` po unikalnej `data`
zamiast brać pierwsze 20 wierszy „na ślepo", dokłada flagę `dziennikBezRemisow` do wyroczni i
osobną asercję w teście (`historia.wyrocznia.test.ts` — nowy `it` „wyrocznia jest ważna: wiersze
dziennika mają parami różne `data`"). Zweryfikowane uruchomieniem:
`historia.wyrocznia.json.dziennikBezRemisow === true`, `dziennikPierwszeWiersze.length === 20`,
`new Set(daty).size === 20` — zero remisów w nowym nagraniu. Sprawdzona też kolejność: 20 wierszy
jest ściśle malejąco po `data` (ręczna weryfikacja skryptem), więc odsianie remisów nie zaburzyło
względnej kolejności pozostałych wierszy — po prostu pominięto pary, które i tak miały
niezdefiniowaną kolejność. `zasiewAudytu` nadal ma 270 wierszy (bez zmian, zgodnie z oczekiwaniem
— filtr dotyczy wyłącznie gałęzi `history`, nie `audit_log`).

## B. Podblok 14j vs obowiązki 1–5 CLAUDE.md

- **Obowiązek 1 (STAN, nie zamiar):** spełniony — data, ID ticketa, status ✅, gate rozliczony,
  tabela z faktycznie zmierzonymi liczbami (nie planowanymi).
- **Obowiązek 3 (fakty weryfikowane, nie z nazwy):** zweryfikowałem samodzielnie dwa z pięciu
  faktów: (a) `archiver@5.3.2` w `mirror/backend/package-lock.json:67` — zgodne; `archiver@^8.0.0`
  w `rebuild/backend/package.json:24` — zgodne; (b) `routes/export-shoper.ts:108-171` faktycznie
  zapisuje `zapiszAudyt(..., akcja: "eksport_csv"/"eksport_shoper", ...)` w obu gałęziach (ZIP i
  pojedynczy dostawca) — zgodne z twierdzeniem „odbudowa ZAPISUJE audyt eksportu". Nie znalazłem
  nieprawdziwych faktów.
- **Obowiązek 2 (nota dla przyszłego bloku trafia do WŁAŚCIWEGO miejsca) — kluczowa ocena.**
  Bloku „14k" w roadmapie nie ma, a karta 14j miała zakaz ruszania czegokolwiek poza własnym
  podblokiem (decyzja użytkownika, nadrzędna wobec domyślnej reguły CLAUDE.md). Autor zostawił
  notę dla 14k WEWNĄTRZ podbloku 14j, jawnie oznaczoną nagłówkiem „⚠ DLA KARTY 14k (backlog #21)
  — PRZECZYTAJ, ZANIM ZACZNIESZ" i pierwszym zdaniem wprost przyznającym, że blok 14k jeszcze nie
  istnieje i że **pierwszym krokiem sesji 14k ma być przeniesienie tej treści do nowo założonego
  bloku**. To jest rozwiązanie akceptowalne, a nie obejście: różni się od przypadków opisanych
  w CLAUDE.md (`bridge_ext.cjs`, `PUT /api/config`), gdzie fakt WYLĄDOWAŁ w złym miejscu po cichu
  i trzeba było go tam znaleźć. Tu nota jest głośno oznaczona jako tymczasowa i wskazuje
  dokładnie, co zrobić. **Rekomendacja: zostawić jak jest, nie zakładać bloku 14k na siłę** —
  założenie pustego bloku 14k tylko po to, by przenieść trzy punkty, byłoby naruszeniem tej samej
  zasady własności plików, którą karta świadomie uszanowała, i nie doda żadnej wartości poza
  kosmetyką. Jedyne ryzyko: gdyby sesja realizująca backlog #21 nie nazwała się „14k" (np. dostała
  inny numer/nazwę), nota by ją ominęła — ale to ryzyko dotyczy każdej noty „do przyszłego bloku”
  pisanej zanim ten blok istnieje, nie jest specyficzne dla tej karty.

## C. Poprawność nowej wyroczni

Potwierdzone bezpośrednim odczytem `historia.wyrocznia.json`:
- `dziennikPierwszeWiersze.length === 20`, `dziennikBezRemisow === true`, 20 unikalnych `data`.
- `zasiewAudytu.length === 270` (bez zmian względem pierwszego nagrania).
- Kolejność 20 wierszy jest ściśle malejąca po `data` (sprawdzone programowo) — spójne z
  `ORDER BY data DESC` bez tiebreakera, teraz jednoznaczne, bo bez remisów.
- Diff pliku pokazuje, że dwa wiersze z remisem (`id 46916`, `id 46914`) zostały usunięte z
  pierwszych 20, a w ich miejsce doszły dwa starsze wiersze (`id 37820`, `id 37822`) z jeszcze
  wcześniejszej daty — spójne z logiką „pomiń duplikat `data`, idź dalej, aż będzie 20 unikalnych".
  Nie psuje to porównania z odbudową: `zasiewDziennika` (surowe wiersze wstawiane do testowej bazy)
  i `dziennikPierwszeWiersze` (oczekiwana odpowiedź) pochodzą z tego samego, spójnie przefiltrowanego
  zbioru.

## D. Nowe problemy w plikach zmienionych tą iteracją

Nie znalazłem. `oracle-diff-historii.cjs`, `historia.wyrocznia.test.ts`, `historia.wyrocznia.json`,
`raport.md`, `docs/rebuild-roadmap.md` — zmiany są spójne wewnętrznie i ze sobą nawzajem, bez
regresji względem pierwszej iteracji.

## E. Własność plików

`git diff origin/develop...HEAD --name-only` pokazuje wyłącznie: `docs/rebuild-backlog.md`,
`docs/rebuild-roadmap.md`, `docs/tickets/59-CHORE-i14j-oracle-diff-historii/**`,
`rebuild/backend/test/historia.wyrocznia.json`, `rebuild/backend/test/historia.wyrocznia.test.ts`.
`rebuild/backend/src/` i `contract/` nietknięte — zgodne z deklaracją.

## F. Bramki (uruchomione samodzielnie w tej iteracji)

- `npm run lint` ✓
- `npm run typecheck` ✓
- `npm run build` ✓
- `npm test` ✓ — **82 pliki, 1262 testy, wszystkie zielone** (dokładnie liczba deklarowana
  w `raport.md`).

## G. Uczciwość raportu po poprawkach

Sekcja „Review fixes applied" w `raport.md` opisuje wszystkie cztery poprawki zgodnie ze stanem
faktycznym w diffie (zweryfikowane wyżej punkt po punkcie) — liczby testów (12→13, 1261→1262),
liczba unikalnych dat (18→20) i status bramek są prawdziwe. Nie znalazłem żadnego twierdzenia
w `raport.md` niepokrytego diffem.

## Podsumowanie drugiej iteracji

**0 BLOCKER / 0 SHOULD-FIX / 0 NICE-TO-HAVE.** Wszystkie cztery poprzednio zgłoszone problemy
zostały naprawione trafnie i sprawdzalnie, w tym remisy czasowe — które okazały się realnym,
a nie tylko teoretycznym problemem (18/20 unikalnych dat w pierwszym nagraniu). Rozwiązanie noty
dla bloku 14k (żywa w środku 14j, jawnie oznaczona) jest wystarczające i nie wymaga zakładania
pustego bloku 14k na siłę. Bramki zielone, liczby w `raport.md` zgodne ze stanem faktycznym.
Karta gotowa do merge.
