# 236 — PARTNERZY: numer katalogowy `EAN-dostawca`

Decyzja użytkowniczki 2026-10-12 (odp. 23–25): numer katalogowy dla partnerów = `<EAN>-<numer dostawcy>` (np. `745384925-MO4`); schemat KK PP NNNNN i mapowanie producentów nie obowiązują. Format/stare kody — „to już nie jest nasz problem".

Zakres:
1. Pole katalogu `numerPartnera` (EAN + `-` + `products.dostawca`) jako źródło kolumny pliku (CSV); brak EAN lub dostawcy → pozycja pominięta w pliku z tą kolumną + ostrzeżenie w logu (pusty numer to defekt).
2. `znajdzPozycjeKatalogu`: najpierw dokładne `products.kod`, potem `EAN-dostawca` (ostatni `-`, dostawca case-insensitive); wśród wielu pozycji — aktywna z największym stanem.
3. Panel: nowe źródło w wyborze kolumn.

Poza zakresem: XML (kolumna `numerPartnera` daje pustą wartość przy braku EAN — nie pomijamy wierszy), zmiana konfiguracji kolumn istniejących partnerów (kolumnę CatNumber przestawia użytkowniczka w panelu albo krok wdrożenia w osobnym tickecie).
