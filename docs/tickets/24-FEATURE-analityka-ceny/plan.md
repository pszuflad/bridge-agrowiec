# 24-FEATURE-analityka-ceny — Iteracja 10, blok 10b: Analityka / ceny

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/24-analityka-ceny`
> Worktree: `.worktrees/24-FEATURE-analityka-ceny`

## Opis ticketa

Realizacja Iteracji 10, blok **10b** (BE+FE) wg `docs/rebuild-roadmap.md` §5 i ściągi
`docs/analityka-bloki-10b-10f.md` §4. Blok wypełnia zakładkę `ceny` („Ceny w czasie")
w widoku `/analityka` i dowozi pięć tras `/api/analytics/*` za `requireAuth`, z agregatami
1:1 z `mirror/backend/analytics_module.cjs`:

`prices/inflation` · `prices/last-import` · `prices/product-history` (pierwszy czytelnik
`historia_cen` per produkt, decyzja D3 roadmapy) · `market/group-prices` · `top-zmiany`.

Buduje na bloku 10a (`19-FEATURE-analityka-fundament`, zmergowany). Niezależny od
10c/10d/10e — pracują równolegle, więc blok **dokłada treść w gotowe miejsce, nie
przemebluje widoku**.

## Kontekst

**Zweryfikowane w kodzie (researcher + własne odczyty), nie przepisane z opisu:**

- Cały SQL pięciu tras odczytany dosłownie z `mirror/backend/analytics_module.cjs:237-268`
  i `:333`. Żadna z tych tras ani pomocnik `hasHistory` (`:58`) **nie jest zdublowana**
  łatkami `patch_*.cjs` — pułapka cieniowania z `CLAUDE.md` tu nie występuje.
- **Wszystkie 5 fixtures ma niepuste tablice** — to jedyny blok Iteracji 10 z pełną siatką
  bezpieczeństwa (dla porównania 10e ma cztery z sześciu puste). Kształt wiersza jest więc
  realnie dowiedziony przez GATE… ale **tylko jeśli odpowiedź testowa też jest niepusta**:
  `test/gate/ksztalt.ts:50` nie zagląda do elementów pustej tablicy po ŻADNEJ ze stron.
  Stąd wymóg zasiewu poniżej.
- `top-zmiany` — **0 wywołań** w całym bundlu FE (`mirror/frontend/assets/*.js`,
  `deminified/frontend-index.js`). Trasa bez konsumenta.
- `market/group-prices` — 6 trafień, ale to **martwy fetch**: widok woła ją z `group=marka`
  na sztywno (`:27856-27860`), wynik ląduje w `z` i **`z` nie jest użyte nigdzie** w całym
  komponencie; selektora grupy (`useState("marka")`, `:27805`) nie ma w JSX.
- `prices/product-history` — **`stats` (`{min,max,avg}`) nie jest renderowane nigdzie**
  w oryginale, dokładnie jak `margins.low`/`high` w 10a.
- Oryginał dla tras z parametrami **nie skleja `queryKey` w URL** — pisze własny `queryFn`
  z jawnym `?ean=…&kod=…` (`:27870-27877`). Klucz to `["/api/analytics/prices/product-history", n, a]`,
  czyli segmenty klucza NIE są ścieżką. To rozstrzyga wątpliwość z
  `pages/analityka/README.md` §2.2 (sugerował segment `"?days=…"` doklejany przez domyślny
  `queryFn`) — idziemy za oryginałem, bo jest źródłem prawdy.
- Warunek `WHERE` różni `last-import` od `top-zmiany`: pierwsza wymaga
  `cena_zakupu_stara IS NOT NULL AND cena_zakupu_nowa IS NOT NULL`, druga **tylko
  `cena_zakupu_stara IS NOT NULL`**. To nie jest literówka oryginału — odtwarzamy obie.
- `prices/product-history` **nie ma LIMIT-u** i bez parametrów zwraca całą tabelę
  (fixture: `_przyciete.rows = 15597`).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ścieżki `contract/openapi.yaml` (wszystkie `security: [{bearerAuth},{cookieAuth}]`,
`responses: {200, 400, 401}`, **bez schematów odpowiedzi** — potwierdzone):

| Metoda | Ścieżka | Fixture | Koperta |
|---|---|---|---|
| GET | `/api/analytics/prices/inflation` | `GET_analytics_prices_inflation.json` | `{hasHistory, rows}` |
| GET | `/api/analytics/prices/last-import` | `GET_analytics_prices_last-import.json` | `{rows}` |
| GET | `/api/analytics/prices/product-history` | `GET_analytics_prices_product-history.json` | `{hasHistory, rows, stats}` |
| GET | `/api/analytics/market/group-prices` | `GET_analytics_market_group-prices.json` | `{group, rows}` |
| GET | `/api/analytics/top-zmiany` | `GET_analytics_top-zmiany.json` | **goła tablica** |

Kształty wierszy (z fixtures — jedyne świadectwo, openapi milczy):

- `inflation.rows[]` → `{dostawca, miesiac, sredniaCena, inflacjaPct}` (`inflacjaPct` nullable — `LAG` pierwszego miesiąca)
- `last-import.rows[]` → `{kod, nazwa, dostawca, cenaStara, cenaNowa, zmianaPct, utworzono}`
- `product-history.rows[]` → `{data, dostawca, kod, ean, cenaZakupu, cenaSprzedazy, stan}`; `stats` → **dokładnie** `{min, max, avg}`
- `group-prices` → `{group: "marka", rows: [{grupa, oferty, srednia, min, max}]}`
- `top-zmiany[]` → `{kod, nazwa, dostawca, cenaStara, cenaNowa, zmianaPct, utworzono}`

**Adnotacje nagrywarki, których API nie zwraca:** `_przyciete` (4 fixtures) oraz
`_body_przyciete_z: 100` w `top-zmiany` (inny wariant, bo body jest tablicą i nie może
nieść klucza w środku). `test/gate/ksztalt.ts:20` pomija oba po stronie fixture'a, ale
klucz nadmiarowy po stronie ODPOWIEDZI zgłasza jako różnicę — czyli gate sam pilnuje,
żebyśmy ich nie dorobili.

**Rozjazdy spec↔oryginał↔fixtures: BRAK.** Ściąga §4 zgadza się z kodem co do linii,
LIMIT-ów, parametrów i kształtów. Nic do zgłoszenia użytkownikowi.

**Auth nie jest odstępstwem D1** — kontrakt wymaga `security`, oryginał podaje
`requireAuth` we wszystkich pięciu rejestracjach. Zgodność pełna.

## Decyzje

Z rundy Q&A z użytkownikiem (2026-09-03):

- **D1 — `top-zmiany`: backend tak, UI nie.** Trasa ma zero konsumentów w oryginale;
  dołożenie karty byłoby budowaniem nowej funkcjonalności, nie odbudową. Dowozimy trasę
  (jest w GATE), zakładka jej nie renderuje. *Za:* wierność, zero wymyślonego ekranu.
  *Przeciw:* Ania nie zobaczy tych danych — świadomie, do ewentualnej osobnej decyzji.
- **D2 — `market/group-prices`: backend tak, UI nie.** Potwierdzony martwy fetch.
  Ta sama argumentacja co D1; spójne też z tym, jak 10a potraktowało
  `POST bootstrap-current` (trasa bez przycisku, decyzja D4 tamtego bloku).
- **D3 — debounce 300 ms na polach EAN/Kod → ŚWIADOME ODSTĘPSTWO O-10b-1.** Oryginał
  strzela zapytaniem na każde naciśnięcie klawisza (`queryKey: [ścieżka, n, a]`, brak
  debounce), a trasa nie ma LIMIT-u i skanuje `historia_cen` (15 597 wierszy w nagraniu).
  Wpisanie 13-cyfrowego EAN-u = 13 pełnych zapytań. *Za:* chroni backend na stagingu,
  niewidoczne w kształcie odpowiedzi, nie rusza GATE. *Przeciw:* 300 ms opóźnienia
  względem produkcji — jedyna zauważalna różnica.
- **D4 — `stats` pobieramy, nie renderujemy (1:1).** Backend MUSI je zwracać (fixture),
  frontend ich nie pokazuje, bo oryginał nie pokazuje. Dokładnie jak `low`/`high` w 10a.

Decyzje własne, mieszczące się w zatwierdzonych wcześniej odstępstwach:

- **O-10b-2 — wykres liniowy w karcie „3.6 Inflacja cennika"** (rozszerzenie O-10a-3;
  oryginał nie ma żadnych wykresów). Szereg czasowy → linia, zgodnie ze skillem `dataviz`
  i regułami z nagłówka `components/ui/chart.tsx`. Szczegóły i zgodność z regułami palety
  w „Plan wdrożenia" pkt 8.
- **Filtrowanie klienckie** dla `inflation` i `last-import` (żadna nie czyta `req.query`),
  wyłącznie po wymiarze `dostawcy` — wiersze tych tras nie niosą pozostałych pięciu
  wymiarów, więc sekcja wypisuje je jako pominięte przez `wymiaryNieobslugiwane`, tak jak
  robi to `SekcjaMarze`.
- **`product-history` idzie parametrem do `queryFn`**, nie przez `zastosujFiltry` —
  trasa realnie czyta `?ean` i `?kod`.

## Plan wdrożenia

### Backend

1. **`rebuild/backend/src/repos/analityka.ts`** — dopisać (układ pliku bez zmian: jedna
   funkcja = jedna trasa, SQL dosłownie, limity jako nazwane stałe):
   - `czyJestHistoria(db)` — port `hasHistory(db)` (`:58`), `COUNT(*) FROM historia_cen > 0`.
     Osobno od `statusHistorii()` z 10a, bo oryginał też ma to osobnym zapytaniem.
   - `GRUPY_RYNKU` / `KOLUMNY_GRUP_RYNKU` — whitelista `marka|model|rozmiar` → nazwa kolumny,
     domknięta TYPEM (wzorem `KOLUMNY_FILTROW`), żeby do `sql.raw` nie dało się wpuścić
     niczego z `req.query`. Domyślna `marka` — 1:1 z `['marka','model','rozmiar'].includes(...)`.
   - `cenyGrupRynku(db, group)` → `{group, rows}`, `LIMIT_GRUP_RYNKU = 500`.
   - `zmianyCenOstatniegoImportu(db)` → `{rows}`, `LIMIT_OSTATNIEGO_IMPORTU = 500`.
   - `historiaCenProduktu(db, {ean, kod})` → `{hasHistory, rows, stats}`; `WHERE 1=1`
     + opcjonalne `AND ean = ?` / `AND kod = ?`; **bez LIMIT-u**; przy `hasHistory === false`
     **nie odpytuje** i zwraca `rows: []`; `stats` liczone w JS z `rows.map(r => r.cenaZakupu)
     .filter(v => v != null)`, `avg` przez port `round(v, 2)` (`Math.round(n*100)/100`),
     wszystkie trzy `null` przy pustej liście.
   - `inflacjaCennika(db)` → `{hasHistory, rows}`; CTE `month_avg` (`WHERE cena_zakupu > 0`,
     `GROUP BY dostawca, substr(zarejestrowano_at,1,7)`) → `seq` z `LAG(...) OVER (PARTITION BY
     dostawca ORDER BY miesiac)` → `ROUND(CASE WHEN prev_price > 0 THEN … END, 2)`;
     `ORDER BY miesiac DESC, dostawca`, `LIMIT_INFLACJI = 500`.
   - `topZmiany(db)` → goła tablica, `LIMIT_TOP_ZMIAN = 100`, `ORDER BY ABS(zmiana_pct) DESC`.
2. **`rebuild/backend/src/routes/analytics.ts`** — pięć `router.get(..., requireAuth, ...)`
   w kolejności oryginału (`market/group-prices`, `prices/last-import`,
   `prices/product-history`, `prices/inflation`, `top-zmiany`), z odczytem
   `String(req.query.x || "")` tam, gdzie oryginał go ma.

### Frontend

3. **`pages/analityka/api.ts`** — typy z fixtures (`WierszInflacji`, `WierszOstatniegoImportu`,
   `WierszHistoriiCeny`, `StatystykiCeny`, `HistoriaCenyProduktu`) + hooki:
   `useInflacjaCen()`, `useZmianyCenOstatniegoImportu()` (domyślny `queryFn`, klucz = ścieżka)
   oraz `useHistoriaCenyProduktu(ean, kod)` z **własnym `queryFn`** (jawny `?ean=&kod=`,
   `naglowki(false)`, `credentials: "include"`, 401 → `null` zgodnie z konwencją
   `lib/queryClient.ts`), który **nie odpytuje, gdy oba pola puste** — 1:1 z `n || a ? … : …`.
4. **`pages/analityka/filtrowanie.ts`** — `WYMIARY_CEN: WymiarFiltra[] = ["dostawcy"]`
   + generyczne `zastosujFiltrDostawcow<T extends { dostawca: string }>(wiersze, wybor)`
   (użyte przez obie sekcje tabelaryczne; `zastosujFiltryMarz` zostaje bez zmian).
5. **`pages/analityka/uzyjOpoznionejWartosci.ts`** — mikro-hook debounce (300 ms), O-10b-1.
   Osobny plik, bo `ean/details?ean` z bloku 10c będzie go chciał tak samo.
6. **`pages/analityka/SekcjaCeny.tsx`** — trzy karty w kolejności oryginału
   (`deminified/frontend-index.js:28295-28416`), etykiety i kolumny 1:1:
   - „3.1 Zmiany cen z ostatnich importów”: Data(mono) · Dostawca(mono) · Kod(mono) ·
     Nazwa · Było(right) · Jest(right) · Zmiana %(right)
   - „3.2 / 3.3 Historia ceny wybranej opony”: dwa `Input` (placeholdery `EAN`,
     `Kod produktu`) + statyczny tekst „Wykres/tabela zapełnią się po zebraniu historii cen.”
     renderowany ZAWSZE; kolumny: Data(mono) · Dostawca(mono) · Kod(mono) ·
     Cena zakupu(right) · Cena sprzedaży(right) · Stan(right) — **bez EAN**, mimo że SQL
     go zwraca (tak jest w oryginale)
   - „3.6 Inflacja cennika”: Miesiąc(mono) · Dostawca(mono) · Śr. cena(right) ·
     Zmiana %(right)
   Bez przycisków CSV — trasa `export/{view}` należy do 10f (tak samo jak w `SekcjaMarze`).
7. **`pages/Analityka.tsx`** — podmiana `ZakladkaWPrzygotowaniu blok="10b"` na `<SekcjaCeny/>`.
   Nic poza tym w tym pliku nie ruszamy (10c/10d/10e pracują równolegle).
8. **Wykres (O-10b-2)** — w karcie inflacji, NAD tabelą z tymi samymi liczbami:
   - forma: szereg czasowy → `LineChart`; oś X = `miesiac` rosnąco, oś Y = `sredniaCena`;
   - **jedna oś Y** (nigdy `inflacjaPct` obok `sredniaCena` — inna skala);
   - **≤ 4 serie** (`MAX_SERII`): czterej dostawcy o największej liczbie punktów
     historii, **wybrani z danych NIEFILTROWANYCH**, dzięki czemu zawężenie filtra
     ukrywa serie, ale nigdy nie przemalowuje ocalałych (reguła „kolor należy do bytu,
     nie do pozycji”). Gdy wybór filtra nie zawiera żadnego z tych czterech — notka
     kierująca do tabeli, zamiast pustego płótna;
   - kolory ze slotów `KOLORY_WYKRESU` w kolejności 1→2→4→3→5, legenda obecna
     (≥2 serie), etykiety osi w tokenach tekstu, tabela pod wykresem obowiązkowa.

### Testy

9. **`rebuild/backend/test/gate/dane.ts`** — nowy zasiew `zasiejHistorieCenDlaCen(db)`:
   kilku dostawców × ≥2 miesiące × niepusty `ean`. Powód wprost: `zasiejHistorieCen`
   z 10a ma trzy wiersze jednego dostawcy, w jednym miesiącu i **bez `ean`** — na takich
   danych `inflation` zwróciłoby jeden wiersz z `inflacjaPct: null`, a `product-history`
   wiersze z `ean: null`, czyli GATE dowodziłby kształtu słabiej niż może.
   Istniejącego zasiewu **nie zmieniamy** (używają go testy dostawców).
10. **`rebuild/backend/test/analityka.ceny.gate.test.ts`** — GATE bloku: dla każdej z 5 tras
    `sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture`, `it.each` na 401 bez tokenu,
    plus jawne asercje „odpowiedź nie ma `_przyciete`/`_body_przyciete_z`” i „`stats` ma
    dokładnie klucze `min,max,avg`”.
11. **`rebuild/backend/test/analityka.ceny.agregaty.test.ts`** — testy jednostkowe tego,
    czego GATE nie dowodzi:
    - `stats`: min/max/avg z zaokrągleniem do 2 miejsc, pominięcie `null`-i, trzy `null`
      przy pustym zbiorze;
    - `hasHistory === false` → `rows: []` i `stats` w `null`-ach, **bez zapytania**;
    - `product-history`: filtr po samym `ean`, po samym `kod`, po obu (AND), bez parametrów
      (cała tabela);
    - `group-prices`: `?group=model`/`rozmiar` działa, wartość spoza whitelisty i brak
      parametru → `marka`, a `group` w odpowiedzi to wartość ZACIŚNIĘTA;
    - `top-zmiany` vs `last-import`: wiersz z `cena_zakupu_nowa IS NULL` jest w pierwszej,
      nie ma go w drugiej; porządek po `ABS(zmiana_pct)`;
    - `inflation`: `inflacjaPct` = `null` dla pierwszego miesiąca dostawcy, policzone dla
      kolejnych; wiersze z `cena_zakupu <= 0` pominięte.
12. **`rebuild/frontend/test/msw/kontrakt.ts`** — trzy loadery zdejmujące klucze na `_`
    (istniejący `analitykaZFixtura`).
13. **`rebuild/frontend/test/analityka.ceny.test.tsx`** — widok: trzy karty w kolejności
    oryginału i ich tytuły; etykiety kolumn 1:1; **brak zapytania o `product-history`,
    dopóki oba pola są puste**; po wpisaniu EAN-u zapytanie leci z `?ean=`; debounce
    (jedno zapytanie zamiast N); filtr globalny „dostawcy” zawęża obie tabele i pokazuje
    notkę o wymiarach pominiętych; wykres inflacji obecny wraz z tabelą pod nim.
14. **`pages/analityka/README.md`** — dopisać, co 10b ustaliło dla kolejnych bloków:
    parametry idą własnym `queryFn` z jawnym query stringiem (jak w oryginale), a nie
    segmentem `"?…"` doklejanym przez domyślny `queryFn`; gotowy hook debounce.

Kolejność: (1-2) backend → (9-11) testy backendu → (3-8) frontend → (12-13) testy frontendu
→ (14) README. Po każdym kroku `npm run lint && npm run typecheck`.

## Strategia testów

- **GATE odbudowy** — obowiązuje, ticket dotyka API. Pięć ścieżek z tabeli wyżej ×
  (kontrakt + fixture), plus 401 na każdej. **Warunek konieczny wiarygodności: odpowiedzi
  w teście muszą być NIEPUSTE** — inaczej `ksztalt.ts` przepuści cokolwiek. Stąd zasiew
  z pkt 9 i jawna asercja `rows.length > 0` przed porównaniem z fixture'em.
- **Jednostkowe (backend)** — pkt 11; celują dokładnie w to, czego fixture nie widzi:
  gałęzie parametrów, whitelistę, brak historii, arytmetykę `stats`, różnicę `WHERE`
  między `top-zmiany` a `last-import`.
- **Widok (MSW, frontend)** — pkt 13, dane z fixtures przez loader zdejmujący klucze na `_`.
- **Pomijamy E2E** — widok nie wprowadza przepływu użytkownika ponad wpisanie tekstu
  w dwa pola; pokrywa to test widoku z MSW, jak w 10a.
- Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w
  `rebuild/backend/` i `rebuild/frontend/` (Node ≥ 20 z nvm).

## Poza zakresem

- Przyciski **CSV** i trasa `GET /api/analytics/export/{view}` — blok **10f**.
- Karty dla `top-zmiany` i `market/group-prices` — decyzje D1/D2 (backend bez UI).
- Renderowanie `stats` — decyzja D4.
- Pozostałe 17 tras analityki — bloki 10c/10d/10e/10f.
- Pisarze `historia_cen` — istnieją od 3d-1 i 10a; ten blok tylko czyta.
- Kafle KPI, `FiltryGlobalne`, `NaglowekKpi`, kolejność i etykiety zakładek, paleta
  `--chart-1..5` — **nie ruszamy** (zamrożone w 10a, paletę chroni `test/tokeny.test.ts`).

## Definition of done

- [ ] Pięć tras za `requireAuth`, SQL 1:1 z `analytics_module.cjs`, limity 500/500/—/500/100
- [ ] GATE zielony: 5 fixtures (kształt 1:1) + kontrakt (kody, security) + 401 bez tokenu
- [ ] Odpowiedzi **nie zawierają** `_przyciete` ani `_body_przyciete_z`
- [ ] Odpowiedzi w teście GATE są niepuste — kształt wiersza realnie dowiedziony
- [ ] `stats` ma dokładnie klucze `{min, max, avg}`; `hasHistory:false` → `rows: []` bez zapytania
- [ ] `product-history` czyta `historia_cen`, filtruje po `?ean` i `?kod` (AND), bez LIMIT-u
- [ ] `group-prices` zacieśnia `?group` do `marka|model|rozmiar` (domyślnie `marka`)
      i zwraca wartość zaciśniętą
- [ ] Zakładka `ceny` renderuje trzy karty oryginału z etykietami i kolumnami 1:1
- [ ] Zapytanie o `product-history` NIE leci, dopóki oba pola są puste; debounce 300 ms (O-10b-1)
- [ ] Wykres inflacji: jedna oś Y, ≤4 serie, legenda, tabela pod spodem, sloty palety 1→2→4→3→5
- [ ] `lint`, `typecheck`, `build`, `test` czyste w backendzie i frontendzie
- [ ] `docs/rebuild-roadmap.md` i `docs/rebuild-backlog.md` opisują STAN po bloku 10b
