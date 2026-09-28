# 23-FEATURE-analityka-dostawcy — Iteracja 10, blok 10d (Analityka: dostawcy)

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/23-analityka-dostawcy`
> Worktree: `.worktrees/23-FEATURE-analityka-dostawcy`

## Opis ticketa

> Iteracja 10d — Analityka: dostawcy (wierna odbudowa Bridge)
>
> Realizuj Iterację 10, blok 10d (BE+FE) wg roadmapy (§5, blok 10d; §3). Buduje na 10a.
> Niezależny od 10b/10c/10e → równolegle.
>
> ⭐ NAJPIERW: `docs/analityka-bloki-10b-10f.md` §6 + `pages/analityka/README.md`. Załaduj `dataviz`.
>
> ZAKRES — wypełnia zakładkę `dostawcy` (domyślna zakładka `/analityka`; requireAuth), agregaty
> 1:1 z `analytics_module.cjs`, kształt = fixtures:
> `suppliers/lifecycle` · `suppliers/stability` · `suppliers/stock` · `dostawcy-stats`
> (FE NIE woła — §1.1; odtwórz backend pod GATE, FE wg ściągi)
>
> REUŻYJ / DECYZJE ZAKLEPANE / PUŁAPKI / ŹRÓDŁA: jak w 10b (filtrowanie klienckie — trasy
> dostawców nie czytają `req.query`; paleta zamrożona; `_przyciete` nie zwracać; puste fixtures →
> test jednostkowy; grep w deminified; openapi bez kształtów; wzorzec z README).
>
> GATE: 4 trasy zgodne z fixtures + openapi; testy kształtu; dashboardy na snapshocie;
> lint/typecheck/build czyste.
> DoD: zakładka `dostawcy` wg wzorca 10a; fixtures przez GATE; po merge auto-deploy.

## Kontekst

Blok 10a (`19-FEATURE-analityka-fundament`) postawił szkielet `/analityka`: pięć zakładek
z oryginału, nagłówek KPI, globalny pasek sześciu filtrów, `TabelaAnalityki` (port `I()`),
`formatowanie.ts` (port `_()`/`D()`), infrastrukturę wykresów (`components/ui/chart.tsx`)
i wzorzec sekcji (`pages/analityka/README.md`, `SekcjaMarze.tsx`). Zakładka `dostawcy` — **domyślna
zakładka całego widoku** (`fe.js:27805`, `useState("dostawcy")`) — trzyma dziś
`ZakladkaWPrzygotowaniu blok="10d"` (`Analityka.tsx:90-95`). Ten ticket ją wypełnia.

Backend: cztery handlery `mirror/backend/analytics_module.cjs:110`, `:133`, `:143`, `:332`.
Frontend oryginału: `deminified/frontend-index.js:28050-28174` (trzy karty) + pomocnik paska
postępu `O(e)` (`:27919-27936`).

**Fakty zweryfikowane przed planem (nie z opisu, z kodu):**
- **Żadna z 4 tras nie czyta `req.query`** → filtrowanie w UI jest klienckie (`useMemo`),
  parametrów w `queryKey` nie ma. Martwej `currentWhere()` (`:60-74`) nie ożywiamy (decyzja D2 z 10a).
- **`grep -o "analytics/dostawcy-stats" mirror/frontend/assets/*.js deminified/frontend-index.js`
  → 0 trafień**; pozostałe trzy trasy po 3 trafienia. `dostawcy-stats` nie ma konsumenta w oryginale.
- Schemat ma wszystkie kolumny czterech SQL-i, łącznie z `staging_items.powod` (`001_schema.sql:99`)
  i `staging_items.utworzono` (`:107`). Brak rozjazdu nazw.
- SQLite 3.47.2 (`better-sqlite3@11.7.0`) — funkcje okna (`LAG() OVER`) wspierane (wymóg ≥ 3.25).
- `docs/rebuild-backlog.md` nie ma wpisu dotykającego analityki dostawców, `historia_cen`
  ani widoku `/analityka` — nic do naniesienia.

**Kolizja nazw, o której ostrzega ściąga §6:** `/api/dostawcy` (Konfiguracja → Dostawcy,
`repos/suppliers.ts`, blok 3f-2) to **inny zasób** niż `/api/analytics/dostawcy-stats`. Tamten liczy
przeliczony `status` dostawcy i znaczniki zmian; ten — surowe agregaty katalogu. Nic nie reużywamy,
bo to inne agregaty; odnotowane w komentarzu repo, żeby przyszła sesja nie scaliła ich przez pomyłkę.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ścieżki `contract/openapi.yaml`** (wszystkie `GET`, wszystkie `security: [{bearerAuth}, {cookieAuth}]`,
`responses: {200, 400, 401}` — **bez schematów odpowiedzi**):

| Operacja | openapi.yaml | Fixture |
|---|---|---|
| `GET /api/analytics/suppliers/stability` | `:306-314` | `GET_analytics_suppliers_stability.json` |
| `GET /api/analytics/suppliers/lifecycle` | `:297-305` | `GET_analytics_suppliers_lifecycle.json` |
| `GET /api/analytics/suppliers/stock`     | `:315-323` | `GET_analytics_suppliers_stock.json` |
| `GET /api/analytics/dostawcy-stats`      | `:115-125` | `GET_analytics_dostawcy-stats.json` |

**Siła siatki, nazwana wprost.** Kontrakt dowodzi tu wyłącznie, że ścieżka istnieje, status jest
zadeklarowany i ciało jest JSON-em. **Cały ciężar kształtu niosą fixtures.** Trzy kształty koperty,
zgodnie ze ściągą §3 — nie zakładamy jednego:
- `{ hasHistory, rows }` → `suppliers/stability`
- `{ rows }` → `suppliers/lifecycle`, `suppliers/stock`
- **goła tablica** → `dostawcy-stats`

**Czego odpowiedź mieć NIE MOŻE:** klucza `_przyciete`. To adnotacja nagrywarki
(`contract/README.md:29`), nie pole API; harness zgłasza klucz nadmiarowy w odpowiedzi jako różnicę.

**Czego fixtures NIE dowodzą (→ testy jednostkowe, ściąga §2):**
- `suppliers/stability` ma w fixture `hasHistory: true`, więc **gałąź zapasowa (`hasHistory: false`,
  inny zestaw kolumn) nie jest pokryta niczym** — osobny test jednostkowy na pustej `historia_cen`.
- Żadna z czterech tablic fixtures nie jest pusta, więc kształt wiersza jest dowiedziony dla
  gałęzi „z historią" i dla trzech pozostałych tras.

**`requireAuth` NIE jest odstępstwem D1** (ściąga §1.3): kontrakt wymaga `security` dla wszystkich
tras analityki, a oryginał podaje `requireAuth` w każdej rejestracji. Nie odnotowujemy jako różnicy.

**Znany rozjazd wewnątrz samego oryginału (nie spec↔kod).** Karta „1.1 Stabilność cennika dostawcy"
renderuje **7 kolumn**, a żadna z dwóch gałęzi backendu nie zwraca ich wszystkich:

| Kolumna UI | gałąź `hasHistory: true` | gałąź `hasHistory: false` |
|---|---|---|
| `dostawca` | ✓ | ✓ |
| `produkty` | ✗ → „—" | ✓ |
| `punkty` | ✓ | ✗ → „—" |
| `liczbaZmian` | ✓ | `NULL` → „—" |
| `sredniaZmianaPct` | ✓ | `NULL` → „—" |
| `maxZmianaPct` | ✓ | `NULL` → „—" |
| `sredniStan` | ✗ → „—" | ✓ |

Do tego gałąź zapasowa zwraca `sredniaCena`, dla której **w UI nie ma kolumny** (ciche zignorowanie).
To zastane zachowanie produkcji, nie błąd portu — odtwarzamy je i opisujemy w kodzie, żeby przyszła
sesja nie uznała za bug do naprawienia.

## Decisions

**Z rundy Q&A z użytkownikiem (2026-09-03):**

- **D1 — karta „1.1": odtwarzamy 1:1, same „—".** Zawsze te same 7 kolumn w kolejności oryginału;
  pola, których dana gałąź nie zwraca, pokazują „—", **bez żadnej adnotacji**. Rozważane: notka
  wyjaśniająca (czytelniej dla Ani, ale nazwane odstępstwo — oryginał milczy) oraz kolumny zależne
  od gałęzi (najczytelniej, ale nagłówek tabeli zmieniałby się ze stanem bazy). Wybrano czystą
  odbudowę: banner o zasięgu historii cen z 10a stoi już na górze strony i tłumaczy pustki.
- **D2 — jeden wykres, w karcie „1.4 / 1.5 Stan i dostępność dostawcy".** Poziomy słupek
  `dostepnoscPct` per dostawca **nad** tabelą z tymi samymi liczbami. Rozważane: drugi wykres
  w karcie „1.1" (`sredniaZmianaPct`) — odrzucony, bo znikałby przy `hasHistory: false`, dokładając
  drugi stan karty do przetestowania; oraz zero wykresów — odrzucone, bo domyślna zakładka całego
  widoku zostałaby bez wizualizacji przy gotowej infrastrukturze.

**Zaklepane treścią ticketa (nie wymagały pytania):**

- **D3 — `dostawcy-stats` bez konsumenta FE.** Ticket rozstrzyga wprost: „FE NIE woła — odtwórz
  backend pod GATE". Trasa powstaje w backendzie, wchodzi do GATE, nie dostaje ani hooka, ani karty.
  Ten sam wzorzec, co `POST bootstrap-current` w 10a (decyzja D4).
- **D4 — pasek dostępności od razu jako wspólny komponent.** Ściąga §6 mówi wprost: „kto pisze ją
  pierwszy, wydziela ją do wspólnego komponentu obok `TabelaAnalityki` — drugi blok ma ją zastać
  gotową". 10d jest pierwszy, więc wydziela; 10e (karta „4.1") zastanie gotowe.
- **D5 — bez przycisków „CSV".** Oryginał ma je we wszystkich trzech kartach
  (`M("suppliers-stability")`, `M("suppliers-lifecycle")`, `M("suppliers-stock")`), ale trasa
  `GET /api/analytics/export/{view}` należy do bloku 10f i jeszcze nie istnieje. Przycisk wiodący
  donikąd byłby gorszy niż jego brak — dokładnie tak samo postąpiło 10a w sekcji marż.

**Świadome odstępstwa od oryginału (rejestr):**

| # | Co | Dlaczego |
|---|---|---|
| O-10d-1 | Wykres słupkowy dostępności w karcie „1.4 / 1.5" | oryginał nie ma ani jednego wykresu; kontynuacja O-10a-3, infrastruktura stoi od 10a (decyzja D2) |
| O-10d-2 | Filtrowanie klienckie sekcji + notka o wymiarach nieobsługiwanych | wzorzec 10a (README §2.3); wiersze tych tras niosą wyłącznie wymiar `dostawca`, więc pięć pozostałych filtrów nie ma jak zadziałać |
| O-10d-3 | Stopka „Pokazano 300 z N" w tabelach | zachowanie `TabelaAnalityki` z 10a — jedyne odstępstwo od `slice(0,300)` oryginału, dziedziczone, nie nowe |
| — | brak przycisków „CSV" (D5) | zakres bloku 10f, nie zmiana zachowania |
| — | `dostawcy-stats` bez UI (D3) | trasa bez konsumenta w oryginale |

## Implementation plan

### Krok 1 — Backend: agregaty w `rebuild/backend/src/repos/analityka.ts`

Dopisujemy **cztery funkcje** w układzie pliku z 10a (jedna funkcja = jedna trasa, SQL przepisany
dosłownie, limity jako nazwane stałe). Typy wprost z fixtures.

- `stabilnoscDostawcow(db): StabilnoscDostawcow` — port `:110-131`.
  Dwie gałęzie zależne od `czyJestHistoria(db)` (port `hasHistory(db)`, `:58` — `COUNT(*) > 0`
  na `historia_cen`):
  - z historią: CTE `seq` z `LAG(cena_zakupu) OVER (PARTITION BY dostawca, kod ORDER BY
    zarejestrowano_at)` nad `historia_cen WHERE cena_zakupu IS NOT NULL`, potem
    `GROUP BY dostawca ORDER BY sredniaZmianaPct DESC`; próg zmiany `ABS(...) > 0.01`;
  - bez historii: `products WHERE status='aktywny' GROUP BY dostawca ORDER BY produkty DESC`,
    z `NULL AS liczbaZmian/sredniaZmianaPct/maxZmianaPct`.
  Typ zwracany: unia dwóch kształtów wiersza (`WierszStabilnosciZHistoria | WierszStabilnosciBezHistorii`),
  bo to realnie dwa różne wiersze — komentarz nazywa quirk wprost.
- `cyklZyciaDostawcow(db): { rows: WierszCykluZycia[] }` — port `:133-141`.
  `staging_items WHERE typ_zmiany IN ('nowa','wycofana') ORDER BY utworzono DESC LIMIT 500`;
  aliasy `typ_zmiany AS typ`, `utworzono AS kiedy`.
- `stanDostawcow(db): { rows: WierszStanuDostawcy[] }` — port `:143-154`.
  `products WHERE status='aktywny' GROUP BY dostawca ORDER BY dostepnoscPct DESC, produkty DESC`.
- `statystykiDostawcow(db): WierszStatystykDostawcy[]` — port `:332`. **Goła tablica**, bez koperty.

Stałe: `LIMIT_CYKLU_ZYCIA = 500`, `PROG_ZMIANY_CENY = 0.01`, `TYPY_CYKLU_ZYCIA = ['nowa','wycofana']`.

### Krok 2 — Backend: trasy w `rebuild/backend/src/routes/analytics.ts`

Cztery `router.get(..., requireAuth, (_req, res) => res.json(fn(db)))` — bez `req.query`, bo żaden
handler oryginału go nie czyta. Kolejność rejestracji jak w oryginale (część 1 „supplier analysis"
przed resztą; `dostawcy-stats` w sekcji aliasów na końcu). Komentarz przy `dostawcy-stats` nazywa
brak konsumenta w FE (0 trafień w bundlu) i decyzję D3.

### Krok 3 — Backend: testy

- `rebuild/backend/test/analityka.dostawcy.gate.test.ts` — **GATE bloku 10d**: cztery operacje
  × (`sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture`) + bramka 401 bez tokenu.
  Zasiew: `zasiejProdukty`, `zasiejStagingZFixtures`, `zasiejHistorieCen` (harness `test/gate/`).
- `rebuild/backend/test/analityka.dostawcy.agregaty.test.ts` — testy jednostkowe tego, czego GATE
  nie dowodzi:
  - **gałąź `hasHistory: false`** w `stabilnoscDostawcow` (pusta `historia_cen`): `hasHistory`
    jest `false`, wiersz ma `produkty`/`sredniaCena`/`sredniStan` i trzy `null`-e, `punkty` nie ma;
  - gałąź z historią: `LAG` liczy `liczbaZmian` tylko dla różnic > 0,01; sortowanie `sredniaZmianaPct DESC`;
  - `cyklZyciaDostawcow`: filtr `typ_zmiany`, sortowanie `utworzono DESC`, limit 500;
  - `stanDostawcow`: `dostepnoscPct` = 100·dostępne/produkty, zaokrąglenie do 2, sortowanie;
  - `statystykiDostawcow`: goła tablica, `status='aktywny'`, sortowanie `liczbaProduktow DESC`;
  - **żadna odpowiedź nie zawiera klucza `_przyciete`.**

### Krok 4 — Frontend: typy i hooki w `pages/analityka/api.ts`

Trzy typy + trzy hooki (`useStabilnoscDostawcow`, `useCyklZyciaDostawcow`, `useStanDostawcow`),
klucz = ścieżka, `| null` z powodu `on401: "returnNull"`. `dostawcy-stats` **nie dostaje hooka** (D3).

### Krok 5 — Frontend: wspólny `PasekDostepnosci.tsx` (D4)

Port `O(e)` (`fe.js:27919-27936`) 1:1: `flex items-center gap-2` → `h-2 w-24 bg-muted rounded
overflow-hidden` → `h-full bg-primary` o `width: n%` (n zaciśnięte do `[0,100]`) → `span
font-mono text-xs` z `formatujProcent(e)`. Komentarz mówi, że drugim konsumentem jest karta „4.1"
bloku 10e.

### Krok 6 — Frontend: trzy sekcje wg wzorca `SekcjaMarze.tsx`

- `SekcjaStabilnoscDostawcow.tsx` — „1.1 Stabilność cennika dostawcy", 7 kolumn 1:1 (D1).
- `SekcjaCyklZyciaDostawcow.tsx` — „1.2 Nowości i wycofania", 6 kolumn (Data · Dostawca · Typ ·
  Kod · Nazwa · Powód; pierwsze cztery `mono`).
- `SekcjaStanDostawcow.tsx` — „1.4 / 1.5 Stan i dostępność dostawcy", 5 kolumn, ostatnia przez
  `PasekDostepnosci`; **wykres nad tabelą** (O-10d-1).

Każda: filtr kliencki po `dostawcy` + notka o wymiarach nieobsługiwanych
(`wymiaryNieobslugiwane`, `ETYKIETY_WYMIAROW` z `filtrowanie.ts`); w `filtrowanie.ts` dochodzi
`WYMIARY_DOSTAWCOW: WymiarFiltra[] = ["dostawcy"]` i `zastosujFiltryDostawcow`.

**Wykres (reguły `dataviz` + `components/ui/chart.tsx`):** forma — porównanie wielkości w wielu
kategoriach → słupek **poziomy**; **jedna seria → bez legendy** (tytuł nazywa, co rysujemy);
kolor `KOLOR_SERII` (slot 1, paleta zamrożona, `test/tokeny.test.ts`); **jedna oś**; wartości
etykietami przy końcach słupków (`LabelList position="right"`); **tabela pod wykresem obowiązkowa**
— to ona zdejmuje ostrzeżenie walidatora o kontraście `--chart-1` (2.61 < 3:1); tooltip na hover;
`isAnimationActive={false}` jak w 10a.

### Krok 7 — Frontend: montaż w `pages/Analityka.tsx`

`ZakladkaWPrzygotowaniu blok="10d"` → trzy sekcje w `<div className="space-y-4">`, w kolejności
oryginału (1.1 → 1.2 → 1.4/1.5). Zakładka i jej etykieta już są — nie ruszamy.

### Krok 8 — Frontend: testy

- `test/msw/kontrakt.ts` — loadery czterech fixtures 10d (zdejmujące klucze na `_`).
- `test/analityka.dostawcy.test.tsx` — render zakładki `dostawcy` na fixtures: tytuły trzech kart,
  komplet kolumn, pasek dostępności rysuje szerokość z `dostepnoscPct`, wykres obecny, filtr
  kliencki zawęża tabelę, notka o wymiarach nieobsługiwanych.
- `test/analityka.filtrowanie.test.ts` (istniejący) — dopisać przypadki `zastosujFiltryDostawcow`.

### Krok 9 — Bramki

`npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/`
i `rebuild/frontend/` (Node 20: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`).

## Testing strategy

- **GATE odbudowy (obowiązkowy)** — cztery ścieżki z sekcji „Kontrakt i fixtures (zakres)":
  odpowiedź nowego backendu porównana z fixture'em przez `sprawdzZgodnoscZFixture` (kształt 1:1,
  klucze/typy/zagnieżdżenie) i z `openapi.yaml` przez `sprawdzZgodnoscZKontraktem`.
  **Rozbieżność = STOP** — nie poprawiamy fixture'a, tylko zgłaszamy rozjazd.
- **Testy jednostkowe backendu** tam, gdzie fixture nie sięga: gałąź `hasHistory: false`
  w `suppliers/stability` (fixture ma `true`), progi i sortowania czterech agregatów, brak
  `_przyciete` w odpowiedziach.
- **Testy widoku (MSW)** na fixtures przez loader `test/msw/kontrakt.ts` — dashboardy renderują się
  na snapshocie produkcji, nie na danych wymyślonych.
- **Testy jednostkowe filtrowania** — czysta funkcja, bez DOM-u.
- **Pomijamy E2E** — zakładka jest odczytem bez mutacji; testy widoku + GATE dają pełne pokrycie
  ścieżki dane → HTTP → render.

## Out of scope

- `GET /api/analytics/export/{view}` i przyciski „CSV" w trzech kartach — blok 10f (D5).
- Pozostałe 18 tras analityki — bloki 10b (ceny), 10c (EAN), 10e (dostępność/rotacja/cykl).
- Pulpit `/` — blok 10f.
- Jakikolwiek UI dla `dostawcy-stats` (D3).
- `repos/suppliers.ts` i `/api/dostawcy` — inny zasób, nie ruszamy.
- Ożywianie `currentWhere()` / filtrowanie serwerowe — martwy kod oryginału (decyzja D2 z 10a).

## Definition of done

- [ ] Cztery trasy `GET /api/analytics/{suppliers/stability, suppliers/lifecycle, suppliers/stock,
      dostawcy-stats}` odpowiadają kształtem 1:1 z odpowiadającymi fixtures i walidują się
      względem `contract/openapi.yaml`; wszystkie za `requireAuth` (401 bez tokenu).
- [ ] Odpowiedzi **nie zawierają** klucza `_przyciete`.
- [ ] Gałąź `hasHistory: false` w `suppliers/stability` pokryta testem jednostkowym.
- [ ] Zakładka `dostawcy` renderuje trzy karty w kolejności oryginału, z dosłownymi tytułami
      („1.1 Stabilność cennika dostawcy", „1.2 Nowości i wycofania",
      „1.4 / 1.5 Stan i dostępność dostawcy") i kompletem kolumn 1:1.
- [ ] Kolumna „Dostępność" renderuje pasek postępu (port `O(e)`), wydzielony jako wspólny
      komponent do reużycia przez 10e.
- [ ] Wykres dostępności nad tabelą w karcie „1.4 / 1.5", zgodny z regułami `components/ui/chart.tsx`
      (jedna seria bez legendy, jedna oś, paleta niezmieniona, tabela pod wykresem).
- [ ] Filtr globalny `dostawcy` zawęża wszystkie trzy tabele; wymiary nieobsługiwane są wypisane w notce.
- [ ] `ZakladkaWPrzygotowaniu blok="10d"` usunięte z `Analityka.tsx`.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` czyste w `rebuild/backend/`
      i `rebuild/frontend/`.
- [ ] `docs/rebuild-roadmap.md` §5 opisuje blok 10d jako STAN (data + ID ticketa, zakres faktyczny),
      a nie zamiar; ustalenia dla 10e (gotowy `PasekDostepnosci`) wpisane **do bloku 10e**.
