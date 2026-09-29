## Ticket
155-FEATURE-dziedziczenie-wagi-po-rozmiarze — dziedziczenie wagi po marce+rozmiarze+bieżniku

## Summary
Dodano nowy mechanizm dziedziczenia wagi produktu po marce+rozmiarze+bieżniku (NOWA logika
biznesowa, nie odtworzenie produkcji). Gdy nowy produkt (import albo ręczne dodanie z UI)
trafia bez wagi albo z wagą `0`, a w bazie jest już inny pasujący produkt z wypełnioną wagą,
nowy produkt dziedziczy najwyższą wagę spośród pasujących kandydatów. Dodano też skrypt CLI do
wstecznego dociągnięcia wagi dla produktów już w katalogu oraz tooltip w UI.

## Problem / Motivation
Część katalogu ma puste pole wagi, mimo że inne produkty tej samej marki/rozmiaru/bieżnika już
je mają — waga jest potrzebna do liczenia kosztów wysyłki i nie powinna nigdy wynosić `0`.
Użytkowniczka (Ania) chciała automatycznego uzupełniania na bieżąco (import + ręczne dodanie)
oraz jednorazowego dociągnięcia dla istniejących braków, z widoczną w UI adnotacją.

## Solution
- Nowy moduł `src/import/dziedziczenieWagi.ts` — dopasowanie po marka + znormalizowany rozmiar
  (szerokość/profil/średnica/konstrukcja) + bieżnik (tolerancyjny, gdy dane brakuje po
  którejkolwiek stronie), wybór NAJWYŻSZEJ wagi wśród kandydatów.
- Wpięcie w `akceptacja.ts`/`bulk.ts` TUŻ PO istniejącym porcie `applyWagaPamiec` — priorytet
  pamięci wagi/ręcznej edycji wynika z kolejności wywołań, bez dodatkowej logiki.
- Nowa kolumna `products.waga_auto_uzupelniona` (migracja `014`), resetowana na `false` przy
  ręcznej edycji pola `waga`.
- Skrypt CLI `npm run dziedzicz-wage` — wsteczne dociągnięcie dla istniejących braków, pomija
  produkty chronione ręczną poprawką (`manual_overrides`).
- Rozszerzenie kontraktu OpenAPI + fixtures o pole `wagaAutoUzupelniona`.
- Frontend: tooltip/ikona przy wadze uzupełnionej automatycznie (bez stałego Badge).

## Design decisions
- Klucz dopasowania: marka + rozmiar (znormalizowany) + bieżnik — bieżnik tolerancyjny, gdy
  dane brakuje, żeby nie tracić trafień tam, gdzie dane są niekompletne, ale różny WYPEŁNIONY
  bieżnik wyklucza dopasowanie (różne bieżniki bywają różne wagowo).
- Przy rozjeździe danych: bierzemy NAJWYŻSZĄ wagę spośród kandydatów.
- Waga `0` traktowana zawsze jak pusta — nigdy nie zostaje zapisana.
- `waga_pamiec` (port) i ręczna edycja mają pierwszeństwo przed dziedziczeniem.
- Backfill: ręcznie odpalany skrypt (nie przy starcie serwera) + logika w imporcie działająca
  trwale na przyszłość.
- Nowa kolumna nullable (nie `NOT NULL`), żeby nie wywrócić istniejącego harnessu
  charakteryzacyjnego, który wstawia produkty testowe raw SQL-em z jawnym `NULL`.

## Tests
- Gate odbudowy (fixtures/kontrakt): ✓ zgodne — rozszerzenie kontraktu, fixtures zaktualizowane,
  `contract/openapi.yaml` przebudowany generatorem z fixtures.
- Backend: `npm run lint && npm run typecheck && npm run build && npm test` — 1872/1872 zielone.
- Frontend: `npm run lint && npm run typecheck && npm run build && npm test` — 998/998 zielone.
- Skrypt backfill zweryfikowany ręcznie na tymczasowej bazie.

## Breaking changes
None.

## Follow-up
- Skrypt `dziedzicz-wage` nie jest uruchamiany automatycznie — użytkowniczka odpala go ręcznie,
  kiedy zechce dociągnąć wagi wstecznie (rozważyć wpisanie do procedury cutoveru).
- Kosmetyka UI: `waga === 0` w tabeli katalogu nadal renderuje się jako „0", nie jako kreska
  (backend nigdy nie zapisuje `0`, więc dotyczy tylko starych danych sprzed backfillu).

## Review
<details>
<summary>Code review</summary>

0 BLOCKER / 2 SHOULD-FIX (oba naprawione — dodano test priorytetu `waga_pamiec`, backfill
opakowany w transakcję) / 3 NICE-TO-HAVE (świadomie odłożone, opisane w raporcie).
Pełna treść: `docs/tickets/155-FEATURE-dziedziczenie-wagi-po-rozmiarze/review.md`.

</details>

---
Ticket docs: `docs/tickets/155-FEATURE-dziedziczenie-wagi-po-rozmiarze/`
Zsynchronizowane z `develop` (gałąź utworzona z aktualnego `origin/develop`, `tools/sync-z-develop.sh` potwierdził brak rozjazdu tuż przed pushem); bramki zielone.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_011c43M9EaKacPhHiN8RSDpT
