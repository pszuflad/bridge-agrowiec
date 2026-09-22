# 92-CHORE-migracja-typow-alertow — Code review

> Reviewed: 2026-09-22
> Branch: `chore/92-migracja-typow-alertow`
> Diff: 4 pliki (`rebuild/schema/009_alerty_polskie_znaki.sql` nowy, `rebuild/schema/README.md`,
> `rebuild/backend/test/db.migracje.test.ts`, `docs/tickets/92-CHORE-migracja-typow-alertow/plan.md`), 2 commity

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `rebuild/schema/009_alerty_polskie_znaki.sql:46-47` — komentarz „`typ` jest już naprawiony
  powyżej, ale warunek zna obie formy" wisi nad blokiem `WHERE typ = 'Synchronizacja'` (linia 52),
  który wcale nie zna obu form (nie ma `IN ('Synchronizacja', …)`, bo słowo „Synchronizacja" nigdy
  się nie psuje). Opisywany wzorzec `IN ('Ręczny upload', 'R?czny upload')` jest dopiero w bloku
  niżej (linia 57). Czysto dokumentacyjne — kod działa poprawnie, ale komentarz myli czytelnika co
  do tego, którego bloku dotyczy.
  - Suggestion: przenieść komentarz nad blok z linii 55-58 albo doprecyzować, że dotyczy tylko
    UPDATE-u „Ręczny upload".
- [ ] `docs/tickets/92-CHORE-migracja-typow-alertow/plan.md:76-78` — checkboxy Definition of done
  zostały w stanie `[ ]`, mimo że raport.md i pomiar na snapshocie potwierdzają spełnienie
  wszystkich trzech punktów. Kosmetyka procesowa, nie wpływa na kod.

## Plan compliance

### Done ✓
- `009_alerty_polskie_znaki.sql` — trzy `UPDATE … WHERE typ = '…'` (dokładne `=`, bez
  `GLOB`/`UPPER`, zgodnie z D3 i zasadą projektu o ASCII-only `UPPER()`/`?` jako wildcard w GLOB)
  oraz dwa `UPDATE … SET opis = replace(...) WHERE typ IN (…) AND instr(...) > 0` (D2 — tylko
  stałe fragmenty szablonu z otaczającą interpunkcją, ograniczone typem).
- `rebuild/schema/README.md` — wiersz dla 009 w tabeli migracji + dopisek w części o migracjach
  danych (`009` obok `004`-`006` jako przykład idempotencji treściowej).
- `rebuild/backend/test/db.migracje.test.ts` — 009 dopisana do listy `MIGRACJE`, bilans 28
  tabel/14 indeksów utrzymany (migracja czysto danych), nowy blok czterech testów: naprawa
  wartości + nietykalność nazw dostawcy/pliku/typów obcych/legalnego „?" w query stringu,
  idempotencja (drugi przebieg = 0 zmian), pomiar na kopii `db/snapshot.db` pod `SNAPSHOT_DB`.
- Weryfikacja słownika względem źródeł: literały `B??d HTTP` (:48060), `produkt?w …
  kluczowe/b??dy` (:48091), `B??d pobierania` (:48103), `R?czny upload` (:48269), `produkt?w …
  kluczowe/bledy` (:48270) sprawdzone bezpośrednio w `mirror/backend/index.cjs` (żywy bundel, nie
  tylko deminifikat) — dokładnie te same 4 wywołania `addAlert(...)` co w bundlu, brak patcha
  cieniującego te literały, brak innych wywołań `addAlert` poza `index.cjs`. Słownik jest kompletny
  i zgodny z produkcją.
- Test na kopii `db/snapshot.db` uruchomiony ręcznie
  (`SNAPSHOT_DB=… npx vitest run test/db.migracje.test.ts`, Node 20): 16/16 zielone, w tym pomiar
  435 (`typ`) / 2219 (`opis`) → 0 po migracji, `total_changes()=2654` (nic poza `alerts`), drugi
  przebieg = 0 zmian. Snapshot na dysku nietknięty (test kopiuje do katalogu tymczasowego).
- Weryfikacja bezpieczeństwa gate'u: `test/alerty.gate.test.ts` zasiewa `GET_alerts.json`
  przez bezpośredni `insert()` PO wywołaniu `stworzSrodowiskoTestowe()` (które stosuje migracje),
  więc 009 nie dotyka wierszy z fixture'a — potwierdzone czytając kod testu, nie tylko raport.

### Missing or deviating ✗
Brak — zakres z planu zrealizowany 1:1, „Poza zakresem" (kod alertów P6.1/P6.2, `docs/cutover.md`,
roadmapa, fixtures) rzeczywiście nietknięte w diffie.

### Definition of done
- [x] Na kopii snapshotu: 435 `typ` i 2219 `opis` naprawione, 0 pozostałych „?" w słowach —
  potwierdzone własnym uruchomieniem testu.
- [x] Drugie wykonanie SQL daje 0 zmian — potwierdzone (test idempotencji + snapshot).
- [x] Wszystkie bramki zielone — lint/typecheck zweryfikowane ręcznie dla plików diffu; build i
  pełny `npm test` wg raportu (2 nieszczelne, niepowiązane testy pod obciążeniem maszyny —
  `alerty-katalogu.gate` timeout i `scheduler` okno czasowe — żaden nie czyta `alerts`,
  uzasadnienie w raport.md wystarczające, nie blokuje).

## Parallel-test concerns

None — wszystkie nowe testy używają `mkdtempSync`/plików tymczasowych per test (ten sam wzorzec co
istniejący blok 13c), test snapshotu kopiuje `SNAPSHOT_DB` do katalogu tymczasowego i nie modyfikuje
oryginału. W pełni równoległe.

## Overall assessment

Bardzo solidny, wąsko zakrojony ticket. Słownik zamian zweryfikowany bezpośrednio w żywym bundlu
produkcji (nie tylko w deminifikacie), zgodny co do znaku z tym, co faktycznie zapisują
`synchronizuj.ts` i `routes/suppliers.ts`. Migracja stosuje dokładnie `=`/`instr()`+`replace()`
zamiast `GLOB`/`UPPER()`, zgodnie z udokumentowanymi pułapkami projektu. Idempotencja treściowa i
brak wpływu na fixture/GATE potwierdzone czytaniem kodu, nie tylko deklaracją w raporcie. Jedyne
uwagi to kosmetyczny, źle umiejscowiony komentarz w SQL i nieodhaczone checkboxy w planie — żadna
nie wymaga zmiany kodu przed mergem.
