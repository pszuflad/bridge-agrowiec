# Analityka — ściąga wykonawcza dla bloków 10b–10f

**Do czego to jest.** `docs/rebuild-roadmap.md` §5 mówi, KTÓRY blok bierze które trasy.
Ten plik mówi, CO te trasy realnie robią i co realnie pokazuje oryginał — czyli to, czego
sesja 10a musiała się dowiedzieć sama i co kosztowało ją osobną rundę pytań do użytkownika.
Każdy fakt niżej jest **zweryfikowany w kodzie** (`mirror/backend/analytics_module.cjs`,
`deminified/frontend-index.js`, `contract/fixtures/`), nie przepisany z opisu iteracji.

**Zakres:** 27 tras `/api/analytics/*`. Blok 10a zamknął pięć z nich
(`filters`, `status`, `kpi`, `margins`, `bootstrap-current` — ticket
`19-FEATURE-analityka-fundament`). Ten dokument opisuje **pozostałe 22**.

**Zanim zaczniesz blok:** przeczytaj `rebuild/frontend/src/pages/analityka/README.md` —
wzorzec sekcji dashboardu, którego bloki 10b–10e mają się trzymać 1:1.

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
| `GET /api/analytics/top-zmiany` | 10b | |
| `GET /api/analytics/importy-timeline` | 10e | fixture jest **pustą tablicą** |
| `GET /api/analytics/ean-porownanie` | 10c | przyjmuje `?ean` |
| `GET /api/analytics/ean/details` | 10c | przyjmuje `?ean`; fixture ma puste `offers` |
| `POST /api/analytics/bootstrap-current` | ✅ 10a | dowieziona jako trasa bez UI (decyzja D4) |

**Pobierana, ale nigdzie nierenderowana** — osobny przypadek, jeszcze bardziej mylący:

- `GET /api/analytics/market/group-prices` (**blok 10b**). Widok `/analityka` wykonuje to
  zapytanie przy każdym wejściu, z `group=marka` na sztywno (`zM+53`), trzyma wynik
  w zmiennej `z`... i nigdy jej nie używa. Selektor grupy (`c`/`u`, `useState("marka")`)
  też nie ma żadnej kontrolki w UI. To martwy fetch.

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

---

## 2. Fixtures, które NIE dowodzą kształtu wiersza

`test/gate/ksztalt.ts:50` nie zagląda do elementów pustej tablicy. Jeśli Twoja trasa jest
na tej liście, GATE przepuści **dowolny** kształt wiersza — kształt trzeba pokryć testem
jednostkowym przeciw SQL-owi oryginału, tak jak 10a zrobiło dla `margins.low`/`high`.

| Fixture | Puste pola | Blok |
|---|---|---|
| `GET_analytics_availability_products.json` | `rows` | 10e |
| `GET_analytics_availability_sell-through.json` | `rows` | 10e |
| `GET_analytics_rotation_inactive.json` | `rows` | 10e |
| `GET_analytics_importy-timeline.json` | **cała odpowiedź** | 10e |
| `GET_analytics_ean_details.json` | `offers` | 10c |
| `GET_analytics_margins.json` | `low`, `high` | ✅ 10a (pokryte testem) |

**Blok 10e ma tu najsłabszą siatkę z całej iteracji** — cztery z sześciu jego fixtures są
puste albo częściowo puste. Zaplanuj na to testy jednostkowe od razu, nie po review.

---

## 3. Trzy kształty odpowiedzi — nie zakładaj jednego

| Kształt | Trasy |
|---|---|
| `{ hasHistory, rows }` | `suppliers/stability`, `availability/products`, `availability/sell-through`, `prices/inflation`, `seasonality/monthly`, `lifecycle/models`, `prices/product-history` (+ `stats`) |
| `{ rows }` (bez `hasHistory`) | `suppliers/lifecycle`, `suppliers/stock`, `ean/comparison`, `ean/unique`, `ean/coverage`, `ean/supplier-rank`, `prices/last-import` |
| **goła tablica** (bez koperty) | `dostawcy-stats`, `top-zmiany`, `importy-timeline` |
| inne | `market/group-prices` → `{ group, rows }` · `rotation/inactive` → `{ days, rows }` · `ean/details` → `{ ean, offers }` |

`hasHistory` liczy się z `historia_cen` przez pomocnika `hasHistory(db)` (`:58`) i mówi UI,
czy widok czasowy ma z czego rysować.

---

## 4. Blok 10b — Ceny

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
   `n || a ? fetch(…) : …`). Parametry idą do `queryKey`, nie do `useMemo`.
3. **„3.6 Inflacja cennika"** ← `prices/inflation`
   Kolumny: Miesiąc · Dostawca · Śr. cena · Zmiana %.

**Bez UI w oryginale:** `top-zmiany` (zero wywołań) i `market/group-prices` (martwy fetch —
patrz §1.1). Dla obu potrzebna decyzja użytkownika: pominąć, czy dołożyć jako nazwane
odstępstwo. **To jest pytanie do zadania PRZED planem, nie w trakcie.**

**⚠ `prices/product-history` to pierwszy prawdziwy czytelnik `historia_cen`** (decyzja D3
z roadmapy). Tabela ma pisarzy od 3d-1 (auto-zatwierdzanie importu) i od 10a
(`bootstrap-current`). Na stagingu może być pusta — wtedy `hasHistory: false` i tabela pusta;
to poprawne zachowanie, nie awaria.

---

## 5. Blok 10c — EAN

Trasy: `ean/comparison`, `ean/coverage`, `ean/details`, `ean/supplier-rank`, `ean/unique`,
`ean-porownanie`. Fixtures: 6.

| Trasa | Linia | Query | LIMIT | Kształt |
|---|---|---|---|---|
| `ean/comparison` | `:188` | `minDiffPct` | 1000 | `{ rows }` |
| `ean/details` | `:202` | `ean` | — | `{ ean, offers }` |
| `ean/unique` | `:210` | — | 1000 | `{ rows }` |
| `ean/coverage` | `:219` | — | — | `{ rows }` |
| `ean/supplier-rank` | `:224` | — | — | `{ rows }` |
| `ean-porownanie` | `:335` | `ean` | 200 | goła tablica |

**Zakładka w UI: `ean` „EAN i ceny"** (`fe.js:28175-28294`). Trzy karty:

1. **„2.1-2.4 Porównanie cen po EAN"** ← `ean/comparison`
   Kolumny: EAN · Nazwa · Dostawcy · Min · Max · Spread zł · Spread %. CSV (`ean-comparison`).
   ⚠ `minDiffPct` jest parametrem trasy, ale **oryginalny front go nie podaje** — woła
   `ean/comparison` bez query. Kontrolki filtra dla niego w UI nie ma.
2. **„2.5 Pozycje unikalne"** ← `ean/unique`
   Kolumny: EAN · Nazwa · Dostawca · Cena · Stan. CSV (`unique`).
3. **„2.6 Pokrycie wspólne i ranking dostawcy"** — **jedna karta, DWIE tabele**:
   - `ean/coverage` → Liczba dostawców · EAN (fixture: `{liczbaDostawcow, liczbaEAN}`)
   - `ean/supplier-rank` → Dostawca · Wspólne · Najtańszy · Najtańszy %
     (fixture: `{dostawca, wspolnePozycje, najtanszy, najtanszyPct}`)

**Bez UI w oryginale:** `ean/details` i `ean-porownanie` — obie przyjmują `?ean` i obie mają
zero wywołań w bundlu. Wyglądają na zaczątek „szczegółów jednego EAN-u", którego nikt nie
dokończył. Decyzja użytkownika przed planem.

**Kafle KPI oryginału zależą od tego bloku.** Oryginalny nagłówek `/analityka` liczy dwa
z czterech kafli z `ean/comparison.rows.length` („EAN wspólne") i `ean/unique.rows.length`
(„Pozycje unikalne"). Blok 10a świadomie wziął `GET /api/analytics/kpi` zamiast nich
(odstępstwo O-10a-1), żeby nie czekać na 10c. **Jeśli użytkownik zechce wrócić do kafli
oryginału, to jest moment** — dane będą już dostępne.

---

## 6. Blok 10d — Dostawcy

Trasy: `dostawcy-stats`, `suppliers/lifecycle`, `suppliers/stability`, `suppliers/stock`.
Fixtures: 4.

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
   CSV (`suppliers-stability`).
2. **„1.2 Nowości i wycofania"** ← `suppliers/lifecycle`
   Kolumny: Data · Dostawca · Typ · Kod · Nazwa · Powód. CSV (`suppliers-lifecycle`).
3. **„1.4 / 1.5 Stan i dostępność dostawcy"** ← `suppliers/stock`
   Kolumny: Dostawca · Produkty · Śr. stan · Dostępne · Dostępność.
   ⚠ Kolumna „Dostępność" renderuje się **paskiem postępu**, nie liczbą — pomocnik `O(e)`
   (`fe.js:27921`) dostaje `e.dostepnoscPct` i rysuje `<div>` szerokości 24 z zagnieżdżonym
   `<div>` o `width: n%` plus podpis `n%` monospace. To **jedyna nietabelaryczna wizualizacja
   w całym oryginalnym widoku** i występuje dwa razy: tutaj (`zM+366`) oraz w karcie „4.1"
   bloku 10e (`zM+650`). Kto pisze ją pierwszy, wydziela ją do wspólnego komponentu obok
   `TabelaAnalityki` — drugi blok ma ją zastać gotową. CSV (`suppliers-stock`).

**Bez UI w oryginale:** `dostawcy-stats` (zero wywołań). Zwraca gołą tablicę
`{dostawca, liczbaProduktow, avgMarza, avgCenaZakupu, dostepnych}` — merytorycznie
nakłada się na `suppliers/stock`. Decyzja użytkownika.

**⚠ Uwaga na zderzenie nazw z Iteracją 3f-2.** `/api/dostawcy` (widok Konfiguracja →
Dostawcy) to **inny zasób** niż `/api/analytics/dostawcy-stats`. Pierwszy jest już
odbudowany (`rebuild/backend/src/repos/suppliers.ts`, `routes/suppliers.ts`) i liczy
`liczbaProduktow`, przeliczony `status` i znaczniki zmian z `historia_cen`. Nie duplikuj
tamtej logiki — sprawdź `repos/suppliers.ts`, zanim napiszesz cokolwiek nowego.

---

## 7. Blok 10e — Dostępność / rotacja / cykl

Trasy: `availability/products`, `availability/sell-through`, `rotation/inactive`,
`lifecycle/models`, `seasonality/monthly`, `importy-timeline`. Fixtures: 6.

| Trasa | Linia | Query | LIMIT | Kształt |
|---|---|---|---|---|
| `availability/products` | `:156` | — | 500 | `{ hasHistory, rows }` — **fixture pusty** |
| `availability/sell-through` | `:173` | — | 500 | `{ hasHistory, rows }` — **fixture pusty** |
| `seasonality/monthly` | `:279` | — | — | `{ hasHistory, rows }` |
| `lifecycle/models` | `:285` | — | 1000 | `{ hasHistory, rows }` |
| `rotation/inactive` | `:299` | `days` | 1000 | `{ days, rows }` — **fixture pusty** |
| `importy-timeline` | `:334` | — | 200 | goła tablica — **fixture pusty** |

**Ten blok ma najsłabszą siatkę bezpieczeństwa w całej iteracji** — patrz §2.

**Dwie zakładki, nie jedna:**

**`dostepnosc` „Dostępność"** (`fe.js:28417-28515`) — trzy karty:
1. **„4.1 Historia dostępności pozycji"** ← `availability/products`
   Kolumny: Dostawca · Kod · EAN · Nazwa · Dostępność · Miesiące braków. CSV (`availability-products`).
   ⚠ „Dostępność" to **pasek postępu** `O(e.dostepnoscPct)` (`zM+650`) — ten sam, co w karcie
   „1.4 / 1.5" bloku 10d. Jeśli 10d wszedł wcześniej, komponent już jest; jeśli nie, wydziel go.
2. **„4.2 Tempo schodzenia z magazynu"** ← `availability/sell-through`
   Kolumny: Dostawca · Kod · Nazwa · Zeszło sztuk. CSV (`sell-through`).
3. **„4.4 Sezonowy wzorzec cen"** ← `seasonality/monthly`
   Kolumny: Miesiąc · Marka · Śr. cena · Dostępność.

**`marza` „Marża i rotacja"** — **ta zakładka jest już częściowo wypełniona przez 10a.**
Sekcja marż stoi na górze; dokładasz **pod nią**, w tej samej zakładce, w kolejności oryginału:
2. **„Rotacja / produkty bez aktualizacji"** ← `rotation/inactive`
   Kolumny: Ostatnia aktualizacja · Dostawca · Kod · Nazwa · Stan. CSV (`rotation-inactive`).
   ⚠ **Ma realną kontrolkę:** pole tekstowe „Bez ruchu dni" (`i`/`l`, `useState("60")`),
   wartość idzie do `?days` i **do `queryKey`** — to jest wzorzec „filtr → query param",
   w odróżnieniu od filtrów klienckich z 10a. Backend zaciska `days` do `[1, 730]`
   (`Math.min(730, Math.max(1, parseInt(req.query.days || '60', 10)))`).
3. **„4.6 Cykl życia modelu"** ← `lifecycle/models`
   Kolumny: Marka · Model · Pierwszy raz · Ostatni raz · Produkty. Bez CSV.

W `Analityka.tsx` te dwie karty zastępują `ZakladkaWPrzygotowaniu` z `blok="10e"`
w zakładce `marza` — komponent jest już tam osadzony jako miejsce docelowe.

**Bez UI w oryginale:** `importy-timeline` (zero wywołań, fixture pusty). Czyta `audit_log`
dla akcji importu. Decyzja użytkownika.

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

⚠ Przycisk „CSV" **nie istnieje w odbudowie** — 10a świadomie go pominęło (trasa eksportu
należy do tego bloku). 10f dokłada go do sekcji marż **i do każdej innej sekcji, która ma
go w oryginale** — lista wyżej mówi dokładnie do których. W oryginale przycisk siedzi
w nagłówku karty, po prawej: `<Button variant="outline" size="sm">CSV</Button>`.

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

## 9. Czego blok NIE musi już budować — inwentarz z 10a

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
