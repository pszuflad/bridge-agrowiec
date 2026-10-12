# 238 — PARTNERZY: publikacja cenników do katalogów partnerów + włączenie harmonogramu 60 min

Odczyt serwera 2026-10-12: katalogi partnerów leżą na tym samym VPS co Bridge, `bridge-backend-prod` działa jako `admin` z zapisem do nich (też `bridge-backend-staging` — ten sam użytkownik!).

Zakres:
1. Po wygenerowaniu pliki trafiają kopią (tmp + rename) do katalogu partnera z `PARTNERZY_KATALOGI_PUBLIKACJI` (`Nazwa=/ścieżka;…`). Brak zmiennej = brak publikacji (więc środowisko testowe nie pisze do katalogów partnerów). Błędna wartość loguje błąd i nie przewraca backendu. Błędy publikacji trafiają do logu partnera.
2. (NIE w tym PR — zablokowane przez kontrolę uprawnień sesji, czeka na regułę/zgodę użytkowniczki) Krok wdrożenia `2026-10-12-partnerzy-publikacja-harmonogram-60` (tylko produkcja): `.env` → `PARTNERZY_SCHEDULER=true`, `PARTNERZY_KATALOGI_PUBLIKACJI="Adtyres=…;TyreWorld=…"`; partnerom bez harmonogramu `harmonogram_minuty=60`.

Bezpieczeństwo: ceny wychodzą dopiero po ustawieniu narzutu > 0 dla kraju (blokada z ticketu 235). Do tego czasu harmonogram nic nie publikuje.

Poza zakresem: archiwum zostaje w katalogu Bridge (nie ruszamy istniejącego `archiwum/` partnerów); import zamówień z `customer/orders`, tracking, Selly — kolejne tickety.
