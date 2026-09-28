# 139-FEATURE — montaż modułu dostępności w `server.ts` (karta I15.10b)

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `feature/139-montaz-dostepnosci`
> Worktree: `.worktrees/139-FEATURE-montaz-dostepnosci`
> Karta: `docs/karty/I15.10b/karta.md` · Plan poprzedni (sam plan, bez implementacji): `docs/tickets/136-FEATURE-montaz-dostepnosci/plan.md`

## Opis ticketu

Karta I15.10 (ticket 119, PR #144) dowiozła moduł `rebuild/backend/src/selly/dostepnosc.ts`
i świadomie nie ruszyła `server.ts`, oddając montaż „do uzgodnienia z I15.8". Odpowiedź
(„montaż robi I15.10", `docs/karty/I15.10/wejscie-121.md`) przyszła po zamknięciu tamtego
ticketu — czynność została bez gospodarza. Ten ticket ją wykonuje: buduje instancję
`stworzSynchronizacjeDostepnosci({db, discovery: discoverySelly, sciezkiCsv})`, rejestruje ją
przez `ustawDomyslnaSynchronizacjeDostepnosci(...)` i wyrejestrowuje w `zamknij()`.

**Dlaczego numer 139, a nie 136.** Ticket 136 istnieje i jest zmergowany (PR #149), ale dowiózł
WYŁĄCZNIE dokumenty: `docs/karty/I15.10b/karta.md`, `docs/karty/I15.4b/wejscie-136.md` i swój
`plan.md`. Implementacji nie ma. Numer dla tej pracy bierzemy Krokiem 4 procedury; plan 136
zostaje jako artefakt planistyczny, ten plik go zastępuje.

## Kontekst

- **Moduł jest gotowy i nietykalny** (`src/selly/dostepnosc.ts`, własność I15.10). Ma fabrykę
  `stworzSynchronizacjeDostepnosci`, rejestr `ustawDomyslnaSynchronizacjeDostepnosci(instancja|null)`
  i globalne `zadajOdswiezenie(dostawca)`, które bez zamontowanej instancji **nie robi nic**
  (`dostepnosc.ts:127-130`).
- **Wołanie jest już na `develop`** (I15.4b, ticket 130): `src/import/tk.ts:28,74` wstrzykuje
  `odswiezDostepnosc: zadajOdswiezenie`, a wywołanie jest w JEDNYM miejscu —
  `src/import/polityka/fabryka.ts:988`, na końcu `importer()`, poza pętlą (to jest to miejsce,
  którego dotyczy ostrzeżenie o OOM z `docs/karty/I15.4b/wejscie-119.md`). **Nie duplikujemy go.**
- **Oryginał nie ma montażu w ogóle.** `availability_sync.cjs` jest `require`-owany leniwie
  w miejscu użycia (`mirror/backend/staging_policy.cjs:131-134` i `:614`, `:331`), a jego
  singletonem jest cache `require`. Nie ma śladu w `extensions.cjs`/`index.cjs` — w odróżnieniu
  od `installScheduler` (`extensions.cjs:486-487`). Nasz rejestr to **konstrukcja odbudowy**,
  wymuszona tym, że cała suita Vitest chodzi w jednym procesie; nie ma go z czym porównać 1:1.
- **Bramka oryginału jest za to bardzo konkretna** i to ją odtwarzamy:
  ```js
  // staging_policy.cjs:131-134
  function refreshAvailability(supplier){
    if(require('path').resolve(db.name)!=='/home/admin/private_apps/bridge/data.db')return;
    require('./availability_sync.cjs').request(db,supplier);
  }
  ```
  Produkcja odświeża dostępność **tylko na produkcyjnej bazie**; każda kopia milczy.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Brak (ticket nie dotyka kontraktu).** Nie dodaje ani nie zmienia żadnej trasy HTTP, nie zmienia
kształtu żadnej odpowiedzi, nie rusza schematu bazy ani migracji. Zmiana jest wyłącznie wewnętrznym
wpięciem modułu w cykl życia procesu (`server.ts`) — plik, którego nie dotyka żaden test kontraktowy,
bo cała suita buduje aplikację przez `stworzApp`. **GATE fixtures nie obowiązuje**; obowiązują
bramki lint/typecheck/build/test.

## Decisions

Wszystkie trzy rozstrzygnięte przez użytkownika 2026-09-23 (runda pytań przed planem).

- **D1 — bramka: montujemy tylko poza `SELLY_TRYB=wylaczony`.**
  Powód: montaż otwiera generatorowi CSV drogę **automatyczną, z każdego importu**, a
  `SELLY_CSV_DIR` domyślnie wskazuje katalog produkcyjny
  (`config/env.ts:138-141` → `/home/admin/domains/agritires.eu/public_html/panel/ex-port-files`;
  domyślka jest świadoma — pusty `.env` ma zachowywać się jak oryginał). Do dziś ta ścieżka była
  osiągalna wyłącznie ręcznym `POST /api/selly/generate-csv` za `requireAuth`, a staging dzieli
  VPS z produkcją. `SELLY_TRYB` jest najbliższym dostępnym odpowiednikiem oryginalnej bramki
  „to nie produkcyjna baza": domyślnie `wylaczony` (`env.ts:122`), na stagingu zostaje `wylaczony`
  → zachowanie identyczne z dzisiejszym (ciche no-op), na produkcji `pelny` → odświeżanie działa.
  Rozważone i odrzucone: (a) montaż bezwarunkowy z ochroną tylko w `.env` stagingu — całe ryzyko
  na konfiguracji, jedna pomyłka nadpisuje produkcyjny CSV; (b) osobna bramka na `SELLY_CSV_DIR` —
  nowy element zachowania, nieopisany ani w karcie, ani w planie 136.
  **Koszt przyjęty świadomie:** generowanie CSV (operacja czysto lokalna) zostaje sprzęgnięte
  z przełącznikiem sieciowym Selly.
- **D2 — test importuje prawdziwy `src/server.ts`.** Repo nie ma dziś wzorca: zero testów
  importujących ten plik, zero `vi.mock` w całym `test/`. Wybrany wariant jako jedyny pilnuje
  kodu, który faktycznie jedzie na produkcję — usunięcie montażu z `server.ts` wywali test.
  Odrzucone: (a) wydzielenie montażu do mikro-modułu (test nie sprawdziłby, czy `server.ts` go
  woła, plus nowy plik w `src/selly/`, obszarze karty I15.10); (b) wariant z planu 136 —
  test powtarzający wiring u siebie testuje własną kopię, nie montaż.
- **D3 — budowa i rejestracja na górze pliku**, obok `harmonogramSelly`; wyrejestrowanie
  w `zamknij()`. Rejestracja jest czystym stanem, nie timerem, więc nie ma czego odraczać do
  `listen()` — a **musi** być żywa, zanim w callbacku `listen()` ruszy `scheduler.uruchom()`,
  którego pierwszy przebieg potrafi od razu wykonać import i wywołać `zadajOdswiezenie()`.

**Świadome odstępstwa od oryginału** (poza odziedziczonymi z I15.10, opisanymi w nagłówku
`dostepnosc.ts`): **D1** — bramka po `SELLY_TRYB` zamiast po ścieżce bazy
(`staging_policy.cjs:131-134`). Kierunek jest ten sam (kopie milczą, produkcja działa), kryterium
inne, bo odbudowa nie hardkoduje ścieżki produkcyjnej bazy.

## Implementation plan

### 1. `rebuild/backend/src/server.ts` — montaż

- import: `stworzSynchronizacjeDostepnosci`, `ustawDomyslnaSynchronizacjeDostepnosci`
  z `./selly/dostepnosc.js`;
- **po** `discoverySelly` i `harmonogramSelly` (linie ~56-60), **przed** `stworzApp`:
  ```ts
  if (env.SELLY_TRYB === "wylaczony") {
    console.log("[dostepnosc] niezamontowana (SELLY_TRYB=wylaczony) — zgłoszenia są no-opem");
  } else {
    ustawDomyslnaSynchronizacjeDostepnosci(
      stworzSynchronizacjeDostepnosci({
        db,
        discovery: discoverySelly,   // TA SAMA instancja co Tor 1, Tor 2 i trasy ręczne
        sciezkiCsv: {
          katalog: env.SELLY_CSV_DIR,
          plik: env.SELLY_CSV_PLIK,
          url: env.SELLY_CSV_URL,
        },
      }),
    );
  }
  ```
  z komentarzem niosącym: (a) dlaczego JEDNA instancja `discoverySelly`
  (`docs/karty/I15.10/wejscie-121.md` — w domknięciu żyje cache kodów i nauczone `feature_id`),
  (b) dlaczego rejestracja tutaj, a nie w `listen()` (D3), (c) czym jest bramka i jakiej bramki
  oryginału odpowiada (D1, `staging_policy.cjs:131-134`);
- `sciezkiCsv` bierzemy z env **tak samo jak `app.ts:218-221`** — bez drugiego źródła prawdy;
- w `zamknij()`, obok `scheduler.zatrzymaj()` / `harmonogramSelly.zatrzymaj()`:
  `ustawDomyslnaSynchronizacjeDostepnosci(null)` (bezwarunkowo — wyrejestrowanie czegoś,
  czego nie ma, jest no-opem).

Commit: `139-FEATURE: montaż modułu dostępności w server.ts`.

### 2. `rebuild/backend/test/server.montaz-dostepnosci.test.ts` — nowy test

Jeden plik, dwa scenariusze, każdy z `vi.resetModules()` + dynamicznym `import()`, żeby
`server.js` i `dostepnosc.js` pochodziły z tego samego, świeżego rejestru modułów
(globalne `domyslna` żyje w module — bez resetu drugi scenariusz widziałby stan pierwszego).

Wspólny helper `uruchomServer(nadpisaniaEnv)`:
- katalog tymczasowy (`mkdtempSync(join(tmpdir(), ...))`), w nim `data.db` i podkatalog `csv`;
- baza stawiana **przed** importem: `otworzBaze` + `zastosujMigracje` (wzór:
  `test/db.migracje-produkcja.test.ts`), potem `sqlite.close()` — `server.ts` otworzy ją sam,
  bo `otworzBaze` migracji nie uruchamia (`src/db/index.ts:14-23`);
- env: `DB_PATH`, `JWT_SECRET`, `CORS_ORIGINS=""`, `PORT=0` (port efemeryczny), `HOST=127.0.0.1`,
  `SELLY_CSV_DIR`/`SELLY_CSV_PLIK`/`SELLY_CSV_URL` na tymczasowe, `PROMO_WYGASZACZ_MINUTY=0`,
  `IMPORT_SCHEDULER`/`SELLY_SCHEDULER` nieustawione, `SELLY_SHOP_URL=http://127.0.0.1:1`
  (adres gwarantowanie nieosiągalny — żadnego DNS ani ruchu na zewnątrz, nawet gdyby tryb
  przepuścił odczyt);
- `zamknij` zdejmujemy z `process.listeners("SIGTERM")` (różnica przed/po imporcie) — wołamy
  je wprost zamiast emitować sygnał, żeby nie ruszyć handlerów Vitesta;
- `process.exit` podmieniony `vi.spyOn` na czas testu — `zamknij()` kończy proces w callbacku
  `server.close()`.

Scenariusze:
1. **`SELLY_TRYB=tylko-odczyt` — montaż działa.** Po imporcie `zadajOdswiezenie("MO9")`
   ma realnie wygenerować plik CSV w katalogu tymczasowym (czekamy na pojawienie się pliku
   z limitem czasu). To dowód bez żadnej atrapy: kolejka żyje, `db` i `sciezkiCsv` są wpięte.
   Następne `syncDelta` poleci w nieosiągalny adres i zostanie **złapane** przez `catch`
   w `przetwarzaj()` (`dostepnosc.ts:90-92`) — test sprawdza też, że wyjątek nie wycieka.
   Potem `zamknij("SIGTERM")`, kasujemy plik, kolejne `zadajOdswiezenie("MO2")` i asercja,
   że plik **się nie odtworzył** (wyrejestrowane = no-op).
2. **`SELLY_TRYB=wylaczony` — montażu nie ma.** Po imporcie `zadajOdswiezenie("MO9")` nie
   tworzy żadnego pliku i nie rzuca (bramka D1).

Sprzątanie w `afterEach`: `zamknij()` (jeśli nie wołane), zdjęcie handlerów `SIGTERM`/`SIGINT`
dołożonych przez `server.ts`, `rmSync` katalogu, przywrócenie `process.exit` i `process.env`.

Commit: `139-FEATURE: test montażu — import prawdziwego server.ts`.

### 3. Bramki

`npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/backend/`
(Node ≥ 20, `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`).
Baseline przed zmianą: **111 plików, 1835 testów zielonych** (7 pominiętych).

## Testing strategy

- **GATE odbudowy: nie dotyczy** — ticket nie rusza kontraktu (uzasadnienie w sekcji „Kontrakt
  i fixtures"). Obowiązują bramki lint/typecheck/build/test.
- **Bez atrap logiki.** Test jedzie prawdziwym `server.ts`, prawdziwą bazą (tymczasową, po
  migracjach), prawdziwym `wygenerujCsvSelly` i prawdziwym `syncDelta`. Podmieniamy wyłącznie
  `process.exit` — bo inaczej `zamknij()` zabiłby workera Vitesta.
- **Co test realnie sprawdza:** że `server.ts` montuje moduł (regresja „ktoś wyciął montaż" =
  czerwony test), że bramka `SELLY_TRYB` działa w obie strony, i że `zamknij()` nie zostawia
  żywego modułu między plikami testowymi.
- **Czego NIE sprawdzamy:** zachowania samej kolejki (semantyka partii, restart po błędzie,
  synchroniczny powrót) — to jest pokryte w `test/selly.dostepnosc.test.ts` z I15.10 i nie
  powielamy tego. Nie sprawdzamy też wywołania z importera — to własność I15.4b.
- **Cała dotychczasowa suita ma przejść bez zmian** — montaż stoi w `server.ts`, a nie
  w `stworzApp`, więc dla testów budujących aplikację przez `stworzApp` jest niewidoczny.

## Out of scope

- Wołanie `zadajOdswiezenie()` z importera stagingu — zrobione w I15.4b
  (`import/tk.ts:74`, `import/polityka/fabryka.ts:988`), **nie ruszamy**.
- `src/selly/dostepnosc.ts` — moduł gotowy (I15.10), nie przepisujemy.
- `src/selly/rest/scheduler.ts`, `src/routes/selly-sync.ts` — własność I15.8.
- `import/polityka/**` — warstwa wspólna, zmiany tylko przez koordynatora.
- `docs/rebuild-roadmap.md` — karty go nie ruszają (CLAUDE.md, reguła 0).
- Bramka na `SELLY_CSV_DIR` analogiczna do produkcyjnej bramki po ścieżce bazy — odrzucona
  w D1; jeśli ma powstać, to osobną decyzją koordynatora.

## Definition of done

- [ ] `server.ts` buduje instancję z **tą samą** `discoverySelly`, którą dostaje `stworzApp`
- [ ] rejestracja za bramką `SELLY_TRYB !== "wylaczony"`, z komentarzem wyjaśniającym bramkę
- [ ] `ustawDomyslnaSynchronizacjeDostepnosci(null)` w `zamknij()`
- [ ] nowy test: montaż widoczny przy `tylko-odczyt`, brak montażu przy `wylaczony`,
      no-op po `zamknij()`
- [ ] montaż nie powoduje żadnej próby wysyłki ani zapisu przy samym starcie procesu
- [ ] cała dotychczasowa suita przechodzi bez zmian (111 plików / 1835 testów)
- [ ] `docs/karty/I15.10b/karta.md` opisuje STAN (`✅ data · 139-FEATURE-…`, sekcja „Dowiezione")
- [ ] wpis do backlogu i nota dla deployu stagingu (`SELLY_TRYB` jako bramka) zapisane
      w plikach per-ticket, nie w zbiorczych
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`
