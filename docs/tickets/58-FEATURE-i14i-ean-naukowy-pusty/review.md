# 58-FEATURE-i14i-ean-naukowy-pusty — Code review

> Reviewed: 2026-09-18
> Branch: feature/58-i14i-ean-naukowy-pusty
> Diff: 4 pliki (2 kodu/testów, 2 docs), 3 commity

## BLOCKER

- [ ] `rebuild/backend/src/import/akceptacja.ts:139-141` — zerowanie `rekord.ean` następuje
  PRZED wywołaniem `assignKodImportu(sqlite, rekord, istniejacy)` (linia 200), które czyta ten
  sam `rekord.ean` do zupełnie innego celu: grupowania `kod_importu` (wielomagazynowość Selly,
  `legacy/bridge_ext.cjs:156-172`). Skutek: dla pozycji ze statusem
  `scientific_notation_uncertain` i **poprawną sumą kontrolną** (`eanIsValid: true` —
  to realny, wykonywalny przypadek, np. `8,05997E+12` → `8059970000000`, dokładnie ta sama
  wartość, którą plan.md i `test/silnik.gate.test.ts` już posługują się jako przykład), port
  **nie dziedziczy** `kod_importu` po istniejącym produkcie z tym samym EAN-em w katalogu —
  dostaje losowy nowy numer zamiast numeru grupy. Zweryfikowane uruchomieniem: dla scenariusza
  „istniejący produkt `INNY` ma `ean=8059970000000, eanIsValid=1, kodImportu=424242`, nowa
  pozycja ma ten sam rozwinięty EAN ze statusem `scientific_notation_uncertain`" —
  **oryginał** daje nowemu produktowi `kodImportu: "424242"` (dziedziczy z grupy EAN),
  **port** daje `kodImportu: "811236"` (losowy, bo `P.ean` jest już `null`, więc `eanOk` w
  `assignKodImportu` wypada `false`). To jest DRUGIE, nieudokumentowane odstępstwo — dotyka
  mechanizmu multi-warehouse, nie tylko pola `products.ean` — i nie zostało autoryzowane przez
  Anię (decyzja z 2026-09-18 mówi wyłącznie o pustym polu w katalogu). Ryzyko produkcyjne:
  ten sam produkt w dwóch magazynach dostanie różne `kod_importu` zamiast wspólnego numeru,
  co w Selly wygląda jak dwa różne produkty.
  - Reason: plan.md D1 sam przywołuje `assignKodImportu`/grupowanie po EAN jako argument
    przeciwko cięciu w `ean.ts` (wariant A), ale nie sprawdził, że wariant B ma dokładnie ten
    sam problem wewnątrz samego `akceptacja.ts` — zerowanie stoi przed, nie po,
    `assignKodImportu`. Żaden z 38/31/36 testów charakteryzacji ani `akceptacja.odstepstwa.test.ts`
    nie stawia w katalogu istniejącego produktu z pasującym EAN-em I `eanIsValid=1` jednocześnie
    ze statusem `scientific_notation_uncertain` — dlatego nic tego nie złapało. Test odstępstwa
    dodatkowo maskuje ten przypadek: `stan()` (linie 67-71) zamienia KAŻDY 6-cyfrowy
    `kodImportu` na wspólny placeholder, więc nawet gdyby scenariusz to trafił, asercja
    „reszta identyczna" (`akceptacja.odstepstwa.test.ts:120-129`) by tego nie wykryła.
  - Suggestion: przesunąć zerowanie `rekord.ean` na sam koniec (bezpośrednio przed
    `tylkoKolumnyProduktu(rekord)` / zapisem, po `assignKodImportu`, `applyNazwaPamiec`,
    `applyWagaPamiec`, `applyLinkMemory`, `rememberLink`) albo przekazać do `bridge_ext`
    prawdziwy EAN osobnym mechanizmem. Dołożyć scenariusz charakteryzacji/odstępstwa z
    istniejącym produktem w katalogu o tym samym rozwiniętym EAN-ie, `eanIsValid: 1` i
    nadanym `kodImportu`, i sprawdzić, że nowa pozycja dziedziczy ten sam `kodImportu` mimo
    pustego `ean`.

## SHOULD-FIX

- [ ] `docs/tickets/58-FEATURE-i14i-ean-naukowy-pusty/plan.md:83-85`,
  `docs/tickets/58-FEATURE-i14i-ean-naukowy-pusty/raport.md:31-32,87` — liczba „38 scenariuszy
  charakteryzacji akceptacji" się nie zgadza. `SCENARIUSZE` w
  `test/charakteryzacja/akceptacja/scenariusze.mjs` ma **31** elementów (zweryfikowane
  `SCENARIUSZE.length`), a cały `akceptacja.charakteryzacja.test.ts` ma **36** testów łącznie
  (31 z pętli + 5 dodatkowych `it` w `describe` 1 i 3). Liczba 38 wygląda na naiwny
  `grep -c "nazwa:"`, który łapie też pole `nazwa` wewnątrz `produkt()`/`narzut()`/`promocja()`
  (domyślne wartości, nie nazwy scenariuszy). Nie wpływa na poprawność zmiany (wszystkie
  faktyczne testy są zielone), ale w projekcie, który stawia na „zmierzone, nie oszacowane",
  ta konkretna liczba jest oszacowaniem, nie pomiarem.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/akceptacja.odstepstwa.test.ts:46-60` — wszystkie 7 przypadków
  (włącznie z badanym) ustawiają `eanIsValid: 0` na sztywno. Realny przypadek
  `scientific_notation_uncertain` z `eanIsValid: 1` (patrz BLOCKER) nigdy nie jest ćwiczony w
  tym pliku — dorobienie takiego przypadku zamknęłoby lukę opisaną wyżej i naturalnie
  pasowałoby do istniejącego wzorca testu.

## Plan compliance

### Done ✓
- Cięcie w `akceptacja.ts`, nie w `silnik/ean.ts` — zgodnie z D1.
- `eanRaw`/`eanIsValid`/`eanSourceStatus`/`eanCandidates` w `products` zachowane — zgodnie z D3.
- `staging_items.ostrzezenie`/`powod`/`snapshotJson` nietknięte — zgodnie z D2.
- Warunek na statusie efektywnym `rekord.eanSourceStatus` — zgodnie z D6.
- `contract/`, `silnik/ean.ts`, `tk.ts`, `test/charakteryzacja/**`, `rebuild/frontend/**` —
  potwierdzone nietknięte (`git diff --name-only` ogranicza się do `akceptacja.ts`, nowego
  testu i dwóch plików docs).
- Komentarz w kodzie opisuje decyzję, datę, backlog #11 i uzasadnienie umiejscowienia cięcia —
  zgodnie z wymogiem „odstępstwo opisane w kodzie".
- Wszystkie bramki BE (`lint`, `typecheck`, `build`, `test`) zielone — zweryfikowane
  niezależnym uruchomieniem: 82 pliki / 1256 testów, zero błędów.
- Liczby z GATE odbudowy (fixtures: 5/5/5/1 wystąpień `ean`, 0 plików ze
  `scientific_notation_uncertain`; snapshot.db: 7405/157/1/`ok:7246,NULL:157,
  no_valid_candidate:1,memory:1`) — zweryfikowane niezależnym zapytaniem do `db/snapshot.db`
  i `grep` po `contract/fixtures/`, zgadzają się co do joty.
- Kontrola mutacyjna (1 failed / 6 passed po usunięciu poprawki) — zweryfikowana niezależnie,
  zgadza się.

### Missing or deviating ✗
- Cięcie w `akceptacja.ts` faktycznie dotyka drugiego mechanizmu (`assignKodImportu`) poza
  `products.ean` — patrz BLOCKER. To nie jest deklarowane w planie ani w raporcie jako
  świadome odstępstwo, więc nie ma na to zgody Ani.
- Liczba „38 scenariuszy" w planie/raporcie nie zgadza się z rzeczywistą (31/36) — SHOULD-FIX.

### Definition of done
- [x] Pozycja stagingu ze statusem `scientific_notation_uncertain` po akceptacji daje wiersz
      w `products` z `ean IS NULL`.
- [x] `eanRaw`, `eanIsValid`, `eanSourceStatus`, `eanCandidates` w `products` zachowane.
- [x] `staging_items.ostrzezenie`/`powod` oraz `snapshotJson` niezmienione.
- [x] Status `ok` i `no_valid_candidate` zachowują się jak dotąd.
- [x] `test/charakteryzacja/silnik/*` i `silnik.gate.test.ts` — nietknięte i zielone.
- [ ] `akceptacja.charakteryzacja.test.ts` — zielone, ale liczba scenariuszy w
      dokumentacji (38) nie zgadza się z rzeczywistą (31 w pętli / 36 testów w pliku).
- [x] `contract/` bez zmian; `kontrakt.spojnosc.test.ts` i `katalog.gate.test.ts` zielone.
- [x] Bramki BE: lint, typecheck, build, test — wszystkie zielone.
- [x] Odstępstwo opisane w kodzie (komentarz z decyzją, datą i odsyłaczem do backlogu #11).
- [ ] Odstępstwo opisane jest jako „wąskie" (dotyka wyłącznie `ean`), ale w praktyce dotyka też
      `kod_importu` — opis w kodzie/raporcie tego nie ujawnia (patrz BLOCKER).
- [x] `docs/rebuild-roadmap.md` (14i) i `docs/rebuild-backlog.md` (#11) — poza zakresem tego
      diffu (nie były przedmiotem tego review, plan zakładał ich aktualizację jako krok 4;
      nie sprawdzano w tym przebiegu, bo nie ma ich w diffie `origin/develop...HEAD`).

## Parallel-test concerns

None — wszystkie testy używają `stworzTestowaBaze()` (unikalny katalog tymczasowy przez
`mkdtempSync`), zmienna modułowa `otwarte` w `akceptacja.odstepstwa.test.ts` jest bezpieczna,
bo testy w pliku nie są uruchamiane z `.concurrent`, a `afterEach` poprawnie sprząta nawet po
padniętym teście (zweryfikowano uruchomieniem z celowo usuniętą poprawką — plik nie zostawił
osieroconych katalogów tymczasowych).

## Overall assessment

Kierunek (cięcie w `akceptacja.ts`, nie w `ean.ts`) jest trafny i dobrze uzasadniony —
argumentacja o `tk.ts:302-305` i dopasowaniu po znormalizowanym EAN-ie jest prawdziwa i
zweryfikowana w oryginale. Problem w tym, że ten sam typ ryzyka (EAN jako klucz grupowania),
który słusznie wykluczył wariant A, materializuje się także w wariancie B — tyle że jedno
wywołanie niżej, w `assignKodImportu`. To realna, wykonywalna luka (zademonstrowana
uruchomieniem obu wersji na tej samej bazie), a nie tylko teoretyczne ryzyko, i obecne testy —
łącznie z nowym plikiem odstępstwa — jej nie łapią, częściowo dlatego, że maskują akurat ten
typ różnicy (`kodImportu` → placeholder). Reszta wykonania jest solidna: liczby w
raporcie/planie dot. gate'u i snapshotu się zgadzają, bramki są zielone, komentarze poza tym
jednym miejscem wiernie opisują oryginał.
