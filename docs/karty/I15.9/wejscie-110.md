# Wejście dla I15.9 od ticketu 110 (koordynator, triaż 22.09 wieczór) · 2026-09-22

⚠ Produkcja dołożyła 22.09 dwie duże zmiany (backlog **#103** „braki w cenniku / bezpieczeństwo źródła”
i **#104** „dostępność: brak = wstrzymany/0”), commity `3f00533` i `abe5f14`. Źródło prawdy dla całego I15 to
teraz **`origin/main` na `abe5f14`**, nie `7d6cfc9`. Poniżej zakres, który dochodzi do tej karty.

**Do delty dla Ani dochodzą jej zmiany z 22.09 wieczorem** (#103, #104) — najważniejsze dla niej:
- **„Braki w cenniku”** w panelu i podgląd starej karty (I15.11);
- **brak produktu w cenniku = wstrzymany i stan 0**, automatycznie; ręczne wstrzymania są chronione (I15.4);
- **CSV dla Selly zawiera tylko aktywne produkty** (I15.3), a zmiana dostępności od razu odświeża CSV i wysyła
  zmiany do Selly (I15.10);
- wycofanie wymaga trzech kompletnych ofert i 24 h — koniec fałszywych wycofań (I15.4).
Forma jak w `wejscie-104b.md`: co zmieniono → polecenie → rezultat.
