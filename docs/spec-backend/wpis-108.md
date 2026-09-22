# Wpis do spec-backend od ticketu 108 (karta I15.6) · 2026-09-22

**Sekcja:** §2 (panel Selly — kontynuacja ustalenia z 8a: model danych i logika REST 1).

**Potwierdzone w 108** (`108-FEATURE-selly-rest-discovery-delta`, 2026-09-22, karta I15.6), port z
`origin/main` na `7d6cfc9` (produkcja zamrożona od 22.09):

- **Model wariantowy `selly_products`** (migracja `013`, DDL verbatim `origin/main:db/schema.sql:307-331`):
  klucz `(kod_importu, dostawca)`, kolumny `selly_product_id`, `selly_variant_id`, `feature_id_magazyn`,
  `bridge_kod`, `ostatni_status`; cena/stan są PER WARIANT (nie per produkt jak w starym kształcie). Stara
  tabela zachowana jako `selly_products_old` (rename, bez przenoszenia danych — zgodnie z ręczną
  przebudową Ani z 07.09). Na bazie produkcji nowy kształt **już istnieje** (obiekty Ani), więc migracja
  013 tam nie ma efektu — patrz `docs/karty/I15.6/karta.md` sekcja „Do koordynatora” (procedura cutoveru).
- **`ensureMapping(db, row, dictMaps)`** (`discovery.ts`, port `discovery.cjs`) — 5 kroków: cache
  `feature_id`/kodów w pamięci procesu → `findVariantForDostawca` po `kod_importu` → `findProductByEan` →
  `createVariant` na istniejącym produkcie → `createProduct` (z ochroną przed duplikatem i retry po HTTP
  400 „Istnieje produkt o tym kodzie”). `budujPayloadProduktu` (mapper_v2, I15.7) jest wstrzykiwany, nie
  zaszyty w discovery.
- **`findDeltaProducts` (#77):** produkty ze statusem `wstrzymany`, które MAJĄ już wariant w Selly,
  wchodzą do delty ze stanem wymuszonym na 0 (nie są pomijane); `wstrzymany` bez wariantu jest pomijany —
  filtr działa tak samo jak w oryginale.
- **Rozróżnienie `pending_create`/`error` po TREŚCI komunikatu**, nie po osobnym polu — `syncDelta`
  klasyfikuje błąd discovery na podstawie tekstu wyjątku (kontrakt między `discovery.ts` a
  `sync-delta.ts` zachowany 1:1, łącznie z defektami #69/#70: `pending_create` nie zostawia śladu w
  `selly_products`, a `ON CONFLICT DO UPDATE` nie odświeża `ostatni_status` po udanym odnalezieniu
  wariantu — oba odtworzone jako zastane, nie naprawiane).
- **Limiter (`rest/limiter.ts`)** — 250 zapytań/60 s, `MIN_INTERVAL_MS` 240 ms, `getStats()`; retry po
  HTTP 429 jest MARTWY KOD (#66) — throttle limitera gasi zapytanie, zanim retry ma szansę zadziałać;
  odtworzone identycznie jak oryginał (defekt operacyjny, nie naprawiany).
- **Odstępstwo D4 (#67):** stary `POST /api/selly/sync-supplier` (panel I8) w produkcji pada na
  `NOT NULL constraint failed` po migracji 013 (INSERT gałęzi CREATE nie podaje `kod_importu`/`dostawca`,
  produkt mimo to powstaje w Selly, mapowanie nie zapisuje się, kolejny przebieg tworzy duplikat). W
  odbudowie to **naprawione świadomie**: `repos/selly.ts` zapisuje `kod_importu`/`dostawca` w INSERT-cie
  CREATE, a produkt bez tych pól kończy się błędem przed wywołaniem Selly. Jedyne świadome odstępstwo tej
  karty od zachowania 1:1.

Szczegóły: `docs/tickets/108-FEATURE-selly-rest-discovery-delta/`.
