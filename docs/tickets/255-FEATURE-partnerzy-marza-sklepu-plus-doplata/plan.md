# 255 — PARTNERZY: wariant B (marża sklepu + dopłata kraju), numery VAT Adtyres, zasada „uzupełniaj, co się da”

Decyzje użytkowniczki 2026-10-13:
1. **Wariant B** wyceny: tak jak w starym systemie, „narzut” kraju to DOPŁATA w punktach procentowych DO MARŻY SKLEPU na danym produkcie. Cena partnera = zakup × (1 + marża sklepu + dopłata) / kurs + przesyłka + koszty dodatkowe (np. 6 % + 2 % = 8 % od zakupu). Powód biznesowy: partner nigdy nie kupi taniej niż klient w polskim sklepie.
2. Numery VAT Adtyres wg kraju — pełna lista z szerszego zrzutu (pierwszy był obcięty: LT, NL, SE, ES). Nowy krok wdrożenia `2026-10-13-partnerzy-numery-vat-adtyres` (idempotentny, tylko puste pola).
3. Zasada stała: uzupełniamy to, co da się uzupełnić z dostępnych informacji — zapisana w `CLAUDE.md` (z wyjątkami: dane niepewne → poproś o lepsze źródło, sekrety/dane osobowe nie do repo).

Zmiana zachowania (JAWNA, wariant B): `wycenPozycje` liczy `narzut = marza_pct produktu (products.marza_pct, % narzutu sklepu; brak/ujemna = 0) + dopłata kraju albo reguły`. Reguły narzutów partnera (ticket 247) i pole „Narzut” kraju to od teraz dopłaty — w panelu zmienione etykiety i opisy („Dopłata % (do marży sklepu)”). Zabezpieczenie bez zmian: dopłata 0 (kraju lub braku pasującej reguły) = ceny dla kraju nie są publikowane (inaczej partner dostałby ceny sklepu bez dopłaty; 0 % „świadomie” da się wyrazić najniższą dopłatą, np. 0,01 — do rozważenia, jeśli będzie potrzebne). Zmienna `narzut` w formułach własnych (jeśli ktoś ją ustawił) oznacza teraz sumę marży sklepu i dopłaty.
Wpływ na produkcję: dziś narzuty krajów są 0 %, więc ceny nie są publikowane — zmiana nie przestawia żadnych wysłanych cen. Po ustawieniu dopłat ceny będą wyższe niż przy wariancie A o marżę sklepu.
Do sprawdzenia przy pierwszym wygenerowaniu: że `products.marza_pct` jest wypełnione dla produktów z zasadami marży sklepu (to wartość „narzutu” zapisywana przy imporcie/akceptacji); produkty bez zasady mają dopłatę bez marży.
