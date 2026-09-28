# 64-FEATURE-i14f-daty-koncza-promocje — Code review

> Reviewed: 2026-09-19
> Branch: feature/64-i14f-daty-koncza-promocje
> Diff: 18 plików, 4 commity (`origin/develop` już wmergowany)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `docs/rebuild-backlog.md:1364` — wpis #19 nie został zamknięty przez tę kartę.
  - Reason: pole „Status" nadal brzmi „✔ odtworzone w rebuild (4a backend, 4b frontend),
    defekt zgłoszony · oba warianty wdrożenia WYCENIONE w 14e", mimo że 14f fizycznie
    dowiozła naprawę (wariant b). To dokładnie ten wzorzec błędu, przed którym ostrzega
    `CLAUDE.md` §„Roadmapa jest wejściem dla następnej sesji", obowiązek 1: „statusy wpisów
    aktualizuje ta sesja, która je realizuje, nie następna". `git diff` nie dotyka w ogóle
    `docs/rebuild-backlog.md` ani `docs/rebuild-roadmap.md`.
  - Suggestion: dopisać do wpisu #19 rozliczenie 14f (data, ID ticketa, faktyczny zakres) i
    zmienić pole „Status" na zamknięte/naprawione.
- [ ] `docs/rebuild-roadmap.md:191,2158` — blok I14 nadal wisi jako „otwarte 14f".
  - Reason: ten sam obowiązek co wyżej — roadmapa ma opisywać STAN po zamknięciu bloku, nie
    zamiar. Skoro fala 2 I14 miała zostać tylko z otwartym 14f, a ta karta go domyka, wpis
    powinien przejść na ✅ z ID ticketa `64-FEATURE-i14f-daty-koncza-promocje`, tak jak zrobiły
    to sąsiednie karty 14e/14h/14i/14j w tym samym bloku.
  - Suggestion: dopisać `14f: ✅ 64-FEATURE-i14f-daty-koncza-promocje · 2026-09-19` w obu
    miejscach (linia 191 i 2158) i przenieść notę o zamknięciu drugiej fali, jeśli to był
    ostatni otwarty punkt bloku.
- [ ] Brak dedykowanego testu FE pilnującego D6 (liczenie `wybierzNarzut`/`wybierzPromocje`
  zamiast `dopasujDoOstrzezenia`), mimo że `plan.md` („NOWE testy FE") explicite go zapowiada:
  „liczba dotkniętych produktów policzona `wybierzNarzut`'em zgadza się na danych z warunkiem,
  którego matcher ostrzeżenia by nie złapał (np. `srednica`)".
  - Reason: test `rebuild/frontend/test/narzuty.test.tsx` — „⭐ potwierdzenie podaje, ilu
    produktów dotyczy zmiana" — używa globalnej reguły z fixture'a (`warunki: "[]"`,
    `rebuild/frontend/test/narzuty.test.tsx:36-37`). Dla reguły globalnej `wybierzNarzut` i
    uproszczony `dopasujDoOstrzezenia` dają ten sam wynik, więc test przeszedłby nawet gdyby
    ktoś podpiął w `TabelaNarzutow.tsx`/`TabelaPromocji.tsx` niewłaściwy matcher. Sam kod
    produkcyjny (`rebuild/frontend/src/pages/narzuty/ceny.ts:139,148` w `TabelaNarzutow.tsx`
    i `TabelaPromocji.tsx`) poprawnie woła `wybierzNarzut`/`wybierzPromocje` — to nie jest
    błąd implementacji, tylko brak siatki, która by go złapała przy regresji.
  - Suggestion: dołożyć jeden test z regułą warunkową opartą o pole, którego
    `dopasujDoOstrzezenia` nie honoruje (np. `srednica`), i zweryfikować, że liczba produktów
    w dialogu zgadza się z `wybierzNarzut`, nie z zerem/matcherem ostrzeżenia. Analogicznie
    dla `liczbaProduktowZNarzutem`/`liczbaProduktowZPromocja` — obie funkcje w `ceny.ts` (nowe
    w tej karcie) nie mają też żadnego testu jednostkowego bezpośredniego (tylko pośredni,
    przez UI, z regułą globalną).
- [ ] `rebuild/backend/README.md` i `rebuild/backend/.env.example` nie wspominają
  `PROMO_WYGASZACZ_MINUTY`.
  - Reason: README ma tabelę zmiennych środowiskowych (`README.md:59-69`) z każdą inną opcjonalną
    zmienną, łącznie z `IMPORT_SCHEDULER*`, do którego `PROMO_WYGASZACZ_MINUTY` jest bezpośrednio
    porównywane w komentarzu kodu (`env.ts`) jako świadome odstępstwo (domyślnie WŁĄCZony).
    `.env.example` dokumentuje analogicznie każdy inny automat. Brak wpisu utrudni komuś, kto
    czyta tylko README/`.env.example` (nie kod), zrozumienie nowego zachowania „domyślnie
    5 minut, `0` wyłącza".
  - Suggestion: dodać wiersz do tabeli w README i sekcję w `.env.example`, analogicznie do
    sekcji „Scheduler importu".

## NICE-TO-HAVE

- [ ] `docs/tickets/64-FEATURE-i14f-daty-koncza-promocje/plan.md:3` — nagłówek nadal ma
  `> Status: Draft`, mimo że karta jest zaimplementowana i zmergowana z `origin/develop`.
  Kosmetyka, ale inne zamknięte tickety w tym repo zwykle aktualizują ten nagłówek.
- [ ] `rebuild/frontend/src/pages/narzuty/ceny.ts:174` — `opisLiczbyProduktow` zwraca stały
  polski tekst „Żaden produkt nie jest dziś objęty tą regułą — ceny się nie zmienią." nawet dla
  promocji `zaplanowana` (start w przyszłości) — sformułowanie sugeruje trwałe „nigdy", a dla
  zaplanowanej promocji trafniejsze byłoby coś w stylu „jeszcze nie obowiązuje". Nie blokuje —
  komunikat nie jest fałszywy (0 dziś to prawda), ale mógłby być precyzyjniejszy.

## Plan compliance

### Done ✓
- Wygaszacz (`src/promocje/wygaszacz.ts`) — `statusZDat`, `zamiecStatusyPromocji` (obie strony,
  idempotentnie), `stworzWygaszacz` (kształt 1:1 ze `stworzScheduler`, `unref()`) — zgodnie z
  planem.
- Wywołanie `zamiecStatusyPromocji` wyłącznie na wejściu `przeliczCenyZRegul`
  (`repos/ceny.ts:248`) — potwierdzone grafem wywołań (`grep`): `przeliczCenyZRegul` wołane
  tylko z `repos/markups.ts:113` i `repos/promotions.ts:122`; `zastosujRegulyCenowe` (ścieżka
  importu, `import/bulk.ts`, `import/akceptacja.ts`) nie woła ani `zamiecStatusyPromocji`, ani
  `przeliczCenyZRegul` — potwierdzone też mechanicznym testem GATE
  (`test/wygaszacz.test.ts:318-333`).
- `promocjaPasuje` nietknięte — potwierdzone diffem (tylko komentarz) i testem GATE
  (`test/wygaszacz.test.ts:340-347`).
- `status` odcięty od `POLA_EDYTOWALNE_PROMOCJI` (`repos/promotions.ts:40`), `dodajPromocje`
  liczy `status` z dat po stronie serwera — zamyka pułapkę `DEFAULT 'aktywna'`, potwierdzone
  testem `test/narzuty.patch.test.ts` „POST promocji z datą startu w PRZYSZŁOŚCI".
  `aktualizujPromocje` — status prostuje się przez `przeliczPoCichu` → `przeliczCenyZRegul`.
- `PROMO_WYGASZACZ_MINUTY` w `config/env.ts`, domyślnie 5, `0` wyłącza cykl — zgodnie z D4/D5.
- `server.ts` — `stworzWygaszacz` obok `stworzScheduler`, `uruchom()` w callbacku `listen()`,
  `zatrzymaj()` w `zamknij()`; `app.ts` pozostaje czyste (potwierdzone `grep`em i istniejącym
  `scheduler.test.ts`).
- FE: znacznik `rozbieznosc`/`stanZBazy` usunięty z `status.ts` i `TabelaPromocji.tsx`
  (`grep` na `stanZBazy`/`rozbieznosc` w `src/` nie znajduje żadnego żywego użycia, tylko
  historyczne wzmianki w komentarzach i testId asercji „NIE MA").
  `statusZDat` w FE i BE zgodne znak w znak (porównane ręcznie: identyczna formuła, identyczne
  literały `zaplanowana`/`zakonczona`/`aktywna`).
- Nota w `DialogReguly.tsx:555-560` przepisana na prawdziwą treść.
- Dialogi potwierdzenia usuwania w `TabelaNarzutow.tsx` i `TabelaPromocji.tsx`, przez istniejący
  `DialogPotwierdzenia` — zero nowego komponentu, zgodnie z planem. Liczba produktów faktycznie
  liczona `wybierzNarzut`/`wybierzPromocje` (`pages/narzuty/ceny.ts:139,148`), nie
  `dopasujDoOstrzezenia` — potwierdzone czytaniem kodu (patrz jednak SHOULD-FIX o braku testu
  to pilnującego).
- Kolejność commitów zgodna z planem (BE wygaszacz+testy → BE odcięcie status+testy →
  BE server.ts+env → FE sprzątanie+dialogi → raport).

### Missing or deviating ✗
- `docs/rebuild-backlog.md` #19 i `docs/rebuild-roadmap.md` (blok I14) nie zostały zaktualizowane
  jako zamknięte — patrz SHOULD-FIX wyżej. Plan.md tej karty nie wymienia tego jawnie w
  Implementation plan, ale to blanket-obowiązek z `CLAUDE.md`, więc traktuję jako odstępstwo od
  konwencji repo, nie od plan.md.
- Dwa uzupełnienia raportu ponad plan (opisane w `raport.md` „Deviations from plan") są zasadne
  i potwierdzone: `ceny.silnik.test.ts` NIE wymagał przepisania asercji (tylko komentarza),
  seed `PROMOCJA_TESTOWA` w `test/gate/dane.ts` wymagał naprawy dat na względne. Obie zmiany
  są spójne z resztą karty i nie budzą zastrzeżeń.

### Definition of done
- [x] `zamiecStatusyPromocji` ustawia `status` z dat w OBIE strony, idempotentnie
- [x] `statusZDat` w backendzie identyczny z portem frontendowym (bez ogonków)
- [x] Wygaszacz odpala się: start procesu, wejście `przeliczCenyZRegul`, cyklicznie co 5 min
- [x] Timery NIE wchodzą do `stworzApp` (pilnuje test + potwierdzone `grep`em)
- [x] `status` odcięty od `POLA_EDYTOWALNE_PROMOCJI`, `dodajPromocje` liczy go z dat
- [x] Promocja z datą startu w przyszłości NIE obniża cen zaraz po utworzeniu
- [x] Promocja „zaplanowana" WŁĄCZA się po nadejściu daty startu
- [x] Znacznik `rozbieznosc` usunięty świadomie z `status.ts` i `TabelaPromocji.tsx`
- [x] Nota w `DialogReguly.tsx` mówi prawdę o nowym zachowaniu
- [x] Usuwanie narzutu I promocji pyta o potwierdzenie, z liczbą dotkniętych produktów
- [x] Liczba produktów policzona silnikiem (`wybierzNarzut`/`wybierzPromocje`), nie matcherem
      ostrzeżenia — kod poprawny, ale bez dedykowanego testu odróżniającego (SHOULD-FIX)
- [x] Charakteryzacja zielona BEZ wyjątku — zmierzone: `akceptacja.charakteryzacja.test.ts`
      36/36, `produkty-bulk.charakteryzacja.test.ts` 22/22, zero `.skip`/`.todo` w obu plikach
- [x] `contract/` nietknięte — `git diff origin/develop...HEAD -- contract/` jest pusty;
      `GET_promotions.json` dalej przechodzi (w ramach `npm test`)
- [x] Bramki zielone po obu stronach — zmierzone samodzielnie, patrz niżej

## Bramki (uruchomione samodzielnie)

- **Backend** (`rebuild/backend`, Node 20.20.2): `lint` ✓, `typecheck` ✓, `build` ✓,
  `test` ✓ — **85 plików / 1317 testów**, zero failures. Zgodne z raportem.
- **Frontend** (`rebuild/frontend`): `lint` ✓, `typecheck` ✓, `build` ✓ (jeden pre-istniejący
  warning o rozmiarze chunków, niezwiązany z tą kartą), `test` ✓ — **49 plików / 801 testów**,
  zero failures. Zgodne z raportem.
- Osobno: `npx vitest run test/akceptacja.charakteryzacja.test.ts` → 36/36 ✓;
  `npx vitest run test/produkty-bulk.charakteryzacja.test.ts` → 22/22 ✓.

## Parallel-test concerns

None — wszystkie nowe testy backendu używają `stworzTestowaBaze()` (świeży katalog tymczasowy
`mkdtempSync` + `rmSync` w `posprzataj()`), bez portów ani ścieżek na sztywno. Testy
`wygaszacz.test.ts` z realnymi timerami (`setTimeout(60ms)` na interwał 10ms) używają wystarczająco
dużego marginesu i nie dzielą żadnego zasobu między testami/agentami — jedyne ryzyko to potencjalna
kruchość na bardzo obciążonej maszynie (typowe dla testów z realnym `setInterval`), nie kolizja
międzyagentowa.

## Overall assessment

Implementacja jest solidna i dokładnie realizuje wariant (b) z pełnym zrozumieniem, dlaczego
akurat te trzy miejsca wołania wygaszacza są bezpieczne dla charakteryzacji — grafy wywołań się
zgadzają, testy GATE (`wygaszacz.test.ts` sekcja 5) mechanicznie pilnują granic, a `statusZDat`
w FE i BE są bit-identyczne. Pułapka `DEFAULT 'aktywna'` (zadanie 3) jest realnie domknięta i
przetestowana, defekt odwrotny (`zaplanowana → aktywna`) też. Wszystkie bramki (lint/typecheck/
build/test) przechodzą po obu stronach z dokładnie tymi liczbami, które podaje raport, a
charakteryzacja jest zielona bez żadnego wyjątku w wyroczni. Główne zastrzeżenia to higiena
dokumentacji projektu (roadmapa/backlog nie zostały rozliczone — rzecz, przed którą `CLAUDE.md`
ostrzega wprost i wielokrotnie) oraz brakująca siatka testowa pilnująca D6 (kod jest poprawny,
ale regresja na złym matcherze przeszłaby niezauważona). Żadne z tych zastrzeżeń nie jest
blokerem funkcjonalnym — kod jest gotowy do merge po uzupełnieniu dokumentacji projektu.
