# 64-FEATURE-i14f-daty-koncza-promocje — daty kończą promocję (wygaszacz statusu) + potwierdzenie usuwania

> Status: Implemented
> Branch: `feature/64-i14f-daty-koncza-promocje`
> Worktree: `.worktrees/64-FEATURE-i14f-daty-koncza-promocje`

## Ticket description

14f, największa karta Iteracji 4 (blok I14, fala 2). Wejście biznesowe: Ania, 2026-09-18 —
„data ma naprawdę kończyć promocje". Wariant wdrożenia i trzy rozstrzygnięcia były PODJĘTE przez
użytkownika przed startem karty:

1. **Wariant (b): wygaszacz przestawia `status` w bazie.** Silnik nietknięty — dalej patrzy
   wyłącznie na `status`. Zmieniają się DANE, nie zachowanie porównywanej funkcji.
   `promocjaPasuje` (`repos/ceny.ts:121`) zostaje bez zmian (odrzucony wariant (a)).
2. **Wygaszacz odpala się przy starcie procesu, na wejściu `przeliczCenyZRegul` ORAZ cyklicznie.**
3. **`status` zostaje odcięty od `POLA_EDYTOWALNE_PROMOCJI`.**

Zadania karty: (1) zmierzyć, czy cykliczność jest darmowa dla charakteryzacji; (2) wygaszacz
działa w OBIE strony (także `zaplanowana → aktywna`); (3) odcięcie `status` bez wpadnięcia
w pułapkę `DEFAULT 'aktywna'`; (4) sprzątanie po znaczniku rozbieżności; (5) potwierdzenie
przy usuwaniu reguły, z liczbą dotkniętych produktów.

Źródła: `docs/rebuild-backlog.md` #19, `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md`,
blok I14 w `docs/rebuild-roadmap.md`.

## Context

**Defekt #19 to nie „silnik ignoruje daty" w oderwaniu od reszty, tylko brak przeliczania statusu
w czasie.** `status` promocji jest zapisywany RAZ, przy tworzeniu (`POST` liczy go z dat),
`PATCH` go nie wysyła (siedem pól, 1:1 z `Eb()`), a nic po stronie serwera nigdy go nie przelicza.
Silnik JUŻ honoruje `status` — zmierzone w 14e. Stąd wariant (b): wpisanie właściwego `status`
do bazy wyłącza rabat bez tknięcia silnika.

**Defekt odwrotny, znaleziony przez 14e:** skoro nic nie przelicza statusu, to promocja
„zaplanowana" NIGDY SIĘ NIE WŁĄCZA — zostaje zaplanowana na zawsze. Wygaszacz musi działać
w obie strony, inaczej karta naprawi wygaszanie i zostawi niedziałające planowanie.

### ZADANIE 1 — POMIAR: cykliczność JEST darmowa dla charakteryzacji

Wynik: **0 scenariuszy z 31 (akceptacja) i 0 z 17 (bulk). Nie ma powodu zatrzymywać karty.**
Dowód w czterech krokach:

1. **Harness nie przechodzi przez `server.ts`.** `test/gate/aplikacja.ts` buduje aplikację
   wyłącznie przez `stworzApp`, bez `listen()` (HTTP idzie przez supertest). Harness
   charakteryzacji akceptacji (`test/akceptacja.charakteryzacja.test.ts`) woła nawet niżej —
   bezpośrednio funkcję repo `zatwierdzPozycjeStagingu`, bez HTTP. Kod oryginału do porównania
   wycina z bundla `test/charakteryzacja/akceptacja/oryginal.mjs` i uruchamia wprost.
2. **Timery w tym projekcie mieszkają TYLKO w `server.ts`** — precedens schedulera dostawców,
   decyzja użytkownika 2026-09-01 (`src/import/scheduler.ts` nagłówek, `server.ts:51`).
   `stworzScheduler` jest bezczynne, dopóki nikt nie zawoła `uruchom()`.
3. **Repo już MECHANICZNIE tego pilnuje.** `test/scheduler.test.ts:194-201` asercjuje, że źródło
   `app.ts` nie zawiera ani `stworzScheduler`, ani **`setInterval`** — czyli istniejący test
   złapie każdą próbę wstawienia timera wygaszacza do fabryki aplikacji. Siatka jest już na miejscu.
4. **`db/snapshot.db` ma 0 wierszy w `promotions`** — potwierdzone pomiarem na kopii pliku
   (teza 14e prawdziwa). Cykliczny przebieg nie ma czego zmutować w trakcie porównania.

Wniosek: wygaszacz cykliczny startowany z `server.ts` jest dla harnessu niewidoczny, dokładnie
jak wygaszacz startowy. Widoczne dla testów jest wyłącznie wywołanie na wejściu
`przeliczCenyZRegul` — a to, zgodnie z grafem wywołań 14e (potwierdzonym ponownie: wołane
wyłącznie z `repos/markups.ts:113` i `repos/promotions.ts:97`), NIE leży na ścieżce importu
(`acceptStaging` → `zastosujRegulyCenowe`).

**Interwał: 5 minut** (decyzja użytkownika). Kryterium karty — okno, w którym wygasła promocja
nadal obniża cenę przy imporcie, ma być krótsze niż odstęp między importami (60 min, pięciu
dostawców) — spełnione z 12-krotnym marginesem. Koszt: jeden `UPDATE` na tabeli o rozmiarze
jednostek wierszy, 12 razy na godzinę.

### ⚠ KOREKTA DO KARTY — `ceny.silnik.test.ts` NIE jest testem do przepisania

Karta w zadaniu 4 wymienia `ceny.silnik.test.ts:246-252` (2 asercje) jako test do przepisania.
**W wariancie (b) te asercje pozostają PRAWDZIWE i test zostaje.** Woła on `promocjaPasuje`
bezpośrednio, jako jednostkę, a wariant (b) tej funkcji nie rusza — silnik nadal nie czyta dat
i taki ma zostać. Zmiany wymaga wyłącznie jego **komentarz**, który dziś mówi „żeby naprawa dat
nie przeszła kiedyś przypadkiem"; po 14f trzeba w nim napisać, że daty kończą promocję, ale
robi to wygaszacz danych, nie ta funkcja.

Zgadza się to z własną tabelą wyceny 14e, która dla (b) podaje **1** test BE do przepisania
(tylko `narzuty.patch.test.ts`), a 2 dla odrzuconego wariantu (a). Lista w zadaniu 4 karty
przepisała liczbę z kolumny (a).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Odcięcie `status` NIE wymaga zmiany `contract/` — karta NIE koliduje z 14h.** Zweryfikowane
w `contract/openapi.yaml`:

| Ścieżka | Linie | Stan |
|---|---|---|
| `POST /api/promotions` | 19686-19693 | `requestBody.content.application/json.schema: { type: object }` — **bez enumeracji pól, bez `status`, bez `required`** |
| `PATCH /api/promotions/{id}` | 19706-19717 | to samo: `schema: { type: object }` |
| `GET /api/promotions` | 19671-19685 | odpowiedź nietknięta przez tę kartę |
| `DELETE /api/promotions/{id}` | 19694-19705 | kształt nietknięty (dialog potwierdzenia jest w 100% po stronie FE) |

Kontrakt nie opisuje kształtu ciała promocji, więc zwężenie listy pól przyjmowanych przez serwer
nie narusza go w żadnym punkcie. **Do `contract/**` nie wchodzimy** (własność 14h).

Fixtures: `contract/fixtures/GET_promotions.json` to jedyny plik dotyczący promocji i ma
`body: []` — pusty, więc odcięcie pola ani wygaszacz nie zmieniają go w niczym. Fixture
pozostaje niezmieniony i musi dalej przechodzić.

Rozjazdy spec↔oryginał↔fixtures: **brak nowych.** Sprostowanie drobiazgu z 14e/roadmapy:
`zakonczona` nie występuje w `mirror/backend/index.cjs` ANI RAZU, a `zaplanowana` dokładnie raz,
w literale seeda. Teza 14e („napisy padają wyłącznie w danych seeda") zostaje prawdziwa, ale
dotyczy w praktyce jednego napisu, nie dwóch.

## Decisions

Decyzje wykonywane (podjęte przez użytkownika przed startem karty):

- **D1. Wariant (b) — wygaszacz przestawia `status` w bazie.** `promocjaPasuje` nietknięte.
  Uzasadnienie z 14e: brak wyjątku w wyroczni charakteryzacji, o jeden test mniej do przepisania,
  brak kłamiącego znacznika, odtwarza regułę, którą system już stosuje przy tworzeniu promocji.
- **D2. Wygaszacz odpala się w trzech miejscach:** start procesu, wejście `przeliczCenyZRegul`,
  cyklicznie. **NIE na ścieżce importu** (`zastosujRegulyCenowe`) — to zrównałoby koszt z (a)
  i rozjechało dwie tabele naraz.
- **D3. `status` odcięty od `POLA_EDYTOWALNE_PROMOCJI`** — pole staje się WYLICZANYM.

Decyzje podjęte w Q&A tej karty (2026-09-18):

- **D4. Interwał cyklu: 5 minut**, przełącznik `PROMO_WYGASZACZ_MINUTY`, `0` wyłącza.
  12-krotny margines wobec 60-minutowego odstępu importów.
- **D5. Wygaszacz domyślnie WŁĄCZONY** — świadome odejście od wzorca `IMPORT_SCHEDULER`
  (domyślnie wyłączonego). Powód rozróżnienia: scheduler odpytywałby REALNE serwery dostawców
  i podmieniał dane pod Anią, a wygaszacz rusza wyłącznie naszą bazę i JEST tą naprawą, o którą
  Ania poprosiła. Domyślnie wyłączony wróciłby jako zgłoszenie „daty nadal nie kończą promocji".
- **D6. Liczba dotkniętych produktów liczona silnikiem `wybierzNarzut`/`wybierzPromocje`**
  (wierny port backendu z `pages/narzuty/ceny.ts`), a NIE matcherem ostrzeżenia
  `dopasujDoOstrzezenia`. Materiał ten sam, o którym mówi karta: klienckie
  `useQuery(["/api/products"])`, wzorzec z `DialogReguly.tsx:146` i `Symulator.tsx:76`.
  **Nie dokłada czwartego sposobu dopasowania** — oba matchery już istnieją w tym pliku.
  Powód wyboru: `dopasujDoOstrzezenia` jest świadomie uproszczony (port dziwactwa oryginału,
  D6 z 4b) i dla warunków `konstrukcja`, `srednica`, `vfIf` zwraca zawsze `false` — w okienku
  potwierdzenia pokazałby „0 produktów" dla reguły, która realnie dotyka wielu. Liczymy produkty,
  dla których TA reguła jest obecnie wybierana, czyli te, których cena faktycznie się zmieni.
- **D7. Potwierdzenie usuwania obejmuje narzuty I promocje.** Obie tabele stoją w tym samym
  widoku i obie kasują dziś bez pytania; „narzut pyta, promocja nie" wyglądałoby jak błąd.

Świadome odstępstwa od oryginału w tej karcie (oryginał tego nie robi):

- **Wygaszacz statusu jako taki** — odstępstwo zatwierdzone przez Anię 2026-09-18, backlog #19
  przechodzi na ✅. Produkcja nie przelicza statusu nigdy.
- **Potwierdzenie przy usuwaniu reguły z liczbą produktów** — decyzja Ani §3.6 instrukcji I4,
  potwierdzona 2026-09-18. Oryginał kasuje bez pytania.
- **`status` przestaje być polem edytowalnym przez API** (D3) — konsekwencja wygaszacza.
- **Wygaszacz domyślnie włączony** (D5).

## Implementation plan

### Backend

1. **NOWY `src/promocje/wygaszacz.ts`** — jeden moduł, trzy eksporty:
   - `statusZDat(start, koniec, teraz = Date.now()): string` — **dokładny port**
     `pages/narzuty/status.ts:38-44`, napisy BEZ polskich znaków (`zaplanowana`, `aktywna`,
     `zakonczona`). Porównania `teraz < od` / `teraz > do_` na `new Date(x).getTime()`.
     ⚠ Zachowujemy dziwactwo parsowania: `new Date("2026-08-31")` to UTC-midnight, więc data
     końca jest już „po końcu" od swojej własnej północy UTC. Tak liczy front i tak ma liczyć
     backend — inaczej etykieta i baza znów by się rozjechały.
   - `zamiecStatusyPromocji(db, teraz = Date.now()): number` — czyta `id, start, koniec, status`
     wszystkich promocji, wylicza docelowy status, `UPDATE` **tylko tam, gdzie się różni**
     (idempotencja), zwraca liczbę zmienionych wierszy. Działa w OBIE strony (zadanie 2).
   - `stworzWygaszacz({ db, interwalMs })` → `{ uruchom, zatrzymaj, czyDziala, zamiec }` —
     kształt 1:1 ze `stworzScheduler`: sam obiekt jest bezczynny, `setInterval(...).unref()`
     (konieczne, nie kosmetyczne — wiszący timer wywraca `afterAll`), `zatrzymaj()` sprząta.
2. **`src/repos/ceny.ts`** — na WEJŚCIU `przeliczCenyZRegul` (`:233`) wywołanie
   `zamiecStatusyPromocji(db, teraz)`. `promocjaPasuje` (`:121`) i `zastosujRegulyCenowe` (`:196`)
   **bez żadnej zmiany**. To jedno wywołanie obsługuje wszystkie trzy miejsca mutacji reguł
   (`promotions.ts:67/84/91`, `markups.ts:113`) — bez powielania wywołań w repo.
3. **`src/repos/promotions.ts`**:
   - `status` **wypada** z `POLA_EDYTOWALNE_PROMOCJI` (`:23-32`);
   - ⚠ **pułapka zadania 3:** `dodajPromocje` (`:61-69`) MUSI wyliczyć
     `status: statusZDat(start, koniec)` po stronie serwera. Bez tego promocja z datą startu
     w przyszłości dostanie `aktywna` z `DEFAULT` kolumny (`db/schema.ts:198`) i NATYCHMIAST
     zacznie obniżać ceny — naprawiając jeden defekt, wprowadzilibyśmy gorszy.
4. **`src/config/env.ts`** — `PROMO_WYGASZACZ_MINUTY`, domyślnie `5`, `0` = wyłączony (D4/D5).
5. **`src/server.ts`** — `stworzWygaszacz(...)` obok `stworzScheduler(...)`; `uruchom()` wewnątrz
   callbacku `listen()` (gdy interwał > 0), `zatrzymaj()` w istniejącym `zamknij()`.
   **Nic z tego nie wchodzi do `app.ts`** — inaczej zapali się `scheduler.test.ts:194-201`.
   Jednorazowe zamiecenie przy starcie łapie wygaśnięcia z czasu postoju procesu.

### Frontend

6. **`src/pages/narzuty/status.ts`** — usunięcie znacznika (zadanie 4): pole `rozbieznosc`
   z typu `PromocjaZeStanem` (`:81`) i jego wyliczanie w `zeStanem` (`:94-100`).
   `stanZBazy` zostaje tylko jeśli ma jeszcze konsumenta (sprawdzę grepem; jeśli nie — wypada).
   `statusZDat`, `stanPromocji`, `ETYKIETY_STANU` **zostają** — badge nadal liczy się z dat,
   1:1 z produkcją. Nagłówkowy komentarz (`:4-19`) opisuje dziś stan, który ta karta likwiduje —
   przepisuję go na nowy stan rzeczy, z odwołaniem do 14f.
7. **`src/pages/narzuty/TabelaPromocji.tsx`** — usunięcie bloku znacznika (`:162-170`);
   dialog potwierdzenia przy kasowaniu (D7).
8. **`src/pages/narzuty/TabelaNarzutow.tsx`** — dialog potwierdzenia z liczbą produktów:
   `useQuery<Produkt[]>({ queryKey: ["/api/products"] })` + `wybierzNarzut` (D6),
   przez **istniejący** `components/DialogPotwierdzenia.tsx`, którego prop `children` jest wprost
   opisany jako „ostrzeżenie o liczbie produktów (D7)". Zero nowego komponentu.
9. **`src/pages/narzuty/DialogReguly.tsx`** — nota (`:549-557`) staje się nieprawdziwa.
   Przepisuję ją na prawdziwą (upływ daty końca wyłącza promocję automatycznie) zamiast usuwać:
   informacja jest dla Ani użyteczna, a test ma co asercjować.
10. **`src/pages/narzuty/api.ts`** — sprawdzam, czy typy wymagają korekty po odcięciu `status`.
    FE nadal może wysyłać `status` w `POST` (1:1 z `Cb()`); serwer go ignoruje i liczy własny.

### Kolejność commitów

BE wygaszacz + testy → BE odcięcie `status` + `dodajPromocje` + testy → BE hak w `server.ts`
+ env → FE sprzątanie znacznika i noty + testy → FE dialogi potwierdzenia + testy → docs.

## Testing strategy

**Gate odbudowy:** karta dotyka API (zwęża przyjmowane pola `POST`/`PATCH /api/promotions`),
więc gate obowiązuje. Sprawdzane: `contract/fixtures/GET_promotions.json` (`body: []`) bez zmian
oraz walidacja `POST`/`PATCH`/`DELETE /api/promotions` względem `contract/openapi.yaml`
(`schema: { type: object }` — zwężenie pól po stronie serwera jest z nim zgodne).

**Charakteryzacja ma zostać ZIELONA BEZ WYJĄTKU** — 31 scenariuszy akceptacji i 17 bulk.
Przesunięcie któregokolwiek znaczy, że wygaszacz wszedł na ścieżkę importu (patrz zadanie 1).

**NOWE testy wygaszacza** (`test/wygaszacz.test.ts`) — warunek karty, nie dodatek, bo
charakteryzacja wygaszacza NIE obejmuje:
- `statusZDat`: trzy stany + granice (przed startem, dokładnie na starcie, w środku, na końcu,
  po końcu), w tym udokumentowane dziwactwo UTC-midnight;
- zamiatanie w OBIE strony: `aktywna → zakonczona` po dacie końca **i `zaplanowana → aktywna`**
  po nadejściu startu (zadanie 2, defekt odwrotny);
- idempotencja: drugi przebieg zmienia 0 wierszy; promocja o poprawnym statusie nietknięta;
- `stworzWygaszacz` bez `uruchom()` nie stawia ANI JEDNEGO timera;
- **guard 1:1 ze wzorcem schedulera:** źródło `app.ts` nie zawiera startu wygaszacza
  (`scheduler.test.ts:194-201` już asercjuje brak `setInterval` w `app.ts` — dokładam asercję
  na nazwę fabryki, żeby intencja była jawna).
- **pułapka zadania 3:** `POST /api/promotions` z datą startu w przyszłości ląduje jako
  `zaplanowana` i NIE obniża cen, nawet gdy ciało żądania przysyła `status: "aktywna"`;
- `PATCH` nie zapisuje `status` (pole odcięte).

**Testy do przepisania:**
- `test/narzuty.patch.test.ts:318-330` — jedyny test BE, który wygaszacz realnie łapie
  (potwierdza wycenę 14e, nie zaprzecza jej). Tworzy promocję z `start: "2026-06-01"`,
  `koniec: "2026-08-31"` — daty **już przeszłe** wobec 2026-09-18, więc wygaszacz na wejściu
  `przeliczCenyZRegul` przestawi ją na `zakonczona`, zanim policzy się cena. Przepisuję daty na
  liczone względem `Date.now()`, żeby test nie gnił dalej wraz z upływem czasu.
- `test/ceny.silnik.test.ts:246-252` — **asercje ZOSTAJĄ** (patrz „Korekta do karty"), zmienia
  się wyłącznie komentarz.
- FE `test/narzuty.test.tsx:241,256` — asercje znacznika (`rozbieznosc-statusu-{id}`) znikają;
  w zamian test, że wiersz wygasłej promocji znacznika NIE pokazuje.
- FE `test/narzuty.dialog.test.tsx:393,400` — nota (`nota-daty-promocji`) na nową treść.

**NOWE testy FE:** dialog potwierdzenia przy usuwaniu narzutu i promocji — pojawia się przed
kasowaniem, „Anuluj" nie kasuje, „Potwierdź" kasuje, liczba dotkniętych produktów policzona
`wybierzNarzut`em zgadza się na danych z warunkiem, którego matcher ostrzeżenia by nie złapał
(np. `srednica`) — to asercja pilnująca D6.

**Siatki 14e zostają zielone bez zmian** — sprawdzone: `promocja-warunek-obniza-cene.test.ts`
używa dat względnych (`dzienISO(0)`/`dzienISO(30)`, `:119-121`), więc promocja jest aktywna
i wygaszacz jej nie rusza. `narzuty.edycja-toast.test.tsx` nie dotyka statusu.

**Bramki:** `lint`, `typecheck`, `build`, `test` po OBU stronach (`rebuild/backend`
i `rebuild/frontend`), bo karta rusza testy FE.

## Out of scope

- **`promocjaPasuje` / `zastosujRegulyCenowe`** — nietknięte (wariant (a) odrzucony).
- **`contract/**`** — nie wchodzimy; zweryfikowano, że nie ma potrzeby (własność 14h).
- **`routes/products.ts`, `repos/products.ts`, `pages/katalog/**`** — karta 14h, równolegle.
- **`src/import/**`, `src/historia/**`** — poza kartą.
- **`docs/instrukcja-testow-I4.md`** — jej rozdziały 4 i 5 ta zmiana unieważnia (szczególnie
  §4 pkt 6, już dziś nieprawdziwy), ale sprostowanie robi **14m**, karta domykająca falę 2.
  Odnotowane w raporcie jako follow-up.
- **Ostrzeżenie „poniżej kosztu"** i jego matcher `dopasujDoOstrzezenia` — nie zmieniamy go
  (port dziwactwa oryginału, D6 z 4b); tylko NIE używamy go do liczenia skutków usunięcia.
- **Znalezisko 14e dla cutoveru** (samo `przeliczCenyZRegul` zmienia 2050 z 7405 cen) —
  do uprzedzenia Ani, nie do naprawy tutaj.

## Definition of done

- [ ] `zamiecStatusyPromocji` ustawia `status` z dat w OBIE strony, idempotentnie
- [ ] `statusZDat` w backendzie daje napisy identyczne z `pages/narzuty/status.ts` (bez ogonków)
- [ ] Wygaszacz odpala się: przy starcie procesu, na wejściu `przeliczCenyZRegul`, cyklicznie co 5 min
- [ ] Timery NIE wchodzą do `stworzApp` (pilnuje tego test)
- [ ] `status` odcięty od `POLA_EDYTOWALNE_PROMOCJI`, a `dodajPromocje` liczy go z dat
- [ ] Promocja z datą startu w przyszłości NIE obniża cen zaraz po utworzeniu (pułapka zadania 3)
- [ ] Promocja „zaplanowana" WŁĄCZA się po nadejściu daty startu (defekt odwrotny z 14e)
- [ ] Znacznik `rozbieznosc` usunięty świadomie z `status.ts` i `TabelaPromocji.tsx`
- [ ] Nota w `DialogReguly.tsx` mówi prawdę o nowym zachowaniu
- [ ] Usuwanie narzutu I promocji pyta o potwierdzenie, z liczbą dotkniętych produktów
- [ ] Liczba produktów policzona silnikiem (`wybierzNarzut`/`wybierzPromocje`), nie matcherem ostrzeżenia
- [ ] Charakteryzacja zielona BEZ wyjątku (31 + 17 scenariuszy)
- [ ] `contract/` nietknięte; `GET_promotions.json` dalej przechodzi
- [ ] Bramki zielone po obu stronach: lint, typecheck, build, test
