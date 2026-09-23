# 108-FEATURE-selly-rest-discovery-delta — Code review

> Reviewed: 2026-09-22
> Branch: `feature/108-selly-rest-discovery-delta`
> Diff: 22 pliki, 4 commity (vs `origin/develop`)

## BLOCKER

- [ ] `docs/karty/I15.6/karta.md`, `docs/rebuild-backlog.md` (#60, #67, #68, #69, #70, #74, #77), `docs/spec-backend/`, `docs/karty/I15.7/`, `docs/karty/I15.8/` — dokumentacja handoffu NIE zaktualizowana, mimo że to jawny punkt Definition of done w `plan.md` tego ticketu.
  - Reason: `git diff origin/develop...HEAD --stat -- docs/` pokazuje wyłącznie `plan.md` i `raport.md` — żaden plik `docs/karty/**`, `docs/rebuild-backlog.md` ani `docs/spec-backend/` nie został tknięty. Konkretne skutki:
    - `docs/karty/I15.6/karta.md` nadal ma nagłówek stanu sprzed startu prac (`⬜ gotowe (fala 1)`, wzorcowo domknięte karty mają `✅ <data> · <ticket>` — patrz `docs/karty/P10.1/karta.md` i inne), a sekcje „Dowiezione” i „Do koordynatora” są puste (`—`), mimo że plan.md D5 explicite każe zapisać tam notatkę o migracji 013 na cutoverze („Zapis → „Do koordynatora”.”).
    - `docs/rebuild-backlog.md` wpis **#67** wciąż twierdzi „✅ TAK — odtworzone 1:1 (…) u Ani ten sam defekt jest aktywny” — to jest FAKTYCZNIE NIEPRAWDA po tym tickecie: `repos/selly.ts` naprawia #67 (decyzja D4, świadome odstępstwo), backlog temu przeczy. Wpisy #60/#68/#69/#70/#74/#77 też nie zostały zaktualizowane pod realny stan portu z ticketu 108 (nadal opisują cofnięty port z ticketu 45/13d-1, np. #60 mówi „⛔ ODŁOŻONE — start wstrzymany”).
    - `docs/karty/I15.7/` i `docs/karty/I15.8/` nie mają żadnego `wejscie-108.md` — kluczowe ustalenia z tego ticketu (jedna wspólna instancja `discovery` w procesie inaczej cache się nie uczy i nie dzieli, `dictMaps`/`budujPayloadProduktu` jako zależność wstrzykiwana, `syncDelta` eksportowane pod właściwą nazwą wobec błędnego importu w `routes_sync.cjs`, `SELLY_TRYB=wylaczony` maskuje się jako „produkt nie istnieje”) leżą wyłącznie w `raport.md` sekcja „Follow-up” i w komentarzach kodu — CLAUDE.md wprost ostrzega, że notatka schowana w cudzym pliku „do przyszłej karty nie dojdzie”.
    - Brak `docs/spec-backend/wpis-108.md`.
  - Suggestion: domknąć kartę I15.6 (`✅ 2026-09-22 · 108-…`, sekcja „Dowiezione” = realny zakres, „Do koordynatora” = notatka o 013 na cutoverze z D5), zaktualizować siedem wpisów backlogu (zwłaszcza sprostować #67 — realnie NAPRAWIONE, nie „1:1”), dopisać `docs/karty/I15.7/wejscie-108.md` i `docs/karty/I15.8/wejscie-108.md` z treścią sekcji „Follow-up” raportu, założyć `docs/spec-backend/wpis-108.md`. Odhaczyć odpowiedni punkt DoD w `plan.md`.

## SHOULD-FIX

Brak — kod (port `discovery.ts`/`sync-delta.ts`/`limiter.ts`, migracja 013, odstępstwo D4, klasyfikacja `tryb.ts`) sprawdzony linia po linii wobec oryginału (`origin/main:mirror/backend/selly/{discovery,sync_delta,rate_limiter,client}.cjs`, `db/schema.sql:174-331`) jest wierny, dobrze udokumentowany i pokryty testami.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/gate/selly-atrapa.ts:~220` — atrapa `createVariant` wybiera `feature_id` uczenia przez `Object.keys(opcje.featureIdNowegoMagazynu ?? {})[0]`, czyli zawsze PIERWSZY klucz mapy, niezależnie od `dostawca`, dla którego akurat zakładany jest wariant. Dziś żaden test nie podaje więcej niż jednego wpisu, więc nie daje fałszywych zielonych testów, ale przy rozszerzeniu na wielu dostawców naraz mogłoby zwrócić niewłaściwy `feature_id` bez ostrzeżenia testu.

## Plan compliance

### Done ✓
- Migracja `013_selly_products_warianty.sql` (`RENAME` + `DROP INDEX` + `CREATE` verbatim z `origin/main:db/schema.sql:307-331`), model Drizzle `sellyProducts`/`sellyProductsOld`, wpis w `rebuild/schema/README.md`.
- `repos/selly.ts` — gałąź CREATE zapisuje `kodImportu`/`dostawca`, guard przed wywołaniem Selly (D4, #67) — umieszczony poprawnie PRZED `klient.createProduct`.
- `klient.ts` + `tryb.ts` — pięć metod wariantowych, sklasyfikowane w `METODY_ZAPISUJACE`/`METODY_ODCZYTU`; test kompletności `satisfies Record<keyof KlientSelly, unknown>` w atrapie.
- `rest/limiter.ts` — port `RateLimiter` 1:1, zegar/uśpienie wstrzykiwane wyłącznie do testów.
- `rest/discovery.ts` — `ensureMapping` (5 kroków), `createProduct` (ochrona przed duplikatem + retry po 400), cache kodów (3b), cache `feature_id`, `apiWithRetry` (martwa gałąź 429 zachowana i udokumentowana), `mapper.buildProductPayload` wstrzykiwany (D1).
- `rest/sync-delta.ts` — `findDeltaProducts` (SQL verbatim, #77), `syncDelta`, `markSynced`/`markError` (rozróżnienie `pending_create` po treści komunikatu — kontrakt z discovery zachowany).
- Testy: discovery (15), Tor 1 (13), limiter (6), klient (+1, serwer HTTP lokalny na porcie efemerycznym), synchronizacja I8 (+1, #67), migracja (kształt + baza z danymi + baza już-po-cutoverze).
- Gate I8 (`selly.gate.test.ts`, fixtures `contract/fixtures/GET_selly_*.json`) nietknięty, zielony.
- Bramki: lint ✓, typecheck ✓, build ✓, test ✓ (96 plików, 1561 zaliczonych, 2 pominięte) — zweryfikowane ponownie w tym review.

### Missing or deviating ✗
- Domknięcie dokumentacji handoffu (karta, backlog, spec, wejścia dla I15.7/I15.8) — patrz BLOCKER. To jedyne odstępstwo od `plan.md`; sam kod jest zgodny z planem.

### Definition of done
- [x] 013 tworzy nową `selly_products` identyczną z produkcją, stara jako `selly_products_old`
- [x] panel I8 działa na nowej tabeli; gate fixtures I8 zielony; #67 naprawiony i opisany jako odstępstwo
- [x] discovery + Tor 1 + limiter przeportowane 1:1 z `7d6cfc9`, testy na atrapie
- [x] nowe metody klienta sklasyfikowane w `tryb.ts`
- [x] bramki backendu zielone
- [ ] karta, backlog (#60, #67, #68, #69, #70, #74, #77), wpis spec, wejścia dla I15.7/I15.8, „Do koordynatora” (cutover) — NIE zrobione (patrz BLOCKER)

## Parallel-test concerns

None — all tests parallelizable. Baza w każdym teście to prawdziwy SQLite w katalogu tymczasowym (`stworzTestowaBaze`/`mkdtempSync`), klient HTTP testowy (`selly.klient.test.ts`) stoi na porcie efemerycznym (`listen(0)`), atrapa Selly trzyma stan w domknięciu per test. Żaden test nie woła prawdziwego Selly.

## Overall assessment

Sam port (`discovery.ts`, `sync-delta.ts`, `limiter.ts`, migracja 013, odstępstwo D4, klasyfikacja `tryb.ts`) jest wyjątkowo starannie zweryfikowany linia po linii wobec oryginału, z jawnym rozpisaniem semantyki `apiWithRetry`/unwrappingu odpowiedzi klienta i pułapek zastanych (#66/#69/#70/#77) — testy są konkretne, deterministyczne i faktycznie dowodzą zgodności z `7d6cfc9`. Jedyny realny problem to brak aktualizacji dokumentacji handoffu (karta I15.6, backlog #60/#67/#68/#69/#70/#74/#77, wejścia dla I15.7/I15.8, wpis spec) — to jest jawnie odhaczalny punkt DoD w `plan.md`, którego zabrakło, a projekt ma udokumentowaną historię realnych szkód z tego właśnie powodu (notatki gubione między sesjami/kartami). Do zmergowania wystarczy dopisać brakujące pliki dokumentacji; kodu nie trzeba ruszać.
