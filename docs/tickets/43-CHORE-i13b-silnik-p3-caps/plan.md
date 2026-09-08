# 43-CHORE-i13b-silnik-p3-caps — I13/13b: silnik `tk()`/`acceptStaging` — P3 + CAPS/Xq

> Status: Implemented
> Branch: `chore/43-i13b-silnik-p3-caps`
> Worktree: `.worktrees/43-CHORE-i13b-silnik-p3-caps`

## Opis ticketa

Druga karta I13, po 13a (parsery). Odtworzyć w reimplementacji TS silnika DWIE zmiany produkcji
z `mirror/backend/index.cjs` (25.08 → 08.09):

1. **P3** (backlog #56, CHANGELOG 2026-08-31 14:58) — fallback marki: usunięto degenerowany
   `nazwa.split(" ")[0]`; przy pustym `Producent` marka = `"UNKNOWN"`.
2. **CAPS/Xq** (backlog #59, CZĘŚĆ SILNIKOWA, CHANGELOG 2026-09-01 12:30) — helper równości
   `Xq(t,e)` porównuje dodatkowo `A.toUpperCase()===B.toUpperCase()`.

Silnik NIE jest kopiowany bajtowo (w odróżnieniu od parserów w `src/import/legacy/`) — jest
portowany ręcznie jako TS, a bramki charakteryzacji porównują port z żywym oryginałem.
Migracja `products.nazwa`→UPPER to karta **13c** — poza zakresem.

## Kontekst

**Warunek startu spełniony:** 13a (`42-CHORE-i13a-resync-parserow`) jest w `develop` (PR #54,
merge `797aa05`).

**Oracle — dokładny diff `origin/develop..origin/main -- mirror/backend/index.cjs`** to jeden hunk,
2 zmienione linie fizyczne (plik zminifikowany, 632 linie):

```
- a.marka=a.marka??r.marka??(n.nazwa.split(" ")[0]||"—")
+ a.marka=a.marka??r.marka??"UNKNOWN"

- function Xq(t,e){return t==null||t===""?e==null||e==="":e==null||e===""?!1:String(t)===String(e)}
+ function Xq(t,e){if(t==null||t==="")return e==null||e==="";if(e==null||e==="")return!1;
+   var A=String(t),B=String(e);return A===B||A.toUpperCase()===B.toUpperCase()}
```

### Cieniowanie (CLAUDE.md §5) — zweryfikowane, nie z numerów linii deminifikatu

Policzone w `git show origin/main:mirror/backend/index.cjs`:

| symbol | wystąpienia | wniosek |
|---|---|---|
| `function tk(` | 1× (offset 1 432 657, linia 304) | MARTWA deklaracja; `_KP` ma 5 pól |
| `tk=function(` | 1× (offset 1 438 815, linia 312) | **ŻYWA** (przypisanie z łatki, wykonuje się później); `_KP` ma 7 pól |
| `function Xq(` | 1× (offset 1 430 238) | jedyna definicja — **brak cieniowania**, wspólna dla obu `tk` |
| `a.marka=a.marka??r.marka??…` | 1× (offset 1 350 905) | **wewnątrz `U.acceptStaging`**, przed obiema definicjami `tk` |

**Fakt do sprostowania w docs:** P3 NIE jest w `tk()`, tylko w `U.acceptStaging` — roadmapa (blok
I13/13b), backlog #56 i prompt startowy z ticketa 40 mówią „fallback marki w `tk()`". Zakres karty
się nie zmienia (13b = „`tk()`/`acceptStaging`"), ale fakt trzeba poprawić.

Harness charakteryzacji (`test/charakteryzacja/silnik/oryginal.mjs`) już zna parę martwa/żywa i tnie
po kotwicy `zywyTk`, pomijając `martwyTk` — nic tu nie trzeba naprawiać.

### Rozjazd CHANGELOG ↔ kod (znalezisko tej karty)

CHANGELOG Ani (2026-09-01 12:30) twierdzi, że dzięki `Xq` „Kleber GRIPKER" vs „KLEBER GRIPKER" NIE
generuje `staging_items` typu `zmiana_kluczowa`. **Kod tego nie robi.** W żywym `tk` klasyfikacja
liczy się bez `Xq`:

```js
_KP=["rozmiar","indeksNosnosci","indeksPredkosci","model","marka","nazwa","kodDostawcy"],
_ck=_KP.some(pk=>{ …; return String(vS??"")!==String(vN??"") })   // case-SENSITIVE
```

`Xq` wpływa realnie tylko na (a) narrację `powod` (pętla po `Vq`/`POLA_ROZNIC`) i (b) auto-patch pól
`cenaZakupu`/`cenaSprzedazy`/`marzaPct`/`stan`/`magazyn`. Szum case-only w produkcji usunęła
migracja danych `UPPER(nazwa)` + `DELETE` 769 wierszy CASE_ONLY — czyli **13c**, nie kod silnika.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ticket **nie zmienia kształtu API** — zmienia wartość jednego pola w skrajnym przypadku oraz próg
równości przy porównaniach. Ścieżki objęte zachowaniem:

- `POST /api/staging/import`, `POST /api/staging/accept`, `GET /api/staging`, `GET /api/staging/paged`,
  `GET /api/products` (`contract/openapi.yaml`).
- Fixtures: `contract/fixtures/GET_staging.json`, `contract/fixtures/GET_staging_paged.json`.

**Ustalenie:** wszystkie `snapshotJson` w tych fixtures mają `"marka":"BKT"` — żaden nie ma pustej
marki, więc P3 **nie zmienia ani jednej wartości w istniejących fixtures**. Przenagranie fixtures
z powodu tej karty NIE jest potrzebne; gate = zgodność kształtu bez zmian + zielone bramki
charakteryzacji liczone przeciw żywemu oryginałowi 08.09.

## Decisions

- **D1 — `zmiana_kluczowa` zostaje case-sensitive (wierność 1:1).** Zmieniamy wyłącznie helper
  równości (`wartosciRowne` = `Xq`). `POLA_KLUCZOWE`/`zmianaKluczowa` w `tk.ts` zostają na literalnym
  `String(…) !== String(…)`, dokładnie jak żywy oryginał. Rozważana alternatywa (rozszerzyć
  case-insensitivity na `_ck`, żeby spełnić INTENCJĘ z CHANGELOG) **odrzucona**: byłoby to świadome
  odstępstwo od kodu produkcji, rozjechałoby port z `silnik.charakteryzacja` (który porównuje
  z żywym wyciętym oryginałem) i z zachowaniem produkcji przy cutoverze. Decyzja użytkownika.
- **D2 — pokrycie testowe dopisujemy.** Dziś ŻADEN test nie dotyka `UNKNOWN` ani case-insensitive
  równości, a fixtures mają wszędzie `marka:"BKT"` — bez nowych testów obie zmiany przeszłyby bez
  wykonania ścieżki. Dopisujemy scenariusz akceptacji z pustą marką (porównywany na żywo
  z oryginałem) + testy jednostkowe `wartosciRowne`. Decyzja użytkownika.
- **D3 — docs prostujemy w tej karcie.** Pola „Iteracja" we wpisach backlogu #56/#57/#58/#59 mają
  STARE przypisania sprzed przeprojektowania podziału w tickecie 40 i są sprzeczne z wiążącą tabelą
  mapowania (`docs/rebuild-backlog.md` ~2540). Prostujemy je, prostujemy fakt „`tk()`" →
  „`acceptStaging`", a rozjazd CHANGELOG↔kod (`_ck` bez `Xq`) dopisujemy **do bloku 13c**, bo tam
  się rozstrzyga. Decyzja użytkownika.

**Świadome odstępstwa od oryginału:** BRAK. Obie zmiany to odtworzenie 1:1 wpisów backlogu
oznaczonych ✅ TAK (#56, #59 część silnikowa).

## Implementation plan

### Krok 1 — dociągnięcie wycinka oracle
- `git checkout origin/main -- mirror/backend/index.cjs` (TYLKO ten plik; NIE merge `main`).
- Weryfikacja: `git diff --stat` pokazuje wyłącznie `mirror/backend/index.cjs`; ponowne policzenie
  `function tk(` / `tk=function(` / `function Xq(` na dociągniętym pliku.

### Krok 2 — P3 w porcie TS
- `rebuild/backend/src/import/akceptacja.ts:128`
  `rekord.marka = rekord.marka ?? snapshot.marka ?? (pozycja.nazwa.split(" ")[0] || "—");`
  → `rekord.marka = rekord.marka ?? snapshot.marka ?? "UNKNOWN";`
- Zaktualizować komentarz odniesienia do oryginału (P3, CHANGELOG 2026-08-31).

### Krok 3 — CAPS/Xq w porcie TS
- `rebuild/backend/src/import/silnik/pozycja.ts:180-184`, funkcja `wartosciRowne()`:
  `return String(stara) === String(nowa);`
  → `const A = String(stara), B = String(nowa); return A === B || A.toUpperCase() === B.toUpperCase();`
- Zaktualizować doc-komentarz (niesymetryczność zostaje; dochodzi case-insensitivity).
- **Jedna funkcja, sześć call-site'ów w `tk.ts`** (linia 427 `POLA_ROZNIC`; 455/461/467/471/476
  auto-patch) — call-site'ów NIE dotykamy, zmiana propaguje się sama, tak jak w oryginale.
- **NIE dotykamy** `POLA_KLUCZOWE`/`zmianaKluczowa` w `tk.ts:433-438` (D1). Dopisujemy tam komentarz
  wyjaśniający, dlaczego to zostaje case-sensitive mimo narracji CHANGELOG.

### Krok 4 — przenagranie kotwicy integralności
- Fragment `helpery` (od `function mm(` do `martwyTk`) zawiera `Xq` → jego sha256 i długość się
  zmieniły. Przenagrać `test/charakteryzacja/silnik/integralnosc.json` skryptem
  `scripts/charakteryzacja-silnik-nagraj.mjs` (`BRIDGE_SNAPSHOT_DB=…`), nie ręcznie.
- Skrypt nadpisuje też `MO*.expected.json` i `scenariusze.expected.json` — sprawdzić, CO się
  przesunęło, i opisać w raporcie. Fragment `silnik` (żywy `tk`) nie powinien się zmienić.
- `akceptacja.charakteryzacja` **nie ma zamrożonej kotwicy sha** — uruchamia oryginał na żywo, więc
  podciągnie nowe zachowanie sam po Kroku 1.

### Krok 5 — nowe testy (D2)
- `test/charakteryzacja/akceptacja/scenariusze.mjs` — nowy scenariusz `marka-pusta-daje-unknown`:
  `snapshot` bez pola `marka`, katalog pusty → oryginał i port muszą zgodnie dać `marka:"UNKNOWN"`.
  Poprawić też opis scenariusza `nowa-pozycja-wchodzi-do-katalogu` („marka z pierwszego słowa nazwy"
  — nieaktualne i nigdy nie wykonywane, bo snapshot ma `marka:"BKT"`).
- `test/silnik.decyzje.test.ts` (lub nowy `silnik.rownosc.test.ts`) — testy jednostkowe
  `wartosciRowne`: case-only równe; puste/niepuste bez zmian; `6.5` vs `"6.5"` równe; `6.5` vs `"6.50"`
  różne; oraz asercja negatywna do D1: case-only różnica w `marka` NADAL daje `zmiana_kluczowa`.

### Krok 6 — bramki i docs
- `npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/backend/`.
- Docs wg D3.

## Testing strategy

- **Gate odbudowy:** ticket nie zmienia kształtu API; fixtures `GET_staging*.json` nie zawierają
  pustej marki, więc pozostają bez zmian — sprawdzamy, że nadal przechodzą (dowód braku regresji),
  nie przenagrywamy ich.
- **`test/silnik.charakteryzacja.test.ts`** — musi być zielony po przenagraniu kotwicy: port `tk()`
  == żywy oryginał pole-po-polu na zrzucie `db/snapshot.db`.
- **`test/akceptacja.charakteryzacja.test.ts`** — zielony, z NOWYM scenariuszem `marka` pusta →
  `"UNKNOWN"`, porównywanym na żywo z oryginałem 08.09.
- **Testy jednostkowe** `wartosciRowne` — bez mocków, czysta funkcja.
- **Pełny `npm test`** — wykrycie przesunięć w sąsiednich bramkach (`silnik.gate`, `staging.gate`,
  `katalog.gate`, `overrides.gate`).
- **Jeśli bramka nie chce być zielona bez migracji nazwy (13c)** — ODNOTOWUJEMY w raporcie i zostawiamy
  dla 13c. NIE wyłączamy, NIE skipujemy, NIE robimy migracji tutaj.

## Out of scope

- Migracja `products.nazwa` → UPPER, `manual_overrides.nazwa`, `DELETE` staging CASE_ONLY — **13c**.
- Migracje katunify (#57) i konstrukcja kody→słowa (#58) — **13c**.
- Warstwa parserów `src/import/legacy/**` — zrobiona w **13a**, nie ruszamy.
- Podsystem Selly (#60) — **13d**. Frontend (#61) — **13e**.
- Rozszerzanie case-insensitivity na klasyfikację `zmiana_kluczowa` — odrzucone w D1.
- Dociąganie czegokolwiek z `main` poza `mirror/backend/index.cjs`.

## Definition of done

- [ ] `mirror/backend/index.cjs` dociągnięty z `origin/main` (i TYLKO on)
- [ ] P3: `akceptacja.ts` daje `"UNKNOWN"` zamiast `nazwa.split(" ")[0]`
- [ ] CAPS: `wartosciRowne()` porównuje case-insensitive; `POLA_KLUCZOWE` nietknięte (D1)
- [ ] Kotwica `integralnosc.json` przenagrana skryptem, nie ręcznie
- [ ] `silnik.charakteryzacja` zielony
- [ ] `akceptacja.charakteryzacja` zielony, w tym nowy scenariusz `marka` → `"UNKNOWN"`
- [ ] Testy jednostkowe `wartosciRowne` + asercja D1
- [ ] `lint` + `typecheck` + `build` + `test` zielone
- [ ] Roadmapa: blok 13b oznaczony jako zrobiony (data + ID ticketa), fakt `tk()`→`acceptStaging`
      sprostowany, rozjazd CHANGELOG↔kod dopisany DO BLOKU 13c
- [ ] Backlog: #56 i część silnikowa #59 → „zrobione w 13b"; pola „Iteracja" #56–#59 zgodne
      z tabelą mapowania
- [ ] PR do `develop`
