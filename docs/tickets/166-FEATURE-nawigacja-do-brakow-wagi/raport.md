# 166-FEATURE-nawigacja-do-brakow-wagi — raport implementacji

## Ticket description

Po uruchomieniu „Dociągnij wagę" (ticket 156) użytkowniczka widziała tylko liczby w toaście —
nie miała sposobu, żeby zobaczyć KTÓRE konkretnie produkty zostały bez wagi (bo w katalogu nie
znalazł się żaden pasujący „bliźniak" tej samej marki/rozmiaru/bieżnika). Prośba wprost z czatu:
możliwość przejścia do tych produktów, żeby uzupełnić je ręcznie (np. z internetu/kart
katalogowych producentów). Docelowo: każde kolejne dociągnięcie będzie pełniejsze, bo raz ręcznie
uzupełniony produkt staje się kandydatem-źródłem dla innych tej samej marki/rozmiaru/bieżnika.

## Summary

Dodano nowy filtr statusu „Brak wagi" w widoku `/katalog` (puste albo zerowe `waga`, ten sam próg
co backendowe `jestPustaWaga()`) oraz deep link `?status=brak_waga`, który go od razu stosuje.
Wynik „Dociągnij wagę" (Konfiguracja → Katalog) pokazuje teraz TRWAŁY (nie tylko w znikającym
toaście) komunikat z linkiem „zobacz je w katalogu" — widoczny tylko, gdy po operacji coś
zostało bez wagi.

## Changes

- `rebuild/frontend/src/pages/katalog/filtrowanie.ts` — nowa opcja `TrybStatusu = "brak_waga"`
  + logika w `filtrujStatus()` (NOWA, nie port — reszta funkcji jest portem `frontend-index.js:23306`).
- `rebuild/frontend/src/pages/Katalog.tsx` — nowa pozycja w dropdownie statusu; stan `status`
  inicjalizowany z `?status=` w URL-u (wouter `useSearch()`), jeśli wartość jest znanym trybem.
- `rebuild/frontend/src/pages/konfiguracja/Katalog.tsx` — wynik `dziedziczWage()` trzymany w
  stanie (nie tylko przekazywany do toastu); pod przyciskiem trwały komunikat z linkiem
  `/katalog?status=brak_waga` (wouter `Link`), widoczny tylko gdy `zaktualizowano <
  wszystkichKandydatow`.
- Testy: `test/katalog.filtrowanie.test.ts` (+1), `test/katalog.test.tsx` (+1: deep link
  ustawia filtr), `test/konfiguracja.admin.test.tsx` (+1 rozszerzony test o asercję linku,
  +1 nowy: link znika, gdy wszystko zaktualizowane).

## Test results

- Frontend: `npm run lint && npm run typecheck && npm run build && npm test` —
  **1004/1004 zielone** (0 regresji, +3 nowe testy netto).
- Backend: nietknięty tym ticketem, bramki nie uruchamiane ponownie.

## Breaking changes

Brak. Nowa opcja filtra i nowy link — nic istniejącego nie zmienia zachowania.

## Follow-up

- Samo ręczne uzupełnianie wagi (skąd Ania weźmie liczby — internet, karty katalogowe) zostaje
  poza zakresem tego ticketu, zgodnie z tym, co powiedziała: „trzeba uzupełnić te wagi z
  internetu lub innych źródeł [...] ręcznie" — to praca redakcyjna, nie kod.
- Nie zaimplementowano automatycznego przelicznika/szacowania wagi dla przypadków bez
  pasującego produktu (np. na podstawie samego rozmiaru, bez marki) — to byłoby ODSTĘPSTWO
  od decyzji 1 z ticketu 155 (klucz dopasowania = marka+rozmiar+bieżnik) i wymagałoby osobnej
  decyzji użytkowniczki o akceptowalnej niedokładności.
