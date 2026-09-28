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

Pomiar wpływu (a) na `db/snapshot.db`: **587 z 7395** pozycji zmienia zapis.
⚠ Zniesiona gałąź oddawała DWA PIERWSZE CZŁONY, a nie cały `rozmiar` — przykłady czytaj jako `rozmiar` → dziś (dawniej): `8.00x20` → `8.00` (dawniej `8.00x20`), `300x15` → `300` (dawniej `300x15`), `14.9x28` → `14.9` (dawniej `14.9x28`), ale `16x6-8` → `16` (dawniej `16x6`) i `23x10.50-12` → `23` (dawniej `23x10.50`).

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

## Poprawki po review

Review (`review.md`): **0 BLOCKER**, 4 SHOULD-FIX, 3 NICE-TO-HAVE. Reviewer niezależnie odtworzył
diff obu bundli (dwa hunki, oba w tickecie), graf wywołań `Wfmt`/`listaMarek` oraz pomiar 587/7395.

Naniesione:

- **SHOULD-FIX — mylące przykłady.** Zniesiona gałąź `AxB` oddawała DWA PIERWSZE CZŁONY, a nie
  cały `rozmiar`, więc zapis „`16x6-8`→`16`" czytany jako „dawniej → dziś" był nieprawdziwy
  (dawniej było `16x6`). Lista rozpisana na `rozmiar` → dziś (dawniej) w `formatowanie.tsx`,
  `plan.md` i wyżej w tym raporcie.
- **SHOULD-FIX — deminifikat starszy niż produkcja.** `deminified/frontend-active-bundle.txt`
  jest NADPISYWANY przez `tools/deminify.sh:42`, więc nota w nim by zginęła; powstał
  **`deminified/README.md`** z listą czterech łatek, których deminifikat nie zawiera
  (`konstr`, `tr_fix`, `ackalerts`, `szer_marka`), i z instrukcją czytania żywego bundla z `main`.
  Dodatkowo nota w nagłówku `formatowanie.tsx`, żeby nikt nie „przywrócił" zdjętej gałęzi.
- **NICE-TO-HAVE** — nota przy asercji `konstrukcja` w teście (to stan odbudowy, nie produkcji —
  odstępstwo D4) oraz usunięte zbędne `as unknown as` w teście eksportu (`Produkt.szerokosc`
  to `number | string | null`, podwójne rzutowanie było niepotrzebne).

Pozostałe dwa SHOULD-FIX (`docs/spec-frontend.md:173` oraz warstwa docs z DoD — roadmapa 13e,
backlog #61/#58, wpis o regresji `konstrukcja`) idą Fazą 5, przez doc-checkery.

Bramki po poprawkach: `lint` ✓ · `typecheck` ✓ · `build` ✓ · `test` ✓ 751/751.

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

## Docs updates

Cztery doc-checkery, równolegle. Podsumowania:

### `docs/rebuild-roadmap.md`
- §4 tablica postępu, wiersz 13: `⬜` → `🔨`; dopisane `13e: ✅ 47-CHORE-i13e-frontend-bridgeone ·
  2026-09-09 (realny kod tylko szer_marka)`; „Zostają 13d-2/13d-3/13e" → „Zostaje 13d (Selly)".
- §5 blok 13e **przepisany na opis STANU**: zakres faktyczny, GATE N/D + bramki FE, sekcja
  **Fakty** (żywy vs martwy bundle, pomiar 587/7395 w zapisie „dziś (dawniej)", zasięg na CSV,
  `/narzuty` bez filtra) oddzielona od sekcji **Decyzje użytkownika D1–D4**, plus Follow-up.
- §2 tabela źródeł prawdy, wiersz `deminified/`: dopisany fakt, że `frontend-index.js` jest
  z 2026-08-13, starszy od produkcji o cztery łatki → `deminified/README.md`.
- §6: nota dla cutoveru i przeglądu 12 widoków o regresji `konstrukcja` w żywej produkcji.
- §5 blok 7c: sprostowane zdanie „filtr «bez cyfr» wisi WYŁĄCZNIE na gałęzi produktowej".
- **Usunięte jako obalone** (nie dopisane obok): „`szer_marka` — kolumna szerokość/marka";
  rebrand i PRICEFMT jako robota do wykonania; „`tr_fix`/`ackalerts` — port do TS";
  ostrzeżenie „CAPS `nazwa` zderzy się z formatowaniem we froncie" → zamienione na zmierzony
  fakt „bezprzedmiotowe" (zero `capitalize`/`title-case` w `rebuild/frontend/src/`).

### `docs/rebuild-backlog.md`
- **#61 → ✅ zrobione w 13e**: `Zmiana Ani` przepisana z etykiet na realny rozkład diffu wszystkich
  pięciu łatek; `Do nowej wersji?` `⬜ do decyzji` → `✅ TAK — i już było` (D1); Status z pomiarem
  587/7395, notą o dwóch pierwszych członach i decyzjami D2/D3.
- **#58 → sprostowanie faktu**: usunięte fałszywe „dokładnie jak bundle produkcji od 2026-09-01";
  w to miejsce dowód, że łatka poszła w martwy bundle, i zapis, że pass-through jest od
  2026-09-09 świadomym odstępstwem (D4).
- **NOWY wpis #71** — regresja `konstrukcja` w żywej produkcji, `❌ NIE — świadomie nie
  odtwarzamy`, z konkretną naprawą po stronie VPS i adnotacją „nie blokuje cutoveru".
  ⚠ Numer zweryfikowany przez agenta: ostatni istniejący wpis to **#70**, nie #65 jak zakładałem.
- Tabela mapowania I13: wiersz #61 zaktualizowany, dodany wiersz dla #71.
- **#26** (pseudo-alerty): dopisane doprecyzowanie — gdyby kiedyś weszły, wchodzą OD RAZU
  w wersji po łatkach z 04.09. Status wpisu pozostaje ⬜.

### `docs/spec-frontend.md`
- Sprostowana teza o filtrze „bez cyfr" (wskazana w code review) + nota, że asymetria
  marka↔kategoria zostaje.
- Nagłówek dokumentu: ⚠ nota „deminifikat jest starszy niż produkcja" — dotyczy weryfikacji
  całego dokumentu, który sam deklaruje deminifikat jako źródło konfrontacji.
- §4 („Alerty"): doprecyzowanie, że `tr_fix`/`ackalerts` żyją wyłącznie w pseudo-alertowym
  silniku oryginału (D2/D3).
- §5: nowy blok 13e z rozkładem pięciu etykiet, pomiarem i odstępstwami D1/D4.

### `docs/cutover.md`, `docs/przeglad-12-widokow.md`, `CLAUDE.md`, `START.md`
- `cutover.md`: oczekiwana różnica po przełączeniu — kolumna „Konstrukcja opony" zacznie działać
  (rozdział 1) + kratka w smoke-testach (rozdział 6); liczba testów FE `747` → `751`.
- `przeglad-12-widokow.md`: nota w sekcji „Katalog" i pozycja 7 na liście „wygląda inaczej i to
  jest w porządku" — w starym Bridgu są kreski, u nas pełne słowa, nie zgłaszać jako błąd.
  Kolumny „Szerokość opony" świadomie NIE opisano: produkcja ma łatkę `szer_marka` od 04.09,
  więc staging wygląda tak samo jak to, co Ania widzi dziś.
- `CLAUDE.md`: dwie nowe pułapki w sekcji ostrzeżeń — (1) „w `mirror/frontend/` bundli jest kilka,
  ale ŻYWY jest tylko ten z `index.html`" (z poleceniem `grep` i przypadkiem `konstr`),
  (2) „nazwa kopii `.bak` daje ETYKIETĘ, nie treść" (z morałem: najpierw rozłóż diff bundla).
- `START.md`: akapit o stanie odbudowy był nieaktualny o dziesięć iteracji („iteracje 0–2
  zamknięte, iteracja 3 w toku") — przepisany na I0–I12 zamknięte + I13 poza 13d; nota
  o froncie i o starszym deminifikacie.

### Pre-existing issues (zastane, NIENAPRAWIONE — do decyzji użytkownika)
- **⚠ Kolizja z gałęzią `chore/46-revert-13d1-selly`.** Ten worktree odchodzi od `origin/develop`
  (`c1ef210`), czyli SPRZED commita `cc868a3`, który cofa 13d-1 i oznacza całe 13d jako ⛔ ODŁOŻONE.
  Wiersz 13 tablicy roadmapy, linia „Kolejność" i linia Status I13 są dotknięte po obu stronach —
  **przy scalaniu trzeba je złączyć ręcznie** (gałąź 46 jest nadrzędna co do 13d, ta co do 13e).
  Dotyczy też `docs/cutover.md:43` („backend: 87 plików / 1330 testów, po 13d-1") i wiersza
  `SELLY_SCHEDULER` w rozdziale 4 — po rewercie 13d-1 wymagają sprostowania.
- `docs/rebuild-roadmap.md` stopka: „Zamknięte 2026-09-08 (12e) — dalsze zmiany tego pliku to już
  follow-up po cutoverze" jest sprzeczne z tym, że I13 trwa.
- `docs/rebuild-backlog.md:20` — legenda `Status` zna tylko `— / 🔨 / ✔`, a cała sekcja I13
  (#53–#71) używa `✅` i `⬜`. Legenda nieaktualna wobec ~20 wpisów.
- `docs/rebuild-backlog.md:22-27` — lista pozostałych ⬜ z 12e jest datowaną migawką; od tego czasu
  doszły #66–#71.
- `docs/rebuild-backlog.md` #58, pole `Iteracja` — dwa nawarstwione sprostowania, treściowo
  poprawne, ale trudne w czytaniu.
- `docs/spec-frontend.md:498` literówka „zrzytów"; `:502` „sidebar 10 pozycji" (§6, oryginał) vs
  „11 pozycji" (§2, odbudowa) bez adnotacji; §6 „12 tras = 12 widoków" vs §3 „13 tras".
- `docs/cutover.md:3` — pole „Wersja dokumentu" nie było aktualizowane przez tickety 44/45.
- `START.md:233` — „feed MO3 nie działa od 2026-07-06" jest z lipca, brak dowodu na dziś.
  `START.md:201` — „26 tabel / 71 kolumn `products`" vs 72–73 kolumny w `cutover.md`.
