# Wpis 271 — włączenie publikacji cenników

`PARTNERZY_KATALOGI_PUBLIKACJI` przychodzi z sekretu GitHub jako trzecia linia stdin skryptu wdrożenia (`zapisz_wartosc_w_env`). Krok `2026-10-14-partnerzy-publikacja-wlaczona` (produkcja) włącza `PARTNERZY_SCHEDULER=true` i ustawia `harmonogram_minuty=60` partnerom TyreWorld/Adtyres bez harmonogramu; odkłada się, gdy katalog z mapowania nie istnieje.
