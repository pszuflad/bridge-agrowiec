# 6-FEATURE-silnik-tk-dopasowanie-klasyfikator — Silnik `tk()`: dopasowanie + klasyfikator (I3, sesja 3c)

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `feature/6-silnik-tk-dopasowanie-klasyfikator`
> Worktree: `.worktrees/6-FEATURE-silnik-tk-dopasowanie-klasyfikator`

## Opis ticketa

Realizacja Iteracji 3, sesja **3c** (BACKEND) wg `docs/rebuild-roadmap.md` §5. Cel: wymienić
ciało jednej funkcji — silnika dopasowania `tk()` — który 3b zostawiła jako jawny, świadomie
niewierny szew. Zakres: port `Zc`, `Hq`, `Lq`, `Kq`, `Vq`, `Xq` z charakteryzacją PRZED wpięciem;
wymiana ciała silnika — mapy dopasowania (kod → EAN → EAN znormalizowany), łańcuch identyfikatora
(kod dostawcy → EAN → `Lq()`), klasyfikacja `nowa`/`blad`/`zmiana_kluczowa`, budowa `ostrzezenie`
i `powod`, konflikt EAN, reset `nieobecnosc_pod_rzad` przy dopasowaniu, kasowanie produktu przy
nie-oponie. Bez zatwierdzania, historii i realnych overrides (3d), bez frontendu (3e).

Główny dowód sesji: **gate treści** — realny import pliku z próbek i porównanie wierszy
`staging_items` pole po polu.

## Kontekst

3b zostawiła kompletny brzeg: trasy importu (`POST /api/import/parse-file`, `/from-url`),
archiwizację, zapis wsadowy w transakcji (`zapiszPozycjeStagingu`) i trzy projekcje odczytu.
Silnik jest wstrzykiwany przez `ZaleznosciImportu.silnik`, więc **trasy nie wymagają zmian** —
podmieniamy wyłącznie implementację w `src/import/tk.ts` plus dokładamy brakujące funkcje repo.

Żywy oryginał to `deminified/backend-index.cjs:47584-47851` (`tk = function`). Wcześniejsza
`function tk` (:47378-47583) jest **martwa** — nadpisana przez późniejsze przypisanie. Ten sam
wzorzec dotyczy `Lq`: `:46965` (licznik cyfr znaczących) jest nadpisana przez `:47312` (generator
identyfikatora sha1). Ustalono, że **duplikaty są realne w wysłanym bundlu**, a nie artefaktem
naszej deminifikacji — biorą się z łatek `patch_*.cjs` doklejanych po buildzie (`mirror/backend/`
zawiera kilkanaście takich skryptów). Konsekwencje w „Decyzje" (D3).

Graf wywołań `tk()` w zakresie 3c jest **większy, niż wymieniała roadmapa**. Poza
`Zc`/`Hq`/`Kq`/`Vq`/`Xq`/`Lq`/`Gq` dochodzą funkcje, których żadna z nich nie może się pozbyć:

| Funkcja | Linia | Rola |
|---|---|---|
| `mm` | :46940 | suma kontrolna EAN-13 |
| `zq` | :46950 | rozwinięcie notacji naukowej („8,05997E+12") |
| `ZT` | :46971 | właściwy normalizator EAN → `ean_source_status`, `ean_candidates` |
| `bn` | :47121 | `parseFloat` z przecinkiem dziesiętnym |
| `YT` | :47126 | parsowanie rozmiaru → szerokość/profil/średnica/LI/SI/PR/TL-TT/VF-IF |
| `JT` | :47212 | wycięcie rozmiaru z nazwy + oczyszczenie nazwy |
| `ek` | :47233 | wymiary z formatu `W/P-D` (fallback szerokości i wysokości boku) |
| `qq`/`Mq`/`Fq`/`$q` | :47056-47059 | słowniki i regexy klasyfikatora `Zc` |

Sprawdzone: **nie pokrywają się z portem 3a.** `common.cjs:normalizeEan` to inna funkcja niż `ZT`
(zwraca string albo `null`, bez `ean_source_status`/`ean_candidates`). Port 3a obsługuje potok
WEJŚCIA do `tk()`, ten zakres to warstwa nad nim.

**Kluczowe odkrycie tej sesji: oryginał da się uruchomić poza serwerem.** `mirror/backend/index.cjs`
(1,48 MB, 632 linie, esbuild, **nazwy nieobfuskowane** i identyczne jak w deminifikacie) zawiera
cały ten graf w jednym ciągłym fragmencie ~11,5 kB, a żywe `tk` w drugim ~8 kB. Zweryfikowane
empirycznie: oba fragmenty wycięte po kotwicach tekstowych ładują się jako moduł CJS i wykonują,
gdy podstawi się atrapy `U`, `ww`, `__BRIDGE_EXT`, `Qi`. Uruchomiony oryginalny `tk()` zwrócił
poprawne statystyki, `powod`, `snapshotJson` i identyfikator zastępczy `MO5_1248DC01D81B23`.
Sam `require()` całego `index.cjs` jest **niebezpieczny** (top-level IIFE otwiera bazę i nasłuchuje
na porcie) — dlatego ekstrakcja fragmentu, nie import całości.

`db/snapshot.db` to prawdziwy zrzut produkcji: **7405 produktów** (MO5 1989, MO2 1729, MO9 861,
MO1 657, MO3 631, MO8 624, MO4 423, MO7 271, MO10 220), **3362 wiersze `staging_items`** we
wszystkich czterech `typZmiany` (`wycofana` 1297, `zmiana_kluczowa` 1457, `nowa` 419, `blad` 189)
oraz **12620 `manual_overrides`**. To materiał na realny katalog do scenariuszy dopasowania.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ścieżki `contract/openapi.yaml`, które ticket musi spełnić (wszystkie postawione w 3b — 3c zmienia
TREŚĆ danych, nie kształt odpowiedzi):

- `GET /api/staging` — fixture `contract/fixtures/GET_staging.json`
- `GET /api/staging/paged` — fixture `contract/fixtures/GET_staging_paged.json`
- `GET /api/staging/{id}`
- `POST /api/import/parse-file`, `POST /api/import/from-url` — ciało odpowiedzi rozsypuje
  10 liczników `StatystykiImportu` przez `...tkResult`, więc zestaw kluczy jest częścią kontraktu

Dodatkowo bez zmian muszą zostać zielone: **GATE Iteracji 2** (`katalog.gate.test.ts`,
`GET_products.json`) oraz **charakteryzacja 3a** (1838 rekordów, sha256 port↔mirror).

**Znane rozjazdy i jak je rozstrzygamy:**

1. **`snapshotJson.szerokosc` — LICZBA w fixture, STRING z dzisiejszych parserów.** Fixture
   nagrano przed poprawką `szertxt`. Rozjazd **oczekiwany**; nie „naprawiamy" ani kodu, ani
   fixture. Porównanie `snapshotJson` z fixture pole po polu wyłącza to jedno pole jawnie,
   z komentarzem. Docelowa decyzja (`products.szerokosc` REAL→TEXT) należy do 3d/I12.
2. **Reguła EAN „8/12/13/14 i nie kończący się pięcioma zerami" jest w MARTWYM kodzie.** Patrz D4.
3. **`GET_staging.json` pokrywa jedną gałąź.** 5 pozycji, wszystkie `dostawca: "MO9"`, wszystkie
   `typZmiany: "zmiana_kluczowa"`, `ostrzezenie: null`, `powod` z jednym składnikiem `Vq`
   („nazwa: X → Y"). Nie ma tam `blad`, konfliktu EAN, identyfikatora zastępczego ani overrides.
   Dlatego fixture jest kontrolą **dodatkową**, a głównym wzorcem jest uruchomiony oryginał (D2).

## Decisions

### D1 — Strategia portu: reimplementacja w TS, dowodem charakteryzacja przeciw oryginałowi

Kod silnika powstaje jako **czytelny TypeScript z polskimi nazwami** w `src/import/silnik/`,
a nie jako ekstrakcja `Zc`/`Hq`/… do `legacy/`.

*Dlaczego nie tak jak w 3a:* strażnikiem 3a był sha256 port↔`mirror/backend/parsers/*.cjs`, bo
tam mirror to **czytelne pliki, które Ania realnie utrzymuje**. Tutaj jedyne źródło to
zminifikowany bundle albo nasza deminifikacja — czyli artefakt **pochodny**, z którym sha256
nie porównuje się z niczym, co ktokolwiek utrzymuje. Ekstrakcja zamroziłaby w ścieżce
produkcyjnej nieczytelny kod z nazwami `Zc`/`Hq` na zawsze, a 3d ma ten silnik rozbudowywać.

*Czym zastępujemy sha256:* testem równoważności zachowania z **realnym bundlem** (D2). To dowód
mocniejszy niż skrót kopii — sha256 potwierdza, że skopiowaliśmy bajty, a charakteryzacja
potwierdza, że kod robi to samo, i wychwyci też rozjazd po aktualizacji mirrora u Ani.

*Koszt przyjęty świadomie:* ryzyko błędu przepisania. Kryte gate'em z D2, uruchamianym na
pełnych realnych cennikach i realnym katalogu.

### D2 — Wzorzec charakteryzacji: uruchomiony ORYGINALNY `tk()` na atrapach

Wzorcem jest wyjście **prawdziwego `tk()` z `mirror/backend/index.cjs`**, wyciętego po kotwicach
tekstowych do modułu testowego i napędzanego atrapami `U`/`ww`/`__BRIDGE_EXT`/`Qi`, które
zapisują wywołania zamiast dotykać bazy. Karmimy go rekordami z realnych cenników
(`test/charakteryzacja/probki/`, przez port parserów z 3a) i realnym katalogiem z `db/snapshot.db`.

Porównujemy pole po polu: wiersze `staging_items`, komplet 10 liczników, zbiór skasowanych
`products.id` i zbiór resetów `nieobecnoscPodRzad`.

To ta sama metodyka co 3a (uruchom oryginał, nagraj wyjście, porównaj), przeniesiona o warstwę
wyżej. Fragment jest zabezpieczony **sha256 wyciętego wycinka** — zmiana w mirrorze zapala test
z jawną instrukcją, zamiast po cichu przesunąć wzorzec.

### D3 — Błąd cieniowania `Lq()` odtwarzamy 1:1

W wysłanym bundlu obie definicje `Lq` są w **tym samym zakresie**, więc późniejsza (`:47312`,
sha1) wygrywa dla całego pliku — także dla wywołania `Lq(i)` **wewnątrz `ZT()`** (:46984), które
miało trafić w licznik cyfr znaczących (`:46965`). Sprawdzone uruchomieniem oryginału: wywołana
z jednym argumentem funkcja sha1 zawsze zwraca `null`, warunek `null < 13` jest zawsze prawdziwy,
więc dla każdego EAN-u w notacji naukowej rozwijającego się do 13 cyfr komunikat brzmi dosłownie:

```
zapis naukowy ma tylko null cyfr znaczących — EAN niepewny
```

Ten tekst trafia do `ostrzezenie` i `powod` pozycji stagingu, czyli **jest widoczny dla Ani**
(3e) i siedzi w danych produkcyjnych. Dotyczy dostawców z notacją naukową w EAN (MO8 Trelleborg,
MO7 Nokian). **Odtwarzamy 1:1**, zgodnie z domyślną regułą projektu; „poprawka" rozjechałaby się
z produkcją i z charakteryzacją. Zgłoszenie do `docs/rebuild-backlog.md` jako znaleziony błąd do
decyzji Ani. W kodzie reprodukujemy to **wywołaniem tej samej funkcji z jednym argumentem**
(a nie zaszytym `null`), żeby mechanizm był widoczny w miejscu, w którym działa.

### D4 — Reguła auto-aktualizacji EAN NIE wchodzi (jest w martwym kodzie)

`docs/spec-backend.md` §5 i `03_IMPORT_tk.md` podają: „EAN auto-zmieniany tylko dla długości
8/12/13/14 i nie kończący się pięcioma zerami". Sprawdzone: ta reguła istnieje **wyłącznie
w martwej `function tk` (:47503-47512)**. Żywy `tk` buduje auto-patch `AP` tylko z
`cenaZakupu`/`cenaSprzedazy`/`marzaPct`/`stan`/`magazyn` i **nigdy nie ustawia `AP.ean`** —
produkcja realnie nie aktualizuje EAN istniejącego produktu przy imporcie.

Rozstrzygnięcie zgodne z hierarchią źródeł (oryginał > spec): **nie implementujemy**, a oba
dokumenty prostujemy. Autor spec czytał martwy duplikat — dokładnie ta pułapka, przed którą
ostrzega `CLAUDE.md`. Martwa `function tk` różni się od żywej także dopasowaniem (brak mapy EAN
i `conflictEans`), składem `_KP` i liczeniem `cenaZakupuStara` — to porzucona wcześniejsza
iteracja, nie wariant.

### D5 — Gałąź auto-zatwierdzania: 3c liczy decyzję, 3d dowozi efekty

3c wylicza mapę zmian `AP` i inkrementuje `autoZatwierdzone`/`bezZmian` dokładnie jak oryginał,
ale **nie wykonuje** `updateProduct`, wpisu do `historia_cen` ani `applyDims`/`applyLinkMemory`.
Miejsce na efekty jest jedno i jawnie oznaczone dla 3d.

Powód: warunek `else if (Object.keys(AP).length > 0)` jest częścią **klasyfikacji**, a nie
efektu — bez niego pozycje ze zmianą samej ceny wpadałyby w `bezZmian` i dwa liczniki kontraktu
HTTP rozjechałyby się z produkcją, a gate treści musiałby je wyłączyć z porównania.

### D6 — `Gq()` zostaje przepuszczającym stubem (decyzja zaklepana w roadmapie)

`pozycja` = wejście, `naruszono: []`, `srcVals: {}`, w jednym jawnie oznaczonym miejscu.
Skutek do odnotowania: ostrzeżenie „plik nadpisuje poprawkę Marty", gałąź `_srcConflict`
w `snapshotJson` i składnik `powod` o konflikcie z Martą **nie powstaną do czasu 3d**.

Konsekwencja dla charakteryzacji: oryginał w harnessie też musi dostać `getOverridesFor → []`,
żeby porównanie było uczciwe. Harness wystawia to jako jeden przełącznik, który 3d przestawi.

Odnotowane wejście dla 3d: sama logika `Gq` (:47319) jest prostsza, niż zakładano — całą
zawiera 30 linii i jedno zapytanie `SELECT * FROM manual_overrides WHERE supplier_kod = ? AND
supplier_product_id = ?`. Kosztem 3d jest nie `Gq`, tylko warstwa wokół niej.

### D7 — Bezpiecznik pustego wejścia przenosimy DO `tk()` (rozszerzenie odstępstwa D4 z 3b)

Dziś odstępstwo „0 rekordów z parsera → 400, bez zapisu" siedzi w `przetworzBufor`
(`routes/import.ts`) i nie zakrywa `POST /api/staging/import` (:48502-48512), który bierze
pozycje wprost z ciała żądania. 3c przepisuje `tk()`, więc bezpiecznik ląduje w miejscu
zakrywającym wszystkie trzy wejścia naraz — także trasę, która powstanie dopiero w 3d.

To **świadome odstępstwo od oryginału**, rozszerzone teraz na cały silnik: produkcja puszcza
pusty wsad do `tk()`, co po trzech przebiegach wycofuje cały katalog dostawcy (backlog #8).

### D8 — Odtwarzamy deduplikację `U.addStaging`

`U.addStaging` (:44923) **nie jest zwykłym insertem** — najpierw sprawdza
`kod = ? AND typ_zmiany = ? AND COALESCE(powod,'') = COALESCE(?,'')` i przy trafieniu zwraca
istniejący wiersz bez zapisu. `zapiszPozycjeStagingu` z 3b robi insert w pętli.

W 3b to było niewidoczne, bo `powod` był stały i pola treści puste; od 3c pozycje mają realny
`powod`, więc powtórny import tego samego cennika duplikowałby wiersze wbrew produkcji.
Uzupełniamy `zapiszPozycjeStagingu` o ten warunek. `doStagingu` zostaje długością bufora
(`c.length`), **nie** liczbą realnie wstawionych wierszy — tak jak w oryginale (:47849).

## Implementation plan

Kolejność jest celowa: **charakteryzacja powstaje PRZED wpięciem silnika**, żeby wzorzec nie był
skażony naszą implementacją.

### Krok 1 — Harness oryginału (`test/charakteryzacja/silnik/`)

- `oryginal.mjs` — wycina z `mirror/backend/index.cjs` po kotwicach tekstowych dwa fragmenty:
  helpery (od `function mm(t){if(!/^\d{13}$/…` do początku martwej `function tk`) i żywe
  `tk = function` (do `var ih=`). Skleja, dokleja wstrzykiwanie `U`/`ww`/`__BRIDGE_EXT`/`Qi`,
  ładuje jako moduł CJS. Eksportuje `zbudujOryginalnySilnik(zaleznosci)` oraz gołe
  `Zc`/`Hq`/`ZT`/`Lq`/`Kq`/`Vq`/`Xq`.
- `atrapy.mjs` — pamięciowe `U` (`listProducts`, `addStaging`, `updateProduct`, `deleteProduct`,
  `getOverridesFor`) z **wierną deduplikacją `addStaging`** i wiernym efektem ubocznym
  `updateProduct` (cena 0 → `status: "wstrzymany"`), plus dziennik wywołań; `ww.transaction`
  jako przezroczysty wrapper.
- `integralnosc.json` — sha256 obu wyciętych fragmentów + ich długości.
- Test strażnika: wycinek zgadza się z sha256; jeśli nie — komunikat mówi wprost, że mirror się
  zmienił i wzorzec wymaga przenagrania (nie „napraw test").

### Krok 2 — Nagranie wzorca (`test/charakteryzacja/silnik/*.expected.json`)

Skrypt `scripts/charakteryzacja-silnik-nagraj.mjs` (wzorowany na 3a):
- dla każdego dostawcy MO1–MO10: parsuje próbkę przez port 3a (`parsujPlik`), pobiera katalog
  tego dostawcy z `db/snapshot.db`, uruchamia **oryginalny** `tk()` na atrapach;
- zapisuje: wiersze przekazane do `addStaging`, komplet 10 liczników, skasowane `products.id`,
  resety `nieobecnoscPodRzad`, `getOverridesFor → []`;
- `utworzono` normalizowane do stałej (jeden znacznik na przebieg — porównujemy stałość, nie wartość).

### Krok 3 — Funkcje pomocnicze silnika (`src/import/silnik/`)

Port 1:1 z żywego oryginału, nazwy po polsku, terminy domenowe kontraktu bez zmian:

- `ean.ts` — `mm` → `poprawnaSumaKontrolnaEan13`, `zq` → `rozwinNotacjeNaukowa`,
  `ZT` → `normalizujEan` (z odtworzonym D3)
- `rozmiar.ts` — `bn`, `YT` → `parametryZRozmiaru`, `JT` → `wytnijRozmiarZNazwy`,
  `ek` → `wymiaryZRozmiaru`
- `klasyfikator.ts` — `Zc` → `czyOpona` + słowniki `qq`/`Mq`/`Fq`/`$q`
- `pozycja.ts` — `Hq` → `znormalizujPozycje`, `Kq` → `bladZapisuNazwy`,
  `Vq` → `POLA_ROZNIC`, `Xq` → `wartosciRowne`, `Lq(:47312)` → `identyfikatorTechniczny`
- `overrides.ts` — `Gq` → `zastosujPoprawkiMarty` (stub D6, jedno oznaczone miejsce)

Test charakteryzacyjny funkcji pomocniczych: każda porównana z oryginałem na wejściach
wyciągniętych z realnych cenników i z `db/snapshot.db`.

### Krok 4 — Repozytoria

- `src/repos/products.ts`: `katalogDoImportu(db, dostawca)` (pełne wiersze, użytek wewnętrzny —
  nie przez projekcję kontraktową), `aktualizujProdukt` (z wiernym efektem ubocznym ceny 0),
  `usunProdukt`
- `src/repos/staging.ts`: deduplikacja w `zapiszPozycjeStagingu` (D8)

### Krok 5 — Wymiana ciała `tk()` (`src/import/tk.ts`)

`silnikStagingu(db)` w miejsce `silnikStagingu3b(db)`. Typ `SilnikStagingu`, 10 liczników i
przeportowany filtr śmieci MO2 **zostają bez zmian**. Kolejność wykonania dokładnie jak
:47598-47850. Poza zakresem, w jawnie oznaczonych miejscach: efekty auto-zatwierdzania (D5),
cała pętla wycofań (:47807-47847), realne overrides (D6). Bezpiecznik pustego wejścia na wejściu
funkcji (D7); usunięcie duplikatu bezpiecznika z `routes/import.ts`.

### Krok 6 — Gate treści

`test/silnik.gate.test.ts` — realny import pliku z `probki/` przez `POST /api/import/parse-file`
do prawdziwej bazy zasianej katalogiem z `db/snapshot.db`, potem odczyt wierszy `staging_items`
i porównanie **pole po polu**. Scenariusze wymagane przez roadmapę: nowy · po kodzie · po EAN ·
po EAN znormalizowanym · zastępczy `Lq()` · nie-opona z kasowaniem produktu · konflikt EAN ·
błędny zapis nazwy · `typZmiany: "blad"` · pusty wynik (bezpiecznik).

## Testing strategy

| Warstwa | Co dowodzi | Jak |
|---|---|---|
| **Charakteryzacja silnika (nowa, główny dowód)** | nasz `tk()` == oryginalny `tk()` | uruchomienie obu na tych samych realnych cennikach i realnym katalogu, porównanie pole po polu: wiersze stagingu, 10 liczników, kasowania, resety |
| **Charakteryzacja funkcji pomocniczych (nowa)** | `Zc`/`ZT`/`Hq`/`Kq`/`Xq`/`Lq` == oryginał | wejścia z realnych cenników i `snapshot.db` |
| **Strażnik integralności (nowy)** | wzorzec pochodzi z niezmienionego mirrora | sha256 wyciętych fragmentów `mirror/backend/index.cjs` |
| **Gate treści (nowy)** | pełna ścieżka HTTP → `staging_items` | realny import, 10 scenariuszy, porównanie pole po polu |
| **GATE fixtures 3b** | kontrakt odczytu nie ruszony | `GET_staging.json`, `GET_staging_paged.json` bez zmian w testach |
| **GATE I2** | katalog nie ruszony | `katalog.gate.test.ts` bez zmian w samym teście |
| **Charakteryzacja 3a** | port parserów nie ruszony | 1838 rekordów, sha256 |
| `lint` / `typecheck` / `build` / `test` | — | `rebuild/backend/` |

Świadomie **wyłączone z porównania z oryginałem** (poza zakresem 3c, każde z nazwanym powodem
i wypisane w raporcie): wiersze `typZmiany: "wycofana"` i licznik `wycofane`; wynikający z nich
`doStagingu`; mutacje produktów z gałęzi auto-zatwierdzania; wszystko, co zależy od realnych
overrides. Testy używają bazy w katalogu tymczasowym i portów efemerycznych — bez zmian.

## Out of scope

Auto-zatwierdzanie (efekty) i `historia_cen`, wycofanie po 3 nieobecnościach, realne overrides
`Gq()`, `acceptStaging`, port `bridge_ext.cjs`/`tire_dims.js`, `assignKodImportu`, endpointy
mutacji stagingu (`accept`/`reject`/`import`/`clear`) — **3d**. Widok `/staging` — **3e**.
`products.szerokosc` REAL→TEXT — **3d/I12**. Reguła auto-aktualizacji EAN — nie wchodzi nigdzie
(D4, martwy kod).

## Definition of done

- [ ] Silnik odtwarza dopasowanie i klasyfikację 1:1 z żywym `tk()` (:47584)
- [ ] Charakteryzacja przeciw uruchomionemu oryginałowi zielona na realnych cennikach MO1–MO10
- [ ] Strażnik sha256 wyciętych fragmentów mirrora działa i jest opisany
- [ ] Gate treści zielony — 10 scenariuszy, porównanie pole po polu
- [ ] `GET_staging.json` i `GET_staging_paged.json` dalej zielone
- [ ] Charakteryzacja 3a (1838 rekordów, sha256) dalej zielona
- [ ] GATE I2 (`katalog.gate.test.ts`) zielony bez zmian w samym teście
- [ ] `lint` / `typecheck` / `build` / `test` czyste
- [ ] Strategia portu i sposób budowy wzorca opisane w raporcie wraz z uzasadnieniem
- [ ] Błąd cieniowania `Lq` (D3) zgłoszony do `docs/rebuild-backlog.md`
- [ ] `docs/spec-backend.md` §5 sprostowana w punkcie reguły EAN (D4)
- [ ] Roadmapa zaktualizowana wg §3: blok 3c zamknięty (stan, nie zamiar), ustalenia wpisane
      DO bloków 3d/3e
