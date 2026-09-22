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

---

# Review II — uodpornienie łańcucha migracji

> Reviewed: 2026-09-22
> Branch: `feature/107-products-blokady-triggery`
> Zakres: `git diff dfed7d5..HEAD` (commit `26450f2` + merge `dfed7d5`) — 14 plików, 1 commit własny
> (`26450f2`) na wierzchu merge'a `develop`; cały `rebuild/backend/src/db/migrate.ts`.

## BLOCKER

Brak. Bramki BE (lint/typecheck/build/`npm test` — 98 plików, 1606 testów, 3 pominięte) przechodzą;
dodatkowy przebieg `SNAPSHOT_DB=db/snapshot.db npx vitest run test/db.migracja-011.test.ts
test/db.migracje.test.ts test/db.migracje-produkcja.test.ts` (65 testów) też zielony — wykonane w tym
review. Fixture `test/schemat-produkcji/7d6cfc9-schema.sql` zweryfikowana `diff`em jako bajt w bajt
identyczna z `git show 7d6cfc9:db/schema.sql` (exit 0, zero różnic). Grep po `-- @` w całym
`rebuild/schema/*.sql` nie znalazł żadnego fałszywego trafienia — dokładnie cztery wystąpienia, wszystkie
zamierzone (002, 003, 011, 013); w treści sześciu triggerów 011 i w pozostałych plikach nie ma linii
zaczynającej się od `-- @` poza samymi dyrektywami. `readdirSync(...).sort()` daje poprawną kolejność
(002→003→011→013 alfabetycznie = numerycznie), więc 002 (dokłada `uwaga_cena` dyrektywą) zawsze wykonuje
się PRZED 003 (sprawdza typ `szerokosc`) — na produkcji `uwaga_cena` jest więc gwarantowana zanim 003
oceni swój warunek, co domyka wątpliwość z briefu (pkt 2, pierwsza część). `WynikMigracji.bezTresci` jest
polem addytywnym (destrukturyzacja `{ zastosowane, pominiete }` bez `bezTresci` w innym miejscu by
zadziałała tak samo) — jedyny konsument poza testami to `migrate-cli.ts`, zaktualizowany w tym samym
commicie; `tools/deploy-staging.sh` woła `npm run migrate` i nie parsuje jego stdout.

## SHOULD-FIX

- [ ] `rebuild/schema/013_selly_products_warianty.sql:30` (`@pomin-jesli-tabela-istnieje selly_products_old`) —
  warunek pomija treść pliku na podstawie SAMEGO istnienia `selly_products_old`, bez weryfikacji, że
  `selly_products` ma już docelowy kształt wariantowy (`selly_variant_id`, `feature_id_magazyn`,
  `UNIQUE(kod_importu, dostawca)`). Dziś to bezpieczne, bo jedyny znany sposób, w jaki `selly_products_old`
  może powstać, to albo ręczna przebudowa Ani na produkcji (kształt poprawny z definicji), albo sama ta
  migracja (`ALTER TABLE ... RENAME TO`, kształt poprawny bo wykonała go treść pliku) — potwierdzone grepem
  po całym repo, nic innego tej nazwy nie tworzy. Jest to jednak cichy warunek: gdyby kiedyś jakikolwiek inny
  proces (ręczny eksperyment na staging, przerwany/częściowo cofnięty cutover, migracja z innej karty)
  zostawił tabelę o tej samej nazwie przy `selly_products` w STARYM kształcie, runner odnotowałby 013 jako
  zastosowaną i ZOSTAWIŁ złą strukturę na stałe (kolejne uruchomienie pomija plik po nazwie — patrz BLOCKER).
  Żaden test nie sprawdza tego przypadku (`db.migracje-produkcja.test.ts` i `migracje.selly-warianty.test.ts`
  budują tylko dwa warianty: „obiektu brak” i „obiekt jest, w kształcie zgodnym z 013”).
  - Sugestia: w gałęzi `pomin-jesli-tabela-istnieje` dla 013 (albo ogólnie w dyrektywie) dodać twardą
    asercję na obecność charakterystycznej kolumny nowej `selly_products` (np. `selly_variant_id`) przed
    zaufaniem warunkowi — błąd zamiast cichego zaakceptowania złego kształtu. Alternatywnie: udokumentować
    świadomie w README/karcie I15.6, że założenie „`selly_products_old` istnieje ⟹ `selly_products` ma nowy
    kształt” jest przyjęte na wiarę i czym jest uzasadnione (brak innego twórcy tej nazwy w repo).
- [ ] `rebuild/schema/003_szerokosc_text.sql:33` (`@pomin-jesli-typ-kolumny products szerokosc TEXT`) —
  poprawność pominięcia opiera się WYŁĄCZNIE na poprawnej kolejności plików w katalogu (002 przed 003,
  żeby `uwaga_cena` była już dołożona) i na tym, że nikt nie wyjmie dyrektywy z 002 bez wyjęcia jej z 003.
  Ta zależność nie jest w żaden sposób wymuszona w kodzie (`zastosujMigracje` po prostu sortuje pliki po
  nazwie) — dziś jest bezpieczna i przetestowana (`db.migracje-produkcja.test.ts`), ale to założenie
  międzyplikowe warto zapisać jawnie przy samej dyrektywie w 003 (dziś jest tylko w komentarzu wyżej w pliku
  i w `plan.md`), żeby ktoś kasujący/przenoszący 002 zauważył zależność, zanim ją złamie.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/db/migrate.ts:50` (`czytajDyrektywy`) — parser dyrektyw jest czysto liniowy:
  każda linia zaczynająca się (po `trim()`) od `-- @` jest dyrektywą, niezależnie od tego, czy fizycznie
  jest częścią komentarza opisowego, czy (teoretycznie) częścią wielowierszowego literału SQL. Nieznana
  nazwa rzuca błędem (fail-loud, bezpieczne), ale użycie akurat jednej ze trzech znanych nazw jako
  fragmentu opisowego komentarza zostałoby cicho wykonane jako dyrektywa. Dziś nie ma takiego przypadku
  (zweryfikowane grepem po `rebuild/schema/*.sql`) i README już ostrzega („Linia zaczynająca się od `-- @`
  jest ZAWSZE traktowana jako dyrektywa”) — zostawiam jako świadomość dla kolejnej migracji z dyrektywą.
- [ ] Brak dedykowanego testu na CRLF w linii dyrektywy pozostaje nierozliczony z Review I (patrz tam,
  NICE-TO-HAVE) — ten commit nie dodał ani nie musiał dodawać takiego testu, bo nowe dyrektywy nie
  zmieniają parsowania linii; nadal łatwe do dopisania przy okazji.

## Plan compliance

### Done ✓
- Dwie nowe dyrektywy pominięcia (`@pomin-jesli-typ-kolumny`, `@pomin-jesli-tabela-istnieje`) z walidacją
  składni PRZED wykonaniem czegokolwiek, w tej samej transakcji co treść pliku — `src/db/migrate.ts`,
  potwierdzone testami błędów (nieznana dyrektywa, zła składnia, brak tabeli/kolumny → rollback i brak
  wpisu w `_migracje`).
- 002 (`uwaga_cena`), 003 (`szerokosc` TEXT), 013 (`selly_products_old`) uodpornione zgodnie z decyzją
  koordynatora z 2026-09-22 opisaną w `plan.md`, sekcja „Rozszerzenie zakresu”; zmiana treści 013 (plik
  spoza własności tej karty) udokumentowana jako zrobiona „za zgodą użytkownika”.
- `WynikMigracji.bezTresci` + linia w `npm run migrate` (`migrate-cli.ts`) — widoczność przy cutoverze,
  bez zmiany zachowania istniejących konsumentów.
- Nowy test `test/db.migracje-produkcja.test.ts` na fixture `7d6cfc9-schema.sql` (bajt w bajt zweryfikowane
  w tym review) — pełny łańcuch 001→013 na dokładnym schemacie produkcji (74 kolumny, bez `_migracje`)
  przechodzi, `bezTresci` = [003, 013], `products`/`selly_products`/`selly_products_old`/triggery nietknięte,
  dochodzą tylko obiekty spoza produkcji; osobno pokryty przypadek „002/003 już w `_migracje`” (stara
  procedura ręczna z `docs/cutover.md` §3).
- `test/migracje.selly-warianty.test.ts` zaktualizowany zgodnie z nowym zachowaniem — sprawdza `bezTresci`
  i niezmieniony `sqlite_master`/liczbę wierszy zamiast oczekiwanego wcześniej wyjątku; nie jest to
  osłabienie (dalej dowodzi braku zmian w bazie, tylko innym mechanizmem niż `expect().toThrow()`).
- Ustalenie dla przyszłej karty (I15.6) zapisane zgodnie z CLAUDE.md w `docs/karty/I15.6/wejscie-107.md`,
  NIE w cudzym `karta.md` — `docs/karty/I15.6/karta.md` sam nie został tknięty przez ten ticket, mimo że
  jego „Do koordynatora” opisuje teraz nieaktualną (ręczną) procedurę dla 013; to świadomie zostawione
  koordynatorowi zgodnie z zasadą własności kart.
- `rebuild/schema/README.md` — nowa sekcja „Dyrektywy runnera” z tabelą i uzasadnieniem, w tym jawne
  ostrzeżenie o traktowaniu `-- @` i o bezpieczeństwie zmiany treści już zastosowanych migracji.

### Missing or deviating ✗
- Brak asercji/twardej weryfikacji kształtu `selly_products` w gałęzi pomijającej 013 (patrz SHOULD-FIX) —
  nie było w planie jako wymagany krok, ale test na tę konkretną lukę też nie powstał.
- `docs/karty/I15.6/karta.md` sekcja „Do koordynatora” pozostaje z opisem starej (ręcznej) procedury dla
  013 — zgodnie z zasadą własności kart to nie jest zadaniem tego ticketu, ale koordynator będzie musiał
  ją zaktualizować przed użyciem `docs/cutover.md` (już zasygnalizowane w `wejscie-107.md`, nic do zrobienia
  tutaj).

### Definition of done
(Definition of done tej karty dotyczy głównie 011 — patrz Review I; „Rozszerzenie zakresu” nie ma
własnej odrębnej listy DoD w `plan.md`, tylko sekcję z uzasadnieniem decyzji.)
- [x] Zmiana treści 002/003/013 jest bezpieczna dla baz, które mają je już w `_migracje` — zweryfikowane
  w kodzie (`juzZastosowane.has(plik)` po samej nazwie pliku, bez porównania treści) i testem
  `db.migracje-produkcja.test.ts` („baza, która ma już 002/003 w `_migracje`”).
- [x] Pełny łańcuch 001→013 przechodzi na dokładnym schemacie produkcji bez ręcznych kroków —
  zweryfikowane testem i uruchomieniem w tym review.
- [x] `bezTresci` widoczne w `npm run migrate` bez łamania istniejących konsumentów — zweryfikowane
  grepem (`tools/deploy-staging.sh` nie parsuje stdout).
- [ ] Twarda ochrona przed fałszywym trafieniem warunku 013 na innej niż zakładana bazie — NIE zrobione,
  patrz SHOULD-FIX (dziś ryzyko czysto teoretyczne, brak dowodu, że jest osiągalne w praktyce tego repo).

## Parallel-test concerns

None — nowe testy (`db.migracje-produkcja.test.ts`) stawiają bazę w `mkdtempSync`, bez portów ani
współdzielonych zasobów; zmieniony test w `migracje.selly-warianty.test.ts` korzysta z tej samej
infrastruktury co reszta pliku (już oceniona w Review I jako parallelizable).

## Overall assessment

Solidne domknięcie realnego problemu operacyjnego (kopia produkcji i cutover nie przechodziły
`npm run migrate`), z dobrze udokumentowanym uzasadnieniem wyboru mechanizmu i dowodem na dokładnym,
zweryfikowanym bajt-w-bajt schemacie produkcji zamiast tylko na założeniach. Runner pozostaje prosty
i przewidywalny — nieznana dyrektywa czy zła składnia zawsze wywraca całą migrację, a nie tylko cichnie.
Jedyna realna luka koncepcyjna to zaufanie samej NAZWIE tabeli (`selly_products_old`) jako dowodowi na
kształt SĄSIEDNIEJ tabeli w warunku 013 — dziś nieszkodliwe (nic innego w repo tej nazwy nie tworzy), ale
warto to świadomie zapisać albo zabezpieczyć twardszą asercją, zanim ktoś przy przyszłej karcie (I15.7/I15.8
albo kolejny cutover) stworzy tabelę o tej nazwie z innego powodu. Zarządzanie granicami kart (wpis do
`docs/karty/I15.6/wejscie-107.md` zamiast do cudzego `karta.md`) jest zgodne z zasadami projektu.
