# 24-FEATURE-analityka-ceny — Code review

> Reviewed: 2026-09-04
> Branch: feature/24-analityka-ceny
> Diff: 15 plików, 4 commity (`f51c2cb`, `e139e38`, `d17122c`, `b929d99`)

## BLOCKER

Brak. Nie znaleziono żadnego blokera — logika SQL jest przepisana dosłownie z
`mirror/backend/analytics_module.cjs:237-268,333`, ścieżka `req.query.group → sql.raw` jest
domknięta typem (`GrupaRynku`/`KOLUMNY_GRUP_RYNKU`), parametry `?ean`/`?kod` idą jako bind
(`sql\`ean = ${ean}\``), GATE dowodzi niepustych odpowiedzi, a `lint`/`typecheck`/testy
backendu i frontendu przechodzą (uruchomione ponownie w ramach tego review — patrz niżej).

## SHOULD-FIX

- [ ] `docs/rebuild-roadmap.md` / `docs/rebuild-backlog.md` — nie zawierają jeszcze wpisu
  o zamknięciu bloku 10b (brak commitu „sync docs”, jaki mają np. `22-FEATURE-analityka-ean`
  czy `19-FEATURE-analityka-fundament`). Ostatni punkt Definition of done w `plan.md:261`
  tego wymaga wprost.
  - Reason: to wymóg z `plan.md` i z zasad projektu (CLAUDE.md: „roadmapa opisuje STAN, nie
    zamiar”) — bez tego następna sesja (10c/10d/10e, które i tak pracują równolegle) czyta
    nieaktualny opis stanu Iteracji 10.
  - Suggestion: dopisać do bloku 10b w roadmapie datę + ID ticketa + rozliczenie GATE,
    analogicznie do wpisu 10a (`docs/rebuild-roadmap.md:160`), najlepiej osobnym commitem
    „sync docs” przed mergem.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/analityka/README.md:143-149` — po dopisaniu nowego punktu 6
  („Sprawdź, czy w danych jest w ogóle szereg”) lista ma dwa punkty oznaczone „6.” (kolejny to
  „Legenda przy ≥2 seriach…”). Markdown renderuje to poprawnie (własna numeracja), więc czysto
  kosmetyczne — warto poprawić numerację przy najbliższej okazji.
- [ ] `rebuild/frontend/src/pages/analityka/SekcjaCeny.tsx:128-139` — piąty i kolejni dostawcy
  na wykresie inflacji nie trafiają do zbiorczej serii „Pozostałe” (jak sugeruje nagłówek
  `components/ui/chart.tsx:35`), tylko zostają wyłącznie w tabeli pod wykresem. To jednak
  dokładnie ten sam wzorzec co w `SekcjaMarze.tsx:104` z bloku 10a (tam też samo `slice`, bez
  agregowania „Pozostałych”), więc nie jest to nowa niespójność wprowadzona przez ten blok —
  zostawiam jako obserwację, nie do poprawki w tym tickecie.

## Plan compliance

### Done ✓
- Backend: `czyJestHistoria`, `GRUPY_RYNKU`/`KOLUMNY_GRUP_RYNKU`/`zacisnijGrupeRynku`,
  `cenyGrupRynku`, `zmianyCenOstatniegoImportu`, `historiaCenProduktu` + `statystykiCen`,
  `inflacjaCennika`, `topZmiany` — wszystkie w `repos/analityka.ts`, sekcja „BLOK 10b · CENY”,
  SQL 1:1 z oryginałem, limity 500/500/—/500/100 zgodne z planem.
- Backend: pięć `router.get(..., requireAuth, ...)` w `routes/analytics.ts`, w kolejności
  rejestracji z oryginału.
- Frontend: `api.ts` — trzy hooki (`useZmianyCenOstatniegoImportu`, `useInflacjaCen`,
  `useHistoriaCenyProduktu` z własnym `queryFn`, `401 → null`, `encodeURIComponent`,
  „nie pytaj, gdy oba pola puste”).
- Frontend: `filtrowanie.ts` — `WYMIARY_CEN`, `zastosujFiltrDostawcow` (generyczny).
- Frontend: `useOpoznionaWartosc.ts` — debounce 300 ms, osobny plik do reużycia w 10c
  (nazwa różni się od planu — `useOpoznionaWartosc` zamiast `uzyjOpoznionejWartosci` —
  odnotowane w raporcie jako świadome doprecyzowanie z powodu `react-hooks/rules-of-hooks`;
  uzasadnione i nieszkodliwe).
- Frontend: `SekcjaCeny.tsx` — trzy karty w kolejności i z etykietami oryginału (zweryfikowane
  linia po linii wobec `deminified/frontend-index.js:28295-28416`), bez kolumny EAN w karcie
  historii, bez przycisków CSV, wykres inflacji (O-10b-2) z jedną osią Y, ≤4 seriami liczonymi
  z danych NIEFILTROWANYCH, legendą przy ≥2 seriach, tabelą pod wykresem.
- `Analityka.tsx` — wyłącznie podmiana placeholdera na `<SekcjaCeny/>`, reszta pliku nietknięta.
- Testy: GATE (`analityka.ceny.gate.test.ts`, 12 przypadków), jednostkowe
  (`analityka.ceny.agregaty.test.ts`, 23 przypadki), widok (`analityka.ceny.test.tsx`,
  19 przypadków), nowy zasiew `zasiejHistorieCenDlaCen` (wielu dostawców, dwa miesiące,
  niepusty `ean`, wiersz z ceną zerową).
- `pages/analityka/README.md` — §2.2 sprostowane (własny `queryFn` zamiast segmentu klucza),
  §2.2a debounce, reguły wykresu rozszerzone, nowy §5 z dorobkiem bloku.

### Missing or deviating ✗
- Roadmapa/backlog nie zaktualizowane pod stan po bloku 10b — patrz SHOULD-FIX wyżej.
  Poza tym nie znaleziono odstępstw od planu.

### Definition of done
- [x] Pięć tras za `requireAuth`, SQL 1:1 z `analytics_module.cjs`, limity 500/500/—/500/100
- [x] GATE zielony: 5 fixtures (kształt 1:1) + kontrakt (kody, security) + 401 bez tokenu —
      zweryfikowano ponownym uruchomieniem (`vitest run test/analityka.ceny.gate.test.ts` → 12/12)
- [x] Odpowiedzi nie zawierają `_przyciete` ani `_body_przyciete_z` — jawna asercja w GATE
- [x] Odpowiedzi w teście GATE są niepuste — `expect(rows.length).toBeGreaterThan(0)` przed
      każdym porównaniem z fixture'em
- [x] `stats` ma dokładnie klucze `{min, max, avg}`; `hasHistory:false` → `rows: []` bez
      zapytania — pokryte GATE + testem jednostkowym „gałąź brak historii”
- [x] `product-history` czyta `historia_cen`, filtruje po `?ean` i `?kod` (AND), bez LIMIT-u
- [x] `group-prices` zacieśnia `?group` do `marka|model|rozmiar` (domyślnie `marka`) i zwraca
      wartość zaciśniętą
- [x] Zakładka `ceny` renderuje trzy karty oryginału z etykietami i kolumnami 1:1
- [x] Zapytanie o `product-history` NIE leci, dopóki oba pola są puste; debounce 300 ms
      (O-10b-1) — testy widoku potwierdzają (jedno zapytanie na 13 znaków)
- [x] Wykres inflacji: jedna oś Y, ≤4 serie, legenda, tabela pod spodem, sloty palety 1→2→4→3→5
- [x] `lint`, `typecheck`, `build`, `test` czyste w backendzie i frontendzie — zweryfikowano
      ponownie w ramach review (`npm run lint`, `npm run typecheck` w obu projektach zielone;
      testy bloku 10b: backend 35/35, frontend 19/19; `tokeny.test.ts` 6/6 dalej zielony)
- [ ] `docs/rebuild-roadmap.md` i `docs/rebuild-backlog.md` opisują STAN po bloku 10b —
      NIE spełnione, patrz SHOULD-FIX

## Parallel-test concerns

None — all tests parallelizable. GATE i testy jednostkowe backendu korzystają z istniejącej
infrastruktury `stworzSrodowiskoTestowe`/`stworzTestowaBaze` (baza tymczasowa, port efemeryczny,
ten sam wzorzec co reszta pakietu). Testy frontendu używają MSW i `queryClient.clear()` per test,
bez zasobów współdzielonych.

## Overall assessment

Bardzo solidna realizacja — SQL, kolejność rejestracji tras, etykiety i kolumny UI zweryfikowane
linia po linii wobec oryginału i zgadzają się. Rozróżnienie progów (`last-import` wymaga obu cen,
`top-zmiany` tylko starej; `stats` przepuszcza zero, `inflation` je odsiewa) jest odtworzone
poprawnie i pokryte osobnymi testami, tak samo brak LIMIT-u w `product-history` i decyzje D1–D4
o niewidocznych w UI trasach. Jedyny realny brak to niezaktualizowana roadmapa/backlog — do
uzupełnienia przed mergem, nie wpływa na jakość samego kodu.
