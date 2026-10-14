# 271 — publikacja cenników partnerów na serwer (aktualne pliki dla TyreWorld i Adtyres)

Pliki cenników partnerów na serwerze są stare (ostatnia aktualizacja 2026-10-06, stary system wyłączony). Bridge ma generator i publikację (238), ale nie ma włączonego harmonogramu ani mapowania katalogów publikacji na produkcji.

- Sekret GitHub `PARTNERZY_KATALOGI_PUBLIKACJI` (`Nazwa=/ścieżka;…`, katalogi kont FTP partnerów z plikami CSV; ścieżki nie w repozytorium) → trzecia linia stdin skryptu wdrożenia → `.env` (`tools/przyjmij-sekret.sh`, `deploy-produkcja.yml`, jak 264/265). Działa od drugiego wdrożenia po merge'u.
- Krok wdrożenia `2026-10-14-partnerzy-publikacja-wlaczona` (tylko produkcja, wymaga `PARTNERZY_KATALOGI_PUBLIKACJI`): sprawdza, że katalogi istnieją, ustawia `PARTNERZY_SCHEDULER=true` i `harmonogram_minuty=60` partnerom bez harmonogramu (Adtyres ma 60 z panelu).
- Bezpieczeństwo: ceny wychodzą tylko dla krajów z narzutem > 0 (blokada z 235; narzuty ustawione w 258); przesyłka tylko z tabel GEIS (259).
- Nie dotyczy nazw produktów.
