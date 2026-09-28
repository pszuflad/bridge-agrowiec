# 120-CHORE-i15-2-resync-parserow — Code review

> Reviewed: 2026-09-23
> Branch: `chore/120-i15-2-resync-parserow`
> Diff: 57 plików, 9 commitów (`a46d463`…`ae756df`) + drobne WIP w drzewie roboczym w chwili review
>   (`src/import/parsuj.ts`, `test/feed-safety.test.ts`, `test/archiwum-importow.gate.test.ts`) —
>   uwzględnione w ocenie, bo to one realnie działają w repo w tej chwili.

## BLOCKER

- [ ] `rebuild/backend/src/routes/suppliers.ts:245` — `POST /api/dostawcy/:kod/upload` daje **500**
  zamiast **400** dla dokładnie tego samego przypadku („błąd odczytu cennika"), dla którego
  `routes/import.ts` (endpointy `parse-file`/`from-url`) poprawnie daje 400.
  - Reason: `parsuj.ts` (od tego ticketu) tłumaczy wyjątek `feed_safety.attach()` na dwa typy:
    `PustyImportBlad` (pusty cennik/brak listy) i **nowy** `BladCennika` (błędy odczytu, #103).
    `routes/import.ts:144` sprawdza oba typy → 400. `routes/suppliers.ts:245` sprawdza WYŁĄCZNIE
    `instanceof PustyImportBlad` → dla `BladCennika` wpada w gałąź `: 500`. **Zweryfikowane
    empirycznie** (test doraźny, nieskomitowany): upload przez `/api/dostawcy/MO1/upload` pliku,
    który parser MO1 odczytuje z błędami wiersza (bez rzucania wyjątku przez sam parser), daje
    `STATUS: 500`, body `{"error":"Błędy odczytu cennika (1). Import zatrzymany bez przełączania
    na stary format.", ...}`. Przed tym ticketem ten sam scenariusz kończył się **400** (parser
    zwracał `records: []` bez rzutu, `uruchomImport(kod, [])` rzucał *stary* `PustyImportBlad`
    z D4-guard w silniku, złapany przez ten sam `instanceof PustyImportBlad`). Czyli resync
    **pogorszył** kontrakt HTTP dokładnie tej trasy, którą D-6/#103 miało naprawić — a `/api/dostawcy/:kod/upload`
    to „ścieżka główna" dla MO6/MO8 (import ręczny bez auto-pulla, wg komentarza w `import.ts:45-47`).
    Istniejący test `test/dostawcy.upload.test.ts` tego nie łapie, bo asercja jest luźna
    (`expect(odp.status).toBeGreaterThanOrEqual(400)` — przechodzi zarówno dla 400, jak i 500),
    a scenariusz w tym teście (XLSX-śmieci dla MO8) i tak trafia w twardy wyjątek SheetJS,
    nie w ścieżkę `errors.length>0` z `feed_safety`.
  - Suggestion: `suppliers.ts:245` powinno rozpoznawać też `BladCennika` (import z `../import/parsuj.js`,
    tak jak w `routes/import.ts:10`) i mapować na 400, analogicznie do `import.ts:144`.
  - Uwaga do raportu: `raport.md:39-43` i `karta.md:78-83` twierdzą, że tłumaczenie wyjątku
    „obejmuje wszystkie trzy wejścia" (`routes/import.ts`, `routes/suppliers.ts`, `synchronizuj.ts`).
    To prawda WYŁĄCZNIE na poziomie typu wyjątku rzucanego z `parsuj.ts` — nie na poziomie
    mapowania na kod HTTP w każdej trasie. Dla `synchronizuj.ts` (auto-pull, brak odpowiedzi HTTP)
    to bez znaczenia — tam `catch` jest generyczny i degraduje się poprawnie niezależnie od typu
    wyjątku (zweryfikowane czytaniem `synchronizuj.ts:229-247`). Dla `suppliers.ts` różnica jest realna.

## SHOULD-FIX

- [ ] `docs/rebuild-backlog.md` — Definition of done w `plan.md:279` wymaga „statusy #73/#75/#78/#79/#80/#82/#99/#103/#105"
  i oznaczenia #11/14i jako zastąpionych przez #99/D4. Plik NIE został ruszony w ogóle
  (`git diff origin/develop...HEAD -- docs/rebuild-backlog.md` jest pusty) — to jest zgodne z
  CLAUDE.md regułą 1 („statusy wpisów aktualizuje ta sesja, która je realizuje”), ale ten
  ticket właśnie jest tą sesją i sam zostawił to w sekcji „Follow-up”/„Do koordynatora” zamiast
  zrobić. Nie blokuje mergu kodu, ale to bezpośrednio niespełniony punkt własnego DoD.
- [ ] `rebuild/backend/src/import/parsuj.ts:95-97` (komentarz) — sformułowanie „Dotyczy wszystkich
  trzech wejść” wprowadza w błąd w świetle powyższego BLOCKERA; po naprawie `suppliers.ts` warto
  to zdanie utrzymać prawdziwym, albo dopisać zastrzeżenie, że mapowanie na kod HTTP leży w
  każdej trasie osobno.
- [ ] Stan repo w momencie review: trzy pliki (`src/import/parsuj.ts`, `test/feed-safety.test.ts`,
  `test/archiwum-importow.gate.test.ts`) miały niezakomitowane zmiany zawężające tłumaczenie
  wyjątków do dokładnie trzech znanych komunikatów `feed_safety` (dobra, celowa zmiana — chroni
  przed przebieraniem prawdziwej awarii serwera za błąd 400). `raport.md` (stan po `707f7fb`)
  wciąż opisuje POPRZEDNIĄ wersję zachowania dla `archiwum-importow.gate.test.ts` („zepsuty cennik…
  daje 400 zamiast 500”, `raport.md:152-155`), podczas gdy aktualny (nieskomitowany) kod przywraca
  tam **500** (`ZEPSUTY_MO7` to twardy wyjątek czytnika CSV, nie ścieżka `feed_safety`). Przed
  zamknięciem ticketu `raport.md` wymaga przeliczenia pod finalny stan kodu.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/dostawcy.upload.test.ts:187` — asercja `toBeGreaterThanOrEqual(400)`
  jest na tyle luźna, że nie odróżnia 400 od 500; po naprawie BLOCKERA warto ją zaostrzyć na
  konkretny kod, żeby przyszły resync nie mógł po cichu cofnąć naprawy.
- [ ] `docs/karty/I15.2/karta.md:107-109` — nota „(c) #103 jest w backlogu zduplikowany” jest
  trafna i dobrze udokumentowana, ale sam wpis backlogu nie został skorygowany w tym ticketcie
  (świadomie, do koordynatora) — spójne z resztą, tylko zostawiam jako przypomnienie przy odbiorze.

## Plan compliance

### Done ✓
- Resync 12 plików warstwy parserów (8 zmienionych + 4 nowe moduły) do `88fa31c`, równolegle
  `mirror/backend/` i `src/import/legacy/` — **zweryfikowane sha256/hash-object**: wszystkie 12
  plików identyczne w `88fa31c`, `mirror/backend/` i `legacy/`.
- D-1 (kopia całych plików, nie okrojonych) — zrealizowane i uzasadnione.
- D-3 (test akceptacyjny na pełnych cennikach) — wykonany, opisany z liczbami w `raport.md`.
- D-5 (przenagranie wzorca silnika) — wykonane.
- D-6 (bezpiecznik HTTP na wyjątek `feed_safety`) — wykonane dla `routes/import.ts`, ale **nie
  w pełni dla `routes/suppliers.ts`** (patrz BLOCKER).
- MO9 rozliczone ścieżką offline zamiast „nietestowalne”.
- `#78` odnalezione i potwierdzone w `mo9_agrorami_api.cjs`.
- Cztery `wejscie-120.md` (I15.4, I15.8, I15.9, I15.10) — treściwe, konkretne, „STAN nie zamiar”,
  bez ingerencji w roadmapę (`docs/rebuild-roadmap.md` nietknięta — zweryfikowane pustym diffem).
- `docs/spec-backend/wpis-120.md` — nowy plik, zgodnie z regułą „nowy wpis = nowy plik”.
- Żadnych danych handlowych w diffie (`git diff --stat` bez `.csv`/`.xlsx`/`.db`).

### Missing or deviating ✗
- Backlog (`docs/rebuild-backlog.md`) nie zaktualizowany mimo jawnego punktu DoD w `plan.md:279`
  (statusy #73/#75/#78/#79/#80/#82/#99/#103/#105, #11/14i jako zastąpione) — przesunięte do
  „Follow-up”/„Do koordynatora” bez wyjaśnienia, dlaczego to nie ta sesja miała to zrobić.
- `raport.md` w części dot. `archiwum-importow.gate.test.ts` jest niespójny z finalnym
  (nieskomitowanym w chwili review) stanem kodu — wymaga przeliczenia przed zamknięciem karty.

### Definition of done
- [x] `mirror/backend/` (12 plików) na stanie `88fa31c`
- [x] `src/import/legacy/` bajt w bajt zgodne z `mirror/backend/`
- [x] Wzorzec charakteryzacji przenagrany, opisany w `raport.md`
- [x] Test akceptacyjny: zero różnic w polach na pełnych cennikach
- [x] MO9 rozliczone ścieżką offline
- [x] Stan przejściowy D4 zweryfikowany, opisany
- [x] Nowe testy `feed_safety` zielone
- [x] Wzorzec silnika przenagrany
- [ ] `routes/import.ts` tłumaczy wyjątek `feed_safety` na `{blad}` (D-6) — **spełnione tylko
      częściowo**: `routes/import.ts` tak, ale równoległy endpoint `routes/suppliers.ts` (`POST
      /api/dostawcy/:kod/upload`) nadal daje 500 dla błędów parsera (patrz BLOCKER)
- [x] `mo9_agrorami_api.cjs` rozebrany hunk po hunku, los #78 odnotowany
- [x] lint ✓ typecheck ✓ build ✓ (zweryfikowane ponownie w tym review)
- [x] `npm test` ✓ wg `raport.md` (1649/101; nie uruchamiane w całości w tym review na prośbę Mastera,
      pojedyncze pliki dot. tego ticketu — `import.test.ts`, `silnik.gate.test.ts`, `feed-safety.test.ts`,
      `archiwum-importow.gate.test.ts` — uruchomione osobno: 76/76 zielone)
- [x] `karta.md` opisuje STAN, ma sekcję „Do koordynatora”
- [x] cztery `wejscie-120.md`
- [ ] Backlog: statusy #73/.../#105 i #11/14i — **nie zaktualizowane**
- [x] `docs/spec-backend/wpis-120.md`
- [x] Żaden plik cennika/danych dostawcy nie trafił do repo

## Parallel-test concerns

Brak — testy dodane/zmienione w tym tickecie (`feed-safety.test.ts`, `import.test.ts`,
`silnik.gate.test.ts`, `archiwum-importow.gate.test.ts`) korzystają ze wspólnego środowiska
testowego repo (baza tymczasowa, porty efemeryczne przez `stworzSrodowiskoTestowe()`), zgodnie
z konwencją reszty suite. Nie znaleziono twardych ścieżek/portów.

## Overall assessment

Warstwa portu jest wykonana solidnie i dobrze udowodniona: sha256 zgadza się wszędzie, test
akceptacyjny na 4843 realnych rekordach daje zero różnic, a dokumentacja kart jest konkretna
i mierzona, nie deklaratywna. Największy problem to niedokończona naprawa regresji, którą sam
ten resync wprowadza — `feed_safety.attach()` rzuca teraz nowy typ błędu, a tylko jedna z dwóch
tras uploadu (`routes/import.ts`) go rozpoznaje; `routes/suppliers.ts` (ścieżka główna dla MO6/MO8)
nadal oddaje 500 zamiast 400 dla identycznego scenariusza, co jest gorsze niż stan sprzed ticketu
dla tej konkretnej trasy. To jednoliniowa poprawka, ale bez niej deklaracja „obejmuje wszystkie
trzy wejścia” w raporcie i karcie nie jest prawdziwa. Do tego branch był aktywnie edytowany w
trakcie review (dobre, zawężające poprawki tłumaczenia wyjątków) — `raport.md` wymaga jednego
przebiegu synchronizacji z finalnym stanem kodu przed zamknięciem karty, a `docs/rebuild-backlog.md`
zostaje nieaktualizowany mimo własnego punktu DoD.

---

## Rozliczenie review przez Mastera (2026-09-23)

**BLOCKER — `suppliers.ts:245` (500 zamiast 400 przy `BladCennika`): POTWIERDZONY I NAPRAWIONY**
(commit `ed19753`). Znalezisko trafne. Przyczyna po mojej stronie: tłumaczenie wyjątku wstawiłem
w `parsuj.ts` — wspólne dla wszystkich trzech wołających — ale mapowanie na kod HTTP jest
per-trasa i zrobiłem je tylko w `routes/import.ts`. Dołożony test asercjujący DOKŁADNY kod;
zweryfikowane, że bez poprawki czerwieni się na `expected 500 to be 400`. Trafna jest też uwaga,
że istniejący gate tej trasy (`toBeGreaterThanOrEqual(400)`) nie mógł tego złapać.

**SHOULD-FIX „backlog nieruszony": NIEAKTUALNE.** `docs/rebuild-backlog.md` został zaktualizowany
w commicie `9ef7943` — 11 wpisów (#73/#75/#78/#79/#80/#82/#83/#99/#103/#105), #11 i odstępstwo 14i
oznaczone jako zastąpione przez #99/D4, plus wzajemne odsyłacze przy obu instancjach zduplikowanego
numeru #103. Recenzent czytał drzewo przed tym commitem.

**SHOULD-FIX „`raport.md` opisuje poprzedni stan": NIEAKTUALNE.** Poprawione w commicie `28bbd86`,
razem z zawężeniem tłumaczenia wyjątków. Raport ma teraz osobną sekcję „Korekta w trakcie
implementacji", która opisuje dokładnie to, co recenzent zauważył: pierwsza wersja D-6 tłumaczyła
KAŻDY wyjątek, przez co `ZEPSUTY_MO7` (twarda awaria `csv-parse`) dawał 400; asercja w gate archiwum
wróciła do 500.

**Uwaga recenzenta o żywej edycji worktree w trakcie review jest słuszna** i warto ją zapamiętać na
przyszłość: review i implementacja szły równolegle, więc dwa z trzech SHOULD-FIX opisują stan,
którego już nie było. BLOCKER na szczęście dotyczył pliku spoza tych zmian i pozostał aktualny —
co recenzent sam poprawnie odnotował.

**Bramki po poprawce:** lint ✓, typecheck ✓, `dostawcy.upload.test.ts` 15/15.

---

## Review — iteracja 2

> Reviewed: 2026-09-23
> Branch: `chore/120-i15-2-resync-parserow`
> Diff: 63 pliki, 14 commitów (`a46d463`…`362f2d9`)

Zakres tej rundy: weryfikacja poprawki BLOCKER-a (`ed19753`) i poszukiwanie regresji, których
pierwsza runda nie mogła zobaczyć (worktree był w edycji). Poniżej wynik.

### Weryfikacja BLOCKER-a — `suppliers.ts:250`

**Poprawiony poprawnie.** `BladCennika` jest importowane (`routes/suppliers.ts:10`, obok
`parsujBufor`) i użyte w warunku `e instanceof PustyImportBlad || e instanceof BladCennika ? 400 : 500`
(`suppliers.ts:250`). Zweryfikowałem empirycznie, nie tylko czytaniem:

- `npx vitest run test/dostawcy.upload.test.ts` → **15/15 zielone**.
- Cofnąłem lokalnie (bez commitowania) warunek do samego `PustyImportBlad` i uruchomiłem
  ponownie test „błąd odczytu wierszy (#103) daje DOKŁADNIE 400, nie 500” — czerwienił się
  dokładnie tak, jak deklaruje raport (`expected 500 to be 400`), po czym przywróciłem plik.
  Test **nie jest tautologiczny** — sprawdza dokładny kod (nie `>=400`) i realnie łapie regresję.
- Twarda awaria czytnika (śmieci jako XLSX, test „zwraca czytelny błąd i NIE zapisuje pozycji”,
  `dostawcy.upload.test.ts:185-196`) w tym repo nadal używa luźnej asercji `toBeGreaterThanOrEqual(400)`,
  ale scenariusz faktycznie trafia w SheetJS przed `feed_safety` (potwierdzone też przez
  `archiwum-importow.gate.test.ts:79-88`, gdzie analogiczny `ZEPSUTY_MO7` w CSV daje **500** —
  gate 22/22 zielony, fixture bez zmian). Zachowanie dla twardej awarii pozostaje 500, zgodnie z wymaganiem.

### Ścieżki gubiące nowe wyjątki — przegląd wszystkich trzech wołających + reszty `src/`

- **`routes/import.ts:141-146`** (`przetworzBufor`) — `catch` łapie `BladCennika` i `PustyImportBlad`
  osobno i mapuje oba na `{blad}` → 400 (linia 144), reszta leci dalej i kończy się w zewnętrznym
  `catch` trasy jako 500 (linie 297-301 dla `parse-file`, 368+ dla `from-url`). Poprawnie, obie trasy
  korzystają z tej samej funkcji.
- **`routes/suppliers.ts:159-251`** — jak wyżej, naprawione.
- **`import/synchronizuj.ts:198-246`** — `catch` na zewnątrz całego bloku (linia 230) jest generyczny,
  nie rozróżnia typu wyjątku: zapisuje alert „Błąd pobierania”, oznacza dostawcę błędem i zwraca
  `{ok:false, error}` — **nigdy nie rzuca**. `PustyImportBlad`/`BladCennika`/twardy wyjątek parsera
  trafiają w tę samą, bezpieczną gałąź. Potwierdzone też przez wołającego: `scheduler.ts:145` owija
  wywołanie dodatkowym `void synchronizuj(kod).catch(() => {})` — podwójny bezpiecznik. Sprawdziłem,
  kto woła scheduler dla wielu dostawców naraz — `synchronizujDostawce()` zwraca pojedynczą funkcję
  per-kod, wywoływaną raz na dostawcę; brak wspólnej pętli, która mogłaby przerwać się w środku.
  **Jeden zepsuty cennik nie zatrzymuje pozostałych — potwierdzone czytaniem, zgodne z opisem w
  raport.md i karta.md.**
- **`routes/staging-mutacje.ts`** (`POST /api/staging/import`) — NIE woła `parsujBufor`/`parsujPlik`
  w ogóle (pozycje idą wprost z ciała żądania), więc `BladCennika` nie może tam wystąpić. To nie jest
  luka — poza zakresem tego typu wyjątku.
- Grep całego `src/` po `PustyImportBlad|BladCennika` (poza testami) pokazuje tylko cztery pliki:
  `parsuj.ts` (definicja), `tk.ts` (definicja `PustyImportBlad`), `routes/import.ts`, `routes/suppliers.ts`,
  `routes/staging-mutacje.ts` (tylko `PustyImportBlad`, z innego źródła — `uruchomImport()`, nie z
  `parsujBufor`). **Nie znalazłem żadnej dodatkowej ścieżki, która gubi `BladCennika`.**

### `parsuj.ts` — zawężone tłumaczenie wyjątków

Przeczytałem `legacy/feed_safety.cjs` (29 linii) w całości. Trzy miejsca rzucania `Error`:
- `attach()` linia 11: `'Brak listy produktów w odpowiedzi dostawcy'` → pasuje do `BRAK_LISTY = /^Brak listy produktów/`.
- linia 13: `` `Błędy odczytu cennika (${errors}). Import zatrzymany bez przełączania na stary format.` `` → pasuje do `BLEDY_PARSERA = /^Błędy odczytu cennika/`.
- linia 14: `'Pusty cennik. Import zatrzymany.'` → pasuje do `PUSTY_CENNIK = /^Pusty cennik/`.

Wszystkie trzy komunikaty pokryte, kotwiczone na początku (`^`), bez ryzyka przypadkowego
dopasowania innego wyjątku (żaden inny komunikat błędu w warstwie parserów/silnika nie zaczyna się
tymi samymi frazami — sprawdziłem `grep -rn "^Error\|throw new Error" src/import/` pobieżnie, bez trafień
kolizyjnych). `test/feed-safety.test.ts` ładuje **prawdziwy** `legacy/feed_safety.cjs` (nie atrapę)
i asercjuje treści przez `toThrow(/regex/)` — realnie przypina komunikaty; kolejny resync, który
zmieni treść, faktycznie zaświeci na czerwono. Osobny test (`test/feed-safety.test.ts:102-121`)
weryfikuje wprost, że wszystkie trzy komunikaty pasują do tych samych trzech regexów co w `parsuj.ts`
— to redundantne z testem gate gdzie indziej, ale nie szkodzi.

### Dokumentacja vs stan kodu

Sprawdzone: `raport.md`, `docs/karty/I15.2/karta.md`, `docs/spec-backend/wpis-120.md`,
`docs/karty/I15.{4,8,9,10}/wejscie-120.md`. Wszystkie twierdzenia o kodach HTTP (400/400/500) są
dziś prawdziwe wobec finalnego kodu — w szczególności `karta.md:78-83` i `wpis-120.md:18-34` mówią
teraz „wszystkie trzy wejścia” w kontekście tłumaczenia wyjątku na typ, co jest prawdą na poziomie
typu ORAZ (po poprawce BLOCKER-a) na poziomie mapowania na kod HTTP w każdej trasie — nie znalazłem
już rozjazdu, który zgłosiła pierwsza runda. `raport.md` ma osobną sekcję „Poprawki po review”
(linie 175-188), która poprawnie referencjonuje commit `ed19753` i wyjaśnia, dlaczego dwa SHOULD-FIX
z pierwszej rundy były już nieaktualne.

### `docs/rebuild-backlog.md`

Statusy zgadzają się z dowiezionym zakresem: #73, #75, #78, #79, #80, #82, #83, #99/D4, oba wpisy
#103 (Selly/`runFullTodays` i `feed_safety`/staging) i #105 mają zaktualizowane pola „Do nowej
wersji?”/„Status” odzwierciedlające faktyczny stan po tickecie 120, nie zamiar. **Duplikat #103 jest
opisany przy OBU wpisach** (linie ok. 4570-4573 i 4595-4598) — każdy odsyła do drugiego z numerem
linii i rozróżnieniem tematu (Selly vs `feed_safety`), więc nie ma ryzyka pomylenia. Nie znalazłem
zdania, które ten ticket by obalił, a backlog by wciąż powtarzał.

### Ogólnie — ryzyko regresji develop po merge'u

- `docs/rebuild-roadmap.md` — diff pusty (`git diff --name-only origin/develop...HEAD` bez wyniku).
- Brak plików `.csv`/`.xlsx`/`.db`/`snapshot` w diffie.
- `npm run lint` i `npm run typecheck` — czyste w tym worktree (nie uruchamiałem pełnego `npm test`,
  zgodnie z poleceniem).
- `test/dostawcy.upload.test.ts` uruchomiony osobno: 15/15.

### BLOCKER

Brak.

### SHOULD-FIX

Brak nowych. (Dwa SHOULD-FIX z iteracji 1 były nieaktualne — potwierdzone w rozliczeniu Mastera i
w tej rundzie ponownie zweryfikowane jako zrobione.)

### NICE-TO-HAVE

- [ ] `rebuild/backend/test/dostawcy.upload.test.ts:189` — test „zwraca czytelny błąd i NIE zapisuje
  pozycji” (twarda awaria SheetJS) nadal ma luźną asercję `toBeGreaterThanOrEqual(400)`. Skoro obok
  (linia 211) jest już precedens testu na dokładny kod dla `BladCennika`, warto tym samym rygorem
  objąć i tę ścieżkę (`toBe(500)`) — nie blokuje, bo dziś zachowanie jest poprawne i pilnowane przez
  `archiwum-importow.gate.test.ts` z inną próbką, ale to jest dokładnie ten sam typ luki, którą
  złapał BLOCKER z iteracji 1.

### Wynik

**0 BLOCKER / 0 SHOULD-FIX (nowych) / 1 NICE-TO-HAVE.** Poprawka BLOCKER-a jest kompletna i
zweryfikowana empirycznie (nie tylko czytaniem) — nie znalazłem dodatkowych ścieżek gubiących
`BladCennika`, `synchronizuj.ts` degraduje się poprawnie per-dostawca, granica tłumaczenia wyjątków
w `parsuj.ts` pokrywa dokładnie trzy komunikaty `feed_safety.cjs` bez ryzyka fałszywego dopasowania,
a dokumentacja (raport, karta, wpis spec-backend, cztery wejścia, backlog) jest spójna z finalnym
kodem. Ticket gotowy do merge'u z perspektywy tej rundy review.

## Rozliczenie iteracji 2 przez Mastera (2026-09-23)

**NICE-TO-HAVE (luźna asercja `toBeGreaterThanOrEqual(400)`): PRZYJĘTE, ale z inną wartością niż
sugerowana.** Recenzent zaproponował `toBe(500)`, zakładając, że śmieci wysłane jako XLSX wywracają
czytnik SheetJS. **Pomiar pokazał `400`** (`expected 400 to be 500` przy próbie wstawienia 500):
SheetJS jest pobłażliwy i na takim wejściu NIE rzuca — zwraca zero rekordów bez błędów, więc
zatrzymuje to dopiero bezpiecznik pustego cennika. Asercja zaostrzona na zmierzone `400`,
z komentarzem tłumaczącym, gdzie naprawdę leży ścieżka 500 (`CsvError` z `csv-parse`,
`test/archiwum-importow.gate.test.ts`).

Morał ten sam co w całym tickecie: kod odpowiedzi trzeba zmierzyć, nie wyprowadzić z nazwy
scenariusza. Sama rekomendacja („nie zostawiaj luźnej asercji obok precedensu na dokładny kod")
była słuszna i dlatego ją zrealizowałem.

**Pozostałe ustalenia iteracji 2 przyjmuję bez zmian** — w szczególności weryfikację, że
`synchronizuj.ts` i `scheduler.ts:145` degradują się poprawnie i jeden zepsuty cennik nie zatrzymuje
pobierania pozostałych dostawców. To było realne ryzyko produkcyjne i dobrze, że zostało sprawdzone
niezależnie.

**Bramki końcowe:** lint ✓, typecheck ✓, build ✓, `npm test` **1 648/1 648 zielonych** (101 plików,
bezczynna maszyna).
