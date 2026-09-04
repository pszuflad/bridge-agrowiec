# 35-FEATURE-mutacje-produktow-backend — Code review

> Reviewed: 2026-09-05
> Branch: `feature/35-mutacje-produktow-backend`
> Diff: 15 plików, 2 commity (względem `origin/develop`)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:1568-1686`, `docs/rebuild-backlog.md:890-916` (wpis #14), `docs/rebuild-backlog.md:262-306` (wpis #4) — roadmapa i backlog NIE zostały zaktualizowane, mimo że DoD ticketa (`plan.md` ostatni punkt) i `CLAUDE.md` explicite tego wymagają.
  - Reason: `git diff origin/develop...HEAD --stat -- docs/rebuild-roadmap.md docs/rebuild-backlog.md` jest pusty — żaden z tych plików nie został tknięty. Roadmapa w bloku I12 nadal opisuje `PUT`/`PATCH` jako „wspólny handler (`:48415-48424`, zarejestrowany w `:48452`)" — czyli dokładnie to fałszywe twierdzenie, które `raport.md` tej sesji sam identyfikuje jako „ROZJAZD 1" i deklaruje do sprostowania. Status bloku I12 nadal `⬜`, backlog #14 nadal ma „⬜ produkty (I12)", backlog #4 nadal „🔨 częściowo zrobione… endpoint i propagacja → 3d". `CLAUDE.md` wprost ostrzega przed tym wzorcem błędu („Roadmapa jest wejściem dla następnej sesji — utrzymuj ją na bieżąco", „Ustalenie dotyczące PRZYSZŁEGO bloku wpisz DO TEGO BLOKU") i podaje niemal identyczny precedens (rozjazd `PUT /api/config` vs `POST`). Kolejna sesja (12b/12c/12d), czytając roadmapę, dostanie nieaktualny opis kontraktu API i nieaktualny status zależności.
  - Suggestion: przed mergem dopisać do `docs/rebuild-roadmap.md` bloku I12 sprostowanie rozjazdów 1–4 (dokładnie tak, jak są spisane w `raport.md`), oznaczyć 12a jako zrobioną (data + ID ticketa), zaktualizować backlog #14 (status „✔ produkty naprawione w rebuild (12a)") i #4 (status „✔ zrobione — endpointy i propagacja w 12a").

## SHOULD-FIX

- [ ] `rebuild/backend/src/routes/products.ts:70-73` (komentarz w handlerze edycji) — opis „Porównanie luźne (`!==`)" jest mylący: `!==` to porównanie ŚCISŁE (strict inequality), nie luźne. Nie wpływa na kod (logika jest poprawna i zgodna z oryginałem), ale komentarz wprowadza w błąd przyszłego czytelnika.
  - Suggestion: zmienić słowo „luźne" na „ścisłe" albo usunąć przymiotnik.
- [ ] `contract/openapi.yaml` (nowe ścieżki `uwagi-cena`/`hold-reasons`) — endpointy `GET` nie mają wpisanego kodu `400`/walidacji parametrów, co jest OK (nie przyjmują parametrów), ale warto rozważyć w 12d dodanie przykładowego `response schema` już przy pierwszym nagraniu fixture, żeby uniknąć luki między merge'em 12a a 12d (nie blokuje tego ticketa — tylko nota dla następnej sesji, którą jednak najlepiej zapisać w bloku I12 roadmapy razem z resztą, patrz BLOCKER wyżej).

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/dziennik-zmian.ts:56` — `zapiszWpisDziennika` zwraca `void`, podczas gdy oryginalne `U.addHistory` zwraca wstawiony wiersz (`.returning().get()`). Żaden konsument tego nie potrzebuje dziś, ale warto rozważyć zwrócenie wiersza dla symetrii z `zapiszPoprawke`/`zapiszAudyt`, gdyby przyszły konsument tego potrzebował.
- [ ] `rebuild/backend/src/import/bulk.ts:1-12` — komentarz nagłówkowy jest bardzo obszerny (dobra praktyka w tym repo), ale warto krótkiej wzmianki, że `dodajProduktyBulk` jest jedynym konsumentem `tylkoKolumnyProduktu` obok `akceptacja.ts` — ułatwi przyszłe DRY-owanie, gdyby ktoś szukał wspólnego miejsca.

## Plan compliance

### Done ✓
- Krok 1 — harness poszerzony o trzeci wycinek (`updateProduct(t,e){` → `listStaging(){`), kotwice jednoznaczne, dwa istniejące wycinki nietknięte, integralność liczona osobno.
- Krok 2 — `dodajProduktyBulk` w `src/import/bulk.ts`, port 1:1 z `:44746-44806`: kolejność kroków, wartości domyślne, gałąź cenowa przez `zastosujRegulyCenowe` (istniejąca z 4a), sześć rozszerzeń z `rememberLink` po zapisie, `dataAktualizacji` liczone raz przed transakcją, zwracana liczba.
- Krok 3 — `zapiszWpisDziennika` w `dziennik-zmian.ts`, port `U.addHistory`.
- Krok 4 — `POLA_EDYTOWALNE_PRODUKTU` (42 pola) zweryfikowane linia po linii wobec `LT()` (`frontend-index.js:24020-24090`) — skład listy zgadza się dokładnie z polami, które dialog realnie wysyła (`dostawca` poprawnie odcięty jako `disabled`).
- Krok 5 — sześć tras w `routes/products.ts`: wspólny handler `PUT`/`PATCH` (D2, świadome odstępstwo udokumentowane), `DELETE` bez kaskad (zastane), `POST` bulk z dwoma kształtami ciała, dwie trasy `uwaga_cena` z jawną projekcją `snake_case`.
- Krok 6 — `contract/openapi.yaml`: dwie nowe ścieżki + `404` przy trzech operacjach `{id}`.
- Krok 7 — testy: charakteryzacja bulku (22 testy z trzema kontrolami negatywnymi), testy tras (41), GATE kontraktu (16, z kontrolą negatywną). Wszystkie bramki (`lint`/`typecheck`/`build`/`test`, 1103/1103) przechodzą lokalnie — zweryfikowane w tej sesji review.
- `aktualizujProdukt` — guard na pusty patch, niczego nie psuje w ścieżce importu (współdzielona z silnikiem, sprawdzone testami istniejącymi + nowymi).
- `tylkoKolumnyProduktu` wyekstrahowane z `akceptacja.ts` do `repos/products.ts`, re-eksportowane, DRY zachowane.

### Missing or deviating ✗
- **Roadmapa i backlog nie zostały zaktualizowane** mimo jawnego DoD („Roadmapa: blok I12 sprostowany… backlog #14 domknięty… #4 zaktualizowany") — patrz BLOCKER.

### Definition of done
- [x] `POST /api/products` (bulk) — gałąź cenowa, sześć rozszerzeń, propagacja `uwagaCena`, `{ok, dodano}`, oba warianty ciała.
- [x] `PATCH`/`PUT /api/products/{id}` — wspólny handler, 42 pola, auto-status, `manual_overrides` + `history`, audyt, 404.
- [x] `DELETE /api/products/{id}` — 404 albo audyt + `{ok:true}`.
- [x] `GET /api/products/uwagi-cena` i `hold-reasons` — kształt 1:1 z D7.
- [x] Charakteryzacja `addProductsBulk` zielona.
- [x] `contract/openapi.yaml` zaktualizowany.
- [x] GATE kontraktu zielony; `lint`/`typecheck`/`build`/`test` czyste.
- [ ] Roadmapa/backlog sprostowane — **NIE zrobione** (patrz BLOCKER).

## Parallel-test concerns

None — wszystkie nowe testy używają `stworzTestowaBaze()`/`stworzSrodowiskoTestowe()` (baza w katalogu tymczasowym, port efemeryczny), zgodnie z konwencją repo. Brak twardo zakodowanych ścieżek/portów.

## Overall assessment

Merytorycznie kod jest bardzo solidny: port `addProductsBulk` jest wierny 1:1 (zweryfikowany linia po linii wobec `:44746-44806`), lista pól edytowalnych jest poprawnie wyprowadzona z dialogu `LT()`, projekcja `snake_case` dla `uwaga_cena`/`hold-reasons` jest jawna i poprawna, a harness charakteryzacji ma realne kontrole negatywne (nie jest zielony „bo obie strony nic nie robią"). Testy tras są konkretne i sprawdzają dokładne wartości, nie tylko kształt. Jedyny poważny problem to brak aktualizacji `docs/rebuild-roadmap.md` i `docs/rebuild-backlog.md` — to dokładnie ten typ błędu, przed którym ostrzega `CLAUDE.md`, i explicite wymieniony punkt DoD w `plan.md`, więc traktuję go jako blokujący merge, nie kosmetykę.
