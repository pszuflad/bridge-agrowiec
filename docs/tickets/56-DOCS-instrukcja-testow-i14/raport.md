# 56-DOCS-instrukcja-testow-i14 — raport z realizacji

## Podsumowanie

Powstała **`docs/instrukcja-testow-I14.md`** — 13-rozdziałowa delta w konwencji
`instrukcja-testow-I13.md`, opisująca STAN trzech ekranów po zmergowaniu 14a/14b/14c, dwa
naprawione dziwactwa, jedno pozostałe, zatwierdzoną-ale-niewdrożoną zmianę EAN-a oraz
**test rozstrzygający oznaczony jako NIEWYKONANY**. `docs/instrukcja-testow-I3.md` dostała
wyłącznie banner kierujący do I14; jej treść jest nietknięta.

Karta wykryła po drodze trzy rzeczy, których nie było w założeniach: **numeracja rozdziałów
w opisie zadania odnosiła się do wersji dokumentu, której nigdy nie było w repo**;
**backlog #9/#10 był już zamknięty**, więc nie było czego rozliczać; a **14e (zmergowana
w trakcie pracy tej karty) przypisała 14d zadanie, którego karta ma wprost zakazane** —
przypisanie sprostowano.

## Zmiany

- **Nowy:** `docs/instrukcja-testow-I14.md` (463 linie) — 13 rozdziałów:
  1–2 skrót i tabela „co zobaczysz inaczej"; 3 wgrywanie ręczne (dwie ścieżki, toasty, warunki
  brzegowe); 4 staging (domyślny filtr, ukryte kolumny, konfigurator, pasek); 5 karta dostawcy
  („Synchronizuj", „Wgraj plik", częstotliwość); 6 dziwactwa **naprawione**; 7 dziwactwo
  **pozostałe** + prośba Ani; 8 zmiana **zatwierdzona, niewdrożona**; 9 **test rozstrzygający
  (NIEWYKONANY)**; 10 co jest nieaktualne w I3; 11 czego jeszcze nie ma; 12 lista kontrolna;
  13 jak zgłaszać.
- `docs/instrukcja-testow-I3.md` — **wyłącznie banner** (21 linii) po ramce „To jest STAGING".
  Treść dokumentu **nietknięta**, w szczególności 9 wystąpień „Synchronizuj teraz" ZOSTAJE.
- `docs/rebuild-roadmap.md` — podblok **14d** przepisany na STAN; **wiersz 14 w tablicy §4**
  ⬜ → 🔨 z rozliczeniem fali 1; linia „Status" bloku I14; sprostowanie przypisania w podbloku 14e.
- `docs/tickets/56-DOCS-instrukcja-testow-i14/` — `plan.md`, `raport.md`, `review.md`.
- `docs/rebuild-backlog.md` — **BEZ ZMIAN** (uzasadnienie niżej).

`git diff --name-only origin/develop` zwraca wyłącznie powyższe — zero plików spoza własności
karty, zero zmian w `rebuild/` i `contract/`.

## Odstępstwa od planu

Plan zrealizowany, z trzema uzupełnieniami wymuszonymi przez stan repo:

1. **Rebase na `origin/develop` w trakcie pracy.** Karta **14e** (`53-CHORE-i14e-diagnoza-promocji`)
   została zmergowana, gdy instrukcja była już napisana, i też ruszała roadmapę. Rebase przeszedł
   bez konfliktu; podbloki 14d i 14e współistnieją.
2. **Poprawiona linia „Status" bloku I14** (poza literą własności — plan wymieniał tylko podblok
   14d i wiersz §4). Powód: nagłówek bloku mówił „14a i 14b idą równolegle, 14d czeka na ich
   domknięcie", co po zamknięciu fali 1 jest nieprawdą, a to **pierwsza linia, którą czyta
   następna sesja**. Edycja obejmuje wyłącznie tę jedną listę punktowaną.
3. **Sprostowane przypisanie zadania w podbloku 14e** — patrz „Rozbieżności" pkt 3.

## ⚠ Rozbieżności wykryte wobec założeń karty

### 1. Numeracja rozdziałów w opisie zadania dotyczyła dokumentu, którego nie ma w repo

Opis karty operował numeracją z wersji Ani (2026-09-02, 17 rozdziałów). **Wersja w repo ma
8 rozdziałów** i nie zawiera trzech z pięciu rzeczy, które karta kazała zrobić. Zweryfikowane
`grep`em po `docs/instrukcja-testow-I3.md`:

| Polecenie karty | Odpowiednik w wersji repo |
|---|---|
| „pkt 12 (WULSTBAND) — WYKREŚL" | **nie istnieje** (0 trafień na `wulst`) |
| „pkt 13 (`nro`/`cho`) — WYKREŚL" | **nie istnieje** (0 trafień) |
| „NIE wykreślaj testu rozstrzygającego" | **nie istnieje** (0 trafień) |
| „pkt 4 (zapis naukowy) — PRZEPISZ" | istnieje, ale jako **§4 poz. 4** |
| „pkt 10 (status dostawcy) — ZOSTAW" | istnieje, ale jako **§4 poz. 11**, nie 10 |
| „rozdział Czego jeszcze NIE MA" | istnieje jako **§5** |
| rozdz. „Świadome ODSTĘPSTWA" (10 poz.) | **nie istnieje** |
| ściąga dziesięciu dostawców | **nie istnieje** |

Rozdział 4 ma **11 pozycji, nie 13**. Rozstrzygnięcie po decyzji D1: „wykreślić" zrealizowano
jako **opisanie w I14 rozdz. 6, że obie pozycje są zamknięte** (z liczbami z pomiaru),
a „nie wykreślać testu rozstrzygającego" jako **dopisanie go od zera** (I14 rozdz. 9).
Fakt zapisany w roadmapie w podbloku 14d.

### 2. Backlog #9 i #10 — nie było czego rozliczać (zgodnie z ostrzeżeniem karty)

Potwierdzone w `docs/rebuild-backlog.md`. Oba wpisy mają status: *„2026-09-01: Ania wdrożyła fix
produkcyjny (…) ✅ sportowane i POTWIERDZONE pomiarem w `42-CHORE-i13a-resync-parserow`
(2026-09-08)"*. **Backlog nietknięty.**

⚠ **Rozbieżność do odnotowania:** opis podbloku 14d w roadmapie mówił „Backlog #9/#10 do
rozliczenia" — **błędne założenie**, wpisy były zamknięte od 2026-09-08, czyli **dziesięć dni
przed** założeniem tej karty. Opis w roadmapie sprostowany.

### 3. 14e przypisała 14d zadanie, którego karta ma zakazane

Zmergowana w trakcie pracy karta 14e wpisała do roadmapy dwa sprostowania do
`docs/instrukcja-testow-I4.md` z adnotacją *„do zrobienia przez **14d**"*. Opis tej karty mówi
wprost przeciwnie: *„⚠ NIE ruszaj `docs/instrukcja-testow-I4.md` — to zależy od kart 14f/14h/14i,
których jeszcze nie ma"*.

**Rozstrzygnięcie:** decyzja użytkownika wygrywa; `instrukcja-testow-I4.md` **nietknięta**.
Przypisanie w podbloku 14e sprostowane na **kartę domykającą falę 2**, z zapisem, czyja to
decyzja i dlaczego (oba sprostowania opisują stan, który 14f ma zmienić — opisanie go Ani teraz
znaczyłoby opisanie stanu, który za chwilę przestanie obowiązywać). To dokładnie przypadek,
przed którym ostrzega `CLAUDE.md` pkt 3: **zakres przypisany z nazwy, nie z tego, co karta
realnie robi.**

### 4. Sprostowanie liczbowe wobec raportu researchera

Sekcja „W tabeli stagingu" w konfiguratorze kolumn ma **10 przełączników**, nie 9. Policzone
w `rebuild/frontend/src/pages/staging/kolumny.ts`: 12 kolumn tabeli minus `checkbox` i `akcje`
(`zablokowana`, bez przełącznika) = 10, z czego 7 domyślnie widocznych i 3 ukryte.
Do instrukcji trafiła liczba z kodu.

## Decyzje użytkownika

- **D1 — forma dokumentu.** Rozważane: (A) aktualizacja wersji 8-rozdziałowej, (B) odtworzenie
  w repo wersji 17-rozdziałowej. Wybrane po wyjaśnieniu zakresu: **ani A, ani B — osobna, krótka
  delta `instrukcja-testow-I14.md`** opisująca tylko to, co się zmieniło i co Ania ma
  zweryfikować ponownie. ⚠ **Świadomy koszt, zakomunikowany przed wyborem: rozjazd
  z 17-rozdziałowym dokumentem Ani NIE znika** — patrz Follow-up.
- **D2 — treść wyłącznie z weryfikowalnych źródeł repo.** Nic nie zmyślone.
- **D3 — stary I3 zostaje, dostaje banner.** Poza bannerem nietknięty.

## Wyniki weryfikacji

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Karta jest czysto
  dokumentacyjna: `git diff --name-only origin/develop` zwraca cztery pliki, wszystkie w `docs/`.
  Zero zmian w `rebuild/`, `contract/` i w schemacie bazy. Żaden endpoint, kształt odpowiedzi
  ani fixture nie został dotknięty, więc gate nie ma czego rozliczać.
- **Bramki kodu: N/D** — `lint`/`typecheck`/`build`/`test` nie uruchamiane, bo nie ma zmian
  w kodzie; uruchomienie ich dowodziłoby wyłącznie stanu `develop`, nie tej karty.
- **Weryfikacja stringów UI: ✓** — każdy cytowany w instrukcji literał sprawdzony `grep`em
  w `rebuild/frontend/src/` na tej gałęzi. Potwierdzone m.in.: „Wgraj pliki", „Wgraj plik",
  „Importuj do staging", „Dodaj kolejny plik", „Wgrywanie pojedyncze (z wymuszonym dostawcą)",
  „Wgraj wiele plików — auto-detekcja", „Ostatni import", „Szukaj po kodzie, nazwie, dostawcy
  lub EAN...", „Widoczne kolumny (staging)", „Akceptuj widoczne", „Odrzuć widoczne",
  „Synchronizuj", „Inna wartość (minuty)…", „Plik wczytany", „Nowe produkty", „Import
  zakończony", „Błąd importu", „Te kolumny nie są jeszcze wyświetlane…", oraz wszystkie
  osiem członów toasta podsumowania i separator `" • "`.
- **Weryfikacja liczb: ✓** — 10 przełączników „W tabeli stagingu" (7+3), 49 „Dodatkowe",
  3 kolumny domyślnie ukryte, kolejność 9 nagłówków domyślnych; liczby z pomiaru 13a
  (MO1 199, MO3 44, MO9 12) przepisane z backlogu #9/#10.
- **Weryfikacja odsyłaczy do I3: ✓** — wszystkie numery sekcji przywołane w I14 rozdz. 10
  i w bannerze istnieją. Mapowanie 9 wystąpień „Synchronizuj teraz" na sekcje sprawdzone
  po numerach linii: `:190,198,205` → §3.10 · `:215` → §3.11 · `:249` → §3.12 ·
  `:296,297` → §3.13 · `:387` → §4 pkt 11 · `:430` → §6.
  (Nauka z 14b: roadmapa powoływała się na §9.1/§9.3, których w dokumencie nie ma.)
- **Weryfikacja stanu iteracji: ✓** — rozdział „Czego jeszcze NIE MA" skonfrontowany z tablicą
  §4 i z listą tras w `rebuild/frontend/src/App.tsx`. Usunięte jako nieaktualne: historia,
  alerty, atrybuty, analityka, narzuty i promocje, zakładki Konfiguracji, automatyczne
  pobieranie cenników. Zostawione: daty promocji (14f), EAN naukowy (14i), status dostawcy
  w dwóch polach (#18), Selly REST (13d), „cena na zapytanie".
- **Dwie nieścisłości znalezione i poprawione w trakcie:** I3 §2 mówi dosłownie „Wgraj",
  nie „Wgraj (N)" (licznik był w odbudowie, nie w instrukcji); ramka „Czego tu jeszcze nie ma"
  z §2 twierdzi, że zakładki Konfiguracji są puste — oba dopisane do I14 rozdz. 10.

## Breaking changes

Brak. Zmiany wyłącznie dokumentacyjne.

Jedna zmiana **widoczna dla czytelnika**: `docs/instrukcja-testow-I3.md` otwiera się teraz
ramką „CZĘŚCIOWO NIEAKTUALNE — najpierw przeczytaj instrukcję Iteracji 14".

## Follow-up

Rzeczy zauważone i **świadomie** odłożone:

1. **⚠ Rozjazd z 17-rozdziałowym dokumentem Ani ZOSTAJE.** To bezpośrednia konsekwencja D1,
   zakomunikowana użytkownikowi przed wyborem. Wersja, którą Ania wypełniała (2026-09-02:
   ściąga dziesięciu dostawców, „Świadome ODSTĘPSTWA" ×10, „Dziwactwa ODTWORZONE CELOWO" ×13),
   **nadal nie istnieje w repo** i przy każdej kolejnej iteracji trzeba będzie tłumaczyć
   numerację z jednego dokumentu na drugi — tak jak w tej karcie. Domknięcie: poprosić Anię
   o jej plik i wciągnąć go do repo albo świadomie uznać deltę za docelowy format.
2. **`docs/instrukcja-testow-I4.md` — nietknięta i częściowo nieaktualna.** Dwa sprostowania
   zmierzone przez 14e (§4 pkt 6 jest nieprawdziwy; defekt odwrotny — promocja „zaplanowana"
   nigdy się nie włącza — nigdzie nieopisany) czekają na **kartę domykającą falę 2**.
   Przypisanie sprostowane w roadmapie, patrz „Rozbieżności" pkt 3.
3. **Test rozstrzygający wciąż niewykonany.** Instrukcja go opisuje (rozdz. 9) i daje tabelę
   do wypełnienia, ale **wykonać go może tylko Ania** — wymaga dostępu do starego Bridge
   i tych samych plików cennika. MO9 jest niewykonalny z zasady (dane z API, brak pliku).
   To zadanie dla niej, nie dla kolejnej karty.
4. **Brak fixture dla `POST /api/dostawcy/{kod}/upload`** — zgłoszone niezależnie przez 14a
   i 14c, trasa jest już używana przez dwa ekrany opisane w tej instrukcji (kafle dostawców
   i przycisk na karcie dostawcy), a jej kształt odpowiedzi jest udokumentowany wyłącznie kodem.
   Ta karta nie mogła tego ruszyć (`contract/` poza własnością). **Nadal otwarte.**
5. **Rozjazd `pewnosc: "wymuszona"` vs „ręczna"** przy ręcznym wyborze dostawcy z selecta
   (zgłoszony przez 14a, istniejący od 3f-1). Instrukcja opisuje etykiety takimi, jakie Ania
   zobaczy dziś — jeśli rozjazd zostanie naprawiony, rozdz. 3.1 wymaga jednej poprawki.

## Poprawki po review

Review: **0 BLOCKER, 0 SHOULD-FIX, 2 NICE-TO-HAVE** (`review.md`). Rozliczenie:

- **✓ Naprawione (znalezione NIEZALEŻNIE od review, poza jego listą) — etykieta „1 dzień"
  nie istnieje w kodzie.** Review zadeklarowało sprawdzenie jedenastu presetów częstotliwości
  i nie zgłosiło rozbieżności, ale `formatujCzestotliwosc()`
  (`rebuild/frontend/src/pages/konfiguracja/dostawcy.ts:36-40`) dla 1440 minut zwraca
  `` `${Math.round(1440/1440)} dni` `` = **„1 dni"**, a select renderuje właśnie tę funkcję
  (`Dostawcy.tsx:425-429`). Instrukcja podawała „1 dzień" — czyli napis, którego Ania nie
  znajdzie na ekranie. Zweryfikowane wykonaniem funkcji na całej liście presetów:
  `5 min · 15 min · 30 min · 1 godz. · 2 godz. · 4 godz. · 6 godz. · 12 godz. · 1 dni · 2 dni · 7 dni`.
  Poprawione i **opatrzone ostrzeżeniem**, że „1 dni" jest odtworzone 1:1 i nie należy go
  zgłaszać jako literówki.
- **✓ Naprawione (NICE-TO-HAVE) — brak instrukcji sprzątania po teście wymuszonego dostawcy.**
  Test z rozdz. 3.2 celowo tworzy źle przypisane pozycje; bez instrukcji zostawałyby
  w poczekalni i myliły przy kolejnych przebiegach. Dopisana ścieżka: filtr „Wszystkie" →
  szukajka „MO3" → „Odrzuć zaznaczone".
- **Zostawione świadomie (NICE-TO-HAVE) — stara sekcja §5 w `instrukcja-testow-I3.md` nie ma
  przekreślonych pozycji „Historia"/„Atrybuty".** To bezpośrednia konsekwencja decyzji D3
  (I3 nietknięta poza bannerem) i konwencji I13 („starsze instrukcje zostają bez zmian").
  Banner na górze I3 wymienia §5 wprost jako nieaktualny i kieruje do I14 rozdz. 11, gdzie
  lista jest poprawna. Reviewer sam ocenia to jako nieistotne.

## Aktualizacja dokumentacji

`docs/rebuild-roadmap.md` — rozliczona w ramach karty (podblok 14d na STAN, wiersz 14 w §4
⬜ → 🔨, linia „Status" bloku I14, sprostowanie przypisania w podbloku 14e). Szczegóły w
„Zmiany" i „Rozbieżności".

`docs/rebuild-backlog.md` — sprawdzone wpisy #9, #10, #11, #18; **żaden nie wymagał zmiany**.
#9 i #10 zamknięte 2026-09-08, #11 ma zapisaną decyzję Ani z 2026-09-18 z adnotacją „karta
niezałożona" (14i), #18 ma status „odtworzone, opisane Ani w instrukcji" — ta karta ten opis
przeniosła do I14 rozdz. 7 wraz z notą o oczekującej decyzji.

**⚠ Doc-checkerów świadomie NIE uruchomiono.** Opis karty podaje zamkniętą listę własności
plików (`instrukcja-testow-I3.md` / nowy plik, `docs/tickets/<ID>/**`, podblok 14d i wiersz §4
roadmapy, ewentualnie backlog). Delegowanie aktualizacji pozostałych dokumentów oznaczałoby
edycję plików spoza tej listy — przy równolegle idących kartach 14f/14h/14i to jest dokładnie
to ryzyko, przed którym karta ostrzega. Zamiast tego przeprowadzono **audyt tylko do odczytu**
i jego wynik idzie do Follow-up.

### Wynik audytu — co jeszcze jest nieaktualne poza własnością tej karty

`grep -rn "Synchronizuj teraz" docs/` (z pominięciem `docs/tickets/`) daje **sześć wystąpień
w trzech dokumentach**, wszystkie nieaktualne po 14c:

| Plik | Linie | Kontekst |
|---|---|---|
| `docs/instrukcja-testow-I6.md` | `:49, :50, :58, :125` | scenariusz alertów — instrukcja każe Ani klikać przycisk pięć razy pod starą nazwą |
| `docs/instrukcja-testow-I10.md` | `:56` | przygotowanie danych do analityki |
| `docs/przeglad-12-widokow.md` | `:198` | pozycja listy kontrolnej przeglądu widoków |

⚠ **`docs/instrukcja-testow-I6.md` jest najpilniejszy** — to instrukcja scenariuszowa, a nie
wzmianka: krok „kliknij Synchronizuj teraz jeszcze cztery razy" jest nie do wykonania pod
nazwą, której nie ma na ekranie.

Sprawdzone i **czyste**: `docs/spec-frontend.md` (zero wystąpień, nie opisuje domyślnego filtra
stagingu ani starego przepływu wgrywania), `docs/spec-backend.md`, `docs/cutover.md`.
`docs/instrukcja-testow-I10.md:56` wspomina „Konfiguracja → Dostawcy → **Wgraj plik**" —
ten przycisk **od 14c realnie istnieje**, więc ta akurat wzmianka stała się prawdziwa.

**Zapisane też w roadmapie** (podblok 14d), żeby wynik audytu doszedł do następnej sesji,
a nie został tylko w raporcie tej karty.
