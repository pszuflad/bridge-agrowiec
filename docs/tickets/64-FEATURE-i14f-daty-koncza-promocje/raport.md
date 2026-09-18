# 64-FEATURE-i14f-daty-koncza-promocje — raport z wdrożenia

## Summary

Daty naprawdę kończą promocję. Nowy wygaszacz (`promocje/wygaszacz.ts`) przestawia kolumnę
`promotions.status` na wartość wyliczoną z dat — w OBIE strony, więc wygasła promocja przestaje
obniżać ceny, a promocja „zaplanowana" wreszcie się włącza (defekt odwrotny z 14e). Silnik cen
został NIETKNIĘTY, zgodnie z wariantem (b): `promocjaPasuje` dalej nie czyta dat, zmieniły się
DANE, które dostaje — dzięki temu charakteryzacja importu przechodzi **bez ani jednego wyjątku
w wyroczni**. Do tego `status` przestał być polem edytowalnym przez API, znacznik rozbieżności
zniknął jako martwy kod, a usuwanie reguły narzutu i promocji pyta o potwierdzenie, podając liczbę
dotkniętych produktów.

## ZADANIE 1 — POMIAR: cykliczność jest darmowa (0 scenariuszy z 31 i 0 z 17)

Karta wymagała zmierzenia tego PRZED napisaniem kodu i zatrzymania się, gdyby cykliczność
wchodziła w ścieżkę charakteryzacji. Zmierzono — nie wchodzi. Dowód w czterech punktach:

1. **Harness nie przechodzi przez `server.ts`.** `test/gate/aplikacja.ts` buduje aplikację
   wyłącznie przez `stworzApp`, bez `listen()` (HTTP idzie przez supertest, żaden port nie jest
   zajmowany). Harness charakteryzacji akceptacji woła jeszcze niżej — bezpośrednio funkcję repo
   `zatwierdzPozycjeStagingu`, zupełnie bez HTTP. Kod oryginału do porównania wycina z bundla
   `test/charakteryzacja/akceptacja/oryginal.mjs` i uruchamia wprost.
2. **Timery w tym backendzie mieszkają wyłącznie w `server.ts`** — precedens schedulera
   dostawców, decyzja użytkownika z 2026-09-01. `stworzScheduler` jest bezczynne, dopóki nikt
   nie zawoła `uruchom()`; wygaszacz zbudowano dokładnie w tym kształcie.
3. **Repo pilnowało tego MECHANICZNIE, jeszcze zanim wygaszacz powstał.**
   `test/scheduler.test.ts` asercjuje, że źródło `app.ts` nie zawiera ani `stworzScheduler`,
   ani **`setInterval`** — więc każda próba wstawienia timera do fabryki aplikacji zapala
   istniejący test. Siatka była na miejscu.
4. **`db/snapshot.db` ma 0 wierszy w `promotions`** (potwierdzone pomiarem na kopii pliku,
   teza 14e prawdziwa). Cykliczny przebieg nie ma czego zmutować w trakcie porównania.

Widoczne dla testów jest wyłącznie wywołanie na wejściu `przeliczCenyZRegul` — a to, zgodnie
z grafem wywołań potwierdzonym ponownie w tej karcie (wołane tylko z `repos/markups.ts`
i `repos/promotions.ts`), nie leży na ścieżce importu (`acceptStaging` → `zastosujRegulyCenowe`).

**Interwał: 5 minut** (decyzja użytkownika), przełącznik `PROMO_WYGASZACZ_MINUTY`, `0` wyłącza
sam cykl. Kryterium karty — okno, w którym wygasła promocja jeszcze obniża cenę przy imporcie,
ma być krótsze niż odstęp między importami (60 min) — spełnione z 12-krotnym marginesem.

## Changes

### Backend

- **Nowy:** `rebuild/backend/src/promocje/wygaszacz.ts` — `statusZDat()` (dokładny port reguły
  z frontendu, łącznie z dziwactwem północy UTC i napisami bez ogonków),
  `zamiecStatusyPromocji()` (jeden przebieg, w obie strony, `UPDATE` tylko dla wierszy, które
  faktycznie się różnią) i `stworzWygaszacz()` (automat w kształcie 1:1 ze `stworzScheduler`:
  bezczynny do `uruchom()`, `setInterval(...).unref()`, `zatrzymaj()` sprząta).
- `src/repos/ceny.ts` — zamiecenie na WEJŚCIU `przeliczCenyZRegul`, przed odczytem promocji.
  `promocjaPasuje` i `zastosujRegulyCenowe` **bez zmian w kodzie**; skorygowany komentarz
  `promocjaPasuje`, który twierdził, że wygasła promocja nadal obniża ceny.
- `src/repos/promotions.ts` — `status` usunięty z `POLA_EDYTOWALNE_PROMOCJI`;
  `dodajPromocje` liczy `status` z dat po stronie serwera (domknięcie pułapki `DEFAULT 'aktywna'`).
- `src/config/env.ts` — `PROMO_WYGASZACZ_MINUTY` (domyślnie 5, `0` wyłącza cykl).
- `src/server.ts` — budowa wygaszacza, `uruchom()` w callbacku `listen()`, `zatrzymaj()`
  w istniejącym `zamknij()`. Nic z tego nie weszło do `app.ts`.
- **Nowy:** `test/wygaszacz.test.ts` — 27 przypadków (szczegóły w „Test results").
- `test/gate/dane.ts` — `PROMOCJA_TESTOWA` miała `status: "aktywna"` przy datach z przeszłości,
  czyli **sam seed kodował defekt #19**; daty liczone są teraz od dziś (`dzienISO`, wyeksportowany
  do reużycia). Bez tego dwa testy padałyby nie z powodu błędu, a dlatego że seed sobie przeczył.
- `test/narzuty.patch.test.ts` — przepisany jeden test (przeterminowane daty → względne),
  dołożone cztery nowe (pułapka `zaplanowana`, drugi kierunek wygaszacza, `status` niezapisywalny).
- `test/ceny.silnik.test.ts` — **asercje bez zmian**, przepisany komentarz (patrz „Korekta").

### Frontend

- `src/pages/narzuty/status.ts` — usunięte `rozbieznosc` (martwy kod) oraz `stanZBazy`, które
  istniało wyłącznie po to, by go zasilać. `statusZDat`, `stanPromocji`, `ETYKIETY_STANU` i sama
  etykieta z dat zostają (port 1:1 `_b()`). Przepisany nagłówek pliku.
- `src/pages/narzuty/TabelaPromocji.tsx` — usunięty blok znacznika (i niepotrzebny już import
  `AlertTriangle`); dodane potwierdzenie usuwania z liczbą produktów.
- `src/pages/narzuty/TabelaNarzutow.tsx` — potwierdzenie usuwania z liczbą produktów.
- `src/pages/narzuty/ceny.ts` — **nowe** `liczbaProduktowZNarzutem`, `liczbaProduktowZPromocja`
  i wspólne `opisLiczbyProduktow` (jedno brzmienie komunikatu dla obu tabel).
- `src/pages/narzuty/DialogReguly.tsx` — nota przy datach przepisana; stara („upływ daty sam jej
  nie wyłącza") po tej karcie jest nieprawdziwa.
- `test/narzuty.test.tsx`, `test/narzuty.dialog.test.tsx` — przepisane asercje starego zachowania,
  dołożone testy potwierdzenia, liczby produktów i braku znacznika.

**Reużycie zamiast nowego kodu:** `DialogPotwierdzenia` (`src/components/DialogPotwierdzenia.tsx`)
istniał i jego prop `children` był wprost opisany jako „ostrzeżenie o liczbie produktów (D7)" —
nie powstał żaden nowy komponent dialogu. Katalog bierzemy z tego samego
`useQuery(["/api/products"])`, z którego liczą symulator i ostrzeżenie „poniżej kosztu".

## Deviations from plan

Plan zrealizowany, z trzema uzupełnieniami wykrytymi w trakcie:

1. **`ceny.silnik.test.ts` NIE był testem do przepisania** — patrz „Korekta do karty" niżej.
   Plan to przewidywał; karta nie.
2. **`PROMOCJA_TESTOWA` w `test/gate/dane.ts` wymagała naprawy** — plan tego pliku nie
   wymieniał, bo defekt seeda wyszedł dopiero z uruchomienia testów.
3. **Jeden test FE więcej do przepisania, niż wymieniała karta** — „usuwanie NIE pyta
   o potwierdzenie" w `narzuty.test.tsx`. Karta listowała tylko znacznik i notę.

## ⚠ Korekta do karty — `ceny.silnik.test.ts` nie wymagał przepisania asercji

Zadanie 4 karty wymieniało `ceny.silnik.test.ts:246-252` (2 asercje) jako test do przepisania.
**W wariancie (b) te asercje pozostają prawdziwe i test został zachowany.** Woła on
`promocjaPasuje` bezpośrednio, jako jednostkę, a wariant (b) tej funkcji nie rusza — silnik nadal
nie czyta dat i tak ma zostać. Zmiany wymagał wyłącznie jego komentarz, który uzasadniał istnienie
testu nieaktualnym „naprawa dat nie może przejść przypadkiem"; teraz pilnuje tego, że nikt nie
dołożył warunku na daty do silnika, czyli że nie wszedł odrzucony wariant (a).

Zgadza się to z własną tabelą wyceny 14e, która dla (b) podaje **1** test BE do przepisania
(tylko `narzuty.patch.test.ts`), a 2 dla wariantu (a). Lista w zadaniu 4 karty przepisała liczbę
z kolumny odrzuconego wariantu.

## Test results

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne, bez zmian w `contract/`.**
  `POST /api/promotions` i `PATCH /api/promotions/{id}` mają w `contract/openapi.yaml`
  ciało zadeklarowane jako gołe `{ type: object }` — bez enumeracji pól, bez `status`, bez
  `required`. Zwężenie listy pól przyjmowanych przez serwer nie narusza kontraktu w żadnym
  punkcie, więc **odcięcie `status` nie wymagało wejścia do `contract/`** i nie było kolizji
  z kartą 14h. `contract/fixtures/GET_promotions.json` (`body: []`) nietknięty i dalej przechodzi
  (`test/narzuty.gate.test.ts`). Potwierdzone też mechanicznie: `git diff origin/develop --
  contract/` jest pusty.
- **Charakteryzacja: ✓ ZIELONA BEZ WYJĄTKU.** `test/akceptacja.charakteryzacja.test.ts` 36/36,
  zero przesuniętych scenariuszy, zero wyjątków w wyroczni.
- **Backend: ✓ 85 plików / 1317 testów** (przed kartą 83/1271). Lint, typecheck, build — zielone.
- **Frontend: ✓ 49 plików / 801 testów.** Lint, typecheck, build — zielone.
- **Nowe testy wygaszacza (27), bo charakteryzacja go NIE obejmuje** — to była jawna słabość
  wariantu (b) i warunek jego przyjęcia:
  granice `statusZDat` (w tym północ UTC i chwila startu), napisy bez ogonków, OBA kierunki
  zamiatania, wiele promocji w jednym przebiegu, wstrzykiwane `teraz`, idempotencja (drugi
  przebieg = 0 zmian), brak dotykania innych kolumn, bezczynność bez `uruchom()`, realne
  zamiatanie z cyklu, skuteczność `zatrzymaj()`, oraz **GATE**: brak wygaszacza w `app.ts`,
  obecność w `server.ts`, zamiatanie w `przeliczCenyZRegul` ale NIE w `zastosujRegulyCenowe`,
  i brak warunku na daty w `promocjaPasuje`.
- **Siatki z 14e zielone bez zmian:** `promocja-warunek-obniza-cene.test.ts` używa dat względnych
  (`dzienISO`), więc jej promocja jest trwająca i wygaszacz jej nie rusza;
  `narzuty.edycja-toast.test.tsx` statusu nie dotyka.

## Interakcja z kartą 14h (zmergowaną w trakcie)

W trakcie pracy do `develop` weszły dwie karty: `63-DOCS-decyzje-14f` (zapis trzech decyzji —
zgodny z tym, co karta zrealizowała, łącznie z instrukcją „najpierw ZMIERZYĆ cykliczność")
i `61-FEATURE-promocja-kolumna-katalog` (14h). Po zmergowaniu `origin/develop` obie suity
przechodzą w całości, bez konfliktów.

**Emergentny skutek dla 14h, warto go znać:** kolumna „Promocja" dopasowuje przez
`wybierzPromocje`, a ta honoruje `status`. Po 14f wygasła promocja dostaje `zakonczona`, więc
**przestanie się też pokazywać w kolumnie katalogu** — a nie tylko przestanie obniżać ceny.
To zachowanie SPÓJNE i pożądane (brak rabatu ⇒ brak odznaki), nie regresja. Komentarz 14h
„dat tu NIE czytamy" pozostaje dosłownie prawdziwy, z tego samego powodu co w `promocjaPasuje`.
Test jednostkowy 14h zasiewa promocję wygasłą ze statusem `aktywna` — stan, który po 14f nie
utrzyma się w bazie dłużej niż jeden przebieg wygaszacza, ale jako test samego matchera
pozostaje poprawny.

## Breaking changes

- **`status` przestał być polem edytowalnym w `POST`/`PATCH /api/promotions`.** Serwer liczy go
  z dat. Ciało z `status` nie daje błędu — pole jest po cichu odsiewane (zachowanie spójne
  z pozostałymi listami pól edytowalnych, backlog #14). Kontrakt niezmieniony.
- **Rada „żeby wyłączyć promocję, zmień jej status" przestaje działać.** Promocję wyłącza teraz
  data albo usunięcie. Sprostowanie instrukcji należy do **14m** (patrz Follow-up).
- **Usuwanie reguły narzutu i promocji wymaga potwierdzenia** — świadome odstępstwo (decyzja Ani
  §3.6). Jednoklikowe kasowanie z oryginału już nie działa.
- Nowa zmienna środowiskowa `PROMO_WYGASZACZ_MINUTY` — **opcjonalna**, domyślnie 5, więc
  wdrożenie nie wymaga zmian w konfiguracji.

## Review fixes applied

Review: **0 BLOCKER**, 4 SHOULD-FIX, 2 NICE-TO-HAVE. Wszystkie sześć rozliczone.

- **Brak testu odróżniającego dla D6 (SHOULD-FIX) — naprawione, słusznie zgłoszone.**
  Plan zapowiadał test z warunkiem, którego matcher ostrzeżenia nie łapie, a dostarczony test
  używał reguły GLOBALNEJ — dla takiej oba dopasowania dają ten sam wynik, więc przeszedłby nawet
  przy podpiętym złym matcherze. Dołożone dwie warstwy siatki na warunku `srednica`:
  jednostkowa w `test/narzuty.ceny.test.ts` (nowa sekcja 5, 7 przypadków — w tym kontrola
  negatywna pokazująca, że ostrzeżenie widzi na tych danych ZERO, oraz test, że liczymy produkty
  WYBIERANE, nie tylko pasujące) i komponentowa w `test/narzuty.test.tsx` (reguła po `srednica: 28`
  ⇒ dialog pokazuje 2 z 5 produktów fixture'a; zły matcher pokazałby 0).
  Obie nowe funkcje z `ceny.ts` mają teraz testy bezpośrednie, nie tylko przez UI.
- **`PROMO_WYGASZACZ_MINUTY` nieudokumentowane (SHOULD-FIX) — naprawione.** Wiersz w tabeli
  zmiennych `rebuild/backend/README.md` i sekcja w `rebuild/backend/.env.example`, obie
  z uzasadnieniem, dlaczego ta zmienna jest domyślnie WŁĄCZONA w odróżnieniu od `IMPORT_SCHEDULER`.
- **Nierozliczona roadmapa i backlog (2 × SHOULD-FIX) — rozliczone w fazie docs** (Krok 13–15),
  która następuje po review; patrz sekcja „Docs updates" niżej. Uwaga słuszna: `CLAUDE.md` wymaga,
  by statusy aktualizowała sesja realizująca, i tak się stało.
- **`plan.md` miał `Status: Draft` (NICE-TO-HAVE) — poprawione na `Implemented`.**
- **Brzmienie komunikatu dla zera (NICE-TO-HAVE) — poprawione.** Było „Żaden produkt nie jest dziś
  objęty tą regułą", co dawało się czytać jako trwałe „nigdy"; jest „Dziś ta reguła nie obejmuje
  żadnego produktu — usunięcie nie zmieni cen", czyli zdanie o skutku usunięcia TERAZ. Ma
  znaczenie właśnie dla promocji zaplanowanej i zakończonej, gdzie zero jest stanem przejściowym.

Bramki po poprawkach: BE 85 plików / 1317 testów, FE 49 / **809** (było 801, +8 nowych testów);
lint, typecheck, build zielone po obu stronach.

## Follow-up

- **`docs/instrukcja-testow-I4.md` — sprostowanie należy do 14m, NIE do tej karty** (plik poza
  własnością 14f, jawne ograniczenie w treści karty). Ta zmiana unieważnia jej rozdziały 4 i 5:
  - **§4 pkt 6** był nieprawdziwy już przed tą kartą (twierdził, że promocja z datą startu
    w przyszłości od razu obniża ceny) i po niej jest nieprawdziwy tym bardziej;
  - **§3.9** przestaje obowiązywać: promocja przestawiona na daty z 2020 już NIE zostaje
    „aktywna", bo wygaszacz ją wygasi;
  - rada „żeby wyłączyć promocję, zmień status" jest do usunięcia — pole nie jest edytowalne.
- **Uprzedzić Anię o znalezisku 14e dotyczącym cutoveru** (nie zmienione tą kartą): samo
  `przeliczCenyZRegul`, bez żadnej promocji, zmienia **2050 z 7405 cen** — prostuje pozycje
  rozjechane z aktualnym narzutem. Zachowanie oryginału, nie defekt, ale pierwszy zapis dowolnej
  reguły na produkcji będzie wyglądał jak masowa, niezamówiona zmiana cen. Po tej karcie dochodzi
  drugi powód, by uprzedzić: **pierwszy start procesu zamiecie statusy** wszystkich promocji
  z rozjechanym statusem (na produkcji dziś: tabela `promotions` jest pusta, więc realnie 0 zmian).
- **Ostrzeżenie „poniżej kosztu" nadal liczy trzecim sposobem** (`dopasujDoOstrzezenia`, backlog
  #23/#24) i jest ślepe na warunki `konstrukcja`, `srednica`, `vfIf`. Ta karta go NIE zmieniała
  (port dziwactwa oryginału, D6 z 4b) — tylko nie użyła go do liczenia skutków usunięcia.
  Ujednolicenie trzech sposobów zostaje w backlogu.
- **Niespójność wzorca env, odnotowana świadomie:** `IMPORT_SCHEDULER` jest domyślnie wyłączony,
  a `PROMO_WYGASZACZ_MINUTY` domyślnie włączony. Uzasadnienie (scheduler odpytuje CUDZE serwery,
  wygaszacz tylko naszą bazę) jest zapisane przy obu zmiennych — jeśli kiedyś powstanie wspólna
  konwencja przełączników automatów, to jest miejsce do przejrzenia.

## Docs updates

Pięć doc-checkerów równolegle, osiem plików zmienionych, wszystko w `docs/`.
`docs/instrukcja-testow-I4.md` **nietknięta** — należy do karty 14m (zweryfikowane `git status`).

### `docs/rebuild-roadmap.md` (10 edycji + nowa podsekcja)

- **14f oznaczone ✅** `64-FEATURE-i14f-daty-koncza-promocje` · 2026-09-19 w tabeli iteracji
  (~191), w opisie bloku I14 (~2158) i w tabeli kart fali 2 (wiersz przepisany na faktycznie
  dowieziony zakres, z listą plików i testów). Fala 2 opisana jako **dowieziona poza 14m**;
  przy okazji dopisane brakujące w tym wierszu 14j.
- **ZAŁOŻONA NOWA PODSEKCJA `14m`** (⬜ nie zrobione) — zgodnie z obowiązkiem „ustalenie
  dotyczące PRZYSZŁEGO bloku wpisz DO TEGO BLOKU". Zawiera, co 14f dla niej zostawia:
  unieważnione §4 pkt 6 i §3.9 instrukcji I4, radę „zmień status" do usunięcia, oraz notę
  cutoverową.
- **Rozdzielony opis PRODUKCJI od ODBUDOWY** w bloku 4b (~914-923) — to był największy
  realny ryzyk tej aktualizacji: dotąd dało się czytać, że odbudowa nadal ma defekt #19.
- **⚠ Skorygowany błędny fakt:** roadmapa twierdziła, że defekt z backlogu #88
  (`promocjaPasuje` przy pustej marce i kategorii) naprawi 14f. **Nie naprawiła** — silnik
  został świadomie nietknięty w wariancie (b). Założenie pochodziło sprzed wyboru wariantu.
- `POLA_EDYTOWALNE_PROMOCJI` poprawione z 8 na 7 pól; „14f czeka na rozstrzygnięcie #19"
  i „zostaje otwarte tylko 14f" zamienione na stan faktyczny.

### `docs/rebuild-backlog.md` (3 wpisy zmienione, 2 sprawdzone bez zmian)

- **Wpis #19 ZAMKNIĘTY** ✅ 2026-09-19, z pełną drogą (4a/4b → wycena 14e → naprawa 14f).
  **Historia diagnozy i wycena obu wariantów zachowane bez wycinania** — dopisane rozliczenie.
  Nagłówek jawnie zastrzega, że sekcja „Co robi produkcja" pozostaje prawdziwa WYŁĄCZNIE
  dla produkcji; „Uzupełnienie 4b" oznaczone jako historyczne (opisuje znacznik, którego nie ma).
- **Poprawiona nazwa w kodzie:** docs mówiły `rozbieznoscStatusu`, a pole nazywało się
  `rozbieznosc` — rozróżnienie nazwy pojęciowej od nazwy w kodzie jest teraz zapisane.
- **Sprostowana liczba:** `zakonczona` nie występuje w `mirror/backend/index.cjs` ANI RAZU,
  a `zaplanowana` dokładnie raz (dotąd: „oba padają w danych seeda").
- **#14** — `status` usunięty z wyliczonej listy pól edytowalnych promocji.
- **#24** — dopisane, że 14f dodała tylko nowego KONSUMENTA wiernego silnika; trzy sposoby
  liczenia ceny zostają trzema, czwartego nie ma.
- **#23 i #25** sprawdzone, bez zmian (dotyczą innych funkcji).

### `docs/spec-backend.md` i `docs/spec-frontend.md`

- `spec-frontend.md`: poprawiona fraza, która sugerowała, że **odbudowa** ignoruje daty —
  teraz jasno mówi, że robi to produkcja. Usunięte zdanie o „widocznym znaczniku rozbieżności".
  Dodany blok „Odbudowa (14f…)" z sześcioma zdaniami o faktycznym stanie.
- `spec-backend.md`: uzupełniony opis `POLA_EDYTOWALNE_PROMOCJI` (`status` wypadł, jest polem
  wyliczanym, `POST`/`PATCH` odsiewają je po cichu). Doc-checker świadomie NIE dopisał tam
  `PROMO_WYGASZACZ_MINUTY`, bo ten plik nie prowadzi tabeli zmiennych env — zmienna jest
  udokumentowana w `rebuild/backend/README.md` i `.env.example`.

### `docs/cutover.md`, `docs/deploy-setup.md`, `docs/przeglad-12-widokow.md`, `docs/plan.md`

- `cutover.md`: nowy akapit łączący DWA ryzyka — znalezisko 14e (pierwszy zapis reguły zmienia
  2050 z 7405 cen, nadal aktualne) oraz nowy skutek 14f (pierwszy start procesu zamiata statusy
  promocji; dziś realnie 0 wierszy, bo `promotions` na produkcji jest pusta).
- `deploy-setup.md`: `PROMO_WYGASZACZ_MINUTY` z uzasadnieniem domyślnego włączenia i wprost
  napisane, że **wdrożenie nie wymaga zmiany konfiguracji**.
- `przeglad-12-widokow.md`: przepisana nota, która mówiła, że wygasła promocja „dalej obniża
  ceny" — teraz opisuje to jako świadome odstępstwo po 14f. Potwierdzenie usuwania było tam
  już opisane poprawnie.
- `plan.md`: **bez zmian** — jawnie oznaczony jako dokument historyczny, operuje na fazach
  sprzed odbudowy. Nie przepisujemy historii.

### `docs/instrukcja-testow-I3-v2.md`, `-I7.md`, `docs/pytania-do-ani-2026-09-18.md`

- `instrukcja-testow-I3-v2.md`: sekcja 5.3 „Daty promocji — zmierzone, naprawa zaplanowana"
  przepisana na „✅ WDROŻONE kartą 14f", z **wzmianką o opóźnieniu do ~5 minut** przy samym
  upływie daty (po zapisie reguły albo restarcie — od razu). To jest jedyna rzecz, która przy
  testach może Anię zmylić, więc jest napisana wprost.
- `instrukcja-testow-I7.md` i `pytania-do-ani-2026-09-18.md`: **bez zmian**, sprawdzone grepem —
  nie zawierają twierdzeń unieważnionych tą kartą (I7 dotyczy widoku Atrybuty, wzmianki
  o „Narzuty i promocje" to tylko nazwa menu).

### Pre-existing issues

Żaden doc-checker nie zgłosił problemów sprzed tej karty. Jedyne znalezione nieprawdy wiązały
się bezpośrednio z zakresem 14f i zostały poprawione — z wyjątkiem `docs/instrukcja-testow-I4.md`,
która jest świadomie zostawiona karcie 14m (wykaz nieprawd zebrany w sekcji Follow-up).
