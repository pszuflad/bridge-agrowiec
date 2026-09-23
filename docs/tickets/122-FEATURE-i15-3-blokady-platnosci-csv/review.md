# 122-FEATURE-i15-3-blokady-platnosci-csv — Code review

> Reviewed: 2026-09-23
> Branch: feature/122-i15-3-blokady-platnosci-csv
> Diff: 18 plików, 5 commitów

## BLOCKER

Brak.

Najważniejsze do zweryfikowania z promptu — decyzja D2′ (pole `blokowaneFormyPlatnosci` NIE
wychodzi z `GET /api/products`) — sprawdzona niezależnie i **potwierdzona**:
- `git show 88fa31c:mirror/backend/index.cjs | grep -c blokowane_formy_platnosci` → `0` (zgodnie z raportem).
- `rebuild/backend/src/repos/products.ts` faktycznie używa `projekcjaKontraktowa()` (jawnej listy
  wykluczeń), analogicznie do `uwagaCena` — mechanizm opisany w `repos/kolumny.ts` jest realny, nie
  tylko deklaratywny.
- Trzy kopie mapy `MO1–MO10` → lista form płatności (`generator-csv.ts`, `formatowanie.tsx`,
  `rebuild/schema/011_blokowane_formy_i_triggery.sql`) porównane programowo z oryginałem
  (`payment_blocks.cjs`) — **identyczne co do znaku** we wszystkich czterech miejscach.
- Metodologia pomiaru w `raport.md` nie ma widocznej luki: piaskownica z `git archive 88fa31c`
  (nie z nieaktualnego `mirror/` na `develop`), baza doprowadzona własnym modułem oryginału
  `ensurePaymentBlocks()`, weryfikacja `{ok:true, rows:7405}` przed pomiarem. Sprostowania
  komentarzy w `repos/kolumny.ts`, `test/katalog.gate.test.ts`, `test/produkty.mutacje.test.ts`
  są zgodne z pomiarem, nie przekłamują niczego w drugą stronę.
- Wierność `generate_selly_export.cjs`: kolejność i nazwy 60 kolumn, trzy transformacje
  (`Kod-dostawcy`, `cena_sprzedazy`, kolumny boolowskie), `esc()`, `zapiszAtomowo` (tmp+rename w
  tym samym katalogu), cztery linie stdout (`slice(-500)`) — porównane linia po linii z oryginałem,
  bez odchyleń. Linia nagłówkowa generatora zweryfikowana bajt w bajt względem
  `git show 88fa31c:mirror/frontend/ex-port-files/sellycsv-....csv` (zgodna).
- Bramki: `lint`/`typecheck`/`build`/`test` przeszły po obu stronach (backend: 1646/1650 zielone,
  patrz „Parallel-test concerns”; frontend: 949/949 zielone). Mutacja kontrolna (usunięcie filtra
  `status='aktywny'` z generatora) wywaliła 3 testy — siatka faktycznie łapie regresję, nie tylko
  utrwala kod.

## SHOULD-FIX

- [ ] `rebuild/backend/src/selly/csv-cli.ts:30` — CLI używa pełnego `wczytajEnv()`, które wymaga
  `JWT_SECRET` (`src/config/env.ts:36`, brak defaultu), mimo że generowanie CSV nie potrzebuje
  uwierzytelniania. Precedens w tym samym repo jest węższy: `src/db/migrate-cli.ts` czyta
  wyłącznie `process.env.DB_PATH` wprost, bez całego schematu env. Jeśli crontab produkcji nie
  dziedziczy pełnego środowiska procesu serwera (typowe dla crona — brak automatycznego
  `source .env`), polecenie `npm run selly:csv` będzie się wywalać na starcie z powodu brakującego
  sekretu niezwiązanego z jego zadaniem.
  - Reason: ryzyko operacyjne przy cutoverze — cichy fail crona o 6:00, wykryty dopiero jak Selly
    nie zaciągnie pliku o 12:00.
  - Suggestion: albo udokumentować w „Do koordynatora" dokładne zmienne wymagane w środowisku
    crona (w tym `JWT_SECRET`), albo rozważyć węższy odczyt env (tylko `DB_PATH`/`SELLY_CSV_*`)
    analogiczny do `migrate-cli.ts`.

- [ ] `docs/karty/I15.3/karta.md` — sekcje „Dowiezione" i „Do koordynatora" wciąż puste (`—`),
  mimo że DoD w `plan.md` (ostatni punkt, jawnie nieodhaczony) wymaga opisania STANU karty,
  sygnatury funkcji dla I15.10 (`availability_sync.cjs` ma wołać generator) i dokładnego
  polecenia crona. Krok „13-15" z `raport.md`/`plan.md` nie został wykonany.
  - Reason: to jedyny kawałek zakresu tej karty, którego formalnie brakuje — zgodnie z zasadą
    projektu „karta zamknięta opisuje stan, nie zamiar" (`CLAUDE.md` §1). Bez tego koordynator I15.10
    nie ma z czego skorzystać przy spinaniu generatora z `availability_sync`.
  - Suggestion: dopisać `karta.md` przed zamknięciem ticketu — nie blokuje mergowania kodu, ale
    powinno wejść razem z nim albo bezpośrednio po.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/selly.generator-csv.test.ts` (test „pustą wartość uzupełnia z mapy") —
  `DROP TRIGGER products_blokowane_formy_au` przed bezpośrednim `UPDATE ... SET
  blokowane_formy_platnosci = NULL` jest zbędny: ten trigger i tak reaguje tylko na `UPDATE OF
  dostawca`, nie na aktualizację samej kolumny blokad. Nie wpływa na poprawność testu, tylko na
  czytelność.
- [ ] `rebuild/backend/src/selly/generator-csv.ts` — komentarz przy `blokowaneFormyDlaDostawcy`
  odwołuje się do „ticket 113" jako źródła pomiaru „0 wierszy z pustym polem" — w reszcie
  dokumentacji tej karty (raport, kolumny.ts) numerem referencyjnym jest raczej 122/backlog #101;
  warto sprawdzić przy kolejnej okazji, czy odwołanie do 113 jest zamierzone (osobny wcześniejszy
  ticket pomiarowy) czy literówka.

## Plan compliance

### Done ✓
- Krok 1 — generator CSV: 60. kolumna, `nazwaKategoriiSklepu` (z `ł`→`l` po NFD), zapis atomowy
  (tmp + rename w tym samym katalogu, sprzątanie przy błędzie), stdout wyrównany do `88fa31c`.
- Krok 2 — CLI (`selly:csv` / `selly:csv:dev`), wzorzec `migrate`/`migrate:dev`, woła tę samą
  funkcję co trasa; test porównuje plik bajt w bajt.
- Krok 3 — pole w API: **świadomie NIE wykonany** wg litery karty, ale zastąpiony udokumentowaną,
  zweryfikowaną decyzją D2′ (patrz „BLOCKER" wyżej) — zgodnie z regułą projektu „odtwarzaj
  zachowanie 1:1, każde odstępstwo to świadoma decyzja".
- Krok 4 — przenagranie fixture'ów: **nie wykonane, bo pomiar pokazał, że nie jest potrzebne**
  (72 klucze, bez zmian) — spójne z D2′, nie jest odstępstwem od planu, tylko jego naturalną
  konsekwencją po obaleniu założenia.
- Krok 5 — kontrakt: analogicznie nie dotyczy (pole nie wychodzi z API).
- Krok 6 — front: kolumna w `KOLUMNY`/`KOLUMNY_DOMYSLNE`, retrofit `uzupelnijBlokowaneFormy`,
  złożenie retrofitów w `Katalog.tsx`, `formatujKomorke` z „—" dla MO6/nieznanego i `title`
  z pełną listą — zweryfikowane w kodzie i testach.
- Krok 7 — testy: generator → CLI → API (sprostowania) → front, zgodnie z kolejnością planu.

### Missing or deviating ✗
- Krok 13-15 z DoD (`docs/karty/I15.3/karta.md` — stan, sygnatura dla I15.10, polecenie crona
  w „Do koordynatora") — **niewykonany**, jawnie nieodhaczony w `plan.md`. Patrz SHOULD-FIX wyżej.
- Poza tym punktem plan i raport są spójne z diffem — nie znaleziono innych rozjazdów.

### Definition of done
- [x] `LICZBA_KOLUMN === 60`, 60. nagłówek `Blokowane-formy-platnosci`, linia nagłówkowa
      identyczna z plikiem produkcji z `88fa31c` — zweryfikowane niezależnie (diff bajt w bajt).
- [x] `nazwaKategoriiSklepu` pokrywa 5 kluczy + przypadek `ł`, fallback bez zmian.
- [x] Test `R/D` / „Radialna"/„Diagonalna".
- [x] Wyłącznie `aktywny` w pliku; zapis atomowy; brak `.tmp-*` po generowaniu — zweryfikowane
      mutacją kontrolną (usunięcie filtra wywala testy).
- [x] Fallback kolumny 60 działa; MO6 i nieznany dostawca → puste.
- [x] `npm run selly:csv` daje plik bajt w bajt identyczny z trasą; nie rusza `.htaccess`.
- [x] Decyzja o polu w API rozstrzygnięta pomiarem, zweryfikowana niezależnie (patrz wyżej).
- [x] Strażnicy zostają na 72 klucze, komentarze poprawione zgodnie z pomiarem.
- [x] Kolumna „Blokowane formy płatności" widoczna domyślnie, „—" dla MO6/nieznanego, retrofit
      działa (test na zastanym zapisie IndexedDB).
- [x] GATE: fixtures + openapi bez zmian, zgodne z nagraniem — `git status`/`git diff` na
      `contract/` i `rebuild/schema/` puste.
- [x] Bramki zielone: `lint`, `typecheck`, `build`, `test` — zweryfikowane uruchomieniem
      (backend i frontend osobno, zgodnie z instrukcją).
- [x] Pomiar wierszy przed/po w `raport.md` — obecny, spójny z wyjaśnieniem (filtr `aktywny`
      istniał w odbudowie od I8a, więc liczba wierszy się nie zmienia — to jest oczekiwany wynik).
- [ ] `docs/karty/I15.3/karta.md` opisuje STAN — **NIE zrobione**, jawnie nieodhaczone.

## Parallel-test concerns

Brak nowych problemów z równoległością wprowadzonych tym ticketem. `test/selly.csv-cli.test.ts`
odpala CLI jako osobny proces (`execFileSync` + `tsx`), ale każdy test korzysta z własnej bazy
w `mkdtempSync(tmpdir())` i własnego katalogu docelowego (`${baza.sciezka}-cli`, `-cli-stdout`,
`-cli-htaccess`) — bez współdzielonych zasobów, portów ani stałych ścieżek. Bezpieczne przy
równoległej pracy kilku agentów.

Jedna obserwacja **spoza zakresu diffu**: `test/alerty-katalogu.gate.test.ts` (test „paczka równa
limitowi 20 000 id") pada na `Test timed out in 20000ms` nawet uruchomiony w izolacji (bez
równoległego biegu frontu) — nie tylko przy współbieżności obu suit, jak opisano w raporcie dla
`silnik.charakteryzacja.test.ts`. Plik nie jest częścią tego diffu i test nie ma związku z
blokadami płatności/CSV, więc nie traktuję tego jako blokera tego ticketu — ale warto zgłosić
osobno, bo limit 20 s na paczkę 20 000 id wygląda na ten sam gatunek kruchości czasowej.

## Overall assessment

Bardzo solidna robota, szczególnie jak na ticket, który w trakcie implementacji obalił własne
założenie karty. Decyzja D2′ (pole `blokowaneFormyPlatnosci` zostaje ukryte w API) jest dobrze
umotywowana i — co ważniejsze — dała się zweryfikować niezależnie: grep w bundlu produkcyjnym,
mechanizm projekcji w `repos/products.ts` i trzy kopie mapy MO porównane programowo wszystkie się
zgadzają z raportem. Port generatora CSV jest wierny oryginałowi linia po linii (nazwy kolumn,
transformacje, zapis atomowy, stdout), a testy nie tylko istnieją, ale realnie łapią regresje
(zweryfikowane mutacją). Jedyny realny brak to niedokończona dokumentacja karty (`karta.md` +
polecenie crona dla koordynatora) — nie blokuje mergowania kodu, ale powinna zostać domknięta,
bo to jedyny formalnie nieodhaczony punkt DoD i dotyczy operacyjnego przepięcia crona przy cutoverze.
