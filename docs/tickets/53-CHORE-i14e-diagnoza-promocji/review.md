# 53-CHORE-i14e-diagnoza-promocji — Code review

> Reviewed: 2026-09-18
> Branch: chore/53-i14e-diagnoza-promocji
> Diff: 4 pliki zmienione (plan.md, raport.md, 2 nowe pliki testowe), 4 commity

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md:20-22` — sekcja „Podsumowanie" formułuje werdykt C
  („Naprawa #19 kosztuje... Da się ją zrobić bez dotykania charakteryzacji, ale za cenę niespójności
  systemu") jako gotową rekomendację inżynierską, a nie jako materiał do decyzji. Dalej w tekście
  (sekcja C, „Wniosek do decyzji użytkownika") jest to poprawnie zrelatywizowane, ale samo
  podsumowanie na górze pliku czyta się jak zamknięta sprawa — dla kogoś, kto przeczyta tylko
  streszczenie, zaciera granicę między „zmierzone" a „polecane". Warto doprecyzować, że to opcja
  do wyboru, nie rekomendacja.
  - Reason: karta rozpoznawcza nie ma decydować za użytkownika (plan.md D1, „Poza zakresem"); samo
    podsumowanie powinno być równie ostrożne jak reszta raportu.
- [ ] `rebuild/backend/test/promocja-warunek-obniza-cene.test.ts:110-111` — daty `start: "2026-09-18"`,
  `koniec: "2026-10-18"` są zahardkodowane jako „dzisiejsze" wartości domyślne dialogu
  (`DialogReguly.tsx:129-133`, `dzisiaj()`/`zaMiesiac()`), ale liczone dynamicznie w produkcie.
  Za kilka miesięcy ten zakres dat będzie już dawno „wygasły" wg `statusZDat`, mimo że komentarz
  funkcji (`promocjaZWarunkiem`) i nazwa sugerują „to, co wysyła dialog". Test i tak przejdzie
  (silnik nie czyta dat — potwierdzone w `repos/ceny.ts`), więc to nie jest błąd funkcjonalny,
  tylko mylący ślad, który następny czytelnik może wziąć za faktyczne "wartości domyślne" dialogu.
  - Suggestion: policzyć `start`/`koniec` względem `Date.now()` (np. `new Date().toISOString()` +
    30 dni) albo dopisać jedno zdanie w komentarzu, że daty są celowo stałe i nieistotne dla wyniku.

## NICE-TO-HAVE

- [ ] `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md:71-93` — sekcja „Zasięg zmiany" jest
  dobrym przykładem czujności (rozbija 3003 na kontrolne 2050 + 954), ale liczba „2049 innych"
  (linijka 87) nie ma dalej rozbicia/wyjaśnienia — czy to dokładnie te same 2050 z kontroli minus
  1 nakładająca się z BKT, czy coś innego. Drobne, ale warto dopisać jedno zdanie dla precyzji.
- [ ] `rebuild/frontend/test/narzuty.edycja-toast.test.tsx:227-244` — test kontrolny „DODANIE
  reguły" klika `checkbox-globalny`, żeby ominąć walidację „Brak warunków"; to zależy od
  konkretnego zachowania walidacyjnego opisanego w komentarzu z odwołaniem do linii oryginału
  (`DialogReguly.tsx:306-310`, port `:24549`) — gdyby ta walidacja się zmieniła (inna karta),
  test padnie z niejasnego powodu. Rozważyć krótszy komentarz bez zależności od numerów linii
  minifikatu w teście, który ma żyć długo.

## Plan compliance

### Done ✓
- Krok 1–3 (werdykt A): pomiar na kopii `db/snapshot.db`, dwa żywe backendy (odbudowa + oryginał
  wg `tools/record-write-fixtures.cjs`), porównanie całego katalogu — zmierzone i opisane w
  `raport.md`, liczby (7405 produktów, 954 BKT, 1 dla „globalnej") zweryfikowane w tym review
  względem testu regresji, który odtwarza te same przypadki i przechodzi.
- Krok 4 (zadanie B): nowy plik `narzuty.edycja-toast.test.tsx`, 11 przypadków, wszystkie
  przechodzą (potwierdzone uruchomieniem w tym review) — zamyka lukę wskazaną w `plan.md`.
- Krok 5 (zadanie C, wycena w liczbach): liczby `31`/`17` scenariuszy charakteryzacji, `0` fixtures
  do przenagrania, `9`/`7` fixtures z polami cenowymi — zweryfikowane w tym review i zgadzają się
  z repo (`SCENARIUSZE` w `charakteryzacja/akceptacja` i `charakteryzacja/bulk`, `grep` po
  `contract/fixtures/`).
- Krok 6: nowy test backendu `promocja-warunek-obniza-cene.test.ts`, 8 przypadków, przechodzi.
- Migracje `rebuild/schema/00*.sql` sprawdzone (w tym review) — żaden `UPDATE` nie rusza
  `marka`/`cena_zakupu`/`vat`, tylko `nazwa`/`kategoria`/`konstrukcja` — potwierdza podstawę
  porównywalności cen z raportu.
- Zero zmian w kodzie produkcyjnym — potwierdzone `git diff --name-only` (tylko 2 pliki testowe
  + 2 dokumenty ticketa).
- Własność plików dotrzymana co do diffu: żaden plik spoza dozwolonej listy w `plan.md` nie został
  zmieniony (brak dotknięcia `rebuild/frontend/src/pages/narzuty/**`, `contract/**`, istniejących
  plików testowych).

### Missing or deviating ✗
- Krok 7 (dokumenty): `docs/rebuild-roadmap.md` (podblok „14e") i `docs/rebuild-backlog.md`
  (Status/fakty #19/#22/#25) **nie zostały jeszcze zaktualizowane w tej gałęzi** — `git diff`
  pokazuje zero zmian w tych plikach. Zgodnie z notatką od Mastera to zamierzone i „zaraz dojdzie";
  odnotowuję to tu jako fakt na chwilę code review, nie jako defekt karty.
- Odstępstwo D2 (plik testu FE poza pierwotnie zaplanowanym `rebuild/backend/test/`) — zgodnie
  z `raport.md` uzgodnione z użytkownikiem przed startem i udokumentowane w sekcji „Odstępstwa
  od planu"; nie traktuję jako naruszenie.

### Definition of done
- [x] Werdykt A zapisany w postaci (a), poparty pomiarem na odbudowie i na oryginale, z konkretnymi
      cenami dla nazwanych produktów BKT.
- [x] Zmierzone, ilu produktów dotyczy promocja „globalna" (1/7405, hipoteza #25 potwierdzona).
- [x] Werdykt B zapisany, poparty nowym testem FE (11 przypadków, zielone).
- [x] Wycena C: akapit z liczbami (bramki, pola, fixtures, promocje z datą startu w przyszłości).
- [x] Nowy test backendu i nowy test FE przechodzą (potwierdzone uruchomieniem w tym review);
      bramki wg raportu zielone (backend 81/1249, frontend 49/762).
- [ ] Podblok „14e" w roadmapie opisuje STAN — **jeszcze nie zrobione w tej gałęzi** (zapowiedziane
      jako kolejny krok poza tym diffem).
- [ ] Status/fakty w backlogu #19/#22/#25 zaktualizowane — **jeszcze nie zrobione w tej gałęzi**,
      z tego samego powodu co wyżej.
- [x] Zero zmian w kodzie produkcyjnym (`git diff` potwierdza).

## Parallel-test concerns

None — oba nowe pliki testowe są w pełni izolowane. Backend: `stworzTestowaBaze()` tworzy bazę
w `mkdtempSync(tmpdir())` i sprząta w `afterEach`, bez portów ani współdzielonych zasobów. Frontend:
`narzuty.edycja-toast.test.tsx` używa MSW (mocki HTTP w procesie) i lokalnego `sessionStorage`/
`queryClient.clear()` w `beforeEach`, bez sieci ani plików tymczasowych.

## Overall assessment

Karta trzyma się bardzo dokładnie własnych ograniczeń: zero zmian w kodzie produkcyjnym potwierdzone
diffem, własność plików nienaruszona, a kluczowe liczby w raporcie (31/17 scenariuszy, 0/9/7 fixtures,
8/11 przypadków testowych, brak `UPDATE` na `marka`/`cena_zakupu`/`vat` w migracjach) dają się
zweryfikować w repo i się zgadzają. Oba nowe testy są konkretne, nietautologiczne i realnie odtwarzają
zmierzone zachowanie (uruchomione w tym review — zielone). Jedyne zastrzeżenia to kosmetyczna
nieostrość w podsumowaniu raportu (werdykt C brzmi bardziej jak rekomendacja niż jak materiał do
decyzji) oraz zahardkodowane, z czasem mylące daty w teście backendu — żadne z nich nie blokuje
merge'a. Dokumenty roadmapy/backlogu z Kroku 7 planu jeszcze nie ma w tym diffie, zgodnie z zapowiedzią
Mastera.
