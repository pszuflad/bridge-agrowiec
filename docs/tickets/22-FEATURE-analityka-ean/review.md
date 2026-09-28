# 22-FEATURE-analityka-ean — Code review

> Reviewed: 2026-09-03
> Branch: `feature/22-analityka-ean`
> Diff: 15 plików, 3 commity (vs `origin/develop`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/test/analityka.ean.test.tsx`, `rebuild/frontend/test/analityka.test.tsx` — testy widoku okazały się niedeterministyczne przy uruchomieniu **całego** frontendowego `vitest run` naraz.
  - Reason: uruchomienie pełnego zestawu (`npm test` w `rebuild/frontend/`) dwukrotnie dało różne wyniki: raz `2 failed | 406 passed` (obie porażki to `findByTestId("text-page-title")`/tytuł strony, które nie zdążyły się pojawić w domyślnym oknie `waitFor`), raz `408 passed`. Uruchomienie samych trzech plików analityki zawsze przechodzi. To wygląda na czułość na obciążenie CPU przy równoległym uruchamianiu wielu ciężkich testów renderujących całą `<App/>` (blok 10c dokłada kolejne takie testy) — nie na błąd logiki, ale przy modelu pracy „kilka okien naraz” realnie grozi fałszywym czerwonym CI/lokalnym uruchomieniem.
  - Suggestion: rozważyć podniesienie timeoutu `findBy*`/`waitFor` w testach renderujących całą `App` albo ograniczenie równoległości plików testowych (`poolOptions`) w `vitest.config.ts`, żeby test nie zależał od tego, ile innych ciężkich testów akurat działa obok.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/Analityka.tsx:78-80` — `ladowanie={eanWczytywany}` bierze `isPending` wyłącznie z `usePorownanieEan()`, a tekst „Wczytywanie…”/„Brak danych” w `SekcjaEan` jest wspólny dla wszystkich czterech tabel (porównanie, unikalne, pokrycie, ranking). Przy realnie różnych czasach odpowiedzi czterech zapytań jedna tabela może już mieć dane, gdy inna wciąż pokazuje pustkę bez napisu „Wczytywanie…” (bo jej własny `isPending` nie jest sprawdzany). W praktyce cztery zapytania lecą równolegle i różnica czasowa jest znikoma, więc to kosmetyka, nie błąd.
- [ ] `rebuild/frontend/src/pages/analityka/SekcjaEan.tsx:174-181` — `udzialWspolnych.procent` liczy zaokrąglenie ręcznie (`Math.round(x * 10000) / 100`) zamiast przez wspólny pomocnik zaokrąglania; jednorazowe użycie, więc nie szkodzi, ale warto pamiętać przy kolejnych blokach (10d/10e), żeby nie namnożyć wariantów tej samej operacji.

## Plan compliance

### Done ✓
- Backend: sześć tras EAN (`porownanieEan`, `szczegolyEan`, `unikalneEan`, `pokrycieEan`, `rankingDostawcowEan`, `porownanieEanLegacy`) w `repos/analityka.ts` — SQL, WHERE, LIMIT-y i kolejność kluczy odpowiedzi 1:1 z `mirror/backend/analytics_module.cjs:188-235,335-338`, zweryfikowane linia po linii i dodatkowo liczbowo na kopii `db/snapshot.db` (patrz niżej).
- `minDiffPct`: falsy-test (`!minDiff`) i `(spreadPct ?? 0)` odtworzone dosłownie, w tym gałąź „NaN → 0” dla wartości nieliczbowej/tablicy z powtórzonego parametru.
- `porownanieEanLegacy` to realnie osobna trasa: inny WHERE (bez `cena_zakupu > 0`), inny LIMIT (200 vs 1000), inne kolumny, goła tablica zamiast koperty `{rows}` — potwierdzone testem `porownanieEan(db).rows === []` vs `porownanieEanLegacy(db, undefined)` niepusty na tych samych danych.
- Trasy rejestrowane z `requireAuth`, w kolejności oryginału; parametry query przekazywane surowo do repo, bez przedwczesnego parsowania.
- GATE (`analityka.ean.gate.test.ts`) faktycznie dosiewa EAN-y u wielu dostawców — bez tego trzy z sześciu tras wychodziłyby puste i gate nie dowodziłby kształtu; asercje `rows.length > 0` są na miejscu przed porównaniem z fixture.
- Dziury fixtures (gałąź `ean/details?ean=`, gałąź `ean-porownanie?ean=`, `minDiffPct`, różnica WHERE comparison/legacy) pokryte testami jednostkowymi w `analityka.ean.test.ts`.
- Żadna odpowiedź nie zwraca `_przyciete`/`_body_przyciete_z` — sprawdzone testem i ręcznie (fixtures kontra kształt odpowiedzi).
- Frontend: trzy karty 1:1 z `frontend-index.js:28175-28294` — tytuły „2.1-2.4”, „2.5”, „2.6”, komplet kolumn, `mono`/`right` zgodne z oryginałem, karta „2.6” to jedna karta z dwiema tabelami w gridzie.
- Dwa wykresy w karcie „2.6” zgodne z regułami `README.md` §2.5: forma z zadania (histogram → słupek pionowy, ranking nazwanych bytów → słupek poziomy), jedna seria więc bez legendy, kolor z pierwszego slotu (`--chart-1`), etykiety w tokenie tekstu, tabela pod każdym wykresem.
- Filtry: `WYMIARY_EAN_*` odpowiadają realnym kolumnom z SELECT-ów (zweryfikowane przez porównanie z SQL), `currentWhere()` nie ożywione.
- D1–D6 zachowane: KPI nietknięte, brak przycisku CSV, brak UI dla `ean/details`/`ean-porownanie`, brak kontrolki `minDiffPct`, notka o pominiętych wymiarach.
- Dodatkowa weryfikacja liczbowa na `db/snapshot.db` (odtworzona niezależnie w tym review): `ean/comparison` 769 wierszy, czoło `8059971008746` spread 10348 zł / 273,03%; `ean/coverage` 5109/676/90/2/1; `ean/supplier-rank` MO9 100% … MO3 59,75% — wszystko zgodne z raport.md co do wartości.

### Missing or deviating ✗
- Brak — zakres bloku 10c dowieziony zgodnie z planem. (Punkty „poprawa `docs/analityka-bloki-10b-10f.md`” i „zamknięcie bloku w `docs/rebuild-roadmap.md`” z Definition of done nie są jeszcze zrobione, ale to Krok 13+ workflow (`feature.md`, faza „Update docs”), czyli następny etap po tym review, nie brak w tej implementacji.)

### Definition of done
- [x] Sześć tras `/api/analytics/ean*` zarejestrowanych z `requireAuth`, agregaty 1:1 z oryginałem
- [x] GATE: sześć ścieżek zgodnych z `contract/fixtures/` i `contract/openapi.yaml`, 401 bez tokenu
- [x] Żadna odpowiedź nie zawiera `_przyciete` ani `_body_przyciete_z`
- [x] Testy jednostkowe pokrywają obie gałęzie `ean/details`, obie gałęzie `ean-porownanie`, `minDiffPct`, różnicę WHERE comparison/legacy
- [x] Zakładka `ean` renderuje trzy karty 1:1 z oryginałem
- [x] Dwa wykresy w karcie „2.6”, każdy nad swoją tabelą, wg reguł README §2.5
- [x] Notki o pominiętych wymiarach filtra per karta
- [ ] `docs/analityka-bloki-10b-10f.md` poprawiony — nie zrobione w tym branchu; zaplanowane jako faza „Update docs” po review (Krok 13 `feature.md`), nie defekt implementacji
- [ ] `docs/rebuild-roadmap.md`: blok 10c zamknięty — jw., faza po review
- [x] `npm run lint`, `typecheck`, `build`… czyste — lint/typecheck potwierdzone w tym review dla obu pakietów; `npm test` przechodzi (backend 723/723 stabilnie, frontend 408/408 w osobnym uruchomieniu, patrz SHOULD-FIX o niedeterminizmie pełnego zestawu)

## Parallel-test concerns

Testy bloku 10c (`analityka.ean.gate.test.ts`, `analityka.ean.test.ts`, `analityka.ean.test.tsx`, `analityka.ean.filtrowanie.test.ts`) używają własnych, efemerycznych baz/portów przez `stworzSrodowiskoTestowe`/`stworzTestowaBaze` — brak twardo zakodowanych ścieżek czy portów, więc są bezpieczne do równoległego uruchamiania przez kilku agentów. Jedyny zaobserwowany problem to niedeterminizm CZASOWY (nie zasobowy) opisany w SHOULD-FIX — dotyczy obciążenia CPU przy pełnym `vitest run`, nie kolizji zasobów między agentami.

## Overall assessment

Bardzo solidna robota: SQL, WHERE-y, LIMIT-y i kolejność kluczy odpowiedzi są przepisane z chirurgiczną precyzją, a autor poszedł o krok dalej niż wymagał plan — niezależnie zweryfikowałem te same liczby na kopii `db/snapshot.db` (769 wierszy comparison, histogram pokrycia 5109/676/90/2/1, ranking MO9→MO3) i zgadzają się co do jednej cyfry z tym, co raportuje `raport.md`. Testy jednostkowe trafiają dokładnie w dziury, które fixtures i tak zostawiają (`ean/details?ean=`, `ean-porownanie?ean=`, próg `minDiffPct`, różnica WHERE). Jedyna realna rysa to niedeterminizm pełnego zestawu testów frontendowych pod obciążeniem — nie wynika z logiki tego bloku, ale warto to zaadresować, zanim kolejne bloki (10b/10d/10e) dołożą jeszcze więcej ciężkich testów renderujących całą aplikację.
