# 109-FEATURE-selly-rest-sync-full — Selly REST 2: nocna pełna synchronizacja (Tor 2)

> Status: Draft
> Branch: `feature/109-selly-rest-sync-full`
> Worktree: `.worktrees/109-FEATURE-selly-rest-sync-full`
> Karta: `docs/karty/I15.7/` (karta.md + wejscie-108.md)

## Ticket description
I15.7 — port TS `origin/main@7d6cfc9:mirror/backend/selly/sync_full.cjs` (336 l.) i `mapper_v2.cjs` (235 l.),
w tym #81 (ścieżka A z cechami i `category_id`, `metadataScore`/`isMetadataOwner`, `buildFeaturesMirror` bez
dziedziczenia pustej cechy zarządzanej). Sprawdzić #101 (blokowane formy płatności w payloadzie auto-create).
Defekty zastane 1:1. Testy wyłącznie na atrapie Selly.

## Context
- I15.6 (ticket 108) dała `src/selly/rest/{limiter,discovery,sync-delta}.ts`. Discovery przyjmuje
  `budujPayloadProduktu` (wstrzykiwany), eksportuje `ensureMapping`, `buildProductCodeCache`, `apiWithRetry`, `klient`.
- Graf wywołań (7d6cfc9): `syncFullForDostawca` ← `scheduler_selly.cjs:93` (`runFullBatch`, `buildCache: i===0`)
  i `routes_sync.cjs:72` (`{autoCreate}`); `loadDictMaps`/`collectFullSyncItems` ← tylko `sync_full.cjs`;
  `buildProductPayload` ← `discovery.cjs:213`; `toSellyPayloadV2` ← `sync_full.cjs` (3×) + `buildProductPayload`.
- `toDeltaPayload`, `DOSTAWCA_TO_MAGAZYN_FEATURE_ID`, `getMagazynFeatureIdForDostawca` — nigdzie niewołane.
- Klient ma `updateProduct` (PUT `/api/products/{id}`, zapis). Brak `getProduct` (GET `/api/products/{id}`),
  którego potrzebuje ścieżka A.
- Schemat kompletny (migracja 013 + `selly_sync_log`, `selly_kategoria_norm_map`, `selly_dict`) — brak migracji.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
**Brak (nie dotyka kontraktu).** Karta nie dodaje ani nie zmienia trasy HTTP — trasy `sync-full-*` montuje I15.8.
`contract/openapi.yaml` i `contract/fixtures/` nie mają tras `sync-*`. Regresja: `selly.gate.test.ts` (panel I8)
musi zostać zielony bez zmian w fixtures. Zgodność z oryginałem dowodzimy testami na atrapie (payloady PUT/POST,
zapisy w `selly_products`/`selly_sync_log`).

## Decisions
- **D1 — martwe eksporty `mapper_v2` pomijamy** (decyzja użytkownika 2026-09-22): `toDeltaPayload`, mapa magazynów
  i `getMagazynFeatureIdForDostawca`. Brak wpływu na zachowanie; precedens `klient.ts` (bez nieużywanych metod);
  unika drugiej mapy `feature_id` obok `WAREHOUSE_FEATURE_IDS` w discovery.
- **D2 — sygnatura Toru 2: `syncFullForDostawca(db, discovery, dostawca, opts)`** — nazwa 1:1, instancja discovery
  jako argument (wzorzec `syncDelta(db, discovery, dostawca, opts)`), I15.7 NIE tworzy własnej instancji.
- **D3 — nowa metoda klienta `getProduct(id)`** (`GET /api/products/{id}`) w `METODY_ODCZYTU`. PUT idzie istniejącym
  `updateProduct` (już w `METODY_ZAPISUJACE`). Nieaktualny komentarz w `klient.ts` („getProduct niewołany”) poprawiam.
- **D4 — `#81` jest stanem produkcji, nie odstępstwem** — portujemy wersję po `5dedefb` wiernie.
- **D5 — #101 tylko opis**: payload REST nie niesie „blokowanych form płatności” (było tylko w CSV). Bez naprawy;
  wejście dla koordynatora.
- **Defekty/osobliwości zastane odtwarzane 1:1** (bez zmian zachowania):
  - gałęzie „HTTP status spoza 2xx” po PUT są martwe (klient rzuca) — jak w Torze 1;
  - `createVariant` z discovery dostaje wiersz z kolumną `vat` (nie `vat_rate`) → zawsze `vat: 23`;
  - `markError` Toru 2 klasyfikuje `/Brak kategorii|Brak producenta/` → `missing_dict`, inaczej `error` (inna niż
    Tor 1); jak w Torze 1 sam `UPDATE` bez `INSERT` (#69);
  - `metadataScore` liczy `0` jako wypełnione (tylko `null`/`''` puste);
  - `dryRun` w ścieżce A nie robi GET, w B/C nie woła discovery → Tor 2 w dry-run nie dotyka Selly poza budową cache;
  - `details.limiter` z globalnego limitera (`globalnyLimiter.getStats()`), jak `globalLimiter` w oryginale.

## Implementation plan
1. **Klient + tryb:** `KlientSelly.getProduct(id)` → `dane("GET", /api/products/${id})`; typ odpowiedzi
   `{ data?: ProduktSzczegoly } | ProduktSzczegoly | null` z `features?: CechaProduktu[]` (`{name, values}`);
   `METODY_ODCZYTU += "getProduct"`; atrapa: `getProduct` (zwraca `{data: {product_id, features}}`),
   `ProduktSklepu.features?`, `updateProduct` zapisuje `features`/`category_id` do sklepu (efekt widoczny w teście);
   `stworzAtrapeBezKonfiguracji` += `getProduct`. Commit.
2. **`src/selly/rest/mapper-v2.ts`:** port 1:1 `yn`, `txt`, `num`, `zastosowaniePierwsze`, `FEATURE_MAP`,
   `buildFeatures`, `buildFeaturesMirror`, `toSellyPayloadV2`, `buildProductPayload` (typ zgodny z
   `BudujPayloadProduktu`, obsługa `Map` i obiektu). Test `test/selly.mapper-v2.test.ts`. Commit.
3. **`src/selly/rest/sync-full.ts`:** `collectFullSyncItems` (SQL verbatim), `loadDictMaps`, `logSyncStart/End`
   (`operacja='sync_full'`), `markProductSynced`, `markError`, `metadataScore`, `isMetadataOwner`,
   `updateExistingVariant` (ścieżka A: GET przez `discovery.apiWithRetry(…, klient.getProduct)`, PUT przez
   `klient.updateProduct`), `ensureAndUpdate` (B/C przez `discovery.ensureMapping(db, row, dictMaps)`),
   `syncFullForDostawca` (cache przez `discovery.buildProductCodeCache()` przy `buildCache && autoCreate`, błąd
   połykany z ostrzeżeniem). Test `test/selly.sync-full.test.ts`. Commit.
4. Bramki: lint, typecheck, build, test (Node 20).

## Testing strategy
Integracyjne na prawdziwej SQLite (`stworzTestowaBaze`) + atrapa Selly (zero sieci), bez mocków bazy:
- mapper: 21 cech i transformacje (`yn` 0/1/'Tak'/boolean, `num`, `zastosowanie` pierwsze z `+`), brak VAT,
  `ean` tylko przy `ean_is_valid`, mirror: zachowanie cech spoza mapy, nadpisanie zarządzanych, brak dziedziczenia
  pustej zarządzanej (#81), dopisanie nowych; `buildProductPayload`: `_error` kategorii/producenta, `product_code` bez `_`,
  `category_id` z norm_map (klucz lowercase).
- sync_full: ścieżka A właściciel (GET + PUT z `features` i `category_id`) vs nie-właściciel (PUT bez cech);
  grupa z różnymi kategoriami → nikt nie pisze cech; wybór właściciela po `metadataScore`, remis po `id`;
  ścieżka B (produkt po EAN, nowy wariant) i C (auto-create przez prawdziwy `buildProductPayload`, `category_id`
  z `selly_kategoria_norm_map` — #74); `autoCreate:false` → skip; `dryRun` → zero wywołań zapisujących i GET;
  błędy → `missing_dict`/`error` w `selly_products`, status logu `blad` gdy 0 OK; `maxProducts`;
  `buildCache` tylko przy `autoCreate`; `SELLY_TRYB=tylko-odczyt` → zero zapisów w sklepie.
- tryb: test kompletności obejmuje `getProduct`.

## Out of scope
Harmonogram i rotacja dostawców, trasy `sync-*`, montaż jednej instancji discovery z `buildProductPayload`
w serwerze (I15.8); `generator-csv.ts` (I15.3); migracje; naprawa #101; bug `runFullTodays` (I15.8).

## Definition of done
- [ ] `mapper-v2.ts` i `sync-full.ts` portują oryginał 1:1 (poza D1), #81 w całości.
- [ ] `getProduct` w kliencie, atrapie i `METODY_ODCZYTU`; test kompletności zielony.
- [ ] Testy mappera i Toru 2 na atrapie; żaden test nie woła sieci.
- [ ] lint, typecheck, build, test zielone; `selly.gate.test.ts` bez zmian w fixtures.
- [ ] Karta I15.7: stan, Dowiezione, Do koordynatora (#101, sygnatura, rotacja/`buildCache`, `SELLY_TRYB`);
      wejście dla I15.8.
