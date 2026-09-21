# 84-FEATURE-usun-wybranego-przewoznika — Implementation report

## Summary
Usunięcie przewoźnika, który jest aktualnie wybrany w tej przeglądarce, pokazuje teraz mocniejsze
okno potwierdzenia. Okno ma własny tytuł, mówi, że przewoźnik jest wybrany w kalkulatorze, i ma
bursztynową ramkę ostrzeżenia z nazwą następcy, na którego przełączy się kalkulator. Usunięcie
każdego innego przewoźnika pokazuje dotychczasowe okno, znak w znak. To domyka §3.11 z uwag Ani.

## Changes
- `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx`:
  - funkcja `nastepcaPo()`, wspólne źródło nazwy następcy dla okna i dla `usun()`;
  - drugi wariant `DialogPotwierdzenia` (`dialog-usun-wybranego-przewoznika`) z ramką
    `text-ostrzezenie-wybrany` (`TriangleAlert`, ten sam styl bursztynu co ramka na tym ekranie);
  - zaktualizowany komentarz o odstępstwach.
- `rebuild/frontend/test/waga-gabarytowa.test.tsx`:
  - zwykłe okno sprawdzane znak w znak (tytuł, treść, przycisk, brak ramki);
  - test usunięcia wybranego sprawdza mocne okno, PUT i zapamiętany wybór;
  - nowe testy: następca, gdy wybrany nie stoi na początku listy, oraz anulowanie mocnego okna;
  - blokada ostatniego przewoźnika sprawdza, że żadne z dwóch okien się nie pokazuje.

## Deviations from plan
Brak. Ramka używa klas `bg-amber-500/10 border-amber-500/20`, czyli tego samego wzoru co ramka
w `WagaGabarytowa.tsx`. Plan wskazywał jako wzór Pulpit; to kwestia wizualna, poza tym zakres bez
zmian.

## Test results
- **Gate odbudowy (fixtures/kontrakt):** N/D. Ticket nie dotyka API: zmienia się tylko okno
  potwierdzenia, a `PUT /api/waga-gabarytowa/przewoznicy` dostaje tę samą listę co dotąd.
  Backend, schemat i `contract/` bez zmian.
- Frontend (`rebuild/frontend`): lint ✓, typecheck ✓, build ✓, test ✓ (49 plików, 846 testów;
  `waga-gabarytowa.test.tsx`: 30, w tym 2 nowe).

## Breaking changes
Brak.

## Follow-up
- **Wybór przenosi się przed odpowiedzią serwera** (zachowanie z karty 76, nie ruszane tutaj).
  Jeśli `PUT` usunięcia wybranego przewoźnika się nie uda, lista wraca z serwera razem z tym
  przewoźnikiem, ale wybór zostaje już na następcy. „Przywróć domyślne” przestawia wybór dopiero po
  udanym zapisie, więc te dwa zachowania są niespójne. Do decyzji, czy wyrównać.
