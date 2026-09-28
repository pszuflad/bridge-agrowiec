# 154-BUG-csv-selly-flagi-tak — Code review

> Reviewed: 2026-09-24
> Branch: `fix/154-csv-selly-flagi-tak`
> Diff: 4 pliki (2 kodu/testów + plan.md + raport.md), 2 commity, wobec `origin/develop`

## BLOCKER

- [ ] `docs/karty/FIX.1/karta.md` — karta nie została zamknięta, mimo że `raport.md` i Definition of
  done w `plan.md` tego wymagają.
  - Reason: Karta wciąż ma `**Stan:** ⬜ do zrobienia — blokada cutoveru`, `## Dowiezione` = `—`
    i `## Do koordynatora` = `—`. `raport.md` (sekcja „Follow-up”, pkt 1) twierdzi wprost: „Zapisane w
    «Do koordynatora» karty `FIX.1`” — to nieprawda, sekcja jest pusta. `git diff origin/develop...HEAD`
    w ogóle nie dotyka `docs/karty/`. To narusza zasadę projektu „karta oznaczona jako zrobiona opisuje
    STAN, nie zamiar” (`CLAUDE.md`, pkt 1) i wprost pozycję Definition of done w `plan.md`
    (`docs/karty/FIX.1/karta.md: Stan: ✅, „Dowiezione”, „Do koordynatora” (mapper.ts + wiersz
    roadmapy)`). Skutek: koordynator nie zobaczy w karcie, że FIX.1 jest zamknięte ani zgłoszenia
    `mapper.ts`, dopóki ktoś ręcznie nie zajrzy do `raport.md`.
  - Suggestion: Uzupełnić `karta.md` zgodnie z szablonem — `Stan: ✅` + data + ID ticketa, sekcja
    „Dowiezione” z realnym zakresem (dziesięć kolumn, pomiar na stagingu, pusty diff), sekcja
    „Do koordynatora” z notatką o `mapper.ts` (D4) i prośbą o przestawienie wiersza roadmapy.

- [ ] `docs/rebuild-backlog/wpis-153.md` i brak `docs/rebuild-backlog/wpis-154.md` — status backlogu
  nieaktualny, nowy wpis follow-up nie istnieje.
  - Reason: `wpis-153.md:5` wciąż ma `**Status:** ⬜ do naprawy — blokada cutoveru`, mimo że ticket
    naprawia dokładnie ten problem i ma dowód wierności (pusty diff na stagingu). Definition of done
    w `plan.md` wymaga też nowego `docs/rebuild-backlog/wpis-154.md` o błędzie w `mapper.ts` (D4) —
    pliku nie ma w repo, a `raport.md` (Follow-up pkt 1) i `plan.md` (D4) obie twierdzą, że został
    założony. To ten sam typ problemu co wyżej: dokument opisujący pracę (`raport.md`) mówi co innego
    niż rzeczywisty stan repo — dokładnie to, przed czym ostrzega `CLAUDE.md` w kontekście
    nieprawdziwych komentarzy/zapisów.
  - Suggestion: Zaktualizować `Status` w `wpis-153.md` (np. `✅ naprawione ticketem 154-BUG`) i założyć
    `wpis-154.md` z opisem błędu w `mapper.ts:197-203` (numery linii, pola, status „do decyzji”),
    zgodnie z `docs/rebuild-backlog/README.md`.

## SHOULD-FIX

- [ ] `rebuild/backend/src/selly/generator-csv.ts:141` — cytat ze źródła Drizzle wskazuje na zły plik.
  - Reason: Komentarz mówi „`mapResultRow` (`drizzle-orm/sqlite-core/utils.cjs:40-75`)”. Sprawdzone w
    `node_modules/drizzle-orm@0.45.2`: `sqlite-core/utils.cjs` w ogóle nie zawiera `mapResultRow` —
    ten plik eksportuje tylko `getTableConfig`, `getViewConfig`, `extractUsedTable`. Funkcja faktycznie
    żyje w `drizzle-orm/utils.cjs:40-77` (mechanizm opisany w komentarzu jest merytorycznie
    poprawny — `is(field, SQL)` → `field.decoder` → `noopDecoder`, zweryfikowane niezależnie przez
    `.toSQL()` i przez testy — tylko ścieżka pliku jest zmyślona/błędna). To dokładnie klasa problemu,
    przed którą ostrzega `CLAUDE.md` („nieprawdziwy komentarz w kodzie realnie kosztował”) — tu kosztu
    jeszcze nie było, ale przyszły czytelnik szukający `mapResultRow` w `sqlite-core/utils.cjs` go nie
    znajdzie.
  - Suggestion: Zmienić cytat na `drizzle-orm/utils.cjs:40-77`. Ta sama poprawka przyda się w
    `plan.md` (D2), gdzie cytat ma ten sam błąd.

- [ ] `docs/tickets/154-BUG-csv-selly-flagi-tak/raport.md` (sekcja „Changes”) — wymienia
  `docs/tickets/154-BUG-csv-selly-flagi-tak/pr-body.md` jako nowy plik, którego nie ma w repo.
  - Reason: Bez `pr-body.md` `tools/push-i-pr.sh --tresc-plik docs/tickets/154-BUG-csv-selly-flagi-tak/pr-body.md`
    (wymagane przez proces projektu) nie zadziała — plik trzeba będzie dopiero utworzyć przy pushu.
    Drobne, ale ten sam wzorzec „raport twierdzi X, repo nie ma X” co dwa BLOCKERY wyżej.
  - Suggestion: Dopisać `pr-body.md` przed pushem albo poprawić `raport.md`, żeby nie wymieniał pliku,
    którego nie ma.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/selly.generator-csv.test.ts` — test „powinowactwo typów” (`typWKolumnie`)
  dokumentuje mechanizm SQLite niezależny od kodu produktu; warto rozważyć krótki komentarz, że ten
  test i tak przejdzie bez względu na treść `generator-csv.ts` (jak zresztą sam plik już zaznacza) —
  żeby nikt nie próbował go użyć jako regresji dla kodu produkcyjnego.

## Plan compliance

### Done ✓
- Krok 1: `FLAGI_SUROWE` (10 kolumn identycznych z `boolCols` oryginału,
  `origin/main:mirror/backend/generate_selly_export.cjs:76` — porównane 1:1, zgadza się), `KOLUMNY_BOOL`
  wyprowadzone z `Object.keys(FLAGI_SUROWE)`, projekcja `.select({ ...getTableColumns(products),
  ...FLAGI_SUROWE })`, pętla formatująca bez zmian, import `getTableColumns`/`sql`/`SQL` dodany.
- Kłamliwy komentarz nad `KOLUMNY_BOOL` usunięty i zastąpiony opisem z liczbami z pomiaru.
- Krok 2: test jednostkowy pokrywa wszystkie żądane przypadki (regresja 5 kolumn z pomiaru, wszystkie
  10 kolumn, tabelka reguły prawdziwości D3, dowód powinowactwa typów, kontrola nieprzeciekania) —
  36/36 zielone, potwierdzone niezależnym uruchomieniem.
- Model Drizzle, `contract/fixtures/`, `contract/openapi.yaml` nietknięte — potwierdzone diffem.
- Nagłówek CSV i `LICZBA_KOLUMN` bez zmian — potwierdzone testami.
- Bramki lokalne: `lint`, `typecheck`, `build`, `test` — wszystkie zielone, uruchomione niezależnie
  w tej sesji (112/112 plików, 1849/1849 testów, 7 pominiętych — zgadza się z `raport.md`).
- Mechanizm `sql<...>` omijający mapper boolean zweryfikowany niezależnie przez `.toSQL()` —
  wygenerowane zapytanie poprawnie referencjuje kolumny SQL nawet przy aliasowaniu
  (`extra_load`, `snow_3pmsf`), bez duplikatów w projekcji.
- D4 (`mapper.ts` niezałatany, tylko zgłoszony) — zgodnie z decyzją, poza zakresem tego review.
- Zakres plików zmienionych w diffie mieści się w „Pliki (wyłączna własność)” karty `FIX.1`
  (`generator-csv.ts`, jego test, `docs/tickets/<ID>/**`) — brak scope creep w samym diffie.

### Missing or deviating ✗
- Krok 5 planu („`raport.md`, review, docs — karta `FIX.1`, wpis `#153.1`, nowy wpis o `mapper.ts`”)
  zrealizowany tylko częściowo: `raport.md` powstał, ale aktualizacja karty i wpisów backlogu — nie
  (patrz BLOCKERY wyżej), mimo że `raport.md` twierdzi inaczej.

### Definition of done
- [x] Wszystkie dziesięć kolumn z `KOLUMNY_BOOL` czytane surowo; jedno wspólne źródło z projekcją
- [x] Reguła D3 odtworzona dosłownie (potwierdzone testami i pomiarem na stagingu)
- [x] Model Drizzle, `contract/fixtures/`, `contract/openapi.yaml` bez zmian
- [x] Kłamliwy komentarz nad `KOLUMNY_BOOL` zastąpiony (nowy komentarz ma jednak własny błąd cytatu —
      patrz SHOULD-FIX)
- [x] Test jednostkowy: regresja, wszystkie dziesięć kolumn, tabelka reguły prawdziwości
- [x] Nagłówek zgodny z nagraniem, `LICZBA_KOLUMN` = 60
- [x] `lint && typecheck && build && test` zielone (zweryfikowane niezależnie)
- [x] Pomiar na stagingu: opisany w `raport.md` jako pusty diff (nie da się zweryfikować z tego
      worktree — VPS niedostępny stąd; przyjęte na podstawie szczegółowości raportu, w tym kontroli
      pozytywnej i kontroli czułości pomiaru)
- [ ] `docs/karty/FIX.1/karta.md`: `Stan: ✅`, „Dowiezione”, „Do koordynatora” — **NIE zrobione**
- [ ] `docs/rebuild-backlog/wpis-153.md`: `Status` zaktualizowany — **NIE zrobione**
- [ ] Nowy wpis backlogu `docs/rebuild-backlog/wpis-154.md` o `mapper.ts` — **NIE zrobiony (plik nie istnieje)**
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — jeszcze nie w tym punkcie procesu (PR nie założony)

## Parallel-test concerns

None — wszystkie testy budują świeżą bazę w `mkdtempSync` katalogu tymczasowym per test
(`test/gate/baza.ts`), więc są w pełni izolowane międzysesyjnie.

## Overall assessment

Sam mechanizm naprawy jest poprawny i solidnie zweryfikowany: dziesięć kolumn zgadza się 1:1 z
oryginałem, technika `sql<...>` omijająca mapper boolean działa zgodnie z opisem (zweryfikowane
niezależnie w `node_modules/drizzle-orm` i przez `.toSQL()`), testy są konkretne i nietautologiczne
(wstrzykiwanie surowym SQL-em jest tu uzasadnione), a bramki lokalne są rzeczywiście zielone. Problem
leży poza kodem: `raport.md` opisuje zamknięcie karty `FIX.1` i założenie wpisu backlogu `#154.1` jako
fakt dokonany, a żaden z tych plików nie został w tym diffie zmieniony/utworzony — to rozjazd
dokumentacja↔rzeczywistość, którego ten projekt jest szczególnie czuły (ten sam wzorzec co
nieprawdziwe komentarze w kodzie, tylko przeniesiony na `raport.md`). Do domknięcia przed merge'em.
