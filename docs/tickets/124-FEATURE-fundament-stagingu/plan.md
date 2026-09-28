# 124-FEATURE-fundament-stagingu — I15.4a: migracja 012, model Drizzle, repozytoria

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/124-fundament-stagingu`
> Worktree: `.worktrees/124-FEATURE-fundament-stagingu`
> Karta: `docs/karty/I15.4a/`

## Opis ticketa

I15.4a — **sam fundament** toru stagingu, bez zmiany zachowania importu, tak żeby dało się
zmergować i wdrożyć niezależnie od I15.4b (importer) i I15.4c (akceptacja + trasy):

1. migracja `012` (numer zarezerwowany) — 6 tabel + 2 indeksy, definicje **bajt w bajt**
   z `git show 88fa31c:db/schema.sql`, **idempotentna** (na produkcji wszystko już istnieje),
   ze **sprzątaniem duplikatów `staging_items`** przed indeksem unikalnym;
2. model Drizzle tych tabel w `rebuild/backend/src/db/schema.ts`;
3. repozytoria (odczyt + zapis), **bez logiki decyzyjnej**, z sygnaturami stabilnymi dla I15.4b/c.

Źródło prawdy: `origin/main` @ `88fa31c` (23.09 13:00), produkcja zamrożona.

## Kontekst

**Warunek startu spełniony** — PR #133 zmergowany do `develop` 23.09 13:23 (`42a63f9`).

**Stan `main`.** Po `88fa31c` są dwa commity: `4a26cb3` i `233524b` (14:00, 15:00). Oba dotykają
**wyłącznie** `mirror/frontend/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv` — to plik danych
(eksport Selly), nie kod, i `db/schema.sql` się nie zmienił. Zamrożenie kodu obowiązuje, `88fa31c`
zostaje źródłem prawdy. Zweryfikowane `git show --stat`.

**Co robi oryginał.** `88fa31c:mirror/backend/staging_policy.cjs:86-107` zakłada te tabele
**runtime'owo, przy każdym starcie**, przez `CREATE TABLE IF NOT EXISTS` — plus warunkowy
`ALTER TABLE staging_absence_decisions ADD COLUMN selected_source_code TEXT` pod `PRAGMA table_info`
i `CREATE UNIQUE INDEX IF NOT EXISTS staging_absence_one_choice`. Czyli **produkcja sama jest
idempotentna dokładnie tym wzorcem**, który ma odtworzyć migracja `012`. Nowy stos nie ma kodu
startowego zakładającego tabele — bez tej migracji nie powstałyby wcale.

**Runner migracji** (`rebuild/backend/src/db/migrate.ts:149-178`) wykonuje **cały plik jednym
`sqlite.exec(sql)`** w jednej transakcji, po uprzednim zastosowaniu dyrektyw `-- @…`. Wniosek
wiążący dla `012`: gołe `CREATE TABLE` na istniejącej tabeli wywróciłoby **całą** migrację
(`table … already exists`), a `IF NOT EXISTS` jest natywnym mechanizmem SQLite dla
`CREATE TABLE`/`CREATE INDEX`/`CREATE UNIQUE INDEX` — **nowa dyrektywa runnera nie jest potrzebna**
i `migrate.ts` NIE jest ruszany. Dyrektywy z `011` (`@dodaj-kolumne-jesli-brak`) i `013`
(`@pomin-jesli-typ-kolumny`) istnieją tylko dla DDL, który w SQLite nie ma własnego `IF NOT EXISTS`.

**`selected_source_code`.** Na produkcji kolumna **jest** — zrzut `88fa31c:db/schema.sql:340-346`
pokazuje ją wewnątrz `CREATE TABLE staging_absence_decisions` (dopisana przez `ALTER`, dlatego
siedzi w jednej linii z `decided_at`). Dlatego `012` zawiera ją wprost w `CREATE TABLE IF NOT EXISTS`
i **nie potrzebuje dyrektywy** `@dodaj-kolumne-jesli-brak` — ta zresztą by nie zadziałała, bo runner
stosuje dyrektywy PRZED treścią pliku, a `kolumnyTabeli()` rzuca wyjątek, gdy tabeli nie ma
(`migrate.ts:73-75`) — czyli wywróciłaby migrację na świeżej bazie.

**Pomiar sprzątania duplikatów** (kopia `db/snapshot.db`, node + better-sqlite3, nigdy na oryginale):
`staging_items` = **3362 wiersze → 3124 po sprzątaniu, znika 238**. Snapshot (13.08) nie ma żadnej
z 6 nowych tabel ani indeksu `staging_one_current_product`. Na produkcji indeks unikalny już istnieje
od 22.09, więc tam sprzątanie jest **no-opem** (duplikaty są niemożliwe).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Brak — ticket nie dotyka kontraktu.** Uzasadnienie: karta obejmuje wyłącznie schemat bazy, model
Drizzle i repozytoria. Żadna z 6 tabel nie ma tras HTTP ani w `contract/openapi.yaml`, ani w
`contract/fixtures/` — trasy stagingu (`GET /api/staging/{id}/review`, `POST /api/staging/{id}/resolve`)
wnosi dopiero I15.4c, a zachowanie importu I15.4b. Żaden istniejący endpoint nie zmienia kształtu:
migracja tylko **dokłada** obiekty, nie rusza `products`, `staging_items` (poza usunięciem duplikatów)
ani żadnej kolumny czytanej przez obecne trasy.

GATE dla tej karty = **testy migracji na trzech bazach** (niżej), nie fixtures.

⚠ Pułapka z CLAUDE.md, która tu NIE gryzie: `select()` bez jawnej listy pól oddaje camelCase.
Repozytoria tych 6 tabel nie zasilają żadnej odpowiedzi HTTP, więc camelCase modelu jest w porządku;
gdy I15.4c wystawi z nich trasę, to ONA odpowiada za jawną projekcję pod fixture. Zapisane
w „Do koordynatora".

## Decyzje

**D-124.1 — repozytoria wystawiają upserty 1:1 z oryginału** (decyzja użytkownika, wariant rekomendowany).
Każda funkcja odtwarza dokładnie jedno zapytanie ze `staging_policy.cjs`, **łącznie z klauzulą
`ON CONFLICT`**. Powód: klauzule konfliktu to mechaniczny fakt oryginału, nie decyzja biznesowa —
a `max_item_count=MAX(supplier_feed_state.max_item_count, excluded.max_item_count)` i cztery różne
warianty `ON CONFLICT` musiałyby inaczej powstać w I15.4b/c, czyli skończyłoby się edycją mojego
pliku — dokładnie tym, czego karta zakazuje. Kontra (przyjęta): I15.4a musi przeczytać wszystkie
wywołania z oryginału, co i tak jest konieczne do zaprojektowania sygnatur.

**D-124.2 — jeden plik `rebuild/backend/src/repos/staging-polityka.ts`** (decyzja użytkownika).
Odpowiednik jednego `staging_policy.cjs` w oryginale. Powód: jedna wyłączna własność, zero ryzyka
konfliktu merge z I15.4b/c, jeden import po ich stronie. Kontra: plik rzędu 300–400 linii.

**D-124.3 — fundament schematu robimy mimo `⬜ do decyzji` w backlogu** (decyzja użytkownika).
W `docs/rebuild-backlog.md` tylko **#99** ma `✅ TAK`; **#103 („Braki w cenniku"), #104, #105, #106, #107**
mają `⬜ do decyzji`. CLAUDE.md zakazuje nanoszenia `⬜`. Rozstrzygnięcie: prompt karty jest decyzją
użytkownika **dla zakresu schematu** — te tabele fizycznie istnieją na produkcji od 22–23.09, więc
migracja tylko doprowadza rebuild do stanu produkcji i **nie wnosi żadnego nowego zachowania**.
Statusy `⬜` w backlogu **zostają nietknięte**; do „Do koordynatora" trafia notka, że LOGIKA
z #103/#104/#106 (karty I15.4b/I15.4c) wciąż czeka na formalne `✅`.

**D-124.4 — pomiar z backlogu #107 przypisany do I15.4c** (decyzja użytkownika). Backlog zleca
„zmierzyć zatwierdzanie zbiorcze na kopii produkcji" karcie **I15.4** — sprzed podziału. Zatwierdzanie
zbiorcze jest zakresem I15.4c, a I15.4a nie dotyka akceptacji, więc nie ma czego mierzyć.
Zakładam `docs/karty/I15.4c/wejscie-124.md` z zadaniem i dowodem przypisania.

### Świadome odstępstwa od oryginału

**O-1 — `CREATE TABLE` → `CREATE TABLE IF NOT EXISTS`** (i tak samo dla obu indeksów). Zrzut
`88fa31c:db/schema.sql` ma gołe `CREATE TABLE`, bo to `.schema` żywej bazy. Ale KOD produkcji
(`staging_policy.cjs:86-107`) używa dokładnie `IF NOT EXISTS` — więc to **nie jest** odstępstwo od
zachowania oryginału, tylko wierne odtworzenie go w formie migracji. Treść kolumn, typy, `NOT NULL`,
`DEFAULT` i klucze główne zostają bajt w bajt.

**O-2 — sprzątanie duplikatów `staging_items` zmienia dane** na bazach, które ich nie miały sprzątanych
(snapshot: −238 wierszy). To decyzja D5 iteracji 15, zapisana w karcie; na produkcji no-op. Oryginał
zrobił to jednorazowym skryptem `staging_reconcile_20260922.cjs` (D5: skryptu nie przenosimy) —
u nas ta sama operacja musi być częścią migracji, bo inaczej `CREATE UNIQUE INDEX` wywróciłby się
na constraint violation.

## Plan implementacji

### Krok 1 — migracja `rebuild/schema/012_staging_polityka.sql`
Kolejność w pliku jest istotna:
1. nagłówek-komentarz w stylu `011`: skąd się to bierze (`staging_policy.cjs:86-107`), dlaczego
   `IF NOT EXISTS`, dlaczego sprzątanie przed indeksem, co mówi pomiar na snapshocie;
2. `CREATE TABLE IF NOT EXISTS staging_matches(...)` — bajt w bajt z `88fa31c:db/schema.sql:332`;
3. **`DELETE FROM staging_items WHERE id NOT IN (SELECT MAX(id) FROM staging_items GROUP BY dostawca, kod)`**;
4. `CREATE UNIQUE INDEX IF NOT EXISTS staging_one_current_product ON staging_items(dostawca,kod)` (:333);
5. `supplier_feed_state` (:334), `supplier_feed_versions` (:335), `product_absence_checks` (:336),
   `product_auto_suspensions` (:337-339), `staging_absence_decisions` (:340-346) — wszystkie `IF NOT EXISTS`,
   `staging_absence_decisions` **z kolumną `selected_source_code` wprost w `CREATE`**;
6. `CREATE UNIQUE INDEX IF NOT EXISTS staging_absence_one_choice ON staging_absence_decisions(supplier,selected_source_code) WHERE selected_source_code IS NOT NULL` (:347).

Bez dyrektyw runnera. `migrate.ts` nietykany.

### Krok 2 — model Drizzle (`rebuild/backend/src/db/schema.ts`)
Dokładam 6 tabel w stylu pliku (`sqliteTable`, camelCase pól ↔ snake_case kolumn, `primaryKey()`
dla kluczy złożonych, `uniqueIndex().where()` dla indeksu częściowego). Komentarz „dopieszczenie
(migracja 012, ticket 124): tabela spoza kanonu 001" przy każdej — tak jak przy `waga_gab_przewoznicy`
(`schema.ts:287`). Nazwy eksportów: `stagingMatches`, `supplierFeedState`, `supplierFeedVersions`,
`productAbsenceChecks`, `productAutoSuspensions`, `stagingAbsenceDecisions`.
**Nie ruszam** żadnej istniejącej tabeli — w szczególności `stagingItems` (I15.4b/c ich potrzebują).

### Krok 3 — repozytorium `rebuild/backend/src/repos/staging-polityka.ts`
Wzorzec 1:1 z `repos/staging.ts`: `db: Baza` pierwszym parametrem każdej funkcji, typy
`typeof tabela.$inferSelect` / `$inferInsert`, komentarz z odsyłaczem `staging_policy.cjs:<linia>`
przy każdej funkcji. Zaprojektowane sygnatury (pokrywają **wszystkie** zapytania oryginału na tych
6 tabelach; dokładne `.get()` vs `.all()` potwierdzam przy implementacji przy każdym wywołaniu):

**`staging_matches`** — `dopasowaniaStagingu(db, dostawca, sourceKey)` (:137),
`zapiszDopasowanieStagingu(db, dostawca, sourceKey, kodProduktu, utworzono)` — upsert
`ON CONFLICT(supplier,source_key) DO UPDATE SET product_code, created_at` (:224, :305).

**`supplier_feed_state`** — `stanOfertyDostawcy(db, dostawca)` (:455),
`zapiszStanOfertyDostawcy(db, wpis)` — upsert z `max_item_count=MAX(…)` (:522-524).

**`supplier_feed_versions`** — `czyZnanaWersjaOferty(db, dostawca, odcisk)` (:463),
`zapiszWersjeOferty(db, dostawca, odcisk, policzono)` — **goły `INSERT`**, bez `ON CONFLICT`,
wiernie (:526); oryginał woła go tylko, gdy wersja jest nowa.

**`product_absence_checks`** — `dowodyNieobecnosci(db, dostawca, kodProduktu)` (:598),
`zapiszDowodyNieobecnosci(db, …, checksJson)` — upsert (:602),
`usunDowodyNieobecnosci(db, dostawca, kodProduktu)` (:467).

**`product_auto_suspensions`** — `czyAutomatycznieWstrzymany(db, dostawca, kodProduktu)` (:111, :468),
`zapiszAutomatyczneWstrzymanie(db, dostawca, kodProduktu, wstrzymanoO, odcisk, powod)` — upsert
`DO UPDATE SET source_fingerprint, reason` **bez dotykania `suspended_at`** (:122-124 — wierny szczegół:
data pierwszego wstrzymania się nie przesuwa), `usunAutomatyczneWstrzymanie(db, dostawca, kodProduktu)`
(:116, :218, :302, :318, :469).

**`staging_absence_decisions`** — trzy **różne** upserty oryginału dostają trzy nazwane funkcje,
bo różnią się traktowaniem `selected_source_code`:
`zamknijSpraweNieobecnej(db, …, hashKandydatow, decyzjaZ)` — kolumny `selected_source_code` NIE dotyka (:261-263),
`zapiszWyborKartyZrodlowej(db, …, wybranyKodZrodlowy)` — ustawia z `excluded` (:308-311),
`zapiszWyborBiezacejKarty(db, …)` — ustawia `NULL` (:322-325);
do tego `decyzjaONieobecnej(db, dostawca, kodProduktu)` (:544, :567),
`kodProduktuDlaWybranegoZrodla(db, dostawca, wybranyKodZrodlowy)` (:358),
`usunDecyzjeONieobecnej(db, dostawca, kodProduktu)` (:550).

**Bez logiki decyzyjnej** — żadna funkcja nie rozstrzyga „czy wstrzymać", „czy wycofać", „czy oferta
kompletna". To wnoszą I15.4b i I15.4c.

### Krok 4 — testy migracji (moja wyłączna własność)
Pliki `rebuild/backend/test/db.migracje.test.ts`, `db.migracje-produkcja.test.ts` oraz nowy
`db.migracja-012.test.ts`; nowy fixture `test/schemat-produkcji/88fa31c-schema.sql`
(= `git show 88fa31c:db/schema.sql` bajt w bajt, jak istniejący `7d6cfc9-schema.sql`).

⚠ **Dwa istniejące testy pękną i MUSZĄ zostać zaktualizowane** — to nie regresja, tylko skutek
dołożenia migracji:
* `db.migracje.test.ts:40-53` — lista plików migracji nie zawiera `012`;
* `db.migracje-produkcja.test.ts`, asercja „dokłada tylko to, czego produkcja nie ma" — lista nowych
  obiektów urośnie o 6 tabel i 2 indeksy (bo fixture `7d6cfc9` jest sprzed powstania tych tabel).

## Strategia testów — GATE na TRZECH bazach

1. **Baza świeża** (kanon 001 → … → 013): `012` tworzy dokładnie 6 tabel + 2 indeksy; `PRAGMA table_info`
   każdej tabeli zgadza się z `88fa31c:db/schema.sql` co do nazw, typów, `notnull`, `dflt_value` i `pk`;
   indeks częściowy ma `WHERE selected_source_code IS NOT NULL` (sprawdzane po `sqlite_master.sql`);
   drugie uruchomienie runnera nie zmienia niczego.
2. **Kopia `db/snapshot.db`** (przez `SNAPSHOT_DB=…`, wzorzec `it.skipIf(!process.env.SNAPSHOT_DB)`
   z istniejących testów — plik nie jest wersjonowany): przed migracją 3362 wiersze `staging_items`
   i 238 duplikatów `(dostawca, kod)`; po migracji **3124 wiersze, zero duplikatów**, a dla każdej pary
   zostaje wiersz o `MAX(id)`; indeks unikalny powstaje i jest egzekwowany.
3. **Baza symulująca produkcję** — fixture `88fa31c-schema.sql`, gdzie **wszystkie 6 tabel i oba indeksy
   już są**: cały łańcuch migracji przechodzi bez błędu, `012` jest odnotowana, a `sqlite_master`
   (poza `_migracje`) jest **identyczny przed i po** — czyli cutover to no-op. Do tego wariant
   z danymi w tych tabelach: wiersze zostają nietknięte.

Dodatkowo test repozytoriów (`rebuild/backend/test/repos.staging-polityka.test.ts`) na realnej bazie
w katalogu tymczasowym — **bez mocków bazy**: każdy upsert wołany dwa razy, sprawdzamy, że drugie
wywołanie aktualizuje właściwe kolumny i nie dubluje wiersza; osobno że `zapiszAutomatyczneWstrzymanie`
**nie przesuwa `suspended_at`**; osobno że `staging_absence_one_choice` przepuszcza wiele wierszy
z `selected_source_code IS NULL`, a blokuje powtórzony niepusty kod.

Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/` (Node ≥ 20).

## Poza zakresem

- `rebuild/backend/src/import/tk.ts` i zachowanie importu → **I15.4b**;
- akceptacja (`checkAcceptance`), trasy `review`/`resolve`, `contract/openapi.yaml` → **I15.4c**;
- `legacy/**` i część parserowa → **I15.2**; Selly (`availability_sync`) → **I15.10**;
- `rebuild/backend/src/db/migrate.ts` — **nietykany**, `012` nie potrzebuje nowej dyrektywy;
- `docs/rebuild-roadmap.md` — reguła 0 z CLAUDE.md, roadmapę zmienia wyłącznie koordynator;
- statusy `⬜` w `docs/rebuild-backlog.md` przy #103/#104/#105/#106/#107 — zostają (D-124.3);
- pomiar z #107 — przekazany do I15.4c przez `wejscie-124.md` (D-124.4).

## Definition of done

- [ ] `rebuild/schema/012_staging_polityka.sql` — 6 tabel + 2 indeksy bajt w bajt z `88fa31c:db/schema.sql`, `IF NOT EXISTS`, sprzątanie duplikatów PRZED indeksem unikalnym
- [ ] Migracja idempotentna — udowodnione testem na świeżej bazie, kopii `snapshot.db` i bazie symulującej produkcję (`88fa31c-schema.sql`)
- [ ] Na bazie produkcji `sqlite_master` identyczny przed i po (cutover = no-op), dane w 6 tabelach nietknięte
- [ ] Pomiar sprzątania duplikatów zapisany w `docs/karty/I15.4a/karta.md` (3362 → 3124, −238)
- [ ] 6 tabel w `rebuild/backend/src/db/schema.ts`, żadna istniejąca nieruszona
- [ ] `repos/staging-polityka.ts` — komplet operacji pokrywający wszystkie zapytania oryginału na tych tabelach, bez logiki decyzyjnej
- [ ] Testy repozytoriów na realnej bazie (bez mocków), w tym `suspended_at` niezmieniane przy upsercie i zachowanie indeksu częściowego
- [ ] `db.migracje.test.ts` i `db.migracje-produkcja.test.ts` zaktualizowane o `012`
- [ ] Nazwy i sygnatury repozytoriów oraz zachowanie migracji przy cutoverze opisane w „Do koordynatora" w `docs/karty/I15.4a/karta.md`
- [ ] `docs/karty/I15.4c/wejscie-124.md` z pomiarem #107
- [ ] lint, typecheck, build, test — zielone
