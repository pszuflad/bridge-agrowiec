# PARTNERZY — decyzje czekające na konsultację z Martą (poniedziałek 2026-10-12)

> Notatka robocza (ustalenie 2026-10-10). Gdy użytkownik napisze odpowiedzi Marty — wrócić z tymi pytaniami do ticketu PRT-1.2 i go zaplanować.

## Numer katalogowy `KK PP NNNNN` (PRT-1.2)
Miejsce w modelu zostawione, kolumny w `products` jeszcze NIE ma. Do rozstrzygnięcia:
1. Kto jest właścicielem generatora numerów (Bridge czy Optima) i czy Optima/Selly przyjmują nasz numer jako numer katalogowy?
2. Słownik kategorii (01 rolnicze, 02 leśne, 03 przemysłowe, 04 ciężarowe) — czy kategoria `05` (5 pozycji w plikach wzorcowych) ma wejść do listy?
3. Słownik producentów 01–63: marki z wieloma kodami (Gri pod 24, Alliance 01 i 94, Michelin 36 i 37, Ceat 10/11/12) i Deli 67 (>63) — jak je mapować?
4. 548 istniejących numerów 10-cyfrowych (głównie Gri) — zostawiamy bez zmian czy przenumerowujemy?
5. Reguła „stary numer przy pozycji z najniższą ceną, pozostałe magazyny dostają nowe" — potwierdzić na przykładach z danych Adtyres (ok. 630 wierszy współdzieli numer).
6. Backfill jako krok wdrożenia po jawnej zgodzie użytkownika (numery wychodzą poza Bridge).

## Zależy od numeru katalogowego
PRT-7.4 (walidacja `CODE` zamówienia = numer katalogowy) i PRT-3.1 (selekcja wymaga unikalnych numerów).

## Rozbieżność do rozstrzygnięcia
Gałąź `claude/prt-9-1-krok-partnerzy` (ticket 226) zakłada partnerów startowych krokiem wdrożenia. Użytkownik 2026-10-10: „partnerów wrzucimy, gdy będą gotowe parametry" — krok 226 nie powinien się zmergować przed tym.
