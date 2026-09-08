# 43-CHORE-i13b-silnik-p3-caps — Code review

> Reviewed: 2026-09-09
> Branch: chore/43-i13b-silnik-p3-caps
> Diff: 14 plików, 3 commity (`78d9bf6`, `b678945`, `1a36f0f`), origin/develop...HEAD

## BLOCKER

- [ ] `docs/rebuild-roadmap.md` (blok 13b), `docs/rebuild-backlog.md` (#56, #59) — dokumentacja nie
  została zaktualizowana wcale; diff ticketa dotyka wyłącznie kodu i testów.
  - Reason: Plan.md Krok 6 („Docs wg D3") i Definition of done wprost wymagają: (a) blok 13b w
    roadmapie oznaczony jako zrobiony (data + ID ticketa), fakt `tk()`→`acceptStaging` sprostowany,
    rozjazd CHANGELOG↔kod dopisany DO BLOKU 13c; (b) backlog #56 i część silnikowa #59 oznaczone
    „zrobione w 13b", pole „Iteracja" zgodne z tabelą mapowania. Nic z tego nie jest spełnione:
    zweryfikowałem stan bieżący `docs/rebuild-backlog.md:2579` — #56 wciąż ma tytuł „fallback marki
    `tk()`" (fakt, który plan.md sam nazywa błędnym), `Iteracja: → 13a` (sprzeczne z tabelą mapowania
    w `docs/rebuild-backlog.md:2543`, która mówi „13b") i `Status: ⬜ do portu` — mimo że P3 jest
    zaimplementowane i zielone. #59 (`docs/rebuild-backlog.md:2609`) ma `Status: ⬜ do portu` bez
    rozróżnienia części silnikowej (zrobiona) od migracji (13c). `docs/rebuild-roadmap.md:1953` (blok
    13b) nie ma znacznika ✅ ani daty/ID ticketa — w przeciwieństwie do sąsiednich bloków 13a i 13f
    w tej samej sekcji, które MAJĄ taki wpis. To nie jest niedopatrzenie stylistyczne: CLAUDE.md
    poświęca temu osobną, wielopunktową sekcję jako regułę stałą projektu, a dwa poprzednie tickety
    tej samej iteracji (`42-CHORE-i13a`, `41-CHORE-i13f`) faktycznie zrobiły sync docs w tym samym
    PR/commicie („sync docs" w 13a, wpis roadmapa+backlog w 13f) — to ustalony wzorzec dla tej
    iteracji, którego ten ticket nie utrzymał.
  - Suggestion: dopisać commit/zmianę do `docs/rebuild-roadmap.md` (blok 13b: ✅ + data + ID
    `43-CHORE-i13b-silnik-p3-caps`, sprostowanie faktu P3 w `acceptStaging`, przeniesienie noty o
    rozjeździe CHANGELOG↔kod do opisu bloku 13c) i `docs/rebuild-backlog.md` (#56: tytuł/Iteracja/
    Status; #59: rozbić status na część silnikową zrobioną vs migrację 13c).

## SHOULD-FIX

- [ ] `docs/tickets/43-CHORE-i13b-silnik-p3-caps/raport.md:97` — kontrola mutacyjna zaniża realny
  wynik: raport deklaruje „pada 6 testów" po cofnięciu obu zmian w `src/`, zmierzyłem niezależnie
  (cofnięcie identyczne co opisane, uruchomienie `npm test`) **11 nieudanych testów w 3 plikach**:
  3 w `test/silnik.rownosc.test.ts`, 3 w `test/akceptacja.charakteryzacja.test.ts` (zgodne z
  raportem), ale też **5 w `test/silnik.charakteryzacja.test.ts` (MO1–MO5)**, które raport pomija
  całkowicie mimo że to oczywista konsekwencja przenagrania wzorca o 57 pól `powod`.
  - Reason: nie wpływa na jakość kodu — pokrycie jest w rzeczywistości SZERSZE niż deklarowane
    (dobra wiadomość), ale konkretna liczba w raporcie jest nieprawdziwa, a projekt stawia wprost
    „fakt, nie narrację" (patrz D1 w tym samym tickecie) jako zasadę. Rozbieżność 6 vs 11 obniża
    wiarygodność sekcji „Wyniki testów" jako dowodu.
  - Suggestion: poprawić liczbę w raporcie na 11 i dopisać MO1–MO5 do listy testów, które gryzą.

## NICE-TO-HAVE

- [ ] `docs/tickets/43-CHORE-i13b-silnik-p3-caps/plan.md:3` — pole `Status: Draft` zostało nie
  zaktualizowane mimo że implementacja i raport są kompletne; kosmetyka, ale utrudnia szybkie
  rozeznanie stanu ticketa przy przeglądaniu katalogu `docs/tickets/`.

## Plan compliance

### Done ✓
- Krok 1 — `mirror/backend/index.cjs` dociągnięty WYŁĄCZNIE z `origin/main`, dokładnie 2 zmienione
  linie fizyczne (`a.marka=…??"UNKNOWN"`, nowe ciało `Xq`) — zweryfikowane bajt-po-bajcie.
- Krok 2 — P3 w `akceptacja.ts:132`: `rekord.marka ?? snapshot.marka ?? "UNKNOWN"`, komentarz
  odniesienia do CHANGELOG dodany.
- Krok 3 — CAPS w `pozycja.ts:187-193`: `wartosciRowne()` odtwarza nowe ciało `Xq` **dokładnie**
  (ta sama kolejność warunków, ta sama obsługa pustych) — porównałem znak po znaku z żywym `Xq`
  wyciętym z `mirror/backend/index.cjs`. `POLA_KLUCZOWE`/`zmianaKluczowa` w `tk.ts` nietknięte;
  zweryfikowałem niezależnie w mirrorze, że zarówno martwy, jak i żywy `_ck` liczą się bez wywołania
  `Xq` (`String(vS??"")!==String(vN??"")`) — teza D1 i treść komentarza w `tk.ts:432-437` są prawdziwe.
- Krok 4 — kotwica `integralnosc.json` przenagrana; przeliczyłem hashe niezależnie skryptem opartym
  o te same kotwice tekstowe co `oryginal.mjs` — `helpery` i `silnik` zgadzają się co do bitu z tym,
  co jest w pliku. Fragment `silnik` (żywy `tk`) faktycznie się NIE zmienił (identyczny hash
  `335b9b97…` przed i po), zgodnie z przewidywaniem planu.
- Krok 4/raport — twierdzenie „57 pól `powod` i ZERO innych pól, `typZmiany` zostaje
  `zmiana_kluczowa`" zweryfikowane niezależnie skryptem porównującym `MO1–MO5.expected.json` z
  `origin/develop` do `HEAD`: dokładnie 57 par `powod` różnych, 0 innych pól, wszystkie 57 wierszy
  mają `typZmiany: "zmiana_kluczowa"`.
- Krok 5 — nowe scenariusze `brak-marki-daje-unknown` i `marka-pusty-lancuch-nie-uruchamia-fallbacku`
  w `scenariusze.mjs`, kontrola pokrycia i kontrola negatywna w `akceptacja.charakteryzacja.test.ts`,
  testy jednostkowe `wartosciRowne` + asercja D1 w nowym `silnik.rownosc.test.ts` — treściwe,
  nietautologiczne, bez mocków, z konkretnymi wartościami.
- Krok 6 (bramki) — `lint`, `typecheck`, `build`, `test` (80 plików / 1234 testy) uruchomione przeze
  mnie niezależnie z `BRIDGE_SNAPSHOT_DB` — wszystkie zielone.
- Brak `it.skip`/`describe.skip`/`.only`/zakomentowanych asercji w diffie.
- Zakres: diff `mirror/` ogranicza się do `index.cjs` (2 linie); żadna migracja `products.nazwa`→
  UPPER ani inny kod z 13c nie wszedł do diffu (tylko wzmianki w komentarzach/docs, zgodnie z
  planem).

### Missing lub deviating ✗
- Krok 6 (docs wg D3) — NIE zrobione. Roadmapa i backlog nie zostały tknięte (zob. BLOCKER wyżej).

## Definition of done

- [x] `mirror/backend/index.cjs` dociągnięty z `origin/main` (i TYLKO on)
- [x] P3: `akceptacja.ts` daje `"UNKNOWN"` zamiast `nazwa.split(" ")[0]`
- [x] CAPS: `wartosciRowne()` porównuje case-insensitive; `POLA_KLUCZOWE` nietknięte (D1)
- [x] Kotwica `integralnosc.json` przenagrana skryptem, nie ręcznie
- [x] `silnik.charakteryzacja` zielony
- [x] `akceptacja.charakteryzacja` zielony, w tym nowy scenariusz `marka` → `"UNKNOWN"`
- [x] Testy jednostkowe `wartosciRowne` + asercja D1
- [x] `lint` + `typecheck` + `build` + `test` zielone
- [ ] Roadmapa: blok 13b oznaczony jako zrobiony — NIE zrobione, brak wpisu ✅/data/ID w
      `docs/rebuild-roadmap.md:1953`, fakt `tk()`→`acceptStaging` nie sprostowany tam
- [ ] Backlog: #56 i część silnikowa #59 → „zrobione w 13b" — NIE zrobione, wpisy nadal mają stare
      `Status: ⬜ do portu` i niespójną `Iteracja`

## Parallel-test concerns

Brak — `silnik.rownosc.test.ts` i pozostałe zmienione testy używają `stworzTestowaBaze()` z
`mkdtempSync`/portem efemerycznym (izolowany katalog tymczasowy per test), bez współdzielonych
zasobów. Wszystkie testy równoległe do uruchomienia przez wielu agentów naraz.

## Overall assessment

Warstwa kodu i testów jest solidna i wierna oryginałowi — wszystkie twierdzenia planu i raportu
dotyczące zmian w `mirror/backend/index.cjs`, portu TS (`akceptacja.ts`, `pozycja.ts`, `tk.ts`),
kotwicy sha i przenagranego wzorca (57 pól `powod`, D1 case-sensitive `_ck`) zweryfikowałem
niezależnie i się zgadzają co do bitu. Jedyny realny problem to całkowity brak aktualizacji
`docs/rebuild-roadmap.md`/`docs/rebuild-backlog.md`, mimo że plan.md wprost to zakłada (D3, Krok 6,
Definition of done) i mimo że dwa poprzednie tickety tej samej iteracji zrobiły to w tym samym PR —
to blokuje merge do czasu uzupełnienia, bo bez tego następna sesja (13c) odziedziczy nieaktualne
fakty w backlogu. Drugorzędnie: liczba testów w kontroli mutacyjnej raportu jest zaniżona (6 vs
realnie 11) — kosmetyczna nieścisłość, warto poprawić przy okazji.
