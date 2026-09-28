# 121-FEATURE-selly-harmonogram-sync — Code review

> Reviewed: 2026-09-23
> Branch: feature/121-selly-harmonogram-sync
> Diff: 11 plików, 2 commity (`456ebaa`, `5200a3c`)

## BLOCKER

Brak. Nie znalazłem błędów logicznych, luk bezpieczeństwa ani rozjazdów z zatwierdzonymi
odstępstwami. Porównanie linia-po-linii z `scheduler_selly.cjs`/`routes_sync.cjs@88fa31c`
(rotacja `FULL_ROTATION`, minuty Toru 1, `isFirstOfMonthDay`, `buildCache: i === 0`,
`autoCreate` defaults, dokładne komunikaty błędów 400/500) wypadło zgodnie z opisem w planie
i w nagłówkach plików. `npm run lint`, `typecheck`, `build` — czyste; `npx vitest run` —
1654 passed / 3 skipped / 4 failed przy PEŁNYM biegu, ale wszystkie 4 nieudane testy
(`test/scheduler.test.ts`, `test/silnik.charakteryzacja.test.ts`) są POZA zakresem tego
ticketa i **przechodzą w izolacji** (`npx vitest run test/scheduler.test.ts
test/silnik.charakteryzacja.test.ts` → 73/73 zielone) — to typowy szum z równoległych
worktree'ów odpalających testy na tej samej maszynie w tym samym czasie (widoczne w `ps aux`
podczas biegu), nie regresja z tego diffa. Oba nowe pliki testowe (`selly.harmonogram.test.ts`,
`selly.sync.gate.test.ts`, 26 testów) przechodzą zawsze, także w pełnym biegu.

## SHOULD-FIX

- [ ] `docs/karty/I15.8/karta.md`, `docs/rebuild-backlog.md`, `docs/tickets/121-.../raport.md`,
  `docs/karty/I15.9/wejscie-121.md`, `docs/karty/I15.10/wejscie-121.md` — te pliki istnieją
  w worktree, ale są NIEZACOMMITOWANE (`git status`: 2 zmodyfikowane, 3 nowe, poza dwoma
  commitami gałęzi). Definition of done wymaga „karta zamknięta; wejścia dla I15.9/I15.10;
  wkład cutover do koordynatora" — treściowo to jest zrobione i poprawne (sprawdzone), ale
  dopóki nie wejdzie do commita, `git diff origin/develop...HEAD` tego nie pokazuje i PR tego
  nie obejmie.
  - Reason: ryzyko, że przy mergu dokumentacja karty/backlogu zostanie pominięta, a DoD
    formalnie nierozliczone w historii gałęzi.
  - Suggestion: dodać te pliki do commita przed PR-em.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/selly.ts:139-150` (`KOLUMNY_STATUSU_SYNC`) — nowy blok jest
  wcięty TABAMI, podczas gdy reszta pliku (i sąsiedni `KOLUMNY_LOGU` wyżej) używa spacji.
  Lint/build przechodzą, więc czysto kosmetyczne, ale warto ujednolicić przy najbliższej
  okazji (`prettier --write`).

## Plan compliance

### Done ✓
- `src/config/env.ts` — flaga `SELLY_SCHEDULER` (`flagaBoolDomyslnieWylaczona`), wzorzec
  `IMPORT_SCHEDULER` 1:1, z notą o odstępstwie w umiejscowieniu przełącznika.
- `src/selly/rest/scheduler.ts` — `ACTIVE_SUPPLIERS`, `FULL_ROTATION`, `TOR2_HOUR/MINUTE`,
  `isFirstOfMonthDay`, `suppliersForFullToday`, `runDeltaAll`, `runFullBatch`,
  `stworzHarmonogramSelly` z wstrzykiwanym zegarem i interwałem — zgodne z planem punkt po
  punkcie (sprawdzone przeciwko oryginałowi).
- `src/repos/selly.ts` — `ostatnieWpisySync` (zawężenie `KOLUMNY_LOGU` do 9 kolumn,
  `snake_case`, reużycie DRY zamiast kopii), `zamknijOsieroconeWpisySync`, `POWOD_PRZERWANIA`.
- `src/routes/selly-sync.ts` — sześć tras za `requireAuth`, z trzema naprawionymi importami
  (`syncDelta`, `runFullBatch`, mapowanie `dostawcy`→`suppliers`), komunikaty błędów 400
  zgodne 1:1 z oryginałem (zweryfikowane testem).
- Montaż: `app.ts` (opcjonalne `discoverySelly`, fallback budowany lokalnie dla testów/dev,
  wspólny `klientSellyDoUzycia` zamiast duplikatu), `server.ts` (JEDNA instancja `discovery`
  na proces, harmonogram pod flagą + zawór `SELLY_TRYB=wylaczony`, `zatrzymaj()` w `zamknij()`).
- `contract/openapi.yaml` — sześć ścieżek z pełnymi schematami żądań/odpowiedzi;
  `generate-openapi-schemas.cjs --sprawdz` → aktualny; PEŁNY bieg generatora nie zmienia
  pliku (zweryfikowane ręcznie w tej sesji — zero zmian po `node tools/generate-openapi-schemas.cjs`).
- Testy: 14 testów harmonogramu (rotacja, tick, zawory, `buildCache` raz na partię) + 12 testów
  GATE tras (auth, kształt, `snake_case` w `recentLogs`, limit 20, walidacja 400, honorowanie
  listy w `sync-full-force`) — merytoryczne, nie tautologiczne; liczba wpisów logu na cykl
  Toru 1 liczona poprawnie jako `ACTIVE_SUPPLIERS.length` (10), z komentarzem tłumaczącym czemu.
- Timer harmonogramu ma `unref()` — konwencja zgodna z `import/scheduler.ts` i
  `promocje/wygaszacz.ts`, nie nowa dziura.
- `sync-delta.ts`/`sync-full.ts`/`discovery.ts`/`mapper-v2.ts` nietknięte — zgodnie z „Poza
  zakresem" w planie.

### Missing or deviating ✗
Brak — nie znalazłem odstępstw od planu implementacji ani niezatwierdzonych zmian zakresu.
Wszystkie 6 odstępstw wymienionych w prompcie/planie są w kodzie, udokumentowane w nagłówkach
i pokryte testem.

### Definition of done
- [x] `suppliersForFullToday` odtwarza rotację z kodu, MO7/MO8 tylko w pierwszym tygodniu —
  test pokrywa cały miesiąc.
- [x] Tick 60 s odpala Tor 1 o HH:55/10/25/40 i Tor 2 o 04:30, każdorazowo raz.
- [x] `buildCache` budowany raz na batch — test na atrapie liczący strony katalogu.
- [x] 6 tras odpowiada kształtem z `routes_sync.cjs`, z naprawami 2-4; `recentLogs`
  w `snake_case`.
- [x] Harmonogram za `SELLY_SCHEDULER`, domyślnie wyłączony; nie startuje przy
  `SELLY_TRYB=wylaczony`.
- [x] Osierocone `w_trakcie` zamykane przy starcie jako `blad` z powodem.
- [x] JEDNA instancja `discovery` dzielona przez oba tory i trasy — sprawdzone w `server.ts`
  (budowana raz, wstrzykiwana do `stworzApp` i do harmonogramu).
- [x] 6 ścieżek w `contract/openapi.yaml`.
- [x] `lint`, `typecheck`, `build`, `test` zielone (test: zielone w izolacji i dla
  plików tego ticketa; 4 niezwiązane niepowodzenia w pełnym biegu to szum z równoległych
  worktree'ów, zweryfikowany jako niezwiązany z tym diffem).
- [ ] Karta `docs/karty/I15.8/karta.md` zamknięta; wejścia dla I15.9/I15.10; wkład cutover do
  koordynatora — treściowo gotowe i poprawne, ale niezacommitowane (patrz SHOULD-FIX).

## Parallel-test concerns

None — wszystkie nowe testy używają `stworzTestowaBaze()` (katalog tymczasowy przez
`mkdtempSync`) i portów efemerycznych przez `supertest`/wstrzykiwany zegar; harmonogram w
testach stoi na `interwalMs` rzędu 20 ms i realnym `setInterval`, ale zawsze sprzątany w
`afterEach` (tablica `sprzataczki`), więc nie zostawia wiszących timerów między testami ani
plikami.

## Overall assessment

Port jest staranny i wierny — widać systematyczne porównanie z oryginałem (numery linii w
komentarzach, świadome odstępstwa opisane w nagłówkach i w testach, DRY przy projekcji
`KOLUMNY_LOGU`). Kontrakt i testy faktycznie coś dowodzą, nie są fasadą. Jedyne do
zrobienia przed mergem to dociągnięcie commita o pliki dokumentacyjne karty/backlogu/raportu,
które już są w worktree, ale nie wchodzą w diff branch vs `develop`.
