# 18-FEATURE-widok-alerty — Code review

> Reviewed: 2026-09-03
> Branch: feature/18-widok-alerty
> Diff: 15 plików, 5 commitów (vs `origin/develop`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `docs/rebuild-backlog.md` — brakuje wpisu dla D1 (pominięcie pseudo-alertów katalogowych
  `HT()`/`pv()`).
  - Reason: `plan.md` explicite wymaga tego w sekcji D1 („Pominięcie zostaje odnotowane jako
    **nowy wpis w `docs/rebuild-backlog.md` (⬜ do decyzji)**") oraz w Definition of done
    („D1 wpisana do backlogu"). Diff nie dotyka `docs/rebuild-backlog.md` ani
    `docs/rebuild-roadmap.md` w ogóle — `raport.md` wspomina temat w sekcji Follow-up, ale to
    nie to samo miejsce, do którego odsyła plan. Wiedza o porzuconej funkcji (pseudo-alerty
    katalogowe: marża ujemna, niska marża, „nie-opona") nie żyje tam, gdzie następna sesja
    będzie jej szukać.
  - Suggestion: dopisać wpis ⬜ do `docs/rebuild-backlog.md` (lub potwierdzić, że robi to osobny
    ticket dokumentacyjny typu `17-DOCS-...`, i wtedy zamknąć ten punkt jako świadomie
    przesunięty, nie pominięty).

- [ ] `rebuild/frontend/src/pages/alerty/TabelaAlertow.tsx:245-260` — przycisk rozwijania grupy
  (`button-expand-*`) nie ma dostępnej nazwy dla czytników ekranu.
  - Reason: wewnątrz `<button aria-expanded=...>` są wyłącznie dwie ikony SVG (`Chevron*`,
    `ikonaPoziomu`), bez `aria-label` ani tekstu w `sr-only`. Czytnik ekranu ogłosi go jako
    bezimienny „button", mimo że `aria-expanded` jest poprawnie ustawione. To nowy wzorzec w
    repo (brak precedensu `aria-expanded` gdzie indziej), więc warto od razu zrobić to
    kompletnie.
  - Suggestion: dodać `aria-label={rozwinieta ? "Zwiń grupę" : "Rozwiń grupę"}` albo
    `aria-labelledby` wskazujący na tekst nagłówka grupy obok.

- [ ] `rebuild/frontend/src/pages/alerty/TabelaAlertow.tsx:118-119` — `wartosciFiltrow`/
  `filtrujAlerty`/`pogrupujAlerty` liczone bez memoizacji przy każdym renderze komponentu.
  - Reason: przy ~3000 alertach (dzisiejszy stan) koszt jest pomijalny, ale każdy render
    (rozwinięcie/zwinięcie DOWOLNEJ grupy, zmiana `isPending` mutacji, zmiana filtra) przelicza
    grupowanie na całym, nieprzefiltrowanym zbiorze od nowa. `raport.md` (Follow-up #3) sam
    wskazuje wzrost do ~45 tys. wierszy w ciągu roku po włączeniu schedulera z 3f-3 — w tamtym
    momencie brak memoizacji przestanie być teoretyczny. Warto to zaadresować teraz, zanim
    stanie się kolejnym „odziedziczonym" długiem.
  - Suggestion: `useMemo` na `dostepne`/`widoczne`/`grupy` z zależnością od `alerty` i `filtry`.

- [ ] `rebuild/backend/test/alerty.gate.test.ts:112-138` — test „PATCH /api/alerts/{id} zmienia
  status i oddaje {ok:true}" mutuje wiersz z fixture'a i przywraca go ręcznie w tym samym `it`.
  - Reason: jeśli asercja w środku testu (np. `expect(poZmianie...).toBe("nowy")`) padnie, kod
    przywracający status nigdy się nie wykona i baza zostaje w stanie niezgodnym z fixture'em
    dla reszty pliku — kolejne testy w tym samym `describe` (np. sprawdzenie długości listy)
    mogłyby dać fałszywie pozytywny/negatywny wynik zależnie od tego, co się akurat zmieniło.
    Nie jest to problem współbieżności między agentami (każdy plik gate ma własne, izolowane
    środowisko z `stworzSrodowiskoTestowe()`), ale jest to krucha konstrukcja w obrębie samego
    pliku.
  - Suggestion: `try/finally` wokół przywrócenia albo osobny wiersz zasiewu dedykowany temu
    testowi zamiast dzielenia się rekordem z pozostałymi asercjami w pliku.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/alerty/grupowanie.ts:50` — klucz grupy dla `dostawca: null`
  to `` ` brak` `` (ze spacją na początku) — działa, ale wygląda jak literówka; warto `"brak"`
  bez spacji albo krótki komentarz tłumaczący, czemu spacja jest tam celowo (np. żeby nie
  zderzyć się z prawdziwym kodem dostawcy „brak").
- [ ] `rebuild/frontend/src/pages/alerty/TabelaAlertow.tsx:203` — licznik „`N` grup" nie
  odmienia się przez liczbę (dla 1 pokaże „1 grup" zamiast „1 grupa"); kosmetyczne, niski wpływ.
- [ ] `rebuild/backend/src/routes/alerts.ts:59` — `String(status)` na `undefined` da literalny
  string `"undefined"` zapisany do kolumny, gdy klient wyśle ciało bez pola `status`; zgodne
  z 1:1 (oryginał robi `c.body.status` bez sprawdzenia), ale warto rozważyć wspólny komentarz
  z `updateAlertStatus` przypominający, że to świadomie brak walidacji, nie przeoczenie —
  komentarz już to mówi w repo, dublowanie w routingu nie jest konieczne, tylko sygnalizuję dla
  pełności.

## Plan compliance

### Done ✓
- A1–A3: `listAlerts`/`updateAlertStatus` dopisane do istniejącego `repos/alerts.ts` (nie
  powstał drugi plik), `routes/alerts.ts` wzorowany na `overrides.ts`, montaż w `app.ts`.
- GATE (`alerty.gate.test.ts`): 8 testów pokrywających kształt/kolejność/401/D4/audit_log —
  zgodnie ze strategią testów z planu.
- B1–B6: `api.ts` (limit równoległości 8, `Promise.allSettled`), `grupowanie.ts` (klucz
  `dostawca|typ|status`, sortowanie grup i wpisów, `wartosciFiltrow`), `TabelaAlertow.tsx`
  (filtry, rozwijanie, mutacje na grupie i wpisie), `Alerty.tsx`, wpięcie w `App.tsx` i
  wyrejestrowanie z `placeholdery.ts` (liczba tras routera bez zmian, potwierdzone).
- D1–D9 zaimplementowane zgodnie z opisem: `requireAuth` na obu trasach (D2), PATCH 1:1 bez
  audytu/walidacji/404 (D4), status przez API bez IndexedDB (D3), domyślny filtr `nowy` (D7),
  filtry status/dostawca/typ wyliczane z danych (D8), `GET` bez limitu (D9).
- Test na danych z powtórkami (`alerty.grupowanie.test.ts`, `alerty.test.tsx`) realnie dowodzi
  zwijania — 24/28 alertów → 2/3 grupy, `opis` nieobecny w DOM przed rozwinięciem.

### Missing or deviating ✗
- Wpis do `docs/rebuild-backlog.md` dla D1 — nieobecny w diffie (patrz SHOULD-FIX).
- `docs/rebuild-roadmap.md` §Iteracja 6 nadal ma `Status: ⬜` — nie zaktualizowano na zamkniętą
  (być może celowo zostawione dla osobnego kroku „sync docs", jak w ticketach 16/17 wcześniej
  w historii commitów; wymaga potwierdzenia u Mastera, nie traktuję jako samodzielny BLOCKER
  tego ticketa).

### Definition of done
- [x] `GET /api/alerts` — goła tablica, 7 pól, `data` DESC, bez limitu, zgodne z fixture/kontrakt.
- [x] `PATCH /api/alerts/{id}` — zawsze `{ok:true}`, zmienia status, auth, bez audytu.
- [x] Obie trasy za `requireAuth`; 401 bez tokenu potwierdzone testem.
- [x] `listAlerts`/`updateAlertStatus` dopisane do istniejącego `repos/alerts.ts`.
- [x] Widok `/alerty` wpięty w router, listuje zwinięte grupy z licznikiem i czasem ostatniego
      wystąpienia, rozwijalne.
- [x] Domyślny filtr `status=nowy`; filtry status/dostawca/typ działają.
- [x] Zmiana statusu przez API, na grupie i pojedynczym wpisie, w obie strony.
- [x] Test na danych z powtórkami dowodzi zwijania.
- [x] GATE fixtures/kontrakt zielony; lint/typecheck/build/test czyste w BE i FE (potwierdzone
      lokalnie: BE 8/8 nowych + zielony lint/typecheck, FE 31/31 nowych + zielony lint/typecheck).
- [ ] Decyzja D3 zapisana w planie i raporcie — **tak**; D1 wpisana do backlogu — **nie**
      (brak zmian w `docs/rebuild-backlog.md`).

## Parallel-test concerns

Żaden test nie używa stałego portu ani współdzielonego pliku poza harnessem
`stworzSrodowiskoTestowe()`, który już jest wzorcem sprawdzonym w innych plikach `*.gate.test.ts`
(izolowana baza tymczasowa per plik). Jedyna uwaga to wewnątrzplikowa krucha kolejność w
`alerty.gate.test.ts` (mutacja + ręczne przywrócenie stanu w jednym `it`) — opisana wyżej jako
SHOULD-FIX, nie jako problem współbieżności między agentami.

## Overall assessment

Solidna, dobrze udokumentowana implementacja — backend to niemal dosłowny port dwóch linijek
oryginału z kompletem komentarzy tłumaczących świadome odstępstwa (D1/D2/D4), a logika
grupowania w `grupowanie.ts` jest czysta, przetestowana na realistycznym rozkładzie (23/150
powtórek) i faktycznie dowodzi zwijania, a nie tylko deklaruje je w opisie testu. Braki są
drugorzędne: nieuzupełniony wpis do backlogu dla D1 (wymóg własnego DoD ticketa), brak
`aria-label` na przycisku rozwijania grupy i brak memoizacji grupowania na rosnącym zbiorze
danych. Kierunek zmian jest prawidłowy, kod gotowy do merge'a po domknięciu punktu z backlogiem
(reszta to poprawki jakości, nie warunek wejścia).
