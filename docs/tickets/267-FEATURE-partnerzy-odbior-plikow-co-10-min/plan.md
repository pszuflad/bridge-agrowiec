# 267 — odbiór zamówień partnerów z plików co 10 minut

Dawna integracja co 10 min sprawdzała serwer FTP i brała nowe zamówienia. Decyzja 2026-10-14: odtwarzamy.

- `odbior-plikow.ts`: pliki XML starsze niż 30 dni (`MAKS_WIEK_PLIKU_MS`) są pomijane i zostają w `orders` — stary `2022-101179569.xml` nie wpada jako nowe zamówienie.
- Krok wdrożenia `2026-10-14-partnerzy-odbior-plikow-wlaczony` (tylko produkcja, wymaga `PARTNERZY_KATALOGI_ZAMOWIEN`): `PARTNERZY_ODBIOR_PLIKOW=true`, `PARTNERZY_ODBIOR_PLIKOW_MINUTY=10`. Działa po restarcie backendu w tym samym wdrożeniu.
- Uwaga: dopóki działa stara integracja v2, oba systemy mogą pobierać te same pliki — Bridge przenosi odebrane do `done/`.
