# 126-FEATURE-pelne-pliki-csv-analityki — Code review

> Reviewed: 2026-09-23
> Branch: feature/126-pelne-pliki-csv-analityki
> Diff: 15 plików, 3 commity (origin/develop...HEAD)

## BLOCKER

- [ ] `docs/karty/P10.5/karta.md` — karta karty nadal ma „Stan: ⬜ gotowe” bez daty/ID ticketa, „Dowiezione: —”, „Do koordynatora: —”.
  - Reason: Plan (DoD, ostatnia sekcja) wprost wymaga „Stan ✅, Dowiezione, «Do koordynatora» (6 widoków zamiast 3)” — nic z tego nie trafiło do diffu. Bez tego następna sesja/koordynator czytający roadmapę i karty nie zobaczy, że P10.5 jest zamknięta, i nie dowie się o rozjeździe zakresu (8 widoków zamiast 3/4 z backlogu #96) — a to jest dokładnie sytuacja, przed którą ostrzega `CLAUDE.md` (reguła 1: „karta oznaczona jako zrobiona… zakres faktycznie dowieziony zamiast planowanego”).
  - Suggestion: Zaktualizować `karta.md`: Stan ✅ + data + `126-FEATURE-pelne-pliki-csv-analityki`, sekcja „Dowiezione” z listą 8 tras, „Do koordynatora” z notatką o rozjeździe backlogu #96 (liczył 4, dowieziono 8).
- [ ] `docs/rebuild-backlog.md:4379` — wpis `#96` nadal ma `**Status** | —`, mimo że plan.md DoD wymaga „Backlog #96 → Status ✅”.
  - Reason: Reguła CLAUDE.md „statusy wpisów aktualizuje ta sesja, która je realizuje, nie następna” — status nieaktualny wprowadza w błąd każdego, kto sprawdza backlog, czy #96 jest zamknięte.
  - Suggestion: Zmienić `**Status** | —` na `✅ 2026-09-23, ticket 126-FEATURE-pelne-pliki-csv-analityki (zakres: 8 widoków, nie 4 — patrz karta P10.5)`.
- [ ] `docs/karty/I15.9/` — brak pliku `wejscie-126.md`.
  - Reason: DoD wprost: „`docs/karty/I15.9/wejscie-126.md` — Ania ma wiedzieć, że pliki są pełne.” Katalog `I15.9` istnieje (ma już `wejscie-104.md`, `wejscie-104b.md`, `wejscie-110.md`, `wejscie-113.md`), ale nie ma wpisu z tego ticketu — kolejna sesja pracująca nad I15.9 (instrukcje dla Ani) nie dowie się o zmianie zachowania eksportu CSV.
  - Suggestion: Dopisać `docs/karty/I15.9/wejscie-126.md` z krótką notatką „polecenie → rezultat” (zgodnie z pamięcią „Instrukcje dla Ani: krótko”) o tym, że pliki CSV z Analityki są teraz pełne.

## SHOULD-FIX

- [ ] `rebuild/frontend/test/analityka.eksport-pelne.test.tsx` — brak asercji na stan `disabled`/spinner w trakcie pobierania (decyzja D4 z planu).
  - Reason: D4 jest jawną decyzją planu („disabled + spinner na czas pobierania”), ale żaden test nie sprawdza, że przycisk faktycznie jest zablokowany/pokazuje `LoaderCircle` w trakcie `await pobierzPelne()`. Kod wygląda poprawnie przy przeglądzie (`disabled={wczytywanie || pobieranie}`), ale zachowanie nie jest chronione testem — regresja (np. ktoś przypadkiem usunie `ustawPobieranie(true)`) przejdzie całą bramkę niezauważona.
  - Suggestion: Dodać test, który opóźnia handler MSW (`await new Promise(...)`) i sprawdza `toBeDisabled()` / obecność spinnera przed rozwiązaniem promisu.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/analityka.ts:1636` — komentarz nad `czyBezLimitu` powtarza w dużej mierze treść komentarza w `routes/analytics.ts:36-41` (oba tłumaczą semantykę `0`). Niewielka duplikacja dokumentacyjna, nieszkodliwa, ale warto rozważyć odesłanie jednego do drugiego przy następnej okazji.
- [ ] `rebuild/frontend/src/pages/analityka/api.ts` — `pobierzPelneWiersze` zwraca `null` zarówno dla `null`, jak i `undefined` odpowiedzi API; typ `TOdpowiedz | null` w `fetchQuery` nie obejmuje `undefined` jawnie — działa poprawnie w praktyce (TS nie krzyczy), ale sygnatura mogłaby być `TOdpowiedz | null | undefined` dla czytelności.

## Plan compliance

### Done ✓
- Krok 1 — `czyBezLimitu()` w `repos/analityka.ts`, dokładnie zgodnie ze specyfikacją (tylko `"0"` zdejmuje limit).
- Krok 2 — wszystkie 8 funkcji repo (`unikalneEan`, `porownanieEan`, `cyklZyciaDostawcow`, `zmianyCenOstatniegoImportu`, `dostepnoscProduktow` — obie gałęzie SQL, `tempoSchodzenia`, `rotacjaNieaktywnych`, `marze` — tylko `rows`) dostały parametr `bezLimitu = false` na końcu sygnatury, stałe `LIMIT_*` zostały na miejscu.
- Krok 3 — 8 tras w `routes/analytics.ts` przekazuje `czyBezLimitu(req.query.limit)`; `rotation/inactive` łączy `?days` i `?limit` poprawnie.
- Krok 4 — `openapi.yaml` — dokładnie 8 ścieżek z identycznym blokiem `parameters` (`enum: [0]`), schematy odpowiedzi bez zmian; fixtures nietknięte (potwierdzone `git diff --stat` na `contract/fixtures/` — pusty).
- Krok 5 — `pobierzPelneWiersze` / `zAdresemBezLimitu` w `api.ts`, leniwe przez `queryClient.fetchQuery`, dziedziczy `on401: returnNull` i cache.
- Krok 6 — `PrzyciskCsv` z opcjonalnym `pobierzPelne`, ścieżka async ze spinnerem, `disabled`, `toast` przy błędzie, brak pliku przy błędzie/`null` — zweryfikowane testami i przeglądem kodu.
- Krok 7 — 7 plików sekcji (8 przycisków) podłączonych, filtr użyty w `pobierzPelne` jest identyczny (ta sama funkcja i te same argumenty) jak filtr budujący `wiersze` dla tabeli — sprawdzone grepem dla wszystkich 7 sekcji, brak rozjazdu.
- D1 (zakres 8 widoków zamiast 3/4) — zrealizowane i uzasadnione pomiarem w `raport.md`.
- D2 (`?limit=0`, nie SQL `LIMIT 0`) — potwierdzone testami jednostkowymi i integracyjnymi (36 przypadków), w tym negatywny test na pustość wyniku.
- D3 (leniwe pobranie) — potwierdzone testem „pełny zbiór leci DOPIERO po kliknięciu”.
- D5 (błąd → brak pliku, nie cichy ucięty plik) — potwierdzone dwoma testami (500 i 401).
- Backend: 1668 passed, frontend: 945 passed, GATE (`analityka.*.gate.test.ts`) uruchomiony ponownie w tym review — 69/69 zielone, fixtures niezmienione.
- Testy nie kolidują między agentami — baza testowa backendu w `mkdtempSync(tmpdir())`, testy frontowe czyszczą `queryClient`/storage w `beforeEach`, brak twardych portów/ścieżek.

### Missing or deviating ✗
- `docs/karty/P10.5/karta.md`, `docs/rebuild-backlog.md` (#96 Status), `docs/karty/I15.9/wejscie-126.md` — trzy explicite wymagane w DoD artefakty dokumentacyjne nie zostały utworzone/zaktualizowane (patrz BLOCKER wyżej). Kod jest kompletny i zgodny z planem — brakuje wyłącznie zamknięcia procesu dokumentacyjnego wymaganego przez `CLAUDE.md`.

### Definition of done
- [x] Plik CSV z każdego z ośmiu widoków z sufitem ma wszystkie wiersze po filtrach.
- [x] Trasa bez `?limit` oddaje dokładnie to samo co przed ticketem (test na zbiorze ponad sufitem + GATE na niezmienionych fixtures).
- [x] Tabela nadal rysuje najwyżej 300 wierszy.
- [x] Kafel „Pozycje unikalne” nadal liczy 1000.
- [x] `?limit=0` nie oznacza SQL-owego `LIMIT 0` w żadnej z ośmiu tras (test dedykowany + kod).
- [x] `rotation/inactive` obsługuje `?days` i `?limit=0` jednocześnie.
- [x] Błąd pobrania → brak pliku + `toast`, nigdy cicho ucięty plik.
- [x] Osiem ścieżek `openapi.yaml` deklaruje opcjonalny `limit`; schematy odpowiedzi bez zmian.
- [x] GATE fixtures/kontrakt przechodzi bez zmian w plikach `contract/fixtures/`.
- [x] Bramki lint/typecheck/build/test zielone w obu pakietach (potwierdzone w raport.md, uruchomiłem ponownie podzbiór testów — zielone).
- [x] Pomiar „przed → po” dla każdego dotkniętego widoku w `raport.md`.
- [ ] `docs/karty/P10.5/karta.md` — Stan ✅, Dowiezione, „Do koordynatora” — NIE zrobione.
- [ ] `docs/karty/I15.9/wejscie-126.md` — NIE utworzone.
- [ ] Backlog #96 → Status ✅ — NIE zrobione.

## Parallel-test concerns

None — wszystkie testy parallelizowalne. Backend: `mkdtempSync(tmpdir())` per test, bez portów/plików współdzielonych. Frontend: MSW + `queryClient.clear()`/`sessionStorage.clear()`/`localStorage.clear()` w `beforeEach`, brak zależności od zewnętrznego stanu.

## Overall assessment

Implementacja jest solidna i precyzyjnie realizuje trudny wymóg „domyślne zachowanie 1:1, nowe zachowanie tylko opt-in”: `czyBezLimitu` jest odporna na obejście (zwraca `true` wyłącznie dla dosłownego `"0"`, w tym test na tablicę z powtórzonego parametru), obie gałęzie SQL `dostepnoscProduktow` są obsłużone, `marze()` poprawnie rozdziela `LIMIT_GRUP_MARZY` (CSV) od `LIMIT_LISTY_MARZY` (nietknięty), a filtry stosowane w `pobierzPelne` każdej sekcji są identyczne z tymi budującymi widok tabeli — zweryfikowałem to grepem dla wszystkich siedmiu plików. Testy są rzeczywiście dowodowe, nie kosmetyczne: backendowe 36 przypadków celowo zasila bazę ponad sufit (czego GATE nigdy nie robił), a frontowe MSW świadomie rozróżniają `?limit=0` po query stringu, czego stary test `analityka.eksport.test.tsx` nie potrafił. GATE uruchomiony ponownie w tym review — zielony, fixtures nietknięte. Jedyny realny problem to brak trzech artefaktów dokumentacyjnych wymaganych przez własne DoD ticketu i przez `CLAUDE.md` (karta P10.5, status backlogu #96, wejście dla I15.9) — bez nich proces „karta = stan, nie zamiar” jest złamany, a to reguła, którą ten sam projekt wielokrotnie boleśnie sobie przypomina.
