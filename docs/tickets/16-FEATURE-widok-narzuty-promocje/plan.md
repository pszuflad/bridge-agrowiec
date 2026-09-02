# 16-FEATURE-widok-narzuty-promocje — Iteracja 4b: widok `/narzuty` (frontend)

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/16-widok-narzuty-promocje`
> Worktree: `.worktrees/16-FEATURE-widok-narzuty-promocje`

## Opis ticketa

Sesja 4b Iteracji 4 — frontend. Backend gotowy od 4a (ticket `15-FEATURE-narzuty-promocje-ceny`,
PR #23, w `develop`). Zakres z bloku „Iteracja 4 · 4b" w `docs/rebuild-roadmap.md`: widok
`/narzuty` (reguły narzutów + promocje) oraz rozstrzygnięcie kolumny „Promocja" w `/katalog`.

## Kontekst

`/narzuty` jest dziś placeholderem (`src/pages/placeholdery.ts:26-31`,
`WidokWPrzygotowaniu`). Oryginał (`deminified/frontend-index.js`) ma tę stronę jako `VT()`
(`:25122-25152`) — dwie zakładki (`Tabs`, domyślna „narzuty"):

- **„Narzuty"** → tabela `WT()` (`:24661-24803`) **plus** „Symulator ceny" `UT()` (`:24972-25120`);
- **„Promocje"** → tabela `BT()` (`:24805-24970`);
- wspólny dialog dodawania/edycji `el()` (`:24129-24659`) z builderem warunków.

Nagłówek strony: „Narzuty i promocje" / „Konfiguracja reguł cen i czasowych rabatów".

### Ustalenia z lektury oryginału (fakty, nie decyzje)

1. **Kolumna „Promocja" w `/katalog` jest w produkcji MARTWA.** Render czyta
   `produkt._reguly?.promocja` (`:23162-23182`), a `_reguly` **nie jest ustawiane nigdzie
   w bundlu** — jedno wystąpienie w całym pliku, wyłącznie odczyt. Potwierdza to
   `contract/fixtures/GET_products.json`: żadne z 66 pól produktu nie niesie promocji ani
   rabatu. Kolumna jest już zaportowana 1:1 (`src/pages/katalog/kolumny.ts:26,83-95`,
   `katalog/formatowanie.tsx:118-138`) i pokazuje `—`. **Roadmapa opisuje 4b jako
   „dostarcza dla niej dane" — to nieprawda i wymaga sprostowania.**
2. **Status promocji JEST przeliczany z dat — ale tylko do wyświetlenia.** `Qd(start, koniec)`
   (`:9309-9314`) mapuje daty na `"zaplanowana"` / `"zakonczona"` / `"aktywna"`. Woła to
   `Cb` przy tworzeniu (`:9316+`) ORAZ `_b()` (`:9508-9514`) — przy KAŻDYM odczycie
   `/api/promotions` (`queryFn`, `:9568`). `_b()` nadpisuje `status` w lokalnej tablicy `st`,
   wsadza wynik do cache'u zapytania i woła `Gr()` — a `Gr()` zapisuje do **IndexedDB**
   (`un()`, `:9183-9193`), **NIE na serwer**. Kolumna `status` w bazie zostaje nietknięta,
   a to jej używa silnik cen backendu. **Skutek w produkcji: lista pokazuje „zakończona" przy
   promocji, którą backend nadal stosuje i która nadal obniża ceny.** Nagłówek „Status zmienia
   się automatycznie wg dat" jest więc prawdziwy o ETYKIECIE i fałszywy o SKUTKU.
   (`"zaplanowana"` w `backend-index.cjs` występuje wyłącznie w danych seed, `:45687` —
   backend statusu nie rusza.)
3. **Literówka w renderze statusu.** `Qd` produkuje `"zaplanowana"`, a badge porównuje
   z `"planowana"` (`:24825`, bez „za"), więc promocja zaplanowana wpada w gałąź `else`
   i **wyświetla się jako „zakończona"**.
4. **Trzy statusy narzutu/promocji.** Narzut przełącza się `"aktywny"` ↔ `"nieaktywny"`
   (klikalny badge w kolumnie Status, `:24756-24775`). Promocja ma `"aktywna"` /
   `"zaplanowana"` / cokolwiek innego → „zakończona”. Silnik cen backendu uznaje wyłącznie
   `"aktywny"` / `"aktywna"`.
5. **Sortowanie obu tabel:** `[...dane].sort((a, b) => b.id - a.id)` — po `id` MALEJĄCO,
   po stronie klienta. Brak paginacji, filtrów i sortowania po kolumnach.
6. **Builder warunków ma 6 typów** (`X0`, `:24143-24159`): dostawca, kategoria, marka,
   „Rozmiar (fragment tekstu)", „Bieżnik (fragment tekstu)", „Konkretny produkt (kod)".
   Silnik backendu rozumie 9 (`repos/ceny.ts` — dochodzą `konstrukcja`, `srednica`, `vfIf`).
7. **Zabezpieczenie przed sprzedażą poniżej kosztu** (`:24598`): przed zapisem promocji
   oryginał liczy po stronie klienta, które produkty zejdą z ceną sprzedaży poniżej ceny
   zakupu, i pokazuje `window.confirm` z ich listą.
8. **Oryginał trzyma reguły w lokalnym magazynie z IndexedDB** (`:9194-9570`, store `Zs`)
   z optimistic update i synchronizacją do API w tle. Żaden widok w odbudowie tak nie działa.
9. **Usuwanie nie ma potwierdzenia** — `zb(id)` leci od razu, potem toast „Reguła usunięta".

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

| Ścieżka `contract/openapi.yaml` | Fixture |
|---|---|
| `GET /api/markups` (`:709`) | `contract/fixtures/GET_markups.json` |
| `POST /api/markups` (`:717`) | — |
| `PATCH /api/markups/{id}` (`:739`) | — |
| `DELETE /api/markups/{id}` (`:728`) | — |
| `GET /api/promotions` (`:871`) | `contract/fixtures/GET_promotions.json` |
| `POST /api/promotions` (`:879`) | — |
| `PATCH /api/promotions/{id}` (`:901`) | — |
| `DELETE /api/promotions/{id}` (`:890`) | — |
| `GET /api/products` (symulator + kontrola kosztu) | `contract/fixtures/GET_products.json` |

**Ograniczenie nazwane wprost:** `GET_promotions.json` to PUSTA TABLICA — produkcja nie nagrała
ani jednego wiersza promocji. Testy widoku promocji muszą więc zasiać dane samodzielnie
(kształt ze schematu `rebuild/schema/001_schema.sql:156-168`), dokładnie jak zrobił gate
backendu w 4a. Dla narzutów `GET_markups.json` daje pełny wiersz i jest wiążący.

**Rozjazd do sprostowania:** roadmapa (blok I2 i I4b) twierdzi, że 4b „dostarcza dane" kolumnie
„Promocja". Oryginał tego nie robi i nie ma skąd — patrz ustalenie 1. Poprawka roadmapy
i wpis backlogu w Fazie 5.

## Decyzje

**D1 — kolumna „Promocja" zostaje MARTWA, port 1:1 + wpis w backlogu.**
Nie ożywiamy jej. *Za:* tak działa produkcja; ożywienie wymagałoby zduplikowania silnika
dopasowania reguł w przeglądarce, czyli drugiego miejsca, które musi zgadzać się z `ceny.ts`.
*Przeciw:* Ania dalej widzi pustą rubrykę — tak samo jak dziś w starym Bridge.
Nowy wpis backlogu opisuje martwe `_reguly`; roadmapa sprostowana.

**D2 — CRUD na React Query, bez IndexedDB. ŚWIADOME ODSTĘPSTWO.**
Wzorzec `pages/konfiguracja/Dostawcy.tsx`: mutacja → czekamy na serwer → `invalidateQueries`.
*Za:* spójność z całą odbudową (React Query jest jedynym źródłem prawdy w każdym innym widoku);
testowalne przez MSW; brak drugiego źródła prawdy. Optimistic update oryginału maskował głównie
wolny backend — a ten przy każdej mutacji przelicza ~7 400 produktów synchronicznie, więc
zamiast iluzji natychmiastowości pokażemy uczciwy stan ładowania. *Przeciw:* reguła zapisana
lokalnie, a odrzucona przez serwer, rozjeżdżałaby UI z bazą po cichu — przy mutacji dotykającej
cen całego katalogu to kosztowne, i to przesądziło.

**D3 — symulator ceny `UT()` WCHODZI do zakresu 4b.**
*Za:* to jedyne miejsce, gdzie widać, DLACZEGO cena wyszła tak, a nie inaczej — przy regule
przeliczającej cały katalog to realne narzędzie diagnostyczne; nie wymaga nowych endpointów.
Ta sama logika dopasowania obsługuje kontrolę kosztu z D6. *Przeciw:* większy zakres sesji.

**D4 — trzy świadome odstępstwa w samym widoku:**
- **ostrzeżenie przy datach promocji** — pola `start`/`koniec` dostają notę, że są informacyjne
  i że o działaniu promocji decyduje `status` (silnik dat nie czyta, backlog #19). Oryginał
  nie ostrzega;
- **builder warunków rozszerzony do 9 typów** — dochodzą `konstrukcja`, `srednica`, `vfIf`,
  które silnik rozumie, a UI oryginału nie wystawiał;
- **widoczny stan ładowania przy zapisie** — spinner i zablokowany przycisk; konsekwencja D2,
  bez optimistic update odpowiedź serwera trwa zauważalnie.

**D5 — status promocji: przeliczanie z dat 1:1 + WIDOCZNY znacznik rozbieżności.**
Portujemy `_b()`: etykieta statusu liczona z dat przy każdym odczycie `/api/promotions`,
**bez zapisu na serwer** — dokładnie jak produkcja (ustalenie 2). Do tego dwie rzeczy, które
są czystym defektem prezentacji albo jego bezpośrednim skutkiem:
- badge rozpoznaje `"zaplanowana"` i pokazuje ją jako „zaplanowana", a nie „zakończona"
  (ustalenie 3 — literówka w porównaniu, `:24825`);
- **gdy wyliczona z dat etykieta NIE zgadza się z kolumną `status` z serwera, wiersz dostaje
  widoczny znacznik rozbieżności** („wg dat zakończona, ale nadal obniża ceny" i analogicznie).
  To jest ten sam rodzaj poprawki co literówka: mechanika i dane bez zmian, znika wyłącznie
  niewidzialność defektu. Nagłówek o automatyzmie ZOSTAJE — po tej zmianie jest prawdziwy,
  bo etykieta faktycznie idzie za datami, a znacznik mówi, kiedy etykieta rozjeżdża się
  z cenami.
*Za:* zachowanie i zapisywane dane 1:1 z produkcją; defekt z backlogu #19 przestaje być
niewidoczny akurat w miejscu, gdzie Ania podejmuje decyzję. *Przeciw:* znacznik to element
interfejsu, którego produkcja nie ma.
**Świadomie NIE zapisujemy** przeliczonego statusu na serwer — to byłaby zmiana danych,
której produkcja nie robi, i wchodziłaby w kompetencje backendu (backlog #19).

**D6 — kontrola „poniżej kosztu" portowana, ale własnym dialogiem.**
Zachowujemy zabezpieczenie, jego wyliczenie i listę produktów; zamiast `window.confirm`
używamy `components/ui/dialog`. *Za:* realna wartość (jedyny moment, gdy widać skutek przed
zapisem); `window.confirm` blokuje wątek, nie da się go stylować ani testować.
*Przeciw:* wygląd inny niż w produkcji — zachowanie i treść bez zmian.

**D7 — wprowadzamy `Toaster` (decyzja implementacyjna, zgodna z konwencją repo).**
`src/App.tsx:4-7` zapisuje wprost: „`TooltipProvider` i `Toaster` dochodzą w iteracji, która
pierwsza ich użyje". Oryginalny widok `/narzuty` jest toastami sterowany (sześć wywołań:
„Reguła dodana/zaktualizowana/usunięta", „Promocja dodana/zaktualizowana/usunięta", plus błędy
walidacji). To jest ta iteracja. `Wgrywanie.tsx:79-80` zostawiło na to notę. Nie zmieniam
istniejących widoków — one dalej używają komunikatów inline.

**D8 — silnik cen po stronie klienta liczy ZGODNIE Z BACKENDEM, nie z `Mb()`.**
Oryginalny `Mb()` (`:9481-9506`) **rozjeżdża się z własnym backendem**: test „czy reguła jest
specyficzna" sprawdza PRAWDZIWOŚĆ napisu `warunki` (`"globalny" !== typ || n.warunki`, `:9485`),
a nie liczbę warunków po sparsowaniu — więc reguła z `warunki: "[]"` (dokładnie ta z
`GET_markups.json`) jest dla frontendu specyficzna, a dla backendu globalna. Przy dwóch
regułach naraz obie strony wybiorą inną. Do tego `Mb` nie ma domyślnych `priorytet ?? 50`
ani `vat ?? 23` i nie zaokrągla w dół. Nasz klient liczy jak `rebuild/backend/src/repos/ceny.ts`.
*Za:* symulator ma tłumaczyć cenę, która NAPRAWDĘ jest w katalogu — błędne wyjaśnienie jest
gorsze niż jego brak; od tej samej logiki zależy ostrzeżenie o sprzedaży poniżej kosztu (D6),
które przy regule dotykającej ~7 400 produktów musi mówić prawdę. *Przeciw:* świadome
odstępstwo od frontendu produkcji; test musi pilnować zgodności obu implementacji.
Rozbieżność oryginału opisana w backlogu (Faza 5).

## Plan implementacji

**Krok 1 — `src/components/ui/toast.tsx` + `Toaster` w `App.tsx`** (D7). Minimalny port
w stylu istniejących komponentów `ui/`, bez wciągania nowej zależności, jeśli da się oprzeć
o obecne Radix-y. Zarejestrowany w drzewie dokładnie tam, gdzie ma go oryginał.

**Krok 2 — `src/pages/narzuty/api.ts`** — typy i klient obu zasobów:
`Narzut`, `Promocja`, `Warunek`; `pobierzNarzuty`, `dodajNarzut`, `zapiszNarzut`, `usunNarzut`
i odpowiedniki promocji. **Pola wysyłane WYŁĄCZNIE z list `POLA_EDYTOWALNE_NARZUTU`
i `POLA_EDYTOWALNE_PROMOCJI`** (`rebuild/backend/src/repos/{markups,promotions}.ts`) — pole
spoza listy zostanie po cichu zignorowane przy zapisie, a mimo to trafi do audytu (4a, D2/D3).
⚠ `PATCH /api/promotions/{id}` dla nieistniejącego id oddaje **200 z PUSTYM ciałem**, więc
`odpowiedz.json()` rzuci — klient promocji czyta `text()` i parsuje warunkowo, a pusta
odpowiedź jest traktowana jak „nie znaleziono", nie jak sukces.

**Krok 3 — `src/pages/narzuty/warunki.ts`** — serializacja/deserializacja `warunki`
(STRING z JSON-em ⇄ `Warunek[]`, uszkodzony JSON → pusta lista, jak `Ji()` w oryginale),
lista 9 typów z etykietami (D4), opis reguły tekstem („Wszystkie produkty (globalny)" albo
`typ: wartosc  +  typ: wartosc`, `:24174`).

**Krok 4 — `src/pages/narzuty/ceny.ts`** — dopasowanie reguł i formuła ceny **po stronie
klienta**, port `Mb()` z oryginału, zgodny co do wyniku z `rebuild/backend/src/repos/ceny.ts`.
Zasila symulator (D3) i kontrolę „poniżej kosztu" (D6). **Jedno miejsce, nie dwa** — obie
funkcje wołają tę samą logikę.

**Krok 5 — `src/pages/narzuty/TabelaNarzutow.tsx`** — port `WT()`: kolumny „Nazwa / Warunki",
„Narzut" (`+X%`, prawa), „Status" (klikalny badge `aktywny` ↔ `nieaktywny`), akcje; badge
„GLOBALNY" przy pustych warunkach; sort `id` malejąco; stan pusty „Brak reguł narzutów.
Dodaj pierwszą regułę powyżej."; nota nagłówkowa o wygrywaniu najbardziej szczegółowej reguły
i łączeniu warunków operatorem AND. `data-testid` 1:1 (`row-markup-{id}`, `toggle-status-{id}`,
`button-edit-markup-{id}`, `button-delete-markup-{id}`).

**Krok 6 — `src/pages/narzuty/TabelaPromocji.tsx`** — port `BT()`: kolumny „Nazwa / Warunki",
„Rabat" (`−X%`), „Start", „Koniec", „Status", akcje; badge „GLOBALNA"; daty przez
`toLocaleDateString("pl-PL")`, brak daty → `—`. **Badge statusu rozpoznaje `"zaplanowana"`
(D5)**, nagłówek bez fałszywej obietnicy automatyzmu.

**Krok 7 — `src/pages/narzuty/DialogReguly.tsx`** — port `el()`: przełącznik trybu
„Narzut (stała marża)" / „Promocja (czasowy rabat)", nazwa, checkbox „Reguła globalna",
builder warunków (select typu + kontrolka wartości: **select** dla `dostawca`/`kategoria`/`marka`
zasilany danymi katalogu, **input** z kontekstowym placeholderem dla reszty), pole wartości
(„Wartość narzutu (%)" / „Rabat (%)"), daty promocji z notą z D4, walidacje („Brak warunków",
„Nieprawidłowa wartość", „Niepoprawne daty"). Przed zapisem promocji — kontrola „poniżej
kosztu" w dialogu (D6). Stan ładowania na przycisku zapisu (D4).

**Krok 8 — `src/pages/narzuty/Symulator.tsx`** — port `UT()`: wyszukiwarka produktu
i rozbicie ceny krok po kroku (zakup → narzut → rabat → VAT), na logice z Kroku 4.

**Krok 9 — `src/pages/Narzuty.tsx`** — złożenie: `PageHeader` („Narzuty i promocje" /
„Konfiguracja reguł cen i czasowych rabatów"), `Tabs` z domyślną „narzuty"
(`data-testid` `tab-narzuty`, `tab-promocje`); zakładka „narzuty" = tabela + symulator.

**Krok 10 — rejestracja:** `App.tsx` (trasa `/narzuty` na nowy komponent), usunięcie wpisu
z `placeholdery.ts`. **Liczba tras routera musi zostać 12** — komentarz w `placeholdery.ts`
mówi wprost, że to niezmiennik.

**Krok 11 — kolumna „Promocja": ZERO ZMIAN W KODZIE** (D1). Do zrobienia tylko dokumentacja:
wpis backlogu o martwym `_reguly` i sprostowanie roadmapy (Faza 5).

## Strategia testów

Wzorzec: `test/konfiguracja.dostawcy.test.tsx` + MSW (`test/msw/`), dane z fixtures przez
helpery w `test/msw/kontrakt.ts` — dokładam `narzutyZFixtura()` z `GET_markups.json`.
Dla promocji fixture jest pusty, więc dane budujemy w teście ze schematu i mówimy to wprost
w komentarzu (to słabsze świadectwo niż przy narzutach).

**`test/narzuty.test.tsx`** — widok:
- obie zakładki renderują się, „narzuty" jest domyślna;
- tabela narzutów pokazuje wiersz z fixture'a: nazwa, `+6%`, badge „GLOBALNY" przy `warunki: "[]"`,
  status `aktywny`;
- sortowanie po `id` malejąco;
- stany puste obu tabel;
- klik w badge statusu wysyła `PATCH` z `{status: "nieaktywny"}` (i odwrotnie);
- usunięcie wysyła `DELETE` i odświeża listę (**bez** okna potwierdzenia — 1:1);
- **badge `"zaplanowana"` renderuje „zaplanowana", nie „zakończona" (D5)** — test pilnujący
  naprawionej literówki;
- nagłówek zakładki „Promocje" NIE zawiera obietnicy automatyzmu statusu (D5).

**`test/narzuty.dialog.test.tsx`** — formularz:
- przełącznik trybu zmienia etykiety pól i przycisku zapisu;
- checkbox „globalna" chowa builder i wysyła `warunki` jako `"[]"`;
- builder: dodanie dwóch warunków → `warunki` leci jako **STRING z JSON-em**, nie tablica;
- **wysyłane są WYŁĄCZNIE pola z list edytowalnych** — asercja na kluczach ciała żądania;
- walidacje: brak warunków przy niezaznaczonej globalnej, wartość spoza zakresu, `koniec` < `start`;
- **9 typów warunku w selekcie (D4)** wraz z trzema dołożonymi;
- nota przy datach promocji (D4);
- **kontrola „poniżej kosztu" (D6)**: przy rabacie spychającym produkt z fixture'a poniżej
  ceny zakupu pojawia się dialog z listą; anulowanie NIE wysyła żądania, potwierdzenie wysyła;
- przycisk zapisu jest zablokowany w trakcie mutacji (D4).

**`test/narzuty.ceny.test.ts`** — logika cenowa klienta:
- zgodność z backendem co do wyniku: `floor(zakup × (1+narzut/100) × (1−rabat/100) × (1+vat/100))`,
  specyficzność bijąca priorytet, `zasieg` dopasowywany odwrotnie, VAT domyślny 23;
- deserializacja `warunki` z uszkodzonego JSON-a → pusta lista;
- **promocja z datami w przeszłości NADAL działa** — ten sam niezmiennik co w teście backendu,
  żeby obie strony nie rozjechały się przy przyszłej „oczywistej poprawce".

**`test/narzuty.api.test.ts`** — klient:
- `PATCH /api/promotions/{id}` z pustym ciałem odpowiedzi NIE rzuca i jest raportowany
  jako „nie znaleziono" (pułapka z 4a, D5 tamtej sesji).

**Bramki:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
w `rebuild/frontend/` (Node 20). Backend bez zmian — jego bramki uruchamiam kontrolnie,
żeby potwierdzić, że nic nie ruszyłem.

## Poza zakresem
- **Ożywianie kolumny „Promocja"** (D1) — port 1:1, kolumna zostaje martwa.
- **Naprawa dat promocji w silniku** — backlog #19, backend, nie ta sesja.
- **Wyliczanie statusu promocji z dat przy odczycie** (D5) — rozjechałoby listę z silnikiem.
- **Lokalny magazyn IndexedDB / optimistic update** (D2).
- **Zmiana `POLA_EDYTOWALNE_*` w backendzie** — formularz dopasowuje się do nich, nie odwrotnie.
- Migracja istniejących widoków na `Toaster` — dokładamy go, ale nie przepisujemy `Dostawcy.tsx`
  ani `Wgrywanie.tsx`.

## Definition of done
- [ ] `/narzuty` renderuje dwie zakładki z tabelami narzutów i promocji, `/narzuty` zniknęło
      z `placeholdery.ts`, liczba tras routera dalej wynosi 12
- [ ] Pełny CRUD obu zasobów przez React Query, z invalidacją i stanem ładowania (D2, D4)
- [ ] Dialog z builderem warunków (9 typów), `warunki` wysyłane jako string JSON
- [ ] Wysyłane wyłącznie pola z `POLA_EDYTOWALNE_NARZUTU` / `POLA_EDYTOWALNE_PROMOCJI`
- [ ] Klient znosi 200-z-pustym-ciałem na `PATCH /api/promotions/{id}`
- [ ] Symulator ceny działa i zgadza się co do wyniku z silnikiem backendu (D3)
- [ ] Kontrola „poniżej kosztu" przed zapisem promocji, własnym dialogiem (D6)
- [ ] Badge „zaplanowana" naprawiony, nagłówek bez fałszywej obietnicy (D5)
- [ ] Nota przy datach promocji (D4)
- [ ] Kolumna „Promocja" nietknięta; backlog i roadmapa sprostowane (D1)
- [ ] `lint`, `typecheck`, `build`, `test` czyste
