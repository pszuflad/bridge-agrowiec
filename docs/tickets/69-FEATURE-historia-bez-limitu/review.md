# 69-FEATURE-historia-bez-limitu — Code review

> Reviewed: 2026-09-21
> Branch: feature/69-historia-bez-limitu
> Diff: 10 plików (8 kodu/testów + plan.md/raport.md), 3 commity (w tym 1 merge origin/develop)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:962-971,989-991` — blok „Iteracja 5 — Historia" nadal twierdzi,
  że limit 5000 to „port 1:1" i że `/paged` „czyta tylko 5000 najświeższych wierszy audytu
  PRZED filtrowaniem" — to jest **nieaktualne** po tym tickecie, a nikt tego nie poprawił.
  - Reason: CLAUDE.md, sekcja „Roadmapa jest wejściem dla następnej sesji", reguła 1: „Po
    każdym zamkniętym bloku roadmapa opisuje STAN, nie zamiar." Plan.md wprost wymienia to
    w Definicji ukończenia („roadmapa (P5.1) i backlog #87 zaktualizowane") i checkbox
    zostaje niezaznaczony. `git diff origin/develop...HEAD` potwierdza, że
    `docs/rebuild-roadmap.md` i `docs/rebuild-backlog.md` nie zostały w ogóle tknięte —
    następna sesja czytająca roadmapę dostanie fałszywy opis bieżącego zachowania trasy.
  - Suggestion: dopisać do bloku Iteracji 5 notkę „limit zdjęty w tickecie 69, patrz backlog
    #87" i zaktualizować zdanie o 5000 wierszach; w `docs/rebuild-backlog.md:3639-3715`
    zmienić `Status` wpisu #87 z „zmiana limitu — nie zaczęte" na zrobione (data + ID
    ticketu), zgodnie z formatem innych zamkniętych wpisów (np. #40, #41).

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `docs/tickets/69-FEATURE-historia-bez-limitu/plan.md:126-131` — wszystkie pozycje
  Definicji ukończenia zostały w pliku niezaznaczone (`[ ]`), mimo że raport.md potwierdza
  ich spełnienie poza roadmapą/backlogiem. Kosmetyka, ale utrudnia szybkie sprawdzenie stanu
  bez czytania całego raportu.
- [ ] `rebuild/backend/test/historia.mapowanie.test.ts` — plik ma cztery miejsca (linie ok.
  173–175, 187–189, 265, 295–300) niezgodne z `prettier --print-width 100` (zawijanie inne niż
  wynik `prettier --write`); żadne z nich nie leży w liniach dodanych tym tickietem (diff
  dotyka tylko nagłówka importu i nowego bloku `describe("akcjeHistorii…")`), więc to zaszłość
  sprzed tej karty — wspominam, bo formatter i tak by to złapał przy następnej edycji pliku.

## Plan compliance

### Done ✓
- `src/historia/mapowanie.ts`: `SLOWNIK_AKCJI` jako `ReadonlyMap`, `typWpisu()` czyta mapę,
  nowe `akcjeHistorii(typ)`, `LIMIT_AUDYTU` usunięty, nagłówek i komentarze zaktualizowane.
- Nowy `src/repos/audit-historia.ts`: `audytDlaHistorii(db, akcje)` —
  `inArray(akcja) ORDER BY kiedy DESC, id DESC`, bez limitu, dokładnie jak w planie.
- `src/routes/history.ts`: `/meta` woła `akcjeHistorii("all")`, `/paged` woła
  `akcjeHistorii(typ)` w SQL, reszta (`stronaHistorii()`) bez zmian — zgodnie z D2.
- `src/repos/audit.ts`: wyłącznie zmiana komentarza, `/api/audit-log` (`listaAudytu(db, 500)`)
  nietknięte — zgodnie z planem.
- Nowy `test/historia.powyzej-progu.test.ts`: 7 przypadków, w tym remis `id DESC`.
  **Zweryfikowałem osobiście** (cofnięcie `src/historia/mapowanie.ts`,
  `src/repos/audit.ts`, `src/routes/history.ts` do `origin/develop` i usunięcie
  `src/repos/audit-historia.ts`, potem przywrócone `git checkout HEAD --`): na starym kodzie
  5 z 6 przypadków głównych rzeczywiście pada (`total` 9 zam. 12, `/meta` bez `STARY1`, fraza
  i filtry nie sięgają najstarszych wpisów) oraz test remisu też pada bez `id DESC` — zgodnie
  z twierdzeniem raportu „5/6" i „remis pada bez id DESC".
- `test/historia.mapowanie.test.ts`, `test/historia.odczyt.test.ts`: pokrycie `akcjeHistorii()`
  (all/typ/nieznane/`constructor`/`__proto__`), spójność z `typWpisu()`, nieznany `typ` → pusta
  strona — zgodnie z planem.
- `test/historia.wyrocznia.test.ts`: tylko komentarz warunku ważności, JSON nietknięty —
  potwierdzone `git diff`.
- Kontrakt, fixtures, `contract/openapi.yaml` — nietknięte (zweryfikowane `git diff --stat` i
  ręcznym odczytem specyfikacji tras `/api/history/meta`, `/api/history/paged`: brak wzmianki
  o limicie).
- Zakres plików dokładnie zgodny z planem: nie ruszono `repos/dziennik-zmian.ts`,
  `GET /api/history`, `docs/instrukcja-testow-I5.md`.

### Missing or deviating ✗
- Definicja ukończenia pkt „roadmapa (P5.1) i backlog #87 zaktualizowane" — **niespełniony**,
  patrz BLOCKER wyżej. Follow-up P5.3 w raporcie jest za to opisany poprawnie (sekcja
  „Follow-up" raportu, dwa punkty, jeden do karty P5.3, jeden do `oracle-diff-historii.cjs`).

### Definicja ukończenia
- [x] `LIMIT_AUDYTU` usunięty; `/meta` i `/paged` nie tną `audit_log`
- [x] słownik akcji ma jedno źródło; klauzula `IN` z niego wyliczana (zweryfikowane grepem —
  jedyne miejsca z nazwami akcji poza `mapowanie.ts`/`audit-historia.ts` to miejsca ZAPISU
  audytu, nie druga mapa akcja→typ)
- [x] test powyżej progu zielony (pada na starym kodzie, wykazane — zweryfikowane osobiście)
- [x] wyrocznia 13/13 bez wyjątku, GATE zielony (zweryfikowane uruchomieniem)
- [x] lint, typecheck, build, test zielone dla zakresu ticketu (zweryfikowane uruchomieniem;
  patrz uwaga w sekcji „Parallel-test concerns" o niepowiązanym z tym tickietem teście
  `scheduler.test.ts`)
- [ ] roadmapa (P5.1) i backlog #87 zaktualizowane; follow-up P5.3 w raporcie — **część
  „roadmapa/backlog" niespełniona**, follow-up w raporcie jest

## Parallel-test concerns

Podczas weryfikacji natrafiłem na **niepowiązany z tym tickietem** (plik spoza diffu, kod
scheduler'a spoza diffu) niestabilny test: `rebuild/backend/test/scheduler.test.ts` →
`GATE — interwał faktycznie odpala pobranie > awaria dostawcy nie wywraca pętli — kolejny
interwał i tak przychodzi`. Reprodukowany 2 razy z 3 przy uruchamianiu całego pliku (zawsze
zielony w izolacji z `-t`, zawsze zielony na czystym `origin/develop` w osobnym katalogu) —
wygląda na test wrażliwy na obciążenie/timing przy współbieżnym uruchamianiu (realne timery,
nie fake timers?). Nie jest to regresja tego ticketu (plik i kod scheduler'a nietknięte w
diffie), ale warto to zgłosić osobno — user pracuje w wielu oknach naraz i taki test będzie
migotał przy równoległych agentach odpalających `npm test`.

Testy dodane tym tickietem (`historia.powyzej-progu.test.ts`, rozszerzenia
`historia.mapowanie.test.ts`/`historia.odczyt.test.ts`) używają `stworzSrodowiskoTestowe()`
(baza tymczasowa, port efemeryczny) — parallelizowalne bez zastrzeżeń.

## Overall assessment

Implementacja jest solidna i dobrze udokumentowana: hybryda z D2 jest logicznie równoważna
staremu filtrowi w pamięci (SQL i filtr `typ` w pamięci czerpią z tego samego słownika, więc
nie mogą się rozjechać), jedno źródło prawdy słownika faktycznie jest jedno (zweryfikowane
grepem), a nowy test „powyżej progu" naprawdę dyskryminuje — osobiście zweryfikowałem,
że pada na starym kodzie (5/6 + remis) i przechodzi na nowym. Lint/typecheck/build/testy
zakresu ticketu są zielone. Jedyny realny brak to niedopełniony obowiązek projektowy:
roadmapa i backlog #87 nie zostały zaktualizowane mimo że plan.md wprost tego wymaga w
Definicji ukończenia i mimo że CLAUDE.md nazywa to regułą numer jeden tego repo — to jest
do domknięcia przed merge, nie do zignorowania jako drobiazg.
