# 5-FEATURE-staging-endpointy-importu — raport z implementacji

## Podsumowanie

Wyjście parserów z 3a trafia teraz do `staging_items` przez Drizzle, a trzy endpointy
odczytu i trzy endpointy importu odtwarzają zachowanie produkcji. Silnik dopasowania `tk()`
został wydzielony jako jawny szew z implementacją oznaczoną jako świadomie niewierna —
3c wymieni jej ciało bez ruszania niczego poza jednym plikiem. GATE wobec `GET_staging.json`
i `GET_staging_paged.json` przeszedł za pierwszym podejściem; charakteryzacja parserów z 3a
(1838 rekordów) pozostała zielona.

## Zmiany

### Nowe
- `rebuild/schema/002_import.sql` — `suppliers.import_wylaczony`, `products.uwaga_cena`, wyłączenie MO6
- `rebuild/backend/src/repos/kolumny.ts` — jawna projekcja kontraktowa (D6)
- `rebuild/backend/src/repos/staging.ts` — trzy projekcje odczytu + zapis wsadowy w transakcji
- `rebuild/backend/src/repos/audit.ts` — odpowiednik `be()`/`U.addAudit`
- `rebuild/backend/src/repos/config.ts` — odczyt pojedynczego klucza konfiguracji
- `rebuild/backend/src/routes/staging.ts` — `GET /api/staging`, `/paged`, `/{id}`
- `rebuild/backend/src/routes/import.ts` — `parse-file`, `from-url`, `ai-fallback/parse`
- `rebuild/backend/src/import/tk.ts` — szew `SilnikStagingu` + implementacja 3b
- `rebuild/backend/src/import/archiwum.ts` — port `archive_module.cjs`
- `rebuild/backend/src/import/pobierz.ts` — port `downloadUrl`
- `rebuild/backend/test/staging.gate.test.ts` — GATE odbudowy (8 testów)
- `rebuild/backend/test/staging.odczyt.test.ts` — reguły odczytu (22 testy)
- `rebuild/backend/test/import.test.ts` — import end-to-end (28 testów)
- `rebuild/backend/test/import.pobierz.test.ts` — transport HTTP (7 testów)
- `rebuild/backend/test/projekcja.test.ts` — strażnik D6 (5 testów)

### Zmienione
- `rebuild/backend/src/db/schema.ts` — dwie kolumny z migracji 002
- `rebuild/backend/src/repos/products.ts`, `repos/suppliers.ts` — projekcja zamiast `select()`/spreadu; `dostawcaPoKodzie`, `zapiszWynikImportu`
- `rebuild/backend/src/config/env.ts` — `IMPORT_ARCHIVE_DIR`
- `rebuild/backend/src/app.ts` — wpięcie tras stagingu i importu
- `rebuild/backend/src/import/parsuj.ts` — `urlDostawcy()` z mapy `URLS` dispatchera
- `rebuild/backend/test/gate/dane.ts` — `zasiejStagingZFixtures`
- `rebuild/backend/test/gate/aplikacja.ts` — archiwum w katalogu tymczasowym testu
- `rebuild/backend/test/db.migracje.test.ts` — lista migracji zamiast pojedynczego pliku

### Usunięte
Brak.

## Odstępstwa od planu

Plan zrealizowany 1:1 co do decyzji D1–D11. Trzy rzeczy doprecyzowane w trakcie:

1. **`IMPORT_ARCHIVE_DIR` przeszło przez `Env` i `stworzApp`,** a nie przez `process.env`
   czytane bezpośrednio w module. Plan mówił „katalog z env" bez wskazania drogi; przewleczenie
   przez konfigurację jest zgodne z tym, jak backend traktuje resztę ustawień, i pozwala testom
   izolować archiwum bez majstrowania przy `process.env`.
2. **Test `db.migracje.test.ts` wymagał aktualizacji** — asercje wymieniały `001_schema.sql`
   jako jedyną migrację. Zamiast dopisać drugi literał, wprowadzona została jawna stała
   `MIGRACJE`, żeby dołożenie kolejnego pliku było świadomą zmianą testu.
3. **`pobierzZUrl` dostało limit przekierowań** (`MAX_PRZEKIEROWAN = 10`) — patrz odstępstwo D12
   niżej. Plan tego nie przewidywał, bo błąd wyszedł dopiero przy pisaniu testu pętli.

## Świadome odstępstwa od oryginału

| # | Odstępstwo | Uzasadnienie | Gdzie utrwalone testem |
|---|---|---|---|
| D1 | `requireAuth` na `GET /api/staging`, choć kontrakt ma `security: []` | stała decyzja I1, precedens I2 dla `/api/products` | `staging.gate.test.ts` — test wprost sprawdza, że kontrakt mówi „publiczne", a my zwracamy 401 |
| D2 | `tk()` jako szew z implementacją niewierną | podział sesji; pusty katalog nie eliminuje `Zc`/`Hq`/`Gq`/`Lq`/`Kq` | `src/import/tk.ts` — lista braków w komentarzu modułu |
| D4 | bezpiecznik: 0 rekordów z parsera → 400, bez zapisu | backlog #8; trzy ciche przebiegi wycofują katalog dostawcy | `import.test.ts` — trzy testy, w tym realny scenariusz MO8+CSV |
| D5 | nowa kolumna `suppliers.import_wylaczony` + strażnik | backlog #7; `suppliers.status` jest nadpisywany na `aktywny` po każdym imporcie | `import.test.ts` — trzy testy strażnika |
| D6 | jawna projekcja kolumn w repozytoriach I2 | bez niej D5 i D9 łamią zielony GATE Iteracji 2 | `projekcja.test.ts` + niezmieniony `katalog.gate.test.ts` |
| D8 | naprawa `ReferenceError` w `catch` w `from-url` | oryginał deklaruje `archOk` w `try`, używa w `catch` → żądanie wisi bez odpowiedzi | `import.test.ts` — „błąd pobierania kończy się odpowiedzią 500" |
| D9 | nowa kolumna `products.uwaga_cena` (bez pisarza) | backlog #4; pisarz i endpoint w 3d | `projekcja.test.ts` — kolumna jest w tabeli, nie ma jej w API |
| D11 | konfigurowalny katalog archiwum | po `npm run build` `__dirname` wskazuje `dist/` | `test/gate/aplikacja.ts` |
| **D12** | **limit 10 przekierowań w `pobierzZUrl`** | **nowe** — oryginał rekursywnie podąża za `Location` bez licznika (`extensions.cjs:30-33`), więc pętla A→A daje przepełnienie stosu albo wiszące żądanie | `import.pobierz.test.ts` — „pętla przekierowań kończy się błędem" |
| **D13** | **limit 25 MB egzekwowany w trakcie strumieniowania** | **nowe (po recenzji)** — oryginał buforuje CAŁE ciało, a rozmiar sprawdza dopiero po `Buffer.concat` (`extensions.cjs:224-230`); zalogowany użytkownik mógł tym wyczerpać pamięć procesu. Odpowiedź jest IDENTYCZNA (ten sam 400, ten sam komunikat) — zmienia się wyłącznie zużycie pamięci, więc kontrakt zostaje nietknięty | `import.test.ts` — „odrzuca plik większy niż 25 MB" |

## Znaleziska w oryginale (odtworzone wiernie, nie naprawione)

1. **Stempel czasu w nazwie pliku archiwum jest ucięty.** `archive_module.cjs:57` zapowiada
   w komentarzu `RRRRMMDD__GGMMSS`, ale `slice(0, 15)` obcina ostatnią cyfrę sekund — wychodzi
   `RRRRMMDD__GGMMS`. Skutek: dwa pliki tego samego dostawcy o tej samej nazwie, wgrane
   w jednym dziesięciosekundowym oknie, nadpisują się. Odtworzone wiernie, bo nazwa pliku
   jest identyfikatorem (`meta.id`), po którym `aktualizujMeta` odnajduje wpis.
2. **`search` w `/api/staging/paged` nie escape'uje wieloznaczników LIKE.** Znaki `%` i `_`
   z zapytania użytkownika działają jak wzorce (`pagination_module.cjs:40`). Odtworzone,
   z testem utrwalającym, że to świadome.
3. **`zatwierdzilUzytkownikId` i `zatwierdzonoData` są martwe** w całym kodzie produkcji —
   nic ich nigdy nie ustawia. Zostają jako NULL; kuszące „naprawienie" złamałoby fixture.
4. **Nieparsowalne `page`/`pageSize` w `/paged` dają `NaN`, a nie wartość domyślną.**
   `Math.max(1, parseInt("abc", 10))` to `NaN`, SQLite traktuje związany `NaN` jak `NULL`,
   a `LIMIT NULL` znaczy „bez limitu" — więc `?pageSize=abc` zwraca WSZYSTKIE wiersze,
   z `pageSize` i `pages` jako `null` w JSON-ie. Sprawdzone empirycznie na naszym stosie
   (ten sam sterownik co produkcja). Odtworzone wiernie i utrwalone dwoma testami.
5. **`parse-file` i `from-url` mają różne wejścia i różne komunikaty błędów** dla tego samego
   warunku: `parse-file` czyta `query.dostawcaKod || body.dostawcaKod` i mówi
   „Nieznany dostawca: X", a `from-url` czyta `body.dostawcaKod || body.dostawca` i mówi
   „Brak URL dla dostawcy X". Powstały w różnym czasie; różnica jest zastana i zachowana.

## Sprostowania do opisu ticketa

Trzy założenia z opisu zadania okazały się nieprawdziwe — sprawdzone w oryginale, opisane
szerzej w `plan.md`:

1. **`/api/import/ai-fallback/parse` nie istnieje** — realna ścieżka to `POST /api/ai-fallback/parse`
   (`contract/openapi.yaml:51`). Zaimplementowana pod właściwą ścieżką.
2. **AI fallback nie jest fallbackiem z bloku `catch`** i nigdy nie łączy się z OpenAI.
   To osobny, ręcznie wołany endpoint bramkowany kluczem `ai_fallback.klucz_api`; bez klucza
   zwraca pięć zmyślonych pozycji („symulacja"), z kluczem — pustą listę. Mechanizmem z `catch`
   jest `Wc()` (`backend-index.cjs:46910`), zestaw starych parserów per-dostawca używany przez
   rdzeniowy `POST /api/dostawcy/:kod/upload` (Iteracja 11) — inny endpoint, inna rzecz.
3. **Rekomendacja „3b dowozi wierną ścieżkę dla pustego katalogu" była niewykonalna
   w założonym zakresie.** Przejście gałęzi `nowa` w `tk()` (`:47600-47737`) pokazało, że pusty
   katalog zeruje tylko mapy dopasowania, diff `Vq`/`Xq`, auto-zatwierdzanie i wycofania —
   a `Zc()`, `Hq()`, `Gq()`, `Lq()` i `Kq()` wykonują się na KAŻDYM rekordzie. Roadmap
   przypisuje `Zc`/`Lq` do 3c, a `Gq` do 3d. Użytkownik wybrał wariant „brzegi + szew".

## Podział 3b/3c — co dokładnie zostało po której stronie

**W 3b (dowiezione):** repozytorium stagingu z trzema projekcjami, zapis wsadowy w transakcji,
`GET /api/staging` (oba kształty), `/paged` (pełne filtry, tokenizacja, sortowanie), `/{id}`;
`POST /api/import/parse-file` (surowy strumień, 25 MB), `POST /api/import/from-url`
(http/https, 60 s, przekierowania), `POST /api/ai-fallback/parse`; archiwizacja przed
parsowaniem z retencją; aktualizacja `suppliers`; dziennik audytu; strażnik wyłączonego
dostawcy; bezpiecznik pustego wyniku.

**Odtworzone w silniku 3b:** filtr śmieci MO2 (port 1:1 z `:47619-47634`), użycie EAN-u jako
identyfikatora przy braku kodu wraz z ostrzeżeniem, odrzucenie rekordu bez kodu i bez EAN-u
jako `odrzuconeBrakDanych`, jeden znacznik `utworzono` na przebieg, zapis w jednej transakcji.

**Zostaje dla 3c:** `Zc()` (klasyfikator „czy opona" — dziś `odrzuconeNieOpony` zawsze 0,
a nie-opony przechodzą do stagingu), `Hq()` (normalizacja EAN — dziś `eanRaw`/`eanIsValid`/
`eanSourceStatus`/`eanCandidates` są NULL-em, a `snapshotJson` serializuje rekord PRZED
normalizacją), `Lq()` (identyfikator techniczny), `Kq()` (błędny zapis nazwy), dopasowanie
kod→EAN, klasyfikacja `zmiana_kluczowa`/`blad`, `Vq`/`Xq`. **Dla 3d:** `Gq()` (overrides),
wycofania po trzech nieobecnościach, auto-zatwierdzanie i `historia_cen`.

Dlatego w 3b każda przyjęta pozycja ma `typZmiany: "nowa"`, a liczniki `odrzuconeNieOpony`,
`zmienione`, `wycofane`, `bezZmian` i `autoZatwierdzone` zostają zerami.

## Poprawki po recenzji

Recenzja zgłosiła 1 BLOCKER, 4 SHOULD-FIX i 3 NICE-TO-HAVE. Wszystkie zasadne zarzuty
zweryfikowane w oryginale przed poprawką i naniesione.

- **BLOCKER — `pageSize`/`page` liczone innym wzorcem niż w oryginale.** Miałem
  `parseInt(...) || domyślna`, a oryginał ma `string || string || '50'` PRZED `parseInt`
  (`pagination_module.cjs:19`). Różnica jest realna: `?pageSize=0` dawało u mnie `50`,
  a w produkcji daje `1` — czyli inną stronę wyników. Odtworzony dokładny wzorzec.
  Mój wcześniejszy test utrwalał błędne zachowanie z błędnym uzasadnieniem („zero jest falsy") —
  usunięty i zastąpiony czterema testami, które pilnują pułapki kolejności operacji oraz
  zachowania przy `NaN` (znalezisko 4 wyżej).
- **SHOULD-FIX — scalona bramka walidacyjna.** `odrzucNiedozwolonegoDostawce`/`kodZZadania`
  łączyły dwa handlery, które w oryginale są osobne: `from-url` zwracał przez to zły komunikat,
  a `parse-file` zaczął przyjmować alias `dostawca`, którego produkcja tam nie akceptuje.
  Rozdzielone; wspólny został wyłącznie strażnik wyłączonego dostawcy, bo to NASZ dodatek (D5),
  nie port. Poprawiony też komunikat `parse-file` na „Brak dostawcaKod (query lub body)".
  Dodane cztery testy na te różnice.
- **SHOULD-FIX — buforowanie całego ciała przed sprawdzeniem limitu 25 MB.** Zamiast tylko
  odnotować, utwardzone — patrz D13. Odpowiedź bez zmian, znika ryzyko wyczerpania pamięci.
- **SHOULD-FIX — brak testu na nieparsowalny `page`.** Dodany, razem z testami z BLOCKER-a.
- **NICE-TO-HAVE** — `resume()` w `pobierzZUrl` opisane jako świadomy dodatek; walidacja listy
  wykluczeń w `projekcjaKontraktowa` przeniesiona przed budowę projekcji. Trzecie (ponowny
  `existsSync` w `wymusRetencje`) świadomie pominięte: oryginał ma tę samą strukturę,
  a katalog tworzy `archiwizujBufor` przed każdym wywołaniem.

Jeden test świadomie USUNIĘTY: sprawdzał granicę dokładnie 25 MB i kosztował 14 sekund,
bo przepuszczał pełne 25 MB przez archiwum i parser. Ostre `>` jest widoczne w kodzie
i opatrzone komentarzem; tak wolny test i tak zostałby prędzej czy później wyłączony.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.**
  - `contract/fixtures/GET_staging.json` ↔ `GET /api/staging?limit=5` — kształt 1:1, komplet 24 kluczy
  - `contract/fixtures/GET_staging_paged.json` ↔ `GET /api/staging/paged` — kształt 1:1, komplet 20 kluczy
  - `GET /api/staging/{id}` — brak fixtura; kształt (21 kluczy) wyprowadzony z `pagination_module.cjs:105-124` i utrwalony testem
  - Walidacja wobec `contract/openapi.yaml` dla wszystkich trzech ścieżek odczytu
  - **Fixtures nie były modyfikowane.**
- **GATE Iteracji 2 nadal zielony** — `katalog.gate.test.ts` przeszedł **bez żadnej zmiany w samym teście**, co jest dowodem, że projekcja z D6 działa.
- **Charakteryzacja 3a nadal zielona** — 61 testów, 1838 rekordów wzorca, sha256 portu wobec `mirror/backend`.
- **Unit/integracyjne: ✓ 241 testów w 18 plikach**, w tym 78 nowych w tej sesji.
- `lint` ✓ · `typecheck` ✓ · `build` ✓ (kopiuje obie migracje do `dist/schema/`) · `test` ✓

**Bez mocków warstwy danych.** Import testowany na prawdziwych cennikach z próbek 3a
(MO1 199 rekordów, MO2 200, MO8 626) przeciw prawdziwemu SQLite; transport HTTP na prawdziwym
serwerze na porcie efemerycznym. Podstawiane jest wyłącznie pobranie pliku w `from-url`.

**Czego GATE 3b świadomie nie sprawdza:** treści pozycji wyprodukowanych przez realny import
(`typZmiany`, `powod`, pola EAN, zawartość `snapshotJson`). To wymaga `tk()` i jest gate'em 3c.
Warstwa odczytu jest testowana przeciw fixtures przez zasianie tabeli nagranymi danymi.

## Breaking changes

Brak dla istniejących endpointów — `GET /api/products`, `/api/suppliers` i `/api/dostawcy`
zwracają dokładnie to co przed zmianą (pilnuje tego niezmieniony gate I2).

Dla wdrożenia: **migracja `002_import.sql` musi zostać zastosowana** (`npm run migrate`).
Dokłada dwie kolumny i ustawia `import_wylaczony = 1` dla MO6.

## Follow-up

1. **`UPDATE ... WHERE kod = 'MO6'` działa tylko, gdy wiersz MO6 istnieje w `suppliers`.**
   W produkcyjnej bazie istnieje, więc migracja zadziała. W świeżej bazie z samego kanonu
   tabela `suppliers` jest pusta i flaga nie ma czego ustawić — wtedy `dostawcaPoKodzie`
   zwraca `undefined`, a strażnik przepuszcza MO6 (adres z mapy `URLS` dispatchera wystarcza
   do przejścia bramki „znany dostawca"). Domknięcie należy do I11 (konfiguracja dostawców)
   albo do seeda produkcyjnego.
2. **`GET /api/products/uwagi-cena` i propagacja `uwagaCena` w `acceptStaging`** — backlog #4,
   przypisane do 3d (D9). Kolumna czeka gotowa.
3. **`products.szerokosc` REAL→TEXT** — backlog #3, odłożone (D10). Wymaga poprawki Ani
   w `parseWidthFallbackMm()` i przenagrania `GET_products.json` w I12.
4. **Endpointy `/api/import-archive*`** (lista, statystyki, pobranie pliku) — poza roadmapą 3b.
   Warstwa zapisu i rotacji jest gotowa, brakuje trzech tras odczytu.
5. **Scheduler auto-pull** (`runAutoPull`, codziennie 06:00, `extensions.cjs`) — poza zakresem 3b.
6. **`POST /api/dostawcy/:kod/upload`** (rdzeń, multer, fallback `Wc()`) — Iteracja 11.
7. **`MO10` przy śmieciowej treści też zwraca zero rekordów i zero błędów** — tak samo jak MO8
   z backlogu #8. Bezpiecznik D4 to pokrywa, ale sam parser MO10 mógłby zgłaszać błąd;
   to poprawka po stronie Ani (przyjdzie portem, backlog #6).
