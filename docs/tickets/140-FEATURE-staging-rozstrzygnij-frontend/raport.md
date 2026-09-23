# 140-FEATURE-staging-rozstrzygnij-frontend — raport z realizacji

## Summary

Port `mirror/frontend/assets/staging-policy-injection.js` @ `88fa31c` (wersja
`20260923dotchoice` — ta, którą `index.html` naprawdę ładuje) do widoku `/staging` w React.
Wiersz z niejednoznacznym dopasowaniem albo ze sprawą starej karty dostaje w kolumnie „Akcje"
przycisk „Rozstrzygnij" / „Sprawdź kartę", a ten otwiera okno w trzech rozłącznych gałęziach
(stara karta · dopasowanie · sprzeczne wiersze pliku). Blokada akceptacji 409 pokazuje się
w osobnym oknie „Nie zapisano zmian" z komunikatem prosto z serwera. Układ ekranu z I14
(14a/14b/14c) nietknięty — wszystkie 28 istniejących testów stagingu przechodzą bez zmiany
asercji.

## Changes

- **Nowy:** `rebuild/frontend/src/pages/staging/polityka.ts` — typy czterech tras z
  `contract/openapi.yaml`, warunek i etykieta przycisku, rozpakowanie komunikatu 409 z ciała
  odpowiedzi, warunki włączania wyborów i trzy warianty notatki (teksty dosłowne).
- **Nowy:** `rebuild/frontend/src/pages/staging/OknoRozstrzygniecia.tsx` — okno z trzema
  gałęziami, `useQuery` po `["/api/staging", id, "review"]`, mutacje `resolve`
  i `choose-absence-card`, potwierdzenie przez `DialogPotwierdzenia`.
- **Nowy:** `rebuild/frontend/src/pages/staging/OknoBlokady.tsx` — „Nie zapisano zmian".
- `rebuild/frontend/src/pages/staging/TabelaStagingu.tsx` — nowy prop
  `otworzRozstrzygniecie`, przycisk w kolumnie „Akcje" za „Szczegóły" (tam, gdzie oryginał
  doklejał go przez `row.lastElementChild`).
- `rebuild/frontend/src/pages/Staging.tsx` — montaż obu okien, stan `rozstrzyganeId`
  i `blokada`; mutacja `akcja` przyjmuje teraz `{wykonaj, akceptacja}`, żeby `onError`
  rozróżniał błąd akceptacji (okno) od pozostałych (pasek).
- **Nowy:** `rebuild/frontend/test/msw/staging.ts` — `handleryStagingu()` (lista, mutacje,
  CZTERY trasy polityki) + fabryki `przegladDopasowania()`, `przegladStarejKarty()`,
  `przegladSprzecznychWierszy()`.
- `rebuild/frontend/test/staging.test.tsx` — przepięty na współdzielone mocki, asercje bez zmian.
- **Nowy:** `rebuild/frontend/test/staging.rozstrzygnij.test.tsx` — 34 testy.

## Deviations from plan

Brak odstępstw od planu. Cztery decyzje z Kroku 3 (D1–D4) i dwie wykonawcze (D5, D6)
zrealizowane tak, jak opisuje `plan.md`.

Dwa doprecyzowania, które wyszły w trakcie i nie zmieniają zakresu:

1. **Warunek przycisku czyta `powod` ORAZ `ostrzezenie`.** Plan mówił o `powod`. Oryginał
   testował `row.textContent`, czyli tekst CAŁEJ komórki „Powód", a ta renderuje oba pola
   (`TabelaStagingu.tsx`). Importer wkłada frazę do `bledy`, które trafiają i do `powod`
   (`[...zmiany, ...bledy]`), i do `ostrzezenie` (`bledy.join`) — sprawdzanie obu jest więc
   wierniejsze niż samego `powod`. Pokryte testem „fraza w `ostrzezenie` też daje przycisk".
2. **`test/msw/staging.ts` ma też handler `close-absence-review`**, mimo że frontend tej
   trasy nie woła (D1). Stoi tam celowo: gdyby ktoś przywrócił wywołanie, test od razu je
   zobaczy, zamiast po cichu wpaść w stan błędu (pułapka MSW). Osobny test pilnuje, że
   żadna mutacja pod ten adres nie leci.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** **N/D dla fixtures — uzasadnione.** Dla czterech
  tras polityki `contract/fixtures/` nie zawiera nic i nie było czego nagrać (ustalenie
  D129.5 karty I15.4c — nagrania obejmują wyłącznie `GET_staging.json` i
  `GET_staging_paged.json`). Ticket nie zmienia backendu ani `contract/openapi.yaml`.
  **W zamian — gate na dosłowność:** `test/staging.rozstrzygnij.test.tsx` porównuje treść
  okna znak w znak z `staging-policy-injection.js` @ `88fa31c` we wszystkich trzech
  gałęziach, a ciała żądań (`{action,targetCode}`, `{selectedCode,candidateVersion}`)
  ze schematami z `contract/openapi.yaml`. Lista `/paged` nadal jedzie z nagranego fixture'a
  (`stronaStaginguZFixtura()`), więc kształt wiersza pozostaje kontraktowy.
  **Skuteczność gate'u zweryfikowana mutacją:** podmiana notatki w `polityka.ts` i frazy
  „RÓŻNY — nie łączyć" w oknie wywaliła dokładnie te testy, które ich pilnują (2 próby,
  2 trafienia); źródła przywrócone z gita.
- **Unit/komponentowe:** ✓ **991 testów w 56 plikach** (przed kartą 957 w 55), Node 20.20.2.
  Nowe: 34 w `staging.rozstrzygnij.test.tsx`; `staging.test.tsx` 28/28 bez zmiany asercji.
- **Bramki:** `npm run lint` ✓ · `npm run typecheck` ✓ (trzy projekty tsconfig) ·
  `npm run build` ✓ · `npm test` ✓.
- **Integracyjne/E2E:** pominięte — ticket jest czysto frontendowy, a backend tych tras ma
  własne testy z I15.4c (`test/staging-polityka.trasy.test.ts`, 14 testów).

## Breaking changes

**Brak dla użytkownika.** Jedna zmiana sygnatur wewnętrznych, w plikach tej karty:

- `TabelaStagingu` wymaga nowego propa `otworzRozstrzygniecie` (jedyny konsument to
  `Staging.tsx`);
- mutacja `akcja` w `Staging.tsx` przyjmuje `{wykonaj, akceptacja}` zamiast gołej funkcji.

⚠ **Dla karty I15.11:** `zamockujApi()` w `staging.test.tsx` nie tworzy już handlerów sam —
deleguje do `handleryStagingu()` z `test/msw/staging.ts`. Nowe trasy dokłada się tam, nie
w pliku testu.

## Follow-up

Rzeczy zauważone, świadomie NIE realizowane w tym tickecie:

1. **`POST /api/staging/{id}/close-absence-review` jest w backendzie martwa z perspektywy
   frontendu** (D1). Trasa, jej testy backendowe i wpis w `contract/openapi.yaml` zostają —
   usuwanie ich byłoby odstępstwem w drugą stronę. Warte decyzji przy cutoverze: albo
   przywrócić przycisk jako świadome odstępstwo, albo odnotować trasę jako nieużywaną.
2. **Przy różnym DOT użytkownik nie ma ŻADNEJ akcji** poza zamknięciem okna — sprawa wróci
   przy każdym imporcie, dopóki dostawca nie zmieni danych. To jest zachowanie zamrożonej
   produkcji (tekst okna mówi o tym wprost), nie defekt portu. Zgłoszone jako punkt 1 wyżej.
3. **`lib/api.ts::zadanie()` gubi strukturę ciała błędu** — rzuca
   `Error("<status>: <surowy tekst>")`. Rozpakowujemy to lokalnie w
   `staging/polityka.ts::komunikatBledu()`. Gdyby kolejne widoki potrzebowały tego samego,
   warto rozważyć typowany błąd w `lib/api.ts` — ale to rusza wszystkie widoki naraz, więc
   osobny ticket, nie ta karta.
4. **Brak globalnego error middleware w backendzie** — nota z I15.4c „Do koordynatora" p. 6
   nadal aktualna. Bez niego wyjątek spoza `POST /api/staging/accept` wychodzi jako HTML-owe
   500 i okno „Nie zapisano zmian" pokaże wtedy tekst zapasowy zamiast treści błędu
   (pokryte testem: 409 bez `message` → „Odśwież staging i spróbuj ponownie.").

## Review fixes applied

Przegląd (`review.md`): 2 BLOCKER · 2 SHOULD-FIX · 2 NICE-TO-HAVE. Bramki reviewer przebiegł
samodzielnie — zgodne z raportem (991/991).

**Oba BLOCKER-y dotyczyły dokumentacji, nie kodu** — aktualizacja `docs/karty/I15.5/karta.md`
i commit `raport.md`. Rozliczone w Fazie 5 tego ticketa (patrz „Docs updates" niżej).

**Oba SHOULD-FIX opierały się na MOIM błędnym założeniu — poprawiłem założenie, nie kod.**
Reviewer zauważył, że oryginał ma DWA osobne elementy błędu (`:113`, `:127`), po jednym dla
gałęzi „stara karta" i „dopasowanie", a port ma jeden wspólny stan — i słusznie zacytował mój
własny komentarz w kodzie („Gałęzie 1 i 2 mogą wystąpić razem"). **Sprawdziłem to w importerze
i ten komentarz był nieprawdziwy:** `_absenceReview` ustawiają WYŁĄCZNIE dwie gałęzie
(`src/import/polityka/fabryka.ts:855` i `:902`), a obie budują snapshot od zera z PRODUKTU
KATALOGOWEGO (`{...p, _policyVersion, _catalogVersion, _absenceReview, _candidates}`). Produkt
katalogowy nie niesie `_matchIssue` — to pole powstaje w ścieżce dopasowania wiersza importu
(`:485`, `:501`), a tamta kończy się własnym `dodajZgloszenie()` + `continue`. Obie gałęzie są
więc w danych ROZŁĄCZNE, w każdym osiągalnym przypadku renderuje się dokładnie jedna, a miejsce
komunikatu jest to samo co w oryginale.

Zamiast dokładać drugi stan błędu dla nieosiągalnego przypadku (i test, który musiałby zasiać
odpowiedź niemożliwą do wyprodukowania przez backend):

- poprawiłem **w miejscu** fałszywe zdanie w nagłówku `OknoRozstrzygniecia.tsx` — teraz opisuje
  zmierzony stan razem z numerami linii dowodu (CLAUDE.md: „usuń z własnego pliku to, co ticket
  obalił", nie dopisuj obok);
- poprawiłem to samo zdanie w `plan.md`, sekcja „Trzy gałęzie okna".

**NICE-TO-HAVE 1 przyjęty jako trafny:** ustalenie dla I15.11 idzie do
`docs/karty/I15.11/wejscie-140.md`, nie tylko do „Do koordynatora" karty zamykanej —
to wprost reguła 2 z `CLAUDE.md`, a mój plan kierował je w złe miejsce. Zrealizowane w Fazie 5.

**NICE-TO-HAVE 2 (`useMemo` na `kandydatDoWersji`) — nie wdrażam.** Lista kandydatów ma
w praktyce 1–3 pozycje, a `find` po niej przy renderze okna nie jest kosztem; `useMemo` dołożyłby
zależności bez zysku. Odnotowane dla I15.11, która i tak wejdzie w ten plik.

Bramki po poprawkach: `lint` ✓, `typecheck` ✓, testy stagingu 62/62.
