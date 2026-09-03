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
2. **Podniesiony limit czekania na leniwy chunk `/analityka`** w obu plikach testów widoku
   (domyślna sekunda → 15 s). Zakładka `dostawcy` jest domyślna, więc każde wejście na widok
   pobiera teraz o trzy zapytania więcej i pierwszy import chunku z Recharts bywa wolniejszy
   niż sekunda. To koszt narzędzi, nie zachowanie aplikacji — bez tego testy migotały.
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
