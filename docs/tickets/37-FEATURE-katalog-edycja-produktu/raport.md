# 37-FEATURE-katalog-edycja-produktu — raport z implementacji

## Podsumowanie

Widok `/katalog` dostał ZAPIS: dialog edycji produktu (port `LT()`, 42 pola, selecty
słownikowe, znaczniki i kasowanie override'ów) oraz menu „Akcje" w wierszu tabeli
(Edytuj / Historia `disabled` / Wstrzymaj-Aktywuj / Usuń). Trasy mutacji z sesji 12a
dostały wreszcie konsumenta. **Odstępstwo D4 z Iteracji 2 — modal podglądu read-only
w miejscu dialogu edycji — zostało zniesione, a `PodgladProduktu.tsx` usunięty.**

## Zmiany

- **Nowy:** `src/pages/katalog/api.ts` — port `Og` (`PATCH`) i `jb` (`DELETE`) plus odczyt
  i kasowanie override'ów; typ `Override` o kształcie z `contract/fixtures/GET_overrides.json`.
- **Nowy:** `src/pages/katalog/poleEdycji.ts` — 42 pola formularza jako dane (kolejność,
  dosłowne etykiety, rodzaj kontrolki), `KLUCZE_PAYLOADU`, helper opcji słownikowych
  (`localeCompare "pl"`), parser liczb, konwersje tri-state.
- **Nowy:** `src/pages/katalog/DialogEdycjiProduktu.tsx` — port `LT()`.
- **Nowy:** `src/pages/katalog/MenuAkcji.tsx` — menu wierszowe + `przeciwnyStatus`
  i `etykietaPrzelacznika`.
- `src/pages/Katalog.tsx` — trzy `useMutation` (edycja / przełączenie statusu / usunięcie),
  invalidacje, toasty z dosłownymi tekstami, `DialogPotwierdzenia` przy usuwaniu.
- `src/pages/katalog/TabelaProduktow.tsx` — ostatnia kolumna: `MenuAkcji` zamiast przycisku
  podglądu; props `onPodglad` → `onEdytuj`/`onPrzelaczStatus`/`onUsun`.
- **Usunięty:** `src/pages/katalog/PodgladProduktu.tsx` — odstępstwo D4 zniesione.
- **Nowy:** `test/katalog.poleEdycji.test.ts`, `test/katalog.edycja.test.tsx`.
- `test/katalog.test.tsx` — testy podglądu zastąpione testami menu; handler `/api/overrides`.
- `test/msw/kontrakt.ts` — `overridesZFixtura()`.

## Odstępstwa od planu

Brak odstępstw od planu. Zrealizowane zgodnie z decyzjami D1–D4.

Jedna rzecz **dodana ponad plan**, warta odnotowania: mutacje mają `onError` z toastem
`variant: "destructive"`. Oryginał nie daje ŻADNEJ informacji o błędzie (`$t` rzuca,
`onClick` nie łapie — nieobsłużone odrzucenie promisy, dialog zostaje otwarty bez komunikatu).
Poszedłem za konwencją odbudowy, która jest tu jednolita: `narzuty/TabelaNarzutow.tsx:53,62`,
`narzuty/TabelaPromocji.tsx:76`, `narzuty/DialogReguly.tsx:285`, `Staging.tsx:90`. To ta sama
klasa co odstępstwo D5 z I2 (`isLoading`/`isError`) — nie zmienia zachowania ścieżki udanej.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne, z jawnym zastrzeżeniem o zakresie.**
  Ticket jest frontendowy — nie zmienia ani jednej linii backendu, więc nie może naruszyć
  kształtu odpowiedzi. Sprawdzone:
  - **`GET /api/overrides` — `contract/fixtures/GET_overrides.json` UŻYTY JAKO WYROCZNIA.**
    Nowy `overridesZFixtura()` ładuje nagranie i podaje je testowi 1:1; test dowodzi, że
    dialog mapuje override'y po **`fieldName` (camelCase)** i że znacznik pojawia się przy
    `kategoria` i `labelSnow`, a nie przy innych polach. Pułapka snake_case z `CLAUDE.md` §5
    tu NIE występuje i jest to teraz zabezpieczone testem.
  - **`PATCH`/`DELETE /api/products/{id}` — zgodność ŻĄDANIA, nie odpowiedzi.**
    `contract/openapi.yaml:870-909` (metoda + ścieżka) oraz test porównujący `KLUCZE_PAYLOADU`
    frontu z `POLA_EDYTOWALNE_PRODUKTU` czytanym ZE ŹRÓDŁA backendu — obie listy mają
    dokładnie te same 42 pozycje.
  - **`GET_products.json`, `GET_atrybuty.json`** — konsumowane przez mocki MSW budowane
    wprost z nagrań (`test/msw/kontrakt.ts`), więc zmiana kształtu fixture'u wywala testy widoku.
  - **⚠ SPROSTOWANIE (review, runda 2):** GATE katalogu `katalog.gate.test.ts` leży
    w **`rebuild/backend/test/`** — to test BACKENDU, nie frontu, i plan.md początkowo mylnie
    liczył go jako nogę bramki tej sesji. Ten ticket nie zmienia ANI JEDNEGO pliku backendu
    (`git diff --name-only origin/develop...HEAD` → zero trafień w `rebuild/backend/`), więc
    tamten gate wraz z `WYJATKI_SZEROKOSC` jest nietknięty z konstrukcji. Backendowej suity
    nie uruchamiałem i nie twierdzę, że ją zweryfikowałem.
  - **Czego GATE NIE mógł sprawdzić:** sześć operacji mutacji produktów **nie ma nagranych
    fixtures** — ich przenagranie to jawnie zadanie sesji 12d. Kształt odpowiedzi `PATCH`
    (pełny produkt) i `DELETE` (`{ok:true}`) stoi więc na kodzie 12a, nie na nagraniu produkcji.
    Zapisane wprost, nie obchodzone.
- **Jednostkowe:** ✓ 18 nowych w `katalog.poleEdycji.test.ts`.
- **Integracyjne (RTL + MSW):** ✓ 18 nowych w `katalog.edycja.test.tsx` — edycja (`PATCH`
  tylko dotkniętych pól), pole scalone „Bieznik/model" (dwa klucze), przełącznik statusu
  w obie strony, usuwanie z potwierdzeniem ORAZ z anulowaniem, kasowanie override'u,
  invalidacje z **asercją negatywną** na `["/api/alerts"]` i `["/api/analytics"]`.
- **E2E:** nie dotyczy — plan ich nie przewidywał.
- **Suita FE:** **683 testy / 45 plików** (baseline 646/43). `lint`, `typecheck`, `build` czyste.
- **Backend:** nietknięty, nie uruchamiany.

## Poprawki po review

Review: 0 BLOCKER, 1 SHOULD-FIX, 2 NICE-TO-HAVE. Naniesione:

- **SHOULD-FIX** — `TabelaProduktow.tsx`: nagłówek ostatniej kolumny nadal mówił „Podgląd",
  choć kolumna ma już pełne menu, a oryginał (`:23693-23695`) ma tam **„Akcje"**. Etykieta
  została z I2 i nie pojechała za zakresem — komentarz w tym samym pliku twierdził, że kolumna
  wróciła do oryginału, a kod temu przeczył. Poprawione; **dołożony test** (`header-akcje`),
  bo żaden nie sprawdzał treści tego nagłówka.
- **NICE-TO-HAVE** — `DialogEdycjiProduktu.tsx`: tytuł używał `kodDostawcy ?? ""`, a oryginał
  (`:24037`) ma `||`. Różnica ujawnia się dla wartości fałszywych (`0`, `""`). Zrównane z portem.
- **NICE-TO-HAVE (nie naniesione, świadomie)** — brak blokady podwójnego kliknięcia przełącznika
  statusu. **Ta sama wada jest w oryginale**, więc naprawa byłaby odstępstwem bez decyzji
  użytkownika. Odnotowane jako obserwacja, nie dług.

**Runda 2 review: 0 BLOCKER, 0 SHOULD-FIX, 1 NICE-TO-HAVE** (ta sama, świadomie odrzucona
uwaga o dwukliku). Reviewer sprostował przy okazji własną metodologię z rundy 1: sprawdzał
`katalog.gate.test.ts` pod ścieżką frontendową, a ten test leży w backendzie — poprawione
w sekcji o gate wyżej.

Po poprawkach: **683 testy / 45 plików**, lint/typecheck/build czyste.

## Breaking changes

Brak zmian łamiących API. Zmiany wewnętrzne frontendu:

- `TabelaProduktow` ma inne propsy (`onEdytuj`/`onPrzelaczStatus`/`onUsun` zamiast `onPodglad`) —
  jedyny konsument to `Katalog.tsx`, zaktualizowany.
- Zniknęły `data-testid`: `button-podglad-{id}`, `dialog-podglad-produktu`, `podglad-pole-*`,
  `text-podglad-nazwa`. Zastąpione przez `button-actions-{id}`, `button-edit-{id}`,
  `dialog-edycja-produktu`, `button-save-edit`, `button-override-{pole}`, `dialog-usun-produkt`.

## Ustalenia do zapamiętania (dla roadmapy i kolejnych sesji)

1. **Oryginał NIE invaliduje `["/api/alerts"]` ani `["/api/analytics"]` przy mutacjach
   produktu.** `Og` (`:9149`) i `jb` (`:9152`) wołają wyłącznie `Uo("/api/products")`.
   Prompt sesji dopuszczał te klucze warunkowo („jeśli oryginał tak robi") — nie robi.
   Pilnuje tego asercja negatywna w teście.
2. **`Yb()` (`:10290`) nie jest wywołaniem API** — to lokalny dziennik w IndexedDB,
   nadpisujący cache `["/api/history"]` przez `setQueryData`. Kolejna sesja nie znajdzie dla
   niego endpointu, bo takiego nie ma. Świadomie NIE portowany (D2), zastąpiony invalidacją
   `["/api/history"]`.
3. **Kolejność pozycji menu to Edytuj → Historia (`disabled`) → separator →
   Wstrzymaj/Aktywuj → Usuń**, a „Wstrzymaj/Aktywuj" to JEDNA pozycja przełączająca.
   Roadmapa (i prompt) opisywały to jako „Edytuj / Wstrzymaj-Aktywuj / Usuń, Historia disabled",
   co sugerowało inną kolejność i możliwe dwie osobne akcje.
4. **Lista pól dialogu zgadza się co do jednego z `POLA_EDYTOWALNE_PRODUKTU`** (42 pola)
   — potwierdzone testem, nie tylko przeglądem. `dostawca` jest renderowany, ale `disabled`,
   więc nie wchodzi do payloadu.

## Follow-up (świadomie odłożone)

- **`Staging.tsx:177,210` nadal używa surowego `window.confirm`** — jedyne takie miejsce
  w odbudowie po tym tickecie. Niespójne z odstępstwem D2 (7b) / D6 (narzuty) / D1 (ta sesja).
  Poza zakresem 12c; kandydat na drobny ticket porządkowy albo na domknięcie w 12e.
- **Przenagranie fixtures dla sześciu operacji mutacji produktów** — sesja 12d. Do tego czasu
  kształt odpowiedzi `PATCH`/`DELETE` nie ma wyroczni z produkcji.
- **`WYJATKI_SZEROKOSC` w `rebuild/backend/test/katalog.gate.test.ts`** — do usunięcia w 12d po przenagraniu
  `GET_products.json`. Wyjątek jest samoczyszczący.
- **Ręczna edycja `szerokosc` gubi zera końcowe** („10.00" → „10") — port 1:1 zastanej wady
  produkcji (D3). Kandydat na wpis w backlogu, jeśli Ania uzna to za problem; naprawa wymaga
  odejścia od oryginału (pole tekstowe zamiast `type="number"`).
- **Pozycja „Historia" w menu jest martwa** — tak jak w produkcji. Ożywienie jej (podpięcie
  do `/historia` z filtrem na produkt) byłoby NOWĄ funkcją; backend ma już dane od 12a.

## Docs updates

Trzy doc-checkery równolegle. Wynik:

### `docs/rebuild-roadmap.md` (8 miejsc)
- §4 tabela indeksu — wpis `12c: 37-FEATURE-katalog-edycja-produktu · 2026-09-05`.
- Nagłówek Iteracji 12 — „sesja 12a zrobiona, cztery zostały" → „sesje 12a i 12c zrobione,
  trzy zostały"; `12c FE ⬜` → ✅. **Sesja 12b nietknięta** (idzie równolegle w innym worktree).
- Sekcja 12c przepisana z planu na STAN dowiezionego zakresu.
- **Trzy sprostowania faktów:** kolejność menu (Historia stoi DRUGA, nie na końcu);
  Wstrzymaj/Aktywuj to JEDNA pozycja przełączająca; invalidacje to wyłącznie
  `["/api/products"]` (+ `["/api/history"]` z D2) — usunięty warunkowy zapis z promptu.
- **Nowy fakt:** `Yb()` (`:10290-10303`) to lokalny dziennik IndexedDB, nie endpoint.
- **Nota do bloku 12d:** sześć operacji mutacji nadal bez nagrań + poprawiona ścieżka
  `rebuild/backend/test/katalog.gate.test.ts` (było „`test/katalog.gate.test.ts`", co
  sugerowało frontend).
- **Nota do bloku 12e:** `Staging.tsx:177,210` — jedyny surowy `window.confirm`.
- Rozliczona nota z 12a o `szerokosc` — z ostrzeżenia „wymaga uwagi przed portem" na fakt (D3).

### `docs/rebuild-backlog.md`
- **#3** (saga szerokości) — dopisane, że wada ręcznej edycji została zaniesiona do frontu
  1:1 w 12c (D3), ze wskazaniem `poleEdycji.ts`; status wymienia 12c obok 12a.
- **#14** (mass-assignment) — nowy akapit „Front dogonił backend w sesji 12c": formularz
  wysyła dokładnie 42 pola z listy backendu, pilnowane testem `katalog.poleEdycji.test.ts`.
- **#22** (martwa kolumna „Promocja") — sprawdzony, **bez zmian**; 12c go nie dotknęła.
- **#48 NOWY** (FRONTEND, ⬜ **do decyzji** — nie ✅, bo decyzja należy do użytkownika):
  `Staging.tsx:177,210` jako jedyne miejsce z surowym `window.confirm`; 12e wskazane jako
  naturalny moment domknięcia. Numeracja zweryfikowana — #47 był najwyższy.
- Odstępstwo D4 z I2 nie miało w backlogu własnego wpisu, więc nie było czego korygować.

### `docs/spec-frontend.md`
- Linia ~169 — **usunięta nieprawda**: „odbudowa dokłada podgląd read-only jako świadome,
  zatwierdzone odstępstwo". Zastąpiona informacją, że D4 było chwilowe i zostało zniesione w 12c.
- Nowy blok „Odbudowa (12c…)" — menu „Akcje", 42-polowy dialog, `PATCH`/`DELETE` tylko
  z dotkniętymi polami, `GET`/`DELETE /api/overrides`, invalidacje, odstępstwa D1 i D3.

### Bez zmian (z uzasadnieniem)
- `docs/spec-backend.md` — żaden fragment nie twierdził, że trasy mutacji produktów albo
  `/api/overrides` nie mają konsumenta w UI, więc dodanie frontu niczego tam nie unieważniło.
- `CLAUDE.md` — ticket czysto frontendowy, nie obalił żadnej z opisanych pułapek ani nie
  ujawnił nowej tego kalibru.

### Pre-existing issues
Żaden z trzech doc-checkerów nie znalazł sprzeczności w treści niezwiązanej z tym ticketem.
