# 7-FEATURE-silnik-zatwierdzanie-wycofania-overrides — Iteracja 3, sesja 3d-1 (SILNIK)

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `feature/7-silnik-zatwierdzanie-wycofania-overrides`
> Worktree: `.worktrees/7-FEATURE-silnik-zatwierdzanie-wycofania-overrides`

## Opis ticketa

> Iteracja 3, sesja 3d-1 (SILNIK) — port bridge_ext/tire_dims, efekty auto-zatwierdzania
> + historia_cen, wycofania po 3 nieobecnościach, realne Gq() + manual_overrides,
> szerokosc REAL→TEXT

Blok 3d roadmapy (`docs/rebuild-roadmap.md` §5) został **podzielony na dwie sesje**
(decyzja użytkownika, patrz D0). Ten ticket to **3d-1 — SILNIK**: wszystko, co dzieje się
wewnątrz `tk()`. Brzeg HTTP (`acceptStaging` + 8 endpointów) idzie osobno jako **3d-2 — API**.

## Kontekst

3c (PR #11) dowiozła dopasowanie i klasyfikację, zostawiając w `src/import/tk.ts` **dwa jawnie
oznaczone punkty podmiany** i jeden przepuszczający stub. 3d-1 domyka silnik: decyzje, które 3c
tylko liczy, zaczynają mieć skutki.

Stan wejściowy, potwierdzony przed napisaniem planu:

- `src/import/tk.ts:506-515` — gałąź `else if (Object.keys(autoPatch).length > 0)` liczy
  `statystyki.autoZatwierdzone`, ale nie wykonuje `aktualizujProdukt` / wpisu do `historia_cen`
  / `applyDims`+`applyLinkMemory`.
- `src/import/tk.ts:518-523` — miejsce po pętli głównej; `dopasowaneId` już zbierane,
  `statystyki.wycofane` zostaje zerem.
- `src/import/silnik/overrides.ts` — `zastosujPoprawkiMarty()` to przepuszczający stub
  z **docelową sygnaturą** (`{pozycja, naruszono, srcVals}`).
- Wszystkie tabele są w kanonie: `historia_cen` (`001_schema.sql:231`), `manual_overrides`
  (`:111`), `link_pamiec_kod`/`link_pamiec_mr` (`:297-298`), `nazwa_pamiec` (`:313`),
  `waga_pamiec` (`:319`). **Żadnej migracji dla tego zakresu nie trzeba** — zweryfikowane.
  Wszystkie mają też odpowiedniki w `src/db/schema.ts` (`historiaCen:277`,
  `manualOverrides:137`, `linkPamiecKod:374`, `linkPamiecMr:380`, `nazwaPamiec:400`,
  `wagaPamiec:407`).
- Harness charakteryzacji z 3c (`test/charakteryzacja/silnik/`) jest rozszerzalny dokładnie
  tam, gdzie trzeba: `stworzAtrapy({produkty, overrides})` ma już parametr `overrides`
  (`atrapy.mjs:23` — „ten jeden przełącznik, który przestawi 3d"), `__BRIDGE_EXT` jest atrapą
  no-op, `ww.prepare` zwraca no-op `run`, a `wzorzec.mjs` ma jawną sekcję `pozaZakresem3c`
  odsiewającą wiersze `wycofana`, licznik `wycofane` i zapisy auto-zatwierdzania.
- `db.$client` (drizzle-orm 0.45.2) zwraca surowy uchwyt `better-sqlite3` — sprawdzone
  empirycznie. `bridge_ext` dostanie ten uchwyt, tak jak w oryginale dostaje `Qi`.

### Korekty do roadmapy wniesione przez lekturę (fakty, nie decyzje)

Roadmapa i prompt zakładały kilka rzeczy, które lektura źródeł obaliła. Zapisane tu, bo
Krok 13 ma je nanieść na `docs/rebuild-roadmap.md`:

1. **`bridge_ext` jest wołany w 7 z 11 eksportów, nie w 3.** Prompt wymieniał `applyDims`,
   `applyLinkMemory`, `assignKodImportu`. Realnie `acceptStaging` (`:44900-44905`) woła
   dodatkowo `applyNazwaPamiec`, `applyWagaPamiec` i `rememberLink`, a `addProductsBulk`
   (`:44786-44797`) ten sam zestaw. Ma to bezpośredni wpływ na decyzję D2 (port całości).
2. **Lista endpointów 3d jest krótsza o cztery.** Roadmapa wymienia 4 mutacje stagingu
   + „`GET /api/overrides`, `PUT/DELETE /api/overrides/{id}`". Zamrożony kontrakt i żywy kod
   zgodnie mówią co innego: overrides to `GET /api/overrides` + **`POST /api/overrides`**
   (upsert bez id, `:48650`) + `DELETE /api/overrides/{id}` (`:48675`) — **`PUT` nie istnieje**.
   Do tego kontrakt zamraża `PUT /api/staging/{id}` (`openapi.yaml:1125`) i
   `DELETE /api/staging/{id}` (`:1105`), których roadmapa nie wymienia wcale. Razem **8**, nie 4.
   `PUT /api/staging/{id}` (`:48597-48645`) jest przy tym **jedyną ścieżką, która TWORZY
   poprawki Marty** — 3e (edycja w widoku `/staging`) bez niej nie ma czego wołać.
3. **`acceptStaging` sięga do Iteracji 4.** Woła `__bridgePickMarkup`/`__bridgePickPromo`
   (`:44884-44892`) — narzuty i promocje. W I3 obie tabele są puste (brak endpointów do ich
   wypełnienia), więc gałąź `if (__mm || __pp)` nigdy nie wchodzi i zachowanie jest identyczne
   z pominięciem bloku. To jednak **jawna luka do zapisania w bloku 3d-2 i I4**, nie cicha.
4. **Backlog #3: poprawka u Ani JEST kompletna** — wbrew założeniu w bloku 3d roadmapy
   („dziś `szertxt` jest niekompletny”). `tyre_params.cjs:288-298` nadpisuje `result.szerokosc`
   stringiem 1:1 z rozmiaru (`"10.00"`, `"14.9"`, `"800"`). `parseWidthFallbackMm()` istnieje
   i dalej zwraca liczbę w mm, ale odpala się **wyłącznie** gdy `parseSize` nie wykrył
   szerokości (`:520`, `:1069`) — to resztka, nie brak poprawki. Nasz port 3a jest
   bajt-w-bajt identyczny z mirrorem, więc **już dziś emitujemy stringi**. Patrz D3.
5. **Piąte pytanie promptu (auto-accept lokalnie czy przez API) jest rozstrzygnięte faktem,
   nie preferencją.** `docs/spec-frontend.md` §4 mówi: „instrukcja v5 zakłada ręczną obsługę,
   kod auto-przyjmuje zmiany ceny/stanu" — czyli o rozjeździe *instrukcji* z *kodem*, a nie
   o liczeniu czegokolwiek w przeglądarce. Auto-zatwierdzanie to gałąź `else if` w **backendowym**
   `tk()` (`:47791`), którą 3c już przeportowała. Bundle frontendu woła `staging/accept` (API)
   i nie zawiera ani `autoZatwierdzone`, ani żadnej lokalnej logiki auto-akceptacji
   (grep: 0 trafień). Wniosek do §3: **auto-accept jest backendowy, UI go nie liczy,
   przestarzała jest instrukcja v5.**

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ten ticket nie dodaje ani nie zmienia żadnej ścieżki API.** Cały zakres 3d-1 siedzi
wewnątrz `tk()` i warstwy repozytoriów. Gate kontraktowy obowiązuje jednak w trybie
**regresji** — zmiana schematu z D3 dotyka `GET /api/products`:

| Ścieżka / fixture | Rola w tym tickecie |
|---|---|
| `GET /api/products` · `GET_products.json` | **regresja + jedno zadeklarowane odstępstwo** (D3): `szerokosc` zmienia typ z liczby na string |
| `GET /api/suppliers`, `GET /api/dostawcy` | regresja — musi zostać zielone bez zmian |
| `GET /api/staging`, `/paged`, `/{id}` · `GET_staging.json`, `GET_staging_paged.json` | regresja — silnik zaczyna produkować wiersze `wycofana`, kształt odpowiedzi się nie zmienia |
| `POST /api/import/parse-file`, `/from-url` | regresja — statystyki w ciele odpowiedzi zyskują niezerowe `wycofane` i `autoZatwierdzone` |
| `GET /api/overrides` · `GET_overrides.json` | **poza zakresem — 3d-2** (endpoint powstaje tam) |

Rozjazd świadomie przyjęty: `GET_products.json` nagrano **przed** produkcyjną migracją
`szertxt`, więc trzyma `szerokosc` jako liczbę, podczas gdy żywa produkcja trzyma tam TEXT.
Rozstrzygnięcie — patrz D3.

## Decyzje

**D0 — podział bloku 3d na 3d-1 (SILNIK) i 3d-2 (API).** Blok zbierał 8 punktów, a lektura
dołożyła kolejne 4 endpointy (korekta 2 wyżej), więc wychodził największy blok całej Iteracji 3.
Szew jest czysty: 3d-1 kończy się na `tk()`, 3d-2 zaczyna na brzegu HTTP. *Za:* każda połowa
wielkości 3c, review do udźwignięcia. *Przeciw:* dwa PR-y i dwa przenagrania wzorca zamiast
jednego. **Zakres 3d-2** (zapisany w roadmapie, nie realizowany tutaj): `acceptStaging`
+ `assignKodImportu` w `addProductsBulk`, propagacja `uwagaCena`, 8 endpointów,
`GET_overrides.json`.

**D1 — port `bridge_ext.cjs` + `tire_dims.js` bajt-w-bajt, oba pliki W CAŁOŚCI, + sha256.**
Wariant (a) z promptu, wzorzec 3a. *Za:* oba pliki są czytelne, komentowane i utrzymywane
przez Anię (`applyDims` niesie trzy datowane POPRAWKI w komentarzach) — czyli dokładnie
sytuacja 3a, nie 3c; strażnik sha256 port↔mirror jest tu **dostępny**, w odróżnieniu od 3c;
re-synchronizacja z Anią przez `diff`; `bridge_ext` `require`'uje `tire_dims`, więc idą parą;
a skoro 3d-1+3d-2 używa 7 z 11 eksportów, „tylko używany podzbiór" i tak byłby prawie
całym plikiem. *Przeciw:* kolejne 357 linii CommonJS w projekcie. **Konsekwencja:** funkcje
nieużywane w 3d-1 (`assignKodImportu`, `applyNazwaPamiec`, `applyWagaPamiec`, `rememberLink`,
`ensure*Tables`) też wchodzą — port bierze plik, nie podzbiór, i 3d-2 zastanie je gotowe.

**D2 — realne `Gq()` jako strażnik, port 1:1 wraz z jego niesymetrią.** `Gq()` (`:47319`)
nadpisuje pole **zawsze**, gdy istnieje override, ale melduje naruszenie **tylko** gdy
wartość z pliku jest niepusta, różna od override'u i różna od `acknowledgedSourceValue`.
Odtwarzamy dosłownie, łącznie z tym, że `overrideValue` jest zawsze stringiem (kolumna
`TEXT NOT NULL`), więc podmiana pola potrafi zmienić typ wartości w pozycji z liczby na napis.

**D3 — `products.szerokosc` REAL→TEXT TERAZ, z jawnym datowanym wyjątkiem w gate I2**
(backlog #3, wariant „TEXT teraz + wyjątek"). Uzasadnienie faktyczne: parser już emituje
stringi (korekta 4 wyżej), a SQLite stosuje **type affinity** — do kolumny REAL napis
`"10.00"` wchodzi jako liczba `10.0`, czyli kanon FIZYCZNIE niszczy dokładnie to, po co
istnieje `szertxt`. Zostawienie REAL oznacza, że 3d-2 (`acceptStaging`, jedyny pisarz tej
kolumny) od pierwszego dnia zapisuje uszkodzone dane. *Cena:* `GET_products.json` nagrano
przed migracją, więc jego 5 wierszy ma `szerokosc` liczbowe — gate I2 zobaczy string.
*Rozwiązanie:* mechanizm **zadeklarowanych wyjątków** w `sprawdzZgodnoscZFixture` — wyjątek
niesie ścieżkę, powód, datę i ticket domykający (I12), a test **wymusza, żeby wyjątek
faktycznie wystąpił**, więc po przenagraniu fixtures w I12 sam zaświeci i każe się usunąć.
*Forma:* nowa migracja `003_szerokosc_text.sql`, `001_schema.sql` **nietknięty** — README
schematu deklaruje go jako datowany punkt zerowy (stan produkcji 2026-08-17), a zmiany
przyrostowe idą numerowanymi plikami.

**D4 — propagacja `uwagaCena` i endpointy `uwagi-cena` / `hold-reasons`: NIE tutaj.**
Wariant (b) z promptu. Propagacja siedzi w `acceptStaging`, czyli w 3d-2; oba endpointy
(w produkcji to monkey-patch `mirror/backend/uwaga_cena_patch.cjs`, który dokłada **dwa**
endpointy, nie jeden) idą do I12 razem z dopisaniem do `openapi.yaml`. Zapisane w bloku 3d-2.

**D5 — `bridge_ext` dostaje surowy uchwyt SQLite przez `db.$client`.** Oryginał podaje
`applyLinkMemory` uchwyt `Qi` (`better-sqlite3`), bo moduł robi własne `db.prepare(...)`.
Nie zmieniamy sygnatury `silnikStagingu(db: Baza)` (używa jej `src/routes/import.ts:56`) —
uchwyt wyciągamy z drizzle. *Alternatywa odrzucona:* przepisanie `bridge_ext` na nasze
repozytoria złamałoby D1 (kopia bajt-w-bajt).

**D6 — świadome odstępstwo: zachowujemy bezpiecznik pustego wejścia (D7 z 3b).** Zaklepane
wcześniej, wypisane tu dla kompletu — `tk()` rzuca `PustyImportBlad` zamiast puszczać pusty
wsad, co w produkcji po trzech przebiegach wycofuje cały katalog dostawcy (backlog #8).
Ta sesja **uruchamia pętlę wycofań**, więc bezpiecznik przestaje być teoretyczny.

**D7 — błąd cieniowania `Lq()` i nieistniejąca reguła EAN: nie ruszamy.** Zaklepane w 3c
(backlog #11). Odtwarzane 1:1.

## Plan implementacji

Kolejność jest istotna: harness rozszerzamy **przed** kodem produkcyjnym, żeby każdy krok
mierzyć uruchomionym oryginałem, a nie własnym przekonaniem.

### Krok 1 — port `bridge_ext.cjs` + `tire_dims.js` (D1)
- `cp mirror/backend/bridge_ext.cjs mirror/backend/tire_dims.js` →
  `rebuild/backend/src/import/legacy/`.
- Rozszerzyć `test/charakteryzacja.test.ts` (`:116`) o te dwa pliki w porównaniu sha256
  port↔`mirror/backend/`. Sprawdzić, jak lista plików jest tam zbudowana — dołożyć wpisy,
  nie duplikować mechanizmu.
- `tsconfig`/build: potwierdzić, że `.cjs`/`.js` z `legacy/` są kopiowane do `dist/`
  tak samo jak port parserów z 3a (3a już to rozwiązała — sprawdzić `package.json`).

### Krok 2 — rozszerzenie harnessu charakteryzacji (test/charakteryzacja/silnik/)
- `atrapy.mjs`:
  - `__BRIDGE_EXT` przestaje być no-op — podpiąć **realny** port z `src/import/legacy/`
    i zapisywać wywołania (`applyDims`, `applyLinkMemory`) do listy obserwacji;
  - `ww.prepare(sql)` przestaje zwracać no-op — rozpoznać `INSERT INTO historia_cen`
    i zapisywać argumenty `run(...)` jako wiersze historii;
  - `Qi` przestaje być `null` — atrapy potrzebują uchwytu, po którym `applyLinkMemory`
    zrobi `SELECT ... FROM link_pamiec_kod`. Najprościej: prawdziwa baza `:memory:`
    z tabelami pamięci linków (bez mocków — to ta sama biblioteka co w produkcji).
- `wzorzec.mjs`: usunąć sekcję `pozaZakresem3c` — wiersze `wycofana`, licznik `wycofane`,
  `updateProduct` z pętli wycofań i zapisy auto-zatwierdzania **wchodzą do porównania**.
  Dołożyć do wzorca: wiersze `historia_cen` i wywołania `bridge_ext`.
- `scenariusze.mjs`: dołożyć scenariusze celowane w nowy zakres —
  auto-zatwierdzenie samej ceny / samego stanu / magazynu; produkt nieobecny 1×, 2× i 3×
  (granica progu); override zgodny z plikiem, override sprzeczny, override
  z `acknowledgedSourceValue` równym wartości z pliku (naruszenie NIE powstaje).
- Przenagrać wzorzec: `BRIDGE_SNAPSHOT_DB=<ścieżka> node scripts/charakteryzacja-silnik-nagraj.mjs`.

### Krok 3 — repozytoria (`src/repos/`)
- **`historia.ts`** (nowy) — `zapiszHistorieCen(db, wiersz)`; kolumny 1:1 z `INSERT` z `:47800`,
  tabela `historiaCen` już jest w schemacie Drizzle.
- **`overrides.ts`** (nowy) — `poprawkiDla(db, supplierKod, supplierProductId)`, port
  `U.getOverridesFor` (`:44915`). `listOverrides`/`upsertOverride`/`deleteOverride`
  **zostają do 3d-2** (nie ma ich kto wołać w 3d-1) — odnotować to komentarzem, żeby 3d-2
  wiedziała, że dokłada do istniejącego pliku.

### Krok 4 — realne `Gq()` (`src/import/silnik/overrides.ts`)
- Podmienić stub na port `:47319-47348`, zachowując sygnaturę. Funkcja potrzebuje dostępu
  do bazy — dziś `zastosujPoprawkiMarty(kodDostawcy, pozycja)` jej nie ma; wprowadzić
  fabrykę (`poprawkiMarty(db)` → funkcja o dzisiejszej sygnaturze), żeby `tk()` zmienił
  tylko miejsce utworzenia, a nie miejsce wywołania.
- Usunąć z `tk.ts` komentarze „nie powstanie do czasu 3d" przy `naruszono` i `_srcConflict`
  (`:320-323`, `:386-401`) — te gałęzie stają się żywe.

### Krok 5 — efekty auto-zatwierdzania (`tk.ts:506-515`)
Port `:47791-47806`, w **tej samej kolejności co oryginał** (ma znaczenie: `applyDims` mutuje
`autoPatch`, zanim ten trafi do `aktualizujProdukt`):
1. `statystyki.autoZatwierdzone += 1`; `autoPatch.dataAktualizacji = utworzono`;
2. `applyDims(autoPatch, dopasowany.rozmiar)` + `applyLinkMemory(sqlite, autoPatch, dopasowany)`
   — w oryginale objęte `try{}catch{}` (moduł jest defensywny), odtwarzamy;
3. `aktualizujProdukt(db, dopasowany.id, autoPatch)`;
4. `INSERT INTO historia_cen` — pola tożsamości z `dopasowany`, ceny/stan z
   `autoPatch.X ?? dopasowany.X`, `zarejestrowanoAt = utworzono`. Oryginał łapie tu błąd
   osobnym `try{}catch{}` **wewnątrz** try dla `updateProduct` — odtworzyć zagnieżdżenie,
   bo decyduje o tym, czy nieudany zapis historii przewraca aktualizację produktu (nie
   przewraca).

### Krok 6 — pętla wycofań (`tk.ts:518-523`)
Port `:47807-47847`: `WYCOFANIE_PROG_IMPORTOW = 3`; dla każdego produktu z katalogu dostawcy
spoza `dopasowaneId` licznik `(nieobecnoscPodRzad || 0) + 1`; przy `>= 3` — `statystyki.wycofane++`,
wiersz `typZmiany: "wycofana"` do bufora (`stanNowy: 0`, `cenaZakupuNowa: null`,
`snapshotJson: null`, wszystkie pola `ean*` `null`, `powod: "Brak w cenniku — pozycja wycofana"`)
i **zerowanie** licznika; poniżej progu — tylko zapis podbitego licznika.
Ostrzeżenie o możliwym duplikacie EAN buduje się z `konfliktyEan`, z filtrem
`cx.kod !== u.kod` (oryginał `:47822`).

### Krok 7 — `szerokosc` REAL→TEXT (D3)
- `rebuild/schema/003_szerokosc_text.sql` — przebudowa tabeli (SQLite nie ma `ALTER COLUMN`),
  **idempotentna**: no-op, gdy kolumna już jest TEXT. Mechanika sprawdzona i działająca
  jest w `test/gate/dane.ts:312-338` (`przelaczSzerokoscNaText`) — przenieść ją do migracji.
- `src/db/schema.ts:42` — `szerokosc: real()` → `text()`.
- `test/gate/dane.ts` — wartości seeda na stringi; `przelaczSzerokoscNaText` staje się zbędna
  (kanon po migracji jest już TEXT) → usunąć razem z jej użyciami.
- `test/produkty.test.ts:128-195` — przerobić testy-strażniki: pierwszy („na kanonie REAL
  SQLite konwertuje napis") **przestaje opisywać rzeczywistość** i musi zniknąć; pass-through
  stringa zostaje.
- `test/gate/asercje.ts` — mechanizm zadeklarowanych wyjątków (opis w D3).
- `test/katalog.gate.test.ts` — zamienić dzisiejszy komentarz „GATE tego nie łapie i nie ma
  łapać" na realny, datowany wyjątek; komentarz jest po zmianie nieprawdziwy.

### Krok 8 — testy decyzji (poza charakteryzacją)
Patrz „Strategia testów".

## Strategia testów

**1. Charakteryzacja silnika (główny dowód) — rozszerzona o zakres 3d-1.**
Ten sam mechanizm co w 3c: żywy `tk()` wycięty z `mirror/backend/index.cjs` po kotwicach
tekstowych (sha256 na wycinku) uruchamiany na atrapach, porównanie **pole po polu** z naszym
portem. 3d-1 wciąga do porównania to, co 3c odsiewała: wiersze `wycofana`, licznik `wycofane`,
zapisy auto-zatwierdzania, wiersze `historia_cen`, wywołania `bridge_ext` oraz — przez
`stworzAtrapy({overrides})` — **realne `Gq()` po obu stronach**. Cenniki MO1–MO10 z
`test/charakteryzacja/silnik/katalog/` + scenariusze celowane.

**2. Testy decyzji** (wymagane wprost przez gate sesji):
- **co się auto-zatwierdza, a co nie** — zmiana samej ceny zakupu / sprzedaży / marży / stanu
  / magazynu przechodzi bez pytania; zmiana pola kluczowego (`POLA_KLUCZOWE`) albo
  `wymagaSprawdzenia` odbiera auto-zatwierdzenie i produkuje wiersz stagingu;
- **wycofanie dokładnie po TRZECIEJ nieobecności** — trzy oddzielne przebiegi na tym samym
  katalogu: po 1. licznik 1 bez wiersza, po 2. licznik 2 bez wiersza, po 3. wiersz `wycofana`
  + licznik z powrotem 0. Jawnie asercja „nie po drugiej i nie po czwartej";
- **precedencja override** — import NIE nadpisuje ręcznej wartości Marty: po przebiegu
  produkt ma wartość z `manual_overrides`, wiersz stagingu ma `typZmiany: "blad"`,
  `ostrzezenie` zawiera „plik nadpisuje poprawke Marty", a `snapshotJson._srcConflict`
  niesie wartość z pliku;
- **`historia_cen`** — auto-zatwierdzenie dopisuje dokładnie jeden wiersz z polami tożsamości
  produktu i cenami po zmianie;
- **bezpiecznik pustego wejścia** — `tk()` na pustej tablicy rzuca `PustyImportBlad`, nie
  dotyka stagingu ani liczników i **nie podbija `nieobecnoscPodRzad`** (to ostatnie jest
  nowe: dopiero ta sesja daje pętli wycofań moc). Test przez HTTP na
  `POST /api/staging/import` należy do 3d-2 — endpoint tam powstaje; tu testujemy na `tk()`.

**3. Gate regresji** — bez zmian w samych testach muszą zostać zielone: charakteryzacja 3a
(1838 rekordów, sha256), GATE I2 (`katalog.gate.test.ts` — z jednym zadeklarowanym wyjątkiem
z D3), `GET_staging.json`, `GET_staging_paged.json`, gate treści przez
`POST /api/import/parse-file`.

**4. Bramki** — `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
w `rebuild/backend/` (Node ≥ 20).

Czego **nie** testujemy: `assignKodImportu`, `applyNazwaPamiec`, `applyWagaPamiec`,
`rememberLink` — wchodzą portem (D1), ale w 3d-1 nikt ich nie woła; ich charakteryzacja
należy do 3d-2 razem z `acceptStaging`/`addProductsBulk`.

## Poza zakresem

- **`acceptStaging`, `assignKodImportu` w miejscu wywołania, propagacja `uwagaCena`,
  8 endpointów mutacji stagingu i overrides, `GET_overrides.json`** → **3d-2** (D0).
- **`GET /api/products/uwagi-cena` i `/hold-reasons` + dopisanie do `openapi.yaml`,
  przenagranie fixtures** → **I12** (D4).
- **Narzuty i promocje w `acceptStaging`** (`__bridgePickMarkup`/`__bridgePickPromo`) → **I4**;
  w I3 tabele są puste, więc gałąź nie wchodzi (korekta 3).
- **Widok `/staging`** → 3e.
- **Naprawa błędu cieniowania `Lq()`** → backlog #11, czeka na decyzję Ani (D7).

## Definition of done

- [ ] `bridge_ext.cjs` i `tire_dims.js` w `src/import/legacy/`, bajt-w-bajt, pilnowane sha256
- [ ] Auto-zatwierdzanie ma skutki: `aktualizujProdukt` + `historia_cen` + `applyDims`/`applyLinkMemory`
- [ ] Pętla wycofań działa, próg = 3, licznik zerowany po wycofaniu
- [ ] `Gq()` realne; import nie nadpisuje wartości Marty; `_srcConflict` w `snapshotJson`
- [ ] Charakteryzacja silnika rozszerzona o zakres 3d-1 i przenagrana; porównanie pole po polu zielone
- [ ] Testy decyzji: auto-approve, próg wycofania (nie 2, nie 4), precedencja override
- [ ] `products.szerokosc` = TEXT (migracja 003), gate I2 zielony z jednym **zadeklarowanym
      i wymuszanym** wyjątkiem wskazującym na I12
- [ ] Charakteryzacja 3a, GATE I2, `GET_staging*.json` — zielone
- [ ] `lint` / `typecheck` / `build` / `test` czyste
- [ ] Roadmapa: blok 3d zamknięty jako 3d-1, blok **3d-2 utworzony** z pełnym zakresem
      i korektami 1–4; §3 zawiera rozstrzygnięcie auto-accept (korekta 5); backlog #3 i #4
      z aktualnymi statusami
