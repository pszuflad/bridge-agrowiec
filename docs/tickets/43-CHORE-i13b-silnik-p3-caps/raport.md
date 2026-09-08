# 43-CHORE-i13b-silnik-p3-caps — raport z implementacji

## Podsumowanie

Karta 13b iteracji I13 dowieziona. Wycinek oracle `mirror/backend/index.cjs` dociągnięty do stanu
produkcji 08.09 (2 zmienione linie), obie zmiany naniesione ręcznie w reimplementacji TS silnika:
fallback marki → `"UNKNOWN"` (P3, #56) i case-insensitive helper równości (CAPS/`Xq`, #59 część
silnikowa). Kotwica integralności przenagrana skryptem. Wszystkie bramki zielone —
**80 plików testowych, 1234 testy**, żadna bramka nie wymagała migracji z 13c.

## Zmiany

- `mirror/backend/index.cjs` — dociągnięty z `origin/main` (TYLKO ten plik; bez merge `main`).
  Diff: 2 linie — `a.marka=…??"UNKNOWN"` oraz nowe ciało `Xq`.
- `rebuild/backend/src/import/akceptacja.ts` — P3: `rekord.marka = … ?? "UNKNOWN"` zamiast
  `pozycja.nazwa.split(" ")[0] || "—"`.
- `rebuild/backend/src/import/silnik/pozycja.ts` — `wartosciRowne()` (port `Xq`) porównuje
  dodatkowo `a.toUpperCase() === b.toUpperCase()`. Obsługa wartości pustych nietknięta.
- `rebuild/backend/src/import/tk.ts` — **bez zmiany zachowania**; dopisany komentarz przy
  `zmianaKluczowa` wyjaśniający, dlaczego zostaje case-sensitive (D1).
- `rebuild/backend/test/charakteryzacja/silnik/integralnosc.json` — przenagrana kotwica.
- `rebuild/backend/test/charakteryzacja/silnik/MO{1,2,3,4,5}.expected.json` — przenagrany wzorzec.
- `rebuild/backend/test/charakteryzacja/akceptacja/scenariusze.mjs` — 2 nowe scenariusze,
  poprawiony nieaktualny opis jednego istniejącego.
- `rebuild/backend/test/akceptacja.charakteryzacja.test.ts` — nowe nazwy w kontroli pokrycia
  + kontrola negatywna przypinająca wartość `"UNKNOWN"` mierzoną na oryginale.
- **Nowy:** `rebuild/backend/test/silnik.rownosc.test.ts` — testy `wartosciRowne` + zasięg CAPS.

## Ustalenia faktograficzne (do sprostowania w docs)

### 1. P3 siedzi w `acceptStaging`, nie w `tk()`

Roadmapa (blok I13/13b), backlog #56 i prompt startowy z ticketa 40 mówią „fallback marki w `tk()`".
Zmierzone na `mirror/backend/index.cjs@main`: jedyne wystąpienie fallbacku jest pod offsetem
1 350 905, czyli **przed** obiema definicjami `tk` (1 432 657 i 1 438 815) — w ciele
`U.acceptStaging(t,e)`. Zakres karty się nie zmienia (13b = „`tk()`/`acceptStaging`"), ale fakt
jest błędny i został poprawiony.

### 2. Cieniowanie — zweryfikowane liczeniem, nie numerami linii z deminifikatu

| symbol | wystąpienia w `index.cjs@main` | wniosek |
|---|---|---|
| `function tk(` | 1× (offset 1 432 657) | MARTWA deklaracja; `_KP` ma 5 pól |
| `tk=function(` | 1× (offset 1 438 815) | **ŻYWA** (łatka doklejona po bundlu); `_KP` ma 7 pól |
| `function Xq(` | 1× (offset 1 430 238) | jedyna definicja — **brak cieniowania**, wspólna dla obu `tk` |

Harness charakteryzacji (`test/charakteryzacja/silnik/oryginal.mjs`) już tnie po kotwicy `zywyTk`
i pomija `martwyTk` — nic tu nie trzeba było naprawiać. P3 leży poza tym rozróżnieniem w ogóle.

### 3. ⚠ Rozjazd CHANGELOG ↔ kod produkcji — `Xq` NIE wycisza `zmiana_kluczowa`

CHANGELOG Ani (2026-09-01 12:30) i backlog #59 twierdzą, że po zmianie `Xq` plik „Kleber GRIPKER"
vs baza „KLEBER GRIPKER" NIE generuje `staging_items` typu `zmiana_kluczowa`. **Kod produkcji tego
nie robi.** W żywym `tk` klasyfikacja liczy się bez `Xq`:

```js
_KP=["rozmiar","indeksNosnosci","indeksPredkosci","model","marka","nazwa","kodDostawcy"],
_ck=_KP.some(pk=>{ …; return String(vS??"")!==String(vN??"") })   // case-SENSITIVE
```

Fragment nie został tknięty diffem 08.09. `Xq` wpływa realnie tylko na narrację `powod`
(`POLA_ROZNIC`) i na auto-patch pięciu pól: `cenaZakupu`/`cenaSprzedazy`/`marzaPct`/`stan`/`magazyn`.

**Dowód empiryczny z przenagrania wzorca:** zmieniło się **57 pól `powod` i ZERO innych pól**;
wiersze, których `powod` stracił człon `nazwa: Michelin → MICHELIN`, **zostały**
`typZmiany: "zmiana_kluczowa"`. Szum case-only usunęła w produkcji migracja danych
(`UPPER(nazwa)` + `DELETE` 769 wierszy CASE_ONLY), nie kod silnika — u nas idzie to kartą **13c**.

Zgodnie z regułą projektu (oryginał > spec) odtworzyliśmy KOD, nie narrację — decyzja D1.

## Odstępstwa od planu

Brak. Plan zrealizowany 1:1, łącznie z przewidzianym w nim skutkiem (fragment `helpery` zmienia sha,
fragment `silnik` nie).

Jedno rozszerzenie ponad literę planu, w duchu D2: poza scenariuszem „marka nieobecna → UNKNOWN"
dołożony scenariusz „marka jako pusty łańcuch → fallback NIE wchodzi". `??` przepuszcza tylko
`null`/`undefined`, więc `marka: ""` zostaje pusta — to zachowanie oryginału, mierzone na żywo,
warte zapisania, bo „puste pole Producent" z CHANGELOG-u może oznaczać jedno albo drugie.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne. Ticket nie zmienia kształtu API. Sprawdzone
  ścieżki: `POST /api/staging/import`, `POST /api/staging/accept`, `GET /api/staging`,
  `GET /api/staging/paged`, `GET /api/products`. Fixtures `contract/fixtures/GET_staging.json`
  i `GET_staging_paged.json` — **bez zmian i nadal zielone**: wszystkie `snapshotJson` mają
  `"marka":"BKT"`, więc P3 nie dotyka żadnej nagranej wartości. Przenagrywanie fixtures nie było
  potrzebne (i nie zostało zrobione).
- **Kotwica integralności:** przenagrana skryptem `scripts/charakteryzacja-silnik-nagraj.mjs`.
  `helpery` 584611d4… → 62d7202a… (11532 → 11598 B, +66 = dokładnie nowe ciało `Xq`).
  `silnik` 335b9b97… **bez zmian** (8174 B) — żywy `tk` nietknięty, zgodnie z przewidywaniem.
- **`silnik.charakteryzacja.test.ts`:** ✓ zielony.
- **`akceptacja.charakteryzacja.test.ts`:** ✓ zielony, 35 testów (+2 scenariusze, +1 kontrola
  negatywna). Scenariusz `brak-marki-daje-unknown` przypina wartość mierzoną na ORYGINALE.
- **Testy jednostkowe:** ✓ nowy `silnik.rownosc.test.ts` — 8 testów, bez mocków.
- **Pełny przebieg:** ✓ **80 plików, 1234 testy, wszystkie zielone.**
- **Kontrola mutacyjna:** po tymczasowym cofnięciu obu zmian w `src/` pada **11 testów w 3 plikach**
  (zmierzone na PEŁNYM przebiegu) — potwierdzenie, że nowe pokrycie faktycznie gryzie, a nie tylko
  przechodzi. Rozkład:
  - `silnik.rownosc.test.ts` — 3 (nowy plik),
  - `akceptacja.charakteryzacja.test.ts` — 3, w tym dwa ISTNIEJĄCE scenariusze
    (`pozycja-bez-snapshotu`, `uszkodzony-snapshot-nie-wywraca-akceptacji`), które też przechodzą
    przez gałąź fallbacku,
  - `silnik.charakteryzacja.test.ts` — 5 (MO1–MO5, rozjazd `powod` względem przenagranego wzorca).

  Czyli obie zmiany mają pokrycie szersze, niż zakładał plan.
- **Bramki:** `lint` ✓, `typecheck` ✓, `build` ✓.

**Żadna bramka nie wymagała migracji nazwy z 13c** — nic nie zostało wyłączone ani zeskipowane.

## Breaking changes

Brak w sensie kontraktu API. Zmiana zachowania (świadoma, odtwarzająca produkcję):

- Produkt zatwierdzany z pozycji bez marki dostaje `marka = "UNKNOWN"` zamiast pierwszego słowa
  nazwy. Dotyczy tylko NOWYCH akceptacji — istniejących rekordów w bazie nie rusza.
- Różnica wyłącznie w wielkości liter w polach cenowo-magazynowych nie jest już traktowana
  jako zmiana (mniej auto-zatwierdzeń „pustych"), a w narracji `powod` nie pojawiają się człony
  różniące się tylko wielkością liter.

## Follow-up

- **13c (już zaplanowane):** migracja `products.nazwa` → UPPER, `manual_overrides.nazwa`,
  `DELETE` staging CASE_ONLY. Dopiero to usuwa szum `zmiana_kluczowa` case-only — patrz ustalenie 3.
- **13c — do rozstrzygnięcia przy migracji:** czy po `UPPER(nazwa)` warto przenagrać wzorzec
  charakteryzacji silnika ponownie; 57 pól `powod` w MO1–MO5 może się wtedy przesunąć drugi raz
  (tym razem przez zmianę danych wejściowych, nie kodu).
- **Poza zakresem I13:** `marka: ""` (pusty łańcuch) omija fallback i zostaje pusta. Jeśli któryś
  parser oddaje `""` zamiast `null` dla pustego pola Producent, P3 go nie złapie. Zachowanie
  oryginału odtworzone wiernie — ale warte sprawdzenia przy okazji przeglądu parserów.

## Poprawki po review

- **SHOULD-FIX (poprawione):** liczba padających testów w kontroli mutacyjnej była zaniżona —
  raportowała 6, bo mierzyłem tylko na dwóch plikach testowych. Przemierzone na pełnym przebiegu:
  **11 testów w 3 plikach**. Sekcja „Wyniki testów" poprawiona wraz z rozkładem.
- **NICE-TO-HAVE (poprawione):** `plan.md` przestawiony ze statusu `Draft` na `Implemented`.
- **BLOCKER (adresowany):** synchronizacja `docs/rebuild-roadmap.md` i `docs/rebuild-backlog.md`
  była zaplanowana jako Krok 6 i wykonana po review — patrz sekcja „Docs updates" niżej.

## Docs updates

Trzej doc-checkerzy równolegle, każdy na rozłącznym zbiorze plików.

### `docs/rebuild-roadmap.md`
- Tabela zbiorcza (wiersz iteracji 13): dopisane `13b: ✅ 43-CHORE-i13b-silnik-p3-caps · 2026-09-09`
  + nota „zostają 13c/13d/13e".
- Blok 13b: oznaczony ✅ z datą i ID ticketa; **sprostowany fakt** — fallback marki (P3) leży
  w `U.acceptStaging`, NIE w `tk()` (błędne twierdzenie usunięte, nie dopisane obok); dopisany
  zweryfikowany wynik badania cieniowania; dopisane wyniki bramek.
- **Blok 13c** (obowiązek 2 z `CLAUDE.md` — ustalenie o przyszłym bloku trafia DO TEGO BLOKU):
  nota o rozjeździe CHANGELOG↔kod (`Xq` nie wycisza `zmiana_kluczowa`; robi to dopiero migracja
  `UPPER(nazwa)` + `DELETE` CASE_ONLY) oraz ostrzeżenie, że po tej migracji wzorzec
  `MO1–MO5.expected.json` może przesunąć się DRUGI raz — tym razem przez zmianę danych, nie kodu.

### `docs/rebuild-backlog.md`
- **#56** — sprostowany tytuł i opis (`U.acceptStaging`, nie `tk()`); `Iteracja` 13a → **13b**;
  `Status` → ✅ zrobione w 13b (2026-09-09). Sprostowane ostrzeżenie o cieniowaniu.
- **#59** — `Pliki`: `Xq` ma JEDNĄ definicję, brak cieniowania (cieniowanie dotyczy `tk`).
  `Iteracja` ROZBITA: część silnikowa → **13b (zrobione)**, migracja `UPPER(nazwa)` → **13c**.
  Dopisane ustalenie o rozjeździe CHANGELOG↔kod wraz z dowodem (57 pól `powod`, zero innych).
- **#58** — `Iteracja` rozbita zgodnie z tabelą mapowania: parsery → 13a, migracja → 13c,
  FE → **13e** (było błędnie „13d").
- **#60** — `Iteracja` 13c → **13d** (Selly); poprawiony też podpodział `13c-1/2/3` → `13d-1/2/3`.
- **#61** — `Iteracja` 13d → **13e** (FE).
- **#57** — sprawdzone, już poprawne po 13a; bez zmian.

### `docs/spec-backend.md`
- §5 „Silnik importu `tk()`": nowy blockquote „Odbudowa (13b…)" opisujący P3 (z niuansem
  `??` vs pusty łańcuch) i CAPS, wraz z rozjazdem CHANGELOG↔kod. Wzorzec zgodny z blokami
  3a/3b/3c/3f-1/3f-2, które ten plik już zawiera.

### `docs/audit-delta.md`
- Bez zmian. Linia 119 to zrzut stanu bazy z 2026-08-17, sprzed obu zmian produkcji — dane
  historyczne, nie twierdzenie o bieżącym zachowaniu.

### Sprostowanie w moich artefaktach (znalezione przez doc-checkera)
`plan.md` i `raport.md` wymieniały `ean` wśród pól auto-patchowanych przez `Xq`. To nieprawda:
`AP.ean` istnieje wyłącznie w MARTWEJ definicji `tk`. Żywy `tk` ma 6 wywołań `Xq` — jedno
w pętli `powod` i pięć w auto-patchu (`cenaZakupu`, `cenaSprzedazy`, `marzaPct`, `stan`,
`magazyn`). Zweryfikowane bezpośrednio na `mirror/backend/index.cjs`. Komentarze w kodzie były od początku
poprawne (mówią „pola cenowo-magazynowe").

Druga iteracja review wykryła, że korekta była NIEKOMPLETNA: doc-checkerzy zapisali moją pierwotną,
błędną frazę także w `docs/rebuild-roadmap.md` (blok 13c) i `docs/rebuild-backlog.md` (#59) — czyli
dokładnie tam, gdzie przeczyta ją sesja 13c. Poprawione w commicie „review fix (iteracja 2)".
Ostatecznie sprostowane w czterech plikach: `plan.md`, `raport.md`, `docs/spec-backend.md`,
`docs/rebuild-roadmap.md`, `docs/rebuild-backlog.md`.

## Pre-existing issues (do decyzji użytkownika, POZA zakresem tego ticketa)

- `docs/rebuild-backlog.md` #56, pole `Status` — odnośnik „powiązane z #26 (JMK marka=rozmiar,
  backfill w 13e)" wskazuje na wpis **#26**, który dotyczy widoku `/alerty` (frontend), nie JMK.
  Wygląda na nieaktualne odwołanie sprzed renumeracji wpisów. Dodatkowo „backfill w 13e" jest
  podejrzane — decyzja o backfillach zapadła w **13f** (`41-CHORE-i13f-decyzja-backfille`:
  backfilli NIE odtwarzamy). Zostawione bez zmian, bo poprawny cel odnośnika jest niepewny.
