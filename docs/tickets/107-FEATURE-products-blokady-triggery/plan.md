# 107-FEATURE-products-blokady-triggery — I15.1: kolumna blokowanych form płatności + 6 triggerów (migracja 011)

> Status: Implemented → gotowe do merge (próba na kopii produkcji wykonana ticketem 113, 2026-09-23)
> Branch: `feature/107-products-blokady-triggery`
> Worktree: `.worktrees/107-FEATURE-products-blokady-triggery`
> Karta: `docs/karty/I15.1/` (karta.md + wejscie-104.md)

## Ticket description
I15.1 — schemat `products`: kolumna `blokowane_formy_platnosci` + triggery kategorii i zastosowań, migracja `011`
(numer przydzielony przez koordynatora). Produkcja zakłada kolumnę i 6 triggerów przy KAŻDYM starcie procesu
(`extensions.cjs` → `ensurePaymentBlocks` / `ensureApplicationRules`); przenosimy to jako migrację (D1). Migracja musi
przejść na trzech bazach: świeżej, kopii `db/snapshot.db`, bazie symulującej produkcję. Triggery dosłownie z
`git show 7d6cfc9:db/schema.sql`. Kształt API bez zmian (wystawienie pola = I15.3).

## Context
**Źródło prawdy: `7d6cfc9` na `origin/main`** (produkcja zamrożona od 22.09).

Co produkcja robi przy starcie (`mirror/backend/extensions.cjs:114-130`):
- `payment_blocks.cjs` `ensurePaymentBlocks()`:
  1. `PRAGMA table_info(products)` → `ALTER TABLE products ADD COLUMN blokowane_formy_platnosci TEXT` **tylko gdy brak**;
  2. w transakcji: `UPDATE products SET blokowane_formy_platnosci = <CASE> WHERE blokowane_formy_platnosci IS NOT <CASE>`
     (uzupełnienie CAŁEJ tabeli przy każdym starcie), potem `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`
     `products_blokowane_formy_ai` / `_au` (AFTER UPDATE OF dostawca).
  - Mapa MO1–MO5, MO7–MO10; **MO6 celowo bez mapowania** (CHANGELOG produkcji 2026-09-10 14:53: „MO6 Uniglory pozostaje
    bez mapowania, ponieważ nie będzie na razie w sprzedaży”) → `NULL`, tak samo nieznany dostawca.
- `application_rules.cjs` `ensureApplicationRules()` — wołane **bez `backfill: true`**, więc przy starcie tylko
  `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` dla `products_zastosowanie_ai/_au` i `manual_overrides_kategoria_ai/_au`.
  Istniejących wierszy NIE normalizuje (normalizacje #79/#82 były jednorazowe — D2).

Strona `rebuild/` (raport researchera):
- Runner `rebuild/backend/src/db/migrate.ts` wykonuje cały plik `.sql` jednym `sqlite.exec()` w transakcji, ewidencja
  w `_migracje`. SQLite nie ma `ADD COLUMN IF NOT EXISTS` → gołe `ALTER` wywróci 011 na produkcji (razem z triggerami).
- Model `products` w `src/db/schema.ts`; ukrywanie kolumn przed API: `KOLUMNY_POZA_KONTRAKTEM.products`
  (`src/repos/kolumny.ts`) + `wKontrakcie()` / typ `Produkt` (`src/repos/products.ts`).
- Wszystkie testy BE stawiają bazę `zastosujMigracje()` na całym `rebuild/schema/` → triggery wchodzą do wszystkich
  testów automatycznie.
- `db/snapshot.db` (13.08): 72 kolumny, bez kolumny, bez triggerów, bez `_migracje`.
- `overrides.ts:73` `zapiszPoprawke()` robi `INSERT … RETURNING` — RETURNING oddaje wiersz SPRZED triggera AFTER
  (zmierzone). Dziś wszyscy wołający ignorują wynik → bez skutku; odnotowane jako follow-up.

⚠ **Ustalenie dla cutoveru (poza zakresem karty, ale wpływa na jutrzejszą kopię produkcji):** produkcyjne
`products` na `7d6cfc9` ma **74 kolumny** (72 + `uwaga_cena` + `blokowane_formy_platnosci`), `szerokosc` już TEXT.
Migracja `003_szerokosc_text.sql` przepisuje tabelę `INSERT INTO products_szertxt SELECT * FROM products` do
tabeli 73-kolumnowej → **na kopii produkcji padnie deterministycznie** („73 columns but 74 values”), zanim runner
dojdzie do 011. `docs/cutover.md` §3 opisuje to jako możliwość („Jeśli padło na 003 — STOP”); dziś to już pewnik.
Razem ze znanym zderzeniem 002 (`uwaga_cena`) oznacza to, że **odświeżenie stagingu kopią produkcji (D2) nie przejdzie
samym `npm run migrate`**. Nie naprawiam tego w tej karcie (pliki 002/003 nie są w jej własności) — trafia do
„Do koordynatora” i jako pytanie do użytkownika.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
- `GET /api/products` → `contract/fixtures/GET_products.json` (72 klucze) — **bez zmian**: nowe pole modelu
  `blokowaneFormyPlatnosci` ukryte przez `KOLUMNY_POZA_KONTRAKTEM.products`.
- `PUT`/`PATCH /api/products/{id}` — odpowiedź przez `wKontrakcie()` → też bez nowego klucza.
- Pośrednio wszystkie GATE zapisujące kategorię/zastosowanie/overrides: triggery normalizują zapis. Researcher
  sprawdził seed GATE (`test/gate/dane.ts`) — wartości już kanoniczne albo przepuszczane przez trigger; weryfikacja
  pełnym przebiegiem bramek. Każdy test, który zamrażał stan sprzed triggerów, zmieniam świadomie z odnośnikiem
  (#73/#75/#79).

## Decisions
Decyzje iteracji (użytkownik 2026-09-22): D1 (migracja odporna na istniejące obiekty), D2 (bez backfilli z września).
Scenariusz A (użytkownik 2026-09-22): implementacja teraz na bazie symulowanej; **przed PR** próba na prawdziwej kopii
produkcji (od 23.09) + pomiar #101.

Decyzje techniczne (rekomendacje Mastera — do akceptacji razem z planem):
- **T1. Kolumna — dyrektywa runnera.** W `011_*.sql` linia-komentarz
  `-- @dodaj-kolumne-jesli-brak products blokowane_formy_platnosci TEXT`. Runner przed `exec` pliku, w tej samej
  transakcji, parsuje dyrektywy, robi `PRAGMA table_info` i `ALTER` tylko przy braku — dokładnie jak
  `ensurePaymentBlocks`. Identyfikatory walidowane `^\w+$`; nieistniejąca tabela / zła składnia = błąd (migracja się
  wycofa). Odrzucone: dzielenie pliku po `;` i łapanie „duplicate column” (triggery mają `;` w `BEGIN…END` — kruche);
  ręczny krok cutoveru (sprzeczne z kartą).
- **T2. Triggery — `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`**, jak produkcja przy starcie. Gwarantuje dosłowną
  definicję z `7d6cfc9`, nawet gdyby baza miała starszą wersję. Treść `CREATE TRIGGER … END;` skopiowana bajt w bajt
  z `db/schema.sql` (linie 334–385), razem z ASCII-only `UPPER()`/`LOWER()`.
- **T3. Uzupełnienie istniejących wierszy — tylko `blokowane_formy_platnosci`** (ten sam `UPDATE … WHERE … IS NOT`
  co produkcja, CASE przepisany z triggera z `NEW.dostawca` → `dostawca`). Kategorii/zastosowań istniejących wierszy
  nie ruszamy — produkcja przy starcie też nie (backfill=false), a jednorazowe backfille wyklucza D2.
- **T4. API** — `blokowaneFormyPlatnosci` do `KOLUMNY_POZA_KONTRAKTEM.products` z uzasadnieniem „wystawia I15.3”;
  typ `Produkt` liczony z listy wykluczeń zamiast twardego `"uwagaCena"`.
- **#101** — poza zakresem do pomiaru (karta, wejscie-104). Trop MO6 zapisany w karcie.

Świadome odstępstwa od oryginału: **brak** (produkcja robi to samo przy starcie; różni się tylko mechanizm — migracja
jednorazowa zamiast kodu przy każdym starcie, D1). Skutek uboczny mechanizmu: nowy stos nie „odświeża” wartości
blokad przy każdym starcie — nie ma takiej potrzeby, bo triggery utrzymują wartość, a mapa MO* jest zamrożona w SQL.

## ✅ Próba na kopii produkcji — WYKONANA (ticket 113, 2026-09-23)
Warunek „PR mergujemy po próbie na prawdziwej kopii produkcji” (scenariusz A) jest **spełniony**: cały łańcuch
migracji przeszedł na kopii żywej `data.db` (12 migracji, 0 błędów, „bez treści” = dokładnie 003 i 013), a #101
zmierzono na produkcji. Szczegóły i liczby: `docs/karty/I15.1/wejscie-113.md` i sekcja „Próba na kopii produkcji”
w `docs/karty/I15.1/karta.md`. Pierwotna lista kroków (już rozliczona):
1. Plan kopii musi najpierw rozstrzygnąć 002/003 (produkcyjne `products` ma 74 kolumny — obie migracje padną samym
   `npm run migrate`; „Do koordynatora” w `docs/karty/I15.1/karta.md`).
2. `npm run migrate` na kopii → 011 przechodzi; triggery w `sqlite_master` przed i po identyczne.
3. Pomiar #101 (produkty dodane po 10.09: dostawca, puste blokady) i łańcuchów zastosowań (` ; ` w kategorii kanonicznej).
4. Wynik do karty, potem merge PR #122.

## Implementation plan
1. **Runner** — `src/db/migrate.ts`: funkcja `zastosujDyrektywy(sqlite, sql, plik)` (dyrektywa
   `@dodaj-kolumne-jesli-brak <tabela> <kolumna> <definicja>`), wołana w transakcji przed `sqlite.exec(sql)`.
   Aktualizacja komentarza/README o konwencji. Testy jednostkowe runnera (brak kolumny → dodaje; jest → pomija;
   brak tabeli → błąd + rollback; zła składnia → błąd).
2. **Migracja** — `rebuild/schema/011_blokowane_formy_i_triggery.sql`: nagłówek (źródło, D1, idempotencja, skutek na
   produkcji), dyrektywa kolumny, backfill `UPDATE`, 6× `DROP TRIGGER IF EXISTS` + dosłowny `CREATE TRIGGER`.
   Plik generuję skryptem z `git show 7d6cfc9:db/schema.sql` (bez ręcznego przepisywania), weryfikacja `diff`em.
   README migracji: wiersz 011.
3. **Model** — `src/db/schema.ts` (tylko `products`): `blokowaneFormyPlatnosci: text("blokowane_formy_platnosci")`;
   `src/repos/kolumny.ts` + `src/repos/products.ts` — ukrycie pola.
4. **Testy** — `test/db.migracje.test.ts`: lista `MIGRACJE` + bilans (28/14 bez zmian), strażnik 003 dopuszcza
   `blokowane_formy_platnosci`; nowy blok 011:
   - (a) świeża baza: kolumna, 6 triggerów, ich `sqlite_master.sql` = treść z pliku 011;
   - (b) baza symulująca produkcję: 001–010 → symulacja runtime'u produkcji (ALTER + wiersze + triggery, w tym jeden
     „przestarzały”) → pełny `zastosujMigracje` stosuje tylko 011 bez błędu, triggery podmienione, dane poprawne;
   - (c) kopia `db/snapshot.db` (`SNAPSHOT_DB`, jak w 009/010): pełny łańcuch, backfill per dostawca, MO6 = NULL;
   - zachowanie triggerów: dostawca (`' mo2 '`, MO6, zmiana dostawcy), kategoria/zastosowanie (aliasy, kategoria spoza
     listy, puste zastosowanie, ASCII-only `LEŚNE`), `manual_overrides` (`kategoria` vs inne pole).
   - `test/katalog.gate.test.ts`: strażnik „GET/PATCH nie oddaje `blokowaneFormyPlatnosci`”.
5. **Bramki** — lint, typecheck, build, test; świadome poprawki testów zamrażających stan sprzed triggerów.
6. **Scenariusz A (po 23.09, przed PR)** — na kopii produkcji: pomiar kształtu (kolumny, triggery), `npm run migrate`
   z procedurą cutover dla 002/003 → 011 przechodzi; porównanie `sqlite_master` triggerów przed/po (identyczne);
   pomiar #101 (nowe produkty po 10.09: dostawca, puste blokady). Wynik do karty.
7. Karta (`docs/karty/I15.1/karta.md`), wejścia dla I15.2/I15.3 jeśli wyjdą, „Do koordynatora” (cutover).

## Rozszerzenie zakresu — decyzja koordynatora 2026-09-22 (uodpornienie łańcucha migracji)
Powód: bez tego ani odświeżenie stagingu kopią produkcji (D2), ani cutover nie przejdą `npm run migrate`.
Zmiana treści 002/003/013 jest bezpieczna, bo runner pomija zastosowane migracje po NAZWIE — dotknie wyłącznie baz,
które danej migracji jeszcze nie mają (czyli produkcji).

- **002** — `ALTER TABLE products ADD COLUMN uwaga_cena` → `-- @dodaj-kolumne-jesli-brak products uwaga_cena TEXT`.
  Reszta pliku bez zmian; `suppliers.import_wylaczony` zostaje gołym `ALTER`, bo produkcja tej kolumny NIE ma
  (sprawdzone w `7d6cfc9:db/schema.sql`) — dyrektywa ukryłaby tam realny błąd.
- **003** — nowa dyrektywa `-- @pomin-jesli-typ-kolumny products szerokosc TEXT`: gdy kolumna ma już typ docelowy,
  runner odnotowuje migrację jako zastosowaną BEZ wykonania treści.
  **Dlaczego tak, a nie inaczej:**
  - *warunek na żywym schemacie w pliku migracji* (wybrane) — cel 003 to `szerokosc TEXT`; na produkcji jest on już
    osiągnięty własną migracją Ani (`szertxt`, 19.08), więc przebudowa jest zbędna, a wręcz szkodliwa:
    `INSERT … SELECT *` do tabeli 73-kolumnowej padłby na 74 kolumnach, a gdyby liczby się zgadzały — przestawiłby
    dane. Warunek stoi w pliku, jest czytelny przy cutoverze i sprawdzany w tej samej transakcji;
  - *przepisanie 003 na jawną listę kolumn* (odrzucone) — przebudowa tabeli na produkcji ZGUBIŁABY kolumny spoza
    kanonu (`blokowane_formy_platnosci`) razem z triggerami, a danych w nich nie da się odtworzyć z migracji;
  - *`PRAGMA` w SQL-u* (niemożliwe) — SQLite nie ma warunkowego DDL;
  - *ręczny krok operatora* (odrzucone) — to jest dokładnie to, co ta decyzja likwiduje.
- **013 (karta I15.6)** — ten sam problem: produkcja ma `selly_products_old` od 07.09, więc migracja tam padała
  (opisane w samym pliku jako ręczny krok cutoveru). **Decyzja użytkownika z 2026-09-22 (pytanie w trakcie
  ticketu):** uodpornić też ją — warunkiem `-- @pomin-jesli-typ-kolumny selly_products selly_variant_id INTEGER`.
  DDL w 013 jest verbatim z produkcji, więc jej kształt JEST celem migracji. Warunek patrzy na KSZTAŁT CELU
  (kolumna wariantowa), a nie na obecność nazwy `selly_products_old` — pierwsza wersja sprawdzała nazwę i review II
  słusznie wytknął, że nazwa nie dowodzi przebudowy (stara tabela `selly_variant_id` nie ma). Baza z samą nazwą,
  ale starą `selly_products`, zatrzymuje teraz deploy zamiast zostać przepuszczona (test przypadku negatywnego). Zaktualizowany test I15.6
  (`test/migracje.selly-warianty.test.ts`) zamiast „pada i niczego nie zmienia” sprawdza „odnotowuje się bez
  wykonania treści i niczego nie zmienia”.
- **Runner** — dwie dyrektywy (`@dodaj-kolumne-jesli-brak`, `@pomin-jesli-typ-kolumny`); `WynikMigracji.bezTresci` (podzbiór `zastosowane`) i osobna linia w `npm run migrate`, żeby przy
  cutoverze było widać, która migracja przeszła warunkiem, a nie treścią.
- **Test** — `test/db.migracje-produkcja.test.ts`: baza stawiana z fixture'u `test/schemat-produkcji/7d6cfc9-schema.sql`
  (= `git show 7d6cfc9:db/schema.sql` bajt w bajt, bez `sqlite_sequence`), dane w stanie produkcji; pełny łańcuch
  001→013 przechodzi, `bezTresci` = [003, 013], `products`/`selly_products`/`selly_products_old`/triggery bez zmian,
  dochodzą tylko obiekty spoza produkcji (`suppliers.import_wylaczony`, `waga_gab_przewoznicy`,
  `alerty_katalogu_statusy`); osobno: baza z 002/003 w `_migracje` nie dostaje ich nowej treści.

## Testing strategy
- GATE: `GET_products.json` kształt 72 klucze — istniejący gate + nowy strażnik pola.
- Migracja: trzy bazy jak wyżej; (c) na prawdziwej kopii produkcji ręcznie w kroku 6 (wynik w raporcie).
- Bez mocków — prawdziwy SQLite w katalogu tymczasowym.

## Out of scope
Parsery/adapter (I15.2), wystawienie pola w API/katalogu/CSV (I15.3), staging (I15.4), Selly (I15.6); jednorazowe
backfille #79/#82/#83 (D2); naprawa 002/003 pod kształt produkcji (→ koordynator); naprawa #101 (po pomiarze, D6);
`RETURNING` w `zapiszPoprawke` (follow-up).

## Definition of done
- [ ] `011` przechodzi na świeżej bazie, na kopii snapshotu i na bazie symulującej produkcję (testy).
- [ ] Triggery w bazie po migracji = bajt w bajt `7d6cfc9:db/schema.sql`.
- [ ] `GET /api/products` i odpowiedzi PUT/PATCH bez nowego klucza (72).
- [ ] Wszystkie bramki BE zielone; zmienione testy mają odnośnik do wpisu.
- [ ] Próba na kopii produkcji (23.09) + pomiar #101 zapisane w karcie.
- [ ] `karta.md` opisuje stan; „Do koordynatora”: zachowanie na produkcji + 002/003.
