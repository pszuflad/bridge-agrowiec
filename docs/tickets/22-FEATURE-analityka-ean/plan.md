# 22-FEATURE-analityka-ean — Iteracja 10, blok 10c: Analityka / EAN

> Status: Draft
> Branch: `feature/22-analityka-ean`
> Worktree: `.worktrees/22-FEATURE-analityka-ean`

## Opis ticketa

Iteracja 10, blok **10c (BE+FE)** wg `docs/rebuild-roadmap.md` §5 i `docs/analityka-bloki-10b-10f.md` §5.
Buduje na 10a (`19-FEATURE-analityka-fundament`), niezależny od 10b/10d/10e.

Wypełnia zakładkę `ean` („EAN i ceny") widoku `/analityka` i dowozi sześć tras
`/api/analytics/*` związanych z EAN-ami — agregaty 1:1 z `mirror/backend/analytics_module.cjs`,
kształt = `contract/fixtures/`.

## Kontekst

Zakładka `ean` jest dziś w `rebuild/frontend/src/pages/Analityka.tsx:97-102` zaślepką
`ZakladkaWPrzygotowaniu blok="10c"`. Blok 10a postawił cały szkielet: zakładki, globalny
pasek filtrów, nagłówek KPI, `TabelaAnalityki`, `KontenerWykresu` i wzorzec sekcji opisany
w `rebuild/frontend/src/pages/analityka/README.md`. Ten blok wstawia treść, nie przemebluje
widoku.

Backend: `rebuild/backend/src/routes/analytics.ts` + `rebuild/backend/src/repos/analityka.ts`
mają pięć tras z 10a. Dokładamy sześć kolejnych, trzymając układ pliku: jedna funkcja =
jedna trasa, SQL przepisany dosłownie, limity jako nazwane stałe.

Wszystkie sześć tras czyta wyłącznie tabelę `products` (`rebuild/schema/001_schema.sql:22-83`);
każda kolumna z SELECT-ów istnieje w nowym schemacie pod tą samą nazwą.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ścieżki `contract/openapi.yaml` (wszystkie `GET`, `security: [{bearerAuth},{cookieAuth}]`,
`responses: 200/400/401`, **bez schematów odpowiedzi**):

| # | Ścieżka | openapi | Fixture |
|---|---|---|---|
| 1 | `/api/analytics/ean/comparison` | `:133-141` | `GET_analytics_ean_comparison.json` |
| 2 | `/api/analytics/ean/coverage` | `:142-150` | `GET_analytics_ean_coverage.json` |
| 3 | `/api/analytics/ean/details` | `:151-159` | `GET_analytics_ean_details.json` |
| 4 | `/api/analytics/ean/supplier-rank` | `:160-168` | `GET_analytics_ean_supplier-rank.json` |
| 5 | `/api/analytics/ean/unique` | `:169-177` | `GET_analytics_ean_unique.json` |
| 6 | `/api/analytics/ean-porownanie` | `:124-132` | `GET_analytics_ean-porownanie.json` |

**Siła siatki — nazwana wprost.** `openapi.yaml` nie ma dla analityki żadnych schematów
odpowiedzi, więc część kontraktowa GATE dowodzi tylko: ścieżka istnieje, status zadeklarowany,
ciało jest JSON-em. Cały ciężar kształtu niosą fixtures. A te są dziurawe w trzech miejscach:

1. `GET_analytics_ean_details.json` ma `offers: []` — `test/gate/ksztalt.ts:50` nie zagląda
   do elementów pustej tablicy, więc **kształt oferty nie jest dowiedziony niczym**.
   → test jednostkowy (wzorzec: `margins.low`/`high` w `analityka.agregaty.test.ts`).
2. Fixture `ean/details` nagrał **wyłącznie gałąź bez `?ean`** (`{ean: null, offers: []}`).
   Gałąź z `?ean` nie ma fixture'a → test jednostkowy.
3. Fixture `ean-porownanie` nagrał **wyłącznie gałąź bez `?ean`** (agregat). Gałąź z `?ean`
   (goła tablica ofert) nie ma fixture'a → test jednostkowy.

**`_przyciete` / `_body_przyciete_z` NIE są polami API** (`contract/README.md:29` — adnotacja
nagrywarki). Odpowiedzi ich nie zwracają; harness i tak zgłosiłby klucz nadmiarowy jako różnicę.

### Rozjazdy spec ↔ oryginał ↔ fixtures (i jak je rozstrzygamy)

| Rozjazd | Rozstrzygnięcie |
|---|---|
| `docs/analityka-bloki-10b-10f.md` §3 i §5 podaje kształt `ean/details` jako `{ean, offers}` | **Niepełne.** Handler (`analytics_module.cjs:202-208`) dla podanego `?ean` zwraca `{ean, offers, mediana, srednia}`, a każda oferta dostaje `pozycjaCenowa`. Fixture nagrał gałąź pustą, więc różnicy nie widać. Wygrywa oryginał; dokument poprawiamy w Kroku 13. |
| Dokumentacja i prompt nie mówią, że `ean-porownanie` ma DWIE gałęzie SQL | **Ma.** `:335-338`: z `?ean` → goła tablica ofert; bez `?ean` → agregat 2-dostawcowy. Obie odtwarzamy. |
| Prompt ticketa: „żadna trasa EAN nie czyta `req.query`" | **Nieprawda.** `ean/comparison` czyta `minDiffPct`, `ean/details` i `ean-porownanie` czytają `ean`. Backend odtwarza parametry 1:1. „Filtrowanie klienckie" dotyczy wyłącznie globalnego paska sześciu filtrów z 10a (decyzja D2). |
| `docs/analityka-bloki-10b-10f.md` §5 nie odnotowuje, że `ean-porownanie` ma inny WHERE niż `ean/comparison` | `ean-porownanie` **nie ma** `cena_zakupu > 0`, ma LIMIT 200 zamiast 1000 i nie liczy `srednia`/`oferty`/`spread*`. To osobny SQL, nie alias. Dopisujemy do dokumentu. |

## Decisions

Runda Q&A z użytkownikiem, 2026-09-03. Wszystkie cztery rekomendacje przyjęte.

**D1 — Nagłówek KPI zostaje na `GET /api/analytics/kpi` (odstępstwo O-10a-1 utrzymane).**
Oryginał liczy dwa z czterech kafli z tras tego bloku („EAN wspólne" = `ean/comparison.rows.length`,
„Pozycje unikalne" = `ean/unique.rows.length`, `frontend-index.js:28002-28017`). Dane będą
dostępne, ale przepięcie ruszyłoby kartę zamkniętą w 10a i powiększyło diff/review.
Prompt wprost nazywa to osobną decyzją. → `NaglowekKpi.tsx` **bez zmian**; w roadmapie
odnotowujemy, że dane są gotowe i decyzja czeka.

**D2 — Dwa wykresy, oba w karcie „2.6" (odstępstwo O-10c-1).**
Oryginał nie ma ani jednego wykresu; 10a otworzyło tę furtkę (O-10a-3) i postawiło
infrastrukturę. Dokładamy:
- **pokrycie** — słupek pionowy: oś X = liczba dostawców, Y = liczba EAN, plus jedna liczba
  nagłówkowa „% EAN-ów u ≥2 dostawców" liczona z tych samych wierszy;
- **ranking dostawców** — słupek poziomy po `najtanszyPct`.

Karty „2.1-2.4" i „2.5" **bez wykresu**: to listy do przeglądania i wyszukiwania, nie
porównania wielkości (skill `dataviz`, forma z zadania). Obie tabele zostają pod wykresami —
to obowiązek, nie ozdoba (`README.md` §2.5 pkt 8: walidator zgłasza kontrast `--chart-1`
i `--chart-4` do tła poniżej 3:1, zdejmuje to widoczna etykieta albo widok tabelaryczny).

**D3 — `minDiffPct`: backend 1:1, front bez kontrolki.**
Parametr działa w API i jest pokryty testem jednostkowym, ale hook woła trasę bez query —
dokładnie jak produkcja (`d("/api/analytics/ean/comparison")`, `:27839`). Zero nowych odstępstw.

**D4 — Uczciwa notka o pominiętych wymiarach per karta.**
Wzorzec `README.md` §2.3 / `SekcjaMarze.tsx`. Każda karta deklaruje własne `WYMIARY_*`:
- `ean/comparison` → `[]` (SELECT nie ma żadnej z sześciu kolumn filtra — grupowanie po EAN je zwinęło),
- `ean/coverage` → `[]` (wiersz to `{liczbaDostawcow, liczbaEAN}`),
- `ean/unique` → `["dostawcy"]`,
- `ean/supplier-rank` → `["dostawcy"]`.

**D5 (bez pytania — precedens 10a) — przyciski „CSV" pominięte.**
Oryginał ma je w kartach „2.1-2.4" (`M("ean-comparison")`) i „2.5" (`M("unique")`), ale trasa
`GET /api/analytics/export/{view}` należy do bloku **10f**. 10a pominęło przycisk z tego samego
powodu (`SekcjaMarze.tsx`) — przycisk wiodący donikąd jest gorszy niż jego brak. 10f dokłada
wszystkie trzy naraz.

**D6 (bez pytania — zakres promptu) — `ean/details` i `ean-porownanie` jako trasy bez UI.**
Obie mają zero wywołań w produkcyjnym bundlu FE (`docs/analityka-bloki-10b-10f.md` §1.1,
potwierdzone grepem: `deminified/frontend-index.js` woła tylko `comparison`, `unique`,
`coverage`, `supplier-rank`). Dowozimy je jako trasy — tak jak 10a dowiozło
`POST /api/analytics/bootstrap-current` bez przycisku (decyzja D4 z 10a). Dorobienie im ekranu
byłoby budowaniem nowego, nie odbudową.

### Odstępstwa od oryginału w tym bloku — pełna lista

| # | Co | Dlaczego |
|---|---|---|
| O-10c-1 | Dwa wykresy w karcie „2.6" (pokrycie, ranking) + liczba „% EAN-ów u ≥2 dostawców" | D2; oryginał nie ma wykresów, infrastruktura z 10a stoi |
| O-10c-2 | Notka o wymiarach filtra, których karta nie stosuje | D4; oryginał nie ma globalnych filtrów (te są odstępstwem O-10a-2) |
| — | Stopka „Pokazano 300 z N" | dziedziczona z `TabelaAnalityki` (10a), nie nowa |
| — | Brak przycisków CSV | D5; zakres bloku 10f, nie zmiana zachowania |
| — | `ean/details`, `ean-porownanie` bez UI | D6; 1:1 z oryginałem (zero konsumentów) |

## Implementation plan

### Krok 1 — Backend: agregaty w `rebuild/backend/src/repos/analityka.ts`

Dokładamy na końcu pliku, w układzie 10a (jedna funkcja = jedna trasa, SQL dosłownie,
limity jako nazwane stałe, komentarz z numerem linii oryginału).

Stałe: `LIMIT_PORWNANIA_EAN = 1000` (`:198`), `LIMIT_UNIKALNYCH_EAN = 1000` (`:215`),
`LIMIT_PORWNANIA_EAN_LEGACY = 200` (`:338`).

1. `porownanieEan(db, minDiffPct)` → `{ rows: WierszPorownaniaEan[] }` (`:188-200`)
   - SQL 1:1: `GROUP BY ean HAVING COUNT(DISTINCT dostawca) >= 2`, `WHERE status='aktywny'
     AND ean IS NOT NULL AND ean != '' AND cena_zakupu > 0`, `ORDER BY (MAX-MIN) DESC LIMIT 1000`.
   - Po SQL, w TS (jak w oryginale): `spreadZl = zaokraglij(cenaMax - cenaMin)`,
     `spreadPct = cenaMin ? zaokraglij((cenaMax-cenaMin)/cenaMin*100) : null`,
     następnie `.filter(r => !minDiff || (r.spreadPct ?? 0) >= minDiff)`.
   - ⚠ `!minDiff` w oryginale jest falsy-testem: `0`, `NaN` i brak parametru wyłączają filtr.
     `num(v, 0)` → `Number(v)`, a gdy nie jest skończone → `0`. Odtwarzamy dokładnie
     (pomocnik `liczba(v, domyslna)` w tym pliku).
2. `szczegolyEan(db, ean)` → `{ean: null, offers: []}` gdy `ean` puste, inaczej
   `{ean, offers, mediana, srednia}` (`:202-208`).
   - `offers` sortowane `cena_zakupu ASC`, każda dostaje `pozycjaCenowa: i + 1`.
   - `mediana` — port `median()` (`:53`): sort rosnąco po `Number`, odrzucenie nieskończonych,
     przy parzystej długości średnia dwóch środkowych, przy pustej `null`.
   - `srednia` — `prices.length ? zaokraglij(sum/len) : null`.
3. `unikalneEan(db)` → `{ rows }` (`:210-217`) — `HAVING COUNT(DISTINCT dostawca)=1`,
   `ORDER BY nazwa LIMIT 1000`.
4. `pokrycieEan(db)` → `{ rows }` (`:219-222`) — podzapytanie + `GROUP BY dostawcy ORDER BY dostawcy`.
   Bez LIMIT-u.
5. `rankingDostawcowEan(db)` → `{ rows }` (`:224-235`) — CTE `ranked` z `RANK() OVER
   (PARTITION BY ean ORDER BY cena_zakupu ASC)`, `ORDER BY najtanszyPct DESC`. Bez LIMIT-u.
6. `porownanieEanLegacy(db, ean)` → **goła tablica** (`:335-338`), dwie gałęzie:
   - z `ean` → oferty (`dostawca, kod, nazwa, cenaZakupu, cenaSprzedazy, stan, marzaPct`),
     **bez** `pozycjaCenowa`;
   - bez `ean` → agregat: `ean, nazwa, dostawcy, cenaMin, cenaMax` — **bez** `cena_zakupu > 0`
     w WHERE, LIMIT 200.

Pomocnik `zaokraglij(v, p = 2)` — port `round()` (`:52`): `Math.round(n * 10^p) / 10^p`
na `liczba(v, 0)`. Jeśli 10a już go ma, reużywamy; jeśli nie — dokładamy raz, obok istniejących.

⚠ **`safeAll` połyka błędy SQL i zwraca `[]`** (`:49`). Nie dokładamy własnego `try/catch`
z 500 — SELECT-y na poprawnym schemacie nie rzucają, a dodanie 500 byłoby rozjazdem
z oryginałem. Odnotowujemy to komentarzem.

### Krok 2 — Backend: trasy w `rebuild/backend/src/routes/analytics.ts`

Sześć rejestracji, wszystkie `requireAuth`, w kolejności oryginału (`comparison`, `details`,
`unique`, `coverage`, `supplier-rank` — Part 2; `ean-porownanie` — Part 6).
Parametry query czytane w trasie i przekazywane jawnie do repo (repo nie zna Expressa).

### Krok 3 — Backend: testy

- `test/analityka.gate.test.ts` — dopisujemy sześć operacji do `OPERACJE` i sześć asercji
  `sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture`, plus 401 bez tokenu.
  Zasiew: `zasiejProdukty` musi dać EAN-y u ≥2 dostawców i EAN-y unikalne — sprawdzam,
  co robi obecny zasiew (`test/gate/dane.ts`); jeśli nie pokrywa, dokładam wiersze
  **w teście**, nie zmieniając wspólnego zasiewu innych bloków.
- `test/analityka.agregaty.test.ts` — testy jednostkowe tego, czego gate nie dowodzi:
  1. kształt oferty w `ean/details?ean=…` (4 klucze odpowiedzi, `pozycjaCenowa` rosnące,
     `mediana` przy parzystej i nieparzystej liczbie ofert, `srednia`),
  2. `ean/details` bez `ean` → dokładnie `{ean: null, offers: []}`, bez `mediana`/`srednia`,
  3. `ean-porownanie?ean=…` → goła tablica ofert bez `pozycjaCenowa`,
  4. `ean-porownanie` bez `ean` → agregat, i **dowód różnicy** vs `ean/comparison`:
     produkt z `cena_zakupu = 0` wpada do `ean-porownanie`, a wypada z `ean/comparison`,
  5. `minDiffPct` — próg odcina wiersze; `minDiffPct=0` i wartość nieliczbowa filtru nie włączają,
  6. `spreadPct = null` przy `cenaMin = 0` (gałąź `cenaMin ? … : null`) — osiągalna tylko
     w `ean-porownanie`? nie: `ean/comparison` ma `cena_zakupu > 0`, więc `cenaMin > 0` zawsze.
     Test dokumentuje, że gałąź jest w oryginale martwa, i pilnuje, że jej nie usunęliśmy.

### Krok 4 — Frontend: typy i hooki (`pages/analityka/api.ts`)

Cztery typy + cztery hooki (tylko trasy, które oryginalny front realnie woła):
`WierszPorownaniaEan`, `WierszUnikalnegoEan`, `WierszPokryciaEan`, `WierszRankinguEan`;
`usePorownanieEan`, `useUnikalneEan`, `usePokrycieEan`, `useRankingDostawcowEan`.
Klucz zapytania = ścieżka, bez query (D3). Typy z `| null` (`on401: "returnNull"`).

`ean/details` i `ean-porownanie` **nie dostają hooków** — nie ma konsumenta (D6).

### Krok 5 — Frontend: filtry (`pages/analityka/filtrowanie.ts`)

`WYMIARY_EAN_PORWNANIE: WymiarFiltra[] = []`, `WYMIARY_EAN_POKRYCIE = []`,
`WYMIARY_EAN_UNIKALNE = ["dostawcy"]`, `WYMIARY_EAN_RANKING = ["dostawcy"]`
+ `zastosujFiltryUnikalnychEan`, `zastosujFiltryRankinguEan` (OR w wymiarze, AND między —
ta sama semantyka co `zastosujFiltryMarz`).

### Krok 6 — Frontend: sekcja (`pages/analityka/SekcjaEan.tsx`)

Trzy karty 1:1 z `deminified/frontend-index.js:28175-28294`:

1. **„2.1-2.4 Porównanie cen po EAN"** — `TabelaAnalityki`, kolumny:
   EAN (`mono`) · Nazwa · Dostawcy (`right`) · Min (`right`) · Max (`right`) ·
   Spread zł (`right`) · Spread % (`right`).
2. **„2.5 Pozycje unikalne"** — kolumny: EAN (`mono`) · Nazwa · Dostawca (`mono`) ·
   Cena (`right`) · Stan (`right`).
3. **„2.6 Pokrycie wspólne i ranking dostawcy"** — JEDNA karta, DWIE tabele w
   `grid md:grid-cols-2 gap-4 p-4` (nowy wzorzec strukturalny — w 10a go nie było):
   - lewa: Liczba dostawców (`right`) · EAN (`right`),
   - prawa: Dostawca (`mono`) · Wspólne (`right`) · Najtańszy (`right`) · Najtańszy % (`right`).
   Nad tabelami wykresy z D2, każdy w `KontenerWykresu`, każdy nad SWOJĄ tabelą.

Notki o pominiętych wymiarach i licznik odfiltrowanych — wzorzec `SekcjaMarze.tsx`.

### Krok 7 — Frontend: wpięcie (`pages/Analityka.tsx`)

`TabsContent value="ean"` → `<SekcjaEan …/>` zamiast `ZakladkaWPrzygotowaniu blok="10c"`.
Hooki wołane w `Analityka.tsx` i przekazywane w dół — jak `useMarze`/`SekcjaMarze`.

### Krok 8 — Frontend: testy

- `test/msw/kontrakt.ts` — cztery loadery (`porownanieEanZFixtura` itd.) przez istniejące
  `analitykaZFixtura` (wszystkie cztery mają body-obiekt, więc loader wystarcza).
  ⚠ Loader **musi** zdejmować `_przyciete`.
- `test/analityka.test.tsx` — rozszerzenie: przełączenie na zakładkę „EAN i ceny", render
  trzech kart, sprawdzenie nagłówków i wierszy z fixtures.
- `test/analityka.filtrowanie.test.ts` — testy jednostkowe `zastosujFiltryUnikalnychEan`
  i `zastosujFiltryRankinguEan` + `wymiaryNieobslugiwane` dla `[]`.

## Testing strategy

**GATE odbudowy (obowiązkowy).** Dla każdej z sześciu ścieżek z sekcji „Kontrakt i fixtures":
`sprawdzZgodnoscZKontraktem` (ścieżka/metoda/status/JSON wg `contract/openapi.yaml`)
+ `sprawdzZgodnoscZFixture` (kształt 1:1 z nagraniem produkcji) + 401 bez tokenu.
Rozbieżność = STOP, nie poprawiamy fixture'a.

**Czego GATE nie dowiedzie i co to nadrabia** (trzy dziury opisane wyżej) — testy jednostkowe
z Kroku 3, pkt 1-6. To jest ta sama sytuacja co `margins.low`/`high` w 10a.

**Frontend** — testy widoku na MSW z fixtures (kształt, którego realnie oddaje produkcja)
+ testy jednostkowe czystych funkcji filtrowania, bez DOM-u.

**Czego nie testujemy:** wyglądu wykresów (Recharts renderuje SVG w jsdom niekompletnie —
10a przyjęło tę samą granicę); zamiast tego testujemy dane wejściowe wykresu przez tabelę
pod nim, która niesie te same liczby.

Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/`
i `rebuild/frontend/`.

## Out of scope

- Przepięcie nagłówka KPI na oryginalne kafle (D1 — osobna decyzja użytkownika).
- Przyciski „CSV" i `GET /api/analytics/export/{view}` — blok **10f** (D5).
- UI dla `ean/details` i `ean-porownanie` — oryginał go nie ma (D6).
- Kontrolka `minDiffPct` w UI (D3).
- Pozostałe 16 tras analityki — bloki 10b, 10d, 10e, 10f.
- Ożywianie `currentWhere()` (`analytics_module.cjs:60-74`) — martwy kod, zakaz z 10a.

## Definition of done

- [ ] Sześć tras `/api/analytics/ean*` zarejestrowanych z `requireAuth`, agregaty 1:1 z oryginałem
- [ ] GATE: sześć ścieżek zgodnych z `contract/fixtures/` i `contract/openapi.yaml`, 401 bez tokenu
- [ ] Żadna odpowiedź nie zawiera `_przyciete` ani `_body_przyciete_z`
- [ ] Testy jednostkowe pokrywają to, czego gate nie dowodzi: obie gałęzie `ean/details`,
      obie gałęzie `ean-porownanie`, `minDiffPct`, różnica WHERE między `comparison` a `ean-porownanie`
- [ ] Zakładka `ean` renderuje trzy karty 1:1 z oryginałem (tytuły, kolumny, wyrównanie, `mono`)
- [ ] Dwa wykresy w karcie „2.6", każdy nad swoją tabelą, wg reguł `README.md` §2.5
- [ ] Notki o pominiętych wymiarach filtra per karta
- [ ] `docs/analityka-bloki-10b-10f.md` poprawiony: kształt `ean/details`, dwie gałęzie `ean-porownanie`
- [ ] `docs/rebuild-roadmap.md`: blok 10c zamknięty (data + ID ticketa), nota o gotowych danych
      dla ewentualnego przepięcia nagłówka KPI
- [ ] `npm run lint`, `typecheck`, `build`, `test` czyste w `rebuild/backend/` i `rebuild/frontend/`
