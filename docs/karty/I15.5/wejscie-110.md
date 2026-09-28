# Wejście dla I15.5 od ticketu 110 (koordynator, triaż 22.09 wieczór) · 2026-09-22

⚠ Produkcja dołożyła 22.09 dwie duże zmiany (backlog **#103** „braki w cenniku / bezpieczeństwo źródła”
i **#104** „dostępność: brak = wstrzymany/0”), commity `3f00533` i `abe5f14`. Źródło prawdy dla całego I15 to
teraz **`origin/main` na `abe5f14`**, nie `7d6cfc9`. Poniżej zakres, który dochodzi do tej karty.

Zakres tej karty **bez zmian** (przycisk i okno „Rozstrzygnij”), ale uwaga na kolejność: FE z #103
(**panel „Braki w cenniku” i podgląd starej karty**) dostał osobną kartę **I15.11**, która idzie PO Tobie i rusza
ten sam widok Staging. Zostaw w kodzie czytelny punkt wejścia i opisz w „Do koordynatora”, gdzie I15.11 ma się wpiąć.
⚠ Zmiany FE z 22.09 poszły w **ŻYWY bundel** `index-PRICEFMT1783512500.js`, nie w łatkę wstrzykiwaną — I15.11 czyta
je z `origin/main:abe5f14`.
