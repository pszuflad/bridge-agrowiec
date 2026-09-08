# 42-CHORE-i13a-resync-parserow — raport z implementacji

## Podsumowanie

Dziewięć plików warstwy parserów zsynchronizowano bajt-w-bajt ze stanem produkcji 08.09
(`6872aea` na `main`) RÓWNOLEGLE w oracle (`mirror/backend/`) i w porcie
(`rebuild/backend/src/import/legacy/`), po czym przenagrano wzorzec charakteryzacji parserów.
Sync ujawnił udokumentowaną zależność parsery→silnik: wzorzec charakteryzacji silnika karmi się
wyjściem parserów, więc przenagranie 3a zdezaktualizowało go mechanicznie — po decyzji użytkownika
przenagrano też jego, nadal z ORYGINALNEGO `tk()`. Wszystkie cztery bramki backendu zielone,
1223/1223 testów (tyle samo co baseline).

## Zmiany

**Commit 1 — sync mirror + port** (`bb020fb`), 9 par plików, nic poza listą:

- `mirror/backend/common.cjs` + `rebuild/backend/src/import/legacy/common.cjs` — +23/−1
- `mirror/backend/parsers/adapter.cjs` + port — +9/−3
- `mirror/backend/parsers/tyre_params.cjs` + port — +132/−34
- `mirror/backend/parsers/mo1_bohnenkamp.cjs` + port — +4/−1
- `mirror/backend/parsers/mo2_jmk.cjs` + port — +13/−10
- `mirror/backend/parsers/mo6_agrowiec.cjs` + port — +13/−10
- `mirror/backend/parsers/mo7_nokian.cjs` + port — +14/−11
- `mirror/backend/parsers/mo8_trelleborg.cjs` + port — +81/−3
- `mirror/backend/parsers/mo9_agrorami_api.cjs` + port — +47/−11

**Commit 2 — wzorzec parserów** (`9b26ceb`): `test/charakteryzacja/MO{1..10}.expected.json`
przenagrane `scripts/charakteryzacja-nagraj.mjs`.

**Commit 3 — wzorzec silnika** (`5887c0b`): `test/charakteryzacja/silnik/MO{1..10}.expected.json`
przenagrane `scripts/charakteryzacja-silnik-nagraj.mjs`. `katalog/` i `overrides/` bez zmian.

## Odstępstwa od planu

**Jedno, zatwierdzone przez użytkownika w trakcie: przenagranie wzorca charakteryzacji SILNIKA.**
Plan (decyzja 3) zakładał, że wzorce silnika nie mają prawa się ruszyć, bo `index.cjs` jest poza
zakresem 13a, i przewidywał STOP + zgłoszenie, gdyby padły. Padły — 10/10 dostawców. Zatrzymałem
się i zgłosiłem, użytkownik wybrał przenagranie w 13a. Szczegóły w sekcji „Zależność parsery→silnik".

Druga, drobna: `git checkout main -- rebuild/...` nie zadziałał, bo gałąź `main` **nie zawiera katalogu
`rebuild/`** (jest lustrem produkcji, nie repozytorium odbudowy). Plan przewidywał tę ścieżkę zapasową
— użyto `git show main:mirror/backend/<plik> > <port>`, więc obie kopie pochodzą z tego samego blobu.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): N/D** — karta nie dotyka API ani `contract/`. Parsery kończą się
  na `adapter.recordsToSurowe()`, przed zapisem do bazy; żaden plik `contract/fixtures/` nie jest
  nagraniem ich wyjścia. Skutki widoczne niżej w API (Wielka litera kategorii, słowa konstrukcji)
  należą do 13c wraz z przenagraniem `katalog.gate`, `analityka.*`, `produkty.*`.
- **Gate charakteryzacji parserów, warstwa 1 (byte-for-byte): ✓** — całe drzewo `src/import/legacy/**`
  (19 plików) zgodne z `mirror/backend/**`; jedyny wyjątek pozostaje `legacy/package.json` (marker
  `commonjs`), lista wyjątków niezmieniona. Żaden plik spoza listy 9 nie odjechał — warunek STOP
  z decyzji 2 nie zaszedł.
- **Warstwa 2 (field-characterization MO1–MO10): ✓** po przenagraniu.
- **Warstwa 3 (próbka niepusta): ✓**
- **Charakteryzacja silnika: ✓** po przenagraniu (przed: 10/10 czerwono).
- **Charakteryzacja akceptacji: ✓** (33 testy) — nie konsumuje wzorca 3a, była zielona przez cały czas.
- **Pełny zestaw:** `npm run lint` ✓, `npm run typecheck` ✓, `npm run build` ✓,
  `npm test` ✓ **79 plików / 1223 testy** — dokładnie tyle, ile w baseline przed zmianą.
- Nowych testów jednostkowych nie pisano (uzasadnienie w planie: kod parserów jest kopią bajtową
  wykonywanego oryginału; field-characterization mierzy zachowanie lepiej niż nasze wyobrażenie o nim).

## Co realnie zmieniło się w zachowaniu importu

Liczba rekordów **nie zmieniła się u żadnego z 10 dostawców** (2686 wstawień == 2686 usunięć w diffie
wzorca), zestawy kodów identyczne. Jedyny przesunięty licznik: **MO1 `odrzuconePrzezAdapter` 1 → 0**
przy tych samych 199 kodach — sygnatura **bug1**: rekord odrzucany jest teraz już w parserze,
wcześniej dopiero w adapterze.

Przesunięcia pól, każde przypisane do konkretnej zmiany Ani:

| Zmiana | Backlog | Gdzie widać w charakteryzacji |
|---|---|---|
| **konstr** | #58 | `konstrukcja` `R`→`Radialna`, `D`→`Diagonalna` — **wszystkich 10 dostawców** (MO1 199, MO2 200, MO3 44, MO4 101, MO5 146, MO6 2, MO7 285, MO8 625, MO9 12, MO10 223 rek.) |
| **bug2** | #9 | `nro` `1`→`'Tak'`, `nro`/`cho` `0`→`null` — MO1 (199), MO3 (44), MO9 (12) |
| **odswinch** | #64 | notacja calowa OD×SW−Rim: `28x9-15`, `18x7-8`, `16x6.50-8`, `13x5.00-6`, `20x10.00-8`, `20.5x8.00-10` → `szerokosc` z DRUGIEJ liczby zamiast pierwszej — **98 rek.**: MO1 1, MO2 22, MO3 1, MO4 4, MO8 68, MO10 2 |
| **p2_4** | #63 | ułamkowe szerokości z profilem: `6.5/80-12`, `9.0/75-16`, `4.00/4.50-21` — **7 rek.**: MO2 1, MO8 6 |
| **b4** | #53 | notacja metryczna WxSxD → `szerokosc` z DRUGIEJ liczby, `profil` → `null`, `wysokosc` przeliczona — **4 rek.**, wszystkie MO8: `690x180-15` (`'690'`→`'180'`, wysokosc 286.5→67.98), `560x140-12`, `610x145-13`, `645x160-14` |
| **b10** | #54 | Handlopex: sufiks `/NACZEPA` usunięty z `model`, `bieznik` i `nazwa` — MO4, 2 rek. (`TH31 /NACZEPA` → `TH31`) |
| **bug1** | #10 | MO1 `odrzuconePrzezAdapter` 1 → 0 (patrz wyżej) |

Rozbicie na `odswinch` / `p2_4` / `b4` jest **zmierzone**, nie szacowane: każdy rekord o zmienionej
`szerokosc` sklasyfikowano wzorcem jego pola `rozmiar` — calowe OD×SW−Rim (pierwsza liczba > trzeciej
i < 30) → `odswinch`, `W/P-D` z ułamkiem → `p2_4`, metryczne `\d{3,4}x\d{3}-\d` → `b4`. Klasyfikacja
pokrywa wszystkie 109 rekordów bez reszty.

### Zmiany, których próbki NIE uruchamiają (kod jest, pokrycia brak)

To nie jest brak wdrożenia — obecność kodu potwierdzona w diffie. Próbki po prostu nie zawierają
wejść, które by go odpaliły. Zgodnie z krokiem 5 planu opisuję zamiast zgłaszać STOP:

- **katunify (#57)** — `KATEGORIA_MAP` w `mo2`/`mo6`/`mo7` zmieniło wartości z małej litery na Wielką,
  ale rozkład `kategoria` jest **identyczny przed i po syncu** u wszystkich 10 dostawców. Powód:
  próbki nie mają surowej kolumny kategorii, więc parser leci fallbackiem
  `if (!kategoria) kategoria = c.classifyByName(nazwa)` (`mo2_jmk.cjs:55`), a `classifyByName`
  zwracała Wielką literę już przed 25.08 — mapa nie odpala. Zmieniony jest też fallback
  w `common.cjs` (`rec.kategoria || 'rolnicze'` → `'Rolnicze'`), również nieuruchomiony.
- **mo9expand (#55)** — `expandLoadIndexSlash` wymaga drugiego członu BEZ liczby (`144A8/B`).
  Próbka MO9 ma wyłącznie indeksy z liczbą w obu członach: `115A6/108A8`, `133A6/129A8`,
  `148A8/144B`, `153A6/149A8`, `88A6/80A8`, `91A6/83A8`. Funkcja przechodzi bez efektu.
- **bug4 (#8)** — `isZipBuffer` rozstrzyga CSV vs XLSX na poziomie detekcji typu pliku. Próbka MO8
  to stały `MO8.xlsx`, więc gałąź CSV pozostaje nieuruchomiona.

## Rozłożenie `odswinch` (#64) — zmiana NIEZALOGOWANA w CHANGELOG

Zakres ustalony diffem `mirror/backend/parsers/tyre_params.cjs.bak_odswinch_20260904_1403`
(migawka sprzed zmiany, 2026-09-04 14:03) względem `mirror/backend/parsers/tyre_params.cjs@main`.
**Realny zakres: +26/−1, dwa hunki, oba w `parseSize()`** — nic poza tym.

**Hunk 1 — nowy wariant parsowania (`parseSize`, blok rozmiarów 3-liczbowych).**
Dodano rozpoznanie calowej notacji **OD×SW−Rim** dla małych opon wózkowych i mikroopon:

```js
match = size.match(/^(\d{1,2}(?:\.\d+)?)x(\d{1,2}(?:\.\d+)?)-(\d{1,2}(?:\.\d+)?)$/i);
if (match && parseNumber(match[1]) > parseNumber(match[3]) && parseNumber(match[1]) < 30) {
  result.szerokosc = parseNumber(match[2]);   // SW, czyli DRUGA liczba
  result.profil = null;
  result.konstrukcja = 'D';
  result.srednica = parseNumber(match[3]);
}
```

Rozróżnienie od klasycznej bias-ply `WxP-D` (np. `10.5x80-18`) opiera się na dwóch warunkach:
pierwsza liczba (OD, średnica zewnętrzna w calach) **większa** od trzeciej (felga) oraz **< 30**.
W klasycznej bias-ply zawsze A < C (szerokość < felga). Blok **musi stać PRZED** wzorcem `WxP-D`,
bo inaczej ten drugi przechwyciłby dopasowanie i wziął szerokość z pierwszej liczby.
Przykłady z komentarza Ani: `16x6-8` (BKT MAGLIFT: OD 16", SW 6", felga 8"), `23x10-12`, `18x7.50-8`.

**Hunk 2 — rozszerzenie strażnika `isWxSxD` (blok `szerokoscRaw`).**
Dotychczasowy strażnik chronił notację metryczną WxSxD (`/^\d{3,4}x\d{3}-\d/` + szerokość < 400)
przed nadpisaniem `szerokoscRaw` pierwszą liczbą z rozmiaru. Dodano analogiczny wariant calowy
`isWxSxDcale` (ta sama heurystyka OD > felga i OD < 30) i zsumowano oba przez `||`. Bez tego
hunka hunk 1 byłby bezużyteczny: poprawnie sparsowana szerokość SW zostałaby zaraz nadpisana
przez OD z pierwszej liczby.

**Zmierzony efekt (charakteryzacja):** ~103 rekordy w 6 z 10 próbek dostają szerokość z drugiej
liczby zamiast pierwszej, wraz z wyzerowanym `profil` i przeliczoną `wysokosc` —
np. MO1 `28x9-15`: `szerokosc '28'→'9'`, `profil 9→null`, `wysokosc 50.9→76.04`.

Plik `.bak_odswinch_*` **nie został wciągnięty do portu** — warstwa 1 gate'a ma osobny strażnik
odrzucający wzorzec `\.bak_`; porównania dokonano przez `git show main:<ścieżka>`, bez dodawania
pliku do drzewa.

## Zależność parsery→silnik (istotne dla 13b)

Po przenagraniu wzorca 3a `test/silnik.charakteryzacja.test.ts` zaświecił czerwono na 10/10
dostawców. **To NIE jest niezauważona zależność** — jest zadeklarowana w nagłówku samej nagrywarki
(`scripts/charakteryzacja-silnik-nagraj.mjs:8-11, 28`):

> „WEJŚCIE SILNIKA = wzorzec 3a. Rekordy bierzemy wprost z `test/charakteryzacja/MOx.expected.json`
> (pole `rekordy`), czyli z nagranego wyjścia ORYGINALNYCH parserów. […]
> Uruchamiać po każdej zmianie w mirrorze albo po przenagraniu wzorca 3a."

Charakter rozjazdów potwierdza, że chodzi o zmienione wejście, nie o silnik. Kotwice sha wycinków
`index.cjs` bez zmian (helpery `584611d43a24…` 11532 B, silnik `335b9b97bb96…` 8174 B), więc
`mirror/backend/index.cjs` pozostał nietknięty i wzorzec dalej pochodzi z ORYGINALNEGO `tk()` —
dowód wierności portu TS jest nienaruszony.

**Sprostowanie (znalezione w code review).** Wcześniejsza wersja tego raportu i treść commita
`5887c0b` mówiły o „zerze różnic strukturalnych". To jest **nieprawda dla MO8** — twierdzenie
opierało się na uciętym wyjściu vitest (widocznych było tylko kilka pierwszych asercji, wszystkie
na polach `powod` i `snapshotJson`). Porównanie wzorców przed/po dla wszystkich 10 dostawców daje
obraz dokładny:

- **9 dostawców (MO1–MO7, MO9, MO10):** `statystyki` i liczba wierszy `staging` bez zmian —
  różnice wyłącznie w treści pól tekstowych (`powod`, `snapshotJson`), np. `• konstrukcja: D → Diagonalna`.
- **MO8: zmiana strukturalna.** `staging` 25 → 31 wierszy, `wierszyPoDeduplikacji` 25 → 31,
  `statystyki.doStagingu` 25 → 31, `zmienione` 24 → 30, `bezZmian` 600 → 594. Żaden wiersz nie
  zniknął — doszło sześć: `MO8_0198600`, `MO8_0198800`, `MO8_0207900`, `MO8_0209500`, `MO8_1159100`,
  `MO8_1169800`.

**Przyczyna i dlaczego to potwierdza, a nie podważa, diagnozę.** Wszystkie sześć nowych wierszy to
**konflikty z poprawkami Marty**, a katalog do nagrania pochodzi z `db/snapshot.db` — zrzutu produkcji
z **2026-08-13**, więc w starej konwencji. Rekordy niosą dokładnie te pola, które zmieniły parsery:

    MO8_0198600  konstrukcja: baza/Marta="D"     vs plik dostawcy="Diagonalna"   (konstr, #58)
    MO8_0209500  szerokosc:   baza/Marta="4"     vs plik dostawcy="4.00"          (p2_4, #63)
    MO8_1169800  szerokosc:   baza/Marta="4.1"   vs plik dostawcy="4.10"          (p2_4, #63)

Czyli silnik zachowuje się identycznie jak wcześniej — dostaje tylko inne wejście i inny katalog niż
to wejście zakłada. To **artefakt stanu przejściowego**, nie zmiana w silniku: nowe parsery zderzone
ze starym zrzutem bazy. Migracja danych do nowej konwencji (`konstrukcja` kody→słowa, szerokości)
jest zakresem **13c** i te sześć konfliktów po niej zniknie.

**⚠ Świadomy stan przejściowy do rozliczenia w 13b.** Przenagrany wzorzec utrwala kombinację
**silnik 25.08 + parsery 08.09**, która nigdy nie istniała na produkcji (08.09 ma nowy również
`index.cjs`). 13b, bumpując silnik, przenagra ten wzorzec ponownie i dopiero wtedy będzie on
opisywał realny stan produkcji. Do tego czasu develop zostaje zielony, zgodnie z zasadą I13.

Do przenagrania potrzebny jest `db/snapshot.db` (w `.gitignore`, nieobecny w worktree ticketa) —
skrypt przyjmuje `BRIDGE_SNAPSHOT_DB=/ścieżka/do/snapshot.db`. Użyta komenda:

```bash
BRIDGE_SNAPSHOT_DB=<repo>/db/snapshot.db node scripts/charakteryzacja-silnik-nagraj.mjs
```

**Wzorce akceptacji (`test/charakteryzacja/akceptacja/`) NIE zależą od wzorca 3a** — 33 testy były
zielone przez cały czas, przed i po przenagraniu. 13b nie musi tego odkrywać na nowo.

## Breaking changes

Brak w rozumieniu API. Zmienia się natomiast **wyjście importu** dla przyszłych przebiegów:
`konstrukcja` niesie teraz słowa (`Radialna`/`Diagonalna`) zamiast kodów (`R`/`D`/`L`/`B`),
`nro`/`cho` niosą `'Tak'`/`null` zamiast `1`/`0`, a szerokości opon w notacji calowej OD×SW−Rim
liczą się z drugiej liczby. Rekordy już zapisane w bazie **nie są tym ruszone** — ich migracja
to zakres 13c.

## Follow-up

- **13b (silnik):** przenagrać `test/charakteryzacja/silnik/MO*.expected.json` po bumpie
  `mirror/backend/index.cjs` — obecny wzorzec jest przejściowy (silnik 25.08 + parsery 08.09).
  ⚠ Uwaga na MO8: wzorzec ma tam **31 wierszy stagingu zamiast 25**, w tym sześć konfliktów
  z poprawkami Marty wynikających ze zderzenia nowych parserów ze starym `db/snapshot.db`
  (2026-08-13). Nie jest to regresja silnika — patrz sekcja „Zależność parsery→silnik".
- **13c (migracje):** dane historyczne w bazie mają kody konstrukcji (`R`/`D`/`L`/`B`) i wymagają
  migracji do słów, zgodnie z `KONSTRUKCJA_CANONICAL_MAP` z `common.cjs` (mapowanie decyzją Anny
  z 2026-09-01: `L` 46 rek. i `B` 11 rek. → `Diagonalna`, `-` → `Diagonalna`).
- **13c (migracje), znalezisko poza zakresem 13a:** `katunify` **nie unifikuje kategorii
  `'rolnicze małe'`** — w warstwie parserów zostaje ona z małej litery (widoczne w MO2, 3 rek.).
  Wielką literę nadaje jej dopiero osobny skrypt `mirror/backend/apply_kategoria.cjs:12`
  (`'rolnicze małe' → 'Rolnicze małe'`), który nie należy do warstwy parserów. Warto sprawdzić
  przy 13c, czy migracja historycznych kategorii ma tę wartość obejmować.
- **Pokrycie próbek:** `katunify`, `mo9expand` i gałąź CSV z `bug4` nie są uruchamiane przez obecne
  próbki charakteryzacji. Gdyby chcieć je objąć dowodem, trzeba dołożyć próbki (MO2/MO6/MO7
  z surową kolumną kategorii, MO9 z indeksem typu `144A8/B`, MO8 w wariancie CSV). Świadomie
  NIE robione w 13a — zmiana zestawu próbek to zmiana bazy dowodowej wszystkich kart I13.

## Poprawki po code review

Review (`review.md`) zgłosiło 3 BLOCKER-y i 1 SHOULD-FIX. Rozliczenie:

1. **BLOCKER — roadmapa nie zaktualizowana.** Zasadny. Zrobione w fazie dokumentacji tego ticketa
   (`docs/rebuild-roadmap.md`): 13a oznaczone jako zamknięte z datą i ID ticketa, ustalenia dla
   13b/13c wpisane DO ICH bloków zgodnie z zasadą CLAUDE.md #2.
2. **BLOCKER — backlog nie zaktualizowany.** Zasadny. Zrobione w fazie dokumentacji
   (`docs/rebuild-backlog.md`, wpisy #8/#9/#10/#53/#54/#55/#57/#58/#63/#64).
3. **BLOCKER — „zero różnic strukturalnych" nieprawdziwe dla MO8.** Zasadny i potwierdzony
   niezależnie (MO8 staging 25→31). Sprostowane w sekcji „Zależność parsery→silnik" wraz
   z ustaloną przyczyną (nowe parsery vs zrzut bazy z 2026-08-13) i przypisem do 13c.
   Treści commita `5887c0b` nie da się już zmienić — sprostowanie żyje w raporcie i w opisie PR.
4. **SHOULD-FIX — rozbicie 72/78 brzmi jak twarda liczba, a jest szacunkiem.** Zasadny, ale zamiast
   opatrzyć je zastrzeżeniem — **zmierzyłem je**: klasyfikacja wszystkich 109 rekordów o zmienionej
   `szerokosc` wzorcem pola `rozmiar` daje odswinch 98 / p2_4 7 / b4 4, bez reszty.

**Znalezisko własne przy weryfikacji SHOULD-FIX, nie zgłoszone przez review:** raport twierdził,
że **b4 (#53) weszło do produkcji przed 25.08** i nie jest ruszane tym syncem. To był błąd —
`git show origin/develop:mirror/backend/parsers/tyre_params.cjs | grep -c "POPRAWKA 2026-08-31"`
zwraca **0**, więc b4 wchodzi dopiero tym syncem i JEST uruchomione przez próbki: cztery rekordy
MO8 w notacji metrycznej WxSxD (`690x180-15`, `560x140-12`, `610x145-13`, `645x160-14`) biorą
teraz szerokość z drugiej liczby (`'690'` → `'180'`). Wpis usunięty z listy „nieuruchomionych",
b4 dopisane do tabeli zmierzonych przesunięć. Lista faktycznie nieuruchomionych zawęża się
do trzech pozycji: `katunify` (#57), `mo9expand` (#55) i gałąź CSV z `bug4` (#8).

## Docs updates

### `docs/rebuild-roadmap.md`

- §5 tabela statusów — wiersz „13 | Delty produkcji…" uzupełniony o zamknięcie 13f
  (`41-CHORE-i13f-decyzja-backfille`) i 13a (`42-CHORE-i13a-resync-parserow`), oba 2026-09-08.
- Akapit „Oś podziału = MECHANIZM PORTU…" — dopisany fakt operacyjny dotyczący **każdej** karty I13,
  nie tylko 13a: gałąź `main` nie zawiera katalogu `rebuild/`, więc port dociąga się przez
  `git show main:mirror/backend/<plik> > <port>`, nie `git checkout main -- rebuild/...`.
- Bullet **13a** — przepisany z zamiaru na stan: nagłówek „✅ zrobione 2026-09-08", zakres faktycznie
  dowieziony z rozbiciem każdej zmiany na liczbę rekordów, rozdzielenie zmian potwierdzonych
  pomiarem od tych, których próbki nie uruchamiają, sprostowanie o `b4`, oraz informacja
  o ponadplanowym przenagraniu wzorca silnika.
- Bullet **13b** — nowy akapit „Stan przejściowy odziedziczony z 13a" (zgodnie z obowiązkiem #2
  z `CLAUDE.md`: ustalenie o przyszłym bloku wpisane DO NIEGO): konieczność ponownego przenagrania
  po bumpie `index.cjs`, komenda z `BRIDGE_SNAPSHOT_DB`, nota o MO8 (31 vs 25 wierszy — nie regresja),
  nota że wzorce akceptacji nie zależą od wzorca 3a.
- Bullet **13c** — dopisane `KONSTRUKCJA_CANONICAL_MAP` (decyzja Anny 2026-09-01), znalezisko
  o `'rolnicze małe'` z odniesieniem do `apply_kategoria.cjs:12`, oraz nota że sześć konfliktów MO8
  powinno zniknąć po migracji.

### `docs/rebuild-backlog.md`

- Intro sekcji „Delty produkcji Ani 26.08–08.09" — odnotowane zamknięcie 13a.
- Statusy 10 wpisów zaktualizowane z rozróżnieniem, którego wcześniej nie było:
  **sportowane i potwierdzone pomiarem** (#9, #10, #53, #54, #58, #63, #64) kontra
  **sportowane, ale niepotwierdzone** (#8, #55, #57 — próbki nie uruchamiają tego kodu).
- **#64** domknięty: realny zakres `odswinch` (+26/−1, dwa hunki w `parseSize()`), z odesłaniem
  do raportu zamiast powielania treści.
- **#53** — sprostowanie: `b4` nie istniało w produkcji przed 25.08.
- **#54** — doprecyzowanie: kod siedzi w `tyre_params.cjs`, nie w `mo4_mo5_handlopex.cjs`.
- **#57** — dopisane znalezisko o `'rolnicze małe'`.
- **#57, pole „Iteracja" — sprostowanie przypisania karty.** Wpis mówił `→ 13b (migracja + fixtures)`,
  co przeczyło dwóm innym źródłom: tabeli mapowania w tej samej sekcji („katunify(migracja) #57 | **13c**")
  i roadmapie (blok 13c: „weryfikacja czy katunify wymaga migracji historycznych kategorii").
  Opis w nawiasie był dosłowną definicją 13c — błędny był sam numer, więc poprawiono go jako fakt,
  a nie jako zmianę zakresu. To dokładnie ten wzorzec błędu, przed którym ostrzega `CLAUDE.md`
  (obowiązek #3: przypisanie funkcji do sesji weryfikuj, nie ufaj zapisowi).

### `docs/spec-backend.md`, `docs/spec-frontend.md`, `docs/cutover.md`, `docs/audit-delta.md`

Sprawdzone, **zero zmian** — i to jest poprawny wynik. Żadne twierdzenie w tych plikach nie zostało
obalone, bo wszystkie dotyczą warstwy API / bazy / UI / planu wdrożenia, a zmiana 13a żyje wyłącznie
w warstwie parserów, przed zapisem do bazy. Odnotowane potencjalne kolizje okazały się pozorne:
`spec-frontend.md` wspomina `konstrukcja` jako typ warunku w builderze narzutów (bez przywiązania
do reprezentacji wartości), a `audit-delta.md` ma wpis „konstrukcja R→Radialna" dotyczący
transformacji przy **eksporcie CSV na froncie** (22.07–17.08), nie normalizacji przy imporcie.
Aktualizacja tych dokumentów należy do **13c**, gdy zmiana dotrze do bazy i API.

## Pre-existing issues (zastane, poza zakresem ticketa)

Brak — jedyny zgłoszony rozjazd (przypisanie #57 do 13b) okazał się literówką w numerze karty
i został poprawiony w ramach tego ticketa, bo pozostałe dwa źródła były zgodne.
