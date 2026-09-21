# 92-CHORE-migracja-typow-alertow — raport z implementacji

## Podsumowanie
Migracja `009_alerty_polskie_znaki.sql` przywraca polskie litery zamienione na „?” w tabeli
`alerts`. Na kopii `db/snapshot.db` naprawia 435 wartości `typ` („B??d pobierania” → „Błąd
pobierania” i dwa pozostałe typy) oraz 2219 wartości `opis` („produkt?w” → „produktów”,
„kluczowe/b??dy” → „kluczowe/błędy”). Poza tym nie zmienia niczego: skan wszystkich tabel nie
znalazł uszkodzeń w innych miejscach. Drugie uruchomienie nie zmienia żadnego wiersza.

## Pomiar (kopia `db/snapshot.db`)

| Kolumna | Zepsuta wartość / fragment | Wierszy | Poprawna | Kandydatów |
|---|---|---|---|---|
| `alerts.typ` | `B??d pobierania` | 339 | `Błąd pobierania` | 1 |
| `alerts.typ` | `R?czny upload` | 92 | `Ręczny upload` | 1 |
| `alerts.typ` | `B??d HTTP` | 4 | `Błąd HTTP` | 1 |
| `alerts.opis` · Synchronizacja | `produkt?w`, `kluczowe/b??dy` | 2127 | `produktów`, `kluczowe/błędy` | 1 |
| `alerts.opis` · Ręczny upload | `produkt?w` | 92 | `produktów` | 1 |
| wszystkie inne tabele i kolumny tekstowe | — | 0 | — | — |

- **Skąd 435 i 339.** Obie liczby są prawdziwe, ale mierzą co innego. 435 to wszystkie zepsute
  `typ`, a 339 to tylko „B??d pobierania”. Notatka dla Ani
  (`docs/pytania-do-ani-2026-09-18.md`) podała liczbę jednego typu.
- **Wartości niejednoznaczne lub bez dopasowania:** 0.
- **Kto dziś zapisuje zepsute znaki.** Produkcja: literały ze znakami „?” są w żywym bundlu
  (`deminified/backend-index.cjs:48060, :48091, :48103, :48269, :48270`), a nazwa dostawcy
  w tym samym `opis` ma poprawne litery. Psuje więc każdy nowy alert tych typów. Odbudowa
  zapisuje poprawne literały (`synchronizuj.ts:172, :222, :238`, `routes/suppliers.ts:190, :192`).
  009 uruchomiona przy cutoverze naprawi też alerty zapisane przez produkcję do dnia
  przełączenia, a potem problem nie wraca.

## Skutki uboczne
- **Grupowanie P6.1** (`dostawca|typ|status`): na snapshocie jest 19 grup przed i 19 po
  migracji. Żadna grupa się nie scala, bo baza produkcji nie ma ani jednego poprawnego „Błąd…”.
  Grupy tylko zmieniają nazwę. Scalenie nastąpi jedynie w bazach deweloperskich, w których
  odbudowa zdążyła zapisać własne alerty.
- **Wyszukiwarka P6.1:** słowa „Błąd”, „Ręczny”, „produktów” i „błędy” znajdą naprawione alerty.
- **Fixtures:** `contract/fixtures/GET_alerts.json` ma `produkt?w`/`b??dy` jako zapis produkcji
  i zostaje bez zmian. `alerty.gate.test.ts` zasiewa bazę tym fixture'em po migracjach, więc 009
  go nie dotyka. Frontend nie porównuje `typ` z literałem, a jego mocki nie zawierają „B??d”.

## Zmiany
- **Nowy:** `rebuild/schema/009_alerty_polskie_znaki.sql` — trzy `UPDATE` na `typ` przez `=`,
  dwa `UPDATE` na `opis` przez `instr()` + `replace()` pełnego fragmentu szablonu, ograniczone typem.
- `rebuild/schema/README.md` — wiersz dla 009 i dopisek w części o migracjach danych.
- `rebuild/backend/test/db.migracje.test.ts` — 009 dodana do listy `MIGRACJE` oraz nowy blok
  z czterema testami: naprawa, rzeczy nietknięte, idempotencja i pomiar na kopii snapshotu
  (uruchamiany tylko z `SNAPSHOT_DB`).

## Odstępstwa od planu
Brak.

## Wyniki testów
- **Gate odbudowy:** nie dotyczy, bo ticket nie zmienia API. `alerty.gate.test.ts` przechodzi
  bez zmian (fixture `GET_alerts.json` nietknięty).
- **Migracja:** `db.migracje.test.ts` 15 przeszło + 1 pominięty bez `SNAPSHOT_DB`. Z
  `SNAPSHOT_DB=db/snapshot.db` przeszło 16/16: 435 → 0 i 2219 → 0, `total_changes` = 2654
  (435 + 2127 + 92, czyli nic poza `alerts`), porównanie wiersz po wierszu z oczekiwanym
  i drugi przebieg = 0.
- **Bramki:** lint ✓, typecheck ✓, build ✓ (`copy-schema` kopiuje 9 plików). `npm test`:
  1471 przeszło, 1 pominięty, 1 nie przeszedł. Obciążenie maszyny wynosiło 17–19 przy
  8 rdzeniach (równoległe sesje). Porażki zależą od czasu, a między biegami padały różne testy:
  - `alerty-katalogu.gate` „paczka 20 000 id” — timeout 20 s (bieg trwał 28 s); z
    `--testTimeout=90000` przechodzi;
  - `scheduler` „stary interwał jest GASZONY” — okno 400 ms; osobno przeszedł 3/3.

  Żaden z tych testów nie czyta `alerts`, a 009 na pustej bazie testowej zmienia 0 wierszy.

## Breaking changes
Brak w kodzie. Na produkcji przy cutoverze 009 **zmienia dane**, więc nie jest to no-op
jak w przypadku 004–006.

## Follow-up
- `docs/cutover.md` wymaga dopisania 009 (akapit i punkt kontrolny). Zapisane w „Do
  koordynatora” w karcie PR.3. Ten ticket nie zmienia tego pliku.
- W notatce dla Ani (`docs/pytania-do-ani-2026-09-18.md`) jest „339 alertów”. Faktycznie
  zepsutych było 435 typów i 2219 treści. Decyzja, czy to prostować, należy do PR.6 lub
  koordynatora.

## Poprawki po review
Review: 0 BLOCKER, 0 SHOULD-FIX, 2 NICE-TO-HAVE. Obie uwagi poprawione: komentarz o „obu formach
`typ`” w 009 przeniesiony nad właściwy `UPDATE` (Ręczny upload), a checkboxy DoD w `plan.md`
odhaczone.
