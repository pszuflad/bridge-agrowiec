# I15.10b — montaż modułu dostępności w `server.ts`

> **Stan:** ✅ 2026-09-23 · 139-FEATURE-montaz-dostepnosci
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #104 (reszta po I15.10)
> **Ticket:** `139-FEATURE-montaz-dostepnosci` (implementacja; plan sam dowiózł ticket 136, PR #149)
> **Zależy od:** I15.10 ✅ (ticket 119, PR #144 — moduł istnieje)

## Zakres

Rejestracja `stworzSynchronizacjeDostepnosci({db, discovery: discoverySelly, sciezkiCsv})`
przez `ustawDomyslnaSynchronizacjeDostepnosci()` w `src/server.ts`, wzorem `harmonogramSelly`,
plus wyrejestrowanie w `zamknij()`. Pełny opis, wymagania i testy: plan ticketu 139
(`docs/tickets/139-FEATURE-montaz-dostepnosci/plan.md`).

## Skąd się wzięła ta karta

Ticket 119 (I15.10) świadomie nie ruszał `app.ts` i oddał montaż „do uzgodnienia z I15.8".
`docs/karty/I15.10/wejscie-121.md` odpowiedziało „montaż robi I15.10" już po zamknięciu tamtego
ticketu, więc czynność została bez właściciela. Wołanie `zadajOdswiezenie()` ma I15.4b
(`docs/karty/I15.4b/wejscie-119.md`) — to osobna rzecz i zostaje tam, gdzie jest.

## Pliki (wyłączna własność)

- `rebuild/backend/src/server.ts` — sam montaż (kilkanaście linii).
- Test montażu — nowy plik, nazwa do wyboru przez wykonawcę.

NIE dotyka: `src/selly/rest/scheduler.ts`, `src/routes/selly-sync.ts` (własność I15.8),
`src/selly/dostepnosc.ts` (własność I15.10 — moduł jest gotowy, nie przepisujemy go).

## Dowiezione

Ticket `139-FEATURE-montaz-dostepnosci` (2026-09-23; plan tego ticketu dowiózł już 136, PR #149).
`src/server.ts` buduje `stworzSynchronizacjeDostepnosci({db, discovery: discoverySelly, sciezkiCsv})`
z **tą samą** instancją `discoverySelly`, którą dostaje `stworzApp`, rejestruje ją przez
`ustawDomyslnaSynchronizacjeDostepnosci(...)` przed `stworzApp`/`listen()` i zdejmuje w `zamknij()`
przez `ustawDomyslnaSynchronizacjeDostepnosci(null)` (bezwarunkowo). Nowy test
`test/server.montaz-dostepnosci.test.ts` importuje prawdziwy `server.ts` (dwa scenariusze: montaż
i brak montażu), dowiedziony trzema sabotażami (raport ticketu). Cała dotychczasowa suita
przeszła bez zmian (111→112 plików, 1835→1837 testów).

**Odstępstwo od pierwotnego założenia karty:** karta zakładała montaż bezwarunkowy (wzorem
`harmonogramSelly`). Dowieziony montaż jest **za bramką `SELLY_TRYB !== "wylaczony"`** — decyzja
użytkownika 2026-09-23 (D1, `docs/tickets/139-FEATURE-montaz-dostepnosci/plan.md`). Powód:
`SELLY_CSV_DIR` domyślnie wskazuje katalog produkcyjny, a montaż otwiera generatorowi CSV drogę
automatyczną z każdego importu — bez bramki jedna pomyłka w `.env` nadpisałaby produkcyjny plik
ze stagingu. Oryginał ma tu bramkę po ścieżce bazy (`mirror/backend/staging_policy.cjs:131-134`);
odbudowa nie ma jej odpowiednika (nie hardkoduje ścieżki produkcyjnej bazy), więc `SELLY_TRYB`
jest najbliższym dostępnym kryterium — ten sam kierunek (kopie milczą, produkcja działa), inne
kryterium.

## Do koordynatora

- **Przed deployem produkcji sprawdzić `SELLY_TRYB` w `.env`.** Przy `wylaczony` odświeżanie
  dostępności nie ruszy (moduł niezamontowany, w logu startu `[dostepnosc] niezamontowana
  (SELLY_TRYB=wylaczony)…`) — to zamierzone dla stagingu, ale na produkcji musi być świadoma
  decyzja (`pelny` lub `tylko-odczyt`), nie przeoczenie.
- **Otwarta sprawa: bramka na `SELLY_CSV_DIR`.** Odrzucona w tym tickecie jako spoza zakresu
  karty (D1, `raport.md` → „Follow-up”). `SELLY_CSV_DIR` domyślnie wskazuje katalog produkcyjny,
  a jedyną ochroną na środowisku innym niż produkcja jest poprawny `.env` — dotyczy też
  istniejącej trasy `POST /api/selly/generate-csv` (od I15.3), więc to nie dług wniesiony przez
  ten ticket. Jeśli ma powstać osobna bramka, to decyzja koordynatora.
