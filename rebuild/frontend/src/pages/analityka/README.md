# Wzorzec sekcji dashboardu — Iteracja 10 zamknięta (10a–10f)

Ten katalog powstał w bloku **10a** (ticket `19-FEATURE-analityka-fundament`) i jest
szablonem, którego trzymały się wszystkie kolejne bloki Iteracji 10. Iteracja jest
**zamknięta** (2026-09-04), moduł ma komplet 27/27 tras:

- **10d** (`23-FEATURE-analityka-dostawcy`) — zakładka `dostawcy`; trzy sekcje
  w `Sekcja{Stabilnosc,CyklZycia,Stan}Dostawcow.tsx` są drugim, niezależnym od marż
  przykładem tego wzorca (w tym sekcją bez wykresu);
- **10b** (`24-FEATURE-analityka-ceny`) — zakładka `ceny`; doprecyzował dwie rzeczy, które
  10a zostawiło otwarte: sposób podawania parametrów zapytania (§2.2) i debounce (§2.2a);
- **10e** (`25-FEATURE-analityka-dostepnosc-rotacja`) — wypełnił zakładkę „Dostępność"
  trzema kartami i dołożył dwie pod kartą marż w zakładce „Marża i rotacja"; wniósł trzy
  rzeczy do REUŻYCIA — `PasekDostepnosci`, `NaglowekSekcji` i generyczne `zastosujFiltry`
  (patrz §1 i §2.3);
- **10f** (`26-FEATURE-analityka-export-pulpit`) — ostatni blok: dołożył przycisk „CSV"
  do wszystkich dziesięciu kart, które mają go w oryginale, i odtworzył Pulpit `/`
  (osobny widok, poza tym katalogiem) — patrz §7.

Bloki **dokładają zakładki, nie przemeblowują widoku** — zakładki, ich kolejność
i etykiety już są i pochodzą z oryginału.

Zanim napiszesz linijkę kodu: przeczytaj „Trzy pułapki" na końcu. Każda z nich kosztowała
w 10a osobne dochodzenie.

---

## 1. Podział pracy między plikami

| Plik | Odpowiada za |
|---|---|
| `api.ts` | typy z fixtures + hooki TanStack Query. **Jedyne** miejsce, które wie o HTTP |
| `filtrowanie.ts` | stan globalnych filtrów, semantyka OR/AND, deklaracja wymiarów obsługiwanych przez sekcję |
| `formatowanie.ts` | port `_()` i `D()` z oryginału — liczby `pl-PL`, `—` dla pustych, procenty. `zaokraglij(wartosc, miejsca)` — do liczb, które sekcja LICZY SAMA (nie mylić z `formatuj()`, które zamienia na napis) |
| `TabelaAnalityki.tsx` | port `I()` z oryginału — kolumny, wyrównanie, `slice(0, 300)` |
| `PasekDostepnosci.tsx` | port `O()` z oryginału — pasek postępu w komórce „Dostępność". Wydzielony w 10d, bo woła go też karta „4.1" bloku 10e |
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
  `prices/product-history?ean&kod`) → parametr idzie do `queryKey`, filtrowanie na backendzie.

  ⚠ **SPROSTOWANE W 10b.** Ta sekcja radziła wcześniej doklejać parametr jako segment
  klucza (`["…/inactive", "?days=60"]`) i liczyć na to, że domyślny `queryFn` sklei go
  ze ścieżką. Oryginał robi to INACZEJ i to on rozstrzyga: pisze **własny `queryFn`**
  z jawnym query stringiem, a klucz trzyma jako listę wartości — segmenty klucza NIE SĄ
  tam ścieżką (`deminified/frontend-index.js:27870-27877`, `:27899-27905`):

  ```ts
  // Wariant prosty (10e, `rotation/inactive?days`) — CAŁY adres w JEDNYM segmencie klucza.
  // `queryKey.join("/")` z `lib/queryClient.ts` wstawiłby przy dwóch segmentach ukośnik przed
  // znakiem zapytania (`…/inactive/?days=60`). Ten sam wzorzec niosą `pages/Staging.tsx`
  // i `pages/Historia.tsx` (`adresStrony`); domyślny `queryFn` wystarcza.
  useQuery({ queryKey: [`/api/analytics/rotation/inactive?days=${dni}`] });

  // Wariant z własnym `queryFn` (10b, `prices/product-history`) — potrzebny tylko wtedy, gdy
  // zapytanie ma się NIE wykonać przy pustych parametrach.
  useQuery({
    queryKey: ["/api/analytics/prices/product-history", ean, kod],
    queryFn: async () => {
      if (!ean && !kod) return PUSTA_ODPOWIEDZ;   // port `n || a ? fetch(…) : …`
      const url = `${BAZA_API}/api/analytics/prices/product-history`
        + `?ean=${encodeURIComponent(ean)}&kod=${encodeURIComponent(kod)}`;
      const odpowiedz = await fetch(url, { headers: naglowki(false), credentials: "include" });
      if (odpowiedz.status === 401) return null;   // konwencja `on401: "returnNull"`
      await rzucGdyBlad(odpowiedz);
      return await odpowiedz.json();
    },
  });
  ```

  Gotowy przykład: `useHistoriaCenyProduktu` w `api.ts`. Pamiętaj o `401 → null` — przy
  własnym `queryFn` nikt nie zrobi tego za Ciebie.

### 2.2a Pole tekstowe sterujące zapytaniem → debounce

`useOpoznionaWartosc(wartosc)` (300 ms) stoi w tym katalogu od 10b. Nie pisz drugiego.

To **świadome odstępstwo O-10b-1**: oryginał wysyła zapytanie na każde naciśnięcie klawisza,
a trasy przyjmujące `?ean` nie mają LIMIT-u. Blok 10c ma `ean/details?ean`
i `ean-porownanie?ean` w dokładnie tej samej sytuacji — użyj tego hooka i odnotuj
odstępstwo w swoim `plan.md`, zamiast wymyślać je od nowa.
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
a wiersz z pustą wartością odpada, gdy ten wymiar filtruje. Generyk `zastosujFiltry` powstał
w 10e, kiedy sekcji zrobiło się sześć — nie pisz kolejnej kopii tej pętli.

Dla wierszy z kolumną `dostawca` jest też węższe `zastosujFiltryDostawcow()`
(`filtrowanie.ts`, blok 10d) — nie pisz własnej wersji filtra po dostawcy dla każdej tabeli.
Bloki 10c i 10d napisały tę samą funkcję równolegle pod dwiema nazwami i duplikat trzeba było
usuwać przy scalaniu (2026-09-04); zanim dołożysz pomocnika, sprawdź, czy sąsiedni blok już go
nie wniósł.

⚠ **Gdy karta ma dwie tabele reagujące RÓŻNIE na ten sam filtr** (jedna filtruje, druga nie
— bo jej wiersz nie niesie odpowiedniej kolumny), powiedz o tym wprost osobną notką przy
tabeli, która filtra NIE stosuje. Bez tego wygląda to jak zacięty filtr, nie jak świadome
ograniczenie (wzorzec: karta „2.6" w `SekcjaEan.tsx` z 10c — ranking dostawców filtruje,
histogram pokrycia nie). Sekcje 10e robią to samo przez `NaglowekSekcji`, który dostaje
wynik `wymiaryNieobslugiwane(...)` i sam wypisuje pominięte wymiary.

### 2.4 Tabela

Zawsze przez `TabelaAnalityki`. Kolumny przepisz **1:1 z oryginału** — etykiety PL,
`right` dla liczb, `mono` dla kodów i znaczników czasu:

```tsx
<TabelaAnalityki dane={wiersze} kolumny={KOLUMNY} testId="tabela-inflacja" />
```

Limit 300 renderowanych wierszy jest z oryginału (`frontend-index.js:27953`) i zostaje.
Stopkę „Pokazano 300 z N" dokłada sam komponent.

**Karta z dwiema tabelami** (wzorzec z 10c, `SekcjaEan.tsx`, karta „2.6"): gdy oryginał
łączy dwa agregaty w jedną kartę, użyj `grid gap-4 p-4 md:grid-cols-2` i połóż każdą tabelę
(ewentualnie z własnym wykresem nad nią) w swojej kolumnie grida.

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
   Dla słupka **pionowego** użyj `PROMIEN_SLUPKA_PIONOWEGO` (`chart.tsx`), nie
   `PROMIEN_SLUPKA` — Recharts liczy `radius` zawsze w kolejności [lewy-górny, prawy-górny,
   prawy-dolny, lewy-dolny] niezależnie od orientacji, więc wariant poziomy na wykresie
   pionowym zaokrągli złą krawędź słupka.
2. **Nigdy dwie osie Y.** Dwie miary o różnej skali → dwa wykresy albo indeksowanie do wspólnej bazy.
3. **≤ 4 serie.** Piąta i dalsze składają się w „Pozostałe" albo idą w small multiples.
4. **Sloty koloru w kolejności `KOLORY_WYKRESU`** — 1 → 2 → 4 → 3 → 5. Sloty 3 i 5 mają
   najniższą chromę (walidator: `#33998d` 0.094, `#435670` 0.049), więc idą na końcu.
5. **Kolor należy do BYTU, nie do pozycji.** Filtr zmieniający liczbę serii nie może
   przemalować ocalałych. Praktycznie znaczy to tyle: **zestaw serii licz z odpowiedzi
   SUROWEJ, nie z wierszy po filtrze** — inaczej odznaczenie jednego bytu przesunie
   pozostałe o slot. Wzorzec: `dostawcyNaWykres()` w `SekcjaCeny.tsx`.
6. **Sprawdź, czy w danych jest w ogóle szereg.** Linia przez jeden punkt to nie wykres
   czasowy. `SekcjaCeny` wymaga dwóch różnych miesięcy (`MIN_MIESIECY_NA_WYKRESIE`)
   i przy jednym pokazuje samą tabelę — tak jak wygląda cały oryginał.
7. **Legenda przy ≥2 seriach, nigdy przy jednej** (tytuł już nazywa, co jest rysowane).
8. **Etykiety noszą tokeny tekstu**, nigdy koloru serii. Wartości przy końcach słupków,
   selektywnie — nie liczba przy każdym punkcie.
9. **Tabela pod wykresem jest obowiązkowa.** To nie ozdoba: walidator zgłasza dla
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

**Każdy blok zakłada WŁASNE pliki testowe** (`analityka.<blok>.gate.test.ts`,
`analityka.<blok>.test.tsx`, `analityka.<blok>.filtrowanie.test.ts` — wzorzec z 10c),
zamiast dopisywać do plików 10a. Bloki 10b–10e idą równolegle i wspólne pliki testowe to
gwarantowany konflikt przy merge'u. **Jedyny wyjątek:** handlery MSW nowej zakładki trzeba
dodać do `zamockujApi` w `test/analityka.test.tsx` — widok pobiera wszystkie trasy przy
każdym wejściu, a `onUnhandledRequest: "error"` wywala test bez nich.

⚠ **Progi czasowe już podniesione** (10c, po tym jak pełny `vitest run` padał losowo pod
obciążeniem): `vitest.config.ts` ma `testTimeout`/`hookTimeout` 20 s, `test/setup.ts` ma
`asyncUtilTimeout` 5 s. Nie trzeba tego robić drugi raz.

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

**1:1 z oryginałem (10a):** tytuł i podtytuł strony · banner o zasięgu historii cen (z surowym
znacznikiem ISO) · pięć zakładek, ich kolejność i etykiety PL · domyślna zakładka
„Dostawcy" · karta „Marża per dostawca/kategoria/marka" z siedmioma kolumnami · limit 300
wierszy · pobieranie `margins.low`/`high` bez renderowania ich.

**1:1 z oryginałem (10c, zakładka „EAN i ceny"):** trzy karty i ich tytuły z numeracją
oryginału („2.1-2.4", „2.5", „2.6") · komplet kolumn i wyrównania (`right`/`mono`) ·
układ karty „2.6" jako jednej karty z dwiema tabelami.

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

**Blok 10f — co dołożył** (ticket `26-FEATURE-analityka-export-pulpit`, decyzje D1–D5
użytkownika z 2026-09-04; szczegóły w §7):

| # | Co | Dlaczego |
|---|---|---|
| O-10f-1 | Karta powiadomień i kafel alertów Pulpitu na realnych `/api/alerts`, zamiast pseudo-alertów katalogowych `pv()` | D1 — kontynuacja odstępstwa D1 z Iteracji 6 (backlog #26) |
| — | Przycisk „CSV" w dziesięciu kartach `/analityka` | D4 — trasa `export/{view}` wreszcie istnieje; 10a i 10d świadomie ją pomijały do tego momentu |

**1:1 z oryginałem, choć wygląda na defekt:** karty „4.1 Historia dostępności pozycji"
i „4.2 Tempo schodzenia z magazynu" są **puste zawsze**. Ich zapytania pytają `historia_cen`
o kolumnę `nazwa`, której ta tabela nie ma — produkcja połyka błąd i zwraca `rows: []` mimo
15 597 migawek w historii (dowód w fixtures). Odtwarzamy to zachowanie; sprawa czeka na
decyzję jako wpis **#32** w `docs/rebuild-backlog.md`. Nie „naprawiaj" tego przy okazji
innego bloku — to jest zmiana zachowania produkcji i wymaga decyzji użytkownika.

## 5. Co ustalił blok 10b (`24-FEATURE-analityka-ceny`, 2026-09-04)

**1:1 z oryginałem:** trzy karty zakładki `ceny` w kolejności i z tytułami oryginału ·
etykiety i wyrównania wszystkich kolumn · brak kolumny „EAN" w tabeli historii, choć API
ją zwraca · statyczny tekst „Wykres/tabela zapełnią się po zebraniu historii cen."
renderowany zawsze · brak zapytania o `product-history`, dopóki oba pola są puste ·
`stats` pobierane i nierenderowane.

| # | Odstępstwo | Dlaczego |
|---|---|---|
| O-10b-1 | debounce 300 ms na polach EAN/Kod | oryginał pyta na każdy klawisz, a trasa nie ma LIMIT-u |
| O-10b-2 | wykres liniowy w karcie inflacji | rozszerzenie O-10a-3 |
| D1 | `top-zmiany` — backend bez UI | zero wywołań w bundlu produkcji |
| D2 | `market/group-prices` — backend bez UI | martwy fetch: wołana i ignorowana |

**Gotowe do reużycia:** `useOpoznionaWartosc` (debounce),
`zastosujFiltryDostawcow` (generyczny filtr po dostawcy, wspólny z blokiem 10d),
`WYMIARY_CEN` jako przykład deklaracji wymiarów obsługiwanych przez sekcję.

## 6. Co ustalił blok 10c (`22-FEATURE-analityka-ean`)

Odstępstwa bloku 10c (decyzje D1–D6, `docs/tickets/22-FEATURE-analityka-ean/plan.md`):

| # | Co | Dlaczego |
|---|---|---|
| O-10c-1 | Dwa wykresy w karcie „2.6" (histogram pokrycia + ranking dostawców) + liczba nagłówkowa „% EAN-ów u ≥2 dostawców" | D2; oryginał nie ma wykresów, infrastruktura z O-10a-3 stoi |
| O-10c-2 | Notka o wymiarach filtra, których dana tabela w karcie nie stosuje | D4; oryginał nie ma globalnych filtrów (odstępstwo O-10a-2) |

## 7. Co ustalił blok 10f (`26-FEATURE-analityka-export-pulpit`, 2026-09-04) — ostatni blok Iteracji 10

Dołożył ostatnią, 27. trasę modułu (`GET /api/analytics/export/{view}`) i przycisk „CSV"
w dziesięciu kartach, które mają go w oryginale — logika w `pages/analityka/eksport.tsx`
(`PrzyciskCsv`, `adresEksportu()`), nie w tym katalogu wprost, bo przycisk jest współdzielony
przez sekcje z kilku bloków.

**Wpięcie w karty — trzy warianty tego samego układu „tytuł po lewej, akcje po prawej":**
cztery sekcje (`SekcjaMarze`, `SekcjaDostepnosciProduktow`, `SekcjaRotacji`,
`SekcjaTempaSchodzenia`) dostają przycisk przez gotowy slot `obok?: ReactNode`
w `NaglowekSekcji` (§1); `SekcjaEan` i `SekcjaCeny` (karta `prices-last`) mają własne nagłówki
inline i dostały analogiczny prop `obok` o identycznym markupie; trzy sekcje dostawców
(`SekcjaStabilnoscDostawcow`, `SekcjaCyklZyciaDostawcow`, `SekcjaStanDostawcow`) mają nagłówek
inline bez wspólnego propa — przycisk jest tam wstawiony wprost w tym samym układzie
(`flex items-center justify-between gap-2`), bo te trzy karty i tak nie przechodzą przez
`NaglowekSekcji` (nie liczą notek o filtrach).

**Dlaczego to musi być `window.location.href`, a nie `fetch`:** oryginał eksportuje przez
zwykłą nawigację przeglądarki, więc żądanie **nie niesie nagłówka `Authorization`** i
uwierzytelnia się wyłącznie cookie'em `bridge_session`. `fetch` + `blob` zmieniłby model
autoryzacji i **zerwał zgodność z produkcją** — działa tylko dzięki temu, że cookie ma
`SameSite=Lax` (wysyłane przy nawigacji GET najwyższego poziomu) i staging jest same-origin;
dowiedzione testem integracyjnym na prawdziwym serwerze
(`rebuild/backend/test/analityka.eksport.gate.test.ts`).

⚠ **Eksport NIE zwraca tego, co widać w tabeli.** Każdy `{view}` ma własny SQL po stronie
backendu, inny niż trasa dashboardu o tej samej nazwie, i nie niesie żadnych filtrów ani
parametrów — `adresEksportu()` nie dokleja query stringu. Dwa widoki
(`availability-products`, `sell-through`) oddają **pusty plik** (sam BOM) z powodu backlogu
#32 (`historia_cen` bez kolumny `nazwa`) — odtworzone 1:1, nie naprawiane.

| # | Co | Dlaczego |
|---|---|---|
| O-10f-1 | Karta powiadomień i kafel alertów Pulpitu na realnych `/api/alerts`, zamiast pseudo-alertów katalogowych `pv()` z oryginału | D1 — kontynuacja odstępstwa D1 z Iteracji 6 (backlog #26); „Zobacz wszystkie" prowadzi do `/alerty`, który i tak stoi na `/api/alerts` |

Pulpit `/` (`src/pages/Pulpit.tsx`, `src/pages/pulpit/`) jest osobnym widokiem poza tym
katalogiem — szczegóły w `docs/analityka-bloki-10b-10f.md` §8.2.
