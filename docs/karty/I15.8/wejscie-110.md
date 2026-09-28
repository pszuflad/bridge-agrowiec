# Wejście dla I15.8 od ticketu 110 (koordynator, triaż 22.09 wieczór) · 2026-09-22

⚠ Produkcja dołożyła 22.09 dwie duże zmiany (backlog **#103** „braki w cenniku / bezpieczeństwo źródła”
i **#104** „dostępność: brak = wstrzymany/0”), commity `3f00533` i `abe5f14`. Źródło prawdy dla całego I15 to
teraz **`origin/main` na `abe5f14`**, nie `7d6cfc9`. Poniżej zakres, który dochodzi do tej karty.

**Bez zmian w zakresie**, ale montaż rośnie: oprócz jednej instancji `discovery` dla Toru 1 i Toru 2 dochodzi
**`availability_sync` (karta I15.10)** — moduł uruchamiany przy zmianie dostępności, który woła generator CSV
i deltę. Ustal z I15.10, kto montuje go w serwerze, i opisz w karcie.
