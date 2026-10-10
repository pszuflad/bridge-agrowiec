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

## Hasła i skrzynki partnerów (zapis 2026-10-10, do decyzji w poniedziałek z Martą)
Kontekst: odbiór zamówień przez e-mail (ticket 229, PR #346) jest gotowy w kodzie, ale **wyłączony i nieprzetestowany na prawdziwym serwerze IMAP**. Hasła nie mogą trafić do repozytorium (jest publiczne) —
wpisuje się je raz do `.env` na serwerze. Do ustalenia:
1. **Gdzie stoją skrzynki partnerów** — na naszym serwerze pocztowym czy zewnętrznym? Od tego zależy wartość `PARTNERZY_IMAP_HOST` (jeden host dla wszystkich partnerów) i port (domyślnie 993/TLS).
2. **Kto zakłada skrzynki** (po jednej na partnera, np. zamowienia-tyreworld@…) i kto zna hasła.
3. **Kto i jak wpisuje hasła do `.env` na serwerze** — zmienne `PARTNERZY_IMAP_HASLO_<id partnera>` (id widać w panelu / w adresie `/partnerzy/<id>`). Wzór procesu jak przy `HASLO_TYMCZASOWE`: wpis ręczny raz, poza repo; sesja nie ma dostępu do serwera.
4. **Rotacja haseł** — jak często i kto zmienia; po zmianie trzeba poprawić `.env` i zrestartować backend.
5. **Skrzynka testowa** na środowisku testowym (`training.agroopony.eu`) do pierwszego prawdziwego odbioru — bez niej połączenia IMAP nie da się sprawdzić.
6. **Konta FTP partnerów** (PRT-6.1) — to samo pytanie: kto zakłada konta, jak przekazujemy hasła partnerom (nie mailem w treści?), gdzie je trzymamy po stronie Bridge. Kroki wdrożenia nie wpisują haseł do repo; krok zależny od sekretu pomija się, gdy sekretu brak.
7. **Czy włączyć odbiór e-mail już na produkcji**, czy najpierw tylko FTP (wtedy `PARTNERZY_ODBIOR_EMAIL` zostaje wyłączone).

## Zależy od numeru katalogowego
PRT-7.4 (walidacja `CODE` zamówienia = numer katalogowy) i PRT-3.1 (selekcja wymaga unikalnych numerów).

## Rozbieżność do rozstrzygnięcia
Gałąź `claude/prt-9-1-krok-partnerzy` (ticket 226) zakłada partnerów startowych krokiem wdrożenia. Użytkownik 2026-10-10: „partnerów wrzucimy, gdy będą gotowe parametry" — krok 226 nie powinien się zmergować przed tym.
