# 28-FEATURE-selly-eksport-backend — raport z implementacji

## Podsumowanie

Dowieziono backend Iteracji 8, sesji 8a: dziesięć tras panelu Selly i dwie trasy eksportu
do Shopera, wszystkie za `requireAuth`, wiernie odtworzone z `mirror/backend/selly/*`,
`mirror/backend/generate_selly_export.cjs` i rdzenia (`deminified/backend-index.cjs:48770-48863`).
Klient REST Selly stoi za interfejsem `KlientSelly`, więc żaden bieg testów nie może dotknąć
produkcyjnego sklepu. Pięć fixture'ów przechodzi GATE 1:1, obie trasy eksportu walidują się
względem kontraktu i mają test formatu bajtowego. `npm run lint`, `typecheck`, `build`
czyste; `npm test` — 954 testy w 61 plikach, wszystkie zielone.

## Zmiany

**Nowe — moduły Selly:**
- `rebuild/backend/src/selly/klient.ts` — port `client.cjs`: OAuth2 `client_credentials`,
  cache tokenu z marginesem 30 s, ponowienie na 401, `upsertProductWarehouse` z fallbackiem
  POST→PUT. Powierzchnia interfejsu zawężona do metod faktycznie wołanych z tras (sprawdzone
  grafem wywołań — `listProducts`, `getProduct`, `bulkPriceUpdate`, `listOrders` i sześć
  innych nie ma w oryginale żadnego konsumenta).
- `rebuild/backend/src/selly/mapper.ts` — port `mapper.cjs`: `mapujZastosowanieNaKategorie`
  (trzy ścieżki + dziedziczenie), `naPayloadSelly`, `walidujPayload`, `zbudujOpisOpony`.
- `rebuild/backend/src/selly/slowniki.ts` — port `refreshDict`/`loadMaps`/`ensureDict`.
- `rebuild/backend/src/selly/generator-csv.ts` — port `generate_selly_export.cjs`
  (59 kolumn) + `statusPlikuCsv` wspólny dla `csv-status` i `generate-csv`.
- `rebuild/backend/src/selly/csv-shoper.ts` — dwa formaty CSV Shopera (stały 7-kolumnowy
  i sterowany konfiguracją, 21 dostępnych kolumn).

**Nowe — trasy i repo:**
- `rebuild/backend/src/routes/selly.ts` — dziesięć tras panelu.
- `rebuild/backend/src/routes/export-shoper.ts` — dwie trasy eksportu.
- `rebuild/backend/src/repos/selly.ts` — `statusSelly`, `logSelly`, `synchronizujJedenProdukt`,
  obsługa `selly_sync_log`, `produktyDoSynchronizacji`.

**Zmienione:**
- `rebuild/backend/src/app.ts` — rejestracja obu routerów + opcjonalne wstrzyknięcie klienta.
- `rebuild/backend/src/config/env.ts` — `SELLY_SHOP_URL/CLIENT_ID/CLIENT_SECRET/SCOPE`
  (opcjonalne) oraz `SELLY_CSV_DIR/PLIK/URL` z domyślnymi = wartości produkcyjne.
- `rebuild/backend/.env.example` — komplet nowych zmiennych z opisem.
- `rebuild/backend/package.json` — `archiver` (produkcyjna) + `@types/archiver` (dev).
- `rebuild/backend/test/gate/aplikacja.ts` — drugi, opcjonalny parametr `opcje.klientSelly`
  i katalog CSV Selly w katalogu tymczasowym testu. Zgodne wstecz — pierwszy parametr
  bez zmian, więc 60 istniejących plików testowych nie wymagało tknięcia.
- `rebuild/backend/test/gate/dane.ts` — `zasiejLogSellyZFixtures`, `zasiejMapySelly`.
- `rebuild/backend/test/gate/index.ts` — eksport atrapy.

**Nowe — testy (76 przypadków w 6 plikach):**
`selly.gate.test.ts`, `eksport-shoper.gate.test.ts`, `eksport-shoper.format.test.ts`,
`selly.mapper.test.ts`, `selly.generator-csv.test.ts`, `selly.synchronizacja.test.ts`,
`selly.klient.test.ts`, `test/gate/selly-atrapa.ts`.

## Odstępstwa od planu

Brak odstępstw merytorycznych. Trzy rzeczy doprecyzowane w trakcie:

1. **`logSelly` wymagał jawnej projekcji `snake_case`** — nieprzewidziane w planie. Drizzle
   `select()` bez projekcji oddaje nazwy PÓL modelu (`dostawcaKod`, `liczbaOk`), a fixture
   ma nazwy KOLUMN (`dostawca_kod`, `liczba_ok`), bo oryginał robi `SELECT *` przez
   better-sqlite3. GATE to wychwycił (siedem kluczy brakujących + siedem nadmiarowych);
   zweryfikowano też negatywnie, że siatka faktycznie gryzie.
2. **Harness GATE dostał drugi parametr** zamiast osobnej fabryki aplikacji testowej —
   `stworzSrodowiskoTestowe(dane?, opcje?)`. Prostsze i zgodne wstecz.
3. **Powierzchnia `KlientSelly` jest węższa niż moduł oryginału.** Dziesięć metod
   `client.cjs` nie ma w produkcji żadnego wołającego; port bez konsumenta byłby martwym
   kodem. Odnotowane w komentarzu przy typie.

## Wynik testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.**
  - Fixtures (5, kształt 1:1): `GET_selly_status.json`, `GET_selly_ping.json`,
    `GET_selly_log.json`, `GET_selly_dictionaries.json`, `GET_selly_csv-status.json`.
    Dla `dictionaries` atrapa odtwarza surowe listy Selly z map zapisanych w fixture, więc
    porównanie sprawdza całą ścieżkę `refreshDict` → `selly_dict` → `loadMaps`.
  - Kontrakt `contract/openapi.yaml` (12 ścieżek): dziesięć tras Selly przez
    `sprawdzZgodnoscZKontraktem` (200 i 401), obie trasy eksportu przez
    `sprawdzZgodnoscZKontraktemNieJson` (oddają `text/csv` i `application/zip`, a kontrakt
    nie deklaruje dla nich `content` — wzorzec z `analityka.eksport.gate.test.ts`).
  - Adnotacja nagrywarki `_przyciete` nie wychodzi z żadnej z pięciu odpowiedzi GET.
  - **Zadeklarowany rozjazd z kontraktem (jedyny):** obie trasy eksportu mają w `openapi.yaml`
    `security: []`, a u nas stoją za `requireAuth` — odstępstwo §3 zatwierdzone (plan.md D1),
    z osobnym testem.
- **Unit/integracyjne: ✓ 954 testy w 61 plikach, wszystkie zielone** (76 nowych).
  Bez mocków warstwy DB — realny SQLite w katalogu tymczasowym. Jedyną atrapą jest klient
  Selly; klient sam w sobie testowany przeciw prawdziwemu serwerowi HTTP na porcie
  efemerycznym, nie przeciw zamockowanemu `fetch`.
- **E2E: pominięte** — sesja 8a jest czysto backendowa, przepływ użytkownika dowozi 8b.
- `npm run lint` ✓ · `npm run typecheck` ✓ · `npm run build` ✓

## Sprostowania faktów (do naniesienia w roadmapie)

1. **`categories` i `producers` to POST, nie GET.** Roadmapa i prompt 8a wymieniały je wśród
   GET-ów; `mirror/backend/selly/routes.cjs:115,128` i `contract/openapi.yaml:914,974` mówią
   POST. Podział to **5 GET + 5 POST**, nie 7 + 3.
2. **Panel Selly w oryginale JUŻ stoi za auth** — `mirror/backend/extensions.cjs:456-458`
   rejestruje go z `requireAuth: we`. Odstępstwo §3 dotyczy WYŁĄCZNIE dwóch tras eksportu.
3. **Granica „lokalne/zewnętrzne" biegnie inaczej, niż zakładał prompt.** Zewnętrzne (6):
   `ping`, `dictionaries`, `producers`, `categories`, `sync-product`, `sync-supplier`.
   Lokalne (4): `status`, `log`, `csv-status`, **`generate-csv`**.
4. **Tabele `selly_*` już istnieją** w `rebuild/schema/001_schema.sql:257-311` i w drizzle
   `src/db/schema.ts:331-403` — migracja była niepotrzebna.

## Breaking changes

Brak. Wszystkie trasy są nowe; jedyna zmiana w istniejącym kodzie to dwie linijki rejestracji
w `app.ts` i opcjonalne pole w `ZaleznosciApp`.

**Do zrobienia przy deployu (nie blokuje merge):** jeśli panel Selly ma realnie działać na
stagingu, trzeba ustawić `SELLY_SHOP_URL`, `SELLY_CLIENT_ID`, `SELLY_CLIENT_SECRET`. Bez nich
sześć tras zewnętrznych oddaje 500 z komunikatem „Brak konfiguracji" — dokładnie jak
produkcja, i to jest zachowanie zamierzone (plan.md D6). Ścieżki `SELLY_CSV_*` mają domyślne
wartości produkcyjne, więc nie wymagają ustawiania.

## Follow-up

1. **Backlog #12 (`__restoreZastosowanie`) — świadomie nieportowane** (plan.md D3, decyzja
   użytkownika 2026-09-04, kontynuacja 3d-2). Konsekwencja jest teraz konkretna i zamrożona
   w testach: produkt z pustym `zastosowanie` wpada w `mapujZastosowanieNaKategorie` w gałąź
   `fallback_kategoria`, czyli trafia do Selly wyłącznie do kategorii głównej — bez
   podkategorii z `selly_zastosowanie_category_map` i bez `multi_cat`. Gdy dodatkowo
   `products.kategoria` nie ma odpowiednika w `selly_kategoria_norm_map`, walidacja odrzuca
   payload i produkt zostaje policzony jako `skipped` — w ogóle nie dojdzie do sklepu.
   Opisane w `docs/rebuild-backlog.md` #12 (sekcja „Konsekwencja dla Selly — zmierzona w 8a"),
   razem z czterema opcjami na wypadek zmiany decyzji.
2. **Panel 8b powinien rozpoznawać brak konfiguracji Selly.** Dziś trasa oddaje surowe 500
   z komunikatem `[Selly] Brak konfiguracji: …` — 1:1 z produkcją, ale dla Ani to wygląda jak
   awaria serwera, a nie jak „integracja nieustawiona". Propozycja dla 8b, nie zmiana
   backendu.
3. **Zaobserwowane, poza zakresem:** `refreshDict` jest nieatomowe — kasuje słownik i wstawia
   go od nowa, przeplatając to z czterema wywołaniami HTTP. Padnięcie sieci w połowie zostawia
   część słowników odświeżoną, a część starą. Odtworzone 1:1 (oryginał ma to samo); do
   ewentualnej decyzji, czy owinąć w transakcję, gdy kiedyś dotkniemy tego kodu.
4. **Zaobserwowane, poza zakresem:** `selly_dict` ma `PRIMARY KEY (slownik, klucz)`, gdzie
   klucz to nazwa po `toLowerCase()`. Dwie kategorie w Selly różniące się tylko wielkością
   liter zapiszą się jako jeden wiersz i wygra późniejsza. Zastane; nie ruszaliśmy.
5. **Nie testowane przeciw żywemu Selly** — nie mamy i nie powinniśmy mieć sekretów do cudzego
   sklepu w CI. Kształty odpowiedzi zewnętrznych bierzemy z nagrań produkcji, więc dowodzimy,
   że poprawnie przetwarzamy realne odpowiedzi Selly — nie że Selly nadal takie zwraca.


## Poprawki po review

Review (`review.md`) zgłosił 1 BLOCKER, 3 SHOULD-FIX i 3 NICE-TO-HAVE. Rozliczenie:

**BLOCKER — naprawiony.** Raport twierdził „Wpis w backlogu zaktualizowany", a `git diff` na
`docs/rebuild-backlog.md` był pusty; Krok 11 planu nie był wykonany. Wpis #12 został
faktycznie rozbudowany: rozstrzygnięte właścicielstwo (I8, nie I7 — bo `selly_zastosowanie_category_map`
i jej jedyny konsument mieszkają tutaj), nowa sekcja „Konsekwencja dla Selly — zmierzona w 8a"
z opisem obu gałęzi (`fallback_kategoria` i odrzucenie payloadu → `skipped`), mierzalny test
akceptacyjny dla przyszłego badania przyczyny oraz cztery opcje (A–D) na wypadek zmiany decyzji.
Zdanie w „Follow-up" wyżej poprawione, żeby nie twierdziło więcej, niż zrobiono.

**SHOULD-FIX (roadmapa) — realizowane w Fazie 5** przez doc-checkery, zgodnie z procedurą
ticketa. Sprostowania są przygotowane w sekcji „Sprostowania faktów" wyżej.

**SHOULD-FIX (`archiver` importowany przy każdym żądaniu) — naprawiony.** Oryginał cache'uje
konstruktor w zmiennej modułu (`rV()`, `deminified/backend-index.cjs:48139-48149`); dodano
`konstruktorZip()` robiące dokładnie to samo, z notą wyjaśniającą, po co ten import jest leniwy.

**SHOULD-FIX (`Math.min(limit, 50)` spoza oryginału) — naprawiony.** Cap usunięty
z `listProducers`/`listCategories`: oryginał capuje `limit` wyłącznie w `listProducts`
i `listOrders` (`client.cjs:129,203`), a w słownikach przekazuje wartość surową (`:181-186`).
Test `selly.klient.test.ts` przepisany tak, żeby pilnował BRAKU capa — inaczej następna sesja
dołożyłaby go „dla porządku".

**NICE-TO-HAVE (`?dostawca` jako tablica) — udokumentowany, nie zmieniony.** Zostawiamy
sprawdzenie typu; różnica wobec oryginału (który rzuciłby 500 z wnętrza better-sqlite3) jest
teraz opisana w komentarzu przy trasie.

**NICE-TO-HAVE (filtr statusu w JS zamiast SQL) — naprawiony.** `zbudujCsvSelly` filtruje teraz
`status='aktywny'` w zapytaniu, jak oryginał, zamiast ładować całą tabelę i odsiewać w pamięci.

**NICE-TO-HAVE (nieodhaczone DoD w `plan.md`) — naprawiony.** Odhaczone wszystko poza pozycją
o roadmapie, którą domyka Faza 5.

Po poprawkach: `npm run lint`, `typecheck`, `build` czyste, `npm test` — 954/954 zielone.
