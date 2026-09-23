# Specyfikacja synchronizacji Selly dla nowego Bridge

> **Dokument OD ANI**, przysłany 2026-09-23 (stan opisu: 22.09.2026), wrzucony do repo bez zmian w treści.
> Weryfikacja wobec kodu produkcji i naszego portu — rozbieżności, nowe fakty i pytania:
> `docs/selly-spec-od-ani-2026-09-22-weryfikacja.md`. ⚠ Przy rozbieżności **wygrywa kod** (`origin/main`).

Dokument: kompletna specyfikacja implementacyjna synchronizacji Bridge → Selly. Na podstawie dokumentacji produkcji (wiki + sesje). Stan: 22.09.2026.

---

## Warstwa 1 — stary mechanizm z sierpnia (I8)

### Klient API Selly (`client.cjs` → `selly/klient.ts`)

OAuth2 client_credentials, token Bearer 3600s, scope READ/WRITE/READWRITE. Klucz "bridge" readwrite. Cache/refresh przy 401.

### Mapowanie produktu (`mapper.cjs` → `selly/mapper.ts`)

Funkcja `toSellyPayload()` buduje payload z `products`. Mapowanie kod Bridge → product_id Selly w tabeli `selly_products`. Endpoint `POST /api/selly/sync-product` wspiera `dry_run`.

### 10 tras (`routes.cjs` → `routes/selly.ts`)

ping, dictionaries, producers, categories, sync-product, sync-supplier, status, log, csv-status, generate-csv.

### Panel Selly we froncie (`selly-injection.js` → widok `/selly`)

Karty: Status połączenia (ping), Codzienna synchronizacja CSV (status OK/BŁĄD, data, liczba produktów, rozmiar pliku), Mapowanie dostawców, Sync dostawcy, Historia operacji. Route Selly trzymany w `sessionStorage`.

### Generator CSV (`generate_selly_export.cjs`)

**Uwaga: wersja produkcyjna ma zmiany z września, które muszą być w nowym Bridge:**

1. **60. kolumna — `Blokowane-formy-platnosci`** — mapowanie MO→formy płatności. Pełny potok: `payment_blocks.cjs` (triggery DB), `adapter.cjs` (w potoku importu), `generate_selly_export.cjs` (w eksporcie), `payment-blocks-injection.js` (we froncie). Nie tylko kolumna w CSV — to system.

2. **Nagłówek `R/D` zamiast `Konstrukcja`** — Selly importer wymaga nagłówka `R/D`. Wartości pełne: `Radialna`/`Diagonalna`. Przywrócono 14.09 po błędzie z `Konstrukcja`.

3. **Nowe nazwy kategorii w CSV** — "Rolnicze"→"Opony rolnicze", "Leśne"→"Opony leśne", "Przemysłowe"→"Opony przemysłowe", "Ciężarowe"→"Opony ciężarowe". Generator mapuje kategorie Bridge na żywe nazwy. Normalizator uwzględnia polskie znaki (`ł`).

4. **Wstrzymane produkty ze stanem 0** — CSV eksportuje aktywne i wstrzymane, ale dla wstrzymanych zawsze zapisuje `Stan-magazynowy=0`. Pierwszy plik po zmianie: 7401 wierszy = 6894 aktywne + 507 wstrzymanych.

5. **`availability_sync.cjs` (22.09) wyklucza auto-wstrzymane z CSV** — brak w pełnej wiarygodnej ofercie → od razu wstrzymuje, zeruje stan, wyklucza z CSV. 5374 aktywne wiersze, 0 wstrzymanych w CSV.

### Cron 6:00 (serwer)

Codzienne uruchomienie generatora CSV o 6:00. Plik serwowany przez Apache z ograniczeniem IP (Selly + Agrowiec) przez `.htaccess`. Drugi IP Agrowca: `46.170.251.129`.

---

## Warstwa 2 — synchronizacja przez API (wrzesień)

### Model danych — schemat tabeli `selly_products` (v2)

Klucz mapowania: `(kod_importu, dostawca) → (selly_product_id, selly_variant_id, feature_id_magazyn)`.

Ten sam `kod_importu` grupuje N rekordów Bridge (jeden na dostawcę) do jednego produktu Selly z N wariantami. ~19% katalogu Selly (874 grupy w Bridge) ma >1 wariant; największa grupa = 5 wariantów. Cena i stan per wariant; nazwa, kategoria, features produktu wspólne dla wszystkich wariantów.

**Pełny schemat:**

```
kod_importu TEXT NOT NULL + dostawca TEXT NOT NULL — klucz unikatowy (kod_importu, dostawca)
selly_product_id INTEGER NOT NULL — jeden produkt Selly na kod_importu
selly_variant_id INTEGER — unikatowy per (kod_importu, dostawca)
feature_id_magazyn INTEGER — feature_id "Magazyny" dla tego dostawcy
stan_wyslany — snapshot ostatnio wysłanego stanu
cena_sprzedazy_wyslana — snapshot ostatnio wysłanej ceny sprzedaży
cena_zakupu_wyslana — snapshot ostatnio wysłanej ceny zakupu
ostatnia_sync — timestamp ostatniej synchronizacji
ostatni_status — pending/ok/error/not_found
ostatni_blad — tekst błędu
```

Stara tabela zachowana jako `selly_products_old` (2174 przestarzałe wpisy MO1/MO2 z pierwszej próby integracji). **Nie wolno ich używać do zapisu** — powodują błędne ceny (przykład: OZKA Selly ID 1164 miał 3305 zł zamiast 368 zł przez błędne mapowanie do CULTOR).

### Feature ID Magazynów — znane wartości

Discovery uzupełnia automatycznie, ale wartości startowe:

```
MO2=5, MO3=4, MO4=3, MO5=2, MO9=1
MO1, MO7, MO8, MO10 — discovery uzupełnia przy pierwszym POST wariantu z tym dostawcą
```

### Bulk endpointy Selly — ograniczenie krytyczne

Zbiorcze endpointy `warehouse_quantity`/`price_update` zwracają **HTTP 400** dla produktów z wariantami. Jedyna droga aktualizacji ceny/stanu = **PUT konkretnego wariantu**: `PUT /api/products/{pid}/variants/{vid}` body `{quantity, price}`. Zwraca 204 przy sukcesie.

To jest fundamentalna decyzja architektoniczna: **model wariantów, nie model produktów**.

### Discovery — pełny algorytm 7 kroków

Moduł `selly/discovery.cjs`, funkcja `ensureMapping(db, bridgeRow, dictMaps?)`:

1. **Cache hit** — SELECT po `(kod_importu, dostawca)` w `selly_products`
2. **Wyszukiwanie po EAN** — `GET /api/products?ean=X` zwraca dokładnie 1 produkt (Selly ma indeks po EAN)
3. **Sibling variant Bridge** — inny dostawca tego samego `kod_importu` już ma mapping w `selly_products`
4. **Cache Selly product_code/provider_code** — jednorazowa paginacja `/api/products?sort_by=product_id&sort=ASC` (~75s dla 314 stron × 20 = 6261 produktów). Funkcja `buildProductCodeCache({force, maxAgeMs, onProgress})`
5. **Wyszukiwanie wariantu** — `GET /api/products/{pid}/variants`, filtr po `features[].name='Magazyny' && value=<dostawca>`
6. **Utworzenie wariantu** (`createVariant`) — `POST /api/products/{pid}/variants` z `{quantity, price, vat, ean, default:0, attributes:[], features:[{feature_id, name:'Magazyny', value:<dostawca>}]}`. Uwaga: `attributes: []` jest wymagane nawet puste (Selly odrzuca POST bez tego pola).
7. **Utworzenie produktu** (`createProduct`) — `POST /api/products` z payloadem z `mapper_v2.cjs`; na 400 "Istnieje produkt o tym kodzie" wykonuje `rebuildProductCodeCache()` i retry z fallbackiem do `createVariant`

Wynik funkcji: `{ product_id, variant_id, feature_id_magazyn, action: 'cache_hit'|'found_variant'|'created_variant'|'created_product'|'not_found' }`

Dodatkowe API: `buildProductCodeCache({force, maxAgeMs, onProgress})`, `rebuildProductCodeCache()`, `findProductByCode(code)`, `findProductByProviderCode(code)`

**Strategia: lazy discovery, nie masowy pre-fetch.** Pobieranie wszystkich ~6000 produktów Selly + wariantów zajęłoby ~30 min i marnowało rate limit. Discovery działa tylko dla produktów które faktycznie chcemy zaktualizować.

### `apiWithRetry` — wrapper API z throttling i retry

Krytyczna funkcja w `discovery.cjs`. Pierwsza masowa próba Tor 1 (20:10, 7.09) dała 2362 OK + 731 błędów; 100% błędów to HTTP 429. Przyczyna: `discovery.cjs` deklarował limiter w komentarzu ale **nie wywoływał go** w wewnętrznych GET/POST/PUT.

`apiWithRetry` to wrapper na wszystkie wywołania API w discovery, który:
- Throttluje zapytania (min interval 150ms)
- Ponawia przy HTTP 429 z uwzględnieniem nagłówka `Retry-After`
- Limit: 250 req/60s (oficjalny limit Selly: 300 req/60s per token)
- Błąd "produkt nie istnieje" oznaczany jako `pending_create` zamiast `error`

`sync_delta.cjs` używa `apiWithRetry` dla PUT wariantu. `sync_full.cjs` używa `apiWithRetry` dla wszystkich operacji.

### Rate limiter (`rate_limiter.cjs`)

Osobny moduł: `globalLimiter` z `rate_limiter.cjs`. 250 req/60s, min interval 150ms. Oficjalny limit Selly: 300 req/60s per token. Każda odpowiedź zawiera nagłówki `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `RateLimit-Policy`.

### Tor 1 — delta sync (`sync_delta.cjs`)

Funkcja `syncDelta(db, dostawca?, {dryRun, maxProducts})`:

1. **Wybór kandydatów** (`findDeltaProducts`): aktywne produkty + wstrzymane mające już `selly_variant_id`. Dla wstrzymanych stan efektywny = 0; nie tworzy nowych produktów ani wariantów.
2. **Discovery per produkt** — `ensureMapping()` jeśli brak mapowania w cache
3. **PUT wariantu** — `PUT /api/products/{pid}/variants/{vid}` body `{quantity, price}`. Zwraca 204 przy sukcesie.
4. **Snapshot** — po HTTP 2xx zapisuje `stan_wyslany`, `cena_sprzedazy_wyslana`, `cena_zakupu_wyslana`, ustawia `ostatni_status='ok'`
5. **Log** — insert do `selly_sync_log` (`operacja='sync_delta'`, statystyki, sample_errors do 20)

Nie dotyka nazw, kategorii, features — to jest Tor 2.

### Tor 2 — pełny sync (`sync_full.cjs` + `mapper_v2.cjs`)

Funkcja `syncFullForDostawca(db, dostawca, {dryRun, maxProducts, autoCreate, buildCache})`:

**Krok 1 — Cache Selly:** przed startem batcha wywołuje `disc.buildProductCodeCache()` (75s, jednorazowo per batch, `buildCache: i===0`)

**Krok 2 — Kandydaci:** `collectFullSyncItems(db, dostawca)` — wszystkie produkty dla dostawcy niewstrzymane, z JOIN po `(kod_importu, dostawca)` do `selly_products`

**Trzy ścieżki decyzyjne:**

**Ścieżka A (update)** — jeśli `selly_variant_id` istnieje: `updateExistingVariant()` — PUT wariantu (cena, stan) + PUT produktu (nazwa, waga, provider_code, price_purchase, visible, ean, `category_id`, produktowe features). Dane wspólne produktu pochodzą z jednego kanonicznego rekordu Bridge; grupa `kod_importu` z różnymi aktywnymi kategoriami jest blokowana zamiast wybierania kategorii przypadkowo.

**Ścieżka B (found)** — `ensureMapping()` znajduje produkt w Selly (przez EAN/sibling/cache) i istniejący wariant dla dostawcy → zapis mappingu, update jak A.

**Ścieżka C (create)** — `ensureMapping()` tworzy nowy wariant lub cały produkt (payload z `mapper_v2.buildProductPayload`, bez VAT).

Log do `selly_sync_log` z `operacja='sync_full'`, statystyki A/B/C/err/skip/dry, sample_errors do 20.

### Mapa 21 features — pełna definicja

Programista musi znać dokładne mapowanie nazw cech Selly na kolumny Bridge:

| Cecha Selly | Kolumna Bridge | Pokrycie | Transformacja |
|---|---|---|---|
| Bieżnik / model | `bieznik` | 100% | 1:1 |
| Rozmiar | `rozmiar` | 100% | 1:1 |
| Szerokość opony | `szerokosc` | 100% | 1:1 |
| Profil | `profil` | 69% | warunkowo |
| Średnica | `srednica` | 100% | 1:1 |
| Rozmiar alternatywny | `rozmiar_alternatywny` | rzadkie | warunkowo |
| R/D | `konstrukcja` | 100% | 1:1 |
| PR | `pr` | 41.7% | warunkowo |
| TL/TT | `tl_tt` | 96.8% | 1:1 |
| Indeksy | `indeksy` | ~78% | 1:1 |
| Indeks nośności | `indeks_nosnosci` | 77.5% | warunkowo |
| Indeks prędkości | `indeks_predkosci` | 78% | warunkowo |
| DOT | `dot` | 92% | 1:1 |
| Zastosowanie | `zastosowanie` | 91.8% | pierwsza wartość przed `+` |
| Przyczepność | `label_wet` | 20% | 1:1 |
| Opór toczenia | `label_rolling` | 20% | 1:1 |
| Hałas | `label_noise` | 20% | 1:1 (NNdB) |
| Błoto + śnieg | `ms` | 17.5% | Tak/null |
| Śnieg-3PMSF | `snow_3pmsf` | 18.2% | Tak/null |
| Śnieg | `label_snow` | 18.3% | Tak/null |
| Marka | `marka` | 100% | 1:1 |

**Wykluczone świadomie (NIE mapujemy):**
- `Lód` → `label_ice` jest zepsute w Bridge (wartości "0.0" w Selly to śmieci)
- Feature `Magazyny` na wariancie → osobny endpoint, nie ruszamy przez `PUT /api/products/{id}` z payloadem `features`

### Decyzje — co NIE synchronizować w Torze 2

- **`content_html`** — NIE wysyłamy. Selly ma ręcznie zredagowane opisy SEO. Nadpisanie tabelą techniczną z Bridge zniszczyłoby SEO. Test PUT potwierdził że wysłanie samej tablicy features nie rusza pozostałych pól (name, ceny, SEO, warianty).
- **`vat_rate`** — NIE synchronizujemy. VAT jest nadawany w Selly ręcznie na kategoriach.
- **`unit_of_measure`** — nie wymagane, nie wysyłamy.
- **Wymiary logistyczne** (`dlugosc`, `szerokosc_paczki`, `wysokosc`, `wysokosc_przesylki`) — NIE wysyłamy. Selly liczy dostawy sam ze swoich reguł.
- **`category_id`** — wysyłamy w Torze 2 ale tylko jako przypisanie do istniejącej kategorii. NIGDY nie wołamy `POST /api/categories` ani `PUT /api/categories/{id}` — nie ruszamy drzewa.
- **`producer_id`** — wysyłamy ale wymaga weryfikacji kompletności mapy marek.
- **`warehouse_id`** — magazyny są przez features na wariantach, nie przez `warehouse_id` produktu głównego (wszystkie produkty mają `warehouse_id=1`).
- **SEO meta** (`html_title`, `html_description`, `html_keywords`) — nie ruszamy, ręczne SEO.

### Pola wysyłane w Torze 2 (podsumowanie)

**Payload główny `PUT /api/products/{id}` (8 pól):**
1. `name` ← `nazwa`
2. `provider_code` ← `kod_importu` (NIE `kod_dostawcy` — to była naprawa buga)
3. `ean` ← `ean` (tylko gdy `ean_is_valid=1`)
4. `visible` = true gdy `status='aktywny'`
5. `weight` ← `waga`
6. `price_purchase` ← `cena_zakupu`
7. `category_id` ← z mapowania kategorii (tylko żywe ID: 1, 2, 3, 4)
8. `features` — tablica 21 cech (tylko niepuste wartości)

**PUT wariantu `PUT /api/products/{pid}/variants/{vid}` (2 pola):**
- `quantity` ← `stan`
- `price` ← `cena_sprzedazy`

### Scheduler (`scheduler_selly.cjs`)

`installScheduler(db)` wywoływane z `extensions.cjs` po rejestracji tras Selly. Tick co 60s wewnątrz procesu backendu.

**Tor 1 — aktywne cykle:**
- **HH:55** — event-driven po godzinnym auto-pull dostawców (auto-pull uruchamia się o HH:54)
- **HH:10, HH:25, HH:40** — fallback co 15 min dla ręcznych aktualizacji
- Każdy cykl wywołuje `runDeltaAll()` — `syncDelta()` po kolei dla wszystkich dostawców
- Jednorazowy przebieg dla dostawcy bez zmian trwa <1s

**Tor 2 — aktywny cykl:**
- **04:30 CEST codziennie** — `runFullBatch()` wywołuje `syncFullForDostawca()` dla dostawców z rotacji dnia
- Cache Selly budowany jeden raz per batch (`buildCache: i===0`)

**Rotacja per dzień tygodnia (FULL_ROTATION):**
- Pn: MO1/MO2
- Wt: MO3/MO4
- Śr: MO5
- Czw: MO9
- Pt: MO10
- So: MO7 (tylko pierwsza sobota miesiąca)
- Nd: MO8 (tylko pierwsza niedziela miesiąca)

### 6 tras sync-* (`routes_sync.cjs`)

Zarejestrowane w `extensions.cjs`:
- `GET /api/selly/sync-status` — ostatnie 20 wpisów z `selly_sync_log`
- `POST /api/selly/sync-delta-supplier` body `{dostawca}` — ręczny Tor 1 per dostawca
- `POST /api/selly/sync-delta-all` — ręczny Tor 1 dla wszystkich
- `POST /api/selly/sync-full-supplier` — ręczny Tor 2 per dostawca
- `POST /api/selly/sync-full-today` — ręczny Tor 2 dla dzisiejszej rotacji
- `POST /api/selly/sync-full-force` — wymuszony pełny batch (wywołuje `syncFullForDostawca` — ta sama funkcja co scheduler 04:30)

---

## Ograniczenia i pułapki API Selly

### Limity
- Limit chwilowy: 300 zapytań / 60s, okno stałe (fixed-window), per token dostępu
- Endpoint wydania tokenu limitowany per IP
- `GET /api/products` limit max 50 (100 → HTTP 400)
- `POST /api/clients/helper/bulk_update_prices`: max 100 rekordów na wywołanie
- Po przekroczeniu: HTTP 429 + nagłówek `Retry-After`
- Auth: OAuth2 client_credentials, token Bearer 3600s

### Features — ograniczenie usuwania
`PUT` **nie usuwa historycznej cechy**, gdy pole zostanie pominięte ani gdy zostanie wysłane z `values=[]` lub `values=['']`. Niepuste wartości są nadpisywane prawidłowo, lecz część dawnych pustych pól — głównie `Śnieg` — może wymagać osobnej migracji.

`mapper_v2.cjs` nie zachowuje w payloadzie pustej zarządzanej cechy (filtruje puste).

### Wstrzymane produkty — obsługa dwutorowa

Od 14.09:
- `generate_selly_export.cjs` eksportuje aktywne i wstrzymane, ale dla wstrzymanych zawsze zapisuje `Stan-magazynowy=0`
- `sync_delta.cjs` obejmuje wstrzymane tylko wtedy, gdy mają już mapowanie wariantu, i wysyła stan 0 bez tworzenia nowych pozycji

Od 22.09 (`availability_sync.cjs`):
- Brak w pełnej wiarygodnej ofercie → od razu wstrzymuje produkt, zeruje stan, wyklucza z CSV Selly
- Pewny zgodny powrót → przywraca tylko automatycznie wstrzymane; ręczne blokady pozostają
- Inny dostawca ma tę samą oponę → jego potwierdzona dostępność pozostaje
- `sync_delta.cjs`/`sync_full.cjs` zaktualizowane: warianty wstrzymane zerowane, grupy z inną aktywną ofertą nie blokowane

---

## Problemy krytyczne i znane

### Kolizje `kod_importu` — BLOKADA KRYTYCZNA

121 zduplikowanych kluczy `(dostawca, kod_importu)` = 259 aktywnych wierszy; 114 grup/245 z różnymi cenami/stanami. Współdzielony `selly_products` → snapshot nadpisywany → delty wracają co 15 min. **Naprawa `assignKodImportu` w `bridge_ext.cjs` to warunek przed dalszym syncem.**

`assignKodImportu` generuje `kod_importu` (EAN lub marka+rozmiar+bieżnik+nazwa). Jeśli ten problem nie zostanie rozwiązany, delta sync będzie w pętli — te same produkty będą wysyłane co 15 minut bo snapshot będzie nadpisywany przez współdzielony klucz.

### Stary `sync-supplier` z warstwy 1 przestaje działać

Po zmianie schematu `selly_products` (z `bridge_kod` na `kod_importu + dostawca`) stary `sync-supplier` z warstwy 1 przestaje działać. Na produkcji jest identycznie i nikt go już nie używa, bo zastąpiły go tory API.

### Blokada grup wielokategorii w Torze 2

Jeśli aktywne rekordy w jednej grupie `kod_importu` wskazują różne kategorie, grupa jest blokowana i wymaga rozstrzygnięcia zamiast automatycznej, potencjalnie błędnej aktualizacji. Wdrożone 17.09.

### Osierocony log `selly_sync_log`

`selly_sync_log` id 2725 — `sync_delta` MO2 `w_trakcie` od 2026-09-10 (restart). Scheduler nie oznacza przerwanych cykli przy starcie. To jest znany problem do rozwiązania w nowym Bridge.

### `ostatnia_sync` — zachowanie dla ścieżki A

Dla ścieżki A (update) w Torze 2, `ostatnia_sync` w `selly_products` NIE jest updatowany (tylko dla B/C przy discovery insert). To nie jest bug — kolumna służy do znakowania świeżo dodanych/znalezionych mappingów, nie do audytu każdej aktualizacji.

### `provider_code` = `kod_importu`, nie `kod_dostawcy`

Krytyczna poprawka buga: w polu `provider_code` w Selly ma być `kod_importu` z Bridge, nie `kod_dostawcy`. Kod dostawcy w ogóle nie idzie do Selly. `kod_importu` to to co grupuje warianty — ten sam `kod_importu` w Bridge = jeden produkt Selly z N wariantami.

### `content_html` — test PUT potwierdził bezpieczeństwo

Test na produkcie 4071 (Bridgestone M840): PUT z samą tablicą features (18 cech, identyczne wartości) → HTTP 204, wszystkie pozostałe pola nietknięte (name, price, content_html 1216 znaków byte-perfect, html_title, html_keywords, warianty). **Wysyłanie features nie niszczy SEO.**

---

## Tabela `selly_sync_log`

Używana dla obu torów. Pola: `operacja` ('sync_delta', 'sync_full'), statystyki (A/B/C/err/skip/dry), `sample_errors` (do 20), timestampy. Endpoint `GET /api/selly/sync-status` zwraca ostatnie 20 wpisów.

---

## Mapowanie kategorii Selly

Drzewo Selly ma 3 poziomy: kategoria główna → zastosowanie → marka jako kategoria. Klucz mapowania to para `kategoria + zastosowanie` (np. `przemysłowe|ładowarka` → 138), nie samo `zastosowanie` — nazwy zastosowań powtarzają się między kategoriami z różnymi ID.

Funkcja `mapCategoryId(kategoria, zastosowanie, catZastMap, catGlownaMap)` — szuka dokładnej pary, fallback do kategorii głównej gdy zastosowanie puste/nierozpoznane.

**Żywe kategorie (widoczne):**
- 1 = Opony rolnicze
- 2 = Opony leśne
- 3 = Opony przemysłowe
- 4 = Opony ciężarowe

Stare ukryte: 7, 8, 9, 10. `selly_kategoria_norm_map` naprawiona 11.09 na żywe ID.

`refreshDict(db, force=true)` pobiera aktualną listę kategorii z Selly do tabeli `selly_dict` przed każdą sync. `mapZastosowanieCategory` wybiera tylko ID z tej listy — nie da się wysłać ID nieistniejącej kategorii.

---

## Struktura plików produkcji (referencja)

| Plik | Rola |
|---|---|
| `selly/client.cjs` | Klient HTTP API Selly (OAuth2, cache/refresh) |
| `selly/mapper.cjs` | Mapowanie produktów Bridge → payload Selly (warstwa 1) |
| `selly/mapper_v2.cjs` | Mapper v2 — `buildProductPayload(row, dictMaps)`, bez VAT, filtruje puste features |
| `selly/discovery.cjs` | Lazy discovery przez EAN, 7 kroków, `apiWithRetry`, `buildProductCodeCache` |
| `selly/sync_delta.cjs` | Tor 1 — PUT wariantu (cena, stan), snapshot, log |
| `selly/sync_full.cjs` | Tor 2 — 3 ścieżki (A/B/C), GET+PUT, auto-create |
| `selly/scheduler_selly.cjs` | Harmonogram Tor 1 (HH:55 + HH:10/25/40) i Tor 2 (04:30 rotacja) |
| `selly/rate_limiter.cjs` | `globalLimiter` — 250 req/60s, min interval 150ms |
| `selly/routes.cjs` | 10 tras warstwy 1 |
| `selly/routes_sync.cjs` | 6 tras sync-* (ręczne/diagnostyczne) |
| `generate_selly_export.cjs` | Generator CSV — 60 kolumn, wstrzymane ze stanem 0, nowe nazwy kategorii |
| `availability_sync.cjs` | Auto-wstrzymywanie przy braku pełnej oferty (22.09) |
| `payment_blocks.cjs` | Blokowane formy płatności per magazyn (triggery DB) |

---

## Zabezpieczenia nowego Bridge (nie ma ich na produkcji)

- **Blokada `SELLY_TRYB`** — domyślnie wyłączona, produkcja musi włączyć jawnie
- **Osobne ścieżki CSV dla stagingu** — odrębne pliki dla środowiska testowego
- **Atrapa Selly w testach** — mock API, żeby nigdy nie pisały do prawdziwego sklepu
