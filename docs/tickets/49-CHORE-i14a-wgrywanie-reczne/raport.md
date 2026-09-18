# 49-CHORE-i14a-wgrywanie-reczne — raport z implementacji

## Podsumowanie

Zakładka Konfiguracja → „Wgrywanie ręczne" wróciła do kształtu oryginału `JT()`
(`deminified/frontend-index.js:26147-26200`): wgrywanie zbiorcze przeniosło się z inline'u
do modala za przyciskiem „Wgraj pliki", doszła brakująca sekcja „Wgrywanie pojedyncze
(z wymuszonym dostawcą)" z siatką kafli `upload-tile-{kod}`, a komunikaty inline zastąpił toast —
zbiorczy po imporcie i `destructive` przy błędzie pliku oraz błędzie importu. Przycisk akcji nie
ma już licznika „Wgraj (N)", który po udanym imporcie pokazywał „Wgraj (0)".

## Zmiany

- **Nowy:** `rebuild/frontend/src/pages/konfiguracja/DialogWgrywania.tsx` — port `Cd()`
  (`:18850-19180`). Jeden dialog obsługuje oba wejścia: `multi` (auto-detekcja) i `dostawcaKod`
  (wymuszony dostawca z kafla). Zawiera wybór plików, listę z detekcją i nadpisaniem dostawcy,
  „Dodaj kolejny plik", „Wyczyść", przycisk „Importuj do staging", pętlę importu i toast zbiorczy.
- `rebuild/frontend/src/pages/konfiguracja/Wgrywanie.tsx` — przepisane na strukturę `JT()`:
  dwie karty (zbiorcza + kafle) zamiast inline'owego `input-pliki` i kolejki. Komponent
  `PozycjaListy` przeniesiony do dialogu; doszła sekcja „Ostatni import" z wynikiem per plik
  i podglądem 5 pozycji.
- `rebuild/frontend/test/konfiguracja.test.tsx` — przepisana część o wgrywaniu (szkielet zakładek
  bez zmian): 7 testów zastąpionych 17 nowymi.
- `docs/tickets/49-CHORE-i14a-wgrywanie-reczne/plan.md` — plan ticketa.

`detekcja.ts` i `wgrywanie.ts` **nie wymagały zmian** — `przeanalizujPlik`, `wymusDostawce`
(który już ustawia dokładnie to, co oryginał: `pewnosc: "wymuszona"`, `powod: "Wymuszone z UI (KOD)"`)
i `wgrajPlik` pokryły potrzeby dialogu bez modyfikacji.

## Ustalenia z oryginału warte zapamiętania

- **Wariant „Importuj do katalogu" (`:19171`) to MARTWA GAŁĄŹ — nie został sportowany.** Propsy
  `prostoDoKatalogu` i `buttonLabel` istnieją w deklaracji `Cd` (`:18853-18855`), ale `Cd` jest
  w całym bundlu wołane dokładnie dwa razy (`:26157`, `:26190`) i żadne wywołanie ich nie
  przekazuje. `prostoDoKatalogu` domyślnie `false`, więc etykieta zawsze brzmi „Importuj do
  staging", a trzeci argument `sP(e,t,n)` nie jest w ciele funkcji nawet czytany (`:18821-18848`).
- **Zakładka nie była ruszana żadną z czterech łatek FE.** Bloki `JT` i `Cd` w żywym bundlu
  `mirror/frontend/assets/index-PRICEFMT1783512500.js` są znak w znak zgodne z deminifikatem
  z 13.08, a liczniki wszystkich charakterystycznych stringów identyczne. Ostrzeżenie roadmapy
  o nieaktualnym deminifikacie dla TEJ zakładki nie ma zastosowania.
- **`odrzuconeBrakDanych` oryginał sumuje, ale nigdy nie wyświetla** (`:19141` vs `:19148`).
  Odtworzone wraz z komentarzem, żeby nikt tego „nie naprawił" dopisaniem członu do toasta.
- **Tytuł sekcji nie ma słowa „dostawcy"** („Wgraj wiele plików — auto-detekcja"), a tytuł dialogu
  ma („…— auto-detekcja dostawcy"). Oba przepisane z bundla 1:1, mimo że opis karty cytował
  wariant z „dostawcy" dla obu.

## Odstępstwa od planu

Zakres i wszystkie decyzje D1–D7 zrealizowane zgodnie z `plan.md`. Dwa uzupełnienia wykonane
po review, poza literą planu:

1. **Unieważnienia cache idą po KAŻDYM udanym pliku, nie raz na końcu.** Krok 2 planu mówił
   „unieważnienia jak dziś", a „dziś" znaczyło: raz, po pętli. Oryginał robi je wewnątrz `sP()`,
   czyli po każdym pliku (`:18838-18842`) — i to ma znaczenie przy decyzji D7, bo po imporcie
   przerwanym błędem pozycje zapisane wcześniej muszą być widoczne w stagingu i katalogu.
   Poprawka przybliża kod do oryginału, nie oddala.
2. **Sekcja „Ostatni import" jest zerowana/odświeżana także po błędzie.** Plan opisywał tylko
   ścieżkę sukcesu; bez tego po nieudanym imporcie pod kaflami wisiałby wynik POPRZEDNIEJ próby
   obok toasta „Błąd importu". Sekcja jest naszym dodatkiem (D4), więc nie ma tu ograniczenia
   wierności — jest powód, żeby nie mylić.

## Świadome odstępstwa od oryginału (zatwierdzone w planie)

| # | Odstępstwo | Powód |
|---|---|---|
| D2 | brak przedimportowej tabeli podglądu 8 poz./12 kol. | nie parsujemy w przeglądarce (3f-1) |
| D4 | wynik + podgląd 5 poz. w sekcji „Ostatni import" pod kaflami, poza dialogiem | konsekwencja D2; dialog zachowuje się 1:1 (zamyka się i czyści listę) |
| D6 | „CSV i XLSX (separator ; lub ,) — do 50 MB każdy", `accept` z XLSX | rebuild realnie przyjmuje XLSX i 50 MB (MO8/MO10) |
| — | select dostawcy z `/api/dostawcy`, nie zahardkodowane `MO1…MO10` (`:19017`) | odstępstwo ISTNIEJĄCE z 3f-1, zostawione |
| — | brak klienckiego wpisu do dziennika `qb()` (`:10275-10288`) | proteza oryginału nadpisująca cache `/api/history`; rebuild ma dziennik z backendu |

Zachowania odtworzone 1:1 mimo pokusy „poprawienia": kafle bez filtrowania (D5 — dostawcę
wyłączonego z importu odrzuca backend), przerwanie pętli na pierwszym błędzie importu
z pozostawieniem otwartego dialogu (D7), brak komunikatu przy pustej liście dostawców.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka kontraktu.** Zmiany wyłącznie
  w warstwie widoku `rebuild/frontend/`; `git diff --name-only origin/develop` daje cztery pliki,
  żaden w `contract/**` ani `rebuild/backend/**`. Żadne wywołanie API nie powstało ani się nie
  zmieniło — `wgrajPlik()` i zapytanie `GET /api/dostawcy` zostały nietknięte.
  Odnotowane przy okazji: `POST /api/dostawcy/{kod}/upload` (`contract/openapi.yaml:19314-19328`)
  **nie ma fixture** — multipartu nie dało się nagrać, kontrakt deklaruje `200` bez schematu.
  Kształt odpowiedzi jest wiążąco znany tylko z kodu (oryginał `backend-index.cjs:48277-48281`
  ≡ port `rebuild/backend/src/routes/suppliers.ts:213-221` ≡ typ `WynikUploadu`). To luka
  w siatce bezpieczeństwa, nie regres tej karty — do follow-upu.
- **Unit/komponentowe:** ✓ 761 testów w 48 plikach, wszystkie zielone (cały pakiet frontendu).
  W `test/konfiguracja.test.tsx`: 24 testy (było 14), z czego 17 dotyczy wgrywania.
- **Bramki FE:** ✓ `npm run lint`, ✓ `npm run typecheck`, ✓ `npm run build`, ✓ `npm test`.
- **Bramki backendu:** N/D (karta czysto FE).

Co pokrywają nowe testy: kształt sekcji (przycisk zamiast inline'u, kafle z kodem/nazwą/e-mailem),
otwarcie modala, detekcja i ręczne nadpisanie dostawcy wewnątrz dialogu, wymuszenie dostawcy
z kafla (plik o nazwie MO1 leci pod MO3), oba warianty tytułu toasta, sklejanie tylko niezerowych
członów separatorem `" • "`, toast „Błąd pliku …" z pominięciem tylko wadliwego pliku, brak
licznika w etykiecie przycisku (regresja „Wgraj (0)"), zamknięcie dialogu i wyczyszczenie listy
po sukcesie, oraz pozostawienie dialogu otwartego po błędzie importu.

## Breaking changes

Brak zmian kontraktu. Zmiana jest widoczna dla użytkownika (inny układ zakładki) i **usuwa
`data-testid`**, na których mogły opierać się zewnętrzne skrypty: `input-pliki` i `powod-detekcji`
żyją teraz wyłącznie wewnątrz modala, a `button-wyslij`, `bledy-wczytania` i `blad-uploadu`
zniknęły (zastąpione przez `button-importuj` i toasty). W repo nikt poza przepisanym plikiem
testowym ich nie używa.

## Poprawki po review

Review nie zgłosiło ani jednego BLOCKER-a. Naprawione wszystkie SHOULD-FIX:

- **Unieważnienia cache w pętli** (patrz „Odstępstwa od planu" pkt 1) — rozjazd z `:18838-18842`.
- **Wyniki częściowe oddawane rodzicowi także przy błędzie** (pkt 2) — sekcja pod kaflami
  pokazuje TĘ próbę, nie poprzednią.
- **`<input type="file">` zeruje `value` po odczytaniu.** To jeden trwały węzeł DOM (oryginał
  renderuje dwa osobne inputy, `:18921` i `:18959`), więc bez resetu ponowny wybór TEGO SAMEGO
  pliku nie generował zdarzenia `change` i kończył się ciszą. Lista plików jest kopiowana przed
  resetem, bo `input.files` to żywa referencja.
- **Lista dostawców idzie propsem** zamiast `useQuery` w każdej z N+1 instancji dialogu.
- **`id` pozycji z licznika `useRef`** zamiast `Date.now()` — dwa pliki o tej samej nazwie
  i rozmiarze dodane w tej samej milisekundzie dostawały identyczny klucz, a wtedy usunięcie
  i zmiana dostawcy trafiały w obie pozycje naraz.
- **Podświetlenie strefy zrzutu przy przeciąganiu** (`:18900-18907`) — brakujący fragment 1:1.
- **Opisy dialogu opatrzone komentarzem** o odstępstwie (D2/D4/D6), żeby następna sesja nie brała
  rozjazdu stringu za literówkę. Wariant pojedynczy mówi teraz wprost „pokaże podgląd po imporcie".
- **Trzy nowe testy:** człon „Pominięte pliki: N" (jedyny licznik kliencki i jedyna gałąź
  `continue`), urwanie pętli na pierwszym błędzie (dwa pliki → jeden upload) oraz import częściowo
  udany (wynik udanego pliku nie ginie, dialog zostaje otwarty).

Świadomie NIE zmienione z listy NICE-TO-HAVE: `pewnosc: "wymuszona"` przy ręcznym wyborze
z selecta, podczas gdy oryginał rozróżnia wybór ręczny (`pewnosc: "ręczna"`, „Wybór użytkownika",
`:19009-19013`) od wymuszenia z kafla. To rozjazd ISTNIEJĄCY od 3f-1, którego ta karta nie
wprowadziła — zmiana dotknęłaby `detekcja.ts` i testu detekcji spoza zakresu uwag Ani. Do triażu.

## Aktualizacja dokumentacji

`docs/rebuild-roadmap.md` — podblok **14a** przepisany na STAN (✅ zrobione 2026-09-18 + ID ticketa):
faktycznie dowieziony zakres, rozstrzygnięcie martwej gałęzi „Importuj do katalogu" (zastąpiło
otwarte pytanie, nie dopisane obok), dowód zgodności żywego bundla z deminifikatem dla tej
zakładki, lista świadomych odstępstw i luka „brak fixture dla uploadu".
Zgodnie z zasadą nr 2 z `CLAUDE.md` ustalenia dotyczące przyszłych bloków wpisane DO NICH:
- **14c** — ostrzeżenie, żeby NIE reużywać `DialogWgrywania.tsx` (oryginał ma na karcie dostawcy
  własny, samodzielny upload, `:25756-25802`; reużycie złamałoby też rozłączność kart) oraz
  gotowy wzorzec wywołania toasta;
- **14d** — co dokładnie zmieniło się w przepływie opisanym w §2 instrukcji testów i które
  `data-testid` zniknęły albo przeniosły się do modala.

Tablica postępu §4 i podblok 14b **nietknięte** (wiersz iteracji zamyka 14d).
`docs/rebuild-backlog.md` — bez zmian: żaden wpis nie dotyczy tej zakładki (sprawdzone `grep`em
po „wgrywan/upload/toast"; trafienia dotyczą parserów i silnika importu, nie warstwy UI).

## Follow-up

- **Brak fixture dla `POST /api/dostawcy/{kod}/upload`.** Kontrakt deklaruje `200` bez schematu,
  a `contract/fixtures/` nie ma żadnego pliku uploadu, bo multipartu nie dało się nagrać
  narzędziem `tools/record-write-fixtures.cjs`. Kształt odpowiedzi — od którego zależy cały toast
  z tej karty — jest wiążąco udokumentowany wyłącznie kodem. Warte domknięcia w osobnym tickecie
  (nagranie fixture albo dopisanie schematu do `openapi.yaml`); ta karta nie mogła tego ruszyć,
  bo `contract/` jest wspólne dla BE i FE (nauka z 13c).
- **Oryginał wysyła `format: "csv"` do dziennika także dla plików XLSX** (`sP()` → `qb()`,
  `:18841`). Odbudowa klienckiego wpisu do dziennika nie ma, więc problem jej nie dotyczy —
  odnotowane wyłącznie na wypadek, gdyby ktoś kiedyś chciał ten wpis sportować.
