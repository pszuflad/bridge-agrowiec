# 50-FEATURE-i14c-karta-dostawcy-upload — Code review

> Reviewed: 2026-09-18
> Branch: feature/50-i14c-karta-dostawcy-upload
> Diff: 5 plików (`plan.md`, `Dostawcy.tsx`, `DialogKonfiguracjiDostawcy.tsx`,
> `konfiguracja.dostawcy.test.tsx`, `konfiguracja.admin.test.tsx`), 2 commity
> (`258959e`, `af8fb0f`) względem `origin/develop`

## BLOCKER

Brak. Zakres zmian jest wąski, zweryfikowany bajt-w-bajt względem żywego bundla
(`mirror/frontend/assets/index-PRICEFMT1783512500.js:25690-25802`) i
`freq-injection.js:90-190`, wszystkie trzy odstępstwa (D1, D5, D6) są udokumentowane w
kodzie w miejscu wystąpienia i zgodne z decyzjami z `plan.md`. Bramki zielone (patrz niżej),
własność plików zachowana.

## SHOULD-FIX

- [ ] `docs/tickets/50-FEATURE-i14c-karta-dostawcy-upload/raport.md` — plik jest
  **niezacommitowany** (`git status` pokazuje go jako `Untracked`). Nie wejdzie do PR/gałęzi
  w obecnym stanie, więc `raport.md` referowany w tym review de facto nie istnieje na branchu.
  - Reason: rozjazd między tym, co widzi review/PR, a tym, co widać w worktree; przy squashu
    lub czyszczeniu worktree treść raportu przepada.
  - Suggestion: `git add docs/tickets/50-FEATURE-i14c-karta-dostawcy-upload/raport.md` i
    dopisać do commita (lub nowego commita) przed mergem.

- [ ] `rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx:409-416` — przy przełączeniu
  selecta z presetu na „Inna wartość" w TEJ SAMEJ sesji edycji, pole liczbowe pokazuje się
  **wypełnione starą wartością presetu** (np. „60"), bo `czestotliwosc` jest współdzielone
  między selectem i polem custom. Oryginał (`freq-injection.js:138-141`) przy takim ręcznym
  przełączeniu NIE kopiuje wartości presetu do `customInput` — pole zostaje puste (wartość
  jest wstępnie wypełniona tylko przy OTWARCIU popovera, gdy `currentMin` już był „custom").
  - Reason: to realna, niewielka różnica zachowania względem oryginału, która nie przeszła
    przez rundę Q&A (nie jest w tabeli D1–D6), a `plan.md` Krok 2 pkt 4 opisuje ją jako
    zamierzoną („wartość zostaje, użytkownik ją edytuje") bez podania jej jako osobnej decyzji.
    Nie widzę tu ryzyka utraty danych (użytkownik i tak widzi liczbę i może ją nadpisać), ale
    warto to świadomie zatwierdzić albo dopisać jako D7, żeby nie było niejasności, czy to
    przeoczenie czy decyzja.
  - Suggestion: albo dopisać wpis D7 do `plan.md`/roadmapy z uzasadnieniem UX, albo — jeśli ma
    być 1:1 — czyścić `czestotliwosc` na `""` w gałęzi `onChange` prowadzącej do `inna: true`,
    gdy poprzednia wartość była presetem.

- [ ] `rebuild/frontend/test/konfiguracja.dostawcy.test.tsx:340-360` — żaden test nie klika
  faktycznie przycisku `button-upload-<kod>`, żeby zweryfikować, że wywołuje
  `polePliku.current?.click()`. Test GATE multipart (`:~285-300`) uploaduje plik od razu przez
  `userEvent.upload` na ukrytym inpucie, z pominięciem przycisku — regresja w
  `onClick={() => polePliku.current?.click()}` (np. zerwane `ref`, zła zmienna) nie zostałaby
  wykryta przez żaden istniejący test.
  - Reason: to jedyna ścieżka, którą realnie klika Ania — brak testu na nią jest dziurą w
    GATE-u „klik otwiera wybór pliku" z Definition of done.
  - Suggestion: `vi.spyOn(HTMLInputElement.prototype, "click")` (albo spy na `ref.current`)
    + `userEvent.click(getByTestId("button-upload-..."))`, asercja, że `click` na inpucie padło.

- [ ] `rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx:116` vs
  `rebuild/frontend/src/pages/konfiguracja/wgrywanie.ts:35` — `wgrajPlikDostawcy` owija `kod`
  w `encodeURIComponent`, a bliźniacza (świadomie zduplikowana) `wgrajPlik` w `wgrywanie.ts`
  tego nie robi. Dziś nieszkodliwe (kody dostawców to proste alfanumeryki bez znaków
  specjalnych), ale dwie „te same" implementacje różnią się bez potrzeby.
  - Reason: drobna niekonsekwencja w duplikacie, który z definicji miał być równoległy do
    `wgrywanie.ts::wgrajPlik` — łatwo przeoczyć przy przyszłym scaleniu (follow-up już
    odnotowany w `raport.md`).
  - Suggestion: nic nie robić teraz (poza własnością karty), ale dopisać do noty o scaleniu w
    follow-upie, żeby scalający zauważył różnicę.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx:332-340` — przycisk „Wgraj plik"
  nie ma ikony (oryginał: `gd` przed tekstem, `:25774-25776`). Zgodne z już istniejącym stylem
  karty (przycisk „Synchronizuj" też jest bez ikony od wcześniejszej sesji — udokumentowane w
  komentarzu przy nim), więc to nie regresja tego ticketu, tylko nieodrobiony dług wcześniejszy.

- [ ] `rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx:152-162` — `stanZDostawcy` dla
  `czestotliwoscMinuty === 0` (teoretyczny przypadek, prawdopodobnie nigdy nie zapisywany przez
  backend) ustawi `inna: true`, ale `czestotliwosc: "0"` (niepusty string), więc pole minut
  pokaże „0" zamiast być puste jak w wariancie `null`. Niespójne z resztą logiki D5, ale niska
  szansa trafienia w praktyce.

- [ ] Brak testu na szybkie podwójne kliknięcie/wybranie pliku na przycisku uploadu (ochrona
  tylko przez `disabled={zajety}`, a `isPending` aktualizuje się asynchronicznie). Ryzyko niskie
  i architektonicznie identyczne z resztą karty (sync/zapis też tak działają), więc nie blokuję.

## Plan compliance

### Done ✓

- Krok 1 — przycisk „Wgraj plik": klient `wgrajPlikDostawcy` w `Dostawcy.tsx` (nie w
  `dostawcy.ts`, zgodnie z zastrzeżeniem własności), `FormData` z polem `plik`,
  `naglowki(false)`, `credentials: "include"`, render dla `upload`/`mail`, `data-testid`
  zgodne z oryginałem, reset inputa (D6), `zajety` rozszerzone o `upload.isPending`.
- Krok 2 — pole minut za „Inna wartość": `StanEdycji.inna`, `jestPresetem`, reguła widoczności
  1:1 z `freq-injection.js:138-147`, wariant „bez harmonogramu → Inna wartość" (D5) z testem
  GATE, walidacja `≥ 1` nadal osiągalna, komentarz przy selekcie zaktualizowany do STANU.
- Krok 3 — etykieta „Synchronizuj teraz" → „Synchronizuj", zweryfikowana na żywym bundlu.
- Krok 4 — `DialogKonfiguracjiDostawcy.tsx` bez zmian funkcjonalnych, komentarz D3 w miejscu
  pola, test-strażnik w `konfiguracja.admin.test.tsx`.
- Krok 5 — testy: trzy istniejące poprawione (`selectOptions(..., "inna")` przed użyciem pola),
  dziewięć nowych w `konfiguracja.dostawcy.test.tsx`, jeden w `konfiguracja.admin.test.tsx`.
  Toast czyta `nowe`/`zmienione`, gate multipart czyta realny `request.formData()`.
- Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — wszystkie zielone
  (patrz „Wyniki bramek" niżej), 761/761 testów.
- Własność plików: `git diff --name-only origin/develop...HEAD` zwraca tylko pliki z listy
  dozwolonych (plus `plan.md`); `rebuild/backend/**` i `contract/**` nietknięte.

### Missing or deviating ✗

- **Krok 6 (docs), część roadmapy** — podblok 14c w `docs/rebuild-roadmap.md` wciąż opisuje
  ZAMIAR („Do sprawdzenia, nie do automatycznej zmiany", „Do decyzji użytkownika"), nie STAN.
  Zgodnie z wyraźną instrukcją Mastera dla tego review to jest **następny krok, nie zgłaszam
  tego jako problem** tej karty.
- **Krok 6 (docs), część backlogu** — `docs/rebuild-backlog.md` nie ma nowych wpisów dla D1/D5/D6,
  mimo że `plan.md` Krok 6 i DoD tego wymagają. Zauważam niekonsekwencję w samym `plan.md`:
  sekcja „Własność plików" NIE wymienia `docs/rebuild-backlog.md` jako dozwolonego do edycji
  (tylko podblok 14c roadmapy), więc dodanie wpisów backlogu z tej gałęzi złamałoby własną
  whitelistę karty. Traktuję to analogicznie do wyjątku dla roadmapy (odkładam, nie blokuję),
  ale odnotowuję rozjazd między Krokiem 6/DoD a sekcją „Własność plików" w samym planie — do
  poprawienia przy 14d albo przy scalaniu 14a/14b/14c.
- `raport.md` — patrz SHOULD-FIX wyżej (plik istnieje w worktree, ale nie jest zacommitowany).

### Definition of done

- [x] Przycisk „Wgraj plik" renderuje się przy `upload`/`mail`, nie przy `url`
- [x] Klik otwiera wybór pliku (`accept=".csv,.xml,.xlsx"`) i wysyła `FormData` z polem `plik`
      na `POST /api/dostawcy/{kod}/upload` — potwierdzone kodem i testem GATE multipart, choć
      bez dedykowanego testu na samo wywołanie `ref.click()` z przycisku (patrz SHOULD-FIX)
- [x] Sukces → toast „Plik wczytany" z liczbami z realnych pól (`nowe`/`zmienione`), bez
      „undefined"; unieważnione `["/api/dostawcy"]` i `["/api/staging"]`
- [x] Błąd → toast `destructive` z komunikatem z ciała odpowiedzi
- [x] `<input type="file">` wyczyszczony po wysyłce (D6)
- [x] Pole „liczba minut" widoczne dokładnie wtedy, gdy select stoi na „Inna wartość (minuty)…"
- [x] Dostawca bez harmonogramu startuje na „Inna wartość" z pustym polem; zapis innego pola
      NIE włącza mu harmonogramu (D5) — test GATE potwierdza
- [x] Nadal da się wyczyścić harmonogram (puste pole → `czestotliwoscMinuty: null`)
- [x] Etykieta przycisku synchronizacji to „Synchronizuj"
- [x] Dialog admina bez zmian funkcjonalnych, decyzja D3 utrwalona komentarzem + testem
- [x] Komentarz przy selekcie częstotliwości opisuje STAN
- [x] `npm run lint && npm run typecheck && npm run build && npm test` — zielone
- [ ] Podblok 14c w roadmapie opisuje STAN; backlog uzupełniony o D1/D5/D6 — NIE zrobione
      (roadmapa: zgodnie z instrukcją Mastera to następny krok, nie liczę tego na minus tej
      karcie; backlog: patrz „Missing or deviating")
- [x] Żaden plik spoza własności karty nie ruszony

## Parallel-test concerns

Brak — wszystkie nowe/zmienione testy używają MSW (mock w pamięci procesu), `queryClient`
resetowanego w `beforeEach`, `sessionStorage`/`localStorage` czyszczonych w `beforeEach`, żadnych
portów efemerycznych, plików tymczasowych ani współdzielonej bazy. Testy są w pełni
parallelizowalne między agentami.

## Overall assessment

Solidna, dobrze zweryfikowana karta — implementacja jest sprawdzona bajt-w-bajt względem żywego
bundla (nie tylko deminifikatu), trzy zatwierdzone odstępstwa (D1, D5, D6) są opisane w kodzie
w miejscu wystąpienia z uzasadnieniem, a testy realnie sprawdzają multipart i kształt odpowiedzi
(nie tylko „przechodzą"). Największa realna dziura to niezacommitowany `raport.md` — do naprawienia
przed mergem. Reszta uwag (wypełnienie pola custom starą wartością presetu, brak testu na klik
przycisku uploadu, drobna niekonsekwencja `encodeURIComponent`) to rzeczy warte poprawy, ale żadna
nie blokuje — kierunek i jakość wykonania są dobre.
