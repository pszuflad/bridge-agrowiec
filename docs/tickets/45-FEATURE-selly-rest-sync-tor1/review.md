# 45-FEATURE-selly-rest-sync-tor1 — Code review

> Reviewed: 2026-09-09
> Branch: `feature/45-selly-rest-sync-tor1`
> Diff: 30 plików, 4 commity (`8918cca`, `9506054`, `1dd8ea7`, `dab7c5b`)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:2026-2033` i `docs/rebuild-backlog.md:2625-2633` — **roadmapa i backlog #60 NIE są zaktualizowane**, mimo że DoD tego ticketa (`plan.md:301`) wprost tego wymaga: „Roadmapa 13d/13d-1 + backlog #60 zaktualizowane; cztery defekty produkcji opisane".
  - Reason: `docs/rebuild-roadmap.md` sekcja „13d" wciąż opisuje kartę jako niedomkniętą (podział 13d-1/13d-2/13d-3 wymieniony jako *plan*, nie jako stan), a `docs/rebuild-backlog.md` #60 ma nadal `**Status** | ⬜ do portu (po domknięciu Tor 2 u Ani)`. `raport.md:15` twierdzi „Wszystkie są opisane niżej i w backlogu #60" — to nieprawda, backlog nie został tknięty w tym diffie (`git diff origin/develop...HEAD --stat` nie pokazuje żadnego z tych dwóch plików). Zgodnie z CLAUDE.md (obowiązek #1: „Po każdym zamkniętym bloku roadmapa opisuje STAN, nie zamiar") to jest dokładnie błąd, przed którym instrukcja ostrzega — kolejna sesja czytająca roadmapę zobaczy kartę 13d jako nierozpoczętą i zablokowaną przez Tor 2, choć fundament + Tor 1 są już zmergowane.
  - Suggestion: Dopisać do roadmapy stan „13d-1 ✅ zamknięte (data, ticket 45)" z notą o czterech/sześciu zastanych defektach i przenieść blokadę „Tor 2 niedomknięty" wyłącznie do opisu 13d-2. Zaktualizować status #60 w backlogu na „częściowo zrobione — Tor 1" z odsyłaczem do ticketa.

## SHOULD-FIX

- [ ] `rebuild/backend/src/app.ts:213` i `rebuild/backend/src/server.ts:51` — dwie NIEZALEŻNE instancje `stworzDiscovery(...)` w tym samym procesie produkcyjnym (jedna dla tras manualnych, druga dla schedulera), każda z własnym domknięciem `cacheFeatureId`.
  - Reason: Komentarz w `discovery.ts:80-84` twierdzi „Stan MODUŁU, jak w oryginale (discovery.cjs:46) — żyje tyle, co proces" — ale w oryginale `featureIdCache` jest DOSŁOWNIE modułowe (`require('./discovery.cjs')` cache'owany przez Node, jedna instancja na cały proces, dzielona przez wszystkich wołających: trasy manualne I scheduler). U nas `app.ts` i `server.ts` wołają `stworzDiscovery()` osobno, więc nauczony w trakcie działania `feature_id` (dla MO1/MO6/MO7/MO8/MO10, których nie znamy statycznie) nie przenosi się między trasą ręczną a przebiegiem schedulera w TYM SAMYM uruchomieniu procesu — co zaprzecza treści własnego komentarza. Skutek jest ograniczony (po pierwszym zapisanym mapowaniu wiersz i tak trafia w `cache_hit` z bazy przy kolejnym przebiegu), ale to niezamierzona, nieudokumentowana różnica względem „jednego procesu = jedno źródło wiedzy o feature_id", którą limiter (`globalnyLimiter`) poprawnie zachowuje jako prawdziwy singleton.
  - Suggestion: Albo jeden wspólny `discovery` budowany raz i przekazywany do obu miejsc (analogicznie do współdzielonego `klientSellyDoUzycia`), albo świadoma decyzja + korekta komentarza w `discovery.ts`, że cache NIE jest już dzielony 1:1 z oryginałem.

- [ ] `rebuild/backend/src/selly/scheduler-sync.ts:181` — `timer.unref?.()` to dodatek nieobecny w oryginale i nieopisany jako odstępstwo (D4 mówi tylko o fladze `SELLY_SCHEDULER`, nie o `unref`).
  - Reason: Nieszkodliwe (tylko pozwala procesowi zamknąć się mimo aktywnego timera), ale to jeszcze jedna cicha różnica względem „ten sam wzorzec co `IMPORT_SCHEDULER`" — warto sprawdzić, czy `import/scheduler.ts` robi to samo, i ewentualnie dopisać do listy odstępstw albo zdjąć jeśli nieuzasadnione.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/selly/discovery.ts:411-419` i `rebuild/backend/src/selly/sync-delta.ts:143-153` — komentarze bardzo dobrze opisują defekt #5/#6 z `raport.md`, ale warto dorzucić bezpośredni odnośnik do numeru wpisu w `docs/rebuild-backlog.md` (dopiero po tym, jak BLOCKER wyżej zostanie zamknięty i wpis faktycznie powstanie), żeby link był aktualny, a nie tylko obiecany.

## Plan compliance

### Done ✓
- Krok 1 — migracja `007` (`ALTER TABLE ... RENAME`, DDL verbatim z `main:db/schema.sql:307-325`, sześć indeksów) + model Drizzle `sellyProducts`/`sellyProductsOld` + `repos/selly.ts` na surowy SQL (D3) — zweryfikowane linia po linii z `main:db/schema.sql` i `main:mirror/backend/selly/routes.cjs:417-421`, zgadza się.
- Krok 2 — cztery nazwane metody wariantowe w `klient.ts` (D7) + `tryb.ts` (dopisane do `METODY_ZAPISUJACE`/`METODY_ODCZYTU`) + `test/gate/selly-atrapa.ts`.
- Krok 3 — `limiter.ts`, port 1:1 (rekurencja `acquire()`, `MIN_ODSTEP_MS`, zegar wstrzykiwany wyłącznie w testach).
- Krok 4 — `discovery.ts`, pięć kroków `zapewnijMapowanie` zweryfikowane linia po linii z `discovery.cjs` — kolejność, komunikaty `action`, klauzula `ON CONFLICT`, `attributes: []`, defekt D5 (`createProduct`) odtworzony wiernie.
- Krok 5 — `mapper-v2.ts`, 21 cech w tej samej kolejności, helpery `yn`/`txt`/`num`/`zastosowaniePierwsze` identyczne, `toDeltaPayload` portowany jako martwy (jak w oryginale).
- Krok 6 — `sync-delta.ts`, SQL delty 1:1, `markSynced`/`markError` (nazwane `oznaczZsynchronizowany`/`oznaczBlad`) identyczne co do treści komunikatów i logiki `pending_create` vs `error`. Projekcja `znajdzProduktyDelta` jawna, `snake_case` (pułapka z CLAUDE.md domknięta poprawnie).
- Krok 7 — `scheduler-sync.ts`, minuty `[55,10,25,40]`, `lastRunKey`/`ostatniKlucz`, rotacja Tor 2 (nieużywana, ale potrzebna dla kształtu `sync-status`) — zgodne.
- Krok 8 — trzy trasy w `routes/selly-sync.ts`, montaż w `app.ts` z jednym współdzielonym, opakowanym `SELLY_TRYB` klientem; trzy ścieżki w `contract/openapi.yaml` (D6) zweryfikowane wobec kształtów z `routes_sync.cjs`.
- D1 (naprawa `sync-delta-supplier`), D2 (martwy retry 429), D3 (zepsuty stary `sync-supplier`, z testami dokumentującymi awarię), D4 (scheduler za flagą, domyślnie OFF), D5 (`createProduct` bez `buildProductPayload`) — wszystkie zweryfikowane w kodzie, zgodne z deklaracjami.
- Ustalenie #5 z `raport.md` („`pending_create` nie ma jak trafić do bazy") zweryfikowane NIEZALEŻNIE na oryginale (`discovery.cjs:213-234`, `sync_delta.cjs:91-104`) — potwierdzone jako prawdziwe, nie jest błędem tego wniosku.
- Bramki: `lint`, `typecheck`, `build`, `test` (1330/1330, 87 plików) — zielone, potwierdzone uruchomieniem lokalnie.
- Regresja I8: `selly.gate.test.ts` (5 fixtures panelu Selly) przechodzi bez zmian kształtu.

### Missing or deviating ✗
- Aktualizacja `docs/rebuild-roadmap.md` (sekcja 13d) i `docs/rebuild-backlog.md` (#60) — patrz BLOCKER wyżej. Diff nie dotyka żadnego z tych plików mimo jawnego punktu w DoD.
- Drobne odstępstwo nieudokumentowane: dwie niezależne instancje `discovery` (app.ts/server.ts) zamiast jednej dzielonej — patrz SHOULD-FIX.

### Definition of done
- [x] Migracja `007` + model Drizzle; `selly_products` w kształcie wariantowym, `selly_products_old` zachowana
- [x] `limiter.ts`, `discovery.ts`, `mapper-v2.ts`, `sync-delta.ts`, `scheduler-sync.ts`, `routes/selly-sync.ts`
- [x] Cztery metody wariantowe w `KlientSelly` + `tryb.ts` + atrapa; test kompletności zielony
- [x] Trzy trasy Tor 1 za `requireAuth`, zamontowane; scheduler za `SELLY_SCHEDULER` (domyślnie OFF)
- [x] Trzy ścieżki w `contract/openapi.yaml`
- [x] Testy z „Testing strategy" zielone; żaden nie woła prawdziwego Selly
- [x] Istniejący GATE (5 fixtures Selly + reszta suity) bez regresji
- [x] `lint`, `typecheck`, `build`, `test` zielone w `rebuild/backend/`
- [ ] Roadmapa 13d/13d-1 + backlog #60 zaktualizowane; cztery defekty produkcji opisane — **niezrobione**, patrz BLOCKER

## Parallel-test concerns

None — wszystkie nowe testy (`selly.limiter`, `selly.discovery`, `selly.sync-delta`, `selly.mapper-v2`, `selly.scheduler-sync`, `selly.sync-trasy`, `migracje.selly-warianty`) chodzą na `stworzSrodowiskoTestowe()`/`stworzTestowaBaze()` (baza tymczasowa, izolowana per test) i atrapie klienta HTTP — zero portów efemerycznych, zero współdzielonych plików, zero realnego ruchu do Selly. Scheduler testowany przez bezpośrednie wołanie `tik(data)`, bez `setInterval`.

## Overall assessment

Port jest wyjątkowo staranny — każdy z sześciu plików źródłowych (`limiter`, `discovery`, `mapper_v2`, `sync_delta`, `scheduler_selly`, `routes_sync`) porównany linia po linii z oryginałem na `main` zgadza się co do kolejności kroków, dokładnych stringów (`action`, komunikaty błędów) i DDL migracji. Bezpieczeństwo Selly jest domknięte podwójnie (blokada `SELLY_TRYB` przez `Proxy` + scheduler za flagą domyślnie wyłączoną) i żaden test nie dotyka realnego API. Najpoważniejsze znalezisko to nie błąd w kodzie, tylko niedopełniony obowiązek dokumentacyjny wynikający wprost z CLAUDE.md i własnego DoD ticketa — roadmapa i backlog #60 nie odzwierciedlają zamknięcia karty 13d-1, co zmyli następną sesję planującą 13d-2/13d-3. Po uzupełnieniu tego wpisu i rozważeniu ujednolicenia instancji `discovery`, branch jest gotowy do mergu.
