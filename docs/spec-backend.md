# Specyfikacja backendu Bridge — ZWERYFIKOWANA

Werdykt weryfikacji dokumentacji, którą Perplexity wygenerowało dla backendu
(`docs/incoming/backend-perplexity/backend_doc/`), skonfrontowanej niezależnie
z naszym kodem (`deminified/backend-index.cjs`, `mirror/backend/*.cjs`,
`db/schema.sql`, `db/snapshot.db` — ten sam rdzeń, MD5 `b745bf95…`).

> **Werdykt: dokumentacja Perplexity jest RZETELNA i przyjęta jako referencja.**
> W przeciwieństwie do dokumentacji frontendu (która miała zmyślone endpointy),
> ta cytuje `plik:linia` przy każdej tezie, oznacza `NIEZNANE`, nie ujawnia
> sekretów i **sama raportuje rozbieżności z moim audytem**. Spot-checki na naszym
> kodzie potwierdziły kluczowe twierdzenia. Szczegóły są w 7 plikach źródłowych;
> ten dokument to warstwa weryfikacji + korekty do propagacji.

**Kanoniczna referencja (przyjęta):**
`docs/incoming/backend-perplexity/backend_doc/` — `00_PODSUMOWANIE`, `01_ENDPOINTY`,
`02_SCHEMAT_BAZY`, `03_IMPORT_tk`, `04_WARSTWA_DANYCH`, `05_PARSERY_MODULY`,
`06_KONFIGURACJA`, `schema.sql`.

---

## 1. Rozbieżności z moim audytem — 3 KOREKTY

Weryfikacja zmusza mnie do poprawienia trzech rzeczy z `audit-2026-07-22.md`
i `audit-delta.md`:

| Pozycja | Mój audyt | Stan faktyczny (zweryfikowany) |
|---|---|---|
| **Selly routes** | „niepodpięte, `selly/routes.cjs` nigdy niewywoływane" | ❌ **BŁĄD** — są rejestrowane warunkowo: `extensions.cjs:395-396` `registerSellyRoutes(app, {db, requireAuth: we})`. Potwierdzone w naszym `mirror/`. |
| **PM2** | „nie działa / nie ma w PATH" | ❌ nieaktualne — proces `bridge-backend` online (fork, PID 1385800), demon 5.4.2. Binarka po prostu nie jest w interaktywnym PATH. |
| **Duplikat tras `/api/atrybuty` w rdzeniu** | „istnieją równolegle w rdzeniu i module" | ❌ nieaktualne — 6 tras usunięto z rdzenia (06.08); Atrybuty rejestruje wyłącznie Extensions. |

## 2. ⚠ ELEWOWANE ustalenie: auth jest CZĘŚCIOWY (bezpieczeństwo)

Moja delta pisała „auth naprawione" — **za optymistycznie**. Naprawa z 06.08 objęła
tylko katalog (`/api/products`, `/api/dostawcy`, `/api/suppliers`, `/api/users`).
Weryfikacja na naszym `deminified`: **32 z 49 tras rdzenia ma `we`, 17 nie ma.**

**Publiczne (bez logowania) endpointy danych — do naprawy:**
```
GET  /api/history            GET  /api/history/meta      GET  /api/history/paged
GET  /api/audit-log          GET  /api/config            GET  /api/overrides
GET  /api/staging            GET  /api/markups           GET  /api/promotions
GET  /api/alerts             GET  /api/spedycja
GET  /api/export/shoper      GET  /api/export-shoper     ← pełny katalog CSV bez auth!
POST /api/waga-gabarytowa/oblicz
```
Najgroźniejsze: **`/api/export/shoper`** (każdy pobierze cały katalog),
**`/api/audit-log`** i **`/api/history`** (log działań i zmian), **`/api/config`**.

Dodatkowo subtelność z rejestracji tras — sprostowane w I5: rejestracje `/api/history/meta`
i `/api/history/paged` są **trzy**, nie dwie. Rdzeń rejestruje je bez `we` (`:48335`, `:48352`);
`mirror/backend/pagination_module.cjs:136,168` rejestruje je ponownie z `we`, a ten moduł jest
ładowany dwukrotnie (`extensions.cjs:449-451` oraz wprost z `index.cjs`). Express bierze
pierwszy pasujący handler, więc żywy jest handler z rdzenia (bez auth) i obie trasy są
**faktycznie publiczne** — wniosek się nie zmienia, tylko liczba rejestracji.

> **Odbudowa (I1a, `1-FEATURE-backend-fundament-logowanie`):** w `rebuild/backend`
> zasada jest odwrócona od startu — `requireAuth` nakłada się jawnie na trasy danych,
> publiczne zostają tylko `/api/login`, `/api/logout` i `/api/health`. Konkretne
> endpointy z listy wyżej (products, staging, history, audit-log, export/shoper…)
> wjeżdżają dopiero w iteracjach 2+, każdy już pod `requireAuth`; ta lista opisuje
> stan **oryginału**, nie nowego backendu.
>
> **Potwierdzone w I2** (`3-FEATURE-katalog-odczyt`): `GET /api/products`, `GET /api/suppliers`
> i `GET /api/dostawcy` wjechały pod `requireAuth`, zgodnie z zasadą powyżej — i zgodnie
> z kontraktem, który dla tych operacji deklaruje `security: [bearerAuth, cookieAuth]`,
> więc to nie jest odstępstwo. `GET /api/products/{id}` nie istnieje ani w produkcji, ani
> w `contract/openapi.yaml` — nie został odtworzony (szczegóły endpointów: `spec-frontend.md`
> / `docs/tickets/3-FEATURE-katalog-odczyt/`, nie zakres tego pliku).
>
> **Potwierdzone w 3b** (`5-FEATURE-staging-endpointy-importu`): `GET /api/staging` też wjechało
> pod `requireAuth`, mimo że kontrakt ma dla niego `security: []` — świadome, dziedziczone
> odstępstwo (D1), ten sam wzorzec co przy `/api/products`.
>
> **Potwierdzone w 4a** (`15-FEATURE-narzuty-promocje-ceny`): `GET/POST /api/markups`
> i `GET/POST /api/promotions` (oraz `PATCH`/`DELETE` po `{id}`) wjechały pod `requireAuth`,
> ten sam wzorzec D1, mimo że oryginał i `security: []` w openapi mają je publiczne.
>
> **Potwierdzone w I5** (`15-FEATURE-historia-zmian`, 2026-09-02): `GET /api/history`,
> `/api/history/meta` i `/api/history/paged` też wjechały pod `requireAuth`, mimo
> `security: []` w kontrakcie — ten sam wzorzec D1. Przy okazji sprostowane tabele: `/api/history`
> czyta `history` (`Wa`, goła tablica wierszy, 10 pól), `/meta` i `/paged` czytają `audit_log`
> (`Za`) i zwracają odpowiednio `{ dostawcy: string[] }` oraz `{ items, total, pages, page, limit }`
> z 11 polami na `item` — żadna z tras nie dotyka `historia_cen`. Szczegóły:
> `docs/tickets/15-FEATURE-historia-zmian/`.
>
> **Potwierdzone w 10a** (`19-FEATURE-analityka-fundament`, 2026-09-03): pięć tras
> `/api/analytics/*` (`filters`, `status`, `kpi`, `margins`, `bootstrap-current`) wjechały pod
> `requireAuth` — ale to **NIE jest odstępstwo D1**, inaczej niż w powyższych wpisach: kontrakt
> już deklarował `security: [bearerAuth, cookieAuth]` i oryginał już miał `requireAuth` w każdej
> z 27 rejestracji modułu `analytics_module.cjs`. Przy okazji: `currentWhere()` (`:60-74`),
> zbudowana pod filtrowanie `margins` po sześciu wymiarach, ma **zero wywołań w całym module** —
> martwy kod w produkcji; odbudowa jej świadomie nie ożywia (`GET /margins` bez query params,
> filtrowanie po stronie klienta). Szczegóły: `docs/tickets/19-FEATURE-analityka-fundament/`.

## 3. Potwierdzone z lipca (Perplexity niezależnie zgadza się ze mną)

- **CORS odbija dowolny `Origin` + `Allow-Credentials: true`** — ryzyko CSRF (`be.cjs:48926`).
  **Odbudowa (I1a):** CORS domyślnie wyłączony; opcjonalna allowlista przez `CORS_ORIGINS`
  (staging jest same-origin przez proxy Apache).
- **≥4 niezależne uchwyty `better-sqlite3`** do jednej bazy (rdzeń `Qi`, Extensions
  `_bridgeDb`, Atrybuty, Pending); WAL, więc działa, ale wielu writerów = ryzyko blokad.
- **Handler błędów przed modułami** — nie łapie błędów tras modułowych; moduły ratują
  się lokalnym `try/catch`.
- **Podwójna rejestracja** analytics (×2) i pagination — druga warstwa martwa.
- **`JWT_SECRET` z zahardkodowanym fallbackiem** (Perplexity nie cytuje wartości — słusznie).
  **Odbudowa (I1a):** `JWT_SECRET` wymagany z env, bez fallbacku — serwer nie startuje bez niego.
- **Dryf schematu** potwierdzony: tabele `atrybuty_wartosci_pending`,
  `atrybuty_wartosci_odrzucone`, `selly_kategoria_norm_map`,
  `selly_zastosowanie_category_map`; kolumny `products.kod_importu`, `products.zastosowanie`.

## 4. Kontrakt — liczby (zweryfikowane)

| Element | Wartość | Weryfikacja |
|---|---|---|
| Endpointy rdzenia | **49** rejestracji | zgodne z naszym `deminified` |
| Endpointy modułowe | 66 def. (64 żywe po deduplikacji) | Atrybuty 11, Analytics 27, Pending, Paginacja 4, Selly |
| Unikalne pary metoda+ścieżka | ~113 | 49 + 66 − 2 przesłonięte |
| Metody `U.*` | **50 zdefiniowanych** / 47 używanych | Perplexity liczy definicje (`04_WARSTWA_DANYCH`), ja użycia — obie liczby poprawne |
| Tabele | 27 (z `sqlite_sequence`) / 26 użytkowych | bez zmian od lipca |
| `products` | 72 kolumny, 7 405 wierszy | +`nieobecnosc_pod_rzad` vs lipiec |
| Uchwyty SQLite | ≥4 | patrz §3 |

## 5. Silnik importu `tk()` — najcenniejszy zasób

`03_IMPORT_tk.md` zawiera **realny diagram decyzyjny** wyprowadzony z kodu (z cytatami
linii) — to bezpośrednie wejście do odbudowy (Faza 4, kierunek A). Kluczowe reguły
potwierdzone (zweryfikowane w 3c wobec żywego `tk = function` w
`deminified/backend-index.cjs:47584-47851`):
- dopasowanie po kodzie → po EAN → **po EAN znormalizowanym** (`:47698`, gdy surowy EAN
  dostawcy nie trafił w mapę, dopasowanie po wartości z `Hq()`) → kod zastępczy `Lq()`
  tylko dla opony;
- `Gq()` = `manual_overrides`: przy konflikcie **zachowuje wartość Marty**, zapisuje do `snapshotJson`
  (poza zakresem 3c — `Gq()` tam jest stubem przepuszczającym, realna logika to 3d);
- `Zc()` = klasyfikator „czy opona";
- auto-zatwierdzenie **tylko** zmian cena/marża/stan/magazyn → wpis do `historia_cen`
  (3c liczy tylko decyzję i licznik `autoZatwierdzone`; sam zapis efektu to 3d);
- wycofanie po **3 kolejnych** nieobecnościach (`WYCOFANIE_PROG_IMPORTOW=3` ↔ kolumna `nieobecnosc_pod_rzad`) — pętla wycofań poza zakresem 3c, jest w 3d;
- **SPROSTOWANIE (3c): nie ma reguły „EAN auto-zmieniany tylko dla długości 8/12/13/14 i nie
  kończący się pięcioma zerami"**, mimo że tak twierdziły ta specyfikacja i
  `docs/incoming/backend-perplexity/backend_doc/03_IMPORT_tk.md`. Ta reguła istnieje
  **wyłącznie w martwej `function tk`** (`deminified/backend-index.cjs:47499-47512`),
  nadpisanej przez późniejsze przypisanie `tk = function` (`:47584`). Żywy `tk()` buduje
  auto-patch produktu tylko z `cenaZakupu`/`cenaSprzedazy`/`marzaPct`/`stan`/`magazyn` i
  **nigdy nie ustawia `AP.ean`** — produkcja nie aktualizuje EAN istniejącego produktu przy
  imporcie. Reguła **nie wchodzi** do portu (decyzja D4, `docs/tickets/6-FEATURE-silnik-tk-dopasowanie-klasyfikator/plan.md`).
  `03_IMPORT_tk.md` powtarza ten sam błąd i **zostaje bez zmian** — to materiał źródłowy
  Perplexity, nieredagowany; sprostowanie mieszka tutaj;
- `kod_importu` nadaje `bridge_ext.assignKodImportu` (nie sama `tk`), grupując po EAN
  lub marka+rozmiar+bieznik+nazwa — potwierdzone: wywoływane wyłącznie w `addProductsBulk`
  (`:44791`) i `acceptStaging` (`:44903`), obie poza `tk()` i poza zakresem 3c (3d).

Dodatkowe ustalenia z charakteryzacji 3c, niewidoczne z samego czytania kodu:
- `U.addStaging` (`:44923`) deduplikuje po `(kod, typ_zmiany, COALESCE(powod,''))` i przy
  trafieniu nie zapisuje nic — licznik `doStagingu` liczy długość bufora, nie liczbę
  realnych zapisów (`:47849-47850`).
- `d.eanIsValid === false` w klasyfikatorze (`:47712`, `:47758`) jest w praktyce martwe:
  `Hq()` (`:47357`) zapisuje w tym polu zawsze `1` albo `0`, nigdy `boolean`.
- Pętla porównania pól po `Vq` (`:47749`) pomija przypadek „stara wartość pusta, nowa
  niepusta" — uzupełnienie brakującego pola klasyfikuje pozycję jako zmienioną, ale nie
  pojawia się jako składnik `powod`.

> **Odbudowa (3a, `4-FEATURE-port-parserow-charakteryzacja`):** potok WEJŚCIA do `tk()` —
> `dispatcher.parseByKod() → parser.parseFile() → adapter.recordsToSurowe()` — jest przeportowany
> 1:1 do `rebuild/backend/src/import/legacy/` i pokryty testem charakteryzacyjnym na próbkach
> MO1–MO10 (potwierdza m.in., że MO9 realnie ignoruje plik i ciągnie dane z GraphQL Agrorami, zgodnie
> z `05_PARSERY_MODULY.md`). `bridge_ext.cjs`/`tire_dims.js` i sam silnik `tk()` zostają poza zakresem
> do sesji 3c. Szczegóły: `docs/tickets/4-FEATURE-port-parserow-charakteryzacja/`.
>
> **Odbudowa (3b, `5-FEATURE-staging-endpointy-importu`):** brzeg stagingu i importu
> odtworzony (`GET /api/staging`+`/paged`+`/{id}`, `POST /api/import/parse-file`,
> `/api/import/from-url`, `POST /api/ai-fallback/parse`); `tk()` sam pozostaje jawnym,
> świadomie niewiernym placeholderem do 3c. Po drodze wyjaśniły się trzy osobne mechanizmy,
> które łatwo pomylić: `/api/import/*` (bez fallbacku, `mirror/backend/extensions.cjs`),
> `POST /api/dostawcy/:kod/upload` (rdzeń, fallback do starych parserów `Wc()`, nie AI —
> ⚠ **przypisanie „Iteracja 11" jest NIEAKTUALNE: trasa weszła w bloku 3f-1, 2026-09-01**)
> i `POST /api/ai-fallback/parse` (stub, nigdy nie łączy się z OpenAI). Szczegóły:
> `docs/tickets/5-FEATURE-staging-endpointy-importu/`.
>
> **Odbudowa (3c, `6-FEATURE-silnik-tk-dopasowanie-klasyfikator`):** ciało silnika wymienione —
> port `Zc`/`Hq`/`ZT`/`Kq`/`Vq`/`Xq`/`Lq` do czytelnego TS (`rebuild/backend/src/import/silnik/`),
> wymiana ciała `tk()`, deduplikacja zapisu do stagingu (`U.addStaging`), bezpiecznik pustego
> wejścia przeniesiony z trasy do silnika. Dowód wierności: żywe `tk()` (`:47584-47851`) da się
> wyciąć z `mirror/backend/index.cjs` po kotwicach tekstowych i **uruchomić** na atrapach warstwy
> danych, więc wzorzec charakteryzacji pochodzi z wykonanego kodu produkcji, nie z lektury —
> 340 wierszy `staging_items` porównanych pole po polu z 1838 rekordów wejścia na katalogu 7405
> produktów ze zrzutu produkcji, plus 18 scenariuszy celowanych i gate treści przez HTTP.
> Do 3d zostają: efekty auto-zatwierdzania (decyzja i licznik liczone, zapis nie), pętla
> wycofań, realne `Gq()`. Szczegóły: `docs/tickets/6-FEATURE-silnik-tk-dopasowanie-klasyfikator/`.

> **Odbudowa (3f-1 i 3f-2, 2026-09-01) — BRZEG OPERACYJNY IMPORTU.** Dowiezione:
> `POST /api/dostawcy/:kod/upload` (rdzeń, multer 50 MB, pole `plik`),
> `POST /api/dostawcy/:kod/synchronizuj-teraz`, `PATCH /api/dostawcy/:id` oraz alerty pisane
> przez import. **Fallback `Wc()` NIE wchodzi** (decyzja zaklepana): gdy parser rzuci, leci
> czytelny błąd i alert zamiast cichej drugiej próby innym kodem — luka otwarta, opisana
> w roadmapie. Po drodze wyjaśniły się cztery rzeczy, których ta specyfikacja nie miała:
>
> 1. **⭐ PRODUKCJA MA DWA RÓŻNE POBIERACZE URL, nie jeden.** `downloadUrl`
>    (`mirror/backend/extensions.cjs:26-45`) chodzi na `node:http`/`node:https`, ma timeout
>    **60 s** i sam śledzi przekierowania rekurencją po `location`; obsługuje
>    `POST /api/import/from-url`. `L4()` (rdzeń, `:48038-48116`) chodzi na `fetch`
>    + `AbortController`, ma timeout **30 s** i przekierowania zostawia `fetch`; obsługuje
>    `synchronizuj-teraz` oraz scheduler. Różnica jest obserwowalna: komunikaty undici
>    („fetch failed", „This operation was aborted", „terminated") trafiają dosłownie
>    do treści alertu — tak wygląda 339 alertów „Błąd pobierania" w `db/snapshot.db`.
>    W odbudowie są to DWA osobne moduły (`src/import/pobierz.ts` i `src/import/synchronizuj.ts`)
>    i mają takie zostać — decyzja użytkownika 2026-09-01.
> 2. **⭐ SCHEDULER `D4()` (`:48118-48131`) — mechanizm, którego nie miała ani ta
>    specyfikacja, ani roadmapa.** `setInterval` per dostawca, dobór:
>    `sposobDostarczania === "url" && url && czestotliwoscMinuty && status !== "wstrzymany"`,
>    ponowne wywołanie czyści poprzednie interwały. Uruchamiany bezwarunkowo przy starcie
>    (`M4()`, `:48166`). W odbudowie wchodzi w bloku **3f-3**, za przełącznikiem
>    `IMPORT_SCHEDULER` domyślnie WYŁĄCZONYM (świadome odstępstwo — produkcja przełącznika
>    nie ma). Wyszukanie „scheduler / polling / setInterval" w tym pliku dawało wcześniej
>    zero trafień, bo mechanizm nie był nigdzie przypisany.
> 3. **Alerty PISZE import, nie widok.** `U.addAlert` (`:44954`) woła `L4()` przy błędzie HTTP
>    (`typ: "Błąd HTTP"`) i przy każdym innym wyjątku (`typ: "Błąd pobierania"` + ustawienie
>    `suppliers.status = "blad"`), oraz upload przy każdym wgraniu (`typ: "Ręczny upload"`).
>    Iteracja 6 obejmuje wyłącznie ODCZYT. **Bez dławika** — każda nieudana próba to osobny
>    wiersz; skala w produkcji: 339 „Błąd pobierania" wobec 4 „Błąd HTTP" i 2127
>    „Synchronizacja", rekord 23/dobę dla jednego dostawcy. Konsekwencje dla widoku z I6
>    zapisane w roadmapie i w backlogu #16.
> 4. **`ostatniaSync` znaczy „kiedy PRÓBOWALIŚMY", nie „kiedy się udało".** `L4()` ustawia ją
>    w OBU gałęziach błędu (`:48067`, `:48110`); nietknięty zostaje wtedy `ostatniPlik`.
>
> Do tego dwa defekty warstwy danych, oba w backlogu: **#14** (mutacje zapisują całe ciało
> żądania — wzorzec systemowy, dotyka też I4 i I12) i **#15** (`L4()` nie czyści timera
> po odrzuconym `fetch`). Szczegóły bloków: `docs/rebuild-roadmap.md` §5, blok 3f.

`04_WARSTWA_DANYCH.md` daje **50 metod `U.*` z dokładnymi wyrażeniami Drizzle** i mapą
zmangowanych zmiennych (`he`=products, `He`=staging, `Bt`=markups, `hn`=promotions,
`Yt`=overrides, `Ki`=alerts, `Wa`=history, `Ot`=suppliers, `dt`=users, `Za`=audit_log,
`gn`=spedycja, `Jt`=config) — zgodna z moją lipcową rekonstrukcją. ⚠ `Wa` to tabela SQL
**`history`**, odrębna od `historia_cen` — zweryfikowane w I5, `docs/tickets/15-FEATURE-historia-zmian/plan.md`.
`historia_cen` ma od bloku **10a** dwóch pisarzy: auto-zatwierdzanie importu (od 3d-1) i
`POST /api/analytics/bootstrap-current`, oraz pierwszego czytelnika — `GET /api/analytics/status`
zwraca z niej agregat `{hasHistory, snapshots, od, do}` (`COUNT`/`MIN`/`MAX` po `zarejestrowano_at`).
`GET /api/analytics/margins` liczy z `products.marza_pct`, nie z `historia_cen`. Szczegóły:
`docs/tickets/19-FEATURE-analityka-fundament/plan.md`.

## 6. Korekty do propagacji

Do naniesienia w pozostałych dokumentach przy okazji:
- `audit-delta.md`: **Selly JEST podpięte** (nie „niepodpięte"); **auth CZĘŚCIOWY**
  (nie „naprawione") — dopisać listę ~13 publicznych GET-ów.
- Nowa pozycja bezpieczeństwa priorytet 1: **domknąć auth na wszystkich trasach
  danych**, zwłaszcza `/api/export/shoper`, `/api/audit-log`, `/api/history`, `/api/config`.
- **Pozycja bezpieczeństwa priorytet 2 (dopisane 2026-09-01, blok 3f-2): mutacje
  zapisują CAŁE ciało żądania.** `updateSupplier`/`updateMarkup`/`updatePromotion` robią
  `.set(e)` bez listy pól, a trasy podają im `req.body` wprost (`:48230`, `:48701`, `:48724`;
  `PATCH /api/products/:id` odsiewa tylko `_reason`). Produkcja NIE jest w tym konsekwentna —
  `PUT /api/staging/:id` (`:48598`) ma jawną listę ośmiu pól. Dostawcy naprawieni w 3f-2;
  **narzuty i promocje naprawione w Iteracji 4a** (`POLA_EDYTOWALNE_NARZUTU`/
  `POLA_EDYTOWALNE_PROMOCJI`, filtr na PATCH i POST — `docs/tickets/15-FEATURE-narzuty-promocje-ceny/`),
  z jednym świadomym odstępstwem: audyt loguje SUROWE `req.body`, więc dziennik może wskazać pole,
  które faktycznie nie zostało zapisane; **produkty zostają na Iterację 12**. Pełny rozbiór:
  `rebuild-backlog.md` #14.

---

*Weryfikacja Krok 2.1 (Faza 2) — 2026-08-17. Konfrontacja tez Perplexity z naszym
kodem, nie z pamięcią. Dokumentacja Perplexity przyjęta jako kanoniczna referencja
backendu; ten plik to warstwa weryfikacji i korekt.*
