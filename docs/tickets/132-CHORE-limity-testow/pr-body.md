## Ticket
132-CHORE — limity czasu dla dwóch testów + budżet czasu jako sygnał

## Summary
Dwa testy **spoza jakiegokolwiek diffu** wypadały na TIMEOUT (20 s) przy obciążonej maszynie
i fałszywie czerwieniły GATE cudzych ticketów. Dostają własny limit 120 s, a żeby podniesiony
limit nie przykrył prawdziwej regresji — dochodzi budżet czasu sprawdzany w CI.

## Problem / Motivation
`test/alerty-katalogu.gate.test.ts` („paczka równa limitowi 20 000 id”) i
`test/silnik.charakteryzacja.test.ts` („MO5: port silnika == oryginalne `tk()`”) siedzą blisko
domyślnego limitu 20 s. Zdarzyło się to dwa razy w jeden dzień: raz autorowi ticketu 119, raz
recenzentowi — obaj tracili czas na diagnozę nie swojego testu. Gdy „czerwony bywa normalny”,
przestaje się patrzeć na czerwone.

## Pomiar — rozstrzyga spór z ticketu 119
Raport 119 twierdził „w izolacji zielone”, review 119 — „37–50 s także w izolacji”. Obie
obserwacje są prawdziwe, bo decyduje **obciążenie maszyny**:

| Warunki | „paczka 20 000 id” | MO5 |
|---|---|---|
| load ≈ 6 (wolna maszyna) | **4,6 s** | **2,6 s** |
| load ≈ 19 | 21,4 s | — |
| load ≈ 34 (siedem sesji agentów) | 30,6 s (TIMEOUT) | 22,0 s (TIMEOUT) |

Wniosek ważny dla planowania: **endpoint nie jest wolny** — 20 000 pozycji idzie w ~3–5 s
(~0,2 ms na pozycję, zapis już jest w jednej transakcji, `repos/alerty-katalogu.ts:113`).
Wcześniejsza hipoteza „~1 ms na pozycję, użytkownik czeka 20 s” brała się z pomiaru na
obciążonej maszynie i jest błędna.

## Solution
- `it(..., 120_000)` w obu testach, z komentarzem zawierającym pomiar. **Nie** podnosimy
  globalnego `testTimeout` — to przykryłoby także prawdziwe zawieszenia.
- `rebuild/backend/test/budzety-czasu.json` — budżet 45 s, twardy limit 90 s, pomiary wyjściowe
  i instrukcja „co zrobić po przekroczeniu”.
- `tools/czas-testow.cjs` — czyta raport JSON vitest, porównuje z budżetami, wypisuje
  `::warning::` (budżet) lub `::error::` + kod 1 (twardy limit).
- `.github/workflows/ci.yml` — testy z dodatkowym raportem JSON plus krok „Budżety czasu testów”
  (`always()`, więc raportuje też po czerwonych testach).
- `docs/tickets/133-PERF-zapis-statusow-alertow/plan.md` — **odłożony** ticket na przyspieszenie
  zapisu, z jasnym wyzwalaczem: budżet przekroczony **na wolnej maszynie** albo zgłoszenie
  użytkownika panelu. Bez tego nie ma czego naprawiać.

## Design decisions
- **Ostrzeżenie zamiast blokady** przy przekroczeniu budżetu — dokładanie kolejnego fałszywego
  czerwonego byłoby lekiem gorszym od choroby; twardy limit 90 s zostaje jako bezpiecznik.
- **Budżet przy podniesionym limicie**, nie zamiast niego — limit chroni przed obciążeniem
  maszyny, budżet przed niezauważonym wzrostem czasu. To dwie różne rzeczy.
- **Ticket 133 założony, nie wykonany** — decyzja użytkownika („wariant A teraz, B jak będą
  problemy”), poparta pomiarem: dziś nie ma regresji do naprawienia.

## Tests
Bramki backendu **po scaleniu `develop` z ticketem 119**: `lint` ✓, `typecheck` ✓, `build` ✓,
`vitest run` ✓ — **109/109 plików, 1793 testy zielone, 7 pominiętych**.
Skrypt budżetów sprawdzony na realnym raporcie: ✓ 4,6 s i ✓ 2,6 s przy load 6,5; poprawnie
obsługuje brak pliku raportu, brak testu w raporcie i test pominięty.

## Breaking changes
Brak. Zmiana dotyczy limitów czasu w dwóch testach i jednego dodatkowego kroku CI.

## Follow-up
`133-PERF-zapis-statusow-alertow` — odłożony, uruchamiany wyzwalaczem opisanym w jego planie.

## Review
Bez subagenta — zmiana testowo-narzędziowa, poparta pomiarem w trzech stanach obciążenia.

---
Ticket docs: `docs/tickets/132-CHORE-limity-testow/`
