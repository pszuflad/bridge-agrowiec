# Wpis 211 — parser pól obliczeniowych partnerów

Ticket `211-FEATURE-partnerzy-parser-formul` (PRT-2.3). `src/partnerzy/formula.ts`: bezpieczny parser/ewaluator wyrażeń (bez `eval`),
operatory `+ - * /`, nawiasy, funkcje `zaokr/min/max/abs`, zmienne dostarczane przez wywołującego. Błąd składni niesie pozycję znaku;
brak zmiennej, dzielenie przez zero i wynik nieskończony zgłaszają `BladFormuly` (nigdy 0). `sprawdzFormule` służy do walidacji przy zapisie
(składnia + znane zmienne). Konsumentem będzie kalkulator ceny (PRT-2.4) i panel (PRT-5.3).
