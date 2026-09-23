# 121-FEATURE-selly-harmonogram-sync — raport z implementacji

## Podsumowanie
Przeportowano harmonogram Selly (`scheduler_selly.cjs`) i sześć tras `sync-*` (`routes_sync.cjs`)
z `origin/main@88fa31c` do `rebuild/backend/`. Harmonogram stoi za nową flagą `SELLY_SCHEDULER`
(domyślnie wyłączoną) i dodatkowo odmawia startu przy `SELLY_TRYB=wylaczony`; jedna instancja
`discovery` powstaje w `server.ts` i jest dzielona przez Tor 1, Tor 2 i trasy ręczne. Naprawiono
trzy zastane defekty produkcji (dwa zepsute importy i zgubioną listę dostawców w `sync-full-force`)
— każdy jako świadome, zatwierdzone odstępstwo.

## Zmiany
- **Nowy:** `rebuild/backend/src/selly/rest/scheduler.ts` — `ACTIVE_SUPPLIERS`, `FULL_ROTATION`,
  `suppliersForFullToday`, `isFirstOfMonthDay`, `runDeltaAll`, `runFullBatch`,
  `stworzHarmonogramSelly` (tick 60 s, wstrzykiwany zegar, zawory).
- **Nowy:** `rebuild/backend/src/routes/selly-sync.ts` — sześć tras za `requireAuth`.
- `rebuild/backend/src/repos/selly.ts` — `ostatnieWpisySync` (projekcja 9 kolumn `snake_case`,
  zawężenie istniejącej `KOLUMNY_LOGU`), `zamknijOsieroconeWpisySync`, `POWOD_PRZERWANIA`.
- `rebuild/backend/src/config/env.ts` — flaga `SELLY_SCHEDULER` (`flagaBoolDomyslnieWylaczona`).
- `rebuild/backend/src/app.ts` — opcja `discoverySelly`, rejestracja `trasySellySync`; klient Selly
  wyciągnięty do wspólnej zmiennej (był budowany inline wyłącznie dla `trasySelly`).
- `rebuild/backend/src/server.ts` — jedna `discovery` na proces, harmonogram pod flagą,
  `zatrzymaj()` w `zamknij()`.
- `contract/openapi.yaml` — sześć ścieżek `sync-*` ze schematami odpowiedzi i ciał żądań.
- `rebuild/backend/test/gate/aplikacja.ts` — opcja `discoverySelly` w środowisku testowym.
- **Nowy:** `test/selly.harmonogram.test.ts` (14 testów), `test/selly.sync.gate.test.ts` (12 testów).

## Odstępstwa od planu
Jedno, wymuszone przez narzędzie. Plan zakładał schematy odpowiedzi jako nazwane komponenty
w `components.schemas`. Okazało się to niewykonalne: `tools/generate-openapi-schemas.cjs`
przepisuje CAŁY blok `components.schemas` z fixtures (klucz `schemas:` leży wewnątrz jego
znaczników), a przy okazji zdejmuje `, content: { … }` z KAŻDEJ jednolinijkowej odpowiedzi
(`^ {8}"\d{3}": \{ …`), nie tylko ze swoich. Pierwsza wersja wstawki znikała więc przy każdym
biegu generatora. Rozwiązanie: schematy inline, w formie WIELOLINIJKOWEJ, która nie pasuje do
tego wzorca. Zweryfikowane: pełny bieg generatora nie zmienia teraz pliku ani o bajt.

## Wyniki testów
- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne, z jawnym ograniczeniem.
  - **Kontrakt:** wszystkie sześć ścieżek dopisane do `contract/openapi.yaml`; każda odpowiedź
    w testach przechodzi `sprawdzZgodnoscZKontraktem`. `tools/generate-openapi-schemas.cjs
    --sprawdz` → „aktualny"; test `kontrakt.spojnosc` zielony.
  - **Fixtures:** ŻADNEGO w zakresie — i to nie jest obejście gate'a. Cztery z sześciu tras są
    mutacjami wołającymi Tor 1/Tor 2, czyli realnymi PUT-ami wariantów i zakładaniem produktów
    w cudzym sklepie `agroopony.selly24.pl`; nagrywarka ich nie ruszała, bo każde nagranie
    zmieniałoby ten sklep. Z pozostałych — `sync-delta-supplier`, `sync-full-today`
    i `sync-full-force` oddają na produkcji HTTP 500 (zepsute importy), więc nagranie 1:1 byłoby
    nagraniem awarii, a po naprawie i tak by się nie zgadzało. Siatką jest kontrakt + zachowanie
    na atrapie klienta. Kształty odczytane wprost z `routes_sync.cjs@88fa31c`.
- **Jednostkowe/integracyjne:** ✓ 26 nowych testów (14 harmonogramu + 12 gate tras).
- **Cała suita:** ✓ 102 pliki, 1658 testów, 3 pominięte. `lint`, `typecheck`, `build` — czyste.
- Żaden test nie woła prawdziwego Selly (atrapa `test/gate/selly-atrapa.ts`).

## Breaking changes
Brak dla istniejących tras. Nowa zmienna środowiskowa `SELLY_SCHEDULER` — **domyślnie wyłączona**,
więc pominięcie jej nie zmienia zachowania procesu; produkcja musi ją włączyć jawnie, inaczej
nocna synchronizacja Selly nie ruszy. Wkład do `docs/cutover.md` w „Do koordynatora" karty.

## Follow-up
- **`docs/rebuild-backlog.md` ma DWA różne wpisy pod numerem `#103`** (bug `runFullTodays`
  oraz „Braki w cenniku" z 22.09) — kolizja numeracji w samym backlogu, poza zakresem tego
  ticketa. Do rozplątania przez koordynatora.
- **Zdanie o źródle prawdy `7d6cfc9` w `karta.md`** jest przeterminowane (zamrożenie to `88fa31c`).
  Dla tej karty bez znaczenia — zweryfikowałem, że `scheduler_selly.cjs` i `routes_sync.cjs` są
  bajt w bajt identyczne na `abe5f14` i `88fa31c`. Poprawione we własnej karcie.
- **`dryRun` Toru 1 nadal nie chroni przed `createVariant`** w discovery (zastane, I15.6).
  Harmonogram nie używa `dryRun`, więc go to nie dotyka; zostaje jako znana właściwość.
- **Montaż modułu dostępności** (`availability_sync`, karta I15.10) — punkt wpięcia jest
  przygotowany (`server.ts` tworzy i wstrzykuje zależności Selly); ustalenie w `wejscie-121.md`.
