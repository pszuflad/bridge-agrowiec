## Ticket
156-FEATURE-dziedzicz-wage-przycisk — przycisk w Konfiguracji do wstecznego dociągania wagi

## Summary
Nadbudowa nad ticketem 155 (dziedziczenie wagi po marce+rozmiarze+bieżniku): wsteczne
dociągnięcie wagi było dostępne tylko jako skrypt CLI (`npm run dziedzicz-wage`), co wymaga
dostępu do terminala serwera — nikt nie będzie tego specjalnie odpalał. Dodano przycisk w UI
(Konfiguracja → Katalog), żeby użytkowniczka mogła to zrobić sama, jednym kliknięciem.

## Problem / Motivation
Lokalizacja przycisku ustalona bezpośrednio z użytkowniczką w rozmowie: istniejąca zakładka
„Katalog" (nie nowa zakładka) — pasuje do wzorca tej zakładki, która już ma sekcję z akcjami na
całym katalogu (np. „Usuń wszystko z katalogu").

## Solution
- Logika backfillu wydzielona ze skryptu CLI do współdzielonej funkcji
  `dziedziczWageWstecznie(db, sqlite)` w `src/import/dziedziczenieWagi.ts` — skrypt i nowa trasa
  HTTP wołają dokładnie tę samą funkcję, więc nie mogą się rozjechać zachowaniem.
- Nowa trasa `POST /api/products/dziedzicz-wage` (`routes/maintenance.ts`) — auth wymagany,
  wpis w Dzienniku (`audit_log`) z licznikami wyniku, nie jest destrukcyjna (bez potwierdzenia).
- Nowy endpoint w kontrakcie (`contract/openapi.yaml` + ręcznie napisany fixture — endpoint jest
  NOWĄ logiką, produkcja go nie ma, więc nie ma czego nagrywać; ten sam wzorzec co
  `POST /api/maintenance/usun-nieopony`).
- Nowa sekcja „Dziedziczenie wagi" w zakładce „Katalog" (`Katalog.tsx`) z przyciskiem
  „Dociągnij wagę", toast z wynikiem (zaktualizowano/pominięto z rozbiciem na przyczyny),
  unieważnienie `/api/products` po sukcesie.

## Design decisions
- Przycisk NIE jest destrukcyjny (tylko uzupełnia braki, nigdy nie nadpisuje istniejącej wagi
  ani ręcznych poprawek) — bez `window.confirm`, inaczej niż „Usuń wszystko z katalogu".
- Jeden mechanizm dla CLI i UI (wspólna funkcja) zamiast duplikowania logiki backfillu.
- Komunikat błędu w toaście wyciąga pole `error` z ciała odpowiedzi (jak `wyczyscKatalog()`
  obok), nie surowy status+JSON — poprawione po code review.

## Tests
- Gate odbudowy: N/D w sensie odtwarzania produkcji (nowy endpoint), fixture ręcznie napisany
  jak przy innych rebuild-only trasach maintenance. `contract/openapi.yaml` przebudowany
  generatorem, `kontrakt.spojnosc.test.ts` zielony.
- Backend: `npm run lint && npm run typecheck && npm run build && npm test` — 1876/1876 zielone.
- Frontend: `npm run lint && npm run typecheck && npm run build && npm test` — 1001/1001 zielone.

## Breaking changes
None.

## Follow-up
Brak nowych — follow-upy z ticketu 155 (kosmetyka `waga=0` w UI, wpisanie backfillu do
procedury cutoveru) zostają aktualne.

## Review
<details>
<summary>Code review</summary>

0 BLOCKER / 1 SHOULD-FIX (naprawiony — czytelny komunikat błędu w toaście zamiast surowego
status+JSON) / 2 NICE-TO-HAVE (świadomie odłożone, opisane w raporcie).
Pełna treść: `docs/tickets/156-FEATURE-dziedzicz-wage-przycisk/review.md`.

</details>

---
Ticket docs: `docs/tickets/156-FEATURE-dziedzicz-wage-przycisk/`
Zsynchronizowane z `develop` (gałąź utworzona z aktualnego `origin/develop` po merge'u PR #181; `tools/sync-z-develop.sh` potwierdził brak rozjazdu tuż przed pushem); bramki zielone.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_011c43M9EaKacPhHiN8RSDpT
