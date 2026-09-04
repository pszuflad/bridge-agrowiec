# 29-FEATURE-atrybuty-backend — Code review

> Reviewed: 2026-09-04
> Branch: `feature/29-atrybuty-backend`
> Diff: 11 plików (+2779), 2 commity (`02cb31a`, `d2a071f`)

Weryfikacja przeprowadzona w worktree: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm test` — **czyste, 916 testów / 58 plików zielone** (Node v20.20.2). Porównanie handler po
handlerze z `mirror/backend/atrybuty_module.cjs` (308 linii) i `mirror/backend/pending_module.cjs`
(393 linie) — wynik: 18 operacji, komunikaty błędów co do znaku, kody, kolejność sprawdzeń
i sortowania zgodne z oryginałem. Poniżej to, co się nie zgadza albo jest niedomknięte.

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:1006` — roadmapa nie została zaktualizowana; ostatni punkt
      Definition of done z `plan.md` (Krok 13) jest niezrealizowany.
  - Reason: `Status: ⬜` przy Iteracji 7 mimo dowiezionego 7a; wyliczenie backendu (`:1008`)
    nadal pomija `DELETE /api/atrybuty/pending`, choć `plan.md` sam wskazał to jako błąd
    roadmapy do naprawienia w tym tickecie; w bloku 7b nie ma ani jednego ustalenia z 7a.
    To dokładnie te dwa obowiązki, przed których złamaniem ostrzega `CLAUDE.md` (§1 „roadmapa
    opisuje STAN" i §2 „ustalenie dotyczące PRZYSZŁEGO bloku wpisz DO TEGO BLOKU") — sesja 7b
    przeczyta blok 7b i nie dowie się o niczym: ani o rozjeździe dwóch map rodzaj→kolumna,
    ani o braku paginacji w `GET /api/atrybuty/pending` (498 pozycji × Levenshtein po całym
    słowniku), ani o tym, że `GET /api/atrybuty/rodzaje` nie zwraca `utworzony`.
  - Suggestion: oznaczyć 7a jako zrobione (data + ID ticketa), dopisać `DELETE /api/atrybuty/pending`
    do `:1008`, a follow-upy 3/5/6 z `raport.md` przenieść DO opisu bloku 7b (i/lub do
    `docs/rebuild-backlog.md`, jeśli mają żyć dłużej niż I7).

## SHOULD-FIX

- [ ] `rebuild/backend/src/app.ts:71` — niezabezpieczony `zasiejSlownikAtrybutow(db)` w `stworzApp`
      wywraca START PROCESU, gdy baza nie ma tabel atrybutów.
  - Sprawdzone empirycznie: na świeżej, niezmigrowanej bazie `stworzApp` rzuca
    `Failed to run the query 'INSERT OR IGNORE INTO atrybuty_rodzaje …'`, więc `server.ts` pada
    przed `listen()`. Wcześniej `stworzApp` w ogóle nie dotykało bazy i backend wstawał również
    na bazie ze starszym schematem (padały tylko konkretne trasy). Oryginał nie miał tego
    problemu, bo `registerAtrybuty` woła `ensureSchema()` PRZED `seed()` (`:98-99`) — a port
    `ensureSchema()` świadomie pominął (słusznie), nie dokładając nic w zamian.
  - Scenariusz: `npm run dev`/`pm2 restart` na `DB_PATH`, na którym nie puszczono jeszcze
    `npm run migrate` (deploy robi to w dobrej kolejności, ale ręczny restart i dev — już nie).
  - Suggestion: `try { zasiejSlownikAtrybutow(db); } catch (e) { console.error(...) }` — to samo
    podejście, co oryginał stosuje do SELECT-ów z `products` („products może nie istnieć",
    `atrybuty_module.cjs:78`). Seed nie jest krytyczny dla startu.

- [ ] `rebuild/backend/test/gate/asercje.ts:203` — zbiór dozwolonych rodzajów budowany z fixture'a
      da FAŁSZYWY alarm GATE, gdy dane testowe urosną.
  - `GET_atrybuty_liczniki.json` ma 5348 kluczy, ale tylko **13 prefiksów** — brakuje `sezon`
    i `wentyl`, bo w nagraniu produkcji te kolumny były puste. `RODZAJ_KOLUMNA` ma 15 pozycji,
    więc wystarczy, że ktoś doda do `test/gate/dane.ts` produkt z wypełnionym `sezon`, a asercja
    zapali `rodzaj "sezon" nie występuje w GET_atrybuty_liczniki.json` z komunikatem
    „To jest STOP — nie poprawiaj fixture'a, zgłoś rozjazd", mimo że kod jest poprawny.
  - Przy okazji ginie mocniejszy dowód w drugą stronę: dziś nikt nie sprawdza, czy każdy prefiks
    Z FIXTURE'A jest w `RODZAJ_KOLUMNA` (a to złapałoby wypadnięcie wpisu z mapy).
  - Suggestion: dozwolone rodzaje brać z `RODZAJ_KOLUMNA`, a fixture wykorzystać do asercji
    `prefiksy fixture'a ⊆ klucze mapy`.

- [ ] `rebuild/backend/test/gate/asercje.ts:163` — `sprawdzZgodnoscZFixtureSlownika` przechodzi
      na pustym obiekcie `{}` (brak kluczy = brak błędów, brak `ok` = OK).
  - Dziś ratuje to dopiero `atrybuty.gate.test.ts:230` (`mapa["marka::BKT"] === 2`), ale sama
    asercja jest gate'em pozornym i przy następnym użyciu (albo po refaktorze tamtego testu)
    przepuści trasę, która przestała cokolwiek liczyć — a `licznikiAtrybutow` połyka wyjątek
    per kolumna (`continue`), więc pusta mapa to realny tryb awarii, nie hipoteza.
  - Suggestion: dodać w asercji `expect(Object.keys(mapa).length).toBeGreaterThan(0)`.

- [ ] `rebuild/backend/src/repos/atrybuty-pending.ts:163-164` — brak testu dla `slice(0, 5)`
      i sortowania malejącego sugestii aliasów.
  - `plan.md` → „Strategia testów" wymienia to wprost („oraz `slice(0,5)` i sortowanie malejące"),
    ale jedyny test dotykający `sugerowane_aliasy` (`atrybuty.gate.test.ts:184`) sprawdza listę
    JEDNOELEMENTOWĄ. Zamiana `b.podobienstwo - a.podobienstwo` na rosnące albo `slice(0, 4)`
    przeszłaby całą suitę — a to pole widzi front 7b.
  - Suggestion: jeden test w `atrybuty.podobienstwo.test.ts` albo `pending.test.ts`: 7 wartości
    katalogowych w promieniu ≥ 0,9 od pozycji pending → oczekiwane 5 pozycji, malejąco.

- [ ] `rebuild/backend/src/routes/atrybuty.ts:56` — ścieżka 500 rozjeżdża się z oryginałem
      i z własną deklaracją planu.
  - Każdy handler oryginału ma `try/catch` zwracający `500 {ok:false, error:e.message}`. Port łapie
    tylko UNIQUE i przepuszcza resztę do globalnego `bladHandler`, który oddaje
    `{error:"Błąd serwera"}` — BEZ klucza `ok`. `plan.md` (Krok 3) sam pisze: „Błędy zwracamy
    lokalnie jako `{ok:false,error}` … inaczej złamalibyśmy kształt z oryginału" — dla 4xx tak jest,
    dla 5xx nie.
  - Realny scenariusz: `SQLITE_BUSY` przy równoległym zapisie (produkcja ma `busy_timeout`, ale
    nie jest nieskończony) albo błąd zapisu — UI produkcji (`pending-injection.js`) czyta
    `data.ok`/`data.error`.
  - Suggestion: wspólny wrapper `bezpiecznie(handler)` w tym module, oddający `500 {ok:false,error}`.

- [ ] `rebuild/backend/src/routes/atrybuty.ts:179` i `:213` — walidacja `wartosc` różni się od
      oryginału dla wartości falsy innych niż `""`.
  - Oryginał: `if (!rodzaj || !wartosc)` (`:201`) i `if (!wartosc)` (`:222`). Port sprawdza
    `== null || === ""`. Sprawdzone empirycznie: `POST /api/atrybuty/wartosci {rodzaj:"kategoria",
    wartosc: 0}` → **200** i wpis `"0"` w słowniku; `{wartosc: false}` → 200 i wpis `"false"`.
    Produkcja w obu przypadkach oddaje `400 {ok:false,error:"Brak rodzaj lub wartosc"}`.
  - To śmieć w słowniku, który potem wraca w `GET /api/atrybuty` i w sugestiach aliasów.
  - Suggestion: sprowadzić warunek do falsy jak w oryginale (`if (!rodzaj || !cialo.wartosc)`),
    ewentualnie z komentarzem, że `0`/`false` są odrzucane celowo — 1:1.

- [ ] `docs/tickets/29-FEATURE-atrybuty-backend/raport.md` — plik jest NIEŚLEDZONY przez gita
      (`git status` → `?? …/raport.md`), więc nie ma go w `origin/develop...HEAD`.
  - Po merge artefakt ticketa przepadnie razem z worktree; `plan.md` jest zacommitowany, raport nie.
  - Suggestion: dołożyć do commita razem z poprawką roadmapy.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/routes/atrybuty.ts:112` (i analogicznie `:137`, `:158`, `:197`, `:224`,
      `:245`) — `zapiszAudyt` bez `try/catch`, a oryginał połyka błąd audytu
      (`try { be(...) } catch (_) {}`, `atrybuty_module.cjs:142`). Przy awarii zapisu do
      `audit_log` udana operacja CRUD zwróci 500 zamiast `{ok:true}`.
- [ ] `rebuild/backend/src/repos/atrybuty.ts:178-179` — pola ciała spoza `string` (np.
      `PUT /api/atrybuty/rodzaje/marka {label: 123}`) są ignorowane, a oryginał zapisałby `"123"`;
      przy `POST` z `label: 123` oryginał w ogóle wywala się na `(123||'').trim()` → 500, port
      oddaje 400 „Brak label". To utwardzenie, nie regres, ale nie ma go na liście odstępstw
      w `plan.md`/`raport.md` — warto dopisać zdanie, żeby ktoś tego później nie „naprawił" wstecz.
- [ ] `rebuild/backend/src/repos/atrybuty.ts:70` / `atrybuty-pending.ts:45` — `Object.hasOwn`
      zamiast surowego indeksowania mapy: `GET /api/atrybuty/uzycie?rodzaj=constructor` daje
      400 „Nieznany rodzaj atrybutu: constructor" (sprawdzone), a oryginał trafiłby prototypem
      w `sql.raw` i oddał 500. Też utwardzenie warte jednego zdania w „Odstępstwach".
      Analogicznie `parametr()` w `routes/atrybuty.ts:66` dla `?rodzaj=a&rodzaj=b`.
- [ ] `rebuild/backend/test/atrybuty.gate.test.ts:58` — `beforeAll` (jedno środowisko na plik)
      przy testach, które mutują kolejkę (`scan-pending` × 2, `DELETE /pending`). Dziś działa
      i asercje są odporne na kolejność, ale to kruche — `beforeEach`, jak w dwóch pozostałych
      plikach, byłby spójniejszy.
- [ ] `rebuild/backend/test/atrybuty.crud.test.ts:317` — dowód na `ORDER BY nazwa` opiera się na
      DWÓCH produktach i porównaniu z `Array.prototype.sort()`; przy trzech różnych nazwach
      (i jednej zaczynającej się małą literą) test faktycznie odróżniałby `ORDER BY nazwa`
      od braku sortowania.

## Plan compliance

### Done ✓
- Krok 1 — `src/repos/atrybuty.ts`: `RODZAJ_KOLUMNA` (15), obie listy rodzajów (z `utworzony`
  i bez), `listaWartosci`, CRUD, `licznikiAtrybutow`, `uzycieAtrybutu` (`COUNT(*)` bez limitu +
  `LIMIT 200 ORDER BY nazwa`), `slugRodzaju`, `zasiejSlownikAtrybutow`. Komunikaty błędów
  odtworzone dosłownie (sprawdzone znak po znaku z `:128`, `:138`, `:146`, `:158`, `:174`,
  `:201`, `:204`, `:206`, `:212`, `:222`, `:230`, `:241`, `:293`, `:294`).
- Krok 2 — `src/repos/atrybuty-pending.ts`: `levenshtein`/`podobienstwo`/`czySugerowacAlias`
  1:1 (włącznie z regułą „różnica tylko `+`" i brakiem normalizacji wielkości liter),
  `RODZAJE_KOLUMNY` (13), `skanujNoweWartosci` (filtr MO6, pominięcie katalogu i odrzuconych,
  UPDATE zamiast INSERT dla istniejących, `pierwszy_import` nietknięty, brak czyszczenia kolejki),
  pięć operacji rozstrzygających w transakcjach.
- **Obie mapy rodzaj→kolumna zgadzają się z oryginałem CO DO WPISU I KOLEJNOŚCI** — sprawdzone
  programowo (`atrybuty_module.cjs:251-267` = 15/15, `pending_module.cjs:22-36` = 13/13,
  identyczna kolejność kluczy, więc także kolejność kluczy w JSON-ie `liczniki`).
- **Kolejność sprawdzeń w trasach pending zachowana**: `akceptuj-z-edycja` waliduje `nowa_wartosc`
  PRZED pobraniem pozycji (`routes/atrybuty.ts:328-332` = `:277-281`), `akceptuj-jako-alias`
  sprawdza kanoniczną w katalogu PRZED mapą kolumn (`:373-378` = `:321-327`).
- **Transakcje działają realnie** — sprawdzone empirycznie: `db.transaction((tx) => …)` z drizzle
  na better-sqlite3 wycofuje wszystkie kroki przy wyjątku w środku i poprawnie zwraca wartość
  z callbacku (`produktow_zaktualizowano` ma pokrycie w teście).
- **Brak drogi wstrzyknięcia SQL** — prześledzone: `sql.raw` dostaje nazwę kolumny wyłącznie
  ze stałych `RODZAJ_KOLUMNA`/`RODZAJE_KOLUMNY`; jedyne wejścia użytkownika (`req.query.rodzaj`,
  `pozycja.rodzaj` z bazy) przechodzą przez `znanyRodzaj`/`kolumnaRodzaju` z `Object.hasOwn`,
  a wszystkie wartości idą przez parametry.
- Krok 3 — router z `requireAuth` na 18 operacjach, błędy 4xx lokalnie jako `{ok:false,error}`,
  audyt tylko dla 6 tras CRUD (D4), trasy statyczne nie kolidują ze wzorcami (pokryte testem).
- Krok 4 — hook skanu w `staging-mutacje.ts:200`: poza transakcją akceptacji, w `try/catch`,
  odpowiedź `{ok:true, accepted}` niezmieniona (potwierdzone testem `pending.test.ts:403`).
- Krok 5 — asercja `sprawdzZgodnoscZFixtureSlownika` (uwagi wyżej).
- Krok 6 — testy: 13 GATE + 26 CRUD + 21 pending + 9 unit; suita 916/916 zielona.
- D1–D6 zrealizowane zgodnie z opisem; jedyne zadeklarowane odstępstwo (D2 — moment wywołania
  skanu) jest opisane w kodzie w miejscu wywołania.
- Nic spoza zakresu nie weszło: brak zmian we froncie, brak dotknięcia `/api/attributes`,
  brak ożywiania martwego `GET /api/atrybuty` w `/staging`, brak nowej migracji.

### Missing or deviating ✗
- **Krok 13 (roadmapa) — niezrobiony.** Patrz BLOCKER.
- Krok 1 zapowiadał osobną whitelistę `KOLUMNY_PRODUKTOW`; w kodzie jej nie ma — rolę pełni
  `znanyRodzaj()` nad `RODZAJ_KOLUMNA`. Równoważne i bezpieczne, tylko do odnotowania.
- „Strategia testów" zapowiadała test `slice(0,5)` i sortowania malejącego aliasów — brak
  (SHOULD-FIX wyżej).
- Drobne rozjazdy walidacji ciała wobec oryginału (`wartosc: 0`/`false`, pola nie-`string`)
  nie są nigdzie zapisane jako decyzja — patrz SHOULD-FIX i NICE-TO-HAVE.

### Definition of done
- [x] 18 operacji na 13 ścieżkach za `requireAuth`, kształty 1:1 — z zastrzeżeniem rozjazdów
      walidacji falsy (SHOULD-FIX) i kształtu odpowiedzi 500 (SHOULD-FIX)
- [x] Workflow pending kompletny: scan / akceptuj / jako-alias / z-edycją / odrzuć / wyczyść
- [x] Tabele `atrybuty_wartosci_pending` i `_odrzucone` używane zgodnie z oryginałem
- [x] Seed słownika przy starcie (D1) + hook skanu po akceptacji stagingu (D2)
- [x] GATE: 6 fixtures zgodnych, wszystkie odpowiedzi walidują się względem `contract/openapi.yaml`
- [x] Testy workflow pending i CRUD na bazie testowej — zielone
- [x] `npm run lint`, `typecheck`, `build`, `test` czyste (zweryfikowane w worktree)
- [ ] Roadmapa §5 I7: blok 7a oznaczony jako zrobiony, `DELETE /api/atrybuty/pending` dopisane,
      ustalenia dla 7b wpisane DO bloku 7b — **NIEZROBIONE** (`docs/rebuild-roadmap.md:1006,1008`)

## Parallel-test concerns

Brak — wszystkie cztery nowe pliki testów idą przez `stworzSrodowiskoTestowe()`: świeży SQLite
w `mkdtemp` katalogu tymczasowym, aplikacja bez `listen()` (supertest), zero portów, zero
stałych ścieżek, sprzątanie w `afterEach`/`afterAll`. Seed z `stworzApp` pisze wyłącznie do bazy
tymczasowej danego testu. Bezpieczne przy równoległej pracy w kilku oknach.

## Overall assessment

Bardzo dobra robota odtworzeniowa: obie mapy rodzaj→kolumna zgadzają się z oryginałem co do wpisu
i kolejności, komunikaty błędów są dosłowne, kolejność sprawdzeń w trasach pending (najbardziej
podchwytliwe miejsce tego zakresu) zachowana, transakcje realnie wycofują wszystkie kroki, a
komentarze uczciwie oddzielają quirk produkcji od decyzji portu. Kierunek jest w porządku i kod
nadaje się do merge po drobnych poprawkach. Główne zastrzeżenia są dwa: dokumentacyjne — roadmapa
nie została zaktualizowana, więc sesja 7b dostanie nieaktualny stan i nie zobaczy ustaleń z 7a
(to blokuje merge, bo roadmapa jest wejściem następnej sesji), oraz operacyjne — niezabezpieczony
seed w `stworzApp` zamienia brak tabel atrybutów w awarię startu całego backendu, czego oryginał
nie robił. Reszta to drobne rozjazdy wierności na krawędziach walidacji i dwie luki w sile GATE
(asercja słownika przechodzi na pustej mapie i fałszywie zapali się przy `sezon`/`wentyl`).

## Iteracja 2 — weryfikacja poprawek

> Zweryfikowane 2026-09-04 przez Mastera (reviewer-subagent padł na limicie sesji w trakcie
> drugiego przebiegu). Weryfikacja jest **empiryczna** — sprawdzenia uruchomione, nie wywnioskowane
> z lektury kodu. Testy weryfikacyjne były tymczasowe i zostały usunięte po przebiegu; trwały
> dowód dla każdego punktu leży w suicie ticketa.

| # | Zarzut z iteracji 1 | Status | Dowód |
|---|---|---|---|
| 1 | BLOCKER: roadmapa nietknięta | **NAPRAWIONE** | §5 I7: `🔨 iteracja w połowie`, 7a ✅ z datą i ID ticketa, 7b ⬜; `DELETE /api/atrybuty/pending` w wyliczeniu; „13 ścieżek / 18 operacji" doprecyzowane; **sześć ustaleń wpisanych do bloku 7b**, nie do zamkniętego 7a. §3 wiersz „Martwe ścieżki FE" → „naprawić w 7b" (`:135`), §4 wiersz 7 → `🔨` z ticketem (`:157`, przy okazji poprawiona etykieta sesji `1a BE` → `7a BE`) |
| 2 | Seed wywraca start na bazie bez tabel | **NAPRAWIONE** | `stworzApp` na świeżej, niezmigrowanej bazie nie rzuca (uruchomione); błąd ląduje w logu jako „[atrybuty] seed pominięty" |
| 3 | `wartosc: 0` / `false` przechodzi | **NAPRAWIONE** | `{wartosc:0}` i `{wartosc:false}` → `400 {ok:false,error:"Brak rodzaj lub wartosc"}`; `PUT {wartosc:0}` → „Brak wartosc". **Sprawdzona też regresja w drugą stronę:** napis `"0"` nadal przechodzi (200), bo oryginał go przepuszcza |
| 4 | 500 bez klucza `ok` | **NAPRAWIONE** | Po `DROP TABLE atrybuty_rodzaje` trasa `GET /api/atrybuty` oddaje `500 {ok:false,error:"Błąd serwera"}`. Handler jest ZAKRESOWY: po `DROP TABLE promotions` `GET /api/promotions` nadal idzie globalnym `bladHandler` i oddaje `{error:…}` bez `ok` — czyli nic spoza tego routera nie zostało przechwycone |
| 5 | Audyt bez `try/catch` | **NAPRAWIONE** | Po `DROP TABLE audit_log` `POST /api/atrybuty/rodzaje` nadal zwraca `200 {ok:true}` |
| 6 | Asercja słownika przechodzi na `{}` | **NAPRAWIONE** | Oblewa dla `{}`, dla obcego rodzaju (`widmo::X`) i dla nadmiarowego klucza `ok`. **Nie zapala się** dla `sezon::Zimowe` — czyli fałszywy alarm z iteracji 1 jest usunięty, bo zbiór rodzajów bierze się z mapy kodu, a nie z 13 prefiksów nagrania |
| 7 | Brak testu `slice(0,5)` i sortowania | **NAPRAWIONE i ZWERYFIKOWANE MUTACJĄ** | `MAKS_SUGESTII` 5→4 → test czerwony; sortowanie odwrócone na rosnące → test czerwony; źródło przywrócone (`git status` czysty) |
| 8 | Słaby dowód `ORDER BY nazwa` | **NAPRAWIONE i ZWERYFIKOWANE MUTACJĄ** | Podmiana `ORDER BY nazwa` na `ORDER BY kod DESC` → test czerwony; źródło przywrócone |
| 9 | `raport.md` nieśledzony | **NAPRAWIONE** | W commicie `fd8523e`, aktualizowany w `46ad759` |
| 10 | Utwardzenia nieodnotowane | **NAPRAWIONE** | `raport.md` → „Review fixes applied", sekcja „Świadomie NIE zmienione": pola nie-`string`, `Object.hasOwn`, `parametr()` dla tablicy, `beforeAll` w teście GATE |

### Korekta merytoryczna wprowadzona po iteracji 1

Teza powtórzona w `plan.md` (D6) i w komentarzach obu repozytoriów — jakoby mapa kolejki miała
`wentyl`, którego nie ma mapa liczników — **jest fałszywa**. Sprawdzone programowo na
`atrybuty_module.cjs:251-267` (15 pozycji) i `pending_module.cjs:22-36` (13 pozycji):

```
tylko w liczniki: [ 'model', 'zastosowanie' ]
tylko w pending:  []
wentyl w obu:     true
```

Mapa 13-pozycyjna jest **dokładnym podzbiorem** 15-pozycyjnej. Wniosek dla zachowania nie zmienia
się (pozycja pending rodzaju `model`/`zastosowanie` dostałaby 400), ale opis był mylący —
poprawiony w `repos/atrybuty.ts`, `repos/atrybuty-pending.ts` i `plan.md`.

### Nowe problemy

**Brak.** Bramki po poprawkach i po merge `origin/develop` (dwa nowe pliki docs, bez konfliktów):
`lint`, `typecheck`, `build` czyste, suita **917 testów / 58 plików** zielona.
