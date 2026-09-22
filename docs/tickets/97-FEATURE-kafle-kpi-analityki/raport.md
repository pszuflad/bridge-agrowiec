# 97-FEATURE-kafle-kpi-analityki — raport z implementacji

## Podsumowanie
Nagłówek `/analityka` pokazuje cztery kafle z produkcji: Dostawcy, EAN wspólne, Pozycje unikalne
i Snapshoty. Liczy je klient z `filters`, `ean/comparison`, `ean/unique` i `status`, czyli z tras,
które widok i tak pobiera, więc nie dochodzi żadne nowe zapytanie. Odstępstwo O-10a-1 jest zamknięte.
`GET /api/analytics/kpi` zostaje w backendzie i kontrakcie, ale UI już jej nie woła, tak jak produkcyjny frontend.

## Zmiany
- `rebuild/frontend/src/pages/analityka/NaglowekKpi.tsx`: nowe kafle, czysta funkcja `wartosciKafli()`
  z semantyką pustych stanów 1:1 z oryginałem (D3/D4), nowe testId `kpi-dostawcy`, `kpi-ean-wspolne`,
  `kpi-pozycje-unikalne`, `kpi-snapshoty`. Komentarz nagłówkowy: O-10a-1 zamknięte, pułapka `LIMIT 1000`.
- `rebuild/frontend/src/pages/Analityka.tsx`: podpięcie nagłówka pod `filtry`, `status`,
  `porownanieEan.data`, `unikalneEan.data`, usunięte `useKpi()`, zaktualizowany komentarz modułu.
- `rebuild/frontend/src/pages/analityka/api.ts`: usunięty `useKpi()`. Typ `Kpi` zostaje dla loadera fixture.
- `rebuild/frontend/src/pages/analityka/README.md`: O-10a-1 oznaczone jako zamknięte.
- `rebuild/frontend/test/analityka.test.tsx` §2: testy kafli (kolejność i etykiety; liczby z danych,
  inne dla każdego kafla; puste odpowiedzi; brak `/kpi` i dokładnie jedno wywołanie każdej z czterech tras,
  także po przejściu na zakładkę EAN). Handler `/kpi` zdjęty z `zamockujApi`.
- **Nowy:** `rebuild/frontend/test/analityka.naglowek-kpi.test.ts`: testy jednostkowe `wartosciKafli()`
  dla `undefined`, `null`, odpowiedzi bez `rows` i liczb surowych.

## Odstępstwa od planu
Brak.

## Wyniki testów
- **Gate odbudowy:** N/D dla backendu, bo backend i `contract/` są bez zmian
  (`git diff origin/develop -- rebuild/backend contract` jest pusty). Frontend testowany na
  `contract/fixtures/GET_analytics_{filters,status,ean_comparison,ean_unique}.json` przez `test/msw/kontrakt.ts`.
- Frontend: lint ✓, typecheck ✓, build ✓, vitest: 53 pliki i 911 testów ✓.
- Test na dublowanie zapytań sprawdzony mutacją: drugie zapytanie o `ean/unique` z innym `queryKey`
  wywala go (`"ean/unique": 2`).

## Zmiany łamiące
Brak. `useKpi()` nie miał innych konsumentów.

## Follow-up
- Handlery `/api/analytics/kpi` zostały w `analityka.{ceny,dostawcy,ean,dostepnosc,eksport}.test.tsx`.
  Są nieużywane, ale nieszkodliwe. `eksport.test` leży w obszarze P10.3, więc sprzątanie zostawiam na później.
- `rebuild/frontend/src/pages/pulpit/KafelKpi.tsx:8` wspomina O-10a-1 jako żywe. Pulpit należy do P10.2,
  więc sprawa idzie przez „Do koordynatora”.
- `docs/instrukcja-testow-I10.md:171,472` opisuje stare kafle. Na to jest wejście dla P10.4.

## Poprawki po review
- Zgłoszony BLOCKER (karta PR.2 i wejścia) należał do fazy dokumentacji i jest zrobiony niżej.
- SHOULD-FIX: odhaczone punkty DoD w `plan.md`. NICE-TO-HAVE: zawinięta za długa linia testu.

## Aktualizacje dokumentacji
- `docs/karty/PR.2/karta.md`: stan ✅ 2026-09-22, uzupełnione „Dowiezione” i „Do koordynatora”
  (roadmapa :1424/:1632, `pulpit/KafelKpi.tsx:8`, pusta odpowiedź Ani na 12.3, nieużywane handlery `/kpi`).
  Założenie „do potwierdzenia” zastąpione rozstrzygnięciem.
- **Nowy** `docs/karty/PR.6/wejscie-97.md`: stan dla §8 przeglądu 12 widoków.
- **Nowy** `docs/karty/P10.4/wejscie-97.md`: delta „Zgłosiłaś → Jest teraz → Sprawdź” do `instrukcja-testow-I10.md:171,472`.
- `docs/spec-frontend.md` (§10a, §10c) i `docs/analityka-bloki-10b-10f.md` (§5, §8.2): O-10a-1 poprawione
  w miejscu na „zamknięte ticketem 97”.
- `docs/rebuild-backlog.md`: bez zmian, żaden wpis nie dotyczy kafli nagłówka.
- Problemy zastane: roadmapa :1424/:1632 (dla koordynatora) i `pulpit/KafelKpi.tsx:8` (dla P10.2).
