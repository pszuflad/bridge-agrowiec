# Wpis do spec-backend od ticketu 139 (karta I15.10b) · 2026-09-23

**Sekcja:** §2 (panel Selly — kontynuacja `wpis-119.md`, moduł `src/selly/dostepnosc.ts`, i
`wpis-130.md`, wołanie `zadajOdswiezenie()` z importera).

**Potwierdzone w 139** (`139-FEATURE-montaz-dostepnosci`, 2026-09-23, karta I15.10b): montaż
modułu dostępności w cyklu życia procesu, ostatni brakujący element łańcucha opisanego w
`wpis-119.md` (moduł, świadomie niewpięty) i `wpis-130.md`/I15.4b (wołanie z importera).

- `rebuild/backend/src/server.ts` buduje `stworzSynchronizacjeDostepnosci({ db, discovery:
  discoverySelly, sciezkiCsv })` i rejestruje ją przez
  `ustawDomyslnaSynchronizacjeDostepnosci(...)`, **za bramką `SELLY_TRYB !== "wylaczony"`**;
  przy `wylaczony` proces wypisuje `[dostepnosc] niezamontowana (SELLY_TRYB=wylaczony) …`
  i nie montuje nic. `discoverySelly` jest TĄ SAMĄ instancją, którą dostaje `stworzApp` (jedna
  na proces — w jej domknięciu żyje cache kodów Selly i nauczone `feature_id`,
  `docs/karty/I15.10/wejscie-121.md`).
- Rejestracja stoi PRZED `stworzApp`/`listen()`, nie w callbacku `listen()` — to jest czysty
  stan, nie timer, i musi być żywa, zanim pierwszy przebieg schedulera importu (uruchamiany
  w callbacku `listen()`) zdąży wywołać `zadajOdswiezenie()`.
- `zamknij()` woła `ustawDomyslnaSynchronizacjeDostepnosci(null)` bezwarunkowo, obok
  `scheduler.zatrzymaj()` / `harmonogramSelly.zatrzymaj()` / `wygaszacz.zatrzymaj()`.
- **Skutek systemowy:** `zadajOdswiezenie()`, które importer woła na końcu `importer()`
  (`src/import/polityka/fabryka.ts:988`, karta I15.4b), przestaje być cichym no-opem przy
  `SELLY_TRYB` ∈ {`tylko-odczyt`, `pelny`} — import, który zmienił dostępność, regeneruje CSV
  pod `SELLY_CSV_DIR` i woła Tor 1. Przy `wylaczony` zachowanie zostaje identyczne jak dotąd
  (no-op), bo modułu w ogóle nie ma w procesie.

**Odstępstwo od oryginału.** `mirror/backend/availability_sync.cjs` NIE MA montażu — jest
`require`-owany leniwie w miejscu użycia (`mirror/backend/staging_policy.cjs:131-134`), a jego
singletonem jest cache `require`; bramką jest tam twarde porównanie ścieżki otwartej bazy do
`/home/admin/private_apps/bridge/data.db`. Rejestr `ustawDomyslnaSynchronizacjeDostepnosci` to
konstrukcja ODBUDOWY, wymuszona tym, że cała suita Vitest chodzi w jednym procesie (nie ma go
z czym porównać 1:1). Bramka `SELLY_TRYB !== "wylaczony"` jest najbliższym dostępnym
odpowiednikiem oryginalnej bramki „to nie produkcyjna baza": kierunek ten sam (kopie/staging
milczą, produkcja działa), kryterium inne, bo odbudowa nie hardkoduje ścieżki produkcyjnej bazy.

Nota dla cutoveru (deploy produkcji): `docs/cutover.md` §4, wiersze `SELLY_TRYB` i
`SELLY_CSV_DIR`.

Szczegóły: `docs/tickets/139-FEATURE-montaz-dostepnosci/`.
