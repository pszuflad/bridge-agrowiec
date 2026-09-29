# 155-FEATURE-dziedziczenie-wagi-po-rozmiarze — Code review

> Reviewed: 2026-09-25
> Branch: `feature/155-dziedziczenie-wagi-po-rozmiarze`
> Diff: 27 plików, 5 commitów (vs `origin/develop`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/test/dziedziczenie-wagi.integracja.test.ts` — brak testu integracyjnego
  na priorytet `applyWagaPamiec` nad dziedziczeniem, mimo że plan.md w sekcji „Testing
  strategy" wprost go wymaga („produkt z `waga_pamiec` ma pierwszeństwo przed
  dziedziczeniem"). `raport.md` twierdzi „4/4 integration: … priorytet wagi z importu…”, ale
  faktycznie sprawdzone jest tylko: (1) dziedziczenie działa, (2) waga z IMPORTU nie jest
  nadpisywana, (3)-(4) reset flagi. Ścieżka `waga_pamiec` (kod widziany wcześniej z inną
  wagą, bez wagi w bieżącym imporcie) nigdy nie jest ćwiczona razem z dziedziczeniem, więc
  kolejność wywołań `applyWagaPamiec` → `applyWagaDziedziczona` w `akceptacja.ts`/`bulk.ts`
  jest zweryfikowana tylko czytaniem kodu, nie testem.
  - Reason: to jest najważniejsza gwarancja biznesowa ticketu („ręczna waga/pamięć zawsze
    wygrywa"), jawnie wymagana w planie — jej brak w testach to realna luka pokrycia, nie
    tylko kosmetyka.
  - Suggestion: dopisać test wstawiający wpis w `waga_pamiec` dla danego `kod`, importujący
    pozycję bez wagi, i asercję że `waga` pochodzi z pamięci (nie z dziedziczenia) oraz
    `wagaAutoUzupelniona === false`.

- [ ] `rebuild/backend/scripts/dziedzicz-wage.ts:30-34` — zapytanie `SELECT * FROM products
  WHERE waga IS NULL OR waga = 0` ładuje do pamięci CAŁĄ tabelę pasujących wierszy naraz i
  iteruje z osobnym `UPDATE` per wiersz bez transakcji (raport to odnotowuje jako świadome
  uproszczenie). Przy większym katalogu może być wolne; nie blokujące przy obecnej skali
  (odnotowane w raporcie), ale warto rozważyć `db.transaction()` wokół pętli — koszt zerowy,
  a chroni przed połowicznym zapisem przy przerwaniu skryptu w trakcie.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/import/dziedziczenieWagi.ts:89-97` — tolerancja pustego bieżnika
  dopuszcza też `bieznik = ""` po stronie kandydata (`eq(products.bieznik, "")`), co jest
  rozszerzeniem decyzji 4 z planu (mówiącej o `null`/braku danych) o pusty string. Sensowne i
  spójne z resztą `tekstLubNull`, ale warto dopisać jedno zdanie komentarza uzasadniające to
  rozszerzenie, żeby przyszła sesja nie uznała tego za niezamierzone odstępstwo od planu.
- [ ] `rebuild/frontend/src/pages/katalog/formatowanie.tsx:264-280` — gdy `wartosc === 0` (waga
  legacy, niedociągnięta jeszcze backfillem), komórka pokazuje `"0"` zamiast `<Kreska />`,
  mimo że logika biznesowa traktuje `0` jako „pustą wagę" wszędzie indziej
  (`jestPustaWaga`). Kosmetyczna niespójność wizualna do czasu uruchomienia backfillu.
- [ ] `rebuild/backend/scripts/dziedzicz-wage.ts:41` — komentarz „filtr SQL wyżej jest
  zgrubny” trochę myli: SQL faktycznie już dokładnie odpowiada `jestPustaWaga` dla
  `NULL`/`0`, dociążenie w JS ma sens tylko dla stringów/`NaN`, które w tej kolumnie (`real`)
  praktycznie się nie zdarzą — nieszkodliwe, ale komentarz przecenia ryzyko.

## Plan compliance

### Done ✓
- Migracja `014_waga_auto_uzupelniona.sql`, kolumna w `schema.ts`.
- Nowy moduł `dziedziczenieWagi.ts` z `isEmptyWaga`/`kluczZRekordu`/`znajdzWageDoDziedziczenia`/
  `applyWagaDziedziczona`, odseparowany od `bridge-ext.ts` zgodnie z zasadą CLAUDE.md.
- Wpięcie w `akceptacja.ts` i `bulk.ts` tuż po `applyWagaPamiec`, w `try/catch` nieblokujący
  zapisu — zgodnie z planem.
- Reset flagi przy ręcznej edycji w `repos/products.ts::aktualizujProdukt`, bez efektów
  ubocznych na `manual_overrides`/`history`/`audit_log` (te iterują po `zmiany` z
  `routes/products.ts`, nie po `doZapisu` — sprawdzone, zapis flagi nie tworzy fałszywych
  wpisów poprawek/dziennika).
- Kontrakt `openapi.yaml` rozszerzony (oba miejsca schematu `Produkt`), fixtures
  zaktualizowane, `wagaAutoUzupelniona` poprawnie POZA `KOLUMNY_POZA_KONTRAKTEM` (jest
  częścią kontraktu, celowo).
- Skrypt CLI `dziedzicz-wage.ts` + wpis w `package.json`.
- Frontend: typ `Produkt`, gałąź renderowania w `formatowanie.tsx` z ikoną `Info` + tooltipem,
  test komponentowy.
- Testy jednostkowe (22) dla `dziedziczenieWagi.ts`.
- Mechaniczne poprawki testów/gate po dodaniu kolumny (72→73/74 kluczy) — sprawdzone punktowo
  (`katalog.gate.test.ts`, `produkty.mutacje.test.ts`, `projekcja.test.ts`) — poprawki są
  wyłącznie liczbowe, nie zmieniają asercji zachowania.

### Missing or deviating ✗
- Test integracyjny na priorytet `waga_pamiec` nad dziedziczeniem — wymagany w planie, brak w
  implementacji (patrz SHOULD-FIX).
- Odstępstwo od planu (opisane i uzasadnione w raporcie): kolumna `waga_auto_uzupelniona` jest
  `NULLABLE` zamiast `NOT NULL DEFAULT 0` z powodu harnessu charakteryzacyjnego wstawiającego
  RAW SQL z jawnym `NULL`. Uzasadnienie sensowne, aplikacja i tak traktuje `null` jak `false` —
  nie flaguję jako problem.

### Definition of done
- [x] Migracja dodana i opisana (`rebuild/schema/README.md` — nie weryfikowano wpisu wprost,
      ale plik migracji jest kompletny i skomentowany).
- [x] Nowa kolumna + moduł z testami jednostkowymi.
- [x] Wpięcie w `akceptacja.ts` i `bulk.ts`.
- [x] Reset flagi przy ręcznej edycji.
- [x] Kontrakt rozszerzony, fixtures przechodzą.
- [x] Skrypt CLI działający i (ręcznie) przetestowany.
- [x] Frontend: tooltip/ikona.
- [x] Testy jednostkowe + integracyjne zielone, pełne bramki zielone (wg raportu:
      1871/1871 backend, 995/995 frontend) — nie uruchamiałem bramek ponownie w tym
      przeglądzie, opieram się na raporcie.
- [ ] Gałąź zsynchronizowana z `develop`, PR `MERGEABLE` — poza zakresem code review (robi to
      Master przy pushu).

## Parallel-test concerns

None — nowe testy używają `stworzTestowaBaze()` (baza tymczasowa) i skryptu z wymaganym
`DB_PATH` z env, zgodnie z istniejącym wzorcem projektu. Brak twardo zakodowanych ścieżek/portów.

## Overall assessment

Implementacja jest staranna, dobrze udokumentowana i konsekwentnie trzyma się decyzji z
plan.md (klucz dopasowania, MAX przy rozjeździe, tolerancja pustego bieżnika, priorytet
kolejności wywołań zamiast dodatkowego sprawdzania `manual_overrides` w ścieżce importu).
Separacja od `bridge-ext.ts` jest zgodna z zasadą CLAUDE.md o nieportowej logice. Jedyna
realna luka to brak testu na współdziałanie z `waga_pamiec` — mechanizm jest zaimplementowany
poprawnie (kolejność wywołań w kodzie to gwarantuje), ale nie jest to dziś udowodnione testem,
mimo że plan tego testu wprost wymagał. Reszta uwag to drobiazgi niewymagające blokowania mergu.
