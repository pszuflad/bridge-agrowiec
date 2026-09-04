# 24-FEATURE-analityka-ceny — raport z wdrożenia

## Podsumowanie

Blok 10b Iteracji 10 dowieziony: pięć tras `/api/analytics/*` za `requireAuth` z agregatami
przepisanymi dosłownie z `mirror/backend/analytics_module.cjs`, oraz wypełniona zakładka
`ceny` („Ceny w czasie") z trzema kartami oryginału. Dwie trasy — `top-zmiany`
i `market/group-prices` — dostały backend **bez UI**, bo oryginał ich nie renderuje
(decyzje D1/D2). GATE zielony za pierwszym uruchomieniem; agregaty sprawdzone dodatkowo
na snapshocie produkcji i **odtwarzają wartości z nagrań**, nie tylko ich kształt.

## Zmiany

**Backend**

- `rebuild/backend/src/repos/analityka.ts` — sekcja „BLOK 10b · CENY": `czyJestHistoria`
  (port `hasHistory`, `:58`), `cenyGrupRynku`, `zmianyCenOstatniegoImportu`, `topZmiany`,
  `historiaCenProduktu`, `statystykiCen` (port `stats` z `:259-260`), `inflacjaCennika`;
  whitelista `GRUPY_RYNKU`/`KOLUMNY_GRUP_RYNKU` + `zacisnijGrupeRynku`; cztery nazwane
  limity (500/500/500/100).
- `rebuild/backend/src/routes/analytics.ts` — pięć `router.get(…, requireAuth, …)`
  w kolejności rejestracji z oryginału.

**Frontend**

- **Nowy:** `rebuild/frontend/src/pages/analityka/SekcjaCeny.tsx` — trzy karty
  (`3.1`, `3.2 / 3.3`, `3.6`) z kolumnami 1:1, wykres liniowy nad tabelą inflacji.
- **Nowy:** `rebuild/frontend/src/pages/analityka/useOpoznionaWartosc.ts` — debounce 300 ms.
- `rebuild/frontend/src/pages/analityka/api.ts` — pięć typów z fixtures + trzy hooki,
  w tym `useHistoriaCenyProduktu` z własnym `queryFn`.
- `rebuild/frontend/src/pages/analityka/filtrowanie.ts` — `WYMIARY_CEN`,
  `zastosujFiltrDostawcow` (generyczny).
- `rebuild/frontend/src/pages/Analityka.tsx` — `ZakladkaWPrzygotowaniu blok="10b"` → `SekcjaCeny`.
- `rebuild/frontend/src/pages/analityka/README.md` — sprostowany §2.2, nowy §2.2a
  (debounce), rozszerzone reguły wykresu, nowy §5 z dorobkiem 10b.

**Testy**

- **Nowy:** `rebuild/backend/test/analityka.ceny.gate.test.ts` — 12 przypadków.
- **Nowy:** `rebuild/backend/test/analityka.ceny.agregaty.test.ts` — 23 przypadki.
- **Nowy:** `rebuild/frontend/test/analityka.ceny.test.tsx` — 19 przypadków.
- `rebuild/backend/test/gate/dane.ts` — `zasiejHistorieCenDlaCen` (nowy zasiew, istniejący
  `zasiejHistorieCen` nietknięty).
- `rebuild/frontend/test/msw/kontrakt.ts` — trzy loadery zdejmujące klucze na `_`.

## Odstępstwa od planu

Dwa doprecyzowania względem planu, oba wynikły z kodu i żadne nie zmienia zakresu:

1. **Hook debounce nazywa się `useOpoznionaWartosc`, nie `uzyjOpoznionejWartosci`.**
   Reguła `react-hooks/rules-of-hooks` wymaga prefiksu `use`; reszta projektu ma tę samą
   konwencję (`useFiltry`, `useMarze`).
2. **Wykres inflacji ma próg `MIN_MIESIECY_NA_WYKRESIE = 2`.** Plan nie przewidywał, że
   szereg może mieć jeden punkt w czasie — a nagranie właśnie tak wygląda (pięciu dostawców,
   wszyscy w `2026-08`). Linia przez jeden punkt to anty-wzorzec, więc karta pokazuje wtedy
   samą tabelę. Gałąź wykresu testujemy na danych z drugim miesiącem dobudowanym z kształtu
   nagrania — ograniczenie opisane w komentarzu testu.

## Wyniki testów

**Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Pięć ścieżek, każda × (kontrakt + fixture)
+ 401 bez tokenu; zielony za pierwszym uruchomieniem, zero `WyjatekGate`.

| Ścieżka | Fixture | Wynik |
|---|---|---|
| `GET /api/analytics/market/group-prices` | `GET_analytics_market_group-prices.json` | ✓ |
| `GET /api/analytics/prices/last-import` | `GET_analytics_prices_last-import.json` | ✓ |
| `GET /api/analytics/prices/product-history` | `GET_analytics_prices_product-history.json` | ✓ |
| `GET /api/analytics/prices/inflation` | `GET_analytics_prices_inflation.json` | ✓ |
| `GET /api/analytics/top-zmiany` | `GET_analytics_top-zmiany.json` | ✓ |

Do gate'a dołożone dwie asercje, których harness sam nie robi: **odpowiedź musi być
niepusta** (`gate/ksztalt.ts` nie zagląda do elementów pustej tablicy po ŻADNEJ ze stron,
więc pusta odpowiedź przeszłaby bez dowodu) oraz **brak kluczy na `_`** w odpowiedzi.

**Weryfikacja na snapshocie produkcji** (`db/snapshot.db`, 7405 produktów, 3362 pozycje
stagingu, 14 513 wpisów historii) — nie tylko kształt, ale i wartości:

| Trasa | Wiersze | `_przyciete` w fixture | Zgodność wartości |
|---|---|---|---|
| `market/group-prices` | 92 | 92 | pierwszy wiersz `BKT / 945 ofert` — jak w nagraniu |
| `prices/inflation` | 17 | 17 | pierwszy wiersz `MO1 / 2026-08 / 3138.08 / 44.06` — **identyczny** |
| `prices/last-import` | 500 (limit) | 500 | kształt i porządek zgodne |
| `prices/product-history` | 14 513 | 15 597 | `min 24.26`, `max 27230` — **identyczne**; `avg` różni się (snapshot jest starszy o ~1000 wpisów) |
| `top-zmiany` | 100 (limit) | 100 | pierwszy wiersz `MO9_48466 / 529.4642857142857` — **identyczny** |

- **Unit (backend):** ✓ 23 nowe przypadki (`analityka.ceny.agregaty.test.ts`) —
  whitelista `?group` (w tym tablica z `?group=a&group=b`), gałęzie `?ean`/`?kod`/oba/żaden,
  `stats` (zaokrąglenie, pominięcie `null`-i, przepuszczenie zera, puste zbiory), brak
  historii bez zapytania, różnica `WHERE` między `last-import` a `top-zmiany`, sortowanie
  po `ABS(zmiana_pct)`, `LAG` i próg `cena_zakupu > 0`.
- **Widok (frontend, MSW):** ✓ 19 przypadków — trzy karty i ich kolejność, kolumny 1:1,
  brak zapytania przed wpisaniem czegokolwiek, query string, debounce (13 znaków → 1 zapytanie),
  nierenderowanie `stats`, filtry i notka o wymiarach pominiętych, wykres wraz z tabelą.
- **Pełne pakiety:** backend 45 plików / **719 testów** ✓; frontend 27 plików /
  **410 testów** ✓.
- **Bramki:** `lint` ✓, `typecheck` ✓, `build` ✓ w obu projektach. Chunk `Analityka`
  urósł z 385 kB do 423 kB (Recharts `LineChart` + `Legend`) — bez zmian w bundlu wspólnym.
- **E2E:** pominięte świadomie — jedyny przepływ użytkownika to wpisanie tekstu w dwa pola,
  pokryte testem widoku z MSW (tak samo rozstrzygnęło 10a).

## Zmiany łamiące zgodność

Brak. Blok wyłącznie dokłada trasy i wypełnia pustą zakładkę; nie ruszono żadnej istniejącej
trasy, komponentu ani tokenu. `test/tokeny.test.ts` przechodzi — paleta `--chart-1..5`
nietknięta.

## Follow-up

Rzeczy zauważone i świadomie odłożone — **żadna nie jest w zakresie tego bloku**:

1. **Przycisk „CSV" przy karcie „3.1"** (`onClick: () => M("prices-last")`, `:28310`) —
   należy do bloku **10f** razem z `GET /api/analytics/export/{view}`. Lista wszystkich
   widoków eksportu jest w `docs/analityka-bloki-10b-10f.md` §8.1.
2. **Wykres w karcie „3.2 / 3.3 Historia ceny"** — oryginał obiecuje go własnym tekstem
   („Wykres/tabela zapełnią się po zebraniu historii cen."), a i tak nie rysuje. Szereg
   cenowy jednego produktu to naturalny kandydat na linię jednoserialną. Nie dokładam
   bez decyzji użytkownika: byłoby to trzecie odstępstwo w jednym bloku.
3. **Środowisko: `rebuild/frontend/node_modules` w GŁÓWNYM repo jest nieaktualne** —
   brakuje w nim `recharts` i `@radix-ui/react-popover`, które doszły w bloku 10a
   (`typecheck` frontendu tam nie przejdzie). Ten worktree ma własne, świeże `node_modules`
   z `npm ci`. W głównym repo wystarczy `npm ci` w `rebuild/frontend/`.
4. **`market/group-prices` grupuje po `model` bez `LIMIT`-u sensownego dla UI** — 500 grup
   przy 92 markach. Nieistotne, dopóki trasa nie ma konsumenta; gdyby kiedyś dostała UI
   (nowa decyzja użytkownika), selektor grupy trzeba połączyć z paginacją albo wyszukiwarką.

## Poprawki po review

Review (`review.md`): **0 BLOCKER**, 1 SHOULD-FIX, 2 NICE-TO-HAVE.

- **SHOULD-FIX — roadmapa/backlog nieaktualne:** to Faza 5 ticketa, wykonana po review
  (patrz „Aktualizacja dokumentacji" niżej).
- **NICE-TO-HAVE — podwójna numeracja „6." w `pages/analityka/README.md`:** poprawione
  (commit `review fix - numeracja reguł wykresu w README`).
- **NICE-TO-HAVE — brak zwijania piątej i dalszych serii w „Pozostałe" na wykresie:**
  nie zmieniam. To ten sam wzorzec, co w `SekcjaMarze.tsx` z 10a (nadmiarowe byty zostają
  w tabeli pod wykresem, a nie w sztucznej serii zbiorczej), a średnia z cen kilku
  dostawców byłaby liczbą, której nie da się poprawnie podpisać. Zmiana wzorca dla obu
  sekcji naraz to osobna decyzja, nie wtrącenie w bloku 10b.

Review potwierdziło samodzielnie: SQL porównany linia po linii z
`analytics_module.cjs:237-268,333`, etykiety i kolumny z `frontend-index.js:28295-28416`,
domknięcie drogi `req.query` → `sql.raw` typem, paleta `--chart-1..5` nietknięta
(`tokeny.test.ts` ✓).

## Aktualizacja dokumentacji

**`docs/rebuild-roadmap.md`** — blok 10b oznaczony jako zrobiony (2026-09-04 + ID ticketa)
z pełnym rozliczeniem w stylu bloku 10a: pięć tras BE, trzy karty FE, decyzje D1–D4,
odstępstwa O-10b-1/O-10b-2, gate, weryfikacja na snapshocie, wzrost chunka. Zaktualizowany
wiersz tabeli iteracji i akapit o `historia_cen` (z zapowiedzi „czytelnika per produkt
dowozi 10b" na fakt). **Usunięty nieaktualny zapis** o parametrze filtra idącym „do
`queryKey`" — zastąpiony sprostowaniem, że oryginał pisze własny `queryFn` z jawnym query
stringiem. Pułapka o pustych tablicach rozszerzona o drugą połowę (pusta ODPOWIEDŹ też
przechodzi bez dowodu). Ustalenia przekazane **do bloków, których dotyczą**: 10c (gotowy
hook debounce + wzorzec parametru), 10e (ten sam wzorzec dla `?days` + ostrzeżenie
o czterech pustych fixtures i wymóg własnego zasiewu), 10f (pominięty przycisk CSV
przy karcie „3.1").

**`docs/analityka-bloki-10b-10f.md`** — nagłówek zaktualizowany (10a+10b zamknęły dziesięć
tras z 27, dokument opisuje pozostałe 17). §1.1 — `top-zmiany` i `market/group-prices`
oznaczone jako rozstrzygnięte decyzjami D1/D2. **Nowy §1.4** — czwarta pułapka iteracji:
trasy z parametrami nie używają klucza-ścieżki, tylko własnego `queryFn` (z ostrzeżeniem
o ręcznej obsłudze `401 → null`). §2 rozszerzone o drugą połowę problemu pustych tablic
wraz z konkretnym przykładem (`zasiejHistorieCen` kontra `zasiejHistorieCenDlaCen`).
§4 rozliczony jako zrobiony, z dopisanym nowym faktem o oryginale (`stats` nierenderowane).
§9 (inwentarz) uzupełniony o cztery pozycje z 10b.

**`docs/rebuild-backlog.md`** — bez zmian. Sprawdzone wszystkie wzmianki o `historia_cen`
i o pięciu trasach cen; jedyny pasujący wpis (#31 — nieidempotentny
`POST bootstrap-current`, „⬜ do decyzji Ani") dotyczy trasy, której ten blok nie tykał.

**`docs/spec-backend.md`** — sprostowane zdanie sugerujące, że `GET /api/analytics/status`
jest jedynym czytelnikiem `historia_cen`; dopisany `prices/product-history` jako pierwszy
czytelnik PER PRODUKT.

**`docs/spec-frontend.md`** — adnotacja przy „pozostałe zakładki są puste" (zakładka `ceny`
wypełniona) + nowy akapit „Odbudowa (10b…)" w konwencji pozostałych bloków.

**`CLAUDE.md`** — bez zmian (plik zasad, nie dziennik postępu; nic się nie zdezaktualizowało).

**Pre-existing issues zgłoszone przez doc-checkery:** brak nowych.

## Scalenie z `develop` (blok 10d wszedł w międzyczasie)

Podczas przygotowania PR na `develop` wylądował blok **10d** (`23-FEATURE-analityka-dostawcy`).
Scalone do gałęzi ticketa, dziewięć konfliktów rozwiązanych ręcznie — wszystkie w plikach,
które oba bloki DOKŁADAJĄ (żaden nie przemeblowuje cudzego kodu):

| Plik | Rozstrzygnięcie |
|---|---|
| `repos/analityka.ts` | obie sekcje (10b i 10d) zachowane; **`czyJestHistoria` wydzielone NAD nie** jako wspólny pomocnik — oba bloki dopisały własną kopię niezależnie |
| `routes/analytics.ts` | scalone importy i obie sekcje tras; nagłówek pliku przeliczony (14 z 27 tras) |
| `pages/Analityka.tsx` | oba importy sekcji, obie zakładki |
| `pages/analityka/api.ts` | obie sekcje hooków |
| `pages/analityka/filtrowanie.ts` | **usunięty duplikat** — patrz niżej |
| `test/msw/kontrakt.ts` | oba komplety loaderów |
| `pages/analityka/README.md`, `docs/rebuild-roadmap.md`, `docs/analityka-bloki-10b-10f.md`, `docs/spec-backend.md` | treści obu bloków połączone, liczniki tras przeliczone |

**Dwie realne duplikacje wykryte przy scalaniu i usunięte** (a nie zakleszczone przez
mechaniczne „weź obie strony"):

1. **`czyJestHistoria`** — 10b i 10d dopisały niezależnie identyczną funkcję (port
   `hasHistory`, `analytics_module.cjs:58`). Zostaje **jedna**, wyeksportowana, w osobnej
   sekcji „wspólny pomocnik" nad obiema sekcjami bloków, z notą, żeby trzeci blok nie dopisał
   trzeciej kopii.
2. **Generyczny filtr po dostawcy** — mój `zastosujFiltrDostawcow` i `zastosujFiltryDostawcow`
   z 10d miały identyczne ciało i prawie identyczną nazwę. Zostaje **wersja 10d** (jest już
   na `develop`, ma testy jednostkowe i trzech konsumentów); `SekcjaCeny` przełączona na nią.
   `WYMIARY_CEN` i `WYMIARY_DOSTAWCOW` zostają osobno mimo tej samej wartości — to deklaracje
   per sekcja, wynikające z kolumn JEJ odpowiedzi (wzorzec `WYMIARY_MARZ` z 10a); zbieżność
   jest przypadkowa i opisana w komentarzu.

**Jedna poprawka testu wymuszona przez scalenie:** `analityka.ceny.test.tsx` dostał
`vi.setConfig({ testTimeout: 20_000 })` i dłuższy limit na `findByTestId` przy leniwym
chunku — dokładnie ten sam zabieg, który blok 10d zastosował u siebie po review. Powód nie
jest w kodzie aplikacji: chunk `/analityka` ciągnie Recharts, a po dołożeniu trzeciego pliku
testów tego widoku pierwszy import w jsdomie przestał mieścić się w domyślnych 5 s.

**Bramki po scaleniu (uruchomione ponownie, komplet):** backend **738 testów** ✓ (47 plików),
frontend **427 testów** ✓ (28 plików, dwa kolejne przebiegi stabilne), `lint` ✓, `typecheck` ✓,
`build` ✓ w obu projektach. Chunk `Analityka`: 429 kB (10a: 385 → 10b+10d: 429).

## Drugie scalenie z `develop` (blok 10c)

Zanim PR zdążył zostać otwarty, na `develop` wszedł jeszcze blok **10c**
(`22-FEATURE-analityka-ean`, PR #35). Drugie scalenie, dziewięć konfliktów, ta sama zasada:
gałąź ticketa dokłada wyłącznie swój blok, resztę bierze z `develop`.

**Trzecia duplikacja wykryta i usunięta:** `zaokraglij` (port `round()`,
`analytics_module.cjs:54`) — 10b i 10c dopisały ją niezależnie. Zostaje **wersja 10c**
(pełniejszy port: przyjmuje `unknown`, przepuszcza przez `liczba()`/`num()` i ma
konfigurowalną liczbę miejsc), moja węższa wersja skasowana. Razem z `liczba` i
`czyJestHistoria` przeniesiona do sekcji **„WSPÓLNE POMOCNIKI BLOKÓW 10b–10f"** nad
sekcjami wszystkich bloków, z notą wyjaśniającą, dlaczego tam stoi — trzy pomocniki z
`:51-58` oryginału zostały dopisane niezależnie przez różne równoległe sesje i bez tego
czwarta dopisze czwartą kopię.

Po scaleniu `repos/analityka.ts` ma cztery sekcje bloków (10b → 10c → 10d) nad wspólnymi
pomocnikami, a `routes/analytics.ts` — **20 z 27 tras** modułu; nagłówki obu plików
przeliczone, łącznie ze sprostowaniem noty „trzy trasy czytają `req.query`" (jest ich pięć:
trzy z 10c i dwie z 10b).

**Bramki po drugim scaleniu:** backend **777 testów** ✓ (49 plików), frontend **440** ✓
(30 plików), `lint` ✓ `typecheck` ✓ `build` ✓ w obu projektach. Chunk `Analityka`: 436 kB.
