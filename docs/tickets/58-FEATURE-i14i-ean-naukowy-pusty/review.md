# 58-FEATURE-i14i-ean-naukowy-pusty — Code review (runda 2)

> Reviewed: 2026-09-18
> Branch: feature/58-i14i-ean-naukowy-pusty
> Diff: 5 plików (1 kod, 1 test, 3 docs), 4 commity

## Zamknięte z rundy 1

- **BLOCKER — zerowanie `rekord.ean` psuło grupowanie `kod_importu`.** ✅ Naprawione i
  zweryfikowane niezależnie. Cięcie przeniesiono z `rekord` na `doZapisu`
  (`akceptacja.ts:190-221`) — `tylkoKolumnyProduktu()` tworzy nowy obiekt (`Object.fromEntries`),
  więc `doZapisu.ean = null` NIE mutuje `rekord.ean`. `assignKodImportu()`, `applyLinkMemory()`
  i `rememberLink()` (wszystkie wołane na `rekord`, nie na `doZapisu`) widzą prawdziwy EAN.
  Powtórzyłem eksperyment z rundy 1 (produkt `INNY-MAGAZYN` z `ean=8059970000000,
  eanIsValid=1, kodImportu=424242`, nowa pozycja z tym samym rozwiniętym EAN-em i statusem
  `scientific_notation_uncertain`): port teraz dziedziczy `kodImportu: "424242"`, tak jak
  oryginał. Dodatkowo wykonałem własną kontrolę mutacyjną — cofnąłem cięcie do starego miejsca
  (na `rekord`, przed `assignKodImportu`) i uruchomiłem `akceptacja.odstepstwa.test.ts`: dokładnie
  2 testy w `describe` „grupowanie kod_importu" czerwienieją (2 failed / 7 passed), reszta
  zielona — regresja jest realnie łapana, nie „z rozpędu". Po przywróceniu poprawki drzewo
  robocze jest czyste (`git status --porcelain` puste).
- **`rememberLink()` wywołane PO zapisie z `rekord` (niewyzerowany EAN) — sprawdzone, NIE jest
  nowym problemem.** `rememberLink()` (`legacy/bridge_ext.cjs:105-122`) operuje wyłącznie na
  `P.linkZdjecia`, `P.kod`, `P.marka/model/rozmiar` — nigdzie nie czyta ani nie zapisuje `P.ean`.
  To, że dostaje `rekord` z prawdziwym EAN-em zamiast `doZapisu` z `null`, jest więc bez
  znaczenia dla tej funkcji.
- **UPDATE istniejącego produktu poprawnie nadpisuje `ean` na NULL.** Własny test (produkt `P1`
  w katalogu z `ean="5901234123457"`, nowa pozycja stagingu dla tego samego `kod` ze statusem
  `scientific_notation_uncertain`) — po `zatwierdzPozycjeStagingu` `products.ean` dla `P1` jest
  `NULL`. `doZapisu` zawiera jawny klucz `ean: null` w `SET`, więc Drizzle nadpisuje starą
  wartość, a nie pomija pole.
- **Inni konsumenci `rekord.ean` między budową rekordu a zapisem — brak.** Przejrzałem
  `zatwierdzPozycjeStagingu` do końca i zgrepowałem `.ean` w `src/repos/ceny.ts` (gałąź cenowa —
  nie odwołuje się do `ean` w ogóle) oraz w całym `bridge_ext.cjs` — jedyne dwa miejsca czytające
  `P.ean` to `_kiGroupKey()`/`assignKodImportu()`, już objęte poprawką. Blok `uwagaCena`
  (`akceptacja.ts:236-242`) czyta tylko `snapshot.uwagaCena`.
- **Liczba scenariuszy charakteryzacji akceptacji.** `plan.md`/`raport.md` mówią teraz o 31 —
  potwierdzone niezależnie (`SCENARIUSZE.length === 31` po imporcie modułu). Poprawione trwale.
- **Brak przypadku `eanIsValid: 1`.** Naprawione — nowy `describe` „grupowanie kod_importu"
  używa `eanIsValid: 1` z realną, poprawną sumą kontrolną (`8059970000000`); to właśnie ten
  przypadek ujawnił BLOCKER-a z rundy 1.

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:2479,2488` i `docs/rebuild-backlog.md` (wpis #11) — **nie zostały
  zaktualizowane**, mimo że `plan.md` krok 4 Implementation planu i ostatni punkt Definition of
  done wprost tego wymagają. `git diff origin/develop...HEAD --name-only` nie zawiera żadnego
  z tych plików. Konkretne rozjazdy: roadmapa `:2479` dalej przypisuje 14i do „BE: silnik importu
  (normalizacja EAN)" i `:2488` dalej każe „przenagrać wzorce" — dokładnie to, co `plan.md` D5
  uznaje za błędne i nakazuje poprawić; nagłówek bloku I14 (`:191`) dalej wymienia „otwarte
  14f/14h/14i", mimo że 14i jest zaimplementowane. Backlog #11: pole „Status" dalej brzmi
  „decyzja podjęta, karta niezałożona", mimo że karta istnieje i jest wdrożona.
  - Reason: to wprost DoD z `plan.md` („`docs/rebuild-roadmap.md` (14i) i
    `docs/rebuild-backlog.md` (#11) opisują STAN") i jednocześnie dokładnie ten typ błędu, przed
    którym ostrzega `CLAUDE.md` w pięciu punktach na temat aktualności roadmapy — następna sesja
    czytająca roadmapę dostanie nieaktualne przypisanie zakresu i nakaz nieautoryzowanego (i
    niewykonalnego, jak ustalił D5) przenagrywania wzorców.
  - Suggestion: zaktualizować `docs/rebuild-roadmap.md` (14i: stan „zrobione", korekta D5, numer
    ticketa 58, data) i `docs/rebuild-backlog.md` #11 (Status → wdrożone, Iteracja → 14i/58).
    To zmiana czysto dokumentacyjna, bez ryzyka dla kodu — nie blokuje technicznie, ale blokuje
    zgodność z DoD karty.

## SHOULD-FIX

- [ ] `rebuild/backend/test/akceptacja.odstepstwa.test.ts:14` — komentarz nagłówkowy dalej mówi
  „rozluźniłoby porównanie dla wszystkich **38** scenariuszy", mimo że w tej samej rundzie
  poprawek skorygowano liczbę na 31 w `plan.md` i `raport.md`. Ten jeden komentarz w kodzie
  testu został pominięty. Nie wpływa na wykonanie testu, ale utrwala tę samą oszacowaną, a nie
  zmierzoną liczbę, którą runda 1 już raz zgłosiła jako problem.
- [ ] `docs/tickets/58-FEATURE-i14i-ean-naukowy-pusty/raport.md:17` — sekcja „Changes" dalej
  mówi „7 przypadków", podczas gdy plik ma teraz 9 (potwierdzone `npx vitest run` → 9/9,
  zgodnie z `raport.md:136` „9/9"). Liczba nie została zaktualizowana po dopisaniu dwóch nowych
  testów w ramach poprawki BLOCKER-a z rundy 1 — te same dwie sekcje raportu się nie zgadzają.

## NICE-TO-HAVE

Brak nowych. Uwaga z rundy 1 (brak `eanIsValid: 1`) zamknięta.

## Plan compliance

### Done ✓
- Cięcie przeniesione na `doZapisu`, tuż przed zapisem — usuwa efekt uboczny na
  `assignKodImportu()`, zweryfikowane uruchomieniem i kontrolą mutacyjną.
- `eanRaw`/`eanIsValid`/`eanSourceStatus`/`eanCandidates` w `products` zachowane (D3).
- `staging_items.ostrzezenie`/`powod`/`snapshotJson` nietknięte (D2).
- `contract/`, `silnik/ean.ts`, `tk.ts`, `test/charakteryzacja/**`, `rebuild/frontend/**` —
  potwierdzone nietknięte (`git diff --name-only` ogranicza się do `akceptacja.ts`, nowego
  testu i trzech plików docs ticketa).
- Wszystkie bramki BE zielone, zweryfikowane niezależnym uruchomieniem: `lint` ✓, `typecheck` ✓,
  `build` ✓, `npm test` → **82 pliki / 1258 testów**, zero błędów — zgadza się co do joty z
  raportem.
- `akceptacja.charakteryzacja.test.ts`, `silnik.charakteryzacja.test.ts`, `silnik.gate.test.ts`,
  `kontrakt.spojnosc.test.ts`, `katalog.gate.test.ts` — uruchomione osobno, wszystkie zielone
  (113/113 testów łącznie w tym przebiegu).
- Liczba scenariuszy charakteryzacji (31) — zmierzona niezależnie, zgadza się z `plan.md`/
  `raport.md`.
- Test odstępstwa realnie gryzie — potwierdzone własną kontrolą mutacyjną (dwukrotnie: raz na
  starym miejscu cięcia z rundy 1 → 2 failed/7 passed; oryginalna kontrola z rundy 1 na braku
  poprawki w ogóle → wcześniej potwierdzone 1 failed/6 passed, zgodne z raportem).

### Missing or deviating ✗
- Krok 4 Implementation planu („Docs: `docs/rebuild-roadmap.md`, `docs/rebuild-backlog.md`") —
  **nie wykonany**, patrz BLOCKER.
- Dwa miejsca ze stalymi, nieodświeżonymi liczbami po poprawkach z rundy 1 (test-file komentarz
  „38", raport „7 przypadków") — SHOULD-FIX.

### Definition of done
- [x] Pozycja stagingu ze statusem `scientific_notation_uncertain` po akceptacji daje wiersz
      w `products` z `ean IS NULL`.
- [x] `eanRaw`, `eanIsValid`, `eanSourceStatus`, `eanCandidates` w `products` zachowane.
- [x] `staging_items.ostrzezenie`/`powod` oraz `snapshotJson` niezmienione.
- [x] Status `ok` i `no_valid_candidate` zachowują się jak dotąd.
- [x] `test/charakteryzacja/silnik/*` i `silnik.gate.test.ts` — nietknięte i zielone.
- [x] `akceptacja.charakteryzacja.test.ts` — 31/31 scenariuszy zielonych, bez dodanego wyjątku.
- [x] `contract/` bez zmian; `kontrakt.spojnosc.test.ts` i `katalog.gate.test.ts` zielone.
- [x] Bramki BE: lint, typecheck, build, test — wszystkie zielone.
- [x] Odstępstwo opisane w kodzie (komentarz z decyzją, datą i odsyłaczem do backlogu #11) —
      komentarz dodatkowo tłumaczy teraz umiejscowienie cięcia na `doZapisu`.
- [ ] `docs/rebuild-roadmap.md` (14i) i `docs/rebuild-backlog.md` (#11) opisują STAN — **nie
      spełnione**, patrz BLOCKER.

## Parallel-test concerns

None — wszystkie testy (nowe i istniejące) używają `stworzTestowaBaze()` (unikalny katalog
tymczasowy przez `mkdtempSync`), `afterEach` sprząta niezależnie od wyniku testu (zweryfikowano
przy własnej kontroli mutacyjnej — brak osieroconych katalogów tymczasowych po dwóch
czerwonych testach).

## Overall assessment

BLOCKER z rundy 1 jest naprawiony solidnie: miejsce cięcia jest właściwe, uzasadnienie w
komentarzu trafne i zweryfikowane niezależnie (włącznie z własną kontrolą mutacyjną cofającą
poprawkę), a nowy `describe` faktycznie łapie regresję, którą miał łapać. `rememberLink()` po
zapisie nie stanowi problemu, bo nie dotyka `ean`. Jedyne, co zostało, to dokumentacyjne resztki:
roadmapa i backlog nie zostały zaktualizowane mimo jawnego wymogu w DoD karty (co ten projekt
traktuje poważnie — patrz `CLAUDE.md`), oraz dwa drobne, nieodświeżone liczby (38 vs 31 w
komentarzu testu, 7 vs 9 w raporcie) będące śladem tego, że poprawki z rundy 1 nie zostały
domknięte we wszystkich miejscach jednocześnie. Żadne z nich nie zagraża poprawności kodu.
