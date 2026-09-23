# 124-FEATURE-fundament-stagingu — raport z implementacji

## Podsumowanie

Migracja `012` wnosi do odbudowy sześć tabel polityki stagingu i dwa indeksy unikalne, bajt w bajt
z `88fa31c:db/schema.sql`, w formie odpornej na to, że na produkcji wszystko to już istnieje.
Do tego model Drizzle tych tabel i jedno repozytorium (`repos/staging-polityka.ts`), którego funkcje
odtwarzają pojedyncze zapytania `staging_policy.cjs` wraz z klauzulami `ON CONFLICT` — bez logiki
decyzyjnej, którą wniosą karty I15.4b i I15.4c. Zachowanie importu i API nietknięte.

## Zmiany

- **Nowy:** `rebuild/schema/012_staging_polityka.sql` — `staging_matches`, `supplier_feed_state`,
  `supplier_feed_versions`, `product_absence_checks`, `product_auto_suspensions`,
  `staging_absence_decisions` + indeksy `staging_one_current_product` i `staging_absence_one_choice`;
  sprzątanie duplikatów `staging_items` przed indeksem unikalnym.
- `rebuild/backend/src/db/schema.ts` — sześć nowych tabel Drizzle; `stagingItems` dostało deklarację
  indeksu `staging_one_current_product` (jedyna zmiana w istniejącej tabeli, nie rusza kolumn).
- **Nowy:** `rebuild/backend/src/repos/staging-polityka.ts` — 16 funkcji odczytu i zapisu.
- **Nowy:** `rebuild/backend/test/db.migracja-012.test.ts` — GATE na trzech bazach (13 testów).
- **Nowy:** `rebuild/backend/test/repos.staging-polityka.test.ts` — 18 testów na prawdziwej bazie.
- **Nowy:** `rebuild/backend/test/schemat-produkcji/88fa31c-schema.sql` — zrzut schematu produkcji.
- `rebuild/backend/test/db.migracje.test.ts` — lista migracji, bilans tabel/indeksów, unikalny `kod`
  w helperze `dodajStaging`.
- `rebuild/backend/test/db.migracje-produkcja.test.ts` — lista obiektów dokładanych na fixture `7d6cfc9`.

## Odstępstwa od planu

**Jedno, dotyczące liczb w pomiarze — plan podawał je zbyt grubo.** Plan mówił „3362 → 3124, −238".
Zmierzone dokładnie w łańcuchu migracji:

| etap | wierszy `staging_items` | duplikatów `(dostawca, kod)` |
|---|---|---|
| surowy snapshot (13.08) | 3362 | 238 |
| po 001–011 (006 kasuje szum CASE_ONLY) | 2639 | 137 |
| po 012 | 2502 | 0 |

Czyli **migracja 012 usuwa 137 wierszy**, a nie 238 — 238 to liczba duplikatów w surowym snapshocie,
zanim 006 zabierze 723 wiersze. Obie liczby są prawdziwe, mierzą co innego. Poprawione w komentarzu
migracji i w karcie.

**Dwa ustalenia, których plan nie przewidział** (oba potwierdzają wierność, nie podważają jej):

1. Fixture `7d6cfc9-schema.sql` **już zawiera** `staging_matches` i `staging_one_current_product` —
   Staging v2 (#99) wdrożono 22.09 rano, a zrzut jest z 14:00. Migracja 012 jest na tym zrzucie
   częściowym no-opem, co jest pierwszym, uzyskanym mimochodem dowodem jej idempotencji.
2. SQLite **normalizuje `IF NOT EXISTS`** przy zapisie do `sqlite_master` — DDL naszych obiektów
   jest więc znak w znak taki sam jak na produkcji. Test to wykorzystuje: porównuje `sqlite_master`
   z bazą zbudowaną ze zrzutu produkcji, zamiast z tekstem przepisanym do testu.

**Drobiazg nazewniczy:** plan zapowiadał funkcję `dopasowaniaStagingu` (liczba mnoga); w implementacji
jest `dopasowanieStagingu` (pojedyncza), bo zapytanie oryginału woła się przez `.get()` i oddaje jeden
wiersz — `(supplier, source_key)` to klucz główny. Nazwa w oryginale (`aliases`) jest myląca.

## Poprawki po review

- `repos/staging-polityka.ts:159` — komentarz przy `usunDowodyNieobecnosci` pomijał szóste wywołanie
  `clearAbsence.run` w oryginale (`staging_policy.cjs:594`). Zweryfikowane `grep`em: wywołań jest sześć
  (:507, :533, :542, :560, :579, :594), odsyłacz uzupełniony. Kod bez zmian.
- `docs/karty/I15.4a/karta.md` — karta oznaczona jako zrobiona, uzupełnione „Dowiezione" (z pomiarem
  duplikatów) i „Do koordynatora" (16 sygnatur repozytoriów, zachowanie cutoveru, otwarte statusy backlogu).
- `docs/karty/I15.4c/wejscie-124.md` i `docs/karty/I15.4b/wejscie-124.md` — założone; przekazują
  sygnatury repozytoriów, trzy pułapki do niesklejania oraz (dla I15.4c) pomiar z backlogu #107.
- `raport.md` dodany do commita (wcześniej nie był w historii gałęzi).

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Żadna z sześciu tabel nie ma
  trasy w `contract/openapi.yaml` ani pliku w `contract/fixtures/` (trasy wnosi I15.4c). Żaden
  istniejący endpoint nie zmienia kształtu: migracja tylko dokłada obiekty. Potwierdzone tym, że
  cały istniejący zestaw GATE-ów przechodzi bez zmian.
- **GATE karty — migracja na trzech bazach: ✓** (`db.migracja-012.test.ts`, 13 testów)
  1. *świeża* — zakłada dokładnie 6 tabel + 2 indeksy; DDL **znak w znak** jak w zrzucie produkcji;
     oba indeksy realnie egzekwowane; ponowne wykonanie treści pliku nie rzuca i nic nie zmienia;
  2. *kopia `db/snapshot.db`* (`SNAPSHOT_DB=…`) — po migracjach zero duplikatów, ocalałe wiersze to
     dokładnie zwycięzcy `MAX(id)` liczeni po 006, indeks unikalny egzekwowany;
  3. *symulacja produkcji* (`88fa31c-schema.sql`, wszystko już istnieje) — łańcuch przechodzi,
     **żaden z ośmiu obiektów nie zmienia definicji**, dane w sześciu tabelach nietknięte,
     sprzątanie duplikatów jest no-opem.
- **Unit/integracja: ✓ 1666 testów w 102 plikach, wszystkie zielone** (`SNAPSHOT_DB` ustawione).
  W tym 18 nowych testów repozytorium na prawdziwej bazie SQLite, bez mocków.
- Bramki: `lint` ✓, `typecheck` ✓, `build` ✓ (kopiuje teraz 13 migracji do `dist/schema/`).

**Obserwacja o teście zastanym:** `test/alerty-katalogu.gate.test.ts` → „paczka równa limitowi
20 000 id przechodzi" raz wypadł na timeoucie 20 s. Sprawdzone: pęka tak samo **bez** migracji 012
(przebieg z wyjętym plikiem), a w pełnym przebiegu przeszedł. To flaky zależny od obciążenia
maszyny, nie skutek tego ticketa — ale próg 20 s jest tam ciasny.

## Breaking changes

**Brak dla API.** Dla baz danych: migracja `012` **kasuje wiersze** `staging_items` na bazach, które
mają duplikaty `(dostawca, kod)` — czyli na kopiach snapshotu i ewentualnych bazach deweloperskich
sprzed Staging v2. Na produkcji no-op (indeks unikalny stoi tam od 22.09). To decyzja D5 iteracji 15,
zapisana w karcie i w nagłówku migracji.

## Follow-up

- **`staging_matches` nie ma funkcji kasującej.** Oryginalny `staging_policy.cjs` w `install()` nie
  ma żadnego `DELETE FROM staging_matches` — kasował je tylko skrypt jednorazowy
  `zero_and_delete_agrorami_20260922.cjs` (D5: nie przenosimy). Świadomie nie wymyślam takiej funkcji.
  Jeśli I15.4b albo I15.4c jej potrzebuje, to jest to nowe zachowanie i wymaga decyzji użytkownika.
- **Próg 20 s w `alerty-katalogu.gate.test.ts`** — osobny ticket, poza zakresem.

## Docs updates

### `docs/karty/` (pisane przez Mastera — karta i wejścia dla kart równoległych)
- `docs/karty/I15.4a/karta.md` — stan `✅ 2026-09-23 · 124-FEATURE-fundament-stagingu`; „Dowiezione" z pomiarem
  duplikatów i trzema ustaleniami obalającymi wcześniejsze założenia; „Do koordynatora" z 16 sygnaturami
  repozytoriów, zachowaniem cutoveru, otwartymi statusami backlogu i zgubionym przypisaniem #107.
  Poprawione **w miejscu**: tytuł „5 tabel" → „6 tabel" (dwa wystąpienia).
- **Nowy:** `docs/karty/I15.4b/wejscie-124.md` — fundament dla importera: odsyłacz do sygnatur, trzy pułapki
  („nie upraszczać"), skutek indeksu unikalnego dla fixtur testowych, otwarte statusy #103/#104.
- **Nowy:** `docs/karty/I15.4c/wejscie-124.md` — jw. dla akceptacji i tras, plus **przejęte zadanie z backlogu
  #107** (pomiar zatwierdzania zbiorczego) z uzasadnieniem przypisania.
- **Nowy:** `docs/spec-backend/wpis-124.md` — zgodnie z regułą „jeden plik na ticket": produkcja zakłada te
  tabele runtime'owo; zrzut `7d6cfc9` ma już Staging v2; SQLite normalizuje `IF NOT EXISTS`; pomiar `MAX(id)`
  zależny od kolejności migracji; trzy upserty `staging_absence_decisions` i dwa zabezpieczenia do niesklejania.

### `rebuild/schema/README.md` + `docs/cutover.md` (doc-checker)
- `rebuild/schema/README.md` — nowy wiersz tabeli migracji dla `012` (sześć tabel, dwa indeksy, DDL bajt
  w bajt, idempotencja bez dyrektywy runnera, pomiar 2639 → 2502 z kontrastem wobec 238 z surowego snapshotu,
  no-op na produkcji). Poprawione **w miejscu** w wierszu `013`: usunięte nieaktualne
  „(`011`, `012` zarezerwowane dla I15.1 i I15.4.)".
- `docs/cutover.md` — nowy akapit „Stan po `012_staging_polityka.sql`". Zdanie „12 migracji bez błędu"
  **świadomie zostawione** — to zapis historycznego pomiaru z konkretnej gałęzi i daty, nie stan bieżący.
  Master doprecyzował potem jedno zdanie o `IF NOT EXISTS`, które w pierwszej wersji sugerowało odwrotność
  (że gołe `CREATE TABLE` nie wywraca migracji — wywraca, i temu właśnie `IF NOT EXISTS` zapobiega).

### `docs/rebuild-backlog.md` (doc-checker)
10 edycji. Pola `Status` uzupełnione przy #99, #103 („Braki w cenniku"), #104, #106 — z informacją, które
tabele są już założone migracją `012`, a która warstwa logiki pozostaje otwarta. Pięć odsyłaczy do nieistniejącej
już karty `I15.4` rozbitych na `I15.4a`/`I15.4b`/`I15.4c`. Poprawiona **w miejscu** błędna liczba w #106:
było „migracja `012` rośnie o **piątą** tabelę", jest szósta z sześciu.
**Żadne pole `Do nowej wersji? ⬜` nie zostało zmienione** (zweryfikowane `git diff`em) — zgodnie z D-124.3.

### Pre-existing issues (odnotowane, NIE poprawiane — poza zakresem ticketa)
- `docs/cutover.md:17` — tabela §1 wymienia migracje 001–010, nie wspomina `011` ani `013`, choć oba istnieją.
  Dokument ma nagłówek 2026-09-08, a te migracje doszły później.
- `docs/cutover.md` §5 (krok 5) — lista checkpointów SQL kończy się na `010`; brak odpowiednika dla `011`,
  `012`, `013`. Wymaga szerszej rewizji rozdziału, osobnym ticketem.
- `docs/rebuild-backlog.md`, wpis **#108** — pole „Pliki" ma nieaktualny odsyłacz „(**I15.4** przejmuje
  nadpisanie)" po podziale karty. Poza listą wpisów zleconych w tym tickecie.
- `rebuild/backend/test/alerty-katalogu.gate.test.ts` — test z 20 000 id bywa flaky na timeoucie 20 s przy
  pełnym przebiegu; próg wart podniesienia osobnym ticketem.
