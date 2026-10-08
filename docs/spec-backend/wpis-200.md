# Wpis do spec-backend od ticketu 200 (włączenie Toru 2 i Toru 3 krokiem wdrożenia) · 2026-10-08

- Decyzja użytkownika (2026-10-08): uruchomić Tor 2 (pełna synchronizacja 04:30) i Tor 3 (usuwanie sierot z Selly) na produkcji.
- Krok wdrożenia `2026-10-08-selly-tor2-tor3-wlaczone` (`kroki/rejestr.ts`, `kroki/env-plik.ts`) ustawia w `$PROD_ROOT/.env` `SELLY_TOR2=true` i
  `SELLY_USUWANIE=true` (istniejące wpisy zmienia, brakujące dopisuje; pozostałe linie, w tym sekrety, zostają bez zmian; w logu tylko te dwa klucze).
  Krok biegnie RAZ — późniejsze ręczne wyłączenie flagi w `.env` nie jest cofane przy kolejnych wdrożeniach.
- ⚠ `deploy-produkcja.sh` czyta `.env` PRZED krokami i startuje PM2 z tym środowiskiem, więc zmiana działa dopiero od **następnego** wdrożenia
  (każdy commit na `main` ruszający ścieżki wdrożenia) albo ręcznego `pm2 restart` po zapisie `.env`.
- Zabezpieczenia Toru 3 bez zmian: 20 usunięć/przebieg, 200/dobę, wstrzymanie przy >30% sierot lub pustym katalogu; status: karta „Usuwanie z Selly".
- Otwarte ryzyko Toru 2: nie zweryfikowano, czy Selly przyjmie cechy CFO/NRO/CHO (#199); pierwszy przebieg o 04:30 jest de facto dry-runem na żywo.
