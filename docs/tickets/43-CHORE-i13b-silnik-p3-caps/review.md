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

---

## Iteracja 2

> Reviewed: 2026-09-09
> Branch: chore/43-i13b-silnik-p3-caps
> Diff od iteracji 1: commity `912c0de` (sprostowanie liczby testów w kontroli mutacyjnej) i
> `7911747` (sync docs) — zmiany wyłącznie w `docs/**`, kod i testy niezmienione od iteracji 1.

### Weryfikacja BLOCKER z iteracji 1 (docs nieaktualne)

**Zamknięty.** Zweryfikowałem niezależnie:
- `docs/rebuild-roadmap.md` — tabela zbiorcza wiersz 13 ma teraz `13b: ✅ 43-CHORE-i13b-silnik-p3-caps
  · 2026-09-09`. Blok 13b (linia ~1953) ma ✅ + datę + ID ticketa, sprostowany fakt „P3 w
  `U.acceptStaging`, NIE w `tk()`" z konkretnymi offsetami — **policzyłem je sam** na
  `mirror/backend/index.cjs`: `function tk(` @1432657, `tk=function(` @1438815, `function Xq(`
  @1430238, `a.marka=a.marka??…` @1350905 — zgadzają się co do bitu z tekstem w roadmapie i backlogu.
- Nota o rozjeździe CHANGELOG↔kod jest teraz **wyłącznie w bloku 13c** (nie w 13b) — zgodne z
  obowiązkiem 2 z `CLAUDE.md`. Blok 13b odsyła do niej frazą „patrz nota niżej w bloku **13c**".
- `docs/rebuild-backlog.md` #56 — tytuł/`Kategoria`/`Iteracja`(→13b)/`Status`(✅ zrobione w 13b)
  poprawione i prawdziwe. #59 — `Iteracja` rozbita (silnik→13b zrobione / migracja→13c), `Status`
  zawiera dowód (57 pól `powod`, zero innych) — zweryfikowany wcześniej w iteracji 1, nie
  zmienił się.
- `docs/spec-backend.md` — nowy blockquote w §5 opisuje P3 i CAPS zgodnie ze stanem faktycznym,
  w tym poprawnie zaznacza „bez `ean`" dla auto-patchu.

### Nowa weryfikacja: litery kart #58/#60/#61 (poza pierwotnym zakresem BLOCKER-a)

Sprawdzone względem tabeli mapowania (`docs/rebuild-backlog.md` ~2540) i bloku I13 w roadmapie
(„13c BE+BAZA(migracje) · 13d BE(Selly, nowy) · 13e FE"):
- **#58** (konstr) — `Iteracja` teraz: parsery→13a (zrobione), migracja→13c, FE→13e. Zgodne z
  tabelą mapowania i z blokiem 13e w roadmapie („`konstr` FE strona konstrukcji — sparowane z 13c").
- **#60** (Selly) — `Iteracja` 13c→**13d**. Zgodne z blokiem 13d roadmapy (opisuje dokładnie ten
  podsystem: `discovery/sync_delta/sync_full/mapper_v2/rate_limiter/scheduler_selly/routes_sync`).
- **#61** (Bridge ONE) — `Iteracja` 13d→**13e**. Zgodne z blokiem 13e roadmapy.

Wszystkie trzy poprawki są zgodne z tabelą mapowania i z opisami bloków 13c/13d/13e — **żadna nowa
sprzeczność**.

### Nowa weryfikacja: sprostowanie o `ean`

`raport.md:178-181` twierdzi: żywy `tk` ma 6 wywołań `Xq` (1 w pętli `powod`, 5 w auto-patchu:
`cenaZakupu`, `cenaSprzedazy`, `marzaPct`, `stan`, `magazyn`, **bez `ean`**), bo `AP.ean` istnieje
wyłącznie w martwej definicji `tk`. Policzyłem to niezależnie na `mirror/backend/index.cjs`:

```
Xq( w żywym tk (offset 1438815, zakres +8000 znaków): 6 wystąpień
  1× w pętli powod (v.push(...))
  5× w auto-patchu: AP.cenaZakupu, AP.cenaSprzedazy, AP.marzaPct, AP.stan, AP.magazyn
AP.ean w martwej function tk( (offset 1432657): true (obecny TYLKO tam)
```

**Sprostowanie jest prawdziwe** — potwierdzone bit-po-bicie. `docs/spec-backend.md` ma tę samą,
poprawną wersję („bez `ean`, zgodnie z ustaleniem 3c wyżej").

Jednak **korekta nie została naniesiona wszędzie**: `docs/rebuild-roadmap.md:1986` (blok 13c) i
`docs/rebuild-backlog.md:2617` (#59, pole `Status`) wciąż zawierają starą, błędną listę:
„`Xq` wpływa realnie tylko na narrację `powod` … i na auto-patch `ean`/`cenaZakupu`/
`cenaSprzedazy`/`marzaPct`/`stan`/`magazyn`" — z `ean` w auto-patchu, co jest tą samą
nieprawdą, którą `raport.md:178` sam nazywa błędną i deklaruje naprawioną („oba pliki
poprawione" — ale „oba" to tylko `plan.md`+`raport.md`, nie roadmapa/backlog). Zobacz BLOCKER
niżej.

### Bramki

Uruchomione niezależnie z `BRIDGE_SNAPSHOT_DB` na Node 20.20.2: `lint` ✓, `typecheck` ✓, `build` ✓,
`test` ✓ — 80 plików / 1234 testy, wszystkie zielone. Zgodne z deklaracją w `raport.md`. Brak
`it.skip`/`describe.skip`/`.only` w `rebuild/backend/{src,test}`.

### Zakres diffu

Commity `912c0de` i `7911747` dotykają wyłącznie `docs/**` i artefaktów ticketa
(`plan.md`/`raport.md`/`review.md`) — kod (`mirror/`, `rebuild/backend/src`, `rebuild/backend/test`)
niezmieniony od iteracji 1. Brak scope creep.

## BLOCKER (iteracja 2)

- [ ] `docs/rebuild-roadmap.md:1986` (blok 13c), `docs/rebuild-backlog.md:2617` (#59, pole
  `Status`) — obie linie wciąż twierdzą, że `Xq` wpływa na auto-patch pola `ean`, co jest
  nieprawdą sprostowaną w tym samym PR w `plan.md`/`raport.md`/`docs/spec-backend.md`.
  - Reason: `raport.md:178-181` wprost mówi „żywy `tk` ma 6 wywołań `Xq`… oba pliki poprawione"
    (odnosząc się tylko do `plan.md`+`raport.md`), ale identyczna błędna fraza „auto-patch
    `ean`/`cenaZakupu`/…" została skopiowana do bloku 13c roadmapy i do #59 w backlogu i NIE
    naniesiono tam tej samej korekty — mimo że `docs/spec-backend.md`, dodany w tym samym
    commicie `7911747`, ma poprawną wersję („bez `ean`, zgodnie z ustaleniem 3c wyżej"). To
    dokładnie ta klasa błędu, przed którą ostrzega `CLAUDE.md` (fakt musi być PRAWDĄ w bloku,
    który czyta następna sesja) — a blok 13c jest właśnie tym blokiem, który czyta sesja 13c.
    Zweryfikowałem niezależnie na `mirror/backend/index.cjs`: `AP.ean` istnieje wyłącznie w
    martwej `function tk(`, żywy `tk=function(` ma 6 wywołań `Xq` bez żadnego dotyczącego `ean`.
  - Suggestion: usunąć `ean/` z listy auto-patchu w obu miejscach (`docs/rebuild-roadmap.md:1986`,
    `docs/rebuild-backlog.md:2617`), analogicznie do już poprawnego tekstu w
    `docs/spec-backend.md`.

## SHOULD-FIX (iteracja 2)

Brak nowych — poprzedni SHOULD-FIX (liczba testów w kontroli mutacyjnej, 6→11) zamknięty
poprawnie, zweryfikowany zgodny z raportem (`silnik.rownosc.test.ts` 3, `akceptacja.charakteryzacja
.test.ts` 3, `silnik.charakteryzacja.test.ts` MO1–MO5 5 = 11).

## NICE-TO-HAVE (iteracja 2)

Poprzedni NICE-TO-HAVE (`plan.md` status `Draft`→`Implemented`) zamknięty — zweryfikowany
(`plan.md:3` ma teraz `Status: Implemented`).

## Overall assessment (iteracja 2)

Praca doc-checkerów jest w większości solidna i dokładna — offsety, liczby wywołań `Xq`, litery
kart (#58/#60/#61) i przeniesienie noty CHANGELOG↔kod do bloku 13c wszystkie zweryfikowałem
niezależnie i się zgadzają. Jest jednak jeden realny, łatwo weryfikowalny błąd: sprostowanie
o `ean` (prawdziwe i potwierdzone w `plan.md`/`raport.md`/`spec-backend.md`) nie zostało
naniesione w `docs/rebuild-roadmap.md` (blok 13c) i `docs/rebuild-backlog.md` (#59) — te dwa
miejsca wciąż niosą tę samą nieprawdę, którą raport deklaruje jako naprawioną. To dokładnie ten
rodzaj rozjazdu, przed którym ostrzega `CLAUDE.md`, i akurat w bloku, który przeczyta sesja 13c —
do zamknięcia przed merge.
