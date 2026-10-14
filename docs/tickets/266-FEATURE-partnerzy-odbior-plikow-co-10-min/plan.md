# 266 — włączenie odbioru zamówień partnerów z plików (co 10 min)

Decyzja 2026-10-14: nowe zamówienia partnerów wpadają na FTP (`orders`), Bridge ma je odbierać sam. Waluta (EUR + kurs) i e-mail zamawiającego bez zmian.

- `odbior-plikow.ts`: pliki XML starsze niż 30 dni (`MAKS_WIEK_PLIKU_MS`) są pomijane i zostają w `orders` — stare zamówienia (np. `2022-…xml`) nie wpadają jako nowe.
- Krok wdrożenia `2026-10-14-partnerzy-odbior-plikow-wlaczony` (tylko produkcja, wymaga `PARTNERZY_KATALOGI_ZAMOWIEN`): `PARTNERZY_ODBIOR_PLIKOW=true`, `PARTNERZY_ODBIOR_PLIKOW_MINUTY=10`.
- Nie dotyczy nazw produktów.
