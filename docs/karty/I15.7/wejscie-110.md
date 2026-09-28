# Wejście dla I15.7 od ticketu 110 (koordynator, triaż 22.09 wieczór) · 2026-09-22

⚠ Produkcja dołożyła 22.09 dwie duże zmiany (backlog **#103** „braki w cenniku / bezpieczeństwo źródła”
i **#104** „dostępność: brak = wstrzymany/0”), commity `3f00533` i `abe5f14`. Źródło prawdy dla całego I15 to
teraz **`origin/main` na `abe5f14`**, nie `7d6cfc9`. Poniżej zakres, który dochodzi do tej karty.

**Dochodzi do zakresu (z #104), jeśli karta jeszcze trwa:** `selly/sync_full.cjs` — **Tor 2 pomija produkty
wstrzymane po rozpoczęciu cyklu** (3 linie w `abe5f14`). Portuj `sync_full` ze stanu `abe5f14`, nie `7d6cfc9`.
Jeśli karta jest już zamknięta na starszym stanie — zgłoś to w „Do koordynatora”, dopiszemy różnicę do I15.10.
Reszta zakresu (mapper_v2, #81) bez zmian.
