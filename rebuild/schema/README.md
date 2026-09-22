# Schemat bazy jako kod (Krok 2.5)

Kanoniczny, odtwarzalny schemat produkcyjnej bazy Bridge — źródło prawdy o strukturze
danych dla odbudowy backendu.

## Pliki

| Plik | Co |
|---|---|
| `001_schema.sql` | Kompletny schemat: 26 tabel + 13 indeksów, idempotentny (`IF NOT EXISTS`) |
| `002_import.sql` | Pierwsza migracja przyrostowa (Iteracja 3b): dokłada `suppliers.import_wylaczony` i `products.uwaga_cena`, ustawia wyłączenie MO6. Szczegóły: `docs/tickets/5-FEATURE-staging-endpointy-importu/plan.md` (D5, D9). |
| `003_szerokosc_text.sql` | Iteracja 3d-1: `products.szerokosc` REAL → TEXT (backlog #3, saga `szertxt`). Przebudowa tabeli, bo SQLite nie ma `ALTER COLUMN`. |
| `004_kategoria_wielka_litera.sql` | **Iteracja 13c:** historyczne `products.kategoria` z małej litery → forma kanoniczna (backlog #2 `kategoriafix` + #57 `katunify`). |
| `005_konstrukcja_slowa.sql` | **Iteracja 13c:** `products.konstrukcja` kody `R`/`D`/`L`/`B`/`-` → `Radialna`/`Diagonalna` (backlog #58). |
| `006_nazwa_caps.sql` | **Iteracja 13c:** `products.nazwa` → `UPPER`, `manual_overrides` pole `nazwa` → `UPPER`, skasowanie wierszy `staging_items` CASE_ONLY (backlog #59). |
| `007_waga_gab_przewoznicy.sql` | **Karta P9.1 (ticket 76):** nowa tabela `waga_gab_przewoznicy` — wspólna lista przewoźników wagi wolumetrycznej, spoza produkcji (backlog #27) — i **seed danych** (sześciu przewoźników Ani). Pierwsza migracja wstawiająca dane do nowej tabeli; trafiają do produkcji przez `npm run migrate` przy cutoverze. |
| `008_alerty_katalogu_statusy.sql` | **Karta P6.2** (`77-FEATURE-pseudo-alerty-katalogowe`): tabela `alerty_katalogu_statusy` (+ indeks na `klucz`) dla statusu pseudo-alertów katalogowych. ⚠ **Ta migracja NIE odtwarza stan produkcji** — produkcja tej tabeli nie ma (status żył w IndexedDB przeglądarki), to nowa funkcja odbudowy. Na cutoverze tworzy pustą tabelę = wszystkie pseudo-alerty katalogowe startują jako „nowy". |
| `009_alerty_polskie_znaki.sql` | **Karta PR.3** (`92-CHORE-migracja-typow-alertow`): migracja DANYCH `alerts` — polskie litery zamienione na „?" wracają (`B??d pobierania`→`Błąd pobierania`, `R?czny upload`→`Ręczny upload`, `B??d HTTP`→`Błąd HTTP`; w `opis` fragmenty szablonu `produkt?w`→`produktów`, `kluczowe/b??dy`→`kluczowe/błędy`). Na `db/snapshot.db`: 435 `typ` + 2219 `opis`. ⚠ **Świadome odstępstwo od produkcji** — tam „?" są wpisane w literały bundla i produkcja psuje każdy nowy alert aż do cutoveru; odbudowa pisze poprawnie. Test na kopii snapshotu: `SNAPSHOT_DB=… npx vitest run test/db.migracje.test.ts`. |
| `010_marka_caps.sql` | **Karta PR.5** (`101-CHORE-migracja-marka-caps`, backlog #92): migracja DANYCH `products.marka` — marka, która w katalogu ma drugą formę różniącą się WYŁĄCZNIE wielkością liter, przechodzi na formę WIELKIMI; ze słownika `marka` znika forma niekanoniczna, gdy kanoniczna już w nim jest. Klucz porównania sprowadza `ąćęłńóśźż` przed `UPPER()` (ASCII-only), inne litery spoza ASCII nie są sprowadzane (ograniczenie opisane w pliku). Na `db/snapshot.db`: 1 produkt (`MO1_71970103` `Alliance`→`ALLIANCE`, razem 849) + 1 wpis słownika. ⚠ **Świadome odstępstwo od produkcji** (decyzja użytkownika 2026-09-22). `historia_cen.marka` celowo nietknięta. |
| `011_blokowane_formy_i_triggery.sql` | **Karta I15.1** (`107-FEATURE-products-blokady-triggery`, backlog #73/#75/#79/#80/#82): kolumna `products.blokowane_formy_platnosci`, uzupełnienie jej dla istniejących wierszy (mapa MO1–MO10, MO6 celowo `NULL`) i sześć triggerów produkcji — blokady płatności po `dostawca`, kanoniczna kategoria i zamknięta lista zastosowań (`products`), kanoniczna kategoria w poprawkach ręcznych (`manual_overrides`). Treść triggerów to kopia bajt w bajt `git show 7d6cfc9:db/schema.sql:334-385`. Produkcja zakłada to samo przy każdym starcie (`payment_blocks.cjs`, `application_rules.cjs`), więc migracja jest **odporna na istniejące obiekty**: kolumna przez dyrektywę runnera (niżej), triggery `DROP IF EXISTS` + `CREATE`, uzupełnienie `WHERE … IS NOT`. Kategorii/zastosowań istniejących wierszy NIE normalizuje (produkcja przy starcie też nie; D2). Kolumna nie wychodzi w API do czasu I15.3. |
| `013_selly_products_warianty.sql` | **Karta I15.6** (`108-FEATURE-selly-rest-discovery-delta`, backlog #60): `selly_products` → model wariantowy. Stara tabela przemianowana na `selly_products_old` (zachowuje dane i indeks `idx_selly_products_kod`), nowa z kluczem `(kod_importu, dostawca)`, `selly_variant_id`, `feature_id_magazyn` i sześcioma indeksami — DDL verbatim z `origin/main:db/schema.sql`. Danych nie przenosi (Ania też nie). ⚠ **Na bazie produkcji pada** (oba obiekty już istnieją od 07.09) i wycofuje się w całości — przy cutoverze weryfikacja kształtu + ręczny wpis do `_migracje`, jak dla 002. (`011`, `012` zarezerwowane dla I15.1 i I15.4.) |

### Dyrektywy runnera (od ticketu 107)

SQLite nie ma `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, a runner wykonuje plik w jednej transakcji — gołe
`ALTER` na kolumnie, którą produkcja już ma, wycofałoby całą migrację. Dlatego plik może zawierać linię-komentarz

```sql
-- @dodaj-kolumne-jesli-brak <tabela> <kolumna> <definicja>
```

Runner (`rebuild/backend/src/db/migrate.ts`, `zastosujDyrektywy`) wykonuje dyrektywy PRZED treścią pliku, w tej samej
transakcji. Dla SQLite to zwykły komentarz, więc plik zostaje poprawnym SQL-em.

| Dyrektywa | Co robi | Gdzie użyta |
|---|---|---|
| `-- @dodaj-kolumne-jesli-brak <tabela> <kolumna> <definicja>` | `PRAGMA table_info` → `ALTER TABLE … ADD COLUMN` tylko przy braku kolumny | 002 (`uwaga_cena`), 011 (`blokowane_formy_platnosci`) |
| `-- @pomin-jesli-typ-kolumny <tabela> <kolumna> <typ>` | kolumna ma już ten typ → treść pliku i pozostałe dyrektywy NIE są wykonywane, migracja zostaje odnotowana jako zastosowana; brak kolumny = cel nieosiągnięty, treść się wykonuje | 003 (`szerokosc` już `TEXT`), 013 (`selly_products.selly_variant_id` = kształt wariantowy już jest) |

**Po co pominięcia (ticket 107, decyzja koordynatora 2026-09-22).** Produkcyjna `data.db` nie pochodzi z kanonu:
`products` ma tam 74 kolumny, `szerokosc` jest już `TEXT` (własna migracja `szertxt` Ani), a Selly przebudowane
ręcznie 07.09. Migracje 002, 003 i 013 padały na niej po kolei, więc `npm run migrate` na kopii produkcji wymagał
ręcznych kroków z `docs/cutover.md` §3. Z dyrektywami pełny łańcuch przechodzi sam — dowód:
`rebuild/backend/test/db.migracje-produkcja.test.ts` (baza stawiana z `git show 7d6cfc9:db/schema.sql`).

**Zmiana treści już zastosowanej migracji jest bezpieczna** — runner pomija pliki po NAZWIE (`_migracje`), więc bazy
dev/staging, które mają 002/003/013 odnotowane, nie zobaczą nowej treści. Dotyczy to wyłącznie baz, gdzie danej
migracji jeszcze nie ma — czyli produkcji.

Warunek pominięcia ma wskazywać KSZTAŁT CELU migracji (kolumnę, którą ona wprowadza), a nie poszlakę w rodzaju
nazwy tabeli — inaczej baza w nieznanym stanie zostałaby po cichu przepuszczona zamiast zatrzymać deploy.
Nieznana dyrektywa, zła składnia albo brak tabeli = błąd i wycofanie całej migracji. ⚠ Linia zaczynająca się od `-- @` jest ZAWSZE traktowana jako dyrektywa — nie zaczynaj tak komentarzy
opisowych. `npm run migrate` wypisuje osobno, które migracje odnotował bez wykonania treści.

## Skąd pochodzi

`sqlite3 data.db .schema` z produkcji (2026-08-17) → oczyszczony:
- dodane `IF NOT EXISTS` (idempotencja),
- usunięte `sqlite_sequence` (SQLite tworzy je sam przy `AUTOINCREMENT`),
- reszta **verbatim** z żywej bazy (łącznie z komentarzami w tabelach Selly).

## ⭐ Ten plik DOMYKA DRYF

W starym systemie część obiektów istniała tylko w produkcyjnej bazie, bo powstały
**ręcznie albo jednorazowymi skryptami**, a nie przez kod aplikacji (patrz
`docs/spec-backend.md §3`). Na czystej instalacji stary kod by się o nie wywrócił.
Tutaj **wszystko powstaje z kodu**:

- **Tabele wcześniej dryfujące:** `atrybuty_wartosci_pending`,
  `atrybuty_wartosci_odrzucone`, `selly_kategoria_norm_map`,
  `selly_zastosowanie_category_map`.
- **Kolumny `products` dopięte historycznie ALTER-em** (tu inline w `CREATE`):
  `link_zdjecia, oznaczenie_bieznika, sezon, ms, snow_3pmsf, wentyl, cfo,
  wysokosc_przesylki, zastosowanie, kod_importu, nieobecnosc_pod_rzad`.

## Weryfikacja (wykonana)

Świeża baza utworzona z `001_schema.sql` porównana ze snapshotem produkcji:

```
produkcja:  26 tabel, 13 indeksów, products 72 kolumny
z migracji: 26 tabel, 13 indeksów, products 72 kolumny
TABELE identyczne: True   KOLUMNY products: True   INDEKSY: 13=13
Tabele z różną definicją: BRAK — wszystkie identyczne ✅
```

Odtworzenie testu:
```bash
python3 - <<'EOF'
import sqlite3
c=sqlite3.connect(':memory:'); c.executescript(open('rebuild/schema/001_schema.sql').read())
print(len([r for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]),'tabel')
EOF
```

## Drizzle (odbudowa backendu)

`rebuild/backend/src/db/schema.ts` jest **wygenerowany** przez `npx drizzle-kit pull` z bazy
zbudowanej z `001_schema.sql` (26 tabel, 269 kolumn, 13 indeksów), z ręcznymi dopieszczeniami,
bo introspekcja nie jest wierna oryginałowi w kilku miejscach: `.unique()` na `users.email`
(nie przenosi ograniczeń inline), poprawka nazwy `snow3pmsf` i `{ mode: "boolean" }` na
10 kolumnach `products` (Iteracja 2, Decyzja D5 — bez tego API zwraca `0/1` zamiast `false/true`).
`001_schema.sql` jest źródłem prawdy i **zostaje nietknięty** przez te poprawki — typy kolumn
w bazie się nie zmieniają, zmienia się tylko mapowanie w Drizzle. Dokładna lista dopieszczeń
i procedura regeneracji: `rebuild/backend/README.md`, sekcja „Schemat Drizzle".

## Uwaga o migracjach przyrostowych

Produkcja dokłada kolumny idempotentną funkcją `bw()` (w bundlu) — np. sierpniowa
`nieobecnosc_pod_rzad`. W odbudowie odpowiednikiem są **numerowane migracje**
(`002_import.sql`, dalsze `003_*.sql`…). Od Iteracji 13c pliki `004`–`006` niosą także
**migracje DANYCH**, nie tylko struktury — odtwarzają jednorazowe skrypty i SQL, którymi
Ania ujednoliciła konwencje na produkcji (`mirror/backend/apply_kategoria.cjs`, wpisy
`CHANGELOG.md` z 2026-09-01 11:35 i 12:30). Numer pliku = kolejność chronologiczna produkcji —
**wyjątki: `007`** (karta P9.1, lista przewoźników) **i `008`** (karta P6.2, status
pseudo-alertów katalogowych) nie odtwarzają nic z produkcji, tylko dokładają tabele dla nowych
funkcji odbudowy (dane przeniesione z IndexedDB przeglądarki na serwer); ich numer mówi jedynie
o kolejności migracji w NASZYM repo. **`009`** (karta PR.3) też nie odtwarza produkcji — naprawia
dane, które produkcja psuje (polskie litery w alertach); **`010`** (karta PR.5) — duplikat marki
różniący się wielkością liter.

⚠ Migracja danych MUSI być idempotentna także TREŚCIOWO, nie tylko przez ewidencję
`_migracje`: cutover idzie na tej samej `data.db`, którą produkcja już zmigrowała, więc
pierwszy przebieg u nas trafia na dane już zmienione. Każda z `004`–`006`, `009` i `010` mapuje po kluczu
znormalizowanym i ma warunek „pomiń wiersz, który już ma formę docelową"; dowodzi tego
`rebuild/backend/test/db.migracje.test.ts`, wykonując ten sam SQL drugi raz z pominięciem
ewidencji i żądając zera zmienionych wierszy. Mechanizm już istnieje i jest w użyciu:
`npm run migrate` w `rebuild/backend` stosuje `rebuild/schema/*.sql` idempotentnie,
z ewidencją zastosowanych plików w tabeli `_migracje`. `001_schema.sql` to punkt zerowy =
stan produkcji na 2026-08-17; kolejne pliki dokładają kolumny, których zamrożony kontrakt
nie zna (patrz `rebuild/backend/src/repos/kolumny.ts`, D6).
