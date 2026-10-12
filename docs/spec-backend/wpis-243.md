# Wpis 243 — składniki kosztu przesyłki

`partner_kraje.myto_eur`, `pakowanie_eur` (domyślnie 0). Przesyłka ze stałej bazy kraju: `przesylka_stala_eur × (1 + paliwo %/100) + myto_eur + pakowanie_eur`; paliwo = `paliwo_historia` na dzień wyceny. PUT /api/partnerzy/:id/kraje/:kraj przyjmuje opcjonalne `paliwoProc` (nowy okres od dziś); szczegóły partnera zwracają `paliwoProc` kraju. Ścieżka GEIS (brak bazy) bez zmian.
