# Wejście dla I15.8 od ticketu 109 (I15.7) · 2026-09-22

Karta I15.7 przeportowała `src/selly/rest/{mapper-v2,sync-full}.ts` (Tor 2). Dla harmonogramu i
tras (własność I15.8) istotne jest:

- **Eksport Toru 2 to `syncFullForDostawca(db, discovery, dostawca, opts)`** z
  `src/selly/rest/sync-full.ts` — nazwa zgodna z oryginałem. `opts = { dryRun=false,
  maxProducts=5000, autoCreate=true, buildCache=true }`, zwraca `{ stats, errors, logId,
  durationMs }`. Instancja `discovery` jest argumentem — Tor 2 jej sam nie tworzy; ma to być ta
  SAMA instancja co dla Toru 1 (I15.6), montowana raz na proces (patrz `wejscie-108.md`).
- **Mapper wpina się przez `budujPayloadProduktuV2`** z `src/selly/rest/mapper-v2.ts` — to jest
  funkcja do wstrzyknięcia w `stworzDiscovery({ klient, limiter?, budujPayloadProduktu:
  budujPayloadProduktuV2 })`, jeśli montaż I15.8 chce Tor 2 z auto-create.
- **Rotacja dostawców i `buildCache` NIE są w Torze 2** — to zakres harmonogramu
  (`scheduler_selly.cjs:82-102`, `runFullBatch` w oryginale): `suppliers = opts.suppliers ||
  suppliersForFullToday(new Date())`, a `buildCache: i === 0` (cache kodów Selly budowany raz na
  całą partię, nie per dostawca). I15.8 musi to odtworzyć przy wołaniu `syncFullForDostawca` w
  pętli.
- **Bug produkcji — `routes_sync.cjs` importuje nieistniejące `runFullTodays`** (scheduler
  eksportuje `runFullBatch`), więc `POST /api/selly/sync-full-today` i
  `POST /api/selly/sync-full-force` na produkcji zawsze kończą się 500.
  `POST /api/selly/sync-full-supplier` woła `syncFullForDostawca` bezpośrednio i działa. Decyzja
  do podjęcia w I15.8 (analogicznie do `syncDeltaForDostawca` z `wejscie-108.md` w tej karcie):
  odtworzyć awarię 1:1 (nazwa importu zgodna z produkcją, trasy `sync-full-today`/`sync-full-force`
  wybuchają) czy naprawić import na `runFullBatch` — to decyzja użytkownika, nie fakt do
  zgadnięcia.
- **Sprawdzić `SELLY_TRYB` przed biegiem Toru 2.** W `tylko-odczyt` każdy rekord kończy się błędem
  i Tor 2 zapisuje `ostatni_status='error'` w całej partii (zmierzone testem w I15.7) — ta sama
  zasada jak dla Toru 1 (`wejscie-108.md`): harmonogram powinien sprawdzić tryb przed startem, nie
  polegać na tym, że dyskavery/klient sam zablokuje zapis w porę.
- **`getProduct` jest już w kliencie** (`src/selly/klient.ts`, `GET /api/products/{pid}`) i
  sklasyfikowany w `METODY_ODCZYTU` (`src/selly/tryb.ts`) — I15.8 nie musi nic dokładać do klienta
  ani do klasyfikacji trybu dla Toru 2.
