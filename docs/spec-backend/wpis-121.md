# Wpis do spec-backend od ticketu 121 (karta I15.8) · 2026-09-23

## Harmonogram synchronizacji Selly i sześć tras `sync-*`

Port `origin/main@88fa31c`: `mirror/backend/selly/scheduler_selly.cjs`
i `mirror/backend/selly/routes_sync.cjs` → `rebuild/backend/src/selly/rest/scheduler.ts`
i `rebuild/backend/src/routes/selly-sync.ts`.

### Potwierdzone zachowanie oryginału

**Montaż (graf wywołań, `mirror/backend/extensions.cjs:483-491`).** Oba moduły podnosi ten sam
blok `try/catch`: `registerSyncRoutes(app, { db, requireAuth: we })` i `installScheduler(_bridgeDb)`.
Dwa wnioski, których wcześniejsze dokumenty nie miały:
- harmonogram na produkcji **nie stoi za żadną flagą** — instaluje się przy każdym starcie;
- `installScheduler` dostaje **wyłącznie `db`**, bez `opts`, więc Tor 2 chodzi z domyślnym
  `autoCreate = true` (`opts.autoCreate !== false`) i `maxProducts = 5000`.

**Godziny.** Tick co 60 s. Tor 1 biegnie przy minucie ∈ {55, 10, 25, 40} — 55 to bieg
„event-driven" po auto-pull dostawców o HH:54, pozostałe to fallback dla ręcznych aktualizacji;
każdy bieg to `syncDelta` po kolei dla wszystkich dziesięciu dostawców. Tor 2 biegnie o 04:30,
raz na dobę, rotacją per dzień tygodnia: pn MO1+MO2, wt MO3+MO4, śr MO5+MO6, czw MO9, pt MO10,
MO7 tylko w pierwszą sobotę miesiąca, MO8 tylko w pierwszą niedzielę. „Pierwsza" to predykat
`date.getDate() <= 7`. Cache kodów Selly budowany raz na partię (`buildCache: i === 0`).

Dwa rozjazdy wobec opisów Ani, rozstrzygnięte na korzyść kodu: opis mówi „w nocy między 3–4 rano"
(kod: 04:30) i podaje dla środy samo „MO5" (kod: MO5 + MO6).

**Klucz przeciw podwójnemu biegowi.** `lastRunKey` trzyma `"YYYY-MM-DD HH:MM"`, `lastFullKey`
samo `"YYYY-MM-DD"`. Data w obu pochodzi z `now.toISOString()`, czyli z UTC, podczas gdy godzina
i minuta czytane są LOKALNIE (`getHours`/`getMinutes`). Ta niespójność jest w oryginale
i została odtworzona — klucz służy wyłącznie odróżnianiu kolejnych przebiegów.

**`GET /api/selly/sync-status`** oddaje `{ ok, limiter, todayRotation, activeSuppliers, recentLogs }`,
gdzie `recentLogs` to ostatnie 20 wpisów `selly_sync_log` posortowanych malejąco po `rozpoczeto`.
⚠ Klucze wpisów są `snake_case` (nazwy KOLUMN), bo oryginał wypisuje jawną listę kolumn i czyta
je przez better-sqlite3. Trasa bierze **9 kolumn** — BEZ `uzytkownik_id` i `uzytkownik_imie`,
inaczej niż `GET /api/selly/log`, które robi `SELECT *`.

**Statusy w `selly_sync_log`.** W obiegu są cztery wartości: `w_trakcie` (wpisywany przez
`logSyncStart`), `zakonczono` (domyślny w `logSyncEnd`), `blad` (ścieżka błędu w `routes.cjs`)
oraz `ok`. Schemat w komentarzu wymienia tylko trzy pierwsze.

### Trzy zastane defekty produkcji

`routes_sync.cjs` destrukturyzuje dwa eksporty, których nie ma: `syncDeltaForDostawca`
(`sync_delta.cjs` eksportuje `syncDelta`) i `runFullTodays` (`scheduler_selly.cjs` eksportuje
`runFullBatch`). W CommonJS destrukturyzacja brakującego eksportu daje `undefined`, a nie błąd
ładowania — moduł wstaje normalnie, a `TypeError` leci dopiero w handlerze i wpada w jego
`try/catch`. Skutek: `POST /api/selly/sync-delta-supplier`, `sync-full-today` i `sync-full-force`
oddają na produkcji **HTTP 500** `{ ok: false, error: "… is not a function" }`, nie dotykając
przy tym Selly. `sync-status`, `sync-delta-all` i `sync-full-supplier` działają.

Trzeci defekt, niezależny od tamtych dwóch: `sync-full-force` przekazuje
`{ forceSuppliers: dostawcy }`, a `runFullBatch` czyta `opts.suppliers`. Nawet po naprawieniu
nazwy importu trasa zignorowałaby podaną listę i puściła rotację na dziś — czyli zapis do sklepu
dla innych dostawców niż wskazane, albo pusty przebieg.

### Odstępstwa w odbudowie (decyzje użytkownika 2026-09-23)

Wszystkie trzy defekty są w `rebuild/` naprawione, a ponadto: harmonogram stoi za flagą
`SELLY_SCHEDULER` (domyślnie wyłączoną), nie startuje przy `SELLY_TRYB=wylaczony` i przy starcie
domyka osierocone wpisy `w_trakcie` jako `blad` z powodem w `szczegoly_json`. Pełna lista
z uzasadnieniami: `docs/karty/I15.8/karta.md`, sekcja „Odstępstwa świadome".

### Czego nie ma

**Przycisków synchronizacji nie ma w panelu produkcyjnym** — żaden z ośmiu żywych skryptów
frontu nie woła `sync-*`. Trasy są wyłącznie do użytku ręcznego (curl) i dla harmonogramu.
