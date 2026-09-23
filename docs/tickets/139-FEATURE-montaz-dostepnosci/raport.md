# 139-FEATURE — raport z implementacji

## Summary

`src/server.ts` buduje instancję `stworzSynchronizacjeDostepnosci` z **tą samą** `discoverySelly`,
którą dostaje `stworzApp`, rejestruje ją przez `ustawDomyslnaSynchronizacjeDostepnosci(...)`
i zdejmuje w `zamknij()`. Od tej chwili `zadajOdswiezenie()`, które I15.4b woła na końcu
`importer()` (`import/polityka/fabryka.ts:988`), przestaje być cichym no-opem. Rejestracja stoi
za bramką `SELLY_TRYB !== "wylaczony"` — odbudowa nie ma produkcyjnego kryterium „to nie
produkcyjna baza", a bez bramki montaż otwierałby generatorowi CSV automatyczną drogę do
katalogu, który domyślnie jest produkcyjny.

## Changes

- `rebuild/backend/src/server.ts` — import `stworzSynchronizacjeDostepnosci` /
  `ustawDomyslnaSynchronizacjeDostepnosci`; blok montażu za bramką `SELLY_TRYB` (po
  `harmonogramSelly`, przed `stworzApp`); `ustawDomyslnaSynchronizacjeDostepnosci(null)`
  w `zamknij()` obok `wygaszacz.zatrzymaj()`.
- **Nowy:** `rebuild/backend/test/server.montaz-dostepnosci.test.ts` — dwa scenariusze montażu.
- **Nowy:** `docs/tickets/139-FEATURE-montaz-dostepnosci/plan.md`.

Nie ruszone (zgodnie z zakresem karty): `src/selly/dostepnosc.ts`, `src/selly/rest/scheduler.ts`,
`src/routes/selly-sync.ts`, `src/import/**`, `import/polityka/**`, `docs/rebuild-roadmap.md`.

## Deviations from plan

Dwie, obie wymuszone przez zastane fakty, żadna nie zmienia zakresu:

1. **`PORT=0` w teście odpadło.** Plan zakładał port efemeryczny, ale strażnik konfiguracji
   wymaga `PORT >= 1` (`config/env.ts`) i `wczytajEnv()` rzuca. Test bierze wolny port sondą
   `node:net` (`wolnyPort()`) — ten sam efekt, bez stałego numeru, który biłby się
   z równoległymi sesjami.
2. **Asercja na wyrejestrowanie musiała być inna, niż zakładał plan.** Plan mówił „po `zamknij()`
   plik się nie odtwarza". To przechodziło **z niewłaściwego powodu**: `zamknij()` zamyka też
   bazę, więc nadal zarejestrowana instancja wywalałaby się w generatorze i pliku i tak by nie
   było. Wykryte sabotażem (niżej). Ostateczna asercja: `console.error` **nie zostaje wywołane** —
   moduł loguje każdy nieudany bieg (`selly/dostepnosc.ts`), więc cisza znaczy „bieg w ogóle nie
   ruszył", czyli instancja jest zdjęta.

## Test results

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Nie dodaje ani nie zmienia
  żadnej trasy HTTP, nie zmienia kształtu odpowiedzi, nie rusza schematu ani migracji. Zmiana
  jest wewnętrznym wpięciem modułu w cykl życia procesu (`server.ts`) — pliku, którego nie
  dotyka żaden test kontraktowy, bo cała suita buduje aplikację przez `stworzApp`.
- **Bramki:** `lint` ✓ · `typecheck` ✓ · `build` ✓ · `test` ✓ — **112 plików, 1837 testów
  zielonych** (7 pominiętych). Baseline przed ticketem: 111 plików / 1835 testów, też zielony.
  Cała dotychczasowa suita przeszła bez zmian.
- **Nowy test** (`test/server.montaz-dostepnosci.test.ts`, 2 przypadki): zero atrap logiki —
  prawdziwa baza w katalogu tymczasowym (po `zastosujMigracje`), prawdziwy `wygenerujCsvSelly`,
  prawdziwy `syncDelta`. Podmieniony jest wyłącznie `process.exit`, bo `zamknij()` kończy proces.
  Selly wskazuje na `http://127.0.0.1:1` — zero DNS, zero ruchu na zewnątrz.
- **Weryfikacja, że test nie jest pusty — trzy sabotaże na `server.ts`:**

  | Sabotaż | Wynik |
  |---|---|
  | instancja powstaje, ale nie jest rejestrowana | ✗ czerwony (`…ma wygenerować CSV…`) |
  | usunięte `ustawDomyslnaSynchronizacjeDostepnosci(null)` z `zamknij()` | ✗ czerwony (`…nie ma nawet PRÓBOWAĆ biegu…`) |
  | usunięta bramka `SELLY_TRYB` (montaż bezwarunkowy) | ✗ czerwony (`bez montażu żaden plik nie powstaje`) |

  Drugi sabotaż początkowo **przechodził** — to on wymusił zmianę asercji opisaną w „Deviations".

- **Czego test NIE łapie (świadomie):** podmiany `discovery: discoverySelly` na świeżą instancję
  `stworzDiscovery(...)`. Z zewnątrz procesu obie zachowują się identycznie — różnica (zimny cache
  kodów, utracone `feature_id`) jest niewidoczna w obserwowalnym skutku. Chroni to komentarz
  w `server.ts` i przegląd kodu, nie test.

## Breaking changes

Brak zmian w API. **Jest natomiast zmiana zachowania procesu** i ona wymaga uwagi przy deployu:

- Przy `SELLY_TRYB` = `pelny` lub `tylko-odczyt` każdy import, który zmienił dostępność, zaczyna
  **regenerować plik CSV** pod `SELLY_CSV_DIR` i wołać Tor 1. Dotąd nie robił nic.
- Przy `SELLY_TRYB=wylaczony` (domyślka i staging) zachowanie jest **identyczne jak dotąd** —
  moduł nie jest montowany, w logu startu pojawia się `[dostepnosc] niezamontowana…`.
- **Do sprawdzenia przed deployem produkcji:** czy `.env` produkcji ma `SELLY_TRYB=pelny`
  (inaczej odświeżanie dostępności nie ruszy) **oraz** czy `SELLY_CSV_DIR` wskazuje właściwy
  katalog na każdym środowisku, które nie ma `wylaczony`.

## Follow-up

- **Bramka na `SELLY_CSV_DIR` — do decyzji koordynatora.** Odrzucona w tym tickecie (decyzja D1
  w `plan.md`), bo dokładałaby element zachowania spoza karty. Problem zostaje: `SELLY_CSV_DIR`
  domyślnie wskazuje katalog produkcyjny, a jedyną ochroną na środowisku innym niż produkcja
  jest poprawny `.env`. Dotyczy to też istniejącej trasy `POST /api/selly/generate-csv`
  (od I15.3), więc nie jest to dług wniesiony przez ten ticket.
- **Brak testu na tożsamość `discoverySelly`** — patrz „Test results", ostatni punkt.

## Review fixes applied

Review (`review.md`): 3 BLOCKER / 3 SHOULD-FIX / 1 NICE-TO-HAVE. Kod produkcyjny bez zastrzeżeń
— bramki potwierdzone niezależnie przez reviewera (112 plików / 1837 testów).

**BLOCKER-y** — wszystkie trzy były pozycjami dokumentacyjnymi, rozliczonymi w Fazie 5:
`docs/karty/I15.10b/karta.md` doprowadzona do STANU, `docs/rebuild-backlog/wpis-139.md` założony,
`raport.md` zacommitowany (wszedł z commitem poprawek review).

**SHOULD-FIX** — wszystkie trzy naprawione, commit `139-FEATURE: review fix …`:
- `test/server.montaz-dostepnosci.test.ts` — `uruchomiony` przypisywane PRZED asercją obronną,
  a sprzątanie w `afterEach` idzie przez `finally`. Wcześniej padnięcie asercji
  `expect(zamknij).toBeDefined()` zostawiłoby na workerze Vitesta żywy nasłuch HTTP i handlery
  sygnałów.
- `wolnyPort()` opisuje swoje okno TOCTOU, a `vitest.config.ts` odnotowuje, że ten jeden plik
  łamie niezmiennik „testy nie zajmują portu" — bo `server.ts` zawsze woła `listen()` i nie da
  się tego obejść bez zmiany kodu produkcyjnego.
- Komentarz w `zamknij()` nie obiecuje już, że trwający bieg kolejki „dobiega sam": mówi wprost,
  że albo trafi na zamkniętą bazę (błąd złapany i zalogowany), albo utnie go `process.exit`.

Po poprawkach powtórzone sabotaże 1 i 2 — oba nadal dają czerwony test.

## Docs updates

### `docs/karty/` (karta + wejścia)
- `docs/karty/I15.10b/karta.md` — `> **Stan:** ✅ 2026-09-23 · 139-FEATURE-montaz-dostepnosci`;
  `**Ticket:**` przeniesiony z 136 na 139 (136 dowiózł sam plan, PR #149). Nowa sekcja
  „Dowiezione" z zakresem faktycznym i **jawnie oznaczonym odstępstwem od założenia karty**:
  karta zakładała montaż bezwarunkowy, dowieziony jest za bramką `SELLY_TRYB`. Sekcja
  „Do koordynatora" przepisana na dwa aktualne punkty (sprawdzenie `SELLY_TRYB` przed deployem,
  otwarta sprawa bramki na `SELLY_CSV_DIR`); nieaktualne punkty o kolejności i ryzyku odłożenia
  usunięte, nie dopisane obok.
- **Nowy** `docs/karty/I15.9/wejscie-139.md` — I15.9 (ostatnia karta I15) dowiaduje się, że
  łańcuch jest kompletny, ale **bezczynny przy `SELLY_TRYB=wylaczony`**, więc „na stagingu nic
  się nie dzieje" nie jest dowodem zepsucia.
- **Nowy** `docs/karty/TEST.1/wejscie-139.md` — instrukcja w układzie delty (co zmieniono →
  polecenie → rezultat) z rozbiciem na oba tryby.

### `docs/rebuild-backlog/`
- **Nowy** `docs/rebuild-backlog/wpis-139.md`: `#139.1` (montaż + odstępstwo D1, ✅ wdrożone),
  `#139.2` (`SELLY_CSV_DIR` bez własnej bramki, ⬜ do decyzji — odnotowane jako **nie dług tego
  ticketu**, bo istnieje od I15.3 dla `POST /api/selly/generate-csv`).
- `docs/rebuild-backlog.md` — korekta W MIEJSCU dwóch zdań obalonych przez ten ticket
  (pole „Status" wpisu `#104` i blok „⭐ Zrealizowane" ticketu 119 mówiły, że moduł jest
  „celowo niewpięty — czeka na I15.4b"). Plik nie urósł.
- `docs/rebuild-backlog/wpis-129.md` — **bez zmian**: wiersz `#104` nie ma komórki
  `Status`/`Do nowej wersji?`, więc regulamin nie daje prawa do edycji w miejscu. Odnośnik idzie
  z `wpis-139.md`.

### `docs/spec-backend/` i `docs/cutover.md`
- **Nowy** `docs/spec-backend/wpis-139.md` — montaż, wspólna instancja `discoverySelly`,
  kolejność względem `listen()`, wyrejestrowanie w `zamknij()`, skutek systemowy i odstępstwo
  w kryterium bramki. Nic nie dopisane na koniec sekcji `docs/spec-backend.md`.
- `docs/spec-backend.md` — **bez zmian**, sprawdzone `grep`em: nie zawiera zdania obalonego
  przez ten ticket.
- `docs/cutover.md` §4 — dwa wiersze tabeli zmiennych środowiskowych doprecyzowane:
  `SELLY_TRYB` (bramkuje teraz także moduł dostępności — przy `wylaczony` import nie regeneruje
  CSV i nie woła Toru 1, **cicho, bez błędu**) oraz `SELLY_CSV_DIR`/`SELLY_CSV_PLIK`/`SELLY_CSV_URL`
  (ścieżka jest od teraz zapisywana automatycznie po każdym imporcie zmieniającym dostępność,
  nie tylko ręcznym wywołaniem trasy).

### Pre-existing issues zgłoszone przez doc-checkery (nie naprawione — cudza własność pliku)
- `docs/spec-backend/wpis-119.md:57-58` — „moduł jest CELOWO niewpięty, wpięcie to karta I15.4"
  jest po tym tickecie nieaktualne. Plik jest własnością ticketu 119, a regulamin
  (`docs/spec-backend/README.md`) zabrania innym ticketom go edytować. Sprostowanie stoi
  w `docs/spec-backend/wpis-139.md`, który się do niego odwołuje. **Do decyzji koordynatora.**
- `docs/rebuild-backlog.md`, pole „Do nowej wersji?" wpisu `#104` — mówi „staging/auto-wstrzymania
  zostają do I15.4b", choć ta praca jest już dowieziona ticketem 130. Niespójność sprzed tego
  ticketu, dotyczy karty I15.4b. **Zgłoszone, nie poprawione.**
- `docs/rebuild-backlog/wpis-129.md`, wiersz `#104` — opis „Import i `availability_sync` →
  I15.4b / I15.10" jest nadal prawdziwy, ale nie wspomina montażu (I15.10b). Brak uprawnionego
  miejsca do edycji w miejscu. **Do decyzji koordynatora.**
