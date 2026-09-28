# I15.8 — Selly REST 3: harmonogram (Tor 2 o 4:30) i trasy `sync-*`

> **Stan:** ✅ 2026-09-23 · 121-FEATURE-selly-harmonogram-sync
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #60 · **Zależy od:** I15.7
> **Ticket:** 121

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Dawne 13d-3. Port TS z `origin/main`: `mirror/backend/selly/scheduler_selly.cjs` (Tor 2 codziennie **04:30**, po
auto-pull dostawców o 04:00; pętla sprawdzająca) i `routes_sync.cjs` — sześć tras: `GET /api/selly/sync-status`,
`POST /api/selly/sync-delta-supplier`, `sync-delta-all`, `sync-full-supplier`, `sync-full-today`, `sync-full-force`
→ `contract/openapi.yaml` + nagrania z oryginału (z atrapą Selly).
- Harmonogram za flagą środowiskową, **domyślnie wyłączony** (wzorzec `IMPORT_SCHEDULER`), produkcja włącza jawnie —
  wejście dla koordynatora (cutover: kto od dnia przełączenia robi nocną synchronizację).
- **Przycisków synchronizacji w panelu NIE ma na produkcji** (koordynator 2026-09-22: żaden z 8 żywych skryptów frontu
  nie woła `sync-*`). Dawny plan 13d-3 zakładał przyciski — to było założenie. Odtwarzamy 1:1 (bez UI); jeśli Ania ich
  chce, to osobna decyzja.
⚠ Bezpieczeństwo jak w I15.6 — trasy `sync-*` realnie zapisują do sklepu; w testach tylko atrapa.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/rest/scheduler*`, trasy `sync-*`, rejestracja w `app.ts`, `config/env.ts` (flaga), `contract/openapi.yaml`, testy.

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona** — źródło prawdy to `origin/main` na commicie `88fa31c`; nowy kod na `main` = zgłoś.
Zweryfikowane w tickecie 121: `scheduler_selly.cjs` i `routes_sync.cjs` są **bajt w bajt identyczne**
na `7d6cfc9`, `abe5f14` i `88fa31c`, więc dla TEJ karty wybór commitu zamrożenia niczego nie zmieniał.

—

## Dowiezione

**Ticket 121, 2026-09-23.** Bramki zielone: `lint`, `typecheck`, `build`, `test`
(102 pliki, 1658 testów, 3 pominięte). 26 nowych testów.

**Harmonogram** — `src/selly/rest/scheduler.ts`, port `scheduler_selly.cjs@88fa31c`:
tick co 60 s, Tor 1 o HH:55 + fallback HH:10/25/40, Tor 2 o 04:30 z rotacją per dzień
tygodnia (MO7 pierwsza sobota, MO8 pierwsza niedziela — granica `date.getDate() <= 7`),
`buildCache: i === 0` (cache kodów Selly raz na partię). Zegar wstrzykiwany, więc godziny
są testowane bez czekania.

**Sześć tras** — `src/routes/selly-sync.ts`, wszystkie za `requireAuth`, wszystkie dopisane
do `contract/openapi.yaml`.

**Montaż** — JEDNA instancja `discovery` powstaje w `server.ts` i idzie do `stworzApp`
oraz do harmonogramu (precedens `synchronizuj`). `app.ts` buduje zastępczą, gdy jej nie
podano (testy). Flaga `SELLY_SCHEDULER`, domyślnie wyłączona.

### Odstępstwa świadome (wszystkie zatwierdzone przez użytkownika)
1. `sync-delta-supplier` → `syncDelta` zamiast nieistniejącego `syncDeltaForDostawca`
   (`wejscie-117.md`).
2. `sync-full-today` / `sync-full-force` → `runFullBatch` zamiast nieistniejącego
   `runFullTodays` (decyzja 2026-09-23; `wejscie-109.md` zostawiało to do rozstrzygnięcia).
3. `sync-full-force` honoruje listę `dostawcy`. **To był DRUGI, niezależny błąd**, nieopisany
   w żadnym wejściu: produkcja przekazuje `{forceSuppliers}`, a `runFullBatch` czyta
   `opts.suppliers`, więc nawet po naprawie (2) „force MO1,MO2" puściłoby dzisiejszą rotację —
   czyli zapis do sklepu dla INNYCH dostawców niż wskazane.
4. Harmonogram nie startuje przy `SELLY_TRYB=wylaczony` (decyzja 2026-09-23). Zawór obronny
   na duplikaty z `wejscie-108.md`; `tylko-odczyt` startu nie blokuje.
5. Osierocone wpisy `selly_sync_log` ze statusem `w_trakcie` domykane przy starcie jako `blad`
   z `szczegoly_json = {"powod":"przerwany restartem procesu"}` (`wejscie-117.md`; wybór
   statusu — decyzja 2026-09-23, żeby nie wprowadzać wartości nieznanej kolumnie).
6. Flaga `SELLY_SCHEDULER`, domyślnie wyłączona — produkcja instaluje harmonogram
   bezwarunkowo (`extensions.cjs:486-487`).

### Gate odbudowy — ograniczenie, które trzeba znać
**Dla tych sześciu tras NIE MA i nie będzie fixture'ów.** Cztery są mutacjami wołającymi
Tor 1/Tor 2, czyli realnymi zapisami do cudzego sklepu `agroopony.selly24.pl` — nagrywarka
ich nie ruszała. Trzy (`sync-delta-supplier`, `sync-full-today`, `sync-full-force`) oddają
na produkcji HTTP 500, więc nagranie byłoby nagraniem awarii. Siatką jest kontrakt
(`contract/openapi.yaml`) + zachowanie na atrapie klienta. Kształty odczytane wprost
z `routes_sync.cjs@88fa31c`.

### Czego NIE zrobiono (świadomie)
Przycisków synchronizacji w panelu — nie ma ich na produkcji, karta zakładała odtworzenie 1:1.

## Do koordynatora

**1. `docs/cutover.md` — dopisz wiersz do tabeli zmiennych (rozdział 4, ok. linia 208):**

| `SELLY_SCHEDULER` | **wyłączone** | `true` | **nocna synchronizacja Selly nie chodzi** — Tor 1 (co 15 min) i Tor 2 (04:30) milczą, sklep dostaje wyłącznie CSV, a panel wygląda normalnie |

Warto też dodać do listy kontrolnej startu (rozdz. „W logu startu…", ok. linia 337), że proces
wypisuje `[selly-scheduler] wyłączony (SELLY_SCHEDULER nie jest ustawione)` — jeśli miał być
włączony, to jest ten sam rodzaj cichej awarii co przy `IMPORT_SCHEDULER`.
⚠ Zawór dodatkowy: harmonogram nie ruszy także przy `SELLY_TRYB=wylaczony`, nawet z ustawioną flagą.

**2. Kolizja numeracji w `docs/rebuild-backlog.md`: DWA różne wpisy mają numer `#103`** —
jeden o buggu `runFullTodays` w Selly, drugi „Braki w cenniku / bezpieczeństwo źródła"
z 22.09. To nie jest kolizja numerów ticketów (osobna sprawa), tylko numeracji w samym
backlogu. Nie ruszam jej, bo backlog jest współdzielony.

**3. Fakt do roadmapy (graf wywołań, reguła 3 z CLAUDE.md):** montaż obu modułów jest
w `mirror/backend/extensions.cjs:483-491` — `registerSyncRoutes` i `installScheduler(_bridgeDb)`,
bez żadnej flagi i bez opcji (czyli Tor 2 chodzi na produkcji z `autoCreate=true`). Karta
zakładała tylko, że „harmonogram jest aktywny"; teraz wiadomo, gdzie i z czym.

**4. Zdanie o źródle prawdy `7d6cfc9`** było w tej karcie (i jest w I15.6/I15.7)
przeterminowane wobec zamrożenia na `88fa31c`. Poprawiłem we własnej karcie; w cudzych nie
ruszam. Dla Selly różnica jest żadna — pliki są identyczne na obu commitach (zweryfikowane).
