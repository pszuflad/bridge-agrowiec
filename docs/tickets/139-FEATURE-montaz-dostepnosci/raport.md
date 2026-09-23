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
