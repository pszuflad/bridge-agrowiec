# 3-FEATURE-katalog-odczyt — Code review

> Reviewed: 2026-08-25
> Branch: feature/3-katalog-odczyt
> Diff: 39 plików, 4 commity (`git diff origin/develop...HEAD`)

## BLOCKER

Brak. Nie znalazłem błędów logiki, luk bezpieczeństwa, rozjazdów z kontraktem/fixtures ani
nieprzechodzących testów. Wszystkie 103 (backend) + 106 (frontend) testów zielone, `lint`,
`typecheck` i `build` czyste po obu stronach (zweryfikowane uruchomieniem, nie tylko wg raportu).

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/katalog/wirtualizacja.ts:46-86` — brak `ResizeObserver` na
      kontenerze tabeli.
  - Reason: oryginał (`frontend-index.js:23246-23250`) oprócz nasłuchu `scroll`/`resize` okna
    obserwuje też zmianę rozmiaru/pozycji samego kontenera tabeli przez `ResizeObserver` i woła
    `remeasure()`. Rebuild pomija to całkowicie — `gornaKrawedzRef`/`wysokoscOkna` są przeliczane
    tylko przy montażu i przy `resize` okna. Gdy layout NAD tabelą zmienia wysokość bez zmiany
    rozmiaru okna (np. zakładki dostawców zawijają się do dwóch linii po zaznaczeniu marek/kategorii,
    pasek filtrów wydłuża się przy dłuższym podsumowaniu wyboru), offset przewijania używany do
    wyliczenia okna wirtualizacji staje się nieaktualny. Efekt widoczny dopiero przy > 150 wierszach
    na stronie (czyli praktycznie po wybraniu „Wszystkie") — może dawać złe okno wirtualizacji
    (puste/nie te wiersze) do najbliższego `resize` okna.
  - Suggestion: dodać `ResizeObserver` na `refKontenera.current` w `useEffect`, analogicznie do
    oryginału, wołający `zmierz()`.

- [ ] `rebuild/frontend/src/pages/katalog/TabelaProduktow.tsx:30-33,84-118` — dodany, nieautoryzowany
      wskaźnik kierunku sortowania w nagłówkach.
  - Reason: `StrzalkaSortowania` renderuje `↕` gdy kolumna nieaktywna i `↑`/`↓` gdy aktywna —
    oryginał (`frontend-index.js:23644-23692`, ikona `Au` = `ArrowUpDown`) renderuje w KAŻDYM
    nagłówku (przyklejonym i konfigurowalnym) ten sam statyczny, nieaktywny wygląd niezależnie od
    tego, która kolumna jest posortowana i w którą stronę. Sortowanie w oryginale działa (klik
    przełącza asc/desc), ale UI nie daje żadnej wizualnej informacji zwrotnej o aktywnej kolumnie/
    kierunku. To realna, nieudokumentowana (brak wzmianki w plan.md/raport.md) zmiana zachowania
    widoczna dla Ani na każdym ekranie katalogu.
  - Suggestion: albo świadomie zatwierdzić to jako odstępstwo (dopisać do raport.md/plan.md jako
    D-coś, bo to poprawa UX), albo cofnąć do statycznej ikony 1:1 z oryginałem.

- [ ] `rebuild/frontend/src/pages/katalog/TabelaProduktow.tsx:86` — tekst nagłówka przyklejonej
      kolumny „Nazwa" brzmi „Nazwa-produktu" zamiast „Nazwa".
  - Reason: w oryginale (`frontend-index.js:23650`) statyczny, przyklejony nagłówek tabeli ma
    treść `"Nazwa "` (krótką, tylko na potrzeby kolumny przyklejonej) — RÓŻNĄ od etykiety
    `"Nazwa-produktu"` używanej w konfiguratorze kolumn i podglądzie (`kolumny.ts:19`, `$r[0].label`).
    Rebuild użył tej drugiej etykiety wprost w nagłówku tabeli, więc Ania zobaczy inny tekst niż
    w produkcji na najbardziej widocznej kolumnie ekranu.
  - Suggestion: hardkodować `"Nazwa"` w nagłówku tabeli tak jak w oryginale, zostawiając
    `"Nazwa-produktu"` tylko w `kolumny.ts` (konfigurator/podgląd).

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/Katalog.tsx:93-104` — brak migracji starych zapisów kolumn
      o brakujący klucz `kodImportu`.
  - Oryginał (`frontend-index.js:23023-23036`, funkcja `MT`) dokłada `kodImportu` do zapisanej w
    IndexedDB listy kolumn, jeśli go tam brakuje (retrofit dla użytkowników z zapisem sprzed
    dodania tej kolumny). Rebuild tego nie robi. W praktyce mało istotne — IndexedDB jest
    per-origin, a nowy frontend startuje na innej domenie/origin niż stara produkcja, więc nie ma
    z czego migrować. Warto tylko odnotować, gdyby kiedyś origin się pokrywał.

- [ ] `rebuild/frontend/src/pages/katalog/TabelaProduktow.tsx:63,144-148,213-217` — `liczbaKolumn`
      (i tym samym `colSpan` wierszy „Wczytuję…"/„Brak produktów"/spacerów wirtualizacji) liczy
      `kolumnyZmienne.length + 3 + 1` (+1 za kolumnę podglądu), podczas gdy oryginał
      (`frontend-index.js:23692,23815`) liczy `_.length + 3` — czyli o jeden mniej, nie licząc
      kolumny „Akcje". To raczej poprawka niż regres (rebuild lepiej spina wiersz na całą
      szerokość), ale jest to odejście od dosłownego wzoru oryginału.

## Plan compliance

### Done ✓
- `GET /api/products` odtwarza oba warianty (goła tablica / `{items,total,limit,offset}`),
  `Math.min(parseInt(...) || 200, 2000)`, `parseInt(offset ?? "0") || 0`, filtr `dostawca`,
  `requireAuth` — 1:1 z `backend-index.cjs:48280-48294`.
- `GET /api/suppliers` + `GET /api/dostawcy` (jeden handler, dwie trasy) z `liczbaProduktow`,
  4-gałęziowym `przeliczStatus`, zapytaniem okienkowym `LAG` po `historia_cen` w `try/catch`.
- `src/db/schema.ts` — naprawa D5 (`snow3pmsf`, 10× `mode:"boolean"`), `eanIsValid` świadomie
  zwykłym `integer()`; potwierdzone testem-strażnikiem 72 kluczy i testem typów w GATE.
- Kompresja (`compression()`) wpięta w `app.ts` po CORS, przed trasami.
- GATE: `GET_products.json`, `GET_suppliers.json`, `GET_dostawcy.json` — zielone, zweryfikowane
  uruchomieniem (nie tylko wg raportu).
- Widok `/katalog` wpięty w router bez zmiany liczby tras (12), zdjęty z placeholderów.
- Szukajka tokenowa (AND/OR zgodnie z `frontend-index.js:23297-23305`), filtry marka/kategoria/
  status, zakładki dostawców z sortowaniem po numerze kodu, sortowanie po nagłówkach, paginacja
  25/50/100/Wszystkie z identycznym gate'em `$ > 1`, konfigurator 59 kolumn w IndexedDB,
  wirtualizacja > 150 wierszy z tym samym kwantem scrolla (74/444).
- Modal podglądu read-only (D4), zawiera wszystkie 59 pól przez ten sam `formatujKomorke`.
- `lint`, `typecheck`, `test` zielone po obu stronach (backend 103/103, frontend 106/106).
- Rozjazd `szerokosc` opisany w raport.md z konkretną propozycją domknięcia backlogu #3.

### Missing or deviating ✗
- Drobne, nieautoryzowane odstępstwa UI opisane wyżej w SHOULD-FIX (wskaźnik kierunku sortowania,
  tekst nagłówka „Nazwa", brak `ResizeObserver` w wirtualizacji) — żadne nie blokuje DoD, ale nie
  są odnotowane jako świadome decyzje w plan.md/raport.md.
- Poza tym plan zrealizowany kompletnie zgodnie z krokami 1–12.

### Definition of done
- [x] `GET /api/products` odtwarza oba warianty, cap `limit=2000`, filtr `dostawca`, `requireAuth`
- [x] `GET /api/suppliers`/`GET /api/dostawcy` — 17 pól, przeliczone `liczbaProduktow`/`status`/`ostatniaAktualizacja*`
- [x] `src/db/schema.ts` naprawiony (D5) — 72 klucze zgodne co do nazwy i typu z fixture
- [x] Kompresja odpowiedzi włączona (D2)
- [x] GATE: `GET_products.json`, `GET_suppliers.json`, `GET_dostawcy.json` zielone
- [x] Widok `/katalog` wpięty w router (12 tras), renderuje realne dane
- [x] Szukajka, filtry, zakładki, sortowanie, paginacja, konfigurator kolumn, wirtualizacja
- [x] Modal podglądu read-only (D4)
- [x] `lint`, `typecheck`, `test` zielone po obu stronach
- [x] Rozjazd `szerokosc` opisany w raport.md z propozycją domknięcia backlogu #3
- [ ] Po merge do `develop` auto-deploy stawia katalog na `test.agritires.eu`; Ania potwierdza
      wygląd — poza zasięgiem code review (dzieje się po merge).

## Parallel-test concerns

None — wszystkie nowe testy backendu chodzą po prawdziwym SQLite w katalogu tymczasowym (harness
GATE z I1, bez `listen()`, bez portu). Testy frontendu używają MSW + jsdom, bez zasobów
współdzielonych. `queryClient.clear()` w `afterEach` (`test/setup.ts:58`) izoluje testy od siebie
nawzajem w ramach jednego procesu, ale nie dotyka żadnego zasobu zewnętrznego — bezpieczne przy
równoległej pracy kilku agentów.

## Overall assessment

Bardzo solidna, wierna odbudowa — backend to niemal dosłowne tłumaczenie oryginału (parsowanie
parametrów, rozgałęzienie kształtu odpowiedzi, przeliczanie statusu dostawcy, zapytanie okienkowe),
a naprawy D5 w schemacie Drizzle są kompletne i poprawnie przetestowane na obu pułapkach typów
(`eanIsValid` jako liczba, 10 kolumn boolean, `NULL` zostający `null`). Frontend odtwarza filtrację,
sortowanie, paginację i wirtualizację z dokładnością do stałych liczbowych (74/444/37/20/150), a
testy (backend i frontend) są rzeczowe, nietautologiczne i nie nadużywają mocków. Znalezione
odstępstwa (wskaźnik kierunku sortowania, etykieta „Nazwa", brak `ResizeObserver`) są drobne,
lokalne i nie wpływają na GATE ani na DoD — warto je jednak świadomie zatwierdzić albo cofnąć,
żeby nie kumulowały się jako niezamierzony dryf od oryginału w kolejnych iteracjach.
