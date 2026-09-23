# I15.1 — schemat `products`: kolumna blokowanych form płatności + triggery kategorii i zastosowań

> **Stan:** ✅ 2026-09-23 · 107-FEATURE-products-blokady-triggery
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #73, #75, #79, #80, #82 · **Zależy od:** —
> **Ticket:** 107-FEATURE-products-blokady-triggery

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Przeniesienie do `rebuild/schema/` stanu, który produkcja zakłada w bazie **przy każdym starcie procesu**
(`mirror/backend/extensions.cjs` na `origin/main`: `paymentBlocks.ensurePaymentBlocks()` i
`applicationRules.ensureApplicationRules()` — „idempotentnie dopina kolumnę, uzupełnia istniejące rekordy
i zakłada triggery”):
- kolumna `products.blokowane_formy_platnosci` + wartości dla istniejących rekordów (#73);
- 6 triggerów z produkcyjnego `db/schema.sql` (`git show origin/main:db/schema.sql`):
  `products_blokowane_formy_ai/_au` (#73), `products_zastosowanie_ai/_au` (#75, stan końcowy z #79/#80/#82),
  `manual_overrides_kategoria_ai/_au` (#79);
- model Drizzle (`rebuild/backend/src/db/schema.ts`) zna nową kolumnę.

⚠ **PUŁAPKA — idempotencja na produkcji.** Na produkcji kolumna i triggery JUŻ istnieją (zakłada je runtime).
`ALTER TABLE … ADD COLUMN` w SQLite nie ma `IF NOT EXISTS`, a runner (`db/migrate.ts`) wykonuje plik `.sql`
w transakcji — migracja wywróciłaby cutover. Rozwiązanie wybiera karta (np. triggery `CREATE TRIGGER IF NOT
EXISTS`, a kolumna — mechanizm odporny na jej obecność); musi przejść na TRZECH bazach: świeżej, kopii
`db/snapshot.db` (bez kolumny) i bazie symulującej produkcję (kolumna + triggery już są). Opisz wybór i dopisz
wejście dla koordynatora (cutover).
⚠ Triggery kopiuj **dosłownie** (także `UPPER()`/`LOWER()` ASCII-only — CLAUDE.md). Ich treść to reguły biznesowe
Ani (lista zastosowań per kategoria, blokady per dostawca) — nie upraszczaj.
⚠ Uzupełnienie istniejących rekordów to **efekt runtime'u produkcji przy każdym starcie — TYLKO dla blokad
płatności** (`ensurePaymentBlocks()` robi `UPDATE` całej tabeli). `ensureApplicationRules()` (kategoria/zastosowanie)
produkcja woła **bez backfillu** — istniejących wierszy nie rusza, tylko zakłada triggery na przyszłość; nie
odtwarzaj backfillu kategorii/zastosowań, to jednorazowe skrypty z września (#79/#82) poza zakresem (D2), razem z
`normalize_widths_selly_20260918.cjs` i #83.
⚠ **Kształt API się NIE zmienia w tej karcie.** Jeśli dodanie pola do modelu zmienia odpowiedź `GET /api/products`
(Drizzle `select()` bez projekcji oddaje wszystkie pola modelu — CLAUDE.md), zablokuj to jawnie; wystawienie pola
w API należy do I15.3. Triggery zmienią zapisy kategorii/zastosowań — puść WSZYSTKIE bramki BE i popraw testy,
które zamrażały stan sprzed triggerów (świadomie, z odnośnikiem do wpisu).

## Pliki (wyłączna własność)
`rebuild/schema/011_*.sql` (numer **przydzielony przez koordynatora**), README migracji, `rebuild/backend/src/db/schema.ts`
(tylko tabela `products`), testy migracji. NIE: parsery (I15.2), API/katalog/CSV (I15.3), staging (I15.4), Selly (I15.6).

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

Numer migracji `011` zarezerwowany. Druga migracja → „Do koordynatora”, nie bierz kolejnego numeru sam.

## Dowiezione
Ticket `107-FEATURE-products-blokady-triggery`, implementacja zamknięta 2026-09-22 — karta NIE jest jeszcze
zamknięta (patrz „Zostało przed PR” niżej, scenariusz A).

- **Runner** (`src/db/migrate.ts`): `zastosujDyrektywy()` — linia `-- @dodaj-kolumne-jesli-brak <tabela> <kolumna>
  <definicja>` wykonywana przed treścią pliku, w tej samej transakcji (`PRAGMA table_info` → `ALTER` tylko przy
  braku kolumny). Nieznana dyrektywa / zła składnia / brak tabeli = błąd i rollback całej migracji.
- **Migracja `011_blokowane_formy_i_triggery.sql`**: kolumna przez dyrektywę; backfill `UPDATE … WHERE … IS NOT
  <CASE>` — TYLKO `blokowane_formy_platnosci` (jak `ensurePaymentBlocks()`; #101 wciąż niewyjaśnione, patrz
  `wejscie-104.md`); 6 triggerów `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` bajt w bajt z
  `7d6cfc9:db/schema.sql:334-385` (zweryfikowane niezależnym `diff`em w review). Kategorii/zastosowań istniejących
  wierszy migracja nie rusza (zgodnie z poprawką w „Zakres” wyżej).
- **Model/kontrakt**: `products.blokowaneFormyPlatnosci` w `schema.ts`; ukryte w `KOLUMNY_POZA_KONTRAKTEM.products`
  (`src/repos/kolumny.ts`) jako stan przejściowy do I15.3; typ `Produkt` (`src/repos/products.ts`) liczony z listy
  wykluczeń zamiast twardego stringa `"uwagaCena"`.
- **Testy**: `test/db.migracja-011.test.ts` (osobny plik, nie blok w `db.migracje.test.ts` — plik już miał 757
  linii) — dyrektywa (6 przypadków), 011 na trzech bazach (świeża / symulacja produkcji z „przestarzałym” triggerem
  / kopia `db/snapshot.db`), zachowanie wszystkich triggerów (ASCII-only `LEŚNE`, MO6, łańcuch zastosowań).
  `test/katalog.gate.test.ts`, `test/produkty.mutacje.test.ts` — strażniki: pole nie wychodzi przez GET/PATCH,
  PATCH go nie zapisuje. Świadome poprawki 4 plików testów zamrażających stan sprzed triggerów, każda z
  odnośnikiem: `test/atrybuty.pending.test.ts`, `test/atrybuty.niezmiennik.test.ts` (wartości `zastosowanie`
  przeniesione na zamkniętą listę kategorii `Rolnicze`), `test/selly.synchronizacja.test.ts` (łańcuch przeniesiony
  na kategorię spoza czterech kanonicznych + nowy test „w kategorii kanonicznej brak `multi_cat`”),
  `test/silnik.charakteryzacja.test.ts` (triggery świadomie zdjęte w bazie tego testu — wzorzec nagrany z `tk()` na
  atrapach JS bez SQLite). Bramki BE: lint/typecheck/build/test zielone (93 pliki, 1549 passed, 3 skipped).
- **Decyzje techniczne T1–T4** (`plan.md`): T1 dyrektywa runnera zamiast dzielenia pliku po `;` (triggery mają `;`
  w `BEGIN…END`) albo ręcznego kroku cutoveru; T2 `DROP TRIGGER IF EXISTS` + `CREATE` zamiast `IF NOT EXISTS` (żeby
  definicja była zawsze ta z 011, nawet na bazie ze starszą wersją triggera); T3 backfill tylko blokad płatności;
  T4 `blokowaneFormyPlatnosci` do `KOLUMNY_POZA_KONTRAKTEM` + typ `Produkt` z listy wykluczeń.
- **Odstępstwo od planu**: testy 011 w osobnym pliku zamiast bloku w `db.migracje.test.ts` (rozmiar pliku); poza
  tym plan zrealizowany jak zapisano.
- **Wejście `wejscie-104.md` (#101)** — rozliczone jako trop, nie jako naprawa: hipoteza MO6 (dostawca celowo bez
  mapowania, CHANGELOG produkcji 2026-09-10 14:53 „nie będzie na razie w sprzedaży”) prawdopodobna, ale pomiar na
  prawdziwej kopii produkcji jeszcze nie wykonany — patrz „Zostało przed PR”.

### Próba na kopii produkcji — WYKONANA (ticket 113, 2026-09-23; `wejscie-113.md`)
Lista „Zostało przed PR (scenariusz A)” jest wyczerpana; sekcja zdjęta, liczby przepisane tutaj.
Kopia `.backup` żywej `data.db` (8329 produktów, `integrity_check = ok`, bez `_migracje`), migracje z gałęzi
`feature/107-products-blokady-triggery` (`3eabfee`), build i binarka `better-sqlite3` z VPS:
- `npm run migrate` zastosował **12 migracji, 0 błędów**; linia „bez treści (warunek dyrektywy)” pokazała
  **dokładnie `003` i `013`** — tak, jak przewiduje punkt kontrolny niżej;
- po migracji: triggery **6**, blokady puste (znani dostawcy) **0**, blokady puste MO6 **0**,
  `zastosowanie` z łańcuchem ` ; ` **0**, alerty z „?” **0**, `marka='Alliance'` **0**, przewoźnicy **6**;
- **#101 zmierzone na ŻYWEJ produkcji (tylko odczyt):** 0 produktów z pustym `blokowane_formy_platnosci`
  w każdej grupie dostawcy, 6 triggerów. Zgłoszenie Ani NIE dotyczy bazy Bridge — zostaje hipoteza „puste pole
  po stronie Selly” (karty I15.6/I15.7). Wejście `wejscie-104.md` (#101) tym samym rozliczone.
- **Pomiar łańcuchów zastosowań = 0** potwierdza, że spłaszczanie `a ; b` do „Uniwersalne/pozostałe” dzieje się
  na produkcji od razu przy zapisie (nie ma ani jednego wiersza z łańcuchem) — wpis backlogu opisany niżej
  zostaje aktualny jako pytanie do Ani, nie jako rozjazd odbudowy.

## Do koordynatora
**⚠ PILNE przed odświeżeniem stagingu kopią produkcji (D2, od 23.09) — kopia NIE przejdzie samym `npm run migrate`.**
Ustalone w tickecie 107 (2026-09-22) z `git show 7d6cfc9:db/schema.sql:297`: produkcyjne `products` ma **74 kolumny**
(72 z kanonu + `uwaga_cena` + `blokowane_formy_platnosci`), `szerokosc` już `TEXT`, brak `_migracje`. Skutek dla
łańcucha migracji na kopii produkcji:
- `002_import.sql` — `ALTER TABLE products ADD COLUMN uwaga_cena` → `duplicate column name`, cała 002 się wycofuje
  (znane: `docs/cutover.md` §3 (a));
- `003_szerokosc_text.sql` — `INSERT INTO products_szertxt SELECT * FROM products` do tabeli 73-kolumnowej →
  **pada deterministycznie** („73 columns but 74 values”). `docs/cutover.md` §3 (b) traktuje to jako możliwość
  („Jeśli padło na 003 — STOP”) — dziś to pewnik, bo doszła `blokowane_formy_platnosci`. Cel 003 (TEXT) produkcja
  ma już osiągnięty.
- `011` (ta karta) — odporna na istniejącą kolumnę i triggery, więc po przejściu 002/003 przechodzi.
Prośba użytkownika (2026-09-22): **zanim zrobimy kopię produkcji na staging, plan ma zawierać sposób, żeby ta kopia
dała się zmigrować na nową wersję** — albo przez uodpornienie 002/003 (np. dyrektywą runnera wprowadzoną w 011,
patrz niżej), albo przez sprawdzoną procedurę ręczną z `docs/cutover.md`. To ta sama ścieżka, którą pójdzie cutover —
odświeżenie stagingu jest jego próbą generalną. Pliki 002/003 są poza własnością tej karty — decyzja i przydział do
koordynatora.

**Jak `011` zachowuje się na kopii produkcji (do `docs/cutover.md`)** — ustalone w tickecie 107, do wpisania przez
koordynatora po tym, jak 002/003 przepuszczą migrację (patrz wyżej):
- kolumna: dyrektywa `@dodaj-kolumne-jesli-brak` widzi kolumnę już obecną → pomija `ALTER`, brak błędu;
- backfill blokad płatności: `UPDATE … WHERE … IS NOT <CASE>` na już poprawnych wartościach → 0 zmienionych wierszy
  (produkcja uzupełnia je sama przy każdym starcie procesu);
- triggery: `DROP TRIGGER IF EXISTS` + `CREATE` → definicje identyczne z tym, co runtime produkcji i tak zakłada
  przy starcie; kategorii/zastosowań istniejących wierszy `011` nie rusza;
- `011` idzie PO 002/003 w kolejności runnera, więc wymaga, żeby te dwie przeszły procedurę wyżej najpierw;
- rollback wariant B (stary Bridge na zmigrowanej bazie) jest bezpieczny: `ensurePaymentBlocks()` /
  `ensureApplicationRules()` zobaczą kolumnę i triggery już obecne i podmienią je na identyczne (te same
  `DROP IF EXISTS` + `CREATE` po stronie oryginału).
- Punkt kontrolny po migracji: `SELECT name FROM sqlite_master WHERE type='trigger'` → dokładnie 6 nazw
  (`products_blokowane_formy_ai/_au`, `products_zastosowanie_ai/_au`, `manual_overrides_kategoria_ai/_au`);
  `SELECT count(*) FROM products WHERE blokowane_formy_platnosci IS NULL AND UPPER(TRIM(dostawca)) NOT IN ('MO6')`
  → oczekiwane `0` dla znanych dostawców `MO1`…`MO10` (dostawca spoza mapy też daje `NULL` celowo — sprawdzać tylko
  wśród znanych kodów).

Dodatkowo: dyrektywa runnera z `011` (`@dodaj-kolumne-jesli-brak`) mogłaby w przyszłości uodpornić `002` na kopii
produkcji (ten sam mechanizm zamiast gołego `ALTER`) — to decyzja koordynatora, bo dotyczy zmiany treści migracji
już zastosowanej na bazach, które mają ją w `_migracje` (czyli dotyczy tylko baz, gdzie `002` jeszcze nie
przeszła — czyli właśnie kopii produkcji).

**Nowy wpis backlogu do nadania numeru (ticket 107 nie bierze numeru sam — równolegle pisze I15.6):**
„Trigger zastosowań (`products_zastosowanie_ai/_au`, bajt w bajt z produkcji) zna tylko POJEDYNCZE wartości z zamkniętej
listy (+ warianty Forwarder/Harwester) — łańcuch `a ; b`, który produkuje JS `normalizeApplication()`, w kategorii
kanonicznej (Rolnicze/Przemysłowe/Ciężarowe/Leśne) spada do „Uniwersalne/pozostałe”; w kategorii niekanonicznej
przechodzi bez zmian. Defekt produkcji odtworzony 1:1 w 011. Skutek dla Selly: `multi_cat` praktycznie tylko dla
kategorii niekanonicznych. Status: do pomiaru na kopii produkcji (ile wierszy ma ` ; `), potem pytanie do Ani:
zostawić czy naprawić (świadome odstępstwo).” Źródło: `docs/tickets/107-FEATURE-products-blokady-triggery/raport.md`.

**⏸ Prośba użytkownika (2026-09-22): plan kopiowania bazy produkcyjnej na staging ma zawierać krok „wróć do I15.1”.**
PR #122 (ticket 107) jest otwarty, ale czeka na próbę `npm run migrate` na tej kopii + pomiary z sekcji „Zostało przed
PR”. Koordynator: przy planowaniu kopii dopisz ten krok (po rozstrzygnięciu 002/003, przed mergem #122).

### Co znika z ręcznej procedury `docs/cutover.md` §3 (po rozszerzeniu zakresu, decyzja koordynatora 2026-09-22)
Ticket 107 uodpornił łańcuch migracji na kształt produkcji, więc z §3 i z kroku 5 rozdziału 5 **można usunąć całą
ręczną obsługę kolizji**:
- „Jeśli padło na `duplicate column name: uwaga_cena`” + `INSERT OR IGNORE INTO _migracje ('002_import.sql')`
  + ręczny `ALTER TABLE suppliers ADD COLUMN import_wylaczony` + `UPDATE suppliers … MO6` — **niepotrzebne**:
  002 dokłada `uwaga_cena` dyrektywą tylko przy braku, a `import_wylaczony` (której produkcja nie ma) zakłada sama.
- „Jeśli padło na 003 (niezgodna liczba kolumn) — STOP, nie przełączamy” — **nie wystąpi**: 003 wykrywa, że
  `szerokosc` jest już TEXT, i odnotowuje się bez wykonania treści.
- Ręczne odnotowanie 013 w `_migracje` (opisane w `docs/karty/I15.6/karta.md`) — **niepotrzebne**: 013 wykrywa, że
  `selly_products` ma już kolumnę wariantową `selly_variant_id` (warunek na kształcie celu, nie na nazwie tabeli).
**Zostaje** (i zostać powinno): kopia bazy przed migracją, `diff` kształtu `products` vs kanon, podgląd danych po
migracji (przestawione kolumny nie rzucają błędu) oraz punkty kontrolne. **Dochodzi** jedna rzecz do sprawdzenia:
`npm run migrate` wypisuje teraz linię „w tym bez treści (warunek dyrektywy…)” — na produkcji mają tam być
**dokładnie `003` i `013`**; cokolwiek innego (albo pusta lista) znaczy, że baza nie jest tym, czym myślimy — STOP.
Dowód działania: `rebuild/backend/test/db.migracje-produkcja.test.ts` (pełny łańcuch na `7d6cfc9:db/schema.sql`).
Aktualizację samego `docs/cutover.md` zostawiam koordynatorowi — to plik spoza własności tej karty.
