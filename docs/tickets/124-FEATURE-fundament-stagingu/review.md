# 124-FEATURE-fundament-stagingu — Code review

> Reviewed: 2026-09-23
> Branch: feature/124-fundament-stagingu
> Diff: 9 plików, 3 commity (`7ac2432`, `6283149`, `ad615dd`)

## BLOCKER

- [ ] `docs/karty/I15.4a/karta.md` — karta nie została zaktualizowana po zamknięciu zakresu.
  - Reason: Definition of done w `plan.md` wymaga wprost: „Pomiar sprzątania duplikatów zapisany w
    `docs/karty/I15.4a/karta.md`” oraz „Nazwy i sygnatury repozytoriów oraz zachowanie migracji przy
    cutoverze opisane w «Do koordynatora» w `docs/karty/I15.4a/karta.md`”. `git diff origin/develop...HEAD`
    nie dotyka tego pliku — `karta.md` nadal ma `> **Stan:** ⬜ gotowe`, sekcje `## Dowiezione` i
    `## Do koordynatora` są puste (`—`). To też prosta wersja CLAUDE.md reguły 1: „Po każdej zamkniętej
    karcie jej `karta.md` opisuje STAN, nie zamiar” — tu wciąż opisuje zamiar sprzed ticketu.
  - Suggestion: dopisać do karty pomiar (3362→2639→2502, migracja 012 usuwa 137, nie 238 — raport.md już
    to ma) oraz notatkę „Do koordynatora” z nazwami/sygnaturami 16 funkcji repozytorium i faktem, że
    cutover na produkcji jest no-opem (dowód: `sqlite_master` identyczny przed/po).

- [ ] `docs/karty/I15.4c/` — brakuje pliku `wejscie-124.md`.
  - Reason: decyzja D-124.4 w `plan.md` („Zakładam `docs/karty/I15.4c/wejscie-124.md` z zadaniem i
    dowodem przypisania”) oraz osobny punkt Definition of done wprost tego wymagają — chodzi o pomiar
    z backlogu #107 („zmierzyć zatwierdzanie zbiorcze na kopii produkcji”), przypisany do I15.4c. Katalog
    `docs/karty/I15.4c/` ma dziś tylko `karta.md` i `wejscie-110.md`; `wejscie-124.md` nie istnieje.
    Karta I15.4c przy starcie nie dostanie tej informacji — to dokładnie sytuacja, przed którą ostrzega
    CLAUDE.md reguła 2 („ustalenie dla przyszłej karty zapisz DLA TEJ KARTY, nie w karcie właśnie
    zamkniętej”), tylko że tu nie zapisano jej nigdzie.
  - Suggestion: dopisać plik z treścią zadania (pomiar #107 na kopii produkcji) i odnośnikiem do decyzji
    D-124.4 w `plan.md`.

## SHOULD-FIX

- [ ] `docs/tickets/124-FEATURE-fundament-stagingu/raport.md` — plik istnieje w worktree, ale jest
  `??` w `git status` (nigdy niedodany do żadnego z 3 commitów). Diff `origin/develop...HEAD` go nie
  zawiera — gdyby gałąź poszła teraz do PR, raport zniknąłby z historii, mimo że opisuje realne wyniki
  testów i odstępstwa od planu (poprawka liczby −238 → −137). Dodać do commita przed PR.
- [ ] `rebuild/backend/src/repos/staging-polityka.ts:159` — komentarz przy `usunDowodyNieobecnosci`
  wymienia wywołania `clearAbsence.run` w `staging_policy.cjs` na liniach `:507, :533, :542, :560, :579`,
  ale pomija `:594` (`clearAbsence.run(supplier,p.kod);stats.doStagingu++;...`). Nie wpływa na kod, tylko
  na kompletność odsyłacza do oryginału, który reszta pliku traktuje jako dowód wierności.

## NICE-TO-HAVE

- [ ] `docs/tickets/124-FEATURE-fundament-stagingu/plan.md:144` — planowana nazwa funkcji
  `dopasowaniaStagingu` (liczba mnoga) wylądowała w implementacji jako `dopasowanieStagingu` (liczba
  pojedyncza, `repos/staging-polityka.ts:43`) — trafniejsza nazwa (funkcja zwraca jeden wiersz), ale plan
  i kod się rozjeżdżają nazewniczo; kosmetyka.

## Plan compliance

### Done ✓
- Migracja `012` — 6 tabel + 2 indeksy, DDL zweryfikowane bajt w bajt względem
  `git show 88fa31c:db/schema.sql:332-347` (z jedyną zmianą `CREATE` → `CREATE IF NOT EXISTS`),
  `DELETE` duplikatów `staging_items` PRZED `CREATE UNIQUE INDEX` — kolejność poprawna.
- Model Drizzle sześciu tabel w `schema.ts` — typy, `NOT NULL`, `DEFAULT`, klucze złożone i indeks
  częściowy (`uniqueIndex(...).where(...)`) zgadzają się z DDL; `stagingItems` dostał tylko deklarację
  indeksu, żadna kolumna nietknięta.
- `repos/staging-polityka.ts` — wszystkie 16 funkcji porównane linia po linii z
  `mirror/backend/staging_policy.cjs` @ 88fa31c: `ON CONFLICT`, zestaw aktualizowanych kolumn,
  `.get()`/`.all()`/`.run()` zgadzają się z zapytaniem wskazanym w komentarzu. Szczególnie potwierdzone:
  `zapiszAutomatyczneWstrzymanie` nie dotyka `suspended_at` w `DO UPDATE` (:122-124),
  `zapiszStanOfertyDostawcy` odtwarza `MAX(...)` (:522-524), trzy zapisy na `staging_absence_decisions`
  (:261, :308-311, :322-325) różnią się dokładnie tak, jak opisano (pierwszy nie dotyka
  `selected_source_code`, drugi ustawia z `excluded`, trzeci jawnie `NULL`).
- Brak logiki decyzyjnej w repozytorium — same operacje CRUD/upsert, żadnych warunków biznesowych.
- Testy migracji na trzech bazach (`db.migracja-012.test.ts`, 13 testów) — świeża, kopia
  `db/snapshot.db` (pomiar zweryfikowany samodzielnie: SNAPSHOT_DB uruchomiony, testy przechodzą),
  symulacja produkcji (`88fa31c-schema.sql`, zweryfikowane `diff` bajt w bajt ze zrzutem oryginału).
- Testy repozytoriów na realnej bazie bez mocków (`repos.staging-polityka.test.ts`, 18 testów) —
  faktycznie dowodzą różnic między upsertami, nie są tautologiczne.
- Aktualizacja `db.migracje.test.ts` (helper `dodajStaging` z unikalnym `kod`) i
  `db.migracje-produkcja.test.ts` — zweryfikowane, że zmiana jest wymuszona nowym indeksem unikalnym
  (uruchamianym w `beforeEach` PRZED wstawieniem danych testowych), a nie rozluźnieniem asercji: testy
  nadal śledzą wiersze po `id`.
- `migrate.ts` nietknięty, `import/tk.ts`, trasy, `legacy/**`, `docs/rebuild-roadmap.md`,
  `docs/rebuild-backlog.md` — nietknięte, zgodnie z „Poza zakresem”.
- lint, typecheck, build — zielone (zweryfikowane samodzielnie).

### Missing or deviating ✗
- Dwa elementy Definition of done dotyczące dokumentacji karty nie zostały zrealizowane — patrz BLOCKER.
- `raport.md` nie jest częścią żadnego commita — patrz SHOULD-FIX.

### Definition of done
- [x] `012_staging_polityka.sql` — 6 tabel + 2 indeksy bajt w bajt, `IF NOT EXISTS`, sprzątanie przed indeksem
- [x] Migracja idempotentna — udowodnione testem na trzech bazach
- [x] Na bazie produkcji `sqlite_master` identyczny przed i po
- [ ] Pomiar sprzątania duplikatów zapisany w `docs/karty/I15.4a/karta.md` — nie zapisany (jest tylko w komentarzu migracji i w `raport.md`, niekommitowanym)
- [x] 6 tabel w `schema.ts`, żadna istniejąca nieruszona
- [x] `repos/staging-polityka.ts` — komplet operacji, bez logiki decyzyjnej
- [x] Testy repozytoriów na realnej bazie
- [x] `db.migracje.test.ts` i `db.migracje-produkcja.test.ts` zaktualizowane
- [ ] Nazwy/sygnatury repozytoriów i zachowanie migracji przy cutoverze opisane w „Do koordynatora” — nie opisane
- [ ] `docs/karty/I15.4c/wejscie-124.md` z pomiarem #107 — plik nie istnieje
- [x] lint, typecheck, build — zielone; `test` zielony poza dwoma testami niezwiązanymi z tym ticketem (patrz „Parallel-test concerns”/uwaga niżej)

## Parallel-test concerns

Brak nowych problemów z równoległością wniesionych przez ten ticket — wszystkie nowe testy używają baz
SQLite w katalogach tymczasowych (`mkdtempSync`), bez współdzielonych portów czy stałych ścieżek.

Uwaga (nie wina tego ticketu, ale odnotowana przy pełnym przebiegu `npx vitest run`):
oprócz znanego, zastrzeżonego w promptcie flaky testu `alerty-katalogu.gate.test.ts` („paczka równa
limitowi 20 000 id”), w tym samym przebiegu wypadły na timeoucie 20 s również dwa testy w
`silnik.charakteryzacja.test.ts` (`MO2: port silnika == oryginalne tk()`, `MO5: port silnika == oryginalne
tk()`). Uruchomione osobno (`npx vitest run test/silnik.charakteryzacja.test.ts test/alerty-katalogu.gate.test.ts`)
— wszystkie 86 testów przechodzi. `import/tk.ts` nie jest dotknięty tym diffem (`git diff` pusty), więc to
obciążenie maszyny przy pełnym równoległym przebiegu, nie regresja tego ticketu — ale próg 20 s w obu
plikach jest zbyt ciasny dla pracy równoległej kilku agentów, tak jak już odnotowano dla
`alerty-katalogu.gate.test.ts`.

## Overall assessment

Techniczna jakość zmiany jest bardzo wysoka: DDL migracji 012 jest zweryfikowany bajt w bajt względem
zrzutu produkcji, a wszystkich 16 funkcji repozytorium sprawdzono linia po linii względem
`staging_policy.cjs` — łącznie z subtelnymi różnicami między trzema upsertami na
`staging_absence_decisions` i brakiem `suspended_at` w `DO UPDATE` automatycznego wstrzymania. Testy
realnie coś dowodzą (nie tautologiczne), pomiar sprzątania duplikatów samodzielnie zweryfikowany na
kopii `snapshot.db`. Jedyny realny problem to dyscyplina procesu z CLAUDE.md: karta `I15.4a` nie
została zaktualizowana o stan i „Do koordynatora”, a `docs/karty/I15.4c/wejscie-124.md` — obiecany
decyzją D-124.4 i wpisany do Definition of done — nie powstał. To są zaległości dokumentacyjne, łatwe
do domknięcia, ale bez nich następna sesja (I15.4c) nie dostanie zaplanowanego przekazania.
