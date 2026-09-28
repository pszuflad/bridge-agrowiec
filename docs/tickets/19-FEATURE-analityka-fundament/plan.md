# 19-FEATURE-analityka-fundament — Iteracja 10, blok 10a (fundament analityki)

> Status: Draft
> Branch: `feature/19-analityka-fundament`
> Worktree: `.worktrees/19-FEATURE-analityka-fundament`

## Opis ticketa

Iteracja 10, blok **10a — Fundament analityki** (BE+FE) wg `docs/rebuild-roadmap.md` §5.
Pierwszy blok analityki: stawia infrastrukturę i **wzorzec**, które reużyją bloki 10b–10e.

**Cel (Ania klika):** otwiera `/analityka`, widzi nagłówek KPI, globalne filtry i jeden
działający dashboard (marże) na realnych danych.

Zakres z promptu:
- Backend za `requireAuth`: `GET /api/analytics/filters`, `/status`, `/kpi`, `/margins`,
  `POST /api/analytics/bootstrap-current` — agregacje wiernie z `mirror/backend/analytics_module.cjs`.
- Frontend: szkielet `/analityka` (panel zakładkowy, pasek filtrów, nagłówek KPI, zakładka
  z marżami jako pełny wzorzec, miejsce na 10b–10e), wpięty w istniejący shell/router.
- Udokumentowany **wzorzec „sekcji dashboardu"** dla 10b–10e.

---

## Kontekst

### Co znalazł research (i co zweryfikowałem osobiście)

Blok 10a jest **jedynym blokiem I10, w którym prompt opisuje inny ekran niż ma oryginał.**
Cztery ustalenia z promptu okazały się nietrafione wobec `deminified/frontend-index.js:27804-28640`
(funkcja `zM` — cały widok `/analityka`) i `mirror/backend/analytics_module.cjs`:

| Założenie promptu | Stan faktyczny oryginału | Dowód |
|---|---|---|
| 6 globalnych wyszukiwalnych filtrów w UI | **Zero filtrów w UI.** `/api/analytics/filters` jest pobierane, ale renderowane jest wyłącznie `f.dostawcy.length` w kaflu KPI. Pozostałych pięciu list (`marki`, `modele`, `rozmiary`, `indeksyNosnosci`, `indeksyPredkosci`) oryginał nigdzie nie wyświetla. | `zM+12` (fetch), `zM+192` (jedyne użycie) |
| 4 kafle z `/api/analytics/kpi` | 4 kafle są, ale z **innych** źródeł: „Dostawcy" (`filters.dostawcy.length`), „EAN wspólne" (`ean/comparison`), „Pozycje unikalne" (`ean/unique`), „Snapshoty" (`status.snapshots`). **`GET /api/analytics/kpi` nie jest wołane przez FE ani razu.** Sam backend nazywa je *„Backward-compatible aliases used by previous frontend build"*. | `zM+186-222`; `analytics_module.cjs:324` (komentarz) |
| Zakładka „Marże" jako osobny dashboard | Zakładek jest **5**: `dostawcy` · `ean` · `ceny` · `dostepnosc` · `marza`, domyślna **„Dostawcy"** (nie marże). Etykiety PL: „Dostawcy", „EAN i ceny", „Ceny w czasie", „Dostępność", „Marża i rotacja". `margins` to **pierwsza z trzech kart** w ostatniej zakładce, obok `rotation/inactive` i `lifecycle/models` (zakres 10e). | `zM+231-243` (TabsTrigger), `zM+713-836` (treść zakładki) |
| Wykresy (Recharts / inna biblioteka) | **Zero wykresów w bundlu.** Grep po `recharts`, `chart.js`, `d3`, `apexcharts`, `echarts`, `nivo` w `mirror/frontend/assets/*.js` — brak trafień. Cała wizualizacja to tabela `I()` z `.slice(0,300)` plus pasek postępu `O()` zbudowany z dwóch `<div>`. | `zM+143-169` |
| „`margins` = tabela + filtry" | `GET /api/analytics/margins` **nie przyjmuje żadnego query param.** Funkcja `currentWhere(q, alias)` zbudowana dokładnie pod te 6 filtrów (+ `cenaMin`/`cenaMax`/`stan`) istnieje, ale ma **zero wywołań w całym module** — martwy kod. Odpowiedź niesie też `low` (marża <5%) i `high` (marża >80%), których oryginalny FE **w ogóle nie renderuje**. | `analytics_module.cjs:60-74` (definicja), `:292-297` (handler); `grep -c currentWhere` → 1 trafienie = sama definicja |

**Wniosek:** prompt opisuje redesign, nie odbudowę. Zgodnie z `CLAUDE.md` („każde odstępstwo
musi być świadomą decyzją użytkownika") rozjazd został zgłoszony przed planem i rozstrzygnięty
w rundzie Q&A 2026-09-03 — patrz „Decyzje".

### Dwie pułapki, które trzeba nazwać zanim ktoś napisze kod

**1. `_przyciete` NIE JEST polem API.** Prompt mówi „Endpoint zwraca listy PRZYCIĘTE (pole
`_przyciete` z pełnymi licznikami)". To nieprawda: `_przyciete` i `_body_przyciete_z` to
**adnotacje nagrywarki fixtures** (`contract/README.md:29` — duże tablice przycięto do 5
elementów, 27 MB → 247 KB). Handler oryginału zwraca sześć gołych tablic i nic więcej.
Konsekwencje:
- nasz backend **nie może** zwracać `_przyciete` — harness GATE pomija klucze na `_` po
  stronie *fixture'a*, ale klucz nadmiarowy po stronie *odpowiedzi* zgłasza jako RÓŻNICĘ
  (`test/gate/ksztalt.ts:59-77`), więc zwrócenie go **wywaliłoby gate**;
- uzasadnienie dla wyszukiwalnych dropdownów mimo to **zostaje w mocy**: listy są realnie duże,
  bo ucina je `LIMIT` w SQL (`modele` 1000, `rozmiary` 1000, `indeksyNosnosci` 300,
  `indeksyPredkosci` 300, `marki` 500, `dostawcy` bez limitu).

**2. Paleta wykresów już istnieje i jest zamrożonym tokenem.** `--chart-1..5` siedzą
w `rebuild/frontend/src/styles/` w obu trybach — przyszły z surowego CSS oryginału w I1.
Przewalidowałem je skryptem ze skilla `dataviz` (nie na oko):

```
LIGHT #d98e26,#3969ac,#33998d,#e87d30,#435670  (surface #f9fafb)
  [PASS] Lightness band · [PASS] CVD separation ΔE 11.5 · [PASS] Normal-vision floor ΔE 16.4
  [FAIL] Chroma floor  #33998d (0.094), #435670 (0.049) — czytają się szaro
  [WARN] Contrast vs surface  #d98e26 (2.61), #e87d30 (2.76) < 3:1
DARK  #e6a64c,#709ddb,#4dcbbd,#e68c4c,#9cb3c9  (surface #161d27)
  [PASS] CVD separation ΔE 12.4 · [PASS] Normal-vision floor ΔE 15.0 · [PASS] Contrast
  [FAIL] Lightness band  wszystkie 5 powyżej pasma · [FAIL] Chroma floor #9cb3c9 (0.041)
```

**Twarde checki (rozróżnialność przy daltonizmie i przy normalnym widzeniu) przechodzą
w obu trybach** — to są te, które decydują o czytelności. Reszta to ostrzeżenia o niskiej
chromie i kontraście. **Tokenów nie ruszamy** (pochodzą z oryginału i chroni je test-strażnik
`rebuild/frontend/test/tokeny.test.ts`); zamiast tego stosujemy ulgę, którą skill sam przewiduje:
tabela obok wykresu + widoczne etykiety + ograniczenie liczby serii. Zapisane we wzorcu jako
wiążąca reguła dla 10b–10e.

### Stan `rebuild/` — co jest, czego nie ma

Jest do reużycia: harness GATE (`test/gate/`), wzorzec routera (`routes/markups.ts`),
wzorzec repo z agregatem okienkowym (`repos/suppliers.ts:47`), `Tabs`, `Card`, `Button`,
`Input`, `Badge`, multi-select `pages/katalog/WyborWielokrotny.tsx` (bez wyszukiwarki),
wirtualizacja wierszy (`pages/katalog/wirtualizacja.ts`), pozycja „Analityka" w sidebarze
(`components/nawigacja.ts:37`).

Nie ma: `recharts`, `@radix-ui/react-popover`, `components/ui/chart.tsx`,
`components/ui/popover.tsx`, `components/ui/table.tsx`, wyszukiwalnego dropdowna.
Rejestr npm osiągalny (`npm view recharts version` → 3.10.1).

---

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ścieżki `contract/openapi.yaml`** (wszystkie pięć w zakresie):

| Metoda | Ścieżka | openapi | Fixture |
|---|---|---|---|
| GET | `/api/analytics/filters` | `:189-197` | `GET_analytics_filters.json` |
| GET | `/api/analytics/status` | `:225-233` | `GET_analytics_status.json` |
| GET | `/api/analytics/kpi` | `:207-215` | `GET_analytics_kpi.json` |
| GET | `/api/analytics/margins` | (blok `margins`) | `GET_analytics_margins.json` |
| POST | `/api/analytics/bootstrap-current` | `:103-114` | **brak** (fixtures nie mają metod zapisujących — `contract/README.md:38`) |

**Siła tej siatki, nazwana wprost.** `openapi.yaml` dla tras analityki **nie ma schematów
odpowiedzi** — tylko `responses: {200, 400, 401}` i `security`. Część „kontrakt" gate'a dowodzi
więc jedynie, że ścieżka i metoda istnieją, status jest zadeklarowany i odpowiedź jest JSON-em.
**Całe świadectwo kształtu niosą fixtures** — dla czterech GET-ów jest twarde (nagrane ciała),
dla `bootstrap-current` nie ma go wcale (zostaje walidacja openapi + test 401 + test jednostkowy).

**Auth to NIE odstępstwo D1.** Inaczej niż przy `markups`/`promotions` (gdzie kontrakt miał
`security: []`, a rebuild świadomie dokładał `requireAuth`) — wszystkie pięć tras analityki ma
w `openapi.yaml` `security: [{bearerAuth: []}, {cookieAuth: []}]`, a oryginał podaje `requireAuth`
w każdej rejestracji. Zgodność jest tu pełna, nie ma czego odnotowywać jako różnicę.

**Znane rozjazdy i jak je rozstrzygamy:**
1. `_przyciete` w fixtures ↔ brak takiego pola w odpowiedzi produkcji → **nie zwracamy go**;
   to artefakt nagrywarki, harness pomija klucze na `_` po stronie fixture'a (uzasadnienie wyżej).
2. `margins.low` / `margins.high` w fixture są **puste tablice** → harness nie sprawdza kształtu
   elementów pustej tablicy (`ksztalt.ts:50`). Kształt wiersza `low`/`high` weryfikujemy więc
   **testem jednostkowym przeciw SQL-owi oryginału**, nie fixture'em, i zapisujemy to jako
   świadomie słabsze świadectwo (identyczna sytuacja co `GET_promotions.json` w 4a).
3. Roadmapa 10a mówi „`margins` jako pełny wzorzec *filtr→zapytanie→tabela/wykres*" ↔ backend
   oryginału nie filtruje `margins` w ogóle → rozstrzygnięte decyzją D2 (filtr kliencki).

---

## Decyzje

Runda Q&A z użytkownikiem, 2026-09-03. Wszystkie cztery pytania wynikły z rozjazdu
prompt ↔ oryginał opisanego w „Kontekście"; użytkownik wybrał wariant rekomendowany
w każdym z nich.

**D1 — Szkielet 1:1 z oryginałem, treść nagłówka wg promptu.**
Zakładki, ich kolejność, wartości `value` i etykiety PL odtwarzamy 1:1 (`dostawcy` „Dostawcy" ·
`ean` „EAN i ceny" · `ceny` „Ceny w czasie" · `dostepnosc` „Dostępność" · `marza` „Marża i
rotacja"), z domyślną `dostawcy` jak w oryginale. W 10a wypełniamy **wyłącznie kartę „Marża per
dostawca/kategoria/marka"** w zakładce `marza`; pozostałe zakładki dostają jawne miejsce dla
10b–10e. Nagłówek KPI, globalny pasek filtrów i wykres wchodzą jako **nazwane odstępstwo**.
*Za:* 10b–10e mają gotowe, właściwe miejsca (zero przepisywania roadmapy), a nazwy zakładek
zgadzają się z tym, co Ania zna z produkcji. *Przeciw:* nagłówek nie jest 1:1.

**D2 — Filtry globalne działają po stronie klienta.**
Backend `margins` zostaje 1:1 z oryginałem: bez query params, `currentWhere()` **nie ożywiamy**.
Filtrowanie dzieje się w przeglądarce nad pobraną tablicą `rows`.
*Za:* zero rozszerzania API poza to, co produkcja realnie zwraca — GATE zostaje twardy, bo każde
zachowanie, które testujemy, ma pokrycie w nagraniu. *Przeciw:* wzorzec dla 10b–10e to
„filtr → `useMemo`", a nie „filtr → query param"; łagodzi to fakt, że 10b i 10e mają trasy
z realnymi parametrami (`days`, `group`, `ean`/`kod`), więc tamten wariant wzorca powstanie
tam, gdzie jest potwierdzony oryginałem.

**D3 — Kafle KPI z `/api/analytics/kpi`.**
Cztery kafle: Produkty · Dostawcy · Śr. marża · Staging oczekujące.
*Za:* endpoint jest w zakresie 10a i ma fixture, więc kafle działają na realnych danych bez
zależności od 10c (wariant 1:1 wymagałby `ean/comparison` i `ean/unique`, czyli wciągnięcia
zakresu 10c albo dwóch kafli świecących „—"). *Przeciw:* to nie są kafle oryginału — odstępstwo
do odnotowania w raporcie i roadmapie.

**D4 — `POST /api/analytics/bootstrap-current` bez UI.**
Trasa powstaje i przechodzi GATE (openapi + 401 + test jednostkowy), ale **nie dostaje przycisku**.
*Za:* 1:1 z oryginałem (jego FE nie woła jej nigdy — grep `bootstrap` po `frontend-index.js`:
zero trafień) i zero ryzyka, że Ania kliknie dwa razy. Trasa jest **nieidempotentna**: to
`INSERT … SELECT` bez `ON CONFLICT`, więc każde wywołanie dokłada po jednym wierszu
`historia_cen` na każdy aktywny produkt. *Przeciw:* dowieziona „na sucho", uruchamiana ręcznie.

### Świadome odstępstwa od oryginału (komplet)

| # | Odstępstwo | Decyzja |
|---|---|---|
| O-10a-1 | Nagłówek KPI z `/api/analytics/kpi` zamiast czterech kafli oryginału | D3 |
| O-10a-2 | Globalny pasek 6 wyszukiwalnych filtrów, którego oryginał nie ma | D1 + D2 (kliencki) |
| O-10a-3 | Wykres słupkowy w sekcji marż — oryginał nie ma żadnych wykresów | D1 (infrastruktura dla 10b–10e wymagana przez roadmapę 10a) |
| O-10a-4 | Zakładki `ean`/`ceny`/`dostepnosc` puste do czasu 10b–10e | zakres bloku, nie zmiana zachowania |

Nic z `docs/rebuild-backlog.md` nie dotyczy tego zakresu — sprawdzone, brak wpisu ✅ TAK
odnoszącego się do analityki.

---

## Plan implementacji

### Krok 1 — Backend: repo agregatów

**Nowy:** `rebuild/backend/src/repos/analityka.ts` — port `analytics_module.cjs`, zapytania
przez `db.all(sql\`…\`)` / `db.get(sql\`…\`)` (wzorzec `repos/suppliers.ts:47`).

- `listyFiltrow(db)` → 6× `SELECT DISTINCT <kol> AS value FROM products WHERE <kol> IS NOT NULL
  AND <kol> != '' ORDER BY <kol>` z limitami **dokładnie jak w oryginale** (`:98-107`):
  `dostawcy` bez limitu · `marki` 500 · `modele` 1000 · `rozmiary` 1000 · `indeksyNosnosci` 300 ·
  `indeksyPredkosci` 300. Zwraca gołe tablice `{value}[]`, **bez `_przyciete`**.
- `statusHistorii(db)` → `SELECT COUNT(*) AS snapshots, MIN(zarejestrowano_at) AS od,
  MAX(zarejestrowano_at) AS do FROM historia_cen`; odpowiedź
  `{hasHistory: snapshots > 0, snapshots: … || 0, od: … || null, do: … || null}` (`:93-96`).
- `kpi(db)` → cztery osobne odczyty scalone spreadem (`:325-331`): `produkty`
  (`COUNT WHERE status='aktywny'`), `dostawcy` (`COUNT(DISTINCT dostawca)` też tylko po
  aktywnych), `avgMarza` (`ROUND(AVG(marza_pct),2)`), `stagingPending`
  (`COUNT FROM staging_items WHERE zatwierdzono_data IS NULL`).
- `marze(db)` → trzy zapytania (`:292-297`), przepisane bez zmiany semantyki:
  `rows` — `GROUP BY dostawca, kategoria, marka`, `ORDER BY avgMarza ASC`, `LIMIT 1000`;
  `low` — `marza_pct < 5`, `ORDER BY marza_pct ASC`, `LIMIT 200`;
  `high` — `marza_pct > 80`, `ORDER BY marza_pct DESC`, `LIMIT 200`.
  Progi 5 i 80 są **na twardo w oryginale**, nie są parametrem — zostają stałymi nazwanymi.
- `zbudujSnapshotBiezacy(db)` → `INSERT INTO historia_cen (…14 kolumn…) SELECT … FROM products
  WHERE status='aktywny'` z jednym `now = new Date().toISOString()` dla całej partii; zwraca
  `{ok: true, inserted, at}` (`:81-91`). Nieidempotentność jest zachowaniem oryginału —
  udokumentowana w nagłówku funkcji, nie „naprawiana".

`safeGet`/`safeAll` oryginału łykają wyjątek i zwracają `null`/`[]` (np. gdy tabeli nie ma).
`historia_cen` istnieje w `rebuild/schema/001_schema.sql:231-237` od 3d-1, a `ensureSchema()`
oryginału tworzy identyczną tabelę — **migracji nie trzeba**. Zachowanie „pusta tabela →
`hasHistory:false`" odtwarzamy wprost, bez naśladowania `try/catch` na brak tabeli.

### Krok 2 — Backend: router + rejestracja

**Nowy:** `rebuild/backend/src/routes/analytics.ts` — `trasyAnalityki({ db })`, pięć tras
z `requireAuth`, komentarze z numerami linii oryginału (wzorzec `routes/markups.ts`).
**Zmiana:** `rebuild/backend/src/app.ts` — import + `app.use(trasyAnalityki({ db }))`
po `trasyHistorii`.

Commit: `19-FEATURE-analityka-fundament: backend — pięć tras analityki (filters/status/kpi/margins/bootstrap)`

### Krok 3 — Backend: testy

**Nowy:** `rebuild/backend/test/analityka.gate.test.ts` — wzorzec `narzuty.gate.test.ts`:
`sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture` dla czterech GET-ów, `bootstrap-current`
tylko przez kontrakt, plus test „wszystkie pięć tras bez tokenu → 401".
**Nowy:** `rebuild/backend/test/analityka.agregaty.test.ts` — semantyka, której fixtures nie
złapią: progi 5/80 dla `low`/`high` (fixture ma je puste), `ORDER BY avgMarza ASC`, pominięcie
produktów `status != 'aktywny'` we wszystkich czterech zapytaniach KPI, `stagingPending` liczy
tylko `zatwierdzono_data IS NULL`, `bootstrap-current` zwraca `inserted` równe liczbie aktywnych
produktów i **rośnie przy drugim wywołaniu** (charakteryzacja nieidempotentności).
**Zmiana:** `rebuild/backend/test/gate/dane.ts` — wariant seedu z wieloma
`dostawca`/`kategoria`/`marka`, żeby `margins.rows` miał >1 grupę.

Commit: `19-FEATURE-analityka-fundament: testy GATE i agregatów analityki`

### Krok 4 — Frontend: infrastruktura (zależności + prymitywy)

**Zmiana:** `rebuild/frontend/package.json` — `recharts@^3.10.1`, `@radix-ui/react-popover@^1.1`.
Świadomie **nie** dodajemy `cmdk`: wyszukiwarkę składamy z `Popover` + `Input` + listy, bo
`DropdownMenu` Radiksa przechwytuje klawisze na typeahead i psuje pole tekstowe w środku.

**Nowe:**
- `components/ui/popover.tsx` — cienki wrapper Radiksa w stylu pozostałych plików `ui/`.
- `components/ui/chart.tsx` — **własny**, minimalny wrapper Recharts (`ResponsiveContainer` +
  kontener z tokenami `--chart-1..5` + tooltip w stylu `popover`). Nie kopiujemy `chart.tsx`
  z shadcn: tamten celuje w Recharts 2.x, a my bierzemy 3.x — mniejsza powierzchnia, zero
  niezgodności wersji.
- `components/WyborZWyszukiwarka.tsx` — wyszukiwalny multi-select. Wydzielony do
  `components/` (nie `pages/analityka/`), bo `pages/katalog/WyborWielokrotny.tsx` rozwiązuje ten
  sam problem bez wyszukiwarki i przy 1000 pozycjach się nie nadaje; nowy komponent zachowuje
  jego API (`etykieta`, `opcje`, `wybrane`, `onZmiana`, `tekstPusty`, `formatujLicznik`, `testId`)
  i dokłada pole filtrujące. **Katalogu w tym tickecie nie ruszamy** — migracja `/katalog` na
  nowy komponent to follow-up, nie zakres 10a.

Commit: `19-FEATURE-analityka-fundament: prymitywy FE — popover, wykres, wyszukiwalny multi-select`

### Krok 5 — Frontend: strona `/analityka`

**Nowe** `rebuild/frontend/src/pages/analityka/`:
- `api.ts` — typy z fixtures (`Filtry`, `StatusHistorii`, `Kpi`, `WierszMarzy`, `Marze`) +
  hooki TanStack Query (`useFiltry`, `useStatus`, `useKpi`, `useMarze`).
- `FiltryGlobalne.tsx` — 6× `WyborZWyszukiwarka`, stan podniesiony do `Analityka.tsx`
  i podany zakładkom przez props (filtry są **wspólne dla wszystkich zakładek**).
- `filtrowanie.ts` — `zastosujFiltry(rows, wybor)`: czysta funkcja, testowalna bez DOM-u.
- `NaglowekKpi.tsx` — 4 kafle z `/kpi` + zachowany banner historii z oryginału
  (`zM+169`: „Historia cen: N snapshotów od …" / komunikat o pustej historii, tekst 1:1).
- `TabelaAnalityki.tsx` — port `I()` z oryginału (`zM+143`): kolumny `{key,label,right,mono,render}`,
  `.slice(0, 300)`, `bg-muted/50` w `thead`, komunikat „Brak danych" w pustej tabeli.
  Wspólna dla wszystkich zakładek 10b–10e.
- `formatowanie.ts` — port `_()` i `D()` z oryginału: `toLocaleString("pl-PL", {maximumFractionDigits: 2})`,
  `null`/`""` → `"—"`, procent jako `wartość + "%"`.
- `SekcjaMarze.tsx` — **wzorzec sekcji**: nagłówek karty „Marża per dostawca/kategoria/marka",
  wykres słupkowy poziomy (15 grup o najniższej średniej marży — porządek `avgMarza ASC` jest
  porządkiem oryginału), pod nim tabela z kolumnami 1:1 z oryginału: Dostawca (mono) · Kategoria ·
  Marka · Produkty (prawo) · Śr. marża (prawo) · Min (prawo) · Max (prawo).
- `README.md` — **wzorzec sekcji dashboardu dla 10b–10e** (patrz niżej).

**Nowy:** `rebuild/frontend/src/pages/Analityka.tsx` — `PageHeader` z tytułem „Analityka"
i podtytułem 1:1 z oryginału („Dostawcy, porównanie EAN, ceny w czasie, dostępność, marża
i rotacja"), nagłówek KPI, pasek filtrów, `Tabs` z pięcioma zakładkami.

**Zmiany:** `App.tsx` (trasa `/analityka` → `Analityka`), `pages/placeholdery.ts` (usunięcie
wpisu `/analityka`; `/` zostaje — Pulpit to 10f).

Commit: `19-FEATURE-analityka-fundament: widok /analityka — KPI, filtry globalne, sekcja marż`

### Krok 6 — Wykres wg `dataviz`

Forma dobrana wg `references/choosing-a-form.md`: zadanie to **magnitude across categories**
→ poziomy słupek, jedna seria. Jedna seria oznacza, że problem rozróżnialności kategorii
kolorem **w ogóle nie powstaje** — legenda niepotrzebna (tytuł nazywa serię), kolor jeden
(`--chart-1`), wartości jako bezpośrednie etykiety na końcach słupków.
Reguły z `marks-and-anatomy.md`: zaokrąglone końce 4px zakotwiczone w linii bazowej, 2px odstęp
tła między słupkami, recesywna siatka. Tooltip per słupek (`interaction.md`).
**Ulga wymagana przez WARN kontrastu** (`#d98e26` 2.61:1): tabela z tymi samymi liczbami stoi
bezpośrednio pod wykresem, a wartości są wypisane przy słupkach — to spełnia warunek
„visible labels or a table view". Wynik walidatora wklejony do `README.md` wzorca.

### Krok 7 — Testy frontendu

**Nowy:** `rebuild/frontend/test/analityka.test.tsx` (MSW, wzorzec z istniejących testów FE):
render `/analityka` na odpowiedziach z fixtures → 4 kafle KPI z poprawnymi liczbami, banner
historii, 6 kontrolek filtrów, tabela marż z kolumnami oryginału.
**Nowy:** `rebuild/frontend/test/analityka.filtrowanie.test.ts` — czysta jednostka dla
`zastosujFiltry` (pusty wybór = brak filtrowania; wielokrotny wybór = OR w obrębie wymiaru,
AND między wymiarami; limit 300 wierszy renderowanych).

Commit: `19-FEATURE-analityka-fundament: testy widoku analityki`

### Krok 8 — Dokumentacja wzorca

`pages/analityka/README.md` opisuje, jak 10b–10e mają dokładać zakładki:
1. hook w `api.ts` (`queryKey` = ścieżka + parametry, jak `queryClient.ts`),
2. sekcja jako `Sekcja<Nazwa>.tsx` przyjmująca `wybor: WyborFiltrow` w props,
3. filtrowanie przez `zastosujFiltry` (albo query param, jeśli **oryginalna** trasa go ma —
   `days`, `group`, `ean`/`kod`; wtedy do `queryKey`),
4. render przez `TabelaAnalityki` + opcjonalny wykres z `components/ui/chart.tsx`,
5. reguły koloru: ≤4 serie, kolejność `--chart-1,2,4` przed `3,5` (chroma), legenda przy ≥2
   seriach, zawsze tabela pod wykresem, nigdy dwie osie Y; wynik walidatora palety wklejony
   jako uzasadnienie.

Plik jest jednocześnie „raportem/README" wymaganym przez prompt; `raport.md` linkuje do niego,
a roadmapa dostaje wskaźnik w blokach 10b–10e.

---

## Strategia testów

**GATE odbudowy (obowiązkowy).**
- `sprawdzZgodnoscZFixture` dla `GET_analytics_filters.json`, `GET_analytics_status.json`,
  `GET_analytics_kpi.json`, `GET_analytics_margins.json` — kształt 1:1, klucz nadmiarowy
  albo brakujący = STOP.
- `sprawdzZgodnoscZKontraktem` dla wszystkich pięciu operacji (w tym `POST bootstrap-current`).
- Test 401 bez tokenu dla wszystkich pięciu.
- Fixture'ów **nie wolno poprawiać**. Jedyną furtką są `WyjatekGate` (opisane, samoczyszczące).
  Na dziś nie przewiduję żadnego — wszystkie cztery kształty są odtwarzalne wprost.

**Testy jednostkowe** (to, czego fixtures nie dowodzą): progi `low`/`high`, sortowania i limity,
filtr `status='aktywny'`, licznik `stagingPending`, nieidempotentność `bootstrap-current`,
`zastosujFiltry`.

**Testy widoku** (MSW): renderowanie KPI, bannera, filtrów i tabeli marż na danych z fixtures.

**Świadomie pomijamy:** E2E (brak harnessu E2E w projekcie; widok jest pokryty testem MSW),
oraz weryfikację `low`/`high` fixture'em (są puste — powód opisany w „Kontrakt i fixtures").

**Bramki:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/`
i `rebuild/frontend/`. Node 20 (`export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`).

---

## Poza zakresem

- Bloki 10b–10e: `prices/*`, `market/group-prices`, `top-zmiany`, wszystkie `ean/*`,
  `dostawcy-stats`, `suppliers/*`, `availability/*`, `rotation/inactive`, `lifecycle/models`,
  `seasonality/monthly`, `importy-timeline`. Zakładki dla nich są **puste, ale nazwane**.
- Blok 10f: `analytics/export/{view}` (przycisk „CSV" w oryginalnych kartach — **nie dodajemy go
  w 10a**, bo trasa eksportu należy do 10f) oraz Pulpit `/`.
- Ożywienie `currentWhere()` w backendzie (D2).
- Przycisk uruchamiający `bootstrap-current` (D4).
- Migracja `/katalog` na nowy wyszukiwalny multi-select (follow-up).
- Zmiana tokenów `--chart-*` (chronione testem-strażnikiem, pochodzą z oryginału).

---

## Definition of done

- [ ] `GET /api/analytics/filters` zwraca 6 list `{value}[]` z limitami oryginału, **bez `_przyciete`**
- [ ] `GET /api/analytics/status` zwraca `{hasHistory, snapshots, od, do}`
- [ ] `GET /api/analytics/kpi` zwraca `{produkty, dostawcy, avgMarza, stagingPending}`
- [ ] `GET /api/analytics/margins` zwraca `{rows, low, high}` z progami 5/80 i limitami 1000/200/200
- [ ] `POST /api/analytics/bootstrap-current` zwraca `{ok, inserted, at}` i seeduje `historia_cen`
- [ ] Wszystkie pięć tras za `requireAuth` → 401 bez tokenu
- [ ] GATE: cztery fixtures zgodne kształtem 1:1 + pięć operacji waliduje się wg `openapi.yaml`
- [ ] `/analityka` renderuje: banner historii, 4 kafle KPI, 6 wyszukiwalnych filtrów globalnych,
      5 zakładek z etykietami oryginału, wypełnioną sekcję „Marża per dostawca/kategoria/marka"
      (wykres + tabela ≤300 wierszy z kolumnami 1:1)
- [ ] Filtry globalne działają na sekcji marż (klient) i są wspólne dla zakładek
- [ ] `/analityka` zdjęte z `PLACEHOLDERY`, wpięte w `App.tsx`; sidebar bez zmian
- [ ] Wzorzec sekcji dashboardu udokumentowany w `pages/analityka/README.md` (pobranie danych,
      filtry, tabela, wykres, reguły koloru + wynik walidatora palety)
- [ ] `lint`, `typecheck`, `build`, `test` czyste po obu stronach
- [ ] Roadmapa: blok 10a oznaczony jako zrobiony (data + ID ticketa), odstępstwa O-10a-1..4
      zapisane, bloki 10b–10e wskazują na wzorzec
