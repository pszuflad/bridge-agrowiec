# 45-FEATURE-selly-rest-sync-tor1 — raport z implementacji

## Podsumowanie

Odtworzony w TypeScripcie podsystem synchronizacji Bridge→Selly przez REST API w zakresie
**fundamentu + Toru 1** (backlog #60, karta 13d-1): przeprojektowana `selly_products` w modelu
wariantowym, token bucket, lazy discovery po EAN, `mapper_v2`, delta stan/cena z `PUT`-em na
wariant, scheduler HH:55 + HH:10/25/40 i trzy trasy manualne. Źródło: `mirror/backend/selly/*.cjs`
na gałęzi `main` (produkcja 08.09), zamrożone — po `6872aea` nie ma tam żadnego commita.

89 nowych testów (1241 → 1330), wszystkie **za atrapą** — żaden nie dotyka
`agroopony.selly24.pl`. Cztery bramki zielone.

W trakcie portu wyszło **sześć defektów produkcji** w tym wycinku. Pięć odtworzyliśmy 1:1,
jeden naprawiliśmy za zgodą użytkownika (D1). Wszystkie są opisane niżej i w backlogu #60.

## Zmiany

**Nowe — `rebuild/backend/src/selly/`:**
- `limiter.ts` — port `rate_limiter.cjs`: 250 żądań / 60 s, minimalny odstęp 240 ms. Zegar
  wstrzykiwany (jedyne odstępstwo, wyłącznie testowe).
- `discovery.ts` — port `discovery.cjs`: `zapewnijMapowanie` (pięć kroków), nauka `feature_id`
  Magazynów, `attributes: []` przy tworzeniu wariantu, `wykonajZPonowieniem` z throttle'em.
- `mapper-v2.ts` — port `mapper_v2.cjs`: 21 cech, `provider_code = kod_importu`, tryb lustra.
- `sync-delta.ts` — port `sync_delta.cjs`: Tor 1 w całości.
- `scheduler-sync.ts` — port `scheduler_selly.cjs`, część Tor 1 (Tor 2 nieaktywny, jak u Ani).

**Nowe — pozostałe:**
- `rebuild/schema/007_selly_products_warianty.sql` — migracja modelu wariantowego.
- `rebuild/backend/src/routes/selly-sync.ts` — trzy trasy Toru 1.
- Siedem plików testowych (lista w sekcji „Wyniki testów").

**Zmienione:**
- `src/db/schema.ts` — nowy model `sellyProducts` + `sellyProductsOld`.
- `src/selly/klient.ts` — cztery nazwane metody wariantowe (D7).
- `src/selly/tryb.ts` — nowe metody dopisane do list zapisu/odczytu.
- `src/repos/selly.ts` — INSERT starej ścieżki na surowy SQL przez `db.$client` (D3).
- `src/app.ts` — jeden klient dla panelu i Toru 1 + montaż tras.
- `src/server.ts`, `src/config/env.ts` — scheduler za `SELLY_SCHEDULER` (D4).
- `contract/openapi.yaml` — trzy nowe ścieżki (D6).
- `test/gate/selly-atrapa.ts`, `test/gate/dane.ts` — obsługa wariantów + `zasiejMapowanieWariantowe`.
- `test/db.migracje.test.ts`, `test/selly.tryb.test.ts`, `test/selly.synchronizacja.test.ts`,
  `test/selly.gate.test.ts`, `test/selly.tryb.trasy.test.ts` — dostosowane do nowego schematu.

## Odstępstwa od planu

Brak co do zakresu. Trzy rzeczy doprecyzowane w trakcie, wszystkie w duchu zatwierdzonych decyzji:

1. **`syncDelta` nie dostaje limitera** (plan przewidywał wstrzyknięcie). Oryginał importuje
   `globalLimiter` w `sync_delta.cjs:14` i **ani razu go nie woła** — throttle przychodzi
   z `apiWithRetry`. Drugie wstrzyknięcie dałoby podwójne dławienie.
2. **INSERT w `repos/selly.ts` idzie przez `db.$client`**, nie przez `db.run()`. Drizzle opakowuje
   wyjątek w „Failed to run the query '<cały SQL>'" i chowa komunikat SQLite w `cause`, a ten
   komunikat trafia do odpowiedzi API i do `selly_sync_log`, czyli na ekran Ani. Oryginał używa
   `better-sqlite3` wprost i pokazuje tam przyczynę.
3. **`timer.unref()` w schedulerze Selly** — oryginał go nie woła (`scheduler_selly.cjs:99`).
   Ten sam wzorzec i to samo uzasadnienie co w `import/scheduler.ts:185`: wiszący interwał
   trzyma proces i wywraca sprzątanie testów. Dla produkcji bez znaczenia.
4. **Migracja przez `ALTER TABLE ... RENAME`**, nie przez przebudowę tabeli (plan dopuszczał wzór
   z `003`). Metodę zdradza rozkład indeksów w `main:db/schema.sql` — szczegóły w komentarzu migracji.

## Wyniki testów

**Gate odbudowy (fixtures/kontrakt): ✓ zgodne, z jawnie zapisaną granicą dowodu.**

- **Regresja istniejących fixtures — bez zmian.** Pięć nagrań Selly (`GET_selly_ping`,
  `_dictionaries`, `_status`, `_log`, `_csv-status`) przechodzi jak dotąd; zmiana schematu ich nie
  ruszyła, bo `bridge_kod` zostaje kolumną, a `GET /api/selly/status` po niej joinuje. Cała suita
  GATE zielona.
- **Trzy nowe trasy — BEZ FIXTURES, i to jest ograniczenie, nie przeoczenie.** Kształty odpowiedzi
  Selly dla `GET /api/products?ean=`, `GET/POST .../variants` i `PUT .../variants/{vid}` nie są
  udokumentowane w repo żadnym nagraniem, a nagrać ich nie sposób: wymagałoby to odpytania żywego,
  cudzego sklepu (zakaz z CLAUDE.md). `tools/record-write-fixtures.cjs` nagrywa zapisy do bazy
  Bridge, nie odpowiedzi zewnętrznego API.
  Ścieżki dopisane do `contract/openapi.yaml` (D6) i walidowane przez `sprawdzZgodnoscZKontraktem`
  (metoda, status, content-type).
  **Co to dowodzi:** że nasz kod robi to samo co kod Ani. **Czego nie dowodzi:** że Selly odpowiada
  tak, jak oboje zakładamy. Zamknięcie tej luki wymaga sandboxu Selly i sekretów, których nie mamy.

**Unit/integracyjne: ✓ 1330 (było 1241, +89).** Nowe pliki:
`selly.limiter` (6), `selly.discovery` (15), `selly.sync-delta` (19), `selly.mapper-v2` (20),
`selly.scheduler-sync` (11), `selly.sync-trasy` (8), `migracje.selly-warianty` (9).

**Bramki:** `lint` ✓, `typecheck` ✓, `build` ✓, `test` ✓ (87 plików).

**Bezpieczeństwo Selly:** żaden test nie woła prawdziwego API — klient jest wstrzykiwany, atrapa
w `test/gate/selly-atrapa.ts`, a `POST /api/selly/sync-*` nie było uruchamiane ręcznie.

## Defekty produkcji wykryte w tym wycinku

Pięć odtworzonych 1:1, jeden naprawiony. Wszystkie potwierdzone w kodzie na `main`, nie w opisach.

| # | Defekt | Co robimy | Dowód w kodzie |
|---|---|---|---|
| 1 | `POST /api/selly/sync-delta-supplier` **zawsze 500** — `routes_sync.cjs:15` importuje `syncDeltaForDostawca`, którego `sync_delta.cjs` nie eksportuje (nazwa żyje tylko w `.bak-v1-2026-09-07`) | **NAPRAWIONE** (D1) | `sync_delta.cjs:183` |
| 2 | **Retry na 429 to martwy kod** — `client.cjs:56-60` odrzuca każdą odpowiedź spoza 2xx, więc `apiWithRetry` nigdy nie ogląda `r.status`. Burzę 429 ugasił throttle, nie retry | 1:1 (D2) | `discovery.cjs:27-36` |
| 3 | **Stary `sync-supplier` (I8) zepsuty** przez nowy schemat — INSERT bez `kod_importu`/`dostawca`, które są `NOT NULL`. Produkt POWSTAJE w Selly, mapowanie u nas nie → kolejny przebieg tworzy go PONOWNIE | 1:1 (D3) | `routes.cjs:417` |
| 4 | `discovery.createProduct` woła **nieistniejące `mapper.buildProductPayload`** — nie ma go ani w `mapper_v2.cjs`, ani w `mapper.cjs` | 1:1 (D5) | `discovery.cjs:147` |
| 5 | **`pending_create` nie ma jak trafić do bazy** (nowe ustalenie, patrz niżej) | 1:1 | `discovery.cjs:213-218` + `sync_delta.cjs:96-103` |
| 6 | **`ON CONFLICT DO UPDATE` nie odświeża `ostatni_status`** — stary `pending_create` przeżywa UDANE odnalezienie wariantu | 1:1 | `discovery.cjs:229-234` |

### Defekt 5 — rozwinięcie (wyszedł dopiero przy pisaniu testów)

Cała mechanika „nieznany produkt to nie awaria, tylko robota dla Toru 2" **nie działa**:

- żeby `markError` zapisał `pending_create`, `zapewnijMapowanie` musi zwrócić komunikat
  „brak dictMaps do createProduct", a to wymaga `productId === null` po krokach 2 i 3;
- krok 3 („rodzeństwo") szuka `selly_product_id` po **samym** `kod_importu`, a ta kolumna jest
  `NOT NULL` — więc **jeśli wiersz istnieje, rodzeństwo zawsze poda `product_id`** (także własny
  wiersz podaje go sam sobie) i sterowanie idzie ścieżką tworzenia wariantu;
- **jeśli wiersza nie ma**, komunikat owszem powstaje, ale `markError` robi `UPDATE` bez `INSERT`
  i nie trafia w żaden wiersz.

Efekt: błąd jest policzony w `stats.err` i widoczny w `errors[]`, ale w bazie nie zostaje po nim
ślad. Zgadza się z tym komentarz DDL produkcji, który wymienia `pending | ok | error | not_found`
i `pending_create` w ogóle nie zna. Pokryte dwoma testami w `selly.sync-delta.test.ts`.

## Poprawki po review

- **Jedna instancja discovery na proces** (SHOULD-FIX). `app.ts` i `server.ts` tworzyły dwie
  niezależne instancje, więc cache `dostawca → feature_id` nie był dzielony: scheduler mógł
  odkryć `feature_id` dla MO6, a trasa manualna nadal wysyłałaby wariant bez cechy „Magazyny".
  Oryginał dzieli ten cache stanem modułu (`discovery.cjs:46` + `require`). `server.ts` buduje
  teraz klienta i discovery raz i podaje je do `stworzApp` (`discoverySelly`) oraz do schedulera;
  komentarz w `discovery.ts` sprostowany (twierdził „stan modułu, jak w oryginale", co nie było
  prawdą po stronie montażu).
- **`timer.unref()` odnotowany jako odstępstwo** (SHOULD-FIX) — patrz „Odstępstwa od planu" #3.
- BLOCKER z review (brak aktualizacji roadmapy i backlogu) zamknięty w Fazie 5 — patrz
  „Aktualizacja dokumentacji" niżej.

## Breaking changes

**Tak — zmiana schematu bazy.** Migracja `007` przemianowuje `selly_products` na
`selly_products_old` i tworzy nową tabelę **pustą**, dokładnie jak Ania 07.09 (u niej stara
została z 2174 przestarzałymi wpisami MO1/MO2; nowa zapełniła się lazy discovery do 6614 wpisów
przez pierwszą noc). Danych nie migrujemy — Ania też nie migrowała.

**Świadoma regresja funkcjonalna:** stary `POST /api/selly/sync-supplier` (I8) przestaje tworzyć
nowe produkty (defekt 3, decyzja D3). To jest stan, w jakim jest dziś produkcja.

**Nowa zmienna środowiskowa:** `SELLY_SCHEDULER` (domyślnie wyłączona). Bez ustawienia zachowanie
procesu jest jak dotąd — scheduler Toru 1 nie startuje.

## Follow-up

- **Tor 2 (`sync_full`) → karta 13d-2.** Przy okazji: `routes_sync.cjs:14` importuje
  `runFullTodays`, którego `scheduler_selly.cjs` nie eksportuje, więc `POST /api/selly/sync-full-today`
  i `/sync-full-force` są u Ani **też zepsute** (500). `sync-full-supplier` działa. Do rozstrzygnięcia
  w 13d-2 razem z brakującym `buildProductPayload` (defekt 4).
- **Przyciski sync w panelu `/selly` → karta 13d-3.** Będą wołać `sync-delta-supplier`, który
  naprawiliśmy w D1 — bez tej naprawy przycisk oddawałby 500.
- **Defekty 5 i 6 do decyzji Ani po cutoverze.** Oba są kosmetyczne operacyjnie (Tor 1 i tak
  ustawia `ok` po udanym PUT), ale zaciemniają diagnostykę w panelu: produkt nieznany w Selly nie
  zostawia śladu, a wiersz z nieudanym PUT-em może pokazywać mylące `pending_create`.
- **Granica dowodu dla API Selly** (brak fixtures dla `/variants`) zostaje otwarta — zamknięcie
  wymaga sandboxu Selly. Odnotowane wyżej i w `contract/openapi.yaml`.
