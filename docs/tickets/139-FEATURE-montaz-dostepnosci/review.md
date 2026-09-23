# 139-FEATURE-montaz-dostepnosci — Code review

> Reviewed: 2026-09-23
> Branch: `feature/139-montaz-dostepnosci`
> Diff: 3 pliki (`rebuild/backend/src/server.ts`, `rebuild/backend/test/server.montaz-dostepnosci.test.ts`, `docs/tickets/139-FEATURE-montaz-dostepnosci/plan.md`), 2 commity

Bramki uruchomione samodzielnie w tym worktree (Node v20.20.2): `npm run lint` ✓, `npm run typecheck` ✓,
`npm run build` ✓, `npm test` ✓ — **112 plików, 1837 testów zielonych, 7 pominiętych** (baseline
111/1835 potwierdzony jako podzbiór). Zgodne z `raport.md`. Gałąź zawiera całe `origin/develop`
(`ab30674` jest przodkiem HEAD) — synchronizacja OK.

## BLOCKER

- [ ] `docs/karty/I15.10b/karta.md` — karta nadal opisuje ZAMIAR, nie STAN.
  - Reason: Plik nie ma żadnego commita na tej gałęzi (`git log -- docs/karty/I15.10b/karta.md`
    pokazuje tylko commit zakładający kartę, `6b99466`). Nagłówek wciąż brzmi „⬜ do wstawienia
    w kolejkę", mimo że DoD ticketu (`plan.md:203`) wprost wymaga oznaczenia karty jako zrobionej
    (`✅ data · 139-FEATURE-…`, sekcja „Dowiezione"). To jednoznaczne złamanie CLAUDE.md, reguła 1:
    „Po każdej zamkniętej karcie jej `karta.md` opisuje STAN, nie zamiar" — kolejna sesja/koordynator
    czytający tę kartę zobaczy nieprawdziwy stan „do zrobienia", choć montaż jest już zaimplementowany
    i przetestowany.
  - Suggestion: dopisać do `karta.md` status `✅` z datą i ID ticketu oraz sekcję „Dowiezione"
    streszczającą to, co faktycznie wylądowało w `server.ts`.

- [ ] Brak `docs/rebuild-backlog/wpis-139.md` — DoD niezrealizowane.
  - Reason: `plan.md:204-205` explicite wymaga „wpisu do backlogu i noty dla deployu stagingu
    (`SELLY_TRYB` jako bramka) zapisanych w plikach per-ticket, nie w zbiorczych". Jedyne miejsce,
    gdzie ta treść istnieje, to sekcje „Breaking changes"/„Follow-up" w `raport.md` — nie jest to
    wpis backlogu w rozumieniu `docs/rebuild-backlog/README.md` (własny plik `wpis-<N>.md`,
    identyfikator `#139.1`), więc przyszły triaż backlogu (`tools/stan-backlogu.sh` i sesje
    czytające katalog) tej noty nie zobaczy. Ryzyko jest realne i nazwane w samym raporcie:
    „Do sprawdzenia przed deployem produkcji: czy `SELLY_TRYB=pelny`… oraz czy `SELLY_CSV_DIR`
    wskazuje właściwy katalog" — to dokładnie kandydat na wpis backlogu, a nie ma go nigdzie
    indeksowanego poza plikiem ticketu.
  - Suggestion: utworzyć `docs/rebuild-backlog/wpis-139.md` wg szablonu z README, z odnośnikiem
    do `raport.md` i notą deployu (`SELLY_TRYB` na produkcji, `SELLY_CSV_DIR` per środowisko).

- [ ] `docs/tickets/139-FEATURE-montaz-dostepnosci/raport.md` — plik jest **niezacommitowany**.
  - Reason: `git status --porcelain` pokazuje `?? docs/tickets/139-FEATURE-montaz-dostepnosci/raport.md`
    — nie wszedł do żadnego z dwóch commitów na gałęzi (`e1a984d`, `f39ee5b`). To plik, na którym
    opiera się duża część tego review (deviations, wyniki sabotaży, breaking changes) i wymóg
    procesu (artefakt ticketu). Dopóki nie jest zacommitowany, nie wejdzie do PR ani do historii
    gałęzi — ktoś czytający sam diff/PR go nie zobaczy.
  - Suggestion: `git add`/commit `raport.md` przed pushem i otwarciem PR.

## SHOULD-FIX

- [ ] `rebuild/backend/test/server.montaz-dostepnosci.test.ts:46-59,125` — realne bindowanie portu
  TCP (`wolnyPort()` sondą `node:net`) jest odstępstwem od udokumentowanego niezmiennika suity.
  - Reason: `rebuild/backend/vitest.config.ts:7` mówi wprost: „HTTP idzie przez supertest (bez
    zajmowania portu) — równoległość jest bezpieczna". Ten test jako jedyny w repo faktycznie
    wywołuje `app.listen()` (przez import `server.ts`) na prawdziwym porcie. `wolnyPort()` ma okno
    TOCTOU: między zamknięciem sondy (`sonda.close()`) a realnym `listen()` w zaimportowanym
    `server.ts` inny proces/test może zająć ten sam port — mało prawdopodobne, ale realne przy
    ~46 równoległych worktree i wielu workerach Vitest. Komentarz w `vitest.config.ts` nie został
    zaktualizowany, więc jest teraz nieścisły dla tego pliku.
  - Suggestion: doprecyzować komentarz w `vitest.config.ts` (wyjątek dla tego jednego pliku) albo
    rozważyć retry na `EADDRINUSE` w `uruchomServer()`. Nie musi być zrobione teraz — ryzyko jest
    niskie, ale warto to nazwać, żeby ktoś nie uznał testu za w 100% bezpieczny do run współbieżnego.

- [ ] `rebuild/backend/test/server.montaz-dostepnosci.test.ts:134-157` — `uruchomiony` jest
  przypisywany PO defensywnym `expect(zamknij, …).toBeDefined()` (linia 141 vs. 143), więc gdyby
  ta asercja kiedyś padła, sprzątanie w ogóle nie ruszy.
  - Reason: w chwili wywołania `expect` na linii 141 prawdziwy `server.ts` już wykonał `app.listen()`
    i zarejestrował handlery `SIGTERM`/`SIGINT` (efekty uboczne importu modułu). Jeśli asercja
    rzuci (np. przyszła regresja usuwająca rejestrację handlera), `uruchomiony` zostaje `null`,
    `afterEach` (linia 92: `if (uruchomiony && !zamkniety)`) NIE wywoła `zamknij()`, a żywy
    HTTP-serwer + handlery sygnałów zostają na workerze Vitesta do końca jego życia — realne ryzyko
    zawieszenia lub zatrucia kolejnych plików testowych w tym samym workerze.
  - Suggestion: przypisać `uruchomiony` (albo przynajmniej referencję do handlera `zamknij`) ZANIM
    padnie defensywny `expect`, np. w bloku `try/finally` albo od razu po znalezieniu `zamknij`,
    przed asercją.

- [ ] `rebuild/backend/src/server.ts:170-174` (komentarz „Bieg już trwający dobiega sam") —
  nieprecyzyjne w świetle realnego zachowania `zamknij()`.
  - Reason: `ustawDomyslnaSynchronizacjeDostepnosci(null)` (linia 174) tylko blokuje NOWE zgłoszenia;
    bieg już trwający to niezależny łańcuch obietnic nad tym samym `db`/`sqlite`, którego
    `server.close()` (linia 175) NIE czeka. Callback `server.close()` zamyka `sqlite` i woła
    `process.exit(0)` (linie 176-177) niezależnie od tego, czy kolejka `dostepnosc.ts` skończyła.
    Bieg w toku może więc trafić na zamkniętą bazę (wyjątek złapany i zalogowany przez
    `dostepnosc.ts`) — a w najgorszym razie `process.exit(0)` ubije event loop, zanim ten
    `console.error` zdąży się wykonać, więc strata może być całkowicie cicha. Komentarz sugeruje
    czyste dokończenie („dobiega sam"), co nie jest gwarantowane. To nie jest nowa regresja
    (oryginał też nie ma drenażu przy zamykaniu), ale komentarz nie powinien obiecywać więcej,
    niż kod faktycznie daje.
  - Suggestion: doprecyzować komentarz — bieg w toku może zakończyć się błędem na zamkniętej
    bazie (złapanym) albo zostać ucięty przez `process.exit`, zamiast sugerować gładkie dokończenie.
    Nie wymaga zmiany logiki (brak drenażu jest świadomą, spójną z resztą pliku decyzją — scheduler
    i harmonogram też nie czekają na trwającą pracę).

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/server.ts:66-90` — blok komentarza przy montażu (ok. 25 linii) powtarza
  dużą część uzasadnienia z `plan.md`. Zgodne z konwencją projektu (decyzje dokumentowane w kodzie),
  ale można by skrócić do samej istoty + odnośnika do `docs/karty/I15.10b/karta.md`, żeby plik
  wejściowy procesu nie puchł przy kolejnych kartach dokładających podobne bloki.

## Plan compliance

### Done ✓
- `server.ts` buduje `stworzSynchronizacjeDostepnosci` z **tą samą** instancją `discoverySelly`,
  którą dostaje `stworzApp` (zweryfikowane: jedna zmienna, jedno miejsce budowy).
- `sciezkiCsv` brane z env dokładnie jak w `app.ts:218-221` (ten sam kształt `{katalog, plik, url}`).
- Rejestracja stoi PRZED `stworzApp`/`listen()`, więc jest żywa zanim `scheduler.uruchom()` w
  callbacku `listen()` mógłby wywołać import → `zadajOdswiezenie()`. Brak okna wyścigu na starcie.
- Bramka `SELLY_TRYB === "wylaczony"` zaimplementowana zgodnie z D1 — montaż pomijany tylko dla
  `wylaczony`, uruchamiany dla `tylko-odczyt` i `pelny`; komentarz opisuje różnicę względem bramki
  oryginału (`staging_policy.cjs:131-134`) uczciwie (kierunek ten sam, kryterium inne).
- `ustawDomyslnaSynchronizacjeDostepnosci(null)` w `zamknij()`, bezwarunkowo, przed `server.close()`.
- Nowy test importuje prawdziwy `server.ts` (D2), dwa scenariusze (`tylko-odczyt` montuje,
  `wylaczony` nie montuje), zero atrap logiki poza `process.exit`; Selly wskazuje na
  `http://127.0.0.1:1` — brak realnego ruchu sieciowego.
- Cała dotychczasowa suita przechodzi bez zmian (111→112 plików, 1835→1837 testów), zgodnie z DoD.
- Zakres domknięty ściśle do własności karty: `src/selly/dostepnosc.ts`, `src/selly/rest/scheduler.ts`,
  `src/routes/selly-sync.ts`, `import/polityka/**`, `docs/rebuild-roadmap.md` — nietknięte.

### Missing or deviating ✗
- `docs/karty/I15.10b/karta.md` — miało zostać zaktualizowane do STANU (DoD), nie zostało (BLOCKER).
- Wpis do `docs/rebuild-backlog/` i nota dla deployu stagingu w osobnym pliku per-ticket — nie
  powstały jako osobny plik backlogu (BLOCKER); treść istnieje wyłącznie w `raport.md`.
- `raport.md` nie jest zacommitowany na gałęzi (BLOCKER, kwestia procesu, nie kodu).
- Dwa udokumentowane w `raport.md` odstępstwa od planu (`PORT=0` → sonda `wolnyPort()`; zmiana
  asercji na wyrejestrowanie z „plik się nie odtwarza" na „brak `console.error`") — obie
  uzasadnione i nie zmieniają zakresu, zaakceptowane.

### Definition of done
- [x] `server.ts` buduje instancję z tą samą `discoverySelly`, którą dostaje `stworzApp`
- [x] rejestracja za bramką `SELLY_TRYB !== "wylaczony"`, z komentarzem wyjaśniającym bramkę
- [x] `ustawDomyslnaSynchronizacjeDostepnosci(null)` w `zamknij()`
- [x] nowy test: montaż widoczny przy `tylko-odczyt`, brak montażu przy `wylaczony`, no-op po `zamknij()`
- [x] montaż nie powoduje żadnej próby wysyłki ani zapisu przy samym starcie procesu
- [x] cała dotychczasowa suita przechodzi bez zmian (111 plików / 1835 testów → 112/1837, przyrost tylko z nowego pliku)
- [ ] `docs/karty/I15.10b/karta.md` opisuje STAN — nie zrobione
- [ ] wpis do backlogu i nota dla deployu stagingu zapisane w plikach per-ticket, nie w zbiorczych — nie zrobione (treść jest tylko w `raport.md`, który sam nie jest zacommitowany)
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE` — synchronizacja i bramki OK; PR jeszcze nie istnieje (etap przed pushem), więc ten punkt jest otwarty do domknięcia przy pushu, nie defekt tej rundy

## Parallel-test concerns

Nowy test (`test/server.montaz-dostepnosci.test.ts`) generalnie jest zaprojektowany pod
równoległość: katalog tymczasowy unikalny (`mkdtempSync`), port przez sondę (nie stały numer),
pełne odtworzenie `process.env`/listenerów w `afterEach`. Jedno realne ryzyko: **wiąże prawdziwy
port TCP** (patrz SHOULD-FIX wyżej) — TOCTOU między sondą a właściwym `listen()`, w przeciwieństwie
do reszty suity, która (wg `vitest.config.ts`) w ogóle nie zajmuje portów. Prawdopodobieństwo
kolizji jest niskie, ale to jedyny plik w repo, który w ten sposób łamie udokumentowany niezmiennik
— warto to nazwać przy równoległych sesjach/CI, nie blokować teraz.

## Overall assessment

Sama zmiana w `server.ts` jest precyzyjna i zgodna z planem: właściwa instancja `discoverySelly`,
właściwe źródło `sciezkiCsv`, poprawna kolejność montażu względem `listen()`, bramka `SELLY_TRYB`
zaimplementowana zgodnie z D1 i uczciwie skomentowana. Test jest ambitny (jedyny w repo importujący
prawdziwy `server.ts`) i realnie dowodzi montażu — trzy udokumentowane sabotaże w `raport.md` to
dobry dowód, że nie jest pusty. Główny problem tej rundy nie leży w kodzie produkcyjnym, tylko
w niedomkniętych artefaktach procesu: karta `I15.10b` wciąż wygląda na niezaczętą, nie ma wpisu
backlogu mimo jawnego zobowiązania w DoD, a `raport.md` — źródło większości uzasadnień w tym
review — nie jest nawet zacommitowany na gałęzi. To są rzeczy do domknięcia przed pushem, nie
powód do przepisywania logiki.
