# Wpis do spec-backend od ticketu 109 (karta I15.7) · 2026-09-22

**Sekcja:** §2 (panel Selly — kontynuacja ustaleń z 8a/108: model danych i logika REST, tu Tor 2).

**Potwierdzone w 109** (`109-FEATURE-selly-rest-sync-full`, 2026-09-22, karta I15.7), port z
`origin/main` na `7d6cfc9` (stan po `5dedefb`, czyli z #81; produkcja zamrożona od 22.09):

- **Tor 2 = nocna/ręczna pełna synchronizacja Bridge → Selly** (`src/selly/rest/sync-full.ts`,
  `syncFullForDostawca(db, discovery, dostawca, opts)`), osobny od Toru 1 (delta cen/stanu, ticket 108).
  Aktualizuje `name`/`weight`/`ean`/`provider_code`/`price_purchase`/`visible`, a u KANONICZNEGO
  rekordu grupy także cechy i `category_id`. **NIE aktualizuje VAT, ceny sprzedaży ani stanu** —
  to domena Toru 1.
- **Kwalifikacja pozycji** (`collectFullSyncItems`, SQL verbatim): `p.status='aktywny'` AND
  `p.kod_importu` niepusty. **EAN nie jest wymagany** (inaczej niż Tor 1) — produkty bez EAN idą
  ścieżką B/C przez cache kodów Selly. Sortowanie po `p.kod`.
- **Słowniki auto-create** (`loadDictMaps`): `catMap` z `selly_kategoria_norm_map`, klucz
  `kategoria_raw.toLowerCase()` → `category_id_glowna` (żywe kategorie Selly, zero ID zaszytych
  w kodzie — domyka #74 po stronie Toru 2); `prodMap`/`whMap` z `selly_dict` (`slownik='producers'`/
  `'warehouses'`).
- **Trzy ścieżki na rekord:**
  - **A** (`updateExistingVariant`) — wariant już jest w `selly_products`. Nie-właściciel metadanych
    dostaje PUT bez cech. Właściciel (poza `dryRun`) dostaje: `GET /api/products/{pid}` →
    `PUT /api/products/{pid}` z pełnym payloadem (`includeFeatures:true`, lustro cech z
    `existingSellyFeatures`) i `category_id` z `catMap`.
  - **B** (`ensureAndUpdate`, produkt istnieje po EAN, wariantu brak) — `discovery.ensureMapping`
    zakłada wariant (`createVariant`), potem PUT bez cech.
  - **C** (`ensureAndUpdate`, produktu nie ma) — `discovery.ensureMapping` zakłada produkt
    (`createProduct`, auto-create), potem PUT bez cech (cechy nowego produktu już wysłał `createProduct`).
  - `autoCreate:false` pomija każdy rekord bez wariantu (`stats.skip`) i nie buduje cache kodów.
- **Kanoniczny rekord metadanych (#81, `isMetadataOwner`/`metadataScore`):** jeden produkt Selly może
  mieć warianty od kilku dostawców Bridge, ale cechy i kategoria są wspólne dla produktu — pisze je
  tylko JEDEN rekord: najwięcej wypełnionych pól z listy 21 (20 cech + `marka`), remis → niższe
  `products.id`. Grupa, w której aktywne rekordy mają różne kategorie (albo żadną), jest CELOWO
  pomijana (nikt nie pisze cech). `metadataScore` liczy `0` jako wartość WYPEŁNIONĄ — puste jest
  tylko `null`/`''`. Cecha zarządzana przez Bridge (`FEATURE_MAP`), dziś pusta, **nie dziedziczy**
  już starej wartości z Selly (mirror); cechy spoza mapy zostają nietknięte.
- **Zapisy `selly_products`:** `markProductSynced` (sukces) ustawia `ostatni_status='ok'` i
  `cena_zakupu_wyslana`; `markError` klasyfikuje `/Brak kategorii|Brak producenta/` → `missing_dict`,
  inaczej `error` — **inna klasyfikacja niż Tor 1** (tam `pending_create`), bo to dwie osobne funkcje
  w oryginale. `markError` robi `UPDATE` bez `INSERT` (jak #69 w Torze 1) — rekord bez wiersza w
  `selly_products` nie zostawia śladu poza `selly_sync_log`.
- **Zapisy `selly_sync_log`:** `operacja='sync_full'`, `szczegoly_json` ze statystykami
  (`updated_A`/`created_variant_B`/`created_C`/`err`/`skip`/`dry`), czasem trwania i stanem globalnego
  limitera (`globalnyLimiter.getStats()`). `status='blad'` **tylko** gdy były błędy I ani jeden rekord
  się nie udał (`err>0 && totalOk===0`); w każdym innym przypadku `'zakonczono'`.
- **`dryRun`:** ścieżka A pomija GET i PUT; B/C w ogóle nie wchodzą do discovery. Tor 2 w dry-run nie
  dotyka Selly poza (opcjonalną) budową cache kodów. Twardą blokadą zapisów jest niezależnie `SELLY_TRYB`.
- **Osobliwości zastane, odtworzone 1:1 (bez naprawy):**
  - wiersz Toru 2 niesie kolumnę `vat` (nie `vat_rate`) → `discovery.createVariant` (Tor 1/2 wspólny)
    czyta `vat_rate`, więc nowy wariant zakładany przez Tor 2 dostaje **zawsze `vat: 23`**;
  - gałęzie „PUT zwrócił status spoza 2xx” są martwe — klient Selly rzuca na non-2xx (jak Tor 1);
  - cache kodów (`buildProductCodeCache`) budowany tylko przy `buildCache && autoCreate`; błąd budowy
    jest połknięty (ostrzeżenie w logu), reszta synchronizacji leci dalej przez EAN/rodzeństwo.
- **Klient Selly:** nowa metoda odczytu `getProduct(productId)` (`GET /api/products/{pid}`),
  sklasyfikowana w `METODY_ODCZYTU` i objęta `SELLY_TRYB` tak samo jak reszta odczytów.

Szczegóły: `docs/tickets/109-FEATURE-selly-rest-sync-full/`.
