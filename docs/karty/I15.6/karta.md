# I15.6 — Selly REST 1: nowy schemat `selly_products`, odnajdywanie produktów, aktualizacje w ciągu dnia

> **Stan:** ✅ 2026-09-22 · 108-FEATURE-selly-rest-discovery-delta
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #60, #74, #77 (delta), #68, #69, #70 · **Zależy od:** —
> **Ticket:** `108-FEATURE-selly-rest-discovery-delta`

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Dawne 13d-1. Port TS z `origin/main`: `mirror/backend/selly/discovery.cjs` (442 l.), `sync_delta.cjs` (187),
`rate_limiter.cjs` (64; 250/60 s + retry). **Migracja `013`**: `selly_products` → `selly_products_old`, nowa
`selly_products` (schemat z `git show origin/main:db/schema.sql`: klucz `(kod_importu, dostawca)`, `selly_product_id`,
`selly_variant_id`, `feature_id_magazyn`, indeksy). Model wariantowy: cena/stan PER WARIANT, `provider_code=kod_importu`.
- **#74:** żywe kategorie Selly 1/2/3/4 z danych (`selly_kategoria_norm_map`) — **nie hardkodować**.
- **#77 (delta):** `findDeltaProducts()` obejmuje `wstrzymany` z istniejącym wariantem → stan 0, bez tworzenia produktów.
- **#68/#69/#70 i osierocone mapowania** (usunięcie produktu nie sprząta `selly_products`): domyślnie **1:1**.
  KROK 0: zapytaj użytkownika, czy Ania odpowiedziała na pytania 1.3/1.4 rundy 3
  (`docs/pytania-do-ani-2026-09-22.md`) — jeśli wybrała naprawę, to świadome odstępstwo.
  **Ustalone z kodu (108):** #68 nieaktualne — `mapper.buildProductPayload` istnieje od 08.09 15:12,
  ścieżka działa w Torze 2; w Torze 1 jest nieosiągalna z definicji (brak `dictMaps`), nie dlatego że
  funkcja nie istnieje. #69/#70 potwierdzone 1:1 (patrz „Dowiezione”).
- **#67:** stary `POST /api/selly/sync-supplier` (I8) po zmianie schematu psuje się w produkcji — ~~odtworzone 1:1
  (decyzja D3 z 13d-1); utrzymaj~~. **Zmienione w 108 (D4, świadome odstępstwo):** naprawione — gałąź CREATE
  zapisuje `kod_importu`/`dostawca`; produkt bez nich kończy się błędem PRZED wywołaniem Selly. Szczegóły
  i uzasadnienie: `docs/tickets/108-FEATURE-selly-rest-discovery-delta/plan.md` (D4).
⚠ **PUŁAPKA revertu:** port na NOWEJ gałęzi ze stanu `origin/main`, NIE przez ponowny merge `feature/45`
(revert #58 sprawia, że git uzna go za zmergowany). Kod z `feature/45` wolno czytać jako ściągę, nie przenosić.
⚠ **Bezpieczeństwo:** testy NIGDY nie wołają prawdziwego Selly (klient za interfejsem, atrapa
`test/gate/selly-atrapa.ts`), `SELLY_TRYB` obowiązuje dla nowych ścieżek.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/rest/**` (nowe), `rebuild/schema/013_*.sql`, `db/schema.ts` (tylko Selly), dostosowanie
repozytorium Selly z I8 do nowej tabeli, testy. NIE: `generator-csv.ts` (I15.3), `sync_full`/`mapper_v2` (I15.7), trasy
`sync-*` i harmonogram (I15.8).

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

Numer migracji `013` zarezerwowany.

## Dowiezione
Ticket `108-FEATURE-selly-rest-discovery-delta`, 2026-09-22.
- **Migracja + model:** `rebuild/schema/013_selly_products_warianty.sql` (`RENAME` starej tabeli →
  `selly_products_old`, `DROP INDEX idx_selly_products_status`, nowa `selly_products` verbatim z
  `origin/main:db/schema.sql:307-331`, 6 indeksów); `db/schema.ts` (`sellyProducts` w nowym kształcie +
  `sellyProductsOld`); `repos/selly.ts` dostosowany do nowej tabeli (D4, patrz #67 wyżej).
- **Klient:** 5 nowych metod wariantowych w `selly/klient.ts` (`listProductsByEan`, `listProductsPage`,
  `listVariants`, `createVariant`, `updateVariant`), sklasyfikowane w `SELLY_TRYB` (`tryb.ts`; zapis:
  `createVariant`/`updateVariant`; odczyt: pozostałe trzy) z testem kompletności.
- **`src/selly/rest/`** (nowy katalog, wyłączna własność karty): `limiter.ts` (port `RateLimiter` 1:1,
  250/60 s, `MIN_INTERVAL_MS` 240, `getStats`), `discovery.ts` (`stworzDiscovery({klient, limiter?,
  budujPayloadProduktu})`, `ensureMapping`, cache `feature_id`, cache kodów krok 3b, `createProduct` z
  ochroną przed duplikatem i retry po 400), `sync-delta.ts` (`findDeltaProducts` z #77, `syncDelta(db,
  discovery, dostawca, opts)`, `markSynced`/`markError`).
- **Decyzje:** D1 `budujPayloadProduktu` wstrzykiwany (mapper_v2 wpina I15.7) — #68 rozstrzygnięte z kodu,
  nieaktualne jako defekt; D2 cache kodów (krok 3b) portowany w całości; D3 defekty zastane 1:1 — #66
  (martwe ponawianie 429), #69 (`pending_create` bez śladu w bazie), #70 (UPSERT nie odświeża
  `ostatni_status`), `dryRun` nie chroni przed `createVariant`; D4 **naprawa #67** — świadome odstępstwo
  (patrz wyżej); D5 migracja 013 „czysta” (dane nieprzenoszone, jak Ania).
- **KROK 0:** Ania odpowiedziała na 1.1–1.4 rundy 3 (`docs/karty/I15.6/wejscie-104.md`) — port ze stanu
  `origin/main` `7d6cfc9`; podsumowania logiki Selly od Ani **jeszcze nie ma**, port poszedł z kodu.
- **Gate:** karta nie dodaje żadnej trasy HTTP; regresja panelu I8 (`selly.gate.test.ts`,
  `contract/fixtures/GET_selly_*.json`) zielona bez zmian w fixtures. Bramki: lint/typecheck/build/test —
  96 plików, 1561 testów, 2 pominięte.
- Rozliczone wejście: `wejscie-104.md` (odpowiedzi Ani rundy 3) — patrz punkty wyżej.

⚠ **Dla przyszłych kart (I15.7/I15.8):** `feature/45-selly-rest-sync-tor1` jest STARSZA niż oryginał —
brak kroku 3b (cache kodów), brak gałęzi #77 w delcie, `createProduct` jako blokada, scalone UPSERT-y
(port z 45 nadpisywał `bridge_kod` inaczej niż verbatim). **Nie używać jako ściągi** dla I15.7/I15.8 —
czytać `origin/main` na `7d6cfc9`.

## Do koordynatora
- **CUTOVER:** na bazie produkcji `selly_products_old` i nowa `selly_products` **już istnieją** (ręczna
  przebudowa Ani, 07.09). Migracja 013 tam **PADA** („there is already another table or index with this
  name: selly_products_old") i wycofuje się w całości — sprawdzone testem
  `test/migracje.selly-warianty.test.ts`. Procedura do `docs/cutover.md`: przed `npm run migrate`
  sprawdzić kształt (`pragma table_info(selly_products)` ma `selly_variant_id`, `kod_importu`,
  `feature_id_magazyn`; istnieje `selly_products_old`; indeksy jak w 013), potem
  `INSERT OR IGNORE INTO _migracje (nazwa, zastosowano) VALUES ('013_selly_products_warianty.sql', …)`
  — ten sam wzorzec idempotencji jak dla `002` w I15.1.
- **#67 zmienia status** z „odtworzone 1:1” na odstępstwo (D4) — instrukcje testów dla Ani (I15.9) i
  roadmapa powinny o tym wspomnieć.
- **Graf wywołań:** `syncDelta` woła wyłącznie `scheduler_selly.cjs`; `routes_sync.cjs` importuje
  nieistniejące `syncDeltaForDostawca` → trasa `sync-delta-supplier` na produkcji rzuca `TypeError`.
  Decyzja (naprawić nazwę importu czy zostawić 1:1) należy do I15.8.
- **Wspólne pliki `db/schema.ts` (import `unique`) i `test/db.migracje.test.ts`** (lista migracji + bilans
  29 tabel/19 indeksów): przy merge'u z I15.1 (011) i I15.4 (012) będą trywialne konflikty — bilans trzeba
  przeliczyć po scaleniu wszystkich migracji fali.
