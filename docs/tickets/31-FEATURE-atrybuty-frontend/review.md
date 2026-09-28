# 31-FEATURE-atrybuty-frontend — Code review

> Reviewed: 2026-09-04
> Branch: feature/31-atrybuty-frontend
> Diff: 22 plików, 3 commity (wobec origin/develop)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `docs/tickets/31-FEATURE-atrybuty-frontend/raport.md:30` — sekcja „Zmiany” twierdzi, że do
      `test/narzuty.dialog.test.tsx` dołożono „4 nowe testy”, ale `git diff` pokazuje **zero**
      nowych `it(...)` (25 przed, 25 po) — dołożono tylko mocki `/api/atrybuty` i `/api/suppliers`
      do istniejącego zestawu. Sekcja „Wyniki testów” (raport.md:86-88) mówi to poprawnie
      („asercji nie zmieniano”), więc obie sekcje raportu się przeczą.
  - Reason: rozjazd między deklarowanym a faktycznym zakresem zmian utrudnia następnej sesji
    zaufanie do raportu (zasada „roadmapa/raport opisuje stan, nie zamiar” z `CLAUDE.md`).
  - Suggestion: poprawić sekcję „Zmiany” w raporcie, żeby zgadzała się z rzeczywistością.

- [ ] `rebuild/frontend/test/narzuty.dialog.test.tsx:247-261` — jedyny test warunku słownikowego
      wybiera kategorię „Rolnicze”, która jest **jednocześnie** w słowniku i w katalogu produktów
      (`contract/fixtures/GET_products.json` ma `kategoria: "Rolnicze"`). Test więc przeszedłby
      identycznie, gdyby `DialogReguly.tsx` nadal czytał kategorie ze starego, katalogowego
      źródła (degradacja z 4b) — nie weryfikuje realnie okablowania z `opcjeWarunku`.
      Plan (Testing strategy, „Rozszerzony `test/narzuty.dialog.test.tsx`”) wprost wymagał
      testu na kategorię SPOZA katalogu („Quady” jest przygotowane w danych testowych,
      `narzuty.dialog.test.tsx:55`, ale nigdy nie użyte w asercji) oraz testu, że wartość
      warunku „dostawca” to `kod`, a żaden z nich nie powstał na poziomie tego dialogu
      (logika sama jest poprawnie pokryta w `test/atrybuty.slownik.test.ts`, ale okablowanie
      `DialogReguly.tsx` → `opcjeWarunku` — już nie).
  - Reason: to dokładnie przypadek z instrukcji ticketa („sprawdź, czy testy naprawdę
    złapałyby odwrócenie reguły”) — na poziomie dialogu nie złapałyby pomyłki w przekazaniu
    argumentów (`slownik`/`produkty`/`dostawcy` zamienione miejscami) ani powrotu do starego
    źródła danych.
  - Suggestion: dodać w `narzuty.dialog.test.tsx` wybór kategorii „Quady” (asercja, że opcja
    istnieje i jest wybieralna) oraz test, że select „dostawca” ma opcje z wartością = `kod`.

- [ ] `rebuild/frontend/src/pages/atrybuty/DialogNowaWartosc.tsx:69-80` — detekcja duplikatu
      po samym dopasowaniu `/już istnieje/i` do treści błędu nie rozróżnia 409 z `/rodzaje`
      („Rodzaj '<value>' już istnieje”) od 409 z `/wartosci` („Taka wartość już istnieje dla
      tego rodzaju”). W rzadkim wyścigu (rodzaj dodany przez inny zapis między odczytem
      `rodzaje` a wysłaniem `dodajRodzaj`) użytkowniczka dostanie mylący toast „Wartość „X” jest
      już w rodzaju Y”, choć naprawdę to RODZAJ już istniał, a wartość w ogóle nie została
      wysłana.
  - Reason: edge case współbieżności (dwie karty/dwie osoby zakładające ten sam nowy rodzaj
    „w locie”) daje nieprawdziwy komunikat, co utrudni diagnozę.
  - Suggestion: rozróżnić po etapie mutacji (błąd z `dodajRodzaj` vs. z `dodajWartosc`), nie po
    treści komunikatu.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/atrybuty/DialogNowaWartosc.tsx:147-148` i
      `rebuild/frontend/src/pages/atrybuty/DialogNowyRodzaj.tsx:107-108` — przycisk „Anuluj”
      zamyka dialog bez resetu pól (`wartosc`/`nazwa`/`opis`); pola czyszczą się tylko po
      sukcesie zapisu. Kolejne otwarcie tego samego dialogu pokazuje poprzednio wpisany,
      nieanulowany tekst. Drobny wyciek stanu między otwarciami, bez wpływu na dane.

- [ ] `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:156-157` — `["/api/atrybuty"]` jest
      tu odpytywane domyślnym `queryFn` (zwraca `null` na 401), a ten sam klucz w
      `Atrybuty.tsx:51-54` używa własnego `pobierzSlownik()` (rzuca na 401). Ponieważ klucz
      jest współdzielony (D9), o tym, które zachowanie „wygra” w danej sesji przeglądarki,
      decyduje kolejność montowania komponentów — kosmetyczna niespójność, nieszkodliwa
      w normalnym użyciu (obie ścieżki i tak trafiają pod ten sam URL).

## Plan compliance

### Done ✓
- Krok 1 — `src/pages/atrybuty/api.ts`: typy z fixtures (`snake_case`, `core` liczba,
  `utworzony` opcjonalne), `komunikatBledu`, osobna ścieżka dla `/liczniki` (goła mapa),
  `pobierzUzycie` z wymaganymi parametrami — zgodne z kontraktem i `routes/atrybuty.ts`.
- Krok 2 — widok trójstanowy (`kafle`/`wartosci`/`pending`), wszystkie podkomponenty
  (`KafleRodzajow`, `PanelWartosci`, `PanelPending`, `DialogProduktow` jako jeden wspólny
  komponent), dialogi Radix `DialogPotwierdzenia`/`DialogTekstu` (D2) z tekstami 1:1
  z `pending-injection.js` (zweryfikowano dosłownie: „UWAGA: to nie jest trwałe odrzucenie…”,
  „Zmapować…”, itd.).
- Krok 3 — trasa `/atrybuty` w `App.tsx`, placeholder zdjęty, komentarz w `placeholdery.ts`
  zaktualizowany, liczba tras routera bez zmian (12).
- Krok 4 — `DialogReguly.tsx` czyta `["/api/atrybuty"]` + `["/api/suppliers"]`;
  `slownik.ts` implementuje regułę D8 (marki = suma, kategorie = wyłącznie słownik,
  dostawcy = kod z API, bez dedupu/sortu) — zweryfikowane wprost w kodzie i pokryte testem
  jednostkowym `atrybuty.slownik.test.ts`, który realnie łapie odwrócenie reguły.
- Krok 5 — grep kontrolny: zero wywołań `/api/attributes` / `/api/attribute-kinds`,
  tylko komentarze i `data-testid` 1:1 z oryginałem.
- Trzy warianty akceptacji kolejki (`akceptuj` bez ciała, `akceptuj-z-edycja`
  `{nowa_wartosc}`, `akceptuj-jako-alias` `{kanoniczna_wartosc}`) trafiają pod właściwe adresy
  z właściwym ciałem — potwierdzone kodem i testem `atrybuty.pending.test.tsx` (sekcja 2).
- Odstępstwa D1–D12 z planu odzwierciedlone w kodzie i komentarzach 1:1 z uzasadnieniem.

### Missing or deviating ✗
- Testowa weryfikacja reguły D8 na poziomie `DialogReguly.tsx` (nie samej funkcji
  `opcjeWarunku`) jest słabsza niż zakładał plan — patrz SHOULD-FIX wyżej. Logika jest
  poprawna (sprawdzone czytaniem kodu), ale integracyjny test tego nie potwierdza.
- Raport.md ma wewnętrznie sprzeczny opis zmian w `narzuty.dialog.test.tsx` (patrz SHOULD-FIX).

### Definition of done
- [x] `/atrybuty` działa natywnie: kafle, panel wartości z CRUD, kolejka z czterema akcjami,
      oba czyszczenia, modal produktów
- [x] placeholder zdjęty; `placeholdery.ts` ma tylko `/moje-konto`
- [x] `DialogReguly.tsx` czyta słownik z `/api/atrybuty`, dostawców z `/api/suppliers`;
      kategoria spoza katalogu wybieralna (zweryfikowane w kodzie i teście jednostkowym
      `slownik.ts`, choć nie w teście dialogu — patrz SHOULD-FIX)
- [x] `grep -rn "attributes|attribute-kinds"` = 0 trafień (poza komentarzami)
- [x] testy komponentów i logiki zielone, w tym test łapiący odwrócenie reguły marki/kategorie
      (`atrybuty.slownik.test.ts`)
- [x] testy `/narzuty` z 4b nadal przechodzą (25/25)
- [x] lint / typecheck / build czyste — zweryfikowane ponownie w tym review
      (`npm run lint`, `npm run typecheck`, `npm test` → 559/559 zielone)
- [ ] roadmapa: aktualizacja stanu 7b, blok 7c, przeniesienie noty dla I2 — poza zakresem
      tego code review (nie sprawdzano `docs/rebuild-roadmap.md`, do weryfikacji przez Mastera)

## Parallel-test concerns

None — testy jednostkowe/komponentowe używają MSW (bez sieci), test integracyjny
(`atrybuty.integracja.test.ts`) startuje backend na porcie efemerycznym i bazie w katalogu
tymczasowym (`mkdtempSync`), zgodnie z konwencją repo. Brak twardo zakodowanych portów/plików.

## Overall assessment

Bardzo solidna robota portowa: dokumentacja w kodzie konsekwentnie odwołuje się do konkretnych
linii oryginału, teksty UI i kolejność żądań sprawdzone dosłownie względem
`pending-injection.js`, a trzy warianty akceptacji (najbardziej ryzykowne miejsce ticketa) mają
dedykowany test na adres+ciało. Kontrakt typów zgadza się z fixtures co do joty (`snake_case`,
`core` jako liczba, brak `ok` w `/liczniki`, `utworzony` tylko w `/api/atrybuty`). Jedyne realne
zastrzeżenia to luka w pokryciu testowego okablowania `DialogReguly.tsx` (część B) względem
tego, co faktycznie zakładał plan, plus drobna niespójność samego raportu — żadne z nich nie
blokuje merge'a.

---

# Iteracja 2 — weryfikacja poprawek

> Reviewed: 2026-09-04
> Branch: feature/31-atrybuty-frontend
> Diff od iteracji 1: commit `08821fe` (6 plików, w tym raport.md/review.md)

## Metodyka weryfikacji

Wszystkie trzy twierdzenia Mastera sprawdzone eksperymentalnie, nie tylko czytaniem kodu:

1. **Testy części B — zweryfikowane mutacyjnie, zgodnie z instrukcją.** Trzy mutacje w
   `src/pages/narzuty/slownik.ts` (przywrócone po każdej przez `cp` z backupu, `git status`
   czysty po przywróceniu):
   - kategorie liczone jak marki (suma słownika + katalogu) → padają **dwa** testy:
     „KATEGORIA spoza katalogu jest wybieralna” i „KATEGORIE nie biorą się z katalogu”;
   - kategorie wyłącznie z katalogu (odtworzenie degradacji 4b) → pada
     „KATEGORIE nie biorą się z katalogu”;
   - `dostawcyDoWyboru` zwraca etykietę zamiast kodu jako `wartosc` → pada
     „DOSTAWCA idzie z /api/suppliers […] w warunku ląduje KOD” z jawnym diffem
     `MO1` vs `MO1 · Bohnenkamp`.
   Baseline (bez mutacji) i po przywróceniu: 30/30 zielone. Test dostawcy realnie dowodzi, że
   w warunku ląduje `kod`, nie etykieta — potwierdzone.
2. **Sprzeczność raportu — usunięta.** `raport.md` sekcja „Zmiany” opisuje teraz dokładnie to,
   co jest w diffie (5 nowych `it(...)`, 25 → 30, plus mocki), zgodnie z `git show 08821fe`.
3. **Detekcja duplikatu po etapie mutacji — zweryfikowana względem oryginału.**
   `deminified/frontend-index.js:10243-10250` (`window.__atrybutyAddRodzaj`) faktycznie kończy
   się `fetch(...).catch(function(e){ console.warn(...) })` — POST rodzaju jest fire-and-forget,
   błąd nigdy nie dociera do UI. `Hb()` (`:10020-10030`) faktycznie zwraca `null` wyłącznie dla
   duplikatu WARTOŚCI (`Kb()` sprawdza `rodzaj+wartosc`, nie samo istnienie rodzaju). Cytaty w
   komentarzu (`DialogNowaWartosc.tsx:59-64`) zgadzają się z oryginałem co do sensu (numery linii
   przesunięte o kilka, bez znaczenia). Nowe zachowanie (etap zamiast treści) jest ściślej wierne
   niż wersja z iteracji 1.
4. **Wspólny `queryFn` na `/api/atrybuty` — sprawdzone, że nie wywala `/narzuty`.**
   `pobierzSlownik()` rzuca `Error` przez `rzucGdyBlad` (`lib/api.ts:95-99`), ale w
   `DialogReguly.tsx:156-162` żaden `throwOnError`/Suspense nie jest włączony (domyślny
   `QueryClient` z `queryClient.ts:28-43` tego nie ustawia), więc błąd zapytania zatrzymuje się
   w stanie `isError` TanStack Query — nie propaguje się do renderu. Odczyt jest też zabezpieczony
   `slownikAtrybutow?.wartosci ?? []` (`DialogReguly.tsx:186`), więc efekt błędu/401 to puste listy
   w selectach warunków, nie crash widoku `/narzuty`. Potwierdzone czytaniem + brakiem błędu przy
   `npm test` (testy dialogu montują komponent bez zamockowanego `/api/atrybuty` w części
   scenariuszy 1–5 i przechodzą).
5. **„Anuluj” nie czyści pól — cytat z oryginału potwierdzony.** `sg()`
   (`deminified/frontend-index.js:27199-27266`): `onClick: () => t(!1)` na przycisku „Anuluj”
   (`:27265`) nie woła `r("")`/`o("")`; reset stanu (`r(""), o(""), t(!1)`) siedzi wyłącznie
   w gałęzi sukcesu `l()` (`:27203-27208`). Komentarz w `DialogNowyRodzaj.tsx:106-111` zgadza się
   z oryginałem.

## Regresje

Brak. Pełne bramki po poprawce, uruchomione w tym worktree:
- `npm run lint` — czyste
- `npm run typecheck` — czyste
- `npm run build` — czyste (2408 modułów, bez błędów; ostrzeżenie o rozmiarze chunku istniało
  już wcześniej, niezwiązane z tym ticketem)
- `npm test` — **564/564** zielone, 38 plików (zgodne z raportem)
- `npm run test:integracja` — **39/39** zielone

## BLOCKER

Brak.

## SHOULD-FIX

Brak nowych. Wszystkie trzy z iteracji 1 rozliczone i zweryfikowane działaniem (nie tylko
deklaracją), patrz „Metodyka weryfikacji” wyżej.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/atrybuty/DialogNowaWartosc.tsx:66-70` — pusty blok `catch` przy
      połykaniu błędu `dodajRodzaj` nie loguje nic do konsoli, w odróżnieniu od (a) oryginału,
      który tu kończy się `console.warn` (`:10243-10250`), i (b) istniejącej konwencji w tym
      repo dla analogicznych „cichych” błędów (`src/lib/magazynKV.ts:51` —
      `console.warn("IndexedDB save failed:", blad)`). Bez wpływu na użytkowniczkę, ale utrudnia
      diagnozę w devtools, gdyby zakładanie rodzaju realnie zaczęło padać (np. zmiana kontraktu
      backendu). Rozważyć dodanie `console.warn` w tym `catch`.

- [ ] (z iteracji 1, wciąż aktualne, nieszkodliwe) `DialogNowaWartosc.tsx:147-148` i
      `DialogNowyRodzaj.tsx:107-108` — „Anuluj” nie czyści pól; teraz udokumentowane komentarzem
      jako świadome zachowanie 1:1 z oryginałem — nie wymaga dalszej akcji.

## Plan compliance

Bez zmian względem iteracji 1 — poprawki z `08821fe` domykają lukę w pokryciu testowym części B
(Definition of done, punkt „kategoria spoza katalogu wybieralna”, teraz potwierdzony też na
poziomie `DialogReguly.tsx`, nie tylko `slownik.ts`) i usuwają jedyną wewnętrzną niespójność
`raport.md`.

### Definition of done — aktualizacja
- [x] `DialogReguly.tsx` czyta słownik z `/api/atrybuty`, dostawców z `/api/suppliers`;
      kategoria spoza katalogu wybieralna — **teraz potwierdzone testem okablowania dialogu**
      (`narzuty.dialog.test.tsx`, sekcja 6), nie tylko testem jednostkowym `slownik.ts`
- [x] testy komponentów i logiki zielone, w tym testy łapiące odwrócenie reguły marki/kategorie
      **na dwóch poziomach** (czysta funkcja i okablowanie dialogu)
- [x] testy `/narzuty` z 4b nadal przechodzą (30/30, było 25/25 — przyrost to nowy blok części B)
- [x] lint / typecheck / build czyste — zweryfikowane ponownie w tej iteracji
- [ ] roadmapa: nadal poza zakresem code review (do weryfikacji przez Mastera)

## Parallel-test concerns

Bez zmian — None. Nowe testy (blok 6 w `narzuty.dialog.test.tsx`) używają tego samego MSW
bez sieci co reszta pliku.

## Overall assessment

Wszystkie trzy poprawki są rzeczywiste, nie kosmetyczne: testy części B faktycznie łapią
odwrócenie reguły marki/kategorie i pomyłkę kod/etykieta dostawcy (sprawdzone mutacyjnie w obu
kierunkach), detekcja duplikatu po etapie mutacji jest ściślej wierna oryginałowi niż wersja
sprzed poprawki, a wspólny `queryFn` nie wprowadza ryzyka crasha `/narzuty` na wygasłej sesji
(zabezpieczone przez `?? []` i brak `throwOnError`). Jedyna pozostała uwaga to brakujący
`console.warn` w połkniętym błędzie `dodajRodzaj` — kosmetyczna, nie blokuje merge'a. Ticket
gotowy do merge'a.
