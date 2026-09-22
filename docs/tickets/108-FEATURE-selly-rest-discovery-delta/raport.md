# 108-FEATURE-selly-rest-discovery-delta — Implementation report

## Summary
Karta I15.6 (dawne 13d-1) przeniesiona świeżo z `origin/main` (`7d6cfc9`, produkcja zamrożona): migracja 013
przebudowuje `selly_products` na model wariantowy (stara tabela → `selly_products_old`), a w `src/selly/rest/`
powstały ogranicznik zapytań, discovery (lazy odnajdywanie/zakładanie mapowań, cache kodów produktów,
`createProduct` z wstrzykiwanym builderem payloadu) i Tor 1 (`syncDelta`, z #77). Panel Selly z I8 działa na
nowej tabeli; jego stary `sync-supplier` zapisuje mapowanie poprawnie (#67 — świadome odstępstwo). Nic tego jeszcze
nie uruchamia — montaż harmonogramu i tras to I15.8.

## Changes
- **New:** `rebuild/schema/013_selly_products_warianty.sql` — `RENAME` starej tabeli, zwolnienie nazwy indeksu
  `_status`, nowa tabela i 6 indeksów verbatim z `origin/main:db/schema.sql:307-331`.
- `rebuild/schema/README.md` — wiersz 013 (z uwagą o cutoverze).
- `rebuild/backend/src/db/schema.ts` — `sellyProducts` w nowym kształcie, nowy `sellyProductsOld` (tylko tabele Selly;
  import `unique`).
- `rebuild/backend/src/repos/selly.ts` — gałąź CREATE `synchronizujJedenProdukt` zapisuje `kod_importu`/`dostawca`;
  produkt bez nich → błąd przed wywołaniem Selly (D4, #67).
- `rebuild/backend/src/selly/klient.ts` — typy wariantów + 5 metod: `listProductsByEan`, `listProductsPage`,
  `listVariants`, `createVariant`, `updateVariant`.
- `rebuild/backend/src/selly/tryb.ts` — `createVariant`/`updateVariant` w zapisach, trzy nowe odczyty.
- **New:** `rebuild/backend/src/selly/rest/limiter.ts` — port `rate_limiter.cjs` (250/60 s, 240 ms).
- **New:** `rebuild/backend/src/selly/rest/discovery.ts` — port `discovery.cjs` (nazwy funkcji z oryginału),
  `stworzDiscovery({ klient, budujPayloadProduktu, limiter?, spij? })`.
- **New:** `rebuild/backend/src/selly/rest/sync-delta.ts` — port `sync_delta.cjs` (`findDeltaProducts`, `syncDelta`).
- Testy: **new** `test/migracje.selly-warianty.test.ts`, `test/selly.discovery.test.ts`, `test/selly.sync-delta.test.ts`,
  `test/selly.limiter.test.ts`, `test/gate/selly-rest.ts`; zmienione `test/gate/selly-atrapa.ts` (sklep wariantowy
  w pamięci, `bledyRaz`, `magazynNowegoWariantu`), `test/gate/index.ts`, `test/db.migracje.test.ts` (013, bilans
  29 tabel / 19 indeksów), `test/selly.synchronizacja.test.ts` (#67), `test/selly.klient.test.ts` (ścieżki metod
  wariantowych), `test/selly.tryb.test.ts` (atrapa z `satisfies Record<keyof KlientSelly,…>`).

## Deviations from plan
Brak. Doprecyzowania: trzy UPSERT-y discovery zostały osobno i verbatim (port z ticketu 45 scalał je w jeden,
co zmieniało, czy `bridge_kod` jest nadpisywany); discovery wystawia `klient`, bo Tor 1 robi nim PUT.

## Test results
- **Gate odbudowy (fixtures/kontrakt):** ✓ — karta nie dodaje tras. Regresja panelu I8 po zmianie tabeli:
  `test/selly.gate.test.ts` (`GET /api/selly/{ping,dictionaries,status,log,csv-status}` vs `contract/fixtures/`)
  zielony bez zmian w fixtures; `selly.tryb.trasy.test.ts` zielony.
- Migracja: kształt kolumn/NOT NULL/UNIQUE/indeksów = produkcja; stare wiersze w `_old`; na bazie w kształcie
  produkcji migracja pada i wycofuje się (brak wpisu w `_migracje`).
- Unit/integracja (SQLite w katalogu tymczasowym + atrapa sklepu, zero sieci): discovery 15, Tor 1 13, limiter 6,
  klient +1, synchronizacja I8 +1 (#67).
- Całość `rebuild/backend`: lint ✓, typecheck ✓, build ✓, test ✓ — 96 plików, 1561 zaliczonych, 2 pominięte.

## Breaking changes
- Schemat: `selly_products` ma nowy kształt (migracja 013). **Na produkcji 013 się nie zastosuje** — obiekty już są;
  cutover musi zweryfikować kształt i odnotować 013 w `_migracje` (→ „Do koordynatora” w karcie).
- Zachowanie: stary `sync-supplier`/`sync-product` (I8) zapisuje mapowanie zamiast padać (#67, odstępstwo D4).

## Follow-up
- **I15.7:** wpiąć `mapper_v2.buildProductPayload` jako `budujPayloadProduktu` i `loadDictMaps` (#74 — mapy z danych);
  jedna instancja discovery na proces (wspólna z Torem 1).
- **I15.8:** montaż `syncDelta` w harmonogramie; decyzja o `routes_sync.cjs` importującym nieistniejące
  `syncDeltaForDostawca` (produkcja: `TypeError` na `sync-delta-supplier`); przed biegiem sprawdzić `SELLY_TRYB` —
  przy `wylaczony` discovery połyka blokadę odczytu i oznacza pozycje jak „produkt nie istnieje”.
- Po naprawie #67 produkt założony starym przyciskiem ma mapowanie bez `selly_variant_id`; Tor 1 odnajdzie go po EAN,
  ale domyślny wariant nie ma cechy „Magazyny”, więc discovery dołoży DRUGI wariant. Stan lepszy niż na produkcji
  (tam powstaje kolejny produkt), ale do rozważenia z Anią po cutoverze.
- `dryRun` Toru 1 nie chroni przed `createVariant` w discovery — zastane 1:1; twardą blokadą jest `SELLY_TRYB`.
- Defekty zostawione 1:1 do decyzji Ani po cutoverze: #66, #69, #70, osierocone mapowania (#100).

## Review fixes applied
- BLOCKER (dokumentacja handoffu: karta, backlog, wpis spec, wejścia I15.7/I15.8) — realizowany w fazie „sync docs” tego ticketu.
- NICE-TO-HAVE: atrapa `createVariant` — opcja `featureIdNowegoMagazynu` (wybór dostawcy przez `Object.keys()[0]`)
  zastąpiona jawną parą `magazynNowegoWariantu: { dostawca, featureId }`.
