# 45-FEATURE-selly-rest-sync-tor1 — Selly REST sync: fundament + Tor 1 (discovery + delta)

> Status: Draft
> Branch: `feature/45-selly-rest-sync-tor1`
> Worktree: `.worktrees/45-FEATURE-selly-rest-sync-tor1`
> Iteracja: I13, karta **13d, pod-karta 1**. Backlog **#60**.

## Opis ticketa

13d-1 — reimplementacja TS w `rebuild/backend/src/selly/` podsystemu synchronizacji
Bridge→Selly przez REST API: **fundament** (schemat `selly_products` w modelu wariantowym,
rate limiter, discovery, mapper_v2) + **Tor 1** (delta stan/cena, scheduler, 3 endpointy).
Oryginały: `mirror/backend/selly/*.cjs` na gałęzi `main` (produkcja 08.09).

NIE tu: `sync_full.cjs` (Tor 2 → 13d-2), przyciski sync w panelu FE (→ 13d-3).

## Kontekst

To **wykracza poza I8**. I8 odbudowało eksport CSV + panel Selly (10 tras, `mapper.cjs` v1).
Ania 07–08.09 dołożyła osobny podsystem, bo cena/stan w Selly są **per wariant** (19%
produktów ma >1 wariant), a bulk-endpoint zwracał HTTP 400. Klucz `(kod_importu, dostawca)`
→ `(selly_product_id, selly_variant_id)`.

**Źródło prawdy zamrożone.** `main` nie ma żadnego commita dotykającego `mirror/backend/selly/`
po `6872aea` (08.09) — Tor 1 nie jest ruchomym celem. Rejestracja podsystemu jest w
`mirror/backend/extensions.cjs:462-470` (jedyne miejsce, potwierdzone `git grep`), bezwarunkowo,
w `try/catch`.

**Stan develop:** 13a/13b/13c zmergowane (migracje `004`–`006`), nasza będzie `007`.

### Cztery defekty produkcji wykryte w tym wycinku (wszystkie potwierdzone w kodzie)

1. **`POST /api/selly/sync-delta-supplier` zawsze 500.** `routes_sync.cjs:15` importuje
   `{ syncDeltaForDostawca }` z `sync_delta.cjs`, który eksportuje tylko
   `{ syncDelta, findDeltaProducts }`. Nazwa `syncDeltaForDostawca` żyje wyłącznie
   w `sync_delta.cjs.bak-v1-2026-09-07` — refaktor z 07.09 nie doszedł do `routes_sync`.
2. **Retry na 429 jest martwym kodem.** `client.cjs:56-60` (`request()`) **odrzuca** każdą
   odpowiedź spoza 2xx, więc `client.api()` rzuca, zanim `apiWithRetry` sprawdzi
   `r.status !== 429`. Nieosiągalna jest też gałąź `else` po `putRes.status` w `sync_delta.cjs`.
   Burzę 429 z cyklu 20:10 ugasił **throttle** (`globalLimiter.acquire()` przed każdym
   requestem), nie retry.
3. **`discovery.createProduct` woła nieistniejące `mapper.buildProductPayload`** — `mapper_v2.cjs`
   takiej funkcji nie eksportuje (ani v1). Nieosiągalne z Toru 1 (`sync_delta` woła
   `ensureMapping` BEZ `dictMaps`), zawsze rzuciłoby `TypeError` w Torze 2.
4. **Stary `POST /api/selly/sync-supplier` (I8) jest zepsuty przez nowy schemat.**
   `routes.cjs:417` wstawia wiersz bez `kod_importu`/`dostawca`, które w nowej tabeli są
   `NOT NULL` bez defaultu → gałąź CREATE pada na `NOT NULL constraint failed`.

Do tego dwa defekty Toru 2 (poza zakresem, do odnotowania dla 13d-2): `runFullTodays`
nie istnieje w `scheduler_selly.cjs`, więc `sync-full-today` i `sync-full-force` też dają 500.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Fixtures: BRAK i nie da się ich nagrać.** Żadna z trzech tras zakresu nie ma nagrania
w `contract/fixtures/`, a nagrać się nie da: kształty odpowiedzi Selly dla
`GET /api/products?ean=`, `GET /api/products/{pid}/variants`, `POST .../variants`,
`PUT .../variants/{vid}` nie są nigdzie w repo udokumentowane, a odpytanie żywego Selly jest
zakazane (CLAUDE.md) i wymagałoby cudzych sekretów. `tools/record-write-fixtures.cjs` nagrywa
zapisy do bazy Bridge, nie odpowiedzi zewnętrznego API.

**Kontrakt: rozszerzamy o 3 ścieżki (decyzja D6).** `contract/openapi.yaml` zna dziś 10 tras
`/api/selly/*` (linie 19721-19825), w tym stare `sync-product`/`sync-supplier`, ale **nie zna**
`sync-status` ani `sync-delta-*`. Dopisujemy je wraz z kształtami odczytanymi z `routes_sync.cjs`,
z jawną notą „bez nagrania — wymaga żywego Selly".

**Ścieżki objęte GATE tego ticketa:**
| Metoda + ścieżka | Fixture | Jak weryfikujemy |
|---|---|---|
| `GET /api/selly/sync-status` | brak | test za atrapą + walidacja wobec nowego schematu openapi |
| `POST /api/selly/sync-delta-supplier` | brak | jw. (kształt wg D1 — naprawiony) |
| `POST /api/selly/sync-delta-all` | brak | jw. |

**Ścieżki, których NIE WOLNO ruszyć (regresja I8):** `GET /api/selly/status`, `GET /api/selly/log`,
`GET /api/selly/ping`, `GET /api/selly/dictionaries`, `GET /api/selly/csv-status` — mają fixtures
i muszą przejść GATE bez zmian. `GET /api/selly/status` liczy `w_selly` przez
`LEFT JOIN selly_products ON bridge_kod = products.kod`; `bridge_kod` **zostaje** kolumną
w nowej tabeli, więc kształt i wartości fixture'a nie ruszają się.

## Decisions

- **D1 — `sync-delta-supplier` NAPRAWIONY (świadome odstępstwo).** Trasa woła
  `syncDelta(db, dostawca)` zamiast nieistniejącego `syncDeltaForDostawca`. Powód: to literówka
  po refaktorze (obie nazwy mają tę samą sygnaturę), a 13d-3 dokłada przycisk „synchronizuj
  dostawcę" w panelu — bez naprawy przycisk z definicji oddawałby 500. Wpis do backlogu #60
  jako defekt produkcji naprawiony u nas. *Odrzucone:* wierny port martwej trasy (dowozimy
  świadomie zepsuty endpoint), pominięcie trasy (zakres węższy niż prompt).
- **D2 — retry na 429 zostaje MARTWY (1:1).** Throttle działa przed każdym requestem; 429
  propaguje się wyjątkiem do `markError` → `ostatni_status='error'`, bez ponowienia. Gałąź
  retry zostaje w kodzie jako nieosiągalna, z komentarzem i wpisem w backlogu. *Odrzucone:*
  naprawa retry — zmieniłaby obserwowalne zachowanie (mniej wpisów `error`, inne czasy)
  względem tego, co Ania ma dziś na produkcji.
- **D3 — stary `sync-supplier` (I8) zostaje ZEPSUTY (1:1).** Gałąź CREATE pada na
  `NOT NULL constraint failed: selly_products.kod_importu`, dokładnie jak u Ani. Istniejący test
  `test/selly.synchronizacja.test.ts` („nieznany produkt jest TWORZONY") zostaje **przepisany
  tak, żeby DOKUMENTOWAŁ tę awarię**, a nie sukces. *Odrzucone:* dopisanie brakujących kolumn
  (u nas endpoint robiłby coś, czego u Ani nie robi — rozjazd wyszedłby dopiero po cutoverze),
  przekierowanie starego kodu na `selly_products_old` (u Ani stary kod celuje w NOWĄ tabelę,
  więc `GET /api/selly/status` liczyłby u nas co innego).
  - **Konsekwencja techniczna:** typowany `db.insert(sellyProducts).values({...})`
    (`repos/selly.ts:215`) przestanie się kompilować, gdy `kodImportu`/`dostawca` dostaną
    `.notNull()`. Zapis przechodzi na surowy SQL z **dokładnie tą listą kolumn co oryginał**
    (`routes.cjs:417`) — kompiluje się, a pada w runtime tak samo jak produkcja.
- **D4 — scheduler za flagą `SELLY_SCHEDULER`, domyślnie WYŁĄCZONY (świadome odstępstwo).**
  Ten sam wzorzec i to samo uzasadnienie co `IMPORT_SCHEDULER` z I3 (`import/scheduler.ts:13-30`):
  moduł niczego nie uruchamia, start wyłącznie w `server.ts` po `listen()`. Staging stoi na tym
  samym VPS co produkcja — bezwarunkowy scheduler robiłby realne PUT-y do żywego sklepu Ani
  co 15 minut, a jedynym zabezpieczeniem byłby `SELLY_TRYB`. Dodatkowo `stworzApp` nie ma gdzie
  sprzątać timerów, więc testy stawiałyby je przy każdym scenariuszu. *Odrzucone:* 1:1
  bezwarunkowy start; flaga domyślnie ON.
- **D5 — `mapper_v2` portowany TERAZ, `createProduct` odtwarza defekt 1:1.** Cały
  `mapper_v2.cjs` (21 features, `provider_code = kod_importu`, `toDeltaPayload`) idzie do
  `src/selly/mapper-v2.ts` z testami jednostkowymi — to czyste funkcje, testowalne bez Selly
  i gotowe dla 13d-2. `discovery.createProduct` odtwarza brak `buildProductPayload`: zwraca
  `{ error: ... }` zamiast payloadu, bez wymyślania funkcji, której u Ani nie ma.
  ⚠ `toDeltaPayload` jest w Torze 1 **martwy** — `sync_delta` liczy deltę własnym SQL-em i nie
  woła go w ogóle. Portujemy, ale nigdzie nie podpinamy.
- **D6 — 3 ścieżki dopisane do `contract/openapi.yaml`, bez fixtures.** Kontrakt ma opisywać
  powierzchnię API produkcji z 08.09, a te trasy tam są. *Odrzucone:* nagranie fixtures z atrapy —
  `contract/fixtures/` to z definicji nagrania ŻYWEJ produkcji i wstawienie tam syntetyku
  podważyłoby najważniejsze źródło prawdy.
- **D7 — nowe metody wariantowe jako NAZWANE metody `KlientSelly`, nie generyczne `api()`.**
  Oryginał woła `client.api(method, path, opts)`. Wystawienie generycznego `api()` w naszym
  interfejsie **otworzyłoby dziurę w blokadzie `SELLY_TRYB`**: `tryb.ts` klasyfikuje metody na
  zapisujące i odczytowe, a generyczne `api()` jest nieklasyfikowalne — w trybie `tylko-odczyt`
  przepuściłoby PUT wariantu. Dokładamy więc cztery nazwane metody i dopisujemy je do list
  w `tryb.ts` (test kompletności `test/selly.tryb.test.ts` i tak by tego pilnował).

### Świadome odstępstwa od oryginału (zbiorczo)
| # | Odstępstwo | Decyzja |
|---|---|---|
| O1 | `sync-delta-supplier` działa (u Ani 500) | D1 |
| O2 | Scheduler za flagą, domyślnie OFF (u Ani bezwarunkowy) | D4 |
| O3 | Nazwane metody wariantowe zamiast generycznego `api()` | D7 |
| O4 | 3 nowe ścieżki w `contract/openapi.yaml` | D6 |

Odtworzone 1:1 **mimo że są defektami**: martwy retry 429 (D2), zepsuty stary `sync-supplier`
(D3), `createProduct` bez `buildProductPayload` (D5).

## Implementation plan

Kolejność = kolejność commitów.

### Krok 1 — Schemat (fundament)
- `rebuild/schema/007_selly_products_warianty.sql` — migracja odtwarzająca to, co Ania zrobiła
  07.09. **Nie przez przebudowę tabeli, tylko przez `ALTER TABLE ... RENAME`** — dowód:
  w `main:db/schema.sql` indeks `idx_selly_products_kod` został przy `selly_products_old`
  (podąża za zmienioną nazwą tabeli, tak działa SQLite), a `idx_selly_products_status` jest już
  na NOWEJ tabeli. Stąd kolejność:
  1. `ALTER TABLE selly_products RENAME TO selly_products_old;`
  2. `DROP INDEX idx_selly_products_status;` (poszedł za starą tabelą, nazwa musi się zwolnić)
  3. `CREATE TABLE selly_products (...)` — DDL **verbatim** z `main:db/schema.sql:307-325`,
     z `UNIQUE (kod_importu, dostawca)` i `ostatni_status DEFAULT 'pending'` (stara miała `'ok'`)
  4. sześć indeksów: `_bridge`, `_kod_imp`, `_dostaw`, `_prodid`, `_varid`, `_status`
  - Migracje idą przez `zastosujMigracje` (`src/db/migrate.ts`) — transakcja + wpis w `_migracje`,
    więc idempotencja jest z automatu; test i tak ją sprawdza.
- `rebuild/backend/src/db/schema.ts` — nowy model `sellyProducts` (`kodImportu`, `dostawca`
  notNull, `sellyVariantId`, `featureIdMagazyn`, unique `(kodImportu, dostawca)`, 6 indeksów)
  + `sellyProductsOld` dla starej tabeli. ⚠ Nie generować przez `drizzle-kit pull` — skasowałoby
  „dopieszczenia" z D5 iteracji 2 (`snow3pmsf`, 10× `mode:"boolean"`).
- `rebuild/backend/src/repos/selly.ts` — zapis z `syncOneProduct` na surowy SQL (D3).

### Krok 2 — Klient + blokada trybu
- `src/selly/klient.ts` — cztery metody na wzór istniejących (`zapytajApi` w środku):
  `listProductsByEan(ean)` (`GET /api/products?ean=&limit=1`), `listVariants(productId)`
  (`GET /api/products/{pid}/variants`), `createVariant(productId, body)` (`POST`),
  `updateVariant(productId, variantId, body)` (`PUT`).
- `src/selly/tryb.ts` — `listProductsByEan`, `listVariants` → `METODY_ODCZYTU`;
  `createVariant`, `updateVariant` → `METODY_ZAPISUJACE`.
- `test/gate/selly-atrapa.ts` — te same cztery metody, sterowalne z testu (jakie produkty po EAN,
  jakie warianty, jakie `feature_id`), z licznikiem wywołań jak dotąd.

### Krok 3 — Rate limiter (port `rate_limiter.cjs`)
- `src/selly/limiter.ts` — `LimiterZapytan` (`MAX=250`, `OKNO_MS=60_000`,
  `MIN_ODSTEP_MS=Math.ceil(60000/250)=240`), `acquire()` async: filtr okna → gdy pełne, czekaj
  do zwolnienia najstarszego +10 ms i **rekurencja**; potem wymuś 240 ms od ostatniego wpisu.
  `getStats()` → `{requestsInWindow, capacity, utilizationPct}`. Singleton `globalnyLimiter`
  dzielony przez discovery i sync-delta (jak w oryginale) — **wstrzykiwalny w testach**, żeby
  suita nie czekała realnych sekund.

### Krok 4 — Discovery (port `discovery.cjs`)
- `src/selly/discovery.ts`:
  - `wykonajZPonowieniem(opis, wywolanie, maxProb=3)` — port `apiWithRetry`: `await limiter.acquire()`
    przed KAŻDĄ próbą, potem wywołanie; gałąź „status 429 → backoff wg `Retry-After`,
    `min(60s, max(1s, retryAfter*1000))`" zostaje jako **nieosiągalna** (D2, komentarz + backlog).
  - `WAREHOUSE_FEATURE_IDS` = `{MO1:null, MO2:5, MO3:4, MO4:3, MO5:2, MO6:null, MO7:null,
    MO8:null, MO9:1, MO10:null}` + cache runtime, `getFeatureIdForWarehouse`, `learnFeatureId`
    (uczy tylko gdy pole puste).
  - `findProductByEan` / `fetchVariants` — `try/catch` połykający błąd (zwraca `null` / `[]`),
    1:1 z oryginałem; to przez to 429 wygląda jak „nie znaleziono".
  - `findVariantForDostawca(variants, dostawca)` — wariant, którego feature `name==='Magazyny'`
    ma `value === dostawca`; przy okazji `learnFeatureId`.
  - `createVariant` — body `{quantity, price, vat, ean, default:0, attributes: []}`
    (`attributes` wymagane — fix Ani z 08.09, HTTP 400 bez niego) + `features` z `Magazyny`,
    gdy znamy `feature_id`.
  - `createProduct` — odtwarza defekt: brak `buildProductPayload` → `{error}` (D5).
  - `ensureMapping(db, bridgeRow, dictMaps=null)` — pięć kroków wg oryginału, `action` dokładnie
    `'cache_hit' | 'found_variant' | 'created_variant' | 'created_product' | 'not_found'`,
    UPSERT `ON CONFLICT(kod_importu, dostawca) DO UPDATE`. Komunikat
    `'produkt nie istnieje w Selly ale brak dictMaps do createProduct'` **verbatim** — na jego
    treści opiera się `markError` (patrz Krok 6).

### Krok 5 — `mapper-v2.ts` (port `mapper_v2.cjs`)
Helpery `yn`/`txt`/`num`/`zastosowaniePierwsze`, `FEATURE_MAP` (21 pozycji, kolejność 1:1),
`buildFeatures`, `buildFeaturesMirror`, `toSellyPayloadV2` (`provider_code = kod_importu ||
kod_dostawcy || null`), `toDeltaPayload` (martwy w Torze 1), `DOSTAWCA_TO_MAGAZYN_FEATURE_ID`,
`DEFAULT_VAT_RATE=23`. Świadomie pominięte features `Lód` i `Magazyny` — zostaje komentarz.

### Krok 6 — `sync-delta.ts` (Tor 1, port `sync_delta.cjs`)
- `findDeltaProducts(db, dostawca, limit=10000)` — SQL 1:1 (filtry `status='aktywny'`,
  `ean` niepuste, `kod_importu` niepuste; `LEFT JOIN` po `(kod_importu, dostawca)`; warunek delty
  `selly_variant_id IS NULL OR stan_wyslany IS NULL OR != stan OR cena_sprzedazy_wyslana IS NULL
  OR != cena_sprzedazy`). ⚠ Projekcja **jawna** — nie `select()` bez listy pól (CLAUDE.md).
- `syncDelta(db, dostawca, {dryRun=false, maxProducts=5000})` — pętla 1:1: cache-hit z wiersza →
  inaczej `ensureMapping` BEZ `dictMaps`; brak `variant_id` → `markError`; `dryRun` → `skip++`
  bez żadnego wywołania Selly; inaczej PUT wariantu `{quantity: stan ?? 0, price: cena ?? 0}`.
- `markSynced` / `markError` — `UPDATE ... WHERE kod_importu=? AND dostawca=?`. `markError`
  rozpoznaje `pending_create` po **treści** komunikatu (`'brak dictMaps do createProduct'` lub
  `'produkt nie istnieje w Selly'`), inaczej `'error'`; komunikat obcinany do 500 znaków.
- Log do `selly_sync_log`: `operacja='sync_delta'`, `dostawca_kod = dostawca ?? 'ALL'`,
  `szczegoly_json` obcięty do 8000 znaków, `status='blad'` **tylko** gdy `err>0 && ok===0`.

### Krok 7 — Scheduler (port `scheduler_selly.cjs`, część Tor 1)
`ACTIVE_SUPPLIERS` (MO1–MO10), `FULL_ROTATION` + `suppliersForFullToday(date)`
(z `isFirstOfMonthDay` dla MO7/MO8) — potrzebne, bo `sync-status` je zwraca; `runDeltaAll`;
`stworzSchedulerSelly({db, syncDelta})` z `setInterval(60_000)`, wyzwalacz
`[55,10,25,40].includes(mm)` + `lastRunKey` per minuta, tag `event-driven`/`fallback`.
Tor 2 nieobecny (u Ani zakomentowany). Start wyłącznie w `server.ts` za `SELLY_SCHEDULER` (D4);
`src/config/env.ts` dostaje nową zmienną.

### Krok 8 — Trasy + montaż
- `src/routes/selly-sync.ts` — `trasySellySync({db, klient})`, trzy trasy za `requireAuth`
  (oryginał rejestruje je z `requireAuth: we`, `extensions.cjs:465`):
  - `GET /api/selly/sync-status` → `{ok:true, limiter, todayRotation, activeSuppliers, recentLogs}`
    (`recentLogs`: 20 wpisów `selly_sync_log` wg `rozpoczeto DESC`, jawna projekcja 9 kolumn).
  - `POST /api/selly/sync-delta-supplier` — walidacja `dostawca` wobec `ACTIVE_SUPPLIERS` → 400
    z komunikatem verbatim `'Zly dostawca. Wymagany jeden z: ' + join(',')`; inaczej `syncDelta` (D1).
  - `POST /api/selly/sync-delta-all` → `{ok:true, results}`.
  - Każda w `try/catch` → `500 {ok:false, error: e.message}`, jak oryginał.
- `src/app.ts` — `app.use(trasySellySync({...}))` obok istniejącego `trasySelly`, ten sam
  wstrzykiwany klient (atrapa w testach).
- `contract/openapi.yaml` — trzy ścieżki (D6).

### Krok 9 — Testy (Krok 9 procesu)

## Testing strategy

**GATE odbudowy:** ticket dotyka API, ale **żadna z trzech tras nie ma fixture'a i nagrać go nie
można** (uzasadnienie w „Kontrakt i fixtures"). GATE domykamy dwutorowo:
1. **Regresja istniejących fixtures** — cała suita GATE musi zostać zielona, w szczególności
   `GET_selly_status.json` i `GET_selly_log.json`, których dotyka zmiana schematu.
2. **Nowe trasy** — walidacja odpowiedzi wobec dopisanych schematów `openapi.yaml` + testy za
   atrapą. To jest granica dowodu i zapisujemy ją wprost w `raport.md`: testy dowodzą, że nasz kod
   robi to samo co kod Ani, **nie** że Selly odpowiada tak, jak oboje zakładamy.

**Nowe testy (wszystkie za atrapą, zero ruchu do Selly):**
- `selly.limiter.test.ts` — odstęp ≥240 ms między zgodami; przy pełnym oknie `acquire()` czeka;
  `getStats()`. Zegar sterowany, nie realne 60 s.
- `selly.discovery.test.ts` — pięć wartości `action`: `cache_hit` (zero wywołań Selly),
  `found_variant` (dopasowanie po feature `Magazyny`, zapis mapowania + nauka `feature_id`),
  `created_variant` (POST z `attributes: []`), `created_product` (defekt D5 → `error`),
  `not_found` (brak `dictMaps`, komunikat verbatim). Plus: throttle wołany przed każdym
  requestem, a 429 **nie jest ponawiany** (D2).
- `selly.sync-delta.test.ts` — `findDeltaProducts` (filtry i warunek delty, w tym „wariant nieznany"),
  PUT wariantu z `{quantity, price}`, snapshot `stan_wyslany`/`cena_sprzedazy_wyslana` po sukcesie,
  `markError` → `error` vs `pending_create`, `dryRun` nie dotyka Selly ani snapshotu,
  wpis w `selly_sync_log` (`status` `blad` tylko przy `err>0 && ok===0`).
- `selly.mapper-v2.test.ts` — 21 features i ich kolejność, `yn`/`num`/`zastosowaniePierwsze`,
  `provider_code = kod_importu`, pominięcie `Lód`/`Magazyny`, `buildFeaturesMirror` (nie kasuje
  cech spoza mapy), `ean` tylko przy `ean_is_valid`.
- `selly.sync-trasy.test.ts` — trzy trasy: auth wymagane, 400 na złego dostawcę (komunikat
  verbatim), kształt `sync-status`, `sync-delta-all`, walidacja wobec `openapi.yaml`.
- `migracje.selly-warianty.test.ts` — po `007`: nowy kształt `selly_products` (kolumny, `UNIQUE`,
  6 indeksów), `selly_products_old` istnieje z danymi i indeksem `idx_selly_products_kod`,
  ponowne uruchomienie migracji nic nie zmienia.
- `selly.scheduler.test.ts` — wyzwalanie o minutach 55/10/25/40, brak dubla w tej samej minucie,
  `suppliersForFullToday` (rotacja + reguła „pierwszy w miesiącu" dla MO7/MO8).

**Zmieniany test:** `selly.synchronizacja.test.ts` — przypadek „nieznany produkt jest TWORZONY"
przechodzi na dokumentowanie awarii `NOT NULL constraint failed` (D3).

**Czego NIE testujemy:** realnego Selly (zakaz), martwej gałęzi retry (nieosiągalna z definicji —
test sprawdza zachowanie faktyczne: 429 kończy się `markError`), `sync_full`/Toru 2.

## Out of scope
- `sync_full.cjs` — Tor 2 (→ 13d-2), wraz z `sync-full-supplier|today|force`. Dwie z tych tras
  są u Ani zepsute (`runFullTodays` nie istnieje) — odnotować w backlogu dla 13d-2.
- Przyciski sync w panelu FE `/selly` (→ 13d-3).
- Naprawa `createProduct`/`buildProductPayload` — to projektowanie Toru 2 (D5).
- `client.cjs` v1, `mapper.cjs` v1, 10 istniejących tras panelu — nietykane poza D3.
- Backfille 13f, migracje 13c — zamknięte osobno.

## Definition of done
- [ ] Migracja `007` + model Drizzle; `selly_products` w kształcie wariantowym, `selly_products_old` zachowana
- [ ] `limiter.ts`, `discovery.ts`, `mapper-v2.ts`, `sync-delta.ts`, `scheduler-sync.ts`, `routes/selly-sync.ts`
- [ ] Cztery metody wariantowe w `KlientSelly` + `tryb.ts` + atrapa; test kompletności zielony
- [ ] Trzy trasy Tor 1 za `requireAuth`, zamontowane; scheduler za `SELLY_SCHEDULER` (domyślnie OFF)
- [ ] Trzy ścieżki w `contract/openapi.yaml`
- [ ] Testy z „Testing strategy" zielone; **żaden nie woła prawdziwego Selly**
- [ ] Istniejący GATE (5 fixtures Selly + reszta suity) bez regresji
- [ ] `lint`, `typecheck`, `build`, `test` zielone w `rebuild/backend/`
- [ ] Roadmapa 13d/13d-1 + backlog #60 zaktualizowane; cztery defekty produkcji opisane
