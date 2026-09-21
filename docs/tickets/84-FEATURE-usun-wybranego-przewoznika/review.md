# 84-FEATURE-usun-wybranego-przewoznika — Code review

> Reviewed: 2026-09-21
> Branch: feature/84-usun-wybranego-przewoznika
> Diff: 4 pliki (2 kodu/testów + plan.md + raport.md), 2 commity

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx:146-148` — `usun()` liczy
  `nastepcaPo(przewoznicy, id)` na nowo z propsa `przewoznicy` w momencie kliknięcia, zamiast
  ponownie użyć już obliczonego `nastepcaWybranego` z renderu okna. W praktyce to ten sam wynik
  (ten sam `przewoznicy` w domknięciu, okno i przycisk renderują się w tym samym cyklu), więc nie
  ma realnego ryzyka rozjazdu — czysto kosmetyczna drobna duplikacja wywołania, może `nastepcaPo`
  policzyć raz i przekazać dalej.
- [ ] `docs/tickets/84-FEATURE-usun-wybranego-przewoznika/raport.md:22-24` — „Deviations from plan”
  zgłasza inne klasy CSS ramki niż wskazane w planie jako wzór (Pulpit) — to nieistotne wizualnie
  i już opisane jako świadome, tylko odnotowuję do wglądu przy aktualizacji docs.

## Plan compliance

### Done ✓
- `nastepcaPo(przewoznicy, id)` jako jedno źródło następcy dla okna i dla `usun()` — logika
  identyczna z poprzednim `pozostali[0]` (potwierdzone diffem względem `origin/develop`), więc
  nie ma regresji w wyborze następcy.
- Wariant mocny (`testId="dialog-usun-wybranego-przewoznika"`) pokazuje się tylko, gdy
  `doUsuniecia.id === wybrany` i następca istnieje; treść tytułu, opisu, ramki ostrzeżenia
  (`text-ostrzezenie-wybrany`, `TriangleAlert`, bursztyn) i przycisku zgodna słowo w słowo z Q1
  planu (sprawdzone znak w znak, w tym poprawka „jego dzielnikiem” zamiast „innym dzielnikiem”).
- Zwykłe okno (`dialog-usun-przewoznika`) pozostało bez zmian — potwierdzone diffem: blok kodu
  dla gałęzi „niewybrany” nie występuje w diffie, czyli jest identyczny z wersją na `develop`.
- Testy pokrywają: zwykłe okno znak w znak + brak ramki, mocne okno ze skasowaniem GEIS (domyślnie
  wybrany, następca DPD), następcę przy wyborze niepierwszego na liście (GLS → GEIS), anulowanie
  mocnego okna (lista/wybór/zapisy bez zmian), blokadę ostatniego przewoźnika (żadne z dwóch okien
  się nie pokazuje). To realnie wyłapałoby regresję — assercje idą po `getByRole("heading")` i
  regexach `^...$`, nie po `toHaveTextContent` z luźnym substringiem, więc np. literówka w treści
  albo brak ramki w niewłaściwej gałęzi zostałyby złapane.
- Komentarz nagłówkowy pliku zaktualizowany o nowe odstępstwo (mocniejsze okno dla wybranego).

### Missing or deviating ✗
- Krok 3 planu („Docs: roadmap, backlog #27, spec-frontend.md §5”) nieukończony — zgodnie z
  poleceniem zadania ma być zrobiony PO review, więc nie traktuję jako brak w tym przeglądzie.

## Definition of done

- [x] Usunięcie wybranego przewoźnika pokazuje mocne okno z nazwą następcy i ramką ostrzeżenia.
- [x] Usunięcie niewybranego pokazuje dotychczasowe okno, znak w znak.
- [x] Anulowanie niczego nie zmienia, a potwierdzenie zapisuje listę i przenosi wybór na następcę.
- [x] Blokada ostatniego przewoźnika bez zmian.
- [x] lint, typecheck, build i test zielone (zweryfikowane ponownie w tym review: lint ✓,
  typecheck ✓, build ✓, `npx vitest run test/waga-gabarytowa.test.tsx` → 30/30 ✓); docs — do
  zrobienia po review (poza zakresem tego przeglądu).

## Parallel-test concerns

None — testy używają MSW (`server.use`), atrapy `magazynKV` w pamięci (`vi.hoisted`/`Map`) i
`beforeEach` czyszczącego stan; brak współdzielonej bazy, portu na sztywno czy pliku tymczasowego.

## Overall assessment

Zmiana jest wąska, dobrze wyizolowana i wierna decyzjom Q1–Q4 z planu — treści okna sprawdzone
znak w znak, `nastepcaPo` eliminuje duplikację logiki następcy między oknem a `usun()`, a zwykłe
okno faktycznie zostało nietknięte. Testy są precyzyjne (regexy `^...$`, `getByRole`) i realnie
złapałyby regresję treści, brakującej ramki albo złego wariantu okna. Nie znalazłem blokerów ani
spraw wymagających poprawki przed mergem — jedyna uwaga to kosmetyczna, nieistotna duplikacja
obliczenia następcy.
