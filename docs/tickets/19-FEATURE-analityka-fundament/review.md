# 19-FEATURE-analityka-fundament — Code review

> Reviewed: 2026-09-03
> Branch: `feature/19-analityka-fundament`
> Diff: 26 plików, 5 commitów (vs `origin/develop`)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:1046-1073` — blok 10a nie jest oznaczony jako zrobiony.
  - Reason: `plan.md` DoD wprost wymaga „Roadmapa: blok 10a oznaczony jako zrobiony (data + ID
    ticketa), odstępstwa O-10a-1..4 zapisane, bloki 10b–10e wskazują na wzorzec" — nic z tego
    nie weszło do diffu (`git diff origin/develop...HEAD -- docs/rebuild-roadmap.md` jest pusty).
    To też prosta kolizja z `CLAUDE.md`, obowiązek #1 („Po każdym zamkniętym bloku roadmapa
    opisuje STAN, nie zamiar") — sesje 10b–10e czytają ten plik, nie `raport.md` tego ticketa,
    i bez wpisu nie dowiedzą się, że fundament jest gotowy, że domyślna decyzja D1–D4 zapadła,
    ani że wzorzec czeka w `pages/analityka/README.md`. Status wiersza Iteracji 10 w tabeli
    (`docs/rebuild-roadmap.md:160`) i sekcji (`:1047`) wciąż stoi na ⬜.
  - Suggestion: dopisać do bloku 10a w roadmapie: datę, ID ticketa, listę O-10a-1..4, i w opisach
    10b–10e wskaźnik na `rebuild/frontend/src/pages/analityka/README.md` jako obowiązujący wzorzec.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/analityka/TabelaAnalityki.tsx:90-95` — brak testu na stopkę
      „Pokazano 300 z N" / limit renderowanych wierszy.
  - Reason: to jest nietrywialna logika DOŁOŻONA ponad oryginał (odstępstwo #3 z `raport.md`),
    a `plan.md` → „Strategia testów" wprost obiecuje w `analityka.filtrowanie.test.ts` „limit 300
    wierszy renderowanych" — w rzeczywistym pliku tego testu nie ma (`grep -rn "Pokazano"
    rebuild/frontend/test/` nie znajduje nic w katalogu `test/`). Zachowanie przy >300 wierszach
    (np. po odznaczeniu filtrów) nie jest dziś pokryte ani testem jednostkowym, ani widoku.
  - Suggestion: dopisać test (jednostkowy dla `TabelaAnalityki` albo scenariusz w
    `analityka.test.tsx` z >300 zamockowanymi wierszami `margins.rows`) sprawdzający treść stopki
    i liczbę renderowanych `<tr>`.

- [ ] `rebuild/backend/test/gate/dane.ts` — plan zapowiadał zmianę seedu („wariant z wieloma
      dostawca/kategoria/marka, żeby `margins.rows` miał >1 grupę"), pliku nie tknięto.
  - Reason: nie jest to błąd funkcjonalny — istniejący `PRODUKTY_TESTOWE` już ma wystarczającą
    różnorodność (MO9/BKT/Rolnicze, MO1/MITAS/Rolnicze, MO2/ALLIANCE/Przyczepy), więc GATE
    przechodzi i sam cel planu jest spełniony faktycznie — ale krok z planu nie został
    wykonany ani nazwany jako świadomie pominięty w `raport.md` → „Odstępstwa od planu".
  - Suggestion: kosmetyczne — dopisać jedno zdanie do `raport.md`, że seed już miał wymaganą
    różnorodność i zmiana `dane.ts` okazała się zbędna.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/analityka.ts:64` — `listaWartosci(db, kolumna: string, …)` przyjmuje
      `string`, a nie zawężony typ z `KOLUMNY_FILTROW`. Dziś bezpieczne (funkcja wewnętrzna,
      wołana tylko z zamkniętej stałej — komentarz w kodzie to nazywa wprost), ale silniejszy typ
      (`(typeof KOLUMNY_FILTROW)[NazwaFiltru]`) zamieniłby tę gwarancję z komentarza w gwarancję
      kompilatora.
- [ ] `rebuild/frontend/src/components/WyborZWyszukiwarka.tsx:141-165` — lista `role="listbox"`
      nie ma nawigacji strzałkami (roving tabindex); dziś działa przez Tab + Enter/Spację na
      natywnych `<button>`, co jest użyteczne, ale przy 200 widocznych pozycjach strzałki
      byłyby wygodniejsze. Nie blokuje — testy potwierdzają, że wyszukiwarka i klik działają.
- [ ] `rebuild/backend/src/repos/analityka.ts:233-260` (`marze`) i `listyFiltrow` — brak indeksu
      SQLite na `products(status)` / `products(dostawca, kategoria, marka)`; przy ~6900
      produktach to pełny skan tabeli przy każdym `GET /margins`/`GET /filters`, dziś rzędu
      pojedynczych milisekund. Oryginał też nie ma tego indeksu (wierność zachowana), więc nie
      jest to regresja — warto tylko mieć na radarze, gdyby katalog urósł o rząd wielkości.

## Plan compliance

### Done ✓
- Backend: pięć tras `/api/analytics/*` za `requireAuth`, agregaty 1:1 z
  `mirror/backend/analytics_module.cjs` (limity list filtrów, progi marż 5/80, `status='aktywny'`
  w KPI i marżach, jego świadomy brak w `filters`, format `toISOString()` w bootstrapie) —
  zweryfikowane linia po linii wobec `analytics_module.cjs:81-107,292-297,325-331`.
- GATE (`analityka.gate.test.ts`) i testy semantyki (`analityka.agregaty.test.ts`) — realne,
  nietrywialne asercje; siatka i jej słabości (kontrakt bez schematów, `low`/`high` puste
  w fixture, brak fixture'a dla `bootstrap-current`) opisane zgodnie z tym, co harness
  faktycznie robi (`test/gate/ksztalt.ts` sprawdzone: klucz nadmiarowy w odpowiedzi = różnica,
  pusta tablica fixture'a pomija sprawdzenie kształtu elementu — dokładnie jak twierdzi kod).
- Frontend: szkielet `/analityka` z pięcioma zakładkami 1:1 z oryginałem (kolejność, etykiety,
  domyślna „Dostawcy") — potwierdzone wobec `deminified/frontend-index.js:28028-28046`; karta
  marż z siedmioma kolumnami 1:1 — potwierdzone wobec `:28516-28560`; `formatuj`/`formatujProcent`
  1:1 z `_()`/`D()` — potwierdzone wobec `:27909-27921`; `TabelaAnalityki` 1:1 z `I()` (limit 300,
  klasy, komunikat pustej tabeli) — potwierdzone wobec `:27942-27966`.
- Cztery odstępstwa O-10a-1..4 nazwane w kodzie (nagłówki plików), w `raport.md` i w
  `pages/analityka/README.md`, spójnie ze sobą.
- `pages/analityka/README.md` opisuje rzeczywisty kod, nie zamiar — każdy przywołany fragment
  (kolumny, limity, reguła koloru, test na `_przyciete`) sprawdza się w plikach źródłowych.
- Lazy-loading `/analityka` (`App.tsx`) — uzasadniony pomiarem bundla w `raport.md`, `Suspense`
  poprawnie owija `Switch` wewnątrz `AuthGate`; nie psuje pozostałych tras (są ładowane statycznie).
- Bramki: lint/typecheck/build/test uruchomione ponownie w tym review — czyste po obu stronach;
  GATE i testy agregatów (28 testów BE) oraz testy widoku i filtrowania (26 testów FE) przechodzą.

### Missing or deviating ✗
- Roadmapa (`docs/rebuild-roadmap.md`) nie zaktualizowana — patrz BLOCKER.
- `gate/dane.ts` nie zmieniony wbrew zapowiedzi w planie (Krok 3) — patrz SHOULD-FIX; skutek
  neutralny, ale krok planu formalnie niedowieziony i niedopisany do „Odstępstw od planu".
- Test na limit 300 wierszy (zapowiedziany w „Strategia testów") nie istnieje — patrz SHOULD-FIX.

### Definition of done
- [x] `GET /api/analytics/filters` zwraca 6 list `{value}[]` z limitami oryginału, bez `_przyciete`
- [x] `GET /api/analytics/status` zwraca `{hasHistory, snapshots, od, do}`
- [x] `GET /api/analytics/kpi` zwraca `{produkty, dostawcy, avgMarza, stagingPending}`
- [x] `GET /api/analytics/margins` zwraca `{rows, low, high}` z progami 5/80 i limitami 1000/200/200
- [x] `POST /api/analytics/bootstrap-current` zwraca `{ok, inserted, at}` i seeduje `historia_cen`
- [x] Wszystkie pięć tras za `requireAuth` → 401 bez tokenu
- [x] GATE: cztery fixtures zgodne kształtem 1:1 + pięć operacji waliduje się wg `openapi.yaml`
- [x] `/analityka` renderuje banner, 4 kafle KPI, 6 filtrów, 5 zakładek, sekcję marż (wykres+tabela)
- [x] Filtry globalne działają na sekcji marż (klient) i są wspólne dla zakładek
- [x] `/analityka` zdjęte z `PLACEHOLDERY`, wpięte w `App.tsx`; sidebar bez zmian
- [x] Wzorzec sekcji dashboardu udokumentowany w `pages/analityka/README.md`
- [x] `lint`, `typecheck`, `build`, `test` czyste po obu stronach (zweryfikowane ponownie w review)
- [ ] Roadmapa: blok 10a oznaczony jako zrobiony, odstępstwa zapisane, 10b–10e wskazują na wzorzec
      — NIE spełnione, patrz BLOCKER

## Parallel-test concerns

None — all tests parallelizable. Backend GATE/agregaty używają `stworzSrodowiskoTestowe()` /
`stworzTestowaBaze()` (baza w katalogu tymczasowym, brak stałego portu). Frontend testy widoku
używają MSW + `queryClient.clear()` + `sessionStorage.clear()` w `beforeEach`, bez zależności od
zewnętrznych zasobów.

## Overall assessment

Bardzo solidna robota jak na „fundament" dla czterech kolejnych bloków: backend jest przepisany
z oryginału linia po linii z czytelnym uzasadnieniem każdego odstępstwa, GATE nie ma trywialnych
asercji (sprawdzone przeciw `ksztalt.ts`), a `README.md` wzorca faktycznie opisuje to, co kod robi
— zweryfikowałem to punkt po punkcie. Jedyny poważny problem to brak aktualizacji roadmapy, co
akurat w tym projekcie jest zasadą stałą (`CLAUDE.md`) i ma bezpośredni wpływ na cztery kolejne
sesje pracujące równolegle — to jedyna rzecz blokująca merge. Dwa SHOULD-FIX są drobne i nie
wpływają na poprawność działania.
