# 140-FEATURE-staging-rozstrzygnij-frontend — Code review

> Reviewed: 2026-09-23
> Branch: feature/140-staging-rozstrzygnij-frontend
> Diff: 9 plików, 2 commity (`9289e33`, `53148b9`)

## BLOCKER

- [ ] `docs/karty/I15.5/karta.md` — karta NIE jest zaktualizowana: `Stan:` nadal `⬜ po
      I15.4c (fala 4)`, sekcje „Dowiezione" i „Do koordynatora" nadal puste (`—`).
  - Reason: DoD z `plan.md` wprost wymaga „`docs/karty/I15.5/karta.md` opisuje STAN (zakres
    dowieziony, D1–D6), wejście dla I15.11 założone" — checkbox jest niespełniony, a
    CLAUDE.md pkt 1 mówi, że karta zamknięta opisuje stan, nie zamiar.
  - Suggestion: uzupełnić `Stan`, `Dowiezione` (D1–D6, zakres z raport.md) i „Do koordynatora"
    (opis punktu wejścia dla I15.11 — `⭐ PUNKT WPIĘCIA I15.11` w `OknoRozstrzygniecia.tsx`
    i przy pasku narzędzi `Staging.tsx`) przed PR-em.
- [ ] `docs/tickets/140-FEATURE-staging-rozstrzygnij-frontend/raport.md` — plik istnieje
      tylko na dysku, jest **niezacommitowany** (`git status` pokazuje `??`).
  - Reason: bez `git add`/commit raportu nie będzie w PR-ze — DoD i proces ticketowy
    wymagają raportu jako części gałęzi, nie tylko working tree.
  - Suggestion: dodać plik do commita przed pushem.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/staging/OknoRozstrzygniecia.tsx:393-397` — wspólny,
      pojedynczy stan `blad`/`<p data-testid="blad-decyzji">` renderowany raz, na końcu
      treści okna, podczas gdy oryginał (`:71-78`, `:113`, `:127-132`) tworzy DWA osobne
      elementy błędu — jeden zaraz po sekcji „stara karta", drugi zaraz po formularzu
      dopasowania — bo `absenceReview` i `matchIssue && !duplicateSource` mogą wystąpić
      RAZEM (co sam plan.md odnotowuje: „Gałęzie 1 i 2 mogą wystąpić razem").
  - Reason: w tym rzadkim, ale udokumentowanym jako możliwy przypadku (stara karta +
    niejednoznaczne dopasowanie naraz) błąd z akcji „Zapisz wybór w katalogu" pokazałby
    się w oryginale zaraz po kartach starej karty, a w porcie — na samym dole, za
    formularzem dopasowania. Treść komunikatu zostaje poprawna, zmienia się tylko miejsce.
  - Suggestion: rozważyć dwa niezależne pola stanu błędu (dla gałęzi absence i dla gałęzi
    dopasowania) renderowane w miejscach analogicznych do oryginału, albo świadomie
    odnotować to jako kolejne odstępstwo D7 w `plan.md`, skoro tekst i tak trafia do
    właściwego użytkownika.
- [ ] `rebuild/frontend/test/staging.rozstrzygnij.test.tsx` — brak testu dla scenariusza,
      w którym `absenceReview` i `matchIssue && !duplicateSource` są prawdziwe jednocześnie
      (obie gałęzie i oba przyciski zapisu naraz).
  - Reason: plan.md wprost mówi, że to możliwa kombinacja odpowiedzi backendu („Gałęzie 1
    i 2 mogą wystąpić razem"), a żadna z trzech fabryk MSW (`przegladDopasowania`,
    `przegladStarejKarty`, `przegladSprzecznychWierszy`) jej nie pokrywa — powyższy problem
    z umiejscowieniem błędu (punkt wyżej) mógł ujść uwadze właśnie z tego powodu.
  - Not parallelizable: n/d (dot. treści testu, nie zasobu).

## NICE-TO-HAVE

- [ ] `docs/karty/I15.11/` — zgodnie z CLAUDE.md pkt 2, ustalenie dla PRZYSZŁEJ karty
      (opis punktu wejścia I15.11) formalnie powinno trafić do `docs/karty/I15.11/wejscie-140.md`,
      a plan.md kieruje je do „Do koordynatora" karty I15.5 (czyli do karty ZAMYKANEJ, nie
      przyszłej). To rozbieżność między decyzją Mastera w planie a regułą CLAUDE.md — nie
      blokuje tego ticketu (komentarze `⭐ PUNKT WPIĘCIA I15.11` w kodzie i tak są), ale
      warto rozstrzygnąć przy aktualizacji karty (patrz BLOCKER wyżej).
- [ ] `rebuild/frontend/src/pages/staging/OknoRozstrzygniecia.tsx:194-195` — `kandydatDoWersji`
      liczony wprost w ciele komponentu przy każdym renderze; przy większej liczbie
      kandydatów to kosmetyka, nie problem wydajnościowy, ale warto rozważyć `useMemo`
      przy okazji kolejnych zmian w tym pliku (I15.11 i tak go dotknie).

## Plan compliance

### Done ✓
- Krok 1 — `polityka.ts`: typy, `WZORZEC_ROZSTRZYGNIECIA`, `wymagaRozstrzygniecia`,
  `etykietaRozstrzygniecia`, `rozstrzygnijDopasowanie`, `wybierzKarte`, `komunikatBledu` —
  zgodne z oryginałem znak w znak (zweryfikowane porównaniem stringów i logiki warunków
  z `88fa31c`, w tym asymetria `Number.isFinite` między `mozliwyWyborStarejKarty` a
  `mozliwyWyborKandydata`/`maSwiezyOdczyt`, zachowana świadomie).
- Krok 2 — `OknoRozstrzygniecia.tsx`: trzy rozłączne gałęzie, kolejność renderowania,
  teksty dosłowne (zweryfikowane bajt po bajcie dla polskich cudzysłowów „…", zweryfikowane
  po normalizacji białych znaków dla wieloliniowych akapitów JSX).
- Krok 3 — `OknoBlokady.tsx`: „Nie zapisano zmian", treść z serwera, jeden przycisk.
- Krok 4 — `TabelaStagingu.tsx`: przycisk za „Szczegóły" w kolumnie „Akcje", warunkowany
  `wymagaRozstrzygniecia`.
- Krok 5 — `Staging.tsx`: stan `rozstrzyganeId`/`blokada`, mutacja `akcja` z
  `{wykonaj, akceptacja}`, rozdzielenie błędu akceptacji (okno) od pozostałych (pasek) —
  odpowiednik filtra po URL-u z oryginału, bez globalnej mutacji `window.fetch` (D4).
- Krok 6 — `test/msw/staging.ts` (`handleryStagingu()`, kolejność `paged` przed `:id`
  zachowana), `staging.test.tsx` przepięty bez zmiany asercji (28/28 zielone),
  `staging.rozstrzygnij.test.tsx` — 34 testy z asercjami na dosłowną treść, ciała żądań,
  warunki blokad i sześć komunikatów 409.
- Krok 7 — komentarze `⭐ PUNKT WPIĘCIA I15.11` obecne w `OknoRozstrzygniecia.tsx` (sekcja
  „Stara karta w katalogu") i implicite przy pasku narzędzi `Staging.tsx`.
- D1–D6: wdrożone zgodnie z opisem — brak przycisku „Pozostaw starą wstrzymaną i zamknij
  sprawę", brak wywołania `close-absence-review` (pokryte testem), warunek przycisku z
  danych a nie z DOM-u, `invalidateQueries` zamiast `location.reload()`,
  `DialogPotwierdzenia` zamiast `window.confirm()`, wydzielone mocki.

### Missing or deviating ✗
- Aktualizacja `docs/karty/I15.5/karta.md` — nie wykonana (BLOCKER wyżej).
- `docs/tickets/.../raport.md` — nie zacommitowany (BLOCKER wyżej).
- Test dla współwystępowania gałęzi „stara karta" + „dopasowanie" — brak (SHOULD-FIX wyżej).

### Definition of done
- [x] Przycisk „Rozstrzygnij"/„Sprawdź kartę" przy czterech frazach `powod`, z właściwą
      etykietą, niezależny od widoczności kolumny „Powód" — pokryte testami.
- [x] Okno renderuje wszystkie trzy gałęzie z tekstami dosłownie z `88fa31c`.
- [x] `resolve` i `choose-absence-card` wysyłają ciała zgodne z `contract/openapi.yaml`.
- [x] Okno „Nie zapisano zmian" pokazuje komunikat 409 z serwera bez przepisywania w UI.
- [x] Układ ekranu z I14 nietknięty — `staging.test.tsx` zielony bez zmian asercji.
- [x] Handlery czterech tras w `test/msw/staging.ts`; żaden test nie chodzi po
      nieobsłużonym URL-u (zweryfikowane uruchomieniem `npm test`).
- [x] `npm run lint && npm run typecheck && npm run build && npm test` w
      `rebuild/frontend/` zielone — zweryfikowane samodzielnie (991/991 testów, 56 plików).
- [ ] `docs/karty/I15.5/karta.md` opisuje STAN — NIE spełnione (BLOCKER wyżej).
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki po synchronizacji, PR
      `MERGEABLE` — nie sprawdzane w tym przeglądzie (PR jeszcze nie istnieje w chwili
      review; do wykonania przez Mastera przed pushem).

## Parallel-test concerns

None — wszystkie nowe testy (`staging.rozstrzygnij.test.tsx`) korzystają z tej samej
architektury co istniejące testy stagingu: MSW + `queryClient.clear()`/`sessionStorage.clear()`
w `beforeEach`, brak twardo zakodowanych portów/plików tymczasowych. Zasoby nie są
współdzielone między testami ani między agentami.

## Overall assessment

Implementacja jest bardzo solidna pod kątem wierności: wszystkie teksty widoczne dla
użytkownika (włącznie z polskimi cudzysłowami, wielokropkiem i wersalikami) zweryfikowane
bajt po bajcie względem `88fa31c`, warunki logiczne (w tym świadomie zachowana asymetria
`Number.isFinite`) przepisane 1:1, a kształty żądań zgodne z `contract/openapi.yaml`. Testy
mają realne zęby (mutation-testing potwierdzony w raporcie, dodatkowo zweryfikowany przeze
mnie odczytem asercji) i poprawnie korzystają ze wspólnych mocków MSW, omijając pułapkę
`onUnhandledRequest`. Jedyny merytoryczny niedostatek to brak pokrycia rzadkiego przypadku
współwystępowania gałęzi „stara karta" + „dopasowanie" (gdzie oryginał pokazuje DWA
niezależne komunikaty błędu w różnych miejscach, a port — jeden wspólny na końcu). Główny
powód niedopuszczenia do merge w obecnym stanie to strona formalna: karta `I15.5` nie
została zaktualizowana o stan (nadal pokazuje `⬜`), a `raport.md` nie jest zacommitowany —
oba są wymagane przez DoD z `plan.md` i CLAUDE.md, i to jest łatwe do naprawienia przed PR-em.
