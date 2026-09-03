# 22-FEATURE-analityka-ean — raport z implementacji

## Summary

Blok 10c Iteracji 10 dowieziony w całości: sześć tras `/api/analytics/ean*` w backendzie
(agregaty przepisane 1:1 z `mirror/backend/analytics_module.cjs`) i wypełniona zakładka
„EAN i ceny" z trzema kartami oryginału. Wszystkie sześć fixtures przechodzi GATE, a pięć
z nich reprodukuje się **co do wartości i kolejności** na snapshocie produkcji — to mocniejszy
dowód niż sam kształt. Dwie trasy bez konsumenta w oryginalnym froncie (`ean/details`,
`ean-porownanie`) dowiezione jako trasy bez UI.

## Changes

### Backend

- `rebuild/backend/src/repos/analityka.ts` — **+6 funkcji agregujących** (`porownanieEan`,
  `szczegolyEan`, `unikalneEan`, `pokrycieEan`, `rankingDostawcowEan`, `porownanieEanLegacy`),
  wspólny `ofertyEan` oraz porty pomocników oryginału: `liczba` (`num`), `zaokraglij` (`round`),
  `tekst` (`String(x || '')`), `mediana` (`median`). Trzy nazwane limity: 1000, 1000, 200.
- `rebuild/backend/src/routes/analytics.ts` — **+6 rejestracji** z `requireAuth`, w kolejności
  oryginału. Parametry `req.query` przekazywane SUROWO do repozytorium (luźne parsowanie
  oryginału jest częścią odtwarzanego zachowania).
- **Nowy:** `rebuild/backend/test/analityka.ean.gate.test.ts` — GATE dla sześciu ścieżek
  (13 testów).
- **Nowy:** `rebuild/backend/test/analityka.ean.test.ts` — 26 testów jednostkowych semantyki.

### Frontend

- `rebuild/frontend/src/pages/analityka/api.ts` — **+4 typy i +4 hooki** (`usePorownanieEan`,
  `useUnikalneEan`, `usePokrycieEan`, `useRankingDostawcowEan`).
- `rebuild/frontend/src/pages/analityka/filtrowanie.ts` — **+4 deklaracje wymiarów** per karta
  i generyczne `zastosujFiltrDostawcy`.
- **Nowy:** `rebuild/frontend/src/pages/analityka/SekcjaEan.tsx` — trzy karty oryginału.
- `rebuild/frontend/src/pages/Analityka.tsx` — zakładka `ean` dostaje `SekcjaEan` zamiast
  zaślepki; cztery hooki wołane na poziomie widoku.
- `rebuild/frontend/src/components/ui/chart.tsx` — **+`PROMIEN_SLUPKA_PIONOWEGO`** (wspólna
  infrastruktura; bloki 10d/10e zastaną ją gotową).
- `rebuild/frontend/test/msw/kontrakt.ts` — **+4 loadery** fixtures EAN (zdejmują `_przyciete`).
- `rebuild/frontend/test/analityka.test.tsx` — cztery handlery EAN w `zamockujApi`
  (widok pobiera je przy każdym wejściu, więc bez nich `onUnhandledRequest: "error"` wywala test).
- **Nowy:** `rebuild/frontend/test/analityka.ean.test.tsx` — 10 testów widoku.
- **Nowy:** `rebuild/frontend/test/analityka.ean.filtrowanie.test.ts` — 7 testów jednostkowych.

**Świadoma decyzja o układzie plików testowych:** nowe pliki zamiast dopisków do
`analityka.gate.test.ts` / `analityka.agregaty.test.ts` / `analityka.test.tsx`. Bloki 10b–10e
idą równolegle i każdy dokłada do tej samej rodziny tras i tego samego widoku — wspólne pliki
byłyby gwarantowanym konfliktem przy merge'u czterech gałęzi.

## Deviations from plan

Trzy odstępstwa od `plan.md`, wszystkie w stronę mocniejszego dowodu:

1. **Testy w nowych plikach, nie dopisane do istniejących** (uzasadnienie wyżej). Plan
   zakładał rozszerzenie plików z 10a.
2. **Weryfikacja na snapshocie produkcji** — plan przewidywał tylko fixtures + testy
   jednostkowe. Dołożyłem przebieg wszystkich sześciu agregatów na kopii `db/snapshot.db`;
   wynik niżej.
3. **Notka „histogram pokrycia ignoruje filtr dostawcy"** — plan mówił o jednej notce na kartę
   „2.6". W praktyce karta ma dwie tabele reagujące RÓŻNIE na to samo zaznaczenie (ranking
   filtruje, histogram nie), więc doszła osobna, jednozdaniowa notka po stronie histogramu.
   Bez niej użytkownik widziałby zawężoną jedną tabelę i niezmienioną drugą, bez wyjaśnienia.

Punkt 6 planu („test dokumentujący martwą gałąź `spreadPct = null`") zrealizowany jako komentarz
w `repos/analityka.ts`, nie jako test — gałąź jest przy `cena_zakupu > 0` **nieosiągalna**, więc
testu, który by ją wywołał, napisać się nie da bez ominięcia SQL-a. Zachowany jest natomiast
`| null` w typie i w kształcie odpowiedzi.

## Test results

### Gate odbudowy (fixtures/kontrakt): ✓ zgodne

Sześć ścieżek `contract/openapi.yaml` — wszystkie zadeklarowane, wszystkie z `security`
i kodami 200/400/401 (kontrakt nie ma dla analityki schematów odpowiedzi, więc dowodzi
istnienia ścieżki, statusu i JSON-a — nie kształtu):

| Ścieżka | Fixture | Wynik |
|---|---|---|
| `GET /api/analytics/ean/comparison` | `GET_analytics_ean_comparison.json` | ✓ kształt + 401 |
| `GET /api/analytics/ean/unique` | `GET_analytics_ean_unique.json` | ✓ kształt + 401 |
| `GET /api/analytics/ean/coverage` | `GET_analytics_ean_coverage.json` | ✓ kształt + 401 |
| `GET /api/analytics/ean/supplier-rank` | `GET_analytics_ean_supplier-rank.json` | ✓ kształt + 401 |
| `GET /api/analytics/ean/details` | `GET_analytics_ean_details.json` | ✓ kształt + 401 |
| `GET /api/analytics/ean-porownanie` | `GET_analytics_ean-porownanie.json` | ✓ kształt + 401 |

Plus asercja wprost, że żadna z sześciu odpowiedzi nie zawiera `_przyciete`
ani `_body_przyciete_z`.

**⚠ Gate musiał najpierw przestać być pusty.** `gate/ksztalt.ts:50` iteruje po elementach
ODPOWIEDZI — pusta odpowiedź przechodzi za darmo, przepuszczając dowolny kształt wiersza.
Domyślny zasiew (`PRODUKTY_TESTOWE`) nie ma ani jednego EAN-u u dwóch dostawców, więc
`comparison`, `supplier-rank` i `ean-porownanie` wychodziły na nim puste. Test dosypuje pięć
produktów z dwoma dzielonymi EAN-ami i po każdym zapytaniu asercją sprawdza, że wierszy JEST.

### Weryfikacja na snapshocie produkcji: ✓ wartości i kolejność 1:1

Sześć agregatów przepuszczonych przez kopię `db/snapshot.db` (kopia w katalogu tymczasowym,
oryginał nietknięty). Wynik zestawiony z fixtures:

| Trasa | Snapshot | Fixture | Zgodność |
|---|---|---|---|
| `ean/comparison` | 769 wierszy, czoło: `8059971008746` spread 10348 zł / 273,03% | te same 5 wierszy | **wartości i kolejność identyczne** |
| `ean/unique` | 1000 wierszy (limit) | `_przyciete: {rows: 1000}` | **identyczne** |
| `ean/coverage` | 5109 / 676 / 90 / 2 / 1 | 5109 / 676 / 90 / 2 / 1 | **identyczne** |
| `ean/supplier-rank` | 9 wierszy, MO9 100% → MO3 59,75% | `_przyciete: {rows: 9}`, te same 5 | **identyczne** |
| `ean-porownanie` | 200 wierszy (limit) | `_body_przyciete_z: 200` | **identyczne** |
| `ean/details` bez `?ean` | `{ean: null, offers: []}` | to samo | **identyczne** |

Dwie gałęzie bez fixture'a zachowują się zgodnie z oryginałem:
`ean/details?ean=8059971008746` → cztery klucze, dwie oferty z `pozycjaCenowa` 1 i 2,
`mediana: 8964`, `srednia: 8964`; `ean-porownanie?ean=…` → goła tablica tych samych ofert
bez `pozycjaCenowa`.

### Testy

- **Backend unit + gate:** ✓ 723 testy w 45 plikach (w tym 13 nowych gate + 26 nowych jednostkowych)
- **Frontend:** ✓ 408 testów w 28 plikach (w tym 10 nowych widoku + 7 jednostkowych)
- **Lint / typecheck / build:** ✓ czyste w `rebuild/backend/` i `rebuild/frontend/`

Rozmiary po buildzie: chunk `Analityka` 391,91 kB (był 385 kB po 10a), wspólny bundle
484,03 kB. Wzrost wspólnego bundla NIE pochodzi z tego bloku — `SekcjaEan.tsx`,
`analityka/api.ts`, `analityka/filtrowanie.ts` i `components/ui/chart.tsx` są importowane
wyłącznie przez `Analityka.tsx`, który jest ładowany leniwie (zweryfikowane grepem po
`src/`); wszystkie nasze zmiany siedzą w chunku `Analityka`.

## Breaking changes

Brak. Zmiany są addytywne: sześć nowych tras, jedna wypełniona zakładka. Trasy z 10a
(`filters`, `status`, `kpi`, `margins`, `bootstrap-current`) i nagłówek KPI nietknięte.

## Follow-up

Świadomie odłożone, każde z powodem:

1. **Przepięcie nagłówka KPI na kafle oryginału** (decyzja D1). Oryginał liczy „EAN wspólne"
   z `ean/comparison.rows.length` i „Pozycje unikalne" z `ean/unique.rows.length`
   (`frontend-index.js:28002-28017`) — dane są od teraz dostępne, więc odstępstwo O-10a-1 da
   się zdjąć jedną zmianą w `NaglowekKpi.tsx`. Wymaga decyzji użytkownika; odnotowane
   w roadmapie przy bloku 10f.
2. **Przyciski „CSV"** przy kartach „2.1-2.4" (`M("ean-comparison")`) i „2.5" (`M("unique")`)
   — należą do bloku **10f** razem z `GET /api/analytics/export/{view}`.
3. **UI dla `ean/details` i `ean-porownanie`** — oryginał go nie ma i nie będzie miał, chyba
   że użytkownik zdecyduje inaczej. Obie trasy wyglądają na zaczątek ekranu „szczegóły jednego
   EAN-u", którego nikt nie dokończył.
4. **Kontrolka progu `minDiffPct`** (decyzja D3) — parametr działa w API, ale oryginał nie ma
   dla niego kontrolki. Dołożenie jej byłoby nową funkcją, nie odbudową.

### Zaobserwowane w oryginale, NIE naprawiane (charakterystyka, nie błąd)

- **`ean/supplier-rank.wspolnePozycje` myli nazwą.** CTE `ranked` nie wymaga, żeby EAN był
  u dwóch dostawców — bierze każdą aktywną ofertę z niepustym EAN-em i ceną > 0. Licznik to
  więc „ile ofert dostawcy wpadło do rankingu", a nie „ile pozycji dzieli z kimkolwiek".
  Skutek widoczny w produkcji: **MO9 ma 846/846 = 100%**, bo wszystkie jego EAN-y są unikalne
  — jest jedyny, więc zawsze najtańszy. Kolumna w UI nosi etykietę „Wspólne" z oryginału.
  Odtworzone 1:1 i opisane w kodzie; gdyby Ania uznała to za mylące, jest to zmiana zachowania
  i osobna decyzja.
- **`ean/details` nie używa `RANK()`.** `pozycjaCenowa` liczy się z kolejności wierszy (`i + 1`),
  więc dwie oferty o identycznej cenie dostają różne pozycje. `ean/supplier-rank` używa dla
  odmiany prawdziwego `RANK()` i tam remisy dzielą pozycję 1 — suma `najtanszy` po dostawcach
  może przez to przekroczyć liczbę EAN-ów. Obie niespójności są w oryginale.
- **`ean/unique` używa `MAX()` do wyciągnięcia kolumn spoza `GROUP BY`.** Gdy jeden dostawca ma
  pod tym samym EAN-em kilka kodów, w tabeli pokazuje się NAJWYŻSZA cena i NAJWYŻSZY stan,
  a nie wartości jednej konkretnej oferty.

---

## Review fixes applied

Review (`review.md`): **0 BLOCKER**, 1 SHOULD-FIX, 2 NICE-TO-HAVE. Wszystkie trzy naprawione.

### SHOULD-FIX — niedeterminizm pełnego zestawu testów frontendu ✓

Zreprodukowałem: **trzy z trzech** pełnych przebiegów `npx vitest run` padały na dwóch plikach
(`406/408`), a te same pliki puszczone osobno przechodziły zawsze. Winne były dwa progi czasowe,
oba domyślne:

- `findBy*`/`waitFor` Testing Library (1 s) — testy renderujące CAŁĄ `<App/>` nie zdążały
  doładować leniwego chunku `/analityka` z Rechartsem i szukały `text-page-title`, którego
  jeszcze nie było;
- `testTimeout` vitest (5 s) — `tokeny.test.ts` (buduje arkusz Tailwinda, ~8 s pod obciążeniem).

To nie był defekt bloku 10c — próg był ciasny już wcześniej, a nasze dziesięć nowych testów
widoku dołożyło obciążenia i przewróciło go na stałe. Poprawki:

- `rebuild/frontend/vitest.config.ts` — `testTimeout`/`hookTimeout` na 20 s,
- `rebuild/frontend/test/setup.ts` — `configure({ asyncUtilTimeout: 5_000 })`.

Podniesienie progu nie spowalnia testów przechodzących: `findBy*` kończy się w chwili
pojawienia się elementu. **Weryfikacja: trzy pełne przebiegi z rzędu 408/408.**

⚠ To zmiana we WSPÓLNEJ konfiguracji — bloki 10b/10d/10e dokładają kolejne ciężkie testy
widoku i zastaną próg już podniesiony.

### NICE-TO-HAVE 1 — jeden `ladowanie` dla czterech tabel ✓

`SekcjaEan` brała `isPending` wyłącznie z `usePorownanieEan()` i sterowała nim tekstem pustej
tabeli we wszystkich czterech tabelach. Cztery zapytania lecą niezależnie, więc tabela wciąż
czekająca na odpowiedź mogła pokazać „Brak danych" zamiast „Wczytywanie…". Propsy zmienione
na pary `{dane, ladowanie}` — każda karta odpowiada za swój stan. (`SekcjaMarze` z 10a ma jedno
zapytanie i tam pojedyncza flaga zostaje poprawna.)

### NICE-TO-HAVE 2 — ręczne zaokrąglanie ✓

`Math.round(x * 10000) / 100` w liczbie udziału EAN-ów wspólnych zastąpione wspólnym
`zaokraglij()` dodanym do `pages/analityka/formatowanie.ts` — z komentarzem, czym różni się
od `formatuj()` (zostaje w domenie liczb, nie zamienia na napis) i wskazówką dla bloków 10d/10e,
żeby nie namnażać wariantów tej samej operacji.

### Po poprawkach

- Backend: ✓ 723/723 · Frontend: ✓ 408/408 (trzy przebiegi z rzędu)
- Lint / typecheck / build: ✓ czyste w obu pakietach
- Chunk `Analityka` 392,22 kB, wspólny bundle 484,03 kB — bez zmian względem stanu przed review

---

## Docs updates

Trzy doc-checkery równolegle, pięć plików sprawdzonych, cztery zaktualizowane.

### `docs/rebuild-roadmap.md`

- Tabela statusu Iteracji 10 — dopisany `10c: 22-FEATURE-analityka-ean · 2026-09-03`; lista bloków
  otwartych zawężona do 10b/10d/10e (+10f).
- Blok **10c** oznaczony ✅ z datą i ID ticketa; opis zamieniony z planowanego na faktycznie
  dowieziony (sześć tras, trzy karty, dwa wykresy O-10c-1, dwie trasy bez UI, pominięte
  `minDiffPct` w UI i CSV).
- **Poprawiony fakt:** sekcja „Wzorzec i pułapki dla 10b–10e" sugerowała, że query params mają
  tylko `market/group-prices`, `prices/product-history` i `rotation/inactive` — dopisane trzy
  trasy EAN, z zastrzeżeniem, że oryginalny front żadnego z tych parametrów nie wysyła.
- **Poprawiony fakt:** rozmiary bundla FE — obok stanu po 10a (385/452 kB) dopisany stan po 10c
  (392/484 kB) z notą, że wzrost wspólnego bundla nie pochodzi z tego bloku.
- **Nowa sekcja „Wzorzec i gotowa infrastruktura z 10c (dla 10b/10d/10e)"** —
  `PROMIEN_SLUPKA_PIONOWEGO`, `zaokraglij()`, `zastosujFiltrDostawcy()`, zasada własnych plików
  testowych per blok, podniesione progi czasowe testów.
- **Do bloku 10f (nie do 10c) dopisane „WEJŚCIE Z BLOKU 10c"** — dane do przepięcia nagłówka KPI
  czekają na decyzję użytkownika; przyciski „CSV" kart EAN do dowiezienia razem z eksportem.

### `docs/analityka-bloki-10b-10f.md`

- Zakres dokumentu z „pozostałe 22 trasy" na „pozostałe 16"; blok 10c oznaczony jako zamknięty
  w intro, §1.1 i §5.
- **Poprawiony rozjazd:** §3 i §5 podawały kształt `ean/details` jako `{ean, offers}` — teraz
  opisane obie gałęzie, z czterema kluczami i `pozycjaCenowa` liczoną z kolejności wierszy.
- **Poprawiony rozjazd:** §5 dostało opis dwóch gałęzi SQL `ean-porownanie` i pełną listę różnic
  wobec `ean/comparison` (WHERE, LIMIT 200 vs 1000, kolumny, koperta).
- **Wzmocnione ostrzeżenie §2:** gate iteruje po elementach ODPOWIEDZI, więc pusta odpowiedź
  przechodzi za darmo niezależnie od fixture'a — wniosek dla 10d/10e o zasiewie i asercji
  `rows.length > 0`.
- Dopisane fakty, których dokument nie miał: `spreadZl`/`spreadPct` liczone w JS po SQL;
  `wspolnePozycje` mylące nazwą; `MAX()` w `ean/unique`; brak `cena_zakupu > 0`
  w `unique`/`coverage`.

### `rebuild/frontend/src/pages/analityka/README.md` (wzorzec dla 10b–10e)

`zaokraglij()` w tabeli plików · `zastosujFiltrDostawcy()` i notka o karcie z dwiema tabelami
reagującymi różnie na ten sam filtr (§2.3) · wzorzec karty dwutabelowej (§2.4) ·
`PROMIEN_SLUPKA_PIONOWEGO` i kolejność `radius` w Recharts (§2.5) · zasada własnych plików
testowych per blok + wyjątek dla handlerów MSW + podniesione progi czasowe (§2.7) ·
nowa sekcja „1:1 z oryginałem (10c)" i tabela odstępstw O-10c-1/O-10c-2 (§4).

### `docs/spec-backend.md` i `docs/spec-frontend.md`

- **spec-backend:** §2 dostało akapit „Potwierdzone w 10c" — sześć tras EAN pod `requireAuth`
  (nie odstępstwo, kontrakt już miał `security`), `ean-porownanie` jako osobna trasa z gołą
  tablicą, oraz sprostowanie, że trasy analityki JEDNAK czytają query params.
- **spec-frontend:** §5 — poprawione nieaktualne zdanie „wypełniona tylko zakładka Marża"
  (teraz także `ean`, czekają `dostawcy`/`ceny`/`dostepnosc`); nowy akapit o bloku 10c
  z decyzjami D1 i D6 oraz odstępstwem O-10c-1.

### `docs/rebuild-backlog.md` — bez zmian (świadomie)

Wpis **#31** (nieidempotentny `bootstrap-current`) to jedyny wpis o analityce i ten ticket go
nie dotknął. Trzy zachowania oryginału odtworzone 1:1 i opisane w „Follow-up" wyżej
(`wspolnePozycje`, `pozycjaCenowa`, `MAX()` w `unique`) **nie pasują do konwencji tego pliku** —
backlog rejestruje zmiany Ani z żywej produkcji, przechodzące przez pipeline diff/mail
z obowiązkową kolumną decyzji (✅/❌/⬜/🕒), a nie obserwacje charakteryzacyjne z odbudowy.
Zostały w `raport.md`.

### Pre-existing issues zgłoszone przez doc-checkery

Brak — żaden nie znalazł nieścisłości wykraczających poza zakres tego ticketa.
