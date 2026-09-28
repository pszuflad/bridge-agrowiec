# 6-FEATURE-silnik-tk-dopasowanie-klasyfikator — raport z implementacji

## Podsumowanie

Silnik importu `tk()` przepisany z zminifikowanego oryginału do czytelnego TypeScriptu
(`src/import/silnik/` + `src/import/tk.ts`) i wpięty w miejsce świadomie niewiernego szwu z 3b.
Dowodem wierności nie jest skrót kopii, tylko **równoważność zachowania z uruchomionym
oryginałem**: żywe `tk()` da się wyciąć z `mirror/backend/index.cjs` i wykonać na atrapach
warstwy danych, więc wzorzec charakteryzacji pochodzi z prawdziwego kodu produkcji, a nie
z naszej lektury.

Gate: **286 testów zielonych** (było 273), w tym 33 nowe testy charakteryzacji silnika
i 11 testów gate'u treści. Charakteryzacja porównuje pole po polu 340 wierszy `staging_items`
powstałych z 1838 realnych rekordów cennikowych na katalogu 7405 produktów ze zrzutu produkcji.
Skuteczność gate'u zweryfikowana sześcioma celowymi mutacjami — każda została złapana.

## Zmiany

**Nowe — silnik (kod produkcyjny):**
- `src/import/silnik/ean.ts` — port `mm()`, `zq()`, `ZT()`: suma kontrolna EAN-13, rozwijanie
  notacji naukowej, normalizacja EAN do `eanRaw`/`eanIsValid`/`eanSourceStatus`/`eanCandidates`
- `src/import/silnik/rozmiar.ts` — port `bn()`, `YT()`, `JT()`, `ek()`: rozbiór rozmiaru opony,
  wycięcie rozmiaru z nazwy, wyliczenie wymiarów
- `src/import/silnik/klasyfikator.ts` — port `Zc()` + słowniki `qq`/`Mq`/`Fq`/`$q` („czy opona")
- `src/import/silnik/pozycja.ts` — port `Hq()` (normalizacja), `Kq()` (błędny zapis nazwy),
  `Vq` (etykiety różnic), `Xq()` (porównanie wartości)
- `src/import/silnik/identyfikator.ts` — port `Lq()` (`:47312`), identyfikator sha1
- `src/import/silnik/overrides.ts` — `Gq()` jako przepuszczający stub (D6), jedyne świadomie
  niepełne miejsce w sesji

**Zmienione:**
- `src/import/tk.ts` — `silnikStagingu3b()` → `silnikStagingu()`: pełny port żywego `tk()`.
  Typ `SilnikStagingu`, 10 liczników i filtr śmieci MO2 bez zmian. Dodany `PustyImportBlad` (D7).
- `src/repos/products.ts` — `katalogDoImportu()`, `aktualizujProdukt()` (z efektem ubocznym
  ceny 0 → `status: "wstrzymany"`), `usunProdukt()`, typ `ProduktWewnetrzny`
- `src/repos/staging.ts` — `zapiszPozycjeStagingu()` dostał deduplikację z `U.addStaging` (D8)
- `src/routes/import.ts` — wstrzykuje nowy silnik; bezpiecznik pustego wejścia zamieniony
  na tłumaczenie `PustyImportBlad` → 400
- `test/import.test.ts` — trzy asercje z 3b zakładały „wierszy stagingu = rekordów z parsera";
  od 3c silnik realnie klasyfikuje, więc równość wyprowadzana jest z liczników kontraktu.
  Dołożony test regresji na deduplikację (dwukrotny import tego samego cennika).

**Nowe — dowód:**
- `test/charakteryzacja/silnik/oryginal.mjs` — wycięcie żywego `tk()` i helperów
  z `mirror/backend/index.cjs` po kotwicach tekstowych, ładowanie z wstrzykniętymi atrapami
- `test/charakteryzacja/silnik/atrapy.mjs` — pamięciowe `U`/`ww`/`__BRIDGE_EXT`
- `test/charakteryzacja/silnik/wzorzec.mjs` — wspólna normalizacja wzorca
- `test/charakteryzacja/silnik/scenariusze.mjs` — 18 scenariuszy celowanych w gałęzie
- `test/charakteryzacja/silnik/*.expected.json` + `katalog/*.katalog.json` — nagrany wzorzec
- `scripts/charakteryzacja-silnik-nagraj.mjs` — nagrywarka
- `test/silnik.charakteryzacja.test.ts` — 33 testy: integralność, cenniki, scenariusze, przydatność
- `test/silnik.gate.test.ts` — 11 testów gate'u treści przez HTTP

## Odstępstwa od planu

**Brak odstępstw od zatwierdzonych decyzji D1–D8.** Trzy rzeczy dopracowane w trakcie,
wszystkie w duchu planu:

1. **Wzorzec ma dwie warstwy, nie jedną.** Plan zakładał charakteryzację na realnych cennikach.
   Po nagraniu okazało się, że MO1–MO10 dają **zero** wierszy `blad`, zero kasowań nie-opony
   i zero konfliktów EAN — te gałęzie istnieją w produkcji, ale nie w tych dziesięciu plikach.
   Dołożona druga warstwa: 18 scenariuszy celowanych, też **bez ręcznie pisanych oczekiwań** —
   przechodzą przez ten sam uruchomiony oryginał.
2. **Katalog wzorca jest projekcją kolumn, a nie pełnym wierszem.** Pełne wiersze to 10 MB
   w repo na zawsze. Zapisujemy 29 kolumn zamiast 72, ale **kompletność projekcji jest
   weryfikowana maszynowo**: nagrywarka puszcza oryginał dwa razy — na pełnym i na przyciętym
   katalogu — i wymaga identycznego wyniku. Gdyby projekcja gubiła pole czytane przez silnik,
   nagranie padnie. Rozmiar wzorca: 4,9 MB.
3. **Granicę faz 3c/3d trzeba było wyznaczyć obserwacją.** Reset `nieobecnoscPodRzad` przy
   dopasowaniu (zakres 3c) jest po kształcie NIEODRÓŻNIALNY od resetu z pętli wycofań przy
   trzeciej nieobecności (zakres 3d) — oba to `updateProduct(id, { nieobecnoscPodRzad: 0 })`.
   Rozwiązane bez dotykania kodu oryginału: atrapa liczy, ile razy `tk()` przeszło po liście
   produktów; drugie przejście to początek pętli wycofań. Atrapa asertuje, że przejść jest
   dokładnie dwa — gdyby układ pętli w bundlu się zmienił, nagranie padnie zamiast po cichu
   przypisać efekty do złej sesji.

## Ustalenia o oryginale, które zmieniają dokumentację

### U1. Duplikaty `Lq`/`tk` są REALNE w wysłanym bundlu, nie artefaktem naszej deminifikacji

`CLAUDE.md` ostrzegał przed dwiema definicjami, ale nie mówił, skąd się biorą. esbuild nigdy
nie wyemitowałby dwóch deklaracji tej samej nazwy w jednym zakresie (przy kolizji zmienia
nazwę). Sprawdzone w `mirror/backend/index.cjs`: obie deklaracje `Lq` i obie `tk` są tam
fizycznie, w tym samym zakresie. Źródłem są **łatki `patch_*.cjs` doklejane do `index.cjs`
po buildzie** — w `mirror/backend/` jest ich kilkanaście (`patch_szertxt.cjs`,
`patch_index_kodimportu.cjs`, `patch_reject_mo2.cjs`…). To wyjaśnia mechanizm i pozwala
przewidywać kolejne takie przypadki.

### U2. `ZT()` woła `Lq()` z sha1, nie licznik cyfr — żywy błąd produkcji (D3)

Skoro obie definicje są w jednym zakresie, wygrywa późniejsza (`:47312`, sha1) — także dla
wywołania `Lq(i)` **wewnątrz `ZT()`** (`:46987`), które miało trafić w licznik cyfr znaczących.
Wywołana z jednym argumentem funkcja sha1 zawsze zwraca `null`, więc warunek `a < 13` jest
zawsze prawdziwy i komunikat brzmi dosłownie:

```
zapis naukowy ma tylko null cyfr znaczących — EAN niepewny
```

**Potwierdzone uruchomieniem oryginału**, nie odczytem: scenariusz `ean-notacja-naukowa`
w nagranym wzorcu. Tekst trafia do `staging_items.ostrzezenie` i `powod`, czyli **jest widoczny
dla Ani** (3e). Odtworzone 1:1 zgodnie z decyzją D3; zgłoszone do `docs/rebuild-backlog.md` (#11).

**Zasięg jest dziś WĘŻSZY, niż wynikałoby z samego kodu — i to trzeba powiedzieć wprost.**
W nagranym wzorcu (340 wierszy, 1838 rekordów) ta gałąź nie odpaliła **ani razu**:
`eanSourceStatus` to `ok` w 334 wierszach, `null` w 5, `no_valid_candidate` w 1. Powód:
dziewięć z dziesięciu parserów woła `common.normalizeEan()` **przed** silnikiem, więc do `ZT()`
trafiają już same cyfry albo `null`. Dziesiąty (MO8 Trelleborg, `mo8_trelleborg.cjs:251-256`)
przepuszcza wartość surową, ale przy pliku XLSX arkusz oddaje EAN jako LICZBĘ, nie jako
„8,05997E+12".

Gałąź staje się osiągalna w dwóch sytuacjach: **MO8 dostarczony jako CSV** (scenariusz
z backlogu #8, gdzie Excel zapisuje EAN tekstem w notacji naukowej) oraz
**`POST /api/staging/import`** (3d), który bierze pozycje wprost z ciała żądania, z pominięciem
parserów. Błąd jest więc realny i uzbrojony, ale dziś uśpiony na ścieżce plikowej.

Kod portu woła tę samą funkcję z jednym argumentem, zamiast wpisywać `null` na sztywno —
żeby mechanizm był widoczny tam, gdzie działa.

### U3. Reguła auto-aktualizacji EAN jest w MARTWYM kodzie — spec się myli (D4)

`docs/spec-backend.md` §5 i `docs/incoming/backend-perplexity/backend_doc/03_IMPORT_tk.md`
podają jako obowiązującą regułę: „EAN auto-zmieniany tylko dla długości 8/12/13/14 i nie
kończący się pięcioma zerami". Ta reguła istnieje **wyłącznie w martwej `function tk`**
(`:47499-47512`). Żywy `tk` (`:47584`) buduje auto-patch tylko z
`cenaZakupu`/`cenaSprzedazy`/`marzaPct`/`stan`/`magazyn` i **nigdy nie ustawia `AP.ean`** —
produkcja nie aktualizuje EAN istniejącego produktu przy imporcie.

Nie zaimplementowana. `docs/spec-backend.md` §5 zostaje sprostowana w tym tickecie (faza docs).
`docs/incoming/backend-perplexity/backend_doc/03_IMPORT_tk.md` **zostaje bez zmian** — to materiał
źródłowy od Perplexity, którego nie redagujemy; sprostowanie mieszka w naszej specyfikacji.
Martwa `function tk` różni się od żywej
także dopasowaniem (brak mapy EAN i `conflictEans`), składem `_KP` i liczeniem
`cenaZakupuStara` — to porzucona wcześniejsza iteracja, nie wariant.

### U4. `U.addStaging` deduplikuje — 3b tego nie miała (D8)

`U.addStaging` (`:44923`) sprawdza `kod = ? AND typ_zmiany = ? AND COALESCE(powod,'') = COALESCE(?,'')`
i przy trafieniu zwraca istniejący wiersz **bez zapisu**. W 3b było to niewidoczne, bo `powod`
był stały; od 3c wiersze mają realny `powod`. Potwierdzone na danych: **próbka MO2 zawiera dwa
powtórzone kody**, więc oryginał raportuje `doStagingu: 200`, a zapisuje 198 wierszy —
`doStagingu` liczy BUFOR, nie zapisy (`:47850`). Nasz port zachowuje się identycznie.

### U5. `d.eanIsValid === false` jest w praktyce martwe

`Hq()` zapisuje w tym polu **1 albo 0**, nigdy boolean (`:47357`). Warunki `d.eanIsValid === false`
w klasyfikatorze `nowa`/`blad` (`:47712`) i `_cb` (`:47758`) nigdy nie wypalają. To dlatego
niepoprawny EAN sam z siebie nie robi z pozycji `blad` — robi to dopiero ostrzeżenie o EAN-ie
przez inną ścieżkę. Odtworzone dosłownie, oznaczone komentarzem.

### U6. Uzupełnienie pustego pola NIE jest raportowane jako różnica

Pętla po `Vq` (`:47746`) pomija przypadek „stara wartość pusta, nowa niepusta". Klasyfikację
i tak wywołuje, jeśli pole jest w `_KP`, ale w `powod` różnica się nie pojawia. Wygląda jak
błąd, jest zachowaniem oryginału — pokryte w gate'cie treści.

### U7. Ścieżka plikowa nie umie wejść w gałąź identyfikatora zastępczego

Adapter (`legacy/parsers/adapter.cjs`, port 3a) **sam nadaje `kod`** każdemu rekordowi — z EAN-u
albo z własnego syntetycznego skrótu. Dlatego `Lq()` i ostrzeżenie „użyto EAN jako identyfikatora"
są przez `POST /api/import/parse-file` **nieosiągalne**. Wejdą dopiero z `POST /api/staging/import`
(3d), który bierze pozycje wprost z ciała żądania. To ustalenie, nie luka — obie gałęzie są
pokryte scenariuszami charakteryzacji, które karmią silnik bezpośrednio.

## Wyniki testów

**Gate odbudowy (fixtures/kontrakt): ✓ zgodne.**
- `contract/fixtures/GET_staging.json` i `GET_staging_paged.json` — zielone, bez zmian w testach
  (`test/staging.gate.test.ts`). 3c nie rusza kształtu odpowiedzi, tylko treść danych.
- `contract/fixtures/GET_products.json` — GATE Iteracji 2 (`test/katalog.gate.test.ts`) zielony
  **bez żadnej zmiany w samym teście**, mimo że silnik dostał prawo kasować i aktualizować produkty.
- Ścieżki `openapi.yaml`: `GET /api/staging`, `/paged`, `/{id}`, `POST /api/import/parse-file`,
  `/from-url` — walidacja kontraktu zielona. Zestaw 10 liczników w ciele odpowiedzi bez zmian.

**Charakteryzacja 3a: ✓ zielona** — 1838 rekordów, sha256 port↔mirror bez zmian.

**Charakteryzacja silnika 3c (nowa, główny dowód): ✓ 33 testy.**

| Dostawca | Rekordów | Katalog | Wierszy | nowe | zmienione | nie-opony | auto | bezZmian |
|---|---|---|---|---|---|---|---|---|
| MO1 | 199 | 657 | 35 | 9 | 26 | 0 | 162 | 2 |
| MO2 | 200 | 1729 | 35 | 3 | 32 | 0 | 17 | 148 |
| MO3 | 44 | 631 | 12 | 3 | 9 | 0 | 3 | 29 |
| MO4 | 101 | 423 | 34 | 6 | 28 | 0 | 22 | 45 |
| MO5 | 146 | 1989 | 18 | 4 | 14 | 0 | 62 | 66 |
| MO6 | 2 | 0 | 2 | 2 | 0 | 0 | 0 | 0 |
| MO7 | 285 | 271 | 17 | 0 | 25 | 0 | 0 | 260 |
| MO8 | 626 | 624 | 165 | 1 | 164 | 1 | 0 | 460 |
| MO9 | 12 | 861 | 12 | 3 | 9 | 0 | 0 | 0 |
| MO10 | 223 | 220 | 10 | 7 | 3 | 0 | 17 | 196 |

Porównanie pole po polu: 21 pól × 340 wierszy, plus 9 liczników, plus zbiór skasowanych
produktów i zbiór resetów `nieobecnoscPodRzad` — każdy przebieg osobno.

**Scenariusze celowane: ✓ 18** — `nowa` · po kodzie · po EAN · po EAN znormalizowanym ·
identyfikator zastępczy `Lq()` · nie-opona z kasowaniem produktu · konflikt EAN · błędny zapis
nazwy · brak rozmiaru · wiele ostrzeżeń naraz · EAN w notacji naukowej (dowód U2) ·
EAN nieczytelny · śmieci MO2 · brak identyfikatora i danych · bez zmian · decyzja
auto-zatwierdzenia · reset nieobecności · deduplikacja `addStaging`.

**Gate treści (nowy, główny dowód sesji): ✓ 11 testów.** Realny import przez
`POST /api/import/parse-file` na cenniku w prawdziwym formacie Bohnenkampa, przez prawdziwy
parser, do prawdziwego SQLite z zasianym katalogiem. Porównanie wierszy `staging_items` pole
po polu z oryginałem uruchomionym na tym samym wejściu i tym samym katalogu (odczytanym z tej
samej bazy), plus czytelne asercje na każdy scenariusz osobno. Pokryte: nowa · po kodzie ·
po EAN · po EAN znormalizowanym · konflikt EAN · błędny zapis nazwy · `typZmiany: "blad"` ·
nie-opona z kasowaniem produktu · reset nieobecności · jeden znacznik `utworzono` ·
pusty wynik (bezpiecznik D7).

**Skuteczność gate'u zweryfikowana mutacjami.** Sześć celowych zmian w `tk.ts`, każda złapana:

| Mutacja | Padło testów |
|---|---|
| separator ostrzeżeń `" • "` → `" \| "` | 1 |
| separator różnic w `powod` | 8 |
| tekst `"Nowa pozycja w cenniku"` | 13 |
| usunięcie kasowania nie-opony | 1 |
| usunięcie resetu `nieobecnoscPodRzad` | 5 |
| `autoZatwierdzone++` → `bezZmian++` | 7 |

Pierwsza mutacja **początkowo nie została złapana** — żaden przypadek nie miał dwóch ostrzeżeń
naraz, więc separator nigdy się nie pojawiał. Dołożony scenariusz `wiele-ostrzezen-naraz`;
po nim mutacja pada.

**Bramki:** `npm run lint` ✓ · `npm run typecheck` ✓ · `npm run build` ✓ · `npm test` ✓
(286 testów, 20 plików).

## Breaking changes

Brak w kontrakcie HTTP — kształt odpowiedzi i zestaw kluczy bez zmian.

Zmienia się **treść** danych w `staging_items`, i to jest cel sesji:
- `typZmiany` przestaje być zawsze `"nowa"` — dochodzą `blad` i `zmiana_kluczowa`
- cztery pola `ean*` przestają być NULL-em
- `snapshotJson` serializuje rekord **po** `Hq()` (z polami `ean*`, uzupełnionym rozmiarem
  i magazynem), a nie surowy `RekordSurowy`
- `powod` i `ostrzezenie` niosą realną treść

**Import może teraz USUWAĆ i AKTUALIZOWAĆ produkty w katalogu** — pozycja, która w cenniku
przestała być oponą, kasuje odpowiadający jej wiersz `products` (`U.deleteProduct`, `:47689`),
a dopasowanie zeruje `nieobecnosc_pod_rzad`. Do 3b import był wyłącznie zapisem do stagingu.
To zachowanie produkcji, ale operacyjnie nowe dla środowiska staging.

**Dane stagingu z ery 3b są niepełne** — wiersze zapisane wcześniej mają `snapshotJson` bez pól
`ean*` i `typZmiany` zawsze `"nowa"`. Przy testowaniu 3d na starych danych deweloperskich trzeba
je przeimportować, nie łatać.

## Follow-up

Świadomie odłożone, poza zakresem 3c:

1. **Efekty auto-zatwierdzania (3d).** 3c liczy decyzję i licznik `autoZatwierdzone` zgodnie
   z produkcją, ale nie wykonuje `updateProduct`, wpisu do `historia_cen` ani
   `applyDims`/`applyLinkMemory`. Jedno oznaczone miejsce w `tk.ts` (gałąź `else if`).
2. **Pętla wycofań po trzech nieobecnościach (3d).** `dopasowaneId` jest już zbierane, więc
   3d ma komplet wejścia. `statystyki.wycofane` zostaje zerem.
3. **Realne `Gq()` (3d).** Stub przepuszczający; sygnatura docelowa. Do czasu 3d nie powstaną:
   ostrzeżenie „plik nadpisuje poprawke Marty", składnik `powod` o konflikcie z Martą, gałąź
   `_srcConflict` w `snapshotJson` i udział `naruszono` w wymuszeniu `blad`.
   **Odnotowane wejście dla 3d:** sama `Gq()` (`:47319`) jest prostsza, niż zakładano — 30 linii
   i jedno zapytanie do `manual_overrides`. Kosztem 3d jest warstwa wokół niej, nie ona sama.
4. **`docs/incoming/backend-perplexity/backend_doc/03_IMPORT_tk.md` zostaje z błędną regułą EAN.**
   To materiał źródłowy od Perplexity, traktowany jak zastany — nie redagujemy go. Sprostowanie
   jest w `docs/spec-backend.md` §5 (naniesione w tym tickecie). Gdyby ktoś sięgnął po materiał
   źródłowy z pominięciem naszej specyfikacji, trafi na regułę, która w produkcji nie działa.
5. **`db/snapshot.db` jest wymagany do PRZENAGRANIA wzorca**, nie do jego weryfikacji.
   Plik jest w `.gitignore` (32 MB), więc nagrywarka przyjmuje `BRIDGE_SNAPSHOT_DB=/ścieżka`.
   Same testy czytają wyłącznie zacommitowany `test/charakteryzacja/silnik/katalog/`.
6. **Deduplikacja stagingu robi SELECT na pozycję** (`src/repos/staging.ts`) — dokładnie jak
   `U.addStaging` (`:44923`), więc port jest wierny, ale to N zapytań w transakcji. Przy dzisiejszych
   wolumenach (kilkadziesiąt wierszy na przebieg) bez znaczenia; warte uwagi w **3d**, gdy
   `POST /api/staging/import` zacznie przyjmować duże bufory wprost z ciała żądania.
7. **Wzorzec charakteryzacji zajmuje ~5 MB w repo** i będzie rósł, gdy 3d dołoży własne przebiegi
   (wycofania, overrides). Jeśli suma zacznie przeszkadzać — kompresja JSON-ów albo `git lfs`;
   dziś nie ma powodu, żeby ruszać.
8. **Backlog #3 (`szerokosc` REAL→TEXT)** nie ruszony — decyzja należy do 3d/I12, jak ustalono.
   Silnik przepuszcza `szerokosc` jako string, `products.szerokosc` pozostaje REAL; różnica
   ujawnia się dopiero przy zapisie do katalogu, czyli w `acceptStaging` (3d).

## Poprawki po review

Review nie zgłosiło ani jednego zastrzeżenia do kodu — port został przeszedł linia po linii
wobec żywego `tk()` bez znalezionego rozjazdu. Dwa BLOCKERY dotyczyły dokumentacji i zostały
zdjęte w fazie docs (niżej). Poza tym:

- **Usunięta sprzeczność w raporcie** — sekcja D4/U3 mówiła „oba dokumenty prostujemy", a
  „Follow-up" sugerował odłożenie. Doprecyzowane: `docs/spec-backend.md` §5 prostujemy w tym
  tickecie, `docs/incoming/…/03_IMPORT_tk.md` zostaje bez zmian jako materiał źródłowy.
- **Skorygowane numery linii.** Weryfikując cytaty doc-checkera znalazłem, że kilka moich
  odwołań do `deminified/backend-index.cjs` było przesuniętych o kilka wierszy. Poprawione
  w 13 plikach (kod, testy, plan, raport): `Lq(i)` w `ZT()` `:46984`→**`:46987`**, zapis
  `eanIsValid` w `Hq()` `:47355`→**`:47357`**, `d.eanIsValid === false` `:47716`→**`:47712`**,
  `_cb` `:47767`→**`:47758`**, pętla `Vq` `:47756`→**`:47746`**, `_KP` `:47762`→**`:47751`**,
  `doStagingu = c.length` `:47849`→**`:47850`**, budowa `AP` `:47768-47772`→**`:47760-47764`**,
  gałąź auto-zatwierdzania `:47788-47806`→**`:47791-47806`**, martwa reguła EAN
  `:47503-47512`→**`:47499-47512`**. Wzorzec charakteryzacji przenagrany, testy zielone.
  W projekcie, w którym numery linii są nośne, to nie jest kosmetyka.
- **Sprawdzone, a NIE zmienione:** roadmapa cytuje `assignKodImportu` „w `addProductsBulk`
  (`:44746`) i `acceptStaging` (`:44827`)". Wygląda na rozjazd wobec faktycznych miejsc wywołania
  (`:44791`, `:44903`), ale `:44746`/`:44827` to linie DEFINICJI tych funkcji — zapis jest
  poprawny w swoim znaczeniu. Zostawione bez zmian.
- **SHOULD-FIX z review** (N zapytań w dedupie stagingu, ~5 MB wzorca w repo) — oba świadomie
  przyjęte, zapisane jako follow-up 6 i 7. Review sam nie prosił o zmianę.
- **NICE-TO-HAVE z review** (zbędny `SELECT` po `UPDATE` w `aktualizujProdukt`) — zostawione.
  `U.updateProduct` w oryginale (`:44738`) też zwraca zaktualizowany wiersz; port zachowuje
  ten kontrakt, mimo że dzisiejszy wołający go ignoruje.

## Aktualizacja dokumentacji

### `docs/rebuild-roadmap.md`
Blok 3c zamknięty (✅, ticket + PR + 2026-08-26), zaktualizowana §4 Tablica postępu i nagłówek
Iteracji 3. Opis 3c przepisany na stan **faktycznie dowieziony**; usunięta błędna pozycja zakresu
o regule EAN i zwinięta skonsumowana sekcja „Wejście z 3b". Do bloku **3d** dopisana sekcja
„⚠ Wejście z 3c" (11 punktów: oznaczone punkty podmiany, stan bezpiecznika, deduplikacja
`addStaging`, mutacje katalogu przez import, martwe `eanIsValid === false`, osiągalność gałęzi
`Lq()` dopiero przez `POST /api/staging/import`, sposób przenagrania wzorca). Do bloku **3e**
wpisany realny stan danych stagingu i lista komunikatów, które UI ma pokazywać. Naprawione dwa
martwe cross-referencje.

### `docs/rebuild-backlog.md`
Wpis **#11** (błąd cieniowania `Lq`) — nowy. Zaktualizowane: **#3** (3c nie rusza schematu,
decyzja o typie kolumny nadal 3d/I12), **#4** (`uwagaCena` przechodzi przez `snapshotJson`,
materiał dla `acceptStaging` gotowy), **#8** (bezpiecznik domknięty w 3c, zakrywa też przyszły
`POST /api/staging/import`; dopisane powiązanie z #11 — MO8 jako CSV to scenariusz, w którym
błąd #11 realnie odpala). Procedura re-synchronizacji rozszerzona o **drugą warstwę wzorca**
(silnik) i jej strażnik integralności. #6, #9, #10 zweryfikowane bez zmian.

### `docs/spec-backend.md`
§5 sprostowana: usunięta nieprawdziwa reguła auto-aktualizacji EAN (martwy kod), uzupełniony
pominięty trzeci krok dopasowania (po EAN znormalizowanym, `:47698`), doprecyzowany zakres 3c
przy `Gq()`, auto-zatwierdzaniu i wycofaniach, zweryfikowane miejsca wywołania
`assignKodImportu`. Dodane trzy ustalenia z charakteryzacji (dedup `addStaging`, martwe
`eanIsValid === false`, pomijanie „stara pusta → nowa niepusta" w `powod`) oraz nota
„Odbudowa (3c)".

### `CLAUDE.md`
Punkt 5 o duplikatach uzupełniony o **mechanizm** (łatki `patch_*.cjs` doklejane po buildzie,
nie artefakt deminifikacji), **sposób wykrywania** (liczyć `function <nazwa>(` w mirrorze,
nie ufać numerowi linii) i **przykład cieniowania sięgającego poza samą funkcję** (`ZT()` → `Lq`).

### Bez zmian
`docs/plan.md`, `docs/audit-delta.md`, `docs/spec-frontend.md` — sprawdzone, nie zawierają
treści zdezaktualizowanej przez 3c (opisują produkcję albo stan sprzed startu odbudowy).
