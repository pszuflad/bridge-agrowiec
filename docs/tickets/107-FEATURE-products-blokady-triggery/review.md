# 107-FEATURE-products-blokady-triggery — Code review

> Reviewed: 2026-09-22
> Branch: `feature/107-products-blokady-triggery`
> Diff: 16 plików, 4 commity (vs `origin/develop`)

## BLOCKER

Brak. Bramki BE (lint/typecheck/build/`npm test` — 93 pliki, 1549/1552 testów, 3 pominięte)
przechodzą; dodatkowy przebieg z `SNAPSHOT_DB=db/snapshot.db` (31 testów w
`db.migracja-011.test.ts`) też przechodzi. Treść sześciu triggerów w
`rebuild/schema/011_blokowane_formy_i_triggery.sql:53-104` jest bajt w bajt identyczna z
`git show 7d6cfc9:db/schema.sql` (linie 334-385) — zweryfikowane `diff`em w tym review, nie tylko
zaufaniem do opisu w commicie. Backfill `UPDATE ... WHERE ... IS NOT <CASE>` w pliku 011
odpowiada `sqlCase()`/`ensurePaymentBlocks()` z `git show 7d6cfc9:mirror/backend/payment_blocks.cjs`
co do znaku. Kontrakt (`GET/PATCH/PUT /api/products`, 72 klucze) pilnowany testami i faktycznie
bez zmian — `blokowaneFormyPlatnosci` trafiło do `KOLUMNY_POZA_KONTRAKTEM.products`, a typ
`Produkt` liczy wykluczenia z tej listy zamiast twardego stringa, więc kolejna kolumna spoza
kontraktu nie wymaga już zmiany w dwóch miejscach.

## SHOULD-FIX

- [ ] `rebuild/backend/src/import/legacy/parsers/adapter.cjs:376` — port parsera NIE normalizuje
  `zastosowanie` przed zapisem (samo `zastosowanie: raw.Zastosowanie`) ani nie liczy
  `blokowaneFormyPlatnosci`, podczas gdy oryginał (`git show 7d6cfc9:mirror/backend/parsers/adapter.cjs:541-578,687`)
  woła `tyre.normalizeCategoryApplication()` i `paymentBlocks.getBlockedPaymentForms()` w JS-ie,
  ZANIM cokolwiek trafi do bazy/stagingu. Dla wiersza, który trafia do `products` przez `INSERT`,
  trigger 011 i tak nadpisze wynik na docelową wartość (końcowy stan bazy się zgadza), ale
  `staging_items.snapshot_json` — czyli to, co widzi operator w kolejce przed akceptacją — nie
  przechodzi przez żadną normalizację, bo tabela `staging_items` nie ma triggerów z 011. Skutek:
  operator może zobaczyć w podglądzie inną (nieznormalizowaną) kategorię/zastosowanie niż to, co
  ostatecznie wyląduje w `products` po akceptacji, i nie zobaczy w ogóle blokad płatności tam,
  gdzie produkcja by je pokazała. Zakres naprawy to I15.2 (parsery/adapter — plan.md „Out of
  scope”), ale zgłaszam to jako ryzyko do przekazania dalej, zgodnie z poleceniem.
  - Nie jest to regresja WPROWADZONA przez tę migrację (adapter i tak nie miał tej normalizacji
    przed 011) — 011 tylko unaoczniła brak, bo teraz istnieje trigger, z którym warto to porównać.
- [ ] `docs/karty/I15.1/karta.md:52` — sekcja „Dowiezione” zostaje pustym `—`, mimo że karta
  faktycznie dowiozła migrację 011, model, ukrycie pola i pełny komplet testów (zielone bramki).
  Reguła CLAUDE.md („Po każdej zamkniętej karcie jej `karta.md` opisuje STAN, nie zamiar”) — tu
  karta formalnie nie jest zamknięta (kroki 6-7 planu czekają na kopię produkcji z 23.09, co samo
  w sobie jest uzasadnione i jawnie opisane w `raport.md`), ale „Dowiezione” mogłoby już opisywać
  to, co REALNIE wylądowało w `develop` po scaleniu, żeby następna sesja (I15.3/I15.6) nie musiała
  tego wyciągać z diffu.
- [ ] Plan (`plan.md` Definition of done, pkt 5) i `raport.md` („PR czeka na ten krok”) wprost mówią,
  że próba na kopii produkcji (23.09) i pomiar #101 mają się odbyć PRZED PR — dziś (22.09) tego
  jeszcze nie ma. Nie jest to defekt kodu, tylko przypomnienie: PR z tej gałęzi nie powinien
  wychodzić, dopóki krok 6 (scenariusz A) nie zostanie wykonany i zapisany w karcie, zgodnie z
  własną decyzją zespołu.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/db/migrate.ts:34` — `zastosujDyrektywy` nie ma dedykowanego testu na
  CRLF (`\r\n`) w linii dyrektywy; `sql.split(/\r?\n/)` powinien go obsłużyć poprawnie (CLAUDE.md
  ostrzega przed niedowierzaniem założeniom), ale brak jawnego testu na plik z CRLF zostawia to
  bez dowodu — łatwy test do dopisania przy okazji kolejnej migracji z dyrektywą.
- [ ] `rebuild/schema/README.md` — dopisek „Linia zaczynająca się od `-- @` jest ZAWSZE traktowana
  jako dyrektywa” jest dobrym ostrzeżeniem, ale warto rozważyć w kolejnej dyrektywie (jeśli
  powstanie) dodanie przykładu „złego” komentarza, żeby przyszły autor migracji miał gotowy
  kontrprzykład, nie tylko regułę.

## Plan compliance

### Done ✓
- Runner: dyrektywa `@dodaj-kolumne-jesli-brak` w transakcji przed treścią pliku, z testami na
  wszystkie ścieżki błędów (brak tabeli, zła składnia, nieznana dyrektywa, błąd w treści pliku
  cofa też ALTER) — `rebuild/backend/src/db/migrate.ts`, `test/db.migracja-011.test.ts`.
- Migracja 011: kolumna + backfill + 6 triggerów bajt w bajt z `7d6cfc9`, zweryfikowane w tym
  review niezależnym `diff`em.
- Model/kontrakt: `schema.ts`, `kolumny.ts`, `products.ts` — pole ukryte, typ `Produkt` liczony z
  listy wykluczeń.
- Testy na trzech bazach (świeża / symulacja produkcji z przestarzałym triggerem / kopia
  `db/snapshot.db`) — wszystkie przechodzą, w tym przebieg z `SNAPSHOT_DB` wykonany w tym review.
- Świadome poprawki testów zamrażających stan sprzed triggerów (`atrybuty.pending`,
  `atrybuty.niezmiennik`, `selly.synchronizacja`, `silnik.charakteryzacja`) — każda z komentarzem i
  odnośnikiem; sprawdzone, że NIE osłabiają asercji, tylko przenoszą wartości testowe na
  wartości spoza/wewnątrz zamkniętej listy i dokładają nowe przypadki (np. test „w kategorii
  kanonicznej brak `multi_cat`”, test „PATCH nie zapisuje `blokowaneFormyPlatnosci`”).
- Zdjęcie triggerów w bazie `silnik.charakteryzacja.test.ts` jest uzasadnione: wzorzec nagrano z
  `tk()` na atrapach JS bez SQLite, więc trzymanie triggerów w tej bazie porównywałoby silnik z
  silnikiem+bazą i przestałoby mierzyć to, co miało — inne testy (`silnik.rownosc`,
  `silnik.decyzje`, `akceptacja.charakteryzacja`) nadal stawiają pełny łańcuch migracji z 011.
- Sprawdzono grep-em całe `src/`: jedyne miejsca zwracające `db.select(...).from(products)` do
  HTTP/CSV idą przez `KOLUMNY_API`/`wKontrakcie()` albo przez jawną projekcję SQL
  (`/api/products/uwagi-cena`, `/hold-reasons`, generator CSV Selly z jawną listą `KOLUMNY`,
  `statusSelly` z jawnym obiektem kolumn); gołe `select()` bez projekcji występuje tylko w kodzie
  wewnętrznym (import, przeliczanie cen, payload do Selly), nie w odpowiedziach HTTP naszego API.

### Missing or deviating ✗
- Krok 6 planu (próba na prawdziwej kopii produkcji od 23.09 + pomiar #101) — jeszcze nie
  wykonany; sam plan i raport traktują to jako warunek przed PR (patrz SHOULD-FIX).
- `docs/karty/I15.1/karta.md` sekcja „Dowiezione” nie opisuje stanu (patrz SHOULD-FIX) — zgodnie z
  raportem to świadome, bo karta formalnie czeka na krok 6, ale warto rozważyć częściowy zapis.
- Ryzyko dla I15.2 (adapter/parsery nie normalizują `zastosowanie`/`blokowaneFormyPlatnosci` w
  JS przed zapisem do stagingu) — poza własnością tej karty, zgłoszone jako SHOULD-FIX/ryzyko
  zamiast blokady, zgodnie z poleceniem.

### Definition of done
- [x] `011` przechodzi na świeżej bazie, na kopii snapshotu i na bazie symulującej produkcję (testy) — zweryfikowane, w tym uruchomienie z `SNAPSHOT_DB` w tym review.
- [x] Triggery w bazie po migracji = bajt w bajt `7d6cfc9:db/schema.sql` — zweryfikowane niezależnym `diff`em (linie 334-385 vs 53-104 pliku 011).
- [x] `GET /api/products` i odpowiedzi PUT/PATCH bez nowego klucza (72) — strażniki w `katalog.gate.test.ts` i `produkty.mutacje.test.ts`, oba zielone.
- [x] Wszystkie bramki BE zielone; zmienione testy mają odnośnik do wpisu — lint/typecheck/build/test zielone, testy mają komentarze z odnośnikiem do 011/#75 itd.
- [ ] Próba na kopii produkcji (23.09) + pomiar #101 zapisane w karcie — NIE wykonane jeszcze (jawnie, `raport.md`: „PR czeka na ten krok”); data w tym review to 22.09, więc to zgodne z harmonogramem, ale nie jest domknięte.
- [ ] `karta.md` opisuje stan; „Do koordynatora”: zachowanie na produkcji + 002/003 — sekcja „Do koordynatora” wypełniona i dobra, ale „Dowiezione” zostaje pustym `—`.

## Parallel-test concerns

None — wszystkie nowe testy stawiają bazę SQLite w katalogu tymczasowym (`mkdtempSync`/
`stworzTestowaBaze()`), bez współdzielonych zasobów ani portów na sztywno. Test korzystający z
`SNAPSHOT_DB` kopiuje plik do własnego katalogu tymczasowego przed otwarciem (`db.migracja-011.test.ts:366-368`)
i jest opcjonalny (`it.skipIf(!process.env.SNAPSHOT_DB)`), więc nie koliduje z równoległą pracą.

## Overall assessment

Solidna, dobrze udokumentowana robota — kluczowe ryzyko karty (triggery i backfill 1:1 z produkcją,
idempotencja na „już zmigrowanej” bazie) jest nie tylko zaimplementowane poprawnie, ale i
zweryfikowane niezależnym porównaniem w tym review, nie tylko zaufaniem do komentarzy w kodzie.
Testy są liczne i celowane w rzeczywiste gałęzie triggerów (ASCII-only `UPPER`/`LOWER`, MO6,
przestarzały trigger, rozjechane dane), a świadome zmiany istniejących testów faktycznie
wzmacniają pokrycie zamiast je osłabiać. Największe pozostałe ryzyko nie leży w tym diffie, tylko
na styku z I15.2 (adapter parserów bez normalizacji JS-owej) — zgłoszone, nie zablokowane. Przed
mergem do `develop`/PR warto dopilnować kroku 6 (kopia produkcji, 23.09), zgodnie z własną decyzją
zespołu zapisaną w planie.
