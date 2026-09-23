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
