# 84-FEATURE-usun-wybranego-przewoznika — mocniejsze potwierdzenie usunięcia wybranego przewoźnika (P9.1b)

> Status: Draft
> Branch: `feature/84-usun-wybranego-przewoznika`
> Worktree: `.worktrees/84-FEATURE-usun-wybranego-przewoznika`

## Ticket description
P9.1b, Iteracja 9, domknięcie §3.11 z PDF-u instrukcji I9. Ania napisała: „Tak, powinno być
potwierdzenie przed usunięciem przewoźnika, szczególnie gdy jest aktualnie wybrany. Dobrze, że
system nie pozwala usunąć ostatniego przewoźnika.” P9.1 (ticket 76) dowiozła jedno okno dla
każdego przewoźnika. Okno nie odróżnia wybranego, a `usun()` po cichu przenosi wybór na
`pozostali[0]`. Przez to kalkulator zmienia dzielnik, a użytkownik nie dostaje o tym żadnej
informacji. Plan 76 tego nie rozważał. To przeoczenie, nie decyzja.

## Context
- `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx`:
  - `zapytajOUsuniecie` blokuje usunięcie ostatniego przewoźnika (toast, bez okna);
  - `usun()` przenosi wybór na `pozostali[0]` (oryginał `:26881-26885`);
  - `DialogPotwierdzenia` z `testId="dialog-usun-przewoznika"` jest jednym oknem dla wszystkich
    przewoźników.
- `wybrany` jest stanem osobistym przeglądarki (IndexedDB `KLUCZ_WYBRANY`, założenie A karty 76).
  Tabela dostaje go już w propsach.
- `DialogPotwierdzenia` przyjmuje `children`, czyli treść nad przyciskami. Wzór ostrzeżenia
  (`TriangleAlert`, bursztyn) jest już na Pulpicie.
- D3 z karty 76: gdy wybranego przewoźnika usunie ktoś inny, wybór przechodzi na pierwszego
  z listy. Następca `pozostali[0]` jest z tym spójny.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
Brak, bo ticket nie dotyka kontraktu. Zmienia się tylko prezentacja okna potwierdzenia we
frontendzie. `PUT /api/waga-gabarytowa/przewoznicy` dostaje tę samą listę co dotąd. Backend,
schemat i `contract/` bez zmian. Gate kontraktu: N/D.

## Decisions (Q&A 2026-09-21, wszystkie zgodne z rekomendacją)
- **Q1. Treść.** Tytuł „Usunąć wybranego przewoźnika?”. Opis: „Przewoźnik „X” jest teraz wybrany
  w Twoim kalkulatorze. Lista jest wspólna — zmiana obowiązuje wszystkich użytkowników.” Ramka:
  „Po usunięciu kalkulator przełączy się na „Y” i przeliczy wynik jego dzielnikiem.” Przycisk
  „Usuń przewoźnika”.
  Doprecyzowanie redakcyjne względem propozycji: zamiast „innym dzielnikiem” jest „jego
  dzielnikiem”, bo następca może mieć ten sam dzielnik. Wtedy „innym” byłoby nieprawdą.
- **Q2. Wyróżnienie:** tekst plus bursztynowa ramka z ikoną `TriangleAlert`, przekazana przez
  `children`. Bez dodatkowego kroku (checkboxa).
- **Q3. Następca:** bez zmian, pierwszy z pozostałych. Rozjazd z „Przywróć domyślne” (→ GEIS)
  zostaje świadomie: tam lista i tak zaczyna się od GEIS.
- **Q4. Inni użytkownicy:** okno nic o nich nie mówi. Zdanie o wspólnej liście wystarcza.
- Zwykłe okno (niewybrany przewoźnik) zostaje znak w znak bez zmian.
- Odstępstwo od oryginału: w oryginale usunięcie działa od razu, bez okna. To odstępstwo przyjęła
  już karta 76 (backlog #27 ✅). Ta karta tylko je rozwija.

## Implementation plan
1. `TabelaPrzewoznikow.tsx`:
   - funkcja `nastepcaPo(przewoznicy, id)`, czyli pierwszy przewoźnik inny niż usuwany. Używają
     jej zarówno okno (nazwa następcy), jak i `usun()`, żeby oba miejsca liczyły to samo;
   - w miejscu okna usunięcia, gdy `doUsuniecia.id === wybrany` i następca istnieje, pokazuje się
     wariant mocny: `testId="dialog-usun-wybranego-przewoznika"` z ramką w `children`
     (`data-testid="text-ostrzezenie-wybrany"`). W pozostałych przypadkach zostaje dotychczasowe
     okno;
   - aktualizacja nagłówkowego komentarza o odstępstwach.
2. `rebuild/frontend/test/waga-gabarytowa.test.tsx`:
   - usunięcie niewybranego: tytuł, treść i przycisk znak w znak, bez ramki;
   - usunięcie wybranego: okno mocne z nazwami X i Y, zwykłego okna brak;
   - anulowanie mocnego okna: lista, wybór i zapisy bez zmian;
   - potwierdzenie: PUT bez usuniętego i wybór na następcę, z przeliczonym wynikiem (rozszerzony
     dotychczasowy test);
   - następca to pierwszy z pozostałych również wtedy, gdy wybrany nie jest pierwszy na liście
     (np. wybrany DPD → następca GEIS);
   - ostatni przewoźnik: bez zmian (toast, żadne z dwóch okien się nie pokazuje).
3. Docs: `docs/rebuild-roadmap.md` (wiersz P9.1b, P9.2 status i treść akapitu),
   `docs/rebuild-backlog.md` #27, `docs/spec-frontend.md` §5 „Odbudowa (76)”.

## Testing strategy
Testy RTL + MSW w istniejącym pliku. Bramki w `rebuild/frontend`: lint, typecheck, build, test.
Gate kontraktu: N/D.

## Out of scope
- Backend, schemat, `contract/`, `WagaGabarytowa.tsx`.
- Zachowanie po błędzie zapisu (wybór przenosi się przed odpowiedzią serwera, tak jak w 76). Trafia
  do follow-up, jeśli się potwierdzi.

## Definition of done
- [ ] Usunięcie wybranego przewoźnika pokazuje mocne okno z nazwą następcy i ramką ostrzeżenia.
- [ ] Usunięcie niewybranego pokazuje dotychczasowe okno, znak w znak.
- [ ] Anulowanie niczego nie zmienia, a potwierdzenie zapisuje listę i przenosi wybór na następcę.
- [ ] Blokada ostatniego przewoźnika bez zmian.
- [ ] lint, typecheck, build i test zielone; docs zaktualizowane.
