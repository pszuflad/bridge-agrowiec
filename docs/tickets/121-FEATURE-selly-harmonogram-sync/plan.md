# 121-FEATURE-selly-harmonogram-sync — harmonogram Selly (Tor 1 i Tor 2) + 6 tras `sync-*`

> Status: Draft
> Branch: `feature/121-selly-harmonogram-sync`
> Worktree: `.worktrees/121-FEATURE-selly-harmonogram-sync`
> Karta: `docs/karty/I15.8/` · Iteracja 15, fala 3

## Opis ticketa
I15.8 — Selly REST 3: harmonogram (Tor 1 i Tor 2) + 6 tras `sync-*`. Port 1:1 z `origin/main`
(`selly/scheduler_selly.cjs`, `selly/routes_sync.cjs`), harmonogram za flagą środowiskową domyślnie
wyłączoną, jedna instancja `discovery` na proces wspólna dla obu torów.

## Kontekst

**Źródło prawdy:** `origin/main` na `88fa31c`. Zweryfikowane: `scheduler_selly.cjs` (155 linii) i
`routes_sync.cjs` (107 linii) są **bajt w bajt identyczne** na `abe5f14` i `88fa31c`, więc rozjazd
„źródło prawdy `abe5f14` vs `88fa31c`" (`wejscie-110.md` vs prompt) nie dotyczy tej karty. Zapis
w `karta.md` mówiący o `7d6cfc9` jest formalnie przeterminowany — do poprawienia przy zamykaniu karty.

**Graf wywołań w oryginale (sprawdzony, reguła 3 z CLAUDE.md):** montaż jest w
`mirror/backend/extensions.cjs:483-491` — `registerSyncRoutes(app, {db, requireAuth})` plus
`installScheduler(_bridgeDb)`. Dwa fakty z tego wynikające:
- harmonogram na produkcji **nie stoi za żadną flagą** — instaluje się zawsze, a `installScheduler`
  dostaje wyłącznie `db` (brak `opts` ⇒ `dryRun=false`, `maxProducts=5000`, `autoCreate=true`);
- cały blok jest w `try/catch`, więc błąd ładowania tylko loguje.

**Dlaczego trzy trasy są na produkcji martwe.** `routes_sync.cjs` destrukturyzuje eksporty, których
nie ma: `syncDeltaForDostawca` (jest `syncDelta`) i `runFullTodays` (jest `runFullBatch`). W CJS
destrukturyzacja brakującego eksportu daje `undefined`, a nie wyjątek — moduł ładuje się poprawnie,
a `TypeError` leci dopiero w handlerze i wpada we własny `try/catch` trasy. Efekt: `sync-delta-supplier`,
`sync-full-today` i `sync-full-force` oddają **HTTP 500** `{ok:false, error:"... is not a function"}`,
nie dotykając Selly. `sync-status`, `sync-delta-all` i `sync-full-supplier` działają.

**Stan rebuildu.** I15.6 dała `rest/{limiter,discovery,sync-delta}.ts`, I15.7 — `rest/{mapper-v2,sync-full}.ts`.
Sygnatury różnią się od oryginału o wstrzykiwane `discovery`:
`syncDelta(db, discovery, dostawca, opts)`, `syncFullForDostawca(db, discovery, dostawca, opts)`.
To wymusza przeniesienie tworzenia `discovery` do montażu — patrz „Decyzja 7".

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Stan wyjściowy: zerowe pokrycie.** `contract/openapi.yaml` nie ma żadnej z 6 ścieżek (jest 10 innych
`/api/selly/*`, linie 20066-20168), a `contract/fixtures/` nie ma ani jednego nagrania `sync-*`.
Ten ticket **dokłada** ścieżki do kontraktu; nie ma istniejącego fixture, z którym mógłby się rozjechać.

Ścieżki do dopisania (kształt odczytany z `routes_sync.cjs` na `88fa31c`):

| Ścieżka | Odpowiedź (oryginał) |
|---|---|
| `GET /api/selly/sync-status` | `{ok:true, limiter, todayRotation, activeSuppliers, recentLogs}` |
| `POST /api/selly/sync-delta-supplier` | body `{dostawca}`; 400 zły dostawca; **500 na produkcji** |
| `POST /api/selly/sync-delta-all` | `{ok:true, results}` |
| `POST /api/selly/sync-full-supplier` | body `{dostawca, autoCreate?}`; `{...WynikSyncFull}`; 400 |
| `POST /api/selly/sync-full-today` | `{ok:true, results}`; **500 na produkcji** |
| `POST /api/selly/sync-full-force` | body `{dostawcy[], autoCreate?}`; `{ok:true, results}`; 400; **500 na produkcji** |

⚠ **`recentLogs` MUSI mieć klucze `snake_case`** (`dostawca_kod`, `liczba_ok`, `liczba_blad`,
`liczba_skip`, `szczegoly_json`, `rozpoczeto`, `zakonczono`). Oryginał robi `SELECT` z jawną listą
kolumn przez better-sqlite3. Drizzle `select()` bez projekcji oddałby `dostawcaKod` itd. i rozjechał
kontrakt — dokładnie pułapka opisana w CLAUDE.md, która w `GET /api/selly/log` trafiła na siedmiu
kluczach naraz. **Reużywamy istniejącej projekcji `KOLUMNY_LOGU` z `src/repos/selly.ts:86-101`** (DRY),
zamiast pisać drugą.
Uwaga: `sync-status` wybiera 9 z 12 kolumn (bez `uzytkownik_id`, `uzytkownik_imie`) — projekcja musi
być zawężeniem `KOLUMNY_LOGU`, nie jej kopią.

**Nagrania z oryginału — co się da, a czego nie.** Bezpiecznie nagrywalne są tylko te przebiegi, które
nie dotykają cudzego sklepu: `GET /api/selly/sync-status`, wszystkie ścieżki walidacji `400` oraz trzy
odpowiedzi `500` (wybuchają przed jakimkolwiek wywołaniem Selly). `sync-delta-all` i
`sync-full-supplier` realnie **zapisują do sklepu agroopony.selly24.pl** — tych nie odpalamy.
Ich kształt wynika wprost z kodu (`{ok:true, results}` / `WynikSyncFull`) i zamrażamy go testem
przeciwko atrapie, nie nagraniem. To jest **świadome ograniczenie GATE-u**, opisane w raporcie.

## Decyzje

Zatwierdzone wcześniej (`docs/karty/I15.8/wejscie-117.md`, ticket 117, 2026-09-23):
1. **Osierocone wpisy `selly_sync_log` ze statusem `w_trakcie` zamykamy przy starcie harmonogramu.**
   Świadome odstępstwo — produkcja zostawia je wiszące (u Ani wpis MO2 wisi od 10.09). Czysta
   diagnostyka, nic nie zmienia w sklepie.
2. **`sync-delta-supplier` używa `syncDelta`** zamiast nieistniejącego `syncDeltaForDostawca`.
   Świadome odstępstwo — naprawa literówki. Zachowanie poza nazwą importu jest identyczne: oryginał
   wołał `syncDeltaForDostawca(db, dostawca)` bez `opts`, więc wołamy `syncDelta` z domyślnym `opts`.

Podjęte przez użytkownika 2026-09-23 w tym ticketcie:
3. **`sync-full-today` i `sync-full-force` naprawiamy na `runFullBatch`** (zamiast `runFullTodays`).
   Ta sama klasa błędu co pkt 2 — spójna decyzja. Świadome odstępstwo: rebuild robi tu więcej niż
   produkcja, więc te dwie trasy nie mają odpowiednika 1:1 w nagraniu (oryginał oddaje 500).
4. **`sync-full-force` honoruje listę `dostawcy`** — mapujemy ją na `opts.suppliers`.
   Drugi, niezależny błąd: oryginał przekazuje `{forceSuppliers}`, a `runFullBatch` czyta
   `opts.suppliers`, więc „force MO1,MO2" puściłoby dzisiejszą rotację — zapis do sklepu dla INNYCH
   dostawców niż wskazane. Świadome odstępstwo; bez niego trasa jest myląca i ryzykowna.
5. **Harmonogram nie startuje przy `SELLY_TRYB=wylaczony`** — log i brak instalacji ticka.
   Świadome odstępstwo obronne: przy `wylaczony` discovery myli blokadę odczytu z „produkt nie
   istnieje" i zaczyna zakładać duplikaty w sklepie (`wejscie-108.md`). Przy poprawnym trybie zawór
   nie zmienia niczego. `tylko-odczyt` **nie** blokuje startu (wariant węższy z trzech).
6. **Osierocone wpisy oznaczamy statusem `blad`** + powód w `szczegoly_json`
   (`{"powod":"przerwany restartem procesu"}`), `zakonczono=datetime('now')`. Nie wprowadza nowej
   wartości do kolumny (schemat zna `w_trakcie|zakonczono|blad`, oryginał pisze też `ok`), więc nic,
   co mapuje statusy, nie zobaczy nieznanej wartości.

Decyzje projektowe (moje, w granicach portu):
7. **Jedna instancja `discovery` powstaje w `server.ts`** i jest wstrzykiwana do `stworzApp` oraz do
   harmonogramu — dokładnie precedens `synchronizuj` z `server.ts:12-14` („JEDNA instancja na proces").
   `app.ts` zachowuje budowanie zapasowe, gdy `discoverySelly` nie podano (testy). Klienta Selly buduje
   wspólny helper, żeby `server.ts` i `app.ts` nie miały dwóch kopii `stworzKlientaSelly` +
   `opakujKlientaTrybem`.
8. **Flaga `SELLY_SCHEDULER`**, domyślnie wyłączona, przez istniejące `flagaBoolDomyslnieWylaczona`
   (`config/env.ts:25-52`) — wzorzec `IMPORT_SCHEDULER` 1:1. `uruchom()`/`zatrzymaj()` woła `server.ts`
   po `listen()` i w `zamknij()`, timery poza zasięgiem testów budujących przez `stworzApp`.
9. **Zegar wstrzykiwany** (`teraz?: () => Date`, `interwalMs?`) wzorem `ZegarLimitera` z `limiter.ts:45`.
   Bez tego nie da się przetestować 04:30 ani HH:55 inaczej niż czekaniem; `test/scheduler.test.ts`
   celowo nie używa fake timers i ten wzorzec pozwala tę zasadę utrzymać.

## Plan implementacji

1. **`src/config/env.ts`** — dodać `SELLY_SCHEDULER: flagaBoolDomyslnieWylaczona` z notą, czemu
   domyślnie wyłączona (produkcja włącza jawnie; cutover).
2. **`src/selly/rest/scheduler.ts`** (nowy) — port `scheduler_selly.cjs`:
   - stałe `ACTIVE_SUPPLIERS` (MO1…MO10), `FULL_ROTATION` (pn MO1+MO2, wt MO3+MO4, śr MO5+MO6,
     czw MO9, pt MO10, so MO7, nd MO8), `TOR2_HOUR=4`, `TOR2_MINUTE=30`;
   - `isFirstOfMonthDay(date, dow)` → `date.getDate() <= 7`; `suppliersForFullToday(date)` — MO7 tylko
     pierwsza sobota, MO8 tylko pierwsza niedziela;
   - `runDeltaAll(db, discovery, opts)` — pętla `syncDelta`, `results.push({dostawca, ...r.stats})`,
     log tylko gdy `stats.total > 0`; błąd dostawcy łapany per iteracja (`{ok:false, dostawca, error}`),
     pętla leci dalej;
   - `runFullBatch(db, discovery, opts)` — `opts.suppliers ?? suppliersForFullToday(new Date())`,
     pusta lista ⇒ log i `[]`; `buildCache: i === 0` (cache kodów Selly raz na batch, nie per dostawca);
     `autoCreate: opts.autoCreate !== false`; wynik `{dostawca, ...stats, duration_ms}`;
   - `stworzHarmonogramSelly({db, discovery, tryb, teraz?, interwalMs?})` → `{uruchom, zatrzymaj, czyDziala}`:
     tick co 60 s; Tor 1 gdy `mm ∈ {55,10,25,40}` i `lastRunKey !== key`; Tor 2 gdy `hh===4 && mm===30`
     i `lastFullKey !== dateKey`; oba przez `.catch()` (nie blokują ticka);
     `uruchom()` przy `tryb==="wylaczony"` loguje i **nie** stawia timera (decyzja 5);
     przed postawieniem timera — zamknięcie osieroconych wpisów (decyzja 6).
   - Nagłówek pliku wypisuje wszystkie odstępstwa (2-6).
3. **`src/repos/selly.ts`** — dodać `zamknijOsieroconeWpisySync(db)` (UPDATE `status='blad'`,
   `zakonczono`, `szczegoly_json` WHERE `status='w_trakcie'`, zwraca liczbę) i `ostatnieWpisySync(db)`
   (20 wpisów, projekcja 9 kolumn `snake_case` zawężona z `KOLUMNY_LOGU`).
4. **`src/routes/selly-sync.ts`** (nowy) — 6 tras, port `routes_sync.cjs` z naprawami 2-4;
   walidacja `dostawca ∈ ACTIVE_SUPPLIERS` → 400 z komunikatem 1:1; `autoCreate` domyślnie `true`
   w `sync-full-supplier`, a `=== true` (czyli domyślnie **false**) w `sync-full-force`.
5. **Montaż** — `src/selly/fabryka.ts` (helper klienta), `app.ts` (opcjonalne `discoverySelly`,
   rejestracja `trasySelly­Sync`), `server.ts` (jedna `discovery`, harmonogram pod flagą, `zatrzymaj()`
   w `zamknij()`).
6. **`contract/openapi.yaml`** — 6 ścieżek wzorem sąsiednich `/api/selly/*`.
7. **Testy** (niżej), potem bramki.

## Strategia testów

Atrapa Selly (`test/gate/selly-atrapa.ts`) i helpery `test/gate/selly-rest.ts`
(`stworzDiscoveryTestowe`, `stworzLimiterLiczacy`, `zasiejMapowanie`) — **żaden test nie woła prawdziwego
Selly**. Baza w katalogu tymczasowym, porty efemeryczne (tak jak reszta suity).

- **Rotacja Toru 2** — `suppliersForFullToday` dla wszystkich 7 dni tygodnia + pierwsza/druga sobota
  i niedziela miesiąca (MO7/MO8 pojawiają się wyłącznie w pierwszym tygodniu). To czysta funkcja dat,
  najgęstszy zwrot z testu.
- **Tick harmonogramu** — wstrzyknięty zegar: minuty 55/10/25/40 odpalają Tor 1, minuta 11 nie;
  ten sam klucz minuty nie odpala dwa razy; 04:30 odpala Tor 2 raz na dobę.
- **Zawór `SELLY_TRYB=wylaczony`** — `uruchom()` nie stawia timera i nie woła discovery (decyzja 5).
- **Osierocone wpisy** — wpis `w_trakcie` zastany w bazie dostaje `blad` + `zakonczono` + powód,
  wpisy `zakonczono` zostają nietknięte (decyzja 6).
- **`buildCache: i === 0`** — batch dwóch dostawców buduje cache dokładnie raz (asercja na atrapie).
- **6 tras** przez `supertest` na `stworzApp` z wstrzykniętą atrapą: kształt `sync-status`
  (w tym **klucze `snake_case`** w `recentLogs` i 20 wpisów max), 400 dla złego/brakującego dostawcy,
  `sync-full-force` faktycznie honoruje podaną listę (decyzja 4) i domyślnie ma `autoCreate=false`.
- **Walidacja względem `openapi.yaml`** dla dopisanych ścieżek.

Nie testujemy realnego zapisu do sklepu (z definicji) ani `sync-delta-all`/`sync-full-supplier`
przeciwko produkcji — patrz ograniczenie GATE-u wyżej.

## Poza zakresem
- `src/selly/rest/sync-delta.ts` i `sync-full.ts` — zmiany pod dostępność należą do I15.10.
- `generator-csv.ts` (I15.3), staging i auto-wstrzymania (I15.4).
- **UI** — przycisków synchronizacji nie ma na produkcji, nie dorabiamy.
- `docs/rebuild-roadmap.md` i `docs/cutover.md` — zmienia je koordynator; wkład idzie do
  „Do koordynatora" w `docs/karty/I15.8/karta.md`.
- Montaż modułu dostępności (`availability_sync`) — I15.10; ustalenie trafi do `docs/karty/I15.10/wejscie-121.md`.

## Definition of done
- [ ] `suppliersForFullToday` odtwarza rotację z kodu, z MO7/MO8 tylko w pierwszym tygodniu miesiąca
- [ ] Tick 60 s odpala Tor 1 o HH:55/10/25/40 i Tor 2 o 04:30, każdorazowo raz
- [ ] `buildCache` budowany raz na batch
- [ ] 6 tras odpowiada kształtem z `routes_sync.cjs`, z naprawami 2-4; `recentLogs` w `snake_case`
- [ ] Harmonogram za `SELLY_SCHEDULER`, domyślnie wyłączony; nie startuje przy `SELLY_TRYB=wylaczony`
- [ ] Osierocone `w_trakcie` zamykane przy starcie jako `blad` z powodem
- [ ] JEDNA instancja `discovery` dzielona przez oba tory i trasy
- [ ] 6 ścieżek w `contract/openapi.yaml`
- [ ] `lint`, `typecheck`, `build`, `test` zielone w `rebuild/backend/`
- [ ] Karta `docs/karty/I15.8/karta.md` zamknięta; wejścia dla I15.9/I15.10; wkład cutover do koordynatora
