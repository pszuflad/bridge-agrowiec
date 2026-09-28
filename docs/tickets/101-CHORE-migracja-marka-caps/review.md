# 101-CHORE-migracja-marka-caps — Code review

> Reviewed: 2026-09-22
> Branch: `chore/101-migracja-marka-caps`
> Diff: 4 pliki (307 dodanych / 2 usunięte linie), 1 commit (`836a471`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/schema/010_marka_caps.sql:42-56` — samo-referencyjny wzorzec `UPDATE products` (CTE
  `klucz` liczone z `SELECT DISTINCT marka FROM products`, użyte zarówno w `WHERE ... IN`, jak i w
  skorelowanym podzapytaniu `SET marka = (...)`) jest nowym, bardziej subtelnym wzorcem SQL niż
  poprzednie migracje (004/006 nie robią self-join/dedupu na tej samej tabeli). Poprawność zależy
  od dwóch niezapisanych nigdzie w pliku zachowań silnika SQLite: (1) CTE użyte >1 raz w jednym
  stwierdzeniu jest materializowane raz przed rozpoczęciem `UPDATE` (nie „widzi" własnych zmian
  w trakcie przebiegu), (2) `x IN (podzapytanie nieskorelowane)` jest materializowane do efemerycznego
  indeksu raz, a nie przeliczane per wiersz.
  - Reason: Zweryfikowałem to empirycznie (testy 22/22 z `SNAPSHOT_DB`, w tym porównanie
    wiersz-po-wierszu i drugi przebieg = 0 zmian) i to zachowanie jest zgodne z udokumentowanymi
    optymalizacjami SQLite (materializacja wielokrotnie referencjonowanego CTE, efemeryczny
    B-tree dla `IN`), więc **nie jest to błąd** — ale plik SQL nie tłumaczy, dlaczego wzorzec jest
    bezpieczny, mimo że komentarz w nagłówku pliku odnosi się już do innych subtelności (ASCII-only
    `UPPER()`, idempotencja). Ktoś kopiujący ten wzorzec do migracji, gdzie CTE jest referencjonowane
    tylko raz, mógłby nieświadomie trafić w faktyczny hazard „częściowo zaktualizowanej tabeli".
  - Suggestion: dopisać do nagłówka pliku 2-3 zdania z uzasadnieniem (jak wyżej) albo wrócić do
    podejścia z `plan.md` (tabela TEMP) i osobno rozliczyć wpływ na `total_changes()` w teście.

## NICE-TO-HAVE

- [ ] `docs/tickets/101-CHORE-migracja-marka-caps/plan.md:62-64` — checkboxy „Definition of done"
  zostały nieodhaczone (`- [ ]`), mimo że wszystkie trzy warunki są spełnione i potwierdzone testami
  na snapshocie. Kosmetyka, ale utrudnia szybkie „czy gotowe" przy przeglądzie karty.
- [ ] `rebuild/schema/010_marka_caps.sql:52,65` — oba `UPDATE`/`DELETE` powtarzają identyczny,
  9-krotny łańcuch `replace()` do sprowadzania polskich liter. Plik sam to nazywa („wyrażenie jest
  w obu instrukcjach IDENTYCZNE; zmieniając jedno, zmień drugie") — świadomy DRY-dług z powodu braku
  tabeli tymczasowej między dwiema instrukcjami `WITH`. Nie blokuje, bo SQLite nie pozwala dzielić
  CTE między osobnymi top-level statements bez tabeli pomocniczej, a ta decyzja jest już uzasadniona
  w `raport.md` (Deviations from plan).

## Plan compliance

### Done ✓
- `rebuild/schema/010_marka_caps.sql` — predykat ogólny (klucz = grupa, nie „ALLIANCE" na sztywno),
  polskie znaki sprowadzane przed `UPPER()`, słownik bez formy niekanonicznej, idempotencja treściowa.
- `rebuild/schema/README.md` — wiersz 010 + dopisek w akapicie o migracjach danych (zgodnie z
  zasadą projektu „nowy wpis w nowym miejscu", nie dopisany na końcu istniejącego zdania w sposób
  konfliktogenny).
- `test/db.migracje.test.ts` — lista `MIGRACJE` zaktualizowana, blok 010 z 6 testami (ogólny
  predykat, polskie znaki, ograniczenie spoza polskiego alfabetu, słownik, idempotencja, snapshot).

### Missing or deviating ✗
- Tabela TEMP z `plan.md` (krok 1) zastąpiona powtórzonym CTE — udokumentowane i uzasadnione w
  `raport.md` („Deviations from plan"), akceptowalne (patrz SHOULD-FIX wyżej — tylko dokumentacja
  bezpieczeństwa wzorca w samym pliku SQL jest niepełna).

### Definition of done
- [x] 010 na snapshocie: 849 × `ALLIANCE`, 0 × `Alliance`, słownik bez `Alliance`, nic innego —
  potwierdzone testem `SNAPSHOT_DB` (uruchomiony ponownie w trakcie review, 22/22 zielone).
- [x] drugi przebieg = 0 zmian — potwierdzone (test idempotencji + snapshot).
- [x] lint/typecheck/build/test zielone — lint i typecheck uruchomione ponownie w trakcie review
  (czyste); pełny `test` (1516/2 skip) zaufany raportowi, sam plik migracji przetestowany w pełni
  (22/22 z realną kopią `db/snapshot.db`).

## Parallel-test concerns

None — wszystkie testy używają `mkdtempSync` (izolowany katalog tymczasowy) i kopiują
`db/snapshot.db` do własnego katalogu tymczasowego zamiast otwierać oryginał; brak stałych portów
i wspólnych plików.

## Overall assessment

Migracja jest solidna: reguła jest ogólna (nie hardkoduje „Alliance"), poprawnie obsługuje polskie
znaki mimo ASCII-only `UPPER()` w SQLite, jest idempotentna treściowo i ma dobre pokrycie testami —
w tym test na realnej kopii `db/snapshot.db`, który potwierdza dokładnie oczekiwane liczby
(849/0, 1 wpis słownika usunięty, `total_changes()`=2, zero par case-only po migracji liczonych
narzędziem Unicode-aware). Świadome odstępstwo od produkcji (usunięcie duplikatu zamiast scalania
w filtrze) jest zgodne z decyzją użytkownika i jasno oznaczone w pliku SQL. Jedyna realna uwaga to
brak w samym pliku SQL uzasadnienia, dlaczego samo-referencyjny wzorzec `UPDATE`/`DELETE` z CTE
jest bezpieczny wobec własnych zmian w trakcie wykonania — zweryfikowałem to i jest bezpieczny, ale
zależy od zachowań silnika, które warto nazwać wprost, żeby nikt nie skopiował wzorca w kontekście,
gdzie przestaje być bezpieczny.
