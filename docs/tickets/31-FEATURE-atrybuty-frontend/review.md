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
