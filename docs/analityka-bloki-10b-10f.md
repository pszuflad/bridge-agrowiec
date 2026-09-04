# Analityka — ściąga wykonawcza dla bloków 10b–10f

**Do czego to jest.** `docs/rebuild-roadmap.md` §5 mówi, KTÓRY blok bierze które trasy.
Ten plik mówi, CO te trasy realnie robią i co realnie pokazuje oryginał — czyli to, czego
sesja 10a musiała się dowiedzieć sama i co kosztowało ją osobną rundę pytań do użytkownika.
Każdy fakt niżej jest **zweryfikowany w kodzie** (`mirror/backend/analytics_module.cjs`,
`deminified/frontend-index.js`, `contract/fixtures/`), nie przepisany z opisu iteracji.

**Zakres:** 27 tras `/api/analytics/*`. Zamknięte **dwadzieścia sześć**: blok 10a — pięć
(`filters`, `status`, `kpi`, `margins`, `bootstrap-current` — ticket
`19-FEATURE-analityka-fundament`); blok 10c — sześć tras EAN (§5, ticket
`22-FEATURE-analityka-ean`); blok 10d — cztery trasy dostawców (`suppliers/stability`,
`suppliers/lifecycle`, `suppliers/stock`, `dostawcy-stats` — §6, ticket
`23-FEATURE-analityka-dostawcy`) — te trzy zamknięte 2026-09-03; blok 10b — pięć tras cen
(`prices/inflation`, `prices/last-import`, `prices/product-history`, `market/group-prices`,
`top-zmiany` — §4, ticket `24-FEATURE-analityka-ceny`); blok 10e — sześć tras dostępności,
rotacji i cyklu życia (§7, ticket `25-FEATURE-analityka-dostepnosc-rotacja`) — te dwa
2026-09-04. Ten dokument opisuje **ostatnią trasę** (`export/{view}`, blok 10f wraz z pulpitem)
oraz stan faktyczny bloków już zamkniętych.

**Zanim zaczniesz blok:** przeczytaj `rebuild/frontend/src/pages/analityka/README.md` —
wzorzec sekcji dashboardu, którego bloki 10b–10d mają się trzymać 1:1.

---

## 1. Trzy rzeczy, które zaskoczyły blok 10a — nie daj się zaskoczyć drugi raz

### 1.1 Osiem tras z dwudziestu siedmiu NIE MA KONSUMENTA w oryginalnym froncie

To jest najważniejsza pułapka całej Iteracji 10. Trasa ma fixture, ma sensowną nazwę
i wygląda na źródło jakiegoś ekranu — a produkcyjny bundle nie woła jej ani razu. Jeśli
zaplanujesz „odtworzenie" takiego dashboardu, **budujesz coś nowego, nie odbudowujesz** —
a to wymaga decyzji użytkownika, nie domysłu.

**Zero wywołań w całym bundlu FE** (grep po `mirror/frontend/assets/*.js`):

| Trasa | Blok | Uwaga |
|---|---|---|
| `GET /api/analytics/kpi` | ✅ 10a | backend sam nazywa ją „backward-compatible alias used by previous frontend build" (`:324`) |
| `GET /api/analytics/dostawcy-stats` | 10d | |
| `GET /api/analytics/top-zmiany` | ✅ 10b | backend dowieziony bez UI (decyzja D1, `docs/tickets/24-FEATURE-analityka-ceny/plan.md`) |
| `GET /api/analytics/importy-timeline` | 10e | fixture jest **pustą tablicą** |
| `GET /api/analytics/ean-porownanie` | ✅ 10c | przyjmuje `?ean`; dowieziona jako trasa bez UI (decyzja D6) |
| `GET /api/analytics/ean/details` | ✅ 10c | przyjmuje `?ean`; fixture ma puste `offers`; dowieziona jako trasa bez UI (decyzja D6) |
| `POST /api/analytics/bootstrap-current` | ✅ 10a | dowieziona jako trasa bez UI (decyzja D4) |

**Pobierana, ale nigdzie nierenderowana** — osobny przypadek, jeszcze bardziej mylący:

- `GET /api/analytics/market/group-prices` (**✅ blok 10b**). Widok `/analityka` wykonuje to
  zapytanie przy każdym wejściu, z `group=marka` na sztywno (`zM+53`), trzyma wynik
  w zmiennej `z`... i nigdy jej nie używa. Selektor grupy (`c`/`u`, `useState("marka")`)
  też nie ma żadnej kontrolki w UI. To martwy fetch — backend dowieziony bez UI (decyzja D2,
  `docs/tickets/24-FEATURE-analityka-ceny/plan.md`).

Ten sam wzorzec dotyczy `GET /api/analytics/filters`: oryginał pobiera sześć list,
a renderuje z nich wyłącznie `dostawcy.length` w kaflu KPI.

**Jak sprawdzić samemu, zanim zaplanujesz ekran:**

```bash
grep -o "analytics/<twoja-trasa>" mirror/frontend/assets/*.js deminified/frontend-index.js | wc -l
```

### 1.2 `_przyciete` w fixtures NIE jest polem API

To adnotacja nagrywarki fixtures (`contract/README.md:29` — duże tablice przycięto do 5
elementów, 27 MB → 247 KB). Handler produkcji zwraca gołe tablice. Zwrócenie `_przyciete`
z nowego backendu **wywala GATE**, bo `test/gate/ksztalt.ts` zgłasza klucz nadmiarowy
w odpowiedzi jako różnicę (klucze na `_` pomija tylko po stronie fixture'a).

### 1.3 Kontrakt nie mówi o analityce prawie nic

`contract/openapi.yaml` nie ma dla **żadnej** trasy analityki schematu odpowiedzi — tylko
`responses: {200, 400, 401}` i `security`. Kontraktowa część GATE dowodzi więc wyłącznie,
że ścieżka istnieje, status jest zadeklarowany i ciało jest JSON-em. **Cały ciężar kształtu
niosą fixtures.**

Konsekwencja: `auth` nie jest tu odstępstwem D1. Wszystkie trasy analityki mają
w kontrakcie `security: [{bearerAuth}, {cookieAuth}]`, a oryginał podaje `requireAuth`
w każdej z 27 rejestracji. Nie odnotowuj tego jako różnicy.

### 1.4 Trasy z parametrami NIE używają klucza-ścieżki (odkryte w 10b)

Oryginał dla `market/group-prices?group`, `prices/product-history?ean&kod` i
`rotation/inactive?days` pisze **własny `queryFn` z jawnym query stringiem**, a `queryKey`
trzyma jako listę wartości — segmenty klucza NIE są tam ścieżką
(`deminified/frontend-index.js:27856-27860`, `:27870-27877`, `:27899-27905`). Nie doklejaj
segmentu `"?…"` do `queryKey` licząc na domyślny `queryFn`, który skleja `queryKey.join("/")`
— to nie odtwarza oryginału. Wzorzec do skopiowania: `useHistoriaCenyProduktu`
w `rebuild/frontend/src/pages/analityka/api.ts`; pełny opis: `pages/analityka/README.md`
§2.2. **Uwaga: przy własnym `queryFn` trzeba samemu obsłużyć `401 → null`** (konwencja
`on401: "returnNull"` całej aplikacji). Dotyczy bloków 10c (`ean/details?ean`,
`ean-porownanie?ean`) i 10e (`rotation/inactive?days`) — gotowy hook debounce
(`pages/analityka/useOpoznionaWartosc.ts`) i wzorzec `queryFn` już są, patrz §5 i §7.

---

## 2. Fixtures, które NIE dowodzą kształtu wiersza

`test/gate/ksztalt.ts:50` nie zagląda do elementów pustej tablicy. Jeśli Twoja trasa jest
na tej liście, GATE przepuści **dowolny** kształt wiersza — kształt trzeba pokryć testem
jednostkowym przeciw SQL-owi oryginału, tak jak 10a zrobiło dla `margins.low`/`high`.

**Problem jest szerszy, niż tylko puste pola fixture'a.** `test/gate/ksztalt.ts:50` iteruje
po elementach ODPOWIEDZI, więc **pusta ODPOWIEDŹ przechodzi gate za darmo** — niezależnie
od tego, czy fixture jest pusty. Domyślny zasiew `PRODUKTY_TESTOWE` nie ma ani jednego EAN-u
u dwóch dostawców, więc w 10c trzy trasy (`ean/comparison`, `ean/supplier-rank`,
`ean-porownanie`) wychodziły na nim puste i gate przepuszczał dowolny kształt wiersza —
mimo że fixtures tych tras NIE są puste. **Wniosek dla 10b: zasiej dane dające
NIEPUSTE odpowiedzi i asercją sprawdź `rows.length > 0` PRZED porównaniem z fixture'em.**

**⚠ PUSTKA MA DWIE RÓŻNE PRZYCZYNY I TRZEBA JE ROZRÓŻNIAĆ.** Fixture bywa pusty, bo w chwili
nagrania nie było danych — ale bywa też pusty, bo **trasa jest zepsuta i nie zwraca nic nigdy**.
Blok 10e trafił na drugi przypadek: `availability/products` i `availability/sell-through` pytają
`historia_cen` o kolumnę `nazwa`, której ta tabela nie ma, `safeAll()` połyka `no such column`
i obie trasy oddają `rows: []` — mimo 15 597 migawek widocznych w `GET_analytics_status.json`.
Zanim uznasz pusty fixture za „brak danych w chwili nagrania", sprawdź, czy kolumny z SQL-a
trasy w ogóle istnieją w `rebuild/schema/001_schema.sql` (§10, punkt 7). Szczegóły:
`docs/rebuild-backlog.md` #32 i #33.

| Fixture | Puste pola | Blok | Przyczyna |
|---|---|---|---|
| `GET_analytics_availability_products.json` | `rows` | ✅ 10e | **trasa zepsuta** (brak kolumny `nazwa`) |
| `GET_analytics_availability_sell-through.json` | `rows` | ✅ 10e | **trasa zepsuta** (brak kolumny `nazwa`) |
| `GET_analytics_rotation_inactive.json` | `rows` | ✅ 10e (pokryte testem) | brak danych w chwili nagrania |
| `GET_analytics_importy-timeline.json` | **cała odpowiedź** | ✅ 10e (pokryte testem) | brak danych w chwili nagrania (`audit_log`) |
| `GET_analytics_ean_details.json` | `offers` (i cała gałąź z `?ean`) | ✅ 10c (pokryte testem) | brak danych w chwili nagrania |
| `GET_analytics_margins.json` | `low`, `high` | ✅ 10a (pokryte testem) | brak danych w chwili nagrania |
| `GET_analytics_suppliers_stability.json` | — (tablica niepusta) | ✅ 10d (pokryte testem) | — |

**Blok 10e miał tu najsłabszą siatkę z całej iteracji** — cztery z sześciu jego fixtures były
puste albo częściowo puste. Nadrobione testem jednostkowym `analityka.dostepnosc.agregaty.test.ts`.

**⚠ Pusty fixture ma DWIE różne przyczyny — nie zakładaj automatycznie „brak danych".**
`availability/products` i `availability/sell-through` mają `rows: []` NIE dlatego, że w chwili
nagrania nie było historii cen (fixture `GET_analytics_status.json` pokazuje 15 597 migawek),
tylko dlatego, że obie trasy pytają `historia_cen` o kolumnę `nazwa`, której ta tabela **nie
ma** (ani w `db/schema.sql`, ani w `rebuild/schema/001_schema.sql`, ani w `ensureSchema()`
modułu analityki) — SQLite rzuca `no such column: nazwa`, a `safeAll()` (`:51`) połyka wyjątek
i oddaje pustą listę. Obie karty zakładki „Dostępność" są więc w produkcji **trwale** puste,
niezależnie od danych. Szczegóły i warianty naprawy: `docs/rebuild-backlog.md` **#32** (brak
kolumny) i **#33** (druga, dziś zamaskowana pułapka SQL w `sell-through` — funkcja okna
liczona po niepełnym `GROUP BY`).

**Druga połowa problemu (wykryta w 10b): `ksztalt.ts` porównuje elementy tablicy PARAMI**,
więc nie tylko pusta tablica w fixture, ale i **pusta ODPOWIEDŹ testowa** przechodzi bez
jednego porównania — nawet gdy fixture ma niepuste wiersze. Konsekwencja praktyczna: test
GATE musi asercją wymusić niepustą odpowiedź (`expect(rows.length).toBeGreaterThan(0)` przed
porównaniem), a zasiew musi ją zapewnić. Przykład z 10b: `zasiejHistorieCen` z 10a ma trzy
wiersze jednego dostawcy, w jednym miesiącu, bez `ean` — na takich danych `prices/inflation`
zwróciłoby same `inflacjaPct: null`, a `prices/product-history` same `ean: null`, co harness
zgłasza tylko jako OSTRZEŻENIE, nie różnicę. Dlatego 10b dołożyło osobny zasiew
`zasiejHistorieCenDlaCen` (`test/gate/dane.ts`) — kilku dostawców × dwa miesiące × niepusty
`ean` — zamiast dorabiać kolejne dane do zasiewu 10a. **Dotyczy szczególnie bloku 10e** (patrz
§7) — ten sam wzorzec: osobny, bogatszy zasiew zamiast liczenia na to, co GATE i tak przepuści.

**Trzeci rodzaj luki (wykryty w 10d): tablica niepusta, ale nagrana tylko na jednej gałęzi
handlera.**: tablica niepusta, ale nagrana tylko na jednej gałęzi handlera.**
`GET_analytics_suppliers_stability.json` nie jest pusty — ale nagrano go przy
`hasHistory: true`, więc **gałąź zapasowa (`hasHistory: false`, inny zestaw kolumn) nie ma
w nagraniu żadnego świadka**; GATE jej nie widzi. Pokrywa ją test jednostkowy
`rebuild/backend/test/analityka.dostawcy.agregaty.test.ts`. Reguła dla kolejnych bloków:
**handler z dwiema gałęziami zależnymi od `hasHistory` ma zwykle tylko jedną nagraną —
drugą trzeba pokryć testem jednostkowym**, nawet gdy fixture wygląda na kompletny. Dotyczy
też bloku 10e: `availability/products`, `availability/sell-through`, `seasonality/monthly`,
`lifecycle/models` mają ten sam wzorzec `hasHistory`.

---

## 3. Trzy kształty odpowiedzi — nie zakładaj jednego

| Kształt | Trasy |
|---|---|
| `{ hasHistory, rows }` | `suppliers/stability`, `availability/products`, `availability/sell-through`, `prices/inflation`, `seasonality/monthly`, `lifecycle/models`, `prices/product-history` (+ `stats`) |
| `{ rows }` (bez `hasHistory`) | `suppliers/lifecycle`, `suppliers/stock`, `ean/comparison`, `ean/unique`, `ean/coverage`, `ean/supplier-rank`, `prices/last-import` |
| **goła tablica** (bez koperty) | `dostawcy-stats`, `top-zmiany`, `importy-timeline` |
| inne | `market/group-prices` → `{ group, rows }` · `rotation/inactive` → `{ days, rows }` · `ean/details` bez `?ean` → `{ ean: null, offers: [] }`; **z `?ean`** → `{ ean, offers, mediana, srednia }`, patrz §5 |

`hasHistory` liczy się z `historia_cen` przez pomocnika `hasHistory(db)` (`:58`) i mówi UI,
czy widok czasowy ma z czego rysować.

---

## 4. Blok 10b — Ceny

**✅ Zrobione 2026-09-04 (`24-FEATURE-analityka-ceny`).**

Trasy: `prices/inflation`, `prices/last-import`, `prices/product-history`,
`market/group-prices`, `top-zmiany`. Fixtures: 5.

| Trasa | Linia | Query | LIMIT | Kształt |
|---|---|---|---|---|
| `prices/last-import` | `:245` | — | 500 | `{ rows }` |
| `prices/product-history` | `:250` | `ean`, `kod` | — | `{ hasHistory, rows, stats: {min, max, …} }` |
| `prices/inflation` | `:263` | — | 500 | `{ hasHistory, rows }` |
| `market/group-prices` | `:237` | `group` | 500 | `{ group, rows }` |
| `top-zmiany` | `:333` | — | 100 | **goła tablica** |

**Zakładka w UI: `ceny` „Ceny w czasie"** (`fe.js:28295-28416`). Trzy karty, w tej kolejności:

1. **„3.1 Zmiany cen z ostatnich importów"** ← `prices/last-import`
   Kolumny: Data · Dostawca · Kod · Nazwa · Było · Jest · Zmiana %. Przycisk CSV (`prices-last`).
2. **„3.2 / 3.3 Historia ceny wybranej opony"** ← `prices/product-history`
   Kolumny: Data · Dostawca · Kod · Cena zakupu · Cena sprzedaży · Stan.
   **To jedyna karta z realnymi kontrolkami wejścia** — dwa pola tekstowe (`n` = EAN,
   `a` = kod), a zapytanie leci dopiero, gdy **któreś** z nich jest niepuste (`zM+69`:
   `n || a ? fetch(…) : …`). Parametry idą własnym `queryFn`, nie doklejone do `queryKey`
   jako ścieżka — patrz §1.4. `stats` (`{min, max, avg}`) **backend zwraca, frontend go nie
   renderuje** — oryginał też go nigdzie nie pokazuje (zero użyć w bundlu), dokładnie jak
   `margins.low`/`high` w 10a (decyzja D4).
   **Odstępstwo O-10b-1:** pola EAN/Kod mają debounce 300 ms (`useOpoznionaWartosc`) —
   oryginał strzela zapytaniem na każde naciśnięcie klawisza, a trasa nie ma LIMIT-u i skanuje
   całą `historia_cen`.
3. **„3.6 Inflacja cennika"** ← `prices/inflation`
   Kolumny: Miesiąc · Dostawca · Śr. cena · Zmiana %.
   **Odstępstwo O-10b-2:** wykres liniowy nad tabelą (szereg czasowy, oryginał bez wykresów) —
   pokazuje się dopiero od dwóch różnych miesięcy w danych, inaczej sama tabela.

**Bez UI w oryginale (rozstrzygnięte):** `top-zmiany` — backend TAK, UI NIE (**D1**) —
i `market/group-prices` — backend TAK, UI NIE (**D2**, martwy fetch, patrz §1.1). Obie trasy
mają zero konsumentów/martwy fetch w oryginale; dołożenie karty byłoby nową funkcjonalnością,
nie odbudową. Szczegóły: `docs/tickets/24-FEATURE-analityka-ceny/plan.md`.

**⚠ `prices/product-history` to pierwszy prawdziwy czytelnik `historia_cen`** (decyzja D3
z roadmapy). Tabela ma pisarzy od 3d-1 (auto-zatwierdzanie importu) i od 10a
(`bootstrap-current`). Na stagingu może być pusta — wtedy `hasHistory: false` i tabela pusta;
to poprawne zachowanie, nie awaria.

**Zweryfikowane na snapshocie produkcji** (`db/snapshot.db`) — agregaty odtwarzają wartości
nagrań, nie tylko kształt: `group-prices` → 92 wiersze (fixture `_przyciete: 92`), `inflation`
→ 17 (fixture 17, pierwszy wiersz `MO1 / 2026-08 / 3138.08 / 44.06` identyczny), `top-zmiany`
→ pierwszy wiersz identyczny z fixture, `product-history` → `min 24.26` / `max 27230`
identyczne. Taniej i mocniej niż sam GATE — warto powtórzyć w kolejnych blokach.

---

## 5. Blok 10c — EAN ✅ zamknięty 2026-09-03 (`22-FEATURE-analityka-ean`)

Trasy: `ean/comparison`, `ean/coverage`, `ean/details`, `ean/supplier-rank`, `ean/unique`,
`ean-porownanie`. Fixtures: 6. Backend: `rebuild/backend/src/repos/analityka.ts` +
`routes/analytics.ts`. Frontend: `pages/analityka/SekcjaEan.tsx`.

| Trasa | Linia | Query | LIMIT | Kształt |
|---|---|---|---|---|
| `ean/comparison` | `:188` | `minDiffPct` | 1000 | `{ rows }` |
| `ean/details` | `:202` | `ean` | — | **bez `?ean`** → `{ean: null, offers: []}`; **z `?ean`** → `{ean, offers, mediana, srednia}` |
| `ean/unique` | `:210` | — | 1000 | `{ rows }` |
| `ean/coverage` | `:219` | — | — | `{ rows }` |
| `ean/supplier-rank` | `:224` | — | — | `{ rows }` |
| `ean-porownanie` | `:335` | `ean` | 200 | goła tablica (dwie różne gałęzie, patrz niżej) |

**`ean/details` z `?ean` ma cztery klucze, nie dwa** (`analytics_module.cjs:202-208`).
Fixture nagrał wyłącznie gałąź bez parametru (`{ean: null, offers: []}`), więc różnicy nie
widać w kontrakcie — kształt jest pokryty testem jednostkowym, nie gate'em. Każda oferta
w `offers` dostaje dodatkowo `pozycjaCenowa: i + 1` liczoną z **kolejności wierszy po
sortowaniu**, NIE funkcją okna — dwie oferty o identycznej cenie dostają różne pozycje
(w odróżnieniu od `ean/supplier-rank`, który używa prawdziwego `RANK()` i tam remisy dzielą
pozycję).

**`ean-porownanie` ma DWIE gałęzie SQL zależne od `?ean`** (`:335-338`) i to nie jest alias
`ean/comparison` — to osobny, prostszy SQL:
- **bez `?ean`** → agregat 2-dostawcowy (to nagrał fixture): pięć kolumn
  (`ean, nazwa, dostawcy, cenaMin, cenaMax`, bez `srednia`/`oferty`/`spreadZl`/`spreadPct`),
  WHERE **bez** `cena_zakupu > 0`, LIMIT **200** (nie 1000).
- **z `?ean`** → goła tablica ofert, ten sam SELECT co `ean/details.offers`, ale **bez**
  `pozycjaCenowa`.

**Dwa fakty, które kosztowały dochodzenie w 10c:**
- `spreadZl`/`spreadPct` w `ean/comparison` liczą się w **JS, po SQL** — filtr `minDiffPct`
  działa **PO** obcięciu do LIMIT 1000, nie przed nim.
- `ean/supplier-rank.wspolnePozycje` **myli nazwą**: CTE `ranked` nie wymaga, żeby EAN był
  u dwóch dostawców — liczy WSZYSTKIE aktywne oferty dostawcy z niepustym EAN-em i ceną > 0.
  Stąd w fixture `MO9` wychodzi 846/846 = **100%** (wszystkie jego EAN-y są unikalne, więc
  jest zawsze najtańszy). `RANK()` (nie `ROW_NUMBER()`) sprawia, że przy remisie każdy
  z remisujących liczy się jako najtańszy — suma `najtanszy` po dostawcach może przez to
  przekroczyć liczbę EAN-ów.
- `ean/unique` używa `MAX()` do wyciągnięcia kolumn spoza `GROUP BY` — gdy jeden dostawca ma
  pod tym samym EAN-em kilka kodów, w tabeli widać NAJWYŻSZĄ cenę i NAJWYŻSZY stan, nie
  wartości jednej konkretnej oferty.
- `ean/unique` i `ean/coverage` **nie filtrują** po `cena_zakupu > 0` (w odróżnieniu od
  `comparison` i `supplier-rank`).

`ean/details?ean` i `ean-porownanie?ean` idą przez własny `queryFn`, nie klucz-ścieżkę —
patrz §1.4; gotowy hook debounce (`pages/analityka/useOpoznionaWartosc.ts`) i wzorzec
`queryFn` (`useHistoriaCenyProduktu`, `pages/analityka/api.ts`) są od 10b.

**Zakładka w UI: `ean` „EAN i ceny"** (`fe.js:28175-28294`). Trzy karty:

1. **„2.1-2.4 Porównanie cen po EAN"** ← `ean/comparison`
   Kolumny: EAN · Nazwa · Dostawcy · Min · Max · Spread zł · Spread %. CSV (`ean-comparison`,
   `M("ean-comparison")` `fe.js:28190` — bez UI do 10f).
   ⚠ `minDiffPct` jest parametrem trasy, ale **oryginalny front go nie podaje** — woła
   `ean/comparison` bez query. Kontrolki filtra dla niego w UI nie ma (backend go ma i jest
   pokryty testem jednostkowym).
2. **„2.5 Pozycje unikalne"** ← `ean/unique`
   Kolumny: EAN · Nazwa · Dostawca · Cena · Stan. CSV (`unique`, `M("unique")` `fe.js:28234`
   — bez UI do 10f).
3. **„2.6 Pokrycie wspólne i ranking dostawcy"** — **jedna karta, DWIE tabele**:
   - `ean/coverage` → Liczba dostawców · EAN (fixture: `{liczbaDostawcow, liczbaEAN}`)
   - `ean/supplier-rank` → Dostawca · Wspólne · Najtańszy · Najtańszy %
     (fixture: `{dostawca, wspolnePozycje, najtanszy, najtanszyPct}`)

**Bez UI w oryginale (decyzja D6 z ticketu):** `ean/details` i `ean-porownanie` — obie
przyjmują `?ean` i obie mają zero wywołań w bundlu. Wyglądają na zaczątek „szczegółów jednego
EAN-u", którego nikt nie dokończył. Dowiezione jako trasy bez UI, tak jak
`bootstrap-current` w 10a.

**Kafle KPI oryginału zależą od tego bloku.** Oryginalny nagłówek `/analityka` liczy dwa
z czterech kafli z `ean/comparison.rows.length` („EAN wspólne") i `ean/unique.rows.length`
(„Pozycje unikalne"). Blok 10a świadomie wziął `GET /api/analytics/kpi` zamiast nich
(odstępstwo O-10a-1), żeby nie czekać na 10c. **Dane są teraz dostępne, ale przepięcie
nagłówka na oryginalne kafle jest osobną decyzją użytkownika** — 10c jej nie podjął
(decyzja D1 z `docs/tickets/22-FEATURE-analityka-ean/plan.md`); zmiana byłaby jednym
edytem `NaglowekKpi.tsx`, gdy ktoś zdecyduje.

**Co 10c zostawia następnym:** przyciski CSV kart „2.1-2.4" i „2.5" idą do bloku **10f**
razem z `GET /api/analytics/export/{view}` (§8.1).

---

## 6. Blok 10d — Dostawcy ✅ ZAMKNIĘTY (2026-09-03, `23-FEATURE-analityka-dostawcy`)

Trasy: `dostawcy-stats`, `suppliers/lifecycle`, `suppliers/stability`, `suppliers/stock`.
Fixtures: 4. Zrealizowane 1:1 wg tej sekcji (potwierdzone odczytem
`deminified/frontend-index.js:28054-28172`).

**Pliki:** backend — `rebuild/backend/src/repos/analityka.ts` (sekcja „BLOK 10d · DOSTAWCY":
`stabilnoscDostawcow`, `cyklZyciaDostawcow`, `stanDostawcow`, `statystykiDostawcow`),
`rebuild/backend/src/routes/analytics.ts` (cztery trasy `GET`). Frontend —
`pages/analityka/Sekcja{StabilnoscDostawcow,CyklZyciaDostawcow,StanDostawcow}.tsx`,
`pages/analityka/PasekDostepnosci.tsx` (wspólny komponent, patrz §7 i §9).

| Trasa | Linia | Query | LIMIT | Kształt |
|---|---|---|---|---|
| `suppliers/stability` | `:110` | — | — | `{ hasHistory, rows }` |
| `suppliers/lifecycle` | `:133` | — | 500 | `{ rows }` |
| `suppliers/stock` | `:143` | — | — | `{ rows }` |
| `dostawcy-stats` | `:332` | — | — | **goła tablica** |

**Zakładka w UI: `dostawcy` „Dostawcy"** (`fe.js:28050-28174`) — **to jest zakładka DOMYŚLNA
całego widoku** (`useState("dostawcy")`, `fe.js:27805`). Trzy karty:

1. **„1.1 Stabilność cennika dostawcy"** ← `suppliers/stability`
   Kolumny: Dostawca · Produkty · Punkty historii · Zmiany · Śr. zmiana % · Max % · Śr. stan.
   CSV (`suppliers-stability`, czeka na 10f — patrz §8.1).
   ⚠ **Karta renderuje 7 kolumn, ale żadna z dwóch gałęzi backendu (`hasHistory`) nie zwraca
   ich wszystkich** — gałąź `true` nie ma `produkty`/`sredniStan`, gałąź `false` nie ma
   `punkty` i ma trzy `NULL`-e (`liczbaZmian`, `sredniaZmianaPct`, `maxZmianaPct`); gałąź
   `false` zwraca też `sredniaCena`, dla której w UI **nie ma kolumny** (ciche zignorowanie).
   Zastane zachowanie produkcji, odtworzone 1:1 — puste komórki „—", bez adnotacji (10d,
   decyzja D1: `docs/tickets/23-FEATURE-analityka-dostawcy/plan.md`).
   ⚠ **Próg zmiany ceny `ABS(...) > 0.01` jest porównaniem FLOAT** — w podwójnej precyzji
   `100.01 - 100 = 0.010000000000005…`, czyli różnica równa dokładnie groszowi LICZY SIĘ jako
   zmiana. Odtworzone i scharakteryzowane testem jednostkowym, nie „naprawione".
2. **„1.2 Nowości i wycofania"** ← `suppliers/lifecycle`
   Kolumny: Data · Dostawca · Typ · Kod · Nazwa · Powód. CSV (`suppliers-lifecycle`,
   czeka na 10f — patrz §8.1).
3. **„1.4 / 1.5 Stan i dostępność dostawcy"** ← `suppliers/stock`
   Kolumny: Dostawca · Produkty · Śr. stan · Dostępne · Dostępność.
   ⚠ Kolumna „Dostępność" renderuje się **paskiem postępu**, nie liczbą — pomocnik `O(e)`
   (`fe.js:27921`) dostaje `e.dostepnoscPct` i rysuje `<div>` szerokości 24 z zagnieżdżonym
   `<div>` o `width: n%` plus podpis `n%` monospace. To **jedyna nietabelaryczna wizualizacja
   w całym oryginalnym widoku** i występuje dwa razy: tutaj (`zM+366`) oraz w karcie „4.1"
   bloku 10e (`zM+650`). **10d wydzieliła ją jako wspólny komponent**
   (`pages/analityka/PasekDostepnosci.tsx`, port `O()` 1:1) — 10e ją reużywa, patrz §7.
   CSV (`suppliers-stock`, czeka na 10f — patrz §8.1).

**Bez UI w oryginale (decyzja D3, zaklepana treścią ticketa):** `dostawcy-stats` (zero
wywołań). Dowieziona w backendzie pod GATE, bez hooka i bez karty — tak jak w oryginale.
Zwraca gołą tablicę `{dostawca, liczbaProduktow, avgMarza, avgCenaZakupu, dostepnych}` —
merytorycznie nakłada się na `suppliers/stock`.

**⚠ Uwaga na zderzenie nazw z Iteracją 3f-2.** `/api/dostawcy` (widok Konfiguracja →
Dostawcy) to **inny zasób** niż `/api/analytics/dostawcy-stats`. Pierwszy jest już
odbudowany (`rebuild/backend/src/repos/suppliers.ts`, `routes/suppliers.ts`) i liczy
`liczbaProduktow`, przeliczony `status` i znaczniki zmian z `historia_cen`. Nie duplikuj
tamtej logiki — sprawdź `repos/suppliers.ts`, zanim napiszesz cokolwiek nowego.

---

## 7. Blok 10e — Dostępność / rotacja / cykl — ✅ ZROBIONE (2026-09-04, `25-FEATURE-analityka-dostepnosc-rotacja`)

Sekcja niżej opisuje **stan faktyczny po dowiezieniu**, nie zamiar. Szczegóły decyzji i
odkryć: `docs/tickets/25-FEATURE-analityka-dostepnosc-rotacja/{plan,raport,review}.md`.

Trasy: `availability/products`, `availability/sell-through`, `rotation/inactive`,
`lifecycle/models`, `seasonality/monthly`, `importy-timeline`. Fixtures: 6.

**⚠ Dwie karty tej zakładki są w produkcji trwale puste** — `historia_cen` nie ma kolumny
`nazwa`, o którą pytają `availability/products` i `availability/sell-through`; szczegóły
w §2 i backlog **#32**/**#33**. Odbudowa odtworzyła to 1:1 (port `safeAll` →
`bezpiecznieWiersze`), zamrożone testami charakteryzacyjnymi.

| Trasa | Linia | Query | LIMIT | Kształt |
|---|---|---|---|---|
| `availability/products` | `:156` | — | 500 | `{ hasHistory, rows }` — **fixture pusty** |
| `availability/sell-through` | `:173` | — | 500 | `{ hasHistory, rows }` — **fixture pusty** |
| `seasonality/monthly` | `:279` | — | — | `{ hasHistory, rows }` |
| `lifecycle/models` | `:285` | — | 1000 | `{ hasHistory, rows }` |
| `rotation/inactive` | `:299` | `days` | 1000 | `{ days, rows }` — **fixture pusty** |
| `importy-timeline` | `:334` | — | 200 | goła tablica — **fixture pusty** |

**Ten blok miał najsłabszą siatkę bezpieczeństwa w całej iteracji** — patrz §2. Nadrobione
zgodnie ze wzorcem z 10b (poszerzony zasiew, żeby GATE realnie dowodził kształtu) plus test
jednostkowy `analityka.dostepnosc.agregaty.test.ts`: kształt wiersza czterech tras z pustym
fixture'em, obie gałęzie `hasHistory`, zaciski `?days`, trzy charakteryzacje.

**Dwie zakładki, nie jedna:**

**`dostepnosc` „Dostępność"** (`fe.js:28417-28515`) — trzy karty, dowiezione jako
`SekcjaDostepnosciProduktow.tsx`, `SekcjaTempaSchodzenia.tsx`, `SekcjaSezonowosci.tsx`
(`rebuild/frontend/src/pages/analityka/`):
1. **„4.1 Historia dostępności pozycji"** ← `availability/products`
   Kolumny: Dostawca · Kod · EAN · Nazwa · Dostępność · Miesiące braków. CSV — dokłada 10f.
   ⚠ „Dostępność" to **pasek postępu** `O(e.dostepnoscPct)` (`zM+650`) — ten sam, co w karcie
   „1.4 / 1.5" bloku 10d. Komponent jest wspólny i obie karty na nim stoją:
   `rebuild/frontend/src/pages/analityka/PasekDostepnosci.tsx` (wydzielony w 10d, użyty w 10e).
   ⚠ Karta jest **trwale pusta w produkcji** — patrz §2 i `docs/rebuild-backlog.md` #32.
2. **„4.2 Tempo schodzenia z magazynu"** ← `availability/sell-through`
   Kolumny: Dostawca · Kod · Nazwa · Zeszło sztuk. CSV — dokłada 10f. ⚠ Też trwale pusta
   w produkcji.
3. **„4.4 Sezonowy wzorzec cen"** ← `seasonality/monthly`
   Kolumny: Miesiąc · Marka · Śr. cena · Dostępność. Jedyny wykres bloku: linia „średnia
   cena wg miesiąca" nad tabelą (odstępstwo **O-10e-1** — oryginał nie ma tu wykresu).

**`marza` „Marża i rotacja"** — **sekcja marż z 10a zostaje pierwsza, nietknięta;** pod nią
doszły, w kolejności oryginału, `SekcjaRotacji.tsx` i `SekcjaCykluZycia.tsx`:
2. **„Rotacja / produkty bez aktualizacji"** ← `rotation/inactive`
   Kolumny: Ostatnia aktualizacja · Dostawca · Kod · Nazwa · Stan. CSV — dokłada 10f.
   ⚠ **Ma realną kontrolkę:** pole tekstowe „Bez ruchu dni" (`i`/`l`, `useState("60")`),
   wartość idzie do `?days` i **do `queryKey`** jako jeden segment z pełnym adresem
   (`["/api/analytics/rotation/inactive?days=60"]`) — to jest wzorzec „filtr → query param",
   w odróżnieniu od filtrów klienckich z 10a. Backend zaciska `days` do `[1, 730]`
   (`Math.min(730, Math.max(1, parseInt(req.query.days || '60', 10)))`). Klucz zapytania to
   CAŁY adres w jednym segmencie (`…/rotation/inactive?days=60`) — własny `queryFn` z 10b jest
   potrzebny tylko tam, gdzie zapytanie ma się NIE wykonać przy pustych parametrach, a `?days`
   ma zawsze wartość domyślną. Stan pola mieszka w `Analityka.tsx` (nie w sekcji), inaczej
   przełączenie zakładek go resetuje — poprawka z review. Karta ma jako jedyna layout
   `p-4 space-y-3` bez `border-b`.
3. **„4.6 Cykl życia modelu"** ← `lifecycle/models`
   Kolumny: Marka · Model · Pierwszy raz · Ostatni raz · Produkty. Bez CSV.

W `Analityka.tsx` te dwie karty zastąpiły `ZakladkaWPrzygotowaniu` z `blok="10e"`
w zakładce `marza`.

**Bez UI, backend 1:1 (decyzja D2):** `importy-timeline`. Zero wywołań w oryginale, fixture
pusty, czyta `audit_log` dla akcji importu — trasa istnieje i przechodzi GATE, żadna
zakładka jej nie konsumuje (ten sam wzorzec co `bootstrap-current` w 10a).

---

## 8. Blok 10f — Export + Pulpit

### 8.1 `GET /api/analytics/export/{view}` (`:305`)

Jedyna trasa analityki z **parametrem ścieżki**, nie query. `LIMIT 5000`, oddaje CSV przez
pomocnika `sendRows`. Nie ma fixture'a GET — walidacja tylko wg openapi.

CSV budują `toCsv`/`csvEscape` (`:56-57`): separator **średnik**, BOM `﻿` na początku,
cudzysłowy podwajane, pola z `;`/`"`/nowa linia w cudzysłowach. Nagłówek to klucze
pierwszego wiersza. Pusty wynik = sam BOM.

**Nazwy `{view}` używane przez oryginał** (z `M(e)` → `window.location.href`):
`suppliers-stability` · `suppliers-lifecycle` · `suppliers-stock` · `ean-comparison` ·
`unique` · `prices-last` · `availability-products` · `sell-through` · `margins` ·
`rotation-inactive`.

**⚠ Dwa widoki eksportu mają dokładnie tę samą wadę, co ich odpowiedniki dashboardu (§2,
backlog #32).** `export/availability-products` i `export/sell-through`
(`analytics_module.cjs:316-317`) czytają `nazwa` z `historia_cen` tak samo jak
`availability/products`/`sell-through` — w produkcji ta kolumna nie istnieje, więc oba pliki
CSV oddają sam znacznik BOM, bez wiersza danych. 10f musi to wiedzieć **zanim** zaplanuje
⚠ Przycisk „CSV" **nie istnieje w odbudowie** — 10a świadomie go pominęło w sekcji marż,
a 10d — świadomie (decyzja D5) — w trzech kartach zakładki `dostawcy`
(`suppliers-stability`, `suppliers-lifecycle`, `suppliers-stock`): przycisk wiodący donikąd
byłby gorszy niż jego brak, dopóki trasa eksportu nie istnieje. 10f dokłada go do wszystkich
czterech sekcji, do **trzech kart dowiezionych przez 10e** — „4.1 Historia dostępności"
(`availability-products`), „4.2 Tempo schodzenia" (`sell-through`) i „Rotacja / produkty bez
aktualizacji" (`rotation-inactive`) — **i do każdej innej sekcji, która ma go w oryginale**;
lista wyżej mówi dokładnie do których. W oryginale przycisk siedzi w nagłówku karty, po prawej:
`<Button variant="outline" size="sm">CSV</Button>`.

**⚠ Dwa widoki eksportu mają dokładnie tę samą wadę, co ich odpowiedniki dashboardu (§2,
backlog #32).** `export/availability-products` i `export/sell-through`
(`analytics_module.cjs:316-317`) czytają `nazwa` z `historia_cen` tak samo jak
`availability/products`/`sell-through` — w produkcji ta kolumna nie istnieje, więc oba pliki
CSV oddają sam znacznik BOM, bez wiersza danych. 10f musi to wiedzieć **zanim** zaplanuje
te dwa przyciski, inaczej pusty CSV wygląda jak własny błąd bloku.

**⚠ EKSPORT NIE ZWRACA TEGO, CO WIDAĆ W TABELI. Każdy `{view}` ma WŁASNY SQL, inny niż trasa
dashboardu o tej samej nazwie** — to nie jest „ta sama odpowiedź w innym formacie". Dwa
przykłady, oba zweryfikowane:

- `GET /api/analytics/margins` zwraca wiersze **zgrupowane** (`dostawca, kategoria, marka,
  produkty, avgMarza, minMarza, maxMarza`, `GROUP BY` po trzech wymiarach, LIMIT 1000).
  `GET /api/analytics/export/margins` zwraca wiersze **per produkt**
  (`kod, nazwa, dostawca, kategoria, marka, marza_pct`, bez grupowania, LIMIT 5000).
- `GET /api/analytics/suppliers/stability` liczy z `historia_cen` (punkty historii, liczba
  zmian, średnia i maksymalna zmiana %), z gałęzią zapasową na `products`, gdy historii nie ma.
  `export/suppliers-stability` liczy **zawsze** z `historia_cen` i oddaje inne kolumny
  (`produkty, punkty, sredniaCena, sredniStan`).

Nie zakładaj więc, że da się zbudować CSV z danych, które sekcja już ma w pamięci — każdy
widok eksportu trzeba portować osobno, z jego własnego zapytania.

Eksport w oryginale to zwykła nawigacja przeglądarki (`window.location.href = …`), więc
**nie leci przez `fetch` i nie niesie nagłówka `Authorization`** — działa tylko na cookie
sesji. W odbudowie trasa jest za `requireAuth`; jeśli link ma zadziałać, musi polegać na
cookie `bridge_session` (`credentials: include` nie dotyczy nawigacji). Sprawdź to wcześnie,
bo to jest ta rzecz, która „działa u mnie" i pada na stagingu.

### 8.2 Pulpit `/` (home)

- Czyta `GET /api/history` (I5, `rebuild/backend/src/routes/history.ts`) — na stagingu
  zwraca dziś `[]`, bo tabela `history` nie ma jeszcze pisarza.
- **Klient alertów już istnieje** (I6, `18-FEATURE-widok-alerty`): `pobierzAlerty()`
  (`pages/alerty/api.ts`), `pogrupujAlerty()` i `filtrujAlerty()` (`pages/alerty/grupowanie.ts`),
  `queryKey: ["/api/alerts"]`. Nie pisz drugiego klienta. Pulpit oryginału filtruje alerty
  po statusie `nowy` i ogranicza do pięciu.
- KPI z 10a: hooki `useKpi()` i `useStatusHistorii()` w `pages/analityka/api.ts` są gotowe
  do reużycia; kafle są w `pages/analityka/NaglowekKpi.tsx`.
- `/` jest ostatnim placeholderem Iteracji 10 w `src/pages/placeholdery.ts`.

---

## 9. Czego blok NIE musi już budować — inwentarz z 10a, 10b, 10d i 10e

| Rzecz | Gdzie |
|---|---|
| Tabela z limitem 300 wierszy (port `I()`) | `pages/analityka/TabelaAnalityki.tsx` |
| Formatowanie liczb `pl-PL`, `—`, procenty (port `_()`, `D()`) | `pages/analityka/formatowanie.ts` |
| Hooki TanStack Query + typy z fixtures | `pages/analityka/api.ts` |
| Globalny pasek 6 filtrów + stan + semantyka OR/AND | `pages/analityka/FiltryGlobalne.tsx`, `filtrowanie.ts` |
| Wyszukiwalny multi-select (listy do 1000 pozycji) | `components/WyborZWyszukiwarka.tsx` |
| Wykresy: Recharts 3.x, kontener, tooltip, paleta, reguły | `components/ui/chart.tsx` |
| Popover (Radix) | `components/ui/popover.tsx` |
| Nagłówek KPI + banner historii | `pages/analityka/NaglowekKpi.tsx` |
| Wzorzec sekcji, krok po kroku | `pages/analityka/README.md` |
| Wzorcowa sekcja do skopiowania | `pages/analityka/SekcjaMarze.tsx` |
| Pasek postępu dostępności (port `O()`) | `pages/analityka/PasekDostepnosci.tsx` (10d, używa go też karta „4.1" z 10e) |
| Filtr kliencki po dostawcy — dla dowolnego wiersza z kolumną `dostawca` | `zastosujFiltryDostawcow` + `WYMIARY_DOSTAWCOW` w `pages/analityka/filtrowanie.ts` (10d; używa go też sekcja cen z 10b) |
| **Generyczny** filtr kliencki `zastosujFiltry(wiersze, wybor, mapowanie)` + `wymiaryZMapowania` — dowolny podzbiór sześciu wymiarów | `pages/analityka/filtrowanie.ts` (10e; `zastosujFiltryMarz` z 10a jest jego cienką nakładką) |
| Nagłówek karty (tytuł + notka o odfiltrowanych + notka o wymiarach pominiętych) | `pages/analityka/NaglowekSekcji.tsx` (10e) |
| Debounce 300 ms na polu tekstowym sterującym zapytaniem (10b) | `pages/analityka/useOpoznionaWartosc.ts` |
| Własny `queryFn` z jawnym query stringiem, klucz jako lista wartości a nie ścieżka (10b) — patrz §1.4 | `pages/analityka/api.ts` (`useHistoriaCenyProduktu`) |
| Sekcja z filtrem SERWEROWYM w najprostszym wariancie (cały adres w jednym segmencie klucza, stan kontrolki w `Analityka.tsx`) | `pages/analityka/SekcjaRotacji.tsx` (10e) |
| Kolejne przykłady wzorca sekcji (kopiuj obok `SekcjaMarze.tsx`) | trzy sekcje 10d: `SekcjaStabilnoscDostawcow.tsx` (pierwszy przykład sekcji **bez wykresu**), `SekcjaCyklZyciaDostawcow.tsx`, `SekcjaStanDostawcow.tsx`; `SekcjaCeny.tsx` z 10b i `SekcjaSezonowosci.tsx` z 10e — wzorzec wykresu **liniowego** (szereg czasowy) obok słupkowego z marż |

**Czego NIE ruszać:**
- tokenów `--chart-1..5` — pochodzą z arkusza produkcji, chroni je `test/tokeny.test.ts`;
  wynik walidacji i wynikające z niego reguły (max 4 serie, kolejność slotów 1-2-4-3-5,
  tabela pod wykresem obowiązkowa) są w nagłówku `components/ui/chart.tsx`;
- kolejności i etykiet zakładek — są 1:1 z oryginałem, blok wstawia treść w gotowe miejsce;
- `App.tsx` — `/analityka` jest już wpięta i ładowana leniwie; kolejne wykresy trafiają
  do tego samego chunku same z siebie.

---

## 10. Zanim napiszesz plan bloku — lista kontrolna

1. Dla **każdej** trasy bloku: `grep -o "analytics/<trasa>" mirror/frontend/assets/*.js | wc -l`.
   Zero trafień → nie odtwarzasz ekranu, tylko go wymyślasz → **pytanie do użytkownika**.
2. Dla każdej trasy: czy handler czyta `req.query`? Jeśli tak → parametr do `queryKey`.
   Jeśli nie → filtr kliencki przez `zastosujFiltry` + `useMemo`.
3. Sprawdź w `contract/fixtures/`, czy któraś tablica jest pusta → kształt wiersza pokryj
   testem jednostkowym, bo GATE go nie złapie.
4. Sprawdź kształt koperty (`{rows}` vs `{hasHistory, rows}` vs goła tablica) — §3.
5. Odpowiedź nowego backendu **nie może** zawierać `_przyciete`.
6. Nie odnotowuj `requireAuth` jako odstępstwa D1 — kontrakt już go wymaga.
7. **Sprawdź, czy kolumny, o które pyta SQL trasy, istnieją w schemacie**
   (`rebuild/schema/001_schema.sql`). Oryginalny `safeAll()` zamienia błąd schematu (kolumna
   nie istnieje) w pustą odpowiedź — zepsuta trasa wygląda identycznie jak trasa bez danych,
   tak jak w 10e (`availability/products`, `availability/sell-through` — §2, backlog #32).
   Pusty fixture sam tego nie ujawni.
