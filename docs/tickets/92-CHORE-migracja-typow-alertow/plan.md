# 92-CHORE-migracja-typow-alertow — naprawa zepsutych polskich znaków w alertach (karta PR.3)

> Status: Implemented
> Branch: `chore/92-migracja-typow-alertow`
> Worktree: `.worktrees/92-CHORE-migracja-typow-alertow`

## Opis ticketa
Karta PR.3 z przeglądu 12 widoków. Ania zobaczyła w filtrze alertów „B??d HTTP”. W bazie leżą
alerty, w których polskie litery zamieniono na „?”. Nowy panel Alerty pokazuje je jako pierwszy,
bo stary ekran Alerty tej tabeli nie czytał. Obietnica dla Ani to „Poprawimy same dane”
(`docs/pytania-do-ani-2026-09-18.md`, wstęp do sekcji 12). Jest to świadoma, uzgodniona poprawka
danych migracją.

## Kontekst — pomiar na kopii `db/snapshot.db`
2562 alerty z okresu 2026-06-30…2026-08-13. Przeskanowano wszystkie kolumny tekstowe wszystkich
tabel pod kątem „?” wstawionego między litery. Trafienia są **wyłącznie** w `alerts.typ`
i `alerts.opis`.

| Kolumna | Zepsute (DISTINCT / fragment) | Wierszy | Poprawna forma | Źródło słownika |
|---|---|---|---|---|
| `alerts.typ` | `B??d pobierania` | 339 | `Błąd pobierania` | `synchronizuj.ts:238` · oryg. `backend-index.cjs:48103` |
| `alerts.typ` | `R?czny upload` | 92 | `Ręczny upload` | `routes/suppliers.ts:190` · oryg. `:48269` |
| `alerts.typ` | `B??d HTTP` | 4 | `Błąd HTTP` | `synchronizuj.ts:172` · oryg. `:48060` |
| `alerts.opis` (typ Synchronizacja) | ` produkt?w (nowe: `, `, kluczowe/b??dy: ` | 2127 | `produktów`, `kluczowe/błędy` | `synchronizuj.ts:221-222` · oryg. `:48091` |
| `alerts.opis` (typ Ręczny upload) | ` produkt?w, nowe: ` | 92 | `produktów` | `routes/suppliers.ts:192` · oryg. `:48270` |

- **Skąd 435 i 339.** Obie liczby są poprawne, ale mierzą co innego. 435 to wszystkie zepsute
  `typ`, a 339 to wyłącznie `B??d pobierania`. Notatka dla Ani podała liczbę jednego typu.
- **Przyczyna.** To nie jest błąd kodowania przy zapisie. Znaki „?” są wpisane na stałe
  w literałach żywego bundla produkcji (`mirror/backend/index.cjs`, w `deminified/` linie
  podane wyżej). Nazwa dostawcy wstawiana do tego samego `opis` („Handlopex Wrocław”) jest
  zapisana poprawnie, co potwierdza, że psuje się tylko tekst z kodu.
- **Kto zapisuje zepsute znaki dziś.** Produkcja tak, dopóki działa. Odbudowa nie, bo zapisuje
  poprawne literały. Migracja wykonana przy cutoverze naprawi także alerty, które produkcja
  zapisze do dnia przełączenia, a potem problem nie wraca.
- Każdy „?” zastępuje dokładnie jedną literę (`Błąd` ↔ `B??d`). Każda zepsuta wartość ma
  w słowniku dokładnie jednego kandydata identycznego poza pozycjami „?”. Nie ma wartości
  niejednoznacznych ani bez dopasowania.
- `kluczowe/bledy` bez ogonków w alertach „Ręczny upload” pochodzi z oryginału (`:48270`)
  i odbudowa pisze to samo. Zostaje bez zmian.

## Kontrakt i fixtures (zakres)
Brak, bo ticket nie dotyka API ani kodu. `contract/fixtures/GET_alerts.json` zawiera
`produkt?w`/`b??dy` jako zapis produkcji i zostaje bez zmian. `alerty.gate.test.ts` zasiewa
bazę tym fixture'em PO migracjach, więc migracja go nie dotyka.

## Decyzje
- **D1 — zakres: `typ` + `opis`** (użytkownik 2026-09-22). Bez poprawy `opis` odbudowa po
  cutoverze pisałaby „produktów” obok starego „produkt?w”, a wyszukiwarka nie znajdowałaby
  starych alertów.
- **D2 — w `opis` podmieniamy tylko stałe fragmenty szablonu** (razem z otaczającą
  interpunkcją) i tylko w wierszach właściwego typu. Nazwy plików i dostawców pozostają nietknięte.
- **D3 — `typ` poprawiamy dokładnym `=`**, a nie przez `LIKE`/`GLOB`/`UPPER`: `?` jest wildcardem
  w GLOB, a `UPPER` w SQLite jest ASCII-only.
- **Odstępstwo od oryginału:** produkcja zapisuje zepsute znaki, a my je naprawiamy. Taka jest
  treść karty i obietnica dana Ani. Odbudowa już wcześniej zapisywała poprawne literały.

## Plan implementacji
1. `rebuild/schema/009_alerty_polskie_znaki.sql` — trzy `UPDATE … WHERE typ = '…'` i dwa
   `UPDATE … SET opis = replace(...) WHERE typ IN (…) AND instr(opis, fragment) > 0`.
   Idempotencja wynika z tego, że warunek `WHERE` nie trafia w wiersz już naprawiony.
2. `rebuild/schema/README.md` — wiersz tabeli dla 009.
3. `rebuild/backend/test/db.migracje.test.ts` — dopisanie 009 do listy `MIGRACJE`, nowy blok
   testów dla 009 na zasianych wierszach (przed/po, idempotencja, inne kolumny i tabele
   nietknięte, alerty już poprawne nietknięte) oraz test na kopii snapshotu, uruchamiany
   tylko gdy ustawiono `SNAPSHOT_DB`. Test sprawdza liczby 435/2219 i zero pozostałości.

## Testy
Bramki backendu: lint, typecheck, build, test (Node 20). Test snapshotu uruchomiony ręcznie
z `SNAPSHOT_DB=<ścieżka>/db/snapshot.db`, wynik zapisany w raporcie.

## Poza zakresem
Kod alertów (P6.1/P6.2), `docs/cutover.md`, roadmapa, fixtures.

## Definition of done
- [x] Na kopii snapshotu: 435 `typ` i 2219 `opis` naprawione, 0 pozostałych „?” w słowach.
- [x] Drugie wykonanie SQL daje 0 zmian.
- [x] Wszystkie bramki zielone.
