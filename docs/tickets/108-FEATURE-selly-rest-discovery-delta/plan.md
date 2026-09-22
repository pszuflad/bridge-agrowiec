# 108-FEATURE-selly-rest-discovery-delta — Selly REST 1: nowy schemat `selly_products`, discovery, Tor 1

> Status: Approved
> Branch: `feature/108-selly-rest-discovery-delta`
> Worktree: `.worktrees/108-FEATURE-selly-rest-discovery-delta`
> Karta: `docs/karty/I15.6/` (Iteracja 15, fala 1, równolegle z I15.1)

## Ticket description
I15.6 — Selly REST 1: nowy schemat `selly_products` (migracja 013), odnajdywanie produktów (discovery)
i aktualizacje w ciągu dnia (Tor 1, `sync_delta`) — dawne 13d-1. Źródło prawdy: `origin/main` na `7d6cfc9`
(produkcja zamrożona od 22.09 — wersja ostateczna).

## Context
- Oryginał (`git show origin/main:mirror/backend/selly/…`): `discovery.cjs` (442 l.), `sync_delta.cjs` (187 l.),
  `rate_limiter.cjs` (64 l.). DDL: `origin/main:db/schema.sql:174-331`. Historia: CHANGELOG 2026-09-07 20:03
  (Ania przebudowała tabelę ręcznie: stara → `selly_products_old` z 2174 wpisami, nowa startowała pusta).
- Graf wywołań (reguła 3): `syncDelta` woła wyłącznie `scheduler_selly.cjs` (I15.8); `routes_sync.cjs` (I15.8)
  importuje nieistniejące `syncDeltaForDostawca` → trasa `sync-delta-supplier` na produkcji rzuca `TypeError`.
  `buildProductCodeCache` woła tylko `sync_full.cjs` (I15.7); `ensureMapping(db,row,dictMaps)` z mapami — tylko
  `sync_full.cjs:226`, a Tor 1 (`sync_delta.cjs:137`) woła go BEZ `dictMaps`.
- Ściąga: gałąź `feature/45-selly-rest-sync-tor1` (port z 08.09, cofnięty revertem #58). Jest STARSZA niż
  oryginał: brak kroku 3b (`buildProductCodeCache`, `findProductByCode/ProviderCode`, ochrona przed duplikatem
  w `createProduct`), brak gałęzi `wstrzymany` (#77) w `findDeltaProducts`, `createProduct` jako blokada (D5).
  Czytamy, nie kopiujemy.
- Odbudowa dziś: `selly_products` w starym kształcie (`001_schema.sql:257-272`), jedyny konsument
  `repos/selly.ts` (panel I8). `KlientSelly` wąski, `tryb.ts` dzieli metody na zapis/odczyt z testem kompletności.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
**Karta nie dodaje żadnej trasy HTTP** (trasy `sync-*` i scheduler = I15.8). Moduły discovery/delta/limiter są
wewnętrzne. Gate kontraktu = **regresja panelu I8** po zmianie tabeli:
`GET /api/selly/status`, `GET /api/selly/log`, `GET /api/selly/ping`, `GET /api/selly/dictionaries`,
`GET /api/selly/csv-status` — fixtures `contract/fixtures/GET_selly_*.json` przez istniejący
`test/selly.gate.test.ts` (musi zostać zielony bez zmian w fixtures). `status` joinuje po `bridge_kod` —
kolumna zostaje w nowej tabeli, więc kształt/wartości bez zmian.
Zachowanie nowych modułów sprawdzamy testami na atrapie względem oryginału (linie w komentarzach).

## Decisions
Użytkownik, 2026-09-22 (KROK 0 + runda pytań):
- **Podsumowanie logiki Selly od Ani** — jeszcze go nie ma; port idzie z kodu.
- **D1 `createProduct` — budowanie payloadu wstrzykiwane.** `discovery` portowany w całości 1:1 (łącznie
  z `createProduct`, ochroną przed duplikatem i retry po 400 „Istnieje produkt o tym kodzie”), a funkcję
  `buildProductPayload` (`mapper_v2.cjs`, własność I15.7) podaje wołający jako zależność. I15.7 wpina mapper_v2.
  Backlog #68 jest nieaktualny: funkcja istnieje od 08.09 15:12; ścieżka działa w Torze 2, w Torze 1 jest
  nieosiągalna z definicji (brak `dictMaps`).
- **D2 cache kodów produktów (krok 3b) — portowany teraz, w całości** (`buildProductCodeCache`,
  `rebuildProductCodeCache`, `findProductByCode`, `findProductByProviderCode`).
- **D3 defekty zastane 1:1:** #66 (martwe ponawianie po 429), #69 (`pending_create` bez śladu w bazie),
  #70 (UPSERT nie odświeża `ostatni_status`), brak sprzątania mapowań po usunięciu produktu (#100 po cutoverze),
  `dryRun` w `syncDelta` nadal odpala discovery (może utworzyć wariant) — jak oryginał.
- **⚠ ŚWIADOME ODSTĘPSTWO — D4 naprawa #67.** Stary `POST /api/selly/sync-supplier` (I8), gałąź CREATE, zapisuje
  mapowanie z `kod_importu` i `dostawca` produktu — na produkcji INSERT pada na `NOT NULL` i kolejny przebieg
  zakłada w Selly duplikat. Dodatkowo: produkt bez `kod_importu`/`dostawca` (w snapshocie 0 z 7405) kończy się
  błędem PRZED wywołaniem Selly, żeby nie zakładać produktu, którego mapowania nie da się zapisać. Gałąź UPDATE
  bez zmian (1:1).
- **D5 migracja 013 „czysta”** — `RENAME` + `DROP INDEX idx_selly_products_status` + `CREATE` z DDL verbatim;
  danych nie przenosimy (Ania też nie). Na produkcji tabela już ma nowy kształt → migracja padnie
  (`there is already another table named selly_products_old`) i wycofa transakcję; cutover weryfikuje kształt
  i odnotowuje 013 w `_migracje` (wzorzec z `docs/cutover.md` §5 dla 002). Zapis → „Do koordynatora”.
- **D6 nazwy/architektura** (moje, techniczne): pliki w `src/selly/rest/` (własność karty); stan procesu
  (cache `feature_id`, cache kodów) w domknięciu `stworzDiscovery()` — jedna instancja na proces (montuje
  I15.7/I15.8); klient zamiast generycznego `api()` dostaje nazwane metody (klasyfikowalne w `tryb.ts`, jak
  D7 z ticketu 45): `listProductsByEan`, `listProductsPage`, `listVariants`, `createVariant`, `updateVariant`.
  `syncDelta` eksportowany pod tą nazwą (nie `syncDeltaForDostawca` — decyzja o awarii trasy należy do I15.8).
- **#74** — `selly_category_id` bierze się z `dictMaps.catMap` (dane z `selly_kategoria_norm_map`), zero ID
  w kodzie. Ładowanie map (`sync_full.loadDictMaps`) to I15.7.

## Implementation plan
1. **Migracja + model** — `rebuild/schema/013_selly_products_warianty.sql`; `db/schema.ts`: `sellyProducts`
   w nowym kształcie + `sellyProductsOld` (tylko tabele Selly); `rebuild/schema/README.md` wiersz 013.
   `repos/selly.ts`: INSERT gałęzi CREATE z `kodImportu`/`dostawca` (D4) + guard.
   Testy: `test/migracje.selly-warianty.test.ts` (kształt, indeksy wg produkcji, stare wiersze w `_old`,
   pad na bazie w kształcie produkcji), `db.migracje.test.ts` (lista + bilans 29 tabel / 19 indeksów),
   `selly.synchronizacja.test.ts` (CREATE zapisuje mapowanie; drugi przebieg = UPDATE, bez duplikatu).
2. **Klient + tryb** — typy wariantów i pięć metod w `klient.ts`; `tryb.ts` (zapis: `createVariant`,
   `updateVariant`; odczyt: `listProductsByEan`, `listProductsPage`, `listVariants`); atrapa rozszerzona
   o model produktów/wariantów w pamięci; `selly.klient.test.ts` — ścieżki/ciała metod (fetch atrapowany).
3. **`rest/limiter.ts`** — port `RateLimiter` 1:1 (250/60 s, `MIN_INTERVAL_MS` 240, `getStats`) z wstrzykiwanym
   zegarem/uśpieniem dla testów; `globalnyLimiter`.
4. **`rest/discovery.ts`** — `stworzDiscovery({ klient, limiter?, budujPayloadProduktu })`: `ensureMapping`
   (kroki 1–5, SQL verbatim przez `db.$client`), `findProductByEan`, `fetchVariants`, `findVariantForDostawca`,
   `createVariant`, `createProduct`, `apiWithRetry` (martwa gałąź 429), cache `feature_id`
   (`WAREHOUSE_FEATURE_IDS`), cache kodów.
5. **`rest/sync-delta.ts`** — `findDeltaProducts` (SQL verbatim z #77), `syncDelta(db, discovery, dostawca, opts)`,
   `markSynced`/`markError` (`pending_create` vs `error`), log `selly_sync_log` (`sync_delta`, `ALL`).
6. Testy discovery/sync-delta/limiter na atrapie + test SELLY_TRYB (`tylko-odczyt` blokuje `createVariant`/
   `updateVariant` wywoływane przez discovery/delta).

## Testing strategy
- Gate I8: `selly.gate.test.ts`, `selly.tryb*.test.ts` zielone bez zmian w fixtures.
- Migracja: struktura po `pragma table_info/index_list` vs DDL produkcji; zachowanie danych w `_old`.
- Discovery (atrapa, zero sieci): każda akcja (`cache_hit`, `found_variant`, `created_variant`,
  `created_product`, `not_found`), krok 3 (rodzeństwo), 3b (cache kodów), ochrona przed duplikatem,
  retry po 400, uczenie `feature_id`, #69/#70 odtworzone.
- Delta: filtr delty, #77 (`wstrzymany` z wariantem → stan 0; bez wariantu → pominięty), wymóg EAN i
  `kod_importu`, `dryRun`, `markSynced`, `markError`, wpis w `selly_sync_log`.
- Limiter: okno i odstęp na sztucznym zegarze.
- Prawdziwe Selly — nigdy. Bramki: lint, typecheck, build, test.

## Out of scope
`sync_full`/`mapper_v2`/`loadDictMaps` (I15.7), scheduler i trasy `sync-*` + ich wpięcie w `server.ts`/`app.ts`
(I15.8), `generator-csv.ts` (I15.3), usuwanie produktu z Selly (#100), naprawy #66/#69/#70.

## Definition of done
- [ ] 013 tworzy nową `selly_products` identyczną z produkcją, stara jako `selly_products_old`
- [ ] panel I8 działa na nowej tabeli; gate fixtures I8 zielony; #67 naprawiony i opisany jako odstępstwo
- [ ] discovery + Tor 1 + limiter przeportowane 1:1 z `7d6cfc9`, testy na atrapie
- [ ] nowe metody klienta sklasyfikowane w `tryb.ts`
- [ ] bramki backendu zielone
- [ ] karta, backlog (#60, #67, #68, #69, #70, #74, #77), wpis spec, wejścia dla I15.7/I15.8, „Do koordynatora” (cutover)
