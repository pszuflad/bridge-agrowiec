# 36-FEATURE-konto-admin-maintenance — Code review

> Reviewed: 2026-09-05
> Branch: `feature/36-konto-admin-maintenance`
> Diff: 36 plików, 7 commitów (bez `plan.md`, który jest artefaktem ticketa)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md` — roadmapa NIE została sprostowana, mimo że to punkt Definition of done tego ticketa.
  - Reason: DoD wprost wymaga: „Roadmapa sprostowana: `PATCH` zamiast `PUT`, zakres 12b odhaczony, ustalenia dla 12a/12c/12d/12e wpisane DO ICH bloków." `git diff origin/develop...HEAD -- docs/rebuild-roadmap.md docs/rebuild-backlog.md` jest PUSTY — żaden z tych plików nie został dotknięty. Konkretnie linia 1571 roadmapy wciąż mówi `GET/PUT /api/admin/supplier-config` — to dokładnie błąd, który `plan.md` (Kontekst §1) każe sprostować, a `raport.md` w ogóle nie wspomina o roadmapie (mówi tylko „Decyzje D1–D8 zrealizowane w całości", co nie obejmuje tego punktu DoD). Zgodnie z CLAUDE.md §„Roadmapa jest wejściem dla następnej sesji" błędny opis metody w roadmapie prowadzi do powtórki tego samego pomyłkowego wzorca w kolejnych sesjach (12a/12c/12d/12e), które czytają roadmapę, nie ten ticket.
  - Suggestion: zaktualizować blok „Iteracja 12" w roadmapie — `PATCH` zamiast `PUT`, odznaczyć zakres 12b jako zrobiony (z datą i ID ticketa), przenieść ustalenia dotyczące 12a/12c/12d/12e (np. notę o `przeplanujScheduler` jako wierniejszym porcie, notę o braku 401 dla `audit-log` w openapi, notę o fixtures mutacji do 12d) do ich właściwych bloków.

## SHOULD-FIX

- [ ] `rebuild/backend/src/historia/mapowanie.ts:84-85` — mylący komentarz NIE został sprostowany, mimo że plan.md i DoD tego wymagają.
  - Reason: Zarówno „Kontekst §2" planu, jak i Krok 9, jak i ostatni punkt Definition of done mówią wprost, że komentarz „Ten sam parser obsłuży `/api/audit-log` w I12" jest nieprawdziwy (trasa oddaje surowy string, nie parsuje) i ma zostać doprecyzowany razem z dołożeniem kotwicy w drugą stronę. `git diff` na tym pliku jest pusty — plik nie był w ogóle dotknięty w tej sesji. `raport.md` nie wspomina o tym pominięciu.
  - Suggestion: poprawić komentarz na `mapowanie.ts:84-85`, np. wskazując, że front ma OSOBNĄ kopię parsera w `pages/konfiguracja/dziennik.ts` (D4), a nie że backend go reużyje.

- [ ] `rebuild/frontend/src/pages/MojeKonto.tsx:55-60` — jeden `catch` zlewa dwa różne komunikaty toastu oryginału w jeden.
  - Reason: Oryginał (`frontend-index.js:27680-27694`) rozróżnia dwa przypadki: `!e.ok` → toast `{title:"Nie udało się zmienić hasła", description:i?.error||"Spróbuj ponownie"}`, a wyjątek sieciowy (np. `fetch` rzuca) w osobnym `catch` → toast `{title:"Błąd", description:e?.message||"Nieznany błąd"}`. Port łączy oba przypadki w jednym `catch` w `MojeKonto.tsx`, więc awaria sieci (np. `TypeError: Failed to fetch`) pokaże tytuł „Nie udało się zmienić hasła" zamiast „Błąd" — drobna, ale realna rozbieżność tekstu wobec D7 („teksty FE dosłownie z oryginału"), niepokryta żadnym testem (network-failure path nie jest testowany w `moje-konto.test.tsx`).
  - Suggestion: rozdzielić `zmienHaslo()` z `moje-konto/api.ts` (rzuca dla `!ok`) od wyjątku sieciowego (np. innym typem błędu albo dwoma blokami try/catch w komponencie), żeby zachować dwa różne tytuły toastu.

- [ ] `rebuild/backend/src/routes/admin.ts:123-205` (`PATCH /api/admin/supplier-config/:kod`) — brak `try/catch` wokół `aktualizujDostawce`/audytu, w odróżnieniu od oryginału.
  - Reason: Oryginał (`extensions.cjs:344-395`) owija operacje bazowe w `try { … } catch (e) { res.status(500).json({error: e.message}) }`. Port nie ma tego opakowania — błąd bazy (np. constraint) trafiłby do domyślnego error-handlera Express z innym kształtem odpowiedzi niż `{error: e.message}`. Niska szansa wystąpienia (operacja jest prostym UPDATE po zwalidowanych polach), ale to odejście od 1:1 nieodnotowane w planie/raporcie.
  - Suggestion: dodać `try/catch` analogiczny do `GET /api/admin/suppliers-list` (które go ma) albo świadomie odnotować pominięcie.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/test/konfiguracja.admin.test.tsx` — test „po potwierdzeniu wysyła {potwierdzenie:'WYCZYSC'} i pokazuje toast" (katalog) nie sprawdza trzech `invalidateQueries` explicite (tylko toast i ciało żądania); dowód D7 w tym miejscu jest częściowy.
- [ ] `rebuild/backend/src/routes/maintenance.ts:79-108` (`usun-nieopony`) iteruje po `listaProduktow(db)` (cała tabela do pamięci) — dla bardzo dużego katalogu to potencjalny hotspot, ale to port 1:1 zachowania oryginału (`U.listProducts()`), więc nie do naprawienia w tym tickecie.
- [ ] `rebuild/frontend/src/pages/konfiguracja/admin.ts:69-76` — `pobierzJson` nie ustawia limitu czasu / abort na `fetch`; wzorzec zgodny z resztą projektu, ale warto rozważyć wspólny timeout przy kolejnym audycie (12e).

## Plan compliance

### Done ✓
- Krok 1–2: `repos/users.ts` (projekcja jawna), `auth/zmiana-hasla.ts` (port `P4` 1:1, kolejność sprawdzeń), `routes/konto.ts` (`POST /api/password/change`, `GET /api/users`), testy `konto.haslo.test.ts`.
- Krok 3: `routes/admin.ts` — `GET supplier-config`/`suppliers-list` (pętla po dispatcherze, nie po `suppliers`), `PATCH supplier-config/{kod}` (hasOwnProperty, granice 5..10080, regex URL, toUpperCase, kolejność 400/404/pusty patch) — zweryfikowane linia po linii wobec `extensions.cjs:296-405`, zgodne.
- Krok 4: `routes/maintenance.ts` — `usun-nieopony` (limit przykładów 10, substring 60) i `products/clear` (ścisłe porównanie, kopia bazy z checkpointem WAL — D5 zrealizowane i przetestowane na dysku).
- Krok 5: `GET /api/audit-log` — surowy `listAudytu`, bez parsowania, `requireAuth` (D2).
- Krok 6: GATE (`admin.gate.test.ts`) — realna siatka bezpieczeństwa: test na `szczegolyJson` jako string, na NULL i niezłączalny `encjaId`, 401 na wszystkich ośmiu operacjach, 10 pozycji list mimo mniejszej tabeli `suppliers`.
- Krok 7: `/moje-konto` — port `lM()` 1:1 co do warunków walidacji, `data-testid`, kolejności komunikatów, danych z sesji (bez fetcha do `/api/me`).
- Krok 8: przycisk „Usuń wszystko z katalogu" w `Katalog.tsx` — `window.confirm`, treść dosłowna, trzy `invalidateQueries`, toasty 1:1 z oryginałem.
- Krok 9: zakładki „Admin" i „Dziennik", dialog edycji dostawcy wysyłający tylko zmienione pola (zweryfikowane testem), `parsujSzczegoly`/`streszczSzczegoly` we froncie (D4) z testami na NULL/zepsuty JSON/wartość nie-obiektową.
- Odstępstwo na plus: `przeplanujScheduler` faktycznie podpięty pod zmianę częstotliwości (wierniejszy port niż planowany pominięcie `lastRunPerSupplier`).

### Missing lub deviating ✗
- Ostatni punkt DoD („roadmapa sprostowana") — NIE zrealizowany; `docs/rebuild-roadmap.md` i `docs/rebuild-backlog.md` nietknięte (BLOCKER powyżej).
- Nota „Do poprawienia przy okazji" z Kroku 9 planu (komentarz w `historia/mapowanie.ts:87-91`) — NIE zrealizowana (SHOULD-FIX powyżej).
- Rozdzielenie toastu „Błąd" (sieć) od „Nie udało się zmienić hasła" (HTTP) w `/moje-konto` — ubyło wobec D7 (SHOULD-FIX powyżej), nieodnotowane w raporcie.

### Definition of done
- [x] Osiem operacji backendu za `requireAuth`, każda 401 bez tokenu — potwierdzone testem `admin.gate.test.ts`.
- [x] GATE: cztery fixtures zgodne 1:1 + komplet kluczy.
- [x] `GET /api/audit-log` znosi NULL i niezłączalny `encjaId` — dowiedzione testem na danych.
- [x] `products/clear` chroniony ścisłym potwierdzeniem, kopia bazy przed czyszczeniem (zweryfikowana na dysku, niepusta).
- [x] `PATCH /api/admin/supplier-config/{kod}` odtwarza wszystkie gałęzie walidacji — potwierdzone linia po linii wobec oryginału i testami granicznymi.
- [x] `/moje-konto` — zmiana hasła + realne przelogowanie, teksty i `data-testid` 1:1 (z drobnym wyjątkiem toastu sieciowego, patrz SHOULD-FIX).
- [x] Przycisk „Usuń wszystko z katalogu" z `window.confirm` i trzema `invalidateQueries`.
- [x] Zakładki „Admin" i „Dziennik" obsługują cztery pozostałe trasy.
- [x] Parser szczegółów we froncie ma kotwicę i test na te same trzy wejścia — ALE mylący komentarz w `mapowanie.ts` NIE sprostowany.
- [x] `lint`/`typecheck`/`build`/`test` czyste (potwierdzone lokalnym przebiegiem testów tego ticketa — 62 backend + 68 frontend, wszystkie zielone).
- [ ] Roadmapa sprostowana (PATCH, odhaczenie 12b, ustalenia do 12a/12c/12d/12e) — NIE zrealizowane.

## Parallel-test concerns

None — wszystkie nowe testy backendu chodzą na `stworzSrodowiskoTestowe()` (baza w katalogu tymczasowym, porty efemeryczne), a testy frontendu na MSW z `queryClient.clear()`/`sessionStorage.clear()` w `beforeEach`. `maintenance.test.ts` czyści własne pliki kopii (`.bak_before_clear_*`) w `beforeEach`, więc nie zostawia śmieci między przebiegami. Brak twardych portów, brak współdzielonych plików o ustalonej nazwie.

## Overall assessment

Warstwa backendu jest bardzo solidna: porty `P4()`, `extensions.cjs:296-405` i obu tras maintenance są zweryfikowane linia po linii wobec oryginału i zgodne, GATE realnie broni kontraktu (siatka bezpieczeństwa potwierdzona odwrotnym testem — sparsowanie `szczegolyJson` faktycznie wywala test), a kopia bazy z checkpointem WAL jest sprawdzana na dysku, nie na samym wywołaniu. Frontend też trzyma się oryginału (`lM()`, przycisk czyszczenia katalogu) z jednym drobnym rozjazdem tekstu toastu przy błędzie sieci. Największym problemem tego ticketa nie jest kod, a rozliczenie: dwa explicit punkty z planu/DoD (sprostowanie roadmapy, poprawka komentarza w `mapowanie.ts`) zostały pominięte, a `raport.md` deklaruje realizację D1–D8 „w całości" bez wzmianki o tych dwóch nieprzeprowadzonych krokach — to samo w sobie warte odnotowania przy kolejnych sesjach jako wzorzec do sprawdzania.
