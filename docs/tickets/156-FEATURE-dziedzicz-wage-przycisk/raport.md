# 156-FEATURE-dziedzicz-wage-przycisk — raport implementacji

## Ticket description

Nadbudowa nad ticketem 155 (dziedziczenie wagi po marce+rozmiarze+bieżniku): wsteczne
dociągnięcie wagi było dostępne tylko jako skrypt CLI (`npm run dziedzicz-wage`), co wymaga
dostępu do terminala serwera — nikt nie będzie tego specjalnie odpalał. Dodano przycisk w UI
(Konfiguracja → Katalog), żeby użytkowniczka mogła to zrobić sama, jednym kliknięciem.

Lokalizacja przycisku ustalona z użytkowniczką: istniejąca zakładka „Katalog" (nie nowa
zakładka) — pasuje do wzorca tej zakładki, która już ma sekcję z akcjami na całym katalogu.

## Summary

Nowy endpoint `POST /api/products/dziedzicz-wage` (NOWA logika, nie port — jak cały mechanizm
z ticketu 155) woła dokładnie tę samą funkcję co skrypt CLI, więc oba wejścia (terminal i UI)
nigdy się nie rozjadą. Logika backfillu została wydzielona ze skryptu do współdzielonej funkcji
`dziedziczWageWstecznie()` w `src/import/dziedziczenieWagi.ts`. Nowa sekcja w zakładce „Katalog"
z przyciskiem „Dociągnij wagę" (nie destrukcyjne — bez `window.confirm`), toast z wynikiem
(zaktualizowano/pominięto z rozbiciem na przyczyny), wpis w Dzienniku (audit log).

## Changes

- `rebuild/backend/src/import/dziedziczenieWagi.ts` — nowa funkcja `dziedziczWageWstecznie(db,
  sqlite)`, wydzielona z dotychczasowego skryptu CLI (ticket 155); reszta modułu bez zmian.
- `rebuild/backend/scripts/dziedzicz-wage.ts` — uproszczony do cienkiego wrappera wołającego
  `dziedziczWageWstecznie()`.
- `rebuild/backend/src/routes/maintenance.ts` — nowa trasa `POST /api/products/dziedzicz-wage`
  (auth wymagany, audyt `dziedziczenie_wagi_wsteczne` z licznikami w `szczegoly`).
- `contract/openapi.yaml`, `contract/fixtures/POST_products_dziedzicz-wage.json` — nowy endpoint
  w kontrakcie. Fixture RĘCZNIE napisany (nie nagrany z oryginału) — endpoint jest nową logiką,
  produkcja go nie ma, więc nie ma czego nagrywać (ten sam wzorzec co
  `POST /api/maintenance/usun-nieopony`, też rebuild-only).
- `rebuild/frontend/src/pages/konfiguracja/katalog.ts` — nowy klient `dziedziczWage()` +
  typ `WynikDziedziczeniaWagi`.
- `rebuild/frontend/src/pages/konfiguracja/Katalog.tsx` — nowa sekcja „Dziedziczenie wagi" z
  przyciskiem „Dociągnij wagę", toast z wynikiem, unieważnienie `/api/products` po sukcesie.
- Testy: `test/maintenance.test.ts` (+4 backend: auth, uzupełnienie, pominięcie chronione
  override'em, audyt), `test/konfiguracja.admin.test.tsx` (+3 frontend: wywołanie bez
  potwierdzenia + toast, unieważnienie zapytań, błąd z backendu).

## Deviations from plan

Brak formalnego `plan.md` — ticket ustalony bezpośrednio w rozmowie z użytkowniczką (lokalizacja
przycisku potwierdzona jawnie: zakładka „Katalog", sekcja obok istniejących akcji katalogu).
Zakres zrealizowany zgodnie z ustaleniami.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** N/D w sensie odtwarzania produkcji — nowy endpoint,
  fixture ręcznie napisany (jak `usun-nieopony`). `contract/openapi.yaml` przebudowany
  generatorem (`node tools/generate-openapi-schemas.cjs`), `kontrakt.spojnosc.test.ts` zielony.
- Backend: `npm run lint && npm run typecheck && npm run build && npm test` —
  **1876/1876 zielone** (0 regresji, +4 nowe testy).
- Frontend: `npm run lint && npm run typecheck && npm run build && npm test` —
  **1001/1001 zielone** (0 regresji, +3 nowe testy).

## Review fixes applied

Reviewer: 0 BLOCKER / 1 SHOULD-FIX / 2 NICE-TO-HAVE.

- **SHOULD-FIX (naprawione):** `dziedziczWage()` szedł przez ogólny `zadanie()`/`rzucGdyBlad()`,
  który przy błędzie skleja komunikat ze statusem i surowym JSON-em ciała (`"500: {"error":...}"`),
  zamiast czytelnego tekstu. Zmieniono na ten sam wzorzec co `wyczyscKatalog()` w tym samym
  pliku — bezpośredni `fetch` + wyciągnięcie pola `error` z ciała odpowiedzi. Dopisany test
  sprawdza, że toast pokazuje wyciągnięty komunikat, nie surowy status+JSON.
- **NICE-TO-HAVE (świadomie pozostawione):** guard `if (!sqlite)` w trasie wygląda na martwy kod
  w praktyce (serwer zawsze przekazuje realny `sqlite`) — zostawiony jako defensywny fallback,
  spójny z typem `sqlite?: BazaSqlite` w `ZaleznosciUtrzymania`, nietestowany celowo.
- **NICE-TO-HAVE (świadomie pozostawione):** brak osobnego testu na toast z licznikami = 0 —
  ryzyko marginalne (sam format stringa jest identyczny niezależnie od wartości liczb).

## Breaking changes

Brak. Nowy endpoint, nowa sekcja UI — nic istniejącego nie zmienia zachowania.

## Follow-up

Brak nowych — follow-upy z ticketu 155 (kosmetyka `waga=0` w UI, kwestia wpisania backfillu do
procedury cutoveru) zostają aktualne.
