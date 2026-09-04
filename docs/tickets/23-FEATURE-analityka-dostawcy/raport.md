# 23-FEATURE-analityka-dostawcy — raport z implementacji

## Summary

Blok 10d Iteracji 10 dowieziony w całości: cztery trasy analityki dostawców w backendzie
(agregaty przepisane 1:1 z `mirror/backend/analytics_module.cjs`) i wypełniona zakładka
`dostawcy` — **domyślna zakładka widoku `/analityka`** — trzema kartami wg wzorca sekcji z 10a.
GATE zgodny z czterema fixtures i kontraktem; gałąź `hasHistory: false` trasy
`suppliers/stability`, której żadne nagranie nie pokrywa, dostała własny test jednostkowy.

## Changes

### Backend

- `rebuild/backend/src/repos/analityka.ts` — **nowa sekcja „BLOK 10d · DOSTAWCY"**: `czyJestHistoria`
  (port `hasHistory(db)`, `:58`), `stabilnoscDostawcow` (`:110-131`, dwie gałęzie SQL),
  `cyklZyciaDostawcow` (`:133-141`), `stanDostawcow` (`:143-154`), `statystykiDostawcow` (`:332`)
  plus typy wprost z fixtures. Stałe `PROG_ZMIANY_CENY`, `LIMIT_CYKLU_ZYCIA`.
- `rebuild/backend/src/routes/analytics.ts` — cztery trasy `GET` za `requireAuth`, w kolejności
  rejestracji oryginału (trzy w sekcji „supplier analysis", `dostawcy-stats` w sekcji aliasów).
- **Nowy:** `rebuild/backend/test/analityka.dostawcy.gate.test.ts` — GATE bloku (9 przypadków).
- **Nowy:** `rebuild/backend/test/analityka.dostawcy.agregaty.test.ts` — semantyka agregatów
  (10 przypadków), w tym gałąź `hasHistory: false`.

### Frontend

- `rebuild/frontend/src/pages/analityka/api.ts` — typy `WierszStabilnosci` (unia dwóch gałęzi
  wyrażona polami opcjonalnymi), `WierszCykluZycia`, `WierszStanuDostawcy` + trzy hooki.
  `dostawcy-stats` świadomie **bez hooka**.
- `rebuild/frontend/src/pages/analityka/filtrowanie.ts` — `WYMIARY_DOSTAWCOW`
  i generyczne `zastosujFiltryDostawcow`.
- **Nowy:** `rebuild/frontend/src/pages/analityka/PasekDostepnosci.tsx` — port `O(e)`
  (`fe.js:27919-27936`), wspólny komponent dla 10d i 10e.
- **Nowy:** `SekcjaStabilnoscDostawcow.tsx` — karta „1.1", 7 kolumn 1:1.
- **Nowy:** `SekcjaCyklZyciaDostawcow.tsx` — karta „1.2", 6 kolumn 1:1.
- **Nowy:** `SekcjaStanDostawcow.tsx` — karta „1.4 / 1.5", 5 kolumn + wykres dostępności.
- `rebuild/frontend/src/pages/Analityka.tsx` — `ZakladkaWPrzygotowaniu blok="10d"` zastąpione
  trzema sekcjami; rejestr odstępstw w nagłówku pliku uzupełniony o O-10d-1.
- `rebuild/frontend/src/pages/analityka/README.md` — `PasekDostepnosci` w inwentarzu wzorca,
  nota, że 10d jest drugim przykładem sekcji (w tym sekcją bez wykresu).
- **Nowy:** `rebuild/frontend/test/analityka.dostawcy.test.tsx` — 12 przypadków widoku.
- `rebuild/frontend/test/msw/kontrakt.ts` — trzy loadery fixtures 10d (zdejmują klucze na `_`).
- `rebuild/frontend/test/analityka.filtrowanie.test.ts` — 5 przypadków `zastosujFiltryDostawcow`.
- `rebuild/frontend/test/analityka.test.tsx` — mocki trzech tras dostawców (zakładka `dostawcy`
  jest domyślna, więc mountuje się w każdym teście tego pliku) + podniesiony limit czekania
  na leniwy chunk.

## Deviations from plan

Trzy, wszystkie drobne i wewnątrz zatwierdzonych decyzji:

1. **Test progu zmiany ceny opisuje zachowanie, a nie życzenie.** Plan zakładał asercję
   „różnica równa groszowi nie liczy się jako zmiana". Uruchomienie pokazało, że liczy się:
   `100.01 - 100` w podwójnej precyzji to 0.010000000000005…, czyli więcej niż próg `0.01`.
   To zachowanie oryginału (ten sam SQL, ta sama arytmetyka), więc test je **charakteryzuje**
   zamiast wymuszać — z komentarzem wyjaśniającym, skąd bierze się ta niespodzianka.
2. **Podniesiony limit czekania na leniwy chunk `/analityka`** w obu plikach testów widoku.
   Zakładka `dostawcy` jest domyślna, więc każde wejście na widok pobiera teraz o trzy
   zapytania więcej, a pierwszy import chunku z Recharts w jsdomie bywa wolniejszy niż
   domyślna sekunda. To koszt narzędzi, nie zachowanie aplikacji — bez tego testy migotały.
   Limity są DWA i oba trzeba było ruszyć: `findByTestId(..., { timeout })` czeka najwyżej
   tyle, ile pozwala `testTimeout` vitest (domyślnie 5 s) — patrz „Review fixes applied".
3. **Trasy dostawców dołożone do mocków `analityka.test.tsx` (blok 10a).** Nie było tego
   w planie, ale jest konieczne: `onUnhandledRequest: "error"` wywaliłby każdy test w tamtym
   pliku, odkąd domyślna zakładka wypuszcza własne zapytania.

## Test results

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Sprawdzone cztery operacje i cztery nagrania:
  - `GET /api/analytics/suppliers/stability` ↔ `GET_analytics_suppliers_stability.json`
  - `GET /api/analytics/suppliers/lifecycle` ↔ `GET_analytics_suppliers_lifecycle.json`
  - `GET /api/analytics/suppliers/stock` ↔ `GET_analytics_suppliers_stock.json`
  - `GET /api/analytics/dostawcy-stats` ↔ `GET_analytics_dostawcy-stats.json` (goła tablica)

  Każda: kształt 1:1 (`sprawdzZgodnoscZFixture`), zgodność ze ścieżką i statusem w
  `contract/openapi.yaml` (`sprawdzZgodnoscZKontraktem`), 401 bez tokenu, brak klucza
  `_przyciete` w odpowiedzi. **Zero zadeklarowanych wyjątków GATE** — nie było czego obchodzić.
- **Unit (backend): ✓ 703 testy w 45 plikach** (`npm test` w `rebuild/backend/`), w tym 19 nowych
  z tego bloku.
- **Unit + widok (frontend): ✓ 408 testów w 27 plikach** (`npm test` w `rebuild/frontend/`),
  w tym 17 nowych z tego bloku.
- **Integration/E2E:** pominięte świadomie — zakładka jest odczytem bez mutacji, a ścieżkę
  dane → HTTP → render pokrywają GATE (backend na realnej bazie SQLite) i testy widoku
  na nagraniach produkcji przez MSW.
- **Bramki:** `lint`, `typecheck`, `build` czyste po obu stronach. Chunk `Analityka` 390,64 kB
  (przed blokiem 385 kB) — trzy sekcje dołożyły ~5 kB, wspólny bundle bez zmian (484 kB).

## Breaking changes

Brak. Cztery nowe trasy `GET`; żadna istniejąca odpowiedź nie zmieniła kształtu.

## Follow-up

- **Przyciski „CSV" w trzech kartach zakładki (blok 10f).** Oryginał ma je we wszystkich trzech
  (`M("suppliers-stability")`, `M("suppliers-lifecycle")`, `M("suppliers-stock")`,
  `fe.js:28063`, `:28106`, `:28144`). Pominięte świadomie, bo trasa `GET /api/analytics/export/{view}`
  jeszcze nie istnieje — dokładnie tak samo postąpiło 10a w sekcji marż.
  ⚠ Eksport ma **własny SQL**, inny niż trasa dashboardu o tej samej nazwie: `export/suppliers-stability`
  liczy ZAWSZE z `historia_cen` i oddaje kolumny `produkty, punkty, sredniaCena, sredniStan`
  (`docs/analityka-bloki-10b-10f.md` §8.1). Nie da się go zbudować z danych, które sekcja ma
  już w pamięci.
- **`GET /api/analytics/dostawcy-stats` bez UI.** Trasa działa i jest pod GATE, ale nie ma
  konsumenta — tak jak w oryginale. Jeśli kiedyś ma dostać ekran, to nowa funkcja i osobna
  decyzja, nie odbudowa. Merytorycznie nakłada się na `suppliers/stock`.
- **Kafle KPI oryginału.** 10a wzięło `/api/analytics/kpi` zamiast oryginalnych czterech kafli
  (odstępstwo O-10a-1), bo dwa z nich wymagają tras bloku 10c. To wciąż otwarte — decyzja
  należy do sesji 10c lub 10f.

## Review fixes applied

Review: **0 BLOCKER · 1 SHOULD-FIX · 1 NICE-TO-HAVE**
(`docs/tickets/23-FEATURE-analityka-dostawcy/review.md`). Oba ustalenia naprawione.

- **SHOULD-FIX — ochrona przed migotaniem testów widoku była POZORNA.** Podniesienie
  `findByTestId(..., { timeout: 15_000 })` nie działa samo z siebie: zapytanie czeka najwyżej
  tyle, ile pozwala `testTimeout` vitest, a ten stał na domyślnych 5 s. Pod obciążeniem
  (scenariusz, który ten projekt wprost zakłada — kilku agentów na jednej maszynie) test padłby
  na „Test timed out in 5000ms", zanim limit zapytania miałby szansę zadziałać.
  Naprawione `vi.setConfig({ testTimeout: 20_000 })` w obu plikach testów widoku — **plikowo,
  nie globalnie**, bo dotyczy to wyłącznie widoków ładowanych leniwie; reszta zestawu zachowuje
  ostry pięciosekundowy limit. Nota przy wywołaniu wyjaśnia mechanikę dwóch limitów.
- **NICE-TO-HAVE** — rozdzielony akapit w `pages/analityka/README.md`, w którym zdanie o bloku
  10d skleiło się ze zdaniem o blokach 10b–10e.

Zweryfikowane po naprawie: `lint`, `typecheck` czyste, oba pliki testów widoku zielone (31/31).

### Pre-existing issues (spoza tego ticketa)

- `rebuild/backend/test/scheduler.test.ts` potrafi paść pod pełnym `npm test` backendu
  (u recenzenta 702/703), a w izolacji przechodzi 24/24. Plik nie występuje w diffie tego
  brancha — to wcześniejsza niestabilność timingowa pod obciążeniem, nie regresja bloku 10d.
  U mnie pełny zestaw przeszedł 703/703, więc objaw jest przerywany.

## Docs updates

Cztery doc-checkery, równolegle. Zakres wyznaczony przez obowiązek z `CLAUDE.md`: roadmapa
i backlog są przy zamknięciu bloku iteracji **zawsze** w zakresie, a ustalenia dotyczące
przyszłych bloków muszą trafić **do tych bloków**, nie do właśnie zamkniętego.

### `docs/rebuild-roadmap.md` — 6 edycji

- §4, wiersz Iteracji 10 — dołożone `10d: 23-FEATURE-analityka-dostawcy · 2026-09-03`
  (status całej iteracji zostaje 🔨, bo 10b/10c/10e są otwarte).
- Nagłówek Iteracji 10 i sekcja „⭐ Kolejność" — lista bloków niezależnych skurczona
  do 10b/10c/10e; 10a i 10d opisane jako zrobione.
- **Blok 10d** — opis zamiaru zastąpiony opisem STANU: ✅, data, ID ticketa, cztery trasy,
  trzy karty (tytuły + liczba kolumn), wynik GATE (4/4 fixtures, zero wyjątków, 703/408 testów)
  i rejestr O-10d-1, O-10d-2, D1, D3, D4, D5 w stylu bloku 10a.
- **Blok 10e — „WEJŚCIE Z BLOKU 10d"**: `PasekDostepnosci.tsx` jest gotowy, karta „4.1" ma go
  zaimportować, nie pisać drugi raz.
- **Blok 10f — „WEJŚCIE Z BLOKU 10d"**: przyciski „CSV" trzeba dołożyć także do trzech kart
  zakładki `dostawcy`, z ostrzeżeniem, że trasa eksportu ma własny SQL, inny niż dashboard.

Nietknięte: „Wzorzec i pułapki dla 10b–10e" (nadal aktualny) i wiersz „Ścieżki (GATE)"
(już poprawnie liczył 10d jako 4 fixtures).

### `docs/analityka-bloki-10b-10f.md` — 6 edycji (364 → 404 linie)

- Nagłówek — „10a zamknął pięć… pozostałe 22" → „zamknięte dziewięć (10a: 5, 10d: 4)… pozostałe 18".
- **§2** — dopisany DRUGI rodzaj luki w siatce, który wyszedł w tym bloku: fixture może być
  niepusty, a i tak nie dowodzić kształtu, bo nagrano tylko jedną z dwóch gałęzi handlera.
  Sformułowane jako reguła dla kolejnych bloków (dotyczy czterech tras 10e z `hasHistory`).
- **§6** — blok oznaczony ✅ ZAMKNIĘTY, lista powstałych plików, „decyzja użytkownika" przy
  `dostawcy-stats` zastąpiona rozstrzygnięciem D3, dopisane dwa quirki (7 kolumn vs gałęzie SQL;
  próg zmiany ceny jako porównanie float).
- **§7 (blok 10e)** — „jeśli 10d wszedł wcześniej… jeśli nie, wydziel go" zastąpione faktem
  wraz z sygnaturą `<PasekDostepnosci wartosc={w.dostepnoscPct} />`.
- **§8.1 (blok 10f)** — odnotowane trzy przyciski CSV czekające na ten blok.
- **§9** — inwentarz „czego nie musisz budować" powiększony o `PasekDostepnosci`,
  `zastosujFiltryDostawcow`/`WYMIARY_DOSTAWCOW` i trzy sekcje 10d jako drugi przykład wzorca
  (w tym pierwszy przykład sekcji BEZ wykresu).

### `docs/rebuild-backlog.md` — bez zmian (wynik prawidłowy)

Przeszukane pod kątem: `analytics`/`analityk`, czterech ścieżek tras, `historia_cen`,
`staging_items` (`typ_zmiany`/`powod`/`utworzono`) oraz `marza_pct`/`cena_zakupu`/`stan`
w kontekście agregatów. Żaden wpis nie dotyczy tego ticketa. Jedyny wpis dotykający
`historia_cen` to **#31** (nieidempotentny `POST bootstrap-current` z 10a) — ten ticket go nie
woła i nie rozstrzyga otwartej decyzji, więc status `⬜ do decyzji Ani` zostaje bez zmian.
Nowego wpisu **nie zakładano**: backlog rejestruje świadome zmiany wobec produkcji, a ten
ticket odtwarza zachowanie 1:1.

### `docs/spec-backend.md` + `docs/spec-frontend.md` — 3 edycje

- `spec-backend.md` §2 — akapit „Potwierdzone w 10d" z czterema trasami, dwiema gałęziami
  `suppliers/stability` i gołą tablicą `dostawcy-stats` bez konsumenta.
- `spec-backend.md` §5 — sprostowane: `historia_cen` ma od 10d **dwóch** czytelników, nie
  jednego (drugim jest `suppliers/stability` z oknem `LAG()`).
- `spec-frontend.md` §5 — akapit „Odbudowa (10d)": trzy karty 1:1, quirk „—" (D1), wspólny
  `PasekDostepnosci`, wykres (O-10d-1), filtrowanie klienckie, brak CSV (10f),
  `dostawcy-stats` bez UI (D3).

### Pre-existing issues zgłoszone przez doc-checkery

- `docs/plan.md:137` — „ekran analityki (31 gotowych endpointów bez UI)" jest nieaktualne
  **od bloku 10a**, nie od tego ticketa. Dokument jest jawnie oznaczony jako historyczny i ma
  banner kierujący do `docs/rebuild-roadmap.md` jako źródła prawdy, więc nie był przepisywany —
  decyzja, czy w ogóle aktualizować dokumenty historyczne, należy do właściciela repo.
