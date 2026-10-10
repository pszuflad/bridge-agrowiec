# 211 — parser pól obliczeniowych partnerów (PRT-2.3)

Karta: `docs/karty/PARTNERZY/` · poziom 2.

## Zakres
`src/partnerzy/formula.ts`: `parsujFormule`, `zmienneWFormule`, `sprawdzFormule` (walidacja przy zapisie: składnia + znane zmienne),
`obliczFormule`, `zaokraglij`. Własny parser rekurencyjny — **bez `eval`/`Function`**.

## Decyzje
- **Brak reuse** `src/waga-gabarytowa/formula.ts`: to port stałej formuły paletowej z produkcji, nie parser wyrażeń.
- Składnia: liczby z kropką, zmienne (też polskie litery), `+ - * /`, minus jednoargumentowy, nawiasy, funkcje `zaokr(x, n)`, `min`, `max`, `abs`. Przecinek rozdziela argumenty, więc `1,5` jest błędem.
- Brak wartości zmiennej, dzielenie przez zero i wynik nieskończony/NaN to **błąd** (nigdy 0) — pozycję pomija i loguje kalkulator (PRT-2.4).
- Parser nie zna zbioru zmiennych; przekazuje go wywołujący (zmienne katalogu i partnera/kraju ustali PRT-2.4).
- Limity: 2000 znaków, głębokość zagnieżdżenia 50.

## Zmiana zachowania produkcji
Brak — nowy moduł, nikt go jeszcze nie woła. Bez migracji i zmian API.

## Testy
`test/partnerzy.formula.test.ts` — priorytety, przykład z karty, funkcje, zaokrąglanie (1,005 → 1,01), błędy z pozycją, odporność na złośliwe wejścia, limity.
