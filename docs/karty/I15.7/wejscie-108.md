# Wejście dla I15.7 od ticketu 108 (I15.6) · 2026-09-22

Karta I15.6 przeportowała `src/selly/rest/{limiter,discovery,sync-delta}.ts`. Dla Toru 2 (`sync_full`/
`mapper_v2`, własność I15.7) istotne jest:

- **`budujPayloadProduktu` jest wstrzykiwany do discovery** (D1 karty I15.6) —
  `stworzDiscovery({ klient, limiter?, budujPayloadProduktu })`. I15.7 wpina tu
  `mapper_v2.buildProductPayload` (port) pod tę samą nazwę parametru; discovery sam funkcji nie definiuje.
- **`loadDictMaps` (port `sync_full.cjs`) należy do I15.7.** `ensureMapping(db, row, dictMaps)` z mapami
  (`catMap` itd.) woła dziś wyłącznie `sync_full.cjs:226` w oryginale — Tor 1 (`sync_delta.cjs:137`) woła
  `ensureMapping` BEZ `dictMaps`. `#74`: `selly_category_id` bierze się z `dictMaps.catMap`
  (dane z tabeli `selly_kategoria_norm_map`), zero ID zahardkodowanych w kodzie.
- **`sync_full` woła `discovery.ensureMapping(db, row, dictMaps)` i `discovery.buildProductCodeCache()`**
  — nazwy funkcji zachowane 1:1 jak w oryginale (nie przemianowywać przy porcie).
  `buildProductCodeCache` woła dziś wyłącznie `sync_full.cjs`.
- **JEDNA instancja `discovery` na proces, wspólna z Torem 1** — stan procesu (nauczone `feature_id`,
  cache kodów produktów) żyje w domknięciu `stworzDiscovery()`. Montaż (kto tworzy tę jedną instancję,
  prawdopodobnie `server.ts`) to zakres I15.8, ale I15.7 musi konsumować tę samą instancję, nie tworzyć
  własną — inaczej cache się nie dzieli i nie uczy między torami.
- **Nie korzystać z `feature/45-selly-rest-sync-tor1` jako ściągi.** Ta gałąź jest STARSZA niż stan
  `origin/main` na `7d6cfc9`: brakuje w niej kroku 3b (`buildProductCodeCache`,
  `findProductByCode`/`findProductByProviderCode`), gałęzi `wstrzymany` (#77) w delcie, a `createProduct`
  tam jest zaślepiony jako blokada; trzy UPSERT-y discovery scalała w jeden inaczej niż verbatim
  (nadpisywanie `bridge_kod`). Czytać `origin/main:mirror/backend/selly/{discovery,sync_full}.cjs`.
- **Klient (`selly/klient.ts`) ma dziś** `listProductsByEan`, `listProductsPage`, `listVariants`,
  `createVariant`, `updateVariant`. Jeśli `sync_full` (Tor 2) potrzebuje `getProduct`/`PUT product`
  z cechami (#81) — nowa metoda **MUSI** trafić do `METODY_ZAPISUJACE`/`METODY_ODCZYTU` w `tryb.ts`
  (test kompletności `satisfies Record<keyof KlientSelly, unknown>` w `test/selly.tryb.test.ts` wymusi
  to i tak, ale nie pomiń klasyfikacji przy dodawaniu metody).
