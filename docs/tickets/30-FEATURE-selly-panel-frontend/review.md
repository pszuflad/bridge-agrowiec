# 30-FEATURE-selly-panel-frontend — Code review

> Reviewed: 2026-09-04
> Branch: feature/30-selly-panel-frontend
> Diff: 25 plików, 5 commitów (`c33078a`…`9cc4c83`)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:1031-1086`, `docs/spec-frontend.md:53` — DoD ticketa nie jest spełnione: roadmapa nie została zaktualizowana.
  - Reason: `plan.md` ma w Definition of done dwa jawne punkty: „Roadmapa: blok 8 zamknięty w całości (8a ✅ + 8b ✅), DoD rozliczone, parytet z `selly-injection.js` odnotowany faktyczną wielkością pliku (30 936 B, nie 26 KB)” oraz „Sprostowania z sekcji «Trzy fakty» zapisane w roadmapie/spec”. `git diff origin/develop...HEAD` nie dotyka ani `docs/rebuild-roadmap.md`, ani `docs/spec-frontend.md` — roadmapa dalej pokazuje `8b ⬜`, `DoD: panel Selly natywny (8b ⬜)` i „parytet z `selly-injection.js` (26 KB, 8b)” (linia 1086), a `spec-frontend.md:53` dalej podaje „26 KB”. Żadne z trzech sprostowań faktograficznych z raportu (POST vs GET dla `categories`/`producers` — już poprawne w roadmapie, ale dwa pozostałe: przycisk „Sync” w mapowaniu robiący pełny sync, i domyślna gałąź `S.size>0` w eksporcie) nie trafiło do roadmapy ani do spec. To dokładnie ten scenariusz, przed którym ostrzega `CLAUDE.md` („Roadmapa jest wejściem dla następnej sesji — utrzymuj ją na bieżąco”) — kolejna sesja czytająca roadmapę zobaczy blok 8 jako niedomknięty i błędny rozmiar pliku.
  - Suggestion: Dopisać do `docs/rebuild-roadmap.md` blok 8: status `8b ✅ 2026-09-04`, DoD odhaczone, poprawiony rozmiar pliku (30 936 B) i sekcję ustaleń faktograficznych (mapowanie ma przycisk Sync = pełny zapis; domyślna gałąź eksportu to „wybrane kolumny”, nie Shoper). Zaktualizować `spec-frontend.md:53` (26 KB → 30 936 B) i dopisać przypis o dwóch sprostowaniach.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/selly/SekcjaCsv.tsx:116-146` — sekcja „Codzienna synchronizacja CSV” gubi trzy elementy tekstowe oryginału bez żadnej D-decyzji.
  - Reason: Oryginał (`selly-injection.js:580-591`) pokazuje (1) linię podsumowania „✓ Synchronizacja OK — plik wygenerowany dzisiaj” / „✗ Błąd synchronizacji — {powod}” — w porcie nie ma jej WCALE (jest tylko dot + tabela); (2) komórkę „Status” jako przetłumaczoną odznakę „OK”/„BŁĄD” (`selly-csv-ok`) — port pokazuje surowe `dane.status` (czyli dosłownie „ok”, małą literą, bez tłumaczenia); (3) kolorowanie wieku pliku wg `wygenerowany_dzisiaj` (`ok`/`warn`) — `formatujOstatniaSynchronizacje` w ogóle nie przyjmuje tego parametru. Plan i DoD wymagają „etykiety i teksty 1:1”, a żadne z tych trzech odstępstw nie jest odnotowane jako D1–D7/O1.
  - Suggestion: Dodać brakującą linię statusu, użyć `Badge`/tekstu „OK”/„BŁĄD” zamiast surowego `status`, przekazać `wygenerowany_dzisiaj` do formatowania wieku (albo świadomie zapisać te trzy uproszczenia jako nową D-decyzję w planie).

- [ ] `rebuild/frontend/src/pages/Selly.tsx:88-95` — `onSettled` odświeża `/status` i `/log` również po BŁĘDZIE syncu, podczas gdy oryginał robi to tylko po sukcesie.
  - Reason: `doSync` w oryginale (`selly-injection.js:703-709`) ma `if (!r.ok) { …; return; }` PRZED `loadStatus(); loadLog();` — po błędzie NIE odświeża. Port używa `onSettled`, które odpala się też przy odrzuceniu obietnicy (HTTP błąd rzucony przez `rzucGdyBlad`). To osłabia zasadę „odświeżanie po mutacjach identyczne jak w oryginale”, jest niezatwierdzone i nietestowane — test „5. Odświeżanie” w `selly.test.tsx` sprawdza wyłącznie ścieżkę sukcesu.
  - Suggestion: `onSuccess` zamiast `onSettled` (jak już zrobiono poprawnie dla `generowanie` w tym samym pliku, linia 82-86), albo świadomie zatwierdzić i opisać jako nową D-decyzję.

- [ ] `rebuild/frontend/src/pages/selly/SekcjaPolaczenie.tsx:35-52` — cichy dodatek (`token_prefix`) i cichy ubytek („✓ Połączono”) względem oryginału.
  - Reason: Oryginał (`:554-559`) pokazuje „✓ Połączono · {shop} · token wygasa za {n}s · {vat_probe}” i NIGDZIE nie wyświetla `token_prefix`, mimo że pole jest w fixture. Port dodaje wiersz „Token: {token_prefix}” (informacja, której Ania nigdy nie widziała) i nie ma dosłownego tekstu „Połączono”. Żadna z tych zmian nie ma D-decyzji w planie.
  - Suggestion: Usunąć `token_prefix` z widoku albo świadomie zatwierdzić i zapisać jako odstępstwo w planie (dodatkowa informacja diagnostyczna, nieszkodliwa, ale niezgodna z zasadą „nie wymyślamy nowego”).

- [ ] `rebuild/frontend/test/katalog.eksport-przycisk.test.tsx` — brak testu trzeciego wariantu etykiety przycisku eksportu.
  - Reason: DoD i nagłówek pliku deklarują pokrycie „trzech wariantów etykiety” (`Pobierz CSV (N kol.)`, `Pobierz CSV (Shoper)`, `Pobierz CSV dla Shopera` — ten ostatni przy wybranym konkretnym dostawcy i odznaczonych wszystkich kolumnach, `frontend-index.js:23421`), ale w pliku są asercje tylko na dwa pierwsze warianty (linie 91 i 150). Trzeci wariant nie jest sprawdzony nigdzie w testach.
  - Suggestion: Dodać test klikający zakładkę konkretnego dostawcy + „Żadna” w konfiguratorze kolumn i asertujący etykietę „Pobierz CSV dla Shopera”.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/selly/formatowanie.ts:62-66` — `wariantStatusuOperacji` zwraca `"ladowanie"` jako trzeci/domyślny wariant (odpowiednik „warn”), a `StanWskaznika` jest tym samym typem, co realny stan ładowania w innych sekcjach. Myląca nazwa dla czegoś, co nie ma nic wspólnego z ładowaniem — warto rozdzielić typy albo przenazwać trzeci wariant.
- [ ] `rebuild/frontend/src/pages/selly/api.ts:58` i `docs/tickets/30-FEATURE-selly-panel-frontend/plan.md:150` — komentarz „14 pól” jest nieprawdziwy; `WpisLogu` i fixture mają po 12 kluczy. Nie wpływa na kod (typ jest poprawny), tylko na komentarz.
- [ ] `docs/tickets/30-FEATURE-selly-panel-frontend/raport.md:69` — „Nowe: 9 GATE …” — faktycznie w `selly.gate.test.tsx` jest 8 testów (8+13+5+25+10 = 61, nie zadeklarowane 62).
- [ ] `rebuild/frontend/src/pages/selly/SekcjaMapowanie.tsx` + `Selly.tsx:148-150` — klik „Sync” w wierszu tabeli mapowania NIE aktualizuje widocznego `<select>` „Dostawca” (oryginał robił to, `:643`); dialog i tak pokazuje, kogo dotyczy operacja, więc funkcjonalnie nieszkodliwe, ale to kolejne ciche odstępstwo od `:637-646`.
- [ ] `docs/tickets/30-FEATURE-selly-panel-frontend/plan.md:3` — pole `Status: Draft` nie zostało zaktualizowane do konwencji używanej w innych ticketach (`Draft → **Implemented**` itp., por. `28-FEATURE-selly-eksport-backend/plan.md:3`).

## Plan compliance

### Done ✓
- Krok 1 — `src/pages/selly/api.ts`: sześć tras, typy z fixtures, `czyBrakKonfiguracjiSelly` (D4) — zgodne.
- Krok 2 — `formatowanie.ts`: rozmiar, liczby, data logu (cięcie stringa, nie parsowanie), sortowanie MO1…MO10 — zweryfikowane linia po linii, zgodne.
- Krok 3 — pięć sekcji + dialog potwierdzenia (D3) z obu wejść („Wyślij do Selly” i „Sync” per wiersz) — zaimplementowane i przetestowane.
- Krok 4 — routing (`/selly` statycznie, nie lazy) i nawigacja (`PackageOpen`, D7, pozycja za „Konfiguracją”) — policzone: 13 tras, 11 pozycji, zgadza się z komentarzami.
- Krok 5 — `eksport.ts`: `Qy`/`OT`/`IT`/`TT` przeportowane 1:1, zweryfikowane naprzeciw `deminified/frontend-index.js:22706-23118` — wszystkie przypadki specjalne (`szerokosc`, `kodDostawcy`, `stan`, `ean`, `konstrukcja`, `tlTt`, `pr`, `sb/sf/hf/ls`, boolean) i priorytet źródła kolumn/separatora zgodne z oryginałem.
- Krok 6 — przycisk w `/katalog`: logika i etykiety zweryfikowane 1:1 z `:23384-23422`, w tym dokładny priorytet (wybór użytkownika → `shoper.kolumny` → `TT`) i wymuszenie separatora `";"` przy niepustym wyborze.
- Krok 7 — testy: GATE oparty na fixtures z konkretnymi asercjami wartości i niepustości (nie tautologiczny), testy zachowania (D3/D5), testy ścieżki 500 (D4), testy formatu CSV.
- D1, D2, D5, D6, D7 — zaimplementowane zgodnie z opisem w planie.
- Teza raportu o domyślnej gałęzi (`S`/`kolumnyWybrane` startuje z 15 kolumn domyślnych, więc `size===0` zachodzi dopiero po odznaczeniu wszystkiego) — **zweryfikowana niezależnie i potwierdzona**: `Nn` w `deminified/frontend-index.js:23022` ma faktycznie 15 elementów, a `KOLUMNY_DOMYSLNE` w `kolumny.ts` jest z nim zgodne. Wniosek raportu jest prawdziwy.
- Liczby 13 tras / 11 pozycji — policzone ręcznie w `App.tsx` i `nawigacja.ts`, zgadzają się z komentarzami.

### Missing or deviating ✗
- DoD „Roadmapa: blok 8 zamknięty… parytet odnotowany faktyczną wielkością” i „Sprostowania… zapisane w roadmapie/spec” — **niespełnione** (patrz BLOCKER).
- Trzy niezatwierdzone ciche odstępstwa od tekstów/zachowania oryginału (SekcjaCsv, SekcjaPolaczenie, odświeżanie po błędzie syncu) — nieujęte w D1–D7/O1, mimo że plan explicite wymaga zgłaszania każdego takiego przypadku.
- Deklarowane „trzy warianty etykiety” pokryte testami tylko w dwóch trzecich.

### Definition of done
- [x] `/selly` działa natywnie, pięć sekcji, sześć tras — funkcjonalnie kompletne (z zastrzeżeniami tekstowymi wyżej w SHOULD-FIX).
- [x] Sidebar 11 pozycji, router 13 tras — policzone i zgodne.
- [x] Komentarze o liczbie tras/pozycji zaktualizowane wraz z uzasadnieniem.
- [ ] Przycisk eksportu CSV działa we wszystkich trzech wariantach — kod poprawny, ale trzeci wariant bez testu (SHOULD-FIX).
- [x] GATE: kształty z czterech fixtures, mocki z fixtures, tablice niepuste, `_przyciete` odsiane.
- [x] Test ścieżki 500 „Brak konfiguracji” + kontrtest.
- [x] Testy potwierdzenia D3 z obu wejść.
- [x] `lint`/`typecheck`/`build`/`test` czyste — zweryfikowane uruchomieniem (566/566 testów, build 514,52 kB / gzip 156,65 kB, zgodnie z raportem).
- [ ] Roadmapa: blok 8 zamknięty, DoD rozliczone, poprawny rozmiar pliku — **niespełnione** (BLOCKER).
- [ ] Sprostowania „Trzy fakty” w roadmapie/spec — **niespełnione** (BLOCKER).

## Parallel-test concerns

None — wszystkie nowe testy używają MSW + `queryClient` w pamięci, fixtures są czytane tylko do odczytu (`readFileSync` na plikach z `contract/fixtures/`), brak portów, wspólnych baz czy plików tymczasowych z ustaloną ścieżką.

## Overall assessment

Implementacja jest solidna: klient API, formatowanie i logika eksportu CSV są zweryfikowane linia po linii względem oryginału i się zgadzają (w tym najbardziej ryzykowne przypadki — priorytet kolumn/separatora, przycisk „Sync” z pełnym zapisem, dialog potwierdzenia D3). Testy są konkretne, oparte na fixtures, niepuste i nietautologiczne; wszystkie cztery bramki przechodzą (566/566 testów, lint/typecheck/build czyste). Największy problem to nie kod, tylko dokumentacja: DoD ticketa jawnie wymaga aktualizacji `docs/rebuild-roadmap.md` i `docs/spec-frontend.md` (status bloku 8, poprawny rozmiar pliku, sprostowania faktograficzne), a diff ich nie dotyka — to dokładnie ten rodzaj długu, przed którym ostrzega `CLAUDE.md`. Dodatkowo w sekcji „Codzienna synchronizacja CSV” i „Status połączenia” znalazłem kilka cichych, niezatwierdzonych odstępstw tekstowych od oryginału, wartych krótkiej korekty albo świadomego zatwierdzenia.
