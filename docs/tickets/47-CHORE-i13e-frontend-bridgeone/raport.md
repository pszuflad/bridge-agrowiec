# 47-CHORE-i13e-frontend-bridgeone — raport z implementacji

## Podsumowanie

13e domknięte. Z pięciu etykiet z bundla produkcji realny kod dotyczy **tylko `szer_marka`** —
i to nie „kolumny szerokość/marka", lecz dwóch poprawek: `Wfmt` traci gałąź „cała notacja `AxB`",
a filtr „marka bez cyfr" obejmuje od 2026-09-04 także wartości ze słownika. Rebrand „Bridge ONE"
i `PRICEFMT` odbudowa miała już 1:1 (deminifikat to bundle PRICEFMT sprzed 04.09, więc port
z I0–I12 wciągnął je automatycznie); `tr_fix` i `ackalerts` żyją w silniku pseudo-alertów,
którego odbudowa świadomie nie ma (D1 z I6, backlog #26). Przy okazji rozkładania diffu wyszła
regresja w ŻYWEJ produkcji: łatka `konstr` z 01.09 poszła w martwy bundle.

## Zmiany

- `rebuild/frontend/src/pages/katalog/formatowanie.tsx` — `formatujSzerokosc` (`Wfmt`) bez gałęzi
  `AxB`; docblock przepisany z pięciu kroków na cztery + dwie noty: skąd zmiana (łatka
  `szer_marka`, pomiar 587/7395) i dlaczego kroku „token z `rozmiar`" nie wolno upraszczać
  (to on niesie zera końcowe).
- `rebuild/frontend/src/pages/katalog/filtrowanie.ts` — `listaMarek` odsiewa `!/\d/` także na
  gałęzi słownikowej; ostrzeżenie o asymetrii przepisane (asymetria marka↔słownik zniknęła,
  asymetria marka↔kategoria ZOSTAJE i nie wolno jej „domykać").
- `rebuild/frontend/test/katalog.formatowanie.test.tsx` — test notacji `AxB` odwrócony
  (`14.9x28` → `"14.9"`, plus `16x6-8` i `23x10.50-12`); test „nie stosuje przy ukośniku"
  przepisany na strażnika rozmiarów ze slashem; **dopisane** dwa: zera końcowe (`8.00x20`)
  i asercja przeciw pozycji `[2]` z `contract/fixtures/GET_products.json`.
- `rebuild/frontend/test/katalog.filtrowanie.test.ts` — test filtra marek odwrócony
  („Gruma 3" ze słownika ma teraz WYPAŚĆ, „Michelin" zostaje); komentarz przy fixturze słownika
  zaktualizowany.
- `rebuild/frontend/test/katalog.eksport.test.ts` — **dopisany** test, że CSV zmienia się razem
  z tabelą (eksport dzieli formater).
- **Nowe:** `docs/tickets/47-CHORE-i13e-frontend-bridgeone/{plan.md,raport.md}`.

Bez zmian: `contract/`, `rebuild/backend/`, `rebuild/schema/`, `mirror/`.

## Rozkład diffu bundla — ustalenia (materiał dowodowy)

Kopie `.bak` istnieją **tylko na gałęzi `main`** (weszły `31aa0e5`/`d88ac15`, 2026-09-08);
na `develop` ich nie ma, więc czyta się je przez `git show main:mirror/frontend/assets/<plik>`.
Bundle rozbite na kawałki po `;{}` i porównane `diff -u`.

**Żywy bundle to `index-PRICEFMT1783512500.js`** (`mirror/frontend/index.html:16`).
`index-BRIDGEONE21783342500.js` jest martwy od łatki `pricefmt` z 31.07. Linia rodowa:
`AUTOFILL` → `BRIDGEONE` (31.07 13:01) → `BRIDGEONE2` (31.07 13:55) → `PRICEFMT` (31.07).

| etykieta | realny zakres | stan odbudowy |
|---|---|---|
| rebrand | `<title>` + 3× `children:"Bridge"`→`"BridgeOne"` + usunięcie podtytułu „dla Agrowca" (sidebar, logowanie). `aria-label="Bridge"` i teksty pomocnicze bez zmian. | **już 1:1** od ticketa 2 (`751a8e2`) |
| PRICEFMT | `DT`: `cenaSprzedazy` odchodzi od wspólnej gałęzi z `cenaZakupu` — `toFixed(2)` → `` `${Math.floor(n)},-` ``. Eksport `OT` nietknięty. | **już 1:1** (`formatowanie.tsx:167,169`) |
| tr_fix | usunięcie tokenu `"tr-"` z listy `h2` („to nie opona"). Regex `\btr-\b` łapał `TR-135` w nazwach opon BKT → fałszywy alert „Nie-opona w katalogu". | **N/D** — `h2`/`v2`/`pv` nie istnieją |
| ackalerts | (1) odcisk wartości w `id` alertu (`-marza-ujemna-{marża}`, `-nie-opona-{nazwa\|kategoria}`, `-brak-importu-{dni}`), (2) pulpit czyta `alerty-statusy` z IndexedDB, (3) `window.dispatchEvent("alerty-statusy-updated")` po zapisie, (4) ukrycie `rozwiazany` poza filtrem. | **N/D** — patrz decyzje D2/D3 |
| szer_marka | (a) `Wfmt` bez gałęzi `AxB`; (b) filtr „bez cyfr" dołożony na gałęzi słownikowej `listaMarek`. | **zrobione w tym tickecie** |

Pomiar wpływu (a) na `db/snapshot.db`: **587 z 7395** pozycji zmienia zapis —
`8.00x20`→`8.00`, `16x6-8`→`16`, `23x10.50-12`→`23`, `300x15`→`300`, `14.9x28`→`14.9`.

## Odstępstwa od planu

Brak. Zakres kodu, testy i decyzje D1–D4 zrealizowane 1:1 z `plan.md`.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Zmiany są wyłącznie
  w warstwie prezentacji frontendu; żaden endpoint, kształt odpowiedzi ani kod HTTP się nie
  zmienia. Dowód: `git diff --name-only origin/develop` nie zawiera ani jednego pliku
  z `contract/` ani z `rebuild/backend/`. Fixtures wchodzą tylko jako DANE WEJŚCIOWE testów FE
  i **nie zostały zmienione** — `contract/fixtures/GET_products.json` jest nietknięty, zmieniło
  się oczekiwanie testu (pozycja `[2]`, `rozmiar:"8.00x20"`, `szerokosc:"8.00"` → `"8.00"`
  zamiast `"8.00x20"`), bo zmienił się formater.
- **Unit (vitest): ✓ 751/751 w 48 plikach.** Zestawy dotknięte: `katalog.formatowanie.test.tsx`,
  `katalog.filtrowanie.test.ts`, `katalog.eksport.test.ts` — 82/82.
- **Bramki FE:** `npm run lint` ✓ · `npm run typecheck` ✓ (3× `tsc`) · `npm run build` ✓ ·
  `npm test` ✓. Node v20.20.2.
- **Backend:** nieruszany, bramek nie uruchamiano (uzasadnienie wyżej).
- E2E: pominięte — zmiana czysto prezentacyjna, w całości pokryta testami jednostkowymi
  spiętymi z nagraną odpowiedzią produkcji.

## Breaking changes

Brak w sensie API. Zmiana **widoczna dla użytkownika**: kolumna „Szerokość opony" w katalogu
i w eksporcie CSV pokazuje dla 587 pozycji sam człon szerokości zamiast pełnej notacji `AxB`
(`14.9x28` → `14.9`). To jest ODTWORZENIE stanu produkcji z 2026-09-04, nie regresja.
Drugi widoczny skutek: z listy filtra „Producent" znikają wartości słownikowe zawierające cyfrę.

## Follow-up

1. **⚠ Regresja `konstrukcja` w ŻYWEJ produkcji — do zgłoszenia Ani.** Łatka pass-through
   z 2026-09-01 11:22 (`"Diagonalna":n||""` / `:n||null` obok mapowania kodów) trafiła do
   `mirror/frontend/assets/index-BRIDGEONE21783342500.js`, czyli do bundla, którego `index.html`
   **nie ładuje**. Potwierdzenie w `mirror/backend/CHANGELOG.md:101` — Ania wpisała tam właśnie
   tę ścieżkę. Żywy `index-PRICEFMT1783512500.js` ma `…"Diagonalna":""` / `…"Diagonalna":null`,
   więc po migracji `konstrukcja` na pełne słowa **produkcja pokazuje dziś „—" w kolumnie
   „Konstrukcja opony" i pustą kolumnę w eksporcie CSV** dla 7392 zmigrowanych wierszy.
   Naprawa po stronie VPS: przenieść tę samą zmianę do `index-PRICEFMT1783512500.js`
   (dwa miejsca: `OT` → `:n||""`, `DT` → `:n||null`). **Odbudowa jest poprawna i nie wymaga
   zmian** — po 13c ma pass-through, czyli od dziś świadomie odbiega od żywej produkcji (D4).
2. **Silnik pseudo-alertów katalogowych (`pv`/`v2`) — backlog #26, dalej ⬜ do decyzji.**
   Dopóki nie zostanie sportowany, `tr_fix` i `ackalerts` nie mają w odbudowie nośnika.
   Gdyby kiedyś wszedł, wchodzi OD RAZU w wersji po łatkach z 04.09: `h2` bez `"tr-"`,
   `id` alertów z odciskiem wartości, pulpit czytający zapisane statusy.
3. **Trzeci status alertu (`przejrzany`)** — istnieje w oryginale, nie istnieje w odbudowie
   (`alerty/api.ts:29-30`, `backend/src/repos/alerts.ts`, fixture `GET_alerts.json`).
   Nie wprowadzany, bo rozszerzałby kontrakt bez wpisu w backlogu.
4. **Enhancer konfiguratora kolumn stagingu** (`ex_marka`/`ex_szerokosc`, doklejony
   niezminifikowany na końcu bundla) — mylące skojarzenie z etykietą `szer_marka`, ale to
   inna i wcześniejsza zmiana. Odbudowa ma staging z 11 sztywnymi kolumnami
   (`staging/TabelaStagingu.tsx:81-102`). Nie jest to w żadnym wpisie backlogu — do triażu.
