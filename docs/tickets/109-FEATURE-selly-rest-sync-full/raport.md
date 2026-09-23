# 109-FEATURE-selly-rest-sync-full — raport implementacji

## Podsumowanie
Tor 2 (nocna pełna synchronizacja Bridge → Selly) przeniesiony do `rebuild/backend` jako
`src/selly/rest/{mapper-v2,sync-full}.ts` — port `origin/main@7d6cfc9:mirror/backend/selly/
{mapper_v2,sync_full}.cjs` ze stanem po `5dedefb`, czyli z całym #81 (ścieżka A z cechami
i `category_id`, `metadataScore`/`isMetadataOwner`, lustro cech bez dziedziczenia pustej wartości).
Klient Selly dostał jedną nową metodę odczytu (`getProduct`), sklasyfikowaną w `SELLY_TRYB`.
Karta nie montuje harmonogramu ani tras — to I15.8.

## Zmiany
- **Nowe:** `src/selly/rest/mapper-v2.ts` — 21 cech (`FEATURE_MAP`), `yn`/`txt`/`num`/
  `zastosowaniePierwsze`, `buildFeatures`, `buildFeaturesMirror` (#81), `toSellyPayloadV2`,
  `buildProductPayload` + `budujPayloadProduktuV2` (gotowy do wstrzyknięcia w `stworzDiscovery`).
- **Nowe:** `src/selly/rest/sync-full.ts` — `collectFullSyncItems`, `loadDictMaps`,
  `syncFullForDostawca(db, discovery, dostawca, opts)`, prywatne `logSyncStart`/`logSyncEnd`/
  `markProductSynced`/`markError`/`metadataScore`/`isMetadataOwner`/`updateExistingVariant`/
  `ensureAndUpdate`.
- `src/selly/klient.ts` — `getProduct(productId)` (`GET /api/products/{pid}`), typy
  `CechaProduktu`/`ProduktSzczegolySelly`/`OdpowiedzProduktu`; poprawiony nieaktualny komentarz
  („`getProduct` niewołany z żadnej trasy” — było prawdą dla `routes.cjs`, nie dla `sync_full.cjs`).
- `src/selly/tryb.ts` — `getProduct` w `METODY_ODCZYTU`.
- `src/selly/rest/discovery.ts` — jedna zmiana typu: `PayloadProduktu.provider_code?: string | null`
  (mapper zwraca `null`, gdy wiersz nie ma ani `kod_importu`, ani `kod_dostawcy`). Bez zmiany kodu.
- `test/gate/selly-atrapa.ts` — `getProduct`, cechy i `category_id` na poziomie produktu
  (`ProduktSklepu`), `updateProduct` zapisuje skutek PUT do stanu sklepu, `stworzAtrapeBezKonfiguracji`
  += `getProduct`.
- **Nowe testy:** `test/selly.mapper-v2.test.ts` (13), `test/selly.sync-full.test.ts` (13);
  `test/selly.klient.test.ts` i `test/selly.tryb.test.ts` — dopisany `getProduct`.

## Odstępstwa od planu
Brak. Decyzja D1 (pominięte martwe eksporty `toDeltaPayload`, `DOSTAWCA_TO_MAGAZYN_FEATURE_ID`,
`getMagazynFeatureIdForDostawca`) wykonana zgodnie z planem; powód udokumentowany w nagłówku
`mapper-v2.ts`.

## Wyniki testów
- **Gate odbudowy (fixtures/kontrakt):** N/D — karta nie dodaje ani nie zmienia żadnej trasy HTTP
  (trasy `sync-*` montuje I15.8), a `contract/openapi.yaml` i `contract/fixtures/` nie mają ścieżek
  `sync-*`. Regresja panelu Selly z I8 (`selly.gate.test.ts`, `GET_selly_*.json`) zielona bez zmian
  w fixtures.
- Unit/integracyjne: ✓ `npm test` — 98 plików, 1587 testów, 2 pominięte.
- Bramki: ✓ lint, ✓ typecheck, ✓ build (Node 20.20.2).
- Żaden test nie wychodzi do sieci: klient za interfejsem, atrapa `test/gate/selly-atrapa.ts`.

## Zachowania zastane odtworzone 1:1
- Gałęzie „PUT zwrócił status spoza 2xx” są martwe (klient rzuca na non-2xx) — jak w Torze 1.
- `markError` Toru 2 ma własną klasyfikację (`missing_dict` vs `error`), inną niż Tor 1
  (`pending_create`); sam `UPDATE` bez `INSERT` (jak #69) — rekord bez wiersza w `selly_products`
  nie zostawia śladu poza `selly_sync_log`.
- `metadataScore` liczy `0` jako wartość wypełnioną (puste to tylko `null` i `''`).
- Wiersz Toru 2 niesie kolumnę `vat`, a `discovery.createVariant` czyta `vat_rate` → nowy wariant
  zakładany przez Tor 2 dostaje zawsze `vat: 23`.
- Status logu `blad` tylko wtedy, gdy były błędy i ANI JEDEN rekord się nie udał.

## Breaking changes
Brak. Nowa metoda klienta jest dodatkiem; zmiana typu w `discovery.ts` to rozszerzenie.

## Follow-up
- **#101 (blokowane formy płatności)** — zmierzone, nienaprawione (brak decyzji): payload REST
  Toru 2 tego pola nie niesie; wysyłał je tylko stary eksport CSV. Szczegóły i wejście dla
  koordynatora w `docs/karty/I15.7/karta.md`.
- **Bug produkcji dla I15.8:** `routes_sync.cjs:14` importuje z `scheduler_selly.cjs` nieistniejące
  `runFullTodays` (scheduler eksportuje `runFullBatch`), więc `POST /api/selly/sync-full-today`
  i `sync-full-force` na produkcji zawsze oddają 500. Zapisane jako wejście dla I15.8.

## Poprawki po review
Review (`review.md`) potwierdził wierność portu linia po linii z oryginałem i zgłosił jeden BLOCKER
dotyczący dokumentacji (karta I15.7 nieoznaczona jako zrobiona, brak wejścia dla I15.8) oraz
SHOULD-FIX (nieodhaczona lista „Definition of done” w `plan.md`). Oba naprawione w fazie dokumentacji
— karta, wejście dla I15.8 i backlog niżej; `plan.md` ma status `Implemented` i odhaczoną listę.
NICE-TO-HAVE był informacyjny (bez akcji). W kodzie review nie znalazł rozjazdów z oryginałem.

## Docs updates
- `docs/karty/I15.7/karta.md` — stan `✅ 2026-09-22 · 109-FEATURE-selly-rest-sync-full`, wypełnione
  „Dowiezione” (faktyczny zakres, decyzje D1–D5, defekty odtworzone 1:1, rozliczenie wszystkich
  pięciu punktów `wejscie-108.md`, gate i bramki) oraz „Do koordynatora” (#101 z dowodem, sygnatura
  Toru 2, rotacja i `buildCache` jako zakres harmonogramu, bug `runFullTodays`, zachowanie przy
  `SELLY_TRYB=tylko-odczyt`).
- `docs/karty/I15.8/wejscie-109.md` — **nowy**: sygnatura i montaż Toru 2 (jedna instancja discovery
  + `budujPayloadProduktuV2`), rotacja i `buildCache: i === 0`, bug `runFullTodays` jako fakt
  z decyzją dla użytkownika, wymóg sprawdzenia `SELLY_TRYB`, `getProduct` już w kliencie.
- `docs/rebuild-backlog.md` — #81 ✅ (zrobione ticketem 109), #60 postęp (zostaje I15.8), #74 ✅
  (kategorie z danych), #101 uzupełniony o pomiar (payload REST nie niesie pola; dowód `git grep`),
  #66/#69/#70 — nota, że Tor 2 odtwarza te same defekty (bez zmiany statusów); **nowy wpis #103** —
  `routes_sync.cjs` importuje nieistniejące `runFullTodays`, trasy `sync-full-today`/`-force` dają
  500, decyzja w zakresie I15.8.
- `docs/spec-backend/wpis-109.md` — **nowy**: Tor 2 jako fakt o backendzie (kwalifikacja pozycji,
  słowniki, ścieżki A/B/C, kanoniczny rekord metadanych, czego Tor 2 nie aktualizuje, zapisy do
  `selly_products`/`selly_sync_log`, `dryRun`/`autoCreate`, zastane osobliwości, `getProduct`
  pod `SELLY_TRYB`). `docs/spec-backend.md` nie wymagał poprawki w miejscu.
- `docs/rebuild-roadmap.md` — **nietknięta** (reguła 0 z CLAUDE.md; stan iteracji odświeża koordynator).
