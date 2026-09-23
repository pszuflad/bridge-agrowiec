# I15.7 — Selly REST 2: nocna pełna synchronizacja (`sync_full`, `mapper_v2`, #81)

> **Stan:** ✅ 2026-09-22 · 109-FEATURE-selly-rest-sync-full
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #60, #81 · **Zależy od:** I15.6
> **Ticket:** `109-FEATURE-selly-rest-sync-full`

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Dawne 13d-2. Port TS z `origin/main`: `mirror/backend/selly/sync_full.cjs` (336 l.) i `mapper_v2.cjs` (235 l.):
ścieżka A (`GET /api/products/{pid}` → payload z `includeFeatures:true` → `PUT` z cechami i `category_id`),
auto-create, **#81**: `metadataScore()`/`isMetadataOwner()` (jeden kanoniczny rekord pisze cechy i kategorię
wspólnego produktu; grupa o różnych kategoriach pomijana), usunięta martwa `fetchVariantFeatures()`,
`buildFeaturesMirror()` nie dziedziczy starej wartości cechy zarządzanej przez Bridge, gdy bieżąca jest pusta.
⚠ Ustalenie z 08.09 „PUT nie przyjmuje features” jest **OBALONE** (test produkcyjny 17.09, `5dedefb`) — patrz blok 13d.
⚠ Bezpieczeństwo jak w I15.6.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/rest/sync-full*`, `mapper*` (+ testy). NIE: pliki I15.6 poza importem ich API.

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

## Dowiezione
Ticket `109-FEATURE-selly-rest-sync-full`, 2026-09-22.
- **Nowe:** `src/selly/rest/mapper-v2.ts` — 21 cech (`FEATURE_MAP`), `yn`/`txt`/`num`/
  `zastosowaniePierwsze`, `buildFeatures`, `buildFeaturesMirror` (#81 — bez dziedziczenia pustej
  cechy zarządzanej), `toSellyPayloadV2`, `buildProductPayload` + `budujPayloadProduktuV2` (gotowe
  do wstrzyknięcia w `stworzDiscovery`).
- **Nowe:** `src/selly/rest/sync-full.ts` — `collectFullSyncItems`, `loadDictMaps`,
  `syncFullForDostawca(db, discovery, dostawca, opts)`, prywatne `logSyncStart`/`logSyncEnd`/
  `markProductSynced`/`markError`/`metadataScore`/`isMetadataOwner`/`updateExistingVariant`/
  `ensureAndUpdate`.
- **Klient:** `getProduct(productId)` (`GET /api/products/{pid}`) w `src/selly/klient.ts`,
  sklasyfikowany w `METODY_ODCZYTU` (`src/selly/tryb.ts`); poprawiony nieaktualny komentarz
  („`getProduct` niewołany z żadnej trasy” — było prawdą dla `routes.cjs`, nie dla `sync_full.cjs`).
- **`discovery.ts`:** jedna zmiana typu — `PayloadProduktu.provider_code?: string | null` (mapper
  zwraca `null`, gdy wiersz nie ma ani `kod_importu`, ani `kod_dostawcy`); bez zmiany zachowania.
- Atrapa (`test/gate/selly-atrapa.ts`) rozszerzona: `getProduct`, cechy i `category_id` na poziomie
  produktu (`ProduktSklepu`), `updateProduct` zapisuje skutek PUT do stanu sklepu.
- **Decyzje D1–D5** wykonane zgodnie z planem: D1 pominięte martwe eksporty `mapper_v2`
  (`toDeltaPayload`, mapa magazynów, `getMagazynFeatureIdForDostawca` — udokumentowane w nagłówku
  `mapper-v2.ts`); D2 sygnatura `syncFullForDostawca(db, discovery, dostawca, opts)`, instancja
  discovery jako argument (nie tworzona przez kartę); D3 `getProduct` w kliencie/`METODY_ODCZYTU`;
  D4 port ze stanu produkcji po `5dedefb` (#81 w całości, ścieżka A z cechami i `category_id`); D5
  #101 tylko opisane, bez naprawy (patrz „Do koordynatora”).
- **Zastane defekty odtworzone 1:1:** gałęzie „PUT status spoza 2xx” martwe (klient rzuca na
  non-2xx); `createVariant` z discovery dostaje kolumnę `vat` (nie `vat_rate`) → nowy wariant
  zawsze `vat: 23`; `markError` Toru 2 ma własną klasyfikację (`missing_dict`/`error`), inną niż
  Tor 1 (`pending_create`), sam `UPDATE` bez `INSERT` (#69); `metadataScore` liczy `0` jako
  wypełnione (puste to tylko `null`/`''`); `dryRun` w ścieżce A nie robi GET, w B/C nie woła
  discovery; status logu `blad` tylko gdy były błędy i ANI JEDEN rekord się nie udał.
- **Rozliczenie `wejscie-108.md`:** wszystkie 5 punktów spełnione — mapper wpięty jako
  `budujPayloadProduktuV2`; `loadDictMaps` po stronie I15.7; nazwy `ensureMapping`/
  `buildProductCodeCache` zachowane 1:1; discovery konsumowany jako argument (karta nie tworzy
  własnej instancji); `getProduct` sklasyfikowany w `tryb.ts`.
- **Gate:** N/D — karta nie dodaje/zmienia żadnej trasy HTTP (trasy `sync-*` montuje I15.8);
  `contract/openapi.yaml` i `contract/fixtures/` bez tras `sync-*`. Regresja panelu I8
  (`selly.gate.test.ts`, `GET_selly_*.json`) zielona bez zmian w fixtures.
- **Bramki:** lint/typecheck/build/test zielone — 98 plików, 1587 testów, 2 pominięte (Node
  20.20.2). Żaden test nie woła sieci (atrapa `test/gate/selly-atrapa.ts`).

## Do koordynatora
- **#101 (blokowane formy płatności) — ZAMKNIĘTE 2026-09-23, nic do zrobienia.** Ania: „Nie widzę
  pustych pól tylko myślałam że nie mamy zrobionej tej logiki. Jest zrobiona to super zamknij temat."
  Pomiar na żywej produkcji (ticket 113): zero produktów z pustym polem, 6 triggerów w bazie.
  Zostaje sam FAKT z tego ticketu, przydatny przy porównaniach CSV ↔ REST: payload Toru 2 tego pola
  NIE niesie (`git grep -niE "payment|platnos|płatno|block" 7d6cfc9 -- mirror/backend/selly/` — zero
  trafień); wysyłał je wyłącznie stary eksport CSV (`generate_selly_export.cjs:75,142-143`, kolumna
  `Blokowane-formy-platnosci` z fallbackiem `paymentBlocks.getBlockedPaymentForms(dostawca)`).
  Luka na przyszłość: `BLOCKED_PAYMENT_FORMS` nie ma MO6 — dziś ten dostawca nie ma produktów.
- **Sygnatura Toru 2 dla I15.8:** `syncFullForDostawca(db, discovery, dostawca, opts)`,
  `opts = { dryRun=false, maxProducts=5000, autoCreate=true, buildCache=true }`, zwraca
  `{ stats, errors, logId, durationMs }`. Instancja discovery jest argumentem (JEDNA na proces,
  wspólna z Torem 1); mapper wpina się przez `budujPayloadProduktuV2` z
  `src/selly/rest/mapper-v2.ts`.
- **Rotacja dostawców i `buildCache` należą do harmonogramu** (`scheduler_selly.cjs:82-102`,
  `runFullBatch`): `suppliers = opts.suppliers || suppliersForFullToday(new Date())`, a
  `buildCache: i === 0` — cache kodów Selly budowany raz na całą partię, nie per dostawca. Tor 2
  sam rotacji nie zna.
- **Bug produkcji w `routes_sync.cjs` (zakres I15.8):** plik importuje z `scheduler_selly.cjs`
  nieistniejące `runFullTodays` (scheduler eksportuje `runFullBatch`), więc
  `POST /api/selly/sync-full-today` i `POST /api/selly/sync-full-force` na produkcji zawsze
  kończą się 500. `POST /api/selly/sync-full-supplier` woła `syncFullForDostawca` bezpośrednio
  i działa.
- **`SELLY_TRYB` przed biegiem Toru 2:** w `tylko-odczyt` każdy rekord kończy się błędem i Tor 2
  zapisuje `ostatni_status='error'` w całej partii (zmierzone testem) — harmonogram powinien
  sprawdzić tryb przed startem, tak samo jak dla Toru 1.
