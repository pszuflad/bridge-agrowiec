# Wejście dla I15.3 od ticketu 110 (koordynator, triaż 22.09 wieczór) · 2026-09-22

⚠ Produkcja dołożyła 22.09 dwie duże zmiany (backlog **#103** „braki w cenniku / bezpieczeństwo źródła”
i **#104** „dostępność: brak = wstrzymany/0”), commity `3f00533` i `abe5f14`. Źródło prawdy dla całego I15 to
teraz **`origin/main` na `abe5f14`**, nie `7d6cfc9`. Poniżej zakres, który dochodzi do tej karty.

**Dochodzi do zakresu (z #104):** `generate_selly_export.cjs` — **eksport CSV zawiera tylko produkty `aktywny`**
(wstrzymane wypadają) i **zapis pliku jest atomowy**. To zmiana zachowania widoczna w liczbie wierszy pliku — opisz
pomiar (ile wierszy przed i po) w karcie.
**Styk z nową kartą I15.10:** `availability_sync.cjs` uruchamia generator w osobnym procesie po każdej zmianie
dostępności. Twój generator (i polecenie CLI z #102) musi dać się tak wywołać — uzgodnij interfejs i zapisz go
w „Do koordynatora”; sam `availability_sync` należy do I15.10.
