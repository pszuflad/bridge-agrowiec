# Wzorzec sekcji dashboardu — obowiązuje bloki 10b–10e

Ten katalog powstał w bloku **10a** (ticket `19-FEATURE-analityka-fundament`) i jest
szablonem dla reszty Iteracji 10. Bloki 10b–10e **dokładają zakładki, nie przemeblowują
widoku** — zakładki, ich kolejność i etykiety już są i pochodzą z oryginału.

**Blok 10e jest zrobiony** (ticket `25-FEATURE-analityka-dostepnosc-rotacja`): wypełnił
zakładkę „Dostępność" trzema kartami i dołożył dwie pod kartą marż w zakładce „Marża
i rotacja". Wraz z nim doszły trzy rzeczy do REUŻYCIA, nie do przepisania — `PasekDostepnosci`,
`NaglowekSekcji` i generyczne `zastosujFiltry` (patrz §1 i §2.3).

Zanim napiszesz linijkę kodu: przeczytaj „Trzy pułapki" na końcu. Każda z nich kosztowała
w 10a osobne dochodzenie.

---

## 1. Podział pracy między plikami

| Plik | Odpowiada za |
|---|---|
| `api.ts` | typy z fixtures + hooki TanStack Query. **Jedyne** miejsce, które wie o HTTP |
| `filtrowanie.ts` | stan globalnych filtrów, semantyka OR/AND, deklaracja wymiarów obsługiwanych przez sekcję |
| `formatowanie.ts` | port `_()` i `D()` z oryginału — liczby `pl-PL`, `—` dla pustych, procenty |
| `TabelaAnalityki.tsx` | port `I()` z oryginału — kolumny, wyrównanie, `slice(0, 300)` |
| `NaglowekKpi.tsx` | banner historii + cztery kafle. Nie ruszać — to nagłówek całej strony |
| `FiltryGlobalne.tsx` | sześć kontrolek. Nie ruszać — filtry są wspólne dla zakładek |
| `NaglowekSekcji.tsx` | tytuł karty + notka „filtry ukryły N z M" + notka o wymiarach pominiętych |
| `PasekDostepnosci.tsx` | port `O()` — pasek procentu dostępności w komórce tabeli (10e) |
| `Sekcja<Nazwa>.tsx` | **to piszesz w swoim bloku** |
| `../Analityka.tsx` | montuje sekcje w zakładkach; podmieniasz `ZakladkaWPrzygotowaniu` na swoją sekcję |

---

## 2. Krok po kroku: nowa sekcja

### 2.1 Typ i hook w `api.ts`

Typ przepisz z **fixture'a**, nie z `openapi.yaml` — ten dla analityki nie ma żadnych
schematów odpowiedzi (same kody 200/400/401 i `security`). Fixture jest jedynym
świadectwem kształtu.

```ts
export type WierszInflacji = { /* … pola z GET_analytics_prices_inflation.json … */ };

export function useInflacjaCen(): UseQueryResult<{ rows: WierszInflacji[] } | null> {
  return useQuery({ queryKey: ["/api/analytics/prices/inflation"] });
}
```

Klucz zapytania **jest ścieżką** — `lib/queryClient.ts` skleja `queryKey.join("/")` w URL
i dokłada nagłówki. Nie pisz własnego `queryFn`.

Typ ma `| null`, bo `on401: "returnNull"` z oryginału oznacza, że na wygasłej sesji
`data` jest `null`, a nie błędem. Sekcja musi to przeżyć.

### 2.2 Filtry: parametr czy `useMemo`?

**Rozstrzyga oryginał, nie wygoda.** Sprawdź w `mirror/backend/analytics_module.cjs`,
czy handler czyta `req.query`:

- **czyta** (`rotation/inactive?days`, `market/group-prices?group`,
  `prices/product-history?ean&kod`) → parametr idzie do `queryKey`, filtrowanie na backendzie:
  ```ts
  // CAŁY adres w JEDNYM segmencie klucza — `queryKey.join("/")` z `lib/queryClient.ts`
  // wstawiłby przy dwóch segmentach ukośnik przed znakiem zapytania (`…/inactive/?days=60`).
  // Ten sam wzorzec niosą `pages/Staging.tsx` i `pages/Historia.tsx` (`adresStrony`).
  useQuery({ queryKey: [`/api/analytics/rotation/inactive?days=${dni}`] });
  ```
- **nie czyta** (jak `margins`) → filtruj klientem, przez `zastosujFiltry*` w `useMemo`.

Czego **nie** wolno: ożywiać `currentWhere()` (`analytics_module.cjs:60-74`). Ta funkcja jest
zbudowana pod sześć wymiarów filtra i ma **zero wywołań w całych 27 trasach** — to martwy kod.
Wywołanie jej dałoby zachowanie, którego nie pokrywa żaden fixture. Jeśli uznasz, że sekcja
tego potrzebuje, to jest decyzja użytkownika i nowe, nazwane odstępstwo — nie skrót.

### 2.3 Zadeklaruj, których wymiarów sekcja NIE stosuje

Filtry są globalne, ale wiersz Twojej sekcji nie musi nieść wszystkich sześciu kolumn.
`margins` grupuje po `dostawca`/`kategoria`/`marka`, więc model, rozmiar i oba indeksy
w odpowiedzi **nie istnieją** — `GROUP BY` je zwinął.

Nie zwijaj wtedy tabeli do zera i nie udawaj, że filtr zadziałał. Zadeklaruj MAPOWANIE
„wymiar → pole wiersza"; wymiar nieobecny w mapie to wymiar, którego sekcja nie stosuje,
i o którym `NaglowekSekcji` powie użytkownikowi wprost:

```ts
const MAPOWANIE: MapowanieWymiarow<MojWiersz> = {
  dostawcy: (w) => w.dostawca,
  marki: (w) => w.marka,
};

const wiersze = useMemo(() => zastosujFiltry(dane?.rows ?? [], wybor, MAPOWANIE), [dane, wybor]);
const pominiete = wymiaryNieobslugiwane(wybor, wymiaryZMapowania(MAPOWANIE));
```

Semantyka jest jedna dla wszystkich sekcji: **OR wewnątrz wymiaru, AND między wymiarami**,
a wiersz z pustą wartością odpada, gdy ten wymiar filtruje. Generyk powstał w 10e, kiedy
sekcji zrobiło się sześć — nie pisz szóstej kopii tej pętli.

### 2.4 Tabela

Zawsze przez `TabelaAnalityki`. Kolumny przepisz **1:1 z oryginału** — etykiety PL,
`right` dla liczb, `mono` dla kodów i znaczników czasu:

```tsx
<TabelaAnalityki dane={wiersze} kolumny={KOLUMNY} testId="tabela-inflacja" />
```

Limit 300 renderowanych wierszy jest z oryginału (`frontend-index.js:27953`) i zostaje.
Stopkę „Pokazano 300 z N" dokłada sam komponent.

### 2.5 Wykres (opcjonalny, ale jeśli już — to tak)

Wykresy są **odstępstwem od oryginału** (O-10a-3): produkcyjny bundle nie ma ani jednej
biblioteki wykresów. Dokładaj je tam, gdzie realnie pomagają, i zawsze **nad tabelą
z tymi samymi liczbami**, nigdy zamiast niej.

```tsx
<KontenerWykresu wysokosc={320} opis="…co przedstawia…">
  <BarChart …>…</BarChart>
</KontenerWykresu>
```

Reguły z `components/ui/chart.tsx` (wywiedzione ze skilla `dataviz` i z **przewalidowanej**
palety projektu) — łamanie ich to błąd, nie kwestia gustu:

1. **Forma z zadania, nie z upodobania.** Porównanie wielkości → słupek (poziomy, gdy nazwy
   kategorii są długie). Zmiana w czasie → linia. Kilka liczb nagłówkowych → kafle, nie wykres.
2. **Nigdy dwie osie Y.** Dwie miary o różnej skali → dwa wykresy albo indeksowanie do wspólnej bazy.
3. **≤ 4 serie.** Piąta i dalsze składają się w „Pozostałe" albo idą w small multiples.
4. **Sloty koloru w kolejności `KOLORY_WYKRESU`** — 1 → 2 → 4 → 3 → 5. Sloty 3 i 5 mają
   najniższą chromę (walidator: `#33998d` 0.094, `#435670` 0.049), więc idą na końcu.
5. **Kolor należy do BYTU, nie do pozycji.** Filtr zmieniający liczbę serii nie może
   przemalować ocalałych.
6. **Legenda przy ≥2 seriach, nigdy przy jednej** (tytuł już nazywa, co jest rysowane).
7. **Etykiety noszą tokeny tekstu**, nigdy koloru serii. Wartości przy końcach słupków,
   selektywnie — nie liczba przy każdym punkcie.
8. **Tabela pod wykresem jest obowiązkowa.** To nie ozdoba: walidator zgłasza dla
   `--chart-1` i `--chart-4` kontrast do tła poniżej 3:1 (2.61 i 2.76), a skill `dataviz`
   mówi wprost, że takiego ostrzeżenia nie wolno zignorować — zdejmuje je widoczna etykieta
   albo widok tabelaryczny. Mamy oba.

**Palety nie wolno zmieniać.** `--chart-1..5` przyszły z surowego arkusza produkcji w I1
i chroni je test-strażnik `test/tokeny.test.ts`. Pełny wynik walidacji (co przeszło, co nie
i dlaczego to nie blokuje) siedzi w nagłówku `components/ui/chart.tsx`.

### 2.6 Wepnij w zakładkę

W `../Analityka.tsx` podmień `ZakladkaWPrzygotowaniu` na swoją sekcję. Wzorzec dokładania
do zakładki JUŻ WYPEŁNIONEJ pokazuje blok 10e: zakładka `marza` niesie sekcję marż z 10a
na górze, a rotację i cykl życia **pod nią**, w tej samej zakładce, bo tak jest w oryginale
(`frontend-index.js:28516-28640`).

⚠ Dokładając kartę do zakładki, która już ma tabelę, sprawdź testy poprzedniego bloku:
zapytania w rodzaju `getByText("Brak danych")` przestają być jednoznaczne i muszą zejść
do `within(getByTestId("tabela-…"))`. To jedyna zmiana, jakiej 10e musiało dokonać
w testach 10a — poza dopisaniem handlerów MSW dla nowych tras, bez których
`onUnhandledRequest: "error"` zgłasza żądanie bez mocka.

### 2.7 Testy

Dwa pliki, wzorowane na `test/analityka.test.tsx` i `test/analityka.filtrowanie.test.ts`:

- **widok (MSW)** — dane z fixtures przez loader w `test/msw/kontrakt.ts`. Dopisz swój
  loader obok istniejących; **musi zdejmować klucze na `_`** (patrz pułapka 1).
- **jednostka** — czysta funkcja filtrowania/przeliczania, bez DOM-u.

---

## 3. Trzy pułapki, które kosztowały czas w 10a

**1. `_przyciete` w fixtures NIE JEST polem API.** To adnotacja nagrywarki
(`contract/README.md:29` — duże tablice przycięto do 5 elementów, 27 MB → 247 KB). Backend
go nie zwraca i zwracać nie może: harness GATE zgłasza klucz nadmiarowy w odpowiedzi jako
różnicę, więc dorobienie go **wywala gate**. W mockach MSW zdejmuj go loaderem, inaczej test
widoku pracuje na kształcie, którego w produkcji nie ma.

**2. Puste tablice w fixture nie dowodzą kształtu wiersza.** `margins.low` i `margins.high`
są puste, bo w chwili nagrywania cała produkcja mieściła się w marży (5, 80).
`gate/ksztalt.ts` nie zagląda do elementów pustej tablicy — kształt takich wierszy trzeba
pokryć **testem jednostkowym backendu**, nie gatem. To samo dotyczy każdej pustej listy
w Twoich fixtures.

**3. Sprawdź, czy oryginalny frontend w ogóle woła Twoją trasę.** `GET /api/analytics/kpi`
istnieje, ma fixture i wygląda na źródło nagłówka — a produkcyjny bundle nie woła go ani razu
(`analytics_module.cjs:324`: *„Backward-compatible aliases used by previous frontend build"*).
Zanim uznasz, że coś odtwarzasz, zgrepuj ścieżkę w `deminified/frontend-index.js`. Jeśli
trafień nie ma, budujesz coś nowego — a to wymaga decyzji użytkownika, nie domysłu.

---

## 4. Co w 10a jest odbudową, a co odstępstwem

Ściąga, żeby kolejne bloki nie musiały tego odtwarzać z gita.

**1:1 z oryginałem:** tytuł i podtytuł strony · banner o zasięgu historii cen (z surowym
znacznikiem ISO) · pięć zakładek, ich kolejność i etykiety PL · domyślna zakładka
„Dostawcy" · karta „Marża per dostawca/kategoria/marka" z siedmioma kolumnami · limit 300
wierszy · pobieranie `margins.low`/`high` bez renderowania ich.

**Świadome odstępstwa** (decyzje użytkownika D1–D4 z 2026-09-03, `docs/tickets/19-FEATURE-analityka-fundament/plan.md`):

| # | Co | Dlaczego |
|---|---|---|
| O-10a-1 | Kafle KPI z `/api/analytics/kpi` zamiast z `filters`/`ean/*`/`status` | oryginalne kafle wymagają tras z bloku 10c; te dają sensowne liczby od razu |
| O-10a-2 | Globalny pasek sześciu wyszukiwalnych filtrów | oryginał pobiera `filters`, ale renderuje z nich tylko `dostawcy.length` |
| O-10a-3 | Wykres w sekcji marż | oryginał nie ma żadnych wykresów; infrastruktura potrzebna blokom 10b–10e |
| O-10a-4 | Cztery zakładki puste do czasu 10b–10e | zakres bloku, nie zmiana zachowania |
| — | `/analityka` ładowana leniwie | Recharts podnosił wspólny bundle z 451 do 837 kB, a używa go tylko ten widok |
| — | `POST bootstrap-current` bez przycisku | trasa nieidempotentna, a oryginalny frontend nigdy jej nie woła |

**Blok 10e — co dołożył** (ticket `25-FEATURE-analityka-dostepnosc-rotacja`, decyzje D1–D4
użytkownika z 2026-09-03):

| # | Co | Dlaczego |
|---|---|---|
| O-10e-1 | Wykres liniowy w karcie „4.4 Sezonowy wzorzec cen" | jedna seria (średnia po wszystkich markach), bo marek bywa kilkadziesiąt, a limit to 4 serie; pełny podział jest w tabeli pod wykresem |
| — | `GET /api/analytics/importy-timeline` bez UI | oryginalny bundle nie woła tej trasy ani razu — karta byłaby nowym ekranem, nie odbudową |

**1:1 z oryginałem, choć wygląda na defekt:** karty „4.1 Historia dostępności pozycji"
i „4.2 Tempo schodzenia z magazynu" są **puste zawsze**. Ich zapytania pytają `historia_cen`
o kolumnę `nazwa`, której ta tabela nie ma — produkcja połyka błąd i zwraca `rows: []` mimo
15 597 migawek w historii (dowód w fixtures). Odtwarzamy to zachowanie; sprawa czeka na
decyzję jako wpis **#32** w `docs/rebuild-backlog.md`. Nie „naprawiaj" tego przy okazji
innego bloku — to jest zmiana zachowania produkcji i wymaga decyzji użytkownika.
