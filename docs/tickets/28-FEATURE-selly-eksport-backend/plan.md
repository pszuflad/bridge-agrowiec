# 28-FEATURE-selly-eksport-backend — Iteracja 8, sesja 8a (backend Selly + eksport Shoper)

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/28-selly-eksport-backend`
> Worktree: `.worktrees/28-FEATURE-selly-eksport-backend`

## Opis ticketa

Realizacja Iteracji 8, sesja 8a (BACKEND) wg `docs/rebuild-roadmap.md` §5 „Iteracja 8" + §3.
Frontend `/selly` i przycisk „Pobierz CSV (Shoper)" w `/katalog` to osobna sesja 8b PO merge tej.

CEL: dostarczyć endpointy panelu Selly + eksport Shopera za `requireAuth`, gotowe pod natywny
panel 8b.

ZAKRES — 12 tras: Selly ×10 + eksport ×2. Tabele `selly_kategoria_norm_map`,
`selly_zastosowanie_category_map`.

⭐ RESEARCH: ocena, czy `sync-product`/`sync-supplier`/`generate-csv` gadają z zewnętrznym API
Selly, i czy dzielić 8a.
⚠ BACKLOG #12 (`products.zastosowanie` / `__restoreZastosowanie`): ocenić i zaproponować.

## Kontekst

### Wynik ⭐ RESEARCH — integracja jest realna, ale granica biegnie inaczej niż zakładał prompt

Prompt pytał o `sync-product`/`sync-supplier`/`generate-csv`. Stan faktyczny
(`mirror/backend/selly/client.cjs:21-32,78-97,118-125`):

- **Zewnętrzne (6 tras)** — OAuth2 `client_credentials` do `{SELLY_SHOP_URL}/api/auth/access_token`,
  token JWT 3600 s w cache, auto-refresh na 401, Bearer na każdym wywołaniu:
  `ping`, `dictionaries`, `producers`, `categories`, `sync-product`, `sync-supplier`.
  Sekrety wyłącznie z env: `SELLY_SHOP_URL`, `SELLY_CLIENT_ID`, `SELLY_CLIENT_SECRET`,
  `SELLY_SCOPE`; `assertConfig()` (`client.cjs:28-32`) rzuca, gdy któregokolwiek brak.
  Realny ruch produkcyjny widać w `contract/fixtures/GET_selly_log.json`
  (`https://agroopony.selly24.pl/api/products`, błędy `[Selly] HTTP 400 ... Brak kategorii o id 1`).
- **Lokalne (4 trasy)** — czysty SQLite/plik, zero HTTP: `status`, `log`, `csv-status`,
  `generate-csv`. `generate-csv` odpala podproces `generate_selly_export.cjs`
  (`mirror/backend/generate_selly_export.cjs`), który czyta bazę i pisze plik 59-kolumnowy.

Czyli **`generate-csv` jest lokalny**, a **`ping` i `dictionaries` są zewnętrzne** — prompt
zakładał odwrotnie w obie strony.

### Sprostowania faktów (roadmapa/prompt ↔ stan faktyczny)

1. **`categories` i `producers` to POST, nie GET.** Roadmapa i prompt wymieniają je w grupie
   „GET status, ping, csv-status, log, dictionaries, categories, producers". W rzeczywistości:
   `POST /api/selly/producers {name}` (`mirror/backend/selly/routes.cjs:115`),
   `POST /api/selly/categories {name, parent_id, visible}` (`:128`), potwierdzone
   `contract/openapi.yaml:914` i `:974`. Podział to **5 GET + 5 POST**, nie 7 GET + 3 POST.
2. **Panel Selly w oryginale JUŻ stoi za auth.** `mirror/backend/extensions.cjs:456-458`
   rejestruje `registerSellyRoutes(app, {db, requireAuth: we})`. §3 dokłada auth wyłącznie
   dwóm trasom eksportu, które faktycznie są publiczne (`security: []`,
   `contract/openapi.yaml:611-626`).
3. **Tabele `selly_*` już istnieją** — `rebuild/schema/001_schema.sql:257-311` i drizzle
   `src/db/schema.ts:331-403`. Migracja niepotrzebna; zakres to kod, nie schemat.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ścieżki `contract/openapi.yaml` (12, wszystkie MUSZĄ walidować):**

| Metoda | Ścieżka | openapi | security w kontrakcie | u nas |
|---|---|---|---|---|
| GET | `/api/selly/ping` | `:988` | bearer+cookie | bez zmian |
| GET | `/api/selly/dictionaries` | `:934` | bearer+cookie | bez zmian |
| GET | `/api/selly/status` | `:962` | bearer+cookie | bez zmian |
| GET | `/api/selly/log` | `:952` | bearer+cookie | bez zmian |
| GET | `/api/selly/csv-status` | `:924` | bearer+cookie | bez zmian |
| POST | `/api/selly/producers` | `:974` | bearer+cookie | bez zmian |
| POST | `/api/selly/categories` | `:914` | bearer+cookie | bez zmian |
| POST | `/api/selly/sync-product` | `:996` | bearer+cookie | bez zmian |
| POST | `/api/selly/sync-supplier` | `:1007` | bearer+cookie | bez zmian |
| POST | `/api/selly/generate-csv` | `:942` | bearer+cookie | bez zmian |
| GET | `/api/export-shoper` | `:611` | **`security: []`** | **+`requireAuth` (§3, D1)** |
| GET | `/api/export/shoper` | `:619` | **`security: []`** | **+`requireAuth` (§3, D1)** |

**Fixtures (5, porównanie kształtu 1:1):**

| Plik | Kształt (klucze najwyższego poziomu) |
|---|---|
| `GET_selly_status.json` | `{items:[{dostawca,w_bridge,w_selly,z_bledami}]}` + adnotacja `_przyciete` |
| `GET_selly_ping.json` | `{ok,shop,token_prefix,expires_in_seconds,vat_probe}` |
| `GET_selly_csv-status.json` | `{ok,exists,status,powod,ostatnia_synchronizacja,wygenerowany_dzisiaj,wiek_minut,wiersze,rozmiar_bajty,rozmiar_mb,url}` |
| `GET_selly_log.json` | `{items:[{id,operacja,dostawca_kod,liczba_ok,liczba_blad,liczba_skip,szczegoly_json,uzytkownik_id,uzytkownik_imie,rozpoczeto,zakonczono,status}]}` + `_przyciete` |
| `GET_selly_dictionaries.json` | `{producers,categories,vat_rates,warehouses,refreshed}` — cztery mapy `nazwa→id` |

⚠ **`_przyciete` to adnotacja nagrywarki, nie pole API** (`contract/README.md:29`,
`test/gate/ksztalt.ts:14`) — harness ją pomija, a test musi wprost sprawdzić, że nasza
odpowiedź jej NIE zawiera (wzorzec z `analityka.dostawcy.gate.test.ts:133`).

**Brak fixtures i dlaczego to nie jest obejście gate'a:**
- eksport ×2 — nagrywarka zapisywała wyłącznie JSON (`contract/README.md`), a to `text/csv`
  i `application/zip`. Wzorzec: `analityka.eksport.gate.test.ts`
  (`sprawdzZgodnoscZKontraktemNieJson` + osobne asercje na `content-type`/`Content-Disposition`
  + test formatu bajtowego).
- `producers`, `categories`, `sync-product`, `sync-supplier` — mutacje wołające zewnętrzne
  API; produkcja ich nie nagrywała. Pokrycie: kontrakt + testy na atrapie klienta.

**Rozjazdy i jak je rozstrzygamy:** patrz „Sprostowania faktów" wyżej — we wszystkich trzech
punktach wygrywa oryginał + kontrakt, roadmapa idzie do poprawki (Faza 5).

## Decyzje

**D1 (§3, odstępstwo świadome) — `requireAuth` na obu trasach eksportu.** Kontrakt ma tam
`security: []`, oryginał jest publiczny. Kontynuacja zasady §3 i decyzji z I1/I4a/3b/I10.
Kształt i treść odpowiedzi bez zmian — zmienia się wyłącznie to, kto ją dostanie.

**D2 (Q&A) — jedna sesja 8a, klient Selly za interfejsem.** Wszystkie 12 tras w tym tickecie.
`KlientSelly` jako interfejs; produkcyjna implementacja to wierny port `client.cjs` (OAuth2,
env, cache tokenu, retry na 401). Testy wstrzykują atrapę zwracającą kształty z fixtures.
Za: 8b dostaje komplet jednym merge, kształt `_ping`/`_dictionaries` weryfikowany od razu.
Przeciw: trasy zewnętrzne przetestowane wyłącznie na atrapie — świadomie przyjęte.

**D3 (Q&A) — backlog #12 NIE portowany, opisany.** Kontynuacja decyzji 3d-2.
`__restoreZastosowanie()` (`deminified/backend-index.cjs:44105-44135`) czyta CSV spoza repo
(`/home/admin/private_apps/bridge/zastosowania/zastosowania_master.csv`, 6823 wiersze) i robi
`UPDATE products SET zastosowanie=? WHERE kod=? AND (zastosowanie IS NULL OR TRIM(zastosowanie)='')`.
Bez tego pliku nie da się odtworzyć zachowania. Skutek dla Selly jest realny i musi być
zapisany: `mapZastosowanieCategory` (`mapper.cjs`) przy pustym `zastosowanie` wpada w
`source: "fallback_kategoria"` zamiast mapować przez `selly_zastosowanie_category_map`.
Zamiast implementacji: aktualizacja wpisu #12 w backlogu o tę konsekwencję + nota
w roadmapie. Za: nie wciągamy do repo cudzego pliku danych i nie utrwalamy obejścia objawu.
Przeciw: mapowanie kategorii pokryje mniej wierszy niż produkcja — udokumentowana degradacja.

**D4 (Q&A) — ścieżki plikowe w env z domyślnymi wartościami produkcji.** Oryginał ma
`/home/admin/domains/agritires.eu/public_html/panel/ex-port-files/` i nazwę pliku
zahardkodowane w dwóch miejscach (`routes.cjs:300-301`, `:361`). Wprowadzamy
`SELLY_CSV_DIR`, `SELLY_CSV_PLIK`, `SELLY_CSV_URL` z domyślnymi = wartości produkcyjne, więc
przy pustym env zachowanie jest identyczne. Za: testy podstawiają katalog tymczasowy; deploy
bez wpisów w bazie. Przeciw: trzy zmienne więcej do ewentualnego ustawienia.

**D5 (Q&A) — `generate-csv` portowany in-process, bez podprocesu.** Generator jako
`src/selly/generator-csv.ts`: te same 59 kolumn i te same trzy transformacje
(`Kod-dostawcy` bez `_`, `cena_sprzedazy` → `123,-`, boole → `Tak`/puste), BOM, `;`, `\r\n`.
Trasa zwraca ten sam kształt `{ok, czas_ms, wiersze, rozmiar_mb, ostatnia_synchronizacja, stdout}`;
`stdout` składamy z tych samych czterech linii, które wypisuje oryginalny skrypt. Za:
testowalne bez podprocesu, jedno połączenie do bazy, działa po `npm run build`. Przeciw:
`stdout` jest syntetyczny — odnotowane w komentarzu w kodzie.

**D6 (Q&A) — brak sekretów `SELLY_*` → 500 jak w oryginale.** `assertConfig()` rzuca, trasa
oddaje `{ok:false, error}` / `{error}` ze statusem 500. Zero odstępstwa; panel 8b zobaczy to,
co produkcja.

**D7 (Q&A) — `archiver` dodany, ZIP odtworzony.** `GET /api/export-shoper` bez `?dostawca`
(albo `dostawca=wszyscy`) zwraca `application/zip` (`shoper_wszyscy_{data}.zip`) z osobnym
CSV per dostawca. Nowa zależność produkcyjna w `rebuild/backend`.

**D8 (wynika z D2, nie z Q&A) — cache tokenu Selly żyje w instancji klienta, nie w module.**
Oryginał trzyma `tokenCache` jako zmienną modułu (`client.cjs:26`), co przy dwóch procesach
i tak nie jest współdzielone. Przeniesienie do instancji nie zmienia zachowania pojedynczego
procesu, a pozwala testom mieć czysty stan. Odnotowane jako różnica strukturalna, nie
behawioralna.

## Plan implementacji

**Krok 1 — env i zależności.**
- `src/config/env.ts`: `SELLY_SHOP_URL`, `SELLY_CLIENT_ID`, `SELLY_CLIENT_SECRET`,
  `SELLY_SCOPE` (domyślnie `READWRITE`), `SELLY_CSV_DIR`, `SELLY_CSV_PLIK`, `SELLY_CSV_URL`
  (D4 — domyślne = produkcyjne). Sekrety Selly **opcjonalne** (`.optional()`), bo brak ma dać
  500 na trasie, a nie wywalić start serwera (D6).
- `.env.example` — dopisać komplet z komentarzem.
- `package.json` — `archiver` + `@types/archiver` (D7).

**Krok 2 — klient Selly (`src/selly/klient.ts`).** Port `mirror/backend/selly/client.cjs`:
`assertConfig`, `getAccessToken` (cache + `force`), `api()` (Bearer, retry na 401),
`createProduct`, `updateProduct`, `upsertProductWarehouse` (POST → fallback PUT na 400/409),
`setProductMultiCat`, `listProducers`, `createProducer`, `listCategories`, `createCategory`,
`listVatRates`, `listWarehouses`, `ping`. Interfejs `KlientSelly` + fabryka
`stworzKlientaSelly(env)` (D2).

**Krok 3 — mapper (`src/selly/mapper.ts`).** Port `mirror/backend/selly/mapper.cjs`:
`splitZastosowanie`, `mapKategoriaGlownaId` (`selly_kategoria_norm_map`),
`mapZastosowanieCategory` (`selly_zastosowanie_category_map`, trzy `source`:
`zastosowanie` / `fallback_kategoria` / `fallback_empty`), `mapProducerId`,
`mapWarehouseId`, `buildTireDescription`, `toSellyPayload`, `validatePayload`.
⚠ Nazwy pól payloadu (`name`, `category_id`, `product_code`…) to kontrakt Selly — zostają
po angielsku. Terminy domenowe Bridge (`zastosowanie`, `kategoria`, `cenaZakupu`) — po polsku.

**Krok 4 — słowniki (`src/selly/slowniki.ts`).** Port `refreshDict`/`loadMaps`/`ensureDict`
z `routes.cjs:26-79` na drizzle + `selly_dict`.

**Krok 5 — repo lokalne (`src/repos/selly.ts`).** `statusSelly(db, dostawca?)`
(`routes.cjs:252-280`), `logSelly(db, limit)` (`:283-293`), `synchronizujJedenProdukt`
(`:394-425` — `syncOneProduct`), zapis/aktualizacja `selly_sync_log`.

**Krok 6 — generator CSV (`src/selly/generator-csv.ts`).** Port
`mirror/backend/generate_selly_export.cjs` (D5) + `statusPlikuCsv()` wspólny dla
`csv-status` i `generate-csv` (oryginał ma tę logikę zduplikowaną w `:298-342` i `:345-368` —
u nas jedna funkcja, wynik identyczny; DRY bez zmiany zachowania).

**Krok 7 — trasy Selly (`src/routes/selly.ts`).** 10 tras, wszystkie `requireAuth`, kody
błędów 1:1 (`400` „Brak name" / „Brak \"kod\"" / „Brak \"dostawca\" (np. \"MO1\")",
`404` „Nie znaleziono produktu {kod}", `400` walidacji z `details`+`payload`, `500` z `message`).
Audyt: `selly_dodanie_producenta`, `selly_dodanie_kategorii`, `selly_sync_produktu`,
`selly_sync_dostawcy` — przez `zapiszAudyt` (`src/repos/audit.ts`).

**Krok 8 — eksport Shoper (`src/routes/export-shoper.ts` + `src/selly/csv-shoper.ts`).**
- `csvDostawcy(kod)` — port `a()` (`deminified/backend-index.cjs:48770-48782`): nagłówek
  stały `kod_produktu;aktywny;nazwa;cena;vat;jednostka;kategoria`, filtr `stan >= 0`,
  `aktywny` = `status==='aktywny' && stan>0`, cena `toFixed(2)` z przecinkiem, `nazwa` `;`→`,`,
  BOM, `\r\n`.
- `GET /api/export-shoper` (`:48783-48818`): bez `?dostawca` lub `wszyscy` → ZIP (D7);
  inaczej pojedynczy CSV. Audyt `eksport_csv`.
- Słownik kolumn `s` (`:48819-48841`) — 21 kluczy, `ean`/`ean_raw` w Excel-escapingu `="..."`.
- `GET /api/export/shoper` (`:48853-48863`): kolumny z `shoper.format_eksportu`
  (domyślnie `ean;nazwa;producent;rozmiar;cena_netto;magazyn;vat`), filtr `?supplier=`,
  BEZ filtra `stan>=0`, zawsze jeden CSV. Audyt `eksport_shoper`.

**Krok 9 — rejestracja w `src/app.ts`** (`trasySelly`, `trasyEksportuShoper`) + przekazanie
klienta/env z `server.ts`.

**Krok 10 — testy** (patrz niżej).

**Krok 11 — dokumentacja backlogu #12 (D3)** — bez kodu.

## Strategia testów

- `test/selly.gate.test.ts` — **GATE**: 5 fixtures przez `sprawdzZgodnoscZFixture` (kształt
  1:1) + `sprawdzZgodnoscZKontraktem` dla wszystkich 10 tras Selly + asercja braku
  `_przyciete` + 401 bez tokenu na każdej z 10.
- `test/eksport-shoper.gate.test.ts` — **GATE**: `sprawdzZgodnoscZKontraktemNieJson` dla obu
  tras, `content-type`/`Content-Disposition`, 401 bez tokenu, **auth przez samo cookie**
  (eksport to nawigacja przeglądarki, nie `fetch` — wzorzec z `analityka.eksport.gate.test.ts`).
- `test/eksport-shoper.format.test.ts` — format bajtowy: BOM, `;`, `\r\n`, stały nagłówek
  7-kolumnowy, `aktywny` 0/1, przecinek dziesiętny, `;`→`,` w nazwie, ZIP z plikiem per
  dostawca, kolumny z `shoper.format_eksportu`, `="..."` na EAN, nieznana kolumna → puste pole.
- `test/selly.generator-csv.test.ts` — 59 kolumn w kolejności, `Tak`/puste, `Kod-dostawcy`
  bez `_`, `cena_sprzedazy` `123,-`, tylko `status='aktywny'`.
- `test/selly.mapper.test.ts` — trzy ścieżki `mapZastosowanieCategory` (`zastosowanie`,
  `fallback_kategoria`, `fallback_empty`), `dziedziczy_kategorie_produktu`, dedup + kolejność
  (`category_id` = pierwszy, reszta do `extra_cat_ids`), `validatePayload` (w tym `price===0`).
- `test/selly.synchronizacja.test.ts` — na atrapie klienta: create vs update, zapis do
  `selly_products`, `selly_sync_log` (`w_trakcie`→`zakonczono`/`blad`), `dry_run`
  (`dry_payloads` max 5, zero wywołań klienta), `limit`, `only_updated`, `errors` obcięte do 50.
- `test/selly.klient.test.ts` — na lokalnym serwerze HTTP (bez mocka warstwy sieci):
  OAuth2, cache tokenu, retry na 401, `assertConfig` przy pustym env.

Bez mocków warstwy DB — wszystko na realnym SQLite w katalogu tymczasowym, jak reszta repo.
Atrapa dotyczy wyłącznie zewnętrznego Selly, którego nie mamy prawa dotykać z testów.

## Poza zakresem

- Widok `/selly` i przycisk „Pobierz CSV (Shoper)" w `/katalog` (sesja 8b).
- Podpięcie `shoper.kolumny` / `shoper.separator` z konfiguracji do przycisku (8b).
  ⚠ Serwerowa trasa `GET /api/export/shoper` czyta `shoper.format_eksportu` i to robimy TU —
  to inny klucz i inna droga niż `shoper.kolumny` z I11.
- `__restoreZastosowanie()` (D3).
- Backlog #5 („frazy" Selly) — inne narzędzie, poza iteracją.
- Migracje schematu — tabele już są.

## Definition of done

- [ ] 10 tras Selly + 2 trasy eksportu odpowiadają, wszystkie za `requireAuth`
- [ ] 5 fixtures Selly zgodne 1:1 (kształt) i żadna odpowiedź nie niesie `_przyciete`
- [ ] Wszystkie 12 ścieżek waliduje się względem `contract/openapi.yaml`
- [ ] Format obu CSV eksportu odtworzony wiernie (BOM, `;`, `\r\n`, kolumny, escaping); ZIP działa
- [ ] Generator 59-kolumnowy zgodny z `generate_selly_export.cjs`
- [ ] 401 bez tokenu na wszystkich 12 trasach; eksport działa na samo cookie
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` czyste
- [ ] Backlog #12 zaktualizowany o konsekwencję dla mapowania kategorii Selly (D3)
- [ ] Roadmapa: blok 8a zamknięty, sprostowane POST-y i auth panelu, notatki dla 8b w bloku 8b
